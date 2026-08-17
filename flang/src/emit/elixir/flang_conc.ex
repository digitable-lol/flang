# SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov)
# SPDX-License-Identifier: BSD-2-Clause

defmodule Flang.Proc do
  @moduledoc """
  Процесс flang как процесс BEAM.

  ## Зачем это, а не своя машина

  Контракт модели конкурентности (`flang/conc/SPEC.md`, раздел «Свою BEAM писать
  не надо — надо в неё печатать») решает так: процесс flang ложится на процесс
  BEAM, надзор — на супервизор OTP. Всё, ради чего затевалась модель, достаётся
  тогда в настоящем виде, а не в приблизительном: вытеснение по счёту редукций,
  куча и сборщик мусора у каждого процесса по отдельности, планировщик на каждое
  ядро, распределённость и горячая загрузка.

  Отображение ровно такое:

      процесс flang       → GenServer
      состояние процесса  → состояние GenServer
      обработчик          → чистая функция flang, вызываемая из handle_info
      почтовый ящик       → почтовый ящик процесса BEAM
      отправить           → send
      отложить            → send самому себе (уходит ЗА уже пришедшие)
      продолжить          → {:noreply, …, {:continue, …}}
      через … отправить   → Process.send_after
      остановить          → {:stop, …}

  ## Обработчик остаётся чистым, действия исполняются после возврата

  Обработчик — обычная функция flang: принимает состояние и сообщение,
  возвращает запись из нового состояния и списка действий. Ни одного действия он
  не выполняет — он их ОПИСЫВАЕТ. Исполняет их `perform/3` уже после того, как
  функция вернула значение. Это не украшение: пока обработчик чист, он
  проверяется примерами, сверяется с интерпретатором и попадает под анализ
  завершаемости — то есть остаётся обычным кодом языка, а не особым.

  ## «Продолжить» — это handle_continue, и это редкое точное совпадение

  Контракт требует от `продолжить`: то же сообщение возвращается в ГОЛОВУ ящика,
  а планировщик получает управление. На BEAM в голову собственного ящика
  положить нечего — ящик читается только с головы, а пишется только в хвост. Но
  `{:noreply, state, {:continue, term}}` даёт ровно требуемое: `handle_continue`
  выполнится ПЕРЕД любым сообщением из ящика, но уже после возврата из
  обработчика — то есть процесс отдал управление, а очередь не обогнала его.
  Совпадение полное, и притворяться тут ничем не пришлось.

  ## Ящик переживает перезапуск, и это пришлось напечатать руками

  Контракт (раздел «Перезапуск точен») решает иначе, чем BEAM: перезапуск трогает
  только состояние, а ящик остаётся — сообщение здесь значение в общей арене, а
  не копия в чужой куче, и терять уже принятые сообщения из-за того, что
  обработчик споткнулся об одно из них, было бы потерей данных без нужды.

  На BEAM ящик умирает вместе с процессом. Поэтому обещание языка приходится
  печатать явно: процесс ловит выходы (`trap_exit`), в `terminate/2` вычерпывает
  остаток своего ящика в хранилище, а следующее воплощение забирает его в
  `init/1` и досылает себе. Порядок при этом сохраняется, а сообщение, на котором
  процесс упал, не возвращается: оно снято с ящика до пробега, и вечного круга
  «упал — подняли — упал на том же» не выходит.

  Дырка тут одна, и она названа: между смертью процесса и регистрацией нового
  воплощения имя не зарегистрировано, и сообщение, отправленное ровно в это
  окно, пропадает. У эталона такого окна нет вовсе.

  ## Запас витков: почему он остался, хотя BEAM вытесняет сама

  Соблазн выбросить велик: на BEAM вытеснение своё, по счёту редукций, и длинный
  обработчик не остановит остальных. Но запас витков заведён не ради этого.

  Вытеснение спасает СОСЕДЕЙ, а не сам процесс. Обработчик, который не
  завершается, на BEAM не остановится никогда: он будет крутиться, занимая ядро,
  а его ящик будет расти, пока узел не съест всю память. Никакого исхода из этого
  не следует — а контракт требует именно исхода: «исчерпание запаса — не
  зависание и не молчаливый обрыв». Поэтому запас остаётся, и считает его тот же
  счётчик, что и в остальных целях (`Flang.Rt.step`), — с той разницей, что
  здесь он лежит в словаре процесса, а словарь у процесса BEAM свой. Два
  обработчика не мешают друг другу не по договорённости, а по устройству.

  Тотальный обработчик не платит за это ничего: `Flang.Rt.enter/step` печатаются
  только в функции, способные к рекурсии, а тотальный обработчик без рекурсии их
  не содержит вовсе. Доказанная тотальность здесь — право не называть запас, а не
  ускорение планировщика.
  """

  use GenServer

  @doc """
  Запуск под супервизором OTP.

  Имя BEAM — из имени процесса flang: набор процессов задан объявлением и не
  растёт, поэтому таблица атомов не может распухнуть.

  Здесь стояло «`породить` в модели нет». Это неправда с 16 августа 2026:
  порождение есть и в модели (`flang/src/conc.mjs`), и в цели C
  (`flang/src/emit/c/flang_conc.c`, `fl_conc_spawn`). Нет его У ЭТОЙ ЦЕЛИ — и
  довод про таблицу атомов держится именно этим, а не свойством языка.
  Планировщик Elixir отвечает на `породить` названной ошибкой, а не делает молча
  не то; отсутствие стережёт `БЕЗ_ПОРОЖДЕНИЯ` в
  `flang/test/emit-elixir-conc.test.mjs`. Появится порождение здесь — снимать
  надо и исключение теста, и этот довод: динамические имена атомов таблицу
  распухнуть уже позволят.
  """
  def start_link(spec) do
    GenServer.start_link(__MODULE__, spec, name: Flang.Conc.registered(spec.name))
  end

  @doc "Описание ребёнка: вид перезапуска задаёт стратегия надзора flang."
  def child_spec(spec) do
    %{
      id: {:flang_proc, spec.name},
      start: {__MODULE__, :start_link, [spec]},
      restart: spec.restart,
      shutdown: 5_000,
      type: :worker
    }
  end

  @impl true
  def init(spec) do
    # Ловля выходов нужна ради terminate/2: без неё супервизор, гасящий
    # поддерево, убил бы процесс молча, и ящик пропал бы вместе с ним.
    Process.flag(:trap_exit, true)
    Flang.Conc.running(spec.name)
    value = initial_state(spec)
    Flang.Conc.remember_state(spec.name, value)
    Enum.each(Flang.Conc.take_kept(spec.name), fn message -> send(self(), message) end)
    {:ok, %{spec: spec, value: value}}
  end

  # Начальное состояние — функция без параметров, и она чиста. Перезапуск
  # поэтому даёт ровно то же значение, что и первый запуск: пересчитывать чистую
  # функцию и брать сохранённое значение здесь одно и то же.
  defp initial_state(spec) do
    apply(spec.module, :new_context, [])
    apply(spec.module, :call, [spec.initial, []])
  end

  @impl true
  def handle_info({:flang, message}, st), do: run(st, message)

  def handle_info({:flang_timer, ref, message}, st) do
    Flang.Conc.timer_delivered(ref)
    run(st, message)
  end

  # Чужое сообщение — не отказ: в почтовый ящик процесса BEAM вправе написать
  # кто угодно, а модель говорит только о сообщениях flang.
  def handle_info(_other, st), do: {:noreply, st}

  @impl true
  def handle_cast({:flang, message}, st), do: run(st, message)
  def handle_cast(_other, st), do: {:noreply, st}

  @impl true
  def handle_continue({:flang, message}, st), do: run(st, message)

  @doc """
  Состояние процесса по требованию.

  Нужен всякому, кто встраивает напечатанную программу в живую систему: состояние
  процесса flang — значение, и прочитать его снаружи можно только спросив.
  """
  @impl true
  def handle_call(:flang_state, _from, st), do: {:reply, st.value, st}
  def handle_call(_other, _from, st), do: {:reply, :nothing, st}

  @impl true
  def terminate(_reason, st) do
    # Остаток ящика уходит следующему воплощению — см. @moduledoc.
    Flang.Conc.keep(st.spec.name, drain([]))
    :ok
  end

  defp drain(acc) do
    receive do
      {:flang, _} = message -> drain([message | acc])
      {:flang_timer, _, _} = message -> drain([message | acc])
    after
      0 -> Enum.reverse(acc)
    end
  end

  # ── пробег обработчика ──────────────────────────────────────────────────────

  defp run(st, message) do
    spec = st.spec
    Flang.Conc.run_started(spec.name)

    try do
      apply(spec.module, :new_context, [])
      if spec.budget != nil, do: Flang.Rt.set_max_steps(spec.budget)
      response = apply(spec.module, :call, [spec.handler, [st.value, message]])
      value = response_state(response, spec)
      actions = response_actions(response, spec)
      Flang.Conc.remember_state(spec.name, value)
      outcome = perform(actions, %{st | value: value}, message)
      # Пометка «занят» снимается ПОСЛЕ действий, а не после обработчика:
      # действия — часть пробега, и наблюдатель, снявший её раньше, увидел бы
      # покой в тот миг, когда сообщение уже описано, но ещё не отправлено.
      Flang.Conc.run_finished(spec.name)
      outcome
    rescue
      error in Flang.Error ->
        # Три вида отказа контракта сходятся в одну точку: исчерпание запаса,
        # ошибка выполнения и негодный отклик. Три разных пути к надзору
        # означали бы три разных поведения надзора, и они бы разошлись.
        code = failure_code(error, spec)
        Flang.Conc.note_failure(spec.name, code, Exception.message(error))
        Flang.Conc.run_finished(spec.name)
        # Отказ обязан дойти до супервизора OTP ненормальной причиной: только по
        # ней он отличает «упал» от «закончил работу».
        stop(st, {:flang_failure, code})
    end
  end

  # Исчерпание запаса — это FLANG_BUDGET_EXHAUSTED, а не «предел рекурсии»:
  # предел здесь назван программой (`с запасом N витков`), и исход у него свой.
  # Решает признак тотальности, а не наличие запаса, — ровно как у эталона: у
  # тотального обработчика упереться в предел можно только по ошибке движка, и
  # называть это исчерпанием названного запаса было бы неправдой.
  defp failure_code(error, spec) do
    if not spec.total and error.code == Flang.Rt.code_recursion_limit() do
      "FLANG_BUDGET_EXHAUSTED"
    else
      error.code
    end
  end

  # Отклик обязан быть записью из нового состояния и списка действий. Тексты
  # диагностик дословно те же, что у планировщика эталона (conc.mjs).
  defp response_state({:rec, fields}, spec) do
    case Flang.Rt.lookup(fields, "состояние") do
      {:ok, value} ->
        value

      :error ->
        raise Flang.Rt.fail(
                "FLANG_PROCESS",
                "отклик обработчика «" <> spec.handler <> "» не содержит поле «состояние»"
              )
    end
  end

  defp response_state(_other, spec) do
    raise Flang.Rt.fail(
            "FLANG_PROCESS",
            "обработчик «" <> spec.handler <> "» вернул не запись отклика"
          )
  end

  defp response_actions({:rec, fields}, spec) do
    case Flang.Rt.lookup(fields, "действия") do
      {:ok, {:list, _, _} = actions} ->
        Enum.map(Flang.Rt.items(actions), fn action -> check_action(action, spec) end)

      _ -> raise Flang.Rt.fail("FLANG_PROCESS", actions_message(spec))
    end
  end

  defp actions_message(spec) do
    "поле «действия» отклика обработчика «" <> spec.handler <> "» должно быть списком действий"
  end

  @known_actions ["отправить", "через", "остановить", "отложить", "продолжить"]

  defp check_action({:var, name, fields}, spec) do
    if name in @known_actions do
      {name, fields}
    else
      raise Flang.Rt.fail(
              "FLANG_PROCESS",
              "неизвестное действие «" <> name <> "» в отклике обработчика «" <> spec.handler <> "»"
            )
    end
  end

  defp check_action(_other, spec) do
    raise Flang.Rt.fail(
            "FLANG_PROCESS",
            "в списке «действия» обработчика «" <> spec.handler <> "» не действие"
          )
  end

  # ── действия ────────────────────────────────────────────────────────────────
  #
  # Порядок исполнения — порядок списка, как у эталона. «Остановить» не
  # прерывает перебор: сообщения, описанные после него, всё равно уходят —
  # процесс успел их описать, а описанное действие не отменяется тем, что
  # описавший завершился.

  defp perform(actions, st, message) do
    outcome = Enum.reduce(actions, %{stop: nil, continue: false}, &act(&1, &2, message))

    cond do
      outcome.stop == "норма" ->
        # Нормальная остановка не отказ: transient-ребёнок после неё не
        # поднимается, и надзор о ней не узнаёт — как :normal в BEAM.
        stop(st, :normal)

      outcome.stop != nil ->
        # Остановка с причиной, отличной от «нормы», — отказ (контракт, «Отказ,
        # надзор, перезапуск»), и код у него тот же, что у эталона.
        Flang.Conc.note_failure(st.spec.name, "FLANG_STOPPED", outcome.stop)
        stop(st, {:flang_stopped, outcome.stop})

      outcome.continue ->
        {:noreply, st, {:continue, {:flang, message}}}

      true ->
        {:noreply, st}
    end
  end

  # Процесс решил остановиться — и об этом надо сказать вслух, ДО возврата.
  #
  # Между «обработчик кончился остановкой» и «процесса больше нет» на BEAM лежит
  # промежуток: gen_server ещё позовёт terminate/2, а планировщик машины вправе
  # снять процесс с ядра посреди этого. Под нагрузкой промежуток растягивается до
  # миллисекунд, и наблюдатель, спрашивающий «все ли угомонились», видел бы
  # процесс живым, незанятым и с пустым ящиком — то есть спокойным. Итог прогона
  # от этого расходился с эталоном (остановленный процесс попадал в живые) — на
  # свободной машине раз на триста прогонов, под нагрузкой чаще. Метка снимается
  # заводом следующего воплощения (init/1).
  defp stop(st, reason) do
    Flang.Conc.stopping(st.spec.name)
    {:stop, reason, st}
  end

  defp act({"отправить", fields}, acc, _message) do
    Flang.Conc.send_to(field_text(fields, "кому"), field_value(fields, "что"))
    acc
  end

  defp act({"через", fields}, acc, _message) do
    Flang.Conc.send_after(
      field_text(fields, "кому"),
      field_value(fields, "что"),
      field_delay(fields, "задержка")
    )

    acc
  end

  defp act({"отложить", _fields}, acc, message) do
    # В хвост собственного ящика — то есть ЗА уже пришедшие. Ровно этого требует
    # контракт, и BEAM даёт это одной строкой, потому что писать в ящик можно
    # только в хвост. Метка `:flang` обязательна: без неё сообщение вернулось бы
    # в ящик неотличимым от чужого и было бы выброшено как чужое.
    send(self(), {:flang, message})
    acc
  end

  defp act({"продолжить", _fields}, acc, _message), do: %{acc | continue: true}

  defp act({"остановить", fields}, acc, _message) do
    %{acc | stop: field_text(fields, "почему")}
  end

  defp field_value(fields, name) do
    case Flang.Rt.lookup(fields, name) do
      {:ok, value} -> value
      :error -> raise Flang.Rt.fail("FLANG_PROCESS", "у действия нет поля «" <> name <> "»")
    end
  end

  defp field_text(fields, name) do
    case field_value(fields, name) do
      {:str, text} -> text
      other -> raise Flang.Rt.fail("FLANG_PROCESS", field_message(name, other))
    end
  end

  defp field_message(name, value) do
    "поле «" <> name <> "» действия должно быть строкой, получено " <> Flang.Rt.type_name(value)
  end

  # Задержка таймера — миллисекунды настоящих часов. У эталона единица времени
  # другая (пробег обработчика), и это записано в контракте отдельным абзацем:
  # проверочный режим и рабочий совпадают по НАБОРУ исходов, но не по времени.
  defp field_delay(fields, name) do
    case field_value(fields, name) do
      {:num, value} when is_float(value) and value > 0.0 -> trunc(value)
      _ -> 0
    end
  end
end

defmodule Flang.Conc do
  @moduledoc """
  Надзор flang как дерево супервизоров OTP, и наблюдение за прогоном.

  ## Три стратегии против одной интенсивности

  Стратегия в flang названа ЗА КАЖДЫМ ребёнком по отдельности:

      надзор «Смена»
        процесс «Отгрузка» стратегия «передать выше»
        процесс «Склад» стратегия «перезапустить»

  У супервизора OTP перезапуск ребёнка тоже настраивается по ребёнку
  (`:permanent`, `:transient`, `:temporary`), но «передать выше» настройкой
  ребёнка не выражается вовсе: супервизор OTP уходит наверх, только исчерпав
  СВОЮ интенсивность перезапусков, а интенсивность — свойство супервизора, а не
  ребёнка. Отсюда устройство, которое иначе выглядело бы нагромождением: на один
  надзор flang приходится до трёх супервизоров OTP, и у каждого своя
  интенсивность.

      S_верх  (интенсивность 0 — любой перезапуск здесь означает «выше»)
        ├── S_выше (интенсивность 0)   ← дети со стратегией «передать выше»
        ├── S_снова (интенсивность = порог отказов) ← дети «перезапустить»
        └── дети «остановить» напрямую, :temporary

  Читается это так. Ребёнок со стратегией «перезапустить» лежит под S_снова, и
  его падение S_снова гасит сам — до S_верх оно не доходит. Ребёнок со
  стратегией «передать выше» лежит под S_выше, у которого интенсивность 0: первое
  же падение обязывает S_выше перезапустить ребёнка, а перезапускать ему нельзя
  — S_выше умирает, вслед за ним умирает S_верх (у него интенсивность тоже 0), и
  отказ оказывается там, где и должен: у надзора ступенью выше. Ребёнок со
  стратегией «остановить» — `:temporary`, его смерть не считается перезапуском
  вовсе и никого не будит.

  Порог отказов ложится на `max_restarts`/`max_seconds` супервизора S_снова, а
  слово `иначе` — на вид его собственного перезапуска: «передать выше» —
  `:permanent` (смерть S_снова убивает S_верх), «остановить» — `:temporary`
  (смерть S_снова никого не будит), «перезапустить» — порог не наступает никогда,
  и `max_restarts` ставится заведомо недостижимый.

  Вид перезапуска процесса — `:transient`, а не `:permanent`, и это не мелочь:
  `остановить «норма»` обязано оставить процесс остановленным, а `:permanent`
  поднял бы его обратно. Вложенный надзор, наоборот, `:permanent`: нормальной
  остановки у надзора не бывает, а умирает он с причиной `:shutdown`, которую
  `:transient` считает нормальной и не поднимает.

  ## Где это расходится с эталоном

  1. **Порог считает не то же самое.** У эталона в окно порога попадают ВСЕ
     отказы, дошедшие до надзора; у OTP `max_restarts` считает только
     перезапуски внутри S_снова, то есть отказы детей со стратегией
     «перезапустить». В надзоре со смешанными стратегиями счёт разойдётся.
  2. **Окно измеряется по-разному.** У эталона единица — пробег обработчика (это
     записано в контракте как расхождение шага 3), у OTP — секунда настоящих
     часов, и меньше секунды окна не бывает вовсе.
  3. **«Остановить» по порогу останавливает группу.** У эталона запасная
     стратегия применяется к упавшему процессу; здесь умирает S_снова, а с ним
     все дети со стратегией «перезапустить» у этого надзора.

  ## Наблюдение: почему таблица, а не опрос процессов

  У эталона итог прогона виден просто так — он весь в его памяти. На BEAM
  состояние процесса умирает вместе с процессом, а прогон, кончившийся отказом
  доверху, только из мёртвых процессов и состоит. Поэтому каждый пробег
  записывает новое состояние в общую таблицу ETS, а каждое начало пробега —
  строку журнала с номером из общего счётчика. Стоимость честная: две записи в
  ETS на пробег, и общий счётчик, который слегка сериализует старты пробегов.
  Зато итог прогона наблюдаем целиком — включая состояния тех, кого уже нет.

  Номер из общего счётчика берётся В НАЧАЛЕ пробега, поэтому журнал — законная
  линеаризация: два пробега в разных процессах не видят состояния друг друга и
  переставимы, а причинная связь «отправил — получил» порядок сохраняет, потому
  что отправка идёт после начала своего пробега и до начала чужого.

  ## Покой определяется наблюдением, а не знанием

  У эталона исход «покой» точен: он видит, что очередь готовых пуста. На BEAM
  такого знания нет ни у кого — «никому нечего делать» не событие, а вывод.
  Поэтому здесь он и делается выводом: несколько раз подряд с промежутком
  оказалось, что ни один процесс не занят, все ящики пусты, ни один таймер ещё
  не сработал, а общий счётчик пробегов не сдвинулся. Это наблюдение, а не
  доказательство, и называть его иначе было бы неправдой.
  """

  @table :flang_conc

  # Порог, который не наступает никогда: `перезапустить` без порога отказов и
  # `иначе «перезапустить»` — это «поднимать сколько угодно раз».
  @forever 1_000_000_000

  # Пределы прогона. Оба существуют ради одного: у прогона обязан быть исход.
  @default_max_turns 1_000_000
  @default_deadline_ms 30_000

  # ── имена и отправка ────────────────────────────────────────────────────────

  @doc "Имя BEAM для процесса flang."
  def registered(name), do: String.to_atom("flang:" <> name)

  @doc """
  Отправка сообщения процессу flang по имени.

  Мёртвому процессу писать некуда, и это не ошибка отправителя: он не обязан
  знать, что адресат уже остановился, — ровно так же, как в BEAM.
  """
  def send_to(name, value) do
    case Process.whereis(registered(name)) do
      nil -> :ok
      pid -> send(pid, {:flang, value})
    end

    :ok
  end

  @doc """
  Таймер: «через N миллисекунд отправить».

  Имя адресата, а не pid: к моменту срабатывания процесс мог быть перезапущен, и
  тогда сообщение обязано достаться новому воплощению, а не старому. Если
  адресата нет вовсе, BEAM молча выбросит сообщение — то же самое делает и
  `send_to`.
  """
  def send_after(name, value, delay) do
    ref = make_ref()
    :ets.insert(@table, {{:timer, ref}, now_ms() + delay})
    Process.send_after(registered(name), {:flang_timer, ref, value}, delay)
    :ok
  end

  @doc "Таймер сработал и дошёл: из счёта неспящих его пора убрать."
  def timer_delivered(ref) do
    :ets.delete(@table, {:timer, ref})
    :ok
  end

  # ── таблица наблюдения ──────────────────────────────────────────────────────

  @doc "Новая таблица наблюдения. Владелец — тот, кто позвал: прогон свой у каждого."
  def reset do
    if :ets.whereis(@table) != :undefined, do: :ets.delete(@table)
    ensure_table()
  end

  @doc """
  Таблица, если её ещё нет.

  Нужна не только наблюдению: через неё же передаётся ящик умирающего процесса
  следующему воплощению, а это уже семантика, а не измерение. Поэтому дерево без
  таблицы не поднимается.
  """
  def ensure_table do
    if :ets.whereis(@table) == :undefined do
      :ets.new(@table, [
        :named_table,
        :public,
        :set,
        write_concurrency: true,
        read_concurrency: true
      ])

      :ets.insert(@table, [{:seq, 0}, {:failures, 0}])
    end

    :ok
  end

  @doc "Состояние процесса после пробега (и при заводе)."
  def remember_state(name, value) do
    :ets.insert(@table, {{:state, name}, value})
    :ok
  end

  @doc "Последнее известное состояние процесса — даже если процесса уже нет."
  def state_of(name) do
    case :ets.lookup(@table, {:state, name}) do
      [{_key, value}] -> value
      [] -> :nothing
    end
  end

  @doc "Начало пробега: номер в журнале и пометка «занят»."
  def run_started(name) do
    seq = :ets.update_counter(@table, :seq, {2, 1})
    :ets.insert(@table, [{{:journal, seq}, name}, {{:busy, name}, true}])
    seq
  end

  @doc "Конец пробега — успешного или отказавшего."
  def run_finished(name) do
    :ets.insert(@table, {{:busy, name}, false})
    :ok
  end

  @doc "Процесс решил остановиться, но ещё не остановился — см. `Flang.Proc`."
  def stopping(name) do
    :ets.insert(@table, {{:stopping, name}, true})
    :ok
  end

  @doc "Новое воплощение процесса: метка остановки снимается."
  def running(name) do
    :ets.insert(@table, [{{:stopping, name}, false}, {{:busy, name}, false}])
    :ok
  end

  @doc "Отказ процесса: код и текст, в порядке случившегося."
  def note_failure(name, code, message) do
    number = :ets.update_counter(@table, :failures, {2, 1})
    :ets.insert(@table, {{:failure, number}, {name, code, message}})
    :ok
  end

  @doc "Ящик умирающего процесса — следующему воплощению."
  def keep(_name, []), do: :ok

  def keep(name, messages) do
    :ets.insert(@table, {{:kept, name}, messages})
    :ok
  end

  @doc "Ящик, оставшийся от прошлого воплощения. Забирается ровно один раз."
  def take_kept(name) do
    case :ets.take(@table, {:kept, name}) do
      [{_key, messages}] -> messages
      [] -> []
    end
  end

  @doc "Сколько пробегов случилось за прогон."
  def turns do
    [{:seq, value}] = :ets.lookup(@table, :seq)
    value
  end

  # ── дерево супервизоров ─────────────────────────────────────────────────────

  @doc """
  Поднять всё дерево программы.

  Корень — тоже супервизор, и у него интенсивность 0: смерть надзора верхней
  ступени обязана останавливать программу целиком. Это исход «отказ дошёл
  доверху» из контракта, а не молчаливое продолжение работы с мёртвым процессом
  внутри. Процесс, не стоящий ни под каким надзором, висит прямо на корне
  `:temporary` — упал и остался лежать, как и говорит контракт.
  """
  def start(module) do
    ensure_table()
    plan = apply(module, :conc_plan, [])

    Supervisor.start_link(root_children(module, plan),
      strategy: :one_for_one,
      max_restarts: 0,
      max_seconds: 1
    )
  end

  defp root_children(module, plan) do
    nested = for sup <- plan.supervisors, {name, _strategy} <- sup.nested, do: name
    watched = for sup <- plan.supervisors, {name, _strategy} <- sup.watch, do: name

    tops =
      for sup <- plan.supervisors, sup.name not in nested do
        supervisor_child(module, plan, sup, :permanent)
      end

    loose =
      for process <- plan.processes, process.name not in watched do
        process_child(module, process, :temporary)
      end

    tops ++ loose
  end

  defp supervisor_child(module, plan, sup, restart) do
    %{
      id: {:flang_sup, sup.name},
      start:
        {Supervisor, :start_link,
         [levels(module, plan, sup), [strategy: :one_for_one, max_restarts: 0, max_seconds: 1]]},
      restart: restart,
      shutdown: :infinity,
      type: :supervisor
    }
  end

  # Три уровня одного надзора flang — см. @moduledoc.
  defp levels(module, plan, sup) do
    escalating = children_with(module, plan, sup, "передать выше")
    restarting = children_with(module, plan, sup, "перезапустить")
    stopping = children_with(module, plan, sup, "остановить")

    group(escalating, {:flang_escalate, sup.name}, :permanent, 0, 1) ++
      group(
        restarting,
        {:flang_restart, sup.name},
        restart_of_group(sup),
        max_restarts_of(sup),
        max_seconds_of(sup)
      ) ++ stopping
  end

  defp group([], _id, _restart, _max_restarts, _max_seconds), do: []

  defp group(children, id, restart, max_restarts, max_seconds) do
    [
      %{
        id: id,
        start:
          {Supervisor, :start_link,
           [
             children,
             [strategy: :one_for_one, max_restarts: max_restarts, max_seconds: max_seconds]
           ]},
        restart: restart,
        shutdown: :infinity,
        type: :supervisor
      }
    ]
  end

  # Дети надзора с одной стратегией: сперва процессы, потом вложенные надзоры —
  # в порядке объявления, потому что порядок наблюдаем везде, где его видно.
  defp children_with(module, plan, sup, strategy) do
    processes =
      sup.watch
      |> Enum.filter(fn {_name, own} -> own == strategy end)
      |> Enum.flat_map(fn {name, _own} ->
        case find(plan.processes, name) do
          nil ->
            []

          process ->
            # Процесс — :transient: остановка «норма» отказом не считается, а
            # :permanent поднял бы процесс и после неё.
            [process_child(module, process, restart_of_child(strategy, :transient))]
        end
      end)

    nested =
      sup.nested
      |> Enum.filter(fn {_name, own} -> own == strategy end)
      |> Enum.flat_map(fn {name, _own} ->
        case find(plan.supervisors, name) do
          nil ->
            []

          inner ->
            # Надзор — :permanent: умирает он только с причиной :shutdown, а её
            # :transient принял бы за нормальную остановку и поднимать не стал.
            [supervisor_child(module, plan, inner, restart_of_child(strategy, :permanent))]
        end
      end)

    processes ++ nested
  end

  defp restart_of_child("остановить", _alive), do: :temporary
  defp restart_of_child(_strategy, alive), do: alive

  defp find(list, name), do: Enum.find(list, fn item -> item.name == name end)

  defp process_child(module, process, restart) do
    Flang.Proc.child_spec(%{
      module: module,
      name: process.name,
      handler: process.handler,
      initial: process.initial,
      total: process.total,
      budget: process.budget,
      restart: restart
    })
  end

  defp restart_of_group(%{threshold: nil}), do: :permanent

  defp restart_of_group(%{threshold: threshold}) do
    if threshold.otherwise == "остановить", do: :temporary, else: :permanent
  end

  defp max_restarts_of(%{threshold: nil}), do: @forever

  defp max_restarts_of(%{threshold: threshold}) do
    if threshold.otherwise == "перезапустить", do: @forever, else: threshold.failures
  end

  # Окно порога — миллисекунды в поверхности языка, секунды у OTP, и меньше
  # секунды окна там не бывает. Округление вверх — то, что честнее: окно, ставшее
  # нулём, отменило бы порог вовсе.
  defp max_seconds_of(%{threshold: nil}), do: 1

  defp max_seconds_of(%{threshold: threshold}) do
    max(1, div(trunc(threshold.window) + 999, 1000))
  end

  # ── прогон ──────────────────────────────────────────────────────────────────

  @doc """
  Прогон программы: поднять дерево, разнести входные сообщения, дождаться покоя,
  снять итог, погасить дерево.

  Отдельным процессом — ради уборки: он владеет таблицей наблюдения и связан с
  корнем дерева, поэтому после ответа не остаётся ни таблицы, ни живых процессов,
  какой бы ни вышел исход.
  """
  def run(module, name), do: run(module, name, [])

  def run(module, name, options) do
    parent = self()

    {pid, ref} =
      spawn_monitor(fn -> send(parent, {:flang_run, self(), inside(module, name, options)}) end)

    receive do
      {:flang_run, ^pid, result} ->
        Process.demonitor(ref, [:flush])
        result

      {:DOWN, ^ref, :process, ^pid, reason} ->
        {:error, "прогон не состоялся: " <> inspect(reason)}
    end
  end

  defp inside(module, name, options) do
    plan = apply(module, :conc_plan, [])

    case find(plan.runs, name) do
      nil ->
        {:error, "в программе нет прогона «" <> name <> "»"}

      run_node ->
        quiet()
        reset()
        Process.flag(:trap_exit, true)
        {:ok, root} = start(module)
        deliver(plan, run_node.inbox)

        outcome =
          settle(root, plan, %{
            deadline: now_ms() + Keyword.get(options, :deadline, @default_deadline_ms),
            cap: Keyword.get(options, :max_turns, @default_max_turns),
            stable: 0,
            seen: -1
          })

        result = snapshot(plan, name, outcome)
        # Гашение с ограничением по времени: без него `Supervisor.stop` ждал бы
        # вечно, а прогон, не сумевший погасить дерево, обязан кончиться ошибкой,
        # а не молчанием. Десяти секунд хватает с большим запасом: у процессов на
        # выход по пять, и уходят они за микросекунды.
        if Process.alive?(root), do: Supervisor.stop(root, :shutdown, 10_000)
        result
    end
  end

  # Входные сообщения прогона кладутся в ящики ДО первого пробега — все сразу.
  #
  # Это не педантизм. «Дано «Счётчик» принимает …» у эталона значит «сообщение
  # уже в ящике, когда планировщик делает первый выбор». Разносить их по одному
  # живым процессам значило бы другое начальное условие: первый обработчик мог бы
  # успеть увидеть ящик, в котором ещё нет второго сообщения, — а это состояние,
  # которого у эталона не бывает вовсе, и в программе с `отложить` оно наблюдаемо
  # (отложенное сообщение вернулось бы в пустой ящик, то есть себе же в голову).
  #
  # Поэтому на время раздачи процессы приостанавливаются. Сообщения в ящики при
  # этом кладутся как обычно — приостановка останавливает исполнение, а не
  # доставку. Пользуется этим только прогон: настоящая работа начинается с
  # `start/1`, где никаких «всех сразу» не бывает и быть не может.
  defp deliver(plan, inbox) do
    running =
      plan.processes
      |> Enum.map(fn process -> Process.whereis(registered(process.name)) end)
      |> Enum.filter(fn pid -> pid != nil end)

    Enum.each(running, fn pid -> :erlang.suspend_process(pid) end)
    Enum.each(inbox, fn {process, value} -> send_to(process, value) end)
    Enum.each(running, fn pid -> :erlang.resume_process(pid) end)
    :ok
  end

  # Покой — вывод из наблюдения, а не событие (см. @moduledoc). Три совпавших
  # замера подряд с промежутком в две миллисекунды; между замерами проверяется
  # не только «никто не занят», но и то, что никто не собирается ожить:
  # процесс, решивший остановиться, помечает себя сам, а супервизор
  # опрашивается вызовом, который сам по себе ждёт конца перезапуска.
  defp settle(root, plan, watch) do
    cond do
      not Process.alive?(root) -> "отказ дошёл доверху"
      turns() > watch.cap -> "предел пробегов"
      now_ms() > watch.deadline -> "предел времени"
      true -> sample(root, plan, watch)
    end
  end

  defp sample(root, plan, watch) do
    Process.sleep(2)
    seen = turns()

    if idle?(plan, root) and seen == watch.seen do
      if watch.stable >= 2 do
        "покой"
      else
        settle(root, plan, %{watch | stable: watch.stable + 1, seen: seen})
      end
    else
      settle(root, plan, %{watch | stable: 0, seen: seen})
    end
  end

  defp idle?(plan, root) do
    not timers_pending?() and
      Enum.all?(plan.processes, fn process -> quiet?(process.name) end) and
      supervisors_quiet?(root)
  end

  @doc """
  Угомонились ли супервизоры — и почему без этого вопроса нельзя.

  Между смертью процесса и его перезапуском лежит ещё один промежуток: сигнал
  выхода уже в ящике супервизора, но супервизор до него ещё не дошёл. Всё это
  время процесса нет вовсе, счётчик пробегов стоит, ящики пусты — то есть
  снаружи это выглядит покоем, хотя работа только собирается продолжиться.

  Спрашивается это так: `which_children` — обычный синхронный вызов, и ответ на
  него приходит ПОСЛЕ того, как супервизор разобрал всё, что лежало в ящике до
  вопроса. То есть сам вопрос и есть ожидание конца перезапуска. Пустой ящик
  после ответа добивает остаток: если сигнал пришёл уже во время разговора,
  покой не объявляется, а замер повторится. И третье: ребёнок, про которого
  супервизор отвечает `:restarting`, — прямое «работа ещё не кончилась».
  """
  def supervisors_quiet?(root) do
    nodes = supervisor_tree(root)

    :restarting not in nodes and
      Enum.all?(nodes, fn pid ->
        Process.info(pid, :message_queue_len) == {:message_queue_len, 0}
      end)
  end

  defp supervisor_tree(pid) do
    children =
      pid
      |> Supervisor.which_children()
      |> Enum.flat_map(fn
        {_id, :restarting, _type, _modules} -> [:restarting]
        {_id, child, :supervisor, _modules} when is_pid(child) -> supervisor_tree(child)
        _other -> []
      end)

    [pid | children]
  catch
    # Супервизор мог умереть, пока мы спрашивали: с мёртвого спрос невелик.
    :exit, _reason -> [pid]
  end

  @doc """
  Жив ли процесс flang — и почему одного `whereis` мало.

  Имя, снятое с реестра, и процесс, переставший быть живым, — на BEAM это два
  разных мига. Процесс, начавший умирать, ещё несколько мгновений отвечает на
  `whereis` своим pid, но `Process.alive?` про него уже говорит правду: «не
  существует, не выходит, не вышел» — три условия сразу.

  Спрашивать надо оба, и одинаково в обоих местах: покой определялся по одному
  правилу, а итог снимался по другому — и прогон, кончившийся отказом
  Разборщика, объявлял его живым. На свободной машине это случалось раз на
  триста прогонов, под нагрузкой — раз на несколько десятков. Эталон такой щели
  не имеет вовсе: там процесс — запись в таблице, и «жив» у неё поле.
  """
  def alive?(name) do
    case Process.whereis(registered(name)) do
      nil -> false
      pid -> Process.alive?(pid)
    end
  end

  defp quiet?(name) do
    cond do
      # Мёртвого спрашивать не о чем.
      not alive?(name) -> true
      # Живой, но уже решивший умереть, спокойным не считается: итог снимается
      # по тому же признаку «жив», и разойтись они не имеют права.
      flag?(:stopping, name) -> false
      true -> idle_mailbox?(name)
    end
  end

  defp idle_mailbox?(name) do
    case Process.info(Process.whereis(registered(name)), :message_queue_len) do
      {:message_queue_len, 0} -> not flag?(:busy, name)
      {:message_queue_len, _} -> false
      # nil — процесс умер между двумя вопросами: делать ему больше нечего.
      nil -> true
    end
  end

  defp flag?(kind, name) do
    case :ets.lookup(@table, {kind, name}) do
      [{_key, value}] -> value
      [] -> false
    end
  end

  # Таймер, срок которого прошёл, уже сработал: сообщение либо в ящике (и тогда
  # ящик не пуст), либо выброшено, потому что адресата не стало. Отсрочка в две
  # миллисекунды — на дорогу от срока до ящика.
  defp timers_pending? do
    edge = now_ms() + 2
    Enum.any?(:ets.match(@table, {{:timer, :_}, :"$1"}), fn [at] -> at > edge end)
  end

  defp snapshot(plan, name, outcome) do
    %{
      run: name,
      outcome: outcome,
      turns: turns(),
      states: Enum.map(plan.processes, fn process -> {process.name, state_of(process.name)} end),
      alive: for(process <- plan.processes, alive?(process.name), do: process.name),
      journal: journal(),
      failures: failures()
    }
  end

  defp journal do
    @table
    |> :ets.match({{:journal, :"$1"}, :"$2"})
    |> Enum.sort_by(fn [seq, _name] -> seq end)
    |> Enum.map(fn [_seq, name] -> name end)
  end

  defp failures do
    @table
    |> :ets.match({{:failure, :"$1"}, :"$2"})
    |> Enum.sort_by(fn [number, _what] -> number end)
    |> Enum.map(fn [_number, {name, code, _message}] -> {name, code} end)
  end

  defp now_ms, do: System.monotonic_time(:millisecond)

  @doc """
  Отчёты OTP на время прогона молчат.

  Отказ процесса в этой модели — событие, а не поломка: контракт требует, чтобы
  он кончался решением надзора, и примеры на нём построены. Отчёт об аварии на
  каждый такой отказ забил бы вывод проверки тем, чего проверка и добивается.

  Зовёт это только `run/3` — то есть прогон, то есть проверка. Настоящая работа
  начинается с `start/1`, и там ничего не выключается: в живой системе отчёт об
  упавшем процессе — это как раз то, что нужно.
  """
  def quiet do
    :logger.set_primary_config(:level, :none)
    :ok
  end
end

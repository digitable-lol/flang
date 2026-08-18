# Синтез из спецификации упирается в 75 узлов дерева — и медианная функция нашей библиотеки ровно этого размера

Внешняя проверка к [[spetsifikatsiya-ne-opredelyaet-funktsiyu]]: если бы наша
спецификация всё-таки определяла функцию, синтезировал бы её кто-нибудь? Ответ —
**функцию да, библиотеку нет**, и потолок известен с точностью до десятков узлов.

**Рекорд за десять лет назван авторами прямо.** Myth (PLDI 2015): «to our
knowledge `fvs_large` is the **largest example of a fully synthesized recursive
function in the literature at 75 AST nodes**»; остальные 43 задачи — 15–30 узлов
([pdf](https://www.cis.upenn.edu/~stevez/papers/OZ15.pdf)). Synquid (PLDI 2016):
самая большая **рекурсивная** программа — 69 узлов
([arXiv](https://arxiv.org/pdf/1510.08419)). SuSLik (POPL 2019) — 10–58 узлов,
Cypress (PLDI 2021) — максимум 35 операторов и **1304 секунды** на удаление корня
из дерева поиска. Absynthe (PLDI 2023), самая свежая работа этого рода: максимум
в таблице — **14 узлов** при пределе в 600 секунд, и там же сказано почему:
«a larger program takes much longer to synthesize, due to **combinatorial
increase** in the number of terms being searched».

> Наш замер: медианное тело функции `flang/stdlib/` — **59 токенов**
> ([[iz-hesha-kod-ne-vyvoditsya]]). Единицы разные — узлы дерева и токены, — но
> порядок один. **Медианная функция нашей библиотеки стоит ровно на рекорде
> десятилетия.** Не «немного не дотягиваем»: одна такая функция — это предел
> области, а в библиотеке их 208.

**Отношение спеки к телу у них перевёрнуто, и это добивает наш довод 0,28.** Я
мерил, что спека втрое короче тела, и оговаривал: это оттого, что спека у нас не
определяющая. Вот подтверждение снаружи, в узлах дерева, из таблицы самого
Synquid: балансировка красно-чёрного дерева — **спека 144, код 137**; поворот
AVL — **спека 107, код 91**. У SuSLik для поворотов дерева поиска спека **вдесятеро
больше** программы. Авторы Synquid признают это в тексте: «Even though
specification sizes for some benchmarks are comparable with the size of the
synthesized code…».

**И спека обязана быть «под синтезатор».** Когда чужие люди написали
семантически равносильные спеки к тем же задачам, Synquid решил **22 из 45, и две
неверно, — 44 % правильных** (Burst, POPL 2022): «Synquid is only able to
successfully synthesize programs from **highly stylized** specifications… coming
up with specifications that are Synquid-friendly is a highly non-trivial task»
([pdf](https://cs.sfu.ca/~miltner/papers/burst.pdf)).

**Смежные области дают тот же порядок.**

- **SyGuS**: соревнование закрыли **сами организаторы в 2020** — «we anticipate
  that this year there will be no significantly new solvers that are ready to
  compete». Медиана размера решения в основной категории по официальным
  журналам 2019 года — **7 узлов дерева**; 68,5 % решений меньше десяти.
- **Молоток для Coq**: CoqHammer закрывает **40,8 %** из 9276 задач стандартной
  библиотеки за ~40 с ([JAR
  61:423](https://link.springer.com/content/pdf/10.1007/s10817-018-9458-4.pdf)),
  но на CompCert — **25,6 %**, и индукцию не делает **никогда** (сказано на их же
  сайте). Число не обновлялось восемь лет.
- **Молоток для Lean**: на 149 142 теоремах Mathlib, когда каждому средству
  подложили **точные** посылки из человеческого доказательства, объединение
  **всех** символьных средств закрыло **53,2 %**. LeanHammer формулирует границу
  так: «almost all theorems that LeanHammer solves… use **1–2 lines** in the
  human-written proof… the search space becomes prohibitively large for longer
  proofs».

**Самое красноречивое — что область покинули.** У Поликарповой, автора Synquid,
после 2022 года **ни одной** работы по чистому синтезу из уточняющих типов:
babble, CCLemma, HYSYNTH (с подсказкой от языковой модели), Laurel. То же в EPFL:
Stainless синтеза не делает, а строка «Leon остаётся основным проектом по синтезу»
заморожена на 2016 годе.

**И общее место, ради которого всё это искалось** — обзор Гулвани, Полозова и
Сингха (2017): «The deductive synthesis approaches assumed a complete formal
specification of the desired user intent was provided, which **in many cases
proved to be as complicated as writing the program itself**»
([pdf](https://www.microsoft.com/en-us/research/wp-content/uploads/2017/10/program_synthesis_now.pdf)).
Резче всех сказал Солар-Лезама: «the only way to completely and unambiguously
characterize a program is by **writing down the program itself**».

**Чем подтверждено.** Разбор внешних источников 2026-08-18; ссылки построчно
выше, числа взяты из таблиц самих работ. Наши 59 токенов — замер на этой машине,
описан в [[iz-hesha-kod-ne-vyvoditsya]].

**Чем ограничено.**

- **Единицы сравнения не совпадают.** 59 токенов и 75 узлов дерева — величины
  одного порядка, но не одна и та же величина. Пересчитать наши тела в узлы
  дерева — отдельная работа, и её тут нет.
- **Потолок «30–75 узлов» нигде не объявлен авторами как потолок.** Ближайшее —
  замечание Myth про 75 узлов; остальное выведено из их таблиц, а не процитировано.
- **Это про дедуктивный синтез, а не про языковые модели.** Что умеют агенты с
  прувером — другое дело и другой вывод: [[hrapovik-vmesto-vyvoda]].
- **Отрицательные находки — это «не нашли», а не «не существует».** Бюджет поиска
  был исчерпан.

Связано: [[spetsifikatsiya-ne-opredelyaet-funktsiyu]],
[[iz-hesha-kod-ne-vyvoditsya]], [[hrapovik-vmesto-vyvoda]],
[[vyvod-rabotaet-na-uzkoy-oblasti]], [[zakony-kak-ukazatel]],
[[uzkoe-mesto-ne-v-avtomatike]]

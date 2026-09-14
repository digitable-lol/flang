%%% Точка отсчёта: те же четыре числа на настоящей BEAM.
%%% Запуск: erl -noshell -pa <каталог> -s beam start -s init stop +P 100000000
-module(beam).
-export([start/0, tihiy/0, ping/2]).

tihiy() -> receive stop -> ok end.

ping(0, Parent) -> Parent ! done;
ping(N, Parent) ->
  receive {ping, From} -> From ! {pong, self()}, ping(N - 1, Parent) end.

pong_loop(0, _Peer) -> ok;
pong_loop(N, Peer) ->
  Peer ! {ping, self()},
  receive {pong, _} -> ok end,
  pong_loop(N - 1, Peer).

start() ->
  io:format("схемы: ~p, ядер онлайн: ~p, предел процессов: ~p~n",
            [erlang:system_info(schedulers), erlang:system_info(schedulers_online),
             erlang:system_info(process_limit)]),
  [pamyat(N) || N <- [1000, 10000, 100000, 1000000]],
  zavod(),
  pinpong(),
  ok.

%% 1. Байт на процесс: разность erlang:memory(processes) и медиана по процессам.
pamyat(N) ->
  erlang:garbage_collect(),
  Do = erlang:memory(processes),
  Pids = [spawn(fun tihiy/0) || _ <- lists:seq(1, N)],
  Posle = erlang:memory(processes),
  Kazhdyy = lists:sort([element(2, erlang:process_info(P, memory)) || P <- lists:sublist(Pids, 1000)]),
  Mediana = lists:nth(max(1, length(Kazhdyy) div 2), Kazhdyy),
  io:format("память: N=~p, (после-до)/N=~.1f Б, медиана process_info(memory)=~p Б~n",
            [N, (Posle - Do) / N, Mediana]),
  [P ! stop || P <- Pids],
  ok.

%% 2. Процессов в секунду: пять повторов, берётся лучший.
zavod() ->
  N = 200000,
  Vremena = [begin
               T0 = erlang:monotonic_time(microsecond),
               Pids = [spawn(fun tihiy/0) || _ <- lists:seq(1, N)],
               T1 = erlang:monotonic_time(microsecond),
               [P ! stop || P <- Pids],
               T1 - T0
             end || _ <- lists:seq(1, 5)],
  Luchshee = lists:min(Vremena),
  io:format("завод: ~p процессов, минимум ~p мкс, это ~.1f процессов/с (все повторы, мкс: ~p)~n",
            [N, Luchshee, N * 1.0e6 / Luchshee, Vremena]),
  ok.

%% 3. Пинг-понг: сообщений в секунду между двумя процессами.
pinpong() ->
  N = 1000000,
  Vremena = [begin
               Ya = self(),
               Peer = spawn(fun() -> ping(N, Ya) end),
               T0 = erlang:monotonic_time(microsecond),
               pong_loop(N, Peer),
               T1 = erlang:monotonic_time(microsecond),
               T1 - T0
             end || _ <- lists:seq(1, 5)],
  Luchshee = lists:min(Vremena),
  io:format("пинг-понг: ~p кругов, минимум ~p мкс, это ~.1f круг/с и ~.1f сообщений/с (повторы: ~p)~n",
            [N, Luchshee, N * 1.0e6 / Luchshee, 2 * N * 1.0e6 / Luchshee, Vremena]),
  ok.

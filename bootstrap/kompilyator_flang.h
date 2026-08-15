/*
 * Сгенерировано flang (бэкенд C, flang/src/emit/c.mjs). Не редактировать руками.
 * Модуль flang: «Компилятор flang».
 * Файл: объявления: конструкторы значений и функции программы.
 * Правьте исходник на flang и печатайте заново: любая правка здесь потеряется.
 */
#ifndef KOMPILYATOR_FLANG_H
#define KOMPILYATOR_FLANG_H

#include "flang_runtime.h"

/*
 * Контракт вызова: функция кладёт результат в *result и возвращает FL_OK
 * либо НЕ трогает *result и возвращает FL_ERROR, заполнив *error (его можно
 * передать NULL). Результат живёт в арене контекста — до ближайшего
 * fl_arena_reset; чтобы сохранить его надолго, скопируйте в свою память.
 *
 *   fl_arena arena;
 *   fl_ctx ctx;
 *   fl_error error;
 *   fl_value result;
 *   fl_arena_init(&arena);
 *   fl_ctx_init(&ctx, &arena);
 *   if (…(&ctx, …, &result, &error) != FL_OK) { … error.code, error.message … }
 *   fl_arena_release(&arena);
 */

/* Запись FTS «Токен»: «вид», «значение», «число», «текст», «в ёлочках», «нижний», «строка», «столбец». */
/* Запись flang тотальна: пропущенное поле — это «ничто», а не дырка. */
fl_status kompilyator_flang_sozdat_token(fl_ctx *ctx, fl_value vid, fl_value znachenie, fl_value chislo, fl_value tekst, fl_value v_yolochkah, fl_value nizhniy, fl_value stroka, fl_value stolbec, fl_value *out, fl_error *error);

/* Запись FTS «Диагностика»: «код», «сообщение», «строка», «столбец». */
/* Запись flang тотальна: пропущенное поле — это «ничто», а не дырка. */
fl_status kompilyator_flang_sozdat_diagnostika(fl_ctx *ctx, fl_value kod, fl_value soobschenie, fl_value stroka, fl_value stolbec, fl_value *out, fl_error *error);

/* Запись FTS «Разбор»: «токены», «диагностики». */
/* Запись flang тотальна: пропущенное поле — это «ничто», а не дырка. */
fl_status kompilyator_flang_sozdat_razbor(fl_ctx *ctx, fl_value tokeny, fl_value diagnostiki, fl_value *out, fl_error *error);

/* Запись FTS «Лексер»: «токены», «свои», «стек», «глубина», «есть токены», «режим», «закрывающая», «накоплено», «строка метки», «столбец метки», «номер», «край», «беда». */
/* Запись flang тотальна: пропущенное поле — это «ничто», а не дырка. */
fl_status kompilyator_flang_sozdat_lekser(fl_ctx *ctx, fl_value tokeny, fl_value svoi, fl_value stek, fl_value glubina, fl_value est_tokeny, fl_value rezhim, fl_value zakryvayuschaya, fl_value nakopleno, fl_value stroka_metki, fl_value stolbec_metki, fl_value nomer, fl_value kray, fl_value beda, fl_value *out, fl_error *error);

/* Запись FTS «Чтение»: «значение», «съедено», «закрыто», «сломано», «съело перевод». */
/* Запись flang тотальна: пропущенное поле — это «ничто», а не дырка. */
fl_status kompilyator_flang_sozdat_chtenie(fl_ctx *ctx, fl_value znachenie, fl_value sedeno, fl_value zakryto, fl_value slomano, fl_value selo_perevod, fl_value *out, fl_error *error);

/* Запись FTS «Слово»: «значение», «заглавные». */
/* Запись flang тотальна: пропущенное поле — это «ничто», а не дырка. */
fl_status kompilyator_flang_sozdat_slovo(fl_ctx *ctx, fl_value znachenie, fl_value zaglavnye, fl_value *out, fl_error *error);

/* Запись FTS «Пробег»: «текст», «остаток». */
/* Запись flang тотальна: пропущенное поле — это «ничто», а не дырка. */
fl_status kompilyator_flang_sozdat_probeg(fl_ctx *ctx, fl_value tekst, fl_value ostatok, fl_value *out, fl_error *error);

/* Запись FTS «Находка»: «размер», «идентификатор». */
/* Запись flang тотальна: пропущенное поле — это «ничто», а не дырка. */
fl_status kompilyator_flang_sozdat_nahodka(fl_ctx *ctx, fl_value razmer, fl_value identifikator, fl_value *out, fl_error *error);

/* Запись FTS «Снятие»: «стек», «токены». */
/* Запись flang тотальна: пропущенное поле — это «ничто», а не дырка. */
fl_status kompilyator_flang_sozdat_snyatie(fl_ctx *ctx, fl_value stek, fl_value tokeny, fl_value *out, fl_error *error);

/* Запись FTS «Блок таблицы»: «основание», «символы». */
/* Запись flang тотальна: пропущенное поле — это «ничто», а не дырка. */
fl_status kompilyator_flang_sozdat_blok_tablicy(fl_ctx *ctx, fl_value osnovanie, fl_value simvoly, fl_value *out, fl_error *error);

/* Запись FTS «Поле значения»: «ключ», «значение». */
/* Запись flang тотальна: пропущенное поле — это «ничто», а не дырка. */
fl_status kompilyator_flang_sozdat_pole_znacheniya(fl_ctx *ctx, fl_value klyuch, fl_value znachenie, fl_value *out, fl_error *error);

/* Запись FTS «Замена»: «что», «чем». */
/* Запись flang тотальна: пропущенное поле — это «ничто», а не дырка. */
fl_status kompilyator_flang_sozdat_zamena(fl_ctx *ctx, fl_value chto, fl_value chem, fl_value *out, fl_error *error);

/* Запись FTS «Пачка»: «токены». */
/* Запись flang тотальна: пропущенное поле — это «ничто», а не дырка. */
fl_status kompilyator_flang_sozdat_pachka(fl_ctx *ctx, fl_value tokeny, fl_value *out, fl_error *error);

/* Запись FTS «Поток»: «т0», «т1», «т2», «кусок», «куски», «конец». */
/* Запись flang тотальна: пропущенное поле — это «ничто», а не дырка. */
fl_status kompilyator_flang_sozdat_potok(fl_ctx *ctx, fl_value t0, fl_value t1, fl_value t2, fl_value kusok, fl_value kuski, fl_value konec, fl_value *out, fl_error *error);

/* Запись FTS «Тяга»: «токен», «кусок», «куски». */
/* Запись flang тотальна: пропущенное поле — это «ничто», а не дырка. */
fl_status kompilyator_flang_sozdat_tyaga(fl_ctx *ctx, fl_value token, fl_value kusok, fl_value kuski, fl_value *out, fl_error *error);

/* Запись FTS «Сборка при разборе»: «текущая», «готовые». */
/* Запись flang тотальна: пропущенное поле — это «ничто», а не дырка. */
fl_status kompilyator_flang_sozdat_sborka_pri_razbore(fl_ctx *ctx, fl_value tekuschaya, fl_value gotovye, fl_value *out, fl_error *error);

/* Запись FTS «Область»: «имена». */
/* Запись flang тотальна: пропущенное поле — это «ничто», а не дырка. */
fl_status kompilyator_flang_sozdat_oblast(fl_ctx *ctx, fl_value imena, fl_value *out, fl_error *error);

/* Запись FTS «Объявление разбора»: «ключ», «узел». */
/* Запись flang тотальна: пропущенное поле — это «ничто», а не дырка. */
fl_status kompilyator_flang_sozdat_obyavlenie_razbora(fl_ctx *ctx, fl_value klyuch, fl_value uzel, fl_value *out, fl_error *error);

/* Запись FTS «Сбор при разборе»: «модуль», «типы», «функции», «наследие», «прочие». */
/* Запись flang тотальна: пропущенное поле — это «ничто», а не дырка. */
fl_status kompilyator_flang_sozdat_sbor_pri_razbore(fl_ctx *ctx, fl_value modul, fl_value tipy, fl_value funkcii, fl_value nasledie, fl_value prochie, fl_value *out, fl_error *error);

/* Запись FTS «Разборщик»: «поток», «сбор», «области», «беда». */
/* Запись flang тотальна: пропущенное поле — это «ничто», а не дырка. */
fl_status kompilyator_flang_sozdat_razborschik(fl_ctx *ctx, fl_value potok, fl_value sbor, fl_value oblasti, fl_value beda, fl_value *out, fl_error *error);

/* Запись FTS «Шаг»: «р», «узел». */
/* Запись flang тотальна: пропущенное поле — это «ничто», а не дырка. */
fl_status kompilyator_flang_sozdat_shag(fl_ctx *ctx, fl_value r, fl_value uzel, fl_value *out, fl_error *error);

/* Запись FTS «Шаг текста»: «р», «текст». */
/* Запись flang тотальна: пропущенное поле — это «ничто», а не дырка. */
fl_status kompilyator_flang_sozdat_shag_teksta(fl_ctx *ctx, fl_value r, fl_value tekst, fl_value *out, fl_error *error);

/* Запись FTS «Шаг флага»: «р», «флаг». */
/* Запись flang тотальна: пропущенное поле — это «ничто», а не дырка. */
fl_status kompilyator_flang_sozdat_shag_flaga(fl_ctx *ctx, fl_value r, fl_value flag, fl_value *out, fl_error *error);

/* Запись FTS «Шаг узлов»: «р», «узлы». */
/* Запись flang тотальна: пропущенное поле — это «ничто», а не дырка. */
fl_status kompilyator_flang_sozdat_shag_uzlov(fl_ctx *ctx, fl_value r, fl_value uzly, fl_value *out, fl_error *error);

/* Запись FTS «Шаг полей»: «р», «перечень». */
/* Запись flang тотальна: пропущенное поле — это «ничто», а не дырка. */
fl_status kompilyator_flang_sozdat_shag_poley(fl_ctx *ctx, fl_value r, fl_value perechen, fl_value *out, fl_error *error);

/* Запись FTS «Шаг токена»: «р», «токен». */
/* Запись flang тотальна: пропущенное поле — это «ничто», а не дырка. */
fl_status kompilyator_flang_sozdat_shag_tokena(fl_ctx *ctx, fl_value r, fl_value token, fl_value *out, fl_error *error);

/* Запись FTS «Шаг имён»: «р», «имена». */
/* Запись flang тотальна: пропущенное поле — это «ничто», а не дырка. */
fl_status kompilyator_flang_sozdat_shag_imyon(fl_ctx *ctx, fl_value r, fl_value imena, fl_value *out, fl_error *error);

/* Запись FTS «Шаг типа»: «р», «тип», «текст». */
/* Запись flang тотальна: пропущенное поле — это «ничто», а не дырка. */
fl_status kompilyator_flang_sozdat_shag_tipa(fl_ctx *ctx, fl_value r, fl_value tip, fl_value tekst, fl_value *out, fl_error *error);

/* Запись FTS «Счёт областей»: «номер», «итог». */
/* Запись flang тотальна: пропущенное поле — это «ничто», а не дырка. */
fl_status kompilyator_flang_sozdat_schyot_oblastey(fl_ctx *ctx, fl_value nomer, fl_value itog, fl_value *out, fl_error *error);

/* Запись FTS «Сборка функции»: «р», «имя», «параметры», «примеры», «возвращает», «мера», «постусловия», «тело». */
/* Запись flang тотальна: пропущенное поле — это «ничто», а не дырка. */
fl_status kompilyator_flang_sozdat_sborka_funkcii(fl_ctx *ctx, fl_value r, fl_value imya, fl_value parametry, fl_value primery, fl_value vozvraschaet, fl_value mera, fl_value postusloviya, fl_value telo, fl_value *out, fl_error *error);

/* Запись FTS «Сборка примера»: «р», «вход», «ожидается», «есть ожидание». */
/* Запись flang тотальна: пропущенное поле — это «ничто», а не дырка. */
fl_status kompilyator_flang_sozdat_sborka_primera(fl_ctx *ctx, fl_value r, fl_value vhod, fl_value ozhidaetsya, fl_value est_ozhidanie, fl_value *out, fl_error *error);

/* Запись FTS «Поиск заголовка»: «номер», «найден». */
/* Запись flang тотальна: пропущенное поле — это «ничто», а не дырка. */
fl_status kompilyator_flang_sozdat_poisk_zagolovka(fl_ctx *ctx, fl_value nomer, fl_value nayden, fl_value *out, fl_error *error);

/* Запись FTS «Выбор узла»: «номер», «итог». */
/* Запись flang тотальна: пропущенное поле — это «ничто», а не дырка. */
fl_status kompilyator_flang_sozdat_vybor_uzla(fl_ctx *ctx, fl_value nomer, fl_value itog, fl_value *out, fl_error *error);

/* Запись FTS «Замена узла»: «номер», «итог». */
/* Запись flang тотальна: пропущенное поле — это «ничто», а не дырка. */
fl_status kompilyator_flang_sozdat_zamena_uzla(fl_ctx *ctx, fl_value nomer, fl_value itog, fl_value *out, fl_error *error);

/* Запись FTS «Сборка цепочки»: «р», «шаги». */
/* Запись flang тотальна: пропущенное поле — это «ничто», а не дырка. */
fl_status kompilyator_flang_sozdat_sborka_cepochki(fl_ctx *ctx, fl_value r, fl_value shagi, fl_value *out, fl_error *error);

/* Запись FTS «Сборка звеньев»: «номер», «текущий», «узлы». */
/* Запись flang тотальна: пропущенное поле — это «ничто», а не дырка. */
fl_status kompilyator_flang_sozdat_sborka_zvenev(fl_ctx *ctx, fl_value nomer, fl_value tekuschiy, fl_value uzly, fl_value *out, fl_error *error);

/* Запись FTS «Итог разбора»: «программа», «диагностики». */
/* Запись flang тотальна: пропущенное поле — это «ничто», а не дырка. */
fl_status kompilyator_flang_sozdat_itog_razbora(fl_ctx *ctx, fl_value programma, fl_value diagnostiki, fl_value *out, fl_error *error);

/* Запись FTS «Сборка правила»: «р», «условия», «действие». */
/* Запись flang тотальна: пропущенное поле — это «ничто», а не дырка. */
fl_status kompilyator_flang_sozdat_sborka_pravila(fl_ctx *ctx, fl_value r, fl_value usloviya, fl_value deystvie, fl_value *out, fl_error *error);

/* Запись FTS «Сборка свойства»: «р», «сравнение», «операнд». */
/* Запись flang тотальна: пропущенное поле — это «ничто», а не дырка. */
fl_status kompilyator_flang_sozdat_sborka_svoystva(fl_ctx *ctx, fl_value r, fl_value sravnenie, fl_value operand, fl_value *out, fl_error *error);

/* Запись FTS «Сборка примера утилиты»: «р», «вход», «ожидается», «есть ожидание». */
/* Запись flang тотальна: пропущенное поле — это «ничто», а не дырка. */
fl_status kompilyator_flang_sozdat_sborka_primera_utility(fl_ctx *ctx, fl_value r, fl_value vhod, fl_value ozhidaetsya, fl_value est_ozhidanie, fl_value *out, fl_error *error);

/* Запись FTS «Сборка утилиты»: «р», «значение». */
/* Запись flang тотальна: пропущенное поле — это «ничто», а не дырка. */
fl_status kompilyator_flang_sozdat_sborka_utility(fl_ctx *ctx, fl_value r, fl_value znachenie, fl_value *out, fl_error *error);

/* Запись FTS «Сборка стрелки»: «р», «даёт», «есть даёт», «законы». */
/* Запись flang тотальна: пропущенное поле — это «ничто», а не дырка. */
fl_status kompilyator_flang_sozdat_sborka_strelki(fl_ctx *ctx, fl_value r, fl_value dayot, fl_value est_dayot, fl_value zakony, fl_value *out, fl_error *error);

/* Запись FTS «Сборка закона»: «р», «примеры». */
/* Запись flang тотальна: пропущенное поле — это «ничто», а не дырка. */
fl_status kompilyator_flang_sozdat_sborka_zakona(fl_ctx *ctx, fl_value r, fl_value primery, fl_value *out, fl_error *error);

/* Запись FTS «Сборка теоремы»: «р», «значение», «переменные», «допущения», «утверждение», «шаги», «доказано», «новая». */
/* Запись flang тотальна: пропущенное поле — это «ничто», а не дырка. */
fl_status kompilyator_flang_sozdat_sborka_teoremy(fl_ctx *ctx, fl_value r, fl_value znachenie, fl_value peremennye, fl_value dopuscheniya, fl_value utverzhdenie, fl_value shagi, fl_value dokazano, fl_value novaya, fl_value *out, fl_error *error);

/* Запись FTS «Обрезка справа»: «готово», «пробелы». */
/* Запись flang тотальна: пропущенное поле — это «ничто», а не дырка. */
fl_status kompilyator_flang_sozdat_obrezka_sprava(fl_ctx *ctx, fl_value gotovo, fl_value probely, fl_value *out, fl_error *error);

/* Запись FTS «Сборка документа»: «р», «значение», «есть утверждение». */
/* Запись flang тотальна: пропущенное поле — это «ничто», а не дырка. */
fl_status kompilyator_flang_sozdat_sborka_dokumenta(fl_ctx *ctx, fl_value r, fl_value znachenie, fl_value est_utverzhdenie, fl_value *out, fl_error *error);

/* Запись FTS «Известная функция»: «имя», «арность», «тотальная». */
/* Запись flang тотальна: пропущенное поле — это «ничто», а не дырка. */
fl_status kompilyator_flang_sozdat_izvestnaya_funkciya(fl_ctx *ctx, fl_value imya, fl_value arnost, fl_value totalnaya, fl_value *out, fl_error *error);

/* Запись FTS «Понижение»: «функции», «имена диспетчеров». */
/* Запись flang тотальна: пропущенное поле — это «ничто», а не дырка. */
fl_status kompilyator_flang_sozdat_ponizhenie(fl_ctx *ctx, fl_value funkcii, fl_value imena_dispetcherov, fl_value *out, fl_error *error);

/* Запись FTS «Пара арности»: «арность», «имя». */
/* Запись flang тотальна: пропущенное поле — это «ничто», а не дырка. */
fl_status kompilyator_flang_sozdat_para_arnosti(fl_ctx *ctx, fl_value arnost, fl_value imya, fl_value *out, fl_error *error);

/* Запись FTS «Отметка меры»: «есть», «параметр», «сообщение». */
/* Запись flang тотальна: пропущенное поле — это «ничто», а не дырка. */
fl_status kompilyator_flang_sozdat_otmetka_mery(fl_ctx *ctx, fl_value est, fl_value parametr, fl_value soobschenie, fl_value *out, fl_error *error);

/* Запись FTS «Имя сторожа»: «сообщение», «имя». */
/* Запись flang тотальна: пропущенное поле — это «ничто», а не дырка. */
fl_status kompilyator_flang_sozdat_imya_storozha(fl_ctx *ctx, fl_value soobschenie, fl_value imya, fl_value *out, fl_error *error);

/* Запись FTS «Пара имён»: «ключ», «значение». */
/* Запись flang тотальна: пропущенное поле — это «ничто», а не дырка. */
fl_status kompilyator_flang_sozdat_para_imyon(fl_ctx *ctx, fl_value klyuch, fl_value znachenie, fl_value *out, fl_error *error);

/* Запись FTS «Сбор слов»: «слово», «готовые». */
/* Запись flang тотальна: пропущенное поле — это «ничто», а не дырка. */
fl_status kompilyator_flang_sozdat_sbor_slov(fl_ctx *ctx, fl_value slovo, fl_value gotovye, fl_value *out, fl_error *error);

/* Запись FTS «Поиск слова»: «первый», «предыдущий», «найдено». */
/* Запись flang тотальна: пропущенное поле — это «ничто», а не дырка. */
fl_status kompilyator_flang_sozdat_poisk_slova(fl_ctx *ctx, fl_value pervyy, fl_value predyduschiy, fl_value naydeno, fl_value *out, fl_error *error);

/* Запись FTS «Набор имён»: «взято», «имена». */
/* Запись flang тотальна: пропущенное поле — это «ничто», а не дырка. */
fl_status kompilyator_flang_sozdat_nabor_imyon(fl_ctx *ctx, fl_value vzyato, fl_value imena, fl_value *out, fl_error *error);

/* Запись FTS «Параметр в C»: «имя», «тип». */
/* Запись flang тотальна: пропущенное поле — это «ничто», а не дырка. */
fl_status kompilyator_flang_sozdat_parametr_v_c(fl_ctx *ctx, fl_value imya, fl_value tip, fl_value *out, fl_error *error);

/* Запись FTS «Постусловие»: «имя», «выражение», «связывание», «код», «сообщение», «есть сообщение». */
/* Запись flang тотальна: пропущенное поле — это «ничто», а не дырка. */
fl_status kompilyator_flang_sozdat_postuslovie(fl_ctx *ctx, fl_value imya, fl_value vyrazhenie, fl_value svyazyvanie, fl_value kod, fl_value soobschenie, fl_value est_soobschenie, fl_value *out, fl_error *error);

/* Запись FTS «Функция»: «имя», «тотальная», «параметры», «возвращает», «тело», «постусловия». */
/* Запись flang тотальна: пропущенное поле — это «ничто», а не дырка. */
fl_status kompilyator_flang_sozdat_funkciya(fl_ctx *ctx, fl_value imya, fl_value totalnaya, fl_value parametry, fl_value vozvraschaet, fl_value telo, fl_value postusloviya, fl_value *out, fl_error *error);

/* Запись FTS «Поле типа в C»: «имя», «тип». */
/* Запись flang тотальна: пропущенное поле — это «ничто», а не дырка. */
fl_status kompilyator_flang_sozdat_pole_tipa_v_c(fl_ctx *ctx, fl_value imya, fl_value tip, fl_value *out, fl_error *error);

/* Запись FTS «Запись типа»: «имя», «поля». */
/* Запись flang тотальна: пропущенное поле — это «ничто», а не дырка. */
fl_status kompilyator_flang_sozdat_zapis_tipa(fl_ctx *ctx, fl_value imya, fl_value polya, fl_value *out, fl_error *error);

/* Запись FTS «Вариант типа»: «имя», «поля». */
/* Запись flang тотальна: пропущенное поле — это «ничто», а не дырка. */
fl_status kompilyator_flang_sozdat_variant_tipa(fl_ctx *ctx, fl_value imya, fl_value polya, fl_value *out, fl_error *error);

/* Запись FTS «Сумма типов в C»: «имя», «варианты». */
/* Запись flang тотальна: пропущенное поле — это «ничто», а не дырка. */
fl_status kompilyator_flang_sozdat_summa_tipov_v_c(fl_ctx *ctx, fl_value imya, fl_value varianty, fl_value *out, fl_error *error);

/* Запись FTS «Рёбра»: «имя», «цели». */
/* Запись flang тотальна: пропущенное поле — это «ничто», а не дырка. */
fl_status kompilyator_flang_sozdat_ryobra(fl_ctx *ctx, fl_value imya, fl_value celi, fl_value *out, fl_error *error);

/* Запись FTS «Компонента»: «имена». */
/* Запись flang тотальна: пропущенное поле — это «ничто», а не дырка. */
fl_status kompilyator_flang_sozdat_komponenta(fl_ctx *ctx, fl_value imena, fl_value *out, fl_error *error);

/* Запись FTS «Метка»: «ключ», «значение». */
/* Запись flang тотальна: пропущенное поле — это «ничто», а не дырка. */
fl_status kompilyator_flang_sozdat_metka(fl_ctx *ctx, fl_value klyuch, fl_value znachenie, fl_value *out, fl_error *error);

/* Запись FTS «Тарьян»: «номера», «низы», «на стеке», «стек», «компоненты», «счётчик». */
/* Запись flang тотальна: пропущенное поле — это «ничто», а не дырка. */
fl_status kompilyator_flang_sozdat_taryan(fl_ctx *ctx, fl_value nomera, fl_value nizy, fl_value na_steke, fl_value stek, fl_value komponenty, fl_value schyotchik, fl_value *out, fl_error *error);

/* Запись FTS «Отрезание»: «индекс», «элементы». */
/* Запись flang тотальна: пропущенное поле — это «ничто», а не дырка. */
fl_status kompilyator_flang_sozdat_otrezanie(fl_ctx *ctx, fl_value indeks, fl_value elementy, fl_value *out, fl_error *error);

/* Запись FTS «Именованные идентификаторы»: «имя», «идентификаторы». */
/* Запись flang тотальна: пропущенное поле — это «ничто», а не дырка. */
fl_status kompilyator_flang_sozdat_imenovannye_identifikatory(fl_ctx *ctx, fl_value imya, fl_value identifikatory, fl_value *out, fl_error *error);

/* Запись FTS «Общее»: «префикс», «функции», «записи», «варианты», «суммы», «ид функций», «ид фабрик», «ид вариантов», «ид шагов», «ид параметров», «хвостовые», «циклические», «рекурсивные». */
/* Запись flang тотальна: пропущенное поле — это «ничто», а не дырка. */
fl_status kompilyator_flang_sozdat_obschee(fl_ctx *ctx, fl_value prefiks, fl_value funkcii, fl_value zapisi, fl_value varianty, fl_value summy, fl_value id_funkciy, fl_value id_fabrik, fl_value id_variantov, fl_value id_shagov, fl_value id_parametrov, fl_value hvostovye, fl_value ciklicheskie, fl_value rekursivnye, fl_value *out, fl_error *error);

/* Запись FTS «Состояние»: «счётчик», «статика», «ключи», «математика», «взято», «ошибка». */
/* Запись flang тотальна: пропущенное поле — это «ничто», а не дырка. */
fl_status kompilyator_flang_sozdat_sostoyanie(fl_ctx *ctx, fl_value schyotchik, fl_value statika, fl_value klyuchi, fl_value matematika, fl_value vzyato, fl_value oshibka, fl_value *out, fl_error *error);

/* Запись FTS «Свежее»: «состояние», «имя». */
/* Запись flang тотальна: пропущенное поле — это «ничто», а не дырка. */
fl_status kompilyator_flang_sozdat_svezhee(fl_ctx *ctx, fl_value sostoyanie, fl_value imya, fl_value *out, fl_error *error);

/* Запись FTS «Итог»: «состояние», «вывод», «значение». */
/* Запись flang тотальна: пропущенное поле — это «ничто», а не дырка. */
fl_status kompilyator_flang_sozdat_itog(fl_ctx *ctx, fl_value sostoyanie, fl_value vyvod, fl_value znachenie, fl_value *out, fl_error *error);

/* Запись FTS «Блок»: «состояние», «вывод». */
/* Запись flang тотальна: пропущенное поле — это «ничто», а не дырка. */
fl_status kompilyator_flang_sozdat_blok(fl_ctx *ctx, fl_value sostoyanie, fl_value vyvod, fl_value *out, fl_error *error);

/* Запись FTS «Контекст»: «общее», «функция», «параметры», «сам хвост», «есть члены», «члены», «область». */
/* Запись flang тотальна: пропущенное поле — это «ничто», а не дырка. */
fl_status kompilyator_flang_sozdat_kontekst(fl_ctx *ctx, fl_value obschee, fl_value funkciya, fl_value parametry, fl_value sam_hvost, fl_value est_chleny, fl_value chleny, fl_value oblast, fl_value *out, fl_error *error);

/* Запись FTS «Зип»: «индекс», «текст». */
/* Запись flang тотальна: пропущенное поле — это «ничто», а не дырка. */
fl_status kompilyator_flang_sozdat_zip(fl_ctx *ctx, fl_value indeks, fl_value tekst, fl_value *out, fl_error *error);

/* Запись FTS «Итог образца»: «состояние», «вывод», «есть проверка», «проверка». */
/* Запись flang тотальна: пропущенное поле — это «ничто», а не дырка. */
fl_status kompilyator_flang_sozdat_itog_obrazca(fl_ctx *ctx, fl_value sostoyanie, fl_value vyvod, fl_value est_proverka, fl_value proverka, fl_value *out, fl_error *error);

/* Запись FTS «Итог связывания в C»: «состояние», «вывод», «контекст», «идентификаторы». */
/* Запись flang тотальна: пропущенное поле — это «ничто», а не дырка. */
fl_status kompilyator_flang_sozdat_itog_svyazyvaniya_v_c(fl_ctx *ctx, fl_value sostoyanie, fl_value vyvod, fl_value kontekst, fl_value identifikatory, fl_value *out, fl_error *error);

/* Запись FTS «Случай печати»: «тело», «образец», «есть проверка», «проверка». */
/* Запись flang тотальна: пропущенное поле — это «ничто», а не дырка. */
fl_status kompilyator_flang_sozdat_sluchay_pechati(fl_ctx *ctx, fl_value telo, fl_value obrazec, fl_value est_proverka, fl_value proverka, fl_value *out, fl_error *error);

/* Запись FTS «Сбор случаев»: «состояние», «вывод», «случаи». */
/* Запись flang тотальна: пропущенное поле — это «ничто», а не дырка. */
fl_status kompilyator_flang_sozdat_sbor_sluchaev(fl_ctx *ctx, fl_value sostoyanie, fl_value vyvod, fl_value sluchai, fl_value *out, fl_error *error);

/* Запись FTS «Сборка»: «состояние», «вывод», «индекс», «части». */
/* Запись flang тотальна: пропущенное поле — это «ничто», а не дырка. */
fl_status kompilyator_flang_sozdat_sborka(fl_ctx *ctx, fl_value sostoyanie, fl_value vyvod, fl_value indeks, fl_value chasti, fl_value *out, fl_error *error);

/* Запись FTS «Файл»: «путь», «содержимое». */
/* Запись flang тотальна: пропущенное поле — это «ничто», а не дырка. */
fl_status kompilyator_flang_sozdat_fayl(fl_ctx *ctx, fl_value put, fl_value soderzhimoe, fl_value *out, fl_error *error);

/* Запись FTS «Настройки»: «путь», «есть путь», «база», «предел глубины», «предел шагов», «прогонщик», «рантайм заголовок», «рантайм исходник», «исходник прогонщика», «оболочка», «исходник оболочки». */
/* Запись flang тотальна: пропущенное поле — это «ничто», а не дырка. */
fl_status kompilyator_flang_sozdat_nastroyki(fl_ctx *ctx, fl_value put, fl_value est_put, fl_value baza, fl_value predel_glubiny, fl_value predel_shagov, fl_value progonschik, fl_value rantaym_zagolovok, fl_value rantaym_ishodnik, fl_value ishodnik_progonschika, fl_value obolochka, fl_value ishodnik_obolochki, fl_value *out, fl_error *error);

/* Запись FTS «Итог печати»: «файлы», «ошибка». */
/* Запись flang тотальна: пропущенное поле — это «ничто», а не дырка. */
fl_status kompilyator_flang_sozdat_itog_pechati(fl_ctx *ctx, fl_value fayly, fl_value oshibka, fl_value *out, fl_error *error);

/* Запись FTS «Тела»: «состояние», «части». */
/* Запись flang тотальна: пропущенное поле — это «ничто», а не дырка. */
fl_status kompilyator_flang_sozdat_tela(fl_ctx *ctx, fl_value sostoyanie, fl_value chasti, fl_value *out, fl_error *error);

/* Запись FTS «Тело функции»: «состояние», «текст». */
/* Запись flang тотальна: пропущенное поле — это «ничто», а не дырка. */
fl_status kompilyator_flang_sozdat_telo_funkcii(fl_ctx *ctx, fl_value sostoyanie, fl_value tekst, fl_value *out, fl_error *error);

/* Запись FTS «Связывание параметров»: «контекст», «индекс». */
/* Запись flang тотальна: пропущенное поле — это «ничто», а не дырка. */
fl_status kompilyator_flang_sozdat_svyazyvanie_parametrov(fl_ctx *ctx, fl_value kontekst, fl_value indeks, fl_value *out, fl_error *error);

/* Запись FTS «Именователь»: «таблица», «состояние». */
/* Запись flang тотальна: пропущенное поле — это «ничто», а не дырка. */
fl_status kompilyator_flang_sozdat_imenovatel(fl_ctx *ctx, fl_value tablica, fl_value sostoyanie, fl_value *out, fl_error *error);

/* Запись FTS «Тип»: «вид», «необязательный». */
/* Запись flang тотальна: пропущенное поле — это «ничто», а не дырка. */
fl_status kompilyator_flang_sozdat_tip(fl_ctx *ctx, fl_value vid, fl_value neobyazatelnyy, fl_value *out, fl_error *error);

/* Запись FTS «Связка типа»: «имя», «тип». */
/* Запись flang тотальна: пропущенное поле — это «ничто», а не дырка. */
fl_status kompilyator_flang_sozdat_svyazka_tipa(fl_ctx *ctx, fl_value imya, fl_value tip, fl_value *out, fl_error *error);

/* Запись FTS «Итог сопоставления»: «связки», «сошлось». */
/* Запись flang тотальна: пропущенное поле — это «ничто», а не дырка. */
fl_status kompilyator_flang_sozdat_itog_sopostavleniya(fl_ctx *ctx, fl_value svyazki, fl_value soshlos, fl_value *out, fl_error *error);

/* Запись FTS «Место»: «есть», «строка», «столбец». */
/* Запись flang тотальна: пропущенное поле — это «ничто», а не дырка. */
fl_status kompilyator_flang_sozdat_mesto(fl_ctx *ctx, fl_value est, fl_value stroka, fl_value stolbec, fl_value *out, fl_error *error);

/* Запись FTS «Беда»: «код», «сообщение», «место». */
/* Запись flang тотальна: пропущенное поле — это «ничто», а не дырка. */
fl_status kompilyator_flang_sozdat_beda(fl_ctx *ctx, fl_value kod, fl_value soobschenie, fl_value mesto, fl_value *out, fl_error *error);

/* Запись FTS «Выбор ключа»: «узел», «есть». */
/* Запись flang тотальна: пропущенное поле — это «ничто», а не дырка. */
fl_status kompilyator_flang_sozdat_vybor_klyucha(fl_ctx *ctx, fl_value uzel, fl_value est, fl_value *out, fl_error *error);

/* Запись FTS «Поле типа»: «имя», «тип». */
/* Запись flang тотальна: пропущенное поле — это «ничто», а не дырка. */
fl_status kompilyator_flang_sozdat_pole_tipa(fl_ctx *ctx, fl_value imya, fl_value tip, fl_value *out, fl_error *error);

/* Запись FTS «Запись типов»: «имя», «поля». */
/* Запись flang тотальна: пропущенное поле — это «ничто», а не дырка. */
fl_status kompilyator_flang_sozdat_zapis_tipov(fl_ctx *ctx, fl_value imya, fl_value polya, fl_value *out, fl_error *error);

/* Запись FTS «Вариант типов»: «имя», «поля». */
/* Запись flang тотальна: пропущенное поле — это «ничто», а не дырка. */
fl_status kompilyator_flang_sozdat_variant_tipov(fl_ctx *ctx, fl_value imya, fl_value polya, fl_value *out, fl_error *error);

/* Запись FTS «Сумма типов»: «имя», «варианты». */
/* Запись flang тотальна: пропущенное поле — это «ничто», а не дырка. */
fl_status kompilyator_flang_sozdat_summa_tipov(fl_ctx *ctx, fl_value imya, fl_value varianty, fl_value *out, fl_error *error);

/* Запись FTS «Параметр»: «имя», «тип». */
/* Запись flang тотальна: пропущенное поле — это «ничто», а не дырка. */
fl_status kompilyator_flang_sozdat_parametr(fl_ctx *ctx, fl_value imya, fl_value tip, fl_value *out, fl_error *error);

/* Запись FTS «Сигнатура»: «имя», «параметры», «возвращает», «тотальная», «параметры типа». */
/* Запись flang тотальна: пропущенное поле — это «ничто», а не дырка. */
fl_status kompilyator_flang_sozdat_signatura(fl_ctx *ctx, fl_value imya, fl_value parametry, fl_value vozvraschaet, fl_value totalnaya, fl_value parametry_tipa, fl_value *out, fl_error *error);

/* Запись FTS «Параметры объявления»: «имя», «имена». */
/* Запись flang тотальна: пропущенное поле — это «ничто», а не дырка. */
fl_status kompilyator_flang_sozdat_parametry_obyavleniya(fl_ctx *ctx, fl_value imya, fl_value imena, fl_value *out, fl_error *error);

/* Запись FTS «Таблицы»: «записи», «суммы», «владельцы», «сигнатуры», «параметры типов». */
/* Запись flang тотальна: пропущенное поле — это «ничто», а не дырка. */
fl_status kompilyator_flang_sozdat_tablicy(fl_ctx *ctx, fl_value zapisi, fl_value summy, fl_value vladelcy, fl_value signatury, fl_value parametry_tipov, fl_value *out, fl_error *error);

/* Запись FTS «Псевдоним»: «имя», «объявление», «номер». */
/* Запись flang тотальна: пропущенное поле — это «ничто», а не дырка. */
fl_status kompilyator_flang_sozdat_psevdonim(fl_ctx *ctx, fl_value imya, fl_value obyavlenie, fl_value nomer, fl_value *out, fl_error *error);

/* Запись FTS «Именованный тип»: «имя», «тип». */
/* Запись flang тотальна: пропущенное поле — это «ничто», а не дырка. */
fl_status kompilyator_flang_sozdat_imenovannyy_tip(fl_ctx *ctx, fl_value imya, fl_value tip, fl_value *out, fl_error *error);

/* Запись FTS «Сбор»: «записи», «суммы», «владельцы», «сигнатуры», «псевдонимы», «развёрнутые», «открытые», «параметры типов», «область», «беды». */
/* Запись flang тотальна: пропущенное поле — это «ничто», а не дырка. */
fl_status kompilyator_flang_sozdat_sbor(fl_ctx *ctx, fl_value zapisi, fl_value summy, fl_value vladelcy, fl_value signatury, fl_value psevdonimy, fl_value razvyornutye, fl_value otkrytye, fl_value parametry_tipov, fl_value oblast, fl_value bedy, fl_value *out, fl_error *error);

/* Запись FTS «Итог типа»: «тип», «сбор». */
/* Запись flang тотальна: пропущенное поле — это «ничто», а не дырка. */
fl_status kompilyator_flang_sozdat_itog_tipa(fl_ctx *ctx, fl_value tip, fl_value sbor, fl_value *out, fl_error *error);

/* Запись FTS «Итог полей»: «поля», «сбор». */
/* Запись flang тотальна: пропущенное поле — это «ничто», а не дырка. */
fl_status kompilyator_flang_sozdat_itog_poley(fl_ctx *ctx, fl_value polya, fl_value sbor, fl_value *out, fl_error *error);

/* Запись FTS «Итог параметров»: «параметры», «сбор». */
/* Запись flang тотальна: пропущенное поле — это «ничто», а не дырка. */
fl_status kompilyator_flang_sozdat_itog_parametrov(fl_ctx *ctx, fl_value parametry, fl_value sbor, fl_value *out, fl_error *error);

/* Запись FTS «Итог типов»: «типы», «сбор». */
/* Запись flang тотальна: пропущенное поле — это «ничто», а не дырка. */
fl_status kompilyator_flang_sozdat_itog_tipov(fl_ctx *ctx, fl_value tipy, fl_value sbor, fl_value *out, fl_error *error);

/* Запись FTS «Итог имён»: «имена», «сбор». */
/* Запись flang тотальна: пропущенное поле — это «ничто», а не дырка. */
fl_status kompilyator_flang_sozdat_itog_imyon(fl_ctx *ctx, fl_value imena, fl_value sbor, fl_value *out, fl_error *error);

/* Запись FTS «Шаг параметра»: «имя», «взять», «сбор». */
/* Запись flang тотальна: пропущенное поле — это «ничто», а не дырка. */
fl_status kompilyator_flang_sozdat_shag_parametra(fl_ctx *ctx, fl_value imya, fl_value vzyat, fl_value sbor, fl_value *out, fl_error *error);

/* Запись FTS «Итог вывода»: «тип», «беды». */
/* Запись flang тотальна: пропущенное поле — это «ничто», а не дырка. */
fl_status kompilyator_flang_sozdat_itog_vyvoda(fl_ctx *ctx, fl_value tip, fl_value bedy, fl_value *out, fl_error *error);

/* Запись FTS «Ход аргументов»: «связки», «беды». */
/* Запись flang тотальна: пропущенное поле — это «ничто», а не дырка. */
fl_status kompilyator_flang_sozdat_hod_argumentov(fl_ctx *ctx, fl_value svyazki, fl_value bedy, fl_value *out, fl_error *error);

/* Запись FTS «Итог решения»: «связки», «беды». */
/* Запись flang тотальна: пропущенное поле — это «ничто», а не дырка. */
fl_status kompilyator_flang_sozdat_itog_resheniya(fl_ctx *ctx, fl_value svyazki, fl_value bedy, fl_value *out, fl_error *error);

/* Запись FTS «Покрытие»: «есть пусто», «есть хвост», «есть любое», «варианты», «литералы». */
/* Запись flang тотальна: пропущенное поле — это «ничто», а не дырка. */
fl_status kompilyator_flang_sozdat_pokrytie(fl_ctx *ctx, fl_value est_pusto, fl_value est_hvost, fl_value est_lyuboe, fl_value varianty, fl_value literaly, fl_value *out, fl_error *error);

/* Запись FTS «Ход разбора»: «покрытие», «итог», «беды». */
/* Запись flang тотальна: пропущенное поле — это «ничто», а не дырка. */
fl_status kompilyator_flang_sozdat_hod_razbora(fl_ctx *ctx, fl_value pokrytie, fl_value itog, fl_value bedy, fl_value *out, fl_error *error);

/* Запись FTS «Итог связывания»: «имена», «беды». */
/* Запись flang тотальна: пропущенное поле — это «ничто», а не дырка. */
fl_status kompilyator_flang_sozdat_itog_svyazyvaniya(fl_ctx *ctx, fl_value imena, fl_value bedy, fl_value *out, fl_error *error);

/* Запись FTS «Итог проверки»: «годно», «диагностики», «сигнатуры». */
/* Запись flang тотальна: пропущенное поле — это «ничто», а не дырка. */
fl_status kompilyator_flang_sozdat_itog_proverki(fl_ctx *ctx, fl_value godno, fl_value diagnostiki, fl_value signatury, fl_value *out, fl_error *error);

/* Запись FTS «Происхождение»: «известно», «параметр», «имя», «часть», «глубина», «мера», «шаг», «шаг параметром», «параметр шага», «положителен», «ограничен». */
/* Запись flang тотальна: пропущенное поле — это «ничто», а не дырка. */
fl_status kompilyator_flang_sozdat_proishozhdenie(fl_ctx *ctx, fl_value izvestno, fl_value parametr, fl_value imya, fl_value chast, fl_value glubina, fl_value mera, fl_value shag, fl_value shag_parametrom, fl_value parametr_shaga, fl_value polozhitelen, fl_value ogranichen, fl_value *out, fl_error *error);

/* Запись FTS «Граница»: «есть», «параметр», «в ветви то», «положительна». */
/* Запись flang тотальна: пропущенное поле — это «ничто», а не дырка. */
fl_status kompilyator_flang_sozdat_granica(fl_ctx *ctx, fl_value est, fl_value parametr, fl_value v_vetvi_to, fl_value polozhitelna, fl_value *out, fl_error *error);

/* Запись FTS «Ветвь границы»: «есть», «в ветви то», «строгая». */
/* Запись flang тотальна: пропущенное поле — это «ничто», а не дырка. */
fl_status kompilyator_flang_sozdat_vetv_granicy(fl_ctx *ctx, fl_value est, fl_value v_vetvi_to, fl_value strogaya, fl_value *out, fl_error *error);

/* Запись FTS «Способ»: «есть», «мера». */
/* Запись flang тотальна: пропущенное поле — это «ничто», а не дырка. */
fl_status kompilyator_flang_sozdat_sposob(fl_ctx *ctx, fl_value est, fl_value mera, fl_value *out, fl_error *error);

/* Запись FTS «Позиция убывания»: «позиция», «мера». */
/* Запись flang тотальна: пропущенное поле — это «ничто», а не дырка. */
fl_status kompilyator_flang_sozdat_poziciya_ubyvaniya(fl_ctx *ctx, fl_value poziciya, fl_value mera, fl_value *out, fl_error *error);

/* Запись FTS «Имя параметра»: «есть», «имя». */
/* Запись flang тотальна: пропущенное поле — это «ничто», а не дырка. */
fl_status kompilyator_flang_sozdat_imya_parametra(fl_ctx *ctx, fl_value est, fl_value imya, fl_value *out, fl_error *error);

/* Запись FTS «Связка»: «имя», «происхождение». */
/* Запись flang тотальна: пропущенное поле — это «ничто», а не дырка. */
fl_status kompilyator_flang_sozdat_svyazka(fl_ctx *ctx, fl_value imya, fl_value proishozhdenie, fl_value *out, fl_error *error);

/* Запись FTS «Аргумент»: «узел», «происхождение». */
/* Запись flang тотальна: пропущенное поле — это «ничто», а не дырка. */
fl_status kompilyator_flang_sozdat_argument(fl_ctx *ctx, fl_value uzel, fl_value proishozhdenie, fl_value *out, fl_error *error);

/* Запись FTS «Вызов»: «откуда», «куда», «узел», «параметры», «аргументы», «параметров вызываемого», «среда», «точные вызывающей», «точные вызываемой». */
/* Запись flang тотальна: пропущенное поле — это «ничто», а не дырка. */
fl_status kompilyator_flang_sozdat_vyzov(fl_ctx *ctx, fl_value otkuda, fl_value kuda, fl_value uzel, fl_value parametry, fl_value argumenty, fl_value parametrov_vyzyvaemogo, fl_value sreda, fl_value tochnye_vyzyvayuschey, fl_value tochnye_vyzyvaemoy, fl_value *out, fl_error *error);

/* Запись FTS «Обход»: «происхождение», «вызовы». */
/* Запись flang тотальна: пропущенное поле — это «ничто», а не дырка. */
fl_status kompilyator_flang_sozdat_obhod(fl_ctx *ctx, fl_value proishozhdenie, fl_value vyzovy, fl_value *out, fl_error *error);

/* Запись FTS «Сбор аргументов»: «аргументы», «вызовы». */
/* Запись flang тотальна: пропущенное поле — это «ничто», а не дырка. */
fl_status kompilyator_flang_sozdat_sbor_argumentov(fl_ctx *ctx, fl_value argumenty, fl_value vyzovy, fl_value *out, fl_error *error);

/* Запись FTS «Слияние ветвей»: «есть», «происхождение», «вызовы». */
/* Запись flang тотальна: пропущенное поле — это «ничто», а не дырка. */
fl_status kompilyator_flang_sozdat_sliyanie_vetvey(fl_ctx *ctx, fl_value est, fl_value proishozhdenie, fl_value vyzovy, fl_value *out, fl_error *error);

/* Запись FTS «Описание функции»: «имя», «тотальная», «параметры», «тело», «точные позиции». */
/* Запись flang тотальна: пропущенное поле — это «ничто», а не дырка. */
fl_status kompilyator_flang_sozdat_opisanie_funkcii(fl_ctx *ctx, fl_value imya, fl_value totalnaya, fl_value parametry, fl_value telo, fl_value tochnye_pozicii, fl_value *out, fl_error *error);

/* Запись FTS «Сбор среды»: «индекс», «среда». */
/* Запись flang тотальна: пропущенное поле — это «ничто», а не дырка. */
fl_status kompilyator_flang_sozdat_sbor_sredy(fl_ctx *ctx, fl_value indeks, fl_value sreda, fl_value *out, fl_error *error);

/* Запись FTS «Диагностика анализа»: «код», «сообщение», «важность», «есть место», «строка», «столбец». */
/* Запись flang тотальна: пропущенное поле — это «ничто», а не дырка. */
fl_status kompilyator_flang_sozdat_diagnostika_analiza(fl_ctx *ctx, fl_value kod, fl_value soobschenie, fl_value vazhnost, fl_value est_mesto, fl_value stroka, fl_value stolbec, fl_value *out, fl_error *error);

/* Запись FTS «Разложение вызовов»: «диагностики», «отказы», «рёбра». */
/* Запись flang тотальна: пропущенное поле — это «ничто», а не дырка. */
fl_status kompilyator_flang_sozdat_razlozhenie_vyzovov(fl_ctx *ctx, fl_value diagnostiki, fl_value otkazy, fl_value ryobra, fl_value *out, fl_error *error);

/* Запись FTS «Проверка»: «диагностики», «отказы», «меры», «точные». */
/* Запись flang тотальна: пропущенное поле — это «ничто», а не дырка. */
fl_status kompilyator_flang_sozdat_proverka(fl_ctx *ctx, fl_value diagnostiki, fl_value otkazy, fl_value mery, fl_value tochnye, fl_value *out, fl_error *error);

/* Запись FTS «Мера»: «откуда», «куда», «позиция», «параметр», «аргумент», «сообщение». */
/* Запись flang тотальна: пропущенное поле — это «ничто», а не дырка. */
fl_status kompilyator_flang_sozdat_mera(fl_ctx *ctx, fl_value otkuda, fl_value kuda, fl_value poziciya, fl_value parametr, fl_value argument, fl_value soobschenie, fl_value *out, fl_error *error);

/* Запись FTS «Точная мера»: «откуда», «куда», «позиция», «параметр», «шаг». */
/* Запись flang тотальна: пропущенное поле — это «ничто», а не дырка. */
fl_status kompilyator_flang_sozdat_tochnaya_mera(fl_ctx *ctx, fl_value otkuda, fl_value kuda, fl_value poziciya, fl_value parametr, fl_value shag, fl_value *out, fl_error *error);

/* Запись FTS «Оценка»: «ребро», «позиции». */
/* Запись flang тотальна: пропущенное поле — это «ничто», а не дырка. */
fl_status kompilyator_flang_sozdat_ocenka(fl_ctx *ctx, fl_value rebro, fl_value pozicii, fl_value *out, fl_error *error);

/* Запись FTS «Сбор позиций»: «индекс», «позиции». */
/* Запись flang тотальна: пропущенное поле — это «ничто», а не дырка. */
fl_status kompilyator_flang_sozdat_sbor_poziciy(fl_ctx *ctx, fl_value indeks, fl_value pozicii, fl_value *out, fl_error *error);

/* Запись FTS «Сбор точных»: «индекс», «позиции». */
/* Запись flang тотальна: пропущенное поле — это «ничто», а не дырка. */
fl_status kompilyator_flang_sozdat_sbor_tochnyh(fl_ctx *ctx, fl_value indeks, fl_value pozicii, fl_value *out, fl_error *error);

/* Запись FTS «Сбор причин»: «индекс», «причины». */
/* Запись flang тотальна: пропущенное поле — это «ничто», а не дырка. */
fl_status kompilyator_flang_sozdat_sbor_prichin(fl_ctx *ctx, fl_value indeks, fl_value prichiny, fl_value *out, fl_error *error);

/* Запись FTS «Отбор имени»: «индекс», «значение». */
/* Запись flang тотальна: пропущенное поле — это «ничто», а не дырка. */
fl_status kompilyator_flang_sozdat_otbor_imeni(fl_ctx *ctx, fl_value indeks, fl_value znachenie, fl_value *out, fl_error *error);

/* Запись FTS «Отбор аргумента»: «индекс», «значение». */
/* Запись flang тотальна: пропущенное поле — это «ничто», а не дырка. */
fl_status kompilyator_flang_sozdat_otbor_argumenta(fl_ctx *ctx, fl_value indeks, fl_value znachenie, fl_value *out, fl_error *error);

/* Запись FTS «Сбор отметок»: «имена», «функции». */
/* Запись flang тотальна: пропущенное поле — это «ничто», а не дырка. */
fl_status kompilyator_flang_sozdat_sbor_otmetok(fl_ctx *ctx, fl_value imena, fl_value funkcii, fl_value *out, fl_error *error);

/* Запись FTS «Сбор отметки»: «индекс», «элементы». */
/* Запись flang тотальна: пропущенное поле — это «ничто», а не дырка. */
fl_status kompilyator_flang_sozdat_sbor_otmetki(fl_ctx *ctx, fl_value indeks, fl_value elementy, fl_value *out, fl_error *error);

/* Запись FTS «Итог тотальности»: «доказано», «диагностики», «тотальные», «меры», «точные». */
/* Запись flang тотальна: пропущенное поле — это «ничто», а не дырка. */
fl_status kompilyator_flang_sozdat_itog_totalnosti(fl_ctx *ctx, fl_value dokazano, fl_value diagnostiki, fl_value totalnye, fl_value mery, fl_value tochnye, fl_value *out, fl_error *error);

/* Запись FTS «Исходник»: «путь», «текст». */
/* Запись flang тотальна: пропущенное поле — это «ничто», а не дырка. */
fl_status kompilyator_flang_sozdat_ishodnik(fl_ctx *ctx, fl_value put, fl_value tekst, fl_value *out, fl_error *error);

/* Запись FTS «Итог сборки»: «файлы», «ошибка», «диагностики». */
/* Запись flang тотальна: пропущенное поле — это «ничто», а не дырка. */
fl_status kompilyator_flang_sozdat_itog_sborki(fl_ctx *ctx, fl_value fayly, fl_value oshibka, fl_value diagnostiki, fl_value *out, fl_error *error);

/* Запись FTS «Итог проверки исходников»: «годно», «диагностики». */
/* Запись flang тотальна: пропущенное поле — это «ничто», а не дырка. */
fl_status kompilyator_flang_sozdat_itog_proverki_ishodnikov(fl_ctx *ctx, fl_value godno, fl_value diagnostiki, fl_value *out, fl_error *error);

/* Запись FTS «Программа с бедами»: «программа», «диагностики». */
/* Запись flang тотальна: пропущенное поле — это «ничто», а не дырка. */
fl_status kompilyator_flang_sozdat_programma_s_bedami(fl_ctx *ctx, fl_value programma, fl_value diagnostiki, fl_value *out, fl_error *error);

/* Запись FTS «Видимость»: «всё», «имена». */
/* Запись flang тотальна: пропущенное поле — это «ничто», а не дырка. */
fl_status kompilyator_flang_sozdat_vidimost(fl_ctx *ctx, fl_value vsyo, fl_value imena, fl_value *out, fl_error *error);

/* Запись FTS «Просьба»: «путь», «видимость». */
/* Запись flang тотальна: пропущенное поле — это «ничто», а не дырка. */
fl_status kompilyator_flang_sozdat_prosba(fl_ctx *ctx, fl_value put, fl_value vidimost, fl_value *out, fl_error *error);

/* Запись FTS «Связывание»: «типы», «функции», «откуда типов», «откуда функций», «загружены», «грузятся», «просьбы», «с импортами», «беды». */
/* Запись flang тотальна: пропущенное поле — это «ничто», а не дырка. */
fl_status kompilyator_flang_sozdat_svyazyvanie(fl_ctx *ctx, fl_value tipy, fl_value funkcii, fl_value otkuda_tipov, fl_value otkuda_funkciy, fl_value zagruzheny, fl_value gruzyatsya, fl_value prosby, fl_value s_importami, fl_value bedy, fl_value *out, fl_error *error);

/* Запись FTS «Шаг связки»: «связка», «программа». */
/* Запись flang тотальна: пропущенное поле — это «ничто», а не дырка. */
fl_status kompilyator_flang_sozdat_shag_svyazki(fl_ctx *ctx, fl_value svyazka, fl_value programma, fl_value *out, fl_error *error);

/* Запись FTS «Подмена»: «имя», «файл», «узел». */
/* Запись flang тотальна: пропущенное поле — это «ничто», а не дырка. */
fl_status kompilyator_flang_sozdat_podmena(fl_ctx *ctx, fl_value imya, fl_value fayl, fl_value uzel, fl_value *out, fl_error *error);

/* Сумма типов FTS «Режим»: «Начало» | «Тело» | «Блок в начале» | «Блок в теле» | «В кавычках». */
/* Дискриминант — имя варианта; проверяется через fl_variant_is(значение, "Имя"). */
fl_status kompilyator_flang_variant_nachalo(fl_ctx *ctx, fl_value *out, fl_error *error);
fl_status kompilyator_flang_variant_telo(fl_ctx *ctx, fl_value *out, fl_error *error);
fl_status kompilyator_flang_variant_blok_v_nachale(fl_ctx *ctx, fl_value *out, fl_error *error);
fl_status kompilyator_flang_variant_blok_v_tele(fl_ctx *ctx, fl_value *out, fl_error *error);
fl_status kompilyator_flang_variant_v_kavychkah(fl_ctx *ctx, fl_value *out, fl_error *error);

/* Сумма типов FTS «Класс»: «Пробел» | «Косая» | «Стрела» | «Черта» | «Равенство» | «Ёлочка» | «Кавычка» | «Цифра» | «Буква» | «Знак» | «Иное». */
/* Дискриминант — имя варианта; проверяется через fl_variant_is(значение, "Имя"). */
fl_status kompilyator_flang_variant_probel(fl_ctx *ctx, fl_value *out, fl_error *error);
fl_status kompilyator_flang_variant_kosaya(fl_ctx *ctx, fl_value *out, fl_error *error);
fl_status kompilyator_flang_variant_strela(fl_ctx *ctx, fl_value *out, fl_error *error);
fl_status kompilyator_flang_variant_cherta(fl_ctx *ctx, fl_value *out, fl_error *error);
fl_status kompilyator_flang_variant_ravenstvo(fl_ctx *ctx, fl_value *out, fl_error *error);
fl_status kompilyator_flang_variant_yolochka(fl_ctx *ctx, fl_value *out, fl_error *error);
fl_status kompilyator_flang_variant_kavychka(fl_ctx *ctx, fl_value *out, fl_error *error);
fl_status kompilyator_flang_variant_cifra(fl_ctx *ctx, fl_value *out, fl_error *error);
fl_status kompilyator_flang_variant_bukva(fl_ctx *ctx, fl_value *out, fl_error *error);
fl_status kompilyator_flang_variant_znak(fl_ctx *ctx, fl_value *out, fl_error *error);
fl_status kompilyator_flang_variant_inoe(fl_ctx *ctx, fl_value *out, fl_error *error);

/* Сумма типов FTS «Скаляр»: «Скаляр строка» | «Скаляр число» | «Скаляр признак» | «Скаляр ничто». */
/* Дискриминант — имя варианта; проверяется через fl_variant_is(значение, "Имя"). */
fl_status kompilyator_flang_variant_skalyar_stroka(fl_ctx *ctx, fl_value znachenie, fl_value *out, fl_error *error);
fl_status kompilyator_flang_variant_skalyar_chislo(fl_ctx *ctx, fl_value znachenie, fl_value *out, fl_error *error);
fl_status kompilyator_flang_variant_skalyar_priznak(fl_ctx *ctx, fl_value znachenie, fl_value *out, fl_error *error);
fl_status kompilyator_flang_variant_skalyar_nichto(fl_ctx *ctx, fl_value *out, fl_error *error);

/* Сумма типов FTS «Значение»: «Значение скаляра» | «Значение списка» | «Значение записи». */
/* Дискриминант — имя варианта; проверяется через fl_variant_is(значение, "Имя"). */
fl_status kompilyator_flang_variant_znachenie_skalyara(fl_ctx *ctx, fl_value skalyar, fl_value *out, fl_error *error);
fl_status kompilyator_flang_variant_znachenie_spiska(fl_ctx *ctx, fl_value elementy, fl_value *out, fl_error *error);
fl_status kompilyator_flang_variant_znachenie_zapisi(fl_ctx *ctx, fl_value polya, fl_value *out, fl_error *error);

/* Сумма типов FTS «Может быть узел при разборе»: «Есть узел при разборе» | «Нет узла при разборе». */
/* Дискриминант — имя варианта; проверяется через fl_variant_is(значение, "Имя"). */
fl_status kompilyator_flang_variant_est_uzel_pri_razbore(fl_ctx *ctx, fl_value uzel, fl_value *out, fl_error *error);
fl_status kompilyator_flang_variant_net_uzla_pri_razbore(fl_ctx *ctx, fl_value *out, fl_error *error);

/* Сумма типов FTS «Может быть беда»: «Есть беда» | «Нет беды». */
/* Дискриминант — имя варианта; проверяется через fl_variant_is(значение, "Имя"). */
fl_status kompilyator_flang_variant_est_beda(fl_ctx *ctx, fl_value beda, fl_value *out, fl_error *error);
fl_status kompilyator_flang_variant_net_bedy(fl_ctx *ctx, fl_value *out, fl_error *error);

/* Сумма типов FTS «Может быть имя при разборе»: «Есть имя при разборе» | «Нет имени при разборе». */
/* Дискриминант — имя варианта; проверяется через fl_variant_is(значение, "Имя"). */
fl_status kompilyator_flang_variant_est_imya_pri_razbore(fl_ctx *ctx, fl_value imya, fl_value *out, fl_error *error);
fl_status kompilyator_flang_variant_net_imeni_pri_razbore(fl_ctx *ctx, fl_value *out, fl_error *error);

/* Сумма типов FTS «Поиск скобки»: «Скобка есть» | «Скобки нет» | «Не решено». */
/* Дискриминант — имя варианта; проверяется через fl_variant_is(значение, "Имя"). */
fl_status kompilyator_flang_variant_skobka_est(fl_ctx *ctx, fl_value *out, fl_error *error);
fl_status kompilyator_flang_variant_skobki_net(fl_ctx *ctx, fl_value *out, fl_error *error);
fl_status kompilyator_flang_variant_ne_resheno(fl_ctx *ctx, fl_value *out, fl_error *error);

/* Сумма типов FTS «Может быть узел»: «Есть узел» | «Нет узла». */
/* Дискриминант — имя варианта; проверяется через fl_variant_is(значение, "Имя"). */
fl_status kompilyator_flang_variant_est_uzel(fl_ctx *ctx, fl_value uzel, fl_value *out, fl_error *error);
fl_status kompilyator_flang_variant_net_uzla(fl_ctx *ctx, fl_value *out, fl_error *error);

/* Сумма типов FTS «Может быть имя»: «Есть имя» | «Нет имени». */
/* Дискриминант — имя варианта; проверяется через fl_variant_is(значение, "Имя"). */
fl_status kompilyator_flang_variant_est_imya(fl_ctx *ctx, fl_value imya, fl_value *out, fl_error *error);
fl_status kompilyator_flang_variant_net_imeni(fl_ctx *ctx, fl_value *out, fl_error *error);

/* Сумма типов FTS «Может быть функция»: «Есть функция» | «Нет функции». */
/* Дискриминант — имя варианта; проверяется через fl_variant_is(значение, "Имя"). */
fl_status kompilyator_flang_variant_est_funkciya(fl_ctx *ctx, fl_value funkciya, fl_value *out, fl_error *error);
fl_status kompilyator_flang_variant_net_funkcii(fl_ctx *ctx, fl_value *out, fl_error *error);

/* Сумма типов FTS «Может быть число»: «Есть число» | «Нет числа». */
/* Дискриминант — имя варианта; проверяется через fl_variant_is(значение, "Имя"). */
fl_status kompilyator_flang_variant_est_chislo(fl_ctx *ctx, fl_value znachenie, fl_value *out, fl_error *error);
fl_status kompilyator_flang_variant_net_chisla(fl_ctx *ctx, fl_value *out, fl_error *error);

/* Сумма типов FTS «Вид типа»: «Вид неизвестного» | «Вид числа» | «Вид отрезка» | «Вид строки» | «Вид признака» | «Вид ничего» | «Вид списка» | «Вид записи» | «Вид суммы» | «Вид функции» | «Вид параметра». */
/* Дискриминант — имя варианта; проверяется через fl_variant_is(значение, "Имя"). */
fl_status kompilyator_flang_variant_vid_neizvestnogo(fl_ctx *ctx, fl_value *out, fl_error *error);
fl_status kompilyator_flang_variant_vid_chisla(fl_ctx *ctx, fl_value *out, fl_error *error);
fl_status kompilyator_flang_variant_vid_otrezka(fl_ctx *ctx, fl_value niz, fl_value verh, fl_value *out, fl_error *error);
fl_status kompilyator_flang_variant_vid_stroki(fl_ctx *ctx, fl_value *out, fl_error *error);
fl_status kompilyator_flang_variant_vid_priznaka(fl_ctx *ctx, fl_value *out, fl_error *error);
fl_status kompilyator_flang_variant_vid_nichego(fl_ctx *ctx, fl_value *out, fl_error *error);
fl_status kompilyator_flang_variant_vid_spiska(fl_ctx *ctx, fl_value element, fl_value *out, fl_error *error);
fl_status kompilyator_flang_variant_vid_zapisi(fl_ctx *ctx, fl_value imya, fl_value argumenty, fl_value *out, fl_error *error);
fl_status kompilyator_flang_variant_vid_summy(fl_ctx *ctx, fl_value imya, fl_value argumenty, fl_value *out, fl_error *error);
fl_status kompilyator_flang_variant_vid_funkcii(fl_ctx *ctx, fl_value prinimaet, fl_value vozvraschaet, fl_value *out, fl_error *error);
fl_status kompilyator_flang_variant_vid_parametra(fl_ctx *ctx, fl_value imya, fl_value *out, fl_error *error);

/* Сумма типов FTS «Может быть тип»: «Тип задан» | «Тип не задан». */
/* Дискриминант — имя варианта; проверяется через fl_variant_is(значение, "Имя"). */
fl_status kompilyator_flang_variant_tip_zadan(fl_ctx *ctx, fl_value tip, fl_value *out, fl_error *error);
fl_status kompilyator_flang_variant_tip_ne_zadan(fl_ctx *ctx, fl_value *out, fl_error *error);

/* Сумма типов FTS «Поиск записи»: «Запись найдена» | «Запись не найдена». */
/* Дискриминант — имя варианта; проверяется через fl_variant_is(значение, "Имя"). */
fl_status kompilyator_flang_variant_zapis_naydena(fl_ctx *ctx, fl_value zapis, fl_value *out, fl_error *error);
fl_status kompilyator_flang_variant_zapis_ne_naydena(fl_ctx *ctx, fl_value *out, fl_error *error);

/* Сумма типов FTS «Поиск суммы»: «Сумма найдена» | «Сумма не найдена». */
/* Дискриминант — имя варианта; проверяется через fl_variant_is(значение, "Имя"). */
fl_status kompilyator_flang_variant_summa_naydena(fl_ctx *ctx, fl_value summa, fl_value *out, fl_error *error);
fl_status kompilyator_flang_variant_summa_ne_naydena(fl_ctx *ctx, fl_value *out, fl_error *error);

/* Сумма типов FTS «Поиск варианта»: «Вариант найден» | «Вариант не найден». */
/* Дискриминант — имя варианта; проверяется через fl_variant_is(значение, "Имя"). */
fl_status kompilyator_flang_variant_variant_nayden(fl_ctx *ctx, fl_value variant, fl_value *out, fl_error *error);
fl_status kompilyator_flang_variant_variant_ne_nayden(fl_ctx *ctx, fl_value *out, fl_error *error);

/* Сумма типов FTS «Поиск поля»: «Поле найдено» | «Поле не найдено». */
/* Дискриминант — имя варианта; проверяется через fl_variant_is(значение, "Имя"). */
fl_status kompilyator_flang_variant_pole_naydeno(fl_ctx *ctx, fl_value pole, fl_value *out, fl_error *error);
fl_status kompilyator_flang_variant_pole_ne_naydeno(fl_ctx *ctx, fl_value *out, fl_error *error);

/* Сумма типов FTS «Поиск сигнатуры»: «Сигнатура найдена» | «Сигнатура не найдена». */
/* Дискриминант — имя варианта; проверяется через fl_variant_is(значение, "Имя"). */
fl_status kompilyator_flang_variant_signatura_naydena(fl_ctx *ctx, fl_value signatura, fl_value *out, fl_error *error);
fl_status kompilyator_flang_variant_signatura_ne_naydena(fl_ctx *ctx, fl_value *out, fl_error *error);

/* Сумма типов FTS «Поиск параметра»: «Параметр найден» | «Параметр не найден». */
/* Дискриминант — имя варианта; проверяется через fl_variant_is(значение, "Имя"). */
fl_status kompilyator_flang_variant_parametr_nayden(fl_ctx *ctx, fl_value parametr, fl_value *out, fl_error *error);
fl_status kompilyator_flang_variant_parametr_ne_nayden(fl_ctx *ctx, fl_value *out, fl_error *error);

/* Сумма типов FTS «Имена»: «Имён нет» | «Имя связано». */
/* Дискриминант — имя варианта; проверяется через fl_variant_is(значение, "Имя"). */
fl_status kompilyator_flang_variant_imyon_net(fl_ctx *ctx, fl_value *out, fl_error *error);
fl_status kompilyator_flang_variant_imya_svyazano(fl_ctx *ctx, fl_value imya, fl_value tip, fl_value dalshe, fl_value *out, fl_error *error);

/* Сумма типов FTS «Может быть аргумент»: «Есть аргумент» | «Нет аргумента». */
/* Дискриминант — имя варианта; проверяется через fl_variant_is(значение, "Имя"). */
fl_status kompilyator_flang_variant_est_argument(fl_ctx *ctx, fl_value znachenie, fl_value *out, fl_error *error);
fl_status kompilyator_flang_variant_net_argumenta(fl_ctx *ctx, fl_value *out, fl_error *error);

/* Сумма типов FTS «Может быть просьба»: «Есть просьба» | «Нет просьбы». */
/* Дискриминант — имя варианта; проверяется через fl_variant_is(значение, "Имя"). */
fl_status kompilyator_flang_variant_est_prosba(fl_ctx *ctx, fl_value prosba, fl_value *out, fl_error *error);
fl_status kompilyator_flang_variant_net_prosby(fl_ctx *ctx, fl_value *out, fl_error *error);

/* Сумма типов FTS «Может быть подмена»: «Есть подмена» | «Нет подмены». */
/* Дискриминант — имя варианта; проверяется через fl_variant_is(значение, "Имя"). */
fl_status kompilyator_flang_variant_est_podmena(fl_ctx *ctx, fl_value podmena, fl_value *out, fl_error *error);
fl_status kompilyator_flang_variant_net_podmeny(fl_ctx *ctx, fl_value *out, fl_error *error);

/*
 * Функция flang «Приписать строку в начало».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param pervaya — «первая»: строка
 * @param elementy — «элементы»: список: строка
 * @return значение: список: строка
 */
fl_status kompilyator_flang_pripisat_stroku_v_nachalo(fl_ctx *ctx, fl_value pervaya, fl_value elementy, fl_value *result, fl_error *error);

/*
 * Функция flang «Соединить строки».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param chasti — «части»: список: строка
 * @param razdelitel — «разделитель»: строка
 * @return значение: строка
 */
fl_status kompilyator_flang_soedinit_stroki(fl_ctx *ctx, fl_value chasti, fl_value razdelitel, fl_value *result, fl_error *error);

/*
 * Функция flang «Заменить».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param tekst — «текст»: строка
 * @param chto — «что»: строка
 * @param chem — «чем»: строка
 * @return значение: строка
 */
fl_status kompilyator_flang_zamenit(fl_ctx *ctx, fl_value tekst, fl_value chto, fl_value chem, fl_value *result, fl_error *error);

/*
 * Функция flang «Позиция подстроки».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param tekst — «текст»: строка
 * @param chast — «часть»: строка
 * @return значение: число
 */
fl_status kompilyator_flang_poziciya_podstroki(fl_ctx *ctx, fl_value tekst, fl_value chast, fl_value *result, fl_error *error);

/*
 * Функция flang «Заглавные».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @return значение: строка
 */
fl_status kompilyator_flang_zaglavnye(fl_ctx *ctx, fl_value *result, fl_error *error);

/*
 * Функция flang «Строчные».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @return значение: строка
 */
fl_status kompilyator_flang_strochnye(fl_ctx *ctx, fl_value *result, fl_error *error);

/*
 * Функция flang «Знаки цифр».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @return значение: строка
 */
fl_status kompilyator_flang_znaki_cifr(fl_ctx *ctx, fl_value *result, fl_error *error);

/*
 * Функция flang «Иероглифы».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @return значение: строка
 */
fl_status kompilyator_flang_ieroglify(fl_ctx *ctx, fl_value *result, fl_error *error);

/*
 * Функция flang «Начала имени».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @return значение: строка
 */
fl_status kompilyator_flang_nachala_imeni(fl_ctx *ctx, fl_value *result, fl_error *error);

/*
 * Функция flang «Части имени».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @return значение: строка
 */
fl_status kompilyator_flang_chasti_imeni(fl_ctx *ctx, fl_value *result, fl_error *error);

/*
 * Функция flang «Знаки».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @return значение: строка
 */
fl_status kompilyator_flang_znaki(fl_ctx *ctx, fl_value *result, fl_error *error);

/*
 * Функция flang «Знаки полной ширины».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @return значение: строка
 */
fl_status kompilyator_flang_znaki_polnoy_shiriny(fl_ctx *ctx, fl_value *result, fl_error *error);

/*
 * Функция flang «Узкий знак».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param bukva — «буква»: строка
 * @return значение: строка
 */
fl_status kompilyator_flang_uzkiy_znak(fl_ctx *ctx, fl_value bukva, fl_value *result, fl_error *error);

/*
 * Функция flang «Блоки таблицы».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @return значение: список: «Блок таблицы»
 */
fl_status kompilyator_flang_bloki_tablicy(fl_ctx *ctx, fl_value *result, fl_error *error);

/*
 * Функция flang «Есть в алфавите».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param alfavit — «алфавит»: строка
 * @param bukva — «буква»: строка
 * @return значение
 */
fl_status kompilyator_flang_est_v_alfavite(fl_ctx *ctx, fl_value alfavit, fl_value bukva, fl_value *result, fl_error *error);

/*
 * Функция flang «Это цифра».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param bukva — «буква»: строка
 * @return значение
 */
fl_status kompilyator_flang_eto_cifra(fl_ctx *ctx, fl_value bukva, fl_value *result, fl_error *error);

/*
 * Функция flang «Это начало имени».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param bukva — «буква»: строка
 * @return значение
 */
fl_status kompilyator_flang_eto_nachalo_imeni(fl_ctx *ctx, fl_value bukva, fl_value *result, fl_error *error);

/*
 * Функция flang «Это часть имени».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param bukva — «буква»: строка
 * @return значение
 */
fl_status kompilyator_flang_eto_chast_imeni(fl_ctx *ctx, fl_value bukva, fl_value *result, fl_error *error);

/*
 * Функция flang «Это знак».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param bukva — «буква»: строка
 * @return значение
 */
fl_status kompilyator_flang_eto_znak(fl_ctx *ctx, fl_value bukva, fl_value *result, fl_error *error);

/*
 * Функция flang «Класс символа».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param bukva — «буква»: строка
 * @return значение: «Класс»
 */
fl_status kompilyator_flang_klass_simvola(fl_ctx *ctx, fl_value bukva, fl_value *result, fl_error *error);

/*
 * Функция flang «Первый впереди».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param simvoly — «символы»: список: строка
 * @return значение: строка
 */
fl_status kompilyator_flang_pervyy_vperedi(fl_ctx *ctx, fl_value simvoly, fl_value *result, fl_error *error);

/*
 * Функция flang «Второй впереди».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param simvoly — «символы»: список: строка
 * @return значение: строка
 */
fl_status kompilyator_flang_vtoroy_vperedi(fl_ctx *ctx, fl_value simvoly, fl_value *result, fl_error *error);

/*
 * Функция flang «Третий впереди».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param simvoly — «символы»: список: строка
 * @return значение: строка
 */
fl_status kompilyator_flang_tretiy_vperedi(fl_ctx *ctx, fl_value simvoly, fl_value *result, fl_error *error);

/*
 * Функция flang «Начало списка».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param simvoly — «символы»: список: строка
 * @param skolko — «сколько»: число
 * @return значение: строка
 */
fl_status kompilyator_flang_nachalo_spiska(fl_ctx *ctx, fl_value simvoly, fl_value skolko, fl_value *result, fl_error *error);

/*
 * Функция flang «Место символа».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param alfavit — «алфавит»: строка
 * @param bukva — «буква»: строка
 * @return значение: число
 */
fl_status kompilyator_flang_mesto_simvola(fl_ctx *ctx, fl_value alfavit, fl_value bukva, fl_value *result, fl_error *error);

/*
 * Функция flang «Строчная».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param bukva — «буква»: строка
 * @return значение: строка
 */
fl_status kompilyator_flang_strochnaya(fl_ctx *ctx, fl_value bukva, fl_value *result, fl_error *error);

/*
 * Функция flang «Нижний регистр».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param tekst — «текст»: строка
 * @return значение: строка
 */
fl_status kompilyator_flang_nizhniy_registr(fl_ctx *ctx, fl_value tekst, fl_value *result, fl_error *error);

/*
 * Функция flang «Шестнадцатеричная».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param bukva — «буква»: строка
 * @return значение: число
 */
fl_status kompilyator_flang_shestnadcaterichnaya(fl_ctx *ctx, fl_value bukva, fl_value *result, fl_error *error);

/*
 * Функция flang «Код четвёрки».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param chetvyorka — «четвёрка»: строка
 * @return значение: число
 */
fl_status kompilyator_flang_kod_chetvyorki(fl_ctx *ctx, fl_value chetvyorka, fl_value *result, fl_error *error);

/*
 * Функция flang «Символ по коду».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param kod — «код»: число
 * @return значение: строка
 */
fl_status kompilyator_flang_simvol_po_kodu(fl_ctx *ctx, fl_value kod, fl_value *result, fl_error *error);

/*
 * Функция flang «Экранированный».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param bukva — «буква»: строка
 * @return значение: строка
 */
fl_status kompilyator_flang_ekranirovannyy(fl_ctx *ctx, fl_value bukva, fl_value *result, fl_error *error);

/*
 * Функция flang «Читать в кавычках».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * Хвостовой самовызов развёрнут в цикл: стек не растёт.
 *
 * Взаимная хвостовая рекурсия с «Читать юникод», «Читать экранированное»: вызовы идут через батут.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param simvoly — «символы»: список: строка
 * @param zakryvayuschaya — «закрывающая»: строка
 * @param nakopleno — «накоплено»: строка
 * @param sedeno — «съедено»: число
 * @return значение: «Чтение»
 */
fl_status kompilyator_flang_chitat_v_kavychkah(fl_ctx *ctx, fl_value simvoly, fl_value zakryvayuschaya, fl_value nakopleno, fl_value sedeno, fl_value *result, fl_error *error);

/*
 * Функция flang «Читать экранированное».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * Взаимная хвостовая рекурсия с «Читать юникод», «Читать в кавычках»: вызовы идут через батут.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param simvoly — «символы»: список: строка
 * @param zakryvayuschaya — «закрывающая»: строка
 * @param nakopleno — «накоплено»: строка
 * @param sedeno — «съедено»: число
 * @return значение: «Чтение»
 */
fl_status kompilyator_flang_chitat_ekranirovannoe(fl_ctx *ctx, fl_value simvoly, fl_value zakryvayuschaya, fl_value nakopleno, fl_value sedeno, fl_value *result, fl_error *error);

/*
 * Функция flang «Читать юникод».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * Взаимная хвостовая рекурсия с «Читать экранированное», «Читать в кавычках»: вызовы идут через батут.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param simvoly — «символы»: список: строка
 * @param zakryvayuschaya — «закрывающая»: строка
 * @param nakopleno — «накоплено»: строка
 * @param sedeno — «съедено»: число
 * @return значение: «Чтение»
 */
fl_status kompilyator_flang_chitat_yunikod(fl_ctx *ctx, fl_value simvoly, fl_value zakryvayuschaya, fl_value nakopleno, fl_value sedeno, fl_value *result, fl_error *error);

/*
 * Функция flang «Читать имя».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * Хвостовой самовызов развёрнут в цикл: стек не растёт.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param simvoly — «символы»: список: строка
 * @param znachenie — «значение»: строка
 * @param zaglavnye — «заглавные»
 * @return значение: «Слово»
 */
fl_status kompilyator_flang_chitat_imya(fl_ctx *ctx, fl_value simvoly, fl_value znachenie, fl_value zaglavnye, fl_value *result, fl_error *error);

/*
 * Функция flang «Цифры подряд».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * Хвостовой самовызов развёрнут в цикл: стек не растёт.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param simvoly — «символы»: список: строка
 * @param nakopleno — «накоплено»: строка
 * @return значение: «Пробег»
 */
fl_status kompilyator_flang_cifry_podryad(fl_ctx *ctx, fl_value simvoly, fl_value nakopleno, fl_value *result, fl_error *error);

/*
 * Функция flang «Дробная часть».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param simvoly — «символы»: список: строка
 * @return значение: «Пробег»
 */
fl_status kompilyator_flang_drobnaya_chast(fl_ctx *ctx, fl_value simvoly, fl_value *result, fl_error *error);

/*
 * Функция flang «Порядок числа».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param simvoly — «символы»: список: строка
 * @return значение: «Пробег»
 */
fl_status kompilyator_flang_poryadok_chisla(fl_ctx *ctx, fl_value simvoly, fl_value *result, fl_error *error);

/*
 * Функция flang «Запись числа».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param simvoly — «символы»: список: строка
 * @return значение: строка
 */
fl_status kompilyator_flang_zapis_chisla(fl_ctx *ctx, fl_value simvoly, fl_value *result, fl_error *error);

/*
 * Функция flang «Простой токен».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param vid — «вид»: строка
 * @param znachenie — «значение»: строка
 * @param nomer — «номер»: число
 * @param mesto — «место»: число
 * @return значение: «Токен»
 */
fl_status kompilyator_flang_prostoy_token(fl_ctx *ctx, fl_value vid, fl_value znachenie, fl_value nomer, fl_value mesto, fl_value *result, fl_error *error);

/*
 * Функция flang «Токен имени».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param znachenie — «значение»: строка
 * @param nizhniy — «нижний»: строка
 * @param v_yolochkah — «в ёлочках»
 * @param nomer — «номер»: число
 * @param mesto — «место»: число
 * @return значение: «Токен»
 */
fl_status kompilyator_flang_token_imeni(fl_ctx *ctx, fl_value znachenie, fl_value nizhniy, fl_value v_yolochkah, fl_value nomer, fl_value mesto, fl_value *result, fl_error *error);

/*
 * Функция flang «Токен литерала».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param znachenie — «значение»: строка
 * @param nomer — «номер»: число
 * @param mesto — «место»: число
 * @return значение: «Токен»
 */
fl_status kompilyator_flang_token_literala(fl_ctx *ctx, fl_value znachenie, fl_value nomer, fl_value mesto, fl_value *result, fl_error *error);

/*
 * Функция flang «Токен числа».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param tekst — «текст»: строка
 * @param nomer — «номер»: число
 * @param mesto — «место»: число
 * @return значение: «Токен»
 */
fl_status kompilyator_flang_token_chisla(fl_ctx *ctx, fl_value tekst, fl_value nomer, fl_value mesto, fl_value *result, fl_error *error);

/*
 * Функция flang «Соединить токены».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param pervye — «первые»: список: «Токен»
 * @param vtorye — «вторые»: список: «Токен»
 * @return значение: список: «Токен»
 */
fl_status kompilyator_flang_soedinit_tokeny(fl_ctx *ctx, fl_value pervye, fl_value vtorye, fl_value *result, fl_error *error);

/*
 * Функция flang «Приписать токен».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param pervyy — «первый»: «Токен»
 * @param elementy — «элементы»: список: «Токен»
 * @return значение: список: «Токен»
 */
fl_status kompilyator_flang_pripisat_token(fl_ctx *ctx, fl_value pervyy, fl_value elementy, fl_value *result, fl_error *error);

/*
 * Функция flang «Значащий».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param token — «токен»: «Токен»
 * @return значение
 */
fl_status kompilyator_flang_znachaschiy(fl_ctx *ctx, fl_value token, fl_value *result, fl_error *error);

/*
 * Функция flang «С токеном».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param sostoyanie — «состояние»: «Лексер»
 * @param token — «токен»: «Токен»
 * @return значение: «Лексер»
 */
fl_status kompilyator_flang_s_tokenom(fl_ctx *ctx, fl_value sostoyanie, fl_value token, fl_value *result, fl_error *error);

/*
 * Функция flang «С режимом».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param sostoyanie — «состояние»: «Лексер»
 * @param rezhim — «режим»: «Режим»
 * @return значение: «Лексер»
 */
fl_status kompilyator_flang_s_rezhimom(fl_ctx *ctx, fl_value sostoyanie, fl_value rezhim, fl_value *result, fl_error *error);

/*
 * Функция flang «С глубиной».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param sostoyanie — «состояние»: «Лексер»
 * @param glubina — «глубина»: число
 * @return значение: «Лексер»
 */
fl_status kompilyator_flang_s_glubinoy(fl_ctx *ctx, fl_value sostoyanie, fl_value glubina, fl_value *result, fl_error *error);

/*
 * Функция flang «С отступами».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param sostoyanie — «состояние»: «Лексер»
 * @param stek — «стек»: список: число
 * @param otstupnye — «отступные»: список: «Токен»
 * @return значение: «Лексер»
 */
fl_status kompilyator_flang_s_otstupami(fl_ctx *ctx, fl_value sostoyanie, fl_value stek, fl_value otstupnye, fl_value *result, fl_error *error);

/*
 * Функция flang «С меткой».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param sostoyanie — «состояние»: «Лексер»
 * @param rezhim — «режим»: «Режим»
 * @param zakryvayuschaya — «закрывающая»: строка
 * @param nakopleno — «накоплено»: строка
 * @param nomer — «номер»: число
 * @param mesto — «место»: число
 * @return значение: «Лексер»
 */
fl_status kompilyator_flang_s_metkoy(fl_ctx *ctx, fl_value sostoyanie, fl_value rezhim, fl_value zakryvayuschaya, fl_value nakopleno, fl_value nomer, fl_value mesto, fl_value *result, fl_error *error);

/*
 * Функция flang «С новой строкой».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param sostoyanie — «состояние»: «Лексер»
 * @param nomer — «номер»: число
 * @param kray — «край»: число
 * @return значение: «Лексер»
 */
fl_status kompilyator_flang_s_novoy_strokoy(fl_ctx *ctx, fl_value sostoyanie, fl_value nomer, fl_value kray, fl_value *result, fl_error *error);

/*
 * Функция flang «С ошибкой».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param sostoyanie — «состояние»: «Лексер»
 * @param kod — «код»: строка
 * @param soobschenie — «сообщение»: строка
 * @param nomer — «номер»: число
 * @param mesto — «место»: число
 * @return значение: «Лексер»
 */
fl_status kompilyator_flang_s_oshibkoy(fl_ctx *ctx, fl_value sostoyanie, fl_value kod, fl_value soobschenie, fl_value nomer, fl_value mesto, fl_value *result, fl_error *error);

/*
 * Функция flang «Слить строку».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param sostoyanie — «состояние»: «Лексер»
 * @param rezhim — «режим»: «Режим»
 * @return значение: «Лексер»
 */
fl_status kompilyator_flang_slit_stroku(fl_ctx *ctx, fl_value sostoyanie, fl_value rezhim, fl_value *result, fl_error *error);

/*
 * Функция flang «Сломан».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param sostoyanie — «состояние»: «Лексер»
 * @return значение
 */
fl_status kompilyator_flang_sloman(fl_ctx *ctx, fl_value sostoyanie, fl_value *result, fl_error *error);

/*
 * Функция flang «Куски таблицы».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @return значение: список: строка
 */
fl_status kompilyator_flang_kuski_tablicy(fl_ctx *ctx, fl_value *result, fl_error *error);

/*
 * Функция flang «Идентификатор фразы».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param fraza — «фраза»: строка
 * @return значение: строка
 */
fl_status kompilyator_flang_identifikator_frazy(fl_ctx *ctx, fl_value fraza, fl_value *result, fl_error *error);

/*
 * Функция flang «Может начинать».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param slovo — «слово»: строка
 * @return значение
 */
fl_status kompilyator_flang_mozhet_nachinat(fl_ctx *ctx, fl_value slovo, fl_value *result, fl_error *error);

/*
 * Функция flang «Складываемый».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param token — «токен»: «Токен»
 * @return значение
 */
fl_status kompilyator_flang_skladyvaemyy(fl_ctx *ctx, fl_value token, fl_value *result, fl_error *error);

/*
 * Функция flang «Слова фразы».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param tokeny — «токены»: список: «Токен»
 * @param skolko — «сколько»: число
 * @return значение: список: строка
 */
fl_status kompilyator_flang_slova_frazy(fl_ctx *ctx, fl_value tokeny, fl_value skolko, fl_value *result, fl_error *error);

/*
 * Функция flang «Первые слова».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param slova — «слова»: список: строка
 * @param skolko — «сколько»: число
 * @return значение: список: строка
 */
fl_status kompilyator_flang_pervye_slova(fl_ctx *ctx, fl_value slova, fl_value skolko, fl_value *result, fl_error *error);

/*
 * Функция flang «Первые токены».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param tokeny — «токены»: список: «Токен»
 * @param skolko — «сколько»: число
 * @return значение: список: «Токен»
 */
fl_status kompilyator_flang_pervye_tokeny(fl_ctx *ctx, fl_value tokeny, fl_value skolko, fl_value *result, fl_error *error);

/*
 * Функция flang «Длины фраз».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @return значение: список: число
 */
fl_status kompilyator_flang_dliny_fraz(fl_ctx *ctx, fl_value *result, fl_error *error);

/*
 * Функция flang «Искать фразу».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param slova — «слова»: список: строка
 * @return значение: «Находка»
 */
fl_status kompilyator_flang_iskat_frazu(fl_ctx *ctx, fl_value slova, fl_value *result, fl_error *error);

/*
 * Функция flang «Ключевое слово».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param identifikator — «идентификатор»: строка
 * @param chasti — «части»: список: «Токен»
 * @param pervyy — «первый»: «Токен»
 * @return значение: «Токен»
 */
fl_status kompilyator_flang_klyuchevoe_slovo(fl_ctx *ctx, fl_value identifikator, fl_value chasti, fl_value pervyy, fl_value *result, fl_error *error);

/*
 * Функция flang «Склеить».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param tokeny — «токены»: список: «Токен»
 * @return значение: список: «Токен»
 */
fl_status kompilyator_flang_skleit(fl_ctx *ctx, fl_value tokeny, fl_value *result, fl_error *error);

/*
 * Функция flang «Верх стека».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param stek — «стек»: список: число
 * @return значение: число
 */
fl_status kompilyator_flang_verh_steka(fl_ctx *ctx, fl_value stek, fl_value *result, fl_error *error);

/*
 * Функция flang «Приписать уровень».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param pervoe — «первое»: число
 * @param elementy — «элементы»: список: число
 * @return значение: список: число
 */
fl_status kompilyator_flang_pripisat_uroven(fl_ctx *ctx, fl_value pervoe, fl_value elementy, fl_value *result, fl_error *error);

/*
 * Функция flang «Закрыть уровни».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param stek — «стек»: список: число
 * @param shirina — «ширина»: число
 * @param nomer — «номер»: число
 * @param mesto — «место»: число
 * @return значение: «Снятие»
 */
fl_status kompilyator_flang_zakryt_urovni(fl_ctx *ctx, fl_value stek, fl_value shirina, fl_value nomer, fl_value mesto, fl_value *result, fl_error *error);

/*
 * Функция flang «Уровни строкой».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param stek — «стек»: список: число
 * @return значение: строка
 */
fl_status kompilyator_flang_urovni_strokoy(fl_ctx *ctx, fl_value stek, fl_value *result, fl_error *error);

/*
 * Функция flang «Отступить».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param sostoyanie — «состояние»: «Лексер»
 * @param shirina — «ширина»: число
 * @param mesto — «место»: число
 * @return значение: «Лексер»
 */
fl_status kompilyator_flang_otstupit(fl_ctx *ctx, fl_value sostoyanie, fl_value shirina, fl_value mesto, fl_value *result, fl_error *error);

/*
 * Функция flang «Длина до закрытия».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * Хвостовой самовызов развёрнут в цикл: стек не растёт.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param simvoly — «символы»: список: строка
 * @param sedeno — «съедено»: число
 * @return значение: число
 */
fl_status kompilyator_flang_dlina_do_zakrytiya(fl_ctx *ctx, fl_value simvoly, fl_value sedeno, fl_value *result, fl_error *error);

/*
 * Функция flang «Недопустимый символ».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param sostoyanie — «состояние»: «Лексер»
 * @param bukva — «буква»: строка
 * @param mesto — «место»: число
 * @return значение: «Лексер»
 */
fl_status kompilyator_flang_nedopustimyy_simvol(fl_ctx *ctx, fl_value sostoyanie, fl_value bukva, fl_value mesto, fl_value *result, fl_error *error);

/*
 * Функция flang «Сканировать».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * Хвостовой самовызов развёрнут в цикл: стек не растёт.
 *
 * Взаимная хвостовая рекурсия с «Уложить литерал»: вызовы идут через батут.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param sostoyanie — «состояние»: «Лексер»
 * @param simvoly — «символы»: список: строка
 * @param poziciya — «позиция»: число
 * @param ostalos — «осталось»: число
 * @return значение: «Лексер»
 */
fl_status kompilyator_flang_skanirovat(fl_ctx *ctx, fl_value sostoyanie, fl_value simvoly, fl_value poziciya, fl_value ostalos, fl_value *result, fl_error *error);

/*
 * Функция flang «Уложить литерал».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * Взаимная хвостовая рекурсия с «Сканировать»: вызовы идут через батут.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param sostoyanie — «состояние»: «Лексер»
 * @param simvoly — «символы»: список: строка
 * @param poziciya — «позиция»: число
 * @param chtenie — «чтение»: «Чтение»
 * @param zakryvayuschaya — «закрывающая»: строка
 * @param vid — «вид»: строка
 * @param nomer — «номер»: число
 * @param mesto — «место»: число
 * @return значение: «Лексер»
 */
fl_status kompilyator_flang_ulozhit_literal(fl_ctx *ctx, fl_value sostoyanie, fl_value simvoly, fl_value poziciya, fl_value chtenie, fl_value zakryvayuschaya, fl_value vid, fl_value nomer, fl_value mesto, fl_value *result, fl_error *error);

/*
 * Функция flang «Открыть строку».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * Хвостовой самовызов развёрнут в цикл: стек не растёт.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param sostoyanie — «состояние»: «Лексер»
 * @param simvoly — «символы»: список: строка
 * @param poziciya — «позиция»: число
 * @param shirina — «ширина»: число
 * @param ostalos — «осталось»: число
 * @return значение: «Лексер»
 */
fl_status kompilyator_flang_otkryt_stroku(fl_ctx *ctx, fl_value sostoyanie, fl_value simvoly, fl_value poziciya, fl_value shirina, fl_value ostalos, fl_value *result, fl_error *error);

/*
 * Функция flang «Отступить и сканировать».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param sostoyanie — «состояние»: «Лексер»
 * @param simvoly — «символы»: список: строка
 * @param poziciya — «позиция»: число
 * @param shirina — «ширина»: число
 * @return значение: «Лексер»
 */
fl_status kompilyator_flang_otstupit_i_skanirovat(fl_ctx *ctx, fl_value sostoyanie, fl_value simvoly, fl_value poziciya, fl_value shirina, fl_value *result, fl_error *error);

/*
 * Функция flang «Строка продолжается».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param rezhim — «режим»: «Режим»
 * @return значение
 */
fl_status kompilyator_flang_stroka_prodolzhaetsya(fl_ctx *ctx, fl_value rezhim, fl_value *result, fl_error *error);

/*
 * Функция flang «Закрыть блок».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param sostoyanie — «состояние»: «Лексер»
 * @param simvoly — «символы»: список: строка
 * @param v_nachale — «в начале»
 * @return значение: «Лексер»
 */
fl_status kompilyator_flang_zakryt_blok(fl_ctx *ctx, fl_value sostoyanie, fl_value simvoly, fl_value v_nachale, fl_value *result, fl_error *error);

/*
 * Функция flang «Продолжить кавычку».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param sostoyanie — «состояние»: «Лексер»
 * @param simvoly — «символы»: список: строка
 * @return значение: «Лексер»
 */
fl_status kompilyator_flang_prodolzhit_kavychku(fl_ctx *ctx, fl_value sostoyanie, fl_value simvoly, fl_value *result, fl_error *error);

/*
 * Функция flang «Завершить строку».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param sostoyanie — «состояние»: «Лексер»
 * @param razmer — «размер»: число
 * @param poslednyaya — «последняя»
 * @return значение: «Лексер»
 */
fl_status kompilyator_flang_zavershit_stroku(fl_ctx *ctx, fl_value sostoyanie, fl_value razmer, fl_value poslednyaya, fl_value *result, fl_error *error);

/*
 * Функция flang «Шаг строки».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param sostoyanie — «состояние»: «Лексер»
 * @param liniya — «линия»: строка
 * @param poslednyaya — «последняя»
 * @return значение: «Лексер»
 */
fl_status kompilyator_flang_shag_stroki(fl_ctx *ctx, fl_value sostoyanie, fl_value liniya, fl_value poslednyaya, fl_value *result, fl_error *error);

/*
 * Функция flang «Начальный лексер».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @return значение: «Лексер»
 */
fl_status kompilyator_flang_nachalnyy_lekser(fl_ctx *ctx, fl_value *result, fl_error *error);

/*
 * Функция flang «Завершить разбор».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param sostoyanie — «состояние»: «Лексер»
 * @return значение: «Разбор»
 */
fl_status kompilyator_flang_zavershit_razbor(fl_ctx *ctx, fl_value sostoyanie, fl_value *result, fl_error *error);

/*
 * Функция flang «Разобрать».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param ishodnik — «исходник»: строка
 * @return значение: «Разбор»
 */
fl_status kompilyator_flang_razobrat(fl_ctx *ctx, fl_value ishodnik, fl_value *result, fl_error *error);

/*
 * Функция flang «Токены».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param ishodnik — «исходник»: строка
 * @return значение: список: «Токен»
 */
fl_status kompilyator_flang_tokeny(fl_ctx *ctx, fl_value ishodnik, fl_value *result, fl_error *error);

/*
 * Функция flang «Диагностики».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param ishodnik — «исходник»: строка
 * @return значение: список: «Диагностика»
 */
fl_status kompilyator_flang_diagnostiki(fl_ctx *ctx, fl_value ishodnik, fl_value *result, fl_error *error);

/*
 * Функция flang «Коды диагностик».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param ishodnik — «исходник»: строка
 * @return значение: список: строка
 */
fl_status kompilyator_flang_kody_diagnostik(fl_ctx *ctx, fl_value ishodnik, fl_value *result, fl_error *error);

/*
 * Функция flang «Показать токен».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param token — «токен»: «Токен»
 * @return значение: строка
 */
fl_status kompilyator_flang_pokazat_token(fl_ctx *ctx, fl_value token, fl_value *result, fl_error *error);

/*
 * Функция flang «Разметка».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param ishodnik — «исходник»: строка
 * @return значение: список: строка
 */
fl_status kompilyator_flang_razmetka(fl_ctx *ctx, fl_value ishodnik, fl_value *result, fl_error *error);

/*
 * Функция flang «Разметка одной строкой».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param ishodnik — «исходник»: строка
 * @return значение: строка
 */
fl_status kompilyator_flang_razmetka_odnoy_strokoy(fl_ctx *ctx, fl_value ishodnik, fl_value *result, fl_error *error);

/*
 * Функция flang «Заменить всё».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param tekst — «текст»: строка
 * @param chto — «что»: строка
 * @param chem — «чем»: строка
 * @return значение: строка
 */
fl_status kompilyator_flang_zamenit_vsyo(fl_ctx *ctx, fl_value tekst, fl_value chto, fl_value chem, fl_value *result, fl_error *error);

/*
 * Функция flang «Замены».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @return значение: список: «Замена»
 */
fl_status kompilyator_flang_zameny(fl_ctx *ctx, fl_value *result, fl_error *error);

/*
 * Функция flang «Экранировать».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param tekst — «текст»: строка
 * @return значение: строка
 */
fl_status kompilyator_flang_ekranirovat(fl_ctx *ctx, fl_value tekst, fl_value *result, fl_error *error);

/*
 * Функция flang «Печать строки».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param tekst — «текст»: строка
 * @return значение: строка
 */
fl_status kompilyator_flang_pechat_stroki(fl_ctx *ctx, fl_value tekst, fl_value *result, fl_error *error);

/*
 * Функция flang «Печать числа».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param znachenie — «значение»: число
 * @return значение: строка
 */
fl_status kompilyator_flang_pechat_chisla(fl_ctx *ctx, fl_value znachenie, fl_value *result, fl_error *error);

/*
 * Функция flang «Печать признака».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param znachenie — «значение»
 * @return значение: строка
 */
fl_status kompilyator_flang_pechat_priznaka(fl_ctx *ctx, fl_value znachenie, fl_value *result, fl_error *error);

/*
 * Функция flang «Печать скаляра».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param skalyar — «скаляр»: «Скаляр»
 * @return значение: строка
 */
fl_status kompilyator_flang_pechat_skalyara(fl_ctx *ctx, fl_value skalyar, fl_value *result, fl_error *error);

/*
 * Функция flang «Печать поля».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param klyuch — «ключ»: строка
 * @param napechatannoe — «напечатанное»: строка
 * @return значение: строка
 */
fl_status kompilyator_flang_pechat_polya(fl_ctx *ctx, fl_value klyuch, fl_value napechatannoe, fl_value *result, fl_error *error);

/*
 * Функция flang «Соединить поля».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param chasti — «части»: список: строка
 * @return значение: строка
 */
fl_status kompilyator_flang_soedinit_polya(fl_ctx *ctx, fl_value chasti, fl_value *result, fl_error *error);

/*
 * Функция flang «Печать объекта».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param chasti — «части»: список: строка
 * @return значение: строка
 */
fl_status kompilyator_flang_pechat_obekta(fl_ctx *ctx, fl_value chasti, fl_value *result, fl_error *error);

/*
 * Функция flang «Печать массива».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param chasti — «части»: список: строка
 * @return значение: строка
 */
fl_status kompilyator_flang_pechat_massiva(fl_ctx *ctx, fl_value chasti, fl_value *result, fl_error *error);

/*
 * Функция flang «Печать значения».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param znachenie — «значение»: «Значение»
 * @return значение: строка
 */
fl_status kompilyator_flang_pechat_znacheniya(fl_ctx *ctx, fl_value znachenie, fl_value *result, fl_error *error);

/*
 * Функция flang «Узел строки».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param tekst — «текст»: строка
 * @return значение: «Значение»
 */
fl_status kompilyator_flang_uzel_stroki(fl_ctx *ctx, fl_value tekst, fl_value *result, fl_error *error);

/*
 * Функция flang «Узел числа».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param znachenie — «значение»: число
 * @return значение: «Значение»
 */
fl_status kompilyator_flang_uzel_chisla(fl_ctx *ctx, fl_value znachenie, fl_value *result, fl_error *error);

/*
 * Функция flang «Узел признака».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param znachenie — «значение»
 * @return значение: «Значение»
 */
fl_status kompilyator_flang_uzel_priznaka(fl_ctx *ctx, fl_value znachenie, fl_value *result, fl_error *error);

/*
 * Функция flang «Узел ничто при разборе».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @return значение: «Значение»
 */
fl_status kompilyator_flang_uzel_nichto_pri_razbore(fl_ctx *ctx, fl_value *result, fl_error *error);

/*
 * Функция flang «Узел списка».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param elementy — «элементы»: список: «Значение»
 * @return значение: «Значение»
 */
fl_status kompilyator_flang_uzel_spiska(fl_ctx *ctx, fl_value elementy, fl_value *result, fl_error *error);

/*
 * Функция flang «Узел записи».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param perechen — «перечень»: список: «Поле значения»
 * @return значение: «Значение»
 */
fl_status kompilyator_flang_uzel_zapisi(fl_ctx *ctx, fl_value perechen, fl_value *result, fl_error *error);

/*
 * Функция flang «Пара поля».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param klyuch — «ключ»: строка
 * @param znachenie — «значение»: «Значение»
 * @return значение: «Поле значения»
 */
fl_status kompilyator_flang_para_polya(fl_ctx *ctx, fl_value klyuch, fl_value znachenie, fl_value *result, fl_error *error);

/*
 * Функция flang «Поле текста».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param klyuch — «ключ»: строка
 * @param tekst — «текст»: строка
 * @return значение: «Поле значения»
 */
fl_status kompilyator_flang_pole_teksta(fl_ctx *ctx, fl_value klyuch, fl_value tekst, fl_value *result, fl_error *error);

/*
 * Функция flang «Поле числом».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param klyuch — «ключ»: строка
 * @param znachenie — «значение»: число
 * @return значение: «Поле значения»
 */
fl_status kompilyator_flang_pole_chislom(fl_ctx *ctx, fl_value klyuch, fl_value znachenie, fl_value *result, fl_error *error);

/*
 * Функция flang «Поле признаком».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param klyuch — «ключ»: строка
 * @param znachenie — «значение»
 * @return значение: «Поле значения»
 */
fl_status kompilyator_flang_pole_priznakom(fl_ctx *ctx, fl_value klyuch, fl_value znachenie, fl_value *result, fl_error *error);

/*
 * Функция flang «Поле списком».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param klyuch — «ключ»: строка
 * @param elementy — «элементы»: список: «Значение»
 * @return значение: «Поле значения»
 */
fl_status kompilyator_flang_pole_spiskom(fl_ctx *ctx, fl_value klyuch, fl_value elementy, fl_value *result, fl_error *error);

/*
 * Функция flang «Поле записью».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param klyuch — «ключ»: строка
 * @param perechen — «перечень»: список: «Поле значения»
 * @return значение: «Поле значения»
 */
fl_status kompilyator_flang_pole_zapisyu(fl_ctx *ctx, fl_value klyuch, fl_value perechen, fl_value *result, fl_error *error);

/*
 * Функция flang «Поле именами».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param klyuch — «ключ»: строка
 * @param imena — «имена»: список: строка
 * @return значение: «Поле значения»
 */
fl_status kompilyator_flang_pole_imenami(fl_ctx *ctx, fl_value klyuch, fl_value imena, fl_value *result, fl_error *error);

/*
 * Функция flang «С параметрами типа».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param polya — «поля»: список: «Поле значения»
 * @param imena — «имена»: список: строка
 * @return значение: список: «Поле значения»
 */
fl_status kompilyator_flang_s_parametrami_tipa(fl_ctx *ctx, fl_value polya, fl_value imena, fl_value *result, fl_error *error);

/*
 * Функция flang «Поля узла при разборе».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param uzel — «узел»: «Значение»
 * @return значение: список: «Поле значения»
 */
fl_status kompilyator_flang_polya_uzla_pri_razbore(fl_ctx *ctx, fl_value uzel, fl_value *result, fl_error *error);

/*
 * Функция flang «Элементы узла при разборе».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param uzel — «узел»: «Значение»
 * @return значение: список: «Значение»
 */
fl_status kompilyator_flang_elementy_uzla_pri_razbore(fl_ctx *ctx, fl_value uzel, fl_value *result, fl_error *error);

/*
 * Функция flang «Это список при разборе».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param uzel — «узел»: «Значение»
 * @return значение
 */
fl_status kompilyator_flang_eto_spisok_pri_razbore(fl_ctx *ctx, fl_value uzel, fl_value *result, fl_error *error);

/*
 * Функция flang «Это запись при разборе».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param uzel — «узел»: «Значение»
 * @return значение
 */
fl_status kompilyator_flang_eto_zapis_pri_razbore(fl_ctx *ctx, fl_value uzel, fl_value *result, fl_error *error);

/*
 * Функция flang «Текст скаляра».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param skalyar — «скаляр»: «Скаляр»
 * @return значение: строка
 */
fl_status kompilyator_flang_tekst_skalyara(fl_ctx *ctx, fl_value skalyar, fl_value *result, fl_error *error);

/*
 * Функция flang «Текст узла».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param uzel — «узел»: «Значение»
 * @return значение: строка
 */
fl_status kompilyator_flang_tekst_uzla(fl_ctx *ctx, fl_value uzel, fl_value *result, fl_error *error);

/*
 * Функция flang «Скаляр это строка».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param skalyar — «скаляр»: «Скаляр»
 * @return значение
 */
fl_status kompilyator_flang_skalyar_eto_stroka(fl_ctx *ctx, fl_value skalyar, fl_value *result, fl_error *error);

/*
 * Функция flang «Это текст».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param uzel — «узел»: «Значение»
 * @return значение
 */
fl_status kompilyator_flang_eto_tekst(fl_ctx *ctx, fl_value uzel, fl_value *result, fl_error *error);

/*
 * Функция flang «Скаляр как строку».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param skalyar — «скаляр»: «Скаляр»
 * @return значение: строка
 */
fl_status kompilyator_flang_skalyar_kak_stroku(fl_ctx *ctx, fl_value skalyar, fl_value *result, fl_error *error);

/*
 * Функция flang «Как строку».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param uzel — «узел»: «Значение»
 * @return значение: строка
 */
fl_status kompilyator_flang_kak_stroku(fl_ctx *ctx, fl_value uzel, fl_value *result, fl_error *error);

/*
 * Функция flang «Первое из полей при разборе».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param perechen — «перечень»: список: «Поле значения»
 * @return значение: «Может быть узел при разборе»
 */
fl_status kompilyator_flang_pervoe_iz_poley_pri_razbore(fl_ctx *ctx, fl_value perechen, fl_value *result, fl_error *error);

/*
 * Функция flang «Поле по ключу».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param uzel — «узел»: «Значение»
 * @param klyuch — «ключ»: строка
 * @return значение: «Может быть узел при разборе»
 */
fl_status kompilyator_flang_pole_po_klyuchu(fl_ctx *ctx, fl_value uzel, fl_value klyuch, fl_value *result, fl_error *error);

/*
 * Функция flang «Есть ключ».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param uzel — «узел»: «Значение»
 * @param klyuch — «ключ»: строка
 * @return значение
 */
fl_status kompilyator_flang_est_klyuch(fl_ctx *ctx, fl_value uzel, fl_value klyuch, fl_value *result, fl_error *error);

/*
 * Функция flang «Ключ узла».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param uzel — «узел»: «Значение»
 * @param klyuch — «ключ»: строка
 * @return значение: «Значение»
 */
fl_status kompilyator_flang_klyuch_uzla(fl_ctx *ctx, fl_value uzel, fl_value klyuch, fl_value *result, fl_error *error);

/*
 * Функция flang «Есть ключ в полях».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param perechen — «перечень»: список: «Поле значения»
 * @param klyuch — «ключ»: строка
 * @return значение
 */
fl_status kompilyator_flang_est_klyuch_v_polyah(fl_ctx *ctx, fl_value perechen, fl_value klyuch, fl_value *result, fl_error *error);

/*
 * Функция flang «Положить в поля».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param perechen — «перечень»: список: «Поле значения»
 * @param klyuch — «ключ»: строка
 * @param znachenie — «значение»: «Значение»
 * @return значение: список: «Поле значения»
 */
fl_status kompilyator_flang_polozhit_v_polya(fl_ctx *ctx, fl_value perechen, fl_value klyuch, fl_value znachenie, fl_value *result, fl_error *error);

/*
 * Функция flang «Положить в узел».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param uzel — «узел»: «Значение»
 * @param klyuch — «ключ»: строка
 * @param znachenie — «значение»: «Значение»
 * @return значение: «Значение»
 */
fl_status kompilyator_flang_polozhit_v_uzel(fl_ctx *ctx, fl_value uzel, fl_value klyuch, fl_value znachenie, fl_value *result, fl_error *error);

/*
 * Функция flang «Размер пачки».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @return значение: число
 */
fl_status kompilyator_flang_razmer_pachki(fl_ctx *ctx, fl_value *result, fl_error *error);

/*
 * Функция flang «Пустой токен».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @return значение: «Токен»
 */
fl_status kompilyator_flang_pustoy_token(fl_ctx *ctx, fl_value *result, fl_error *error);

/*
 * Функция flang «Шаг сборки».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param sborka — «сборка»: «Сборка при разборе»
 * @param token — «токен»: «Токен»
 * @return значение: «Сборка при разборе»
 */
fl_status kompilyator_flang_shag_sborki(fl_ctx *ctx, fl_value sborka, fl_value token, fl_value *result, fl_error *error);

/*
 * Функция flang «Разложить пачками».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param tokeny — «токены»: список: «Токен»
 * @return значение: список: «Пачка»
 */
fl_status kompilyator_flang_razlozhit_pachkami(fl_ctx *ctx, fl_value tokeny, fl_value *result, fl_error *error);

/*
 * Функция flang «Последний токен».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param tokeny — «токены»: список: «Токен»
 * @return значение: «Токен»
 */
fl_status kompilyator_flang_posledniy_token(fl_ctx *ctx, fl_value tokeny, fl_value *result, fl_error *error);

/*
 * Функция flang «Тяга из пачек».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param kuski — «куски»: список: «Пачка»
 * @param konec — «конец»: «Токен»
 * @return значение: «Тяга»
 */
fl_status kompilyator_flang_tyaga_iz_pachek(fl_ctx *ctx, fl_value kuski, fl_value konec, fl_value *result, fl_error *error);

/*
 * Функция flang «Тяга из пачки».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param tokeny — «токены»: список: «Токен»
 * @param kuski — «куски»: список: «Пачка»
 * @param konec — «конец»: «Токен»
 * @return значение: «Тяга»
 */
fl_status kompilyator_flang_tyaga_iz_pachki(fl_ctx *ctx, fl_value tokeny, fl_value kuski, fl_value konec, fl_value *result, fl_error *error);

/*
 * Функция flang «Тянуть».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param kusok — «кусок»: список: «Токен»
 * @param kuski — «куски»: список: «Пачка»
 * @param konec — «конец»: «Токен»
 * @return значение: «Тяга»
 */
fl_status kompilyator_flang_tyanut(fl_ctx *ctx, fl_value kusok, fl_value kuski, fl_value konec, fl_value *result, fl_error *error);

/*
 * Функция flang «Сдвинуть поток».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param potok — «поток»: «Поток»
 * @return значение: «Поток»
 */
fl_status kompilyator_flang_sdvinut_potok(fl_ctx *ctx, fl_value potok, fl_value *result, fl_error *error);

/*
 * Функция flang «Начальный поток».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param tokeny — «токены»: список: «Токен»
 * @return значение: «Поток»
 */
fl_status kompilyator_flang_nachalnyy_potok(fl_ctx *ctx, fl_value tokeny, fl_value *result, fl_error *error);

/*
 * Функция flang «Начальный разборщик».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param tokeny — «токены»: список: «Токен»
 * @return значение: «Разборщик»
 */
fl_status kompilyator_flang_nachalnyy_razborschik(fl_ctx *ctx, fl_value tokeny, fl_value *result, fl_error *error);

/*
 * Функция flang «С потоком».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param r — «р»: «Разборщик»
 * @param potok — «поток»: «Поток»
 * @return значение: «Разборщик»
 */
fl_status kompilyator_flang_s_potokom(fl_ctx *ctx, fl_value r, fl_value potok, fl_value *result, fl_error *error);

/*
 * Функция flang «Со сбором».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param r — «р»: «Разборщик»
 * @param sbor — «сбор»: «Сбор при разборе»
 * @return значение: «Разборщик»
 */
fl_status kompilyator_flang_so_sborom(fl_ctx *ctx, fl_value r, fl_value sbor, fl_value *result, fl_error *error);

/*
 * Функция flang «С областями».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param r — «р»: «Разборщик»
 * @param oblasti — «области»: список: «Область»
 * @return значение: «Разборщик»
 */
fl_status kompilyator_flang_s_oblastyami(fl_ctx *ctx, fl_value r, fl_value oblasti, fl_value *result, fl_error *error);

/*
 * Функция flang «Есть беда».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param r — «р»: «Разборщик»
 * @return значение
 */
fl_status kompilyator_flang_est_beda(fl_ctx *ctx, fl_value r, fl_value *result, fl_error *error);

/*
 * Функция flang «С бедой».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param r — «р»: «Разборщик»
 * @param beda — «беда»: «Диагностика»
 * @return значение: «Разборщик»
 */
fl_status kompilyator_flang_s_bedoy(fl_ctx *ctx, fl_value r, fl_value beda, fl_value *result, fl_error *error);

/*
 * Функция flang «Отказ с кодом».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param r — «р»: «Разборщик»
 * @param kod — «код»: строка
 * @param soobschenie — «сообщение»: строка
 * @param token — «токен»: «Токен»
 * @return значение: «Разборщик»
 */
fl_status kompilyator_flang_otkaz_s_kodom(fl_ctx *ctx, fl_value r, fl_value kod, fl_value soobschenie, fl_value token, fl_value *result, fl_error *error);

/*
 * Функция flang «Отказ у токена».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param r — «р»: «Разборщик»
 * @param soobschenie — «сообщение»: строка
 * @param token — «токен»: «Токен»
 * @return значение: «Разборщик»
 */
fl_status kompilyator_flang_otkaz_u_tokena(fl_ctx *ctx, fl_value r, fl_value soobschenie, fl_value token, fl_value *result, fl_error *error);

/*
 * Функция flang «Отказ».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param r — «р»: «Разборщик»
 * @param soobschenie — «сообщение»: строка
 * @return значение: «Разборщик»
 */
fl_status kompilyator_flang_otkaz(fl_ctx *ctx, fl_value r, fl_value soobschenie, fl_value *result, fl_error *error);

/*
 * Функция flang «Пустой шаг».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param r — «р»: «Разборщик»
 * @return значение: «Шаг»
 */
fl_status kompilyator_flang_pustoy_shag(fl_ctx *ctx, fl_value r, fl_value *result, fl_error *error);

/*
 * Функция flang «С модулем».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param r — «р»: «Разборщик»
 * @param imya — «имя»: строка
 * @return значение: «Разборщик»
 */
fl_status kompilyator_flang_s_modulem(fl_ctx *ctx, fl_value r, fl_value imya, fl_value *result, fl_error *error);

/*
 * Функция flang «Назвать модуль».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param r — «р»: «Разборщик»
 * @param imya — «имя»: строка
 * @return значение: «Разборщик»
 */
fl_status kompilyator_flang_nazvat_modul(fl_ctx *ctx, fl_value r, fl_value imya, fl_value *result, fl_error *error);

/*
 * Функция flang «Добавить тип».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param r — «р»: «Разборщик»
 * @param uzel — «узел»: «Значение»
 * @return значение: «Разборщик»
 */
fl_status kompilyator_flang_dobavit_tip(fl_ctx *ctx, fl_value r, fl_value uzel, fl_value *result, fl_error *error);

/*
 * Функция flang «Добавить функцию».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param r — «р»: «Разборщик»
 * @param uzel — «узел»: «Значение»
 * @return значение: «Разборщик»
 */
fl_status kompilyator_flang_dobavit_funkciyu(fl_ctx *ctx, fl_value r, fl_value uzel, fl_value *result, fl_error *error);

/*
 * Функция flang «Добавить наследие».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param r — «р»: «Разборщик»
 * @param uzel — «узел»: «Значение»
 * @return значение: «Разборщик»
 */
fl_status kompilyator_flang_dobavit_nasledie(fl_ctx *ctx, fl_value r, fl_value uzel, fl_value *result, fl_error *error);

/*
 * Функция flang «Заменить наследие».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param r — «р»: «Разборщик»
 * @param nasledie — «наследие»: список: «Значение»
 * @return значение: «Разборщик»
 */
fl_status kompilyator_flang_zamenit_nasledie(fl_ctx *ctx, fl_value r, fl_value nasledie, fl_value *result, fl_error *error);

/*
 * Функция flang «Добавить прочее».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param r — «р»: «Разборщик»
 * @param klyuch — «ключ»: строка
 * @param uzel — «узел»: «Значение»
 * @return значение: «Разборщик»
 */
fl_status kompilyator_flang_dobavit_prochee(fl_ctx *ctx, fl_value r, fl_value klyuch, fl_value uzel, fl_value *result, fl_error *error);

/*
 * Функция flang «Добавить прочие».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param r — «р»: «Разборщик»
 * @param klyuch — «ключ»: строка
 * @param uzly — «узлы»: список: «Значение»
 * @return значение: «Разборщик»
 */
fl_status kompilyator_flang_dobavit_prochie(fl_ctx *ctx, fl_value r, fl_value klyuch, fl_value uzly, fl_value *result, fl_error *error);

/*
 * Функция flang «Есть в списке имён».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param imena — «имена»: список: строка
 * @param imya — «имя»: строка
 * @return значение
 */
fl_status kompilyator_flang_est_v_spiske_imyon(fl_ctx *ctx, fl_value imena, fl_value imya, fl_value *result, fl_error *error);

/*
 * Функция flang «Слить имена».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param nakopleno — «накоплено»: список: строка
 * @param imena — «имена»: список: строка
 * @return значение: список: строка
 */
fl_status kompilyator_flang_slit_imena(fl_ctx *ctx, fl_value nakopleno, fl_value imena, fl_value *result, fl_error *error);

/*
 * Функция flang «Локальные имена».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param r — «р»: «Разборщик»
 * @return значение: список: строка
 */
fl_status kompilyator_flang_lokalnye_imena(fl_ctx *ctx, fl_value r, fl_value *result, fl_error *error);

/*
 * Функция flang «Открыть область».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param r — «р»: «Разборщик»
 * @param imena — «имена»: список: строка
 * @return значение: «Разборщик»
 */
fl_status kompilyator_flang_otkryt_oblast(fl_ctx *ctx, fl_value r, fl_value imena, fl_value *result, fl_error *error);

/*
 * Функция flang «Шаг обрезки».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param akk — «акк»: «Счёт областей»
 * @param oblast — «область»: «Область»
 * @param skolko — «сколько»: число
 * @return значение: «Счёт областей»
 */
fl_status kompilyator_flang_shag_obrezki(fl_ctx *ctx, fl_value akk, fl_value oblast, fl_value skolko, fl_value *result, fl_error *error);

/*
 * Функция flang «Закрыть область».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param r — «р»: «Разборщик»
 * @return значение: «Разборщик»
 */
fl_status kompilyator_flang_zakryt_oblast(fl_ctx *ctx, fl_value r, fl_value *result, fl_error *error);

/*
 * Функция flang «Область с именем».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param oblast — «область»: «Область»
 * @param imya — «имя»: строка
 * @return значение: «Область»
 */
fl_status kompilyator_flang_oblast_s_imenem(fl_ctx *ctx, fl_value oblast, fl_value imya, fl_value *result, fl_error *error);

/*
 * Функция flang «Шаг привязки».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param akk — «акк»: «Счёт областей»
 * @param oblast — «область»: «Область»
 * @param vsego — «всего»: число
 * @param imya — «имя»: строка
 * @return значение: «Счёт областей»
 */
fl_status kompilyator_flang_shag_privyazki(fl_ctx *ctx, fl_value akk, fl_value oblast, fl_value vsego, fl_value imya, fl_value *result, fl_error *error);

/*
 * Функция flang «Связать имя при разборе».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param r — «р»: «Разборщик»
 * @param imya — «имя»: строка
 * @return значение: «Разборщик»
 */
fl_status kompilyator_flang_svyazat_imya_pri_razbore(fl_ctx *ctx, fl_value r, fl_value imya, fl_value *result, fl_error *error);

/*
 * Функция flang «Связать в областях».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param r — «р»: «Разборщик»
 * @param imya — «имя»: строка
 * @param vsego — «всего»: число
 * @return значение: «Разборщик»
 */
fl_status kompilyator_flang_svyazat_v_oblastyah(fl_ctx *ctx, fl_value r, fl_value imya, fl_value vsego, fl_value *result, fl_error *error);

/*
 * Функция flang «Окончания».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @return значение: список: строка
 */
fl_status kompilyator_flang_okonchaniya(fl_ctx *ctx, fl_value *result, fl_error *error);

/*
 * Функция flang «Наименьшая основа».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @return значение: число
 */
fl_status kompilyator_flang_naimenshaya_osnova(fl_ctx *ctx, fl_value *result, fl_error *error);

/*
 * Функция flang «Кончается на».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param tekst — «текст»: строка
 * @param suffiks — «суффикс»: строка
 * @return значение
 */
fl_status kompilyator_flang_konchaetsya_na(fl_ctx *ctx, fl_value tekst, fl_value suffiks, fl_value *result, fl_error *error);

/*
 * Функция flang «Снять окончание».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * Хвостовой самовызов развёрнут в цикл: стек не растёт.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param nizhnee — «нижнее»: строка
 * @param okonchaniya — «окончания»: список: строка
 * @return значение: строка
 */
fl_status kompilyator_flang_snyat_okonchanie(fl_ctx *ctx, fl_value nizhnee, fl_value okonchaniya, fl_value *result, fl_error *error);

/*
 * Функция flang «Основа имени».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param imya — «имя»: строка
 * @return значение: строка
 */
fl_status kompilyator_flang_osnova_imeni(fl_ctx *ctx, fl_value imya, fl_value *result, fl_error *error);

/*
 * Функция flang «С прописной».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param imya — «имя»: строка
 * @return значение
 */
fl_status kompilyator_flang_s_propisnoy(fl_ctx *ctx, fl_value imya, fl_value *result, fl_error *error);

/*
 * Функция flang «Это вид».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param r — «р»: «Разборщик»
 * @param vid — «вид»: строка
 * @return значение
 */
fl_status kompilyator_flang_eto_vid(fl_ctx *ctx, fl_value r, fl_value vid, fl_value *result, fl_error *error);

/*
 * Функция flang «Это вид 1».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param r — «р»: «Разборщик»
 * @param vid — «вид»: строка
 * @return значение
 */
fl_status kompilyator_flang_eto_vid_1(fl_ctx *ctx, fl_value r, fl_value vid, fl_value *result, fl_error *error);

/*
 * Функция flang «Это слово».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param r — «р»: «Разборщик»
 * @param identifikator — «идентификатор»: строка
 * @return значение
 */
fl_status kompilyator_flang_eto_slovo(fl_ctx *ctx, fl_value r, fl_value identifikator, fl_value *result, fl_error *error);

/*
 * Функция flang «Это слово 2».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param r — «р»: «Разборщик»
 * @param identifikator — «идентификатор»: строка
 * @return значение
 */
fl_status kompilyator_flang_eto_slovo_2(fl_ctx *ctx, fl_value r, fl_value identifikator, fl_value *result, fl_error *error);

/*
 * Функция flang «Знак сейчас».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param r — «р»: «Разборщик»
 * @param znak — «знак»: строка
 * @return значение
 */
fl_status kompilyator_flang_znak_seychas(fl_ctx *ctx, fl_value r, fl_value znak, fl_value *result, fl_error *error);

/*
 * Функция flang «Знак сейчас 1».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param r — «р»: «Разборщик»
 * @param znak — «знак»: строка
 * @return значение
 */
fl_status kompilyator_flang_znak_seychas_1(fl_ctx *ctx, fl_value r, fl_value znak, fl_value *result, fl_error *error);

/*
 * Функция flang «Знак сейчас 2».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param r — «р»: «Разборщик»
 * @param znak — «знак»: строка
 * @return значение
 */
fl_status kompilyator_flang_znak_seychas_2(fl_ctx *ctx, fl_value r, fl_value znak, fl_value *result, fl_error *error);

/*
 * Функция flang «Имя сейчас».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param r — «р»: «Разборщик»
 * @return значение
 */
fl_status kompilyator_flang_imya_seychas(fl_ctx *ctx, fl_value r, fl_value *result, fl_error *error);

/*
 * Функция flang «Имя сейчас 1».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param r — «р»: «Разборщик»
 * @return значение
 */
fl_status kompilyator_flang_imya_seychas_1(fl_ctx *ctx, fl_value r, fl_value *result, fl_error *error);

/*
 * Функция flang «В конце блока».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param r — «р»: «Разборщик»
 * @return значение
 */
fl_status kompilyator_flang_v_konce_bloka(fl_ctx *ctx, fl_value r, fl_value *result, fl_error *error);

/*
 * Функция flang «Шагнуть».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param r — «р»: «Разборщик»
 * @return значение: «Разборщик»
 */
fl_status kompilyator_flang_shagnut(fl_ctx *ctx, fl_value r, fl_value *result, fl_error *error);

/*
 * Функция flang «Взять токен».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param r — «р»: «Разборщик»
 * @return значение: «Шаг токена»
 */
fl_status kompilyator_flang_vzyat_token(fl_ctx *ctx, fl_value r, fl_value *result, fl_error *error);

/*
 * Функция flang «Съесть слово».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param r — «р»: «Разборщик»
 * @param identifikator — «идентификатор»: строка
 * @return значение: «Шаг флага»
 */
fl_status kompilyator_flang_sest_slovo(fl_ctx *ctx, fl_value r, fl_value identifikator, fl_value *result, fl_error *error);

/*
 * Функция flang «Съесть знак».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param r — «р»: «Разборщик»
 * @param znak — «знак»: строка
 * @return значение: «Шаг флага»
 */
fl_status kompilyator_flang_sest_znak(fl_ctx *ctx, fl_value r, fl_value znak, fl_value *result, fl_error *error);

/*
 * Функция flang «Ждать слово».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param r — «р»: «Разборщик»
 * @param identifikator — «идентификатор»: строка
 * @param soobschenie — «сообщение»: строка
 * @return значение: «Шаг токена»
 */
fl_status kompilyator_flang_zhdat_slovo(fl_ctx *ctx, fl_value r, fl_value identifikator, fl_value soobschenie, fl_value *result, fl_error *error);

/*
 * Функция flang «Ждать знак».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param r — «р»: «Разборщик»
 * @param znak — «знак»: строка
 * @return значение: «Шаг токена»
 */
fl_status kompilyator_flang_zhdat_znak(fl_ctx *ctx, fl_value r, fl_value znak, fl_value *result, fl_error *error);

/*
 * Функция flang «Конец строки».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param r — «р»: «Разборщик»
 * @return значение: «Разборщик»
 */
fl_status kompilyator_flang_konec_stroki(fl_ctx *ctx, fl_value r, fl_value *result, fl_error *error);

/*
 * Функция flang «Пропустить переводы».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Хвостовой самовызов развёрнут в цикл: стек не растёт.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param r — «р»: «Разборщик»
 * @return значение: «Разборщик»
 */
fl_status kompilyator_flang_propustit_perevody(fl_ctx *ctx, fl_value r, fl_value *result, fl_error *error);

/*
 * Функция flang «Войти в блок».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param r — «р»: «Разборщик»
 * @return значение: «Шаг флага»
 */
fl_status kompilyator_flang_voyti_v_blok(fl_ctx *ctx, fl_value r, fl_value *result, fl_error *error);

/*
 * Функция flang «Выйти из блока».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param r — «р»: «Разборщик»
 * @return значение: «Разборщик»
 */
fl_status kompilyator_flang_vyyti_iz_bloka(fl_ctx *ctx, fl_value r, fl_value *result, fl_error *error);

/*
 * Функция flang «Текст значения».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param token — «токен»: «Токен»
 * @return значение: строка
 */
fl_status kompilyator_flang_tekst_znacheniya(fl_ctx *ctx, fl_value token, fl_value *result, fl_error *error);

/*
 * Функция flang «Текст токена».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param token — «токен»: «Токен»
 * @return значение: строка
 */
fl_status kompilyator_flang_tekst_tokena(fl_ctx *ctx, fl_value token, fl_value *result, fl_error *error);

/*
 * Функция flang «Место токена».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param token — «токен»: «Токен»
 * @return значение: «Значение»
 */
fl_status kompilyator_flang_mesto_tokena(fl_ctx *ctx, fl_value token, fl_value *result, fl_error *error);

/*
 * Функция flang «Число узла при разборе».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param uzel — «узел»: «Значение»
 * @return значение: число
 */
fl_status kompilyator_flang_chislo_uzla_pri_razbore(fl_ctx *ctx, fl_value uzel, fl_value *result, fl_error *error);

/*
 * Функция flang «Число скаляра при разборе».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param skalyar — «скаляр»: «Скаляр»
 * @return значение: число
 */
fl_status kompilyator_flang_chislo_skalyara_pri_razbore(fl_ctx *ctx, fl_value skalyar, fl_value *result, fl_error *error);

/*
 * Функция flang «Отказ в месте».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param r — «р»: «Разборщик»
 * @param kod — «код»: строка
 * @param soobschenie — «сообщение»: строка
 * @param mesto — «место»: «Значение»
 * @return значение: «Разборщик»
 */
fl_status kompilyator_flang_otkaz_v_meste(fl_ctx *ctx, fl_value r, fl_value kod, fl_value soobschenie, fl_value mesto, fl_value *result, fl_error *error);

/*
 * Функция flang «Токен как имя».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param token — «токен»: «Токен»
 * @return значение: «Токен»
 */
fl_status kompilyator_flang_token_kak_imya(fl_ctx *ctx, fl_value token, fl_value *result, fl_error *error);

/*
 * Функция flang «Ждать токен имени».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param r — «р»: «Разборщик»
 * @param soobschenie — «сообщение»: строка
 * @return значение: «Шаг токена»
 */
fl_status kompilyator_flang_zhdat_token_imeni(fl_ctx *ctx, fl_value r, fl_value soobschenie, fl_value *result, fl_error *error);

/*
 * Функция flang «Ждать имя».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param r — «р»: «Разборщик»
 * @param soobschenie — «сообщение»: строка
 * @return значение: «Шаг текста»
 */
fl_status kompilyator_flang_zhdat_imya(fl_ctx *ctx, fl_value r, fl_value soobschenie, fl_value *result, fl_error *error);

/*
 * Функция flang «Не начинает выражение».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param identifikator — «идентификатор»: строка
 * @return значение
 */
fl_status kompilyator_flang_ne_nachinaet_vyrazhenie(fl_ctx *ctx, fl_value identifikator, fl_value *result, fl_error *error);

/*
 * Функция flang «Мягкое имя».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param identifikator — «идентификатор»: строка
 * @return значение
 */
fl_status kompilyator_flang_myagkoe_imya(fl_ctx *ctx, fl_value identifikator, fl_value *result, fl_error *error);

/*
 * Функция flang «Начало выражения».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param identifikator — «идентификатор»: строка
 * @return значение
 */
fl_status kompilyator_flang_nachalo_vyrazheniya(fl_ctx *ctx, fl_value identifikator, fl_value *result, fl_error *error);

/*
 * Функция flang «Сравнение по слову».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param identifikator — «идентификатор»: строка
 * @return значение: строка
 */
fl_status kompilyator_flang_sravnenie_po_slovu(fl_ctx *ctx, fl_value identifikator, fl_value *result, fl_error *error);

/*
 * Функция flang «Операция по слову».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param identifikator — «идентификатор»: строка
 * @return значение: строка
 */
fl_status kompilyator_flang_operaciya_po_slovu(fl_ctx *ctx, fl_value identifikator, fl_value *result, fl_error *error);

/*
 * Функция flang «Имя типа FTS».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param identifikator — «идентификатор»: строка
 * @return значение: строка
 */
fl_status kompilyator_flang_imya_tipa_fts(fl_ctx *ctx, fl_value identifikator, fl_value *result, fl_error *error);

/*
 * Функция flang «Это скалярный тип».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param identifikator — «идентификатор»: строка
 * @return значение
 */
fl_status kompilyator_flang_eto_skalyarnyy_tip(fl_ctx *ctx, fl_value identifikator, fl_value *result, fl_error *error);

/*
 * Функция flang «Скалярный тип».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param identifikator — «идентификатор»: строка
 * @return значение: «Значение»
 */
fl_status kompilyator_flang_skalyarnyy_tip(fl_ctx *ctx, fl_value identifikator, fl_value *result, fl_error *error);

/*
 * Функция flang «Литерал слова».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param identifikator — «идентификатор»: строка
 * @return значение: «Значение»
 */
fl_status kompilyator_flang_literal_slova(fl_ctx *ctx, fl_value identifikator, fl_value *result, fl_error *error);

/*
 * Функция flang «Метка ожидания».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @return значение: строка
 */
fl_status kompilyator_flang_metka_ozhidaniya(fl_ctx *ctx, fl_value *result, fl_error *error);

/*
 * Функция flang «Метка свободного».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @return значение: строка
 */
fl_status kompilyator_flang_metka_svobodnogo(fl_ctx *ctx, fl_value *result, fl_error *error);

/*
 * Функция flang «Локальная переменная».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param imya — «имя»: строка
 * @param mesto — «место»: «Значение»
 * @return значение: «Значение»
 */
fl_status kompilyator_flang_lokalnaya_peremennaya(fl_ctx *ctx, fl_value imya, fl_value mesto, fl_value *result, fl_error *error);

/*
 * Функция flang «Отказ имени».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param r — «р»: «Разборщик»
 * @param imya — «имя»: строка
 * @param mesto — «место»: «Значение»
 * @param sovpavshie — «совпавшие»: список: строка
 * @return значение: «Шаг текста»
 */
fl_status kompilyator_flang_otkaz_imeni(fl_ctx *ctx, fl_value r, fl_value imya, fl_value mesto, fl_value sovpavshie, fl_value *result, fl_error *error);

/*
 * Функция flang «Подобрать основу».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param r — «р»: «Разборщик»
 * @param imya — «имя»: строка
 * @param mesto — «место»: «Значение»
 * @param lokalnye — «локальные»: список: строка
 * @return значение: «Шаг текста»
 */
fl_status kompilyator_flang_podobrat_osnovu(fl_ctx *ctx, fl_value r, fl_value imya, fl_value mesto, fl_value lokalnye, fl_value *result, fl_error *error);

/*
 * Функция flang «Разрешить среди локальных».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param r — «р»: «Разборщик»
 * @param imya — «имя»: строка
 * @param mesto — «место»: «Значение»
 * @return значение: «Шаг текста»
 */
fl_status kompilyator_flang_razreshit_sredi_lokalnyh(fl_ctx *ctx, fl_value r, fl_value imya, fl_value mesto, fl_value *result, fl_error *error);

/*
 * Функция flang «Разрешить локальное».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param r — «р»: «Разборщик»
 * @param imya — «имя»: строка
 * @param mesto — «место»: «Значение»
 * @return значение: «Шаг текста»
 */
fl_status kompilyator_flang_razreshit_lokalnoe(fl_ctx *ctx, fl_value r, fl_value imya, fl_value mesto, fl_value *result, fl_error *error);

/*
 * Функция flang «Связать узел».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param r — «р»: «Разборщик»
 * @param uzel — «узел»: «Значение»
 * @return значение: «Шаг»
 */
fl_status kompilyator_flang_svyazat_uzel(fl_ctx *ctx, fl_value r, fl_value uzel, fl_value *result, fl_error *error);

/*
 * Функция flang «Разрешить узел».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param r — «р»: «Разборщик»
 * @param uzel — «узел»: «Значение»
 * @return значение: «Шаг»
 */
fl_status kompilyator_flang_razreshit_uzel(fl_ctx *ctx, fl_value r, fl_value uzel, fl_value *result, fl_error *error);

/*
 * Функция flang «Параметры типа».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param r — «р»: «Разборщик»
 * @return значение: «Шаг имён»
 */
fl_status kompilyator_flang_parametry_tipa(fl_ctx *ctx, fl_value r, fl_value *result, fl_error *error);

/*
 * Функция flang «Ещё параметры типа».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Хвостовой самовызов развёрнут в цикл: стек не растёт.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param r — «р»: «Разборщик»
 * @param imena — «имена»: список: строка
 * @return значение: «Шаг имён»
 */
fl_status kompilyator_flang_eschyo_parametry_tipa(fl_ctx *ctx, fl_value r, fl_value imena, fl_value *result, fl_error *error);

/*
 * Функция flang «Разобрать тип».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param r — «р»: «Разборщик»
 * @return значение: «Шаг»
 */
fl_status kompilyator_flang_razobrat_tip(fl_ctx *ctx, fl_value r, fl_value *result, fl_error *error);

/*
 * Функция flang «Разобрать основной тип».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param r — «р»: «Разборщик»
 * @return значение: «Шаг»
 */
fl_status kompilyator_flang_razobrat_osnovnoy_tip(fl_ctx *ctx, fl_value r, fl_value *result, fl_error *error);

/*
 * Функция flang «Тип функцией».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param r — «р»: «Разборщик»
 * @return значение: «Шаг»
 */
fl_status kompilyator_flang_tip_funkciey(fl_ctx *ctx, fl_value r, fl_value *result, fl_error *error);

/*
 * Функция flang «Тип списком».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param r — «р»: «Разборщик»
 * @return значение: «Шаг»
 */
fl_status kompilyator_flang_tip_spiskom(fl_ctx *ctx, fl_value r, fl_value *result, fl_error *error);

/*
 * Функция flang «Тип состоянием».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param r — «р»: «Разборщик»
 * @return значение: «Шаг»
 */
fl_status kompilyator_flang_tip_sostoyaniem(fl_ctx *ctx, fl_value r, fl_value *result, fl_error *error);

/*
 * Функция flang «Тип скаляром».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param r — «р»: «Разборщик»
 * @return значение: «Шаг»
 */
fl_status kompilyator_flang_tip_skalyarom(fl_ctx *ctx, fl_value r, fl_value *result, fl_error *error);

/*
 * Функция flang «Тип именем».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param r — «р»: «Разборщик»
 * @return значение: «Шаг»
 */
fl_status kompilyator_flang_tip_imenem(fl_ctx *ctx, fl_value r, fl_value *result, fl_error *error);

/*
 * Функция flang «Аргументы типа».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Хвостовой самовызов развёрнут в цикл: стек не растёт.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param r — «р»: «Разборщик»
 * @param uzly — «узлы»: список: «Значение»
 * @return значение: «Шаг узлов»
 */
fl_status kompilyator_flang_argumenty_tipa(fl_ctx *ctx, fl_value r, fl_value uzly, fl_value *result, fl_error *error);

/*
 * Функция flang «Ещё аргумент типа».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param r — «р»: «Разборщик»
 * @return значение
 */
fl_status kompilyator_flang_eschyo_argument_tipa(fl_ctx *ctx, fl_value r, fl_value *result, fl_error *error);

/*
 * Функция flang «Поле после и».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param r — «р»: «Разборщик»
 * @return значение
 */
fl_status kompilyator_flang_pole_posle_i(fl_ctx *ctx, fl_value r, fl_value *result, fl_error *error);

/*
 * Функция flang «Строка типа FTS».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param tip — «тип»: «Значение»
 * @return значение: строка
 */
fl_status kompilyator_flang_stroka_tipa_fts(fl_ctx *ctx, fl_value tip, fl_value *result, fl_error *error);

/*
 * Функция flang «Строка типа по виду».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param tip — «тип»: «Значение»
 * @return значение: строка
 */
fl_status kompilyator_flang_stroka_tipa_po_vidu(fl_ctx *ctx, fl_value tip, fl_value *result, fl_error *error);

/*
 * Функция flang «Разобрать тип поля».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param r — «р»: «Разборщик»
 * @return значение: «Шаг типа»
 */
fl_status kompilyator_flang_razobrat_tip_polya(fl_ctx *ctx, fl_value r, fl_value *result, fl_error *error);

/*
 * Функция flang «Тип поля обычный».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param r — «р»: «Разборщик»
 * @return значение: «Шаг типа»
 */
fl_status kompilyator_flang_tip_polya_obychnyy(fl_ctx *ctx, fl_value r, fl_value *result, fl_error *error);

/*
 * Функция flang «Разобрать строки».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param r — «р»: «Разборщик»
 * @return значение: «Шаг»
 */
fl_status kompilyator_flang_razobrat_stroki(fl_ctx *ctx, fl_value r, fl_value *result, fl_error *error);

/*
 * Функция flang «Съесть равенство».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param r — «р»: «Разборщик»
 * @return значение: «Разборщик»
 */
fl_status kompilyator_flang_sest_ravenstvo(fl_ctx *ctx, fl_value r, fl_value *result, fl_error *error);

/*
 * Функция flang «Разобрать пусть».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param r — «р»: «Разборщик»
 * @return значение: «Шаг»
 */
fl_status kompilyator_flang_razobrat_pust(fl_ctx *ctx, fl_value r, fl_value *result, fl_error *error);

/*
 * Функция flang «Разобрать выражение».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param r — «р»: «Разборщик»
 * @return значение: «Шаг»
 */
fl_status kompilyator_flang_razobrat_vyrazhenie(fl_ctx *ctx, fl_value r, fl_value *result, fl_error *error);

/*
 * Функция flang «Выражение из слова».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param r — «р»: «Разборщик»
 * @param token — «токен»: «Токен»
 * @return значение: «Шаг»
 */
fl_status kompilyator_flang_vyrazhenie_iz_slova(fl_ctx *ctx, fl_value r, fl_value token, fl_value *result, fl_error *error);

/*
 * Функция flang «Разобрать если».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param r — «р»: «Разборщик»
 * @return значение: «Шаг»
 */
fl_status kompilyator_flang_razobrat_esli(fl_ctx *ctx, fl_value r, fl_value *result, fl_error *error);

/*
 * Функция flang «Ветки если».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param r — «р»: «Разборщик»
 * @return значение: «Шаг»
 */
fl_status kompilyator_flang_vetki_esli(fl_ctx *ctx, fl_value r, fl_value *result, fl_error *error);

/*
 * Функция flang «Ветки после то».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param r — «р»: «Разборщик»
 * @return значение: «Шаг»
 */
fl_status kompilyator_flang_vetki_posle_to(fl_ctx *ctx, fl_value r, fl_value *result, fl_error *error);

/*
 * Функция flang «Ветки блоком».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param r — «р»: «Разборщик»
 * @return значение: «Шаг»
 */
fl_status kompilyator_flang_vetki_blokom(fl_ctx *ctx, fl_value r, fl_value *result, fl_error *error);

/*
 * Функция flang «Ветки внутри блока».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param r — «р»: «Разборщик»
 * @return значение: «Шаг»
 */
fl_status kompilyator_flang_vetki_vnutri_bloka(fl_ctx *ctx, fl_value r, fl_value *result, fl_error *error);

/*
 * Функция flang «Тело ветки».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param r — «р»: «Разборщик»
 * @return значение: «Шаг»
 */
fl_status kompilyator_flang_telo_vetki(fl_ctx *ctx, fl_value r, fl_value *result, fl_error *error);

/*
 * Функция flang «Разобрать разбор».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param r — «р»: «Разборщик»
 * @return значение: «Шаг»
 */
fl_status kompilyator_flang_razobrat_razbor(fl_ctx *ctx, fl_value r, fl_value *result, fl_error *error);

/*
 * Функция flang «Случаи разбора».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param r — «р»: «Разборщик»
 * @param cel — «цель»: «Значение»
 * @param nachalo — «начало»: «Токен»
 * @return значение: «Шаг»
 */
fl_status kompilyator_flang_sluchai_razbora(fl_ctx *ctx, fl_value r, fl_value cel, fl_value nachalo, fl_value *result, fl_error *error);

/*
 * Функция flang «Обойти случаи».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Хвостовой самовызов развёрнут в цикл: стек не растёт.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param r — «р»: «Разборщик»
 * @param uzly — «узлы»: список: «Значение»
 * @return значение: «Шаг узлов»
 */
fl_status kompilyator_flang_oboyti_sluchai(fl_ctx *ctx, fl_value r, fl_value uzly, fl_value *result, fl_error *error);

/*
 * Функция flang «Разобрать случай».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param r — «р»: «Разборщик»
 * @return значение: «Шаг»
 */
fl_status kompilyator_flang_razobrat_sluchay(fl_ctx *ctx, fl_value r, fl_value *result, fl_error *error);

/*
 * Функция flang «Тело случая».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param r — «р»: «Разборщик»
 * @param nachalo — «начало»: «Токен»
 * @return значение: «Шаг»
 */
fl_status kompilyator_flang_telo_sluchaya(fl_ctx *ctx, fl_value r, fl_value nachalo, fl_value *result, fl_error *error);

/*
 * Функция flang «Тело случая блоком».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param r — «р»: «Разборщик»
 * @return значение: «Шаг»
 */
fl_status kompilyator_flang_telo_sluchaya_blokom(fl_ctx *ctx, fl_value r, fl_value *result, fl_error *error);

/*
 * Функция flang «Значения полей».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param uzel — «узел»: «Значение»
 * @return значение: список: строка
 */
fl_status kompilyator_flang_znacheniya_poley(fl_ctx *ctx, fl_value uzel, fl_value *result, fl_error *error);

/*
 * Функция flang «Связи образца».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param obrazec — «образец»: «Значение»
 * @return значение: список: строка
 */
fl_status kompilyator_flang_svyazi_obrazca(fl_ctx *ctx, fl_value obrazec, fl_value *result, fl_error *error);

/*
 * Функция flang «Разобрать образец».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param r — «р»: «Разборщик»
 * @return значение: «Шаг»
 */
fl_status kompilyator_flang_razobrat_obrazec(fl_ctx *ctx, fl_value r, fl_value *result, fl_error *error);

/*
 * Функция flang «Образец головой и хвостом».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param r — «р»: «Разборщик»
 * @return значение: «Шаг»
 */
fl_status kompilyator_flang_obrazec_golovoy_i_hvostom(fl_ctx *ctx, fl_value r, fl_value *result, fl_error *error);

/*
 * Функция flang «Последнее слово».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param slova — «слова»: список: строка
 * @return значение: строка
 */
fl_status kompilyator_flang_poslednee_slovo(fl_ctx *ctx, fl_value slova, fl_value *result, fl_error *error);

/*
 * Функция flang «Образец головой».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param r — «р»: «Разборщик»
 * @return значение: «Шаг»
 */
fl_status kompilyator_flang_obrazec_golovoy(fl_ctx *ctx, fl_value r, fl_value *result, fl_error *error);

/*
 * Функция flang «Образец любым».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param r — «р»: «Разборщик»
 * @return значение: «Шаг»
 */
fl_status kompilyator_flang_obrazec_lyubym(fl_ctx *ctx, fl_value r, fl_value *result, fl_error *error);

/*
 * Функция flang «Образец вариантом».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param r — «р»: «Разборщик»
 * @return значение: «Шаг»
 */
fl_status kompilyator_flang_obrazec_variantom(fl_ctx *ctx, fl_value r, fl_value *result, fl_error *error);

/*
 * Функция flang «Образец литералом».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param r — «р»: «Разборщик»
 * @return значение: «Шаг»
 */
fl_status kompilyator_flang_obrazec_literalom(fl_ctx *ctx, fl_value r, fl_value *result, fl_error *error);

/*
 * Функция flang «Образец словом-литералом».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param r — «р»: «Разборщик»
 * @return значение: «Шаг»
 */
fl_status kompilyator_flang_obrazec_slovom_literalom(fl_ctx *ctx, fl_value r, fl_value *result, fl_error *error);

/*
 * Функция flang «Образец именем».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param r — «р»: «Разборщик»
 * @return значение: «Шаг»
 */
fl_status kompilyator_flang_obrazec_imenem(fl_ctx *ctx, fl_value r, fl_value *result, fl_error *error);

/*
 * Функция flang «Связи варианта».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param r — «р»: «Разборщик»
 * @return значение: «Шаг полей»
 */
fl_status kompilyator_flang_svyazi_varianta(fl_ctx *ctx, fl_value r, fl_value *result, fl_error *error);

/*
 * Функция flang «Обойти связи варианта».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Хвостовой самовызов развёрнут в цикл: стек не растёт.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param r — «р»: «Разборщик»
 * @param perechen — «перечень»: список: «Поле значения»
 * @return значение: «Шаг полей»
 */
fl_status kompilyator_flang_oboyti_svyazi_varianta(fl_ctx *ctx, fl_value r, fl_value perechen, fl_value *result, fl_error *error);

/*
 * Функция flang «Разобрать отображение».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param r — «р»: «Разборщик»
 * @return значение: «Шаг»
 */
fl_status kompilyator_flang_razobrat_otobrazhenie(fl_ctx *ctx, fl_value r, fl_value *result, fl_error *error);

/*
 * Функция flang «Разобрать отбор».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param r — «р»: «Разборщик»
 * @return значение: «Шаг»
 */
fl_status kompilyator_flang_razobrat_otbor(fl_ctx *ctx, fl_value r, fl_value *result, fl_error *error);

/*
 * Функция flang «Разобрать свёртку».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param r — «р»: «Разборщик»
 * @return значение: «Шаг»
 */
fl_status kompilyator_flang_razobrat_svyortku(fl_ctx *ctx, fl_value r, fl_value *result, fl_error *error);

/*
 * Функция flang «Тело со связями».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param r — «р»: «Разборщик»
 * @param imena — «имена»: список: строка
 * @return значение: «Шаг»
 */
fl_status kompilyator_flang_telo_so_svyazyami(fl_ctx *ctx, fl_value r, fl_value imena, fl_value *result, fl_error *error);

/*
 * Функция flang «Тело формы».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param r — «р»: «Разборщик»
 * @return значение: «Шаг»
 */
fl_status kompilyator_flang_telo_formy(fl_ctx *ctx, fl_value r, fl_value *result, fl_error *error);

/*
 * Функция flang «Узел если при разборе».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param uslovie — «условие»: «Значение»
 * @param kogda_da — «когда да»: «Значение»
 * @param kogda_net — «когда нет»: «Значение»
 * @param token — «токен»: «Токен»
 * @return значение: «Значение»
 */
fl_status kompilyator_flang_uzel_esli_pri_razbore(fl_ctx *ctx, fl_value uslovie, fl_value kogda_da, fl_value kogda_net, fl_value token, fl_value *result, fl_error *error);

/*
 * Функция flang «Узел литерала признака».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param znachenie — «значение»
 * @param token — «токен»: «Токен»
 * @return значение: «Значение»
 */
fl_status kompilyator_flang_uzel_literala_priznaka(fl_ctx *ctx, fl_value znachenie, fl_value token, fl_value *result, fl_error *error);

/*
 * Функция flang «Разобрать дизъюнкцию».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param r — «р»: «Разборщик»
 * @return значение: «Шаг»
 */
fl_status kompilyator_flang_razobrat_dizyunkciyu(fl_ctx *ctx, fl_value r, fl_value *result, fl_error *error);

/*
 * Функция flang «Хвост дизъюнкции».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Хвостовой самовызов развёрнут в цикл: стек не растёт.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param r — «р»: «Разборщик»
 * @param sleva — «слева»: «Значение»
 * @return значение: «Шаг»
 */
fl_status kompilyator_flang_hvost_dizyunkcii(fl_ctx *ctx, fl_value r, fl_value sleva, fl_value *result, fl_error *error);

/*
 * Функция flang «Разобрать конъюнкцию».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param r — «р»: «Разборщик»
 * @return значение: «Шаг»
 */
fl_status kompilyator_flang_razobrat_konyunkciyu(fl_ctx *ctx, fl_value r, fl_value *result, fl_error *error);

/*
 * Функция flang «Хвост конъюнкции».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Хвостовой самовызов развёрнут в цикл: стек не растёт.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param r — «р»: «Разборщик»
 * @param sleva — «слева»: «Значение»
 * @return значение: «Шаг»
 */
fl_status kompilyator_flang_hvost_konyunkcii(fl_ctx *ctx, fl_value r, fl_value sleva, fl_value *result, fl_error *error);

/*
 * Функция flang «Разобрать отрицание».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param r — «р»: «Разборщик»
 * @return значение: «Шаг»
 */
fl_status kompilyator_flang_razobrat_otricanie(fl_ctx *ctx, fl_value r, fl_value *result, fl_error *error);

/*
 * Функция flang «Разобрать сравнение».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param r — «р»: «Разборщик»
 * @return значение: «Шаг»
 */
fl_status kompilyator_flang_razobrat_sravnenie(fl_ctx *ctx, fl_value r, fl_value *result, fl_error *error);

/*
 * Функция flang «Хвост сравнения».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param r — «р»: «Разборщик»
 * @param sleva — «слева»: «Значение»
 * @return значение: «Шаг»
 */
fl_status kompilyator_flang_hvost_sravneniya(fl_ctx *ctx, fl_value r, fl_value sleva, fl_value *result, fl_error *error);

/*
 * Функция flang «Хвост содержания».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param r — «р»: «Разборщик»
 * @param sleva — «слева»: «Значение»
 * @param token — «токен»: «Токен»
 * @return значение: «Шаг»
 */
fl_status kompilyator_flang_hvost_soderzhaniya(fl_ctx *ctx, fl_value r, fl_value sleva, fl_value token, fl_value *result, fl_error *error);

/*
 * Функция flang «Разобрать сложение».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param r — «р»: «Разборщик»
 * @return значение: «Шаг»
 */
fl_status kompilyator_flang_razobrat_slozhenie(fl_ctx *ctx, fl_value r, fl_value *result, fl_error *error);

/*
 * Функция flang «Хвост сложения».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Хвостовой самовызов развёрнут в цикл: стек не растёт.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param r — «р»: «Разборщик»
 * @param sleva — «слева»: «Значение»
 * @return значение: «Шаг»
 */
fl_status kompilyator_flang_hvost_slozheniya(fl_ctx *ctx, fl_value r, fl_value sleva, fl_value *result, fl_error *error);

/*
 * Функция flang «Разобрать умножение».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param r — «р»: «Разборщик»
 * @return значение: «Шаг»
 */
fl_status kompilyator_flang_razobrat_umnozhenie(fl_ctx *ctx, fl_value r, fl_value *result, fl_error *error);

/*
 * Функция flang «Хвост умножения».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Хвостовой самовызов развёрнут в цикл: стек не растёт.
 *
 * Взаимная хвостовая рекурсия с «Хвост процента»: вызовы идут через батут.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param r — «р»: «Разборщик»
 * @param sleva — «слева»: «Значение»
 * @return значение: «Шаг»
 */
fl_status kompilyator_flang_hvost_umnozheniya(fl_ctx *ctx, fl_value r, fl_value sleva, fl_value *result, fl_error *error);

/*
 * Функция flang «Хвост процента».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Взаимная хвостовая рекурсия с «Хвост умножения»: вызовы идут через батут.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param r — «р»: «Разборщик»
 * @param sleva — «слева»: «Значение»
 * @return значение: «Шаг»
 */
fl_status kompilyator_flang_hvost_procenta(fl_ctx *ctx, fl_value r, fl_value sleva, fl_value *result, fl_error *error);

/*
 * Функция flang «Разобрать постфикс».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param r — «р»: «Разборщик»
 * @return значение: «Шаг»
 */
fl_status kompilyator_flang_razobrat_postfiks(fl_ctx *ctx, fl_value r, fl_value *result, fl_error *error);

/*
 * Функция flang «Хвост постфикса».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Хвостовой самовызов развёрнут в цикл: стек не растёт.
 *
 * Взаимная хвостовая рекурсия с «Вызов по имени», «Применение значения», «Хвост применения»: вызовы идут через батут.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param r — «р»: «Разборщик»
 * @param uzel — «узел»: «Значение»
 * @return значение: «Шаг»
 */
fl_status kompilyator_flang_hvost_postfiksa(fl_ctx *ctx, fl_value r, fl_value uzel, fl_value *result, fl_error *error);

/*
 * Функция flang «Имя применения».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param uzel — «узел»: «Значение»
 * @return значение: «Может быть имя при разборе»
 */
fl_status kompilyator_flang_imya_primeneniya(fl_ctx *ctx, fl_value uzel, fl_value *result, fl_error *error);

/*
 * Функция flang «Имя или пусто».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param imya — «имя»: «Может быть имя при разборе»
 * @return значение: строка
 */
fl_status kompilyator_flang_imya_ili_pusto(fl_ctx *ctx, fl_value imya, fl_value *result, fl_error *error);

/*
 * Функция flang «Нет такого имени».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param imya — «имя»: «Может быть имя при разборе»
 * @return значение
 */
fl_status kompilyator_flang_net_takogo_imeni(fl_ctx *ctx, fl_value imya, fl_value *result, fl_error *error);

/*
 * Функция flang «Имя локального».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param r — «р»: «Разборщик»
 * @param imya — «имя»: строка
 * @return значение: «Может быть имя при разборе»
 */
fl_status kompilyator_flang_imya_lokalnogo(fl_ctx *ctx, fl_value r, fl_value imya, fl_value *result, fl_error *error);

/*
 * Функция flang «Значение применения».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param r — «р»: «Разборщик»
 * @param uzel — «узел»: «Значение»
 * @return значение: «Может быть узел при разборе»
 */
fl_status kompilyator_flang_znachenie_primeneniya(fl_ctx *ctx, fl_value r, fl_value uzel, fl_value *result, fl_error *error);

/*
 * Функция flang «Значение локального».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param r — «р»: «Разборщик»
 * @param uzel — «узел»: «Значение»
 * @return значение: «Может быть узел при разборе»
 */
fl_status kompilyator_flang_znachenie_lokalnogo(fl_ctx *ctx, fl_value r, fl_value uzel, fl_value *result, fl_error *error);

/*
 * Функция flang «Хвост применения».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Взаимная хвостовая рекурсия с «Вызов по имени», «Применение значения», «Хвост постфикса»: вызовы идут через батут.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param r — «р»: «Разборщик»
 * @param uzel — «узел»: «Значение»
 * @return значение: «Шаг»
 */
fl_status kompilyator_flang_hvost_primeneniya(fl_ctx *ctx, fl_value r, fl_value uzel, fl_value *result, fl_error *error);

/*
 * Функция flang «Применение значения».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Взаимная хвостовая рекурсия с «Вызов по имени», «Хвост применения», «Хвост постфикса»: вызовы идут через батут.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param r — «р»: «Разборщик»
 * @param znachenie — «значение»: «Значение»
 * @param mesto — «место»: «Значение»
 * @return значение: «Шаг»
 */
fl_status kompilyator_flang_primenenie_znacheniya(fl_ctx *ctx, fl_value r, fl_value znachenie, fl_value mesto, fl_value *result, fl_error *error);

/*
 * Функция flang «Вызов по имени».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Взаимная хвостовая рекурсия с «Применение значения», «Хвост применения», «Хвост постфикса»: вызовы идут через батут.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param r — «р»: «Разборщик»
 * @param uzel — «узел»: «Значение»
 * @param token — «токен»: «Токен»
 * @param mesto — «место»: «Значение»
 * @return значение: «Шаг»
 */
fl_status kompilyator_flang_vyzov_po_imeni(fl_ctx *ctx, fl_value r, fl_value uzel, fl_value token, fl_value mesto, fl_value *result, fl_error *error);

/*
 * Функция flang «Аргументы применения».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Хвостовой самовызов развёрнут в цикл: стек не растёт.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param r — «р»: «Разборщик»
 * @param uzly — «узлы»: список: «Значение»
 * @return значение: «Шаг узлов»
 */
fl_status kompilyator_flang_argumenty_primeneniya(fl_ctx *ctx, fl_value r, fl_value uzly, fl_value *result, fl_error *error);

/*
 * Функция flang «Начинается выражение».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param r — «р»: «Разборщик»
 * @return значение
 */
fl_status kompilyator_flang_nachinaetsya_vyrazhenie(fl_ctx *ctx, fl_value r, fl_value *result, fl_error *error);

/*
 * Функция flang «Похоже на конструктор».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param r — «р»: «Разборщик»
 * @return значение
 */
fl_status kompilyator_flang_pohozhe_na_konstruktor(fl_ctx *ctx, fl_value r, fl_value *result, fl_error *error);

/*
 * Функция flang «Разобрать первичное».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param r — «р»: «Разборщик»
 * @return значение: «Шаг»
 */
fl_status kompilyator_flang_razobrat_pervichnoe(fl_ctx *ctx, fl_value r, fl_value *result, fl_error *error);

/*
 * Функция flang «Первичное числом».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param r — «р»: «Разборщик»
 * @param token — «токен»: «Токен»
 * @return значение: «Шаг»
 */
fl_status kompilyator_flang_pervichnoe_chislom(fl_ctx *ctx, fl_value r, fl_value token, fl_value *result, fl_error *error);

/*
 * Функция flang «Первичное строкой».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param r — «р»: «Разборщик»
 * @param token — «токен»: «Токен»
 * @return значение: «Шаг»
 */
fl_status kompilyator_flang_pervichnoe_strokoy(fl_ctx *ctx, fl_value r, fl_value token, fl_value *result, fl_error *error);

/*
 * Функция flang «Первичное именем».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param r — «р»: «Разборщик»
 * @param token — «токен»: «Токен»
 * @return значение: «Шаг»
 */
fl_status kompilyator_flang_pervichnoe_imenem(fl_ctx *ctx, fl_value r, fl_value token, fl_value *result, fl_error *error);

/*
 * Функция flang «Первичное скобкой».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param r — «р»: «Разборщик»
 * @param token — «токен»: «Токен»
 * @return значение: «Шаг»
 */
fl_status kompilyator_flang_pervichnoe_skobkoy(fl_ctx *ctx, fl_value r, fl_value token, fl_value *result, fl_error *error);

/*
 * Функция flang «Первичное списком».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param r — «р»: «Разборщик»
 * @param token — «токен»: «Токен»
 * @return значение: «Шаг»
 */
fl_status kompilyator_flang_pervichnoe_spiskom(fl_ctx *ctx, fl_value r, fl_value token, fl_value *result, fl_error *error);

/*
 * Функция flang «Обойти элементы списка».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Хвостовой самовызов развёрнут в цикл: стек не растёт.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param r — «р»: «Разборщик»
 * @param uzly — «узлы»: список: «Значение»
 * @return значение: «Шаг узлов»
 */
fl_status kompilyator_flang_oboyti_elementy_spiska(fl_ctx *ctx, fl_value r, fl_value uzly, fl_value *result, fl_error *error);

/*
 * Функция flang «Первичное словом».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param r — «р»: «Разборщик»
 * @param token — «токен»: «Токен»
 * @return значение: «Шаг»
 */
fl_status kompilyator_flang_pervichnoe_slovom(fl_ctx *ctx, fl_value r, fl_value token, fl_value *result, fl_error *error);

/*
 * Функция flang «Слово литералом».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param r — «р»: «Разборщик»
 * @param token — «токен»: «Токен»
 * @return значение: «Шаг»
 */
fl_status kompilyator_flang_slovo_literalom(fl_ctx *ctx, fl_value r, fl_value token, fl_value *result, fl_error *error);

/*
 * Функция flang «Слово пустотой».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param r — «р»: «Разборщик»
 * @param token — «токен»: «Токен»
 * @return значение: «Шаг»
 */
fl_status kompilyator_flang_slovo_pustotoy(fl_ctx *ctx, fl_value r, fl_value token, fl_value *result, fl_error *error);

/*
 * Функция flang «Слово пустым списком».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param r — «р»: «Разборщик»
 * @param token — «токен»: «Токен»
 * @return значение: «Шаг»
 */
fl_status kompilyator_flang_slovo_pustym_spiskom(fl_ctx *ctx, fl_value r, fl_value token, fl_value *result, fl_error *error);

/*
 * Функция flang «Слово списком из».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param r — «р»: «Разборщик»
 * @param token — «токен»: «Токен»
 * @return значение: «Шаг»
 */
fl_status kompilyator_flang_slovo_spiskom_iz(fl_ctx *ctx, fl_value r, fl_value token, fl_value *result, fl_error *error);

/*
 * Функция flang «Ещё элементы списка из».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Хвостовой самовызов развёрнут в цикл: стек не растёт.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param r — «р»: «Разборщик»
 * @param uzly — «узлы»: список: «Значение»
 * @return значение: «Шаг узлов»
 */
fl_status kompilyator_flang_eschyo_elementy_spiska_iz(fl_ctx *ctx, fl_value r, fl_value uzly, fl_value *result, fl_error *error);

/*
 * Функция flang «Имя одноместной формы».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param identifikator — «идентификатор»: строка
 * @return значение: строка
 */
fl_status kompilyator_flang_imya_odnomestnoy_formy(fl_ctx *ctx, fl_value identifikator, fl_value *result, fl_error *error);

/*
 * Функция flang «Слово одноместной формой».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param r — «р»: «Разборщик»
 * @param token — «токен»: «Токен»
 * @return значение: «Шаг»
 */
fl_status kompilyator_flang_slovo_odnomestnoy_formoy(fl_ctx *ctx, fl_value r, fl_value token, fl_value *result, fl_error *error);

/*
 * Функция flang «Слово символом».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param r — «р»: «Разборщик»
 * @param token — «токен»: «Токен»
 * @return значение: «Шаг»
 */
fl_status kompilyator_flang_slovo_simvolom(fl_ctx *ctx, fl_value r, fl_value token, fl_value *result, fl_error *error);

/*
 * Функция flang «Слово элементом».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param r — «р»: «Разборщик»
 * @param token — «токен»: «Токен»
 * @return значение: «Шаг»
 */
fl_status kompilyator_flang_slovo_elementom(fl_ctx *ctx, fl_value r, fl_value token, fl_value *result, fl_error *error);

/*
 * Функция flang «Съесть одно из двух».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param r — «р»: «Разборщик»
 * @param pervoe — «первое»: строка
 * @param vtoroe — «второе»: строка
 * @param soobschenie — «сообщение»: строка
 * @return значение: «Разборщик»
 */
fl_status kompilyator_flang_sest_odno_iz_dvuh(fl_ctx *ctx, fl_value r, fl_value pervoe, fl_value vtoroe, fl_value soobschenie, fl_value *result, fl_error *error);

/*
 * Функция flang «Слово подстрокой».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param r — «р»: «Разборщик»
 * @param token — «токен»: «Токен»
 * @return значение: «Шаг»
 */
fl_status kompilyator_flang_slovo_podstrokoy(fl_ctx *ctx, fl_value r, fl_value token, fl_value *result, fl_error *error);

/*
 * Функция flang «Слово соединением».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param r — «р»: «Разборщик»
 * @param token — «токен»: «Токен»
 * @return значение: «Шаг»
 */
fl_status kompilyator_flang_slovo_soedineniem(fl_ctx *ctx, fl_value r, fl_value token, fl_value *result, fl_error *error);

/*
 * Функция flang «Слово разделением».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param r — «р»: «Разборщик»
 * @param token — «токен»: «Токен»
 * @return значение: «Шаг»
 */
fl_status kompilyator_flang_slovo_razdeleniem(fl_ctx *ctx, fl_value r, fl_value token, fl_value *result, fl_error *error);

/*
 * Функция flang «Слово разложением».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param r — «р»: «Разборщик»
 * @param token — «токен»: «Токен»
 * @return значение: «Шаг»
 */
fl_status kompilyator_flang_slovo_razlozheniem(fl_ctx *ctx, fl_value r, fl_value token, fl_value *result, fl_error *error);

/*
 * Функция flang «Слово кодом символа».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param r — «р»: «Разборщик»
 * @param token — «токен»: «Токен»
 * @return значение: «Шаг»
 */
fl_status kompilyator_flang_slovo_kodom_simvola(fl_ctx *ctx, fl_value r, fl_value token, fl_value *result, fl_error *error);

/*
 * Функция flang «Слово добавлением».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param r — «р»: «Разборщик»
 * @param token — «токен»: «Токен»
 * @return значение: «Шаг»
 */
fl_status kompilyator_flang_slovo_dobavleniem(fl_ctx *ctx, fl_value r, fl_value token, fl_value *result, fl_error *error);

/*
 * Функция flang «Слово функцией».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param r — «р»: «Разборщик»
 * @param token — «токен»: «Токен»
 * @return значение: «Шаг»
 */
fl_status kompilyator_flang_slovo_funkciey(fl_ctx *ctx, fl_value r, fl_value token, fl_value *result, fl_error *error);

/*
 * Функция flang «Слово вариантом».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param r — «р»: «Разборщик»
 * @param token — «токен»: «Токен»
 * @return значение: «Шаг»
 */
fl_status kompilyator_flang_slovo_variantom(fl_ctx *ctx, fl_value r, fl_value token, fl_value *result, fl_error *error);

/*
 * Функция flang «Слово записью».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param r — «р»: «Разборщик»
 * @param token — «токен»: «Токен»
 * @return значение: «Шаг»
 */
fl_status kompilyator_flang_slovo_zapisyu(fl_ctx *ctx, fl_value r, fl_value token, fl_value *result, fl_error *error);

/*
 * Функция flang «Слово полем».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param r — «р»: «Разборщик»
 * @param token — «токен»: «Токен»
 * @return значение: «Шаг»
 */
fl_status kompilyator_flang_slovo_polem(fl_ctx *ctx, fl_value r, fl_value token, fl_value *result, fl_error *error);

/*
 * Функция flang «Слово результатом».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param r — «р»: «Разборщик»
 * @param token — «токен»: «Токен»
 * @return значение: «Шаг»
 */
fl_status kompilyator_flang_slovo_rezultatom(fl_ctx *ctx, fl_value r, fl_value token, fl_value *result, fl_error *error);

/*
 * Функция flang «Слово формой».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param r — «р»: «Разборщик»
 * @param token — «токен»: «Токен»
 * @return значение: «Шаг»
 */
fl_status kompilyator_flang_slovo_formoy(fl_ctx *ctx, fl_value r, fl_value token, fl_value *result, fl_error *error);

/*
 * Функция flang «Слово мягким именем».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param r — «р»: «Разборщик»
 * @param token — «токен»: «Токен»
 * @return значение: «Шаг»
 */
fl_status kompilyator_flang_slovo_myagkim_imenem(fl_ctx *ctx, fl_value r, fl_value token, fl_value *result, fl_error *error);

/*
 * Функция flang «Присвоения полей».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param r — «р»: «Разборщик»
 * @return значение: «Шаг полей»
 */
fl_status kompilyator_flang_prisvoeniya_poley(fl_ctx *ctx, fl_value r, fl_value *result, fl_error *error);

/*
 * Функция flang «Обойти присвоения».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Хвостовой самовызов развёрнут в цикл: стек не растёт.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param r — «р»: «Разборщик»
 * @param perechen — «перечень»: список: «Поле значения»
 * @return значение: «Шаг полей»
 */
fl_status kompilyator_flang_oboyti_prisvoeniya(fl_ctx *ctx, fl_value r, fl_value perechen, fl_value *result, fl_error *error);

/*
 * Функция flang «Ещё присвоение».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param r — «р»: «Разборщик»
 * @return значение
 */
fl_status kompilyator_flang_eschyo_prisvoenie(fl_ctx *ctx, fl_value r, fl_value *result, fl_error *error);

/*
 * Функция flang «Разобрать запись».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param r — «р»: «Разборщик»
 * @return значение: «Шаг»
 */
fl_status kompilyator_flang_razobrat_zapis(fl_ctx *ctx, fl_value r, fl_value *result, fl_error *error);

/*
 * Функция flang «Тело записи».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param r — «р»: «Разборщик»
 * @return значение: «Шаг узлов»
 */
fl_status kompilyator_flang_telo_zapisi(fl_ctx *ctx, fl_value r, fl_value *result, fl_error *error);

/*
 * Функция flang «Обойти поля записи».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Хвостовой самовызов развёрнут в цикл: стек не растёт.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param r — «р»: «Разборщик»
 * @param uzly — «узлы»: список: «Значение»
 * @return значение: «Шаг узлов»
 */
fl_status kompilyator_flang_oboyti_polya_zapisi(fl_ctx *ctx, fl_value r, fl_value uzly, fl_value *result, fl_error *error);

/*
 * Функция flang «Разобрать поле записи».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param r — «р»: «Разборщик»
 * @return значение: «Шаг»
 */
fl_status kompilyator_flang_razobrat_pole_zapisi(fl_ctx *ctx, fl_value r, fl_value *result, fl_error *error);

/*
 * Функция flang «Разделитель поля».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param r — «р»: «Разборщик»
 * @return значение: «Шаг флага»
 */
fl_status kompilyator_flang_razdelitel_polya(fl_ctx *ctx, fl_value r, fl_value *result, fl_error *error);

/*
 * Функция flang «Обычное поле записи».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param r — «р»: «Разборщик»
 * @return значение: «Шаг»
 */
fl_status kompilyator_flang_obychnoe_pole_zapisi(fl_ctx *ctx, fl_value r, fl_value *result, fl_error *error);

/*
 * Функция flang «Разобрать объявление типа».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param r — «р»: «Разборщик»
 * @return значение: «Шаг»
 */
fl_status kompilyator_flang_razobrat_obyavlenie_tipa(fl_ctx *ctx, fl_value r, fl_value *result, fl_error *error);

/*
 * Функция flang «Разобрать псевдоним».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param r — «р»: «Разборщик»
 * @param imya — «имя»: строка
 * @param nachalo — «начало»: «Токен»
 * @param parametry — «параметры»: список: строка
 * @return значение: «Шаг»
 */
fl_status kompilyator_flang_razobrat_psevdonim(fl_ctx *ctx, fl_value r, fl_value imya, fl_value nachalo, fl_value parametry, fl_value *result, fl_error *error);

/*
 * Функция flang «Разобрать сумму».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param r — «р»: «Разборщик»
 * @param imya — «имя»: строка
 * @param nachalo — «начало»: «Токен»
 * @param parametry — «параметры»: список: строка
 * @return значение: «Шаг»
 */
fl_status kompilyator_flang_razobrat_summu(fl_ctx *ctx, fl_value r, fl_value imya, fl_value nachalo, fl_value parametry, fl_value *result, fl_error *error);

/*
 * Функция flang «Тело суммы».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param r — «р»: «Разборщик»
 * @return значение: «Шаг узлов»
 */
fl_status kompilyator_flang_telo_summy(fl_ctx *ctx, fl_value r, fl_value *result, fl_error *error);

/*
 * Функция flang «Обойти варианты».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Хвостовой самовызов развёрнут в цикл: стек не растёт.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param r — «р»: «Разборщик»
 * @param uzly — «узлы»: список: «Значение»
 * @return значение: «Шаг узлов»
 */
fl_status kompilyator_flang_oboyti_varianty(fl_ctx *ctx, fl_value r, fl_value uzly, fl_value *result, fl_error *error);

/*
 * Функция flang «Разобрать вариант».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param r — «р»: «Разборщик»
 * @return значение: «Шаг»
 */
fl_status kompilyator_flang_razobrat_variant(fl_ctx *ctx, fl_value r, fl_value *result, fl_error *error);

/*
 * Функция flang «Обойти поля варианта».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Хвостовой самовызов развёрнут в цикл: стек не растёт.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param r — «р»: «Разборщик»
 * @param uzly — «узлы»: список: «Значение»
 * @return значение: «Шаг узлов»
 */
fl_status kompilyator_flang_oboyti_polya_varianta(fl_ctx *ctx, fl_value r, fl_value uzly, fl_value *result, fl_error *error);

/*
 * Функция flang «Разобрать функцию».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param r — «р»: «Разборщик»
 * @return значение: «Шаг»
 */
fl_status kompilyator_flang_razobrat_funkciyu(fl_ctx *ctx, fl_value r, fl_value *result, fl_error *error);

/*
 * Функция flang «Нет тела».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param telo — «тело»: «Может быть узел при разборе»
 * @return значение
 */
fl_status kompilyator_flang_net_tela(fl_ctx *ctx, fl_value telo, fl_value *result, fl_error *error);

/*
 * Функция flang «Узел или ничто».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param telo — «тело»: «Может быть узел при разборе»
 * @return значение: «Значение»
 */
fl_status kompilyator_flang_uzel_ili_nichto(fl_ctx *ctx, fl_value telo, fl_value *result, fl_error *error);

/*
 * Функция flang «С мерой».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param polya — «поля»: список: «Поле значения»
 * @param mera — «мера»: «Может быть узел при разборе»
 * @return значение: список: «Поле значения»
 */
fl_status kompilyator_flang_s_meroy(fl_ctx *ctx, fl_value polya, fl_value mera, fl_value *result, fl_error *error);

/*
 * Функция flang «Тело функции».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param sborka — «сборка»: «Сборка функции»
 * @return значение: «Сборка функции»
 */
fl_status kompilyator_flang_telo_funkcii(fl_ctx *ctx, fl_value sborka, fl_value *result, fl_error *error);

/*
 * Функция flang «Обойти строки функции».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Хвостовой самовызов развёрнут в цикл: стек не растёт.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param sborka — «сборка»: «Сборка функции»
 * @return значение: «Сборка функции»
 */
fl_status kompilyator_flang_oboyti_stroki_funkcii(fl_ctx *ctx, fl_value sborka, fl_value *result, fl_error *error);

/*
 * Функция flang «С разборщиком».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param sborka — «сборка»: «Сборка функции»
 * @param r — «р»: «Разборщик»
 * @return значение: «Сборка функции»
 */
fl_status kompilyator_flang_s_razborschikom(fl_ctx *ctx, fl_value sborka, fl_value r, fl_value *result, fl_error *error);

/*
 * Функция flang «Строка функции».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param sborka — «сборка»: «Сборка функции»
 * @return значение: «Сборка функции»
 */
fl_status kompilyator_flang_stroka_funkcii(fl_ctx *ctx, fl_value sborka, fl_value *result, fl_error *error);

/*
 * Функция flang «Строка меры».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param sborka — «сборка»: «Сборка функции»
 * @return значение: «Сборка функции»
 */
fl_status kompilyator_flang_stroka_mery(fl_ctx *ctx, fl_value sborka, fl_value *result, fl_error *error);

/*
 * Функция flang «Строка тела».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param sborka — «сборка»: «Сборка функции»
 * @return значение: «Сборка функции»
 */
fl_status kompilyator_flang_stroka_tela(fl_ctx *ctx, fl_value sborka, fl_value *result, fl_error *error);

/*
 * Функция flang «Строка постусловия».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param sborka — «сборка»: «Сборка функции»
 * @return значение: «Сборка функции»
 */
fl_status kompilyator_flang_stroka_postusloviya(fl_ctx *ctx, fl_value sborka, fl_value *result, fl_error *error);

/*
 * Функция flang «Квантор постусловия».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param sborka — «сборка»: «Сборка функции»
 * @param r — «р»: «Разборщик»
 * @param nachalo — «начало»: «Токен»
 * @return значение: «Шаг текста»
 */
fl_status kompilyator_flang_kvantor_postusloviya(fl_ctx *ctx, fl_value sborka, fl_value r, fl_value nachalo, fl_value *result, fl_error *error);

/*
 * Функция flang «Строка параметров».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param sborka — «сборка»: «Сборка функции»
 * @return значение: «Сборка функции»
 */
fl_status kompilyator_flang_stroka_parametrov(fl_ctx *ctx, fl_value sborka, fl_value *result, fl_error *error);

/*
 * Функция flang «Обойти параметры».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Хвостовой самовызов развёрнут в цикл: стек не растёт.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param r — «р»: «Разборщик»
 * @param uzly — «узлы»: список: «Значение»
 * @return значение: «Шаг узлов»
 */
fl_status kompilyator_flang_oboyti_parametry(fl_ctx *ctx, fl_value r, fl_value uzly, fl_value *result, fl_error *error);

/*
 * Функция flang «Разобрать параметр».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param r — «р»: «Разборщик»
 * @return значение: «Шаг»
 */
fl_status kompilyator_flang_razobrat_parametr(fl_ctx *ctx, fl_value r, fl_value *result, fl_error *error);

/*
 * Функция flang «Разобрать пример».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param r — «р»: «Разборщик»
 * @return значение: «Шаг»
 */
fl_status kompilyator_flang_razobrat_primer(fl_ctx *ctx, fl_value r, fl_value *result, fl_error *error);

/*
 * Функция flang «Тело примера».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param sborka — «сборка»: «Сборка примера»
 * @return значение: «Сборка примера»
 */
fl_status kompilyator_flang_telo_primera(fl_ctx *ctx, fl_value sborka, fl_value *result, fl_error *error);

/*
 * Функция flang «Обойти строки примера».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Хвостовой самовызов развёрнут в цикл: стек не растёт.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param sborka — «сборка»: «Сборка примера»
 * @return значение: «Сборка примера»
 */
fl_status kompilyator_flang_oboyti_stroki_primera(fl_ctx *ctx, fl_value sborka, fl_value *result, fl_error *error);

/*
 * Функция flang «Строка примера».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param sborka — «сборка»: «Сборка примера»
 * @return значение: «Сборка примера»
 */
fl_status kompilyator_flang_stroka_primera(fl_ctx *ctx, fl_value sborka, fl_value *result, fl_error *error);

/*
 * Функция flang «Строка ожидания».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param sborka — «сборка»: «Сборка примера»
 * @param r — «р»: «Разборщик»
 * @return значение: «Сборка примера»
 */
fl_status kompilyator_flang_stroka_ozhidaniya(fl_ctx *ctx, fl_value sborka, fl_value r, fl_value *result, fl_error *error);

/*
 * Функция flang «Съесть любое сравнение».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param r — «р»: «Разборщик»
 * @return значение: «Разборщик»
 */
fl_status kompilyator_flang_sest_lyuboe_sravnenie(fl_ctx *ctx, fl_value r, fl_value *result, fl_error *error);

/*
 * Функция flang «Разобрать литеральное значение».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param r — «р»: «Разборщик»
 * @return значение: «Шаг»
 */
fl_status kompilyator_flang_razobrat_literalnoe_znachenie(fl_ctx *ctx, fl_value r, fl_value *result, fl_error *error);

/*
 * Функция flang «Свернуть литерал».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param r — «р»: «Разборщик»
 * @param uzel — «узел»: «Значение»
 * @param token — «токен»: «Токен»
 * @return значение: «Шаг»
 */
fl_status kompilyator_flang_svernut_literal(fl_ctx *ctx, fl_value r, fl_value uzel, fl_value token, fl_value *result, fl_error *error);

/*
 * Функция flang «Свернуть составной литерал».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param r — «р»: «Разборщик»
 * @param uzel — «узел»: «Значение»
 * @param token — «токен»: «Токен»
 * @param vid — «вид»: строка
 * @return значение: «Шаг»
 */
fl_status kompilyator_flang_svernut_sostavnoy_literal(fl_ctx *ctx, fl_value r, fl_value uzel, fl_value token, fl_value vid, fl_value *result, fl_error *error);

/*
 * Функция flang «Свернуть литералы».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Хвостовой самовызов развёрнут в цикл: стек не растёт.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param r — «р»: «Разборщик»
 * @param elementy — «элементы»: список: «Значение»
 * @param token — «токен»: «Токен»
 * @param uzly — «узлы»: список: «Значение»
 * @return значение: «Шаг узлов»
 */
fl_status kompilyator_flang_svernut_literaly(fl_ctx *ctx, fl_value r, fl_value elementy, fl_value token, fl_value uzly, fl_value *result, fl_error *error);

/*
 * Функция flang «Свернуть поля литерала».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Хвостовой самовызов развёрнут в цикл: стек не растёт.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param r — «р»: «Разборщик»
 * @param polya — «поля»: список: «Поле значения»
 * @param token — «токен»: «Токен»
 * @param perechen — «перечень»: список: «Поле значения»
 * @return значение: «Шаг полей»
 */
fl_status kompilyator_flang_svernut_polya_literala(fl_ctx *ctx, fl_value r, fl_value polya, fl_value token, fl_value perechen, fl_value *result, fl_error *error);

/*
 * Функция flang «Строка модуля».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param r — «р»: «Разборщик»
 * @param znachenie — «значение»: «Значение»
 * @return значение: «Шаг»
 */
fl_status kompilyator_flang_stroka_modulya(fl_ctx *ctx, fl_value r, fl_value znachenie, fl_value *result, fl_error *error);

/*
 * Функция flang «Строка экспорта».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param r — «р»: «Разборщик»
 * @param znachenie — «значение»: «Значение»
 * @return значение: «Шаг»
 */
fl_status kompilyator_flang_stroka_eksporta(fl_ctx *ctx, fl_value r, fl_value znachenie, fl_value *result, fl_error *error);

/*
 * Функция flang «Соединить узлы».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param pervye — «первые»: список: «Значение»
 * @param vtorye — «вторые»: список: «Значение»
 * @return значение: список: «Значение»
 */
fl_status kompilyator_flang_soedinit_uzly(fl_ctx *ctx, fl_value pervye, fl_value vtorye, fl_value *result, fl_error *error);

/*
 * Функция flang «Обойти имена через запятую».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Хвостовой самовызов развёрнут в цикл: стек не растёт.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param r — «р»: «Разборщик»
 * @param uzly — «узлы»: список: «Значение»
 * @param soobschenie — «сообщение»: строка
 * @return значение: «Шаг узлов»
 */
fl_status kompilyator_flang_oboyti_imena_cherez_zapyatuyu(fl_ctx *ctx, fl_value r, fl_value uzly, fl_value soobschenie, fl_value *result, fl_error *error);

/*
 * Функция flang «Строка импорта».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param r — «р»: «Разборщик»
 * @param znachenie — «значение»: «Значение»
 * @return значение: «Шаг»
 */
fl_status kompilyator_flang_stroka_importa(fl_ctx *ctx, fl_value r, fl_value znachenie, fl_value *result, fl_error *error);

/*
 * Функция flang «Дописать импорт».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param r — «р»: «Разборщик»
 * @param znachenie — «значение»: «Значение»
 * @param zapis — «запись»: «Значение»
 * @return значение: «Шаг»
 */
fl_status kompilyator_flang_dopisat_import(fl_ctx *ctx, fl_value r, fl_value znachenie, fl_value zapis, fl_value *result, fl_error *error);

/*
 * Функция flang «Обойти строки модуля».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Хвостовой самовызов развёрнут в цикл: стек не растёт.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param r — «р»: «Разборщик»
 * @param znachenie — «значение»: «Значение»
 * @return значение: «Шаг»
 */
fl_status kompilyator_flang_oboyti_stroki_modulya(fl_ctx *ctx, fl_value r, fl_value znachenie, fl_value *result, fl_error *error);

/*
 * Функция flang «Разобрать заголовок модуля».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param r — «р»: «Разборщик»
 * @return значение: «Разборщик»
 */
fl_status kompilyator_flang_razobrat_zagolovok_modulya(fl_ctx *ctx, fl_value r, fl_value *result, fl_error *error);

/*
 * Функция flang «Тело заголовка модуля».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param r — «р»: «Разборщик»
 * @param znachenie — «значение»: «Значение»
 * @return значение: «Шаг»
 */
fl_status kompilyator_flang_telo_zagolovka_modulya(fl_ctx *ctx, fl_value r, fl_value znachenie, fl_value *result, fl_error *error);

/*
 * Функция flang «Шаг поиска заголовка».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param akk — «акк»: «Поиск заголовка»
 * @param uzel — «узел»: «Значение»
 * @return значение: «Поиск заголовка»
 */
fl_status kompilyator_flang_shag_poiska_zagolovka(fl_ctx *ctx, fl_value akk, fl_value uzel, fl_value *result, fl_error *error);

/*
 * Функция flang «Номер последнего заголовка».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param nasledie — «наследие»: список: «Значение»
 * @return значение: число
 */
fl_status kompilyator_flang_nomer_poslednego_zagolovka(fl_ctx *ctx, fl_value nasledie, fl_value *result, fl_error *error);

/*
 * Функция flang «Шаг выбора при разборе».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param akk — «акк»: «Выбор узла»
 * @param uzel — «узел»: «Значение»
 * @param mesto — «место»: число
 * @return значение: «Выбор узла»
 */
fl_status kompilyator_flang_shag_vybora_pri_razbore(fl_ctx *ctx, fl_value akk, fl_value uzel, fl_value mesto, fl_value *result, fl_error *error);

/*
 * Функция flang «Узел по номеру».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param uzly — «узлы»: список: «Значение»
 * @param mesto — «место»: число
 * @return значение: «Значение»
 */
fl_status kompilyator_flang_uzel_po_nomeru(fl_ctx *ctx, fl_value uzly, fl_value mesto, fl_value *result, fl_error *error);

/*
 * Функция flang «Шаг замены».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param akk — «акк»: «Замена узла»
 * @param uzel — «узел»: «Значение»
 * @param mesto — «место»: число
 * @param novoe — «новое»: «Значение»
 * @return значение: «Замена узла»
 */
fl_status kompilyator_flang_shag_zameny(fl_ctx *ctx, fl_value akk, fl_value uzel, fl_value mesto, fl_value novoe, fl_value *result, fl_error *error);

/*
 * Функция flang «Заменить по номеру».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param uzly — «узлы»: список: «Значение»
 * @param mesto — «место»: число
 * @param novoe — «новое»: «Значение»
 * @return значение: список: «Значение»
 */
fl_status kompilyator_flang_zamenit_po_nomeru(fl_ctx *ctx, fl_value uzly, fl_value mesto, fl_value novoe, fl_value *result, fl_error *error);

/*
 * Функция flang «Разобрать вольную строку модуля».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param r — «р»: «Разборщик»
 * @return значение: «Разборщик»
 */
fl_status kompilyator_flang_razobrat_volnuyu_stroku_modulya(fl_ctx *ctx, fl_value r, fl_value *result, fl_error *error);

/*
 * Функция flang «Дописать в заголовок».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param r — «р»: «Разборщик»
 * @param mesto — «место»: число
 * @return значение: «Разборщик»
 */
fl_status kompilyator_flang_dopisat_v_zagolovok(fl_ctx *ctx, fl_value r, fl_value mesto, fl_value *result, fl_error *error);

/*
 * Функция flang «Разобрать категорию».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param r — «р»: «Разборщик»
 * @return значение: «Разборщик»
 */
fl_status kompilyator_flang_razobrat_kategoriyu(fl_ctx *ctx, fl_value r, fl_value *result, fl_error *error);

/*
 * Функция flang «Разобрать объявления».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Хвостовой самовызов развёрнут в цикл: стек не растёт.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param r — «р»: «Разборщик»
 * @return значение: «Разборщик»
 */
fl_status kompilyator_flang_razobrat_obyavleniya(fl_ctx *ctx, fl_value r, fl_value *result, fl_error *error);

/*
 * Функция flang «Разобрать объявление».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param r — «р»: «Разборщик»
 * @return значение: «Разборщик»
 */
fl_status kompilyator_flang_razobrat_obyavlenie(fl_ctx *ctx, fl_value r, fl_value *result, fl_error *error);

/*
 * Функция flang «Объявление по слову».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param r — «р»: «Разборщик»
 * @param identifikator — «идентификатор»: строка
 * @return значение: «Разборщик»
 */
fl_status kompilyator_flang_obyavlenie_po_slovu(fl_ctx *ctx, fl_value r, fl_value identifikator, fl_value *result, fl_error *error);

/*
 * Функция flang «Объявление типом».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param r — «р»: «Разборщик»
 * @param identifikator — «идентификатор»: строка
 * @return значение: «Разборщик»
 */
fl_status kompilyator_flang_obyavlenie_tipom(fl_ctx *ctx, fl_value r, fl_value identifikator, fl_value *result, fl_error *error);

/*
 * Функция flang «Объявление наследием».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param r — «р»: «Разборщик»
 * @param identifikator — «идентификатор»: строка
 * @return значение: «Разборщик»
 */
fl_status kompilyator_flang_obyavlenie_naslediem(fl_ctx *ctx, fl_value r, fl_value identifikator, fl_value *result, fl_error *error);

/*
 * Функция flang «Объявление теорката».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param r — «р»: «Разборщик»
 * @param identifikator — «идентификатор»: строка
 * @return значение: «Разборщик»
 */
fl_status kompilyator_flang_obyavlenie_teorkata(fl_ctx *ctx, fl_value r, fl_value identifikator, fl_value *result, fl_error *error);

/*
 * Функция flang «Объявление стрелкой».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param r — «р»: «Разборщик»
 * @param identifikator — «идентификатор»: строка
 * @return значение: «Разборщик»
 */
fl_status kompilyator_flang_obyavlenie_strelkoy(fl_ctx *ctx, fl_value r, fl_value identifikator, fl_value *result, fl_error *error);

/*
 * Функция flang «Объявление парой».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param r — «р»: «Разборщик»
 * @param identifikator — «идентификатор»: строка
 * @return значение: «Разборщик»
 */
fl_status kompilyator_flang_obyavlenie_paroy(fl_ctx *ctx, fl_value r, fl_value identifikator, fl_value *result, fl_error *error);

/*
 * Функция flang «Разобрать единицу».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param r — «р»: «Разборщик»
 * @return значение: «Шаг»
 */
fl_status kompilyator_flang_razobrat_edinicu(fl_ctx *ctx, fl_value r, fl_value *result, fl_error *error);

/*
 * Функция flang «Разобрать пересечение».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param r — «р»: «Разборщик»
 * @return значение: «Шаг»
 */
fl_status kompilyator_flang_razobrat_peresechenie(fl_ctx *ctx, fl_value r, fl_value *result, fl_error *error);

/*
 * Функция flang «Разобрать вложение».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param r — «р»: «Разборщик»
 * @return значение: «Шаг»
 */
fl_status kompilyator_flang_razobrat_vlozhenie(fl_ctx *ctx, fl_value r, fl_value *result, fl_error *error);

/*
 * Функция flang «Разобрать изоморфизм».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param r — «р»: «Разборщик»
 * @return значение: «Шаг»
 */
fl_status kompilyator_flang_razobrat_izomorfizm(fl_ctx *ctx, fl_value r, fl_value *result, fl_error *error);

/*
 * Функция flang «Тело изоморфизма».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param sborka — «сборка»: «Сборка утилиты»
 * @param imya — «имя»: строка
 * @return значение: «Сборка утилиты»
 */
fl_status kompilyator_flang_telo_izomorfizma(fl_ctx *ctx, fl_value sborka, fl_value imya, fl_value *result, fl_error *error);

/*
 * Функция flang «Обойти строки изоморфизма».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Хвостовой самовызов развёрнут в цикл: стек не растёт.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param sborka — «сборка»: «Сборка утилиты»
 * @param imya — «имя»: строка
 * @return значение: «Сборка утилиты»
 */
fl_status kompilyator_flang_oboyti_stroki_izomorfizma(fl_ctx *ctx, fl_value sborka, fl_value imya, fl_value *result, fl_error *error);

/*
 * Функция flang «Строка изоморфизма».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param sborka — «сборка»: «Сборка утилиты»
 * @param imya — «имя»: строка
 * @return значение: «Сборка утилиты»
 */
fl_status kompilyator_flang_stroka_izomorfizma(fl_ctx *ctx, fl_value sborka, fl_value imya, fl_value *result, fl_error *error);

/*
 * Функция flang «Строка обратного морфизма».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param sborka — «сборка»: «Сборка утилиты»
 * @param r — «р»: «Разборщик»
 * @param imya — «имя»: строка
 * @param token — «токен»: «Токен»
 * @return значение: «Сборка утилиты»
 */
fl_status kompilyator_flang_stroka_obratnogo_morfizma(fl_ctx *ctx, fl_value sborka, fl_value r, fl_value imya, fl_value token, fl_value *result, fl_error *error);

/*
 * Функция flang «Разобрать бифунктор».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param r — «р»: «Разборщик»
 * @return значение: «Шаг»
 */
fl_status kompilyator_flang_razobrat_bifunktor(fl_ctx *ctx, fl_value r, fl_value *result, fl_error *error);

/*
 * Функция flang «Тело бифунктора».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param sborka — «сборка»: «Сборка утилиты»
 * @return значение: «Сборка утилиты»
 */
fl_status kompilyator_flang_telo_bifunktora(fl_ctx *ctx, fl_value sborka, fl_value *result, fl_error *error);

/*
 * Функция flang «Обойти строки бифунктора».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Хвостовой самовызов развёрнут в цикл: стек не растёт.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param sborka — «сборка»: «Сборка утилиты»
 * @return значение: «Сборка утилиты»
 */
fl_status kompilyator_flang_oboyti_stroki_bifunktora(fl_ctx *ctx, fl_value sborka, fl_value *result, fl_error *error);

/*
 * Функция flang «Строка бифунктора».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param sborka — «сборка»: «Сборка утилиты»
 * @return значение: «Сборка утилиты»
 */
fl_status kompilyator_flang_stroka_bifunktora(fl_ctx *ctx, fl_value sborka, fl_value *result, fl_error *error);

/*
 * Функция flang «Строка пары морфизмов».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param sborka — «сборка»: «Сборка утилиты»
 * @param r — «р»: «Разборщик»
 * @return значение: «Сборка утилиты»
 */
fl_status kompilyator_flang_stroka_pary_morfizmov(fl_ctx *ctx, fl_value sborka, fl_value r, fl_value *result, fl_error *error);

/*
 * Функция flang «Пара бифунктора».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param sborka — «сборка»: «Сборка утилиты»
 * @param r — «р»: «Разборщик»
 * @param klyuch — «ключ»: строка
 * @param beda_pervogo — «беда первого»: строка
 * @param beda_i — «беда и»: строка
 * @param beda_vtorogo — «беда второго»: строка
 * @param slovo — «слово»: строка
 * @param beda_slova — «беда слова»: строка
 * @param beda_obraza — «беда образа»: строка
 * @return значение: «Сборка утилиты»
 */
fl_status kompilyator_flang_para_bifunktora(fl_ctx *ctx, fl_value sborka, fl_value r, fl_value klyuch, fl_value beda_pervogo, fl_value beda_i, fl_value beda_vtorogo, fl_value slovo, fl_value beda_slova, fl_value beda_obraza, fl_value *result, fl_error *error);

/*
 * Функция flang «Звено цепочки».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param sborka — «сборка»: «Сборка звеньев»
 * @param shag — «шаг»: строка
 * @param imya — «имя»: строка
 * @param vsego — «всего»: число
 * @param mesto — «место»: «Значение»
 * @return значение: «Сборка звеньев»
 */
fl_status kompilyator_flang_zveno_cepochki(fl_ctx *ctx, fl_value sborka, fl_value shag, fl_value imya, fl_value vsego, fl_value mesto, fl_value *result, fl_error *error);

/*
 * Функция flang «Развернуть цепочку».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param shagi — «шаги»: список: строка
 * @param imya — «имя»: строка
 * @param mesto — «место»: «Значение»
 * @return значение: список: «Значение»
 */
fl_status kompilyator_flang_razvernut_cepochku(fl_ctx *ctx, fl_value shagi, fl_value imya, fl_value mesto, fl_value *result, fl_error *error);

/*
 * Функция flang «Разобрать цепочку».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param r — «р»: «Разборщик»
 * @return значение: «Шаг узлов»
 */
fl_status kompilyator_flang_razobrat_cepochku(fl_ctx *ctx, fl_value r, fl_value *result, fl_error *error);

/*
 * Функция flang «Тело цепочки».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param sborka — «сборка»: «Сборка цепочки»
 * @param nachalo — «начало»: «Токен»
 * @return значение: «Сборка цепочки»
 */
fl_status kompilyator_flang_telo_cepochki(fl_ctx *ctx, fl_value sborka, fl_value nachalo, fl_value *result, fl_error *error);

/*
 * Функция flang «Обойти строки цепочки».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Хвостовой самовызов развёрнут в цикл: стек не растёт.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param sborka — «сборка»: «Сборка цепочки»
 * @param nachalo — «начало»: «Токен»
 * @return значение: «Сборка цепочки»
 */
fl_status kompilyator_flang_oboyti_stroki_cepochki(fl_ctx *ctx, fl_value sborka, fl_value nachalo, fl_value *result, fl_error *error);

/*
 * Функция flang «Строка цепочки».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param sborka — «сборка»: «Сборка цепочки»
 * @param nachalo — «начало»: «Токен»
 * @return значение: «Сборка цепочки»
 */
fl_status kompilyator_flang_stroka_cepochki(fl_ctx *ctx, fl_value sborka, fl_value nachalo, fl_value *result, fl_error *error);

/*
 * Функция flang «Строка затем».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param sborka — «сборка»: «Сборка цепочки»
 * @param r — «р»: «Разборщик»
 * @param nachalo — «начало»: «Токен»
 * @return значение: «Сборка цепочки»
 */
fl_status kompilyator_flang_stroka_zatem(fl_ctx *ctx, fl_value sborka, fl_value r, fl_value nachalo, fl_value *result, fl_error *error);

/*
 * Функция flang «Не решено ли».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param itog — «итог»: «Поиск скобки»
 * @return значение
 */
fl_status kompilyator_flang_ne_resheno_li(fl_ctx *ctx, fl_value itog, fl_value *result, fl_error *error);

/*
 * Функция flang «Есть скобка».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param itog — «итог»: «Поиск скобки»
 * @return значение
 */
fl_status kompilyator_flang_est_skobka(fl_ctx *ctx, fl_value itog, fl_value *result, fl_error *error);

/*
 * Функция flang «Скобка в токене».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param token — «токен»: «Токен»
 * @return значение: «Поиск скобки»
 */
fl_status kompilyator_flang_skobka_v_tokene(fl_ctx *ctx, fl_value token, fl_value *result, fl_error *error);

/*
 * Функция flang «Скобка в списке».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * Хвостовой самовызов развёрнут в цикл: стек не растёт.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param tokeny — «токены»: список: «Токен»
 * @return значение: «Поиск скобки»
 */
fl_status kompilyator_flang_skobka_v_spiske(fl_ctx *ctx, fl_value tokeny, fl_value *result, fl_error *error);

/*
 * Функция flang «Скобка в пачках».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * Хвостовой самовызов развёрнут в цикл: стек не растёт.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param kuski — «куски»: список: «Пачка»
 * @return значение: «Поиск скобки»
 */
fl_status kompilyator_flang_skobka_v_pachkah(fl_ctx *ctx, fl_value kuski, fl_value *result, fl_error *error);

/*
 * Функция flang «Скобка дальше».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param pervoe — «первое»: «Поиск скобки»
 * @param vtoroe — «второе»: «Поиск скобки»
 * @return значение: «Поиск скобки»
 */
fl_status kompilyator_flang_skobka_dalshe(fl_ctx *ctx, fl_value pervoe, fl_value vtoroe, fl_value *result, fl_error *error);

/*
 * Функция flang «Похоже на скобки».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param r — «р»: «Разборщик»
 * @return значение
 */
fl_status kompilyator_flang_pohozhe_na_skobki(fl_ctx *ctx, fl_value r, fl_value *result, fl_error *error);

/*
 * Функция flang «Переписать свободное».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param perechen — «перечень»: список: «Поле значения»
 * @param imena — «имена»: список: строка
 * @return значение: «Значение»
 */
fl_status kompilyator_flang_perepisat_svobodnoe(fl_ctx *ctx, fl_value perechen, fl_value imena, fl_value *result, fl_error *error);

/*
 * Функция flang «Связать вызовы».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param uzel — «узел»: «Значение»
 * @param imena — «имена»: список: строка
 * @return значение: «Значение»
 */
fl_status kompilyator_flang_svyazat_vyzovy(fl_ctx *ctx, fl_value uzel, fl_value imena, fl_value *result, fl_error *error);

/*
 * Функция flang «Диагностики разборщика».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param r — «р»: «Разборщик»
 * @return значение: список: «Диагностика»
 */
fl_status kompilyator_flang_diagnostiki_razborschika(fl_ctx *ctx, fl_value r, fl_value *result, fl_error *error);

/*
 * Функция flang «Разобрать документ».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param r — «р»: «Разборщик»
 * @return значение: «Разборщик»
 */
fl_status kompilyator_flang_razobrat_dokument(fl_ctx *ctx, fl_value r, fl_value *result, fl_error *error);

/*
 * Функция flang «Ключи до наследия».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @return значение: список: строка
 */
fl_status kompilyator_flang_klyuchi_do_naslediya(fl_ctx *ctx, fl_value *result, fl_error *error);

/*
 * Функция flang «Узлы по ключу».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param prochie — «прочие»: список: «Объявление разбора»
 * @param klyuch — «ключ»: строка
 * @param imena — «имена»: список: строка
 * @return значение: список: «Значение»
 */
fl_status kompilyator_flang_uzly_po_klyuchu(fl_ctx *ctx, fl_value prochie, fl_value klyuch, fl_value imena, fl_value *result, fl_error *error);

/*
 * Функция flang «Поле если непусто».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param polya — «поля»: список: «Поле значения»
 * @param klyuch — «ключ»: строка
 * @param uzly — «узлы»: список: «Значение»
 * @return значение: список: «Поле значения»
 */
fl_status kompilyator_flang_pole_esli_nepusto(fl_ctx *ctx, fl_value polya, fl_value klyuch, fl_value uzly, fl_value *result, fl_error *error);

/*
 * Функция flang «Поля объявлений».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param polya — «поля»: список: «Поле значения»
 * @param prochie — «прочие»: список: «Объявление разбора»
 * @param klyuchi — «ключи»: список: строка
 * @param imena — «имена»: список: строка
 * @return значение: список: «Поле значения»
 */
fl_status kompilyator_flang_polya_obyavleniy(fl_ctx *ctx, fl_value polya, fl_value prochie, fl_value klyuchi, fl_value imena, fl_value *result, fl_error *error);

/*
 * Функция flang «Разбор токенов».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param tokeny — «токены»: список: «Токен»
 * @param vneshnie — «внешние»: список: строка
 * @return значение: «Итог разбора»
 */
fl_status kompilyator_flang_razbor_tokenov(fl_ctx *ctx, fl_value tokeny, fl_value vneshnie, fl_value *result, fl_error *error);

/*
 * Функция flang «Разбор исходника».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param ishodnik — «исходник»: строка
 * @param vneshnie — «внешние»: список: строка
 * @return значение: «Итог разбора»
 */
fl_status kompilyator_flang_razbor_ishodnika(fl_ctx *ctx, fl_value ishodnik, fl_value vneshnie, fl_value *result, fl_error *error);

/*
 * Функция flang «Разобрать программу».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param ishodnik — «исходник»: строка
 * @return значение: «Значение»
 */
fl_status kompilyator_flang_razobrat_programmu(fl_ctx *ctx, fl_value ishodnik, fl_value *result, fl_error *error);

/*
 * Функция flang «Печать разбора исходника».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param ishodnik — «исходник»: строка
 * @return значение: строка
 */
fl_status kompilyator_flang_pechat_razbora_ishodnika(fl_ctx *ctx, fl_value ishodnik, fl_value *result, fl_error *error);

/*
 * Функция flang «Диагностики разбора».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param ishodnik — «исходник»: строка
 * @return значение: список: «Диагностика»
 */
fl_status kompilyator_flang_diagnostiki_razbora(fl_ctx *ctx, fl_value ishodnik, fl_value *result, fl_error *error);

/*
 * Функция flang «Коды разбора».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param ishodnik — «исходник»: строка
 * @return значение: список: строка
 */
fl_status kompilyator_flang_kody_razbora(fl_ctx *ctx, fl_value ishodnik, fl_value *result, fl_error *error);

/*
 * Функция flang «Это слово 1».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param r — «р»: «Разборщик»
 * @param identifikator — «идентификатор»: строка
 * @return значение
 */
fl_status kompilyator_flang_eto_slovo_1(fl_ctx *ctx, fl_value r, fl_value identifikator, fl_value *result, fl_error *error);

/*
 * Функция flang «Текст или значение».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param token — «токен»: «Токен»
 * @return значение: строка
 */
fl_status kompilyator_flang_tekst_ili_znachenie(fl_ctx *ctx, fl_value token, fl_value *result, fl_error *error);

/*
 * Функция flang «Ждать сравнение».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param r — «р»: «Разборщик»
 * @param identifikator — «идентификатор»: строка
 * @param soobschenie — «сообщение»: строка
 * @return значение: «Разборщик»
 */
fl_status kompilyator_flang_zhdat_sravnenie(fl_ctx *ctx, fl_value r, fl_value identifikator, fl_value soobschenie, fl_value *result, fl_error *error);

/*
 * Функция flang «Ждать любое сравнение».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param r — «р»: «Разборщик»
 * @return значение: «Шаг текста»
 */
fl_status kompilyator_flang_zhdat_lyuboe_sravnenie(fl_ctx *ctx, fl_value r, fl_value *result, fl_error *error);

/*
 * Функция flang «Разобрать скаляр».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param r — «р»: «Разборщик»
 * @return значение: «Шаг»
 */
fl_status kompilyator_flang_razobrat_skalyar(fl_ctx *ctx, fl_value r, fl_value *result, fl_error *error);

/*
 * Функция flang «Разобрать имя типа FTS».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param r — «р»: «Разборщик»
 * @return значение: «Шаг текста»
 */
fl_status kompilyator_flang_razobrat_imya_tipa_fts(fl_ctx *ctx, fl_value r, fl_value *result, fl_error *error);

/*
 * Функция flang «Разобрать операнд».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param r — «р»: «Разборщик»
 * @return значение: «Шаг»
 */
fl_status kompilyator_flang_razobrat_operand(fl_ctx *ctx, fl_value r, fl_value *result, fl_error *error);

/*
 * Функция flang «Операнд процентом».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param r — «р»: «Разборщик»
 * @return значение: «Шаг»
 */
fl_status kompilyator_flang_operand_procentom(fl_ctx *ctx, fl_value r, fl_value *result, fl_error *error);

/*
 * Функция flang «Операнд полем».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param r — «р»: «Разборщик»
 * @return значение: «Шаг»
 */
fl_status kompilyator_flang_operand_polem(fl_ctx *ctx, fl_value r, fl_value *result, fl_error *error);

/*
 * Функция flang «Разобрать условие правила».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param r — «р»: «Разборщик»
 * @return значение: «Шаг»
 */
fl_status kompilyator_flang_razobrat_uslovie_pravila(fl_ctx *ctx, fl_value r, fl_value *result, fl_error *error);

/*
 * Функция flang «Разобрать правило».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param r — «р»: «Разборщик»
 * @return значение: «Шаг»
 */
fl_status kompilyator_flang_razobrat_pravilo(fl_ctx *ctx, fl_value r, fl_value *result, fl_error *error);

/*
 * Функция flang «Тело правила».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param sborka — «сборка»: «Сборка правила»
 * @return значение: «Сборка правила»
 */
fl_status kompilyator_flang_telo_pravila(fl_ctx *ctx, fl_value sborka, fl_value *result, fl_error *error);

/*
 * Функция flang «Обойти строки правила».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Хвостовой самовызов развёрнут в цикл: стек не растёт.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param sborka — «сборка»: «Сборка правила»
 * @return значение: «Сборка правила»
 */
fl_status kompilyator_flang_oboyti_stroki_pravila(fl_ctx *ctx, fl_value sborka, fl_value *result, fl_error *error);

/*
 * Функция flang «Строка правила».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param sborka — «сборка»: «Сборка правила»
 * @return значение: «Сборка правила»
 */
fl_status kompilyator_flang_stroka_pravila(fl_ctx *ctx, fl_value sborka, fl_value *result, fl_error *error);

/*
 * Функция flang «Строка действия».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param sborka — «сборка»: «Сборка правила»
 * @param r — «р»: «Разборщик»
 * @return значение: «Сборка правила»
 */
fl_status kompilyator_flang_stroka_deystviya(fl_ctx *ctx, fl_value sborka, fl_value r, fl_value *result, fl_error *error);

/*
 * Функция flang «Разобрать действие».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param sborka — «сборка»: «Сборка правила»
 * @param r — «р»: «Разборщик»
 * @return значение: «Сборка правила»
 */
fl_status kompilyator_flang_razobrat_deystvie(fl_ctx *ctx, fl_value sborka, fl_value r, fl_value *result, fl_error *error);

/*
 * Функция flang «Разобрать свойство».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param r — «р»: «Разборщик»
 * @return значение: «Шаг»
 */
fl_status kompilyator_flang_razobrat_svoystvo(fl_ctx *ctx, fl_value r, fl_value *result, fl_error *error);

/*
 * Функция flang «Тело свойства».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param sborka — «сборка»: «Сборка свойства»
 * @param soobschenie — «сообщение»: строка
 * @return значение: «Сборка свойства»
 */
fl_status kompilyator_flang_telo_svoystva(fl_ctx *ctx, fl_value sborka, fl_value soobschenie, fl_value *result, fl_error *error);

/*
 * Функция flang «Обойти строки свойства».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Хвостовой самовызов развёрнут в цикл: стек не растёт.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param sborka — «сборка»: «Сборка свойства»
 * @param soobschenie — «сообщение»: строка
 * @return значение: «Сборка свойства»
 */
fl_status kompilyator_flang_oboyti_stroki_svoystva(fl_ctx *ctx, fl_value sborka, fl_value soobschenie, fl_value *result, fl_error *error);

/*
 * Функция flang «Строка свойства».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param sborka — «сборка»: «Сборка свойства»
 * @param soobschenie — «сообщение»: строка
 * @return значение: «Сборка свойства»
 */
fl_status kompilyator_flang_stroka_svoystva(fl_ctx *ctx, fl_value sborka, fl_value soobschenie, fl_value *result, fl_error *error);

/*
 * Функция flang «Разобрать пример утилиты».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param r — «р»: «Разборщик»
 * @return значение: «Шаг»
 */
fl_status kompilyator_flang_razobrat_primer_utility(fl_ctx *ctx, fl_value r, fl_value *result, fl_error *error);

/*
 * Функция flang «Тело примера утилиты».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param sborka — «сборка»: «Сборка примера утилиты»
 * @return значение: «Сборка примера утилиты»
 */
fl_status kompilyator_flang_telo_primera_utility(fl_ctx *ctx, fl_value sborka, fl_value *result, fl_error *error);

/*
 * Функция flang «Обойти строки примера утилиты».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Хвостовой самовызов развёрнут в цикл: стек не растёт.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param sborka — «сборка»: «Сборка примера утилиты»
 * @return значение: «Сборка примера утилиты»
 */
fl_status kompilyator_flang_oboyti_stroki_primera_utility(fl_ctx *ctx, fl_value sborka, fl_value *result, fl_error *error);

/*
 * Функция flang «Строка примера утилиты».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param sborka — «сборка»: «Сборка примера утилиты»
 * @return значение: «Сборка примера утилиты»
 */
fl_status kompilyator_flang_stroka_primera_utility(fl_ctx *ctx, fl_value sborka, fl_value *result, fl_error *error);

/*
 * Функция flang «Строка ожидания утилиты».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param sborka — «сборка»: «Сборка примера утилиты»
 * @param r — «р»: «Разборщик»
 * @return значение: «Сборка примера утилиты»
 */
fl_status kompilyator_flang_stroka_ozhidaniya_utility(fl_ctx *ctx, fl_value sborka, fl_value r, fl_value *result, fl_error *error);

/*
 * Функция flang «Разобрать утилиту».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param r — «р»: «Разборщик»
 * @return значение: «Шаг»
 */
fl_status kompilyator_flang_razobrat_utilitu(fl_ctx *ctx, fl_value r, fl_value *result, fl_error *error);

/*
 * Функция flang «Тело утилиты».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param sborka — «сборка»: «Сборка утилиты»
 * @return значение: «Сборка утилиты»
 */
fl_status kompilyator_flang_telo_utility(fl_ctx *ctx, fl_value sborka, fl_value *result, fl_error *error);

/*
 * Функция flang «Обойти строки утилиты».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Хвостовой самовызов развёрнут в цикл: стек не растёт.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param sborka — «сборка»: «Сборка утилиты»
 * @return значение: «Сборка утилиты»
 */
fl_status kompilyator_flang_oboyti_stroki_utility(fl_ctx *ctx, fl_value sborka, fl_value *result, fl_error *error);

/*
 * Функция flang «Строка утилиты».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param sborka — «сборка»: «Сборка утилиты»
 * @return значение: «Сборка утилиты»
 */
fl_status kompilyator_flang_stroka_utility(fl_ctx *ctx, fl_value sborka, fl_value *result, fl_error *error);

/*
 * Функция flang «Строка возврата утилиты».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param sborka — «сборка»: «Сборка утилиты»
 * @param r — «р»: «Разборщик»
 * @return значение: «Сборка утилиты»
 */
fl_status kompilyator_flang_stroka_vozvrata_utility(fl_ctx *ctx, fl_value sborka, fl_value r, fl_value *result, fl_error *error);

/*
 * Функция flang «Строка начального».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param sborka — «сборка»: «Сборка утилиты»
 * @param r — «р»: «Разборщик»
 * @return значение: «Сборка утилиты»
 */
fl_status kompilyator_flang_stroka_nachalnogo(fl_ctx *ctx, fl_value sborka, fl_value r, fl_value *result, fl_error *error);

/*
 * Функция flang «Дописать в список узла».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param znachenie — «значение»: «Значение»
 * @param klyuch — «ключ»: строка
 * @param uzel — «узел»: «Значение»
 * @return значение: «Значение»
 */
fl_status kompilyator_flang_dopisat_v_spisok_uzla(fl_ctx *ctx, fl_value znachenie, fl_value klyuch, fl_value uzel, fl_value *result, fl_error *error);

/*
 * Функция flang «Строка правила утилиты».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param sborka — «сборка»: «Сборка утилиты»
 * @param r — «р»: «Разборщик»
 * @return значение: «Сборка утилиты»
 */
fl_status kompilyator_flang_stroka_pravila_utility(fl_ctx *ctx, fl_value sborka, fl_value r, fl_value *result, fl_error *error);

/*
 * Функция flang «Разобрать морфизм».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param r — «р»: «Разборщик»
 * @return значение: «Шаг»
 */
fl_status kompilyator_flang_razobrat_morfizm(fl_ctx *ctx, fl_value r, fl_value *result, fl_error *error);

/*
 * Функция flang «Разобрать композицию».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param r — «р»: «Разборщик»
 * @param imya — «имя»: строка
 * @param nachalo — «начало»: «Токен»
 * @return значение: «Шаг»
 */
fl_status kompilyator_flang_razobrat_kompoziciyu(fl_ctx *ctx, fl_value r, fl_value imya, fl_value nachalo, fl_value *result, fl_error *error);

/*
 * Функция flang «Разобрать стрелку».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param r — «р»: «Разборщик»
 * @param imya — «имя»: строка
 * @param nachalo — «начало»: «Токен»
 * @return значение: «Шаг»
 */
fl_status kompilyator_flang_razobrat_strelku(fl_ctx *ctx, fl_value r, fl_value imya, fl_value nachalo, fl_value *result, fl_error *error);

/*
 * Функция flang «Тело стрелки».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param sborka — «сборка»: «Сборка стрелки»
 * @param imya — «имя»: строка
 * @param nachalo — «начало»: «Токен»
 * @return значение: «Сборка стрелки»
 */
fl_status kompilyator_flang_telo_strelki(fl_ctx *ctx, fl_value sborka, fl_value imya, fl_value nachalo, fl_value *result, fl_error *error);

/*
 * Функция flang «Обойти строки стрелки».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Хвостовой самовызов развёрнут в цикл: стек не растёт.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param sborka — «сборка»: «Сборка стрелки»
 * @param imya — «имя»: строка
 * @param nachalo — «начало»: «Токен»
 * @return значение: «Сборка стрелки»
 */
fl_status kompilyator_flang_oboyti_stroki_strelki(fl_ctx *ctx, fl_value sborka, fl_value imya, fl_value nachalo, fl_value *result, fl_error *error);

/*
 * Функция flang «Строка стрелки».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param sborka — «сборка»: «Сборка стрелки»
 * @param imya — «имя»: строка
 * @param nachalo — «начало»: «Токен»
 * @return значение: «Сборка стрелки»
 */
fl_status kompilyator_flang_stroka_strelki(fl_ctx *ctx, fl_value sborka, fl_value imya, fl_value nachalo, fl_value *result, fl_error *error);

/*
 * Функция flang «Строка закона стрелки».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param sborka — «сборка»: «Сборка стрелки»
 * @param r — «р»: «Разборщик»
 * @return значение: «Сборка стрелки»
 */
fl_status kompilyator_flang_stroka_zakona_strelki(fl_ctx *ctx, fl_value sborka, fl_value r, fl_value *result, fl_error *error);

/*
 * Функция flang «Разобрать закон стрелки».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param r — «р»: «Разборщик»
 * @return значение: «Шаг»
 */
fl_status kompilyator_flang_razobrat_zakon_strelki(fl_ctx *ctx, fl_value r, fl_value *result, fl_error *error);

/*
 * Функция flang «Тело закона стрелки».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param sborka — «сборка»: «Сборка закона»
 * @return значение: «Сборка закона»
 */
fl_status kompilyator_flang_telo_zakona_strelki(fl_ctx *ctx, fl_value sborka, fl_value *result, fl_error *error);

/*
 * Функция flang «Обойти строки закона стрелки».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Хвостовой самовызов развёрнут в цикл: стек не растёт.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param sborka — «сборка»: «Сборка закона»
 * @return значение: «Сборка закона»
 */
fl_status kompilyator_flang_oboyti_stroki_zakona_strelki(fl_ctx *ctx, fl_value sborka, fl_value *result, fl_error *error);

/*
 * Функция flang «Строка примера закона».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param sborka — «сборка»: «Сборка закона»
 * @return значение: «Сборка закона»
 */
fl_status kompilyator_flang_stroka_primera_zakona(fl_ctx *ctx, fl_value sborka, fl_value *result, fl_error *error);

/*
 * Функция flang «Разобрать морфизм наследия».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param r — «р»: «Разборщик»
 * @param imya — «имя»: строка
 * @param nachalo — «начало»: «Токен»
 * @return значение: «Шаг»
 */
fl_status kompilyator_flang_razobrat_morfizm_naslediya(fl_ctx *ctx, fl_value r, fl_value imya, fl_value nachalo, fl_value *result, fl_error *error);

/*
 * Функция flang «Есть текст ключа».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param znachenie — «значение»: «Значение»
 * @param klyuch — «ключ»: строка
 * @return значение
 */
fl_status kompilyator_flang_est_tekst_klyucha(fl_ctx *ctx, fl_value znachenie, fl_value klyuch, fl_value *result, fl_error *error);

/*
 * Функция flang «Тело морфизма».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param sborka — «сборка»: «Сборка утилиты»
 * @return значение: «Сборка утилиты»
 */
fl_status kompilyator_flang_telo_morfizma(fl_ctx *ctx, fl_value sborka, fl_value *result, fl_error *error);

/*
 * Функция flang «Обойти строки морфизма».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Хвостовой самовызов развёрнут в цикл: стек не растёт.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param sborka — «сборка»: «Сборка утилиты»
 * @return значение: «Сборка утилиты»
 */
fl_status kompilyator_flang_oboyti_stroki_morfizma(fl_ctx *ctx, fl_value sborka, fl_value *result, fl_error *error);

/*
 * Функция flang «Строка морфизма».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param sborka — «сборка»: «Сборка утилиты»
 * @return значение: «Сборка утилиты»
 */
fl_status kompilyator_flang_stroka_morfizma(fl_ctx *ctx, fl_value sborka, fl_value *result, fl_error *error);

/*
 * Функция flang «Строка кодомена».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param sborka — «сборка»: «Сборка утилиты»
 * @param r — «р»: «Разборщик»
 * @return значение: «Сборка утилиты»
 */
fl_status kompilyator_flang_stroka_kodomena(fl_ctx *ctx, fl_value sborka, fl_value r, fl_value *result, fl_error *error);

/*
 * Функция flang «Строка закона».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param sborka — «сборка»: «Сборка утилиты»
 * @param r — «р»: «Разборщик»
 * @return значение: «Сборка утилиты»
 */
fl_status kompilyator_flang_stroka_zakona(fl_ctx *ctx, fl_value sborka, fl_value r, fl_value *result, fl_error *error);

/*
 * Функция flang «Разобрать теорему».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param r — «р»: «Разборщик»
 * @return значение: «Шаг»
 */
fl_status kompilyator_flang_razobrat_teoremu(fl_ctx *ctx, fl_value r, fl_value *result, fl_error *error);

/*
 * Функция flang «С теоремой».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param sborka — «сборка»: «Сборка теоремы»
 * @param r — «р»: «Разборщик»
 * @return значение: «Сборка теоремы»
 */
fl_status kompilyator_flang_s_teoremoy(fl_ctx *ctx, fl_value sborka, fl_value r, fl_value *result, fl_error *error);

/*
 * Функция flang «Со значением теоремы».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param sborka — «сборка»: «Сборка теоремы»
 * @param r — «р»: «Разборщик»
 * @param znachenie — «значение»: «Значение»
 * @return значение: «Сборка теоремы»
 */
fl_status kompilyator_flang_so_znacheniem_teoremy(fl_ctx *ctx, fl_value sborka, fl_value r, fl_value znachenie, fl_value *result, fl_error *error);

/*
 * Функция flang «Тело теоремы».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param sborka — «сборка»: «Сборка теоремы»
 * @param imya — «имя»: строка
 * @return значение: «Сборка теоремы»
 */
fl_status kompilyator_flang_telo_teoremy(fl_ctx *ctx, fl_value sborka, fl_value imya, fl_value *result, fl_error *error);

/*
 * Функция flang «Обойти строки теоремы».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Хвостовой самовызов развёрнут в цикл: стек не растёт.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param sborka — «сборка»: «Сборка теоремы»
 * @param imya — «имя»: строка
 * @return значение: «Сборка теоремы»
 */
fl_status kompilyator_flang_oboyti_stroki_teoremy(fl_ctx *ctx, fl_value sborka, fl_value imya, fl_value *result, fl_error *error);

/*
 * Функция flang «Строка теоремы».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param sborka — «сборка»: «Сборка теоремы»
 * @param imya — «имя»: строка
 * @return значение: «Сборка теоремы»
 */
fl_status kompilyator_flang_stroka_teoremy(fl_ctx *ctx, fl_value sborka, fl_value imya, fl_value *result, fl_error *error);

/*
 * Функция flang «Строка дано теоремы».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param sborka — «сборка»: «Сборка теоремы»
 * @return значение: «Сборка теоремы»
 */
fl_status kompilyator_flang_stroka_dano_teoremy(fl_ctx *ctx, fl_value sborka, fl_value *result, fl_error *error);

/*
 * Функция flang «Строка данного объекта».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param sborka — «сборка»: «Сборка теоремы»
 * @return значение: «Сборка теоремы»
 */
fl_status kompilyator_flang_stroka_dannogo_obekta(fl_ctx *ctx, fl_value sborka, fl_value *result, fl_error *error);

/*
 * Функция flang «Строка переменной теоремы».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param sborka — «сборка»: «Сборка теоремы»
 * @return значение: «Сборка теоремы»
 */
fl_status kompilyator_flang_stroka_peremennoy_teoremy(fl_ctx *ctx, fl_value sborka, fl_value *result, fl_error *error);

/*
 * Функция flang «Строка допущения теоремы».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param sborka — «сборка»: «Сборка теоремы»
 * @return значение: «Сборка теоремы»
 */
fl_status kompilyator_flang_stroka_dopuscheniya_teoremy(fl_ctx *ctx, fl_value sborka, fl_value *result, fl_error *error);

/*
 * Функция flang «Строка утверждаем».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param sborka — «сборка»: «Сборка теоремы»
 * @param imya — «имя»: строка
 * @return значение: «Сборка теоремы»
 */
fl_status kompilyator_flang_stroka_utverzhdaem(fl_ctx *ctx, fl_value sborka, fl_value imya, fl_value *result, fl_error *error);

/*
 * Функция flang «Строка шага теоремы».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param sborka — «сборка»: «Сборка теоремы»
 * @param imya — «имя»: строка
 * @return значение: «Сборка теоремы»
 */
fl_status kompilyator_flang_stroka_shaga_teoremy(fl_ctx *ctx, fl_value sborka, fl_value imya, fl_value *result, fl_error *error);

/*
 * Функция flang «Строка доказано».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param sborka — «сборка»: «Сборка теоремы»
 * @return значение: «Сборка теоремы»
 */
fl_status kompilyator_flang_stroka_dokazano(fl_ctx *ctx, fl_value sborka, fl_value *result, fl_error *error);

/*
 * Функция flang «Строка данных теоремы».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param sborka — «сборка»: «Сборка теоремы»
 * @return значение: «Сборка теоремы»
 */
fl_status kompilyator_flang_stroka_dannyh_teoremy(fl_ctx *ctx, fl_value sborka, fl_value *result, fl_error *error);

/*
 * Функция flang «Строка морфизма теоремы».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param sborka — «сборка»: «Сборка теоремы»
 * @param r — «р»: «Разборщик»
 * @return значение: «Сборка теоремы»
 */
fl_status kompilyator_flang_stroka_morfizma_teoremy(fl_ctx *ctx, fl_value sborka, fl_value r, fl_value *result, fl_error *error);

/*
 * Функция flang «Строка вывода теоремы».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param sborka — «сборка»: «Сборка теоремы»
 * @param r — «р»: «Разборщик»
 * @return значение: «Сборка теоремы»
 */
fl_status kompilyator_flang_stroka_vyvoda_teoremy(fl_ctx *ctx, fl_value sborka, fl_value r, fl_value *result, fl_error *error);

/*
 * Функция flang «Слова старой формы».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param znachenie — «значение»: «Значение»
 * @return значение: список: строка
 */
fl_status kompilyator_flang_slova_staroy_formy(fl_ctx *ctx, fl_value znachenie, fl_value *result, fl_error *error);

/*
 * Функция flang «Собрать теорему».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param sborka — «сборка»: «Сборка теоремы»
 * @param imya — «имя»: строка
 * @param nachalo — «начало»: «Токен»
 * @return значение: «Шаг»
 */
fl_status kompilyator_flang_sobrat_teoremu(fl_ctx *ctx, fl_value sborka, fl_value imya, fl_value nachalo, fl_value *result, fl_error *error);

/*
 * Функция flang «Разобрать шаг доказательства».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param r — «р»: «Разборщик»
 * @param imya — «имя»: строка
 * @return значение: «Шаг»
 */
fl_status kompilyator_flang_razobrat_shag_dokazatelstva(fl_ctx *ctx, fl_value r, fl_value imya, fl_value *result, fl_error *error);

/*
 * Функция flang «Это обоснование».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param r — «р»: «Разборщик»
 * @return значение
 */
fl_status kompilyator_flang_eto_obosnovanie(fl_ctx *ctx, fl_value r, fl_value *result, fl_error *error);

/*
 * Функция flang «Это шаг доказательства».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param r — «р»: «Разборщик»
 * @return значение
 */
fl_status kompilyator_flang_eto_shag_dokazatelstva(fl_ctx *ctx, fl_value r, fl_value *result, fl_error *error);

/*
 * Функция flang «Разобрать обоснование».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param r — «р»: «Разборщик»
 * @param imya — «имя»: строка
 * @param nachalo — «начало»: «Токен»
 * @return значение: «Шаг»
 */
fl_status kompilyator_flang_razobrat_obosnovanie(fl_ctx *ctx, fl_value r, fl_value imya, fl_value nachalo, fl_value *result, fl_error *error);

/*
 * Функция flang «Обоснование примером».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param r — «р»: «Разборщик»
 * @param imya — «имя»: строка
 * @param nachalo — «начало»: «Токен»
 * @return значение: «Шаг»
 */
fl_status kompilyator_flang_obosnovanie_primerom(fl_ctx *ctx, fl_value r, fl_value imya, fl_value nachalo, fl_value *result, fl_error *error);

/*
 * Функция flang «Обоснование законом».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param r — «р»: «Разборщик»
 * @param imya — «имя»: строка
 * @param nachalo — «начало»: «Токен»
 * @return значение: «Шаг»
 */
fl_status kompilyator_flang_obosnovanie_zakonom(fl_ctx *ctx, fl_value r, fl_value imya, fl_value nachalo, fl_value *result, fl_error *error);

/*
 * Функция flang «Обоснование предположением».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param r — «р»: «Разборщик»
 * @param imya — «имя»: строка
 * @param nachalo — «начало»: «Токен»
 * @return значение: «Шаг»
 */
fl_status kompilyator_flang_obosnovanie_predpolozheniem(fl_ctx *ctx, fl_value r, fl_value imya, fl_value nachalo, fl_value *result, fl_error *error);

/*
 * Функция flang «Разобрать файл-функтор».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param r — «р»: «Разборщик»
 * @return значение: «Шаг»
 */
fl_status kompilyator_flang_razobrat_fayl_funktor(fl_ctx *ctx, fl_value r, fl_value *result, fl_error *error);

/*
 * Функция flang «Тело функтора».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param sborka — «сборка»: «Сборка утилиты»
 * @return значение: «Сборка утилиты»
 */
fl_status kompilyator_flang_telo_funktora(fl_ctx *ctx, fl_value sborka, fl_value *result, fl_error *error);

/*
 * Функция flang «Обойти строки функтора».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Хвостовой самовызов развёрнут в цикл: стек не растёт.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param sborka — «сборка»: «Сборка утилиты»
 * @return значение: «Сборка утилиты»
 */
fl_status kompilyator_flang_oboyti_stroki_funktora(fl_ctx *ctx, fl_value sborka, fl_value *result, fl_error *error);

/*
 * Функция flang «Строка функтора».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param sborka — «сборка»: «Сборка утилиты»
 * @return значение: «Сборка утилиты»
 */
fl_status kompilyator_flang_stroka_funktora(fl_ctx *ctx, fl_value sborka, fl_value *result, fl_error *error);

/*
 * Функция flang «Строка объекта функтора».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param sborka — «сборка»: «Сборка утилиты»
 * @param r — «р»: «Разборщик»
 * @return значение: «Сборка утилиты»
 */
fl_status kompilyator_flang_stroka_obekta_funktora(fl_ctx *ctx, fl_value sborka, fl_value r, fl_value *result, fl_error *error);

/*
 * Функция flang «Тело объекта функтора».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param r — «р»: «Разборщик»
 * @return значение: «Шаг узлов»
 */
fl_status kompilyator_flang_telo_obekta_funktora(fl_ctx *ctx, fl_value r, fl_value *result, fl_error *error);

/*
 * Функция flang «Обойти поля объекта».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Хвостовой самовызов развёрнут в цикл: стек не растёт.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param r — «р»: «Разборщик»
 * @param uzly — «узлы»: список: «Значение»
 * @return значение: «Шаг узлов»
 */
fl_status kompilyator_flang_oboyti_polya_obekta(fl_ctx *ctx, fl_value r, fl_value uzly, fl_value *result, fl_error *error);

/*
 * Функция flang «Строка морфизма функтора».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param sborka — «сборка»: «Сборка утилиты»
 * @param r — «р»: «Разборщик»
 * @return значение: «Сборка утилиты»
 */
fl_status kompilyator_flang_stroka_morfizma_funktora(fl_ctx *ctx, fl_value sborka, fl_value r, fl_value *result, fl_error *error);

/*
 * Функция flang «Повторная замена».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Хвостовой самовызов развёрнут в цикл: стек не растёт.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param tekst — «текст»: строка
 * @param chto — «что»: строка
 * @param chem — «чем»: строка
 * @return значение: строка
 */
fl_status kompilyator_flang_povtornaya_zamena(fl_ctx *ctx, fl_value tekst, fl_value chto, fl_value chem, fl_value *result, fl_error *error);

/*
 * Функция flang «Без ведущих пробелов».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * Хвостовой самовызов развёрнут в цикл: стек не растёт.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param simvoly — «символы»: список: строка
 * @return значение: строка
 */
fl_status kompilyator_flang_bez_veduschih_probelov(fl_ctx *ctx, fl_value simvoly, fl_value *result, fl_error *error);

/*
 * Функция flang «Обрезать слева».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param tekst — «текст»: строка
 * @return значение: строка
 */
fl_status kompilyator_flang_obrezat_sleva(fl_ctx *ctx, fl_value tekst, fl_value *result, fl_error *error);

/*
 * Функция flang «Обрезать справа».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param tekst — «текст»: строка
 * @return значение: строка
 */
fl_status kompilyator_flang_obrezat_sprava(fl_ctx *ctx, fl_value tekst, fl_value *result, fl_error *error);

/*
 * Функция flang «Собрать тип».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param chasti — «части»: список: строка
 * @return значение: строка
 */
fl_status kompilyator_flang_sobrat_tip(fl_ctx *ctx, fl_value chasti, fl_value *result, fl_error *error);

/*
 * Функция flang «Вид утверждения».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param znachenie — «значение»: строка
 * @return значение: строка
 */
fl_status kompilyator_flang_vid_utverzhdeniya(fl_ctx *ctx, fl_value znachenie, fl_value *result, fl_error *error);

/*
 * Функция flang «Свойство утверждения».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param znachenie — «значение»: строка
 * @return значение: строка
 */
fl_status kompilyator_flang_svoystvo_utverzhdeniya(fl_ctx *ctx, fl_value znachenie, fl_value *result, fl_error *error);

/*
 * Функция flang «Пропустить разделители».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Хвостовой самовызов развёрнут в цикл: стек не растёт.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param r — «р»: «Разборщик»
 * @return значение: «Разборщик»
 */
fl_status kompilyator_flang_propustit_razdeliteli(fl_ctx *ctx, fl_value r, fl_value *result, fl_error *error);

/*
 * Функция flang «Закрыто или сломано».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param r — «р»: «Разборщик»
 * @param znak — «знак»: строка
 * @return значение
 */
fl_status kompilyator_flang_zakryto_ili_slomano(fl_ctx *ctx, fl_value r, fl_value znak, fl_value *result, fl_error *error);

/*
 * Функция flang «Разобрать скобочное значение».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param r — «р»: «Разборщик»
 * @return значение: «Шаг»
 */
fl_status kompilyator_flang_razobrat_skobochnoe_znachenie(fl_ctx *ctx, fl_value r, fl_value *result, fl_error *error);

/*
 * Функция flang «Скобочное значение словом».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param r — «р»: «Разборщик»
 * @return значение: «Шаг»
 */
fl_status kompilyator_flang_skobochnoe_znachenie_slovom(fl_ctx *ctx, fl_value r, fl_value *result, fl_error *error);

/*
 * Функция flang «Скобочное значение списком».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param r — «р»: «Разборщик»
 * @return значение: «Шаг»
 */
fl_status kompilyator_flang_skobochnoe_znachenie_spiskom(fl_ctx *ctx, fl_value r, fl_value *result, fl_error *error);

/*
 * Функция flang «Обойти скобочный список».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Хвостовой самовызов развёрнут в цикл: стек не растёт.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param r — «р»: «Разборщик»
 * @param uzly — «узлы»: список: «Значение»
 * @return значение: «Шаг узлов»
 */
fl_status kompilyator_flang_oboyti_skobochnyy_spisok(fl_ctx *ctx, fl_value r, fl_value uzly, fl_value *result, fl_error *error);

/*
 * Функция flang «Скобочное значение записью».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param r — «р»: «Разборщик»
 * @return значение: «Шаг»
 */
fl_status kompilyator_flang_skobochnoe_znachenie_zapisyu(fl_ctx *ctx, fl_value r, fl_value *result, fl_error *error);

/*
 * Функция flang «Обойти скобочную запись».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Хвостовой самовызов развёрнут в цикл: стек не растёт.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param r — «р»: «Разборщик»
 * @param perechen — «перечень»: список: «Поле значения»
 * @return значение: «Шаг полей»
 */
fl_status kompilyator_flang_oboyti_skobochnuyu_zapis(fl_ctx *ctx, fl_value r, fl_value perechen, fl_value *result, fl_error *error);

/*
 * Функция flang «Разобрать утверждение».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param r — «р»: «Разборщик»
 * @param s_pristavkoy — «с приставкой»
 * @return значение: «Шаг»
 */
fl_status kompilyator_flang_razobrat_utverzhdenie(fl_ctx *ctx, fl_value r, fl_value s_pristavkoy, fl_value *result, fl_error *error);

/*
 * Функция flang «Утверждение свидетельством».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param r — «р»: «Разборщик»
 * @return значение: «Шаг»
 */
fl_status kompilyator_flang_utverzhdenie_svidetelstvom(fl_ctx *ctx, fl_value r, fl_value *result, fl_error *error);

/*
 * Функция flang «Утверждение применением».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param r — «р»: «Разборщик»
 * @param slovo — «слово»: «Токен»
 * @return значение: «Шаг»
 */
fl_status kompilyator_flang_utverzhdenie_primeneniem(fl_ctx *ctx, fl_value r, fl_value slovo, fl_value *result, fl_error *error);

/*
 * Функция flang «Утверждение композицией».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param r — «р»: «Разборщик»
 * @param slovo — «слово»: «Токен»
 * @return значение: «Шаг»
 */
fl_status kompilyator_flang_utverzhdenie_kompoziciey(fl_ctx *ctx, fl_value r, fl_value slovo, fl_value *result, fl_error *error);

/*
 * Функция flang «Тело утверждения».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param r — «р»: «Разборщик»
 * @return значение: «Шаг»
 */
fl_status kompilyator_flang_telo_utverzhdeniya(fl_ctx *ctx, fl_value r, fl_value *result, fl_error *error);

/*
 * Функция flang «Обойти тело утверждения».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Взаимная хвостовая рекурсия с «Строка тела утверждения»: вызовы идут через батут.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param r — «р»: «Разборщик»
 * @param perechen — «перечень»: список: «Поле значения»
 * @return значение: «Шаг полей»
 */
fl_status kompilyator_flang_oboyti_telo_utverzhdeniya(fl_ctx *ctx, fl_value r, fl_value perechen, fl_value *result, fl_error *error);

/*
 * Функция flang «Строка тела утверждения».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Взаимная хвостовая рекурсия с «Обойти тело утверждения»: вызовы идут через батут.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param r — «р»: «Разборщик»
 * @param perechen — «перечень»: список: «Поле значения»
 * @return значение: «Шаг полей»
 */
fl_status kompilyator_flang_stroka_tela_utverzhdeniya(fl_ctx *ctx, fl_value r, fl_value perechen, fl_value *result, fl_error *error);

/*
 * Функция flang «Вложенное утверждение».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param r — «р»: «Разборщик»
 * @return значение
 */
fl_status kompilyator_flang_vlozhennoe_utverzhdenie(fl_ctx *ctx, fl_value r, fl_value *result, fl_error *error);

/*
 * Функция flang «Разобрать скобочную структуру».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param r — «р»: «Разборщик»
 * @return значение: «Шаг»
 */
fl_status kompilyator_flang_razobrat_skobochnuyu_strukturu(fl_ctx *ctx, fl_value r, fl_value *result, fl_error *error);

/*
 * Функция flang «Обойти поля структуры».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Хвостовой самовызов развёрнут в цикл: стек не растёт.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param r — «р»: «Разборщик»
 * @param uzly — «узлы»: список: «Значение»
 * @return значение: «Шаг узлов»
 */
fl_status kompilyator_flang_oboyti_polya_struktury(fl_ctx *ctx, fl_value r, fl_value uzly, fl_value *result, fl_error *error);

/*
 * Функция flang «Разобрать поле структуры».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param r — «р»: «Разборщик»
 * @return значение: «Шаг»
 */
fl_status kompilyator_flang_razobrat_pole_struktury(fl_ctx *ctx, fl_value r, fl_value *result, fl_error *error);

/*
 * Функция flang «Собрать части типа».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Хвостовой самовызов развёрнут в цикл: стек не растёт.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param r — «р»: «Разборщик»
 * @param imena — «имена»: список: строка
 * @param glubina — «глубина»: число
 * @return значение: «Шаг имён»
 */
fl_status kompilyator_flang_sobrat_chasti_tipa(fl_ctx *ctx, fl_value r, fl_value imena, fl_value glubina, fl_value *result, fl_error *error);

/*
 * Функция flang «Конец типа структуры».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param r — «р»: «Разборщик»
 * @return значение
 */
fl_status kompilyator_flang_konec_tipa_struktury(fl_ctx *ctx, fl_value r, fl_value *result, fl_error *error);

/*
 * Функция flang «Разобрать скобочный функтор».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param r — «р»: «Разборщик»
 * @return значение: «Шаг»
 */
fl_status kompilyator_flang_razobrat_skobochnyy_funktor(fl_ctx *ctx, fl_value r, fl_value *result, fl_error *error);

/*
 * Функция flang «Собрать домен».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Хвостовой самовызов развёрнут в цикл: стек не растёт.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param r — «р»: «Разборщик»
 * @param imena — «имена»: список: строка
 * @return значение: «Шаг имён»
 */
fl_status kompilyator_flang_sobrat_domen(fl_ctx *ctx, fl_value r, fl_value imena, fl_value *result, fl_error *error);

/*
 * Функция flang «Собрать кодомен».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Хвостовой самовызов развёрнут в цикл: стек не растёт.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param r — «р»: «Разборщик»
 * @param imena — «имена»: список: строка
 * @return значение: «Шаг имён»
 */
fl_status kompilyator_flang_sobrat_kodomen(fl_ctx *ctx, fl_value r, fl_value imena, fl_value *result, fl_error *error);

/*
 * Функция flang «Разобрать скобочный документ».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param r — «р»: «Разборщик»
 * @return значение: «Разборщик»
 */
fl_status kompilyator_flang_razobrat_skobochnyy_dokument(fl_ctx *ctx, fl_value r, fl_value *result, fl_error *error);

/*
 * Функция flang «Обойти скобочный документ».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Хвостовой самовызов развёрнут в цикл: стек не растёт.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param sborka — «сборка»: «Сборка документа»
 * @return значение: «Сборка документа»
 */
fl_status kompilyator_flang_oboyti_skobochnyy_dokument(fl_ctx *ctx, fl_value sborka, fl_value *result, fl_error *error);

/*
 * Функция flang «Строка скобочного документа».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param sborka — «сборка»: «Сборка документа»
 * @return значение: «Сборка документа»
 */
fl_status kompilyator_flang_stroka_skobochnogo_dokumenta(fl_ctx *ctx, fl_value sborka, fl_value *result, fl_error *error);

/*
 * Функция flang «Строка утверждения документа».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param sborka — «сборка»: «Сборка документа»
 * @return значение: «Сборка документа»
 */
fl_status kompilyator_flang_stroka_utverzhdeniya_dokumenta(fl_ctx *ctx, fl_value sborka, fl_value *result, fl_error *error);

/*
 * Функция flang «Строка структуры документа».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param sborka — «сборка»: «Сборка документа»
 * @return значение: «Сборка документа»
 */
fl_status kompilyator_flang_stroka_struktury_dokumenta(fl_ctx *ctx, fl_value sborka, fl_value *result, fl_error *error);

/*
 * Функция flang «Поле записи из структуры».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param pole — «поле»: «Значение»
 * @return значение: «Значение»
 */
fl_status kompilyator_flang_pole_zapisi_iz_struktury(fl_ctx *ctx, fl_value pole, fl_value *result, fl_error *error);

/*
 * Функция flang «Узел ничто при понижении».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @return значение: «Значение»
 */
fl_status kompilyator_flang_uzel_nichto_pri_ponizhenii(fl_ctx *ctx, fl_value *result, fl_error *error);

/*
 * Функция flang «Поля при понижении».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param uzel — «узел»: «Значение»
 * @return значение: список: «Поле значения»
 */
fl_status kompilyator_flang_polya_pri_ponizhenii(fl_ctx *ctx, fl_value uzel, fl_value *result, fl_error *error);

/*
 * Функция flang «Элементы при понижении».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param uzel — «узел»: «Значение»
 * @return значение: список: «Значение»
 */
fl_status kompilyator_flang_elementy_pri_ponizhenii(fl_ctx *ctx, fl_value uzel, fl_value *result, fl_error *error);

/*
 * Функция flang «Взять поле при понижении».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param uzel — «узел»: «Значение»
 * @param klyuch — «ключ»: строка
 * @return значение: «Значение»
 */
fl_status kompilyator_flang_vzyat_pole_pri_ponizhenii(fl_ctx *ctx, fl_value uzel, fl_value klyuch, fl_value *result, fl_error *error);

/*
 * Функция flang «Есть поле при понижении».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param uzel — «узел»: «Значение»
 * @param klyuch — «ключ»: строка
 * @return значение
 */
fl_status kompilyator_flang_est_pole_pri_ponizhenii(fl_ctx *ctx, fl_value uzel, fl_value klyuch, fl_value *result, fl_error *error);

/*
 * Функция flang «Строка при понижении».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param uzel — «узел»: «Значение»
 * @return значение: строка
 */
fl_status kompilyator_flang_stroka_pri_ponizhenii(fl_ctx *ctx, fl_value uzel, fl_value *result, fl_error *error);

/*
 * Функция flang «Строка скаляра при понижении».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param skalyar — «скаляр»: «Скаляр»
 * @return значение: строка
 */
fl_status kompilyator_flang_stroka_skalyara_pri_ponizhenii(fl_ctx *ctx, fl_value skalyar, fl_value *result, fl_error *error);

/*
 * Функция flang «Это строка при понижении».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param uzel — «узел»: «Значение»
 * @return значение
 */
fl_status kompilyator_flang_eto_stroka_pri_ponizhenii(fl_ctx *ctx, fl_value uzel, fl_value *result, fl_error *error);

/*
 * Функция flang «Это строка в скаляре при понижении».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param skalyar — «скаляр»: «Скаляр»
 * @return значение
 */
fl_status kompilyator_flang_eto_stroka_v_skalyare_pri_ponizhenii(fl_ctx *ctx, fl_value skalyar, fl_value *result, fl_error *error);

/*
 * Функция flang «Вид при понижении».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param uzel — «узел»: «Значение»
 * @return значение: строка
 */
fl_status kompilyator_flang_vid_pri_ponizhenii(fl_ctx *ctx, fl_value uzel, fl_value *result, fl_error *error);

/*
 * Функция flang «Строкой при понижении».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param znachenie — «значение»: строка
 * @return значение: «Значение»
 */
fl_status kompilyator_flang_strokoy_pri_ponizhenii(fl_ctx *ctx, fl_value znachenie, fl_value *result, fl_error *error);

/*
 * Функция flang «Признаком при понижении».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param znachenie — «значение»
 * @return значение: «Значение»
 */
fl_status kompilyator_flang_priznakom_pri_ponizhenii(fl_ctx *ctx, fl_value znachenie, fl_value *result, fl_error *error);

/*
 * Функция flang «Списком при понижении».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param elementy — «элементы»: список: «Значение»
 * @return значение: «Значение»
 */
fl_status kompilyator_flang_spiskom_pri_ponizhenii(fl_ctx *ctx, fl_value elementy, fl_value *result, fl_error *error);

/*
 * Функция flang «Записью при понижении».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param polya — «поля»: список: «Поле значения»
 * @return значение: «Значение»
 */
fl_status kompilyator_flang_zapisyu_pri_ponizhenii(fl_ctx *ctx, fl_value polya, fl_value *result, fl_error *error);

/*
 * Функция flang «Пара при понижении».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param klyuch — «ключ»: строка
 * @param znachenie — «значение»: «Значение»
 * @return значение: «Поле значения»
 */
fl_status kompilyator_flang_para_pri_ponizhenii(fl_ctx *ctx, fl_value klyuch, fl_value znachenie, fl_value *result, fl_error *error);

/*
 * Функция flang «Текстом при понижении».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param klyuch — «ключ»: строка
 * @param znachenie — «значение»: строка
 * @return значение: «Поле значения»
 */
fl_status kompilyator_flang_tekstom_pri_ponizhenii(fl_ctx *ctx, fl_value klyuch, fl_value znachenie, fl_value *result, fl_error *error);

/*
 * Функция flang «Это тег».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param uzel — «узел»: «Значение»
 * @return значение
 */
fl_status kompilyator_flang_eto_teg(fl_ctx *ctx, fl_value uzel, fl_value *result, fl_error *error);

/*
 * Функция flang «Это применение».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param uzel — «узел»: «Значение»
 * @return значение
 */
fl_status kompilyator_flang_eto_primenenie(fl_ctx *ctx, fl_value uzel, fl_value *result, fl_error *error);

/*
 * Функция flang «Есть высший порядок».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param uzel — «узел»: «Значение»
 * @return значение
 */
fl_status kompilyator_flang_est_vysshiy_poryadok(fl_ctx *ctx, fl_value uzel, fl_value *result, fl_error *error);

/*
 * Функция flang «Есть высший порядок в полях».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * Хвостовой самовызов развёрнут в цикл: стек не растёт.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param polya — «поля»: список: «Поле значения»
 * @return значение
 */
fl_status kompilyator_flang_est_vysshiy_poryadok_v_polyah(fl_ctx *ctx, fl_value polya, fl_value *result, fl_error *error);

/*
 * Функция flang «Есть высший порядок в списке».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * Хвостовой самовызов развёрнут в цикл: стек не растёт.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param elementy — «элементы»: список: «Значение»
 * @return значение
 */
fl_status kompilyator_flang_est_vysshiy_poryadok_v_spiske(fl_ctx *ctx, fl_value elementy, fl_value *result, fl_error *error);

/*
 * Функция flang «Теги узла».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param uzel — «узел»: «Значение»
 * @param obyavlennye — «объявленные»: список: строка
 * @param naydennye — «найденные»: список: строка
 * @return значение: список: строка
 */
fl_status kompilyator_flang_tegi_uzla(fl_ctx *ctx, fl_value uzel, fl_value obyavlennye, fl_value naydennye, fl_value *result, fl_error *error);

/*
 * Функция flang «Отметить тег».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param uzel — «узел»: «Значение»
 * @param obyavlennye — «объявленные»: список: строка
 * @param naydennye — «найденные»: список: строка
 * @return значение: список: строка
 */
fl_status kompilyator_flang_otmetit_teg(fl_ctx *ctx, fl_value uzel, fl_value obyavlennye, fl_value naydennye, fl_value *result, fl_error *error);

/*
 * Функция flang «Имя тега».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param uzel — «узел»: «Значение»
 * @return значение: строка
 */
fl_status kompilyator_flang_imya_tega(fl_ctx *ctx, fl_value uzel, fl_value *result, fl_error *error);

/*
 * Функция flang «Теги полей».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * Хвостовой самовызов развёрнут в цикл: стек не растёт.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param polya — «поля»: список: «Поле значения»
 * @param obyavlennye — «объявленные»: список: строка
 * @param naydennye — «найденные»: список: строка
 * @return значение: список: строка
 */
fl_status kompilyator_flang_tegi_poley(fl_ctx *ctx, fl_value polya, fl_value obyavlennye, fl_value naydennye, fl_value *result, fl_error *error);

/*
 * Функция flang «Теги списка».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * Хвостовой самовызов развёрнут в цикл: стек не растёт.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param elementy — «элементы»: список: «Значение»
 * @param obyavlennye — «объявленные»: список: строка
 * @param naydennye — «найденные»: список: строка
 * @return значение: список: строка
 */
fl_status kompilyator_flang_tegi_spiska(fl_ctx *ctx, fl_value elementy, fl_value obyavlennye, fl_value naydennye, fl_value *result, fl_error *error);

/*
 * Функция flang «Собрать функции при понижении».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * Хвостовой самовызов развёрнут в цикл: стек не растёт.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param funkcii — «функции»: список: «Значение»
 * @param gotovye — «готовые»: список: «Известная функция»
 * @return значение: список: «Известная функция»
 */
fl_status kompilyator_flang_sobrat_funkcii_pri_ponizhenii(fl_ctx *ctx, fl_value funkcii, fl_value gotovye, fl_value *result, fl_error *error);

/*
 * Функция flang «Дописать функцию».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param funkciya — «функция»: «Значение»
 * @param gotovye — «готовые»: список: «Известная функция»
 * @return значение: список: «Известная функция»
 */
fl_status kompilyator_flang_dopisat_funkciyu(fl_ctx *ctx, fl_value funkciya, fl_value gotovye, fl_value *result, fl_error *error);

/*
 * Функция flang «Это истина при понижении».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param uzel — «узел»: «Значение»
 * @return значение
 */
fl_status kompilyator_flang_eto_istina_pri_ponizhenii(fl_ctx *ctx, fl_value uzel, fl_value *result, fl_error *error);

/*
 * Функция flang «Это истина в скаляре при понижении».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param skalyar — «скаляр»: «Скаляр»
 * @return значение
 */
fl_status kompilyator_flang_eto_istina_v_skalyare_pri_ponizhenii(fl_ctx *ctx, fl_value skalyar, fl_value *result, fl_error *error);

/*
 * Функция flang «Имена функций при понижении».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param funkcii — «функции»: список: «Известная функция»
 * @return значение: список: строка
 */
fl_status kompilyator_flang_imena_funkciy_pri_ponizhenii(fl_ctx *ctx, fl_value funkcii, fl_value *result, fl_error *error);

/*
 * Функция flang «Арность функции».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param funkcii — «функции»: список: «Известная функция»
 * @param imya — «имя»: строка
 * @return значение: число
 */
fl_status kompilyator_flang_arnost_funkcii(fl_ctx *ctx, fl_value funkcii, fl_value imya, fl_value *result, fl_error *error);

/*
 * Функция flang «Функция тотальна».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param funkcii — «функции»: список: «Известная функция»
 * @param imya — «имя»: строка
 * @return значение
 */
fl_status kompilyator_flang_funkciya_totalna(fl_ctx *ctx, fl_value funkcii, fl_value imya, fl_value *result, fl_error *error);

/*
 * Функция flang «Теги по объявлению».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * Хвостовой самовызов развёрнут в цикл: стек не растёт.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param funkcii — «функции»: список: «Известная функция»
 * @param naydennye — «найденные»: список: строка
 * @param gotovye — «готовые»: список: строка
 * @return значение: список: строка
 */
fl_status kompilyator_flang_tegi_po_obyavleniyu(fl_ctx *ctx, fl_value funkcii, fl_value naydennye, fl_value gotovye, fl_value *result, fl_error *error);

/*
 * Функция flang «Вставить арность».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param arnost — «арность»: число
 * @param gotovye — «готовые»: список: число
 * @return значение: список: число
 */
fl_status kompilyator_flang_vstavit_arnost(fl_ctx *ctx, fl_value arnost, fl_value gotovye, fl_value *result, fl_error *error);

/*
 * Функция flang «Приписать число».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param pervoe — «первое»: число
 * @param prochie — «прочие»: список: число
 * @return значение: список: число
 */
fl_status kompilyator_flang_pripisat_chislo(fl_ctx *ctx, fl_value pervoe, fl_value prochie, fl_value *result, fl_error *error);

/*
 * Функция flang «Слить числа».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * Хвостовой самовызов развёрнут в цикл: стек не растёт.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param pervye — «первые»: список: число
 * @param vtorye — «вторые»: список: число
 * @return значение: список: число
 */
fl_status kompilyator_flang_slit_chisla(fl_ctx *ctx, fl_value pervye, fl_value vtorye, fl_value *result, fl_error *error);

/*
 * Функция flang «Упорядочить пары».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * Хвостовой самовызов развёрнут в цикл: стек не растёт.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param pary — «пары»: список: «Пара арности»
 * @param gotovye — «готовые»: список: «Пара арности»
 * @return значение: список: «Пара арности»
 */
fl_status kompilyator_flang_uporyadochit_pary(fl_ctx *ctx, fl_value pary, fl_value gotovye, fl_value *result, fl_error *error);

/*
 * Функция flang «Вставить пару».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param para — «пара»: «Пара арности»
 * @param gotovye — «готовые»: список: «Пара арности»
 * @return значение: список: «Пара арности»
 */
fl_status kompilyator_flang_vstavit_paru(fl_ctx *ctx, fl_value para, fl_value gotovye, fl_value *result, fl_error *error);

/*
 * Функция flang «Приписать пару».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param pervaya — «первая»: «Пара арности»
 * @param prochie — «прочие»: список: «Пара арности»
 * @return значение: список: «Пара арности»
 */
fl_status kompilyator_flang_pripisat_paru(fl_ctx *ctx, fl_value pervaya, fl_value prochie, fl_value *result, fl_error *error);

/*
 * Функция flang «Слить пары».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * Хвостовой самовызов развёрнут в цикл: стек не растёт.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param pervye — «первые»: список: «Пара арности»
 * @param vtorye — «вторые»: список: «Пара арности»
 * @return значение: список: «Пара арности»
 */
fl_status kompilyator_flang_slit_pary(fl_ctx *ctx, fl_value pervye, fl_value vtorye, fl_value *result, fl_error *error);

/*
 * Функция flang «Имя диспетчера».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param arnost — «арность»: число
 * @param zanyatye — «занятые»: список: строка
 * @return значение: строка
 */
fl_status kompilyator_flang_imya_dispetchera(fl_ctx *ctx, fl_value arnost, fl_value zanyatye, fl_value *result, fl_error *error);

/*
 * Функция flang «Свободное имя при понижении».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param osnova — «основа»: строка
 * @param zanyatye — «занятые»: список: строка
 * @param toplivo — «топливо»: список: строка
 * @param nomer — «номер»: число
 * @return значение: строка
 */
fl_status kompilyator_flang_svobodnoe_imya_pri_ponizhenii(fl_ctx *ctx, fl_value osnova, fl_value zanyatye, fl_value toplivo, fl_value nomer, fl_value *result, fl_error *error);

/*
 * Функция flang «Продолжить поиск имени».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * Хвостовой самовызов развёрнут в цикл: стек не растёт.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param osnova — «основа»: строка
 * @param zanyatye — «занятые»: список: строка
 * @param toplivo — «топливо»: список: строка
 * @param nomer — «номер»: число
 * @return значение: строка
 */
fl_status kompilyator_flang_prodolzhit_poisk_imeni(fl_ctx *ctx, fl_value osnova, fl_value zanyatye, fl_value toplivo, fl_value nomer, fl_value *result, fl_error *error);

/*
 * Функция flang «Имя по арности».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param pary — «пары»: список: «Пара арности»
 * @param arnost — «арность»: число
 * @return значение: строка
 */
fl_status kompilyator_flang_imya_po_arnosti(fl_ctx *ctx, fl_value pary, fl_value arnost, fl_value *result, fl_error *error);

/*
 * Функция flang «Переписать узел».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param uzel — «узел»: «Значение»
 * @param hod — «ход»: «Понижение»
 * @return значение: «Значение»
 */
fl_status kompilyator_flang_perepisat_uzel(fl_ctx *ctx, fl_value uzel, fl_value hod, fl_value *result, fl_error *error);

/*
 * Функция flang «Переписать поля».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param polya — «поля»: список: «Поле значения»
 * @param hod — «ход»: «Понижение»
 * @return значение: список: «Поле значения»
 */
fl_status kompilyator_flang_perepisat_polya(fl_ctx *ctx, fl_value polya, fl_value hod, fl_value *result, fl_error *error);

/*
 * Функция flang «Переписать список».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param elementy — «элементы»: список: «Значение»
 * @param hod — «ход»: «Понижение»
 * @return значение: список: «Значение»
 */
fl_status kompilyator_flang_perepisat_spisok(fl_ctx *ctx, fl_value elementy, fl_value hod, fl_value *result, fl_error *error);

/*
 * Функция flang «Значением тега».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param uzel — «узел»: «Значение»
 * @return значение: «Значение»
 */
fl_status kompilyator_flang_znacheniem_tega(fl_ctx *ctx, fl_value uzel, fl_value *result, fl_error *error);

/*
 * Функция flang «Вызовом диспетчера».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param uzel — «узел»: «Значение»
 * @param hod — «ход»: «Понижение»
 * @return значение: «Значение»
 */
fl_status kompilyator_flang_vyzovom_dispetchera(fl_ctx *ctx, fl_value uzel, fl_value hod, fl_value *result, fl_error *error);

/*
 * Функция flang «Арности применений».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param uzel — «узел»: «Значение»
 * @param naydennye — «найденные»: список: число
 * @return значение: список: число
 */
fl_status kompilyator_flang_arnosti_primeneniy(fl_ctx *ctx, fl_value uzel, fl_value naydennye, fl_value *result, fl_error *error);

/*
 * Функция flang «Арности в полях».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * Хвостовой самовызов развёрнут в цикл: стек не растёт.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param polya — «поля»: список: «Поле значения»
 * @param naydennye — «найденные»: список: число
 * @return значение: список: число
 */
fl_status kompilyator_flang_arnosti_v_polyah(fl_ctx *ctx, fl_value polya, fl_value naydennye, fl_value *result, fl_error *error);

/*
 * Функция flang «Арности в списке».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * Хвостовой самовызов развёрнут в цикл: стек не растёт.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param elementy — «элементы»: список: «Значение»
 * @param naydennye — «найденные»: список: число
 * @return значение: список: число
 */
fl_status kompilyator_flang_arnosti_v_spiske(fl_ctx *ctx, fl_value elementy, fl_value naydennye, fl_value *result, fl_error *error);

/*
 * Функция flang «Печать диспетчера при понижении».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param para — «пара»: «Пара арности»
 * @param tegi — «теги»: список: строка
 * @param hod — «ход»: «Понижение»
 * @return значение: «Значение»
 */
fl_status kompilyator_flang_pechat_dispetchera_pri_ponizhenii(fl_ctx *ctx, fl_value para, fl_value tegi, fl_value hod, fl_value *result, fl_error *error);

/*
 * Функция flang «Все случаи тотальны».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * Хвостовой самовызов развёрнут в цикл: стек не растёт.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param tegi — «теги»: список: строка
 * @param hod — «ход»: «Понижение»
 * @return значение
 */
fl_status kompilyator_flang_vse_sluchai_totalny(fl_ctx *ctx, fl_value tegi, fl_value hod, fl_value *result, fl_error *error);

/*
 * Функция flang «Случай диспетчера».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param teg — «тег»: строка
 * @param arnost — «арность»: число
 * @return значение: «Значение»
 */
fl_status kompilyator_flang_sluchay_dispetchera(fl_ctx *ctx, fl_value teg, fl_value arnost, fl_value *result, fl_error *error);

/*
 * Функция flang «Имя переменной при понижении».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param imya — «имя»: строка
 * @return значение: «Значение»
 */
fl_status kompilyator_flang_imya_peremennoy_pri_ponizhenii(fl_ctx *ctx, fl_value imya, fl_value *result, fl_error *error);

/*
 * Функция flang «Номера аргументов».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Хвостовой самовызов развёрнут в цикл: стек не растёт.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param arnost — «арность»: число
 * @param gotovye — «готовые»: список: число
 * @return значение: список: число
 */
fl_status kompilyator_flang_nomera_argumentov(fl_ctx *ctx, fl_value arnost, fl_value gotovye, fl_value *result, fl_error *error);

/*
 * Функция flang «Сумма тегов».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param tegi — «теги»: список: строка
 * @param zanyatye_tipy — «занятые типы»: список: строка
 * @return значение: «Значение»
 */
fl_status kompilyator_flang_summa_tegov(fl_ctx *ctx, fl_value tegi, fl_value zanyatye_tipy, fl_value *result, fl_error *error);

/*
 * Функция flang «Имена типов».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * Хвостовой самовызов развёрнут в цикл: стек не растёт.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param tipy — «типы»: список: «Значение»
 * @param gotovye — «готовые»: список: строка
 * @return значение: список: строка
 */
fl_status kompilyator_flang_imena_tipov(fl_ctx *ctx, fl_value tipy, fl_value gotovye, fl_value *result, fl_error *error);

/*
 * Функция flang «Объявленные варианты».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * Хвостовой самовызов развёрнут в цикл: стек не растёт.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param tipy — «типы»: список: «Значение»
 * @param gotovye — «готовые»: список: строка
 * @return значение: список: строка
 */
fl_status kompilyator_flang_obyavlennye_varianty(fl_ctx *ctx, fl_value tipy, fl_value gotovye, fl_value *result, fl_error *error);

/*
 * Функция flang «Имена вариантов при понижении».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * Хвостовой самовызов развёрнут в цикл: стек не растёт.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param varianty — «варианты»: список: «Значение»
 * @param gotovye — «готовые»: список: строка
 * @return значение: список: строка
 */
fl_status kompilyator_flang_imena_variantov_pri_ponizhenii(fl_ctx *ctx, fl_value varianty, fl_value gotovye, fl_value *result, fl_error *error);

/*
 * Функция flang «Нет отметки».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @return значение: «Отметка меры»
 */
fl_status kompilyator_flang_net_otmetki(fl_ctx *ctx, fl_value *result, fl_error *error);

/*
 * Функция flang «Отметка при понижении».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param uzel — «узел»: «Значение»
 * @return значение: «Отметка меры»
 */
fl_status kompilyator_flang_otmetka_pri_ponizhenii(fl_ctx *ctx, fl_value uzel, fl_value *result, fl_error *error);

/*
 * Функция flang «Сообщения мер».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param programma — «программа»: «Значение»
 * @return значение: список: строка
 */
fl_status kompilyator_flang_soobscheniya_mer(fl_ctx *ctx, fl_value programma, fl_value *result, fl_error *error);

/*
 * Функция flang «Тексты отметок».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * Хвостовой самовызов развёрнут в цикл: стек не растёт.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param elementy — «элементы»: список: «Значение»
 * @param naydennye — «найденные»: список: строка
 * @return значение: список: строка
 */
fl_status kompilyator_flang_teksty_otmetok(fl_ctx *ctx, fl_value elementy, fl_value naydennye, fl_value *result, fl_error *error);

/*
 * Функция flang «Дописать текст отметки».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param uzel — «узел»: «Значение»
 * @param naydennye — «найденные»: список: строка
 * @return значение: список: строка
 */
fl_status kompilyator_flang_dopisat_tekst_otmetki(fl_ctx *ctx, fl_value uzel, fl_value naydennye, fl_value *result, fl_error *error);

/*
 * Функция flang «Дописать непустой текст».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param tekst — «текст»: строка
 * @param naydennye — «найденные»: список: строка
 * @return значение: список: строка
 */
fl_status kompilyator_flang_dopisat_nepustoy_tekst(fl_ctx *ctx, fl_value tekst, fl_value naydennye, fl_value *result, fl_error *error);

/*
 * Функция flang «Назвать сторожей».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * Хвостовой самовызов развёрнут в цикл: стек не растёт.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param soobscheniya — «сообщения»: список: строка
 * @param zanyatye — «занятые»: список: строка
 * @param gotovye — «готовые»: список: «Имя сторожа»
 * @return значение: список: «Имя сторожа»
 */
fl_status kompilyator_flang_nazvat_storozhey(fl_ctx *ctx, fl_value soobscheniya, fl_value zanyatye, fl_value gotovye, fl_value *result, fl_error *error);

/*
 * Функция flang «Имя сторожа по сообщению».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param imena — «имена»: список: «Имя сторожа»
 * @param soobschenie — «сообщение»: строка
 * @return значение: строка
 */
fl_status kompilyator_flang_imya_storozha_po_soobscheniyu(fl_ctx *ctx, fl_value imena, fl_value soobschenie, fl_value *result, fl_error *error);

/*
 * Функция flang «Сторожа в узле».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param uzel — «узел»: «Значение»
 * @param imena — «имена»: список: «Имя сторожа»
 * @return значение: «Значение»
 */
fl_status kompilyator_flang_storozha_v_uzle(fl_ctx *ctx, fl_value uzel, fl_value imena, fl_value *result, fl_error *error);

/*
 * Функция flang «Сторожа внутри узла».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param uzel — «узел»: «Значение»
 * @param imena — «имена»: список: «Имя сторожа»
 * @param otmetka — «отметка»: «Отметка меры»
 * @return значение: «Значение»
 */
fl_status kompilyator_flang_storozha_vnutri_uzla(fl_ctx *ctx, fl_value uzel, fl_value imena, fl_value otmetka, fl_value *result, fl_error *error);

/*
 * Функция flang «Сторожа в полях».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param polya — «поля»: список: «Поле значения»
 * @param imena — «имена»: список: «Имя сторожа»
 * @return значение: список: «Поле значения»
 */
fl_status kompilyator_flang_storozha_v_polyah(fl_ctx *ctx, fl_value polya, fl_value imena, fl_value *result, fl_error *error);

/*
 * Функция flang «Сторожа в списке».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param elementy — «элементы»: список: «Значение»
 * @param imena — «имена»: список: «Имя сторожа»
 * @return значение: список: «Значение»
 */
fl_status kompilyator_flang_storozha_v_spiske(fl_ctx *ctx, fl_value elementy, fl_value imena, fl_value *result, fl_error *error);

/*
 * Функция flang «Поля без отметки».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param polya — «поля»: список: «Поле значения»
 * @param otmetka — «отметка»: «Отметка меры»
 * @return значение: список: «Поле значения»
 */
fl_status kompilyator_flang_polya_bez_otmetki(fl_ctx *ctx, fl_value polya, fl_value otmetka, fl_value *result, fl_error *error);

/*
 * Функция flang «Имя шага».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param parametr — «параметр»: строка
 * @return значение: строка
 */
fl_status kompilyator_flang_imya_shaga(fl_ctx *ctx, fl_value parametr, fl_value *result, fl_error *error);

/*
 * Функция flang «Вызов сторожа».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param vnutri — «внутри»: «Значение»
 * @param otmetka — «отметка»: «Отметка меры»
 * @param imena — «имена»: список: «Имя сторожа»
 * @param mesto — «место»: «Значение»
 * @return значение: «Значение»
 */
fl_status kompilyator_flang_vyzov_storozha(fl_ctx *ctx, fl_value vnutri, fl_value otmetka, fl_value imena, fl_value mesto, fl_value *result, fl_error *error);

/*
 * Функция flang «Проверка сторожа».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param shag — «шаг»: строка
 * @param otmetka — «отметка»: «Отметка меры»
 * @param imena — «имена»: список: «Имя сторожа»
 * @param mesto — «место»: «Значение»
 * @return значение: «Значение»
 */
fl_status kompilyator_flang_proverka_storozha(fl_ctx *ctx, fl_value shag, fl_value otmetka, fl_value imena, fl_value mesto, fl_value *result, fl_error *error);

/*
 * Функция flang «Шаг меньше меры».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param shag — «шаг»: строка
 * @param parametr — «параметр»: строка
 * @return значение: «Значение»
 */
fl_status kompilyator_flang_shag_menshe_mery(fl_ctx *ctx, fl_value shag, fl_value parametr, fl_value *result, fl_error *error);

/*
 * Функция flang «Отказ сторожа».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param shag — «шаг»: строка
 * @param otmetka — «отметка»: «Отметка меры»
 * @param imena — «имена»: список: «Имя сторожа»
 * @param mesto — «место»: «Значение»
 * @return значение: «Значение»
 */
fl_status kompilyator_flang_otkaz_storozha(fl_ctx *ctx, fl_value shag, fl_value otmetka, fl_value imena, fl_value mesto, fl_value *result, fl_error *error);

/*
 * Функция flang «Тип число при понижении».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @return значение: «Значение»
 */
fl_status kompilyator_flang_tip_chislo_pri_ponizhenii(fl_ctx *ctx, fl_value *result, fl_error *error);

/*
 * Функция flang «Параметр сторожа».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param imya — «имя»: строка
 * @return значение: «Значение»
 */
fl_status kompilyator_flang_parametr_storozha(fl_ctx *ctx, fl_value imya, fl_value *result, fl_error *error);

/*
 * Функция flang «Сравнение сторожа».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @return значение: «Значение»
 */
fl_status kompilyator_flang_sravnenie_storozha(fl_ctx *ctx, fl_value *result, fl_error *error);

/*
 * Функция flang «Постусловие сторожа».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param soobschenie — «сообщение»: строка
 * @return значение: «Значение»
 */
fl_status kompilyator_flang_postuslovie_storozha(fl_ctx *ctx, fl_value soobschenie, fl_value *result, fl_error *error);

/*
 * Функция flang «Печать сторожа при понижении».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param para — «пара»: «Имя сторожа»
 * @return значение: «Значение»
 */
fl_status kompilyator_flang_pechat_storozha_pri_ponizhenii(fl_ctx *ctx, fl_value para, fl_value *result, fl_error *error);

/*
 * Функция flang «Убрать поле при понижении».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param uzel — «узел»: «Значение»
 * @param klyuch — «ключ»: строка
 * @return значение: «Значение»
 */
fl_status kompilyator_flang_ubrat_pole_pri_ponizhenii(fl_ctx *ctx, fl_value uzel, fl_value klyuch, fl_value *result, fl_error *error);

/*
 * Функция flang «Поставить сторожей».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param programma — «программа»: «Значение»
 * @return значение: «Значение»
 */
fl_status kompilyator_flang_postavit_storozhey(fl_ctx *ctx, fl_value programma, fl_value *result, fl_error *error);

/*
 * Функция flang «Поставить сторожей на места».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param programma — «программа»: «Значение»
 * @param soobscheniya — «сообщения»: список: строка
 * @return значение: «Значение»
 */
fl_status kompilyator_flang_postavit_storozhey_na_mesta(fl_ctx *ctx, fl_value programma, fl_value soobscheniya, fl_value *result, fl_error *error);

/*
 * Функция flang «Дефункционализировать».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param programma — «программа»: «Значение»
 * @return значение: «Значение»
 */
fl_status kompilyator_flang_defunkcionalizirovat(fl_ctx *ctx, fl_value programma, fl_value *result, fl_error *error);

/*
 * Функция flang «Понизить программу».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param programma — «программа»: «Значение»
 * @return значение: «Значение»
 */
fl_status kompilyator_flang_ponizit_programmu(fl_ctx *ctx, fl_value programma, fl_value *result, fl_error *error);

/*
 * Функция flang «Назвать диспетчеры».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * Хвостовой самовызов развёрнут в цикл: стек не растёт.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param arnosti — «арности»: список: число
 * @param zanyatye — «занятые»: список: строка
 * @param gotovye — «готовые»: список: «Пара арности»
 * @return значение: список: «Пара арности»
 */
fl_status kompilyator_flang_nazvat_dispetchery(fl_ctx *ctx, fl_value arnosti, fl_value zanyatye, fl_value gotovye, fl_value *result, fl_error *error);

/*
 * Функция flang «Слить узлы при понижении».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * Хвостовой самовызов развёрнут в цикл: стек не растёт.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param pervye — «первые»: список: «Значение»
 * @param vtorye — «вторые»: список: «Значение»
 * @return значение: список: «Значение»
 */
fl_status kompilyator_flang_slit_uzly_pri_ponizhenii(fl_ctx *ctx, fl_value pervye, fl_value vtorye, fl_value *result, fl_error *error);

/*
 * Функция flang «Положить при понижении».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param uzel — «узел»: «Значение»
 * @param klyuch — «ключ»: строка
 * @param znachenie — «значение»: «Значение»
 * @return значение: «Значение»
 */
fl_status kompilyator_flang_polozhit_pri_ponizhenii(fl_ctx *ctx, fl_value uzel, fl_value klyuch, fl_value znachenie, fl_value *result, fl_error *error);

/*
 * Функция flang «Узел ничто».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @return значение: «Значение»
 */
fl_status kompilyator_flang_uzel_nichto(fl_ctx *ctx, fl_value *result, fl_error *error);

/*
 * Функция flang «Первое из полей».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param polya — «поля»: список: «Поле значения»
 * @return значение: «Может быть узел»
 */
fl_status kompilyator_flang_pervoe_iz_poley(fl_ctx *ctx, fl_value polya, fl_value *result, fl_error *error);

/*
 * Функция flang «Поле узла».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param uzel — «узел»: «Значение»
 * @param klyuch — «ключ»: строка
 * @return значение: «Может быть узел»
 */
fl_status kompilyator_flang_pole_uzla(fl_ctx *ctx, fl_value uzel, fl_value klyuch, fl_value *result, fl_error *error);

/*
 * Функция flang «Есть поле у узла».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param uzel — «узел»: «Значение»
 * @param klyuch — «ключ»: строка
 * @return значение
 */
fl_status kompilyator_flang_est_pole_u_uzla(fl_ctx *ctx, fl_value uzel, fl_value klyuch, fl_value *result, fl_error *error);

/*
 * Функция flang «Взять поле».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param uzel — «узел»: «Значение»
 * @param klyuch — «ключ»: строка
 * @return значение: «Значение»
 */
fl_status kompilyator_flang_vzyat_pole(fl_ctx *ctx, fl_value uzel, fl_value klyuch, fl_value *result, fl_error *error);

/*
 * Функция flang «Строка скаляра».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param skalyar — «скаляр»: «Скаляр»
 * @return значение: строка
 */
fl_status kompilyator_flang_stroka_skalyara(fl_ctx *ctx, fl_value skalyar, fl_value *result, fl_error *error);

/*
 * Функция flang «Строка узла».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param uzel — «узел»: «Значение»
 * @return значение: строка
 */
fl_status kompilyator_flang_stroka_uzla(fl_ctx *ctx, fl_value uzel, fl_value *result, fl_error *error);

/*
 * Функция flang «Это строка в скаляре».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param skalyar — «скаляр»: «Скаляр»
 * @return значение
 */
fl_status kompilyator_flang_eto_stroka_v_skalyare(fl_ctx *ctx, fl_value skalyar, fl_value *result, fl_error *error);

/*
 * Функция flang «Это строка».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param uzel — «узел»: «Значение»
 * @return значение
 */
fl_status kompilyator_flang_eto_stroka(fl_ctx *ctx, fl_value uzel, fl_value *result, fl_error *error);

/*
 * Функция flang «Это истина в скаляре».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param skalyar — «скаляр»: «Скаляр»
 * @return значение
 */
fl_status kompilyator_flang_eto_istina_v_skalyare(fl_ctx *ctx, fl_value skalyar, fl_value *result, fl_error *error);

/*
 * Функция flang «Это истина».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param uzel — «узел»: «Значение»
 * @return значение
 */
fl_status kompilyator_flang_eto_istina(fl_ctx *ctx, fl_value uzel, fl_value *result, fl_error *error);

/*
 * Функция flang «Число узла».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param uzel — «узел»: «Значение»
 * @return значение: число
 */
fl_status kompilyator_flang_chislo_uzla(fl_ctx *ctx, fl_value uzel, fl_value *result, fl_error *error);

/*
 * Функция flang «Число скаляра».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param skalyar — «скаляр»: «Скаляр»
 * @return значение: число
 */
fl_status kompilyator_flang_chislo_skalyara(fl_ctx *ctx, fl_value skalyar, fl_value *result, fl_error *error);

/*
 * Функция flang «Это запись».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param uzel — «узел»: «Значение»
 * @return значение
 */
fl_status kompilyator_flang_eto_zapis(fl_ctx *ctx, fl_value uzel, fl_value *result, fl_error *error);

/*
 * Функция flang «Это список».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param uzel — «узел»: «Значение»
 * @return значение
 */
fl_status kompilyator_flang_eto_spisok(fl_ctx *ctx, fl_value uzel, fl_value *result, fl_error *error);

/*
 * Функция flang «Элементы узла».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param uzel — «узел»: «Значение»
 * @return значение: список: «Значение»
 */
fl_status kompilyator_flang_elementy_uzla(fl_ctx *ctx, fl_value uzel, fl_value *result, fl_error *error);

/*
 * Функция flang «Поля узла».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param uzel — «узел»: «Значение»
 * @return значение: список: «Поле значения»
 */
fl_status kompilyator_flang_polya_uzla(fl_ctx *ctx, fl_value uzel, fl_value *result, fl_error *error);

/*
 * Функция flang «Элементы поля».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param uzel — «узел»: «Значение»
 * @param klyuch — «ключ»: строка
 * @return значение: список: «Значение»
 */
fl_status kompilyator_flang_elementy_polya(fl_ctx *ctx, fl_value uzel, fl_value klyuch, fl_value *result, fl_error *error);

/*
 * Функция flang «Строка поля».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param uzel — «узел»: «Значение»
 * @param klyuch — «ключ»: строка
 * @return значение: строка
 */
fl_status kompilyator_flang_stroka_polya(fl_ctx *ctx, fl_value uzel, fl_value klyuch, fl_value *result, fl_error *error);

/*
 * Функция flang «Вид узла».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param uzel — «узел»: «Значение»
 * @return значение: строка
 */
fl_status kompilyator_flang_vid_uzla(fl_ctx *ctx, fl_value uzel, fl_value *result, fl_error *error);

/*
 * Функция flang «Применить замены».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param tekst — «текст»: строка
 * @param zameny — «замены»: список: «Замена»
 * @return значение: строка
 */
fl_status kompilyator_flang_primenit_zameny(fl_ctx *ctx, fl_value tekst, fl_value zameny, fl_value *result, fl_error *error);

/*
 * Функция flang «Замены кириллицы».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @return значение: список: «Замена»
 */
fl_status kompilyator_flang_zameny_kirillicy(fl_ctx *ctx, fl_value *result, fl_error *error);

/*
 * Функция flang «Замены в нижний регистр».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @return значение: список: «Замена»
 */
fl_status kompilyator_flang_zameny_v_nizhniy_registr(fl_ctx *ctx, fl_value *result, fl_error *error);

/*
 * Функция flang «Транслитерировать».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param znachenie — «значение»: строка
 * @return значение: строка
 */
fl_status kompilyator_flang_transliterirovat(fl_ctx *ctx, fl_value znachenie, fl_value *result, fl_error *error);

/*
 * Функция flang «В нижний регистр».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param tekst — «текст»: строка
 * @return значение: строка
 */
fl_status kompilyator_flang_v_nizhniy_registr(fl_ctx *ctx, fl_value tekst, fl_value *result, fl_error *error);

/*
 * Функция flang «Словарные символы».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @return значение: строка
 */
fl_status kompilyator_flang_slovarnye_simvoly(fl_ctx *ctx, fl_value *result, fl_error *error);

/*
 * Функция flang «Дописать слово».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param slovo — «слово»: строка
 * @param gotovye — «готовые»: список: строка
 * @return значение: список: строка
 */
fl_status kompilyator_flang_dopisat_slovo(fl_ctx *ctx, fl_value slovo, fl_value gotovye, fl_value *result, fl_error *error);

/*
 * Функция flang «Слова».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param tekst — «текст»: строка
 * @return значение: список: строка
 */
fl_status kompilyator_flang_slova(fl_ctx *ctx, fl_value tekst, fl_value *result, fl_error *error);

/*
 * Функция flang «Змейка».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param znachenie — «значение»: строка
 * @return значение: строка
 */
fl_status kompilyator_flang_zmeyka(fl_ctx *ctx, fl_value znachenie, fl_value *result, fl_error *error);

/*
 * Функция flang «Замены в верхний регистр».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @return значение: список: «Замена»
 */
fl_status kompilyator_flang_zameny_v_verhniy_registr(fl_ctx *ctx, fl_value *result, fl_error *error);

/*
 * Функция flang «В верхний регистр».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param tekst — «текст»: строка
 * @return значение: строка
 */
fl_status kompilyator_flang_v_verhniy_registr(fl_ctx *ctx, fl_value tekst, fl_value *result, fl_error *error);

/*
 * Функция flang «Первое из пар».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param pary — «пары»: список: «Пара имён»
 * @return значение: «Может быть имя»
 */
fl_status kompilyator_flang_pervoe_iz_par(fl_ctx *ctx, fl_value pary, fl_value *result, fl_error *error);

/*
 * Функция flang «Найти в таблице».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param tablica — «таблица»: список: «Пара имён»
 * @param klyuch — «ключ»: строка
 * @return значение: «Может быть имя»
 */
fl_status kompilyator_flang_nayti_v_tablice(fl_ctx *ctx, fl_value tablica, fl_value klyuch, fl_value *result, fl_error *error);

/*
 * Функция flang «Есть в таблице».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param tablica — «таблица»: список: «Пара имён»
 * @param klyuch — «ключ»: строка
 * @return значение
 */
fl_status kompilyator_flang_est_v_tablice(fl_ctx *ctx, fl_value tablica, fl_value klyuch, fl_value *result, fl_error *error);

/*
 * Функция flang «Значение по ключу».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param tablica — «таблица»: список: «Пара имён»
 * @param klyuch — «ключ»: строка
 * @return значение: строка
 */
fl_status kompilyator_flang_znachenie_po_klyuchu(fl_ctx *ctx, fl_value tablica, fl_value klyuch, fl_value *result, fl_error *error);

/*
 * Функция flang «Обновить пару».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param para — «пара»: «Пара имён»
 * @param klyuch — «ключ»: строка
 * @param znachenie — «значение»: строка
 * @return значение: «Пара имён»
 */
fl_status kompilyator_flang_obnovit_paru(fl_ctx *ctx, fl_value para, fl_value klyuch, fl_value znachenie, fl_value *result, fl_error *error);

/*
 * Функция flang «Положить в таблицу».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param tablica — «таблица»: список: «Пара имён»
 * @param klyuch — «ключ»: строка
 * @param znachenie — «значение»: строка
 * @return значение: список: «Пара имён»
 */
fl_status kompilyator_flang_polozhit_v_tablicu(fl_ctx *ctx, fl_value tablica, fl_value klyuch, fl_value znachenie, fl_value *result, fl_error *error);

/*
 * Функция flang «Символы слова».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @return значение: строка
 */
fl_status kompilyator_flang_simvoly_slova(fl_ctx *ctx, fl_value *result, fl_error *error);

/*
 * Функция flang «Цифры».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @return значение: строка
 */
fl_status kompilyator_flang_cifry(fl_ctx *ctx, fl_value *result, fl_error *error);

/*
 * Функция flang «Первый символ».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param tekst — «текст»: строка
 * @return значение: строка
 */
fl_status kompilyator_flang_pervyy_simvol(fl_ctx *ctx, fl_value tekst, fl_value *result, fl_error *error);

/*
 * Функция flang «Последний символ».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param tekst — «текст»: строка
 * @return значение: строка
 */
fl_status kompilyator_flang_posledniy_simvol(fl_ctx *ctx, fl_value tekst, fl_value *result, fl_error *error);

/*
 * Функция flang «Это символ слова».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param znak — «знак»: строка
 * @return значение
 */
fl_status kompilyator_flang_eto_simvol_slova(fl_ctx *ctx, fl_value znak, fl_value *result, fl_error *error);

/*
 * Функция flang «Граница слова».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param naydeno — «найдено»
 * @param sleva — «слева»: строка
 * @param sprava — «справа»: строка
 * @return значение
 */
fl_status kompilyator_flang_granica_slova(fl_ctx *ctx, fl_value naydeno, fl_value sleva, fl_value sprava, fl_value *result, fl_error *error);

/*
 * Функция flang «Шаг поиска слова».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param akk — «акк»: «Поиск слова»
 * @param chast — «часть»: строка
 * @return значение: «Поиск слова»
 */
fl_status kompilyator_flang_shag_poiska_slova(fl_ctx *ctx, fl_value akk, fl_value chast, fl_value *result, fl_error *error);

/*
 * Функция flang «Пройти части».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param chasti — «части»: список: строка
 * @return значение: «Поиск слова»
 */
fl_status kompilyator_flang_proyti_chasti(fl_ctx *ctx, fl_value chasti, fl_value *result, fl_error *error);

/*
 * Функция flang «Есть слово».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param tekst — «текст»: строка
 * @param slovo — «слово»: строка
 * @return значение
 */
fl_status kompilyator_flang_est_slovo(fl_ctx *ctx, fl_value tekst, fl_value slovo, fl_value *result, fl_error *error);

/*
 * Функция flang «Замены C».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @return значение: список: «Замена»
 */
fl_status kompilyator_flang_zameny_c(fl_ctx *ctx, fl_value *result, fl_error *error);

/*
 * Функция flang «Экранировать C».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param tekst — «текст»: строка
 * @return значение: строка
 */
fl_status kompilyator_flang_ekranirovat_c(fl_ctx *ctx, fl_value tekst, fl_value *result, fl_error *error);

/*
 * Функция flang «Строка C».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param znachenie — «значение»: строка
 * @return значение: строка
 */
fl_status kompilyator_flang_stroka_c(fl_ctx *ctx, fl_value znachenie, fl_value *result, fl_error *error);

/*
 * Функция flang «Ноль C».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param znachenie — «значение»: число
 * @return значение: строка
 */
fl_status kompilyator_flang_nol_c(fl_ctx *ctx, fl_value znachenie, fl_value *result, fl_error *error);

/*
 * Функция flang «Конечное число C».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param znachenie — «значение»: число
 * @param tekst — «текст»: строка
 * @return значение: строка
 */
fl_status kompilyator_flang_konechnoe_chislo_c(fl_ctx *ctx, fl_value znachenie, fl_value tekst, fl_value *result, fl_error *error);

/*
 * Функция flang «Число C».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param znachenie — «значение»: число
 * @return значение: строка
 */
fl_status kompilyator_flang_chislo_c(fl_ctx *ctx, fl_value znachenie, fl_value *result, fl_error *error);

/*
 * Функция flang «Не конечное».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param znachenie — «значение»: число
 * @return значение
 */
fl_status kompilyator_flang_ne_konechnoe(fl_ctx *ctx, fl_value znachenie, fl_value *result, fl_error *error);

/*
 * Функция flang «Зарезервировано в C».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @return значение: список: строка
 */
fl_status kompilyator_flang_zarezervirovano_v_c(fl_ctx *ctx, fl_value *result, fl_error *error);

/*
 * Функция flang «Занято в теле».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @return значение: список: строка
 */
fl_status kompilyator_flang_zanyato_v_tele(fl_ctx *ctx, fl_value *result, fl_error *error);

/*
 * Функция flang «Желаемый идентификатор».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param imya — «имя»: строка
 * @return значение: строка
 */
fl_status kompilyator_flang_zhelaemyy_identifikator(fl_ctx *ctx, fl_value imya, fl_value *result, fl_error *error);

/*
 * Функция flang «Свободное имя».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Хвостовой самовызов развёрнут в цикл: стек не растёт.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param zhelaemoe — «желаемое»: строка
 * @param vzyato — «взято»: список: строка
 * @param suffiks — «суффикс»: число
 * @return значение: строка
 */
fl_status kompilyator_flang_svobodnoe_imya(fl_ctx *ctx, fl_value zhelaemoe, fl_value vzyato, fl_value suffiks, fl_value *result, fl_error *error);

/*
 * Функция flang «Шаг уникальных».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param akk — «акк»: «Набор имён»
 * @param imya — «имя»: строка
 * @return значение: «Набор имён»
 */
fl_status kompilyator_flang_shag_unikalnyh(fl_ctx *ctx, fl_value akk, fl_value imya, fl_value *result, fl_error *error);

/*
 * Функция flang «Уникальные имена».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param imena — «имена»: список: строка
 * @return значение: список: строка
 */
fl_status kompilyator_flang_unikalnye_imena(fl_ctx *ctx, fl_value imena, fl_value *result, fl_error *error);

/*
 * Функция flang «Собрать поле типа».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param uzel — «узел»: «Значение»
 * @return значение: «Поле типа в C»
 */
fl_status kompilyator_flang_sobrat_pole_tipa(fl_ctx *ctx, fl_value uzel, fl_value *result, fl_error *error);

/*
 * Функция flang «Собрать поля типа».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param uzel — «узел»: «Значение»
 * @param klyuch — «ключ»: строка
 * @return значение: список: «Поле типа в C»
 */
fl_status kompilyator_flang_sobrat_polya_tipa(fl_ctx *ctx, fl_value uzel, fl_value klyuch, fl_value *result, fl_error *error);

/*
 * Функция flang «Имена полей типа».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param polya — «поля»: список: «Поле типа в C»
 * @return значение: список: строка
 */
fl_status kompilyator_flang_imena_poley_tipa(fl_ctx *ctx, fl_value polya, fl_value *result, fl_error *error);

/*
 * Функция flang «Собрать параметр в C».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param uzel — «узел»: «Значение»
 * @return значение: «Параметр в C»
 */
fl_status kompilyator_flang_sobrat_parametr_v_c(fl_ctx *ctx, fl_value uzel, fl_value *result, fl_error *error);

/*
 * Функция flang «Строка поля или».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param uzel — «узел»: «Значение»
 * @param klyuch — «ключ»: строка
 * @param po_umolchaniyu — «по умолчанию»: строка
 * @return значение: строка
 */
fl_status kompilyator_flang_stroka_polya_ili(fl_ctx *ctx, fl_value uzel, fl_value klyuch, fl_value po_umolchaniyu, fl_value *result, fl_error *error);

/*
 * Функция flang «Собрать постусловие».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param uzel — «узел»: «Значение»
 * @return значение: «Постусловие»
 */
fl_status kompilyator_flang_sobrat_postuslovie(fl_ctx *ctx, fl_value uzel, fl_value *result, fl_error *error);

/*
 * Функция flang «Собрать функцию».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param uzel — «узел»: «Значение»
 * @return значение: «Функция»
 */
fl_status kompilyator_flang_sobrat_funkciyu(fl_ctx *ctx, fl_value uzel, fl_value *result, fl_error *error);

/*
 * Функция flang «Собрать функции».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param programma — «программа»: «Значение»
 * @return значение: список: «Функция»
 */
fl_status kompilyator_flang_sobrat_funkcii(fl_ctx *ctx, fl_value programma, fl_value *result, fl_error *error);

/*
 * Функция flang «Имена функций».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param funkcii — «функции»: список: «Функция»
 * @return значение: список: строка
 */
fl_status kompilyator_flang_imena_funkciy(fl_ctx *ctx, fl_value funkcii, fl_value *result, fl_error *error);

/*
 * Функция flang «Первая из функций».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param funkcii — «функции»: список: «Функция»
 * @return значение: «Может быть функция»
 */
fl_status kompilyator_flang_pervaya_iz_funkciy(fl_ctx *ctx, fl_value funkcii, fl_value *result, fl_error *error);

/*
 * Функция flang «Найти функцию».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param funkcii — «функции»: список: «Функция»
 * @param imya — «имя»: строка
 * @return значение: «Может быть функция»
 */
fl_status kompilyator_flang_nayti_funkciyu(fl_ctx *ctx, fl_value funkcii, fl_value imya, fl_value *result, fl_error *error);

/*
 * Функция flang «Есть функция с именем».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param funkcii — «функции»: список: «Функция»
 * @param imya — «имя»: строка
 * @return значение
 */
fl_status kompilyator_flang_est_funkciya_s_imenem(fl_ctx *ctx, fl_value funkcii, fl_value imya, fl_value *result, fl_error *error);

/*
 * Функция flang «Число параметров».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param funkcii — «функции»: список: «Функция»
 * @param imya — «имя»: строка
 * @return значение: число
 */
fl_status kompilyator_flang_chislo_parametrov(fl_ctx *ctx, fl_value funkcii, fl_value imya, fl_value *result, fl_error *error);

/*
 * Функция flang «Обновить запись типа».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param prezhnyaya — «прежняя»: «Запись типа»
 * @param novaya — «новая»: «Запись типа»
 * @return значение: «Запись типа»
 */
fl_status kompilyator_flang_obnovit_zapis_tipa(fl_ctx *ctx, fl_value prezhnyaya, fl_value novaya, fl_value *result, fl_error *error);

/*
 * Функция flang «Имена записей».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param zapisi — «записи»: список: «Запись типа»
 * @return значение: список: строка
 */
fl_status kompilyator_flang_imena_zapisey(fl_ctx *ctx, fl_value zapisi, fl_value *result, fl_error *error);

/*
 * Функция flang «Слить запись типа».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param akk — «акк»: список: «Запись типа»
 * @param novaya — «новая»: «Запись типа»
 * @return значение: список: «Запись типа»
 */
fl_status kompilyator_flang_slit_zapis_tipa(fl_ctx *ctx, fl_value akk, fl_value novaya, fl_value *result, fl_error *error);

/*
 * Функция flang «Собрать записи».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param programma — «программа»: «Значение»
 * @return значение: список: «Запись типа»
 */
fl_status kompilyator_flang_sobrat_zapisi(fl_ctx *ctx, fl_value programma, fl_value *result, fl_error *error);

/*
 * Функция flang «Собрать вариант в C».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param uzel — «узел»: «Значение»
 * @return значение: «Вариант типа»
 */
fl_status kompilyator_flang_sobrat_variant_v_c(fl_ctx *ctx, fl_value uzel, fl_value *result, fl_error *error);

/*
 * Функция flang «Собрать суммы».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param programma — «программа»: «Значение»
 * @return значение: список: «Сумма типов в C»
 */
fl_status kompilyator_flang_sobrat_summy(fl_ctx *ctx, fl_value programma, fl_value *result, fl_error *error);

/*
 * Функция flang «Обновить вариант типа».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param prezhniy — «прежний»: «Вариант типа»
 * @param novyy — «новый»: «Вариант типа»
 * @return значение: «Вариант типа»
 */
fl_status kompilyator_flang_obnovit_variant_tipa(fl_ctx *ctx, fl_value prezhniy, fl_value novyy, fl_value *result, fl_error *error);

/*
 * Функция flang «Имена вариантов».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param varianty — «варианты»: список: «Вариант типа»
 * @return значение: список: строка
 */
fl_status kompilyator_flang_imena_variantov(fl_ctx *ctx, fl_value varianty, fl_value *result, fl_error *error);

/*
 * Функция flang «Слить вариант типа».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param akk — «акк»: список: «Вариант типа»
 * @param novyy — «новый»: «Вариант типа»
 * @return значение: список: «Вариант типа»
 */
fl_status kompilyator_flang_slit_variant_tipa(fl_ctx *ctx, fl_value akk, fl_value novyy, fl_value *result, fl_error *error);

/*
 * Функция flang «Слить варианты суммы».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param akk — «акк»: список: «Вариант типа»
 * @param summa — «сумма»: «Сумма типов в C»
 * @return значение: список: «Вариант типа»
 */
fl_status kompilyator_flang_slit_varianty_summy(fl_ctx *ctx, fl_value akk, fl_value summa, fl_value *result, fl_error *error);

/*
 * Функция flang «Собрать варианты в C».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param summy — «суммы»: список: «Сумма типов в C»
 * @return значение: список: «Вариант типа»
 */
fl_status kompilyator_flang_sobrat_varianty_v_c(fl_ctx *ctx, fl_value summy, fl_value *result, fl_error *error);

/*
 * Функция flang «Это ничто».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param uzel — «узел»: «Значение»
 * @return значение
 */
fl_status kompilyator_flang_eto_nichto(fl_ctx *ctx, fl_value uzel, fl_value *result, fl_error *error);

/*
 * Функция flang «Это ничто в скаляре».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param skalyar — «скаляр»: «Скаляр»
 * @return значение
 */
fl_status kompilyator_flang_eto_nichto_v_skalyare(fl_ctx *ctx, fl_value skalyar, fl_value *result, fl_error *error);

/*
 * Функция flang «Первая из меток».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param metki — «метки»: список: «Метка»
 * @return значение: «Может быть число»
 */
fl_status kompilyator_flang_pervaya_iz_metok(fl_ctx *ctx, fl_value metki, fl_value *result, fl_error *error);

/*
 * Функция flang «Найти метку».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param metki — «метки»: список: «Метка»
 * @param klyuch — «ключ»: строка
 * @return значение: «Может быть число»
 */
fl_status kompilyator_flang_nayti_metku(fl_ctx *ctx, fl_value metki, fl_value klyuch, fl_value *result, fl_error *error);

/*
 * Функция flang «Есть метка».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param metki — «метки»: список: «Метка»
 * @param klyuch — «ключ»: строка
 * @return значение
 */
fl_status kompilyator_flang_est_metka(fl_ctx *ctx, fl_value metki, fl_value klyuch, fl_value *result, fl_error *error);

/*
 * Функция flang «Метка или ноль».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param metki — «метки»: список: «Метка»
 * @param klyuch — «ключ»: строка
 * @return значение: число
 */
fl_status kompilyator_flang_metka_ili_nol(fl_ctx *ctx, fl_value metki, fl_value klyuch, fl_value *result, fl_error *error);

/*
 * Функция flang «Обновить метку».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param metka — «метка»: «Метка»
 * @param klyuch — «ключ»: строка
 * @param znachenie — «значение»: число
 * @return значение: «Метка»
 */
fl_status kompilyator_flang_obnovit_metku(fl_ctx *ctx, fl_value metka, fl_value klyuch, fl_value znachenie, fl_value *result, fl_error *error);

/*
 * Функция flang «Положить метку».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param metki — «метки»: список: «Метка»
 * @param klyuch — «ключ»: строка
 * @param znachenie — «значение»: число
 * @return значение: список: «Метка»
 */
fl_status kompilyator_flang_polozhit_metku(fl_ctx *ctx, fl_value metki, fl_value klyuch, fl_value znachenie, fl_value *result, fl_error *error);

/*
 * Функция flang «Меньшее».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param pervoe — «первое»: число
 * @param vtoroe — «второе»: число
 * @return значение: число
 */
fl_status kompilyator_flang_menshee(fl_ctx *ctx, fl_value pervoe, fl_value vtoroe, fl_value *result, fl_error *error);

/*
 * Функция flang «Цели».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param ryobra — «рёбра»: список: «Рёбра»
 * @param imya — «имя»: строка
 * @return значение: список: строка
 */
fl_status kompilyator_flang_celi(fl_ctx *ctx, fl_value ryobra, fl_value imya, fl_value *result, fl_error *error);

/*
 * Функция flang «Добавить уникальное».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param imya — «имя»: строка
 * @param naydeno — «найдено»: список: строка
 * @return значение: список: строка
 */
fl_status kompilyator_flang_dobavit_unikalnoe(fl_ctx *ctx, fl_value imya, fl_value naydeno, fl_value *result, fl_error *error);

/*
 * Функция flang «Добавить имя вызова».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param uzel — «узел»: «Значение»
 * @param naydeno — «найдено»: список: строка
 * @return значение: список: строка
 */
fl_status kompilyator_flang_dobavit_imya_vyzova(fl_ctx *ctx, fl_value uzel, fl_value naydeno, fl_value *result, fl_error *error);

/*
 * Функция flang «Тело пусть».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param uzel — «узел»: «Значение»
 * @return значение: «Значение»
 */
fl_status kompilyator_flang_telo_pust(fl_ctx *ctx, fl_value uzel, fl_value *result, fl_error *error);

/*
 * Функция flang «Обход хвоста случая».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param sluchay — «случай»: «Значение»
 * @param naydeno — «найдено»: список: строка
 * @return значение: список: строка
 */
fl_status kompilyator_flang_obhod_hvosta_sluchaya(fl_ctx *ctx, fl_value sluchay, fl_value naydeno, fl_value *result, fl_error *error);

/*
 * Функция flang «Обход хвоста случаев».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param sluchai — «случаи»: список: «Значение»
 * @param naydeno — «найдено»: список: строка
 * @return значение: список: строка
 */
fl_status kompilyator_flang_obhod_hvosta_sluchaev(fl_ctx *ctx, fl_value sluchai, fl_value naydeno, fl_value *result, fl_error *error);

/*
 * Функция flang «Обход хвоста».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Хвостовой самовызов развёрнут в цикл: стек не растёт.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param uzel — «узел»: «Значение»
 * @param naydeno — «найдено»: список: строка
 * @return значение: список: строка
 */
fl_status kompilyator_flang_obhod_hvosta(fl_ctx *ctx, fl_value uzel, fl_value naydeno, fl_value *result, fl_error *error);

/*
 * Функция flang «Обход хвоста ветвей».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param uzel — «узел»: «Значение»
 * @param naydeno — «найдено»: список: строка
 * @return значение: список: строка
 */
fl_status kompilyator_flang_obhod_hvosta_vetvey(fl_ctx *ctx, fl_value uzel, fl_value naydeno, fl_value *result, fl_error *error);

/*
 * Функция flang «Хвостовые вызовы».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param funkciya — «функция»: «Функция»
 * @return значение: список: строка
 */
fl_status kompilyator_flang_hvostovye_vyzovy(fl_ctx *ctx, fl_value funkciya, fl_value *result, fl_error *error);

/*
 * Функция flang «Добавить вызов».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param uzel — «узел»: «Значение»
 * @param naydeno — «найдено»: список: строка
 * @return значение: список: строка
 */
fl_status kompilyator_flang_dobavit_vyzov(fl_ctx *ctx, fl_value uzel, fl_value naydeno, fl_value *result, fl_error *error);

/*
 * Функция flang «Обход всего».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param uzel — «узел»: «Значение»
 * @param naydeno — «найдено»: список: строка
 * @return значение: список: строка
 */
fl_status kompilyator_flang_obhod_vsego(fl_ctx *ctx, fl_value uzel, fl_value naydeno, fl_value *result, fl_error *error);

/*
 * Функция flang «Обход полей».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param polya — «поля»: список: «Поле значения»
 * @param naydeno — «найдено»: список: строка
 * @return значение: список: строка
 */
fl_status kompilyator_flang_obhod_poley(fl_ctx *ctx, fl_value polya, fl_value naydeno, fl_value *result, fl_error *error);

/*
 * Функция flang «Все вызовы».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param funkciya — «функция»: «Функция»
 * @return значение: список: строка
 */
fl_status kompilyator_flang_vse_vyzovy(fl_ctx *ctx, fl_value funkciya, fl_value *result, fl_error *error);

/*
 * Функция flang «Шаг отрезания».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param akk — «акк»: «Отрезание»
 * @param element — «элемент»: строка
 * @param predel — «предел»: число
 * @return значение: «Отрезание»
 */
fl_status kompilyator_flang_shag_otrezaniya(fl_ctx *ctx, fl_value akk, fl_value element, fl_value predel, fl_value *result, fl_error *error);

/*
 * Функция flang «Без последней строки».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param stroki — «строки»: список: строка
 * @return значение: список: строка
 */
fl_status kompilyator_flang_bez_posledney_stroki(fl_ctx *ctx, fl_value stroki, fl_value *result, fl_error *error);

/*
 * Функция flang «Последняя строка».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param stroki — «строки»: список: строка
 * @return значение: строка
 */
fl_status kompilyator_flang_poslednyaya_stroka(fl_ctx *ctx, fl_value stroki, fl_value *result, fl_error *error);

/*
 * Функция flang «Записать компоненту».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param sostoyanie — «состояние»: «Тарьян»
 * @param nabrano — «набрано»: список: строка
 * @return значение: «Тарьян»
 */
fl_status kompilyator_flang_zapisat_komponentu(fl_ctx *ctx, fl_value sostoyanie, fl_value nabrano, fl_value *result, fl_error *error);

/*
 * Функция flang «Снять компоненту».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Взаимная хвостовая рекурсия с «Снять вершину стека»: вызовы идут через батут.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param sostoyanie — «состояние»: «Тарьян»
 * @param imya — «имя»: строка
 * @param nabrano — «набрано»: список: строка
 * @return значение: «Тарьян»
 */
fl_status kompilyator_flang_snyat_komponentu(fl_ctx *ctx, fl_value sostoyanie, fl_value imya, fl_value nabrano, fl_value *result, fl_error *error);

/*
 * Функция flang «Снять вершину стека».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Взаимная хвостовая рекурсия с «Снять компоненту»: вызовы идут через батут.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param sostoyanie — «состояние»: «Тарьян»
 * @param imya — «имя»: строка
 * @param nabrano — «набрано»: список: строка
 * @return значение: «Тарьян»
 */
fl_status kompilyator_flang_snyat_vershinu_steka(fl_ctx *ctx, fl_value sostoyanie, fl_value imya, fl_value nabrano, fl_value *result, fl_error *error);

/*
 * Функция flang «Заменить низ».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param sostoyanie — «состояние»: «Тарьян»
 * @param imya — «имя»: строка
 * @param niz — «низ»: число
 * @return значение: «Тарьян»
 */
fl_status kompilyator_flang_zamenit_niz(fl_ctx *ctx, fl_value sostoyanie, fl_value imya, fl_value niz, fl_value *result, fl_error *error);

/*
 * Функция flang «Обратное ребро».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param sostoyanie — «состояние»: «Тарьян»
 * @param imya — «имя»: строка
 * @param cel — «цель»: строка
 * @return значение: «Тарьян»
 */
fl_status kompilyator_flang_obratnoe_rebro(fl_ctx *ctx, fl_value sostoyanie, fl_value imya, fl_value cel, fl_value *result, fl_error *error);

/*
 * Функция flang «Закрыть вершину».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param sostoyanie — «состояние»: «Тарьян»
 * @param imya — «имя»: строка
 * @return значение: «Тарьян»
 */
fl_status kompilyator_flang_zakryt_vershinu(fl_ctx *ctx, fl_value sostoyanie, fl_value imya, fl_value *result, fl_error *error);

/*
 * Функция flang «Ребро вглубь».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param sostoyanie — «состояние»: «Тарьян»
 * @param imya — «имя»: строка
 * @param cel — «цель»: строка
 * @param imena — «имена»: список: строка
 * @param ryobra — «рёбра»: список: «Рёбра»
 * @return значение: «Тарьян»
 */
fl_status kompilyator_flang_rebro_vglub(fl_ctx *ctx, fl_value sostoyanie, fl_value imya, fl_value cel, fl_value imena, fl_value ryobra, fl_value *result, fl_error *error);

/*
 * Функция flang «Ребро внутри».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param sostoyanie — «состояние»: «Тарьян»
 * @param imya — «имя»: строка
 * @param cel — «цель»: строка
 * @param imena — «имена»: список: строка
 * @param ryobra — «рёбра»: список: «Рёбра»
 * @return значение: «Тарьян»
 */
fl_status kompilyator_flang_rebro_vnutri(fl_ctx *ctx, fl_value sostoyanie, fl_value imya, fl_value cel, fl_value imena, fl_value ryobra, fl_value *result, fl_error *error);

/*
 * Функция flang «Ребро Тарьяна».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param sostoyanie — «состояние»: «Тарьян»
 * @param imya — «имя»: строка
 * @param cel — «цель»: строка
 * @param imena — «имена»: список: строка
 * @param ryobra — «рёбра»: список: «Рёбра»
 * @return значение: «Тарьян»
 */
fl_status kompilyator_flang_rebro_taryana(fl_ctx *ctx, fl_value sostoyanie, fl_value imya, fl_value cel, fl_value imena, fl_value ryobra, fl_value *result, fl_error *error);

/*
 * Функция flang «Обойти вершину».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param sostoyanie — «состояние»: «Тарьян»
 * @param imya — «имя»: строка
 * @param imena — «имена»: список: строка
 * @param ryobra — «рёбра»: список: «Рёбра»
 * @return значение: «Тарьян»
 */
fl_status kompilyator_flang_oboyti_vershinu(fl_ctx *ctx, fl_value sostoyanie, fl_value imya, fl_value imena, fl_value ryobra, fl_value *result, fl_error *error);

/*
 * Функция flang «Корень Тарьяна».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param sostoyanie — «состояние»: «Тарьян»
 * @param imya — «имя»: строка
 * @param imena — «имена»: список: строка
 * @param ryobra — «рёбра»: список: «Рёбра»
 * @return значение: «Тарьян»
 */
fl_status kompilyator_flang_koren_taryana(fl_ctx *ctx, fl_value sostoyanie, fl_value imya, fl_value imena, fl_value ryobra, fl_value *result, fl_error *error);

/*
 * Функция flang «Компоненты связности».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param imena — «имена»: список: строка
 * @param ryobra — «рёбра»: список: «Рёбра»
 * @return значение: список: «Компонента»
 */
fl_status kompilyator_flang_komponenty_svyaznosti(fl_ctx *ctx, fl_value imena, fl_value ryobra, fl_value *result, fl_error *error);

/*
 * Функция flang «Имя модуля».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param programma — «программа»: «Значение»
 * @return значение: строка
 */
fl_status kompilyator_flang_imya_modulya(fl_ctx *ctx, fl_value programma, fl_value *result, fl_error *error);

/*
 * Функция flang «Есть имя модуля».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param programma — «программа»: «Значение»
 * @return значение
 */
fl_status kompilyator_flang_est_imya_modulya(fl_ctx *ctx, fl_value programma, fl_value *result, fl_error *error);

/*
 * Функция flang «Префикс программы».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param programma — «программа»: «Значение»
 * @return значение: строка
 */
fl_status kompilyator_flang_prefiks_programmy(fl_ctx *ctx, fl_value programma, fl_value *result, fl_error *error);

/*
 * Функция flang «Идентификаторы параметров».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param funkciya — «функция»: «Функция»
 * @return значение: «Именованные идентификаторы»
 */
fl_status kompilyator_flang_identifikatory_parametrov(fl_ctx *ctx, fl_value funkciya, fl_value *result, fl_error *error);

/*
 * Функция flang «Идентификаторы для».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param tablica — «таблица»: список: «Именованные идентификаторы»
 * @param imya — «имя»: строка
 * @return значение: список: строка
 */
fl_status kompilyator_flang_identifikatory_dlya(fl_ctx *ctx, fl_value tablica, fl_value imya, fl_value *result, fl_error *error);

/*
 * Функция flang «Идентификатор с ролью».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param prefiks — «префикс»: строка
 * @param rol — «роль»: строка
 * @param imya — «имя»: строка
 * @return значение: строка
 */
fl_status kompilyator_flang_identifikator_s_rolyu(fl_ctx *ctx, fl_value prefiks, fl_value rol, fl_value imya, fl_value *result, fl_error *error);

/*
 * Функция flang «Таблица фабрик».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param prefiks — «префикс»: строка
 * @param zapisi — «записи»: список: «Запись типа»
 * @return значение: список: «Пара имён»
 */
fl_status kompilyator_flang_tablica_fabrik(fl_ctx *ctx, fl_value prefiks, fl_value zapisi, fl_value *result, fl_error *error);

/*
 * Функция flang «Таблица вариантов».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param prefiks — «префикс»: строка
 * @param varianty — «варианты»: список: «Вариант типа»
 * @return значение: список: «Пара имён»
 */
fl_status kompilyator_flang_tablica_variantov(fl_ctx *ctx, fl_value prefiks, fl_value varianty, fl_value *result, fl_error *error);

/*
 * Функция flang «Таблица функций».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param prefiks — «префикс»: строка
 * @param funkcii — «функции»: список: «Функция»
 * @return значение: список: «Пара имён»
 */
fl_status kompilyator_flang_tablica_funkciy(fl_ctx *ctx, fl_value prefiks, fl_value funkcii, fl_value *result, fl_error *error);

/*
 * Функция flang «Хвостовые рёбра».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param funkcii — «функции»: список: «Функция»
 * @return значение: список: «Рёбра»
 */
fl_status kompilyator_flang_hvostovye_ryobra(fl_ctx *ctx, fl_value funkcii, fl_value *result, fl_error *error);

/*
 * Функция flang «Рёбра вызовов».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param funkcii — «функции»: список: «Функция»
 * @return значение: список: «Рёбра»
 */
fl_status kompilyator_flang_ryobra_vyzovov(fl_ctx *ctx, fl_value funkcii, fl_value *result, fl_error *error);

/*
 * Функция flang «Члены компоненты».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param komponenta — «компонента»: «Компонента»
 * @return значение: список: «Рёбра»
 */
fl_status kompilyator_flang_chleny_komponenty(fl_ctx *ctx, fl_value komponenta, fl_value *result, fl_error *error);

/*
 * Функция flang «Слить рёбра».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param akk — «акк»: список: «Рёбра»
 * @param dobavka — «добавка»: список: «Рёбра»
 * @return значение: список: «Рёбра»
 */
fl_status kompilyator_flang_slit_ryobra(fl_ctx *ctx, fl_value akk, fl_value dobavka, fl_value *result, fl_error *error);

/*
 * Функция flang «Циклические функции».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param komponenty — «компоненты»: список: «Компонента»
 * @return значение: список: «Рёбра»
 */
fl_status kompilyator_flang_ciklicheskie_funkcii(fl_ctx *ctx, fl_value komponenty, fl_value *result, fl_error *error);

/*
 * Функция flang «Слить строки».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param akk — «акк»: список: строка
 * @param dobavka — «добавка»: список: строка
 * @return значение: список: строка
 */
fl_status kompilyator_flang_slit_stroki(fl_ctx *ctx, fl_value akk, fl_value dobavka, fl_value *result, fl_error *error);

/*
 * Функция flang «Рекурсивная одиночка».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param komponenta — «компонента»: «Компонента»
 * @param ryobra — «рёбра»: список: «Рёбра»
 * @return значение: список: строка
 */
fl_status kompilyator_flang_rekursivnaya_odinochka(fl_ctx *ctx, fl_value komponenta, fl_value ryobra, fl_value *result, fl_error *error);

/*
 * Функция flang «Шаг рекурсивных».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param akk — «акк»: список: строка
 * @param komponenta — «компонента»: «Компонента»
 * @param ryobra — «рёбра»: список: «Рёбра»
 * @return значение: список: строка
 */
fl_status kompilyator_flang_shag_rekursivnyh(fl_ctx *ctx, fl_value akk, fl_value komponenta, fl_value ryobra, fl_value *result, fl_error *error);

/*
 * Функция flang «Рекурсивные функции».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param komponenty — «компоненты»: список: «Компонента»
 * @param ryobra — «рёбра»: список: «Рёбра»
 * @return значение: список: строка
 */
fl_status kompilyator_flang_rekursivnye_funkcii(fl_ctx *ctx, fl_value komponenty, fl_value ryobra, fl_value *result, fl_error *error);

/*
 * Функция flang «Таблица шагов».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param ciklicheskie — «циклические»: список: «Рёбра»
 * @param id_funkciy — «ид функций»: список: «Пара имён»
 * @return значение: список: «Пара имён»
 */
fl_status kompilyator_flang_tablica_shagov(fl_ctx *ctx, fl_value ciklicheskie, fl_value id_funkciy, fl_value *result, fl_error *error);

/*
 * Функция flang «Собрать общее».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param programma — «программа»: «Значение»
 * @return значение: «Общее»
 */
fl_status kompilyator_flang_sobrat_obschee(fl_ctx *ctx, fl_value programma, fl_value *result, fl_error *error);

/*
 * Функция flang «Однобайтовые».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @return значение: строка
 */
fl_status kompilyator_flang_odnobaytovye(fl_ctx *ctx, fl_value *result, fl_error *error);

/*
 * Функция flang «Двухбайтовые».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @return значение: список: строка
 */
fl_status kompilyator_flang_dvuhbaytovye(fl_ctx *ctx, fl_value *result, fl_error *error);

/*
 * Функция flang «Двухбайтовый».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param znak — «знак»: строка
 * @return значение
 */
fl_status kompilyator_flang_dvuhbaytovyy(fl_ctx *ctx, fl_value znak, fl_value *result, fl_error *error);

/*
 * Функция flang «Байтов у символа».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param znak — «знак»: строка
 * @return значение: число
 */
fl_status kompilyator_flang_baytov_u_simvola(fl_ctx *ctx, fl_value znak, fl_value *result, fl_error *error);

/*
 * Функция flang «Байтов в строке».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param tekst — «текст»: строка
 * @return значение: число
 */
fl_status kompilyator_flang_baytov_v_stroke(fl_ctx *ctx, fl_value tekst, fl_value *result, fl_error *error);

/*
 * Функция flang «Пустое состояние».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @return значение: «Состояние»
 */
fl_status kompilyator_flang_pustoe_sostoyanie(fl_ctx *ctx, fl_value *result, fl_error *error);

/*
 * Функция flang «Заменить счётчик».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param sostoyanie — «состояние»: «Состояние»
 * @param schyotchik — «счётчик»: число
 * @return значение: «Состояние»
 */
fl_status kompilyator_flang_zamenit_schyotchik(fl_ctx *ctx, fl_value sostoyanie, fl_value schyotchik, fl_value *result, fl_error *error);

/*
 * Функция flang «Заменить взятое».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param sostoyanie — «состояние»: «Состояние»
 * @param vzyato — «взято»: список: строка
 * @return значение: «Состояние»
 */
fl_status kompilyator_flang_zamenit_vzyatoe(fl_ctx *ctx, fl_value sostoyanie, fl_value vzyato, fl_value *result, fl_error *error);

/*
 * Функция flang «Заменить статику».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param sostoyanie — «состояние»: «Состояние»
 * @param statika — «статика»: строка
 * @param klyuchi — «ключи»: список: «Пара имён»
 * @return значение: «Состояние»
 */
fl_status kompilyator_flang_zamenit_statiku(fl_ctx *ctx, fl_value sostoyanie, fl_value statika, fl_value klyuchi, fl_value *result, fl_error *error);

/*
 * Функция flang «Включить математику».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param sostoyanie — «состояние»: «Состояние»
 * @return значение: «Состояние»
 */
fl_status kompilyator_flang_vklyuchit_matematiku(fl_ctx *ctx, fl_value sostoyanie, fl_value *result, fl_error *error);

/*
 * Функция flang «Записать ошибку».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param sostoyanie — «состояние»: «Состояние»
 * @param tekst — «текст»: строка
 * @return значение: «Состояние»
 */
fl_status kompilyator_flang_zapisat_oshibku(fl_ctx *ctx, fl_value sostoyanie, fl_value tekst, fl_value *result, fl_error *error);

/*
 * Функция flang «Временное».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param sostoyanie — «состояние»: «Состояние»
 * @return значение: «Свежее»
 */
fl_status kompilyator_flang_vremennoe(fl_ctx *ctx, fl_value sostoyanie, fl_value *result, fl_error *error);

/*
 * Функция flang «Свежее имя».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param sostoyanie — «состояние»: «Состояние»
 * @param imya — «имя»: строка
 * @return значение: «Свежее»
 */
fl_status kompilyator_flang_svezhee_imya(fl_ctx *ctx, fl_value sostoyanie, fl_value imya, fl_value *result, fl_error *error);

/*
 * Функция flang «Строка вывода».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param otstup — «отступ»: строка
 * @param tekst — «текст»: строка
 * @return значение: строка
 */
fl_status kompilyator_flang_stroka_vyvoda(fl_ctx *ctx, fl_value otstup, fl_value tekst, fl_value *result, fl_error *error);

/*
 * Функция flang «Связать имя в C».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param kontekst — «контекст»: «Контекст»
 * @param imya — «имя»: строка
 * @param identifikator — «идентификатор»: строка
 * @return значение: «Контекст»
 */
fl_status kompilyator_flang_svyazat_imya_v_c(fl_ctx *ctx, fl_value kontekst, fl_value imya, fl_value identifikator, fl_value *result, fl_error *error);

/*
 * Функция flang «Ключ массива имён».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param imena — «имена»: список: строка
 * @return значение: строка
 */
fl_status kompilyator_flang_klyuch_massiva_imyon(fl_ctx *ctx, fl_value imena, fl_value *result, fl_error *error);

/*
 * Функция flang «Новый массив имён».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param sostoyanie — «состояние»: «Состояние»
 * @param prefiks — «префикс»: строка
 * @param imena — «имена»: список: строка
 * @param klyuch — «ключ»: строка
 * @return значение: «Свежее»
 */
fl_status kompilyator_flang_novyy_massiv_imyon(fl_ctx *ctx, fl_value sostoyanie, fl_value prefiks, fl_value imena, fl_value klyuch, fl_value *result, fl_error *error);

/*
 * Функция flang «Массив имён».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param sostoyanie — «состояние»: «Состояние»
 * @param prefiks — «префикс»: строка
 * @param imena — «имена»: список: строка
 * @return значение: «Свежее»
 */
fl_status kompilyator_flang_massiv_imyon(fl_ctx *ctx, fl_value sostoyanie, fl_value prefiks, fl_value imena, fl_value *result, fl_error *error);

/*
 * Функция flang «Массив имён по ключу».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param sostoyanie — «состояние»: «Состояние»
 * @param prefiks — «префикс»: строка
 * @param imena — «имена»: список: строка
 * @param klyuch — «ключ»: строка
 * @return значение: «Свежее»
 */
fl_status kompilyator_flang_massiv_imyon_po_klyuchu(fl_ctx *ctx, fl_value sostoyanie, fl_value prefiks, fl_value imena, fl_value klyuch, fl_value *result, fl_error *error);

/*
 * Функция flang «Новый текстовый литерал».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param sostoyanie — «состояние»: «Состояние»
 * @param prefiks — «префикс»: строка
 * @param tekst — «текст»: строка
 * @param klyuch — «ключ»: строка
 * @return значение: «Свежее»
 */
fl_status kompilyator_flang_novyy_tekstovyy_literal(fl_ctx *ctx, fl_value sostoyanie, fl_value prefiks, fl_value tekst, fl_value klyuch, fl_value *result, fl_error *error);

/*
 * Функция flang «Текстовый литерал».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param sostoyanie — «состояние»: «Состояние»
 * @param prefiks — «префикс»: строка
 * @param tekst — «текст»: строка
 * @return значение: «Свежее»
 */
fl_status kompilyator_flang_tekstovyy_literal(fl_ctx *ctx, fl_value sostoyanie, fl_value prefiks, fl_value tekst, fl_value *result, fl_error *error);

/*
 * Функция flang «Синонимы форм».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @return значение: список: «Пара имён»
 */
fl_status kompilyator_flang_sinonimy_form(fl_ctx *ctx, fl_value *result, fl_error *error);

/*
 * Функция flang «Каноническое имя формы».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param imya — «имя»: строка
 * @return значение: строка
 */
fl_status kompilyator_flang_kanonicheskoe_imya_formy(fl_ctx *ctx, fl_value imya, fl_value *result, fl_error *error);

/*
 * Функция flang «Помощники форм».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @return значение: список: «Пара имён»
 */
fl_status kompilyator_flang_pomoschniki_form(fl_ctx *ctx, fl_value *result, fl_error *error);

/*
 * Функция flang «Арности форм».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @return значение: список: «Метка»
 */
fl_status kompilyator_flang_arnosti_form(fl_ctx *ctx, fl_value *result, fl_error *error);

/*
 * Функция flang «Помощники операций».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @return значение: список: «Пара имён»
 */
fl_status kompilyator_flang_pomoschniki_operaciy(fl_ctx *ctx, fl_value *result, fl_error *error);

/*
 * Функция flang «Слово аргументов».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param kolichestvo — «количество»: число
 * @return значение: строка
 */
fl_status kompilyator_flang_slovo_argumentov(fl_ctx *ctx, fl_value kolichestvo, fl_value *result, fl_error *error);

/*
 * Функция flang «Между».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param znachenie — «значение»: число
 * @param ot — «от»: число
 * @param do_2 — «до»: число
 * @return значение
 */
fl_status kompilyator_flang_mezhdu(fl_ctx *ctx, fl_value znachenie, fl_value ot, fl_value do_2, fl_value *result, fl_error *error);

/*
 * Функция flang «Шаг выбора».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param akk — «акк»: «Зип»
 * @param element — «элемент»: строка
 * @param iskomyy — «искомый»: число
 * @return значение: «Зип»
 */
fl_status kompilyator_flang_shag_vybora(fl_ctx *ctx, fl_value akk, fl_value element, fl_value iskomyy, fl_value *result, fl_error *error);

/*
 * Функция flang «Элемент по индексу».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param stroki — «строки»: список: строка
 * @param indeks — «индекс»: число
 * @return значение: строка
 */
fl_status kompilyator_flang_element_po_indeksu(fl_ctx *ctx, fl_value stroki, fl_value indeks, fl_value *result, fl_error *error);

/*
 * Функция flang «Не встречается».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param vyvod — «вывод»: строка
 * @param identifikator — «идентификатор»: строка
 * @return значение
 */
fl_status kompilyator_flang_ne_vstrechaetsya(fl_ctx *ctx, fl_value vyvod, fl_value identifikator, fl_value *result, fl_error *error);

/*
 * Функция flang «Гасить неиспользованные».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param vyvod — «вывод»: строка
 * @param identifikatory — «идентификаторы»: список: строка
 * @param otstup — «отступ»: строка
 * @return значение: строка
 */
fl_status kompilyator_flang_gasit_neispolzovannye(fl_ctx *ctx, fl_value vyvod, fl_value identifikatory, fl_value otstup, fl_value *result, fl_error *error);

/*
 * Функция flang «Только символы слова».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param tekst — «текст»: строка
 * @return значение
 */
fl_status kompilyator_flang_tolko_simvoly_slova(fl_ctx *ctx, fl_value tekst, fl_value *result, fl_error *error);

/*
 * Функция flang «Это идентификатор».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param tekst — «текст»: строка
 * @return значение
 */
fl_status kompilyator_flang_eto_identifikator(fl_ctx *ctx, fl_value tekst, fl_value *result, fl_error *error);

/*
 * Функция flang «Аргументы после ctx».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param argumenty — «аргументы»: список: строка
 * @return значение: строка
 */
fl_status kompilyator_flang_argumenty_posle_ctx(fl_ctx *ctx, fl_value argumenty, fl_value *result, fl_error *error);

/*
 * Функция flang «Пустая сборка».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param sostoyanie — «состояние»: «Состояние»
 * @return значение: «Сборка»
 */
fl_status kompilyator_flang_pustaya_sborka(fl_ctx *ctx, fl_value sostoyanie, fl_value *result, fl_error *error);

/*
 * Функция flang «Печать скаляра C».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param skalyar — «скаляр»: «Скаляр»
 * @param sostoyanie — «состояние»: «Состояние»
 * @param prefiks — «префикс»: строка
 * @return значение: «Итог»
 */
fl_status kompilyator_flang_pechat_skalyara_c(fl_ctx *ctx, fl_value skalyar, fl_value sostoyanie, fl_value prefiks, fl_value *result, fl_error *error);

/*
 * Функция flang «Печать признака C».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param znachenie — «значение»
 * @param sostoyanie — «состояние»: «Состояние»
 * @return значение: «Итог»
 */
fl_status kompilyator_flang_pechat_priznaka_c(fl_ctx *ctx, fl_value znachenie, fl_value sostoyanie, fl_value *result, fl_error *error);

/*
 * Функция flang «Печать числа C».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param znachenie — «значение»: число
 * @param sostoyanie — «состояние»: «Состояние»
 * @return значение: «Итог»
 */
fl_status kompilyator_flang_pechat_chisla_c(fl_ctx *ctx, fl_value znachenie, fl_value sostoyanie, fl_value *result, fl_error *error);

/*
 * Функция flang «Печать текста C».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param znachenie — «значение»: строка
 * @param sostoyanie — «состояние»: «Состояние»
 * @param prefiks — «префикс»: строка
 * @return значение: «Итог»
 */
fl_status kompilyator_flang_pechat_teksta_c(fl_ctx *ctx, fl_value znachenie, fl_value sostoyanie, fl_value prefiks, fl_value *result, fl_error *error);

/*
 * Функция flang «Печать литерала».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param uzel — «узел»: «Значение»
 * @param kontekst — «контекст»: «Контекст»
 * @param sostoyanie — «состояние»: «Состояние»
 * @param otstup — «отступ»: строка
 * @return значение: «Итог»
 */
fl_status kompilyator_flang_pechat_literala(fl_ctx *ctx, fl_value uzel, fl_value kontekst, fl_value sostoyanie, fl_value otstup, fl_value *result, fl_error *error);

/*
 * Функция flang «Печать элемента».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param uzel — «узел»: «Значение»
 * @param literal — «литерал»
 * @param kontekst — «контекст»: «Контекст»
 * @param sostoyanie — «состояние»: «Состояние»
 * @param otstup — «отступ»: строка
 * @return значение: «Итог»
 */
fl_status kompilyator_flang_pechat_elementa(fl_ctx *ctx, fl_value uzel, fl_value literal, fl_value kontekst, fl_value sostoyanie, fl_value otstup, fl_value *result, fl_error *error);

/*
 * Функция flang «Шаг списка».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param akk — «акк»: «Сборка»
 * @param uzel — «узел»: «Значение»
 * @param literal — «литерал»
 * @param kontekst — «контекст»: «Контекст»
 * @param otstup — «отступ»: строка
 * @param massiv — «массив»: строка
 * @return значение: «Сборка»
 */
fl_status kompilyator_flang_shag_spiska(fl_ctx *ctx, fl_value akk, fl_value uzel, fl_value literal, fl_value kontekst, fl_value otstup, fl_value massiv, fl_value *result, fl_error *error);

/*
 * Функция flang «Печать списка».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param elementy — «элементы»: список: «Значение»
 * @param literal — «литерал»
 * @param kontekst — «контекст»: «Контекст»
 * @param sostoyanie — «состояние»: «Состояние»
 * @param otstup — «отступ»: строка
 * @return значение: «Итог»
 */
fl_status kompilyator_flang_pechat_spiska(fl_ctx *ctx, fl_value elementy, fl_value literal, fl_value kontekst, fl_value sostoyanie, fl_value otstup, fl_value *result, fl_error *error);

/*
 * Функция flang «Печать непустого списка».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param elementy — «элементы»: список: «Значение»
 * @param literal — «литерал»
 * @param kontekst — «контекст»: «Контекст»
 * @param sostoyanie — «состояние»: «Состояние»
 * @param otstup — «отступ»: строка
 * @return значение: «Итог»
 */
fl_status kompilyator_flang_pechat_nepustogo_spiska(fl_ctx *ctx, fl_value elementy, fl_value literal, fl_value kontekst, fl_value sostoyanie, fl_value otstup, fl_value *result, fl_error *error);

/*
 * Функция flang «Шаг поля».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param akk — «акк»: «Сборка»
 * @param pole — «поле»: «Поле значения»
 * @param literal — «литерал»
 * @param kontekst — «контекст»: «Контекст»
 * @param otstup — «отступ»: строка
 * @return значение: «Сборка»
 */
fl_status kompilyator_flang_shag_polya(fl_ctx *ctx, fl_value akk, fl_value pole, fl_value literal, fl_value kontekst, fl_value otstup, fl_value *result, fl_error *error);

/*
 * Функция flang «Печать полей».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param polya — «поля»: список: «Поле значения»
 * @param literal — «литерал»
 * @param est_variant — «есть вариант»
 * @param variant — «вариант»: строка
 * @param kontekst — «контекст»: «Контекст»
 * @param sostoyanie — «состояние»: «Состояние»
 * @param otstup — «отступ»: строка
 * @return значение: «Итог»
 */
fl_status kompilyator_flang_pechat_poley(fl_ctx *ctx, fl_value polya, fl_value literal, fl_value est_variant, fl_value variant, fl_value kontekst, fl_value sostoyanie, fl_value otstup, fl_value *result, fl_error *error);

/*
 * Функция flang «Шаг присвоения поля».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param akk — «акк»: «Зип»
 * @param klyuch — «ключ»: строка
 * @param znacheniya — «значения»: список: строка
 * @param massiv — «массив»: строка
 * @param otstup — «отступ»: строка
 * @return значение: «Зип»
 */
fl_status kompilyator_flang_shag_prisvoeniya_polya(fl_ctx *ctx, fl_value akk, fl_value klyuch, fl_value znacheniya, fl_value massiv, fl_value otstup, fl_value *result, fl_error *error);

/*
 * Функция flang «Печать значений полей».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param klyuchi — «ключи»: список: строка
 * @param znacheniya — «значения»: список: строка
 * @param est_variant — «есть вариант»
 * @param variant — «вариант»: строка
 * @param kontekst — «контекст»: «Контекст»
 * @param sostoyanie — «состояние»: «Состояние»
 * @param otstup — «отступ»: строка
 * @return значение: «Итог»
 */
fl_status kompilyator_flang_pechat_znacheniy_poley(fl_ctx *ctx, fl_value klyuchi, fl_value znacheniya, fl_value est_variant, fl_value variant, fl_value kontekst, fl_value sostoyanie, fl_value otstup, fl_value *result, fl_error *error);

/*
 * Функция flang «Печать пустой записи».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param cel — «цель»: строка
 * @param est_variant — «есть вариант»
 * @param variant — «вариант»: строка
 * @param sostoyanie — «состояние»: «Состояние»
 * @param otstup — «отступ»: строка
 * @return значение: «Итог»
 */
fl_status kompilyator_flang_pechat_pustoy_zapisi(fl_ctx *ctx, fl_value cel, fl_value est_variant, fl_value variant, fl_value sostoyanie, fl_value otstup, fl_value *result, fl_error *error);

/*
 * Функция flang «Печать непустой записи».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param klyuchi — «ключи»: список: строка
 * @param znacheniya — «значения»: список: строка
 * @param cel — «цель»: строка
 * @param massiv_imyon — «массив имён»: строка
 * @param est_variant — «есть вариант»
 * @param variant — «вариант»: строка
 * @param sostoyanie — «состояние»: «Состояние»
 * @param otstup — «отступ»: строка
 * @return значение: «Итог»
 */
fl_status kompilyator_flang_pechat_nepustoy_zapisi(fl_ctx *ctx, fl_value klyuchi, fl_value znacheniya, fl_value cel, fl_value massiv_imyon, fl_value est_variant, fl_value variant, fl_value sostoyanie, fl_value otstup, fl_value *result, fl_error *error);

/*
 * Функция flang «Печать значения в C».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param uzel — «узел»: «Значение»
 * @param kontekst — «контекст»: «Контекст»
 * @param sostoyanie — «состояние»: «Состояние»
 * @param otstup — «отступ»: строка
 * @return значение: «Итог»
 */
fl_status kompilyator_flang_pechat_znacheniya_v_c(fl_ctx *ctx, fl_value uzel, fl_value kontekst, fl_value sostoyanie, fl_value otstup, fl_value *result, fl_error *error);

/*
 * Функция flang «Просто значение».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param sostoyanie — «состояние»: «Состояние»
 * @param znachenie — «значение»: строка
 * @return значение: «Итог»
 */
fl_status kompilyator_flang_prosto_znachenie(fl_ctx *ctx, fl_value sostoyanie, fl_value znachenie, fl_value *result, fl_error *error);

/*
 * Функция flang «Неизвестный вид».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param uzel — «узел»: «Значение»
 * @param sostoyanie — «состояние»: «Состояние»
 * @return значение: «Итог»
 */
fl_status kompilyator_flang_neizvestnyy_vid(fl_ctx *ctx, fl_value uzel, fl_value sostoyanie, fl_value *result, fl_error *error);

/*
 * Функция flang «Печать переменной».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param uzel — «узел»: «Значение»
 * @param kontekst — «контекст»: «Контекст»
 * @param sostoyanie — «состояние»: «Состояние»
 * @return значение: «Итог»
 */
fl_status kompilyator_flang_pechat_peremennoy(fl_ctx *ctx, fl_value uzel, fl_value kontekst, fl_value sostoyanie, fl_value *result, fl_error *error);

/*
 * Функция flang «Печать поля записи».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param uzel — «узел»: «Значение»
 * @param kontekst — «контекст»: «Контекст»
 * @param sostoyanie — «состояние»: «Состояние»
 * @param otstup — «отступ»: строка
 * @return значение: «Итог»
 */
fl_status kompilyator_flang_pechat_polya_zapisi(fl_ctx *ctx, fl_value uzel, fl_value kontekst, fl_value sostoyanie, fl_value otstup, fl_value *result, fl_error *error);

/*
 * Функция flang «Проверить имя узла».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param sostoyanie — «состояние»: «Состояние»
 * @param imya — «имя»: строка
 * @param vid — «вид»: строка
 * @param pole — «поле»: строка
 * @return значение: «Состояние»
 */
fl_status kompilyator_flang_proverit_imya_uzla(fl_ctx *ctx, fl_value sostoyanie, fl_value imya, fl_value vid, fl_value pole, fl_value *result, fl_error *error);

/*
 * Функция flang «Печать пусть».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param uzel — «узел»: «Значение»
 * @param kontekst — «контекст»: «Контекст»
 * @param sostoyanie — «состояние»: «Состояние»
 * @param otstup — «отступ»: строка
 * @return значение: «Итог»
 */
fl_status kompilyator_flang_pechat_pust(fl_ctx *ctx, fl_value uzel, fl_value kontekst, fl_value sostoyanie, fl_value otstup, fl_value *result, fl_error *error);

/*
 * Функция flang «Печать признака в C».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param uzel — «узел»: «Значение»
 * @param pomoschnik — «помощник»: строка
 * @param kontekst — «контекст»: «Контекст»
 * @param sostoyanie — «состояние»: «Состояние»
 * @param otstup — «отступ»: строка
 * @return значение: «Итог»
 */
fl_status kompilyator_flang_pechat_priznaka_v_c(fl_ctx *ctx, fl_value uzel, fl_value pomoschnik, fl_value kontekst, fl_value sostoyanie, fl_value otstup, fl_value *result, fl_error *error);

/*
 * Функция flang «Положить в».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param uzel — «узел»: «Значение»
 * @param cel — «цель»: строка
 * @param kontekst — «контекст»: «Контекст»
 * @param sostoyanie — «состояние»: «Состояние»
 * @param otstup — «отступ»: строка
 * @return значение: «Блок»
 */
fl_status kompilyator_flang_polozhit_v(fl_ctx *ctx, fl_value uzel, fl_value cel, fl_value kontekst, fl_value sostoyanie, fl_value otstup, fl_value *result, fl_error *error);

/*
 * Функция flang «Печать если».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param uzel — «узел»: «Значение»
 * @param kontekst — «контекст»: «Контекст»
 * @param sostoyanie — «состояние»: «Состояние»
 * @param otstup — «отступ»: строка
 * @return значение: «Итог»
 */
fl_status kompilyator_flang_pechat_esli(fl_ctx *ctx, fl_value uzel, fl_value kontekst, fl_value sostoyanie, fl_value otstup, fl_value *result, fl_error *error);

/*
 * Функция flang «Печать разбора значением».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param uzel — «узел»: «Значение»
 * @param kontekst — «контекст»: «Контекст»
 * @param sostoyanie — «состояние»: «Состояние»
 * @param otstup — «отступ»: строка
 * @return значение: «Итог»
 */
fl_status kompilyator_flang_pechat_razbora_znacheniem(fl_ctx *ctx, fl_value uzel, fl_value kontekst, fl_value sostoyanie, fl_value otstup, fl_value *result, fl_error *error);

/*
 * Функция flang «Шаг аргумента».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param akk — «акк»: «Сборка»
 * @param uzel — «узел»: «Значение»
 * @param kontekst — «контекст»: «Контекст»
 * @param otstup — «отступ»: строка
 * @return значение: «Сборка»
 */
fl_status kompilyator_flang_shag_argumenta(fl_ctx *ctx, fl_value akk, fl_value uzel, fl_value kontekst, fl_value otstup, fl_value *result, fl_error *error);

/*
 * Функция flang «Печать аргументов».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param argumenty — «аргументы»: список: «Значение»
 * @param kontekst — «контекст»: «Контекст»
 * @param sostoyanie — «состояние»: «Состояние»
 * @param otstup — «отступ»: строка
 * @return значение: «Сборка»
 */
fl_status kompilyator_flang_pechat_argumentov(fl_ctx *ctx, fl_value argumenty, fl_value kontekst, fl_value sostoyanie, fl_value otstup, fl_value *result, fl_error *error);

/*
 * Функция flang «Проверить арность вызова».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param uzel — «узел»: «Значение»
 * @param kontekst — «контекст»: «Контекст»
 * @param sostoyanie — «состояние»: «Состояние»
 * @param imya — «имя»: строка
 * @return значение: «Состояние»
 */
fl_status kompilyator_flang_proverit_arnost_vyzova(fl_ctx *ctx, fl_value uzel, fl_value kontekst, fl_value sostoyanie, fl_value imya, fl_value *result, fl_error *error);

/*
 * Функция flang «Разрешить вызов».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param uzel — «узел»: «Значение»
 * @param kontekst — «контекст»: «Контекст»
 * @param sostoyanie — «состояние»: «Состояние»
 * @return значение: «Состояние»
 */
fl_status kompilyator_flang_razreshit_vyzov(fl_ctx *ctx, fl_value uzel, fl_value kontekst, fl_value sostoyanie, fl_value *result, fl_error *error);

/*
 * Функция flang «Печать вызова».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param uzel — «узел»: «Значение»
 * @param kontekst — «контекст»: «Контекст»
 * @param sostoyanie — «состояние»: «Состояние»
 * @param otstup — «отступ»: строка
 * @return значение: «Итог»
 */
fl_status kompilyator_flang_pechat_vyzova(fl_ctx *ctx, fl_value uzel, fl_value kontekst, fl_value sostoyanie, fl_value otstup, fl_value *result, fl_error *error);

/*
 * Функция flang «Проверить арность формы».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param sostoyanie — «состояние»: «Состояние»
 * @param kanonicheskoe — «каноническое»: строка
 * @param dano — «дано»: число
 * @return значение: «Состояние»
 */
fl_status kompilyator_flang_proverit_arnost_formy(fl_ctx *ctx, fl_value sostoyanie, fl_value kanonicheskoe, fl_value dano, fl_value *result, fl_error *error);

/*
 * Функция flang «Печать формы».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param uzel — «узел»: «Значение»
 * @param kontekst — «контекст»: «Контекст»
 * @param sostoyanie — «состояние»: «Состояние»
 * @param otstup — «отступ»: строка
 * @return значение: «Итог»
 */
fl_status kompilyator_flang_pechat_formy(fl_ctx *ctx, fl_value uzel, fl_value kontekst, fl_value sostoyanie, fl_value otstup, fl_value *result, fl_error *error);

/*
 * Функция flang «Печать известной формы».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param uzel — «узел»: «Значение»
 * @param kanonicheskoe — «каноническое»: строка
 * @param kontekst — «контекст»: «Контекст»
 * @param sostoyanie — «состояние»: «Состояние»
 * @param otstup — «отступ»: строка
 * @return значение: «Итог»
 */
fl_status kompilyator_flang_pechat_izvestnoy_formy(fl_ctx *ctx, fl_value uzel, fl_value kanonicheskoe, fl_value kontekst, fl_value sostoyanie, fl_value otstup, fl_value *result, fl_error *error);

/*
 * Функция flang «Печать операции».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param uzel — «узел»: «Значение»
 * @param kontekst — «контекст»: «Контекст»
 * @param sostoyanie — «состояние»: «Состояние»
 * @param otstup — «отступ»: строка
 * @return значение: «Итог»
 */
fl_status kompilyator_flang_pechat_operacii(fl_ctx *ctx, fl_value uzel, fl_value kontekst, fl_value sostoyanie, fl_value otstup, fl_value *result, fl_error *error);

/*
 * Функция flang «Печать помощника операции».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param operaciya — «операция»: строка
 * @param levoe — «левое»: строка
 * @param pravoe — «правое»: строка
 * @param vyvod — «вывод»: строка
 * @param sostoyanie — «состояние»: «Состояние»
 * @param otstup — «отступ»: строка
 * @return значение: «Итог»
 */
fl_status kompilyator_flang_pechat_pomoschnika_operacii(fl_ctx *ctx, fl_value operaciya, fl_value levoe, fl_value pravoe, fl_value vyvod, fl_value sostoyanie, fl_value otstup, fl_value *result, fl_error *error);

/*
 * Функция flang «Печать двуместной».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param pomoschnik — «помощник»: строка
 * @param levoe — «левое»: строка
 * @param pravoe — «правое»: строка
 * @param vyvod — «вывод»: строка
 * @param sostoyanie — «состояние»: «Состояние»
 * @param otstup — «отступ»: строка
 * @return значение: «Итог»
 */
fl_status kompilyator_flang_pechat_dvumestnoy(fl_ctx *ctx, fl_value pomoschnik, fl_value levoe, fl_value pravoe, fl_value vyvod, fl_value sostoyanie, fl_value otstup, fl_value *result, fl_error *error);

/*
 * Функция flang «Печать записи».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param uzel — «узел»: «Значение»
 * @param kontekst — «контекст»: «Контекст»
 * @param sostoyanie — «состояние»: «Состояние»
 * @param otstup — «отступ»: строка
 * @return значение: «Итог»
 */
fl_status kompilyator_flang_pechat_zapisi(fl_ctx *ctx, fl_value uzel, fl_value kontekst, fl_value sostoyanie, fl_value otstup, fl_value *result, fl_error *error);

/*
 * Функция flang «Проверить запись».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param uzel — «узел»: «Значение»
 * @param kontekst — «контекст»: «Контекст»
 * @param sostoyanie — «состояние»: «Состояние»
 * @return значение: «Состояние»
 */
fl_status kompilyator_flang_proverit_zapis(fl_ctx *ctx, fl_value uzel, fl_value kontekst, fl_value sostoyanie, fl_value *result, fl_error *error);

/*
 * Функция flang «Проверить имя записи».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param kontekst — «контекст»: «Контекст»
 * @param sostoyanie — «состояние»: «Состояние»
 * @param imya — «имя»: строка
 * @return значение: «Состояние»
 */
fl_status kompilyator_flang_proverit_imya_zapisi(fl_ctx *ctx, fl_value kontekst, fl_value sostoyanie, fl_value imya, fl_value *result, fl_error *error);

/*
 * Функция flang «Печать конструктора».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param uzel — «узел»: «Значение»
 * @param kontekst — «контекст»: «Контекст»
 * @param sostoyanie — «состояние»: «Состояние»
 * @param otstup — «отступ»: строка
 * @return значение: «Итог»
 */
fl_status kompilyator_flang_pechat_konstruktora(fl_ctx *ctx, fl_value uzel, fl_value kontekst, fl_value sostoyanie, fl_value otstup, fl_value *result, fl_error *error);

/*
 * Функция flang «Проверить вариант».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param kontekst — «контекст»: «Контекст»
 * @param sostoyanie — «состояние»: «Состояние»
 * @param imya — «имя»: строка
 * @return значение: «Состояние»
 */
fl_status kompilyator_flang_proverit_variant(fl_ctx *ctx, fl_value kontekst, fl_value sostoyanie, fl_value imya, fl_value *result, fl_error *error);

/*
 * Функция flang «Печать свёртки».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param uzel — «узел»: «Значение»
 * @param kontekst — «контекст»: «Контекст»
 * @param sostoyanie — «состояние»: «Состояние»
 * @param otstup — «отступ»: строка
 * @return значение: «Итог»
 */
fl_status kompilyator_flang_pechat_svyortki(fl_ctx *ctx, fl_value uzel, fl_value kontekst, fl_value sostoyanie, fl_value otstup, fl_value *result, fl_error *error);

/*
 * Функция flang «Печать свёртки дальше».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param uzel — «узел»: «Значение»
 * @param nakopitel — «накопитель»: строка
 * @param element — «элемент»: строка
 * @param kontekst — «контекст»: «Контекст»
 * @param sostoyanie — «состояние»: «Состояние»
 * @param otstup — «отступ»: строка
 * @return значение: «Итог»
 */
fl_status kompilyator_flang_pechat_svyortki_dalshe(fl_ctx *ctx, fl_value uzel, fl_value nakopitel, fl_value element, fl_value kontekst, fl_value sostoyanie, fl_value otstup, fl_value *result, fl_error *error);

/*
 * Функция flang «Печать цикла».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param uzel — «узел»: «Значение»
 * @param otobrazhenie — «отображение»
 * @param kontekst — «контекст»: «Контекст»
 * @param sostoyanie — «состояние»: «Состояние»
 * @param otstup — «отступ»: строка
 * @return значение: «Итог»
 */
fl_status kompilyator_flang_pechat_cikla(fl_ctx *ctx, fl_value uzel, fl_value otobrazhenie, fl_value kontekst, fl_value sostoyanie, fl_value otstup, fl_value *result, fl_error *error);

/*
 * Функция flang «Печать цикла дальше».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param uzel — «узел»: «Значение»
 * @param otobrazhenie — «отображение»
 * @param element — «элемент»: строка
 * @param kontekst — «контекст»: «Контекст»
 * @param sostoyanie — «состояние»: «Состояние»
 * @param otstup — «отступ»: строка
 * @return значение: «Итог»
 */
fl_status kompilyator_flang_pechat_cikla_dalshe(fl_ctx *ctx, fl_value uzel, fl_value otobrazhenie, fl_value element, fl_value kontekst, fl_value sostoyanie, fl_value otstup, fl_value *result, fl_error *error);

/*
 * Функция flang «Тело цикла».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param uzel — «узел»: «Значение»
 * @param otobrazhenie — «отображение»
 * @param massiv — «массив»: строка
 * @param schyot — «счёт»: строка
 * @param imya_elementa — «имя элемента»: строка
 * @param kontekst — «контекст»: «Контекст»
 * @param sostoyanie — «состояние»: «Состояние»
 * @param vnutri — «внутри»: строка
 * @return значение: «Блок»
 */
fl_status kompilyator_flang_telo_cikla(fl_ctx *ctx, fl_value uzel, fl_value otobrazhenie, fl_value massiv, fl_value schyot, fl_value imya_elementa, fl_value kontekst, fl_value sostoyanie, fl_value vnutri, fl_value *result, fl_error *error);

/*
 * Функция flang «Тело отображения в C».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param uzel — «узел»: «Значение»
 * @param massiv — «массив»: строка
 * @param schyot — «счёт»: строка
 * @param kontekst — «контекст»: «Контекст»
 * @param sostoyanie — «состояние»: «Состояние»
 * @param vnutri — «внутри»: строка
 * @return значение: «Блок»
 */
fl_status kompilyator_flang_telo_otobrazheniya_v_c(fl_ctx *ctx, fl_value uzel, fl_value massiv, fl_value schyot, fl_value kontekst, fl_value sostoyanie, fl_value vnutri, fl_value *result, fl_error *error);

/*
 * Функция flang «Тело фильтра в C».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param uzel — «узел»: «Значение»
 * @param massiv — «массив»: строка
 * @param schyot — «счёт»: строка
 * @param imya_elementa — «имя элемента»: строка
 * @param kontekst — «контекст»: «Контекст»
 * @param sostoyanie — «состояние»: «Состояние»
 * @param vnutri — «внутри»: строка
 * @return значение: «Блок»
 */
fl_status kompilyator_flang_telo_filtra_v_c(fl_ctx *ctx, fl_value uzel, fl_value massiv, fl_value schyot, fl_value imya_elementa, fl_value kontekst, fl_value sostoyanie, fl_value vnutri, fl_value *result, fl_error *error);

/*
 * Функция flang «Проверка образца».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param obrazec — «образец»: «Значение»
 * @param predmet — «предмет»: строка
 * @param kontekst — «контекст»: «Контекст»
 * @param sostoyanie — «состояние»: «Состояние»
 * @param otstup — «отступ»: строка
 * @return значение: «Итог образца»
 */
fl_status kompilyator_flang_proverka_obrazca(fl_ctx *ctx, fl_value obrazec, fl_value predmet, fl_value kontekst, fl_value sostoyanie, fl_value otstup, fl_value *result, fl_error *error);

/*
 * Функция flang «Готовая проверка».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param sostoyanie — «состояние»: «Состояние»
 * @param proverka — «проверка»: строка
 * @return значение: «Итог образца»
 */
fl_status kompilyator_flang_gotovaya_proverka(fl_ctx *ctx, fl_value sostoyanie, fl_value proverka, fl_value *result, fl_error *error);

/*
 * Функция flang «Ошибка образца».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param obrazec — «образец»: «Значение»
 * @param sostoyanie — «состояние»: «Состояние»
 * @return значение: «Итог образца»
 */
fl_status kompilyator_flang_oshibka_obrazca(fl_ctx *ctx, fl_value obrazec, fl_value sostoyanie, fl_value *result, fl_error *error);

/*
 * Функция flang «Проверка литералом».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param obrazec — «образец»: «Значение»
 * @param predmet — «предмет»: строка
 * @param kontekst — «контекст»: «Контекст»
 * @param sostoyanie — «состояние»: «Состояние»
 * @param otstup — «отступ»: строка
 * @return значение: «Итог образца»
 */
fl_status kompilyator_flang_proverka_literalom(fl_ctx *ctx, fl_value obrazec, fl_value predmet, fl_value kontekst, fl_value sostoyanie, fl_value otstup, fl_value *result, fl_error *error);

/*
 * Функция flang «Связки варианта».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param obrazec — «образец»: «Значение»
 * @return значение: список: «Пара имён»
 */
fl_status kompilyator_flang_svyazki_varianta(fl_ctx *ctx, fl_value obrazec, fl_value *result, fl_error *error);

/*
 * Функция flang «Связать простое».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param itog — «итог»: «Итог связывания в C»
 * @param imya — «имя»: строка
 * @param kod — «код»: строка
 * @param primechanie — «примечание»: строка
 * @param otstup — «отступ»: строка
 * @return значение: «Итог связывания в C»
 */
fl_status kompilyator_flang_svyazat_prostoe(fl_ctx *ctx, fl_value itog, fl_value imya, fl_value kod, fl_value primechanie, fl_value otstup, fl_value *result, fl_error *error);

/*
 * Функция flang «Связать поле варианта в C».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param itog — «итог»: «Итог связывания в C»
 * @param svyazka — «связка»: «Пара имён»
 * @param predmet — «предмет»: строка
 * @param otstup — «отступ»: строка
 * @return значение: «Итог связывания в C»
 */
fl_status kompilyator_flang_svyazat_pole_varianta_v_c(fl_ctx *ctx, fl_value itog, fl_value svyazka, fl_value predmet, fl_value otstup, fl_value *result, fl_error *error);

/*
 * Функция flang «Связывание образца».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param obrazec — «образец»: «Значение»
 * @param predmet — «предмет»: строка
 * @param kontekst — «контекст»: «Контекст»
 * @param sostoyanie — «состояние»: «Состояние»
 * @param otstup — «отступ»: строка
 * @return значение: «Итог связывания в C»
 */
fl_status kompilyator_flang_svyazyvanie_obrazca(fl_ctx *ctx, fl_value obrazec, fl_value predmet, fl_value kontekst, fl_value sostoyanie, fl_value otstup, fl_value *result, fl_error *error);

/*
 * Функция flang «Связывание любого».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param obrazec — «образец»: «Значение»
 * @param predmet — «предмет»: строка
 * @param pusto — «пусто»: «Итог связывания в C»
 * @param otstup — «отступ»: строка
 * @return значение: «Итог связывания в C»
 */
fl_status kompilyator_flang_svyazyvanie_lyubogo(fl_ctx *ctx, fl_value obrazec, fl_value predmet, fl_value pusto, fl_value otstup, fl_value *result, fl_error *error);

/*
 * Функция flang «Связывание головы и хвоста».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param obrazec — «образец»: «Значение»
 * @param predmet — «предмет»: строка
 * @param pusto — «пусто»: «Итог связывания в C»
 * @param otstup — «отступ»: строка
 * @return значение: «Итог связывания в C»
 */
fl_status kompilyator_flang_svyazyvanie_golovy_i_hvosta(fl_ctx *ctx, fl_value obrazec, fl_value predmet, fl_value pusto, fl_value otstup, fl_value *result, fl_error *error);

/*
 * Функция flang «Связывание головы».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param obrazec — «образец»: «Значение»
 * @param predmet — «предмет»: строка
 * @param pusto — «пусто»: «Итог связывания в C»
 * @param otstup — «отступ»: строка
 * @return значение: «Итог связывания в C»
 */
fl_status kompilyator_flang_svyazyvanie_golovy(fl_ctx *ctx, fl_value obrazec, fl_value predmet, fl_value pusto, fl_value otstup, fl_value *result, fl_error *error);

/*
 * Функция flang «Шаг сбора случая».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param akk — «акк»: «Сбор случаев»
 * @param sluchay — «случай»: «Значение»
 * @param predmet — «предмет»: строка
 * @param kontekst — «контекст»: «Контекст»
 * @param otstup — «отступ»: строка
 * @return значение: «Сбор случаев»
 */
fl_status kompilyator_flang_shag_sbora_sluchaya(fl_ctx *ctx, fl_value akk, fl_value sluchay, fl_value predmet, fl_value kontekst, fl_value otstup, fl_value *result, fl_error *error);

/*
 * Функция flang «Проверить случай».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param sostoyanie — «состояние»: «Состояние»
 * @param sluchay — «случай»: «Значение»
 * @return значение: «Состояние»
 */
fl_status kompilyator_flang_proverit_sluchay(fl_ctx *ctx, fl_value sostoyanie, fl_value sluchay, fl_value *result, fl_error *error);

/*
 * Функция flang «Печать ветви».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param sluchay — «случай»: «Случай печати»
 * @param predmet — «предмет»: строка
 * @param est_cel — «есть цель»
 * @param cel — «цель»: строка
 * @param kontekst — «контекст»: «Контекст»
 * @param sostoyanie — «состояние»: «Состояние»
 * @param otstup — «отступ»: строка
 * @return значение: «Блок»
 */
fl_status kompilyator_flang_pechat_vetvi(fl_ctx *ctx, fl_value sluchay, fl_value predmet, fl_value est_cel, fl_value cel, fl_value kontekst, fl_value sostoyanie, fl_value otstup, fl_value *result, fl_error *error);

/*
 * Функция flang «Тело ветви».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param uzel — «узел»: «Значение»
 * @param est_cel — «есть цель»
 * @param cel — «цель»: строка
 * @param kontekst — «контекст»: «Контекст»
 * @param sostoyanie — «состояние»: «Состояние»
 * @param otstup — «отступ»: строка
 * @return значение: «Блок»
 */
fl_status kompilyator_flang_telo_vetvi(fl_ctx *ctx, fl_value uzel, fl_value est_cel, fl_value cel, fl_value kontekst, fl_value sostoyanie, fl_value otstup, fl_value *result, fl_error *error);

/*
 * Функция flang «Хвост цепочки».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param otkryto — «открыто»
 * @param predmet — «предмет»: строка
 * @param sostoyanie — «состояние»: «Состояние»
 * @param otstup — «отступ»: строка
 * @return значение: «Блок»
 */
fl_status kompilyator_flang_hvost_cepochki(fl_ctx *ctx, fl_value otkryto, fl_value predmet, fl_value sostoyanie, fl_value otstup, fl_value *result, fl_error *error);

/*
 * Функция flang «Цепочка случаев».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param sluchai — «случаи»: список: «Случай печати»
 * @param otkryto — «открыто»
 * @param predmet — «предмет»: строка
 * @param est_cel — «есть цель»
 * @param cel — «цель»: строка
 * @param kontekst — «контекст»: «Контекст»
 * @param sostoyanie — «состояние»: «Состояние»
 * @param otstup — «отступ»: строка
 * @return значение: «Блок»
 */
fl_status kompilyator_flang_cepochka_sluchaev(fl_ctx *ctx, fl_value sluchai, fl_value otkryto, fl_value predmet, fl_value est_cel, fl_value cel, fl_value kontekst, fl_value sostoyanie, fl_value otstup, fl_value *result, fl_error *error);

/*
 * Функция flang «Шаг цепочки».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param sluchay — «случай»: «Случай печати»
 * @param ostalnye — «остальные»: список: «Случай печати»
 * @param otkryto — «открыто»
 * @param predmet — «предмет»: строка
 * @param est_cel — «есть цель»
 * @param cel — «цель»: строка
 * @param kontekst — «контекст»: «Контекст»
 * @param sostoyanie — «состояние»: «Состояние»
 * @param otstup — «отступ»: строка
 * @return значение: «Блок»
 */
fl_status kompilyator_flang_shag_cepochki(fl_ctx *ctx, fl_value sluchay, fl_value ostalnye, fl_value otkryto, fl_value predmet, fl_value est_cel, fl_value cel, fl_value kontekst, fl_value sostoyanie, fl_value otstup, fl_value *result, fl_error *error);

/*
 * Функция flang «Ветвь с проверкой».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param sluchay — «случай»: «Случай печати»
 * @param ostalnye — «остальные»: список: «Случай печати»
 * @param otkryto — «открыто»
 * @param predmet — «предмет»: строка
 * @param est_cel — «есть цель»
 * @param cel — «цель»: строка
 * @param kontekst — «контекст»: «Контекст»
 * @param sostoyanie — «состояние»: «Состояние»
 * @param otstup — «отступ»: строка
 * @return значение: «Блок»
 */
fl_status kompilyator_flang_vetv_s_proverkoy(fl_ctx *ctx, fl_value sluchay, fl_value ostalnye, fl_value otkryto, fl_value predmet, fl_value est_cel, fl_value cel, fl_value kontekst, fl_value sostoyanie, fl_value otstup, fl_value *result, fl_error *error);

/*
 * Функция flang «Ветвь без проверки».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param sluchay — «случай»: «Случай печати»
 * @param otkryto — «открыто»
 * @param predmet — «предмет»: строка
 * @param est_cel — «есть цель»
 * @param cel — «цель»: строка
 * @param kontekst — «контекст»: «Контекст»
 * @param sostoyanie — «состояние»: «Состояние»
 * @param otstup — «отступ»: строка
 * @return значение: «Блок»
 */
fl_status kompilyator_flang_vetv_bez_proverki(fl_ctx *ctx, fl_value sluchay, fl_value otkryto, fl_value predmet, fl_value est_cel, fl_value cel, fl_value kontekst, fl_value sostoyanie, fl_value otstup, fl_value *result, fl_error *error);

/*
 * Функция flang «Печать разбора».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param uzel — «узел»: «Значение»
 * @param est_cel — «есть цель»
 * @param cel — «цель»: строка
 * @param kontekst — «контекст»: «Контекст»
 * @param sostoyanie — «состояние»: «Состояние»
 * @param otstup — «отступ»: строка
 * @return значение: «Блок»
 */
fl_status kompilyator_flang_pechat_razbora(fl_ctx *ctx, fl_value uzel, fl_value est_cel, fl_value cel, fl_value kontekst, fl_value sostoyanie, fl_value otstup, fl_value *result, fl_error *error);

/*
 * Функция flang «Печать хвоста».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param uzel — «узел»: «Значение»
 * @param kontekst — «контекст»: «Контекст»
 * @param sostoyanie — «состояние»: «Состояние»
 * @param otstup — «отступ»: строка
 * @return значение: «Блок»
 */
fl_status kompilyator_flang_pechat_hvosta(fl_ctx *ctx, fl_value uzel, fl_value kontekst, fl_value sostoyanie, fl_value otstup, fl_value *result, fl_error *error);

/*
 * Функция flang «Хвостовое значение».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param uzel — «узел»: «Значение»
 * @param kontekst — «контекст»: «Контекст»
 * @param sostoyanie — «состояние»: «Состояние»
 * @param otstup — «отступ»: строка
 * @return значение: «Блок»
 */
fl_status kompilyator_flang_hvostovoe_znachenie(fl_ctx *ctx, fl_value uzel, fl_value kontekst, fl_value sostoyanie, fl_value otstup, fl_value *result, fl_error *error);

/*
 * Функция flang «Хвостовое пусть».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param uzel — «узел»: «Значение»
 * @param kontekst — «контекст»: «Контекст»
 * @param sostoyanie — «состояние»: «Состояние»
 * @param otstup — «отступ»: строка
 * @return значение: «Блок»
 */
fl_status kompilyator_flang_hvostovoe_pust(fl_ctx *ctx, fl_value uzel, fl_value kontekst, fl_value sostoyanie, fl_value otstup, fl_value *result, fl_error *error);

/*
 * Функция flang «Хвостовое если».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param uzel — «узел»: «Значение»
 * @param kontekst — «контекст»: «Контекст»
 * @param sostoyanie — «состояние»: «Состояние»
 * @param otstup — «отступ»: строка
 * @return значение: «Блок»
 */
fl_status kompilyator_flang_hvostovoe_esli(fl_ctx *ctx, fl_value uzel, fl_value kontekst, fl_value sostoyanie, fl_value otstup, fl_value *result, fl_error *error);

/*
 * Функция flang «Хвостовой вызов».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param uzel — «узел»: «Значение»
 * @param kontekst — «контекст»: «Контекст»
 * @param sostoyanie — «состояние»: «Состояние»
 * @param otstup — «отступ»: строка
 * @return значение: «Блок»
 */
fl_status kompilyator_flang_hvostovoy_vyzov(fl_ctx *ctx, fl_value uzel, fl_value kontekst, fl_value sostoyanie, fl_value otstup, fl_value *result, fl_error *error);

/*
 * Функция flang «Это самовызов».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param kontekst — «контекст»: «Контекст»
 * @param imya — «имя»: строка
 * @return значение
 */
fl_status kompilyator_flang_eto_samovyzov(fl_ctx *ctx, fl_value kontekst, fl_value imya, fl_value *result, fl_error *error);

/*
 * Функция flang «Это отскок».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param kontekst — «контекст»: «Контекст»
 * @param imya — «имя»: строка
 * @return значение
 */
fl_status kompilyator_flang_eto_otskok(fl_ctx *ctx, fl_value kontekst, fl_value imya, fl_value *result, fl_error *error);

/*
 * Функция flang «Хвостовой возврат».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param argumenty — «аргументы»: «Сборка»
 * @param imya — «имя»: строка
 * @param kontekst — «контекст»: «Контекст»
 * @param otstup — «отступ»: строка
 * @return значение: «Блок»
 */
fl_status kompilyator_flang_hvostovoy_vozvrat(fl_ctx *ctx, fl_value argumenty, fl_value imya, fl_value kontekst, fl_value otstup, fl_value *result, fl_error *error);

/*
 * Функция flang «Шаг отскока».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param akk — «акк»: «Зип»
 * @param argument — «аргумент»: строка
 * @param otstup — «отступ»: строка
 * @return значение: «Зип»
 */
fl_status kompilyator_flang_shag_otskoka(fl_ctx *ctx, fl_value akk, fl_value argument, fl_value otstup, fl_value *result, fl_error *error);

/*
 * Функция flang «Хвостовой отскок».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param argumenty — «аргументы»: «Сборка»
 * @param imya — «имя»: строка
 * @param kontekst — «контекст»: «Контекст»
 * @param otstup — «отступ»: строка
 * @return значение: «Блок»
 */
fl_status kompilyator_flang_hvostovoy_otskok(fl_ctx *ctx, fl_value argumenty, fl_value imya, fl_value kontekst, fl_value otstup, fl_value *result, fl_error *error);

/*
 * Функция flang «Шаг временного аргумента».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param akk — «акк»: «Сборка»
 * @param argument — «аргумент»: строка
 * @param kontekst — «контекст»: «Контекст»
 * @param otstup — «отступ»: строка
 * @return значение: «Сборка»
 */
fl_status kompilyator_flang_shag_vremennogo_argumenta(fl_ctx *ctx, fl_value akk, fl_value argument, fl_value kontekst, fl_value otstup, fl_value *result, fl_error *error);

/*
 * Функция flang «Отложить аргумент».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param akk — «акк»: «Сборка»
 * @param argument — «аргумент»: строка
 * @param otstup — «отступ»: строка
 * @return значение: «Сборка»
 */
fl_status kompilyator_flang_otlozhit_argument(fl_ctx *ctx, fl_value akk, fl_value argument, fl_value otstup, fl_value *result, fl_error *error);

/*
 * Функция flang «Аргумент можно оставить».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param argument — «аргумент»: строка
 * @param kontekst — «контекст»: «Контекст»
 * @return значение
 */
fl_status kompilyator_flang_argument_mozhno_ostavit(fl_ctx *ctx, fl_value argument, fl_value kontekst, fl_value *result, fl_error *error);

/*
 * Функция flang «Шаг присвоения параметра».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param akk — «акк»: «Зип»
 * @param parametr — «параметр»: строка
 * @param vremennye — «временные»: список: строка
 * @param otstup — «отступ»: строка
 * @return значение: «Зип»
 */
fl_status kompilyator_flang_shag_prisvoeniya_parametra(fl_ctx *ctx, fl_value akk, fl_value parametr, fl_value vremennye, fl_value otstup, fl_value *result, fl_error *error);

/*
 * Функция flang «Хвостовой цикл».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param argumenty — «аргументы»: «Сборка»
 * @param kontekst — «контекст»: «Контекст»
 * @param otstup — «отступ»: строка
 * @return значение: «Блок»
 */
fl_status kompilyator_flang_hvostovoy_cikl(fl_ctx *ctx, fl_value argumenty, fl_value kontekst, fl_value otstup, fl_value *result, fl_error *error);

/*
 * Функция flang «Пробелы».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param skolko — «сколько»: число
 * @return значение: строка
 */
fl_status kompilyator_flang_probely(fl_ctx *ctx, fl_value skolko, fl_value *result, fl_error *error);

/*
 * Функция flang «Шапка файла».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param est_modul — «есть модуль»
 * @param modul — «модуль»: строка
 * @param chto — «что»: строка
 * @return значение: строка
 */
fl_status kompilyator_flang_shapka_fayla(fl_ctx *ctx, fl_value est_modul, fl_value modul, fl_value chto, fl_value *result, fl_error *error);

/*
 * Функция flang «Пометка типа».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param tip — «тип»: «Значение»
 * @return значение: строка
 */
fl_status kompilyator_flang_pometka_tipa(fl_ctx *ctx, fl_value tip, fl_value *result, fl_error *error);

/*
 * Функция flang «Пометка вида типа».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param tip — «тип»: «Значение»
 * @return значение: строка
 */
fl_status kompilyator_flang_pometka_vida_tipa(fl_ctx *ctx, fl_value tip, fl_value *result, fl_error *error);

/*
 * Функция flang «Пометка имени типа».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param tip — «тип»: «Значение»
 * @return значение: строка
 */
fl_status kompilyator_flang_pometka_imeni_tipa(fl_ctx *ctx, fl_value tip, fl_value *result, fl_error *error);

/*
 * Функция flang «Объявление фабрики».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param zapis — «запись»: «Запись типа»
 * @param obschee — «общее»: «Общее»
 * @return значение: строка
 */
fl_status kompilyator_flang_obyavlenie_fabriki(fl_ctx *ctx, fl_value zapis, fl_value obschee, fl_value *result, fl_error *error);

/*
 * Функция flang «Объявление конструктора».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param variant — «вариант»: «Вариант типа»
 * @param obschee — «общее»: «Общее»
 * @return значение: строка
 */
fl_status kompilyator_flang_obyavlenie_konstruktora(fl_ctx *ctx, fl_value variant, fl_value obschee, fl_value *result, fl_error *error);

/*
 * Функция flang «Объявление функции».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param funkciya — «функция»: «Функция»
 * @param obschee — «общее»: «Общее»
 * @return значение: строка
 */
fl_status kompilyator_flang_obyavlenie_funkcii(fl_ctx *ctx, fl_value funkciya, fl_value obschee, fl_value *result, fl_error *error);

/*
 * Функция flang «Самовызов в хвосте».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param funkciya — «функция»: «Функция»
 * @param obschee — «общее»: «Общее»
 * @return значение
 */
fl_status kompilyator_flang_samovyzov_v_hvoste(fl_ctx *ctx, fl_value funkciya, fl_value obschee, fl_value *result, fl_error *error);

/*
 * Функция flang «Члены батута».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param funkciya — «функция»: «Функция»
 * @param obschee — «общее»: «Общее»
 * @return значение: список: строка
 */
fl_status kompilyator_flang_chleny_batuta(fl_ctx *ctx, fl_value funkciya, fl_value obschee, fl_value *result, fl_error *error);

/*
 * Функция flang «Есть батут».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param funkciya — «функция»: «Функция»
 * @param obschee — «общее»: «Общее»
 * @return значение
 */
fl_status kompilyator_flang_est_batut(fl_ctx *ctx, fl_value funkciya, fl_value obschee, fl_value *result, fl_error *error);

/*
 * Функция flang «Имена рёбер».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param ryobra — «рёбра»: список: «Рёбра»
 * @return значение: список: строка
 */
fl_status kompilyator_flang_imena_ryober(fl_ctx *ctx, fl_value ryobra, fl_value *result, fl_error *error);

/*
 * Функция flang «Строка параметра».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param zip — «зип»: «Зип»
 * @param parametr — «параметр»: «Параметр в C»
 * @param identifikatory — «идентификаторы»: список: строка
 * @return значение: «Зип»
 */
fl_status kompilyator_flang_stroka_parametra(fl_ctx *ctx, fl_value zip, fl_value parametr, fl_value identifikatory, fl_value *result, fl_error *error);

/*
 * Функция flang «Описание функции».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param funkciya — «функция»: «Функция»
 * @param obschee — «общее»: «Общее»
 * @return значение: строка
 */
fl_status kompilyator_flang_opisanie_funkcii(fl_ctx *ctx, fl_value funkciya, fl_value obschee, fl_value *result, fl_error *error);

/*
 * Функция flang «Строка батута».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param funkciya — «функция»: «Функция»
 * @param obschee — «общее»: «Общее»
 * @return значение: строка
 */
fl_status kompilyator_flang_stroka_batuta(fl_ctx *ctx, fl_value funkciya, fl_value obschee, fl_value *result, fl_error *error);

/*
 * Функция flang «Подпись шага».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param shag — «шаг»: строка
 * @return значение: строка
 */
fl_status kompilyator_flang_podpis_shaga(fl_ctx *ctx, fl_value shag, fl_value *result, fl_error *error);

/*
 * Функция flang «Шаг присвоения фабрики».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param zip — «зип»: «Зип»
 * @param pole — «поле»: «Поле типа в C»
 * @param identifikatory — «идентификаторы»: список: строка
 * @return значение: «Зип»
 */
fl_status kompilyator_flang_shag_prisvoeniya_fabriki(fl_ctx *ctx, fl_value zip, fl_value pole, fl_value identifikatory, fl_value *result, fl_error *error);

/*
 * Функция flang «Печать фабрики».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param zapis — «запись»: «Запись типа»
 * @param obschee — «общее»: «Общее»
 * @param sostoyanie — «состояние»: «Состояние»
 * @return значение: «Блок»
 */
fl_status kompilyator_flang_pechat_fabriki(fl_ctx *ctx, fl_value zapis, fl_value obschee, fl_value sostoyanie, fl_value *result, fl_error *error);

/*
 * Функция flang «Печать конструктора варианта».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param variant — «вариант»: «Вариант типа»
 * @param summa — «сумма»: строка
 * @param obschee — «общее»: «Общее»
 * @param sostoyanie — «состояние»: «Состояние»
 * @return значение: «Блок»
 */
fl_status kompilyator_flang_pechat_konstruktora_varianta(fl_ctx *ctx, fl_value variant, fl_value summa, fl_value obschee, fl_value sostoyanie, fl_value *result, fl_error *error);

/*
 * Функция flang «Начальный контекст».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param funkciya — «функция»: «Функция»
 * @param obschee — «общее»: «Общее»
 * @return значение: «Контекст»
 */
fl_status kompilyator_flang_nachalnyy_kontekst(fl_ctx *ctx, fl_value funkciya, fl_value obschee, fl_value *result, fl_error *error);

/*
 * Функция flang «Связать параметр».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param akk — «акк»: «Связывание параметров»
 * @param parametr — «параметр»: «Параметр в C»
 * @param identifikatory — «идентификаторы»: список: строка
 * @return значение: «Связывание параметров»
 */
fl_status kompilyator_flang_svyazat_parametr(fl_ctx *ctx, fl_value akk, fl_value parametr, fl_value identifikatory, fl_value *result, fl_error *error);

/*
 * Функция flang «Начальное взятое».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param sostoyanie — «состояние»: «Состояние»
 * @param identifikatory — «идентификаторы»: список: строка
 * @return значение: «Состояние»
 */
fl_status kompilyator_flang_nachalnoe_vzyatoe(fl_ctx *ctx, fl_value sostoyanie, fl_value identifikatory, fl_value *result, fl_error *error);

/*
 * Функция flang «Шаг постусловия».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param blok — «блок»: «Блок»
 * @param postuslovie — «постусловие»: «Постусловие»
 * @param rezultat — «результат»: строка
 * @param kontekst — «контекст»: «Контекст»
 * @param funkciya — «функция»: «Функция»
 * @return значение: «Блок»
 */
fl_status kompilyator_flang_shag_postusloviya(fl_ctx *ctx, fl_value blok, fl_value postuslovie, fl_value rezultat, fl_value kontekst, fl_value funkciya, fl_value *result, fl_error *error);

/*
 * Функция flang «Тело с постусловиями».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param funkciya — «функция»: «Функция»
 * @param kontekst — «контекст»: «Контекст»
 * @param sostoyanie — «состояние»: «Состояние»
 * @return значение: «Блок»
 */
fl_status kompilyator_flang_telo_s_postusloviyami(fl_ctx *ctx, fl_value funkciya, fl_value kontekst, fl_value sostoyanie, fl_value *result, fl_error *error);

/*
 * Функция flang «Тело обычное».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param funkciya — «функция»: «Функция»
 * @param kontekst — «контекст»: «Контекст»
 * @param sostoyanie — «состояние»: «Состояние»
 * @return значение: «Блок»
 */
fl_status kompilyator_flang_telo_obychnoe(fl_ctx *ctx, fl_value funkciya, fl_value kontekst, fl_value sostoyanie, fl_value *result, fl_error *error);

/*
 * Функция flang «Тело циклом».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param funkciya — «функция»: «Функция»
 * @param kontekst — «контекст»: «Контекст»
 * @param sostoyanie — «состояние»: «Состояние»
 * @return значение: «Блок»
 */
fl_status kompilyator_flang_telo_ciklom(fl_ctx *ctx, fl_value funkciya, fl_value kontekst, fl_value sostoyanie, fl_value *result, fl_error *error);

/*
 * Функция flang «Без перевода в конце».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param tekst — «текст»: строка
 * @return значение: строка
 */
fl_status kompilyator_flang_bez_perevoda_v_konce(fl_ctx *ctx, fl_value tekst, fl_value *result, fl_error *error);

/*
 * Функция flang «Гашение параметров».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param parametry — «параметры»: список: строка
 * @param tekst — «текст»: строка
 * @return значение: строка
 */
fl_status kompilyator_flang_gashenie_parametrov(fl_ctx *ctx, fl_value parametry, fl_value tekst, fl_value *result, fl_error *error);

/*
 * Функция flang «Пролог».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param tekst — «текст»: строка
 * @return значение: строка
 */
fl_status kompilyator_flang_prolog(fl_ctx *ctx, fl_value tekst, fl_value *result, fl_error *error);

/*
 * Функция flang «Шаг распаковки».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param zip — «зип»: «Зип»
 * @param parametr — «параметр»: «Параметр в C»
 * @param identifikatory — «идентификаторы»: список: строка
 * @return значение: «Зип»
 */
fl_status kompilyator_flang_shag_raspakovki(fl_ctx *ctx, fl_value zip, fl_value parametr, fl_value identifikatory, fl_value *result, fl_error *error);

/*
 * Функция flang «Шаг упаковки».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param zip — «зип»: «Зип»
 * @param identifikator — «идентификатор»: строка
 * @return значение: «Зип»
 */
fl_status kompilyator_flang_shag_upakovki(fl_ctx *ctx, fl_value zip, fl_value identifikator, fl_value *result, fl_error *error);

/*
 * Функция flang «Печать батута».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param funkciya — «функция»: «Функция»
 * @param obschee — «общее»: «Общее»
 * @param tekst — «текст»: строка
 * @param opisanie — «описание»: строка
 * @return значение: строка
 */
fl_status kompilyator_flang_pechat_batuta(fl_ctx *ctx, fl_value funkciya, fl_value obschee, fl_value tekst, fl_value opisanie, fl_value *result, fl_error *error);

/*
 * Функция flang «Печать со счётчиком».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param funkciya — «функция»: «Функция»
 * @param obschee — «общее»: «Общее»
 * @param tekst — «текст»: строка
 * @param opisanie — «описание»: строка
 * @param gashenie — «гашение»: строка
 * @return значение: строка
 */
fl_status kompilyator_flang_pechat_so_schyotchikom(fl_ctx *ctx, fl_value funkciya, fl_value obschee, fl_value tekst, fl_value opisanie, fl_value gashenie, fl_value *result, fl_error *error);

/*
 * Функция flang «Печать функции».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param funkciya — «функция»: «Функция»
 * @param obschee — «общее»: «Общее»
 * @param sostoyanie — «состояние»: «Состояние»
 * @return значение: «Блок»
 */
fl_status kompilyator_flang_pechat_funkcii(fl_ctx *ctx, fl_value funkciya, fl_value obschee, fl_value sostoyanie, fl_value *result, fl_error *error);

/*
 * Функция flang «Выбор оболочки».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param funkciya — «функция»: «Функция»
 * @param obschee — «общее»: «Общее»
 * @param tekst — «текст»: строка
 * @param opisanie — «описание»: строка
 * @param gashenie — «гашение»: строка
 * @return значение: строка
 */
fl_status kompilyator_flang_vybor_obolochki(fl_ctx *ctx, fl_value funkciya, fl_value obschee, fl_value tekst, fl_value opisanie, fl_value gashenie, fl_value *result, fl_error *error);

/*
 * Функция flang «Печать простой функции».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param funkciya — «функция»: «Функция»
 * @param obschee — «общее»: «Общее»
 * @param tekst — «текст»: строка
 * @param opisanie — «описание»: строка
 * @param gashenie — «гашение»: строка
 * @return значение: строка
 */
fl_status kompilyator_flang_pechat_prostoy_funkcii(fl_ctx *ctx, fl_value funkciya, fl_value obschee, fl_value tekst, fl_value opisanie, fl_value gashenie, fl_value *result, fl_error *error);

/*
 * Функция flang «Строка аргумента вызова».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param zip — «зип»: «Зип»
 * @param identifikator — «идентификатор»: строка
 * @return значение: «Зип»
 */
fl_status kompilyator_flang_stroka_argumenta_vyzova(fl_ctx *ctx, fl_value zip, fl_value identifikator, fl_value *result, fl_error *error);

/*
 * Функция flang «Ветка диспетчера».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param funkciya — «функция»: «Функция»
 * @param obschee — «общее»: «Общее»
 * @return значение: строка
 */
fl_status kompilyator_flang_vetka_dispetchera(fl_ctx *ctx, fl_value funkciya, fl_value obschee, fl_value *result, fl_error *error);

/*
 * Функция flang «Печать диспетчера».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param obschee — «общее»: «Общее»
 * @return значение: строка
 */
fl_status kompilyator_flang_pechat_dispetchera(fl_ctx *ctx, fl_value obschee, fl_value *result, fl_error *error);

/*
 * Функция flang «Заголовок модуля».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param fayl — «файл»: строка
 * @param est_modul — «есть модуль»
 * @param modul — «модуль»: строка
 * @param obschee — «общее»: «Общее»
 * @return значение: строка
 */
fl_status kompilyator_flang_zagolovok_modulya(fl_ctx *ctx, fl_value fayl, fl_value est_modul, fl_value modul, fl_value obschee, fl_value *result, fl_error *error);

/*
 * Функция flang «Объявление записи в заголовке».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param zapis — «запись»: «Запись типа»
 * @param obschee — «общее»: «Общее»
 * @return значение: строка
 */
fl_status kompilyator_flang_obyavlenie_zapisi_v_zagolovke(fl_ctx *ctx, fl_value zapis, fl_value obschee, fl_value *result, fl_error *error);

/*
 * Функция flang «Объявление суммы в заголовке».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param summa — «сумма»: «Сумма типов в C»
 * @param obschee — «общее»: «Общее»
 * @return значение: строка
 */
fl_status kompilyator_flang_obyavlenie_summy_v_zagolovke(fl_ctx *ctx, fl_value summa, fl_value obschee, fl_value *result, fl_error *error);

/*
 * Функция flang «Объявление функции в заголовке».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param funkciya — «функция»: «Функция»
 * @param obschee — «общее»: «Общее»
 * @return значение: строка
 */
fl_status kompilyator_flang_obyavlenie_funkcii_v_zagolovke(fl_ctx *ctx, fl_value funkciya, fl_value obschee, fl_value *result, fl_error *error);

/*
 * Функция flang «Склеить тела».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param chasti — «части»: список: строка
 * @return значение: строка
 */
fl_status kompilyator_flang_skleit_tela(fl_ctx *ctx, fl_value chasti, fl_value *result, fl_error *error);

/*
 * Функция flang «Исходник модуля».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param fayl — «файл»: строка
 * @param est_modul — «есть модуль»
 * @param modul — «модуль»: строка
 * @param obschee — «общее»: «Общее»
 * @param sostoyanie — «состояние»: «Состояние»
 * @param tela — «тела»: список: строка
 * @return значение: строка
 */
fl_status kompilyator_flang_ishodnik_modulya(fl_ctx *ctx, fl_value fayl, fl_value est_modul, fl_value modul, fl_value obschee, fl_value sostoyanie, fl_value tela, fl_value *result, fl_error *error);

/*
 * Функция flang «Печать Makefile».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param fayl — «файл»: строка
 * @param progonschik — «прогонщик»
 * @param obolochka — «оболочка»
 * @return значение: строка
 */
fl_status kompilyator_flang_pechat_makefile(fl_ctx *ctx, fl_value fayl, fl_value progonschik, fl_value obolochka, fl_value *result, fl_error *error);

/*
 * Функция flang «Шаг тела фабрики».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param tela — «тела»: «Тела»
 * @param zapis — «запись»: «Запись типа»
 * @param obschee — «общее»: «Общее»
 * @return значение: «Тела»
 */
fl_status kompilyator_flang_shag_tela_fabriki(fl_ctx *ctx, fl_value tela, fl_value zapis, fl_value obschee, fl_value *result, fl_error *error);

/*
 * Функция flang «Шаг тела варианта».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param tela — «тела»: «Тела»
 * @param variant — «вариант»: «Вариант типа»
 * @param summa — «сумма»: строка
 * @param obschee — «общее»: «Общее»
 * @return значение: «Тела»
 */
fl_status kompilyator_flang_shag_tela_varianta(fl_ctx *ctx, fl_value tela, fl_value variant, fl_value summa, fl_value obschee, fl_value *result, fl_error *error);

/*
 * Функция flang «Шаг тел суммы».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param tela — «тела»: «Тела»
 * @param summa — «сумма»: «Сумма типов в C»
 * @param obschee — «общее»: «Общее»
 * @return значение: «Тела»
 */
fl_status kompilyator_flang_shag_tel_summy(fl_ctx *ctx, fl_value tela, fl_value summa, fl_value obschee, fl_value *result, fl_error *error);

/*
 * Функция flang «Шаг тела функции».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param tela — «тела»: «Тела»
 * @param funkciya — «функция»: «Функция»
 * @param obschee — «общее»: «Общее»
 * @return значение: «Тела»
 */
fl_status kompilyator_flang_shag_tela_funkcii(fl_ctx *ctx, fl_value tela, fl_value funkciya, fl_value obschee, fl_value *result, fl_error *error);

/*
 * Функция flang «Печать тел».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param obschee — «общее»: «Общее»
 * @param sostoyanie — «состояние»: «Состояние»
 * @return значение: «Тела»
 */
fl_status kompilyator_flang_pechat_tel(fl_ctx *ctx, fl_value obschee, fl_value sostoyanie, fl_value *result, fl_error *error);

/*
 * Функция flang «Наибольшая арность».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param funkcii — «функции»: список: «Функция»
 * @return значение: число
 */
fl_status kompilyator_flang_naibolshaya_arnost(fl_ctx *ctx, fl_value funkcii, fl_value *result, fl_error *error);

/*
 * Функция flang «Арность батутов».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param obschee — «общее»: «Общее»
 * @return значение: число
 */
fl_status kompilyator_flang_arnost_batutov(fl_ctx *ctx, fl_value obschee, fl_value *result, fl_error *error);

/*
 * Функция flang «Имя файла программы».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param programma — «программа»: «Значение»
 * @param nastroyki — «настройки»: «Настройки»
 * @return значение: строка
 */
fl_status kompilyator_flang_imya_fayla_programmy(fl_ctx *ctx, fl_value programma, fl_value nastroyki, fl_value *result, fl_error *error);

/*
 * Функция flang «Проверить столкновения».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param obschee — «общее»: «Общее»
 * @param sostoyanie — «состояние»: «Состояние»
 * @return значение: «Состояние»
 */
fl_status kompilyator_flang_proverit_stolknoveniya(fl_ctx *ctx, fl_value obschee, fl_value sostoyanie, fl_value *result, fl_error *error);

/*
 * Функция flang «Просьбы имён».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param obschee — «общее»: «Общее»
 * @return значение: список: строка
 */
fl_status kompilyator_flang_prosby_imyon(fl_ctx *ctx, fl_value obschee, fl_value *result, fl_error *error);

/*
 * Функция flang «Свернуть имена».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param prosby — «просьбы»: список: строка
 * @param tablica — «таблица»: список: «Пара имён»
 * @param sostoyanie — «состояние»: «Состояние»
 * @return значение: «Именователь»
 */
fl_status kompilyator_flang_svernut_imena(fl_ctx *ctx, fl_value prosby, fl_value tablica, fl_value sostoyanie, fl_value *result, fl_error *error);

/*
 * Функция flang «Занять имя».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param imenovatel — «именователь»: «Именователь»
 * @param znachenie — «значение»: строка
 * @return значение: «Именователь»
 */
fl_status kompilyator_flang_zanyat_imya(fl_ctx *ctx, fl_value imenovatel, fl_value znachenie, fl_value *result, fl_error *error);

/*
 * Функция flang «Проверить прежнее имя».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param sostoyanie — «состояние»: «Состояние»
 * @param znachenie — «значение»: строка
 * @param identifikator — «идентификатор»: строка
 * @param prezhnee — «прежнее»: «Может быть имя»
 * @return значение: «Состояние»
 */
fl_status kompilyator_flang_proverit_prezhnee_imya(fl_ctx *ctx, fl_value sostoyanie, fl_value znachenie, fl_value identifikator, fl_value prezhnee, fl_value *result, fl_error *error);

/*
 * Функция flang «Ошибка столкновения».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param sostoyanie — «состояние»: «Состояние»
 * @param znachenie — «значение»: строка
 * @param identifikator — «идентификатор»: строка
 * @param byloe — «былое»: строка
 * @return значение: «Состояние»
 */
fl_status kompilyator_flang_oshibka_stolknoveniya(fl_ctx *ctx, fl_value sostoyanie, fl_value znachenie, fl_value identifikator, fl_value byloe, fl_value *result, fl_error *error);

/*
 * Функция flang «Печать программы».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param programma — «программа»: «Значение»
 * @param nastroyki — «настройки»: «Настройки»
 * @return значение: «Итог печати»
 */
fl_status kompilyator_flang_pechat_programmy(fl_ctx *ctx, fl_value programma, fl_value nastroyki, fl_value *result, fl_error *error);

/*
 * Функция flang «Слить файлы».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param pervye — «первые»: список: «Файл»
 * @param vtorye — «вторые»: список: «Файл»
 * @return значение: список: «Файл»
 */
fl_status kompilyator_flang_slit_fayly(fl_ctx *ctx, fl_value pervye, fl_value vtorye, fl_value *result, fl_error *error);

/*
 * Функция flang «Файл прогонщика».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param est_modul — «есть модуль»
 * @param modul — «модуль»: строка
 * @param obschee — «общее»: «Общее»
 * @param nastroyki — «настройки»: «Настройки»
 * @return значение: «Файл»
 */
fl_status kompilyator_flang_fayl_progonschika(fl_ctx *ctx, fl_value est_modul, fl_value modul, fl_value obschee, fl_value nastroyki, fl_value *result, fl_error *error);

/*
 * Функция flang «Файл оболочки».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param est_modul — «есть модуль»
 * @param modul — «модуль»: строка
 * @param obschee — «общее»: «Общее»
 * @param nastroyki — «настройки»: «Настройки»
 * @return значение: «Файл»
 */
fl_status kompilyator_flang_fayl_obolochki(fl_ctx *ctx, fl_value est_modul, fl_value modul, fl_value obschee, fl_value nastroyki, fl_value *result, fl_error *error);

/*
 * Функция flang «Блок настроек».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param nastroyki — «настройки»: «Настройки»
 * @param obschee — «общее»: «Общее»
 * @return значение: строка
 */
fl_status kompilyator_flang_blok_nastroek(fl_ctx *ctx, fl_value nastroyki, fl_value obschee, fl_value *result, fl_error *error);

/*
 * Функция flang «Тип неизвестного».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @return значение: «Тип»
 */
fl_status kompilyator_flang_tip_neizvestnogo(fl_ctx *ctx, fl_value *result, fl_error *error);

/*
 * Функция flang «Тип числа».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @return значение: «Тип»
 */
fl_status kompilyator_flang_tip_chisla(fl_ctx *ctx, fl_value *result, fl_error *error);

/*
 * Функция flang «Потолок точных».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @return значение: число
 */
fl_status kompilyator_flang_potolok_tochnyh(fl_ctx *ctx, fl_value *result, fl_error *error);

/*
 * Функция flang «Дно точных».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @return значение: число
 */
fl_status kompilyator_flang_dno_tochnyh(fl_ctx *ctx, fl_value *result, fl_error *error);

/*
 * Функция flang «Тип отрезка».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param niz — «низ»: число
 * @param verh — «верх»: число
 * @param celoe — «целое»
 * @return значение: «Тип»
 */
fl_status kompilyator_flang_tip_otrezka(fl_ctx *ctx, fl_value niz, fl_value verh, fl_value celoe, fl_value *result, fl_error *error);

/*
 * Функция flang «Отрезок годен».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param niz — «низ»: число
 * @param verh — «верх»: число
 * @return значение
 */
fl_status kompilyator_flang_otrezok_goden(fl_ctx *ctx, fl_value niz, fl_value verh, fl_value *result, fl_error *error);

/*
 * Функция flang «Тип нат».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @return значение: «Тип»
 */
fl_status kompilyator_flang_tip_nat(fl_ctx *ctx, fl_value *result, fl_error *error);

/*
 * Функция flang «Тип целого».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @return значение: «Тип»
 */
fl_status kompilyator_flang_tip_celogo(fl_ctx *ctx, fl_value *result, fl_error *error);

/*
 * Функция flang «Тип строки».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @return значение: «Тип»
 */
fl_status kompilyator_flang_tip_stroki(fl_ctx *ctx, fl_value *result, fl_error *error);

/*
 * Функция flang «Тип признака».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @return значение: «Тип»
 */
fl_status kompilyator_flang_tip_priznaka(fl_ctx *ctx, fl_value *result, fl_error *error);

/*
 * Функция flang «Тип ничего».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @return значение: «Тип»
 */
fl_status kompilyator_flang_tip_nichego(fl_ctx *ctx, fl_value *result, fl_error *error);

/*
 * Функция flang «Тип списка».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param element — «элемент»: «Тип»
 * @return значение: «Тип»
 */
fl_status kompilyator_flang_tip_spiska(fl_ctx *ctx, fl_value element, fl_value *result, fl_error *error);

/*
 * Функция flang «Тип записи».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param imya — «имя»: строка
 * @return значение: «Тип»
 */
fl_status kompilyator_flang_tip_zapisi(fl_ctx *ctx, fl_value imya, fl_value *result, fl_error *error);

/*
 * Функция flang «Тип записи от».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param imya — «имя»: строка
 * @param argumenty — «аргументы»: список: «Тип»
 * @return значение: «Тип»
 */
fl_status kompilyator_flang_tip_zapisi_ot(fl_ctx *ctx, fl_value imya, fl_value argumenty, fl_value *result, fl_error *error);

/*
 * Функция flang «Тип суммы».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param imya — «имя»: строка
 * @return значение: «Тип»
 */
fl_status kompilyator_flang_tip_summy(fl_ctx *ctx, fl_value imya, fl_value *result, fl_error *error);

/*
 * Функция flang «Тип суммы от».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param imya — «имя»: строка
 * @param argumenty — «аргументы»: список: «Тип»
 * @return значение: «Тип»
 */
fl_status kompilyator_flang_tip_summy_ot(fl_ctx *ctx, fl_value imya, fl_value argumenty, fl_value *result, fl_error *error);

/*
 * Функция flang «Тип функции».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param prinimaet — «принимает»: список: «Тип»
 * @param vozvraschaet — «возвращает»: «Тип»
 * @return значение: «Тип»
 */
fl_status kompilyator_flang_tip_funkcii(fl_ctx *ctx, fl_value prinimaet, fl_value vozvraschaet, fl_value *result, fl_error *error);

/*
 * Функция flang «Тип параметра».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param imya — «имя»: строка
 * @return значение: «Тип»
 */
fl_status kompilyator_flang_tip_parametra(fl_ctx *ctx, fl_value imya, fl_value *result, fl_error *error);

/*
 * Функция flang «Пометить необязательным».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param tip — «тип»: «Тип»
 * @param nuzhno — «нужно»
 * @return значение: «Тип»
 */
fl_status kompilyator_flang_pometit_neobyazatelnym(fl_ctx *ctx, fl_value tip, fl_value nuzhno, fl_value *result, fl_error *error);

/*
 * Функция flang «Метка вида».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param vid — «вид»: «Вид типа»
 * @return значение: строка
 */
fl_status kompilyator_flang_metka_vida(fl_ctx *ctx, fl_value vid, fl_value *result, fl_error *error);

/*
 * Функция flang «Метка типа».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param tip — «тип»: «Тип»
 * @return значение: строка
 */
fl_status kompilyator_flang_metka_tipa(fl_ctx *ctx, fl_value tip, fl_value *result, fl_error *error);

/*
 * Функция flang «Тип неизвестен».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param tip — «тип»: «Тип»
 * @return значение
 */
fl_status kompilyator_flang_tip_neizvesten(fl_ctx *ctx, fl_value tip, fl_value *result, fl_error *error);

/*
 * Функция flang «Элемент вида».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param vid — «вид»: «Вид типа»
 * @return значение: «Тип»
 */
fl_status kompilyator_flang_element_vida(fl_ctx *ctx, fl_value vid, fl_value *result, fl_error *error);

/*
 * Функция flang «Элемент типа».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param tip — «тип»: «Тип»
 * @return значение: «Тип»
 */
fl_status kompilyator_flang_element_tipa(fl_ctx *ctx, fl_value tip, fl_value *result, fl_error *error);

/*
 * Функция flang «Имя вида».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param vid — «вид»: «Вид типа»
 * @return значение: строка
 */
fl_status kompilyator_flang_imya_vida(fl_ctx *ctx, fl_value vid, fl_value *result, fl_error *error);

/*
 * Функция flang «Имя типа».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param tip — «тип»: «Тип»
 * @return значение: строка
 */
fl_status kompilyator_flang_imya_tipa(fl_ctx *ctx, fl_value tip, fl_value *result, fl_error *error);

/*
 * Функция flang «Аргументы вида».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param vid — «вид»: «Вид типа»
 * @return значение: список: «Тип»
 */
fl_status kompilyator_flang_argumenty_vida(fl_ctx *ctx, fl_value vid, fl_value *result, fl_error *error);

/*
 * Функция flang «Аргументы типа при проверке».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param tip — «тип»: «Тип»
 * @return значение: список: «Тип»
 */
fl_status kompilyator_flang_argumenty_tipa_pri_proverke(fl_ctx *ctx, fl_value tip, fl_value *result, fl_error *error);

/*
 * Функция flang «Принимает вида».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param vid — «вид»: «Вид типа»
 * @return значение: список: «Тип»
 */
fl_status kompilyator_flang_prinimaet_vida(fl_ctx *ctx, fl_value vid, fl_value *result, fl_error *error);

/*
 * Функция flang «Принимает типа».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param tip — «тип»: «Тип»
 * @return значение: список: «Тип»
 */
fl_status kompilyator_flang_prinimaet_tipa(fl_ctx *ctx, fl_value tip, fl_value *result, fl_error *error);

/*
 * Функция flang «Возврат вида».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param vid — «вид»: «Вид типа»
 * @return значение: «Тип»
 */
fl_status kompilyator_flang_vozvrat_vida(fl_ctx *ctx, fl_value vid, fl_value *result, fl_error *error);

/*
 * Функция flang «Возврат типа».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param tip — «тип»: «Тип»
 * @return значение: «Тип»
 */
fl_status kompilyator_flang_vozvrat_tipa(fl_ctx *ctx, fl_value tip, fl_value *result, fl_error *error);

/*
 * Функция flang «Одинаковые типы».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * Взаимная хвостовая рекурсия с «Одинаковые виды»: вызовы идут через батут.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param pervyy — «первый»: «Тип»
 * @param vtoroy — «второй»: «Тип»
 * @return значение
 */
fl_status kompilyator_flang_odinakovye_tipy(fl_ctx *ctx, fl_value pervyy, fl_value vtoroy, fl_value *result, fl_error *error);

/*
 * Функция flang «Одинаковые виды».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * Взаимная хвостовая рекурсия с «Одинаковые типы»: вызовы идут через батут.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param pervyy — «первый»: «Вид типа»
 * @param vtoroy — «второй»: «Вид типа»
 * @return значение
 */
fl_status kompilyator_flang_odinakovye_vidy(fl_ctx *ctx, fl_value pervyy, fl_value vtoroy, fl_value *result, fl_error *error);

/*
 * Функция flang «Годится».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * Взаимная хвостовая рекурсия с «Годится вид»: вызовы идут через батут.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param dannyy — «данный»: «Тип»
 * @param ozhidaemyy — «ожидаемый»: «Тип»
 * @return значение
 */
fl_status kompilyator_flang_goditsya(fl_ctx *ctx, fl_value dannyy, fl_value ozhidaemyy, fl_value *result, fl_error *error);

/*
 * Функция flang «Годится вид».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * Взаимная хвостовая рекурсия с «Годится»: вызовы идут через батут.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param dannyy_vid — «данный вид»: «Вид типа»
 * @param ozhidaemyy_vid — «ожидаемый вид»: «Вид типа»
 * @param dannyy — «данный»: «Тип»
 * @param ozhidaemyy — «ожидаемый»: «Тип»
 * @return значение
 */
fl_status kompilyator_flang_goditsya_vid(fl_ctx *ctx, fl_value dannyy_vid, fl_value ozhidaemyy_vid, fl_value dannyy, fl_value ozhidaemyy, fl_value *result, fl_error *error);

/*
 * Функция flang «Вложен в отрезок».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param dannyy_vid — «данный вид»: «Вид типа»
 * @param niz — «низ»: число
 * @param verh — «верх»: число
 * @return значение
 */
fl_status kompilyator_flang_vlozhen_v_otrezok(fl_ctx *ctx, fl_value dannyy_vid, fl_value niz, fl_value verh, fl_value *result, fl_error *error);

/*
 * Функция flang «Это отрезок».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param tip — «тип»: «Тип»
 * @return значение
 */
fl_status kompilyator_flang_eto_otrezok(fl_ctx *ctx, fl_value tip, fl_value *result, fl_error *error);

/*
 * Функция flang «Низ отрезка».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param tip — «тип»: «Тип»
 * @return значение: число
 */
fl_status kompilyator_flang_niz_otrezka(fl_ctx *ctx, fl_value tip, fl_value *result, fl_error *error);

/*
 * Функция flang «Верх отрезка».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param tip — «тип»: «Тип»
 * @return значение: число
 */
fl_status kompilyator_flang_verh_otrezka(fl_ctx *ctx, fl_value tip, fl_value *result, fl_error *error);

/*
 * Функция flang «Меньшее из».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param pervoe — «первое»: число
 * @param vtoroe — «второе»: число
 * @return значение: число
 */
fl_status kompilyator_flang_menshee_iz(fl_ctx *ctx, fl_value pervoe, fl_value vtoroe, fl_value *result, fl_error *error);

/*
 * Функция flang «Большее из».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param pervoe — «первое»: число
 * @param vtoroe — «второе»: число
 * @return значение: число
 */
fl_status kompilyator_flang_bolshee_iz(fl_ctx *ctx, fl_value pervoe, fl_value vtoroe, fl_value *result, fl_error *error);

/*
 * Функция flang «Объединить типы».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param pervyy — «первый»: «Тип»
 * @param vtoroy — «второй»: «Тип»
 * @return значение: «Тип»
 */
fl_status kompilyator_flang_obedinit_tipy(fl_ctx *ctx, fl_value pervyy, fl_value vtoroy, fl_value *result, fl_error *error);

/*
 * Функция flang «Объединить виды».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param vid — «вид»: «Вид типа»
 * @param pervyy — «первый»: «Тип»
 * @param vtoroy — «второй»: «Тип»
 * @return значение: «Тип»
 */
fl_status kompilyator_flang_obedinit_vidy(fl_ctx *ctx, fl_value vid, fl_value pervyy, fl_value vtoroy, fl_value *result, fl_error *error);

/*
 * Функция flang «Объединить числа».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param pervyy — «первый»: «Тип»
 * @param vtoroy — «второй»: «Тип»
 * @return значение: «Тип»
 */
fl_status kompilyator_flang_obedinit_chisla(fl_ctx *ctx, fl_value pervyy, fl_value vtoroy, fl_value *result, fl_error *error);

/*
 * Функция flang «Расширить до носителя».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param tip — «тип»: «Тип»
 * @return значение: «Тип»
 */
fl_status kompilyator_flang_rasshirit_do_nositelya(fl_ctx *ctx, fl_value tip, fl_value *result, fl_error *error);

/*
 * Функция flang «Расширить вид».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param vid — «вид»: «Вид типа»
 * @param tip — «тип»: «Тип»
 * @return значение: «Тип»
 */
fl_status kompilyator_flang_rasshirit_vid(fl_ctx *ctx, fl_value vid, fl_value tip, fl_value *result, fl_error *error);

/*
 * Функция flang «Одинаковые списки типов».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * Хвостовой самовызов развёрнут в цикл: стек не растёт.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param pervye — «первые»: список: «Тип»
 * @param vtorye — «вторые»: список: «Тип»
 * @return значение
 */
fl_status kompilyator_flang_odinakovye_spiski_tipov(fl_ctx *ctx, fl_value pervye, fl_value vtorye, fl_value *result, fl_error *error);

/*
 * Функция flang «В ёлочках».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param imya — «имя»: строка
 * @return значение: строка
 */
fl_status kompilyator_flang_v_yolochkah(fl_ctx *ctx, fl_value imya, fl_value *result, fl_error *error);

/*
 * Функция flang «Название типа».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param tip — «тип»: «Тип»
 * @return значение: строка
 */
fl_status kompilyator_flang_nazvanie_tipa(fl_ctx *ctx, fl_value tip, fl_value *result, fl_error *error);

/*
 * Функция flang «Название вида».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param vid — «вид»: «Вид типа»
 * @return значение: строка
 */
fl_status kompilyator_flang_nazvanie_vida(fl_ctx *ctx, fl_value vid, fl_value *result, fl_error *error);

/*
 * Функция flang «Числовое имя».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param niz — «низ»: число
 * @param verh — «верх»: число
 * @return значение: строка
 */
fl_status kompilyator_flang_chislovoe_imya(fl_ctx *ctx, fl_value niz, fl_value verh, fl_value *result, fl_error *error);

/*
 * Функция flang «Применено к».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param argumenty — «аргументы»: список: «Тип»
 * @return значение: строка
 */
fl_status kompilyator_flang_primeneno_k(fl_ctx *ctx, fl_value argumenty, fl_value *result, fl_error *error);

/*
 * Функция flang «Принято из».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param prinimaet — «принимает»: список: «Тип»
 * @return значение: строка
 */
fl_status kompilyator_flang_prinyato_iz(fl_ctx *ctx, fl_value prinimaet, fl_value *result, fl_error *error);

/*
 * Функция flang «Винительный падеж».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param tip — «тип»: «Тип»
 * @return значение: строка
 */
fl_status kompilyator_flang_vinitelnyy_padezh(fl_ctx *ctx, fl_value tip, fl_value *result, fl_error *error);

/*
 * Функция flang «Родительный падеж».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param tip — «тип»: «Тип»
 * @return значение: строка
 */
fl_status kompilyator_flang_roditelnyy_padezh(fl_ctx *ctx, fl_value tip, fl_value *result, fl_error *error);

/*
 * Функция flang «Скалярный тип при проверке».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param tip — «тип»: «Тип»
 * @return значение
 */
fl_status kompilyator_flang_skalyarnyy_tip_pri_proverke(fl_ctx *ctx, fl_value tip, fl_value *result, fl_error *error);

/*
 * Функция flang «Сошлось».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param svyazki — «связки»: список: «Связка типа»
 * @return значение: «Итог сопоставления»
 */
fl_status kompilyator_flang_soshlos(fl_ctx *ctx, fl_value svyazki, fl_value *result, fl_error *error);

/*
 * Функция flang «Не сошлось».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param svyazki — «связки»: список: «Связка типа»
 * @return значение: «Итог сопоставления»
 */
fl_status kompilyator_flang_ne_soshlos(fl_ctx *ctx, fl_value svyazki, fl_value *result, fl_error *error);

/*
 * Функция flang «Есть связка».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param svyazki — «связки»: список: «Связка типа»
 * @param imya — «имя»: строка
 * @return значение
 */
fl_status kompilyator_flang_est_svyazka(fl_ctx *ctx, fl_value svyazki, fl_value imya, fl_value *result, fl_error *error);

/*
 * Функция flang «Связанный тип».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param svyazki — «связки»: список: «Связка типа»
 * @param imya — «имя»: строка
 * @return значение: «Тип»
 */
fl_status kompilyator_flang_svyazannyy_tip(fl_ctx *ctx, fl_value svyazki, fl_value imya, fl_value *result, fl_error *error);

/*
 * Функция flang «Есть параметры в типе».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * Хвостовой самовызов развёрнут в цикл: стек не растёт.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param tip — «тип»: «Тип»
 * @return значение
 */
fl_status kompilyator_flang_est_parametry_v_tipe(fl_ctx *ctx, fl_value tip, fl_value *result, fl_error *error);

/*
 * Функция flang «Есть параметры в списке».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * Хвостовой самовызов развёрнут в цикл: стек не растёт.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param tipy — «типы»: список: «Тип»
 * @return значение
 */
fl_status kompilyator_flang_est_parametry_v_spiske(fl_ctx *ctx, fl_value tipy, fl_value *result, fl_error *error);

/*
 * Функция flang «Подставить».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param tip — «тип»: «Тип»
 * @param svyazki — «связки»: список: «Связка типа»
 * @return значение: «Тип»
 */
fl_status kompilyator_flang_podstavit(fl_ctx *ctx, fl_value tip, fl_value svyazki, fl_value *result, fl_error *error);

/*
 * Функция flang «Подставить в вид».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param vid — «вид»: «Вид типа»
 * @param neobyazatelnyy — «необязательный»
 * @param svyazki — «связки»: список: «Связка типа»
 * @return значение: «Тип»
 */
fl_status kompilyator_flang_podstavit_v_vid(fl_ctx *ctx, fl_value vid, fl_value neobyazatelnyy, fl_value svyazki, fl_value *result, fl_error *error);

/*
 * Функция flang «Подставить в список».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param tipy — «типы»: список: «Тип»
 * @param svyazki — «связки»: список: «Связка типа»
 * @return значение: список: «Тип»
 */
fl_status kompilyator_flang_podstavit_v_spisok(fl_ctx *ctx, fl_value tipy, fl_value svyazki, fl_value *result, fl_error *error);

/*
 * Функция flang «Сопоставить».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * Взаимная хвостовая рекурсия с «Сопоставить по виду»: вызовы идут через батут.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param obyavlennyy — «объявленный»: «Тип»
 * @param poluchennyy — «полученный»: «Тип»
 * @param svyazki — «связки»: список: «Связка типа»
 * @return значение: «Итог сопоставления»
 */
fl_status kompilyator_flang_sopostavit(fl_ctx *ctx, fl_value obyavlennyy, fl_value poluchennyy, fl_value svyazki, fl_value *result, fl_error *error);

/*
 * Функция flang «Связать параметр при проверке».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param imya — «имя»: строка
 * @param poluchennyy — «полученный»: «Тип»
 * @param svyazki — «связки»: список: «Связка типа»
 * @return значение: «Итог сопоставления»
 */
fl_status kompilyator_flang_svyazat_parametr_pri_proverke(fl_ctx *ctx, fl_value imya, fl_value poluchennyy, fl_value svyazki, fl_value *result, fl_error *error);

/*
 * Функция flang «Сопоставить по виду».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * Взаимная хвостовая рекурсия с «Сопоставить»: вызовы идут через батут.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param vid — «вид»: «Вид типа»
 * @param poluchennyy — «полученный»: «Тип»
 * @param svyazki — «связки»: список: «Связка типа»
 * @return значение: «Итог сопоставления»
 */
fl_status kompilyator_flang_sopostavit_po_vidu(fl_ctx *ctx, fl_value vid, fl_value poluchennyy, fl_value svyazki, fl_value *result, fl_error *error);

/*
 * Функция flang «Сопоставить списки».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * Хвостовой самовызов развёрнут в цикл: стек не растёт.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param levye — «левые»: список: «Тип»
 * @param pravye — «правые»: список: «Тип»
 * @param svyazki — «связки»: список: «Связка типа»
 * @return значение: «Итог сопоставления»
 */
fl_status kompilyator_flang_sopostavit_spiski(fl_ctx *ctx, fl_value levye, fl_value pravye, fl_value svyazki, fl_value *result, fl_error *error);

/*
 * Функция flang «Первый тип».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param tipy — «типы»: список: «Тип»
 * @return значение: «Тип»
 */
fl_status kompilyator_flang_pervyy_tip(fl_ctx *ctx, fl_value tipy, fl_value *result, fl_error *error);

/*
 * Функция flang «Прочие типы».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param tipy — «типы»: список: «Тип»
 * @return значение: список: «Тип»
 */
fl_status kompilyator_flang_prochie_tipy(fl_ctx *ctx, fl_value tipy, fl_value *result, fl_error *error);

/*
 * Функция flang «Без места».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @return значение: «Место»
 */
fl_status kompilyator_flang_bez_mesta(fl_ctx *ctx, fl_value *result, fl_error *error);

/*
 * Функция flang «Место узла».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param uzel — «узел»: «Значение»
 * @return значение: «Место»
 */
fl_status kompilyator_flang_mesto_uzla(fl_ctx *ctx, fl_value uzel, fl_value *result, fl_error *error);

/*
 * Функция flang «Место из span».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param mesto — «место»: «Значение»
 * @return значение: «Место»
 */
fl_status kompilyator_flang_mesto_iz_span(fl_ctx *ctx, fl_value mesto, fl_value *result, fl_error *error);

/*
 * Функция flang «Сказать».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param bedy — «беды»: список: «Беда»
 * @param kod — «код»: строка
 * @param soobschenie — «сообщение»: строка
 * @param uzel — «узел»: «Значение»
 * @return значение: список: «Беда»
 */
fl_status kompilyator_flang_skazat(fl_ctx *ctx, fl_value bedy, fl_value kod, fl_value soobschenie, fl_value uzel, fl_value *result, fl_error *error);

/*
 * Функция flang «Как в JS».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param uzel — «узел»: «Значение»
 * @param est — «есть»
 * @return значение: строка
 */
fl_status kompilyator_flang_kak_v_js(fl_ctx *ctx, fl_value uzel, fl_value est, fl_value *result, fl_error *error);

/*
 * Функция flang «Значение как в JS».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param uzel — «узел»: «Значение»
 * @return значение: строка
 */
fl_status kompilyator_flang_znachenie_kak_v_js(fl_ctx *ctx, fl_value uzel, fl_value *result, fl_error *error);

/*
 * Функция flang «Скаляр как в JS».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param skalyar — «скаляр»: «Скаляр»
 * @return значение: строка
 */
fl_status kompilyator_flang_skalyar_kak_v_js(fl_ctx *ctx, fl_value skalyar, fl_value *result, fl_error *error);

/*
 * Функция flang «Это имя».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param uzel — «узел»: «Значение»
 * @return значение
 */
fl_status kompilyator_flang_eto_imya(fl_ctx *ctx, fl_value uzel, fl_value *result, fl_error *error);

/*
 * Функция flang «Это имя в поле».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param uzel — «узел»: «Значение»
 * @param klyuch — «ключ»: строка
 * @return значение
 */
fl_status kompilyator_flang_eto_imya_v_pole(fl_ctx *ctx, fl_value uzel, fl_value klyuch, fl_value *result, fl_error *error);

/*
 * Функция flang «Имя поля».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param uzel — «узел»: «Значение»
 * @param klyuch — «ключ»: строка
 * @return значение: строка
 */
fl_status kompilyator_flang_imya_polya(fl_ctx *ctx, fl_value uzel, fl_value klyuch, fl_value *result, fl_error *error);

/*
 * Функция flang «Ключ не пуст».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param uzel — «узел»: «Значение»
 * @param klyuch — «ключ»: строка
 * @return значение
 */
fl_status kompilyator_flang_klyuch_ne_pust(fl_ctx *ctx, fl_value uzel, fl_value klyuch, fl_value *result, fl_error *error);

/*
 * Функция flang «Ключ или ключ».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param uzel — «узел»: «Значение»
 * @param pervyy — «первый»: строка
 * @param vtoroy — «второй»: строка
 * @return значение: «Выбор ключа»
 */
fl_status kompilyator_flang_klyuch_ili_klyuch(fl_ctx *ctx, fl_value uzel, fl_value pervyy, fl_value vtoroy, fl_value *result, fl_error *error);

/*
 * Функция flang «Ключ или ключ или ключ».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param uzel — «узел»: «Значение»
 * @param pervyy — «первый»: строка
 * @param vtoroy — «второй»: строка
 * @param tretiy — «третий»: строка
 * @return значение: «Выбор ключа»
 */
fl_status kompilyator_flang_klyuch_ili_klyuch_ili_klyuch(fl_ctx *ctx, fl_value uzel, fl_value pervyy, fl_value vtoroy, fl_value tretiy, fl_value *result, fl_error *error);

/*
 * Функция flang «Первая из записей».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param zapisi — «записи»: список: «Запись типов»
 * @return значение: «Поиск записи»
 */
fl_status kompilyator_flang_pervaya_iz_zapisey(fl_ctx *ctx, fl_value zapisi, fl_value *result, fl_error *error);

/*
 * Функция flang «Найти запись».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param zapisi — «записи»: список: «Запись типов»
 * @param imya — «имя»: строка
 * @return значение: «Поиск записи»
 */
fl_status kompilyator_flang_nayti_zapis(fl_ctx *ctx, fl_value zapisi, fl_value imya, fl_value *result, fl_error *error);

/*
 * Функция flang «Есть такая запись».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param zapisi — «записи»: список: «Запись типов»
 * @param imya — «имя»: строка
 * @return значение
 */
fl_status kompilyator_flang_est_takaya_zapis(fl_ctx *ctx, fl_value zapisi, fl_value imya, fl_value *result, fl_error *error);

/*
 * Функция flang «Поля записи».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param zapisi — «записи»: список: «Запись типов»
 * @param imya — «имя»: строка
 * @return значение: список: «Поле типа»
 */
fl_status kompilyator_flang_polya_zapisi(fl_ctx *ctx, fl_value zapisi, fl_value imya, fl_value *result, fl_error *error);

/*
 * Функция flang «Обновить запись».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param zapis — «запись»: «Запись типов»
 * @param imya — «имя»: строка
 * @param polya — «поля»: список: «Поле типа»
 * @return значение: «Запись типов»
 */
fl_status kompilyator_flang_obnovit_zapis(fl_ctx *ctx, fl_value zapis, fl_value imya, fl_value polya, fl_value *result, fl_error *error);

/*
 * Функция flang «Положить запись».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param zapisi — «записи»: список: «Запись типов»
 * @param imya — «имя»: строка
 * @param polya — «поля»: список: «Поле типа»
 * @return значение: список: «Запись типов»
 */
fl_status kompilyator_flang_polozhit_zapis(fl_ctx *ctx, fl_value zapisi, fl_value imya, fl_value polya, fl_value *result, fl_error *error);

/*
 * Функция flang «Первая из сумм».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param summy — «суммы»: список: «Сумма типов»
 * @return значение: «Поиск суммы»
 */
fl_status kompilyator_flang_pervaya_iz_summ(fl_ctx *ctx, fl_value summy, fl_value *result, fl_error *error);

/*
 * Функция flang «Найти сумму».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param summy — «суммы»: список: «Сумма типов»
 * @param imya — «имя»: строка
 * @return значение: «Поиск суммы»
 */
fl_status kompilyator_flang_nayti_summu(fl_ctx *ctx, fl_value summy, fl_value imya, fl_value *result, fl_error *error);

/*
 * Функция flang «Есть такая сумма».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param summy — «суммы»: список: «Сумма типов»
 * @param imya — «имя»: строка
 * @return значение
 */
fl_status kompilyator_flang_est_takaya_summa(fl_ctx *ctx, fl_value summy, fl_value imya, fl_value *result, fl_error *error);

/*
 * Функция flang «Варианты суммы».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param summy — «суммы»: список: «Сумма типов»
 * @param imya — «имя»: строка
 * @return значение: список: «Вариант типов»
 */
fl_status kompilyator_flang_varianty_summy(fl_ctx *ctx, fl_value summy, fl_value imya, fl_value *result, fl_error *error);

/*
 * Функция flang «Обновить сумму».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param summa — «сумма»: «Сумма типов»
 * @param imya — «имя»: строка
 * @param varianty — «варианты»: список: «Вариант типов»
 * @return значение: «Сумма типов»
 */
fl_status kompilyator_flang_obnovit_summu(fl_ctx *ctx, fl_value summa, fl_value imya, fl_value varianty, fl_value *result, fl_error *error);

/*
 * Функция flang «Положить сумму».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param summy — «суммы»: список: «Сумма типов»
 * @param imya — «имя»: строка
 * @param varianty — «варианты»: список: «Вариант типов»
 * @return значение: список: «Сумма типов»
 */
fl_status kompilyator_flang_polozhit_summu(fl_ctx *ctx, fl_value summy, fl_value imya, fl_value varianty, fl_value *result, fl_error *error);

/*
 * Функция flang «Первый из вариантов».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param varianty — «варианты»: список: «Вариант типов»
 * @return значение: «Поиск варианта»
 */
fl_status kompilyator_flang_pervyy_iz_variantov(fl_ctx *ctx, fl_value varianty, fl_value *result, fl_error *error);

/*
 * Функция flang «Найти вариант».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param varianty — «варианты»: список: «Вариант типов»
 * @param imya — «имя»: строка
 * @return значение: «Поиск варианта»
 */
fl_status kompilyator_flang_nayti_variant(fl_ctx *ctx, fl_value varianty, fl_value imya, fl_value *result, fl_error *error);

/*
 * Функция flang «Есть такой вариант».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param varianty — «варианты»: список: «Вариант типов»
 * @param imya — «имя»: строка
 * @return значение
 */
fl_status kompilyator_flang_est_takoy_variant(fl_ctx *ctx, fl_value varianty, fl_value imya, fl_value *result, fl_error *error);

/*
 * Функция flang «Поля варианта».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param varianty — «варианты»: список: «Вариант типов»
 * @param imya — «имя»: строка
 * @return значение: список: «Поле типа»
 */
fl_status kompilyator_flang_polya_varianta(fl_ctx *ctx, fl_value varianty, fl_value imya, fl_value *result, fl_error *error);

/*
 * Функция flang «Первое из полей типа».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param polya — «поля»: список: «Поле типа»
 * @return значение: «Поиск поля»
 */
fl_status kompilyator_flang_pervoe_iz_poley_tipa(fl_ctx *ctx, fl_value polya, fl_value *result, fl_error *error);

/*
 * Функция flang «Найти поле типа».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param polya — «поля»: список: «Поле типа»
 * @param imya — «имя»: строка
 * @return значение: «Поиск поля»
 */
fl_status kompilyator_flang_nayti_pole_tipa(fl_ctx *ctx, fl_value polya, fl_value imya, fl_value *result, fl_error *error);

/*
 * Функция flang «Есть такое поле».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param polya — «поля»: список: «Поле типа»
 * @param imya — «имя»: строка
 * @return значение
 */
fl_status kompilyator_flang_est_takoe_pole(fl_ctx *ctx, fl_value polya, fl_value imya, fl_value *result, fl_error *error);

/*
 * Функция flang «Тип поля».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param polya — «поля»: список: «Поле типа»
 * @param imya — «имя»: строка
 * @return значение: «Тип»
 */
fl_status kompilyator_flang_tip_polya(fl_ctx *ctx, fl_value polya, fl_value imya, fl_value *result, fl_error *error);

/*
 * Функция flang «Первая из сигнатур».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param signatury — «сигнатуры»: список: «Сигнатура»
 * @return значение: «Поиск сигнатуры»
 */
fl_status kompilyator_flang_pervaya_iz_signatur(fl_ctx *ctx, fl_value signatury, fl_value *result, fl_error *error);

/*
 * Функция flang «Найти сигнатуру».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param signatury — «сигнатуры»: список: «Сигнатура»
 * @param imya — «имя»: строка
 * @return значение: «Поиск сигнатуры»
 */
fl_status kompilyator_flang_nayti_signaturu(fl_ctx *ctx, fl_value signatury, fl_value imya, fl_value *result, fl_error *error);

/*
 * Функция flang «Есть такая сигнатура».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param signatury — «сигнатуры»: список: «Сигнатура»
 * @param imya — «имя»: строка
 * @return значение
 */
fl_status kompilyator_flang_est_takaya_signatura(fl_ctx *ctx, fl_value signatury, fl_value imya, fl_value *result, fl_error *error);

/*
 * Функция flang «Первый из параметров».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param parametry — «параметры»: список: «Параметр»
 * @return значение: «Поиск параметра»
 */
fl_status kompilyator_flang_pervyy_iz_parametrov(fl_ctx *ctx, fl_value parametry, fl_value *result, fl_error *error);

/*
 * Функция flang «Хвост параметров».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param parametry — «параметры»: список: «Параметр»
 * @return значение: список: «Параметр»
 */
fl_status kompilyator_flang_hvost_parametrov(fl_ctx *ctx, fl_value parametry, fl_value *result, fl_error *error);

/*
 * Функция flang «Есть такой параметр».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param parametry — «параметры»: список: «Параметр»
 * @param imya — «имя»: строка
 * @return значение
 */
fl_status kompilyator_flang_est_takoy_parametr(fl_ctx *ctx, fl_value parametry, fl_value imya, fl_value *result, fl_error *error);

/*
 * Функция flang «Имена параметров».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param parametry — «параметры»: список: «Параметр»
 * @return значение: строка
 */
fl_status kompilyator_flang_imena_parametrov(fl_ctx *ctx, fl_value parametry, fl_value *result, fl_error *error);

/*
 * Функция flang «Параметры имени».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param tablica — «таблица»: список: «Параметры объявления»
 * @param imya — «имя»: строка
 * @return значение: список: строка
 */
fl_status kompilyator_flang_parametry_imeni(fl_ctx *ctx, fl_value tablica, fl_value imya, fl_value *result, fl_error *error);

/*
 * Функция flang «Положить параметры».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param tablica — «таблица»: список: «Параметры объявления»
 * @param imya — «имя»: строка
 * @param imena — «имена»: список: строка
 * @return значение: список: «Параметры объявления»
 */
fl_status kompilyator_flang_polozhit_parametry(fl_ctx *ctx, fl_value tablica, fl_value imya, fl_value imena, fl_value *result, fl_error *error);

/*
 * Функция flang «Связки типа».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param tip — «тип»: «Тип»
 * @param tablica — «таблица»: список: «Параметры объявления»
 * @return значение: список: «Связка типа»
 */
fl_status kompilyator_flang_svyazki_tipa(fl_ctx *ctx, fl_value tip, fl_value tablica, fl_value *result, fl_error *error);

/*
 * Функция flang «Сложить связки».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * Хвостовой самовызов развёрнут в цикл: стек не растёт.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param imena — «имена»: список: строка
 * @param tipy — «типы»: список: «Тип»
 * @param gotovye — «готовые»: список: «Связка типа»
 * @return значение: список: «Связка типа»
 */
fl_status kompilyator_flang_slozhit_svyazki(fl_ctx *ctx, fl_value imena, fl_value tipy, fl_value gotovye, fl_value *result, fl_error *error);

/*
 * Функция flang «Сколько параметров».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param skolko — «сколько»: число
 * @return значение: строка
 */
fl_status kompilyator_flang_skolko_parametrov(fl_ctx *ctx, fl_value skolko, fl_value *result, fl_error *error);

/*
 * Функция flang «Сколько аргументов».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param skolko — «сколько»: число
 * @return значение: строка
 */
fl_status kompilyator_flang_skolko_argumentov(fl_ctx *ctx, fl_value skolko, fl_value *result, fl_error *error);

/*
 * Функция flang «Связать имя».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param imena — «имена»: «Имена»
 * @param imya — «имя»: строка
 * @param tip — «тип»: «Тип»
 * @return значение: «Имена»
 */
fl_status kompilyator_flang_svyazat_imya(fl_ctx *ctx, fl_value imena, fl_value imya, fl_value tip, fl_value *result, fl_error *error);

/*
 * Функция flang «Найти имя».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * Хвостовой самовызов развёрнут в цикл: стек не растёт.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param imena — «имена»: «Имена»
 * @param iskomoe — «искомое»: строка
 * @return значение: «Может быть тип»
 */
fl_status kompilyator_flang_nayti_imya(fl_ctx *ctx, fl_value imena, fl_value iskomoe, fl_value *result, fl_error *error);

/*
 * Функция flang «Тип или неизвестный».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param mozhet — «может»: «Может быть тип»
 * @return значение: «Тип»
 */
fl_status kompilyator_flang_tip_ili_neizvestnyy(fl_ctx *ctx, fl_value mozhet, fl_value *result, fl_error *error);

/*
 * Функция flang «Тип задан ли».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param mozhet — «может»: «Может быть тип»
 * @return значение
 */
fl_status kompilyator_flang_tip_zadan_li(fl_ctx *ctx, fl_value mozhet, fl_value *result, fl_error *error);

/*
 * Функция flang «Ожидаемый элемент».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param ozhidaemyy — «ожидаемый»: «Может быть тип»
 * @return значение: «Может быть тип»
 */
fl_status kompilyator_flang_ozhidaemyy_element(fl_ctx *ctx, fl_value ozhidaemyy, fl_value *result, fl_error *error);

/*
 * Функция flang «Есть в перечне».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param perechen — «перечень»: строка
 * @param slovo — «слово»: строка
 * @return значение
 */
fl_status kompilyator_flang_est_v_perechne(fl_ctx *ctx, fl_value perechen, fl_value slovo, fl_value *result, fl_error *error);

/*
 * Функция flang «Скаляр по имени».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param imya — «имя»: строка
 * @return значение: «Может быть тип»
 */
fl_status kompilyator_flang_skalyar_po_imeni(fl_ctx *ctx, fl_value imya, fl_value *result, fl_error *error);

/*
 * Функция flang «Пустой сбор».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @return значение: «Сбор»
 */
fl_status kompilyator_flang_pustoy_sbor(fl_ctx *ctx, fl_value *result, fl_error *error);

/*
 * Функция flang «Сбор с записями».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param sbor — «сбор»: «Сбор»
 * @param zapisi — «записи»: список: «Запись типов»
 * @return значение: «Сбор»
 */
fl_status kompilyator_flang_sbor_s_zapisyami(fl_ctx *ctx, fl_value sbor, fl_value zapisi, fl_value *result, fl_error *error);

/*
 * Функция flang «Сбор с суммами».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param sbor — «сбор»: «Сбор»
 * @param summy — «суммы»: список: «Сумма типов»
 * @return значение: «Сбор»
 */
fl_status kompilyator_flang_sbor_s_summami(fl_ctx *ctx, fl_value sbor, fl_value summy, fl_value *result, fl_error *error);

/*
 * Функция flang «Сбор с владельцами».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param sbor — «сбор»: «Сбор»
 * @param vladelcy — «владельцы»: список: «Пара имён»
 * @return значение: «Сбор»
 */
fl_status kompilyator_flang_sbor_s_vladelcami(fl_ctx *ctx, fl_value sbor, fl_value vladelcy, fl_value *result, fl_error *error);

/*
 * Функция flang «Сбор с сигнатурами».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param sbor — «сбор»: «Сбор»
 * @param signatury — «сигнатуры»: список: «Сигнатура»
 * @return значение: «Сбор»
 */
fl_status kompilyator_flang_sbor_s_signaturami(fl_ctx *ctx, fl_value sbor, fl_value signatury, fl_value *result, fl_error *error);

/*
 * Функция flang «Сбор с псевдонимами».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param sbor — «сбор»: «Сбор»
 * @param psevdonimy — «псевдонимы»: список: «Псевдоним»
 * @return значение: «Сбор»
 */
fl_status kompilyator_flang_sbor_s_psevdonimami(fl_ctx *ctx, fl_value sbor, fl_value psevdonimy, fl_value *result, fl_error *error);

/*
 * Функция flang «Сбор с развёрнутыми».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param sbor — «сбор»: «Сбор»
 * @param razvyornutye — «развёрнутые»: список: «Именованный тип»
 * @return значение: «Сбор»
 */
fl_status kompilyator_flang_sbor_s_razvyornutymi(fl_ctx *ctx, fl_value sbor, fl_value razvyornutye, fl_value *result, fl_error *error);

/*
 * Функция flang «Сбор с открытыми».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param sbor — «сбор»: «Сбор»
 * @param otkrytye — «открытые»: список: строка
 * @return значение: «Сбор»
 */
fl_status kompilyator_flang_sbor_s_otkrytymi(fl_ctx *ctx, fl_value sbor, fl_value otkrytye, fl_value *result, fl_error *error);

/*
 * Функция flang «Сбор с параметрами типов».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param sbor — «сбор»: «Сбор»
 * @param parametry_tipov — «параметры типов»: список: «Параметры объявления»
 * @return значение: «Сбор»
 */
fl_status kompilyator_flang_sbor_s_parametrami_tipov(fl_ctx *ctx, fl_value sbor, fl_value parametry_tipov, fl_value *result, fl_error *error);

/*
 * Функция flang «Сбор с областью».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param sbor — «сбор»: «Сбор»
 * @param oblast — «область»: список: строка
 * @return значение: «Сбор»
 */
fl_status kompilyator_flang_sbor_s_oblastyu(fl_ctx *ctx, fl_value sbor, fl_value oblast, fl_value *result, fl_error *error);

/*
 * Функция flang «Сбор с бедами».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param sbor — «сбор»: «Сбор»
 * @param bedy — «беды»: список: «Беда»
 * @return значение: «Сбор»
 */
fl_status kompilyator_flang_sbor_s_bedami(fl_ctx *ctx, fl_value sbor, fl_value bedy, fl_value *result, fl_error *error);

/*
 * Функция flang «Сбор сказал».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param sbor — «сбор»: «Сбор»
 * @param kod — «код»: строка
 * @param soobschenie — «сообщение»: строка
 * @param uzel — «узел»: «Значение»
 * @return значение: «Сбор»
 */
fl_status kompilyator_flang_sbor_skazal(fl_ctx *ctx, fl_value sbor, fl_value kod, fl_value soobschenie, fl_value uzel, fl_value *result, fl_error *error);

/*
 * Функция flang «Первый из псевдонимов».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param psevdonimy — «псевдонимы»: список: «Псевдоним»
 * @return значение: «Псевдоним»
 */
fl_status kompilyator_flang_pervyy_iz_psevdonimov(fl_ctx *ctx, fl_value psevdonimy, fl_value *result, fl_error *error);

/*
 * Функция flang «Найти псевдоним».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param psevdonimy — «псевдонимы»: список: «Псевдоним»
 * @param imya — «имя»: строка
 * @return значение: «Псевдоним»
 */
fl_status kompilyator_flang_nayti_psevdonim(fl_ctx *ctx, fl_value psevdonimy, fl_value imya, fl_value *result, fl_error *error);

/*
 * Функция flang «Есть такой псевдоним».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param psevdonimy — «псевдонимы»: список: «Псевдоним»
 * @param imya — «имя»: строка
 * @return значение
 */
fl_status kompilyator_flang_est_takoy_psevdonim(fl_ctx *ctx, fl_value psevdonimy, fl_value imya, fl_value *result, fl_error *error);

/*
 * Функция flang «Первый из развёрнутых».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param razvyornutye — «развёрнутые»: список: «Именованный тип»
 * @return значение: «Тип»
 */
fl_status kompilyator_flang_pervyy_iz_razvyornutyh(fl_ctx *ctx, fl_value razvyornutye, fl_value *result, fl_error *error);

/*
 * Функция flang «Развёрнутый тип».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param razvyornutye — «развёрнутые»: список: «Именованный тип»
 * @param imya — «имя»: строка
 * @return значение: «Тип»
 */
fl_status kompilyator_flang_razvyornutyy_tip(fl_ctx *ctx, fl_value razvyornutye, fl_value imya, fl_value *result, fl_error *error);

/*
 * Функция flang «Есть развёрнутый».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param razvyornutye — «развёрнутые»: список: «Именованный тип»
 * @param imya — «имя»: строка
 * @return значение
 */
fl_status kompilyator_flang_est_razvyornutyy(fl_ctx *ctx, fl_value razvyornutye, fl_value imya, fl_value *result, fl_error *error);

/*
 * Функция flang «Имя объявлено».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param sbor — «сбор»: «Сбор»
 * @param imya — «имя»: строка
 * @return значение
 */
fl_status kompilyator_flang_imya_obyavleno(fl_ctx *ctx, fl_value sbor, fl_value imya, fl_value *result, fl_error *error);

/*
 * Функция flang «Объявленные параметры типа».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param obyavlenie — «объявление»: «Значение»
 * @param imya — «имя»: строка
 * @param sbor — «сбор»: «Сбор»
 * @return значение: «Итог имён»
 */
fl_status kompilyator_flang_obyavlennye_parametry_tipa(fl_ctx *ctx, fl_value obyavlenie, fl_value imya, fl_value sbor, fl_value *result, fl_error *error);

/*
 * Функция flang «Обойти параметры типа».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * Хвостовой самовызов развёрнут в цикл: стек не растёт.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param uzly — «узлы»: список: «Значение»
 * @param obyavlenie — «объявление»: «Значение»
 * @param imya — «имя»: строка
 * @param gotovye — «готовые»: список: строка
 * @param sbor — «сбор»: «Сбор»
 * @return значение: «Итог имён»
 */
fl_status kompilyator_flang_oboyti_parametry_tipa(fl_ctx *ctx, fl_value uzly, fl_value obyavlenie, fl_value imya, fl_value gotovye, fl_value sbor, fl_value *result, fl_error *error);

/*
 * Функция flang «Проверить параметр типа».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param uzel — «узел»: «Значение»
 * @param obyavlenie — «объявление»: «Значение»
 * @param imya — «имя»: строка
 * @param gotovye — «готовые»: список: строка
 * @param sbor — «сбор»: «Сбор»
 * @return значение: «Шаг параметра»
 */
fl_status kompilyator_flang_proverit_parametr_tipa(fl_ctx *ctx, fl_value uzel, fl_value obyavlenie, fl_value imya, fl_value gotovye, fl_value sbor, fl_value *result, fl_error *error);

/*
 * Функция flang «Открыть область типов».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param imya — «имя»: строка
 * @param obyavlenie — «объявление»: «Значение»
 * @param sbor — «сбор»: «Сбор»
 * @return значение: «Сбор»
 */
fl_status kompilyator_flang_otkryt_oblast_tipov(fl_ctx *ctx, fl_value imya, fl_value obyavlenie, fl_value sbor, fl_value *result, fl_error *error);

/*
 * Функция flang «Сверить затенение».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * Хвостовой самовызов развёрнут в цикл: стек не растёт.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param parametry — «параметры»: список: строка
 * @param obyavlenie — «объявление»: «Значение»
 * @param imya — «имя»: строка
 * @param sbor — «сбор»: «Сбор»
 * @return значение: «Сбор»
 */
fl_status kompilyator_flang_sverit_zatenenie(fl_ctx *ctx, fl_value parametry, fl_value obyavlenie, fl_value imya, fl_value sbor, fl_value *result, fl_error *error);

/*
 * Функция flang «Нормализовать тип».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param uzel — «узел»: «Значение»
 * @param est — «есть»
 * @param sbor — «сбор»: «Сбор»
 * @param mesto — «место»: «Значение»
 * @return значение: «Итог типа»
 */
fl_status kompilyator_flang_normalizovat_tip(fl_ctx *ctx, fl_value uzel, fl_value est, fl_value sbor, fl_value mesto, fl_value *result, fl_error *error);

/*
 * Функция flang «Нормализовать заданный».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param uzel — «узел»: «Значение»
 * @param sbor — «сбор»: «Сбор»
 * @param mesto — «место»: «Значение»
 * @return значение: «Итог типа»
 */
fl_status kompilyator_flang_normalizovat_zadannyy(fl_ctx *ctx, fl_value uzel, fl_value sbor, fl_value mesto, fl_value *result, fl_error *error);

/*
 * Функция flang «Нормализовать узел».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param uzel — «узел»: «Значение»
 * @param sbor — «сбор»: «Сбор»
 * @param mesto — «место»: «Значение»
 * @return значение: «Итог типа»
 */
fl_status kompilyator_flang_normalizovat_uzel(fl_ctx *ctx, fl_value uzel, fl_value sbor, fl_value mesto, fl_value *result, fl_error *error);

/*
 * Функция flang «Нормализовать не джокер».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param uzel — «узел»: «Значение»
 * @param vid — «вид»: строка
 * @param neobyazatelno — «необязательно»
 * @param sbor — «сбор»: «Сбор»
 * @param mesto — «место»: «Значение»
 * @return значение: «Итог типа»
 */
fl_status kompilyator_flang_normalizovat_ne_dzhoker(fl_ctx *ctx, fl_value uzel, fl_value vid, fl_value neobyazatelno, fl_value sbor, fl_value mesto, fl_value *result, fl_error *error);

/*
 * Функция flang «Нормализовать не состояние».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param uzel — «узел»: «Значение»
 * @param vid — «вид»: строка
 * @param neobyazatelno — «необязательно»
 * @param sbor — «сбор»: «Сбор»
 * @param mesto — «место»: «Значение»
 * @return значение: «Итог типа»
 */
fl_status kompilyator_flang_normalizovat_ne_sostoyanie(fl_ctx *ctx, fl_value uzel, fl_value vid, fl_value neobyazatelno, fl_value sbor, fl_value mesto, fl_value *result, fl_error *error);

/*
 * Функция flang «Нормализовать составной».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param uzel — «узел»: «Значение»
 * @param vid — «вид»: строка
 * @param neobyazatelno — «необязательно»
 * @param sbor — «сбор»: «Сбор»
 * @param mesto — «место»: «Значение»
 * @return значение: «Итог типа»
 */
fl_status kompilyator_flang_normalizovat_sostavnoy(fl_ctx *ctx, fl_value uzel, fl_value vid, fl_value neobyazatelno, fl_value sbor, fl_value mesto, fl_value *result, fl_error *error);

/*
 * Функция flang «Нормализовать функцию».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param uzel — «узел»: «Значение»
 * @param neobyazatelno — «необязательно»
 * @param sbor — «сбор»: «Сбор»
 * @param mesto — «место»: «Значение»
 * @return значение: «Итог типа»
 */
fl_status kompilyator_flang_normalizovat_funkciyu(fl_ctx *ctx, fl_value uzel, fl_value neobyazatelno, fl_value sbor, fl_value mesto, fl_value *result, fl_error *error);

/*
 * Функция flang «Нормализовать типы».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Хвостовой самовызов развёрнут в цикл: стек не растёт.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param uzly — «узлы»: список: «Значение»
 * @param gotovye — «готовые»: список: «Тип»
 * @param sbor — «сбор»: «Сбор»
 * @param mesto — «место»: «Значение»
 * @return значение: «Итог типов»
 */
fl_status kompilyator_flang_normalizovat_tipy(fl_ctx *ctx, fl_value uzly, fl_value gotovye, fl_value sbor, fl_value mesto, fl_value *result, fl_error *error);

/*
 * Функция flang «Нормализовать список».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param uzel — «узел»: «Значение»
 * @param neobyazatelno — «необязательно»
 * @param sbor — «сбор»: «Сбор»
 * @param mesto — «место»: «Значение»
 * @return значение: «Итог типа»
 */
fl_status kompilyator_flang_normalizovat_spisok(fl_ctx *ctx, fl_value uzel, fl_value neobyazatelno, fl_value sbor, fl_value mesto, fl_value *result, fl_error *error);

/*
 * Функция flang «Нормализовать элемент».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param vybor — «выбор»: «Выбор ключа»
 * @param neobyazatelno — «необязательно»
 * @param sbor — «сбор»: «Сбор»
 * @param mesto — «место»: «Значение»
 * @return значение: «Итог типа»
 */
fl_status kompilyator_flang_normalizovat_element(fl_ctx *ctx, fl_value vybor, fl_value neobyazatelno, fl_value sbor, fl_value mesto, fl_value *result, fl_error *error);

/*
 * Функция flang «Нормализовать именованный».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param uzel — «узел»: «Значение»
 * @param vid — «вид»: строка
 * @param neobyazatelno — «необязательно»
 * @param sbor — «сбор»: «Сбор»
 * @param mesto — «место»: «Значение»
 * @return значение: «Итог типа»
 */
fl_status kompilyator_flang_normalizovat_imenovannyy(fl_ctx *ctx, fl_value uzel, fl_value vid, fl_value neobyazatelno, fl_value sbor, fl_value mesto, fl_value *result, fl_error *error);

/*
 * Функция flang «Нормализовать по имени».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param uzel — «узел»: «Значение»
 * @param neobyazatelno — «необязательно»
 * @param sbor — «сбор»: «Сбор»
 * @param mesto — «место»: «Значение»
 * @return значение: «Итог типа»
 */
fl_status kompilyator_flang_normalizovat_po_imeni(fl_ctx *ctx, fl_value uzel, fl_value neobyazatelno, fl_value sbor, fl_value mesto, fl_value *result, fl_error *error);

/*
 * Функция flang «Неизвестный вид типа».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param uzel — «узел»: «Значение»
 * @param vid — «вид»: строка
 * @param sbor — «сбор»: «Сбор»
 * @param mesto — «место»: «Значение»
 * @return значение: «Итог типа»
 */
fl_status kompilyator_flang_neizvestnyy_vid_tipa(fl_ctx *ctx, fl_value uzel, fl_value vid, fl_value sbor, fl_value mesto, fl_value *result, fl_error *error);

/*
 * Функция flang «Имя или скаляр».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param imya — «имя»: строка
 * @param eto_imya — «это имя»
 * @param argumenty — «аргументы»: список: «Значение»
 * @param sbor — «сбор»: «Сбор»
 * @param mesto — «место»: «Значение»
 * @return значение: «Итог типа»
 */
fl_status kompilyator_flang_imya_ili_skalyar(fl_ctx *ctx, fl_value imya, fl_value eto_imya, fl_value argumenty, fl_value sbor, fl_value mesto, fl_value *result, fl_error *error);

/*
 * Функция flang «Имя в области».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param imya — «имя»: строка
 * @param argumenty — «аргументы»: список: «Значение»
 * @param sbor — «сбор»: «Сбор»
 * @param mesto — «место»: «Значение»
 * @return значение: «Итог типа»
 */
fl_status kompilyator_flang_imya_v_oblasti(fl_ctx *ctx, fl_value imya, fl_value argumenty, fl_value sbor, fl_value mesto, fl_value *result, fl_error *error);

/*
 * Функция flang «Имя объявленного».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param imya — «имя»: строка
 * @param razobrany — «разобраны»: «Итог типов»
 * @param mesto — «место»: «Значение»
 * @return значение: «Итог типа»
 */
fl_status kompilyator_flang_imya_obyavlennogo(fl_ctx *ctx, fl_value imya, fl_value razobrany, fl_value mesto, fl_value *result, fl_error *error);

/*
 * Функция flang «Применить объявление».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param tip — «тип»: «Тип»
 * @param imya — «имя»: строка
 * @param skolko — «сколько»: число
 * @param sbor — «сбор»: «Сбор»
 * @param mesto — «место»: «Значение»
 * @return значение: «Итог типа»
 */
fl_status kompilyator_flang_primenit_obyavlenie(fl_ctx *ctx, fl_value tip, fl_value imya, fl_value skolko, fl_value sbor, fl_value mesto, fl_value *result, fl_error *error);

/*
 * Функция flang «Применить псевдоним».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param imya — «имя»: строка
 * @param argumenty — «аргументы»: список: «Тип»
 * @param sbor — «сбор»: «Сбор»
 * @param mesto — «место»: «Значение»
 * @return значение: «Итог типа»
 */
fl_status kompilyator_flang_primenit_psevdonim(fl_ctx *ctx, fl_value imya, fl_value argumenty, fl_value sbor, fl_value mesto, fl_value *result, fl_error *error);

/*
 * Функция flang «Развернуть псевдоним».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param imya — «имя»: строка
 * @param sbor — «сбор»: «Сбор»
 * @return значение: «Итог типа»
 */
fl_status kompilyator_flang_razvernut_psevdonim(fl_ctx *ctx, fl_value imya, fl_value sbor, fl_value *result, fl_error *error);

/*
 * Функция flang «Развернуть впервые».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param imya — «имя»: строка
 * @param sbor — «сбор»: «Сбор»
 * @return значение: «Итог типа»
 */
fl_status kompilyator_flang_razvernut_vpervye(fl_ctx *ctx, fl_value imya, fl_value sbor, fl_value *result, fl_error *error);

/*
 * Функция flang «Замкнутый псевдоним».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param imya — «имя»: строка
 * @param psevdonim — «псевдоним»: «Псевдоним»
 * @param sbor — «сбор»: «Сбор»
 * @return значение: «Итог типа»
 */
fl_status kompilyator_flang_zamknutyy_psevdonim(fl_ctx *ctx, fl_value imya, fl_value psevdonim, fl_value sbor, fl_value *result, fl_error *error);

/*
 * Функция flang «Развернуть тело».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param imya — «имя»: строка
 * @param psevdonim — «псевдоним»: «Псевдоним»
 * @param sbor — «сбор»: «Сбор»
 * @return значение: «Итог типа»
 */
fl_status kompilyator_flang_razvernut_telo(fl_ctx *ctx, fl_value imya, fl_value psevdonim, fl_value sbor, fl_value *result, fl_error *error);

/*
 * Функция flang «Собрать поля».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Взаимная хвостовая рекурсия с «Собрать новое поле», «Собрать поле»: вызовы идут через батут.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param polya — «поля»: список: «Значение»
 * @param gotovye — «готовые»: список: «Поле типа»
 * @param sbor — «сбор»: «Сбор»
 * @param mesto — «место»: «Значение»
 * @return значение: «Итог полей»
 */
fl_status kompilyator_flang_sobrat_polya(fl_ctx *ctx, fl_value polya, fl_value gotovye, fl_value sbor, fl_value mesto, fl_value *result, fl_error *error);

/*
 * Функция flang «Собрать поле».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Взаимная хвостовая рекурсия с «Собрать новое поле», «Собрать поля»: вызовы идут через батут.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param pole — «поле»: «Значение»
 * @param ostalnye — «остальные»: список: «Значение»
 * @param gotovye — «готовые»: список: «Поле типа»
 * @param sbor — «сбор»: «Сбор»
 * @param mesto — «место»: «Значение»
 * @return значение: «Итог полей»
 */
fl_status kompilyator_flang_sobrat_pole(fl_ctx *ctx, fl_value pole, fl_value ostalnye, fl_value gotovye, fl_value sbor, fl_value mesto, fl_value *result, fl_error *error);

/*
 * Функция flang «Собрать новое поле».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Взаимная хвостовая рекурсия с «Собрать поле», «Собрать поля»: вызовы идут через батут.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param pole — «поле»: «Значение»
 * @param imya — «имя»: строка
 * @param ostalnye — «остальные»: список: «Значение»
 * @param gotovye — «готовые»: список: «Поле типа»
 * @param sbor — «сбор»: «Сбор»
 * @param mesto — «место»: «Значение»
 * @return значение: «Итог полей»
 */
fl_status kompilyator_flang_sobrat_novoe_pole(fl_ctx *ctx, fl_value pole, fl_value imya, fl_value ostalnye, fl_value gotovye, fl_value sbor, fl_value mesto, fl_value *result, fl_error *error);

/*
 * Функция flang «Собрать имена типов».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * Хвостовой самовызов развёрнут в цикл: стек не растёт.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param obyavleniya — «объявления»: список: «Значение»
 * @param nomer — «номер»: число
 * @param sbor — «сбор»: «Сбор»
 * @return значение: «Сбор»
 */
fl_status kompilyator_flang_sobrat_imena_tipov(fl_ctx *ctx, fl_value obyavleniya, fl_value nomer, fl_value sbor, fl_value *result, fl_error *error);

/*
 * Функция flang «Собрать имя типа».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param obyavlenie — «объявление»: «Значение»
 * @param nomer — «номер»: число
 * @param sbor — «сбор»: «Сбор»
 * @return значение: «Сбор»
 */
fl_status kompilyator_flang_sobrat_imya_tipa(fl_ctx *ctx, fl_value obyavlenie, fl_value nomer, fl_value sbor, fl_value *result, fl_error *error);

/*
 * Функция flang «Завести имя типа».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param obyavlenie — «объявление»: «Значение»
 * @param imya — «имя»: строка
 * @param nomer — «номер»: число
 * @param sbor_do_parametrov — «сбор до параметров»: «Сбор»
 * @return значение: «Сбор»
 */
fl_status kompilyator_flang_zavesti_imya_tipa(fl_ctx *ctx, fl_value obyavlenie, fl_value imya, fl_value nomer, fl_value sbor_do_parametrov, fl_value *result, fl_error *error);

/*
 * Функция flang «Собрать тела типов».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Хвостовой самовызов развёрнут в цикл: стек не растёт.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param obyavleniya — «объявления»: список: «Значение»
 * @param nomer — «номер»: число
 * @param sbor — «сбор»: «Сбор»
 * @return значение: «Сбор»
 */
fl_status kompilyator_flang_sobrat_tela_tipov(fl_ctx *ctx, fl_value obyavleniya, fl_value nomer, fl_value sbor, fl_value *result, fl_error *error);

/*
 * Функция flang «Собрать тело типа».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param obyavlenie — «объявление»: «Значение»
 * @param nomer — «номер»: число
 * @param sbor — «сбор»: «Сбор»
 * @return значение: «Сбор»
 */
fl_status kompilyator_flang_sobrat_telo_tipa(fl_ctx *ctx, fl_value obyavlenie, fl_value nomer, fl_value sbor, fl_value *result, fl_error *error);

/*
 * Функция flang «Собрать тело названного».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param obyavlenie — «объявление»: «Значение»
 * @param imya — «имя»: строка
 * @param nomer — «номер»: число
 * @param sbor — «сбор»: «Сбор»
 * @return значение: «Сбор»
 */
fl_status kompilyator_flang_sobrat_telo_nazvannogo(fl_ctx *ctx, fl_value obyavlenie, fl_value imya, fl_value nomer, fl_value sbor, fl_value *result, fl_error *error);

/*
 * Функция flang «Развернуть объявленный псевдоним».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param imya — «имя»: строка
 * @param nomer — «номер»: число
 * @param sbor — «сбор»: «Сбор»
 * @return значение: «Сбор»
 */
fl_status kompilyator_flang_razvernut_obyavlennyy_psevdonim(fl_ctx *ctx, fl_value imya, fl_value nomer, fl_value sbor, fl_value *result, fl_error *error);

/*
 * Функция flang «Собрать поля записи».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param obyavlenie — «объявление»: «Значение»
 * @param imya — «имя»: строка
 * @param sbor — «сбор»: «Сбор»
 * @return значение: «Сбор»
 */
fl_status kompilyator_flang_sobrat_polya_zapisi(fl_ctx *ctx, fl_value obyavlenie, fl_value imya, fl_value sbor, fl_value *result, fl_error *error);

/*
 * Функция flang «Собрать варианты суммы».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param obyavlenie — «объявление»: «Значение»
 * @param imya — «имя»: строка
 * @param sbor — «сбор»: «Сбор»
 * @return значение: «Сбор»
 */
fl_status kompilyator_flang_sobrat_varianty_summy(fl_ctx *ctx, fl_value obyavlenie, fl_value imya, fl_value sbor, fl_value *result, fl_error *error);

/*
 * Функция flang «Собрать варианты».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Хвостовой самовызов развёрнут в цикл: стек не растёт.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param varianty — «варианты»: список: «Значение»
 * @param obyavlenie — «объявление»: «Значение»
 * @param imya — «имя»: строка
 * @param sbor — «сбор»: «Сбор»
 * @return значение: «Сбор»
 */
fl_status kompilyator_flang_sobrat_varianty(fl_ctx *ctx, fl_value varianty, fl_value obyavlenie, fl_value imya, fl_value sbor, fl_value *result, fl_error *error);

/*
 * Функция flang «Собрать вариант».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param variant — «вариант»: «Значение»
 * @param obyavlenie — «объявление»: «Значение»
 * @param imya — «имя»: строка
 * @param sbor — «сбор»: «Сбор»
 * @return значение: «Сбор»
 */
fl_status kompilyator_flang_sobrat_variant(fl_ctx *ctx, fl_value variant, fl_value obyavlenie, fl_value imya, fl_value sbor, fl_value *result, fl_error *error);

/*
 * Функция flang «Завести вариант».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param variant — «вариант»: «Значение»
 * @param obyavlenie — «объявление»: «Значение»
 * @param imya — «имя»: строка
 * @param imya_varianta — «имя варианта»: строка
 * @param sbor — «сбор»: «Сбор»
 * @return значение: «Сбор»
 */
fl_status kompilyator_flang_zavesti_variant(fl_ctx *ctx, fl_value variant, fl_value obyavlenie, fl_value imya, fl_value imya_varianta, fl_value sbor, fl_value *result, fl_error *error);

/*
 * Функция flang «Сказать о владельце».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param variant — «вариант»: «Значение»
 * @param obyavlenie — «объявление»: «Значение»
 * @param imya — «имя»: строка
 * @param imya_varianta — «имя варианта»: строка
 * @param sbor — «сбор»: «Сбор»
 * @return значение: «Сбор»
 */
fl_status kompilyator_flang_skazat_o_vladelce(fl_ctx *ctx, fl_value variant, fl_value obyavlenie, fl_value imya, fl_value imya_varianta, fl_value sbor, fl_value *result, fl_error *error);

/*
 * Функция flang «Собрать сигнатуры».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Хвостовой самовызов развёрнут в цикл: стек не растёт.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param funkcii — «функции»: список: «Значение»
 * @param sbor — «сбор»: «Сбор»
 * @return значение: «Сбор»
 */
fl_status kompilyator_flang_sobrat_signatury(fl_ctx *ctx, fl_value funkcii, fl_value sbor, fl_value *result, fl_error *error);

/*
 * Функция flang «Собрать сигнатуру».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param funkciya — «функция»: «Значение»
 * @param sbor — «сбор»: «Сбор»
 * @return значение: «Сбор»
 */
fl_status kompilyator_flang_sobrat_signaturu(fl_ctx *ctx, fl_value funkciya, fl_value sbor, fl_value *result, fl_error *error);

/*
 * Функция flang «Завести сигнатуру».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param funkciya — «функция»: «Значение»
 * @param imya — «имя»: строка
 * @param sbor_do_oblasti — «сбор до области»: «Сбор»
 * @return значение: «Сбор»
 */
fl_status kompilyator_flang_zavesti_signaturu(fl_ctx *ctx, fl_value funkciya, fl_value imya, fl_value sbor_do_oblasti, fl_value *result, fl_error *error);

/*
 * Функция flang «Собрать параметры».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Взаимная хвостовая рекурсия с «Собрать новый параметр», «Собрать параметр»: вызовы идут через батут.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param parametry — «параметры»: список: «Значение»
 * @param gotovye — «готовые»: список: «Параметр»
 * @param imya — «имя»: строка
 * @param funkciya — «функция»: «Значение»
 * @param sbor — «сбор»: «Сбор»
 * @return значение: «Итог параметров»
 */
fl_status kompilyator_flang_sobrat_parametry(fl_ctx *ctx, fl_value parametry, fl_value gotovye, fl_value imya, fl_value funkciya, fl_value sbor, fl_value *result, fl_error *error);

/*
 * Функция flang «Собрать параметр».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Взаимная хвостовая рекурсия с «Собрать новый параметр», «Собрать параметры»: вызовы идут через батут.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param parametr — «параметр»: «Значение»
 * @param ostalnye — «остальные»: список: «Значение»
 * @param gotovye — «готовые»: список: «Параметр»
 * @param imya — «имя»: строка
 * @param funkciya — «функция»: «Значение»
 * @param sbor — «сбор»: «Сбор»
 * @return значение: «Итог параметров»
 */
fl_status kompilyator_flang_sobrat_parametr(fl_ctx *ctx, fl_value parametr, fl_value ostalnye, fl_value gotovye, fl_value imya, fl_value funkciya, fl_value sbor, fl_value *result, fl_error *error);

/*
 * Функция flang «Собрать новый параметр».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Взаимная хвостовая рекурсия с «Собрать параметр», «Собрать параметры»: вызовы идут через батут.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param parametr — «параметр»: «Значение»
 * @param imya_parametra — «имя параметра»: строка
 * @param ostalnye — «остальные»: список: «Значение»
 * @param gotovye — «готовые»: список: «Параметр»
 * @param imya — «имя»: строка
 * @param funkciya — «функция»: «Значение»
 * @param sbor — «сбор»: «Сбор»
 * @return значение: «Итог параметров»
 */
fl_status kompilyator_flang_sobrat_novyy_parametr(fl_ctx *ctx, fl_value parametr, fl_value imya_parametra, fl_value ostalnye, fl_value gotovye, fl_value imya, fl_value funkciya, fl_value sbor, fl_value *result, fl_error *error);

/*
 * Функция flang «Вывод».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param tip — «тип»: «Тип»
 * @param bedy — «беды»: список: «Беда»
 * @return значение: «Итог вывода»
 */
fl_status kompilyator_flang_vyvod(fl_ctx *ctx, fl_value tip, fl_value bedy, fl_value *result, fl_error *error);

/*
 * Функция flang «Не выражение».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param uzel — «узел»: «Значение»
 * @param bedy — «беды»: список: «Беда»
 * @return значение: «Итог вывода»
 */
fl_status kompilyator_flang_ne_vyrazhenie(fl_ctx *ctx, fl_value uzel, fl_value bedy, fl_value *result, fl_error *error);

/*
 * Функция flang «Тип выражения».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Взаимная хвостовая рекурсия с «Тип пусть», «Тип узла»: вызовы идут через батут.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param uzel — «узел»: «Значение»
 * @param imena — «имена»: «Имена»
 * @param ozhidaemyy — «ожидаемый»: «Может быть тип»
 * @param tablicy — «таблицы»: «Таблицы»
 * @param bedy — «беды»: список: «Беда»
 * @return значение: «Итог вывода»
 */
fl_status kompilyator_flang_tip_vyrazheniya(fl_ctx *ctx, fl_value uzel, fl_value imena, fl_value ozhidaemyy, fl_value tablicy, fl_value bedy, fl_value *result, fl_error *error);

/*
 * Функция flang «Неизвестный вид выражения».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param uzel — «узел»: «Значение»
 * @param bedy — «беды»: список: «Беда»
 * @return значение: «Итог вывода»
 */
fl_status kompilyator_flang_neizvestnyy_vid_vyrazheniya(fl_ctx *ctx, fl_value uzel, fl_value bedy, fl_value *result, fl_error *error);

/*
 * Функция flang «Тип узла».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Взаимная хвостовая рекурсия с «Тип пусть», «Тип выражения»: вызовы идут через батут.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param uzel — «узел»: «Значение»
 * @param imena — «имена»: «Имена»
 * @param ozhidaemyy — «ожидаемый»: «Может быть тип»
 * @param tablicy — «таблицы»: «Таблицы»
 * @param bedy — «беды»: список: «Беда»
 * @return значение: «Итог вывода»
 */
fl_status kompilyator_flang_tip_uzla(fl_ctx *ctx, fl_value uzel, fl_value imena, fl_value ozhidaemyy, fl_value tablicy, fl_value bedy, fl_value *result, fl_error *error);

/*
 * Функция flang «Тип литерала».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param mesto — «место»: «Значение»
 * @param znachenie — «значение»: «Значение»
 * @param est — «есть»
 * @param bedy — «беды»: список: «Беда»
 * @return значение: «Итог вывода»
 */
fl_status kompilyator_flang_tip_literala(fl_ctx *ctx, fl_value mesto, fl_value znachenie, fl_value est, fl_value bedy, fl_value *result, fl_error *error);

/*
 * Функция flang «Тип значения литерала».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param mesto — «место»: «Значение»
 * @param znachenie — «значение»: «Значение»
 * @param bedy — «беды»: список: «Беда»
 * @return значение: «Итог вывода»
 */
fl_status kompilyator_flang_tip_znacheniya_literala(fl_ctx *ctx, fl_value mesto, fl_value znachenie, fl_value bedy, fl_value *result, fl_error *error);

/*
 * Функция flang «Не скаляр».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param mesto — «место»: «Значение»
 * @param znachenie — «значение»: «Значение»
 * @param bedy — «беды»: список: «Беда»
 * @return значение: «Итог вывода»
 */
fl_status kompilyator_flang_ne_skalyar(fl_ctx *ctx, fl_value mesto, fl_value znachenie, fl_value bedy, fl_value *result, fl_error *error);

/*
 * Функция flang «Тип скаляра литерала».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param mesto — «место»: «Значение»
 * @param skalyar — «скаляр»: «Скаляр»
 * @param bedy — «беды»: список: «Беда»
 * @return значение: «Итог вывода»
 */
fl_status kompilyator_flang_tip_skalyara_literala(fl_ctx *ctx, fl_value mesto, fl_value skalyar, fl_value bedy, fl_value *result, fl_error *error);

/*
 * Функция flang «Целое ли число».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param znachenie — «значение»: число
 * @return значение
 */
fl_status kompilyator_flang_celoe_li_chislo(fl_ctx *ctx, fl_value znachenie, fl_value *result, fl_error *error);

/*
 * Функция flang «Тип литерального числа».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param znachenie — «значение»: число
 * @return значение: «Тип»
 */
fl_status kompilyator_flang_tip_literalnogo_chisla(fl_ctx *ctx, fl_value znachenie, fl_value *result, fl_error *error);

/*
 * Функция flang «Тип имени».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param uzel — «узел»: «Значение»
 * @param imena — «имена»: «Имена»
 * @param bedy — «беды»: список: «Беда»
 * @return значение: «Итог вывода»
 */
fl_status kompilyator_flang_tip_imeni(fl_ctx *ctx, fl_value uzel, fl_value imena, fl_value bedy, fl_value *result, fl_error *error);

/*
 * Функция flang «Тип поля записи».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param uzel — «узел»: «Значение»
 * @param imena — «имена»: «Имена»
 * @param tablicy — «таблицы»: «Таблицы»
 * @param bedy — «беды»: список: «Беда»
 * @return значение: «Итог вывода»
 */
fl_status kompilyator_flang_tip_polya_zapisi(fl_ctx *ctx, fl_value uzel, fl_value imena, fl_value tablicy, fl_value bedy, fl_value *result, fl_error *error);

/*
 * Функция flang «Тип поля известной цели».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param uzel — «узел»: «Значение»
 * @param cel — «цель»: «Тип»
 * @param tablicy — «таблицы»: «Таблицы»
 * @param bedy — «беды»: список: «Беда»
 * @return значение: «Итог вывода»
 */
fl_status kompilyator_flang_tip_polya_izvestnoy_celi(fl_ctx *ctx, fl_value uzel, fl_value cel, fl_value tablicy, fl_value bedy, fl_value *result, fl_error *error);

/*
 * Функция flang «Тип поля по имени».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param uzel — «узел»: «Значение»
 * @param cel — «цель»: «Тип»
 * @param tablicy — «таблицы»: «Таблицы»
 * @param bedy — «беды»: список: «Беда»
 * @return значение: «Итог вывода»
 */
fl_status kompilyator_flang_tip_polya_po_imeni(fl_ctx *ctx, fl_value uzel, fl_value cel, fl_value tablicy, fl_value bedy, fl_value *result, fl_error *error);

/*
 * Функция flang «Тип пусть».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Взаимная хвостовая рекурсия с «Тип узла», «Тип выражения»: вызовы идут через батут.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param uzel — «узел»: «Значение»
 * @param imena — «имена»: «Имена»
 * @param ozhidaemyy — «ожидаемый»: «Может быть тип»
 * @param tablicy — «таблицы»: «Таблицы»
 * @param bedy — «беды»: список: «Беда»
 * @return значение: «Итог вывода»
 */
fl_status kompilyator_flang_tip_pust(fl_ctx *ctx, fl_value uzel, fl_value imena, fl_value ozhidaemyy, fl_value tablicy, fl_value bedy, fl_value *result, fl_error *error);

/*
 * Функция flang «Тип если».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param uzel — «узел»: «Значение»
 * @param imena — «имена»: «Имена»
 * @param ozhidaemyy — «ожидаемый»: «Может быть тип»
 * @param tablicy — «таблицы»: «Таблицы»
 * @param bedy — «беды»: список: «Беда»
 * @return значение: «Итог вывода»
 */
fl_status kompilyator_flang_tip_esli(fl_ctx *ctx, fl_value uzel, fl_value imena, fl_value ozhidaemyy, fl_value tablicy, fl_value bedy, fl_value *result, fl_error *error);

/*
 * Функция flang «Свести ветви».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param togda — «тогда»: «Тип»
 * @param inache — «иначе»: «Тип»
 * @return значение: «Тип»
 */
fl_status kompilyator_flang_svesti_vetvi(fl_ctx *ctx, fl_value togda, fl_value inache, fl_value *result, fl_error *error);

/*
 * Функция flang «Сузить имена».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Взаимная хвостовая рекурсия с «Сузить по логике»: вызовы идут через батут.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param uslovie — «условие»: «Значение»
 * @param imena — «имена»: «Имена»
 * @param vetv — «ветвь»
 * @return значение: «Имена»
 */
fl_status kompilyator_flang_suzit_imena(fl_ctx *ctx, fl_value uslovie, fl_value imena, fl_value vetv, fl_value *result, fl_error *error);

/*
 * Функция flang «Сузить по логике».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Взаимная хвостовая рекурсия с «Сузить имена»: вызовы идут через батут.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param uslovie — «условие»: «Значение»
 * @param imena — «имена»: «Имена»
 * @param vetv — «ветвь»
 * @return значение: «Имена»
 */
fl_status kompilyator_flang_suzit_po_logike(fl_ctx *ctx, fl_value uslovie, fl_value imena, fl_value vetv, fl_value *result, fl_error *error);

/*
 * Функция flang «Булев литерал».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param uzel — «узел»: «Значение»
 * @return значение: строка
 */
fl_status kompilyator_flang_bulev_literal(fl_ctx *ctx, fl_value uzel, fl_value *result, fl_error *error);

/*
 * Функция flang «Это ложь в значении».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param znachenie — «значение»: «Значение»
 * @return значение
 */
fl_status kompilyator_flang_eto_lozh_v_znachenii(fl_ctx *ctx, fl_value znachenie, fl_value *result, fl_error *error);

/*
 * Функция flang «Это ложь в скаляре».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param skalyar — «скаляр»: «Скаляр»
 * @return значение
 */
fl_status kompilyator_flang_eto_lozh_v_skalyare(fl_ctx *ctx, fl_value skalyar, fl_value *result, fl_error *error);

/*
 * Функция flang «Сузить по сравнению».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param uslovie — «условие»: «Значение»
 * @param imena — «имена»: «Имена»
 * @param vetv — «ветвь»
 * @return значение: «Имена»
 */
fl_status kompilyator_flang_suzit_po_sravneniyu(fl_ctx *ctx, fl_value uslovie, fl_value imena, fl_value vetv, fl_value *result, fl_error *error);

/*
 * Функция flang «Сузить сторону».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param uslovie — «условие»: «Значение»
 * @param imena — «имена»: «Имена»
 * @param znak — «знак»: строка
 * @return значение: «Имена»
 */
fl_status kompilyator_flang_suzit_storonu(fl_ctx *ctx, fl_value uslovie, fl_value imena, fl_value znak, fl_value *result, fl_error *error);

/*
 * Функция flang «Имя узла».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param uzel — «узел»: «Значение»
 * @return значение: строка
 */
fl_status kompilyator_flang_imya_uzla(fl_ctx *ctx, fl_value uzel, fl_value *result, fl_error *error);

/*
 * Функция flang «Это числовой литерал».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param uzel — «узел»: «Значение»
 * @return значение
 */
fl_status kompilyator_flang_eto_chislovoy_literal(fl_ctx *ctx, fl_value uzel, fl_value *result, fl_error *error);

/*
 * Функция flang «Отрицание знака».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param znak — «знак»: строка
 * @return значение: строка
 */
fl_status kompilyator_flang_otricanie_znaka(fl_ctx *ctx, fl_value znak, fl_value *result, fl_error *error);

/*
 * Функция flang «Переворот знака».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param znak — «знак»: строка
 * @return значение: строка
 */
fl_status kompilyator_flang_perevorot_znaka(fl_ctx *ctx, fl_value znak, fl_value *result, fl_error *error);

/*
 * Функция flang «Наложить границу».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param imena — «имена»: «Имена»
 * @param imya — «имя»: строка
 * @param znak — «знак»: строка
 * @param predel — «предел»: число
 * @return значение: «Имена»
 */
fl_status kompilyator_flang_nalozhit_granicu(fl_ctx *ctx, fl_value imena, fl_value imya, fl_value znak, fl_value predel, fl_value *result, fl_error *error);

/*
 * Функция flang «Наложить на тип».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param imena — «имена»: «Имена»
 * @param imya — «имя»: строка
 * @param tip — «тип»: «Тип»
 * @param znak — «знак»: строка
 * @param predel — «предел»: число
 * @return значение: «Имена»
 */
fl_status kompilyator_flang_nalozhit_na_tip(fl_ctx *ctx, fl_value imena, fl_value imya, fl_value tip, fl_value znak, fl_value predel, fl_value *result, fl_error *error);

/*
 * Функция flang «Сузить отрезок».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param tip — «тип»: «Тип»
 * @param znak — «знак»: строка
 * @param predel — «предел»: число
 * @return значение: «Тип»
 */
fl_status kompilyator_flang_suzit_otrezok(fl_ctx *ctx, fl_value tip, fl_value znak, fl_value predel, fl_value *result, fl_error *error);

/*
 * Функция flang «Узел или узел».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param uzel — «узел»: «Значение»
 * @param klyuch — «ключ»: строка
 * @return значение: «Значение»
 */
fl_status kompilyator_flang_uzel_ili_uzel(fl_ctx *ctx, fl_value uzel, fl_value klyuch, fl_value *result, fl_error *error);

/*
 * Функция flang «Тип вызова».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param uzel — «узел»: «Значение»
 * @param imena — «имена»: «Имена»
 * @param ozhidaemyy — «ожидаемый»: «Может быть тип»
 * @param tablicy — «таблицы»: «Таблицы»
 * @param bedy — «беды»: список: «Беда»
 * @return значение: «Итог вывода»
 */
fl_status kompilyator_flang_tip_vyzova(fl_ctx *ctx, fl_value uzel, fl_value imena, fl_value ozhidaemyy, fl_value tablicy, fl_value bedy, fl_value *result, fl_error *error);

/*
 * Функция flang «Обойти узлы».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Хвостовой самовызов развёрнут в цикл: стек не растёт.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param uzly — «узлы»: список: «Значение»
 * @param imena — «имена»: «Имена»
 * @param tablicy — «таблицы»: «Таблицы»
 * @param bedy — «беды»: список: «Беда»
 * @return значение: список: «Беда»
 */
fl_status kompilyator_flang_oboyti_uzly(fl_ctx *ctx, fl_value uzly, fl_value imena, fl_value tablicy, fl_value bedy, fl_value *result, fl_error *error);

/*
 * Функция flang «Тип известного вызова».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param uzel — «узел»: «Значение»
 * @param argumenty — «аргументы»: список: «Значение»
 * @param signatura — «сигнатура»: «Сигнатура»
 * @param imena — «имена»: «Имена»
 * @param ozhidaemyy — «ожидаемый»: «Может быть тип»
 * @param tablicy — «таблицы»: «Таблицы»
 * @param bedy — «беды»: список: «Беда»
 * @return значение: «Итог вывода»
 */
fl_status kompilyator_flang_tip_izvestnogo_vyzova(fl_ctx *ctx, fl_value uzel, fl_value argumenty, fl_value signatura, fl_value imena, fl_value ozhidaemyy, fl_value tablicy, fl_value bedy, fl_value *result, fl_error *error);

/*
 * Функция flang «Решить вызов».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param uzel — «узел»: «Значение»
 * @param signatura — «сигнатура»: «Сигнатура»
 * @param ozhidaemyy — «ожидаемый»: «Может быть тип»
 * @param svyazki — «связки»: список: «Связка типа»
 * @param bedy — «беды»: список: «Беда»
 * @return значение: «Итог вывода»
 */
fl_status kompilyator_flang_reshit_vyzov(fl_ctx *ctx, fl_value uzel, fl_value signatura, fl_value ozhidaemyy, fl_value svyazki, fl_value bedy, fl_value *result, fl_error *error);

/*
 * Функция flang «Проверить аргументы».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Хвостовой самовызов развёрнут в цикл: стек не растёт.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param argumenty — «аргументы»: список: «Значение»
 * @param parametry — «параметры»: список: «Параметр»
 * @param signatura — «сигнатура»: «Сигнатура»
 * @param imena — «имена»: «Имена»
 * @param tablicy — «таблицы»: «Таблицы»
 * @param svyazki — «связки»: список: «Связка типа»
 * @param bedy — «беды»: список: «Беда»
 * @return значение: «Ход аргументов»
 */
fl_status kompilyator_flang_proverit_argumenty(fl_ctx *ctx, fl_value argumenty, fl_value parametry, fl_value signatura, fl_value imena, fl_value tablicy, fl_value svyazki, fl_value bedy, fl_value *result, fl_error *error);

/*
 * Функция flang «Проверить аргумент».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param argument — «аргумент»: «Значение»
 * @param poisk — «поиск»: «Поиск параметра»
 * @param signatura — «сигнатура»: «Сигнатура»
 * @param imena — «имена»: «Имена»
 * @param tablicy — «таблицы»: «Таблицы»
 * @param svyazki — «связки»: список: «Связка типа»
 * @param bedy — «беды»: список: «Беда»
 * @return значение: «Ход аргументов»
 */
fl_status kompilyator_flang_proverit_argument(fl_ctx *ctx, fl_value argument, fl_value poisk, fl_value signatura, fl_value imena, fl_value tablicy, fl_value svyazki, fl_value bedy, fl_value *result, fl_error *error);

/*
 * Функция flang «Сверить аргумент».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param argument — «аргумент»: «Значение»
 * @param parametr — «параметр»: «Параметр»
 * @param signatura — «сигнатура»: «Сигнатура»
 * @param imena — «имена»: «Имена»
 * @param tablicy — «таблицы»: «Таблицы»
 * @param svyazki — «связки»: список: «Связка типа»
 * @param bedy — «беды»: список: «Беда»
 * @return значение: «Ход аргументов»
 */
fl_status kompilyator_flang_sverit_argument(fl_ctx *ctx, fl_value argument, fl_value parametr, fl_value signatura, fl_value imena, fl_value tablicy, fl_value svyazki, fl_value bedy, fl_value *result, fl_error *error);

/*
 * Функция flang «Все связаны».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * Хвостовой самовызов развёрнут в цикл: стек не растёт.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param imena — «имена»: список: строка
 * @param svyazki — «связки»: список: «Связка типа»
 * @return значение
 */
fl_status kompilyator_flang_vse_svyazany(fl_ctx *ctx, fl_value imena, fl_value svyazki, fl_value *result, fl_error *error);

/*
 * Функция flang «Назвать нерешённые».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * Хвостовой самовызов развёрнут в цикл: стек не растёт.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param imena — «имена»: список: строка
 * @param svyazki — «связки»: список: «Связка типа»
 * @param metka — «метка»: строка
 * @param uzel — «узел»: «Значение»
 * @param bedy — «беды»: список: «Беда»
 * @return значение: «Итог решения»
 */
fl_status kompilyator_flang_nazvat_nereshyonnye(fl_ctx *ctx, fl_value imena, fl_value svyazki, fl_value metka, fl_value uzel, fl_value bedy, fl_value *result, fl_error *error);

/*
 * Функция flang «Тип сигнатуры».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param signatura — «сигнатура»: «Сигнатура»
 * @return значение: «Тип»
 */
fl_status kompilyator_flang_tip_signatury(fl_ctx *ctx, fl_value signatura, fl_value *result, fl_error *error);

/*
 * Функция flang «Тип значения-функции».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param uzel — «узел»: «Значение»
 * @param tablicy — «таблицы»: «Таблицы»
 * @param bedy — «беды»: список: «Беда»
 * @return значение: «Итог вывода»
 */
fl_status kompilyator_flang_tip_znacheniya_funkcii(fl_ctx *ctx, fl_value uzel, fl_value tablicy, fl_value bedy, fl_value *result, fl_error *error);

/*
 * Функция flang «Тип применения».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param uzel — «узел»: «Значение»
 * @param imena — «имена»: «Имена»
 * @param tablicy — «таблицы»: «Таблицы»
 * @param bedy — «беды»: список: «Беда»
 * @return значение: «Итог вывода»
 */
fl_status kompilyator_flang_tip_primeneniya(fl_ctx *ctx, fl_value uzel, fl_value imena, fl_value tablicy, fl_value bedy, fl_value *result, fl_error *error);

/*
 * Функция flang «Тип применения к аргументам».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param uzel — «узел»: «Значение»
 * @param argumenty — «аргументы»: список: «Значение»
 * @param cel — «цель»: «Тип»
 * @param gde — «где»: строка
 * @param imena — «имена»: «Имена»
 * @param tablicy — «таблицы»: «Таблицы»
 * @param bedy — «беды»: список: «Беда»
 * @return значение: «Итог вывода»
 */
fl_status kompilyator_flang_tip_primeneniya_k_argumentam(fl_ctx *ctx, fl_value uzel, fl_value argumenty, fl_value cel, fl_value gde, fl_value imena, fl_value tablicy, fl_value bedy, fl_value *result, fl_error *error);

/*
 * Функция flang «Проверить аргументы применения».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Хвостовой самовызов развёрнут в цикл: стек не растёт.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param argumenty — «аргументы»: список: «Значение»
 * @param prinimaet — «принимает»: список: «Тип»
 * @param nomer — «номер»: число
 * @param gde — «где»: строка
 * @param imena — «имена»: «Имена»
 * @param tablicy — «таблицы»: «Таблицы»
 * @param bedy — «беды»: список: «Беда»
 * @return значение: список: «Беда»
 */
fl_status kompilyator_flang_proverit_argumenty_primeneniya(fl_ctx *ctx, fl_value argumenty, fl_value prinimaet, fl_value nomer, fl_value gde, fl_value imena, fl_value tablicy, fl_value bedy, fl_value *result, fl_error *error);

/*
 * Функция flang «Сверить аргумент применения».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param argument — «аргумент»: «Значение»
 * @param hotim — «хотим»: «Тип»
 * @param nomer — «номер»: число
 * @param gde — «где»: строка
 * @param imena — «имена»: «Имена»
 * @param tablicy — «таблицы»: «Таблицы»
 * @param bedy — «беды»: список: «Беда»
 * @return значение: список: «Беда»
 */
fl_status kompilyator_flang_sverit_argument_primeneniya(fl_ctx *ctx, fl_value argument, fl_value hotim, fl_value nomer, fl_value gde, fl_value imena, fl_value tablicy, fl_value bedy, fl_value *result, fl_error *error);

/*
 * Функция flang «Название применяемого».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param uzel — «узел»: «Значение»
 * @return значение: строка
 */
fl_status kompilyator_flang_nazvanie_primenyaemogo(fl_ctx *ctx, fl_value uzel, fl_value *result, fl_error *error);

/*
 * Функция flang «Тип операции».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param uzel — «узел»: «Значение»
 * @param imena — «имена»: «Имена»
 * @param tablicy — «таблицы»: «Таблицы»
 * @param bedy — «беды»: список: «Беда»
 * @return значение: «Итог вывода»
 */
fl_status kompilyator_flang_tip_operacii(fl_ctx *ctx, fl_value uzel, fl_value imena, fl_value tablicy, fl_value bedy, fl_value *result, fl_error *error);

/*
 * Функция flang «Тип операнда».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param uzel — «узел»: «Значение»
 * @param klyuch — «ключ»: строка
 * @param nuzhen — «нужен»: «Тип»
 * @param op — «оп»: строка
 * @param storona — «сторона»: строка
 * @param imena — «имена»: «Имена»
 * @param tablicy — «таблицы»: «Таблицы»
 * @param bedy — «беды»: список: «Беда»
 * @return значение: «Итог вывода»
 */
fl_status kompilyator_flang_tip_operanda(fl_ctx *ctx, fl_value uzel, fl_value klyuch, fl_value nuzhen, fl_value op, fl_value storona, fl_value imena, fl_value tablicy, fl_value bedy, fl_value *result, fl_error *error);

/*
 * Функция flang «Проверить операнд».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param uzel — «узел»: «Значение»
 * @param klyuch — «ключ»: строка
 * @param nuzhen — «нужен»: «Тип»
 * @param op — «оп»: строка
 * @param storona — «сторона»: строка
 * @param imena — «имена»: «Имена»
 * @param tablicy — «таблицы»: «Таблицы»
 * @param bedy — «беды»: список: «Беда»
 * @return значение: список: «Беда»
 */
fl_status kompilyator_flang_proverit_operand(fl_ctx *ctx, fl_value uzel, fl_value klyuch, fl_value nuzhen, fl_value op, fl_value storona, fl_value imena, fl_value tablicy, fl_value bedy, fl_value *result, fl_error *error);

/*
 * Функция flang «Тип арифметики».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param uzel — «узел»: «Значение»
 * @param op — «оп»: строка
 * @param imena — «имена»: «Имена»
 * @param tablicy — «таблицы»: «Таблицы»
 * @param bedy — «беды»: список: «Беда»
 * @return значение: «Итог вывода»
 */
fl_status kompilyator_flang_tip_arifmetiki(fl_ctx *ctx, fl_value uzel, fl_value op, fl_value imena, fl_value tablicy, fl_value bedy, fl_value *result, fl_error *error);

/*
 * Функция flang «Арифметика отрезков».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param op — «оп»: строка
 * @param levyy — «левый»: «Тип»
 * @param pravyy — «правый»: «Тип»
 * @return значение: «Тип»
 */
fl_status kompilyator_flang_arifmetika_otrezkov(fl_ctx *ctx, fl_value op, fl_value levyy, fl_value pravyy, fl_value *result, fl_error *error);

/*
 * Функция flang «Отрезок операции».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param op — «оп»: строка
 * @param a1 — «а1»: число
 * @param a2 — «а2»: число
 * @param b1 — «б1»: число
 * @param b2 — «б2»: число
 * @return значение: «Тип»
 */
fl_status kompilyator_flang_otrezok_operacii(fl_ctx *ctx, fl_value op, fl_value a1, fl_value a2, fl_value b1, fl_value b2, fl_value *result, fl_error *error);

/*
 * Функция flang «Отрезок произведения».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param pervyy — «первый»: число
 * @param vtoroy — «второй»: число
 * @param tretiy — «третий»: число
 * @param chetvyortyy — «четвёртый»: число
 * @return значение: «Тип»
 */
fl_status kompilyator_flang_otrezok_proizvedeniya(fl_ctx *ctx, fl_value pervyy, fl_value vtoroy, fl_value tretiy, fl_value chetvyortyy, fl_value *result, fl_error *error);

/*
 * Функция flang «Отрезок остатка».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param a1 — «а1»: число
 * @param b1 — «б1»: число
 * @param b2 — «б2»: число
 * @return значение: «Тип»
 */
fl_status kompilyator_flang_otrezok_ostatka(fl_ctx *ctx, fl_value a1, fl_value b1, fl_value b2, fl_value *result, fl_error *error);

/*
 * Функция flang «Тип склейки».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param uzel — «узел»: «Значение»
 * @param op — «оп»: строка
 * @param imena — «имена»: «Имена»
 * @param tablicy — «таблицы»: «Таблицы»
 * @param bedy — «беды»: список: «Беда»
 * @return значение: «Итог вывода»
 */
fl_status kompilyator_flang_tip_skleyki(fl_ctx *ctx, fl_value uzel, fl_value op, fl_value imena, fl_value tablicy, fl_value bedy, fl_value *result, fl_error *error);

/*
 * Функция flang «Тип порядка».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param uzel — «узел»: «Значение»
 * @param op — «оп»: строка
 * @param imena — «имена»: «Имена»
 * @param tablicy — «таблицы»: «Таблицы»
 * @param bedy — «беды»: список: «Беда»
 * @return значение: «Итог вывода»
 */
fl_status kompilyator_flang_tip_poryadka(fl_ctx *ctx, fl_value uzel, fl_value op, fl_value imena, fl_value tablicy, fl_value bedy, fl_value *result, fl_error *error);

/*
 * Функция flang «Сказать о порядке».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param tip — «тип»: «Тип»
 * @param storona — «сторона»: строка
 * @param op — «оп»: строка
 * @param uzel — «узел»: «Значение»
 * @param bedy — «беды»: список: «Беда»
 * @return значение: список: «Беда»
 */
fl_status kompilyator_flang_skazat_o_poryadke(fl_ctx *ctx, fl_value tip, fl_value storona, fl_value op, fl_value uzel, fl_value bedy, fl_value *result, fl_error *error);

/*
 * Функция flang «Сказать о сравнении».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param op — «оп»: строка
 * @param sleva — «слева»: «Тип»
 * @param sprava — «справа»: «Тип»
 * @param uzel — «узел»: «Значение»
 * @param bedy — «беды»: список: «Беда»
 * @return значение: список: «Беда»
 */
fl_status kompilyator_flang_skazat_o_sravnenii(fl_ctx *ctx, fl_value op, fl_value sleva, fl_value sprava, fl_value uzel, fl_value bedy, fl_value *result, fl_error *error);

/*
 * Функция flang «Тип равенства».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param uzel — «узел»: «Значение»
 * @param op — «оп»: строка
 * @param imena — «имена»: «Имена»
 * @param tablicy — «таблицы»: «Таблицы»
 * @param bedy — «беды»: список: «Беда»
 * @return значение: «Итог вывода»
 */
fl_status kompilyator_flang_tip_ravenstva(fl_ctx *ctx, fl_value uzel, fl_value op, fl_value imena, fl_value tablicy, fl_value bedy, fl_value *result, fl_error *error);

/*
 * Функция flang «Сказать о скалярах».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param tip — «тип»: «Тип»
 * @param uzel — «узел»: «Значение»
 * @param bedy — «беды»: список: «Беда»
 * @return значение: список: «Беда»
 */
fl_status kompilyator_flang_skazat_o_skalyarah(fl_ctx *ctx, fl_value tip, fl_value uzel, fl_value bedy, fl_value *result, fl_error *error);

/*
 * Функция flang «Тип неизвестной операции».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param uzel — «узел»: «Значение»
 * @param imena — «имена»: «Имена»
 * @param tablicy — «таблицы»: «Таблицы»
 * @param bedy — «беды»: список: «Беда»
 * @return значение: «Итог вывода»
 */
fl_status kompilyator_flang_tip_neizvestnoy_operacii(fl_ctx *ctx, fl_value uzel, fl_value imena, fl_value tablicy, fl_value bedy, fl_value *result, fl_error *error);

/*
 * Функция flang «Значения полей при проверке».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param polya — «поля»: список: «Поле значения»
 * @return значение: список: «Значение»
 */
fl_status kompilyator_flang_znacheniya_poley_pri_proverke(fl_ctx *ctx, fl_value polya, fl_value *result, fl_error *error);

/*
 * Функция flang «Тип конструктора».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param uzel — «узел»: «Значение»
 * @param imena — «имена»: «Имена»
 * @param ozhidaemyy — «ожидаемый»: «Может быть тип»
 * @param tablicy — «таблицы»: «Таблицы»
 * @param bedy — «беды»: список: «Беда»
 * @return значение: «Итог вывода»
 */
fl_status kompilyator_flang_tip_konstruktora(fl_ctx *ctx, fl_value uzel, fl_value imena, fl_value ozhidaemyy, fl_value tablicy, fl_value bedy, fl_value *result, fl_error *error);

/*
 * Функция flang «Тип известного конструктора».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param uzel — «узел»: «Значение»
 * @param imya_varianta — «имя варианта»: строка
 * @param vladelec — «владелец»: строка
 * @param dannye — «данные»: список: «Поле значения»
 * @param imena — «имена»: «Имена»
 * @param ozhidaemyy — «ожидаемый»: «Может быть тип»
 * @param tablicy — «таблицы»: «Таблицы»
 * @param bedy — «беды»: список: «Беда»
 * @return значение: «Итог вывода»
 */
fl_status kompilyator_flang_tip_izvestnogo_konstruktora(fl_ctx *ctx, fl_value uzel, fl_value imya_varianta, fl_value vladelec, fl_value dannye, fl_value imena, fl_value ozhidaemyy, fl_value tablicy, fl_value bedy, fl_value *result, fl_error *error);

/*
 * Функция flang «Проверить поля конструктора».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Хвостовой самовызов развёрнут в цикл: стек не растёт.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param obyavleno — «объявлено»: список: «Поле типа»
 * @param dannye — «данные»: список: «Поле значения»
 * @param uzel — «узел»: «Значение»
 * @param imya_varianta — «имя варианта»: строка
 * @param imena — «имена»: «Имена»
 * @param tablicy — «таблицы»: «Таблицы»
 * @param bez_parametrov — «без параметров»
 * @param svyazki — «связки»: список: «Связка типа»
 * @param bedy — «беды»: список: «Беда»
 * @return значение: «Ход аргументов»
 */
fl_status kompilyator_flang_proverit_polya_konstruktora(fl_ctx *ctx, fl_value obyavleno, fl_value dannye, fl_value uzel, fl_value imya_varianta, fl_value imena, fl_value tablicy, fl_value bez_parametrov, fl_value svyazki, fl_value bedy, fl_value *result, fl_error *error);

/*
 * Функция flang «Проверить поле конструктора».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param pole — «поле»: «Поле типа»
 * @param dannye — «данные»: список: «Поле значения»
 * @param uzel — «узел»: «Значение»
 * @param imya_varianta — «имя варианта»: строка
 * @param imena — «имена»: «Имена»
 * @param tablicy — «таблицы»: «Таблицы»
 * @param bez_parametrov — «без параметров»
 * @param svyazki — «связки»: список: «Связка типа»
 * @param bedy — «беды»: список: «Беда»
 * @return значение: «Ход аргументов»
 */
fl_status kompilyator_flang_proverit_pole_konstruktora(fl_ctx *ctx, fl_value pole, fl_value dannye, fl_value uzel, fl_value imya_varianta, fl_value imena, fl_value tablicy, fl_value bez_parametrov, fl_value svyazki, fl_value bedy, fl_value *result, fl_error *error);

/*
 * Функция flang «Сверить поле конструктора».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param pole — «поле»: «Поле типа»
 * @param znachenie — «значение»: «Значение»
 * @param imya_varianta — «имя варианта»: строка
 * @param imena — «имена»: «Имена»
 * @param tablicy — «таблицы»: «Таблицы»
 * @param bez_parametrov — «без параметров»
 * @param svyazki — «связки»: список: «Связка типа»
 * @param bedy — «беды»: список: «Беда»
 * @return значение: «Ход аргументов»
 */
fl_status kompilyator_flang_sverit_pole_konstruktora(fl_ctx *ctx, fl_value pole, fl_value znachenie, fl_value imya_varianta, fl_value imena, fl_value tablicy, fl_value bez_parametrov, fl_value svyazki, fl_value bedy, fl_value *result, fl_error *error);

/*
 * Функция flang «Решить построенное».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param osnova — «основа»: «Тип»
 * @param parametry_tipa — «параметры типа»: список: строка
 * @param svyazki — «связки»: список: «Связка типа»
 * @param ozhidaemyy — «ожидаемый»: «Может быть тип»
 * @param metka — «метка»: строка
 * @param uzel — «узел»: «Значение»
 * @param bedy — «беды»: список: «Беда»
 * @return значение: «Итог вывода»
 */
fl_status kompilyator_flang_reshit_postroennoe(fl_ctx *ctx, fl_value osnova, fl_value parametry_tipa, fl_value svyazki, fl_value ozhidaemyy, fl_value metka, fl_value uzel, fl_value bedy, fl_value *result, fl_error *error);

/*
 * Функция flang «Пересобрать применение».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param osnova — «основа»: «Тип»
 * @param argumenty — «аргументы»: список: «Тип»
 * @return значение: «Тип»
 */
fl_status kompilyator_flang_peresobrat_primenenie(fl_ctx *ctx, fl_value osnova, fl_value argumenty, fl_value *result, fl_error *error);

/*
 * Функция flang «Проверить лишние поля конструктора».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Хвостовой самовызов развёрнут в цикл: стек не растёт.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param dannye — «данные»: список: «Поле значения»
 * @param obyavleno — «объявлено»: список: «Поле типа»
 * @param uzel — «узел»: «Значение»
 * @param imya_varianta — «имя варианта»: строка
 * @param vladelec — «владелец»: строка
 * @param imena — «имена»: «Имена»
 * @param tablicy — «таблицы»: «Таблицы»
 * @param bedy — «беды»: список: «Беда»
 * @return значение: список: «Беда»
 */
fl_status kompilyator_flang_proverit_lishnie_polya_konstruktora(fl_ctx *ctx, fl_value dannye, fl_value obyavleno, fl_value uzel, fl_value imya_varianta, fl_value vladelec, fl_value imena, fl_value tablicy, fl_value bedy, fl_value *result, fl_error *error);

/*
 * Функция flang «Проверить лишнее поле конструктора».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param pole — «поле»: «Поле значения»
 * @param obyavleno — «объявлено»: список: «Поле типа»
 * @param uzel — «узел»: «Значение»
 * @param imya_varianta — «имя варианта»: строка
 * @param vladelec — «владелец»: строка
 * @param imena — «имена»: «Имена»
 * @param tablicy — «таблицы»: «Таблицы»
 * @param bedy — «беды»: список: «Беда»
 * @return значение: список: «Беда»
 */
fl_status kompilyator_flang_proverit_lishnee_pole_konstruktora(fl_ctx *ctx, fl_value pole, fl_value obyavleno, fl_value uzel, fl_value imya_varianta, fl_value vladelec, fl_value imena, fl_value tablicy, fl_value bedy, fl_value *result, fl_error *error);

/*
 * Функция flang «Тип записи выражения».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param uzel — «узел»: «Значение»
 * @param imena — «имена»: «Имена»
 * @param ozhidaemyy — «ожидаемый»: «Может быть тип»
 * @param tablicy — «таблицы»: «Таблицы»
 * @param bedy — «беды»: список: «Беда»
 * @return значение: «Итог вывода»
 */
fl_status kompilyator_flang_tip_zapisi_vyrazheniya(fl_ctx *ctx, fl_value uzel, fl_value imena, fl_value ozhidaemyy, fl_value tablicy, fl_value bedy, fl_value *result, fl_error *error);

/*
 * Функция flang «Тип известной записи».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param uzel — «узел»: «Значение»
 * @param imya_zapisi — «имя записи»: строка
 * @param dannye — «данные»: список: «Поле значения»
 * @param imena — «имена»: «Имена»
 * @param ozhidaemyy — «ожидаемый»: «Может быть тип»
 * @param tablicy — «таблицы»: «Таблицы»
 * @param bedy — «беды»: список: «Беда»
 * @return значение: «Итог вывода»
 */
fl_status kompilyator_flang_tip_izvestnoy_zapisi(fl_ctx *ctx, fl_value uzel, fl_value imya_zapisi, fl_value dannye, fl_value imena, fl_value ozhidaemyy, fl_value tablicy, fl_value bedy, fl_value *result, fl_error *error);

/*
 * Функция flang «Проверить поля записи».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Хвостовой самовызов развёрнут в цикл: стек не растёт.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param obyavleno — «объявлено»: список: «Поле типа»
 * @param dannye — «данные»: список: «Поле значения»
 * @param uzel — «узел»: «Значение»
 * @param imya_zapisi — «имя записи»: строка
 * @param imena — «имена»: «Имена»
 * @param tablicy — «таблицы»: «Таблицы»
 * @param bez_parametrov — «без параметров»
 * @param svyazki — «связки»: список: «Связка типа»
 * @param bedy — «беды»: список: «Беда»
 * @return значение: «Ход аргументов»
 */
fl_status kompilyator_flang_proverit_polya_zapisi(fl_ctx *ctx, fl_value obyavleno, fl_value dannye, fl_value uzel, fl_value imya_zapisi, fl_value imena, fl_value tablicy, fl_value bez_parametrov, fl_value svyazki, fl_value bedy, fl_value *result, fl_error *error);

/*
 * Функция flang «Проверить поле записи».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param pole — «поле»: «Поле типа»
 * @param dannye — «данные»: список: «Поле значения»
 * @param uzel — «узел»: «Значение»
 * @param imya_zapisi — «имя записи»: строка
 * @param imena — «имена»: «Имена»
 * @param tablicy — «таблицы»: «Таблицы»
 * @param bez_parametrov — «без параметров»
 * @param svyazki — «связки»: список: «Связка типа»
 * @param bedy — «беды»: список: «Беда»
 * @return значение: «Ход аргументов»
 */
fl_status kompilyator_flang_proverit_pole_zapisi(fl_ctx *ctx, fl_value pole, fl_value dannye, fl_value uzel, fl_value imya_zapisi, fl_value imena, fl_value tablicy, fl_value bez_parametrov, fl_value svyazki, fl_value bedy, fl_value *result, fl_error *error);

/*
 * Функция flang «Сверить поле записи».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param pole — «поле»: «Поле типа»
 * @param znachenie — «значение»: «Значение»
 * @param imya_zapisi — «имя записи»: строка
 * @param imena — «имена»: «Имена»
 * @param tablicy — «таблицы»: «Таблицы»
 * @param bez_parametrov — «без параметров»
 * @param svyazki — «связки»: список: «Связка типа»
 * @param bedy — «беды»: список: «Беда»
 * @return значение: «Ход аргументов»
 */
fl_status kompilyator_flang_sverit_pole_zapisi(fl_ctx *ctx, fl_value pole, fl_value znachenie, fl_value imya_zapisi, fl_value imena, fl_value tablicy, fl_value bez_parametrov, fl_value svyazki, fl_value bedy, fl_value *result, fl_error *error);

/*
 * Функция flang «Проверить лишние поля записи».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Хвостовой самовызов развёрнут в цикл: стек не растёт.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param dannye — «данные»: список: «Поле значения»
 * @param obyavleno — «объявлено»: список: «Поле типа»
 * @param uzel — «узел»: «Значение»
 * @param imya_zapisi — «имя записи»: строка
 * @param imena — «имена»: «Имена»
 * @param tablicy — «таблицы»: «Таблицы»
 * @param bedy — «беды»: список: «Беда»
 * @return значение: список: «Беда»
 */
fl_status kompilyator_flang_proverit_lishnie_polya_zapisi(fl_ctx *ctx, fl_value dannye, fl_value obyavleno, fl_value uzel, fl_value imya_zapisi, fl_value imena, fl_value tablicy, fl_value bedy, fl_value *result, fl_error *error);

/*
 * Функция flang «Проверить лишнее поле записи».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param pole — «поле»: «Поле значения»
 * @param obyavleno — «объявлено»: список: «Поле типа»
 * @param uzel — «узел»: «Значение»
 * @param imya_zapisi — «имя записи»: строка
 * @param imena — «имена»: «Имена»
 * @param tablicy — «таблицы»: «Таблицы»
 * @param bedy — «беды»: список: «Беда»
 * @return значение: список: «Беда»
 */
fl_status kompilyator_flang_proverit_lishnee_pole_zapisi(fl_ctx *ctx, fl_value pole, fl_value obyavleno, fl_value uzel, fl_value imya_zapisi, fl_value imena, fl_value tablicy, fl_value bedy, fl_value *result, fl_error *error);

/*
 * Функция flang «Тип списка выражения».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param uzel — «узел»: «Значение»
 * @param imena — «имена»: «Имена»
 * @param ozhidaemyy — «ожидаемый»: «Может быть тип»
 * @param tablicy — «таблицы»: «Таблицы»
 * @param bedy — «беды»: список: «Беда»
 * @return значение: «Итог вывода»
 */
fl_status kompilyator_flang_tip_spiska_vyrazheniya(fl_ctx *ctx, fl_value uzel, fl_value imena, fl_value ozhidaemyy, fl_value tablicy, fl_value bedy, fl_value *result, fl_error *error);

/*
 * Функция flang «Обойти элементы списка при проверке».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Взаимная хвостовая рекурсия с «Обойти элемент списка»: вызовы идут через батут.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param elementy — «элементы»: список: «Значение»
 * @param nomer — «номер»: число
 * @param element — «элемент»: «Может быть тип»
 * @param imena — «имена»: «Имена»
 * @param tablicy — «таблицы»: «Таблицы»
 * @param bedy — «беды»: список: «Беда»
 * @return значение: «Итог вывода»
 */
fl_status kompilyator_flang_oboyti_elementy_spiska_pri_proverke(fl_ctx *ctx, fl_value elementy, fl_value nomer, fl_value element, fl_value imena, fl_value tablicy, fl_value bedy, fl_value *result, fl_error *error);

/*
 * Функция flang «Обойти элемент списка».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Взаимная хвостовая рекурсия с «Обойти элементы списка при проверке»: вызовы идут через батут.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param uzel — «узел»: «Значение»
 * @param ostalnye — «остальные»: список: «Значение»
 * @param nomer — «номер»: число
 * @param element — «элемент»: «Может быть тип»
 * @param imena — «имена»: «Имена»
 * @param tablicy — «таблицы»: «Таблицы»
 * @param bedy — «беды»: список: «Беда»
 * @return значение: «Итог вывода»
 */
fl_status kompilyator_flang_oboyti_element_spiska(fl_ctx *ctx, fl_value uzel, fl_value ostalnye, fl_value nomer, fl_value element, fl_value imena, fl_value tablicy, fl_value bedy, fl_value *result, fl_error *error);

/*
 * Функция flang «Свести элемент списка».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param poluchen — «получен»: «Тип»
 * @param element — «элемент»: «Тип»
 * @return значение: «Может быть тип»
 */
fl_status kompilyator_flang_svesti_element_spiska(fl_ctx *ctx, fl_value poluchen, fl_value element, fl_value *result, fl_error *error);

/*
 * Функция flang «Сверить элемент списка».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param poluchen — «получен»: «Тип»
 * @param element — «элемент»: «Тип»
 * @param nomer — «номер»: число
 * @param uzel — «узел»: «Значение»
 * @param bedy — «беды»: список: «Беда»
 * @return значение: список: «Беда»
 */
fl_status kompilyator_flang_sverit_element_spiska(fl_ctx *ctx, fl_value poluchen, fl_value element, fl_value nomer, fl_value uzel, fl_value bedy, fl_value *result, fl_error *error);

/*
 * Функция flang «Ничего не покрыто».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @return значение: «Покрытие»
 */
fl_status kompilyator_flang_nichego_ne_pokryto(fl_ctx *ctx, fl_value *result, fl_error *error);

/*
 * Функция flang «Литерал образца».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param obrazec — «образец»: «Значение»
 * @return значение: строка
 */
fl_status kompilyator_flang_literal_obrazca(fl_ctx *ctx, fl_value obrazec, fl_value *result, fl_error *error);

/*
 * Функция flang «Название образца».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param obrazec — «образец»: «Значение»
 * @return значение: строка
 */
fl_status kompilyator_flang_nazvanie_obrazca(fl_ctx *ctx, fl_value obrazec, fl_value *result, fl_error *error);

/*
 * Функция flang «Образец покрыт».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param obrazec — «образец»: «Значение»
 * @param pokrytie — «покрытие»: «Покрытие»
 * @return значение
 */
fl_status kompilyator_flang_obrazec_pokryt(fl_ctx *ctx, fl_value obrazec, fl_value pokrytie, fl_value *result, fl_error *error);

/*
 * Функция flang «Отметить образец».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param obrazec — «образец»: «Значение»
 * @param pokrytie — «покрытие»: «Покрытие»
 * @return значение: «Покрытие»
 */
fl_status kompilyator_flang_otmetit_obrazec(fl_ctx *ctx, fl_value obrazec, fl_value pokrytie, fl_value *result, fl_error *error);

/*
 * Функция flang «Связать образец».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param obrazec — «образец»: «Значение»
 * @param cel — «цель»: «Тип»
 * @param imena — «имена»: «Имена»
 * @param mesto — «место»: «Значение»
 * @param tablicy — «таблицы»: «Таблицы»
 * @param bedy — «беды»: список: «Беда»
 * @return значение: «Итог связывания»
 */
fl_status kompilyator_flang_svyazat_obrazec(fl_ctx *ctx, fl_value obrazec, fl_value cel, fl_value imena, fl_value mesto, fl_value tablicy, fl_value bedy, fl_value *result, fl_error *error);

/*
 * Функция flang «Цель это список».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param cel — «цель»: «Тип»
 * @return значение
 */
fl_status kompilyator_flang_cel_eto_spisok(fl_ctx *ctx, fl_value cel, fl_value *result, fl_error *error);

/*
 * Функция flang «Цель это цепочка».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param cel — «цель»: «Тип»
 * @return значение
 */
fl_status kompilyator_flang_cel_eto_cepochka(fl_ctx *ctx, fl_value cel, fl_value *result, fl_error *error);

/*
 * Функция flang «Сказать о списочном образце».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param cel — «цель»: «Тип»
 * @param nazvanie — «название»: строка
 * @param mesto — «место»: «Значение»
 * @param bedy — «беды»: список: «Беда»
 * @return значение: список: «Беда»
 */
fl_status kompilyator_flang_skazat_o_spisochnom_obrazce(fl_ctx *ctx, fl_value cel, fl_value nazvanie, fl_value mesto, fl_value bedy, fl_value *result, fl_error *error);

/*
 * Функция flang «Связать голову и хвост».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param obrazec — «образец»: «Значение»
 * @param cel — «цель»: «Тип»
 * @param imena — «имена»: «Имена»
 * @param mesto — «место»: «Значение»
 * @param bedy — «беды»: список: «Беда»
 * @return значение: «Итог связывания»
 */
fl_status kompilyator_flang_svyazat_golovu_i_hvost(fl_ctx *ctx, fl_value obrazec, fl_value cel, fl_value imena, fl_value mesto, fl_value bedy, fl_value *result, fl_error *error);

/*
 * Функция flang «Связать части строки».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param obrazec — «образец»: «Значение»
 * @param imena — «имена»: «Имена»
 * @param bedy — «беды»: список: «Беда»
 * @return значение: «Итог связывания»
 */
fl_status kompilyator_flang_svyazat_chasti_stroki(fl_ctx *ctx, fl_value obrazec, fl_value imena, fl_value bedy, fl_value *result, fl_error *error);

/*
 * Функция flang «Связать части списка».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param obrazec — «образец»: «Значение»
 * @param cel — «цель»: «Тип»
 * @param imena — «имена»: «Имена»
 * @param bedy — «беды»: список: «Беда»
 * @return значение: «Итог связывания»
 */
fl_status kompilyator_flang_svyazat_chasti_spiska(fl_ctx *ctx, fl_value obrazec, fl_value cel, fl_value imena, fl_value bedy, fl_value *result, fl_error *error);

/*
 * Функция flang «Связать вариант».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param obrazec — «образец»: «Значение»
 * @param cel — «цель»: «Тип»
 * @param imena — «имена»: «Имена»
 * @param mesto — «место»: «Значение»
 * @param tablicy — «таблицы»: «Таблицы»
 * @param bedy — «беды»: список: «Беда»
 * @return значение: «Итог связывания»
 */
fl_status kompilyator_flang_svyazat_variant(fl_ctx *ctx, fl_value obrazec, fl_value cel, fl_value imena, fl_value mesto, fl_value tablicy, fl_value bedy, fl_value *result, fl_error *error);

/*
 * Функция flang «Связать вариант известной цели».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param obrazec — «образец»: «Значение»
 * @param cel — «цель»: «Тип»
 * @param imena — «имена»: «Имена»
 * @param mesto — «место»: «Значение»
 * @param tablicy — «таблицы»: «Таблицы»
 * @param bedy — «беды»: список: «Беда»
 * @return значение: «Итог связывания»
 */
fl_status kompilyator_flang_svyazat_variant_izvestnoy_celi(fl_ctx *ctx, fl_value obrazec, fl_value cel, fl_value imena, fl_value mesto, fl_value tablicy, fl_value bedy, fl_value *result, fl_error *error);

/*
 * Функция flang «Связать вариант суммы».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param obrazec — «образец»: «Значение»
 * @param cel — «цель»: «Тип»
 * @param imena — «имена»: «Имена»
 * @param mesto — «место»: «Значение»
 * @param tablicy — «таблицы»: «Таблицы»
 * @param bedy — «беды»: список: «Беда»
 * @return значение: «Итог связывания»
 */
fl_status kompilyator_flang_svyazat_variant_summy(fl_ctx *ctx, fl_value obrazec, fl_value cel, fl_value imena, fl_value mesto, fl_value tablicy, fl_value bedy, fl_value *result, fl_error *error);

/*
 * Функция flang «Чужой вариант».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param obrazec — «образец»: «Значение»
 * @param cel — «цель»: «Тип»
 * @param imena — «имена»: «Имена»
 * @param mesto — «место»: «Значение»
 * @param tablicy — «таблицы»: «Таблицы»
 * @param bedy — «беды»: список: «Беда»
 * @return значение: «Итог связывания»
 */
fl_status kompilyator_flang_chuzhoy_variant(fl_ctx *ctx, fl_value obrazec, fl_value cel, fl_value imena, fl_value mesto, fl_value tablicy, fl_value bedy, fl_value *result, fl_error *error);

/*
 * Функция flang «Связать поля варианта».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Взаимная хвостовая рекурсия с «Связать поле варианта»: вызовы идут через батут.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param svyazki — «связки»: список: «Поле значения»
 * @param obyavleno — «объявлено»: список: «Поле типа»
 * @param imya_varianta — «имя варианта»: строка
 * @param imena — «имена»: «Имена»
 * @param podstanovka — «подстановка»: список: «Связка типа»
 * @param mesto — «место»: «Значение»
 * @param bedy — «беды»: список: «Беда»
 * @return значение: «Итог связывания»
 */
fl_status kompilyator_flang_svyazat_polya_varianta(fl_ctx *ctx, fl_value svyazki, fl_value obyavleno, fl_value imya_varianta, fl_value imena, fl_value podstanovka, fl_value mesto, fl_value bedy, fl_value *result, fl_error *error);

/*
 * Функция flang «Связать поле варианта».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Взаимная хвостовая рекурсия с «Связать поля варианта»: вызовы идут через батут.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param svyazka — «связка»: «Поле значения»
 * @param ostalnye — «остальные»: список: «Поле значения»
 * @param obyavleno — «объявлено»: список: «Поле типа»
 * @param imya_varianta — «имя варианта»: строка
 * @param imena — «имена»: «Имена»
 * @param podstanovka — «подстановка»: список: «Связка типа»
 * @param mesto — «место»: «Значение»
 * @param bedy — «беды»: список: «Беда»
 * @return значение: «Итог связывания»
 */
fl_status kompilyator_flang_svyazat_pole_varianta(fl_ctx *ctx, fl_value svyazka, fl_value ostalnye, fl_value obyavleno, fl_value imya_varianta, fl_value imena, fl_value podstanovka, fl_value mesto, fl_value bedy, fl_value *result, fl_error *error);

/*
 * Функция flang «Связать литерал».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param obrazec — «образец»: «Значение»
 * @param cel — «цель»: «Тип»
 * @param imena — «имена»: «Имена»
 * @param mesto — «место»: «Значение»
 * @param bedy — «беды»: список: «Беда»
 * @return значение: «Итог связывания»
 */
fl_status kompilyator_flang_svyazat_literal(fl_ctx *ctx, fl_value obrazec, fl_value cel, fl_value imena, fl_value mesto, fl_value bedy, fl_value *result, fl_error *error);

/*
 * Функция flang «Тип разбора».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param uzel — «узел»: «Значение»
 * @param imena — «имена»: «Имена»
 * @param ozhidaemyy — «ожидаемый»: «Может быть тип»
 * @param tablicy — «таблицы»: «Таблицы»
 * @param bedy — «беды»: список: «Беда»
 * @return значение: «Итог вывода»
 */
fl_status kompilyator_flang_tip_razbora(fl_ctx *ctx, fl_value uzel, fl_value imena, fl_value ozhidaemyy, fl_value tablicy, fl_value bedy, fl_value *result, fl_error *error);

/*
 * Функция flang «Обойти случаи при проверке».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Хвостовой самовызов развёрнут в цикл: стек не растёт.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param sluchai — «случаи»: список: «Значение»
 * @param cel — «цель»: «Тип»
 * @param imena — «имена»: «Имена»
 * @param tablicy — «таблицы»: «Таблицы»
 * @param hod — «ход»: «Ход разбора»
 * @return значение: «Ход разбора»
 */
fl_status kompilyator_flang_oboyti_sluchai_pri_proverke(fl_ctx *ctx, fl_value sluchai, fl_value cel, fl_value imena, fl_value tablicy, fl_value hod, fl_value *result, fl_error *error);

/*
 * Функция flang «Обойти случай».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param vetv — «ветвь»: «Значение»
 * @param cel — «цель»: «Тип»
 * @param imena — «имена»: «Имена»
 * @param tablicy — «таблицы»: «Таблицы»
 * @param hod — «ход»: «Ход разбора»
 * @return значение: «Ход разбора»
 */
fl_status kompilyator_flang_oboyti_sluchay(fl_ctx *ctx, fl_value vetv, fl_value cel, fl_value imena, fl_value tablicy, fl_value hod, fl_value *result, fl_error *error);

/*
 * Функция flang «Свести случай».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param itog — «итог»: «Тип»
 * @param telo — «тело»: «Тип»
 * @return значение: «Может быть тип»
 */
fl_status kompilyator_flang_svesti_sluchay(fl_ctx *ctx, fl_value itog, fl_value telo, fl_value *result, fl_error *error);

/*
 * Функция flang «Сверить случай».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param itog — «итог»: «Тип»
 * @param telo — «тело»: «Тип»
 * @param vetv — «ветвь»: «Значение»
 * @param bedy — «беды»: список: «Беда»
 * @return значение: список: «Беда»
 */
fl_status kompilyator_flang_sverit_sluchay(fl_ctx *ctx, fl_value itog, fl_value telo, fl_value vetv, fl_value bedy, fl_value *result, fl_error *error);

/*
 * Функция flang «Сказать о достижимости».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param obrazec — «образец»: «Значение»
 * @param vetv — «ветвь»: «Значение»
 * @param pokrytie — «покрытие»: «Покрытие»
 * @param bedy — «беды»: список: «Беда»
 * @return значение: список: «Беда»
 */
fl_status kompilyator_flang_skazat_o_dostizhimosti(fl_ctx *ctx, fl_value obrazec, fl_value vetv, fl_value pokrytie, fl_value bedy, fl_value *result, fl_error *error);

/*
 * Функция flang «Сказать об исчерпывании».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param uzel — «узел»: «Значение»
 * @param cel — «цель»: «Тип»
 * @param pokrytie — «покрытие»: «Покрытие»
 * @param skolko — «сколько»: число
 * @param tablicy — «таблицы»: «Таблицы»
 * @param bedy — «беды»: список: «Беда»
 * @return значение: список: «Беда»
 */
fl_status kompilyator_flang_skazat_ob_ischerpyvanii(fl_ctx *ctx, fl_value uzel, fl_value cel, fl_value pokrytie, fl_value skolko, fl_value tablicy, fl_value bedy, fl_value *result, fl_error *error);

/*
 * Функция flang «Исчерпан ли тип».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param uzel — «узел»: «Значение»
 * @param cel — «цель»: «Тип»
 * @param pokrytie — «покрытие»: «Покрытие»
 * @param tablicy — «таблицы»: «Таблицы»
 * @param bedy — «беды»: список: «Беда»
 * @return значение: список: «Беда»
 */
fl_status kompilyator_flang_ischerpan_li_tip(fl_ctx *ctx, fl_value uzel, fl_value cel, fl_value pokrytie, fl_value tablicy, fl_value bedy, fl_value *result, fl_error *error);

/*
 * Функция flang «Исчерпана ли сумма».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param uzel — «узел»: «Значение»
 * @param cel — «цель»: «Тип»
 * @param pokrytie — «покрытие»: «Покрытие»
 * @param tablicy — «таблицы»: «Таблицы»
 * @param bedy — «беды»: список: «Беда»
 * @return значение: список: «Беда»
 */
fl_status kompilyator_flang_ischerpana_li_summa(fl_ctx *ctx, fl_value uzel, fl_value cel, fl_value pokrytie, fl_value tablicy, fl_value bedy, fl_value *result, fl_error *error);

/*
 * Функция flang «Не покрыт вариант».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param imya — «имя»: строка
 * @param pokrytie — «покрытие»: «Покрытие»
 * @return значение
 */
fl_status kompilyator_flang_ne_pokryt_variant(fl_ctx *ctx, fl_value imya, fl_value pokrytie, fl_value *result, fl_error *error);

/*
 * Функция flang «Исчерпана ли цепочка».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param uzel — «узел»: «Значение»
 * @param pokrytie — «покрытие»: «Покрытие»
 * @param chto — «что»: строка
 * @param bedy — «беды»: список: «Беда»
 * @return значение: список: «Беда»
 */
fl_status kompilyator_flang_ischerpana_li_cepochka(fl_ctx *ctx, fl_value uzel, fl_value pokrytie, fl_value chto, fl_value bedy, fl_value *result, fl_error *error);

/*
 * Функция flang «Исчерпан ли признак».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param uzel — «узел»: «Значение»
 * @param pokrytie — «покрытие»: «Покрытие»
 * @param bedy — «беды»: список: «Беда»
 * @return значение: список: «Беда»
 */
fl_status kompilyator_flang_ischerpan_li_priznak(fl_ctx *ctx, fl_value uzel, fl_value pokrytie, fl_value bedy, fl_value *result, fl_error *error);

/*
 * Функция flang «Не покрыт литерал».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param literal — «литерал»: строка
 * @param pokrytie — «покрытие»: «Покрытие»
 * @return значение
 */
fl_status kompilyator_flang_ne_pokryt_literal(fl_ctx *ctx, fl_value literal, fl_value pokrytie, fl_value *result, fl_error *error);

/*
 * Функция flang «Аргумент по номеру».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * Хвостовой самовызов развёрнут в цикл: стек не растёт.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param argumenty — «аргументы»: список: «Значение»
 * @param nomer — «номер»: число
 * @return значение: «Значение»
 */
fl_status kompilyator_flang_argument_po_nomeru(fl_ctx *ctx, fl_value argumenty, fl_value nomer, fl_value *result, fl_error *error);

/*
 * Функция flang «Место аргумента».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param argumenty — «аргументы»: список: «Значение»
 * @param nomer — «номер»: число
 * @param uzel — «узел»: «Значение»
 * @return значение: «Значение»
 */
fl_status kompilyator_flang_mesto_argumenta(fl_ctx *ctx, fl_value argumenty, fl_value nomer, fl_value uzel, fl_value *result, fl_error *error);

/*
 * Функция flang «Просто вывести».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param argumenty — «аргументы»: список: «Значение»
 * @param nomer — «номер»: число
 * @param imena — «имена»: «Имена»
 * @param tablicy — «таблицы»: «Таблицы»
 * @param bedy — «беды»: список: «Беда»
 * @return значение: «Итог вывода»
 */
fl_status kompilyator_flang_prosto_vyvesti(fl_ctx *ctx, fl_value argumenty, fl_value nomer, fl_value imena, fl_value tablicy, fl_value bedy, fl_value *result, fl_error *error);

/*
 * Функция flang «Хотеть аргумент».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param argumenty — «аргументы»: список: «Значение»
 * @param nomer — «номер»: число
 * @param nuzhen — «нужен»: «Тип»
 * @param forma — «форма»: строка
 * @param uzel — «узел»: «Значение»
 * @param imena — «имена»: «Имена»
 * @param tablicy — «таблицы»: «Таблицы»
 * @param bedy — «беды»: список: «Беда»
 * @return значение: «Итог вывода»
 */
fl_status kompilyator_flang_hotet_argument(fl_ctx *ctx, fl_value argumenty, fl_value nomer, fl_value nuzhen, fl_value forma, fl_value uzel, fl_value imena, fl_value tablicy, fl_value bedy, fl_value *result, fl_error *error);

/*
 * Функция flang «Список аргумента».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param argumenty — «аргументы»: список: «Значение»
 * @param nomer — «номер»: число
 * @param forma — «форма»: строка
 * @param uzel — «узел»: «Значение»
 * @param imena — «имена»: «Имена»
 * @param tablicy — «таблицы»: «Таблицы»
 * @param bedy — «беды»: список: «Беда»
 * @return значение: «Итог вывода»
 */
fl_status kompilyator_flang_spisok_argumenta(fl_ctx *ctx, fl_value argumenty, fl_value nomer, fl_value forma, fl_value uzel, fl_value imena, fl_value tablicy, fl_value bedy, fl_value *result, fl_error *error);

/*
 * Функция flang «Сказать об арности».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param forma — «форма»: строка
 * @param skolko — «сколько»: число
 * @param dano — «дано»: число
 * @param uzel — «узел»: «Значение»
 * @param bedy — «беды»: список: «Беда»
 * @return значение: список: «Беда»
 */
fl_status kompilyator_flang_skazat_ob_arnosti(fl_ctx *ctx, fl_value forma, fl_value skolko, fl_value dano, fl_value uzel, fl_value bedy, fl_value *result, fl_error *error);

/*
 * Функция flang «Элемент коллекции».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param uzel — «узел»: «Значение»
 * @param forma — «форма»: строка
 * @param imena — «имена»: «Имена»
 * @param tablicy — «таблицы»: «Таблицы»
 * @param bedy — «беды»: список: «Беда»
 * @return значение: «Итог вывода»
 */
fl_status kompilyator_flang_element_kollekcii(fl_ctx *ctx, fl_value uzel, fl_value forma, fl_value imena, fl_value tablicy, fl_value bedy, fl_value *result, fl_error *error);

/*
 * Функция flang «Тип отображения».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param uzel — «узел»: «Значение»
 * @param imena — «имена»: «Имена»
 * @param ozhidaemyy — «ожидаемый»: «Может быть тип»
 * @param tablicy — «таблицы»: «Таблицы»
 * @param bedy — «беды»: список: «Беда»
 * @return значение: «Итог вывода»
 */
fl_status kompilyator_flang_tip_otobrazheniya(fl_ctx *ctx, fl_value uzel, fl_value imena, fl_value ozhidaemyy, fl_value tablicy, fl_value bedy, fl_value *result, fl_error *error);

/*
 * Функция flang «Тело отображения».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param uzel — «узел»: «Значение»
 * @param element — «элемент»: «Тип»
 * @param imena — «имена»: «Имена»
 * @param ozhidaemyy — «ожидаемый»: «Может быть тип»
 * @param tablicy — «таблицы»: «Таблицы»
 * @param bedy — «беды»: список: «Беда»
 * @return значение: «Итог вывода»
 */
fl_status kompilyator_flang_telo_otobrazheniya(fl_ctx *ctx, fl_value uzel, fl_value element, fl_value imena, fl_value ozhidaemyy, fl_value tablicy, fl_value bedy, fl_value *result, fl_error *error);

/*
 * Функция flang «Тип фильтра».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param uzel — «узел»: «Значение»
 * @param imena — «имена»: «Имена»
 * @param tablicy — «таблицы»: «Таблицы»
 * @param bedy — «беды»: список: «Беда»
 * @return значение: «Итог вывода»
 */
fl_status kompilyator_flang_tip_filtra(fl_ctx *ctx, fl_value uzel, fl_value imena, fl_value tablicy, fl_value bedy, fl_value *result, fl_error *error);

/*
 * Функция flang «Тело фильтра».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param uzel — «узел»: «Значение»
 * @param element — «элемент»: «Тип»
 * @param imena — «имена»: «Имена»
 * @param tablicy — «таблицы»: «Таблицы»
 * @param bedy — «беды»: список: «Беда»
 * @return значение: «Итог вывода»
 */
fl_status kompilyator_flang_telo_filtra(fl_ctx *ctx, fl_value uzel, fl_value element, fl_value imena, fl_value tablicy, fl_value bedy, fl_value *result, fl_error *error);

/*
 * Функция flang «Тип свёртки».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param uzel — «узел»: «Значение»
 * @param imena — «имена»: «Имена»
 * @param tablicy — «таблицы»: «Таблицы»
 * @param bedy — «беды»: список: «Беда»
 * @return значение: «Итог вывода»
 */
fl_status kompilyator_flang_tip_svyortki(fl_ctx *ctx, fl_value uzel, fl_value imena, fl_value tablicy, fl_value bedy, fl_value *result, fl_error *error);

/*
 * Функция flang «Тело свёртки».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param uzel — «узел»: «Значение»
 * @param element — «элемент»: «Тип»
 * @param nakopitel — «накопитель»: «Тип»
 * @param imena — «имена»: «Имена»
 * @param tablicy — «таблицы»: «Таблицы»
 * @param bedy — «беды»: список: «Беда»
 * @return значение: «Итог вывода»
 */
fl_status kompilyator_flang_telo_svyortki(fl_ctx *ctx, fl_value uzel, fl_value element, fl_value nakopitel, fl_value imena, fl_value tablicy, fl_value bedy, fl_value *result, fl_error *error);

/*
 * Функция flang «Каноническая форма».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param imya — «имя»: строка
 * @return значение: строка
 */
fl_status kompilyator_flang_kanonicheskaya_forma(fl_ctx *ctx, fl_value imya, fl_value *result, fl_error *error);

/*
 * Функция flang «Тип встроенной».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param uzel — «узел»: «Значение»
 * @param imena — «имена»: «Имена»
 * @param tablicy — «таблицы»: «Таблицы»
 * @param bedy — «беды»: список: «Беда»
 * @return значение: «Итог вывода»
 */
fl_status kompilyator_flang_tip_vstroennoy(fl_ctx *ctx, fl_value uzel, fl_value imena, fl_value tablicy, fl_value bedy, fl_value *result, fl_error *error);

/*
 * Функция flang «Тип известной формы».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param uzel — «узел»: «Значение»
 * @param forma — «форма»: строка
 * @param argumenty — «аргументы»: список: «Значение»
 * @param imena — «имена»: «Имена»
 * @param tablicy — «таблицы»: «Таблицы»
 * @param bedy — «беды»: список: «Беда»
 * @return значение: «Итог вывода»
 */
fl_status kompilyator_flang_tip_izvestnoy_formy(fl_ctx *ctx, fl_value uzel, fl_value forma, fl_value argumenty, fl_value imena, fl_value tablicy, fl_value bedy, fl_value *result, fl_error *error);

/*
 * Функция flang «Форма длина».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param uzel — «узел»: «Значение»
 * @param argumenty — «аргументы»: список: «Значение»
 * @param imena — «имена»: «Имена»
 * @param tablicy — «таблицы»: «Таблицы»
 * @param bedy — «беды»: список: «Беда»
 * @return значение: «Итог вывода»
 */
fl_status kompilyator_flang_forma_dlina(fl_ctx *ctx, fl_value uzel, fl_value argumenty, fl_value imena, fl_value tablicy, fl_value bedy, fl_value *result, fl_error *error);

/*
 * Функция flang «Строка или список».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param uzel — «узел»: «Значение»
 * @param argumenty — «аргументы»: список: «Значение»
 * @param forma — «форма»: строка
 * @param itog — «итог»: «Тип»
 * @param imena — «имена»: «Имена»
 * @param tablicy — «таблицы»: «Таблицы»
 * @param bedy — «беды»: список: «Беда»
 * @return значение: «Итог вывода»
 */
fl_status kompilyator_flang_stroka_ili_spisok(fl_ctx *ctx, fl_value uzel, fl_value argumenty, fl_value forma, fl_value itog, fl_value imena, fl_value tablicy, fl_value bedy, fl_value *result, fl_error *error);

/*
 * Функция flang «Форма символ».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param uzel — «узел»: «Значение»
 * @param argumenty — «аргументы»: список: «Значение»
 * @param imena — «имена»: «Имена»
 * @param tablicy — «таблицы»: «Таблицы»
 * @param bedy — «беды»: список: «Беда»
 * @return значение: «Итог вывода»
 */
fl_status kompilyator_flang_forma_simvol(fl_ctx *ctx, fl_value uzel, fl_value argumenty, fl_value imena, fl_value tablicy, fl_value bedy, fl_value *result, fl_error *error);

/*
 * Функция flang «Форма подстрока».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param uzel — «узел»: «Значение»
 * @param argumenty — «аргументы»: список: «Значение»
 * @param imena — «имена»: «Имена»
 * @param tablicy — «таблицы»: «Таблицы»
 * @param bedy — «беды»: список: «Беда»
 * @return значение: «Итог вывода»
 */
fl_status kompilyator_flang_forma_podstroka(fl_ctx *ctx, fl_value uzel, fl_value argumenty, fl_value imena, fl_value tablicy, fl_value bedy, fl_value *result, fl_error *error);

/*
 * Функция flang «Три аргумента подстроки».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param uzel — «узел»: «Значение»
 * @param argumenty — «аргументы»: список: «Значение»
 * @param imena — «имена»: «Имена»
 * @param tablicy — «таблицы»: «Таблицы»
 * @param bedy — «беды»: список: «Беда»
 * @return значение: «Итог вывода»
 */
fl_status kompilyator_flang_tri_argumenta_podstroki(fl_ctx *ctx, fl_value uzel, fl_value argumenty, fl_value imena, fl_value tablicy, fl_value bedy, fl_value *result, fl_error *error);

/*
 * Функция flang «Форма соединить».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param uzel — «узел»: «Значение»
 * @param argumenty — «аргументы»: список: «Значение»
 * @param imena — «имена»: «Имена»
 * @param tablicy — «таблицы»: «Таблицы»
 * @param bedy — «беды»: список: «Беда»
 * @return значение: «Итог вывода»
 */
fl_status kompilyator_flang_forma_soedinit(fl_ctx *ctx, fl_value uzel, fl_value argumenty, fl_value imena, fl_value tablicy, fl_value bedy, fl_value *result, fl_error *error);

/*
 * Функция flang «Два аргумента соединения».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param uzel — «узел»: «Значение»
 * @param argumenty — «аргументы»: список: «Значение»
 * @param imena — «имена»: «Имена»
 * @param tablicy — «таблицы»: «Таблицы»
 * @param bedy — «беды»: список: «Беда»
 * @return значение: «Итог вывода»
 */
fl_status kompilyator_flang_dva_argumenta_soedineniya(fl_ctx *ctx, fl_value uzel, fl_value argumenty, fl_value imena, fl_value tablicy, fl_value bedy, fl_value *result, fl_error *error);

/*
 * Функция flang «Форма двух чисел».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param uzel — «узел»: «Значение»
 * @param forma — «форма»: строка
 * @param argumenty — «аргументы»: список: «Значение»
 * @param imena — «имена»: «Имена»
 * @param tablicy — «таблицы»: «Таблицы»
 * @param bedy — «беды»: список: «Беда»
 * @return значение: «Итог вывода»
 */
fl_status kompilyator_flang_forma_dvuh_chisel(fl_ctx *ctx, fl_value uzel, fl_value forma, fl_value argumenty, fl_value imena, fl_value tablicy, fl_value bedy, fl_value *result, fl_error *error);

/*
 * Функция flang «Форма разделить».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param uzel — «узел»: «Значение»
 * @param argumenty — «аргументы»: список: «Значение»
 * @param imena — «имена»: «Имена»
 * @param tablicy — «таблицы»: «Таблицы»
 * @param bedy — «беды»: список: «Беда»
 * @return значение: «Итог вывода»
 */
fl_status kompilyator_flang_forma_razdelit(fl_ctx *ctx, fl_value uzel, fl_value argumenty, fl_value imena, fl_value tablicy, fl_value bedy, fl_value *result, fl_error *error);

/*
 * Функция flang «Форма символы».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param uzel — «узел»: «Значение»
 * @param argumenty — «аргументы»: список: «Значение»
 * @param imena — «имена»: «Имена»
 * @param tablicy — «таблицы»: «Таблицы»
 * @param bedy — «беды»: список: «Беда»
 * @return значение: «Итог вывода»
 */
fl_status kompilyator_flang_forma_simvoly(fl_ctx *ctx, fl_value uzel, fl_value argumenty, fl_value imena, fl_value tablicy, fl_value bedy, fl_value *result, fl_error *error);

/*
 * Функция flang «Тип кодовой точки».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @return значение: «Тип»
 */
fl_status kompilyator_flang_tip_kodovoy_tochki(fl_ctx *ctx, fl_value *result, fl_error *error);

/*
 * Функция flang «Форма код символа».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param uzel — «узел»: «Значение»
 * @param argumenty — «аргументы»: список: «Значение»
 * @param imena — «имена»: «Имена»
 * @param tablicy — «таблицы»: «Таблицы»
 * @param bedy — «беды»: список: «Беда»
 * @return значение: «Итог вывода»
 */
fl_status kompilyator_flang_forma_kod_simvola(fl_ctx *ctx, fl_value uzel, fl_value argumenty, fl_value imena, fl_value tablicy, fl_value bedy, fl_value *result, fl_error *error);

/*
 * Функция flang «Форма начинается с».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param uzel — «узел»: «Значение»
 * @param argumenty — «аргументы»: список: «Значение»
 * @param imena — «имена»: «Имена»
 * @param tablicy — «таблицы»: «Таблицы»
 * @param bedy — «беды»: список: «Беда»
 * @return значение: «Итог вывода»
 */
fl_status kompilyator_flang_forma_nachinaetsya_s(fl_ctx *ctx, fl_value uzel, fl_value argumenty, fl_value imena, fl_value tablicy, fl_value bedy, fl_value *result, fl_error *error);

/*
 * Функция flang «Форма содержит».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param uzel — «узел»: «Значение»
 * @param argumenty — «аргументы»: список: «Значение»
 * @param imena — «имена»: «Имена»
 * @param tablicy — «таблицы»: «Таблицы»
 * @param bedy — «беды»: список: «Беда»
 * @return значение: «Итог вывода»
 */
fl_status kompilyator_flang_forma_soderzhit(fl_ctx *ctx, fl_value uzel, fl_value argumenty, fl_value imena, fl_value tablicy, fl_value bedy, fl_value *result, fl_error *error);

/*
 * Функция flang «Два аргумента содержит».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param uzel — «узел»: «Значение»
 * @param argumenty — «аргументы»: список: «Значение»
 * @param imena — «имена»: «Имена»
 * @param tablicy — «таблицы»: «Таблицы»
 * @param bedy — «беды»: список: «Беда»
 * @return значение: «Итог вывода»
 */
fl_status kompilyator_flang_dva_argumenta_soderzhit(fl_ctx *ctx, fl_value uzel, fl_value argumenty, fl_value imena, fl_value tablicy, fl_value bedy, fl_value *result, fl_error *error);

/*
 * Функция flang «Форма к числу».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param uzel — «узел»: «Значение»
 * @param argumenty — «аргументы»: список: «Значение»
 * @param imena — «имена»: «Имена»
 * @param tablicy — «таблицы»: «Таблицы»
 * @param bedy — «беды»: список: «Беда»
 * @return значение: «Итог вывода»
 */
fl_status kompilyator_flang_forma_k_chislu(fl_ctx *ctx, fl_value uzel, fl_value argumenty, fl_value imena, fl_value tablicy, fl_value bedy, fl_value *result, fl_error *error);

/*
 * Функция flang «Форма к строке».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param uzel — «узел»: «Значение»
 * @param argumenty — «аргументы»: список: «Значение»
 * @param imena — «имена»: «Имена»
 * @param tablicy — «таблицы»: «Таблицы»
 * @param bedy — «беды»: список: «Беда»
 * @return значение: «Итог вывода»
 */
fl_status kompilyator_flang_forma_k_stroke(fl_ctx *ctx, fl_value uzel, fl_value argumenty, fl_value imena, fl_value tablicy, fl_value bedy, fl_value *result, fl_error *error);

/*
 * Функция flang «Форма голова».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param uzel — «узел»: «Значение»
 * @param argumenty — «аргументы»: список: «Значение»
 * @param imena — «имена»: «Имена»
 * @param tablicy — «таблицы»: «Таблицы»
 * @param bedy — «беды»: список: «Беда»
 * @return значение: «Итог вывода»
 */
fl_status kompilyator_flang_forma_golova(fl_ctx *ctx, fl_value uzel, fl_value argumenty, fl_value imena, fl_value tablicy, fl_value bedy, fl_value *result, fl_error *error);

/*
 * Функция flang «Форма хвост».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param uzel — «узел»: «Значение»
 * @param argumenty — «аргументы»: список: «Значение»
 * @param imena — «имена»: «Имена»
 * @param tablicy — «таблицы»: «Таблицы»
 * @param bedy — «беды»: список: «Беда»
 * @return значение: «Итог вывода»
 */
fl_status kompilyator_flang_forma_hvost(fl_ctx *ctx, fl_value uzel, fl_value argumenty, fl_value imena, fl_value tablicy, fl_value bedy, fl_value *result, fl_error *error);

/*
 * Функция flang «Хвост списка».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param itog — «итог»: «Итог вывода»
 * @return значение: «Итог вывода»
 */
fl_status kompilyator_flang_hvost_spiska(fl_ctx *ctx, fl_value itog, fl_value *result, fl_error *error);

/*
 * Функция flang «Форма элемент».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param uzel — «узел»: «Значение»
 * @param argumenty — «аргументы»: список: «Значение»
 * @param imena — «имена»: «Имена»
 * @param tablicy — «таблицы»: «Таблицы»
 * @param bedy — «беды»: список: «Беда»
 * @return значение: «Итог вывода»
 */
fl_status kompilyator_flang_forma_element(fl_ctx *ctx, fl_value uzel, fl_value argumenty, fl_value imena, fl_value tablicy, fl_value bedy, fl_value *result, fl_error *error);

/*
 * Функция flang «Форма пусто».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param uzel — «узел»: «Значение»
 * @param argumenty — «аргументы»: список: «Значение»
 * @param imena — «имена»: «Имена»
 * @param tablicy — «таблицы»: «Таблицы»
 * @param bedy — «беды»: список: «Беда»
 * @return значение: «Итог вывода»
 */
fl_status kompilyator_flang_forma_pusto(fl_ctx *ctx, fl_value uzel, fl_value argumenty, fl_value imena, fl_value tablicy, fl_value bedy, fl_value *result, fl_error *error);

/*
 * Функция flang «Форма добавить».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param uzel — «узел»: «Значение»
 * @param argumenty — «аргументы»: список: «Значение»
 * @param imena — «имена»: «Имена»
 * @param tablicy — «таблицы»: «Таблицы»
 * @param bedy — «беды»: список: «Беда»
 * @return значение: «Итог вывода»
 */
fl_status kompilyator_flang_forma_dobavit(fl_ctx *ctx, fl_value uzel, fl_value argumenty, fl_value imena, fl_value tablicy, fl_value bedy, fl_value *result, fl_error *error);

/*
 * Функция flang «Два аргумента добавления».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param uzel — «узел»: «Значение»
 * @param argumenty — «аргументы»: список: «Значение»
 * @param imena — «имена»: «Имена»
 * @param tablicy — «таблицы»: «Таблицы»
 * @param bedy — «беды»: список: «Беда»
 * @return значение: «Итог вывода»
 */
fl_status kompilyator_flang_dva_argumenta_dobavleniya(fl_ctx *ctx, fl_value uzel, fl_value argumenty, fl_value imena, fl_value tablicy, fl_value bedy, fl_value *result, fl_error *error);

/*
 * Функция flang «Проверить значение».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param znachenie — «значение»: «Значение»
 * @param zadano — «задано»
 * @param tip — «тип»: «Тип»
 * @param metka — «метка»: строка
 * @param tablicy — «таблицы»: «Таблицы»
 * @param mesto — «место»: «Значение»
 * @param bedy — «беды»: список: «Беда»
 * @return значение: список: «Беда»
 */
fl_status kompilyator_flang_proverit_znachenie(fl_ctx *ctx, fl_value znachenie, fl_value zadano, fl_value tip, fl_value metka, fl_value tablicy, fl_value mesto, fl_value bedy, fl_value *result, fl_error *error);

/*
 * Функция flang «Не соответствует».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param metka — «метка»: строка
 * @param tip — «тип»: «Тип»
 * @param mesto — «место»: «Значение»
 * @param bedy — «беды»: список: «Беда»
 * @return значение: список: «Беда»
 */
fl_status kompilyator_flang_ne_sootvetstvuet(fl_ctx *ctx, fl_value metka, fl_value tip, fl_value mesto, fl_value bedy, fl_value *result, fl_error *error);

/*
 * Функция flang «Это конечное число».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param znachenie — «значение»: «Значение»
 * @param zadano — «задано»
 * @return значение
 */
fl_status kompilyator_flang_eto_konechnoe_chislo(fl_ctx *ctx, fl_value znachenie, fl_value zadano, fl_value *result, fl_error *error);

/*
 * Функция flang «Это конечное в узле».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param znachenie — «значение»: «Значение»
 * @return значение
 */
fl_status kompilyator_flang_eto_konechnoe_v_uzle(fl_ctx *ctx, fl_value znachenie, fl_value *result, fl_error *error);

/*
 * Функция flang «Это конечное в скаляре».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param skalyar — «скаляр»: «Скаляр»
 * @return значение
 */
fl_status kompilyator_flang_eto_konechnoe_v_skalyare(fl_ctx *ctx, fl_value skalyar, fl_value *result, fl_error *error);

/*
 * Функция flang «Проверить отрезок значения».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param znachenie — «значение»: «Значение»
 * @param tip — «тип»: «Тип»
 * @param metka — «метка»: строка
 * @param mesto — «место»: «Значение»
 * @param bedy — «беды»: список: «Беда»
 * @return значение: список: «Беда»
 */
fl_status kompilyator_flang_proverit_otrezok_znacheniya(fl_ctx *ctx, fl_value znachenie, fl_value tip, fl_value metka, fl_value mesto, fl_value bedy, fl_value *result, fl_error *error);

/*
 * Функция flang «Число скаляра значения».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param znachenie — «значение»: «Значение»
 * @return значение: число
 */
fl_status kompilyator_flang_chislo_skalyara_znacheniya(fl_ctx *ctx, fl_value znachenie, fl_value *result, fl_error *error);

/*
 * Функция flang «Проверить число в отрезке».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param chislo — «число»: число
 * @param tip — «тип»: «Тип»
 * @param metka — «метка»: строка
 * @param mesto — «место»: «Значение»
 * @param bedy — «беды»: список: «Беда»
 * @return значение: список: «Беда»
 */
fl_status kompilyator_flang_proverit_chislo_v_otrezke(fl_ctx *ctx, fl_value chislo, fl_value tip, fl_value metka, fl_value mesto, fl_value bedy, fl_value *result, fl_error *error);

/*
 * Функция flang «Это признак в узле».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param znachenie — «значение»: «Значение»
 * @param zadano — «задано»
 * @return значение
 */
fl_status kompilyator_flang_eto_priznak_v_uzle(fl_ctx *ctx, fl_value znachenie, fl_value zadano, fl_value *result, fl_error *error);

/*
 * Функция flang «Это признак в значении».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param znachenie — «значение»: «Значение»
 * @return значение
 */
fl_status kompilyator_flang_eto_priznak_v_znachenii(fl_ctx *ctx, fl_value znachenie, fl_value *result, fl_error *error);

/*
 * Функция flang «Это признак в скаляре».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param skalyar — «скаляр»: «Скаляр»
 * @return значение
 */
fl_status kompilyator_flang_eto_priznak_v_skalyare(fl_ctx *ctx, fl_value skalyar, fl_value *result, fl_error *error);

/*
 * Функция flang «Проверить по виду».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param znachenie — «значение»: «Значение»
 * @param zadano — «задано»
 * @param tip — «тип»: «Тип»
 * @param metka — «метка»: строка
 * @param tablicy — «таблицы»: «Таблицы»
 * @param mesto — «место»: «Значение»
 * @param bedy — «беды»: список: «Беда»
 * @return значение: список: «Беда»
 */
fl_status kompilyator_flang_proverit_po_vidu(fl_ctx *ctx, fl_value znachenie, fl_value zadano, fl_value tip, fl_value metka, fl_value tablicy, fl_value mesto, fl_value bedy, fl_value *result, fl_error *error);

/*
 * Функция flang «Проверить составное значение».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param znachenie — «значение»: «Значение»
 * @param zadano — «задано»
 * @param tip — «тип»: «Тип»
 * @param metka_vida — «метка вида»: строка
 * @param metka — «метка»: строка
 * @param tablicy — «таблицы»: «Таблицы»
 * @param mesto — «место»: «Значение»
 * @param bedy — «беды»: список: «Беда»
 * @return значение: список: «Беда»
 */
fl_status kompilyator_flang_proverit_sostavnoe_znachenie(fl_ctx *ctx, fl_value znachenie, fl_value zadano, fl_value tip, fl_value metka_vida, fl_value metka, fl_value tablicy, fl_value mesto, fl_value bedy, fl_value *result, fl_error *error);

/*
 * Функция flang «Проверить значение-функцию».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param znachenie — «значение»: «Значение»
 * @param zadano — «задано»
 * @param tip — «тип»: «Тип»
 * @param metka — «метка»: строка
 * @param tablicy — «таблицы»: «Таблицы»
 * @param mesto — «место»: «Значение»
 * @param bedy — «беды»: список: «Беда»
 * @return значение: список: «Беда»
 */
fl_status kompilyator_flang_proverit_znachenie_funkciyu(fl_ctx *ctx, fl_value znachenie, fl_value zadano, fl_value tip, fl_value metka, fl_value tablicy, fl_value mesto, fl_value bedy, fl_value *result, fl_error *error);

/*
 * Функция flang «Сверить тег с сигнатурой».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param teg — «тег»: строка
 * @param tip — «тип»: «Тип»
 * @param metka — «метка»: строка
 * @param tablicy — «таблицы»: «Таблицы»
 * @param mesto — «место»: «Значение»
 * @param bedy — «беды»: список: «Беда»
 * @return значение: список: «Беда»
 */
fl_status kompilyator_flang_sverit_teg_s_signaturoy(fl_ctx *ctx, fl_value teg, fl_value tip, fl_value metka, fl_value tablicy, fl_value mesto, fl_value bedy, fl_value *result, fl_error *error);

/*
 * Функция flang «Проверить элементы значения».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Хвостовой самовызов развёрнут в цикл: стек не растёт.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param elementy — «элементы»: список: «Значение»
 * @param nomer — «номер»: число
 * @param tip — «тип»: «Тип»
 * @param metka — «метка»: строка
 * @param tablicy — «таблицы»: «Таблицы»
 * @param mesto — «место»: «Значение»
 * @param bedy — «беды»: список: «Беда»
 * @return значение: список: «Беда»
 */
fl_status kompilyator_flang_proverit_elementy_znacheniya(fl_ctx *ctx, fl_value elementy, fl_value nomer, fl_value tip, fl_value metka, fl_value tablicy, fl_value mesto, fl_value bedy, fl_value *result, fl_error *error);

/*
 * Функция flang «Проверить значение записи».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param znachenie — «значение»: «Значение»
 * @param zadano — «задано»
 * @param tip — «тип»: «Тип»
 * @param metka — «метка»: строка
 * @param tablicy — «таблицы»: «Таблицы»
 * @param mesto — «место»: «Значение»
 * @param bedy — «беды»: список: «Беда»
 * @return значение: список: «Беда»
 */
fl_status kompilyator_flang_proverit_znachenie_zapisi(fl_ctx *ctx, fl_value znachenie, fl_value zadano, fl_value tip, fl_value metka, fl_value tablicy, fl_value mesto, fl_value bedy, fl_value *result, fl_error *error);

/*
 * Функция flang «Проверить поля известной записи».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param znachenie — «значение»: «Значение»
 * @param imya — «имя»: строка
 * @param metka — «метка»: строка
 * @param tablicy — «таблицы»: «Таблицы»
 * @param podstanovka — «подстановка»: список: «Связка типа»
 * @param mesto — «место»: «Значение»
 * @param bedy — «беды»: список: «Беда»
 * @return значение: список: «Беда»
 */
fl_status kompilyator_flang_proverit_polya_izvestnoy_zapisi(fl_ctx *ctx, fl_value znachenie, fl_value imya, fl_value metka, fl_value tablicy, fl_value podstanovka, fl_value mesto, fl_value bedy, fl_value *result, fl_error *error);

/*
 * Функция flang «Проверить поля значения».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Хвостовой самовызов развёрнут в цикл: стек не растёт.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param obyavleno — «объявлено»: список: «Поле типа»
 * @param znachenie — «значение»: «Значение»
 * @param imya — «имя»: строка
 * @param metka — «метка»: строка
 * @param tablicy — «таблицы»: «Таблицы»
 * @param podstanovka — «подстановка»: список: «Связка типа»
 * @param mesto — «место»: «Значение»
 * @param bedy — «беды»: список: «Беда»
 * @return значение: список: «Беда»
 */
fl_status kompilyator_flang_proverit_polya_znacheniya(fl_ctx *ctx, fl_value obyavleno, fl_value znachenie, fl_value imya, fl_value metka, fl_value tablicy, fl_value podstanovka, fl_value mesto, fl_value bedy, fl_value *result, fl_error *error);

/*
 * Функция flang «Проверить поле значения».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param pole — «поле»: «Поле типа»
 * @param znachenie — «значение»: «Значение»
 * @param imya — «имя»: строка
 * @param metka — «метка»: строка
 * @param tablicy — «таблицы»: «Таблицы»
 * @param podstanovka — «подстановка»: список: «Связка типа»
 * @param mesto — «место»: «Значение»
 * @param bedy — «беды»: список: «Беда»
 * @return значение: список: «Беда»
 */
fl_status kompilyator_flang_proverit_pole_znacheniya(fl_ctx *ctx, fl_value pole, fl_value znachenie, fl_value imya, fl_value metka, fl_value tablicy, fl_value podstanovka, fl_value mesto, fl_value bedy, fl_value *result, fl_error *error);

/*
 * Функция flang «Проверить лишние поля значения».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * Хвостовой самовызов развёрнут в цикл: стек не растёт.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param polya — «поля»: список: «Поле значения»
 * @param obyavleno — «объявлено»: список: «Поле типа»
 * @param imya — «имя»: строка
 * @param metka — «метка»: строка
 * @param mesto — «место»: «Значение»
 * @param bedy — «беды»: список: «Беда»
 * @return значение: список: «Беда»
 */
fl_status kompilyator_flang_proverit_lishnie_polya_znacheniya(fl_ctx *ctx, fl_value polya, fl_value obyavleno, fl_value imya, fl_value metka, fl_value mesto, fl_value bedy, fl_value *result, fl_error *error);

/*
 * Функция flang «Проверить значение суммы».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param znachenie — «значение»: «Значение»
 * @param zadano — «задано»
 * @param tip — «тип»: «Тип»
 * @param metka — «метка»: строка
 * @param tablicy — «таблицы»: «Таблицы»
 * @param mesto — «место»: «Значение»
 * @param bedy — «беды»: список: «Беда»
 * @return значение: список: «Беда»
 */
fl_status kompilyator_flang_proverit_znachenie_summy(fl_ctx *ctx, fl_value znachenie, fl_value zadano, fl_value tip, fl_value metka, fl_value tablicy, fl_value mesto, fl_value bedy, fl_value *result, fl_error *error);

/*
 * Функция flang «Проверить вариант значения».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param znachenie — «значение»: «Значение»
 * @param tip — «тип»: «Тип»
 * @param metka — «метка»: строка
 * @param tablicy — «таблицы»: «Таблицы»
 * @param mesto — «место»: «Значение»
 * @param bedy — «беды»: список: «Беда»
 * @return значение: список: «Беда»
 */
fl_status kompilyator_flang_proverit_variant_znacheniya(fl_ctx *ctx, fl_value znachenie, fl_value tip, fl_value metka, fl_value tablicy, fl_value mesto, fl_value bedy, fl_value *result, fl_error *error);

/*
 * Функция flang «Полезная нагрузка».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param znachenie — «значение»: «Значение»
 * @return значение: «Значение»
 */
fl_status kompilyator_flang_poleznaya_nagruzka(fl_ctx *ctx, fl_value znachenie, fl_value *result, fl_error *error);

/*
 * Функция flang «Не ключ варианта».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param klyuch — «ключ»: строка
 * @return значение
 */
fl_status kompilyator_flang_ne_klyuch_varianta(fl_ctx *ctx, fl_value klyuch, fl_value *result, fl_error *error);

/*
 * Функция flang «Проверить поля варианта значения».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Хвостовой самовызов развёрнут в цикл: стек не растёт.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param obyavleno — «объявлено»: список: «Поле типа»
 * @param nagruzka — «нагрузка»: «Значение»
 * @param imya_varianta — «имя варианта»: строка
 * @param metka — «метка»: строка
 * @param tablicy — «таблицы»: «Таблицы»
 * @param podstanovka — «подстановка»: список: «Связка типа»
 * @param mesto — «место»: «Значение»
 * @param bedy — «беды»: список: «Беда»
 * @return значение: список: «Беда»
 */
fl_status kompilyator_flang_proverit_polya_varianta_znacheniya(fl_ctx *ctx, fl_value obyavleno, fl_value nagruzka, fl_value imya_varianta, fl_value metka, fl_value tablicy, fl_value podstanovka, fl_value mesto, fl_value bedy, fl_value *result, fl_error *error);

/*
 * Функция flang «Проверить поле варианта значения».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param pole — «поле»: «Поле типа»
 * @param nagruzka — «нагрузка»: «Значение»
 * @param imya_varianta — «имя варианта»: строка
 * @param metka — «метка»: строка
 * @param tablicy — «таблицы»: «Таблицы»
 * @param podstanovka — «подстановка»: список: «Связка типа»
 * @param mesto — «место»: «Значение»
 * @param bedy — «беды»: список: «Беда»
 * @return значение: список: «Беда»
 */
fl_status kompilyator_flang_proverit_pole_varianta_znacheniya(fl_ctx *ctx, fl_value pole, fl_value nagruzka, fl_value imya_varianta, fl_value metka, fl_value tablicy, fl_value podstanovka, fl_value mesto, fl_value bedy, fl_value *result, fl_error *error);

/*
 * Функция flang «Проверить функции».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Хвостовой самовызов развёрнут в цикл: стек не растёт.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param funkcii — «функции»: список: «Значение»
 * @param tablicy — «таблицы»: «Таблицы»
 * @param bedy — «беды»: список: «Беда»
 * @return значение: список: «Беда»
 */
fl_status kompilyator_flang_proverit_funkcii(fl_ctx *ctx, fl_value funkcii, fl_value tablicy, fl_value bedy, fl_value *result, fl_error *error);

/*
 * Функция flang «Проверить функцию».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param funkciya — «функция»: «Значение»
 * @param tablicy — «таблицы»: «Таблицы»
 * @param bedy — «беды»: список: «Беда»
 * @return значение: список: «Беда»
 */
fl_status kompilyator_flang_proverit_funkciyu(fl_ctx *ctx, fl_value funkciya, fl_value tablicy, fl_value bedy, fl_value *result, fl_error *error);

/*
 * Функция flang «Среда параметров».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * Хвостовой самовызов развёрнут в цикл: стек не растёт.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param parametry — «параметры»: список: «Параметр»
 * @param imena — «имена»: «Имена»
 * @return значение: «Имена»
 */
fl_status kompilyator_flang_sreda_parametrov(fl_ctx *ctx, fl_value parametry, fl_value imena, fl_value *result, fl_error *error);

/*
 * Функция flang «Проверить меру».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param funkciya — «функция»: «Значение»
 * @param signatura — «сигнатура»: «Сигнатура»
 * @param tablicy — «таблицы»: «Таблицы»
 * @param bedy — «беды»: список: «Беда»
 * @return значение: список: «Беда»
 */
fl_status kompilyator_flang_proverit_meru(fl_ctx *ctx, fl_value funkciya, fl_value signatura, fl_value tablicy, fl_value bedy, fl_value *result, fl_error *error);

/*
 * Функция flang «Сверить меру».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param mera — «мера»: «Значение»
 * @param signatura — «сигнатура»: «Сигнатура»
 * @param gde — «где»: строка
 * @param tablicy — «таблицы»: «Таблицы»
 * @param bedy — «беды»: список: «Беда»
 * @return значение: список: «Беда»
 */
fl_status kompilyator_flang_sverit_meru(fl_ctx *ctx, fl_value mera, fl_value signatura, fl_value gde, fl_value tablicy, fl_value bedy, fl_value *result, fl_error *error);

/*
 * Функция flang «Проверить тело».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param funkciya — «функция»: «Значение»
 * @param signatura — «сигнатура»: «Сигнатура»
 * @param tablicy — «таблицы»: «Таблицы»
 * @param bedy — «беды»: список: «Беда»
 * @return значение: список: «Беда»
 */
fl_status kompilyator_flang_proverit_telo(fl_ctx *ctx, fl_value funkciya, fl_value signatura, fl_value tablicy, fl_value bedy, fl_value *result, fl_error *error);

/*
 * Функция flang «Сверить тело».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param telo — «тело»: «Значение»
 * @param signatura — «сигнатура»: «Сигнатура»
 * @param gde — «где»: строка
 * @param tablicy — «таблицы»: «Таблицы»
 * @param bedy — «беды»: список: «Беда»
 * @return значение: список: «Беда»
 */
fl_status kompilyator_flang_sverit_telo(fl_ctx *ctx, fl_value telo, fl_value signatura, fl_value gde, fl_value tablicy, fl_value bedy, fl_value *result, fl_error *error);

/*
 * Функция flang «Проверить примеры».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Хвостовой самовызов развёрнут в цикл: стек не растёт.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param primery — «примеры»: список: «Значение»
 * @param funkciya — «функция»: «Значение»
 * @param signatura — «сигнатура»: «Сигнатура»
 * @param tablicy — «таблицы»: «Таблицы»
 * @param bedy — «беды»: список: «Беда»
 * @return значение: список: «Беда»
 */
fl_status kompilyator_flang_proverit_primery(fl_ctx *ctx, fl_value primery, fl_value funkciya, fl_value signatura, fl_value tablicy, fl_value bedy, fl_value *result, fl_error *error);

/*
 * Функция flang «Проверить пример».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param primer — «пример»: «Значение»
 * @param signatura — «сигнатура»: «Сигнатура»
 * @param tablicy — «таблицы»: «Таблицы»
 * @param bedy — «беды»: список: «Беда»
 * @return значение: список: «Беда»
 */
fl_status kompilyator_flang_proverit_primer(fl_ctx *ctx, fl_value primer, fl_value signatura, fl_value tablicy, fl_value bedy, fl_value *result, fl_error *error);

/*
 * Функция flang «Проверить аргументы примера».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Хвостовой самовызов развёрнут в цикл: стек не растёт.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param parametry — «параметры»: список: «Параметр»
 * @param argumenty — «аргументы»: «Значение»
 * @param metka — «метка»: строка
 * @param signatura — «сигнатура»: «Сигнатура»
 * @param tablicy — «таблицы»: «Таблицы»
 * @param podstanovka — «подстановка»: список: «Связка типа»
 * @param primer — «пример»: «Значение»
 * @param bedy — «беды»: список: «Беда»
 * @return значение: список: «Беда»
 */
fl_status kompilyator_flang_proverit_argumenty_primera(fl_ctx *ctx, fl_value parametry, fl_value argumenty, fl_value metka, fl_value signatura, fl_value tablicy, fl_value podstanovka, fl_value primer, fl_value bedy, fl_value *result, fl_error *error);

/*
 * Функция flang «Проверить аргумент примера».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param parametr — «параметр»: «Параметр»
 * @param argumenty — «аргументы»: «Значение»
 * @param metka — «метка»: строка
 * @param signatura — «сигнатура»: «Сигнатура»
 * @param tablicy — «таблицы»: «Таблицы»
 * @param podstanovka — «подстановка»: список: «Связка типа»
 * @param primer — «пример»: «Значение»
 * @param bedy — «беды»: список: «Беда»
 * @return значение: список: «Беда»
 */
fl_status kompilyator_flang_proverit_argument_primera(fl_ctx *ctx, fl_value parametr, fl_value argumenty, fl_value metka, fl_value signatura, fl_value tablicy, fl_value podstanovka, fl_value primer, fl_value bedy, fl_value *result, fl_error *error);

/*
 * Функция flang «Подстановка примера».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param signatura — «сигнатура»: «Сигнатура»
 * @param primer — «пример»: «Значение»
 * @param tablicy — «таблицы»: «Таблицы»
 * @return значение: список: «Связка типа»
 */
fl_status kompilyator_flang_podstanovka_primera(fl_ctx *ctx, fl_value signatura, fl_value primer, fl_value tablicy, fl_value *result, fl_error *error);

/*
 * Функция flang «Подстановка по аргументам».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Хвостовой самовызов развёрнут в цикл: стек не растёт.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param parametry — «параметры»: список: «Параметр»
 * @param argumenty — «аргументы»: «Значение»
 * @param tablicy — «таблицы»: «Таблицы»
 * @param svyazki — «связки»: список: «Связка типа»
 * @return значение: список: «Связка типа»
 */
fl_status kompilyator_flang_podstanovka_po_argumentam(fl_ctx *ctx, fl_value parametry, fl_value argumenty, fl_value tablicy, fl_value svyazki, fl_value *result, fl_error *error);

/*
 * Функция flang «Подстановка по аргументу».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param parametr — «параметр»: «Параметр»
 * @param argumenty — «аргументы»: «Значение»
 * @param tablicy — «таблицы»: «Таблицы»
 * @param svyazki — «связки»: список: «Связка типа»
 * @return значение: список: «Связка типа»
 */
fl_status kompilyator_flang_podstanovka_po_argumentu(fl_ctx *ctx, fl_value parametr, fl_value argumenty, fl_value tablicy, fl_value svyazki, fl_value *result, fl_error *error);

/*
 * Функция flang «Подстановка по ответу».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param signatura — «сигнатура»: «Сигнатура»
 * @param primer — «пример»: «Значение»
 * @param tablicy — «таблицы»: «Таблицы»
 * @param svyazki — «связки»: список: «Связка типа»
 * @return значение: список: «Связка типа»
 */
fl_status kompilyator_flang_podstanovka_po_otvetu(fl_ctx *ctx, fl_value signatura, fl_value primer, fl_value tablicy, fl_value svyazki, fl_value *result, fl_error *error);

/*
 * Функция flang «Всё решено».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * Хвостовой самовызов развёрнут в цикл: стек не растёт.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param imena — «имена»: список: строка
 * @param svyazki — «связки»: список: «Связка типа»
 * @return значение
 */
fl_status kompilyator_flang_vsyo_resheno(fl_ctx *ctx, fl_value imena, fl_value svyazki, fl_value *result, fl_error *error);

/*
 * Функция flang «Дополнить подстановку примера».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param imena — «имена»: список: строка
 * @param svyazki — «связки»: список: «Связка типа»
 * @return значение: список: «Связка типа»
 */
fl_status kompilyator_flang_dopolnit_podstanovku_primera(fl_ctx *ctx, fl_value imena, fl_value svyazki, fl_value *result, fl_error *error);

/*
 * Функция flang «Тип значения примера».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param znachenie — «значение»: «Значение»
 * @param zadano — «задано»
 * @param podskazka — «подсказка»: «Тип»
 * @param tablicy — «таблицы»: «Таблицы»
 * @return значение: «Тип»
 */
fl_status kompilyator_flang_tip_znacheniya_primera(fl_ctx *ctx, fl_value znachenie, fl_value zadano, fl_value podskazka, fl_value tablicy, fl_value *result, fl_error *error);

/*
 * Функция flang «Тип заданного значения».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param znachenie — «значение»: «Значение»
 * @param podskazka — «подсказка»: «Тип»
 * @param tablicy — «таблицы»: «Таблицы»
 * @return значение: «Тип»
 */
fl_status kompilyator_flang_tip_zadannogo_znacheniya(fl_ctx *ctx, fl_value znachenie, fl_value podskazka, fl_value tablicy, fl_value *result, fl_error *error);

/*
 * Функция flang «Тип составного значения примера».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param znachenie — «значение»: «Значение»
 * @param podskazka — «подсказка»: «Тип»
 * @param tablicy — «таблицы»: «Таблицы»
 * @return значение: «Тип»
 */
fl_status kompilyator_flang_tip_sostavnogo_znacheniya_primera(fl_ctx *ctx, fl_value znachenie, fl_value podskazka, fl_value tablicy, fl_value *result, fl_error *error);

/*
 * Функция flang «Подсказка элемента».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param podskazka — «подсказка»: «Тип»
 * @return значение: «Тип»
 */
fl_status kompilyator_flang_podskazka_elementa(fl_ctx *ctx, fl_value podskazka, fl_value *result, fl_error *error);

/*
 * Функция flang «Тип элементов примера».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Хвостовой самовызов развёрнут в цикл: стек не растёт.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param elementy — «элементы»: список: «Значение»
 * @param podskazka — «подсказка»: «Тип»
 * @param tablicy — «таблицы»: «Таблицы»
 * @return значение: «Тип»
 */
fl_status kompilyator_flang_tip_elementov_primera(fl_ctx *ctx, fl_value elementy, fl_value podskazka, fl_value tablicy, fl_value *result, fl_error *error);

/*
 * Функция flang «Тип записи примера».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param znachenie — «значение»: «Значение»
 * @param podskazka — «подсказка»: «Тип»
 * @param tablicy — «таблицы»: «Таблицы»
 * @return значение: «Тип»
 */
fl_status kompilyator_flang_tip_zapisi_primera(fl_ctx *ctx, fl_value znachenie, fl_value podskazka, fl_value tablicy, fl_value *result, fl_error *error);

/*
 * Функция flang «Тип тега примера».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param teg — «тег»: строка
 * @param znachenie — «значение»: «Значение»
 * @param podskazka — «подсказка»: «Тип»
 * @param tablicy — «таблицы»: «Таблицы»
 * @return значение: «Тип»
 */
fl_status kompilyator_flang_tip_tega_primera(fl_ctx *ctx, fl_value teg, fl_value znachenie, fl_value podskazka, fl_value tablicy, fl_value *result, fl_error *error);

/*
 * Функция flang «Тип функции примера».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param teg — «тег»: строка
 * @param tablicy — «таблицы»: «Таблицы»
 * @return значение: «Тип»
 */
fl_status kompilyator_flang_tip_funkcii_primera(fl_ctx *ctx, fl_value teg, fl_value tablicy, fl_value *result, fl_error *error);

/*
 * Функция flang «Тип суммы примера».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param teg — «тег»: строка
 * @param znachenie — «значение»: «Значение»
 * @param podskazka — «подсказка»: «Тип»
 * @param tablicy — «таблицы»: «Таблицы»
 * @return значение: «Тип»
 */
fl_status kompilyator_flang_tip_summy_primera(fl_ctx *ctx, fl_value teg, fl_value znachenie, fl_value podskazka, fl_value tablicy, fl_value *result, fl_error *error);

/*
 * Функция flang «Тип известной записи примера».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param znachenie — «значение»: «Значение»
 * @param podskazka — «подсказка»: «Тип»
 * @param tablicy — «таблицы»: «Таблицы»
 * @return значение: «Тип»
 */
fl_status kompilyator_flang_tip_izvestnoy_zapisi_primera(fl_ctx *ctx, fl_value znachenie, fl_value podskazka, fl_value tablicy, fl_value *result, fl_error *error);

/*
 * Функция flang «Аргументы примера».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param parametry — «параметры»: список: строка
 * @param obyavleno — «объявлено»: список: «Поле типа»
 * @param nagruzka — «нагрузка»: «Значение»
 * @param podskazka — «подсказка»: «Тип»
 * @param vladelec — «владелец»: строка
 * @param tablicy — «таблицы»: «Таблицы»
 * @return значение: список: «Тип»
 */
fl_status kompilyator_flang_argumenty_primera(fl_ctx *ctx, fl_value parametry, fl_value obyavleno, fl_value nagruzka, fl_value podskazka, fl_value vladelec, fl_value tablicy, fl_value *result, fl_error *error);

/*
 * Функция flang «Решить поля примера».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Хвостовой самовызов развёрнут в цикл: стек не растёт.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param obyavleno — «объявлено»: список: «Поле типа»
 * @param nagruzka — «нагрузка»: «Значение»
 * @param vneshnie — «внешние»: список: «Связка типа»
 * @param tablicy — «таблицы»: «Таблицы»
 * @param svyazki — «связки»: список: «Связка типа»
 * @return значение: список: «Связка типа»
 */
fl_status kompilyator_flang_reshit_polya_primera(fl_ctx *ctx, fl_value obyavleno, fl_value nagruzka, fl_value vneshnie, fl_value tablicy, fl_value svyazki, fl_value *result, fl_error *error);

/*
 * Функция flang «Решить поле примера».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param pole — «поле»: «Поле типа»
 * @param nagruzka — «нагрузка»: «Значение»
 * @param vneshnie — «внешние»: список: «Связка типа»
 * @param tablicy — «таблицы»: «Таблицы»
 * @param svyazki — «связки»: список: «Связка типа»
 * @return значение: список: «Связка типа»
 */
fl_status kompilyator_flang_reshit_pole_primera(fl_ctx *ctx, fl_value pole, fl_value nagruzka, fl_value vneshnie, fl_value tablicy, fl_value svyazki, fl_value *result, fl_error *error);

/*
 * Функция flang «Разложить связки».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param parametry — «параметры»: список: строка
 * @param svyazki — «связки»: список: «Связка типа»
 * @return значение: список: «Тип»
 */
fl_status kompilyator_flang_razlozhit_svyazki(fl_ctx *ctx, fl_value parametry, fl_value svyazki, fl_value *result, fl_error *error);

/*
 * Функция flang «Проверить лишние аргументы».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * Хвостовой самовызов развёрнут в цикл: стек не растёт.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param dannye — «данные»: список: «Поле значения»
 * @param parametry — «параметры»: список: «Параметр»
 * @param metka — «метка»: строка
 * @param signatura — «сигнатура»: «Сигнатура»
 * @param primer — «пример»: «Значение»
 * @param bedy — «беды»: список: «Беда»
 * @return значение: список: «Беда»
 */
fl_status kompilyator_flang_proverit_lishnie_argumenty(fl_ctx *ctx, fl_value dannye, fl_value parametry, fl_value metka, fl_value signatura, fl_value primer, fl_value bedy, fl_value *result, fl_error *error);

/*
 * Функция flang «Проверить типы».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param programma — «программа»: «Значение»
 * @return значение: «Итог проверки»
 */
fl_status kompilyator_flang_proverit_tipy(fl_ctx *ctx, fl_value programma, fl_value *result, fl_error *error);

/*
 * Функция flang «Неизвестно».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @return значение: «Происхождение»
 */
fl_status kompilyator_flang_neizvestno(fl_ctx *ctx, fl_value *result, fl_error *error);

/*
 * Функция flang «Собрать происхождение».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param parametr — «параметр»: число
 * @param imya — «имя»: строка
 * @param chast — «часть»
 * @param glubina — «глубина»: число
 * @param mera — «мера»
 * @param shag — «шаг»: число
 * @param ogranichen — «ограничен»
 * @return значение: «Происхождение»
 */
fl_status kompilyator_flang_sobrat_proishozhdenie(fl_ctx *ctx, fl_value parametr, fl_value imya, fl_value chast, fl_value glubina, fl_value mera, fl_value shag, fl_value ogranichen, fl_value *result, fl_error *error);

/*
 * Функция flang «Собрать меру».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param parametr — «параметр»: число
 * @param imya — «имя»: строка
 * @param mera — «мера»
 * @param shag — «шаг»: число
 * @param ogranichen — «ограничен»
 * @return значение: «Происхождение»
 */
fl_status kompilyator_flang_sobrat_meru(fl_ctx *ctx, fl_value parametr, fl_value imya, fl_value mera, fl_value shag, fl_value ogranichen, fl_value *result, fl_error *error);

/*
 * Функция flang «Часть параметра».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param parametr — «параметр»: число
 * @param imya — «имя»: строка
 * @param glubina — «глубина»: число
 * @return значение: «Происхождение»
 */
fl_status kompilyator_flang_chast_parametra(fl_ctx *ctx, fl_value parametr, fl_value imya, fl_value glubina, fl_value *result, fl_error *error);

/*
 * Функция flang «Сам параметр».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param parametr — «параметр»: число
 * @param imya — «имя»: строка
 * @return значение: «Происхождение»
 */
fl_status kompilyator_flang_sam_parametr(fl_ctx *ctx, fl_value parametr, fl_value imya, fl_value *result, fl_error *error);

/*
 * Функция flang «Глубже».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param proishozhdenie — «происхождение»: «Происхождение»
 * @return значение: «Происхождение»
 */
fl_status kompilyator_flang_glubzhe(fl_ctx *ctx, fl_value proishozhdenie, fl_value *result, fl_error *error);

/*
 * Функция flang «Сдвинуть».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param proishozhdenie — «происхождение»: «Происхождение»
 * @param sdvig — «сдвиг»: число
 * @return значение: «Происхождение»
 */
fl_status kompilyator_flang_sdvinut(fl_ctx *ctx, fl_value proishozhdenie, fl_value sdvig, fl_value *result, fl_error *error);

/*
 * Функция flang «Сдвинутая мера».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param proishozhdenie — «происхождение»: «Происхождение»
 * @param shag — «шаг»: число
 * @return значение: «Происхождение»
 */
fl_status kompilyator_flang_sdvinutaya_mera(fl_ctx *ctx, fl_value proishozhdenie, fl_value shag, fl_value *result, fl_error *error);

/*
 * Функция flang «Прибавка перекрыла шаг».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param proishozhdenie — «происхождение»: «Происхождение»
 * @param shag — «шаг»: число
 * @return значение
 */
fl_status kompilyator_flang_pribavka_perekryla_shag(fl_ctx *ctx, fl_value proishozhdenie, fl_value shag, fl_value *result, fl_error *error);

/*
 * Функция flang «Это больше нуля».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param chislo — «число»: число
 * @return значение
 */
fl_status kompilyator_flang_eto_bolshe_nulya(fl_ctx *ctx, fl_value chislo, fl_value *result, fl_error *error);

/*
 * Функция flang «С признаками шага».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param osnova — «основа»: «Происхождение»
 * @param parametrom — «параметром»
 * @param kotoryy — «который»: число
 * @param polozhitelen — «положителен»
 * @return значение: «Происхождение»
 */
fl_status kompilyator_flang_s_priznakami_shaga(fl_ctx *ctx, fl_value osnova, fl_value parametrom, fl_value kotoryy, fl_value polozhitelen, fl_value *result, fl_error *error);

/*
 * Функция flang «Сдвинуть на параметр».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param znachenie — «значение»: «Происхождение»
 * @param shag — «шаг»: «Происхождение»
 * @return значение: «Происхождение»
 */
fl_status kompilyator_flang_sdvinut_na_parametr(fl_ctx *ctx, fl_value znachenie, fl_value shag, fl_value *result, fl_error *error);

/*
 * Функция flang «Можно шагом параметра».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param znachenie — «значение»: «Происхождение»
 * @param shag — «шаг»: «Происхождение»
 * @return значение
 */
fl_status kompilyator_flang_mozhno_shagom_parametra(fl_ctx *ctx, fl_value znachenie, fl_value shag, fl_value *result, fl_error *error);

/*
 * Функция flang «Шаг годится».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param uzhe — «уже»
 * @param shag — «шаг»: «Происхождение»
 * @return значение
 */
fl_status kompilyator_flang_shag_goditsya(fl_ctx *ctx, fl_value uzhe, fl_value shag, fl_value *result, fl_error *error);

/*
 * Функция flang «Это сам параметр».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param proishozhdenie — «происхождение»: «Происхождение»
 * @return значение
 */
fl_status kompilyator_flang_eto_sam_parametr(fl_ctx *ctx, fl_value proishozhdenie, fl_value *result, fl_error *error);

/*
 * Функция flang «Глубина и шаг нулевые».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param proishozhdenie — «происхождение»: «Происхождение»
 * @return значение
 */
fl_status kompilyator_flang_glubina_i_shag_nulevye(fl_ctx *ctx, fl_value proishozhdenie, fl_value *result, fl_error *error);

/*
 * Функция flang «Оба нуля».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param pervoe — «первое»: число
 * @param vtoroe — «второе»: число
 * @return значение
 */
fl_status kompilyator_flang_oba_nulya(fl_ctx *ctx, fl_value pervoe, fl_value vtoroe, fl_value *result, fl_error *error);

/*
 * Функция flang «Это ноль».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param chislo — «число»: число
 * @return значение
 */
fl_status kompilyator_flang_eto_nol(fl_ctx *ctx, fl_value chislo, fl_value *result, fl_error *error);

/*
 * Функция flang «Ограничить».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param proishozhdenie — «происхождение»: «Происхождение»
 * @param polozhitelen — «положителен»
 * @return значение: «Происхождение»
 */
fl_status kompilyator_flang_ogranichit(fl_ctx *ctx, fl_value proishozhdenie, fl_value polozhitelen, fl_value *result, fl_error *error);

/*
 * Функция flang «Хоть одно».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param pervoe — «первое»
 * @param vtoroe — «второе»
 * @return значение
 */
fl_status kompilyator_flang_hot_odno(fl_ctx *ctx, fl_value pervoe, fl_value vtoroe, fl_value *result, fl_error *error);

/*
 * Функция flang «Слить происхождения».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param levoe — «левое»: «Происхождение»
 * @param pravoe — «правое»: «Происхождение»
 * @return значение: «Происхождение»
 */
fl_status kompilyator_flang_slit_proishozhdeniya(fl_ctx *ctx, fl_value levoe, fl_value pravoe, fl_value *result, fl_error *error);

/*
 * Функция flang «Слить известное слева».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param levoe — «левое»: «Происхождение»
 * @param pravoe — «правое»: «Происхождение»
 * @return значение: «Происхождение»
 */
fl_status kompilyator_flang_slit_izvestnoe_sleva(fl_ctx *ctx, fl_value levoe, fl_value pravoe, fl_value *result, fl_error *error);

/*
 * Функция flang «Слить по параметру».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param levoe — «левое»: «Происхождение»
 * @param pravoe — «правое»: «Происхождение»
 * @return значение: «Происхождение»
 */
fl_status kompilyator_flang_slit_po_parametru(fl_ctx *ctx, fl_value levoe, fl_value pravoe, fl_value *result, fl_error *error);

/*
 * Функция flang «Слить совпавшие».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param levoe — «левое»: «Происхождение»
 * @param pravoe — «правое»: «Происхождение»
 * @return значение: «Происхождение»
 */
fl_status kompilyator_flang_slit_sovpavshie(fl_ctx *ctx, fl_value levoe, fl_value pravoe, fl_value *result, fl_error *error);

/*
 * Функция flang «Шаг тот же».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param levoe — «левое»: «Происхождение»
 * @param pravoe — «правое»: «Происхождение»
 * @return значение
 */
fl_status kompilyator_flang_shag_tot_zhe(fl_ctx *ctx, fl_value levoe, fl_value pravoe, fl_value *result, fl_error *error);

/*
 * Функция flang «Тот же шаг параметра».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param levoe — «левое»: «Происхождение»
 * @param pravoe — «правое»: «Происхождение»
 * @return значение
 */
fl_status kompilyator_flang_tot_zhe_shag_parametra(fl_ctx *ctx, fl_value levoe, fl_value pravoe, fl_value *result, fl_error *error);

/*
 * Функция flang «И то и другое».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param pervoe — «первое»
 * @param vtoroe — «второе»
 * @return значение
 */
fl_status kompilyator_flang_i_to_i_drugoe(fl_ctx *ctx, fl_value pervoe, fl_value vtoroe, fl_value *result, fl_error *error);

/*
 * Функция flang «Большее шага».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param pervoe — «первое»: число
 * @param vtoroe — «второе»: число
 * @return значение: число
 */
fl_status kompilyator_flang_bolshee_shaga(fl_ctx *ctx, fl_value pervoe, fl_value vtoroe, fl_value *result, fl_error *error);

/*
 * Функция flang «Связать».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param sreda — «среда»: список: «Связка»
 * @param imya — «имя»: строка
 * @param proishozhdenie — «происхождение»: «Происхождение»
 * @return значение: список: «Связка»
 */
fl_status kompilyator_flang_svyazat(fl_ctx *ctx, fl_value sreda, fl_value imya, fl_value proishozhdenie, fl_value *result, fl_error *error);

/*
 * Функция flang «Найти в среде».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param sreda — «среда»: список: «Связка»
 * @param imya — «имя»: строка
 * @return значение: «Происхождение»
 */
fl_status kompilyator_flang_nayti_v_srede(fl_ctx *ctx, fl_value sreda, fl_value imya, fl_value *result, fl_error *error);

/*
 * Функция flang «Связать по ключу».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param sreda — «среда»: список: «Связка»
 * @param uzel — «узел»: «Значение»
 * @param klyuch — «ключ»: строка
 * @param proishozhdenie — «происхождение»: «Происхождение»
 * @return значение: список: «Связка»
 */
fl_status kompilyator_flang_svyazat_po_klyuchu(fl_ctx *ctx, fl_value sreda, fl_value uzel, fl_value klyuch, fl_value proishozhdenie, fl_value *result, fl_error *error);

/*
 * Функция flang «Ограничить среду».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param sreda — «среда»: список: «Связка»
 * @param parametr — «параметр»: число
 * @param polozhitelen — «положителен»
 * @return значение: список: «Связка»
 */
fl_status kompilyator_flang_ogranichit_sredu(fl_ctx *ctx, fl_value sreda, fl_value parametr, fl_value polozhitelen, fl_value *result, fl_error *error);

/*
 * Функция flang «Ограничить связку».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param svyazka — «связка»: «Связка»
 * @param parametr — «параметр»: число
 * @param polozhitelen — «положителен»
 * @return значение: «Связка»
 */
fl_status kompilyator_flang_ogranichit_svyazku(fl_ctx *ctx, fl_value svyazka, fl_value parametr, fl_value polozhitelen, fl_value *result, fl_error *error);

/*
 * Функция flang «Тот же параметр».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param proishozhdenie — «происхождение»: «Происхождение»
 * @param parametr — «параметр»: число
 * @return значение
 */
fl_status kompilyator_flang_tot_zhe_parametr(fl_ctx *ctx, fl_value proishozhdenie, fl_value parametr, fl_value *result, fl_error *error);

/*
 * Функция flang «Это тот параметр».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param pervyy — «первый»: число
 * @param vtoroy — «второй»: число
 * @return значение
 */
fl_status kompilyator_flang_eto_tot_parametr(fl_ctx *ctx, fl_value pervyy, fl_value vtoroy, fl_value *result, fl_error *error);

/*
 * Функция flang «Нет границы».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @return значение: «Граница»
 */
fl_status kompilyator_flang_net_granicy(fl_ctx *ctx, fl_value *result, fl_error *error);

/*
 * Функция flang «Нижняя граница».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param uzel — «узел»: «Значение»
 * @param sreda — «среда»: список: «Связка»
 * @return значение: «Граница»
 */
fl_status kompilyator_flang_nizhnyaya_granica(fl_ctx *ctx, fl_value uzel, fl_value sreda, fl_value *result, fl_error *error);

/*
 * Функция flang «Граница двучлена».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param uzel — «узел»: «Значение»
 * @param sreda — «среда»: список: «Связка»
 * @return значение: «Граница»
 */
fl_status kompilyator_flang_granica_dvuchlena(fl_ctx *ctx, fl_value uzel, fl_value sreda, fl_value *result, fl_error *error);

/*
 * Функция flang «Число или ноль».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param uzel — «узел»: «Значение»
 * @return значение: число
 */
fl_status kompilyator_flang_chislo_ili_nol(fl_ctx *ctx, fl_value uzel, fl_value *result, fl_error *error);

/*
 * Функция flang «Имя против числа».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param imya — «имя»: «Значение»
 * @param chislo — «число»: «Значение»
 * @return значение
 */
fl_status kompilyator_flang_imya_protiv_chisla(fl_ctx *ctx, fl_value imya, fl_value chislo, fl_value *result, fl_error *error);

/*
 * Функция flang «Есть конечное число».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param mozhet — «может»: «Может быть число»
 * @return значение
 */
fl_status kompilyator_flang_est_konechnoe_chislo(fl_ctx *ctx, fl_value mozhet, fl_value *result, fl_error *error);

/*
 * Функция flang «Ветвь знака слева».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param znak — «знак»: строка
 * @return значение: «Ветвь границы»
 */
fl_status kompilyator_flang_vetv_znaka_sleva(fl_ctx *ctx, fl_value znak, fl_value *result, fl_error *error);

/*
 * Функция flang «Ветвь знака справа».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param znak — «знак»: строка
 * @return значение: «Ветвь границы»
 */
fl_status kompilyator_flang_vetv_znaka_sprava(fl_ctx *ctx, fl_value znak, fl_value *result, fl_error *error);

/*
 * Функция flang «Граница по имени».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param uzel — «узел»: «Значение»
 * @param sreda — «среда»: список: «Связка»
 * @param vetv — «ветвь»: «Ветвь границы»
 * @param predel — «предел»: число
 * @return значение: «Граница»
 */
fl_status kompilyator_flang_granica_po_imeni(fl_ctx *ctx, fl_value uzel, fl_value sreda, fl_value vetv, fl_value predel, fl_value *result, fl_error *error);

/*
 * Функция flang «Граница из среды».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param uzel — «узел»: «Значение»
 * @param sreda — «среда»: список: «Связка»
 * @param vetv — «ветвь»: «Ветвь границы»
 * @param predel — «предел»: число
 * @return значение: «Граница»
 */
fl_status kompilyator_flang_granica_iz_sredy(fl_ctx *ctx, fl_value uzel, fl_value sreda, fl_value vetv, fl_value predel, fl_value *result, fl_error *error);

/*
 * Функция flang «Граница даёт плюс».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param proishozhdenie — «происхождение»: «Происхождение»
 * @param vetv — «ветвь»: «Ветвь границы»
 * @param predel — «предел»: число
 * @return значение
 */
fl_status kompilyator_flang_granica_dayot_plyus(fl_ctx *ctx, fl_value proishozhdenie, fl_value vetv, fl_value predel, fl_value *result, fl_error *error);

/*
 * Функция flang «Предел не ниже нуля».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param strogaya — «строгая»
 * @param predel — «предел»: число
 * @return значение
 */
fl_status kompilyator_flang_predel_ne_nizhe_nulya(fl_ctx *ctx, fl_value strogaya, fl_value predel, fl_value *result, fl_error *error);

/*
 * Функция flang «Не меньше нуля».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param chislo — «число»: число
 * @return значение
 */
fl_status kompilyator_flang_ne_menshe_nulya(fl_ctx *ctx, fl_value chislo, fl_value *result, fl_error *error);

/*
 * Функция flang «Среда ветви».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param sreda — «среда»: список: «Связка»
 * @param granica — «граница»: «Граница»
 * @param eto_vetv_to — «это ветвь то»
 * @return значение: список: «Связка»
 */
fl_status kompilyator_flang_sreda_vetvi(fl_ctx *ctx, fl_value sreda, fl_value granica, fl_value eto_vetv_to, fl_value *result, fl_error *error);

/*
 * Функция flang «Граница действует».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param granica — «граница»: «Граница»
 * @param eto_vetv_to — «это ветвь то»
 * @return значение
 */
fl_status kompilyator_flang_granica_deystvuet(fl_ctx *ctx, fl_value granica, fl_value eto_vetv_to, fl_value *result, fl_error *error);

/*
 * Функция flang «Та же ветвь».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param pervoe — «первое»
 * @param vtoroe — «второе»
 * @return значение
 */
fl_status kompilyator_flang_ta_zhe_vetv(fl_ctx *ctx, fl_value pervoe, fl_value vtoroe, fl_value *result, fl_error *error);

/*
 * Функция flang «Число литерала».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param uzel — «узел»: «Значение»
 * @return значение: «Может быть число»
 */
fl_status kompilyator_flang_chislo_literala(fl_ctx *ctx, fl_value uzel, fl_value *result, fl_error *error);

/*
 * Функция flang «Конечное число значения».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param uzel — «узел»: «Значение»
 * @return значение: «Может быть число»
 */
fl_status kompilyator_flang_konechnoe_chislo_znacheniya(fl_ctx *ctx, fl_value uzel, fl_value *result, fl_error *error);

/*
 * Функция flang «Конечное число скаляра».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param skalyar — «скаляр»: «Скаляр»
 * @return значение: «Может быть число»
 */
fl_status kompilyator_flang_konechnoe_chislo_skalyara(fl_ctx *ctx, fl_value skalyar, fl_value *result, fl_error *error);

/*
 * Функция flang «Конечное или нет».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param znachenie — «значение»: число
 * @return значение: «Может быть число»
 */
fl_status kompilyator_flang_konechnoe_ili_net(fl_ctx *ctx, fl_value znachenie, fl_value *result, fl_error *error);

/*
 * Функция flang «Это конечное число при анализе».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param znachenie — «значение»: число
 * @return значение
 */
fl_status kompilyator_flang_eto_konechnoe_chislo_pri_analize(fl_ctx *ctx, fl_value znachenie, fl_value *result, fl_error *error);

/*
 * Функция flang «Сдвиг арифметики».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param uzel — «узел»: «Значение»
 * @param levoe — «левое»: «Происхождение»
 * @param pravoe — «правое»: «Происхождение»
 * @return значение: «Происхождение»
 */
fl_status kompilyator_flang_sdvig_arifmetiki(fl_ctx *ctx, fl_value uzel, fl_value levoe, fl_value pravoe, fl_value *result, fl_error *error);

/*
 * Функция flang «Сдвиг вычитанием».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param uzel — «узел»: «Значение»
 * @param levoe — «левое»: «Происхождение»
 * @param pravoe — «правое»: «Происхождение»
 * @return значение: «Происхождение»
 */
fl_status kompilyator_flang_sdvig_vychitaniem(fl_ctx *ctx, fl_value uzel, fl_value levoe, fl_value pravoe, fl_value *result, fl_error *error);

/*
 * Функция flang «Сдвиг сложением».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param uzel — «узел»: «Значение»
 * @param levoe — «левое»: «Происхождение»
 * @param pravoe — «правое»: «Происхождение»
 * @return значение: «Происхождение»
 */
fl_status kompilyator_flang_sdvig_slozheniem(fl_ctx *ctx, fl_value uzel, fl_value levoe, fl_value pravoe, fl_value *result, fl_error *error);

/*
 * Функция flang «Сдвиг слева».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param uzel — «узел»: «Значение»
 * @param pravoe — «правое»: «Происхождение»
 * @return значение: «Происхождение»
 */
fl_status kompilyator_flang_sdvig_sleva(fl_ctx *ctx, fl_value uzel, fl_value pravoe, fl_value *result, fl_error *error);

/*
 * Функция flang «Связать голову и хвост при анализе».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param obrazec — «образец»: «Значение»
 * @param cel — «цель»: «Происхождение»
 * @param sreda — «среда»: список: «Связка»
 * @return значение: список: «Связка»
 */
fl_status kompilyator_flang_svyazat_golovu_i_hvost_pri_analize(fl_ctx *ctx, fl_value obrazec, fl_value cel, fl_value sreda, fl_value *result, fl_error *error);

/*
 * Функция flang «Значения узла».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param uzel — «узел»: «Значение»
 * @return значение: список: «Значение»
 */
fl_status kompilyator_flang_znacheniya_uzla(fl_ctx *ctx, fl_value uzel, fl_value *result, fl_error *error);

/*
 * Функция flang «Значения полей при анализе».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param polya — «поля»: список: «Поле значения»
 * @return значение: список: «Значение»
 */
fl_status kompilyator_flang_znacheniya_poley_pri_analize(fl_ctx *ctx, fl_value polya, fl_value *result, fl_error *error);

/*
 * Функция flang «Связать привязку».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param sreda — «среда»: список: «Связка»
 * @param privyazka — «привязка»: «Значение»
 * @param proishozhdenie — «происхождение»: «Происхождение»
 * @return значение: список: «Связка»
 */
fl_status kompilyator_flang_svyazat_privyazku(fl_ctx *ctx, fl_value sreda, fl_value privyazka, fl_value proishozhdenie, fl_value *result, fl_error *error);

/*
 * Функция flang «Связать вариант при анализе».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param obrazec — «образец»: «Значение»
 * @param cel — «цель»: «Происхождение»
 * @param sreda — «среда»: список: «Связка»
 * @return значение: список: «Связка»
 */
fl_status kompilyator_flang_svyazat_variant_pri_analize(fl_ctx *ctx, fl_value obrazec, fl_value cel, fl_value sreda, fl_value *result, fl_error *error);

/*
 * Функция flang «Связать любое».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param obrazec — «образец»: «Значение»
 * @param cel — «цель»: «Происхождение»
 * @param sreda — «среда»: список: «Связка»
 * @return значение: список: «Связка»
 */
fl_status kompilyator_flang_svyazat_lyuboe(fl_ctx *ctx, fl_value obrazec, fl_value cel, fl_value sreda, fl_value *result, fl_error *error);

/*
 * Функция flang «Связать образец при анализе».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param obrazec — «образец»: «Значение»
 * @param cel — «цель»: «Происхождение»
 * @param sreda — «среда»: список: «Связка»
 * @return значение: список: «Связка»
 */
fl_status kompilyator_flang_svyazat_obrazec_pri_analize(fl_ctx *ctx, fl_value obrazec, fl_value cel, fl_value sreda, fl_value *result, fl_error *error);

/*
 * Функция flang «Пустой обход».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param vyzovy — «вызовы»: список: «Вызов»
 * @return значение: «Обход»
 */
fl_status kompilyator_flang_pustoy_obhod(fl_ctx *ctx, fl_value vyzovy, fl_value *result, fl_error *error);

/*
 * Функция flang «Номер разрушаемого».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param imya — «имя»: строка
 * @return значение: число
 */
fl_status kompilyator_flang_nomer_razrushaemogo(fl_ctx *ctx, fl_value imya, fl_value *result, fl_error *error);

/*
 * Функция flang «Аргумент разрушения».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * Хвостовой самовызов развёрнут в цикл: стек не растёт.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param argumenty — «аргументы»: список: «Аргумент»
 * @param nomer — «номер»: число
 * @return значение: «Происхождение»
 */
fl_status kompilyator_flang_argument_razrusheniya(fl_ctx *ctx, fl_value argumenty, fl_value nomer, fl_value *result, fl_error *error);

/*
 * Функция flang «Шаг аргумента при анализе».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param akk — «акк»: «Сбор аргументов»
 * @param uzel — «узел»: «Значение»
 * @param sreda — «среда»: список: «Связка»
 * @return значение: «Сбор аргументов»
 */
fl_status kompilyator_flang_shag_argumenta_pri_analize(fl_ctx *ctx, fl_value akk, fl_value uzel, fl_value sreda, fl_value *result, fl_error *error);

/*
 * Функция flang «Обойти аргументы».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param uzly — «узлы»: список: «Значение»
 * @param sreda — «среда»: список: «Связка»
 * @param vyzovy — «вызовы»: список: «Вызов»
 * @return значение: «Сбор аргументов»
 */
fl_status kompilyator_flang_oboyti_argumenty(fl_ctx *ctx, fl_value uzly, fl_value sreda, fl_value vyzovy, fl_value *result, fl_error *error);

/*
 * Функция flang «Шаг обхода».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param vyzovy — «вызовы»: список: «Вызов»
 * @param uzel — «узел»: «Значение»
 * @param sreda — «среда»: список: «Связка»
 * @return значение: список: «Вызов»
 */
fl_status kompilyator_flang_shag_obhoda(fl_ctx *ctx, fl_value vyzovy, fl_value uzel, fl_value sreda, fl_value *result, fl_error *error);

/*
 * Функция flang «Обойти поле».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param uzel — «узел»: «Значение»
 * @param sreda — «среда»: список: «Связка»
 * @param vyzovy — «вызовы»: список: «Вызов»
 * @return значение: «Обход»
 */
fl_status kompilyator_flang_oboyti_pole(fl_ctx *ctx, fl_value uzel, fl_value sreda, fl_value vyzovy, fl_value *result, fl_error *error);

/*
 * Функция flang «Обойти пусть».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Взаимная хвостовая рекурсия с «Обойти»: вызовы идут через батут.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param uzel — «узел»: «Значение»
 * @param sreda — «среда»: список: «Связка»
 * @param vyzovy — «вызовы»: список: «Вызов»
 * @return значение: «Обход»
 */
fl_status kompilyator_flang_oboyti_pust(fl_ctx *ctx, fl_value uzel, fl_value sreda, fl_value vyzovy, fl_value *result, fl_error *error);

/*
 * Функция flang «Обойти если».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param uzel — «узел»: «Значение»
 * @param sreda — «среда»: список: «Связка»
 * @param vyzovy — «вызовы»: список: «Вызов»
 * @return значение: «Обход»
 */
fl_status kompilyator_flang_oboyti_esli(fl_ctx *ctx, fl_value uzel, fl_value sreda, fl_value vyzovy, fl_value *result, fl_error *error);

/*
 * Функция flang «Обойти вызов».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param uzel — «узел»: «Значение»
 * @param sreda — «среда»: список: «Связка»
 * @param vyzovy — «вызовы»: список: «Вызов»
 * @return значение: «Обход»
 */
fl_status kompilyator_flang_oboyti_vyzov(fl_ctx *ctx, fl_value uzel, fl_value sreda, fl_value vyzovy, fl_value *result, fl_error *error);

/*
 * Функция flang «Обойти двучлен».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param uzel — «узел»: «Значение»
 * @param sreda — «среда»: список: «Связка»
 * @param vyzovy — «вызовы»: список: «Вызов»
 * @return значение: «Обход»
 */
fl_status kompilyator_flang_oboyti_dvuchlen(fl_ctx *ctx, fl_value uzel, fl_value sreda, fl_value vyzovy, fl_value *result, fl_error *error);

/*
 * Функция flang «Обойти поля».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param uzel — «узел»: «Значение»
 * @param sreda — «среда»: список: «Связка»
 * @param vyzovy — «вызовы»: список: «Вызов»
 * @return значение: «Обход»
 */
fl_status kompilyator_flang_oboyti_polya(fl_ctx *ctx, fl_value uzel, fl_value sreda, fl_value vyzovy, fl_value *result, fl_error *error);

/*
 * Функция flang «Обойти список».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param uzel — «узел»: «Значение»
 * @param sreda — «среда»: список: «Связка»
 * @param vyzovy — «вызовы»: список: «Вызов»
 * @return значение: «Обход»
 */
fl_status kompilyator_flang_oboyti_spisok(fl_ctx *ctx, fl_value uzel, fl_value sreda, fl_value vyzovy, fl_value *result, fl_error *error);

/*
 * Функция flang «Шаг ветви».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param akk — «акк»: «Слияние ветвей»
 * @param vetv — «ветвь»: «Значение»
 * @param sreda — «среда»: список: «Связка»
 * @param cel — «цель»: «Происхождение»
 * @return значение: «Слияние ветвей»
 */
fl_status kompilyator_flang_shag_vetvi(fl_ctx *ctx, fl_value akk, fl_value vetv, fl_value sreda, fl_value cel, fl_value *result, fl_error *error);

/*
 * Функция flang «Обойти разбор».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param uzel — «узел»: «Значение»
 * @param sreda — «среда»: список: «Связка»
 * @param vyzovy — «вызовы»: список: «Вызов»
 * @return значение: «Обход»
 */
fl_status kompilyator_flang_oboyti_razbor(fl_ctx *ctx, fl_value uzel, fl_value sreda, fl_value vyzovy, fl_value *result, fl_error *error);

/*
 * Функция flang «Обойти свёртку».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param uzel — «узел»: «Значение»
 * @param sreda — «среда»: список: «Связка»
 * @param vyzovy — «вызовы»: список: «Вызов»
 * @return значение: «Обход»
 */
fl_status kompilyator_flang_oboyti_svyortku(fl_ctx *ctx, fl_value uzel, fl_value sreda, fl_value vyzovy, fl_value *result, fl_error *error);

/*
 * Функция flang «Обойти отображение».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param uzel — «узел»: «Значение»
 * @param sreda — «среда»: список: «Связка»
 * @param vyzovy — «вызовы»: список: «Вызов»
 * @return значение: «Обход»
 */
fl_status kompilyator_flang_oboyti_otobrazhenie(fl_ctx *ctx, fl_value uzel, fl_value sreda, fl_value vyzovy, fl_value *result, fl_error *error);

/*
 * Функция flang «Обойти форму».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param uzel — «узел»: «Значение»
 * @param sreda — «среда»: список: «Связка»
 * @param vyzovy — «вызовы»: список: «Вызов»
 * @return значение: «Обход»
 */
fl_status kompilyator_flang_oboyti_formu(fl_ctx *ctx, fl_value uzel, fl_value sreda, fl_value vyzovy, fl_value *result, fl_error *error);

/*
 * Функция flang «Обойти».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Взаимная хвостовая рекурсия с «Обойти пусть»: вызовы идут через батут.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param uzel — «узел»: «Значение»
 * @param sreda — «среда»: список: «Связка»
 * @param vyzovy — «вызовы»: список: «Вызов»
 * @return значение: «Обход»
 */
fl_status kompilyator_flang_oboyti(fl_ctx *ctx, fl_value uzel, fl_value sreda, fl_value vyzovy, fl_value *result, fl_error *error);

/*
 * Функция flang «Обойти прочее».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param uzel — «узел»: «Значение»
 * @param sreda — «среда»: список: «Связка»
 * @param vyzovy — «вызовы»: список: «Вызов»
 * @param vid — «вид»: строка
 * @return значение: «Обход»
 */
fl_status kompilyator_flang_oboyti_prochee(fl_ctx *ctx, fl_value uzel, fl_value sreda, fl_value vyzovy, fl_value vid, fl_value *result, fl_error *error);

/*
 * Функция flang «Имя в узле».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param uzel — «узел»: «Значение»
 * @return значение: строка
 */
fl_status kompilyator_flang_imya_v_uzle(fl_ctx *ctx, fl_value uzel, fl_value *result, fl_error *error);

/*
 * Функция flang «Имя параметра из узла».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param uzel — «узел»: «Значение»
 * @return значение: «Имя параметра»
 */
fl_status kompilyator_flang_imya_parametra_iz_uzla(fl_ctx *ctx, fl_value uzel, fl_value *result, fl_error *error);

/*
 * Функция flang «Имена параметров при анализе».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param uzel — «узел»: «Значение»
 * @return значение: список: «Имя параметра»
 */
fl_status kompilyator_flang_imena_parametrov_pri_analize(fl_ctx *ctx, fl_value uzel, fl_value *result, fl_error *error);

/*
 * Функция flang «Имена описаний».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param opisaniya — «описания»: список: «Описание функции»
 * @return значение: список: строка
 */
fl_status kompilyator_flang_imena_opisaniy(fl_ctx *ctx, fl_value opisaniya, fl_value *result, fl_error *error);

/*
 * Функция flang «Описание».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param uzel — «узел»: «Значение»
 * @param imya — «имя»: строка
 * @param perechen — «перечень»: строка
 * @return значение: «Описание функции»
 */
fl_status kompilyator_flang_opisanie(fl_ctx *ctx, fl_value uzel, fl_value imya, fl_value perechen, fl_value *result, fl_error *error);

/*
 * Функция flang «Шаг описания».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param akk — «акк»: список: «Описание функции»
 * @param uzel — «узел»: «Значение»
 * @param perechen — «перечень»: строка
 * @return значение: список: «Описание функции»
 */
fl_status kompilyator_flang_shag_opisaniya(fl_ctx *ctx, fl_value akk, fl_value uzel, fl_value perechen, fl_value *result, fl_error *error);

/*
 * Функция flang «Добавить описание».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param akk — «акк»: список: «Описание функции»
 * @param uzel — «узел»: «Значение»
 * @param imya — «имя»: строка
 * @param perechen — «перечень»: строка
 * @return значение: список: «Описание функции»
 */
fl_status kompilyator_flang_dobavit_opisanie(fl_ctx *ctx, fl_value akk, fl_value uzel, fl_value imya, fl_value perechen, fl_value *result, fl_error *error);

/*
 * Функция flang «Описания функций».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param programma — «программа»: «Значение»
 * @return значение: список: «Описание функции»
 */
fl_status kompilyator_flang_opisaniya_funkciy(fl_ctx *ctx, fl_value programma, fl_value *result, fl_error *error);

/*
 * Функция flang «Шаг среды».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param akk — «акк»: «Сбор среды»
 * @param parametr — «параметр»: «Имя параметра»
 * @return значение: «Сбор среды»
 */
fl_status kompilyator_flang_shag_sredy(fl_ctx *ctx, fl_value akk, fl_value parametr, fl_value *result, fl_error *error);

/*
 * Функция flang «Среда параметров при анализе».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param parametry — «параметры»: список: «Имя параметра»
 * @return значение: список: «Связка»
 */
fl_status kompilyator_flang_sreda_parametrov_pri_analize(fl_ctx *ctx, fl_value parametry, fl_value *result, fl_error *error);

/*
 * Функция flang «Пометить вызов».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param vyzov — «вызов»: «Вызов»
 * @param opisanie — «описание»: «Описание функции»
 * @return значение: «Вызов»
 */
fl_status kompilyator_flang_pometit_vyzov(fl_ctx *ctx, fl_value vyzov, fl_value opisanie, fl_value *result, fl_error *error);

/*
 * Функция flang «Вызовы функции».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param vyzovy — «вызовы»: список: «Вызов»
 * @param opisanie — «описание»: «Описание функции»
 * @return значение: список: «Вызов»
 */
fl_status kompilyator_flang_vyzovy_funkcii(fl_ctx *ctx, fl_value vyzovy, fl_value opisanie, fl_value *result, fl_error *error);

/*
 * Функция flang «Все вызовы при анализе».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param opisaniya — «описания»: список: «Описание функции»
 * @return значение: список: «Вызов»
 */
fl_status kompilyator_flang_vse_vyzovy_pri_analize(fl_ctx *ctx, fl_value opisaniya, fl_value *result, fl_error *error);

/*
 * Функция flang «В ёлочках при анализе».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param tekst — «текст»: строка
 * @return значение: строка
 */
fl_status kompilyator_flang_v_yolochkah_pri_analize(fl_ctx *ctx, fl_value tekst, fl_value *result, fl_error *error);

/*
 * Функция flang «Как в JS при анализе».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param uzel — «узел»: «Значение»
 * @param v_spiske — «в списке»
 * @return значение: строка
 */
fl_status kompilyator_flang_kak_v_js_pri_analize(fl_ctx *ctx, fl_value uzel, fl_value v_spiske, fl_value *result, fl_error *error);

/*
 * Функция flang «Скаляр как в JS при анализе».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param skalyar — «скаляр»: «Скаляр»
 * @param v_spiske — «в списке»
 * @return значение: строка
 */
fl_status kompilyator_flang_skalyar_kak_v_js_pri_analize(fl_ctx *ctx, fl_value skalyar, fl_value v_spiske, fl_value *result, fl_error *error);

/*
 * Функция flang «Признак как в JS».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param znachenie — «значение»
 * @return значение: строка
 */
fl_status kompilyator_flang_priznak_kak_v_js(fl_ctx *ctx, fl_value znachenie, fl_value *result, fl_error *error);

/*
 * Функция flang «Ничто как в JS».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param v_spiske — «в списке»
 * @return значение: строка
 */
fl_status kompilyator_flang_nichto_kak_v_js(fl_ctx *ctx, fl_value v_spiske, fl_value *result, fl_error *error);

/*
 * Функция flang «Как строка поля».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param uzel — «узел»: «Значение»
 * @param klyuch — «ключ»: строка
 * @return значение: строка
 */
fl_status kompilyator_flang_kak_stroka_polya(fl_ctx *ctx, fl_value uzel, fl_value klyuch, fl_value *result, fl_error *error);

/*
 * Функция flang «Описание аргументов».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param uzly — «узлы»: список: «Значение»
 * @return значение: строка
 */
fl_status kompilyator_flang_opisanie_argumentov(fl_ctx *ctx, fl_value uzly, fl_value *result, fl_error *error);

/*
 * Функция flang «Описание вызова».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param uzel — «узел»: «Значение»
 * @return значение: строка
 */
fl_status kompilyator_flang_opisanie_vyzova(fl_ctx *ctx, fl_value uzel, fl_value *result, fl_error *error);

/*
 * Функция flang «Описание формы».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param uzel — «узел»: «Значение»
 * @return значение: строка
 */
fl_status kompilyator_flang_opisanie_formy(fl_ctx *ctx, fl_value uzel, fl_value *result, fl_error *error);

/*
 * Функция flang «Описание доступа».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param uzel — «узел»: «Значение»
 * @return значение: строка
 */
fl_status kompilyator_flang_opisanie_dostupa(fl_ctx *ctx, fl_value uzel, fl_value *result, fl_error *error);

/*
 * Функция flang «Описание двучлена».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param uzel — «узел»: «Значение»
 * @return значение: строка
 */
fl_status kompilyator_flang_opisanie_dvuchlena(fl_ctx *ctx, fl_value uzel, fl_value *result, fl_error *error);

/*
 * Функция flang «Описание записи».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param uzel — «узел»: «Значение»
 * @return значение: строка
 */
fl_status kompilyator_flang_opisanie_zapisi(fl_ctx *ctx, fl_value uzel, fl_value *result, fl_error *error);

/*
 * Функция flang «Описание конструктора».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param uzel — «узел»: «Значение»
 * @return значение: строка
 */
fl_status kompilyator_flang_opisanie_konstruktora(fl_ctx *ctx, fl_value uzel, fl_value *result, fl_error *error);

/*
 * Функция flang «Описание связывания».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param uzel — «узел»: «Значение»
 * @return значение: строка
 */
fl_status kompilyator_flang_opisanie_svyazyvaniya(fl_ctx *ctx, fl_value uzel, fl_value *result, fl_error *error);

/*
 * Функция flang «Описание по виду».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param uzel — «узел»: «Значение»
 * @param vid — «вид»: строка
 * @return значение: строка
 */
fl_status kompilyator_flang_opisanie_po_vidu(fl_ctx *ctx, fl_value uzel, fl_value vid, fl_value *result, fl_error *error);

/*
 * Функция flang «Описание по виду дальше».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param uzel — «узел»: «Значение»
 * @param vid — «вид»: строка
 * @return значение: строка
 */
fl_status kompilyator_flang_opisanie_po_vidu_dalshe(fl_ctx *ctx, fl_value uzel, fl_value vid, fl_value *result, fl_error *error);

/*
 * Функция flang «Описание выражения».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param uzel — «узел»: «Значение»
 * @return значение: строка
 */
fl_status kompilyator_flang_opisanie_vyrazheniya(fl_ctx *ctx, fl_value uzel, fl_value *result, fl_error *error);

/*
 * Функция flang «Описание не выражения».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param uzel — «узел»: «Значение»
 * @return значение: строка
 */
fl_status kompilyator_flang_opisanie_ne_vyrazheniya(fl_ctx *ctx, fl_value uzel, fl_value *result, fl_error *error);

/*
 * Функция flang «Диагностика узла».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param soobschenie — «сообщение»: строка
 * @param uzel — «узел»: «Значение»
 * @return значение: «Диагностика анализа»
 */
fl_status kompilyator_flang_diagnostika_uzla(fl_ctx *ctx, fl_value soobschenie, fl_value uzel, fl_value *result, fl_error *error);

/*
 * Функция flang «Сообщение о неизвестной».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param vyzov — «вызов»: «Вызов»
 * @return значение: строка
 */
fl_status kompilyator_flang_soobschenie_o_neizvestnoy(fl_ctx *ctx, fl_value vyzov, fl_value *result, fl_error *error);

/*
 * Функция flang «Сообщение об обычной».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param vyzov — «вызов»: «Вызов»
 * @return значение: строка
 */
fl_status kompilyator_flang_soobschenie_ob_obychnoy(fl_ctx *ctx, fl_value vyzov, fl_value *result, fl_error *error);

/*
 * Функция flang «Цепочка имён».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param imena — «имена»: список: строка
 * @return значение: строка
 */
fl_status kompilyator_flang_cepochka_imyon(fl_ctx *ctx, fl_value imena, fl_value *result, fl_error *error);

/*
 * Функция flang «Имя по номеру».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param parametry — «параметры»: список: «Имя параметра»
 * @param indeks — «индекс»: число
 * @return значение: «Имя параметра»
 */
fl_status kompilyator_flang_imya_po_nomeru(fl_ctx *ctx, fl_value parametry, fl_value indeks, fl_value *result, fl_error *error);

/*
 * Функция flang «Шаг отбора имени».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param akk — «акк»: «Отбор имени»
 * @param parametr — «параметр»: «Имя параметра»
 * @param iskomyy — «искомый»: число
 * @return значение: «Отбор имени»
 */
fl_status kompilyator_flang_shag_otbora_imeni(fl_ctx *ctx, fl_value akk, fl_value parametr, fl_value iskomyy, fl_value *result, fl_error *error);

/*
 * Функция flang «Параметр или».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param parametry — «параметры»: список: «Имя параметра»
 * @param indeks — «индекс»: число
 * @param zapasnoe — «запасное»: строка
 * @return значение: строка
 */
fl_status kompilyator_flang_parametr_ili(fl_ctx *ctx, fl_value parametry, fl_value indeks, fl_value zapasnoe, fl_value *result, fl_error *error);

/*
 * Функция flang «Метка аргумента».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param rebro — «ребро»: «Вызов»
 * @param poziciya — «позиция»: число
 * @return значение: строка
 */
fl_status kompilyator_flang_metka_argumenta(fl_ctx *ctx, fl_value rebro, fl_value poziciya, fl_value *result, fl_error *error);

/*
 * Функция flang «Причина не выведена».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param nomer — «номер»: число
 * @param pokazano — «показано»: строка
 * @return значение: строка
 */
fl_status kompilyator_flang_prichina_ne_vyvedena(fl_ctx *ctx, fl_value nomer, fl_value pokazano, fl_value *result, fl_error *error);

/*
 * Функция flang «Причина чужой позиции».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param proishozhdenie — «происхождение»: «Происхождение»
 * @param indeks — «индекс»: число
 * @param nomer — «номер»: число
 * @param pokazano — «показано»: строка
 * @param parametry — «параметры»: список: «Имя параметра»
 * @return значение: строка
 */
fl_status kompilyator_flang_prichina_chuzhoy_pozicii(fl_ctx *ctx, fl_value proishozhdenie, fl_value indeks, fl_value nomer, fl_value pokazano, fl_value parametry, fl_value *result, fl_error *error);

/*
 * Функция flang «Слово выведения».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param proishozhdenie — «происхождение»: «Происхождение»
 * @return значение: строка
 */
fl_status kompilyator_flang_slovo_vyvedeniya(fl_ctx *ctx, fl_value proishozhdenie, fl_value *result, fl_error *error);

/*
 * Функция flang «Причина своей позиции».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param proishozhdenie — «происхождение»: «Происхождение»
 * @param nomer — «номер»: число
 * @param pokazano — «показано»: строка
 * @param parametry — «параметры»: список: «Имя параметра»
 * @return значение: строка
 */
fl_status kompilyator_flang_prichina_svoey_pozicii(fl_ctx *ctx, fl_value proishozhdenie, fl_value nomer, fl_value pokazano, fl_value parametry, fl_value *result, fl_error *error);

/*
 * Функция flang «Причина части».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param proishozhdenie — «происхождение»: «Происхождение»
 * @param nomer — «номер»: число
 * @param pokazano — «показано»: строка
 * @return значение: строка
 */
fl_status kompilyator_flang_prichina_chasti(fl_ctx *ctx, fl_value proishozhdenie, fl_value nomer, fl_value pokazano, fl_value *result, fl_error *error);

/*
 * Функция flang «Причина меры».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param proishozhdenie — «происхождение»: «Происхождение»
 * @param nomer — «номер»: число
 * @param pokazano — «показано»: строка
 * @param parametry — «параметры»: список: «Имя параметра»
 * @return значение: строка
 */
fl_status kompilyator_flang_prichina_mery(fl_ctx *ctx, fl_value proishozhdenie, fl_value nomer, fl_value pokazano, fl_value parametry, fl_value *result, fl_error *error);

/*
 * Функция flang «Причина шага параметром».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param proishozhdenie — «происхождение»: «Происхождение»
 * @param nomer — «номер»: число
 * @param pokazano — «показано»: строка
 * @param parametry — «параметры»: список: «Имя параметра»
 * @return значение: строка
 */
fl_status kompilyator_flang_prichina_shaga_parametrom(fl_ctx *ctx, fl_value proishozhdenie, fl_value nomer, fl_value pokazano, fl_value parametry, fl_value *result, fl_error *error);

/*
 * Функция flang «Причина шага числом».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param proishozhdenie — «происхождение»: «Происхождение»
 * @param nomer — «номер»: число
 * @param pokazano — «показано»: строка
 * @return значение: строка
 */
fl_status kompilyator_flang_prichina_shaga_chislom(fl_ctx *ctx, fl_value proishozhdenie, fl_value nomer, fl_value pokazano, fl_value *result, fl_error *error);

/*
 * Функция flang «Причина убывающей меры».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param proishozhdenie — «происхождение»: «Происхождение»
 * @param nomer — «номер»: число
 * @param pokazano — «показано»: строка
 * @return значение: строка
 */
fl_status kompilyator_flang_prichina_ubyvayuschey_mery(fl_ctx *ctx, fl_value proishozhdenie, fl_value nomer, fl_value pokazano, fl_value *result, fl_error *error);

/*
 * Функция flang «Причина неубывающей меры».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param proishozhdenie — «происхождение»: «Происхождение»
 * @param nomer — «номер»: число
 * @param pokazano — «показано»: строка
 * @return значение: строка
 */
fl_status kompilyator_flang_prichina_neubyvayuschey_mery(fl_ctx *ctx, fl_value proishozhdenie, fl_value nomer, fl_value pokazano, fl_value *result, fl_error *error);

/*
 * Функция flang «Причина известного».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param proishozhdenie — «происхождение»: «Происхождение»
 * @param indeks — «индекс»: число
 * @param nomer — «номер»: число
 * @param pokazano — «показано»: строка
 * @param parametry — «параметры»: список: «Имя параметра»
 * @return значение: строка
 */
fl_status kompilyator_flang_prichina_izvestnogo(fl_ctx *ctx, fl_value proishozhdenie, fl_value indeks, fl_value nomer, fl_value pokazano, fl_value parametry, fl_value *result, fl_error *error);

/*
 * Функция flang «Причина аргумента».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param argument — «аргумент»: «Аргумент»
 * @param indeks — «индекс»: число
 * @param parametry — «параметры»: список: «Имя параметра»
 * @return значение: строка
 */
fl_status kompilyator_flang_prichina_argumenta(fl_ctx *ctx, fl_value argument, fl_value indeks, fl_value parametry, fl_value *result, fl_error *error);

/*
 * Функция flang «Шаг причины».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param akk — «акк»: «Сбор причин»
 * @param argument — «аргумент»: «Аргумент»
 * @param parametry — «параметры»: список: «Имя параметра»
 * @return значение: «Сбор причин»
 */
fl_status kompilyator_flang_shag_prichiny(fl_ctx *ctx, fl_value akk, fl_value argument, fl_value parametry, fl_value *result, fl_error *error);

/*
 * Функция flang «Причины ребра».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param rebro — «ребро»: «Вызов»
 * @return значение: список: строка
 */
fl_status kompilyator_flang_prichiny_rebra(fl_ctx *ctx, fl_value rebro, fl_value *result, fl_error *error);

/*
 * Функция flang «Перечень причин».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param prichiny — «причины»: список: строка
 * @return значение: строка
 */
fl_status kompilyator_flang_perechen_prichin(fl_ctx *ctx, fl_value prichiny, fl_value *result, fl_error *error);

/*
 * Функция flang «Описание цикла».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param rebro — «ребро»: «Вызов»
 * @param imena — «имена»: список: строка
 * @return значение: строка
 */
fl_status kompilyator_flang_opisanie_cikla(fl_ctx *ctx, fl_value rebro, fl_value imena, fl_value *result, fl_error *error);

/*
 * Функция flang «Сообщение о неубывании».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param rebro — «ребро»: «Вызов»
 * @param imena — «имена»: список: строка
 * @return значение: строка
 */
fl_status kompilyator_flang_soobschenie_o_neubyvanii(fl_ctx *ctx, fl_value rebro, fl_value imena, fl_value *result, fl_error *error);

/*
 * Функция flang «Описание оценки».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param ocenka — «оценка»: «Оценка»
 * @return значение: строка
 */
fl_status kompilyator_flang_opisanie_ocenki(fl_ctx *ctx, fl_value ocenka, fl_value *result, fl_error *error);

/*
 * Функция flang «Сообщение о разных позициях».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param imena — «имена»: список: строка
 * @param ocenki — «оценки»: список: «Оценка»
 * @return значение: строка
 */
fl_status kompilyator_flang_soobschenie_o_raznyh_poziciyah(fl_ctx *ctx, fl_value imena, fl_value ocenki, fl_value *result, fl_error *error);

/*
 * Функция flang «Точные имена типа».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @return значение: строка
 */
fl_status kompilyator_flang_tochnye_imena_tipa(fl_ctx *ctx, fl_value *result, fl_error *error);

/*
 * Функция flang «Слово в перечне при анализе».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param perechen — «перечень»: строка
 * @param slovo — «слово»: строка
 * @return значение
 */
fl_status kompilyator_flang_slovo_v_perechne_pri_analize(fl_ctx *ctx, fl_value perechen, fl_value slovo, fl_value *result, fl_error *error);

/*
 * Функция flang «Точное имя типа».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param tip — «тип»: «Значение»
 * @param perechen — «перечень»: строка
 * @return значение
 */
fl_status kompilyator_flang_tochnoe_imya_tipa(fl_ctx *ctx, fl_value tip, fl_value perechen, fl_value *result, fl_error *error);

/*
 * Функция flang «Точное имя без пометки».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param tip — «тип»: «Значение»
 * @param perechen — «перечень»: строка
 * @return значение
 */
fl_status kompilyator_flang_tochnoe_imya_bez_pometki(fl_ctx *ctx, fl_value tip, fl_value perechen, fl_value *result, fl_error *error);

/*
 * Функция flang «Замыкание псевдонимов».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * Хвостовой самовызов развёрнут в цикл: стек не растёт.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param psevdonimy — «псевдонимы»: список: «Значение»
 * @param perechen — «перечень»: строка
 * @param toplivo — «топливо»: список: «Значение»
 * @return значение: строка
 */
fl_status kompilyator_flang_zamykanie_psevdonimov(fl_ctx *ctx, fl_value psevdonimy, fl_value perechen, fl_value toplivo, fl_value *result, fl_error *error);

/*
 * Функция flang «Проход по псевдонимам».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param psevdonimy — «псевдонимы»: список: «Значение»
 * @param perechen — «перечень»: строка
 * @return значение: строка
 */
fl_status kompilyator_flang_prohod_po_psevdonimam(fl_ctx *ctx, fl_value psevdonimy, fl_value perechen, fl_value *result, fl_error *error);

/*
 * Функция flang «Шаг псевдонима».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param perechen — «перечень»: строка
 * @param psevdonim — «псевдоним»: «Значение»
 * @return значение: строка
 */
fl_status kompilyator_flang_shag_psevdonima(fl_ctx *ctx, fl_value perechen, fl_value psevdonim, fl_value *result, fl_error *error);

/*
 * Функция flang «Дописать имя в перечень».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param perechen — «перечень»: строка
 * @param imya — «имя»: строка
 * @return значение: строка
 */
fl_status kompilyator_flang_dopisat_imya_v_perechen(fl_ctx *ctx, fl_value perechen, fl_value imya, fl_value *result, fl_error *error);

/*
 * Функция flang «Точные имена программы».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param programma — «программа»: «Значение»
 * @return значение: строка
 */
fl_status kompilyator_flang_tochnye_imena_programmy(fl_ctx *ctx, fl_value programma, fl_value *result, fl_error *error);

/*
 * Функция flang «Точные позиции узла».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param uzel — «узел»: «Значение»
 * @param perechen — «перечень»: строка
 * @return значение: список: число
 */
fl_status kompilyator_flang_tochnye_pozicii_uzla(fl_ctx *ctx, fl_value uzel, fl_value perechen, fl_value *result, fl_error *error);

/*
 * Функция flang «Шаг точной позиции».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param akk — «акк»: «Сбор точных»
 * @param parametr — «параметр»: «Значение»
 * @param perechen — «перечень»: строка
 * @return значение: «Сбор точных»
 */
fl_status kompilyator_flang_shag_tochnoy_pozicii(fl_ctx *ctx, fl_value akk, fl_value parametr, fl_value perechen, fl_value *result, fl_error *error);

/*
 * Функция flang «Точные позиции имени».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param opisaniya — «описания»: список: «Описание функции»
 * @param imya — «имя»: строка
 * @return значение: список: число
 */
fl_status kompilyator_flang_tochnye_pozicii_imeni(fl_ctx *ctx, fl_value opisaniya, fl_value imya, fl_value *result, fl_error *error);

/*
 * Функция flang «Число параметров при анализе».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param opisaniya — «описания»: список: «Описание функции»
 * @param imya — «имя»: строка
 * @return значение: число
 */
fl_status kompilyator_flang_chislo_parametrov_pri_analize(fl_ctx *ctx, fl_value opisaniya, fl_value imya, fl_value *result, fl_error *error);

/*
 * Функция flang «Добавить отказ».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param otkazy — «отказы»: список: строка
 * @param imya — «имя»: строка
 * @return значение: список: строка
 */
fl_status kompilyator_flang_dobavit_otkaz(fl_ctx *ctx, fl_value otkazy, fl_value imya, fl_value *result, fl_error *error);

/*
 * Функция flang «Слить отказы».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param otkazy — «отказы»: список: строка
 * @param imena — «имена»: список: строка
 * @return значение: список: строка
 */
fl_status kompilyator_flang_slit_otkazy(fl_ctx *ctx, fl_value otkazy, fl_value imena, fl_value *result, fl_error *error);

/*
 * Функция flang «Не отказ».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param otkazy — «отказы»: список: строка
 * @param imya — «имя»: строка
 * @return значение
 */
fl_status kompilyator_flang_ne_otkaz(fl_ctx *ctx, fl_value otkazy, fl_value imya, fl_value *result, fl_error *error);

/*
 * Функция flang «Отвергнуть неизвестную».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param akk — «акк»: «Разложение вызовов»
 * @param vyzov — «вызов»: «Вызов»
 * @return значение: «Разложение вызовов»
 */
fl_status kompilyator_flang_otvergnut_neizvestnuyu(fl_ctx *ctx, fl_value akk, fl_value vyzov, fl_value *result, fl_error *error);

/*
 * Функция flang «Отвергнуть обычную».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param akk — «акк»: «Разложение вызовов»
 * @param vyzov — «вызов»: «Вызов»
 * @return значение: «Разложение вызовов»
 */
fl_status kompilyator_flang_otvergnut_obychnuyu(fl_ctx *ctx, fl_value akk, fl_value vyzov, fl_value *result, fl_error *error);

/*
 * Функция flang «Добавить ребро».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param akk — «акк»: «Разложение вызовов»
 * @param vyzov — «вызов»: «Вызов»
 * @param opisaniya — «описания»: список: «Описание функции»
 * @return значение: «Разложение вызовов»
 */
fl_status kompilyator_flang_dobavit_rebro(fl_ctx *ctx, fl_value akk, fl_value vyzov, fl_value opisaniya, fl_value *result, fl_error *error);

/*
 * Функция flang «Шаг известного».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param akk — «акк»: «Разложение вызовов»
 * @param vyzov — «вызов»: «Вызов»
 * @param opisaniya — «описания»: список: «Описание функции»
 * @param totalnye — «тотальные»: список: строка
 * @return значение: «Разложение вызовов»
 */
fl_status kompilyator_flang_shag_izvestnogo(fl_ctx *ctx, fl_value akk, fl_value vyzov, fl_value opisaniya, fl_value totalnye, fl_value *result, fl_error *error);

/*
 * Функция flang «Шаг разложения».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param akk — «акк»: «Разложение вызовов»
 * @param vyzov — «вызов»: «Вызов»
 * @param opisaniya — «описания»: список: «Описание функции»
 * @param imena — «имена»: список: строка
 * @param totalnye — «тотальные»: список: строка
 * @return значение: «Разложение вызовов»
 */
fl_status kompilyator_flang_shag_razlozheniya(fl_ctx *ctx, fl_value akk, fl_value vyzov, fl_value opisaniya, fl_value imena, fl_value totalnye, fl_value *result, fl_error *error);

/*
 * Функция flang «Разложить вызовы».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param vyzovy — «вызовы»: список: «Вызов»
 * @param opisaniya — «описания»: список: «Описание функции»
 * @param imena — «имена»: список: строка
 * @param totalnye — «тотальные»: список: строка
 * @return значение: «Разложение вызовов»
 */
fl_status kompilyator_flang_razlozhit_vyzovy(fl_ctx *ctx, fl_value vyzovy, fl_value opisaniya, fl_value imena, fl_value totalnye, fl_value *result, fl_error *error);

/*
 * Функция flang «Цели имени».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param ryobra — «рёбра»: список: «Вызов»
 * @param imya — «имя»: строка
 * @return значение: список: строка
 */
fl_status kompilyator_flang_celi_imeni(fl_ctx *ctx, fl_value ryobra, fl_value imya, fl_value *result, fl_error *error);

/*
 * Функция flang «Дуги».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param imena — «имена»: список: строка
 * @param ryobra — «рёбра»: список: «Вызов»
 * @return значение: список: «Рёбра»
 */
fl_status kompilyator_flang_dugi(fl_ctx *ctx, fl_value imena, fl_value ryobra, fl_value *result, fl_error *error);

/*
 * Функция flang «Первое имя».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param imena — «имена»: список: строка
 * @return значение: строка
 */
fl_status kompilyator_flang_pervoe_imya(fl_ctx *ctx, fl_value imena, fl_value *result, fl_error *error);

/*
 * Функция flang «Члены компоненты при анализе».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param syrye — «сырые»: список: «Компонента»
 * @param imya — «имя»: строка
 * @return значение: список: строка
 */
fl_status kompilyator_flang_chleny_komponenty_pri_analize(fl_ctx *ctx, fl_value syrye, fl_value imya, fl_value *result, fl_error *error);

/*
 * Функция flang «Шаг компоненты».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param akk — «акк»: список: «Компонента»
 * @param imya — «имя»: строка
 * @param imena — «имена»: список: строка
 * @param syrye — «сырые»: список: «Компонента»
 * @return значение: список: «Компонента»
 */
fl_status kompilyator_flang_shag_komponenty(fl_ctx *ctx, fl_value akk, fl_value imya, fl_value imena, fl_value syrye, fl_value *result, fl_error *error);

/*
 * Функция flang «Упорядоченные компоненты».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param imena — «имена»: список: строка
 * @param ryobra — «рёбра»: список: «Вызов»
 * @return значение: список: «Компонента»
 */
fl_status kompilyator_flang_uporyadochennye_komponenty(fl_ctx *ctx, fl_value imena, fl_value ryobra, fl_value *result, fl_error *error);

/*
 * Функция flang «Не убывает».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @return значение: «Способ»
 */
fl_status kompilyator_flang_ne_ubyvaet(fl_ctx *ctx, fl_value *result, fl_error *error);

/*
 * Функция flang «Как убывает».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param proishozhdenie — «происхождение»: «Происхождение»
 * @param indeks — «индекс»: число
 * @param rebro — «ребро»: «Вызов»
 * @return значение: «Способ»
 */
fl_status kompilyator_flang_kak_ubyvaet(fl_ctx *ctx, fl_value proishozhdenie, fl_value indeks, fl_value rebro, fl_value *result, fl_error *error);

/*
 * Функция flang «Как убывает известное».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param proishozhdenie — «происхождение»: «Происхождение»
 * @param indeks — «индекс»: число
 * @param rebro — «ребро»: «Вызов»
 * @return значение: «Способ»
 */
fl_status kompilyator_flang_kak_ubyvaet_izvestnoe(fl_ctx *ctx, fl_value proishozhdenie, fl_value indeks, fl_value rebro, fl_value *result, fl_error *error);

/*
 * Функция flang «Как убывает на своей позиции».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param proishozhdenie — «происхождение»: «Происхождение»
 * @param indeks — «индекс»: число
 * @param rebro — «ребро»: «Вызов»
 * @return значение: «Способ»
 */
fl_status kompilyator_flang_kak_ubyvaet_na_svoey_pozicii(fl_ctx *ctx, fl_value proishozhdenie, fl_value indeks, fl_value rebro, fl_value *result, fl_error *error);

/*
 * Функция flang «Способ по происхождению».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param proishozhdenie — «происхождение»: «Происхождение»
 * @param indeks — «индекс»: число
 * @param rebro — «ребро»: «Вызов»
 * @return значение: «Способ»
 */
fl_status kompilyator_flang_sposob_po_proishozhdeniyu(fl_ctx *ctx, fl_value proishozhdenie, fl_value indeks, fl_value rebro, fl_value *result, fl_error *error);

/*
 * Функция flang «Часть убывает».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param proishozhdenie — «происхождение»: «Происхождение»
 * @return значение
 */
fl_status kompilyator_flang_chast_ubyvaet(fl_ctx *ctx, fl_value proishozhdenie, fl_value *result, fl_error *error);

/*
 * Функция flang «Глубина не меньше одного».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param glubina — «глубина»: число
 * @return значение
 */
fl_status kompilyator_flang_glubina_ne_menshe_odnogo(fl_ctx *ctx, fl_value glubina, fl_value *result, fl_error *error);

/*
 * Функция flang «Способ меры».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param proishozhdenie — «происхождение»: «Происхождение»
 * @param indeks — «индекс»: число
 * @param rebro — «ребро»: «Вызов»
 * @return значение: «Способ»
 */
fl_status kompilyator_flang_sposob_mery(fl_ctx *ctx, fl_value proishozhdenie, fl_value indeks, fl_value rebro, fl_value *result, fl_error *error);

/*
 * Функция flang «Способ видимой меры».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param indeks — «индекс»: число
 * @param rebro — «ребро»: «Вызов»
 * @return значение: «Способ»
 */
fl_status kompilyator_flang_sposob_vidimoy_mery(fl_ctx *ctx, fl_value indeks, fl_value rebro, fl_value *result, fl_error *error);

/*
 * Функция flang «Мера убывает».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param proishozhdenie — «происхождение»: «Происхождение»
 * @param rebro — «ребро»: «Вызов»
 * @return значение
 */
fl_status kompilyator_flang_mera_ubyvaet(fl_ctx *ctx, fl_value proishozhdenie, fl_value rebro, fl_value *result, fl_error *error);

/*
 * Функция flang «Есть дно и шаг».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param proishozhdenie — «происхождение»: «Происхождение»
 * @param rebro — «ребро»: «Вызов»
 * @return значение
 */
fl_status kompilyator_flang_est_dno_i_shag(fl_ctx *ctx, fl_value proishozhdenie, fl_value rebro, fl_value *result, fl_error *error);

/*
 * Функция flang «Шаг уводит вниз».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param proishozhdenie — «происхождение»: «Происхождение»
 * @param rebro — «ребро»: «Вызов»
 * @return значение
 */
fl_status kompilyator_flang_shag_uvodit_vniz(fl_ctx *ctx, fl_value proishozhdenie, fl_value rebro, fl_value *result, fl_error *error);

/*
 * Функция flang «Шаг вниз».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param shag — «шаг»: число
 * @return значение
 */
fl_status kompilyator_flang_shag_vniz(fl_ctx *ctx, fl_value shag, fl_value *result, fl_error *error);

/*
 * Функция flang «Шаг параметра годится».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param proishozhdenie — «происхождение»: «Происхождение»
 * @param rebro — «ребро»: «Вызов»
 * @return значение
 */
fl_status kompilyator_flang_shag_parametra_goditsya(fl_ctx *ctx, fl_value proishozhdenie, fl_value rebro, fl_value *result, fl_error *error);

/*
 * Функция flang «Шаг неизменен».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param rebro — «ребро»: «Вызов»
 * @param kotoryy — «который»: число
 * @return значение
 */
fl_status kompilyator_flang_shag_neizmenen(fl_ctx *ctx, fl_value rebro, fl_value kotoryy, fl_value *result, fl_error *error);

/*
 * Функция flang «Шаг на своём месте».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param argument — «аргумент»: «Может быть аргумент»
 * @param kotoryy — «который»: число
 * @return значение
 */
fl_status kompilyator_flang_shag_na_svoyom_meste(fl_ctx *ctx, fl_value argument, fl_value kotoryy, fl_value *result, fl_error *error);

/*
 * Функция flang «Положительный сам параметр».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param proishozhdenie — «происхождение»: «Происхождение»
 * @param kotoryy — «который»: число
 * @return значение
 */
fl_status kompilyator_flang_polozhitelnyy_sam_parametr(fl_ctx *ctx, fl_value proishozhdenie, fl_value kotoryy, fl_value *result, fl_error *error);

/*
 * Функция flang «Аргумент по номеру при анализе».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param argumenty — «аргументы»: список: «Аргумент»
 * @param kotoryy — «который»: число
 * @return значение: «Может быть аргумент»
 */
fl_status kompilyator_flang_argument_po_nomeru_pri_analize(fl_ctx *ctx, fl_value argumenty, fl_value kotoryy, fl_value *result, fl_error *error);

/*
 * Функция flang «Шаг отбора аргумента».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param akk — «акк»: «Отбор аргумента»
 * @param argument — «аргумент»: «Аргумент»
 * @param iskomyy — «искомый»: число
 * @return значение: «Отбор аргумента»
 */
fl_status kompilyator_flang_shag_otbora_argumenta(fl_ctx *ctx, fl_value akk, fl_value argument, fl_value iskomyy, fl_value *result, fl_error *error);

/*
 * Функция flang «Имя видно».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param rebro — «ребро»: «Вызов»
 * @param indeks — «индекс»: число
 * @return значение
 */
fl_status kompilyator_flang_imya_vidno(fl_ctx *ctx, fl_value rebro, fl_value indeks, fl_value *result, fl_error *error);

/*
 * Функция flang «Имя означает параметр».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param proishozhdenie — «происхождение»: «Происхождение»
 * @param indeks — «индекс»: число
 * @return значение
 */
fl_status kompilyator_flang_imya_oznachaet_parametr(fl_ctx *ctx, fl_value proishozhdenie, fl_value indeks, fl_value *result, fl_error *error);

/*
 * Функция flang «Позиция в пределах».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param indeks — «индекс»: число
 * @param predel — «предел»: число
 * @return значение
 */
fl_status kompilyator_flang_poziciya_v_predelah(fl_ctx *ctx, fl_value indeks, fl_value predel, fl_value *result, fl_error *error);

/*
 * Функция flang «Шаг позиции».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param akk — «акк»: «Сбор позиций»
 * @param argument — «аргумент»: «Аргумент»
 * @param rebro — «ребро»: «Вызов»
 * @return значение: «Сбор позиций»
 */
fl_status kompilyator_flang_shag_pozicii(fl_ctx *ctx, fl_value akk, fl_value argument, fl_value rebro, fl_value *result, fl_error *error);

/*
 * Функция flang «Позиции убывания».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param rebro — «ребро»: «Вызов»
 * @return значение: список: «Позиция убывания»
 */
fl_status kompilyator_flang_pozicii_ubyvaniya(fl_ctx *ctx, fl_value rebro, fl_value *result, fl_error *error);

/*
 * Функция flang «Ребро внутри имён».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param rebro — «ребро»: «Вызов»
 * @param imena — «имена»: список: строка
 * @return значение
 */
fl_status kompilyator_flang_rebro_vnutri_imyon(fl_ctx *ctx, fl_value rebro, fl_value imena, fl_value *result, fl_error *error);

/*
 * Функция flang «Имена содержат».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param imena — «имена»: список: строка
 * @param imya — «имя»: строка
 * @return значение
 */
fl_status kompilyator_flang_imena_soderzhat(fl_ctx *ctx, fl_value imena, fl_value imya, fl_value *result, fl_error *error);

/*
 * Функция flang «Та же позиция».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param pervaya — «первая»: «Позиция убывания»
 * @param vtoraya — «вторая»: «Позиция убывания»
 * @return значение
 */
fl_status kompilyator_flang_ta_zhe_poziciya(fl_ctx *ctx, fl_value pervaya, fl_value vtoraya, fl_value *result, fl_error *error);

/*
 * Функция flang «Нет позиции».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param pozicii — «позиции»: список: «Позиция убывания»
 * @param poziciya — «позиция»: «Позиция убывания»
 * @return значение
 */
fl_status kompilyator_flang_net_pozicii(fl_ctx *ctx, fl_value pozicii, fl_value poziciya, fl_value *result, fl_error *error);

/*
 * Функция flang «Во всех оценках».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param poziciya — «позиция»: «Позиция убывания»
 * @param ocenki — «оценки»: список: «Оценка»
 * @return значение
 */
fl_status kompilyator_flang_vo_vseh_ocenkah(fl_ctx *ctx, fl_value poziciya, fl_value ocenki, fl_value *result, fl_error *error);

/*
 * Функция flang «Позиции первой оценки».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param ocenki — «оценки»: список: «Оценка»
 * @return значение: список: «Позиция убывания»
 */
fl_status kompilyator_flang_pozicii_pervoy_ocenki(fl_ctx *ctx, fl_value ocenki, fl_value *result, fl_error *error);

/*
 * Функция flang «Общие позиции».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param ocenki — «оценки»: список: «Оценка»
 * @param mera — «мера»
 * @return значение: список: «Позиция убывания»
 */
fl_status kompilyator_flang_obschie_pozicii(fl_ctx *ctx, fl_value ocenki, fl_value mera, fl_value *result, fl_error *error);

/*
 * Функция flang «Узел первой оценки».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param ocenki — «оценки»: список: «Оценка»
 * @return значение: «Значение»
 */
fl_status kompilyator_flang_uzel_pervoy_ocenki(fl_ctx *ctx, fl_value ocenki, fl_value *result, fl_error *error);

/*
 * Функция flang «Отвергнуть немое».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param sostoyanie — «состояние»: «Проверка»
 * @param ocenka — «оценка»: «Оценка»
 * @param imena — «имена»: список: строка
 * @return значение: «Проверка»
 */
fl_status kompilyator_flang_otvergnut_nemoe(fl_ctx *ctx, fl_value sostoyanie, fl_value ocenka, fl_value imena, fl_value *result, fl_error *error);

/*
 * Функция flang «Отвергнуть немые».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param sostoyanie — «состояние»: «Проверка»
 * @param imena — «имена»: список: строка
 * @param nemye — «немые»: список: «Оценка»
 * @return значение: «Проверка»
 */
fl_status kompilyator_flang_otvergnut_nemye(fl_ctx *ctx, fl_value sostoyanie, fl_value imena, fl_value nemye, fl_value *result, fl_error *error);

/*
 * Функция flang «Отвергнуть цикл».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param sostoyanie — «состояние»: «Проверка»
 * @param imena — «имена»: список: строка
 * @param ocenki — «оценки»: список: «Оценка»
 * @return значение: «Проверка»
 */
fl_status kompilyator_flang_otvergnut_cikl(fl_ctx *ctx, fl_value sostoyanie, fl_value imena, fl_value ocenki, fl_value *result, fl_error *error);

/*
 * Функция flang «Проверить общую позицию».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param sostoyanie — «состояние»: «Проверка»
 * @param imena — «имена»: список: строка
 * @param ocenki — «оценки»: список: «Оценка»
 * @return значение: «Проверка»
 */
fl_status kompilyator_flang_proverit_obschuyu_poziciyu(fl_ctx *ctx, fl_value sostoyanie, fl_value imena, fl_value ocenki, fl_value *result, fl_error *error);

/*
 * Функция flang «Проверить общую меру».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param sostoyanie — «состояние»: «Проверка»
 * @param imena — «имена»: список: строка
 * @param ocenki — «оценки»: список: «Оценка»
 * @return значение: «Проверка»
 */
fl_status kompilyator_flang_proverit_obschuyu_meru(fl_ctx *ctx, fl_value sostoyanie, fl_value imena, fl_value ocenki, fl_value *result, fl_error *error);

/*
 * Функция flang «Стеречь меру».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param sostoyanie — «состояние»: «Проверка»
 * @param ocenki — «оценки»: список: «Оценка»
 * @param poziciya — «позиция»: число
 * @return значение: «Проверка»
 */
fl_status kompilyator_flang_sterech_meru(fl_ctx *ctx, fl_value sostoyanie, fl_value ocenki, fl_value poziciya, fl_value *result, fl_error *error);

/*
 * Функция flang «Точная позиция».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param poziciya — «позиция»: число
 * @param ocenki — «оценки»: список: «Оценка»
 * @return значение
 */
fl_status kompilyator_flang_tochnaya_poziciya(fl_ctx *ctx, fl_value poziciya, fl_value ocenki, fl_value *result, fl_error *error);

/*
 * Функция flang «Точное ребро».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param rebro — «ребро»: «Вызов»
 * @param poziciya — «позиция»: число
 * @return значение
 */
fl_status kompilyator_flang_tochnoe_rebro(fl_ctx *ctx, fl_value rebro, fl_value poziciya, fl_value *result, fl_error *error);

/*
 * Функция flang «Точный шаг ребра».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param rebro — «ребро»: «Вызов»
 * @param poziciya — «позиция»: число
 * @return значение
 */
fl_status kompilyator_flang_tochnyy_shag_rebra(fl_ctx *ctx, fl_value rebro, fl_value poziciya, fl_value *result, fl_error *error);

/*
 * Функция flang «Точный шаг происхождения».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param proishozhdenie — «происхождение»: «Происхождение»
 * @param rebro — «ребро»: «Вызов»
 * @return значение
 */
fl_status kompilyator_flang_tochnyy_shag_proishozhdeniya(fl_ctx *ctx, fl_value proishozhdenie, fl_value rebro, fl_value *result, fl_error *error);

/*
 * Функция flang «Целый шаг вниз».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param shag — «шаг»: число
 * @return значение
 */
fl_status kompilyator_flang_celyy_shag_vniz(fl_ctx *ctx, fl_value shag, fl_value *result, fl_error *error);

/*
 * Функция flang «Отметить точный шаг».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param sostoyanie — «состояние»: «Проверка»
 * @param ocenki — «оценки»: список: «Оценка»
 * @param poziciya — «позиция»: число
 * @return значение: «Проверка»
 */
fl_status kompilyator_flang_otmetit_tochnyy_shag(fl_ctx *ctx, fl_value sostoyanie, fl_value ocenki, fl_value poziciya, fl_value *result, fl_error *error);

/*
 * Функция flang «Отметить точное ребро».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param sostoyanie — «состояние»: «Проверка»
 * @param ocenka — «оценка»: «Оценка»
 * @param poziciya — «позиция»: число
 * @return значение: «Проверка»
 */
fl_status kompilyator_flang_otmetit_tochnoe_rebro(fl_ctx *ctx, fl_value sostoyanie, fl_value ocenka, fl_value poziciya, fl_value *result, fl_error *error);

/*
 * Функция flang «Точная мера ребра».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param rebro — «ребро»: «Вызов»
 * @param poziciya — «позиция»: число
 * @return значение: «Точная мера»
 */
fl_status kompilyator_flang_tochnaya_mera_rebra(fl_ctx *ctx, fl_value rebro, fl_value poziciya, fl_value *result, fl_error *error);

/*
 * Функция flang «Шаг ребра словами».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param rebro — «ребро»: «Вызов»
 * @param poziciya — «позиция»: число
 * @return значение: строка
 */
fl_status kompilyator_flang_shag_rebra_slovami(fl_ctx *ctx, fl_value rebro, fl_value poziciya, fl_value *result, fl_error *error);

/*
 * Функция flang «Шаг происхождения словами».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param proishozhdenie — «происхождение»: «Происхождение»
 * @param rebro — «ребро»: «Вызов»
 * @return значение: строка
 */
fl_status kompilyator_flang_shag_proishozhdeniya_slovami(fl_ctx *ctx, fl_value proishozhdenie, fl_value rebro, fl_value *result, fl_error *error);

/*
 * Функция flang «Имя шага словами».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param imya — «имя»: строка
 * @return значение: строка
 */
fl_status kompilyator_flang_imya_shaga_slovami(fl_ctx *ctx, fl_value imya, fl_value *result, fl_error *error);

/*
 * Функция flang «Поставить сторожа меры».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param sostoyanie — «состояние»: «Проверка»
 * @param ocenki — «оценки»: список: «Оценка»
 * @param poziciya — «позиция»: число
 * @return значение: «Проверка»
 */
fl_status kompilyator_flang_postavit_storozha_mery(fl_ctx *ctx, fl_value sostoyanie, fl_value ocenki, fl_value poziciya, fl_value *result, fl_error *error);

/*
 * Функция flang «Стеречь ребро».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param sostoyanie — «состояние»: «Проверка»
 * @param ocenka — «оценка»: «Оценка»
 * @param poziciya — «позиция»: число
 * @return значение: «Проверка»
 */
fl_status kompilyator_flang_sterech_rebro(fl_ctx *ctx, fl_value sostoyanie, fl_value ocenka, fl_value poziciya, fl_value *result, fl_error *error);

/*
 * Функция flang «Мера ребра».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param rebro — «ребро»: «Вызов»
 * @param poziciya — «позиция»: число
 * @return значение: «Мера»
 */
fl_status kompilyator_flang_mera_rebra(fl_ctx *ctx, fl_value rebro, fl_value poziciya, fl_value *result, fl_error *error);

/*
 * Функция flang «Узел аргумента».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param argument — «аргумент»: «Может быть аргумент»
 * @return значение: «Значение»
 */
fl_status kompilyator_flang_uzel_argumenta(fl_ctx *ctx, fl_value argument, fl_value *result, fl_error *error);

/*
 * Функция flang «Сообщение о мере».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param otkuda — «откуда»: строка
 * @param kuda — «куда»: строка
 * @param poziciya — «позиция»: число
 * @param parametr — «параметр»: строка
 * @return значение: строка
 */
fl_status kompilyator_flang_soobschenie_o_mere(fl_ctx *ctx, fl_value otkuda, fl_value kuda, fl_value poziciya, fl_value parametr, fl_value *result, fl_error *error);

/*
 * Функция flang «Первая позиция».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param pozicii — «позиции»: список: «Позиция убывания»
 * @return значение: число
 */
fl_status kompilyator_flang_pervaya_poziciya(fl_ctx *ctx, fl_value pozicii, fl_value *result, fl_error *error);

/*
 * Функция flang «Проверить цикл».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param sostoyanie — «состояние»: «Проверка»
 * @param imena — «имена»: список: строка
 * @param vnutri — «внутри»: список: «Вызов»
 * @return значение: «Проверка»
 */
fl_status kompilyator_flang_proverit_cikl(fl_ctx *ctx, fl_value sostoyanie, fl_value imena, fl_value vnutri, fl_value *result, fl_error *error);

/*
 * Функция flang «Проверить компоненту».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param sostoyanie — «состояние»: «Проверка»
 * @param komponenta — «компонента»: «Компонента»
 * @param ryobra — «рёбра»: список: «Вызов»
 * @return значение: «Проверка»
 */
fl_status kompilyator_flang_proverit_komponentu(fl_ctx *ctx, fl_value sostoyanie, fl_value komponenta, fl_value ryobra, fl_value *result, fl_error *error);

/*
 * Функция flang «Шаг заражения».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param otkazy — «отказы»: список: строка
 * @param rebro — «ребро»: «Вызов»
 * @return значение: список: строка
 */
fl_status kompilyator_flang_shag_zarazheniya(fl_ctx *ctx, fl_value otkazy, fl_value rebro, fl_value *result, fl_error *error);

/*
 * Функция flang «Замкнуть отказы».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Хвостовой самовызов развёрнут в цикл: стек не растёт.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param otkazy — «отказы»: список: строка
 * @param ryobra — «рёбра»: список: «Вызов»
 * @return значение: список: строка
 */
fl_status kompilyator_flang_zamknut_otkazy(fl_ctx *ctx, fl_value otkazy, fl_value ryobra, fl_value *result, fl_error *error);

/*
 * Функция flang «Проверить тотальность».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param programma — «программа»: «Значение»
 * @return значение: «Итог тотальности»
 */
fl_status kompilyator_flang_proverit_totalnost(fl_ctx *ctx, fl_value programma, fl_value *result, fl_error *error);

/*
 * Функция flang «Отметить меры».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param programma — «программа»: «Значение»
 * @return значение: «Значение»
 */
fl_status kompilyator_flang_otmetit_mery(fl_ctx *ctx, fl_value programma, fl_value *result, fl_error *error);

/*
 * Функция flang «Положить отметки».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param programma — «программа»: «Значение»
 * @param mery — «меры»: список: «Мера»
 * @return значение: «Значение»
 */
fl_status kompilyator_flang_polozhit_otmetki(fl_ctx *ctx, fl_value programma, fl_value mery, fl_value *result, fl_error *error);

/*
 * Функция flang «Отметить программу».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param programma — «программа»: «Значение»
 * @param mery — «меры»: список: «Мера»
 * @return значение: «Значение»
 */
fl_status kompilyator_flang_otmetit_programmu(fl_ctx *ctx, fl_value programma, fl_value mery, fl_value *result, fl_error *error);

/*
 * Функция flang «Тексты мер».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param mery — «меры»: список: «Мера»
 * @return значение: список: «Значение»
 */
fl_status kompilyator_flang_teksty_mer(fl_ctx *ctx, fl_value mery, fl_value *result, fl_error *error);

/*
 * Функция flang «Стерегомые тексты».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param mery — «меры»: список: «Мера»
 * @return значение: список: строка
 */
fl_status kompilyator_flang_steregomye_teksty(fl_ctx *ctx, fl_value mery, fl_value *result, fl_error *error);

/*
 * Функция flang «Можно пометить».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param uzel — «узел»: «Значение»
 * @return значение
 */
fl_status kompilyator_flang_mozhno_pometit(fl_ctx *ctx, fl_value uzel, fl_value *result, fl_error *error);

/*
 * Функция flang «Отметить функции».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param funkcii — «функции»: список: «Значение»
 * @param mery — «меры»: список: «Мера»
 * @return значение: список: «Значение»
 */
fl_status kompilyator_flang_otmetit_funkcii(fl_ctx *ctx, fl_value funkcii, fl_value mery, fl_value *result, fl_error *error);

/*
 * Функция flang «Шаг отметки функции».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param akk — «акк»: «Сбор отметок»
 * @param funkciya — «функция»: «Значение»
 * @param mery — «меры»: список: «Мера»
 * @return значение: «Сбор отметок»
 */
fl_status kompilyator_flang_shag_otmetki_funkcii(fl_ctx *ctx, fl_value akk, fl_value funkciya, fl_value mery, fl_value *result, fl_error *error);

/*
 * Функция flang «Впервые».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param imena — «имена»: список: строка
 * @param imya — «имя»: строка
 * @return значение
 */
fl_status kompilyator_flang_vpervye(fl_ctx *ctx, fl_value imena, fl_value imya, fl_value *result, fl_error *error);

/*
 * Функция flang «Отметить эту функцию».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param funkciya — «функция»: «Значение»
 * @param svoi — «свои»: список: «Мера»
 * @param vpervye — «впервые»
 * @return значение: «Значение»
 */
fl_status kompilyator_flang_otmetit_etu_funkciyu(fl_ctx *ctx, fl_value funkciya, fl_value svoi, fl_value vpervye, fl_value *result, fl_error *error);

/*
 * Функция flang «Стоит метить».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param svoi — «свои»: список: «Мера»
 * @param vpervye — «впервые»
 * @param funkciya — «функция»: «Значение»
 * @return значение
 */
fl_status kompilyator_flang_stoit_metit(fl_ctx *ctx, fl_value svoi, fl_value vpervye, fl_value funkciya, fl_value *result, fl_error *error);

/*
 * Функция flang «Отметить в узле».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param uzel — «узел»: «Значение»
 * @param mery — «меры»: список: «Мера»
 * @return значение: «Значение»
 */
fl_status kompilyator_flang_otmetit_v_uzle(fl_ctx *ctx, fl_value uzel, fl_value mery, fl_value *result, fl_error *error);

/*
 * Функция flang «Отметить в записи».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param uzel — «узел»: «Значение»
 * @param polya — «поля»: список: «Поле значения»
 * @param mery — «меры»: список: «Мера»
 * @return значение: «Значение»
 */
fl_status kompilyator_flang_otmetit_v_zapisi(fl_ctx *ctx, fl_value uzel, fl_value polya, fl_value mery, fl_value *result, fl_error *error);

/*
 * Функция flang «Отметить вызов».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param uzel — «узел»: «Значение»
 * @param mery — «меры»: список: «Мера»
 * @return значение: «Значение»
 */
fl_status kompilyator_flang_otmetit_vyzov(fl_ctx *ctx, fl_value uzel, fl_value mery, fl_value *result, fl_error *error);

/*
 * Функция flang «Отметить аргумент вызова».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param uzel — «узел»: «Значение»
 * @param mera — «мера»: «Мера»
 * @return значение: «Значение»
 */
fl_status kompilyator_flang_otmetit_argument_vyzova(fl_ctx *ctx, fl_value uzel, fl_value mera, fl_value *result, fl_error *error);

/*
 * Функция flang «Узел по номеру при анализе».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param uzly — «узлы»: список: «Значение»
 * @param kotoryy — «который»: число
 * @return значение: «Значение»
 */
fl_status kompilyator_flang_uzel_po_nomeru_pri_analize(fl_ctx *ctx, fl_value uzly, fl_value kotoryy, fl_value *result, fl_error *error);

/*
 * Функция flang «Шаг отбора узла».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param akk — «акк»: «Сбор отметки»
 * @param uzel — «узел»: «Значение»
 * @param iskomyy — «искомый»: число
 * @return значение: «Сбор отметки»
 */
fl_status kompilyator_flang_shag_otbora_uzla(fl_ctx *ctx, fl_value akk, fl_value uzel, fl_value iskomyy, fl_value *result, fl_error *error);

/*
 * Функция flang «Первый узел».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param uzly — «узлы»: список: «Значение»
 * @return значение: «Значение»
 */
fl_status kompilyator_flang_pervyy_uzel(fl_ctx *ctx, fl_value uzly, fl_value *result, fl_error *error);

/*
 * Функция flang «Отметить в списке».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param elementy — «элементы»: список: «Значение»
 * @param poziciya — «позиция»: число
 * @param mera — «мера»: «Мера»
 * @return значение: список: «Значение»
 */
fl_status kompilyator_flang_otmetit_v_spiske(fl_ctx *ctx, fl_value elementy, fl_value poziciya, fl_value mera, fl_value *result, fl_error *error);

/*
 * Функция flang «Шаг отметки аргумента».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param akk — «акк»: «Сбор отметки»
 * @param element — «элемент»: «Значение»
 * @param poziciya — «позиция»: число
 * @param mera — «мера»: «Мера»
 * @return значение: «Сбор отметки»
 */
fl_status kompilyator_flang_shag_otmetki_argumenta(fl_ctx *ctx, fl_value akk, fl_value element, fl_value poziciya, fl_value mera, fl_value *result, fl_error *error);

/*
 * Функция flang «Приписать отметку».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param uzel — «узел»: «Значение»
 * @param mera — «мера»: «Мера»
 * @return значение: «Значение»
 */
fl_status kompilyator_flang_pripisat_otmetku(fl_ctx *ctx, fl_value uzel, fl_value mera, fl_value *result, fl_error *error);

/*
 * Функция flang «Узел отметки».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param mera — «мера»: «Мера»
 * @return значение: «Значение»
 */
fl_status kompilyator_flang_uzel_otmetki(fl_ctx *ctx, fl_value mera, fl_value *result, fl_error *error);

/*
 * Функция flang «Узел строки при анализе».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param tekst — «текст»: строка
 * @return значение: «Значение»
 */
fl_status kompilyator_flang_uzel_stroki_pri_analize(fl_ctx *ctx, fl_value tekst, fl_value *result, fl_error *error);

/*
 * Функция flang «Заменить поле».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param uzel — «узел»: «Значение»
 * @param klyuch — «ключ»: строка
 * @param znachenie — «значение»: «Значение»
 * @return значение: «Значение»
 */
fl_status kompilyator_flang_zamenit_pole(fl_ctx *ctx, fl_value uzel, fl_value klyuch, fl_value znachenie, fl_value *result, fl_error *error);

/*
 * Функция flang «Поле или замена».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param pole — «поле»: «Поле значения»
 * @param klyuch — «ключ»: строка
 * @param znachenie — «значение»: «Значение»
 * @return значение: «Поле значения»
 */
fl_status kompilyator_flang_pole_ili_zamena(fl_ctx *ctx, fl_value pole, fl_value klyuch, fl_value znachenie, fl_value *result, fl_error *error);

/*
 * Функция flang «Шаг пути».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param chasti — «части»: список: строка
 * @param chast — «часть»: строка
 * @return значение: список: строка
 */
fl_status kompilyator_flang_shag_puti(fl_ctx *ctx, fl_value chasti, fl_value chast, fl_value *result, fl_error *error);

/*
 * Функция flang «Разрешить путь».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param fayl — «файл»: строка
 * @param ssylka — «ссылка»: строка
 * @return значение: строка
 */
fl_status kompilyator_flang_razreshit_put(fl_ctx *ctx, fl_value fayl, fl_value ssylka, fl_value *result, fl_error *error);

/*
 * Функция flang «Всё видно».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @return значение: «Видимость»
 */
fl_status kompilyator_flang_vsyo_vidno(fl_ctx *ctx, fl_value *result, fl_error *error);

/*
 * Функция flang «Видны только».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param imena — «имена»: список: строка
 * @return значение: «Видимость»
 */
fl_status kompilyator_flang_vidny_tolko(fl_ctx *ctx, fl_value imena, fl_value *result, fl_error *error);

/*
 * Функция flang «Скрыто».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param vidimost — «видимость»: «Видимость»
 * @param imya — «имя»: строка
 * @return значение
 */
fl_status kompilyator_flang_skryto(fl_ctx *ctx, fl_value vidimost, fl_value imya, fl_value *result, fl_error *error);

/*
 * Функция flang «Сузить видимость».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param eksport — «экспорт»: «Видимость»
 * @param prosba — «просьба»: «Видимость»
 * @return значение: «Видимость»
 */
fl_status kompilyator_flang_suzit_vidimost(fl_ctx *ctx, fl_value eksport, fl_value prosba, fl_value *result, fl_error *error);

/*
 * Функция flang «Первый из узлов».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param uzly — «узлы»: список: «Значение»
 * @return значение: «Может быть узел»
 */
fl_status kompilyator_flang_pervyy_iz_uzlov(fl_ctx *ctx, fl_value uzly, fl_value *result, fl_error *error);

/*
 * Функция flang «Шапка модуля».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param programma — «программа»: «Значение»
 * @return значение: «Может быть узел»
 */
fl_status kompilyator_flang_shapka_modulya(fl_ctx *ctx, fl_value programma, fl_value *result, fl_error *error);

/*
 * Функция flang «Значение шапки».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param programma — «программа»: «Значение»
 * @return значение: «Значение»
 */
fl_status kompilyator_flang_znachenie_shapki(fl_ctx *ctx, fl_value programma, fl_value *result, fl_error *error);

/*
 * Функция flang «Импорты программы».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param programma — «программа»: «Значение»
 * @return значение: список: «Значение»
 */
fl_status kompilyator_flang_importy_programmy(fl_ctx *ctx, fl_value programma, fl_value *result, fl_error *error);

/*
 * Функция flang «Экспорты программы».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param programma — «программа»: «Значение»
 * @return значение: «Видимость»
 */
fl_status kompilyator_flang_eksporty_programmy(fl_ctx *ctx, fl_value programma, fl_value *result, fl_error *error);

/*
 * Функция flang «Просьба импорта».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param import — «импорт»: «Значение»
 * @return значение: «Видимость»
 */
fl_status kompilyator_flang_prosba_importa(fl_ctx *ctx, fl_value import, fl_value *result, fl_error *error);

/*
 * Функция flang «Собрать связку».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param tipy — «типы»: список: «Значение»
 * @param funkcii — «функции»: список: «Значение»
 * @param otkuda_tipov — «откуда типов»: список: «Пара имён»
 * @param otkuda_funkciy — «откуда функций»: список: «Пара имён»
 * @param zagruzheny — «загружены»: список: строка
 * @param gruzyatsya — «грузятся»: список: строка
 * @param prosby — «просьбы»: список: «Просьба»
 * @param s_importami — «с импортами»: список: строка
 * @param bedy — «беды»: список: «Беда»
 * @return значение: «Связывание»
 */
fl_status kompilyator_flang_sobrat_svyazku(fl_ctx *ctx, fl_value tipy, fl_value funkcii, fl_value otkuda_tipov, fl_value otkuda_funkciy, fl_value zagruzheny, fl_value gruzyatsya, fl_value prosby, fl_value s_importami, fl_value bedy, fl_value *result, fl_error *error);

/*
 * Функция flang «Пустая связка».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @return значение: «Связывание»
 */
fl_status kompilyator_flang_pustaya_svyazka(fl_ctx *ctx, fl_value *result, fl_error *error);

/*
 * Функция flang «Добавить беду».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param s — «с»: «Связывание»
 * @param beda — «беда»: «Беда»
 * @return значение: «Связывание»
 */
fl_status kompilyator_flang_dobavit_bedu(fl_ctx *ctx, fl_value s, fl_value beda, fl_value *result, fl_error *error);

/*
 * Функция flang «Добавить беды».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param s — «с»: «Связывание»
 * @param bedy — «беды»: список: «Беда»
 * @return значение: «Связывание»
 */
fl_status kompilyator_flang_dobavit_bedy(fl_ctx *ctx, fl_value s, fl_value bedy, fl_value *result, fl_error *error);

/*
 * Функция flang «С загруженным».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param s — «с»: «Связывание»
 * @param put — «путь»: строка
 * @return значение: «Связывание»
 */
fl_status kompilyator_flang_s_zagruzhennym(fl_ctx *ctx, fl_value s, fl_value put, fl_value *result, fl_error *error);

/*
 * Функция flang «Начать грузить».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param s — «с»: «Связывание»
 * @param put — «путь»: строка
 * @return значение: «Связывание»
 */
fl_status kompilyator_flang_nachat_gruzit(fl_ctx *ctx, fl_value s, fl_value put, fl_value *result, fl_error *error);

/*
 * Функция flang «Кончить грузить».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param s — «с»: «Связывание»
 * @return значение: «Связывание»
 */
fl_status kompilyator_flang_konchit_gruzit(fl_ctx *ctx, fl_value s, fl_value *result, fl_error *error);

/*
 * Функция flang «С импортами».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param s — «с»: «Связывание»
 * @param put — «путь»: строка
 * @return значение: «Связывание»
 */
fl_status kompilyator_flang_s_importami(fl_ctx *ctx, fl_value s, fl_value put, fl_value *result, fl_error *error);

/*
 * Функция flang «С просьбами».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param s — «с»: «Связывание»
 * @param prosby — «просьбы»: список: «Просьба»
 * @return значение: «Связывание»
 */
fl_status kompilyator_flang_s_prosbami(fl_ctx *ctx, fl_value s, fl_value prosby, fl_value *result, fl_error *error);

/*
 * Функция flang «С типом».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param s — «с»: «Связывание»
 * @param uzel — «узел»: «Значение»
 * @param imya — «имя»: строка
 * @param fayl — «файл»: строка
 * @return значение: «Связывание»
 */
fl_status kompilyator_flang_s_tipom(fl_ctx *ctx, fl_value s, fl_value uzel, fl_value imya, fl_value fayl, fl_value *result, fl_error *error);

/*
 * Функция flang «С функцией».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param s — «с»: «Связывание»
 * @param uzel — «узел»: «Значение»
 * @param imya — «имя»: строка
 * @param fayl — «файл»: строка
 * @return значение: «Связывание»
 */
fl_status kompilyator_flang_s_funkciey(fl_ctx *ctx, fl_value s, fl_value uzel, fl_value imya, fl_value fayl, fl_value *result, fl_error *error);

/*
 * Функция flang «С функциями».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param s — «с»: «Связывание»
 * @param funkcii — «функции»: список: «Значение»
 * @return значение: «Связывание»
 */
fl_status kompilyator_flang_s_funkciyami(fl_ctx *ctx, fl_value s, fl_value funkcii, fl_value *result, fl_error *error);

/*
 * Функция flang «Беда связывания».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param kod — «код»: строка
 * @param soobschenie — «сообщение»: строка
 * @return значение: «Беда»
 */
fl_status kompilyator_flang_beda_svyazyvaniya(fl_ctx *ctx, fl_value kod, fl_value soobschenie, fl_value *result, fl_error *error);

/*
 * Функция flang «Беда узла».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param kod — «код»: строка
 * @param soobschenie — «сообщение»: строка
 * @param uzel — «узел»: «Значение»
 * @return значение: «Беда»
 */
fl_status kompilyator_flang_beda_uzla(fl_ctx *ctx, fl_value kod, fl_value soobschenie, fl_value uzel, fl_value *result, fl_error *error);

/*
 * Функция flang «Беда из разбора».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param d — «д»: «Диагностика»
 * @return значение: «Беда»
 */
fl_status kompilyator_flang_beda_iz_razbora(fl_ctx *ctx, fl_value d, fl_value *result, fl_error *error);

/*
 * Функция flang «Беда из анализа».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param d — «д»: «Диагностика анализа»
 * @return значение: «Беда»
 */
fl_status kompilyator_flang_beda_iz_analiza(fl_ctx *ctx, fl_value d, fl_value *result, fl_error *error);

/*
 * Функция flang «Слить беды».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param pervye — «первые»: список: «Беда»
 * @param vtorye — «вторые»: список: «Беда»
 * @return значение: список: «Беда»
 */
fl_status kompilyator_flang_slit_bedy(fl_ctx *ctx, fl_value pervye, fl_value vtorye, fl_value *result, fl_error *error);

/*
 * Функция flang «Слить тип».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param svyazka — «связка»: «Связывание»
 * @param uzel — «узел»: «Значение»
 * @param fayl — «файл»: строка
 * @param vidimost — «видимость»: «Видимость»
 * @return значение: «Связывание»
 */
fl_status kompilyator_flang_slit_tip(fl_ctx *ctx, fl_value svyazka, fl_value uzel, fl_value fayl, fl_value vidimost, fl_value *result, fl_error *error);

/*
 * Функция flang «Повтор типа».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param svyazka — «связка»: «Связывание»
 * @param uzel — «узел»: «Значение»
 * @param imya — «имя»: строка
 * @param fayl — «файл»: строка
 * @return значение: «Связывание»
 */
fl_status kompilyator_flang_povtor_tipa(fl_ctx *ctx, fl_value svyazka, fl_value uzel, fl_value imya, fl_value fayl, fl_value *result, fl_error *error);

/*
 * Функция flang «Слить функцию».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param svyazka — «связка»: «Связывание»
 * @param uzel — «узел»: «Значение»
 * @param fayl — «файл»: строка
 * @param vidimost — «видимость»: «Видимость»
 * @return значение: «Связывание»
 */
fl_status kompilyator_flang_slit_funkciyu(fl_ctx *ctx, fl_value svyazka, fl_value uzel, fl_value fayl, fl_value vidimost, fl_value *result, fl_error *error);

/*
 * Функция flang «Повтор функции».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param svyazka — «связка»: «Связывание»
 * @param uzel — «узел»: «Значение»
 * @param imya — «имя»: строка
 * @param fayl — «файл»: строка
 * @return значение: «Связывание»
 */
fl_status kompilyator_flang_povtor_funkcii(fl_ctx *ctx, fl_value svyazka, fl_value uzel, fl_value imya, fl_value fayl, fl_value *result, fl_error *error);

/*
 * Функция flang «Слить программу».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param svyazka — «связка»: «Связывание»
 * @param programma — «программа»: «Значение»
 * @param fayl — «файл»: строка
 * @param vidimost — «видимость»: «Видимость»
 * @return значение: «Связывание»
 */
fl_status kompilyator_flang_slit_programmu(fl_ctx *ctx, fl_value svyazka, fl_value programma, fl_value fayl, fl_value vidimost, fl_value *result, fl_error *error);

/*
 * Функция flang «Просьба к файлу».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param prosby — «просьбы»: список: «Просьба»
 * @param put — «путь»: строка
 * @return значение: «Видимость»
 */
fl_status kompilyator_flang_prosba_k_faylu(fl_ctx *ctx, fl_value prosby, fl_value put, fl_value *result, fl_error *error);

/*
 * Функция flang «Первая из просьб».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param prosby — «просьбы»: список: «Просьба»
 * @return значение: «Может быть просьба»
 */
fl_status kompilyator_flang_pervaya_iz_prosb(fl_ctx *ctx, fl_value prosby, fl_value *result, fl_error *error);

/*
 * Функция flang «Запомнить просьбу».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param svyazka — «связка»: «Связывание»
 * @param put — «путь»: строка
 * @param import — «импорт»: «Значение»
 * @return значение: «Связывание»
 */
fl_status kompilyator_flang_zapomnit_prosbu(fl_ctx *ctx, fl_value svyazka, fl_value put, fl_value import, fl_value *result, fl_error *error);

/*
 * Функция flang «Слить просьбы».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param prezhnyaya — «прежняя»: «Видимость»
 * @param novaya — «новая»: «Видимость»
 * @return значение: «Видимость»
 */
fl_status kompilyator_flang_slit_prosby(fl_ctx *ctx, fl_value prezhnyaya, fl_value novaya, fl_value *result, fl_error *error);

/*
 * Функция flang «Загрузить».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param svyazka — «связка»: «Связывание»
 * @param tablica — «таблица»: список: «Пара имён»
 * @param put — «путь»: строка
 * @param tekst — «текст»: строка
 * @param eto_vhod — «это вход»
 * @return значение: «Шаг связки»
 */
fl_status kompilyator_flang_zagruzit(fl_ctx *ctx, fl_value svyazka, fl_value tablica, fl_value put, fl_value tekst, fl_value eto_vhod, fl_value *result, fl_error *error);

/*
 * Функция flang «Беда цикла».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param gruzyatsya — «грузятся»: список: строка
 * @param put — «путь»: строка
 * @return значение: «Беда»
 */
fl_status kompilyator_flang_beda_cikla(fl_ctx *ctx, fl_value gruzyatsya, fl_value put, fl_value *result, fl_error *error);

/*
 * Функция flang «Разобрать и загрузить».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param svyazka — «связка»: «Связывание»
 * @param tablica — «таблица»: список: «Пара имён»
 * @param put — «путь»: строка
 * @param tekst — «текст»: строка
 * @param eto_vhod — «это вход»
 * @return значение: «Шаг связки»
 */
fl_status kompilyator_flang_razobrat_i_zagruzit(fl_ctx *ctx, fl_value svyazka, fl_value tablica, fl_value put, fl_value tekst, fl_value eto_vhod, fl_value *result, fl_error *error);

/*
 * Функция flang «Пройти импорты».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param svyazka — «связка»: «Связывание»
 * @param tablica — «таблица»: список: «Пара имён»
 * @param put — «путь»: строка
 * @param eto_vhod — «это вход»
 * @param programma — «программа»: «Значение»
 * @return значение: «Шаг связки»
 */
fl_status kompilyator_flang_proyti_importy(fl_ctx *ctx, fl_value svyazka, fl_value tablica, fl_value put, fl_value eto_vhod, fl_value programma, fl_value *result, fl_error *error);

/*
 * Функция flang «Шаг импорта».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param svyazka — «связка»: «Связывание»
 * @param tablica — «таблица»: список: «Пара имён»
 * @param fayl — «файл»: строка
 * @param import — «импорт»: «Значение»
 * @return значение: «Связывание»
 */
fl_status kompilyator_flang_shag_importa(fl_ctx *ctx, fl_value svyazka, fl_value tablica, fl_value fayl, fl_value import, fl_value *result, fl_error *error);

/*
 * Функция flang «Взять импорт».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param svyazka — «связка»: «Связывание»
 * @param tablica — «таблица»: список: «Пара имён»
 * @param import — «импорт»: «Значение»
 * @param cel — «цель»: строка
 * @return значение: «Связывание»
 */
fl_status kompilyator_flang_vzyat_import(fl_ctx *ctx, fl_value svyazka, fl_value tablica, fl_value import, fl_value cel, fl_value *result, fl_error *error);

/*
 * Функция flang «Загрузить импорт».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param svyazka — «связка»: «Связывание»
 * @param tablica — «таблица»: список: «Пара имён»
 * @param import — «импорт»: «Значение»
 * @param cel — «цель»: строка
 * @return значение: «Связывание»
 */
fl_status kompilyator_flang_zagruzit_import(fl_ctx *ctx, fl_value svyazka, fl_value tablica, fl_value import, fl_value cel, fl_value *result, fl_error *error);

/*
 * Функция flang «Сверить имя модуля».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param svyazka — «связка»: «Связывание»
 * @param programma — «программа»: «Может быть узел»
 * @param kategoriya — «категория»: строка
 * @param cel — «цель»: строка
 * @return значение: «Связывание»
 */
fl_status kompilyator_flang_sverit_imya_modulya(fl_ctx *ctx, fl_value svyazka, fl_value programma, fl_value kategoriya, fl_value cel, fl_value *result, fl_error *error);

/*
 * Функция flang «Сверить имя дальше».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param svyazka — «связка»: «Связывание»
 * @param imya — «имя»: строка
 * @param kategoriya — «категория»: строка
 * @param cel — «цель»: строка
 * @return значение: «Связывание»
 */
fl_status kompilyator_flang_sverit_imya_dalshe(fl_ctx *ctx, fl_value svyazka, fl_value imya, fl_value kategoriya, fl_value cel, fl_value *result, fl_error *error);

/*
 * Функция flang «Имена связанных функций».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param funkcii — «функции»: список: «Значение»
 * @return значение: список: строка
 */
fl_status kompilyator_flang_imena_svyazannyh_funkciy(fl_ctx *ctx, fl_value funkcii, fl_value *result, fl_error *error);

/*
 * Функция flang «Подмены файла».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param tablica — «таблица»: список: «Пара имён»
 * @param put — «путь»: строка
 * @param imena — «имена»: список: строка
 * @param vhod — «вход»: строка
 * @return значение: список: «Подмена»
 */
fl_status kompilyator_flang_podmeny_fayla(fl_ctx *ctx, fl_value tablica, fl_value put, fl_value imena, fl_value vhod, fl_value *result, fl_error *error);

/*
 * Функция flang «Подмены программы».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param programma — «программа»: «Значение»
 * @param put — «путь»: строка
 * @param vhod — «вход»: строка
 * @return значение: список: «Подмена»
 */
fl_status kompilyator_flang_podmeny_programmy(fl_ctx *ctx, fl_value programma, fl_value put, fl_value vhod, fl_value *result, fl_error *error);

/*
 * Функция flang «Все подмены».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param svyazka — «связка»: «Связывание»
 * @param tablica — «таблица»: список: «Пара имён»
 * @param vhod — «вход»: строка
 * @return значение: список: «Подмена»
 */
fl_status kompilyator_flang_vse_podmeny(fl_ctx *ctx, fl_value svyazka, fl_value tablica, fl_value vhod, fl_value *result, fl_error *error);

/*
 * Функция flang «Слить подмены».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param pervye — «первые»: список: «Подмена»
 * @param vtorye — «вторые»: список: «Подмена»
 * @return значение: список: «Подмена»
 */
fl_status kompilyator_flang_slit_podmeny(fl_ctx *ctx, fl_value pervye, fl_value vtorye, fl_value *result, fl_error *error);

/*
 * Функция flang «Первая из подмен».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param podmeny — «подмены»: список: «Подмена»
 * @return значение: «Может быть подмена»
 */
fl_status kompilyator_flang_pervaya_iz_podmen(fl_ctx *ctx, fl_value podmeny, fl_value *result, fl_error *error);

/*
 * Функция flang «Подменить функцию».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param uzel — «узел»: «Значение»
 * @param podmeny — «подмены»: список: «Подмена»
 * @param otkuda — «откуда»: список: «Пара имён»
 * @return значение: «Значение»
 */
fl_status kompilyator_flang_podmenit_funkciyu(fl_ctx *ctx, fl_value uzel, fl_value podmeny, fl_value otkuda, fl_value *result, fl_error *error);

/*
 * Функция flang «Та же подмена».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param podmena — «подмена»: «Подмена»
 * @param imya — «имя»: строка
 * @param fayl — «файл»: строка
 * @return значение
 */
fl_status kompilyator_flang_ta_zhe_podmena(fl_ctx *ctx, fl_value podmena, fl_value imya, fl_value fayl, fl_value *result, fl_error *error);

/*
 * Функция flang «Второй проход».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param svyazka — «связка»: «Связывание»
 * @param tablica — «таблица»: список: «Пара имён»
 * @param vhod — «вход»: строка
 * @return значение: «Связывание»
 */
fl_status kompilyator_flang_vtoroy_prohod(fl_ctx *ctx, fl_value svyazka, fl_value tablica, fl_value vhod, fl_value *result, fl_error *error);

/*
 * Функция flang «Таблица исходников».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param fayly — «файлы»: список: «Исходник»
 * @return значение: список: «Пара имён»
 */
fl_status kompilyator_flang_tablica_ishodnikov(fl_ctx *ctx, fl_value fayly, fl_value *result, fl_error *error);

/*
 * Функция flang «Модуль входа».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param programma — «программа»: «Может быть узел»
 * @return значение: строка
 */
fl_status kompilyator_flang_modul_vhoda(fl_ctx *ctx, fl_value programma, fl_value *result, fl_error *error);

/*
 * Функция flang «Наследие входа».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param programma — «программа»: «Может быть узел»
 * @return значение: список: «Значение»
 */
fl_status kompilyator_flang_nasledie_vhoda(fl_ctx *ctx, fl_value programma, fl_value *result, fl_error *error);

/*
 * Функция flang «Связать исходники».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param fayly — «файлы»: список: «Исходник»
 * @param vhod — «вход»: строка
 * @return значение: «Программа с бедами»
 */
fl_status kompilyator_flang_svyazat_ishodniki(fl_ctx *ctx, fl_value fayly, fl_value vhod, fl_value *result, fl_error *error);

/*
 * Функция flang «Связать от входа».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param tablica — «таблица»: список: «Пара имён»
 * @param vhod — «вход»: строка
 * @return значение: «Программа с бедами»
 */
fl_status kompilyator_flang_svyazat_ot_vhoda(fl_ctx *ctx, fl_value tablica, fl_value vhod, fl_value *result, fl_error *error);

/*
 * Функция flang «Собрать программу».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param modul — «модуль»: строка
 * @param tipy — «типы»: список: «Значение»
 * @param funkcii — «функции»: список: «Значение»
 * @param nasledie — «наследие»: список: «Значение»
 * @return значение: «Значение»
 */
fl_status kompilyator_flang_sobrat_programmu(fl_ctx *ctx, fl_value modul, fl_value tipy, fl_value funkcii, fl_value nasledie, fl_value *result, fl_error *error);

/*
 * Функция flang «Пустая программа».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param modul — «модуль»: строка
 * @return значение: «Значение»
 */
fl_status kompilyator_flang_pustaya_programma(fl_ctx *ctx, fl_value modul, fl_value *result, fl_error *error);

/*
 * Функция flang «Печать в C от исходников».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param fayly — «файлы»: список: «Исходник»
 * @param vhod — «вход»: строка
 * @param nastroyki — «настройки»: «Настройки»
 * @return значение: «Итог сборки»
 */
fl_status kompilyator_flang_pechat_v_c_ot_ishodnikov(fl_ctx *ctx, fl_value fayly, fl_value vhod, fl_value nastroyki, fl_value *result, fl_error *error);

/*
 * Функция flang «Напечатать связанное».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param programma — «программа»: «Значение»
 * @param nastroyki — «настройки»: «Настройки»
 * @return значение: «Итог сборки»
 */
fl_status kompilyator_flang_napechatat_svyazannoe(fl_ctx *ctx, fl_value programma, fl_value nastroyki, fl_value *result, fl_error *error);

/*
 * Функция flang «Проверить исходники».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param fayly — «файлы»: список: «Исходник»
 * @param vhod — «вход»: строка
 * @return значение: «Итог проверки исходников»
 */
fl_status kompilyator_flang_proverit_ishodniki(fl_ctx *ctx, fl_value fayly, fl_value vhod, fl_value *result, fl_error *error);

/*
 * Функция flang «Печать связанного AST».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param fayly — «файлы»: список: «Исходник»
 * @param vhod — «вход»: строка
 * @return значение: строка
 */
fl_status kompilyator_flang_pechat_svyazannogo_ast(fl_ctx *ctx, fl_value fayly, fl_value vhod, fl_value *result, fl_error *error);

/*
 * Функция flang «Число связанных функций».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 * @param fayly — «файлы»: список: «Исходник»
 * @param vhod — «вход»: строка
 * @return значение: число
 */
fl_status kompilyator_flang_chislo_svyazannyh_funkciy(fl_ctx *ctx, fl_value fayly, fl_value vhod, fl_value *result, fl_error *error);

/*
 * Вызов функции по её исходному имени flang. Нужен прогонщику и всякому,
 * кто связывает программу с внешним миром динамически (скрипт, FFI, тест).
 */
fl_status kompilyator_flang_call(fl_ctx *ctx, const char *name, const fl_value *args, size_t count,
                    fl_value *result, fl_error *error);

#endif /* KOMPILYATOR_FLANG_H */

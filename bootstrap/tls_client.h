/*
 * ПЕЧАТАНО БЕЗ ПРОВЕРКИ ПОСТУСЛОВИЙ — ключ «flang emit --no-postconditions».
 * Снято постусловий: 1260 — ВСЕ обещания «обеспечивает» этой программы.
 * В этом коде обещание на возврате НЕ проверяется ни разу. Проверка не отменена,
 * а осталась на воротах: «flang check» и «flang test» судят постусловия всегда и
 * этим ключом не управляются. Правишь исходник — прогоняй их: тут нарушение молчит.
 * Сгенерировано flang (бэкенд C, flang/self/emit-c.flang).
 * Не редактировать руками.
 * Модуль flang: «TLS client».
 * Файл: объявления: конструкторы значений и функции программы.
 * Правьте исходник на flang и печатайте заново:
 * любая правка здесь потеряется.
 */
#ifndef TLS_CLIENT_H
#define TLS_CLIENT_H

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

/* Запись FTS «Ход куска»: «набрано», «номер». */
/* Запись flang тотальна: пропущенное поле — это «ничто», а не дырка. */
fl_status tls_client_sozdat_hod_kuska(fl_ctx *ctx, fl_value nabrano,
                                      fl_value nomer, fl_value *out,
                                      fl_error *error);

/* Запись FTS «Мера DER»: «значение», «октетов», «беда». */
/* Запись flang тотальна: пропущенное поле — это «ничто», а не дырка. */
fl_status tls_client_sozdat_mera_der(fl_ctx *ctx, fl_value znachenie,
                                     fl_value oktetov, fl_value beda,
                                     fl_value *out, fl_error *error);

/* Запись FTS «Голова DER»: «метка», «начало», «длина», «конец», «беда». */
/* Запись flang тотальна: пропущенное поле — это «ничто», а не дырка. */
fl_status tls_client_sozdat_golova_der(fl_ctx *ctx, fl_value metka,
                                       fl_value nachalo, fl_value dlina,
                                       fl_value konec, fl_value beda,
                                       fl_value *out, fl_error *error);

/* Запись FTS «Обход DER»: «места», «место». */
/* Запись flang тотальна: пропущенное поле — это «ничто», а не дырка. */
fl_status tls_client_sozdat_obhod_der(fl_ctx *ctx, fl_value mesta,
                                      fl_value mesto, fl_value *out,
                                      fl_error *error);

/* Запись FTS «Ход OID»: «части», «копилка», «начат». */
/* Запись flang тотальна: пропущенное поле — это «ничто», а не дырка. */
fl_status tls_client_sozdat_hod_oid(fl_ctx *ctx, fl_value chasti,
                                    fl_value kopilka, fl_value nachat,
                                    fl_value *out, fl_error *error);

/* Запись FTS «Время DER»: «год», «месяц», «день», «час», «минута», «секунда», «беда». */
/* Запись flang тотальна: пропущенное поле — это «ничто», а не дырка. */
fl_status tls_client_sozdat_vremya_der(fl_ctx *ctx, fl_value god,
                                       fl_value mesyac, fl_value den,
                                       fl_value chas, fl_value minuta,
                                       fl_value sekunda, fl_value beda,
                                       fl_value *out, fl_error *error);

/* Запись FTS «Обрезка слева»: «началось», «готово». */
/* Запись flang тотальна: пропущенное поле — это «ничто», а не дырка. */
fl_status tls_client_sozdat_obrezka_sleva(fl_ctx *ctx, fl_value nachalos,
                                          fl_value gotovo, fl_value *out,
                                          fl_error *error);

/* Запись FTS «Обрезка справа»: «готово», «пробелы». */
/* Запись flang тотальна: пропущенное поле — это «ничто», а не дырка. */
fl_status tls_client_sozdat_obrezka_sprava(fl_ctx *ctx, fl_value gotovo,
                                           fl_value probely, fl_value *out,
                                           fl_error *error);

/* Запись FTS «Правило пути»: «верно», «код», «слова». */
/* Запись flang тотальна: пропущенное поле — это «ничто», а не дырка. */
fl_status tls_client_sozdat_pravilo_puti(fl_ctx *ctx, fl_value verno,
                                         fl_value kod, fl_value slova,
                                         fl_value *out, fl_error *error);

/* Запись FTS «Корень доверия»: «субъект», «сертификат». */
/* Запись flang тотальна: пропущенное поле — это «ничто», а не дырка. */
fl_status tls_client_sozdat_koren_doveriya(fl_ctx *ctx, fl_value subekt,
                                           fl_value sertifikat, fl_value *out,
                                           fl_error *error);

/* Запись FTS «Примета строчки»: «приставка», «вид». */
/* Запись flang тотальна: пропущенное поле — это «ничто», а не дырка. */
fl_status tls_client_sozdat_primeta_strochki(fl_ctx *ctx, fl_value pristavka,
                                             fl_value vid, fl_value *out,
                                             fl_error *error);

/* Запись FTS «Ход пар»: «старший», «ждём младший», «пары». */
/* Запись flang тотальна: пропущенное поле — это «ничто», а не дырка. */
fl_status tls_client_sozdat_hod_par(fl_ctx *ctx, fl_value starshiy,
                                    fl_value zhdyom_mladshiy, fl_value pary,
                                    fl_value *out, fl_error *error);

/* Запись FTS «Ход расширений»: «номер», «место», «сколько», «печать». */
/* Запись flang тотальна: пропущенное поле — это «ничто», а не дырка. */
fl_status tls_client_sozdat_hod_rasshireniy(fl_ctx *ctx, fl_value nomer,
                                            fl_value mesto, fl_value skolko,
                                            fl_value pechat, fl_value *out,
                                            fl_error *error);

/* Запись FTS «Ход поиска»: «номер», «место», «начало», «длина», «есть». */
/* Запись flang тотальна: пропущенное поле — это «ничто», а не дырка. */
fl_status tls_client_sozdat_hod_poiska(fl_ctx *ctx, fl_value nomer,
                                       fl_value mesto, fl_value nachalo,
                                       fl_value dlina, fl_value est,
                                       fl_value *out, fl_error *error);

/* Запись FTS «Примета записи»: «тип», «вид». */
/* Запись flang тотальна: пропущенное поле — это «ничто», а не дырка. */
fl_status tls_client_sozdat_primeta_zapisi(fl_ctx *ctx, fl_value tip,
                                           fl_value vid, fl_value *out,
                                           fl_error *error);

/* Запись FTS «Ход полёта»: «номер», «поток», «видно», «итог». */
/* Запись flang тотальна: пропущенное поле — это «ничто», а не дырка. */
fl_status tls_client_sozdat_hod_polyota(fl_ctx *ctx, fl_value nomer,
                                        fl_value potok, fl_value vidno,
                                        fl_value itog, fl_value *out,
                                        fl_error *error);

/* Запись FTS «Пара»: «клиент», «сервер». */
/* Запись flang тотальна: пропущенное поле — это «ничто», а не дырка. */
fl_status tls_client_sozdat_para(fl_ctx *ctx, fl_value klient, fl_value server,
                                 fl_value *out, fl_error *error);

/* Запись FTS «Полёт»: «сервер», «поток», «рук», «дан», «конец». */
/* Запись flang тотальна: пропущенное поле — это «ничто», а не дырка. */
fl_status tls_client_sozdat_polyot(fl_ctx *ctx, fl_value server, fl_value potok,
                                   fl_value ruk, fl_value dan, fl_value konec,
                                   fl_value *out, fl_error *error);

/* Запись FTS «Доверие»: «корни», «сейчас», «узел». */
/* Запись flang тотальна: пропущенное поле — это «ничто», а не дырка. */
fl_status tls_client_sozdat_doverie(fl_ctx *ctx, fl_value korni,
                                    fl_value seychas, fl_value uzel,
                                    fl_value *out, fl_error *error);

/* Запись FTS «Отбор записей»: «номер», «записи». */
/* Запись flang тотальна: пропущенное поле — это «ничто», а не дырка. */
fl_status tls_client_sozdat_otbor_zapisey(fl_ctx *ctx, fl_value nomer,
                                          fl_value zapisi, fl_value *out,
                                          fl_error *error);

/* Запись FTS «Ход строки»: «набрано», «кончено». */
/* Запись flang тотальна: пропущенное поле — это «ничто», а не дырка. */
fl_status tls_client_sozdat_hod_stroki(fl_ctx *ctx, fl_value nabrano,
                                       fl_value koncheno, fl_value *out,
                                       fl_error *error);

/* Запись FTS «Ход ответа»: «номер», «текст», «закрыто», «испорчено». */
/* Запись flang тотальна: пропущенное поле — это «ничто», а не дырка. */
fl_status tls_client_sozdat_hod_otveta(fl_ctx *ctx, fl_value nomer,
                                       fl_value tekst, fl_value zakryto,
                                       fl_value isporcheno, fl_value *out,
                                       fl_error *error);

/* Сумма типов FTS «Ход разбора utf8»: «Разбираем utf8». */
/* Дискриминант — имя варианта: fl_variant_is(значение, "Имя"). */
fl_status tls_client_variant_razbiraem_utf8(fl_ctx *ctx, fl_value tochki,
                                            fl_value kopilka, fl_value ostalos,
                                            fl_value nizhnyaya,
                                            fl_value verhnyaya,
                                            fl_value zamescheniy, fl_value *out,
                                            fl_error *error);

/* Сумма типов FTS «Ход кодирования 64»: «Копим». */
/* Дискриминант — имя варианта: fl_variant_is(значение, "Имя"). */
fl_status tls_client_variant_kopim(fl_ctx *ctx, fl_value sobrano,
                                   fl_value nabrano, fl_value pervyy,
                                   fl_value vtoroy, fl_value *out,
                                   fl_error *error);

/* Сумма типов FTS «Ход раскодирования 64»: «Разбираем». */
/* Дискриминант — имя варианта: fl_variant_is(значение, "Имя"). */
fl_status tls_client_variant_razbiraem(fl_ctx *ctx, fl_value bayty,
                                       fl_value nabrano, fl_value kopilka,
                                       fl_value *out, fl_error *error);

/* Сумма типов FTS «Ход связки»: «Ход связки». */
/* Дискриминант — имя варианта: fl_variant_is(значение, "Имя"). */
fl_status tls_client_variant_hod_svyazki(fl_ctx *ctx, fl_value nomer,
                                         fl_value vnutri, fl_value nabrano,
                                         fl_value *out, fl_error *error);

/* Сумма типов FTS «Ход сверки имён»: «Ход сверки имён». */
/* Дискриминант — имя варианта: fl_variant_is(значение, "Имя"). */
fl_status tls_client_variant_hod_sverki_imyon(fl_ctx *ctx, fl_value mesto,
                                              fl_value soshlos, fl_value *out,
                                              fl_error *error);

/* Сумма типов FTS «Свод sha256»: «Свод». */
/* Дискриминант — имя варианта: fl_variant_is(значение, "Имя"). */
fl_status tls_client_variant_svod(fl_ctx *ctx, fl_value n0, fl_value n1,
                                  fl_value n2, fl_value n3, fl_value n4,
                                  fl_value n5, fl_value n6, fl_value n7,
                                  fl_value *out, fl_error *error);

/* Сумма типов FTS «Расписание»: «Расписание». */
/* Дискриминант — имя варианта: fl_variant_is(значение, "Имя"). */
fl_status tls_client_variant_raspisanie(fl_ctx *ctx, fl_value s0, fl_value s1,
                                        fl_value s2, fl_value s3, fl_value s4,
                                        fl_value s5, fl_value s6, fl_value s7,
                                        fl_value s8, fl_value s9, fl_value s10,
                                        fl_value s11, fl_value s12,
                                        fl_value s13, fl_value s14,
                                        fl_value s15, fl_value *out,
                                        fl_error *error);

/* Сумма типов FTS «Ход блока»: «Ход блока». */
/* Дискриминант — имя варианта: fl_variant_is(значение, "Имя"). */
fl_status tls_client_variant_hod_bloka(fl_ctx *ctx, fl_value raspisanie,
                                       fl_value svod, fl_value *out,
                                       fl_error *error);

/* Сумма типов FTS «Сбор слов»: «Сбор слов». */
/* Дискриминант — имя варианта: fl_variant_is(значение, "Имя"). */
fl_status tls_client_variant_sbor_slov(fl_ctx *ctx, fl_value raspisanie,
                                       fl_value kopilka, fl_value nabrano,
                                       fl_value *out, fl_error *error);

/* Сумма типов FTS «Ход хеша»: «Ход хеша». */
/* Дискриминант — имя варианта: fl_variant_is(значение, "Имя"). */
fl_status tls_client_variant_hod_hesha(fl_ctx *ctx, fl_value svod,
                                       fl_value bufer, fl_value nabrano,
                                       fl_value *out, fl_error *error);

/* Сумма типов FTS «Ход начала»: «Ход начала». */
/* Дискриминант — имя варианта: fl_variant_is(значение, "Имя"). */
fl_status tls_client_variant_hod_nachala(fl_ctx *ctx, fl_value vzyato,
                                         fl_value ostalos, fl_value *out,
                                         fl_error *error);

/* Сумма типов FTS «Ход слияния»: «Ход слияния». */
/* Дискриминант — имя варианта: fl_variant_is(значение, "Имя"). */
fl_status tls_client_variant_hod_sliyaniya(fl_ctx *ctx, fl_value vtoroy,
                                           fl_value nomer, fl_value gotovo,
                                           fl_value *out, fl_error *error);

/* Сумма типов FTS «Ход вывода»: «Ход вывода». */
/* Дискриминант — имя варианта: fl_variant_is(значение, "Имя"). */
fl_status tls_client_variant_hod_vyvoda(fl_ctx *ctx, fl_value tekuschiy,
                                        fl_value nakopleno, fl_value *out,
                                        fl_error *error);

/* Сумма типов FTS «Свод SHA-1»: «Свод1». */
/* Дискриминант — имя варианта: fl_variant_is(значение, "Имя"). */
fl_status tls_client_variant_svod1(fl_ctx *ctx, fl_value n0, fl_value n1,
                                   fl_value n2, fl_value n3, fl_value n4,
                                   fl_value *out, fl_error *error);

/* Сумма типов FTS «Ход блока SHA-1»: «Ход блока SHA-1». */
/* Дискриминант — имя варианта: fl_variant_is(значение, "Имя"). */
fl_status tls_client_variant_hod_bloka_sha_1(fl_ctx *ctx, fl_value raspisanie,
                                             fl_value svod, fl_value *out,
                                             fl_error *error);

/* Сумма типов FTS «Ход хеша SHA-1»: «Ход хеша SHA-1». */
/* Дискриминант — имя варианта: fl_variant_is(значение, "Имя"). */
fl_status tls_client_variant_hod_hesha_sha_1(fl_ctx *ctx, fl_value svod,
                                             fl_value bufer, fl_value nabrano,
                                             fl_value *out, fl_error *error);

/* Сумма типов FTS «Ход вывода SHA-1»: «Ход вывода SHA-1». */
/* Дискриминант — имя варианта: fl_variant_is(значение, "Имя"). */
fl_status tls_client_variant_hod_vyvoda_sha_1(fl_ctx *ctx, fl_value tekuschiy,
                                              fl_value nakopleno, fl_value *out,
                                              fl_error *error);

/* Сумма типов FTS «Перенос RSA»: «Перенос RSA». */
/* Дискриминант — имя варианта: fl_variant_is(значение, "Имя"). */
fl_status tls_client_variant_perenos_rsa(fl_ctx *ctx, fl_value stolbcy,
                                         fl_value perenos, fl_value *out,
                                         fl_error *error);

/* Сумма типов FTS «Заём RSA»: «Заём RSA». */
/* Дискриминант — имя варианта: fl_variant_is(значение, "Имя"). */
fl_status tls_client_variant_zayom_rsa(fl_ctx *ctx, fl_value stolbcy,
                                       fl_value zayom, fl_value *out,
                                       fl_error *error);

/* Сумма типов FTS «Ход Монтгомери»: «Ход Монтгомери». */
/* Дискриминант — имя варианта: fl_variant_is(значение, "Имя"). */
fl_status tls_client_variant_hod_montgomeri(fl_ctx *ctx, fl_value ostatok,
                                            fl_value perenos, fl_value *out,
                                            fl_error *error);

/* Сумма типов FTS «Хеш подписи»: «SHA-1» | «SHA-256». */
/* Дискриминант — имя варианта: fl_variant_is(значение, "Имя"). */
fl_status tls_client_variant_sha_1(fl_ctx *ctx, fl_value *out, fl_error *error);
fl_status tls_client_variant_sha_256(fl_ctx *ctx, fl_value *out,
                                     fl_error *error);

/* Сумма типов FTS «Ход маски»: «Ход маски». */
/* Дискриминант — имя варианта: fl_variant_is(значение, "Имя"). */
fl_status tls_client_variant_hod_maski(fl_ctx *ctx, fl_value nomer,
                                       fl_value nabrano, fl_value *out,
                                       fl_error *error);

/* Сумма типов FTS «Календарный день»: «Календарный день». */
/* Дискриминант — имя варианта: fl_variant_is(значение, "Имя"). */
fl_status tls_client_variant_kalendarnyy_den(fl_ctx *ctx, fl_value god,
                                             fl_value mesyac, fl_value sutki,
                                             fl_value *out, fl_error *error);

/* Сумма типов FTS «Часы»: «Часы». */
/* Дискриминант — имя варианта: fl_variant_is(значение, "Имя"). */
fl_status tls_client_variant_chasy(fl_ctx *ctx, fl_value chas, fl_value minuta,
                                   fl_value sekunda, fl_value *out,
                                   fl_error *error);

/* Сумма типов FTS «Отметка»: «Отметка». */
/* Дискриминант — имя варианта: fl_variant_is(значение, "Имя"). */
fl_status tls_client_variant_otmetka(fl_ctx *ctx, fl_value den, fl_value chasy,
                                     fl_value smeschenie, fl_value *out,
                                     fl_error *error);

/* Сумма типов FTS «Итог даты»: «Дата разобрана» | «Дата не разобрана». */
/* Дискриминант — имя варианта: fl_variant_is(значение, "Имя"). */
fl_status tls_client_variant_data_razobrana(fl_ctx *ctx, fl_value otmetka,
                                            fl_value *out, fl_error *error);
fl_status tls_client_variant_data_ne_razobrana(fl_ctx *ctx, fl_value prichina,
                                               fl_value *out, fl_error *error);

/* Сумма типов FTS «Длительность»: «Длительность». */
/* Дискриминант — имя варианта: fl_variant_is(значение, "Имя"). */
fl_status tls_client_variant_dlitelnost(fl_ctx *ctx, fl_value sekundy,
                                        fl_value *out, fl_error *error);

/* Сумма типов FTS «Интервал»: «Интервал». */
/* Дискриминант — имя варианта: fl_variant_is(значение, "Имя"). */
fl_status tls_client_variant_interval(fl_ctx *ctx, fl_value nachalo,
                                      fl_value konec, fl_value *out,
                                      fl_error *error);

/* Сумма типов FTS «Приговор пути»: «Путь годен» | «Путь отвергнут». */
/* Дискриминант — имя варианта: fl_variant_is(значение, "Имя"). */
fl_status tls_client_variant_put_goden(fl_ctx *ctx, fl_value *out,
                                       fl_error *error);
fl_status tls_client_variant_put_otvergnut(fl_ctx *ctx, fl_value kod,
                                           fl_value slova, fl_value *out,
                                           fl_error *error);

/* Сумма типов FTS «Шаг пути»: «Дошли» | «Идём выше». */
/* Дискриминант — имя варианта: fl_variant_is(значение, "Имя"). */
fl_status tls_client_variant_doshli(fl_ctx *ctx, fl_value prigovor,
                                    fl_value *out, fl_error *error);
fl_status tls_client_variant_idyom_vyshe(fl_ctx *ctx, fl_value *out,
                                         fl_error *error);

/* Сумма типов FTS «Вид строчки»: «Начало PEM» | «Конец PEM» | «Строчка тела». */
/* Дискриминант — имя варианта: fl_variant_is(значение, "Имя"). */
fl_status tls_client_variant_nachalo_pem(fl_ctx *ctx, fl_value *out,
                                         fl_error *error);
fl_status tls_client_variant_konec_pem(fl_ctx *ctx, fl_value *out,
                                       fl_error *error);
fl_status tls_client_variant_strochka_tela(fl_ctx *ctx, fl_value *out,
                                           fl_error *error);

/* Сумма типов FTS «Ход связки корней»: «Ход связки корней». */
/* Дискриминант — имя варианта: fl_variant_is(значение, "Имя"). */
fl_status tls_client_variant_hod_svyazki_korney(fl_ctx *ctx, fl_value vnutri,
                                                fl_value nabrano, fl_value tela,
                                                fl_value *out, fl_error *error);

/* Сумма типов FTS «Ход переноса»: «Ход переноса». */
/* Дискриминант — имя варианта: fl_variant_is(значение, "Имя"). */
fl_status tls_client_variant_hod_perenosa(fl_ctx *ctx, fl_value stolbcy,
                                          fl_value perenos, fl_value *out,
                                          fl_error *error);

/* Сумма типов FTS «Ход займа»: «Ход займа». */
/* Дискриминант — имя варианта: fl_variant_is(значение, "Имя"). */
fl_status tls_client_variant_hod_zayma(fl_ctx *ctx, fl_value stolbcy,
                                       fl_value zayom, fl_value *out,
                                       fl_error *error);

/* Сумма типов FTS «Ход лестницы»: «Ход лестницы». */
/* Дискриминант — имя варианта: fl_variant_is(значение, "Имя"). */
fl_status tls_client_variant_hod_lestnicy(fl_ctx *ctx, fl_value h2, fl_value z2,
                                          fl_value h3, fl_value z3,
                                          fl_value *out, fl_error *error);

/* Сумма типов FTS «Ход шифра»: «Ход шифра». */
/* Дискриминант — имя варианта: fl_variant_is(значение, "Имя"). */
fl_status tls_client_variant_hod_shifra(fl_ctx *ctx, fl_value rasshirenie,
                                        fl_value kvadrat, fl_value *out,
                                        fl_error *error);

/* Сумма типов FTS «Ход счёта»: «Ход счёта». */
/* Дискриминант — имя варианта: fl_variant_is(значение, "Имя"). */
fl_status tls_client_variant_hod_schyota(fl_ctx *ctx, fl_value perenos,
                                         fl_value bayty, fl_value *out,
                                         fl_error *error);

/* Сумма типов FTS «Ход гаммы»: «Ход гаммы». */
/* Дискриминант — имя варианта: fl_variant_is(значение, "Имя"). */
fl_status tls_client_variant_hod_gammy(fl_ctx *ctx, fl_value rasshirenie,
                                       fl_value schyotchik, fl_value gamma,
                                       fl_value poziciya, fl_value vyhod,
                                       fl_value *out, fl_error *error);

/* Сумма типов FTS «Ход поля»: «Ход поля». */
/* Дискриминант — имя варианта: fl_variant_is(значение, "Имя"). */
fl_status tls_client_variant_hod_polya(fl_ctx *ctx, fl_value nakopleno,
                                       fl_value sdvig, fl_value *out,
                                       fl_error *error);

/* Сумма типов FTS «Ход сдвига»: «Ход сдвига». */
/* Дискриминант — имя варианта: fl_variant_is(значение, "Имя"). */
fl_status tls_client_variant_hod_sdviga(fl_ctx *ctx, fl_value prezhniy,
                                        fl_value bayty, fl_value *out,
                                        fl_error *error);

/* Сумма типов FTS «Ход GHASH»: «Ход GHASH». */
/* Дискриминант — имя варианта: fl_variant_is(значение, "Имя"). */
fl_status tls_client_variant_hod_ghash(fl_ctx *ctx, fl_value klyuch,
                                       fl_value svod, fl_value bufer,
                                       fl_value nabrano, fl_value *out,
                                       fl_error *error);

/* Сумма типов FTS «Ход гаммы GCM»: «Ход гаммы GCM». */
/* Дискриминант — имя варианта: fl_variant_is(значение, "Имя"). */
fl_status tls_client_variant_hod_gammy_gcm(fl_ctx *ctx, fl_value klyuch,
                                           fl_value schyotchik, fl_value gamma,
                                           fl_value poziciya, fl_value vyhod,
                                           fl_value *out, fl_error *error);

/* Сумма типов FTS «Печать GCM»: «Печать GCM». */
/* Дискриминант — имя варианта: fl_variant_is(значение, "Имя"). */
fl_status tls_client_variant_pechat_gcm(fl_ctx *ctx, fl_value shifrotekst,
                                        fl_value teg, fl_value *out,
                                        fl_error *error);

/* Сумма типов FTS «Исход GCM»: «Расшифровано» | «Тег не сошёлся». */
/* Дискриминант — имя варианта: fl_variant_is(значение, "Имя"). */
fl_status tls_client_variant_rasshifrovano(fl_ctx *ctx, fl_value tekst,
                                           fl_value *out, fl_error *error);
fl_status tls_client_variant_teg_ne_soshyolsya(fl_ctx *ctx, fl_value poschitan,
                                               fl_value predyavlen,
                                               fl_value *out, fl_error *error);

/* Сумма типов FTS «Ход CBC»: «Ход CBC». */
/* Дискриминант — имя варианта: fl_variant_is(значение, "Имя"). */
fl_status tls_client_variant_hod_cbc(fl_ctx *ctx, fl_value klyuch,
                                     fl_value scepka, fl_value bufer,
                                     fl_value nabrano, fl_value vyhod,
                                     fl_value *out, fl_error *error);

/* Сумма типов FTS «Ход хвоста»: «Ход хвоста». */
/* Дискриминант — имя варианта: fl_variant_is(значение, "Имя"). */
fl_status tls_client_variant_hod_hvosta(fl_ctx *ctx, fl_value mesto,
                                        fl_value poslednee, fl_value *out,
                                        fl_error *error);

/* Сумма типов FTS «Ход сверки»: «Ход сверки». */
/* Дискриминант — имя варианта: fl_variant_is(значение, "Имя"). */
fl_status tls_client_variant_hod_sverki(fl_ctx *ctx, fl_value mesto,
                                        fl_value soshlos, fl_value *out,
                                        fl_error *error);

/* Сумма типов FTS «Обход записей»: «Обход записей». */
/* Дискриминант — имя варианта: fl_variant_is(значение, "Имя"). */
fl_status tls_client_variant_obhod_zapisey(fl_ctx *ctx, fl_value mesta,
                                           fl_value mesto, fl_value *out,
                                           fl_error *error);

/* Сумма типов FTS «Обход сообщений»: «Обход сообщений». */
/* Дискриминант — имя варианта: fl_variant_is(значение, "Имя"). */
fl_status tls_client_variant_obhod_soobscheniy(fl_ctx *ctx, fl_value mesta,
                                               fl_value mesto, fl_value *out,
                                               fl_error *error);

/* Сумма типов FTS «Вид записи TLS»: «Смена шифра» | «Тревога» | «Рукопожатие» | «Закрытая» | «Чужая». */
/* Дискриминант — имя варианта: fl_variant_is(значение, "Имя"). */
fl_status tls_client_variant_smena_shifra(fl_ctx *ctx, fl_value *out,
                                          fl_error *error);
fl_status tls_client_variant_trevoga(fl_ctx *ctx, fl_value *out,
                                     fl_error *error);
fl_status tls_client_variant_rukopozhatie(fl_ctx *ctx, fl_value *out,
                                          fl_error *error);
fl_status tls_client_variant_zakrytaya(fl_ctx *ctx, fl_value *out,
                                       fl_error *error);
fl_status tls_client_variant_chuzhaya(fl_ctx *ctx, fl_value *out,
                                      fl_error *error);

/* Сумма типов FTS «Итог полёта»: «Полёт готов» | «Полёт ждёт» | «Полёт отвергнут». */
/* Дискриминант — имя варианта: fl_variant_is(значение, "Имя"). */
fl_status tls_client_variant_polyot_gotov(fl_ctx *ctx, fl_value polyot,
                                          fl_value *out, fl_error *error);
fl_status tls_client_variant_polyot_zhdyot(fl_ctx *ctx, fl_value *out,
                                           fl_error *error);
fl_status tls_client_variant_polyot_otvergnut(fl_ctx *ctx, fl_value kod,
                                              fl_value slova, fl_value *out,
                                              fl_error *error);

/* Сумма типов FTS «Итог рукопожатия»: «Ждать» | «Отказ рукопожатия» | «Рукопожатие готово». */
/* Дискриминант — имя варианта: fl_variant_is(значение, "Имя"). */
fl_status tls_client_variant_zhdat(fl_ctx *ctx, fl_value *out, fl_error *error);
fl_status tls_client_variant_otkaz_rukopozhatiya(fl_ctx *ctx, fl_value kod,
                                                 fl_value slova, fl_value *out,
                                                 fl_error *error);
fl_status tls_client_variant_rukopozhatie_gotovo(fl_ctx *ctx, fl_value oktety,
                                                 fl_value klyuch,
                                                 fl_value vektor,
                                                 fl_value zapisey,
                                                 fl_value *out,
                                                 fl_error *error);

/*
 * Функция flang «Целая часть».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param znachenie — «значение»: число
 * @return значение: число
 */
fl_status tls_client_celaya_chast(fl_ctx *ctx, fl_value znachenie,
                                  fl_value *result, fl_error *error);

/*
 * Функция flang «Одинокий суррогат».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param kod — «код»: число
 * @return значение
 */
fl_status tls_client_odinokiy_surrogat(fl_ctx *ctx, fl_value kod,
                                       fl_value *result, fl_error *error);

/*
 * Функция flang «Байты кодовой точки».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param kod — «код»: число
 * @return значение: список: число
 */
fl_status tls_client_bayty_kodovoy_tochki(fl_ctx *ctx, fl_value kod,
                                          fl_value *result, fl_error *error);

/*
 * Функция flang «Байтов в точке».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param kod — «код»: число
 * @return значение: число
 */
fl_status tls_client_baytov_v_tochke(fl_ctx *ctx, fl_value kod,
                                     fl_value *result, fl_error *error);

/*
 * Функция flang «Досыпать байты».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param gotovye — «готовые»: список: число
 * @param dobavka — «добавка»: список: число
 * @return значение: список: число
 */
fl_status tls_client_dosypat_bayty(fl_ctx *ctx, fl_value gotovye,
                                   fl_value dobavka, fl_value *result,
                                   fl_error *error);

/*
 * Функция flang «Кодовые точки текста».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param tekst — «текст»: строка
 * @return значение: список: число
 */
fl_status tls_client_kodovye_tochki_teksta(fl_ctx *ctx, fl_value tekst,
                                           fl_value *result, fl_error *error);

/*
 * Функция flang «Байты текста».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param tekst — «текст»: строка
 * @return значение: список: число
 */
fl_status tls_client_bayty_teksta(fl_ctx *ctx, fl_value tekst, fl_value *result,
                                  fl_error *error);

/*
 * Функция flang «Длина в байтах».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param tekst — «текст»: строка
 * @return значение: число
 */
fl_status tls_client_dlina_v_baytah(fl_ctx *ctx, fl_value tekst,
                                    fl_value *result, fl_error *error);

/*
 * Функция flang «Текст без одиноких суррогатов».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param tekst — «текст»: строка
 * @return значение
 */
fl_status tls_client_tekst_bez_odinokih_surrogatov(fl_ctx *ctx, fl_value tekst,
                                                   fl_value *result,
                                                   fl_error *error);

/*
 * Функция flang «Начало разбора utf8».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @return значение: «Ход разбора utf8»
 */
fl_status tls_client_nachalo_razbora_utf8(fl_ctx *ctx, fl_value *result,
                                          fl_error *error);

/*
 * Функция flang «Начать байт».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param tochki — «точки»: список: число
 * @param zamescheniy — «замещений»: число
 * @param bayt — «байт»: число
 * @return значение: «Ход разбора utf8»
 */
fl_status tls_client_nachat_bayt(fl_ctx *ctx, fl_value tochki,
                                 fl_value zamescheniy, fl_value bayt,
                                 fl_value *result, fl_error *error);

/*
 * Функция flang «Шаг разбора utf8».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param hod — «ход»: «Ход разбора utf8»
 * @param bayt — «байт»: число
 * @return значение: «Ход разбора utf8»
 */
fl_status tls_client_shag_razbora_utf8(fl_ctx *ctx, fl_value hod, fl_value bayt,
                                       fl_value *result, fl_error *error);

/*
 * Функция flang «Закрыть разбор utf8».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param hod — «ход»: «Ход разбора utf8»
 * @return значение: список: число
 */
fl_status tls_client_zakryt_razbor_utf8(fl_ctx *ctx, fl_value hod,
                                        fl_value *result, fl_error *error);

/*
 * Функция flang «Кодовые точки из байтов».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param bayty — «байты»: список: число
 * @return значение: список: число
 */
fl_status tls_client_kodovye_tochki_iz_baytov(fl_ctx *ctx, fl_value bayty,
                                              fl_value *result,
                                              fl_error *error);

/*
 * Функция flang «Байты годны как UTF-8».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param bayty — «байты»: список: число
 * @return значение
 */
fl_status tls_client_bayty_godny_kak_utf_8(fl_ctx *ctx, fl_value bayty,
                                           fl_value *result, fl_error *error);

/*
 * Функция flang «Круговой ход держится».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param tekst — «текст»: строка
 * @return значение
 */
fl_status tls_client_krugovoy_hod_derzhitsya(fl_ctx *ctx, fl_value tekst,
                                             fl_value *result, fl_error *error);

/*
 * Функция flang «Списки точек равны».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param pervyy — «первый»: список: число
 * @param vtoroy — «второй»: список: число
 * @return значение
 */
fl_status tls_client_spiski_tochek_ravny(fl_ctx *ctx, fl_value pervyy,
                                         fl_value vtoroy, fl_value *result,
                                         fl_error *error);

/*
 * Функция flang «Октет».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param oktety — «октеты»: список: число
 * @param mesto — «место»: число
 * @return значение: число
 */
fl_status tls_client_oktet(fl_ctx *ctx, fl_value oktety, fl_value mesto,
                           fl_value *result, fl_error *error);

/*
 * Функция flang «Шаг куска».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param hod — «ход»: «Ход куска»
 * @param oktet — «октет»: число
 * @param nachalo — «начало»: число
 * @param konec — «конец»: число
 * @return значение: «Ход куска»
 */
fl_status tls_client_shag_kuska(fl_ctx *ctx, fl_value hod, fl_value oktet,
                                fl_value nachalo, fl_value konec,
                                fl_value *result, fl_error *error);

/*
 * Функция flang «Ход по куску».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param oktety — «октеты»: список: число
 * @param nachalo — «начало»: число
 * @param konec — «конец»: число
 * @return значение: «Ход куска»
 */
fl_status tls_client_hod_po_kusku(fl_ctx *ctx, fl_value oktety,
                                  fl_value nachalo, fl_value konec,
                                  fl_value *result, fl_error *error);

/*
 * Функция flang «Кусок».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param oktety — «октеты»: список: число
 * @param nachalo — «начало»: число
 * @param konec — «конец»: число
 * @return значение: список: число
 */
fl_status tls_client_kusok(fl_ctx *ctx, fl_value oktety, fl_value nachalo,
                           fl_value konec, fl_value *result, fl_error *error);

/*
 * Функция flang «Отбросить начало».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * Хвостовой самовызов развёрнут в цикл: стек не растёт.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param oktety — «октеты»: список: число
 * @param skolko — «сколько»: число
 * @return значение: список: число
 */
fl_status tls_client_otbrosit_nachalo(fl_ctx *ctx, fl_value oktety,
                                      fl_value skolko, fl_value *result,
                                      fl_error *error);

/*
 * Функция flang «Взять начало».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param oktety — «октеты»: список: число
 * @param skolko — «сколько»: число
 * @return значение: список: число
 */
fl_status tls_client_vzyat_nachalo(fl_ctx *ctx, fl_value oktety,
                                   fl_value skolko, fl_value *result,
                                   fl_error *error);

/*
 * Функция flang «Делить нацело».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param delimoe — «делимое»: число
 * @param delitel — «делитель»: число
 * @return значение: число
 */
fl_status tls_client_delit_nacelo(fl_ctx *ctx, fl_value delimoe,
                                  fl_value delitel, fl_value *result,
                                  fl_error *error);

/*
 * Функция flang «Разобрать меру».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param oktety — «октеты»: список: число
 * @param mesto — «место»: число
 * @return значение: «Мера DER»
 */
fl_status tls_client_razobrat_meru(fl_ctx *ctx, fl_value oktety, fl_value mesto,
                                   fl_value *result, fl_error *error);

/*
 * Функция flang «Число из октетов».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param oktety — «октеты»: список: число
 * @return значение: число
 */
fl_status tls_client_chislo_iz_oktetov(fl_ctx *ctx, fl_value oktety,
                                       fl_value *result, fl_error *error);

/*
 * Функция flang «Разобрать голову».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param oktety — «октеты»: список: число
 * @param mesto — «место»: число
 * @return значение: «Голова DER»
 */
fl_status tls_client_razobrat_golovu(fl_ctx *ctx, fl_value oktety,
                                     fl_value mesto, fl_value *result,
                                     fl_error *error);

/*
 * Функция flang «Собрать голову».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param oktety — «октеты»: список: число
 * @param mesto — «место»: число
 * @param mera — «мера»: «Мера DER»
 * @return значение: «Голова DER»
 */
fl_status tls_client_sobrat_golovu(fl_ctx *ctx, fl_value oktety, fl_value mesto,
                                   fl_value mera, fl_value *result,
                                   fl_error *error);

/*
 * Функция flang «Содержимое».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param oktety — «октеты»: список: число
 * @param mesto — «место»: число
 * @return значение: список: число
 */
fl_status tls_client_soderzhimoe(fl_ctx *ctx, fl_value oktety, fl_value mesto,
                                 fl_value *result, fl_error *error);

/*
 * Функция flang «Шаг обхода».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param hod — «ход»: «Обход DER»
 * @param oktety — «октеты»: список: число
 * @param konec — «конец»: число
 * @return значение: «Обход DER»
 */
fl_status tls_client_shag_obhoda(fl_ctx *ctx, fl_value hod, fl_value oktety,
                                 fl_value konec, fl_value *result,
                                 fl_error *error);

/*
 * Функция flang «Шаг вперёд».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param hod — «ход»: «Обход DER»
 * @param golova — «голова»: «Голова DER»
 * @param konec — «конец»: число
 * @return значение: «Обход DER»
 */
fl_status tls_client_shag_vperyod(fl_ctx *ctx, fl_value hod, fl_value golova,
                                  fl_value konec, fl_value *result,
                                  fl_error *error);

/*
 * Функция flang «Ход по вложенным».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param oktety — «октеты»: список: число
 * @param mesto — «место»: число
 * @return значение: «Обход DER»
 */
fl_status tls_client_hod_po_vlozhennym(fl_ctx *ctx, fl_value oktety,
                                       fl_value mesto, fl_value *result,
                                       fl_error *error);

/*
 * Функция flang «Вложенные».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param oktety — «октеты»: список: число
 * @param mesto — «место»: число
 * @return значение: список: число
 */
fl_status tls_client_vlozhennye(fl_ctx *ctx, fl_value oktety, fl_value mesto,
                                fl_value *result, fl_error *error);

/*
 * Функция flang «Вложенное по счёту».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param oktety — «октеты»: список: число
 * @param mesto — «место»: число
 * @param nomer — «номер»: число
 * @return значение: число
 */
fl_status tls_client_vlozhennoe_po_schyotu(fl_ctx *ctx, fl_value oktety,
                                           fl_value mesto, fl_value nomer,
                                           fl_value *result, fl_error *error);

/*
 * Функция flang «Целое DER».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param oktety — «октеты»: список: число
 * @return значение: число
 */
fl_status tls_client_celoe_der(fl_ctx *ctx, fl_value oktety, fl_value *result,
                               fl_error *error);

/*
 * Функция flang «Цифра DER».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param n — «н»: число
 * @return значение: строка
 */
fl_status tls_client_cifra_der(fl_ctx *ctx, fl_value n, fl_value *result,
                               fl_error *error);

/*
 * Функция flang «Октет шестнадцатеричным».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param oktet — «октет»: число
 * @return значение: строка
 */
fl_status tls_client_oktet_shestnadcaterichnym(fl_ctx *ctx, fl_value oktet,
                                               fl_value *result,
                                               fl_error *error);

/*
 * Функция flang «Шаг шестнадцатеричного».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param nabrano — «набрано»: строка
 * @param oktet — «октет»: число
 * @return значение: строка
 */
fl_status tls_client_shag_shestnadcaterichnogo(fl_ctx *ctx, fl_value nabrano,
                                               fl_value oktet, fl_value *result,
                                               fl_error *error);

/*
 * Функция flang «Октеты шестнадцатеричным».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param oktety — «октеты»: список: число
 * @return значение: строка
 */
fl_status tls_client_oktety_shestnadcaterichnym(fl_ctx *ctx, fl_value oktety,
                                                fl_value *result,
                                                fl_error *error);

/*
 * Функция flang «Шаг двоеточий».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param nabrano — «набрано»: строка
 * @param oktet — «октет»: число
 * @return значение: строка
 */
fl_status tls_client_shag_dvoetochiy(fl_ctx *ctx, fl_value nabrano,
                                     fl_value oktet, fl_value *result,
                                     fl_error *error);

/*
 * Функция flang «Октеты двоеточиями».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param oktety — «октеты»: список: число
 * @return значение: строка
 */
fl_status tls_client_oktety_dvoetochiyami(fl_ctx *ctx, fl_value oktety,
                                          fl_value *result, fl_error *error);

/*
 * Функция flang «Знак октета».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param oktet — «октет»: число
 * @return значение: строка
 */
fl_status tls_client_znak_okteta(fl_ctx *ctx, fl_value oktet, fl_value *result,
                                 fl_error *error);

/*
 * Функция flang «Строка DER».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param oktety — «октеты»: список: число
 * @return значение: строка
 */
fl_status tls_client_stroka_der(fl_ctx *ctx, fl_value oktety, fl_value *result,
                                fl_error *error);

/*
 * Функция flang «Закрыть узел OID».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param hod — «ход»: «Ход OID»
 * @param znachenie — «значение»: число
 * @return значение: «Ход OID»
 */
fl_status tls_client_zakryt_uzel_oid(fl_ctx *ctx, fl_value hod,
                                     fl_value znachenie, fl_value *result,
                                     fl_error *error);

/*
 * Функция flang «Шаг OID».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param hod — «ход»: «Ход OID»
 * @param oktet — «октет»: число
 * @return значение: «Ход OID»
 */
fl_status tls_client_shag_oid(fl_ctx *ctx, fl_value hod, fl_value oktet,
                              fl_value *result, fl_error *error);

/*
 * Функция flang «Идентификатор объекта».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param oktety — «октеты»: список: число
 * @return значение: строка
 */
fl_status tls_client_identifikator_obekta(fl_ctx *ctx, fl_value oktety,
                                          fl_value *result, fl_error *error);

/*
 * Функция flang «Цифра октета».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param oktet — «октет»: число
 * @return значение: число
 */
fl_status tls_client_cifra_okteta(fl_ctx *ctx, fl_value oktet, fl_value *result,
                                  fl_error *error);

/*
 * Функция flang «Двузначное».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param oktety — «октеты»: список: число
 * @param mesto — «место»: число
 * @return значение: число
 */
fl_status tls_client_dvuznachnoe(fl_ctx *ctx, fl_value oktety, fl_value mesto,
                                 fl_value *result, fl_error *error);

/*
 * Функция flang «Разобрать время».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param metka — «метка»: число
 * @param oktety — «октеты»: список: число
 * @return значение: «Время DER»
 */
fl_status tls_client_razobrat_vremya(fl_ctx *ctx, fl_value metka,
                                     fl_value oktety, fl_value *result,
                                     fl_error *error);

/*
 * Функция flang «Название месяца».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param mesyac — «месяц»: число
 * @return значение: строка
 */
fl_status tls_client_nazvanie_mesyaca(fl_ctx *ctx, fl_value mesyac,
                                      fl_value *result, fl_error *error);

/*
 * Функция flang «Два знака».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param n — «н»: число
 * @return значение: строка
 */
fl_status tls_client_dva_znaka(fl_ctx *ctx, fl_value n, fl_value *result,
                               fl_error *error);

/*
 * Функция flang «Время как у openssl».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param vremya — «время»: «Время DER»
 * @return значение: строка
 */
fl_status tls_client_vremya_kak_u_openssl(fl_ctx *ctx, fl_value vremya,
                                          fl_value *result, fl_error *error);

/*
 * Функция flang «Время числом».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param vremya — «время»: «Время DER»
 * @return значение: число
 */
fl_status tls_client_vremya_chislom(fl_ctx *ctx, fl_value vremya,
                                    fl_value *result, fl_error *error);

/*
 * Функция flang «Азбука 64».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @return значение: строка
 */
fl_status tls_client_azbuka_64(fl_ctx *ctx, fl_value *result, fl_error *error);

/*
 * Функция flang «Азбука 64 для адреса».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @return значение: строка
 */
fl_status tls_client_azbuka_64_dlya_adresa(fl_ctx *ctx, fl_value *result,
                                           fl_error *error);

/*
 * Функция flang «Знак 64».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param shestyorka — «шестёрка»: число
 * @return значение: строка
 */
fl_status tls_client_znak_64(fl_ctx *ctx, fl_value shestyorka, fl_value *result,
                             fl_error *error);

/*
 * Функция flang «Знак 64 для адреса».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param shestyorka — «шестёрка»: число
 * @return значение: строка
 */
fl_status tls_client_znak_64_dlya_adresa(fl_ctx *ctx, fl_value shestyorka,
                                         fl_value *result, fl_error *error);

/*
 * Функция flang «Значение знака 64».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param kod — «код»: число
 * @return значение: число
 */
fl_status tls_client_znachenie_znaka_64(fl_ctx *ctx, fl_value kod,
                                        fl_value *result, fl_error *error);

/*
 * Функция flang «Это знак 64».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param znak — «знак»: строка
 * @return значение
 */
fl_status tls_client_eto_znak_64(fl_ctx *ctx, fl_value znak, fl_value *result,
                                 fl_error *error);

/*
 * Функция flang «Первая шестёрка».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param bayt — «байт»: число
 * @return значение: число
 */
fl_status tls_client_pervaya_shestyorka(fl_ctx *ctx, fl_value bayt,
                                        fl_value *result, fl_error *error);

/*
 * Функция flang «Вторая шестёрка».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param pervyy — «первый»: число
 * @param vtoroy — «второй»: число
 * @return значение: число
 */
fl_status tls_client_vtoraya_shestyorka(fl_ctx *ctx, fl_value pervyy,
                                        fl_value vtoroy, fl_value *result,
                                        fl_error *error);

/*
 * Функция flang «Третья шестёрка».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param vtoroy — «второй»: число
 * @param tretiy — «третий»: число
 * @return значение: число
 */
fl_status tls_client_tretya_shestyorka(fl_ctx *ctx, fl_value vtoroy,
                                       fl_value tretiy, fl_value *result,
                                       fl_error *error);

/*
 * Функция flang «Четвёртая шестёрка».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param bayt — «байт»: число
 * @return значение: число
 */
fl_status tls_client_chetvyortaya_shestyorka(fl_ctx *ctx, fl_value bayt,
                                             fl_value *result, fl_error *error);

/*
 * Функция flang «Тройка байтов».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param pervyy — «первый»: число
 * @param vtoroy — «второй»: число
 * @param tretiy — «третий»: число
 * @return значение: строка
 */
fl_status tls_client_troyka_baytov(fl_ctx *ctx, fl_value pervyy,
                                   fl_value vtoroy, fl_value tretiy,
                                   fl_value *result, fl_error *error);

/*
 * Функция flang «Шаг кодирования».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param hod — «ход»: «Ход кодирования 64»
 * @param bayt — «байт»: число
 * @return значение: «Ход кодирования 64»
 */
fl_status tls_client_shag_kodirovaniya(fl_ctx *ctx, fl_value hod, fl_value bayt,
                                       fl_value *result, fl_error *error);

/*
 * Функция flang «Закрыть кодирование».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param hod — «ход»: «Ход кодирования 64»
 * @return значение: строка
 */
fl_status tls_client_zakryt_kodirovanie(fl_ctx *ctx, fl_value hod,
                                        fl_value *result, fl_error *error);

/*
 * Функция flang «Закодировать байты».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param bayty — «байты»: список: число
 * @return значение: строка
 */
fl_status tls_client_zakodirovat_bayty(fl_ctx *ctx, fl_value bayty,
                                       fl_value *result, fl_error *error);

/*
 * Функция flang «Сложить шестёрку».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param gotovye — «готовые»: список: число
 * @param skolko — «сколько»: число
 * @param nabralos — «набралось»: число
 * @return значение: «Ход раскодирования 64»
 */
fl_status tls_client_slozhit_shestyorku(fl_ctx *ctx, fl_value gotovye,
                                        fl_value skolko, fl_value nabralos,
                                        fl_value *result, fl_error *error);

/*
 * Функция flang «Свести шестёрку».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param hod — «ход»: «Ход раскодирования 64»
 * @param znachenie — «значение»: число
 * @return значение: «Ход раскодирования 64»
 */
fl_status tls_client_svesti_shestyorku(fl_ctx *ctx, fl_value hod,
                                       fl_value znachenie, fl_value *result,
                                       fl_error *error);

/*
 * Функция flang «Шаг раскодирования 64».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param hod — «ход»: «Ход раскодирования 64»
 * @param znak — «знак»: строка
 * @return значение: «Ход раскодирования 64»
 */
fl_status tls_client_shag_raskodirovaniya_64(fl_ctx *ctx, fl_value hod,
                                             fl_value znak, fl_value *result,
                                             fl_error *error);

/*
 * Функция flang «Закрыть раскодирование».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param hod — «ход»: «Ход раскодирования 64»
 * @return значение: список: число
 */
fl_status tls_client_zakryt_raskodirovanie(fl_ctx *ctx, fl_value hod,
                                           fl_value *result, fl_error *error);

/*
 * Функция flang «Раскодировать в байты».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param kod — «код»: строка
 * @return значение: список: число
 */
fl_status tls_client_raskodirovat_v_bayty(fl_ctx *ctx, fl_value kod,
                                          fl_value *result, fl_error *error);

/*
 * Функция flang «Приписать строку в начало».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param pervaya — «первая»: строка
 * @param elementy — «элементы»: список: строка
 * @return значение: список: строка
 */
fl_status tls_client_pripisat_stroku_v_nachalo(fl_ctx *ctx, fl_value pervaya,
                                               fl_value elementy,
                                               fl_value *result,
                                               fl_error *error);

/*
 * Функция flang «Шаг склейки строк».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param hod — «ход»: строка
 * @param razdelitel — «разделитель»: строка
 * @param chast — «часть»: строка
 * @return значение: строка
 */
fl_status tls_client_shag_skleyki_strok(fl_ctx *ctx, fl_value hod,
                                        fl_value razdelitel, fl_value chast,
                                        fl_value *result, fl_error *error);

/*
 * Функция flang «Соединить строки».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param chasti — «части»: список: строка
 * @param razdelitel — «разделитель»: строка
 * @return значение: строка
 */
fl_status tls_client_soedinit_stroki(fl_ctx *ctx, fl_value chasti,
                                     fl_value razdelitel, fl_value *result,
                                     fl_error *error);

/*
 * Функция flang «Разбить по символу».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param tekst — «текст»: строка
 * @param razdelitel — «разделитель»: строка
 * @return значение: список: строка
 */
fl_status tls_client_razbit_po_simvolu(fl_ctx *ctx, fl_value tekst,
                                       fl_value razdelitel, fl_value *result,
                                       fl_error *error);

/*
 * Функция flang «Заменить».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param tekst — «текст»: строка
 * @param chto — «что»: строка
 * @param chem — «чем»: строка
 * @return значение: строка
 */
fl_status tls_client_zamenit(fl_ctx *ctx, fl_value tekst, fl_value chto,
                             fl_value chem, fl_value *result, fl_error *error);

/*
 * Функция flang «Считать символ».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param tekst — «текст»: строка
 * @param bukva — «буква»: строка
 * @return значение: число
 */
fl_status tls_client_schitat_simvol(fl_ctx *ctx, fl_value tekst, fl_value bukva,
                                    fl_value *result, fl_error *error);

/*
 * Функция flang «Позиция подстроки».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param tekst — «текст»: строка
 * @param chast — «часть»: строка
 * @return значение: число
 */
fl_status tls_client_poziciya_podstroki(fl_ctx *ctx, fl_value tekst,
                                        fl_value chast, fl_value *result,
                                        fl_error *error);

/*
 * Функция flang «Начинается с».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param tekst — «текст»: строка
 * @param prefiks — «префикс»: строка
 * @return значение
 */
fl_status tls_client_nachinaetsya_s(fl_ctx *ctx, fl_value tekst,
                                    fl_value prefiks, fl_value *result,
                                    fl_error *error);

/*
 * Функция flang «Заканчивается на».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param tekst — «текст»: строка
 * @param suffiks — «суффикс»: строка
 * @return значение
 */
fl_status tls_client_zakanchivaetsya_na(fl_ctx *ctx, fl_value tekst,
                                        fl_value suffiks, fl_value *result,
                                        fl_error *error);

/*
 * Функция flang «Заглавная буква».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param bukva — «буква»: строка
 * @return значение: строка
 */
fl_status tls_client_zaglavnaya_bukva(fl_ctx *ctx, fl_value bukva,
                                      fl_value *result, fl_error *error);

/*
 * Функция flang «Строчная буква».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param bukva — «буква»: строка
 * @return значение: строка
 */
fl_status tls_client_strochnaya_bukva(fl_ctx *ctx, fl_value bukva,
                                      fl_value *result, fl_error *error);

/*
 * Функция flang «Шаг в верхний регистр».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param hod — «ход»: строка
 * @param bukva — «буква»: строка
 * @return значение: строка
 */
fl_status tls_client_shag_v_verhniy_registr(fl_ctx *ctx, fl_value hod,
                                            fl_value bukva, fl_value *result,
                                            fl_error *error);

/*
 * Функция flang «В верхний регистр».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param tekst — «текст»: строка
 * @return значение: строка
 */
fl_status tls_client_v_verhniy_registr(fl_ctx *ctx, fl_value tekst,
                                       fl_value *result, fl_error *error);

/*
 * Функция flang «Шаг в нижний регистр».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param hod — «ход»: строка
 * @param bukva — «буква»: строка
 * @return значение: строка
 */
fl_status tls_client_shag_v_nizhniy_registr(fl_ctx *ctx, fl_value hod,
                                            fl_value bukva, fl_value *result,
                                            fl_error *error);

/*
 * Функция flang «В нижний регистр».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param tekst — «текст»: строка
 * @return значение: строка
 */
fl_status tls_client_v_nizhniy_registr(fl_ctx *ctx, fl_value tekst,
                                       fl_value *result, fl_error *error);

/*
 * Функция flang «Символы».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param tekst — «текст»: строка
 * @return значение: список: строка
 */
fl_status tls_client_simvoly(fl_ctx *ctx, fl_value tekst, fl_value *result,
                             fl_error *error);

/*
 * Функция flang «Шаг обращения строки».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param hod — «ход»: строка
 * @param bukva — «буква»: строка
 * @return значение: строка
 */
fl_status tls_client_shag_obrascheniya_stroki(fl_ctx *ctx, fl_value hod,
                                              fl_value bukva, fl_value *result,
                                              fl_error *error);

/*
 * Функция flang «Обратить строку».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param tekst — «текст»: строка
 * @return значение: строка
 */
fl_status tls_client_obratit_stroku(fl_ctx *ctx, fl_value tekst,
                                    fl_value *result, fl_error *error);

/*
 * Функция flang «Палиндром».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param tekst — «текст»: строка
 * @return значение
 */
fl_status tls_client_palindrom(fl_ctx *ctx, fl_value tekst, fl_value *result,
                               fl_error *error);

/*
 * Функция flang «Повторить».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param tekst — «текст»: строка
 * @param raz — «раз»: число
 * @return значение: строка
 */
fl_status tls_client_povtorit(fl_ctx *ctx, fl_value tekst, fl_value raz,
                              fl_value *result, fl_error *error);

/*
 * Функция flang «Шаг обрезки слева».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param hod — «ход»: «Обрезка слева»
 * @param znak — «знак»: строка
 * @return значение: «Обрезка слева»
 */
fl_status tls_client_shag_obrezki_sleva(fl_ctx *ctx, fl_value hod,
                                        fl_value znak, fl_value *result,
                                        fl_error *error);

/*
 * Функция flang «Обрезать слева».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param tekst — «текст»: строка
 * @return значение: строка
 */
fl_status tls_client_obrezat_sleva(fl_ctx *ctx, fl_value tekst,
                                   fl_value *result, fl_error *error);

/*
 * Функция flang «Шаг обрезки справа».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param hod — «ход»: «Обрезка справа»
 * @param znak — «знак»: строка
 * @return значение: «Обрезка справа»
 */
fl_status tls_client_shag_obrezki_sprava(fl_ctx *ctx, fl_value hod,
                                         fl_value znak, fl_value *result,
                                         fl_error *error);

/*
 * Функция flang «Обрезать справа».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param tekst — «текст»: строка
 * @return значение: строка
 */
fl_status tls_client_obrezat_sprava(fl_ctx *ctx, fl_value tekst,
                                    fl_value *result, fl_error *error);

/*
 * Функция flang «Обрезать пробелы».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param tekst — «текст»: строка
 * @return значение: строка
 */
fl_status tls_client_obrezat_probely(fl_ctx *ctx, fl_value tekst,
                                     fl_value *result, fl_error *error);

/*
 * Функция flang «Первый символ».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param tekst — «текст»: строка
 * @return значение: строка
 */
fl_status tls_client_pervyy_simvol(fl_ctx *ctx, fl_value tekst,
                                   fl_value *result, fl_error *error);

/*
 * Функция flang «Шаг последнего символа».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param hod — «ход»: строка
 * @param znak — «знак»: строка
 * @return значение: строка
 */
fl_status tls_client_shag_poslednego_simvola(fl_ctx *ctx, fl_value hod,
                                             fl_value znak, fl_value *result,
                                             fl_error *error);

/*
 * Функция flang «Последний символ».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param tekst — «текст»: строка
 * @return значение: строка
 */
fl_status tls_client_posledniy_simvol(fl_ctx *ctx, fl_value tekst,
                                      fl_value *result, fl_error *error);

/*
 * Функция flang «Это цифра».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param znak — «знак»: строка
 * @return значение
 */
fl_status tls_client_eto_cifra(fl_ctx *ctx, fl_value znak, fl_value *result,
                               fl_error *error);

/*
 * Функция flang «Это пробел».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param znak — «знак»: строка
 * @return значение
 */
fl_status tls_client_eto_probel(fl_ctx *ctx, fl_value znak, fl_value *result,
                                fl_error *error);

/*
 * Функция flang «Это латинская буква».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param znak — «знак»: строка
 * @return значение
 */
fl_status tls_client_eto_latinskaya_bukva(fl_ctx *ctx, fl_value znak,
                                          fl_value *result, fl_error *error);

/*
 * Функция flang «Шаг только цифр».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param hod — «ход»
 * @param znak — «знак»: строка
 * @return значение
 */
fl_status tls_client_shag_tolko_cifr(fl_ctx *ctx, fl_value hod, fl_value znak,
                                     fl_value *result, fl_error *error);

/*
 * Функция flang «Только цифры».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param tekst — «текст»: строка
 * @return значение
 */
fl_status tls_client_tolko_cifry(fl_ctx *ctx, fl_value tekst, fl_value *result,
                                 fl_error *error);

/*
 * Функция flang «Цифра числом».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param znak — «знак»: строка
 * @return значение: число
 */
fl_status tls_client_cifra_chislom(fl_ctx *ctx, fl_value znak, fl_value *result,
                                   fl_error *error);

/*
 * Функция flang «Сколько дополнить».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param shirina — «ширина»: «неотрицательное»
 * @param nabrano — «набрано»: «неотрицательное»
 * @return значение: число
 */
fl_status tls_client_skolko_dopolnit(fl_ctx *ctx, fl_value shirina,
                                     fl_value nabrano, fl_value *result,
                                     fl_error *error);

/*
 * Функция flang «Дополнить слева».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param tekst — «текст»: строка
 * @param shirina — «ширина»: «неотрицательное»
 * @param znak — «знак»: строка
 * @return значение: строка
 */
fl_status tls_client_dopolnit_sleva(fl_ctx *ctx, fl_value tekst,
                                    fl_value shirina, fl_value znak,
                                    fl_value *result, fl_error *error);

/*
 * Функция flang «Дополнить справа».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param tekst — «текст»: строка
 * @param shirina — «ширина»: «неотрицательное»
 * @param znak — «знак»: строка
 * @return значение: строка
 */
fl_status tls_client_dopolnit_sprava(fl_ctx *ctx, fl_value tekst,
                                     fl_value shirina, fl_value znak,
                                     fl_value *result, fl_error *error);

/*
 * Функция flang «Без знака».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param tekst — «текст»: строка
 * @param znak — «знак»: строка
 * @return значение: строка
 */
fl_status tls_client_bez_znaka(fl_ctx *ctx, fl_value tekst, fl_value znak,
                               fl_value *result, fl_error *error);

/*
 * Функция flang «Урезать».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param tekst — «текст»: строка
 * @param predel — «предел»: «неотрицательное»
 * @return значение: строка
 */
fl_status tls_client_urezat(fl_ctx *ctx, fl_value tekst, fl_value predel,
                            fl_value *result, fl_error *error);

/*
 * Функция flang «Строка не окаймление».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param strochka — «строчка»: строка
 * @return значение
 */
fl_status tls_client_stroka_ne_okaymlenie(fl_ctx *ctx, fl_value strochka,
                                          fl_value *result, fl_error *error);

/*
 * Функция flang «Шаг тела PEM».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param nabrano — «набрано»: строка
 * @param strochka — «строчка»: строка
 * @return значение: строка
 */
fl_status tls_client_shag_tela_pem(fl_ctx *ctx, fl_value nabrano,
                                   fl_value strochka, fl_value *result,
                                   fl_error *error);

/*
 * Функция flang «Тело PEM».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param tekst — «текст»: строка
 * @return значение: строка
 */
fl_status tls_client_telo_pem(fl_ctx *ctx, fl_value tekst, fl_value *result,
                              fl_error *error);

/*
 * Функция flang «Октеты сертификата из PEM».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param tekst — «текст»: строка
 * @return значение: список: число
 */
fl_status tls_client_oktety_sertifikata_iz_pem(fl_ctx *ctx, fl_value tekst,
                                               fl_value *result,
                                               fl_error *error);

/*
 * Функция flang «Место тела сертификата».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param oktety — «октеты»: список: число
 * @return значение: число
 */
fl_status tls_client_mesto_tela_sertifikata(fl_ctx *ctx, fl_value oktety,
                                            fl_value *result, fl_error *error);

/*
 * Функция flang «Сдвиг версии».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param oktety — «октеты»: список: число
 * @return значение: число
 */
fl_status tls_client_sdvig_versii(fl_ctx *ctx, fl_value oktety,
                                  fl_value *result, fl_error *error);

/*
 * Функция flang «Место поля тела».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param oktety — «октеты»: список: число
 * @param nomer — «номер»: число
 * @return значение: число
 */
fl_status tls_client_mesto_polya_tela(fl_ctx *ctx, fl_value oktety,
                                      fl_value nomer, fl_value *result,
                                      fl_error *error);

/*
 * Функция flang «Короткое имя атрибута».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param opr — «опр»: строка
 * @return значение: строка
 */
fl_status tls_client_korotkoe_imya_atributa(fl_ctx *ctx, fl_value opr,
                                            fl_value *result, fl_error *error);

/*
 * Функция flang «Печать пары имени».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param oktety — «октеты»: список: число
 * @param mesto — «место»: число
 * @return значение: строка
 */
fl_status tls_client_pechat_pary_imeni(fl_ctx *ctx, fl_value oktety,
                                       fl_value mesto, fl_value *result,
                                       fl_error *error);

/*
 * Функция flang «Шаг набора имени».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param oktety — «октеты»: список: число
 * @param nabrano — «набрано»: строка
 * @param para — «пара»: число
 * @return значение: строка
 */
fl_status tls_client_shag_nabora_imeni(fl_ctx *ctx, fl_value oktety,
                                       fl_value nabrano, fl_value para,
                                       fl_value *result, fl_error *error);

/*
 * Функция flang «Печать набора имени».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param oktety — «октеты»: список: число
 * @param mesto — «место»: число
 * @return значение: строка
 */
fl_status tls_client_pechat_nabora_imeni(fl_ctx *ctx, fl_value oktety,
                                         fl_value mesto, fl_value *result,
                                         fl_error *error);

/*
 * Функция flang «Шаг печати имени».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param oktety — «октеты»: список: число
 * @param nabrano — «набрано»: строка
 * @param chast — «часть»: число
 * @return значение: строка
 */
fl_status tls_client_shag_pechati_imeni(fl_ctx *ctx, fl_value oktety,
                                        fl_value nabrano, fl_value chast,
                                        fl_value *result, fl_error *error);

/*
 * Функция flang «Печать имени».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param oktety — «октеты»: список: число
 * @param mesto — «место»: число
 * @return значение: строка
 */
fl_status tls_client_pechat_imeni(fl_ctx *ctx, fl_value oktety, fl_value mesto,
                                  fl_value *result, fl_error *error);

/*
 * Функция flang «Версия сертификата».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param oktety — «октеты»: список: число
 * @return значение: число
 */
fl_status tls_client_versiya_sertifikata(fl_ctx *ctx, fl_value oktety,
                                         fl_value *result, fl_error *error);

/*
 * Функция flang «Октеты серийного номера».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param oktety — «октеты»: список: число
 * @return значение: список: число
 */
fl_status tls_client_oktety_seriynogo_nomera(fl_ctx *ctx, fl_value oktety,
                                             fl_value *result, fl_error *error);

/*
 * Функция flang «Серийный номер».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param oktety — «октеты»: список: число
 * @return значение: строка
 */
fl_status tls_client_seriynyy_nomer(fl_ctx *ctx, fl_value oktety,
                                    fl_value *result, fl_error *error);

/*
 * Функция flang «Имя алгоритма».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param opr — «опр»: строка
 * @return значение: строка
 */
fl_status tls_client_imya_algoritma(fl_ctx *ctx, fl_value opr, fl_value *result,
                                    fl_error *error);

/*
 * Функция flang «Алгоритм подписи».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param oktety — «октеты»: список: число
 * @return значение: строка
 */
fl_status tls_client_algoritm_podpisi(fl_ctx *ctx, fl_value oktety,
                                      fl_value *result, fl_error *error);

/*
 * Функция flang «Издатель».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param oktety — «октеты»: список: число
 * @return значение: строка
 */
fl_status tls_client_izdatel(fl_ctx *ctx, fl_value oktety, fl_value *result,
                             fl_error *error);

/*
 * Функция flang «Субъект».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param oktety — «октеты»: список: число
 * @return значение: строка
 */
fl_status tls_client_subekt(fl_ctx *ctx, fl_value oktety, fl_value *result,
                            fl_error *error);

/*
 * Функция flang «Место срока».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param oktety — «октеты»: список: число
 * @return значение: число
 */
fl_status tls_client_mesto_sroka(fl_ctx *ctx, fl_value oktety, fl_value *result,
                                 fl_error *error);

/*
 * Функция flang «Не ранее».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param oktety — «октеты»: список: число
 * @return значение: «Время DER»
 */
fl_status tls_client_ne_ranee(fl_ctx *ctx, fl_value oktety, fl_value *result,
                              fl_error *error);

/*
 * Функция flang «Не позднее».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param oktety — «октеты»: список: число
 * @return значение: «Время DER»
 */
fl_status tls_client_ne_pozdnee(fl_ctx *ctx, fl_value oktety, fl_value *result,
                                fl_error *error);

/*
 * Функция flang «Сертификат просрочен».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param oktety — «октеты»: список: число
 * @param seychas — «сейчас»: число
 * @return значение
 */
fl_status tls_client_sertifikat_prosrochen(fl_ctx *ctx, fl_value oktety,
                                           fl_value seychas, fl_value *result,
                                           fl_error *error);

/*
 * Функция flang «Сертификат ещё не начался».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param oktety — «октеты»: список: число
 * @param seychas — «сейчас»: число
 * @return значение
 */
fl_status tls_client_sertifikat_eschyo_ne_nachalsya(fl_ctx *ctx,
                                                    fl_value oktety,
                                                    fl_value seychas,
                                                    fl_value *result,
                                                    fl_error *error);

/*
 * Функция flang «Сертификат действует».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param oktety — «октеты»: список: число
 * @param seychas — «сейчас»: число
 * @return значение
 */
fl_status tls_client_sertifikat_deystvuet(fl_ctx *ctx, fl_value oktety,
                                          fl_value seychas, fl_value *result,
                                          fl_error *error);

/*
 * Функция flang «Начало связки».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @return значение: «Ход связки»
 */
fl_status tls_client_nachalo_svyazki(fl_ctx *ctx, fl_value *result,
                                     fl_error *error);

/*
 * Функция flang «Шаг связки».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param hod — «ход»: «Ход связки»
 * @param strochka — «строчка»: строка
 * @param nuzhen — «нужен»: число
 * @return значение: «Ход связки»
 */
fl_status tls_client_shag_svyazki(fl_ctx *ctx, fl_value hod, fl_value strochka,
                                  fl_value nuzhen, fl_value *result,
                                  fl_error *error);

/*
 * Функция flang «Ход по связке».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param svyazka — «связка»: строка
 * @param nuzhen — «нужен»: число
 * @return значение: «Ход связки»
 */
fl_status tls_client_hod_po_svyazke(fl_ctx *ctx, fl_value svyazka,
                                    fl_value nuzhen, fl_value *result,
                                    fl_error *error);

/*
 * Функция flang «Корней в связке».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param svyazka — «связка»: строка
 * @return значение: число
 */
fl_status tls_client_korney_v_svyazke(fl_ctx *ctx, fl_value svyazka,
                                      fl_value *result, fl_error *error);

/*
 * Функция flang «Тело корня по счёту».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param svyazka — «связка»: строка
 * @param nomer — «номер»: число
 * @return значение: строка
 */
fl_status tls_client_telo_kornya_po_schyotu(fl_ctx *ctx, fl_value svyazka,
                                            fl_value nomer, fl_value *result,
                                            fl_error *error);

/*
 * Функция flang «Корень по счёту».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param svyazka — «связка»: строка
 * @param nomer — «номер»: число
 * @return значение: список: число
 */
fl_status tls_client_koren_po_schyotu(fl_ctx *ctx, fl_value svyazka,
                                      fl_value nomer, fl_value *result,
                                      fl_error *error);

/*
 * Функция flang «Доверять некому».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param svyazka — «связка»: строка
 * @return значение
 */
fl_status tls_client_doveryat_nekomu(fl_ctx *ctx, fl_value svyazka,
                                     fl_value *result, fl_error *error);

/*
 * Функция flang «Октеты подписанного тела».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param sertifikat — «сертификат»: список: число
 * @return значение: список: число
 */
fl_status tls_client_oktety_podpisannogo_tela(fl_ctx *ctx, fl_value sertifikat,
                                              fl_value *result,
                                              fl_error *error);

/*
 * Функция flang «Место подписи сертификата».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param sertifikat — «сертификат»: список: число
 * @return значение: число
 */
fl_status tls_client_mesto_podpisi_sertifikata(fl_ctx *ctx, fl_value sertifikat,
                                               fl_value *result,
                                               fl_error *error);

/*
 * Функция flang «Октеты подписи сертификата».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param sertifikat — «сертификат»: список: число
 * @return значение: список: число
 */
fl_status tls_client_oktety_podpisi_sertifikata(fl_ctx *ctx,
                                                fl_value sertifikat,
                                                fl_value *result,
                                                fl_error *error);

/*
 * Функция flang «Издатель октетами».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param sertifikat — «сертификат»: список: число
 * @return значение: список: число
 */
fl_status tls_client_izdatel_oktetami(fl_ctx *ctx, fl_value sertifikat,
                                      fl_value *result, fl_error *error);

/*
 * Функция flang «Субъект октетами».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param sertifikat — «сертификат»: список: число
 * @return значение: список: число
 */
fl_status tls_client_subekt_oktetami(fl_ctx *ctx, fl_value sertifikat,
                                     fl_value *result, fl_error *error);

/*
 * Функция flang «Начало сверки имён».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @return значение: «Ход сверки имён»
 */
fl_status tls_client_nachalo_sverki_imyon(fl_ctx *ctx, fl_value *result,
                                          fl_error *error);

/*
 * Функция flang «Шаг сверки имён».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param hod — «ход»: «Ход сверки имён»
 * @param oktet — «октет»: число
 * @param drugie — «другие»: список: число
 * @return значение: «Ход сверки имён»
 */
fl_status tls_client_shag_sverki_imyon(fl_ctx *ctx, fl_value hod,
                                       fl_value oktet, fl_value drugie,
                                       fl_value *result, fl_error *error);

/*
 * Функция flang «Ход сверки октетов имён».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param pervye — «первые»: список: число
 * @param vtorye — «вторые»: список: число
 * @return значение: «Ход сверки имён»
 */
fl_status tls_client_hod_sverki_oktetov_imyon(fl_ctx *ctx, fl_value pervye,
                                              fl_value vtorye, fl_value *result,
                                              fl_error *error);

/*
 * Функция flang «Имена сошлись».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param pervye — «первые»: список: число
 * @param vtorye — «вторые»: список: число
 * @return значение
 */
fl_status tls_client_imena_soshlis(fl_ctx *ctx, fl_value pervye,
                                   fl_value vtorye, fl_value *result,
                                   fl_error *error);

/*
 * Функция flang «Звено связано».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param nizhniy — «нижний»: список: число
 * @param verhniy — «верхний»: список: число
 * @return значение
 */
fl_status tls_client_zveno_svyazano(fl_ctx *ctx, fl_value nizhniy,
                                    fl_value verhniy, fl_value *result,
                                    fl_error *error);

/*
 * Функция flang «Сам себе издатель».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param sertifikat — «сертификат»: список: число
 * @return значение
 */
fl_status tls_client_sam_sebe_izdatel(fl_ctx *ctx, fl_value sertifikat,
                                      fl_value *result, fl_error *error);

/*
 * Функция flang «Без ведущего нуля».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param oktety — «октеты»: список: число
 * @return значение: список: число
 */
fl_status tls_client_bez_veduschego_nulya(fl_ctx *ctx, fl_value oktety,
                                          fl_value *result, fl_error *error);

/*
 * Функция flang «Октеты открытого ключа».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param sertifikat — «сертификат»: список: число
 * @return значение: список: число
 */
fl_status tls_client_oktety_otkrytogo_klyucha(fl_ctx *ctx, fl_value sertifikat,
                                              fl_value *result,
                                              fl_error *error);

/*
 * Функция flang «Модуль ключа RSA».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param sertifikat — «сертификат»: список: число
 * @return значение: список: число
 */
fl_status tls_client_modul_klyucha_rsa(fl_ctx *ctx, fl_value sertifikat,
                                       fl_value *result, fl_error *error);

/*
 * Функция flang «Показатель ключа RSA».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param sertifikat — «сертификат»: список: число
 * @return значение: число
 */
fl_status tls_client_pokazatel_klyucha_rsa(fl_ctx *ctx, fl_value sertifikat,
                                           fl_value *result, fl_error *error);

/*
 * Функция flang «Веса слова».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @return значение: список: число
 */
fl_status tls_client_vesa_slova(fl_ctx *ctx, fl_value *result, fl_error *error);

/*
 * Функция flang «Бит».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param slovo — «слово»: число
 * @param ves — «вес»: число
 * @return значение: число
 */
fl_status tls_client_bit(fl_ctx *ctx, fl_value slovo, fl_value ves,
                         fl_value *result, fl_error *error);

/*
 * Функция flang «Четвёрка».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param slovo — «слово»: число
 * @param ves — «вес»: число
 * @return значение: число
 */
fl_status tls_client_chetvyorka(fl_ctx *ctx, fl_value slovo, fl_value ves,
                                fl_value *result, fl_error *error);

/*
 * Функция flang «Свести к слову».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param h — «х»: число
 * @return значение: число
 */
fl_status tls_client_svesti_k_slovu(fl_ctx *ctx, fl_value h, fl_value *result,
                                    fl_error *error);

/*
 * Функция flang «Свести к байту».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param bayt — «байт»: число
 * @return значение: число
 */
fl_status tls_client_svesti_k_baytu(fl_ctx *ctx, fl_value bayt,
                                    fl_value *result, fl_error *error);

/*
 * Функция flang «Шаг байтовости».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param akk — «акк»
 * @param bayt — «байт»: число
 * @return значение
 */
fl_status tls_client_shag_baytovosti(fl_ctx *ctx, fl_value akk, fl_value bayt,
                                     fl_value *result, fl_error *error);

/*
 * Функция flang «Это байты».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param bayty — «байты»: список: число
 * @return значение
 */
fl_status tls_client_eto_bayty(fl_ctx *ctx, fl_value bayty, fl_value *result,
                               fl_error *error);

/*
 * Функция flang «Исключающее или трёх».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param pervoe — «первое»: число
 * @param vtoroe — «второе»: число
 * @param trete — «третье»: число
 * @return значение: число
 */
fl_status tls_client_isklyuchayuschee_ili_tryoh(fl_ctx *ctx, fl_value pervoe,
                                                fl_value vtoroe, fl_value trete,
                                                fl_value *result,
                                                fl_error *error);

/*
 * Функция flang «Выбор».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param uslovie — «условие»: число
 * @param edinichnoe — «единичное»: число
 * @param nulevoe — «нулевое»: число
 * @return значение: число
 */
fl_status tls_client_vybor(fl_ctx *ctx, fl_value uslovie, fl_value edinichnoe,
                           fl_value nulevoe, fl_value *result, fl_error *error);

/*
 * Функция flang «Большинство».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param pervoe — «первое»: число
 * @param vtoroe — «второе»: число
 * @param trete — «третье»: число
 * @return значение: число
 */
fl_status tls_client_bolshinstvo(fl_ctx *ctx, fl_value pervoe, fl_value vtoroe,
                                 fl_value trete, fl_value *result,
                                 fl_error *error);

/*
 * Функция flang «Поворот вправо».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param slovo — «слово»: число
 * @param stepen — «степень»: число
 * @return значение: число
 */
fl_status tls_client_povorot_vpravo(fl_ctx *ctx, fl_value slovo,
                                    fl_value stepen, fl_value *result,
                                    fl_error *error);

/*
 * Функция flang «Сдвиг вправо».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param slovo — «слово»: число
 * @param stepen — «степень»: число
 * @return значение: число
 */
fl_status tls_client_sdvig_vpravo(fl_ctx *ctx, fl_value slovo, fl_value stepen,
                                  fl_value *result, fl_error *error);

/*
 * Функция flang «Большая сигма ноль».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param slovo — «слово»: число
 * @return значение: число
 */
fl_status tls_client_bolshaya_sigma_nol(fl_ctx *ctx, fl_value slovo,
                                        fl_value *result, fl_error *error);

/*
 * Функция flang «Большая сигма один».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param slovo — «слово»: число
 * @return значение: число
 */
fl_status tls_client_bolshaya_sigma_odin(fl_ctx *ctx, fl_value slovo,
                                         fl_value *result, fl_error *error);

/*
 * Функция flang «Малая сигма ноль».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param slovo — «слово»: число
 * @return значение: число
 */
fl_status tls_client_malaya_sigma_nol(fl_ctx *ctx, fl_value slovo,
                                      fl_value *result, fl_error *error);

/*
 * Функция flang «Малая сигма один».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param slovo — «слово»: число
 * @return значение: число
 */
fl_status tls_client_malaya_sigma_odin(fl_ctx *ctx, fl_value slovo,
                                       fl_value *result, fl_error *error);

/*
 * Функция flang «Начальный свод».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @return значение: «Свод sha256»
 */
fl_status tls_client_nachalnyy_svod(fl_ctx *ctx, fl_value *result,
                                    fl_error *error);

/*
 * Функция flang «Постоянные раунда».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @return значение: список: число
 */
fl_status tls_client_postoyannye_raunda(fl_ctx *ctx, fl_value *result,
                                        fl_error *error);

/*
 * Функция flang «Пустое расписание».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @return значение: «Расписание»
 */
fl_status tls_client_pustoe_raspisanie(fl_ctx *ctx, fl_value *result,
                                       fl_error *error);

/*
 * Функция flang «Сдвинуть расписание».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param raspisanie — «расписание»: «Расписание»
 * @param slovo — «слово»: число
 * @return значение: «Расписание»
 */
fl_status tls_client_sdvinut_raspisanie(fl_ctx *ctx, fl_value raspisanie,
                                        fl_value slovo, fl_value *result,
                                        fl_error *error);

/*
 * Функция flang «Следующее слово».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param raspisanie — «расписание»: «Расписание»
 * @return значение: число
 */
fl_status tls_client_sleduyuschee_slovo(fl_ctx *ctx, fl_value raspisanie,
                                        fl_value *result, fl_error *error);

/*
 * Функция flang «Шаг сбора слов».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param sbor — «сбор»: «Сбор слов»
 * @param bayt — «байт»: число
 * @return значение: «Сбор слов»
 */
fl_status tls_client_shag_sbora_slov(fl_ctx *ctx, fl_value sbor, fl_value bayt,
                                     fl_value *result, fl_error *error);

/*
 * Функция flang «Расписание блока».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param blok — «блок»: список: число
 * @return значение: «Расписание»
 */
fl_status tls_client_raspisanie_bloka(fl_ctx *ctx, fl_value blok,
                                      fl_value *result, fl_error *error);

/*
 * Функция flang «Шаг раунда».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param hod — «ход»: «Ход блока»
 * @param postoyannaya — «постоянная»: число
 * @return значение: «Ход блока»
 */
fl_status tls_client_shag_raunda(fl_ctx *ctx, fl_value hod,
                                 fl_value postoyannaya, fl_value *result,
                                 fl_error *error);

/*
 * Функция flang «Сложить своды».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param pervyy — «первый»: «Свод sha256»
 * @param vtoroy — «второй»: «Свод sha256»
 * @return значение: «Свод sha256»
 */
fl_status tls_client_slozhit_svody(fl_ctx *ctx, fl_value pervyy,
                                   fl_value vtoroy, fl_value *result,
                                   fl_error *error);

/*
 * Функция flang «Сжать блок».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param svod — «свод»: «Свод sha256»
 * @param blok — «блок»: список: число
 * @return значение: «Свод sha256»
 */
fl_status tls_client_szhat_blok(fl_ctx *ctx, fl_value svod, fl_value blok,
                                fl_value *result, fl_error *error);

/*
 * Функция flang «Нули».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param skolko — «сколько»: «неотрицательное»
 * @return значение: список: число
 */
fl_status tls_client_nuli(fl_ctx *ctx, fl_value skolko, fl_value *result,
                          fl_error *error);

/*
 * Функция flang «Байт разряда».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param chislo — «число»: число
 * @param stepen — «степень»: число
 * @return значение: число
 */
fl_status tls_client_bayt_razryada(fl_ctx *ctx, fl_value chislo,
                                   fl_value stepen, fl_value *result,
                                   fl_error *error);

/*
 * Функция flang «Байты длины».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param bitov — «битов»: число
 * @return значение: список: число
 */
fl_status tls_client_bayty_dliny(fl_ctx *ctx, fl_value bitov, fl_value *result,
                                 fl_error *error);

/*
 * Функция flang «Дополнить сообщение».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param bayty — «байты»: список: число
 * @return значение: список: число
 */
fl_status tls_client_dopolnit_soobschenie(fl_ctx *ctx, fl_value bayty,
                                          fl_value *result, fl_error *error);

/*
 * Функция flang «Шаг байта».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param hod — «ход»: «Ход хеша»
 * @param bayt — «байт»: число
 * @return значение: «Ход хеша»
 */
fl_status tls_client_shag_bayta(fl_ctx *ctx, fl_value hod, fl_value bayt,
                                fl_value *result, fl_error *error);

/*
 * Функция flang «Свод байтов».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param bayty — «байты»: список: число
 * @return значение: «Свод sha256»
 */
fl_status tls_client_svod_baytov(fl_ctx *ctx, fl_value bayty, fl_value *result,
                                 fl_error *error);

/*
 * Функция flang «Азбука 16».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @return значение: строка
 */
fl_status tls_client_azbuka_16(fl_ctx *ctx, fl_value *result, fl_error *error);

/*
 * Функция flang «Цифра 16».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param n — «н»: число
 * @return значение: строка
 */
fl_status tls_client_cifra_16(fl_ctx *ctx, fl_value n, fl_value *result,
                              fl_error *error);

/*
 * Функция flang «Слово шестнадцатеричным».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param slovo — «слово»: число
 * @return значение: строка
 */
fl_status tls_client_slovo_shestnadcaterichnym(fl_ctx *ctx, fl_value slovo,
                                               fl_value *result,
                                               fl_error *error);

/*
 * Функция flang «Свод шестнадцатеричным».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param svod — «свод»: «Свод sha256»
 * @return значение: строка
 */
fl_status tls_client_svod_shestnadcaterichnym(fl_ctx *ctx, fl_value svod,
                                              fl_value *result,
                                              fl_error *error);

/*
 * Функция flang «Хеш байтов».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param bayty — «байты»: список: число
 * @return значение: строка
 */
fl_status tls_client_hesh_baytov(fl_ctx *ctx, fl_value bayty, fl_value *result,
                                 fl_error *error);

/*
 * Функция flang «Байты слова».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param slovo — «слово»: число
 * @return значение: список: число
 */
fl_status tls_client_bayty_slova(fl_ctx *ctx, fl_value slovo, fl_value *result,
                                 fl_error *error);

/*
 * Функция flang «Байты шестнадцатеричным».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param bayty — «байты»: список: число
 * @return значение: строка
 */
fl_status tls_client_bayty_shestnadcaterichnym(fl_ctx *ctx, fl_value bayty,
                                               fl_value *result,
                                               fl_error *error);

/*
 * Функция flang «Байты свода».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param svod — «свод»: «Свод sha256»
 * @return значение: список: число
 */
fl_status tls_client_bayty_svoda(fl_ctx *ctx, fl_value svod, fl_value *result,
                                 fl_error *error);

/*
 * Функция flang «Шаг начала».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param hod — «ход»: «Ход начала»
 * @param bayt — «байт»: число
 * @return значение: «Ход начала»
 */
fl_status tls_client_shag_nachala(fl_ctx *ctx, fl_value hod, fl_value bayt,
                                  fl_value *result, fl_error *error);

/*
 * Функция flang «Начало списка».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param bayty — «байты»: список: число
 * @param skolko — «сколько»: число
 * @return значение: список: число
 */
fl_status tls_client_nachalo_spiska(fl_ctx *ctx, fl_value bayty,
                                    fl_value skolko, fl_value *result,
                                    fl_error *error);

/*
 * Функция flang «Байт или ноль».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param bayty — «байты»: список: число
 * @param nomer — «номер»: число
 * @return значение: число
 */
fl_status tls_client_bayt_ili_nol(fl_ctx *ctx, fl_value bayty, fl_value nomer,
                                  fl_value *result, fl_error *error);

/*
 * Функция flang «Шаг слияния».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param hod — «ход»: «Ход слияния»
 * @param bayt — «байт»: число
 * @return значение: «Ход слияния»
 */
fl_status tls_client_shag_sliyaniya(fl_ctx *ctx, fl_value hod, fl_value bayt,
                                    fl_value *result, fl_error *error);

/*
 * Функция flang «Исключающее или списков».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param pervyy — «первый»: список: число
 * @param vtoroy — «второй»: список: число
 * @return значение: список: число
 */
fl_status tls_client_isklyuchayuschee_ili_spiskov(fl_ctx *ctx, fl_value pervyy,
                                                  fl_value vtoroy,
                                                  fl_value *result,
                                                  fl_error *error);

/*
 * Функция flang «Ключ блока».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param klyuch — «ключ»: список: число
 * @return значение: список: число
 */
fl_status tls_client_klyuch_bloka(fl_ctx *ctx, fl_value klyuch,
                                  fl_value *result, fl_error *error);

/*
 * Функция flang «Набивка ключа».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param blok — «блок»: список: число
 * @param nabivka — «набивка»: число
 * @return значение: список: число
 */
fl_status tls_client_nabivka_klyucha(fl_ctx *ctx, fl_value blok,
                                     fl_value nabivka, fl_value *result,
                                     fl_error *error);

/*
 * Функция flang «Подпись байтами».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param klyuch — «ключ»: список: число
 * @param soobschenie — «сообщение»: список: число
 * @return значение: список: число
 */
fl_status tls_client_podpis_baytami(fl_ctx *ctx, fl_value klyuch,
                                    fl_value soobschenie, fl_value *result,
                                    fl_error *error);

/*
 * Функция flang «Дописать номер».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param menshie — «меньшие»: список: число
 * @param baytov — «байтов»: число
 * @return значение: список: число
 */
fl_status tls_client_dopisat_nomer(fl_ctx *ctx, fl_value menshie,
                                   fl_value baytov, fl_value *result,
                                   fl_error *error);

/*
 * Функция flang «Номера кусков».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param baytov — «байтов»: «неотрицательное»
 * @return значение: список: число
 */
fl_status tls_client_nomera_kuskov(fl_ctx *ctx, fl_value baytov,
                                   fl_value *result, fl_error *error);

/*
 * Функция flang «Шаг витка».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param parol — «пароль»: список: число
 * @param hod — «ход»: «Ход вывода»
 * @return значение: «Ход вывода»
 */
fl_status tls_client_shag_vitka(fl_ctx *ctx, fl_value parol, fl_value hod,
                                fl_value *result, fl_error *error);

/*
 * Функция flang «Витки вывода».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * Хвостовой самовызов развёрнут в цикл: стек не растёт.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param parol — «пароль»: список: число
 * @param hod — «ход»: «Ход вывода»
 * @param ostalos — «осталось»: число
 * @return значение: «Ход вывода»
 */
fl_status tls_client_vitki_vyvoda(fl_ctx *ctx, fl_value parol, fl_value hod,
                                  fl_value ostalos, fl_value *result,
                                  fl_error *error);

/*
 * Функция flang «Итог витков».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param hod — «ход»: «Ход вывода»
 * @return значение: список: число
 */
fl_status tls_client_itog_vitkov(fl_ctx *ctx, fl_value hod, fl_value *result,
                                 fl_error *error);

/*
 * Функция flang «Витки после первой подписи».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param parol — «пароль»: список: число
 * @param pervyy — «первый»: список: число
 * @param povtorov — «повторов»: число
 * @return значение: список: число
 */
fl_status tls_client_vitki_posle_pervoy_podpisi(fl_ctx *ctx, fl_value parol,
                                                fl_value pervyy,
                                                fl_value povtorov,
                                                fl_value *result,
                                                fl_error *error);

/*
 * Функция flang «Кусок вывода».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param parol — «пароль»: список: число
 * @param sol — «соль»: список: число
 * @param povtorov — «повторов»: число
 * @param nomer — «номер»: число
 * @return значение: список: число
 */
fl_status tls_client_kusok_vyvoda(fl_ctx *ctx, fl_value parol, fl_value sol,
                                  fl_value povtorov, fl_value nomer,
                                  fl_value *result, fl_error *error);

/*
 * Функция flang «Начальный свод SHA-1».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @return значение: «Свод SHA-1»
 */
fl_status tls_client_nachalnyy_svod_sha_1(fl_ctx *ctx, fl_value *result,
                                          fl_error *error);

/*
 * Функция flang «Номера раундов SHA-1».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @return значение: список: число
 */
fl_status tls_client_nomera_raundov_sha_1(fl_ctx *ctx, fl_value *result,
                                          fl_error *error);

/*
 * Функция flang «Постоянная раунда SHA-1».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param nomer — «номер»: число
 * @return значение: число
 */
fl_status tls_client_postoyannaya_raunda_sha_1(fl_ctx *ctx, fl_value nomer,
                                               fl_value *result,
                                               fl_error *error);

/*
 * Функция flang «Смесь раунда SHA-1».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param nomer — «номер»: число
 * @param vtoroe — «второе»: число
 * @param trete — «третье»: число
 * @param chetvyortoe — «четвёртое»: число
 * @return значение: число
 */
fl_status tls_client_smes_raunda_sha_1(fl_ctx *ctx, fl_value nomer,
                                       fl_value vtoroe, fl_value trete,
                                       fl_value chetvyortoe, fl_value *result,
                                       fl_error *error);

/*
 * Функция flang «Следующее слово SHA-1».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param raspisanie — «расписание»: «Расписание»
 * @return значение: число
 */
fl_status tls_client_sleduyuschee_slovo_sha_1(fl_ctx *ctx, fl_value raspisanie,
                                              fl_value *result,
                                              fl_error *error);

/*
 * Функция flang «Шаг раунда SHA-1».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param hod — «ход»: «Ход блока SHA-1»
 * @param nomer — «номер»: число
 * @return значение: «Ход блока SHA-1»
 */
fl_status tls_client_shag_raunda_sha_1(fl_ctx *ctx, fl_value hod,
                                       fl_value nomer, fl_value *result,
                                       fl_error *error);

/*
 * Функция flang «Сложить своды SHA-1».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param pervyy — «первый»: «Свод SHA-1»
 * @param vtoroy — «второй»: «Свод SHA-1»
 * @return значение: «Свод SHA-1»
 */
fl_status tls_client_slozhit_svody_sha_1(fl_ctx *ctx, fl_value pervyy,
                                         fl_value vtoroy, fl_value *result,
                                         fl_error *error);

/*
 * Функция flang «Сжать блок SHA-1».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param svod — «свод»: «Свод SHA-1»
 * @param blok — «блок»: список: число
 * @return значение: «Свод SHA-1»
 */
fl_status tls_client_szhat_blok_sha_1(fl_ctx *ctx, fl_value svod, fl_value blok,
                                      fl_value *result, fl_error *error);

/*
 * Функция flang «Шаг байта SHA-1».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param hod — «ход»: «Ход хеша SHA-1»
 * @param bayt — «байт»: число
 * @return значение: «Ход хеша SHA-1»
 */
fl_status tls_client_shag_bayta_sha_1(fl_ctx *ctx, fl_value hod, fl_value bayt,
                                      fl_value *result, fl_error *error);

/*
 * Функция flang «Свод байтов SHA-1».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param bayty — «байты»: список: число
 * @return значение: «Свод SHA-1»
 */
fl_status tls_client_svod_baytov_sha_1(fl_ctx *ctx, fl_value bayty,
                                       fl_value *result, fl_error *error);

/*
 * Функция flang «Байты свода SHA-1».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param svod — «свод»: «Свод SHA-1»
 * @return значение: список: число
 */
fl_status tls_client_bayty_svoda_sha_1(fl_ctx *ctx, fl_value svod,
                                       fl_value *result, fl_error *error);

/*
 * Функция flang «Хеш байтов SHA-1».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param bayty — «байты»: список: число
 * @return значение: строка
 */
fl_status tls_client_hesh_baytov_sha_1(fl_ctx *ctx, fl_value bayty,
                                       fl_value *result, fl_error *error);

/*
 * Функция flang «Ключ блока SHA-1».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param klyuch — «ключ»: список: число
 * @return значение: список: число
 */
fl_status tls_client_klyuch_bloka_sha_1(fl_ctx *ctx, fl_value klyuch,
                                        fl_value *result, fl_error *error);

/*
 * Функция flang «Подпись байтами SHA-1».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param klyuch — «ключ»: список: число
 * @param soobschenie — «сообщение»: список: число
 * @return значение: список: число
 */
fl_status tls_client_podpis_baytami_sha_1(fl_ctx *ctx, fl_value klyuch,
                                          fl_value soobschenie,
                                          fl_value *result, fl_error *error);

/*
 * Функция flang «Подпись SHA-1 шестнадцатеричным».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param klyuch — «ключ»: список: число
 * @param soobschenie — «сообщение»: список: число
 * @return значение: строка
 */
fl_status tls_client_podpis_sha_1_shestnadcaterichnym(fl_ctx *ctx,
                                                      fl_value klyuch,
                                                      fl_value soobschenie,
                                                      fl_value *result,
                                                      fl_error *error);

/*
 * Функция flang «Дописать номер SHA-1».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param menshie — «меньшие»: список: число
 * @param baytov — «байтов»: число
 * @return значение: список: число
 */
fl_status tls_client_dopisat_nomer_sha_1(fl_ctx *ctx, fl_value menshie,
                                         fl_value baytov, fl_value *result,
                                         fl_error *error);

/*
 * Функция flang «Номера кусков SHA-1».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param baytov — «байтов»: «неотрицательное»
 * @return значение: список: число
 */
fl_status tls_client_nomera_kuskov_sha_1(fl_ctx *ctx, fl_value baytov,
                                         fl_value *result, fl_error *error);

/*
 * Функция flang «Шаг витка SHA-1».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param parol — «пароль»: список: число
 * @param hod — «ход»: «Ход вывода SHA-1»
 * @return значение: «Ход вывода SHA-1»
 */
fl_status tls_client_shag_vitka_sha_1(fl_ctx *ctx, fl_value parol, fl_value hod,
                                      fl_value *result, fl_error *error);

/*
 * Функция flang «Витки вывода SHA-1».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * Хвостовой самовызов развёрнут в цикл: стек не растёт.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param parol — «пароль»: список: число
 * @param hod — «ход»: «Ход вывода SHA-1»
 * @param ostalos — «осталось»: число
 * @return значение: «Ход вывода SHA-1»
 */
fl_status tls_client_vitki_vyvoda_sha_1(fl_ctx *ctx, fl_value parol,
                                        fl_value hod, fl_value ostalos,
                                        fl_value *result, fl_error *error);

/*
 * Функция flang «Итог витков SHA-1».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param hod — «ход»: «Ход вывода SHA-1»
 * @return значение: список: число
 */
fl_status tls_client_itog_vitkov_sha_1(fl_ctx *ctx, fl_value hod,
                                       fl_value *result, fl_error *error);

/*
 * Функция flang «Кусок вывода SHA-1».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param parol — «пароль»: список: число
 * @param sol — «соль»: список: число
 * @param povtorov — «повторов»: число
 * @param nomer — «номер»: число
 * @return значение: список: число
 */
fl_status tls_client_kusok_vyvoda_sha_1(fl_ctx *ctx, fl_value parol,
                                        fl_value sol, fl_value povtorov,
                                        fl_value nomer, fl_value *result,
                                        fl_error *error);

/*
 * Функция flang «Вывод ключа SHA-1».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param parol — «пароль»: список: число
 * @param sol — «соль»: список: число
 * @param povtorov — «повторов»: число
 * @param baytov — «байтов»: «неотрицательное»
 * @return значение: список: число
 */
fl_status tls_client_vyvod_klyucha_sha_1(fl_ctx *ctx, fl_value parol,
                                         fl_value sol, fl_value povtorov,
                                         fl_value baytov, fl_value *result,
                                         fl_error *error);

/*
 * Функция flang «Нулей».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param skolko — «сколько»: число
 * @return значение: список: число
 */
fl_status tls_client_nuley(fl_ctx *ctx, fl_value skolko, fl_value *result,
                           fl_error *error);

/*
 * Функция flang «Повторить октет».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param znachenie — «значение»: число
 * @param skolko — «сколько»: число
 * @return значение: список: число
 */
fl_status tls_client_povtorit_oktet(fl_ctx *ctx, fl_value znachenie,
                                    fl_value skolko, fl_value *result,
                                    fl_error *error);

/*
 * Функция flang «Разряд RSA».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * Хвостовой самовызов развёрнут в цикл: стек не растёт.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param razryady — «разряды»: список: число
 * @param nomer — «номер»: число
 * @return значение: число
 */
fl_status tls_client_razryad_rsa(fl_ctx *ctx, fl_value razryady, fl_value nomer,
                                 fl_value *result, fl_error *error);

/*
 * Функция flang «Отбросить RSA».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * Хвостовой самовызов развёрнут в цикл: стек не растёт.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param razryady — «разряды»: список: число
 * @param skolko — «сколько»: число
 * @return значение: список: число
 */
fl_status tls_client_otbrosit_rsa(fl_ctx *ctx, fl_value razryady,
                                  fl_value skolko, fl_value *result,
                                  fl_error *error);

/*
 * Функция flang «Сложить RSA».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param pervye — «первые»: список: число
 * @param vtorye — «вторые»: список: число
 * @return значение: список: число
 */
fl_status tls_client_slozhit_rsa(fl_ctx *ctx, fl_value pervye, fl_value vtorye,
                                 fl_value *result, fl_error *error);

/*
 * Функция flang «Добавить RSA».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param razryady — «разряды»: список: число
 * @param dobavka — «добавка»: число
 * @return значение: список: число
 */
fl_status tls_client_dobavit_rsa(fl_ctx *ctx, fl_value razryady,
                                 fl_value dobavka, fl_value *result,
                                 fl_error *error);

/*
 * Функция flang «Приписать список».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param pervye — «первые»: список: число
 * @param vtorye — «вторые»: список: число
 * @return значение: список: число
 */
fl_status tls_client_pripisat_spisok(fl_ctx *ctx, fl_value pervye,
                                     fl_value vtorye, fl_value *result,
                                     fl_error *error);

/*
 * Функция flang «Перевернуть».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param razryady — «разряды»: список: число
 * @return значение: список: число
 */
fl_status tls_client_perevernut(fl_ctx *ctx, fl_value razryady,
                                fl_value *result, fl_error *error);

/*
 * Функция flang «Списки равны».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * Хвостовой самовызов развёрнут в цикл: стек не растёт.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param pervye — «первые»: список: число
 * @param vtorye — «вторые»: список: число
 * @return значение
 */
fl_status tls_client_spiski_ravny(fl_ctx *ctx, fl_value pervye, fl_value vtorye,
                                  fl_value *result, fl_error *error);

/*
 * Функция flang «Перенести RSA».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param hod — «ход»: «Перенос RSA»
 * @param razryad — «разряд»: число
 * @return значение: «Перенос RSA»
 */
fl_status tls_client_perenesti_rsa(fl_ctx *ctx, fl_value hod, fl_value razryad,
                                   fl_value *result, fl_error *error);

/*
 * Функция flang «Уложить RSA».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param razryady — «разряды»: список: число
 * @return значение: «Перенос RSA»
 */
fl_status tls_client_ulozhit_rsa(fl_ctx *ctx, fl_value razryady,
                                 fl_value *result, fl_error *error);

/*
 * Функция flang «Вычесть RSA».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param pervye — «первые»: список: число
 * @param vtorye — «вторые»: список: число
 * @param zayom — «заём»: число
 * @return значение: «Заём RSA»
 */
fl_status tls_client_vychest_rsa(fl_ctx *ctx, fl_value pervye, fl_value vtorye,
                                 fl_value zayom, fl_value *result,
                                 fl_error *error);

/*
 * Функция flang «Меньше разрядами».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param pervye — «первые»: список: число
 * @param vtorye — «вторые»: список: число
 * @return значение
 */
fl_status tls_client_menshe_razryadami(fl_ctx *ctx, fl_value pervye,
                                       fl_value vtorye, fl_value *result,
                                       fl_error *error);

/*
 * Функция flang «Шаг Ньютона».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param m — «м»: число
 * @param h — «х»: число
 * @return значение: число
 */
fl_status tls_client_shag_nyutona(fl_ctx *ctx, fl_value m, fl_value h,
                                  fl_value *result, fl_error *error);

/*
 * Функция flang «Обратный по 65536».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param m — «м»: число
 * @return значение: число
 */
fl_status tls_client_obratnyy_po_65536(fl_ctx *ctx, fl_value m,
                                       fl_value *result, fl_error *error);

/*
 * Функция flang «Обратный со знаком минус».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param delitel — «делитель»: список: число
 * @return значение: число
 */
fl_status tls_client_obratnyy_so_znakom_minus(fl_ctx *ctx, fl_value delitel,
                                              fl_value *result,
                                              fl_error *error);

/*
 * Функция flang «Свёртка RSA».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param a — «а»: список: число
 * @param b — «б»: список: число
 * @return значение: список: число
 */
fl_status tls_client_svyortka_rsa(fl_ctx *ctx, fl_value a, fl_value b,
                                  fl_value *result, fl_error *error);

/*
 * Функция flang «Шаг Монтгомери».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param hod — «ход»: «Ход Монтгомери»
 * @param delitel — «делитель»: список: число
 * @param obratnyy — «обратный»: число
 * @return значение: «Ход Монтгомери»
 */
fl_status tls_client_shag_montgomeri(fl_ctx *ctx, fl_value hod,
                                     fl_value delitel, fl_value obratnyy,
                                     fl_value *result, fl_error *error);

/*
 * Функция flang «Приведение Монтгомери».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param proizvedenie — «произведение»: список: число
 * @param delitel — «делитель»: список: число
 * @param obratnyy — «обратный»: число
 * @return значение: список: число
 */
fl_status tls_client_privedenie_montgomeri(fl_ctx *ctx, fl_value proizvedenie,
                                           fl_value delitel, fl_value obratnyy,
                                           fl_value *result, fl_error *error);

/*
 * Функция flang «Умножение Монтгомери».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param a — «а»: список: число
 * @param b — «б»: список: число
 * @param delitel — «делитель»: список: число
 * @param obratnyy — «обратный»: число
 * @return значение: список: число
 */
fl_status tls_client_umnozhenie_montgomeri(fl_ctx *ctx, fl_value a, fl_value b,
                                           fl_value delitel, fl_value obratnyy,
                                           fl_value *result, fl_error *error);

/*
 * Функция flang «Единица разрядами».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param delitel — «делитель»: список: число
 * @return значение: список: число
 */
fl_status tls_client_edinica_razryadami(fl_ctx *ctx, fl_value delitel,
                                        fl_value *result, fl_error *error);

/*
 * Функция flang «R по модулю».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param delitel — «делитель»: список: число
 * @return значение: список: число
 */
fl_status tls_client_r_po_modulyu(fl_ctx *ctx, fl_value delitel,
                                  fl_value *result, fl_error *error);

/*
 * Функция flang «Удвоить по модулю».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param razryady — «разряды»: список: число
 * @param delitel — «делитель»: список: число
 * @return значение: список: число
 */
fl_status tls_client_udvoit_po_modulyu(fl_ctx *ctx, fl_value razryady,
                                       fl_value delitel, fl_value *result,
                                       fl_error *error);

/*
 * Функция flang «R по любому модулю».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param delitel — «делитель»: список: число
 * @return значение: список: число
 */
fl_status tls_client_r_po_lyubomu_modulyu(fl_ctx *ctx, fl_value delitel,
                                          fl_value *result, fl_error *error);

/*
 * Функция flang «Удвоить n раз».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param razryady — «разряды»: список: число
 * @param delitel — «делитель»: список: число
 * @return значение: список: число
 */
fl_status tls_client_udvoit_n_raz(fl_ctx *ctx, fl_value razryady,
                                  fl_value delitel, fl_value *result,
                                  fl_error *error);

/*
 * Функция flang «R в квадрате».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param delitel — «делитель»: список: число
 * @param obratnyy — «обратный»: число
 * @return значение: список: число
 */
fl_status tls_client_r_v_kvadrate(fl_ctx *ctx, fl_value delitel,
                                  fl_value obratnyy, fl_value *result,
                                  fl_error *error);

/*
 * Функция flang «Биты по счёту».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param n — «н»: число
 * @param schyotchik — «счётчик»: список: число
 * @return значение: список: число
 */
fl_status tls_client_bity_po_schyotu(fl_ctx *ctx, fl_value n,
                                     fl_value schyotchik, fl_value *result,
                                     fl_error *error);

/*
 * Функция flang «Отбросить нули спереди».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * Хвостовой самовызов развёрнут в цикл: стек не растёт.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param bity — «биты»: список: число
 * @return значение: список: число
 */
fl_status tls_client_otbrosit_nuli_speredi(fl_ctx *ctx, fl_value bity,
                                           fl_value *result, fl_error *error);

/*
 * Функция flang «Значащие биты».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param n — «н»: число
 * @return значение: список: число
 */
fl_status tls_client_znachaschie_bity(fl_ctx *ctx, fl_value n, fl_value *result,
                                      fl_error *error);

/*
 * Функция flang «Шаг степени».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param akk — «акк»: список: число
 * @param bit — «бит»: число
 * @param osnovanie — «основание»: список: число
 * @param delitel — «делитель»: список: число
 * @param obratnyy — «обратный»: число
 * @return значение: список: число
 */
fl_status tls_client_shag_stepeni(fl_ctx *ctx, fl_value akk, fl_value bit,
                                  fl_value osnovanie, fl_value delitel,
                                  fl_value obratnyy, fl_value *result,
                                  fl_error *error);

/*
 * Функция flang «Степень по модулю».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param osnovanie — «основание»: список: число
 * @param pokazatel — «показатель»: число
 * @param delitel — «делитель»: список: число
 * @return значение: список: число
 */
fl_status tls_client_stepen_po_modulyu(fl_ctx *ctx, fl_value osnovanie,
                                       fl_value pokazatel, fl_value delitel,
                                       fl_value *result, fl_error *error);

/*
 * Функция flang «Разряды из младших байтов».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param bayty — «байты»: список: число
 * @return значение: список: число
 */
fl_status tls_client_razryady_iz_mladshih_baytov(fl_ctx *ctx, fl_value bayty,
                                                 fl_value *result,
                                                 fl_error *error);

/*
 * Функция flang «Разряды из байтов».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param bayty — «байты»: список: число
 * @return значение: список: число
 */
fl_status tls_client_razryady_iz_baytov(fl_ctx *ctx, fl_value bayty,
                                        fl_value *result, fl_error *error);

/*
 * Функция flang «Байты из разрядов».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param razryady — «разряды»: список: число
 * @return значение: список: число
 */
fl_status tls_client_bayty_iz_razryadov(fl_ctx *ctx, fl_value razryady,
                                        fl_value *result, fl_error *error);

/*
 * Функция flang «Метка SHA-256».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @return значение: список: число
 */
fl_status tls_client_metka_sha_256(fl_ctx *ctx, fl_value *result,
                                   fl_error *error);

/*
 * Функция flang «Ожидаемая набивка».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param hesh — «хеш»: список: число
 * @param razmer — «размер»: число
 * @return значение: список: число
 */
fl_status tls_client_ozhidaemaya_nabivka(fl_ctx *ctx, fl_value hesh,
                                         fl_value razmer, fl_value *result,
                                         fl_error *error);

/*
 * Функция flang «Восстановленная набивка».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param podpis — «подпись»: список: число
 * @param delitel — «делитель»: список: число
 * @param pokazatel — «показатель»: число
 * @return значение: список: число
 */
fl_status tls_client_vosstanovlennaya_nabivka(fl_ctx *ctx, fl_value podpis,
                                              fl_value delitel,
                                              fl_value pokazatel,
                                              fl_value *result,
                                              fl_error *error);

/*
 * Функция flang «Подпись верна».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param podpis — «подпись»: список: число
 * @param delitel — «делитель»: список: число
 * @param pokazatel — «показатель»: число
 * @param hesh — «хеш»: список: число
 * @return значение
 */
fl_status tls_client_podpis_verna(fl_ctx *ctx, fl_value podpis,
                                  fl_value delitel, fl_value pokazatel,
                                  fl_value hesh, fl_value *result,
                                  fl_error *error);

/*
 * Функция flang «Длина хеша».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param vid — «вид»: «Хеш подписи»
 * @return значение: число
 */
fl_status tls_client_dlina_hesha(fl_ctx *ctx, fl_value vid, fl_value *result,
                                 fl_error *error);

/*
 * Функция flang «Хеш вида».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param vid — «вид»: «Хеш подписи»
 * @param bayty — «байты»: список: число
 * @return значение: список: число
 */
fl_status tls_client_hesh_vida(fl_ctx *ctx, fl_value vid, fl_value bayty,
                               fl_value *result, fl_error *error);

/*
 * Функция flang «Счётчик MGF1».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param nomer — «номер»: число
 * @return значение: список: число
 */
fl_status tls_client_schyotchik_mgf1(fl_ctx *ctx, fl_value nomer,
                                     fl_value *result, fl_error *error);

/*
 * Функция flang «Шаг маски».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param vid — «вид»: «Хеш подписи»
 * @param zerno — «зерно»: список: число
 * @param hod — «ход»: «Ход маски»
 * @return значение: «Ход маски»
 */
fl_status tls_client_shag_maski(fl_ctx *ctx, fl_value vid, fl_value zerno,
                                fl_value hod, fl_value *result,
                                fl_error *error);

/*
 * Функция flang «Маска MGF1».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param vid — «вид»: «Хеш подписи»
 * @param zerno — «зерно»: список: число
 * @param skolko — «сколько»: число
 * @return значение: список: число
 */
fl_status tls_client_maska_mgf1(fl_ctx *ctx, fl_value vid, fl_value zerno,
                                fl_value skolko, fl_value *result,
                                fl_error *error);

/*
 * Функция flang «Битов в октете».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param oktet — «октет»: число
 * @return значение: число
 */
fl_status tls_client_bitov_v_oktete(fl_ctx *ctx, fl_value oktet,
                                    fl_value *result, fl_error *error);

/*
 * Функция flang «Множитель шага».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param shag — «шаг»: число
 * @param pokazatel — «показатель»: число
 * @return значение: число
 */
fl_status tls_client_mnozhitel_shaga(fl_ctx *ctx, fl_value shag,
                                     fl_value pokazatel, fl_value *result,
                                     fl_error *error);

/*
 * Функция flang «Удвоить столько раз».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param razryady — «разряды»: список: число
 * @param delitel — «делитель»: список: число
 * @param raz — «раз»: число
 * @return значение: список: число
 */
fl_status tls_client_udvoit_stolko_raz(fl_ctx *ctx, fl_value razryady,
                                       fl_value delitel, fl_value raz,
                                       fl_value *result, fl_error *error);

/*
 * Функция flang «Степень двойки».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param pokazatel — «показатель»: число
 * @return значение: число
 */
fl_status tls_client_stepen_dvoyki(fl_ctx *ctx, fl_value pokazatel,
                                   fl_value *result, fl_error *error);

/*
 * Функция flang «Октеты длиной».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param razryady — «разряды»: список: число
 * @param skolko — «сколько»: число
 * @return значение: список: число
 */
fl_status tls_client_oktety_dlinoy(fl_ctx *ctx, fl_value razryady,
                                   fl_value skolko, fl_value *result,
                                   fl_error *error);

/*
 * Функция flang «Высота верхнего октета».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param delitel — «делитель»: список: число
 * @return значение: число
 */
fl_status tls_client_vysota_verhnego_okteta(fl_ctx *ctx, fl_value delitel,
                                            fl_value *result, fl_error *error);

/*
 * Функция flang «Граница верхнего октета».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param vysota — «высота»: число
 * @return значение: число
 */
fl_status tls_client_granica_verhnego_okteta(fl_ctx *ctx, fl_value vysota,
                                             fl_value *result, fl_error *error);

/*
 * Функция flang «Сбросить верх».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param oktety — «октеты»: список: число
 * @param granica — «граница»: число
 * @return значение: список: число
 */
fl_status tls_client_sbrosit_verh(fl_ctx *ctx, fl_value oktety,
                                  fl_value granica, fl_value *result,
                                  fl_error *error);

/*
 * Функция flang «Все нули».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param oktety — «октеты»: список: число
 * @return значение
 */
fl_status tls_client_vse_nuli(fl_ctx *ctx, fl_value oktety, fl_value *result,
                              fl_error *error);

/*
 * Функция flang «Кодировка PSS сходится».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param vid — «вид»: «Хеш подписи»
 * @param kodirovka — «кодировка»: список: число
 * @param granica — «граница»: число
 * @param hesh — «хеш»: список: число
 * @return значение
 */
fl_status tls_client_kodirovka_pss_shoditsya(fl_ctx *ctx, fl_value vid,
                                             fl_value kodirovka,
                                             fl_value granica, fl_value hesh,
                                             fl_value *result, fl_error *error);

/*
 * Функция flang «Октеты PSS сходятся».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param vid — «вид»: «Хеш подписи»
 * @param oktety — «октеты»: список: число
 * @param delitel — «делитель»: список: число
 * @param hesh — «хеш»: список: число
 * @return значение
 */
fl_status tls_client_oktety_pss_shodyatsya(fl_ctx *ctx, fl_value vid,
                                           fl_value oktety, fl_value delitel,
                                           fl_value hesh, fl_value *result,
                                           fl_error *error);

/*
 * Функция flang «Подпись PSS верна».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param vid — «вид»: «Хеш подписи»
 * @param podpis — «подпись»: список: число
 * @param delitel — «делитель»: список: число
 * @param pokazatel — «показатель»: число
 * @param hesh — «хеш»: список: число
 * @return значение
 */
fl_status tls_client_podpis_pss_verna(fl_ctx *ctx, fl_value vid,
                                      fl_value podpis, fl_value delitel,
                                      fl_value pokazatel, fl_value hesh,
                                      fl_value *result, fl_error *error);

/*
 * Функция flang «Строчные шестнадцать».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @return значение: строка
 */
fl_status tls_client_strochnye_shestnadcat(fl_ctx *ctx, fl_value *result,
                                           fl_error *error);

/*
 * Функция flang «Прописные шестнадцать».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @return значение: строка
 */
fl_status tls_client_propisnye_shestnadcat(fl_ctx *ctx, fl_value *result,
                                           fl_error *error);

/*
 * Функция flang «Значение знака 16».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param znak — «знак»: строка
 * @return значение: число
 */
fl_status tls_client_znachenie_znaka_16(fl_ctx *ctx, fl_value znak,
                                        fl_value *result, fl_error *error);

/*
 * Функция flang «Байт по счёту».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param tekst — «текст»: строка
 * @param nomer — «номер»: число
 * @return значение: число
 */
fl_status tls_client_bayt_po_schyotu(fl_ctx *ctx, fl_value tekst,
                                     fl_value nomer, fl_value *result,
                                     fl_error *error);

/*
 * Функция flang «Байты до места».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param tekst — «текст»: строка
 * @param mesto — «место»: число
 * @return значение: список: число
 */
fl_status tls_client_bayty_do_mesta(fl_ctx *ctx, fl_value tekst, fl_value mesto,
                                    fl_value *result, fl_error *error);

/*
 * Функция flang «Байты из шестнадцатеричного».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param tekst — «текст»: строка
 * @return значение: список: число
 */
fl_status tls_client_bayty_iz_shestnadcaterichnogo(fl_ctx *ctx, fl_value tekst,
                                                   fl_value *result,
                                                   fl_error *error);

/*
 * Функция flang «Пол дроби».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param znachenie — «значение»: число
 * @return значение: число
 */
fl_status tls_client_pol_drobi(fl_ctx *ctx, fl_value znachenie,
                               fl_value *result, fl_error *error);

/*
 * Функция flang «Деление вниз».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param delimoe — «делимое»: число
 * @param delitel — «делитель»: число
 * @return значение: число
 */
fl_status tls_client_delenie_vniz(fl_ctx *ctx, fl_value delimoe,
                                  fl_value delitel, fl_value *result,
                                  fl_error *error);

/*
 * Функция flang «Високосный год».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param god — «год»: число
 * @return значение
 */
fl_status tls_client_visokosnyy_god(fl_ctx *ctx, fl_value god, fl_value *result,
                                    fl_error *error);

/*
 * Функция flang «Дней в месяце».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param god — «год»: число
 * @param mesyac — «месяц»: число
 * @return значение: число
 */
fl_status tls_client_dney_v_mesyace(fl_ctx *ctx, fl_value god, fl_value mesyac,
                                    fl_value *result, fl_error *error);

/*
 * Функция flang «Дата верна».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param data — «дата»: «Календарный день»
 * @return значение
 */
fl_status tls_client_data_verna(fl_ctx *ctx, fl_value data, fl_value *result,
                                fl_error *error);

/*
 * Функция flang «Часы верны».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param chasy — «часы»: «Часы»
 * @return значение
 */
fl_status tls_client_chasy_verny(fl_ctx *ctx, fl_value chasy, fl_value *result,
                                 fl_error *error);

/*
 * Функция flang «Дней от эпохи».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param data — «дата»: «Календарный день»
 * @return значение: число
 */
fl_status tls_client_dney_ot_epohi(fl_ctx *ctx, fl_value data, fl_value *result,
                                   fl_error *error);

/*
 * Функция flang «Дата из дней».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param dni — «дни»: число
 * @return значение: «Календарный день»
 */
fl_status tls_client_data_iz_dney(fl_ctx *ctx, fl_value dni, fl_value *result,
                                  fl_error *error);

/*
 * Функция flang «День недели».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param data — «дата»: «Календарный день»
 * @return значение: число
 */
fl_status tls_client_den_nedeli(fl_ctx *ctx, fl_value data, fl_value *result,
                                fl_error *error);

/*
 * Функция flang «Имя дня недели».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param nomer — «номер»: «неотрицательное»
 * @return значение: строка
 */
fl_status tls_client_imya_dnya_nedeli(fl_ctx *ctx, fl_value nomer,
                                      fl_value *result, fl_error *error);

/*
 * Функция flang «День года».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param data — «дата»: «Календарный день»
 * @return значение: число
 */
fl_status tls_client_den_goda(fl_ctx *ctx, fl_value data, fl_value *result,
                              fl_error *error);

/*
 * Функция flang «Прибавить дни».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param data — «дата»: «Календарный день»
 * @param skolko — «сколько»: число
 * @return значение: «Календарный день»
 */
fl_status tls_client_pribavit_dni(fl_ctx *ctx, fl_value data, fl_value skolko,
                                  fl_value *result, fl_error *error);

/*
 * Функция flang «Разность дат».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param pervaya — «первая»: «Календарный день»
 * @param vtoraya — «вторая»: «Календарный день»
 * @return значение: число
 */
fl_status tls_client_raznost_dat(fl_ctx *ctx, fl_value pervaya,
                                 fl_value vtoraya, fl_value *result,
                                 fl_error *error);

/*
 * Функция flang «Секунд от эпохи».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param otmetka — «отметка»: «Отметка»
 * @return значение: число
 */
fl_status tls_client_sekund_ot_epohi(fl_ctx *ctx, fl_value otmetka,
                                     fl_value *result, fl_error *error);

/*
 * Функция flang «Раньше».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param pervaya — «первая»: «Отметка»
 * @param vtoraya — «вторая»: «Отметка»
 * @return значение
 */
fl_status tls_client_ranshe(fl_ctx *ctx, fl_value pervaya, fl_value vtoraya,
                            fl_value *result, fl_error *error);

/*
 * Функция flang «Одно мгновение».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param pervaya — «первая»: «Отметка»
 * @param vtoraya — «вторая»: «Отметка»
 * @return значение
 */
fl_status tls_client_odno_mgnovenie(fl_ctx *ctx, fl_value pervaya,
                                    fl_value vtoraya, fl_value *result,
                                    fl_error *error);

/*
 * Функция flang «Число из цифр».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param tekst — «текст»: строка
 * @return значение: число
 */
fl_status tls_client_chislo_iz_cifr(fl_ctx *ctx, fl_value tekst,
                                    fl_value *result, fl_error *error);

/*
 * Функция flang «Смещение из хвоста».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param hvost — «хвост»: строка
 * @return значение: число
 */
fl_status tls_client_smeschenie_iz_hvosta(fl_ctx *ctx, fl_value hvost,
                                          fl_value *result, fl_error *error);

/*
 * Функция flang «Разобрать отметку».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param tekst — «текст»: строка
 * @return значение: «Итог даты»
 */
fl_status tls_client_razobrat_otmetku(fl_ctx *ctx, fl_value tekst,
                                      fl_value *result, fl_error *error);

/*
 * Функция flang «Двумя знаками».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param znachenie — «значение»: число
 * @return значение: строка
 */
fl_status tls_client_dvumya_znakami(fl_ctx *ctx, fl_value znachenie,
                                    fl_value *result, fl_error *error);

/*
 * Функция flang «Четырьмя знаками».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param znachenie — «значение»: число
 * @return значение: строка
 */
fl_status tls_client_chetyrmya_znakami(fl_ctx *ctx, fl_value znachenie,
                                       fl_value *result, fl_error *error);

/*
 * Функция flang «Напечатать дату».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param data — «дата»: «Календарный день»
 * @return значение: строка
 */
fl_status tls_client_napechatat_datu(fl_ctx *ctx, fl_value data,
                                     fl_value *result, fl_error *error);

/*
 * Функция flang «Напечатать пояс».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param smeschenie — «смещение»: число
 * @return значение: строка
 */
fl_status tls_client_napechatat_poyas(fl_ctx *ctx, fl_value smeschenie,
                                      fl_value *result, fl_error *error);

/*
 * Функция flang «Напечатать отметку».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param otmetka — «отметка»: «Отметка»
 * @return значение: строка
 */
fl_status tls_client_napechatat_otmetku(fl_ctx *ctx, fl_value otmetka,
                                        fl_value *result, fl_error *error);

/*
 * Функция flang «Остаток при делении вниз».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param delimoe — «делимое»: число
 * @param delitel — «делитель»: число
 * @return значение: число
 */
fl_status tls_client_ostatok_pri_delenii_vniz(fl_ctx *ctx, fl_value delimoe,
                                              fl_value delitel,
                                              fl_value *result,
                                              fl_error *error);

/*
 * Функция flang «Длительность из часов минут секунд».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param chasov — «часов»: число
 * @param minut — «минут»: число
 * @param sekund — «секунд»: число
 * @return значение: «Длительность»
 */
fl_status
tls_client_dlitelnost_iz_chasov_minut_sekund(fl_ctx *ctx, fl_value chasov,
                                             fl_value minut, fl_value sekund,
                                             fl_value *result, fl_error *error);

/*
 * Функция flang «Часов в длительности».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param dlitelnost — «длительность»: «Длительность»
 * @return значение: число
 */
fl_status tls_client_chasov_v_dlitelnosti(fl_ctx *ctx, fl_value dlitelnost,
                                          fl_value *result, fl_error *error);

/*
 * Функция flang «Минут в длительности».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param dlitelnost — «длительность»: «Длительность»
 * @return значение: число
 */
fl_status tls_client_minut_v_dlitelnosti(fl_ctx *ctx, fl_value dlitelnost,
                                         fl_value *result, fl_error *error);

/*
 * Функция flang «Секунд в длительности».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param dlitelnost — «длительность»: «Длительность»
 * @return значение: число
 */
fl_status tls_client_sekund_v_dlitelnosti(fl_ctx *ctx, fl_value dlitelnost,
                                          fl_value *result, fl_error *error);

/*
 * Функция flang «Отметка из секунд».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param sekundy — «секунды»: число
 * @param smeschenie — «смещение»: число
 * @return значение: «Отметка»
 */
fl_status tls_client_otmetka_iz_sekund(fl_ctx *ctx, fl_value sekundy,
                                       fl_value smeschenie, fl_value *result,
                                       fl_error *error);

/*
 * Функция flang «Прибавить длительность».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param otmetka — «отметка»: «Отметка»
 * @param dlitelnost — «длительность»: «Длительность»
 * @return значение: «Отметка»
 */
fl_status tls_client_pribavit_dlitelnost(fl_ctx *ctx, fl_value otmetka,
                                         fl_value dlitelnost, fl_value *result,
                                         fl_error *error);

/*
 * Функция flang «Содержит момент».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param interval — «интервал»: «Интервал»
 * @param moment — «момент»: «Отметка»
 * @return значение
 */
fl_status tls_client_soderzhit_moment(fl_ctx *ctx, fl_value interval,
                                      fl_value moment, fl_value *result,
                                      fl_error *error);

/*
 * Функция flang «Пересекается».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param pervyy — «первый»: «Интервал»
 * @param vtoroy — «второй»: «Интервал»
 * @return значение
 */
fl_status tls_client_peresekaetsya(fl_ctx *ctx, fl_value pervyy,
                                   fl_value vtoroy, fl_value *result,
                                   fl_error *error);

/*
 * Функция flang «Ведущих цифр».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param znaki — «знаки»: список: строка
 * @return значение: число
 */
fl_status tls_client_veduschih_cifr(fl_ctx *ctx, fl_value znaki,
                                    fl_value *result, fl_error *error);

/*
 * Функция flang «Без долей секунды».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param tekst — «текст»: строка
 * @return значение: строка
 */
fl_status tls_client_bez_doley_sekundy(fl_ctx *ctx, fl_value tekst,
                                       fl_value *result, fl_error *error);

/*
 * Функция flang «Доли секунды».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param tekst — «текст»: строка
 * @return значение: число
 */
fl_status tls_client_doli_sekundy(fl_ctx *ctx, fl_value tekst, fl_value *result,
                                  fl_error *error);

/*
 * Функция flang «Разобрать отметку с долями».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param tekst — «текст»: строка
 * @return значение: «Итог даты»
 */
fl_status tls_client_razobrat_otmetku_s_dolyami(fl_ctx *ctx, fl_value tekst,
                                                fl_value *result,
                                                fl_error *error);

/*
 * Функция flang «Строчный октет».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param oktet — «октет»: число
 * @return значение: число
 */
fl_status tls_client_strochnyy_oktet(fl_ctx *ctx, fl_value oktet,
                                     fl_value *result, fl_error *error);

/*
 * Функция flang «Строчные октеты».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param oktety — «октеты»: список: число
 * @return значение: список: число
 */
fl_status tls_client_strochnye_oktety(fl_ctx *ctx, fl_value oktety,
                                      fl_value *result, fl_error *error);

/*
 * Функция flang «Октеты имени».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param imya — «имя»: строка
 * @return значение: список: число
 */
fl_status tls_client_oktety_imeni(fl_ctx *ctx, fl_value imya, fl_value *result,
                                  fl_error *error);

/*
 * Функция flang «Метка в месте».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param oktety — «октеты»: список: число
 * @param mesto — «место»: число
 * @return значение: число
 */
fl_status tls_client_metka_v_meste(fl_ctx *ctx, fl_value oktety, fl_value mesto,
                                   fl_value *result, fl_error *error);

/*
 * Функция flang «Последний или ноль».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param mesta — «места»: список: число
 * @return значение: число
 */
fl_status tls_client_posledniy_ili_nol(fl_ctx *ctx, fl_value mesta,
                                       fl_value *result, fl_error *error);

/*
 * Функция flang «Место с меткой».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param oktety — «октеты»: список: число
 * @param mesta — «места»: список: число
 * @param metka — «метка»: число
 * @return значение: число
 */
fl_status tls_client_mesto_s_metkoy(fl_ctx *ctx, fl_value oktety,
                                    fl_value mesta, fl_value metka,
                                    fl_value *result, fl_error *error);

/*
 * Функция flang «Места расширений».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param sert — «серт»: список: число
 * @return значение: список: число
 */
fl_status tls_client_mesta_rasshireniy(fl_ctx *ctx, fl_value sert,
                                       fl_value *result, fl_error *error);

/*
 * Функция flang «Опознаватель расширения».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param sert — «серт»: список: число
 * @param mesto — «место»: число
 * @return значение: строка
 */
fl_status tls_client_opoznavatel_rasshireniya(fl_ctx *ctx, fl_value sert,
                                              fl_value mesto, fl_value *result,
                                              fl_error *error);

/*
 * Функция flang «Расширение».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param sert — «серт»: список: число
 * @param opoznavatel — «опознаватель»: строка
 * @return значение: список: число
 */
fl_status tls_client_rasshirenie(fl_ctx *ctx, fl_value sert,
                                 fl_value opoznavatel, fl_value *result,
                                 fl_error *error);

/*
 * Функция flang «Имена узла».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param sert — «серт»: список: число
 * @return значение: список: список: число
 */
fl_status tls_client_imena_uzla(fl_ctx *ctx, fl_value sert, fl_value *result,
                                fl_error *error);

/*
 * Функция flang «Имена с меткой».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param imena — «имена»: список: число
 * @return значение: список: список: число
 */
fl_status tls_client_imena_s_metkoy(fl_ctx *ctx, fl_value imena,
                                    fl_value *result, fl_error *error);

/*
 * Функция flang «Удостоверяющий центр».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param sert — «серт»: список: число
 * @return значение
 */
fl_status tls_client_udostoveryayuschiy_centr(fl_ctx *ctx, fl_value sert,
                                              fl_value *result,
                                              fl_error *error);

/*
 * Функция flang «Хвост равен».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param oktety — «октеты»: список: число
 * @param hvost — «хвост»: список: число
 * @return значение
 */
fl_status tls_client_hvost_raven(fl_ctx *ctx, fl_value oktety, fl_value hvost,
                                 fl_value *result, fl_error *error);

/*
 * Функция flang «Имя подходит».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param shablon — «шаблон»: список: число
 * @param uzel — «узел»: список: число
 * @return значение
 */
fl_status tls_client_imya_podhodit(fl_ctx *ctx, fl_value shablon, fl_value uzel,
                                   fl_value *result, fl_error *error);

/*
 * Функция flang «Имя узла сходится».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param sert — «серт»: список: число
 * @param uzel — «узел»: список: число
 * @return значение
 */
fl_status tls_client_imya_uzla_shoditsya(fl_ctx *ctx, fl_value sert,
                                         fl_value uzel, fl_value *result,
                                         fl_error *error);

/*
 * Функция flang «Ключ сертификата RSA».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param sert — «серт»: список: число
 * @return значение
 */
fl_status tls_client_klyuch_sertifikata_rsa(fl_ctx *ctx, fl_value sert,
                                            fl_value *result, fl_error *error);

/*
 * Функция flang «Подпись звена верна».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param sert — «серт»: список: число
 * @param izdatel — «издатель»: список: число
 * @return значение
 */
fl_status tls_client_podpis_zvena_verna(fl_ctx *ctx, fl_value sert,
                                        fl_value izdatel, fl_value *result,
                                        fl_error *error);

/*
 * Функция flang «Подпись RSA сходится».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param sert — «серт»: список: число
 * @param izdatel — «издатель»: список: число
 * @return значение
 */
fl_status tls_client_podpis_rsa_shoditsya(fl_ctx *ctx, fl_value sert,
                                          fl_value izdatel, fl_value *result,
                                          fl_error *error);

/*
 * Функция flang «Время сертификата».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param millisekundy — «миллисекунды»: число
 * @return значение: число
 */
fl_status tls_client_vremya_sertifikata(fl_ctx *ctx, fl_value millisekundy,
                                        fl_value *result, fl_error *error);

/*
 * Функция flang «Первый отказ».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param pravila — «правила»: список: «Правило пути»
 * @return значение: «Приговор пути»
 */
fl_status tls_client_pervyy_otkaz(fl_ctx *ctx, fl_value pravila,
                                  fl_value *result, fl_error *error);

/*
 * Функция flang «Правило».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param verno — «верно»
 * @param kod — «код»: строка
 * @param slova — «слова»: строка
 * @return значение: «Правило пути»
 */
fl_status tls_client_pravilo(fl_ctx *ctx, fl_value verno, fl_value kod,
                             fl_value slova, fl_value *result, fl_error *error);

/*
 * Функция flang «Назвать».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param slova — «слова»: строка
 * @param sert — «серт»: список: число
 * @param verh — «верх»: список: число
 * @return значение: строка
 */
fl_status tls_client_nazvat(fl_ctx *ctx, fl_value slova, fl_value sert,
                            fl_value verh, fl_value *result, fl_error *error);

/*
 * Функция flang «С именами».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param prigovor — «приговор»: «Приговор пути»
 * @param sert — «серт»: список: число
 * @param verh — «верх»: список: число
 * @return значение: «Приговор пути»
 */
fl_status tls_client_s_imenami(fl_ctx *ctx, fl_value prigovor, fl_value sert,
                               fl_value verh, fl_value *result,
                               fl_error *error);

/*
 * Функция flang «Звено к корню».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param sert — «серт»: список: число
 * @param koren — «корень»: список: число
 * @param seychas — «сейчас»: число
 * @return значение: «Приговор пути»
 */
fl_status tls_client_zveno_k_kornyu(fl_ctx *ctx, fl_value sert, fl_value koren,
                                    fl_value seychas, fl_value *result,
                                    fl_error *error);

/*
 * Функция flang «Приговор звена к корню».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param sert — «серт»: список: число
 * @param koren — «корень»: список: число
 * @param seychas — «сейчас»: число
 * @return значение: «Приговор пути»
 */
fl_status tls_client_prigovor_zvena_k_kornyu(fl_ctx *ctx, fl_value sert,
                                             fl_value koren, fl_value seychas,
                                             fl_value *result, fl_error *error);

/*
 * Функция flang «Звено к верхнему».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param sert — «серт»: список: число
 * @param verh — «верх»: список: число
 * @param seychas — «сейчас»: число
 * @return значение: «Приговор пути»
 */
fl_status tls_client_zveno_k_verhnemu(fl_ctx *ctx, fl_value sert, fl_value verh,
                                      fl_value seychas, fl_value *result,
                                      fl_error *error);

/*
 * Функция flang «Приговор звена к верхнему».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param sert — «серт»: список: число
 * @param verh — «верх»: список: число
 * @param seychas — «сейчас»: число
 * @return значение: «Приговор пути»
 */
fl_status tls_client_prigovor_zvena_k_verhnemu(fl_ctx *ctx, fl_value sert,
                                               fl_value verh, fl_value seychas,
                                               fl_value *result,
                                               fl_error *error);

/*
 * Функция flang «Корень доверия».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param sertifikat — «сертификат»: список: число
 * @return значение: «Корень доверия»
 */
fl_status tls_client_koren_doveriya(fl_ctx *ctx, fl_value sertifikat,
                                    fl_value *result, fl_error *error);

/*
 * Функция flang «Корень издателя».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param korni — «корни»: список: «Корень доверия»
 * @param sert — «серт»: список: число
 * @return значение: список: число
 */
fl_status tls_client_koren_izdatelya(fl_ctx *ctx, fl_value korni, fl_value sert,
                                     fl_value *result, fl_error *error);

/*
 * Функция flang «Довести до корня».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * Хвостовой самовызов развёрнут в цикл: стек не растёт.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param cep — «цепь»: список: список: число
 * @param korni — «корни»: список: «Корень доверия»
 * @param seychas — «сейчас»: число
 * @return значение: «Приговор пути»
 */
fl_status tls_client_dovesti_do_kornya(fl_ctx *ctx, fl_value cep,
                                       fl_value korni, fl_value seychas,
                                       fl_value *result, fl_error *error);

/*
 * Функция flang «Шаг к корню».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param sert — «серт»: список: число
 * @param koren — «корень»: список: число
 * @param ostalnye — «остальные»: список: список: число
 * @param seychas — «сейчас»: число
 * @return значение: «Шаг пути»
 */
fl_status tls_client_shag_k_kornyu(fl_ctx *ctx, fl_value sert, fl_value koren,
                                   fl_value ostalnye, fl_value seychas,
                                   fl_value *result, fl_error *error);

/*
 * Функция flang «Шаг к верхнему».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param sert — «серт»: список: число
 * @param ostalnye — «остальные»: список: список: число
 * @param seychas — «сейчас»: число
 * @return значение: «Шаг пути»
 */
fl_status tls_client_shag_k_verhnemu(fl_ctx *ctx, fl_value sert,
                                     fl_value ostalnye, fl_value seychas,
                                     fl_value *result, fl_error *error);

/*
 * Функция flang «Цепочка не дошла».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param sert — «серт»: список: число
 * @return значение: «Приговор пути»
 */
fl_status tls_client_cepochka_ne_doshla(fl_ctx *ctx, fl_value sert,
                                        fl_value *result, fl_error *error);

/*
 * Функция flang «Проверить путь».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param cep — «цепь»: список: список: число
 * @param korni — «корни»: список: «Корень доверия»
 * @param seychas — «сейчас»: число
 * @param uzel — «узел»: строка
 * @return значение: «Приговор пути»
 */
fl_status tls_client_proverit_put(fl_ctx *ctx, fl_value cep, fl_value korni,
                                  fl_value seychas, fl_value uzel,
                                  fl_value *result, fl_error *error);

/*
 * Функция flang «Начало связки корней».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @return значение: «Ход связки корней»
 */
fl_status tls_client_nachalo_svyazki_korney(fl_ctx *ctx, fl_value *result,
                                            fl_error *error);

/*
 * Функция flang «Приметы строчек».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @return значение: список: «Примета строчки»
 */
fl_status tls_client_primety_strochek(fl_ctx *ctx, fl_value *result,
                                      fl_error *error);

/*
 * Функция flang «Вид строчки».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param strochka — «строчка»: строка
 * @return значение: «Вид строчки»
 */
fl_status tls_client_vid_strochki(fl_ctx *ctx, fl_value strochka,
                                  fl_value *result, fl_error *error);

/*
 * Функция flang «Шаг связки корней».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param hod — «ход»: «Ход связки корней»
 * @param strochka — «строчка»: строка
 * @return значение: «Ход связки корней»
 */
fl_status tls_client_shag_svyazki_korney(fl_ctx *ctx, fl_value hod,
                                         fl_value strochka, fl_value *result,
                                         fl_error *error);

/*
 * Функция flang «Строчка набрана».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param hod — «ход»: «Ход связки корней»
 * @param strochka — «строчка»: строка
 * @return значение: «Ход связки корней»
 */
fl_status tls_client_strochka_nabrana(fl_ctx *ctx, fl_value hod,
                                      fl_value strochka, fl_value *result,
                                      fl_error *error);

/*
 * Функция flang «Корни из связки».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param svyazka — «связка»: строка
 * @return значение: список: «Корень доверия»
 */
fl_status tls_client_korni_iz_svyazki(fl_ctx *ctx, fl_value svyazka,
                                      fl_value *result, fl_error *error);

/*
 * Функция flang «Нули поля».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param skolko — «сколько»: число
 * @return значение: список: число
 */
fl_status tls_client_nuli_polya(fl_ctx *ctx, fl_value skolko, fl_value *result,
                                fl_error *error);

/*
 * Функция flang «Разряд».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * Хвостовой самовызов развёрнут в цикл: стек не растёт.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param razryady — «разряды»: список: число
 * @param nomer — «номер»: число
 * @return значение: число
 */
fl_status tls_client_razryad(fl_ctx *ctx, fl_value razryady, fl_value nomer,
                             fl_value *result, fl_error *error);

/*
 * Функция flang «Взять первые».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param razryady — «разряды»: список: число
 * @param skolko — «сколько»: число
 * @return значение: список: число
 */
fl_status tls_client_vzyat_pervye(fl_ctx *ctx, fl_value razryady,
                                  fl_value skolko, fl_value *result,
                                  fl_error *error);

/*
 * Функция flang «Отбросить первые».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * Хвостовой самовызов развёрнут в цикл: стек не растёт.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param razryady — «разряды»: список: число
 * @param skolko — «сколько»: число
 * @return значение: список: число
 */
fl_status tls_client_otbrosit_pervye(fl_ctx *ctx, fl_value razryady,
                                     fl_value skolko, fl_value *result,
                                     fl_error *error);

/*
 * Функция flang «Сложить по разрядам».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param pervye — «первые»: список: число
 * @param vtorye — «вторые»: список: число
 * @return значение: список: число
 */
fl_status tls_client_slozhit_po_razryadam(fl_ctx *ctx, fl_value pervye,
                                          fl_value vtorye, fl_value *result,
                                          fl_error *error);

/*
 * Функция flang «Добавить к первому».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param razryady — «разряды»: список: число
 * @param dobavka — «добавка»: число
 * @return значение: список: число
 */
fl_status tls_client_dobavit_k_pervomu(fl_ctx *ctx, fl_value razryady,
                                       fl_value dobavka, fl_value *result,
                                       fl_error *error);

/*
 * Функция flang «Шаг переноса».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param hod — «ход»: «Ход переноса»
 * @param razryad — «разряд»: число
 * @return значение: «Ход переноса»
 */
fl_status tls_client_shag_perenosa(fl_ctx *ctx, fl_value hod, fl_value razryad,
                                   fl_value *result, fl_error *error);

/*
 * Функция flang «Разложить».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param razryady — «разряды»: список: число
 * @return значение: «Ход переноса»
 */
fl_status tls_client_razlozhit(fl_ctx *ctx, fl_value razryady, fl_value *result,
                               fl_error *error);

/*
 * Функция flang «Ужать».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param razryady — «разряды»: список: число
 * @return значение: список: число
 */
fl_status tls_client_uzhat(fl_ctx *ctx, fl_value razryady, fl_value *result,
                           fl_error *error);

/*
 * Функция flang «Свести».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param razryady — «разряды»: список: число
 * @return значение: список: число
 */
fl_status tls_client_svesti(fl_ctx *ctx, fl_value razryady, fl_value *result,
                            fl_error *error);

/*
 * Функция flang «Ноль поля».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @return значение: список: число
 */
fl_status tls_client_nol_polya(fl_ctx *ctx, fl_value *result, fl_error *error);

/*
 * Функция flang «Единица поля».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @return значение: список: число
 */
fl_status tls_client_edinica_polya(fl_ctx *ctx, fl_value *result,
                                   fl_error *error);

/*
 * Функция flang «Простое поля».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @return значение: список: число
 */
fl_status tls_client_prostoe_polya(fl_ctx *ctx, fl_value *result,
                                   fl_error *error);

/*
 * Функция flang «Четыре простых».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @return значение: список: число
 */
fl_status tls_client_chetyre_prostyh(fl_ctx *ctx, fl_value *result,
                                     fl_error *error);

/*
 * Функция flang «Из байтов».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param bayty — «байты»: список: число
 * @return значение: список: число
 */
fl_status tls_client_iz_baytov(fl_ctx *ctx, fl_value bayty, fl_value *result,
                               fl_error *error);

/*
 * Функция flang «Точка из байтов».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param bayty — «байты»: список: число
 * @return значение: список: число
 */
fl_status tls_client_tochka_iz_baytov(fl_ctx *ctx, fl_value bayty,
                                      fl_value *result, fl_error *error);

/*
 * Функция flang «В байты».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param razryady — «разряды»: список: число
 * @return значение: список: число
 */
fl_status tls_client_v_bayty(fl_ctx *ctx, fl_value razryady, fl_value *result,
                             fl_error *error);

/*
 * Функция flang «Снять старший».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param razryady — «разряды»: список: число
 * @return значение: список: число
 */
fl_status tls_client_snyat_starshiy(fl_ctx *ctx, fl_value razryady,
                                    fl_value *result, fl_error *error);

/*
 * Функция flang «Вычесть с займом».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param pervye — «первые»: список: число
 * @param vtorye — «вторые»: список: число
 * @param zayom — «заём»: число
 * @return значение: «Ход займа»
 */
fl_status tls_client_vychest_s_zaymom(fl_ctx *ctx, fl_value pervye,
                                      fl_value vtorye, fl_value zayom,
                                      fl_value *result, fl_error *error);

/*
 * Функция flang «Канон».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param razryady — «разряды»: список: число
 * @return значение: список: число
 */
fl_status tls_client_kanon(fl_ctx *ctx, fl_value razryady, fl_value *result,
                           fl_error *error);

/*
 * Функция flang «Это ноль».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param razryady — «разряды»: список: число
 * @return значение
 */
fl_status tls_client_eto_nol(fl_ctx *ctx, fl_value razryady, fl_value *result,
                             fl_error *error);

/*
 * Функция flang «Это единица».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param razryady — «разряды»: список: число
 * @return значение
 */
fl_status tls_client_eto_edinica(fl_ctx *ctx, fl_value razryady,
                                 fl_value *result, fl_error *error);

/*
 * Функция flang «Сложение».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param a — «а»: список: число
 * @param b — «б»: список: число
 * @return значение: список: число
 */
fl_status tls_client_slozhenie(fl_ctx *ctx, fl_value a, fl_value b,
                               fl_value *result, fl_error *error);

/*
 * Функция flang «Вычитание».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param a — «а»: список: число
 * @param b — «б»: список: число
 * @return значение: список: число
 */
fl_status tls_client_vychitanie(fl_ctx *ctx, fl_value a, fl_value b,
                                fl_value *result, fl_error *error);

/*
 * Функция flang «Свёртка разрядов».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param a — «а»: список: число
 * @param b — «б»: список: число
 * @return значение: список: число
 */
fl_status tls_client_svyortka_razryadov(fl_ctx *ctx, fl_value a, fl_value b,
                                        fl_value *result, fl_error *error);

/*
 * Функция flang «Свернуть разряды».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param razryady — «разряды»: список: число
 * @return значение: список: число
 */
fl_status tls_client_svernut_razryady(fl_ctx *ctx, fl_value razryady,
                                      fl_value *result, fl_error *error);

/*
 * Функция flang «Умножение».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param a — «а»: список: число
 * @param b — «б»: список: число
 * @return значение: список: число
 */
fl_status tls_client_umnozhenie(fl_ctx *ctx, fl_value a, fl_value b,
                                fl_value *result, fl_error *error);

/*
 * Функция flang «Квадрат».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param a — «а»: список: число
 * @return значение: список: число
 */
fl_status tls_client_kvadrat(fl_ctx *ctx, fl_value a, fl_value *result,
                             fl_error *error);

/*
 * Функция flang «Умножить на число».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param a — «а»: список: число
 * @param mnozhitel — «множитель»: число
 * @return значение: список: число
 */
fl_status tls_client_umnozhit_na_chislo(fl_ctx *ctx, fl_value a,
                                        fl_value mnozhitel, fl_value *result,
                                        fl_error *error);

/*
 * Функция flang «Квадраты».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * Хвостовой самовызов развёрнут в цикл: стек не растёт.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param a — «а»: список: число
 * @param skolko — «сколько»: число
 * @return значение: список: число
 */
fl_status tls_client_kvadraty(fl_ctx *ctx, fl_value a, fl_value skolko,
                              fl_value *result, fl_error *error);

/*
 * Функция flang «Обращение».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param a — «а»: список: число
 * @return значение: список: число
 */
fl_status tls_client_obraschenie(fl_ctx *ctx, fl_value a, fl_value *result,
                                 fl_error *error);

/*
 * Функция flang «Веса байта поля».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @return значение: список: число
 */
fl_status tls_client_vesa_bayta_polya(fl_ctx *ctx, fl_value *result,
                                      fl_error *error);

/*
 * Функция flang «Бит скаляра».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param skalyar — «скаляр»: список: число
 * @param nomer — «номер»: число
 * @return значение: число
 */
fl_status tls_client_bit_skalyara(fl_ctx *ctx, fl_value skalyar, fl_value nomer,
                                  fl_value *result, fl_error *error);

/*
 * Функция flang «Зажать скаляр».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param bayty — «байты»: список: число
 * @return значение: список: число
 */
fl_status tls_client_zazhat_skalyar(fl_ctx *ctx, fl_value bayty,
                                    fl_value *result, fl_error *error);

/*
 * Функция flang «Шаг лестницы».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param hod — «ход»: «Ход лестницы»
 * @param tochka — «точка»: список: число
 * @param bit — «бит»: число
 * @return значение: «Ход лестницы»
 */
fl_status tls_client_shag_lestnicy(fl_ctx *ctx, fl_value hod, fl_value tochka,
                                   fl_value bit, fl_value *result,
                                   fl_error *error);

/*
 * Функция flang «Лестница».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * Хвостовой самовызов развёрнут в цикл: стек не растёт.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param skalyar — «скаляр»: список: число
 * @param tochka — «точка»: список: число
 * @param hod — «ход»: «Ход лестницы»
 * @param ostalos — «осталось»: число
 * @return значение: «Ход лестницы»
 */
fl_status tls_client_lestnica(fl_ctx *ctx, fl_value skalyar, fl_value tochka,
                              fl_value hod, fl_value ostalos, fl_value *result,
                              fl_error *error);

/*
 * Функция flang «Умножить точку».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param skalyar — «скаляр»: список: число
 * @param tochka — «точка»: список: число
 * @return значение: список: число
 */
fl_status tls_client_umnozhit_tochku(fl_ctx *ctx, fl_value skalyar,
                                     fl_value tochka, fl_value *result,
                                     fl_error *error);

/*
 * Функция flang «Основание».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @return значение: список: число
 */
fl_status tls_client_osnovanie(fl_ctx *ctx, fl_value *result, fl_error *error);

/*
 * Функция flang «Открытый ключ».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param tayna — «тайна»: список: число
 * @return значение: список: число
 */
fl_status tls_client_otkrytyy_klyuch(fl_ctx *ctx, fl_value tayna,
                                     fl_value *result, fl_error *error);

/*
 * Функция flang «Веса байта».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @return значение: список: число
 */
fl_status tls_client_vesa_bayta(fl_ctx *ctx, fl_value *result, fl_error *error);

/*
 * Функция flang «Исключающее или байтов».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param pervyy — «первый»: число
 * @param vtoroy — «второй»: число
 * @return значение: число
 */
fl_status tls_client_isklyuchayuschee_ili_baytov(fl_ctx *ctx, fl_value pervyy,
                                                 fl_value vtoroy,
                                                 fl_value *result,
                                                 fl_error *error);

/*
 * Функция flang «Байт по номеру».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param bayty — «байты»: список: число
 * @param nomer — «номер»: число
 * @return значение: число
 */
fl_status tls_client_bayt_po_nomeru(fl_ctx *ctx, fl_value bayty, fl_value nomer,
                                    fl_value *result, fl_error *error);

/*
 * Функция flang «Таблица подстановки».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @return значение: список: число
 */
fl_status tls_client_tablica_podstanovki(fl_ctx *ctx, fl_value *result,
                                         fl_error *error);

/*
 * Функция flang «Подстановка».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param bayt — «байт»: число
 * @return значение: число
 */
fl_status tls_client_podstanovka(fl_ctx *ctx, fl_value bayt, fl_value *result,
                                 fl_error *error);

/*
 * Функция flang «Удвоить в поле».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param bayt — «байт»: число
 * @return значение: число
 */
fl_status tls_client_udvoit_v_pole(fl_ctx *ctx, fl_value bayt, fl_value *result,
                                   fl_error *error);

/*
 * Функция flang «Утроить в поле».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param bayt — «байт»: число
 * @return значение: число
 */
fl_status tls_client_utroit_v_pole(fl_ctx *ctx, fl_value bayt, fl_value *result,
                                   fl_error *error);

/*
 * Функция flang «Четыре байта».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param bayty — «байты»: список: число
 * @param smeschenie — «смещение»: число
 * @return значение: список: число
 */
fl_status tls_client_chetyre_bayta(fl_ctx *ctx, fl_value bayty,
                                   fl_value smeschenie, fl_value *result,
                                   fl_error *error);

/*
 * Функция flang «Шестнадцать байтов».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param bayty — «байты»: список: число
 * @param smeschenie — «смещение»: число
 * @return значение: список: число
 */
fl_status tls_client_shestnadcat_baytov(fl_ctx *ctx, fl_value bayty,
                                        fl_value smeschenie, fl_value *result,
                                        fl_error *error);

/*
 * Функция flang «Сложить слова».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param pervoe — «первое»: список: число
 * @param vtoroe — «второе»: список: число
 * @return значение: список: число
 */
fl_status tls_client_slozhit_slova(fl_ctx *ctx, fl_value pervoe,
                                   fl_value vtoroe, fl_value *result,
                                   fl_error *error);

/*
 * Функция flang «Постоянные раундов».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @return значение: список: число
 */
fl_status tls_client_postoyannye_raundov(fl_ctx *ctx, fl_value *result,
                                         fl_error *error);

/*
 * Функция flang «Слово поворота».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param slovo — «слово»: список: число
 * @param postoyannaya — «постоянная»: число
 * @return значение: список: число
 */
fl_status tls_client_slovo_povorota(fl_ctx *ctx, fl_value slovo,
                                    fl_value postoyannaya, fl_value *result,
                                    fl_error *error);

/*
 * Функция flang «Шаг расширения».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param rasshirenie — «расширение»: список: число
 * @param postoyannaya — «постоянная»: число
 * @return значение: список: число
 */
fl_status tls_client_shag_rasshireniya(fl_ctx *ctx, fl_value rasshirenie,
                                       fl_value postoyannaya, fl_value *result,
                                       fl_error *error);

/*
 * Функция flang «Расширение ключа».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param klyuch — «ключ»: список: число
 * @return значение: список: число
 */
fl_status tls_client_rasshirenie_klyucha(fl_ctx *ctx, fl_value klyuch,
                                         fl_value *result, fl_error *error);

/*
 * Функция flang «Подстановка блока».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param kvadrat — «квадрат»: список: число
 * @return значение: список: число
 */
fl_status tls_client_podstanovka_bloka(fl_ctx *ctx, fl_value kvadrat,
                                       fl_value *result, fl_error *error);

/*
 * Функция flang «Сдвиг строк».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param kvadrat — «квадрат»: список: число
 * @return значение: список: число
 */
fl_status tls_client_sdvig_strok(fl_ctx *ctx, fl_value kvadrat,
                                 fl_value *result, fl_error *error);

/*
 * Функция flang «Смешать столбец».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param b0 — «б0»: число
 * @param b1 — «б1»: число
 * @param b2 — «б2»: число
 * @param b3 — «б3»: число
 * @return значение: список: число
 */
fl_status tls_client_smeshat_stolbec(fl_ctx *ctx, fl_value b0, fl_value b1,
                                     fl_value b2, fl_value b3, fl_value *result,
                                     fl_error *error);

/*
 * Функция flang «Смешать столбцы».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param kvadrat — «квадрат»: список: число
 * @return значение: список: число
 */
fl_status tls_client_smeshat_stolbcy(fl_ctx *ctx, fl_value kvadrat,
                                     fl_value *result, fl_error *error);

/*
 * Функция flang «Сложить с ключом».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param kvadrat — «квадрат»: список: число
 * @param klyuch — «ключ»: список: число
 * @return значение: список: число
 */
fl_status tls_client_slozhit_s_klyuchom(fl_ctx *ctx, fl_value kvadrat,
                                        fl_value klyuch, fl_value *result,
                                        fl_error *error);

/*
 * Функция flang «Ключ раунда».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param rasshirenie — «расширение»: список: число
 * @param raund — «раунд»: число
 * @return значение: список: число
 */
fl_status tls_client_klyuch_raunda(fl_ctx *ctx, fl_value rasshirenie,
                                   fl_value raund, fl_value *result,
                                   fl_error *error);

/*
 * Функция flang «Шаг раунда шифра».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param hod — «ход»: «Ход шифра»
 * @param raund — «раунд»: число
 * @return значение: «Ход шифра»
 */
fl_status tls_client_shag_raunda_shifra(fl_ctx *ctx, fl_value hod,
                                        fl_value raund, fl_value *result,
                                        fl_error *error);

/*
 * Функция flang «Состояние хода».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param hod — «ход»: «Ход шифра»
 * @return значение: список: число
 */
fl_status tls_client_sostoyanie_hoda(fl_ctx *ctx, fl_value hod,
                                     fl_value *result, fl_error *error);

/*
 * Функция flang «Зашифровать блок».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param klyuch — «ключ»: список: число
 * @param blok — «блок»: список: число
 * @return значение: список: число
 */
fl_status tls_client_zashifrovat_blok(fl_ctx *ctx, fl_value klyuch,
                                      fl_value blok, fl_value *result,
                                      fl_error *error);

/*
 * Функция flang «Шаг счёта».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param hod — «ход»: «Ход счёта»
 * @param bayt — «байт»: число
 * @return значение: «Ход счёта»
 */
fl_status tls_client_shag_schyota(fl_ctx *ctx, fl_value hod, fl_value bayt,
                                  fl_value *result, fl_error *error);

/*
 * Функция flang «Байты счёта».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param hod — «ход»: «Ход счёта»
 * @return значение: список: число
 */
fl_status tls_client_bayty_schyota(fl_ctx *ctx, fl_value hod, fl_value *result,
                                   fl_error *error);

/*
 * Функция flang «Прибавить единицу».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param schyotchik — «счётчик»: список: число
 * @return значение: список: число
 */
fl_status tls_client_pribavit_edinicu(fl_ctx *ctx, fl_value schyotchik,
                                      fl_value *result, fl_error *error);

/*
 * Функция flang «Шаг гаммы».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param hod — «ход»: «Ход гаммы»
 * @param bayt — «байт»: число
 * @return значение: «Ход гаммы»
 */
fl_status tls_client_shag_gammy(fl_ctx *ctx, fl_value hod, fl_value bayt,
                                fl_value *result, fl_error *error);

/*
 * Функция flang «Выход гаммы».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param hod — «ход»: «Ход гаммы»
 * @return значение: список: число
 */
fl_status tls_client_vyhod_gammy(fl_ctx *ctx, fl_value hod, fl_value *result,
                                 fl_error *error);

/*
 * Функция flang «Шифр CTR».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param klyuch — «ключ»: список: число
 * @param schyotchik — «счётчик»: список: число
 * @param tekst — «текст»: список: число
 * @return значение: список: число
 */
fl_status tls_client_shifr_ctr(fl_ctx *ctx, fl_value klyuch,
                               fl_value schyotchik, fl_value tekst,
                               fl_value *result, fl_error *error);

/*
 * Функция flang «Сложить блоки».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param pervyy — «первый»: список: число
 * @param vtoroy — «второй»: список: число
 * @return значение: список: число
 */
fl_status tls_client_slozhit_bloki(fl_ctx *ctx, fl_value pervyy,
                                   fl_value vtoroy, fl_value *result,
                                   fl_error *error);

/*
 * Функция flang «Многочлен поля».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @return значение: список: число
 */
fl_status tls_client_mnogochlen_polya(fl_ctx *ctx, fl_value *result,
                                      fl_error *error);

/*
 * Функция flang «Шаг сдвига блока».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param hod — «ход»: «Ход сдвига»
 * @param bayt — «байт»: число
 * @return значение: «Ход сдвига»
 */
fl_status tls_client_shag_sdviga_bloka(fl_ctx *ctx, fl_value hod, fl_value bayt,
                                       fl_value *result, fl_error *error);

/*
 * Функция flang «Байты сдвига».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param hod — «ход»: «Ход сдвига»
 * @return значение: список: число
 */
fl_status tls_client_bayty_sdviga(fl_ctx *ctx, fl_value hod, fl_value *result,
                                  fl_error *error);

/*
 * Функция flang «Сдвиг блока вправо».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param blok — «блок»: список: число
 * @return значение: список: число
 */
fl_status tls_client_sdvig_bloka_vpravo(fl_ctx *ctx, fl_value blok,
                                        fl_value *result, fl_error *error);

/*
 * Функция flang «Привести сдвиг».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param blok — «блок»: список: число
 * @return значение: список: число
 */
fl_status tls_client_privesti_sdvig(fl_ctx *ctx, fl_value blok,
                                    fl_value *result, fl_error *error);

/*
 * Функция flang «Шаг разряда поля».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param hod — «ход»: «Ход поля»
 * @param bit — «бит»: число
 * @return значение: «Ход поля»
 */
fl_status tls_client_shag_razryada_polya(fl_ctx *ctx, fl_value hod,
                                         fl_value bit, fl_value *result,
                                         fl_error *error);

/*
 * Функция flang «Шаг байта поля».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param hod — «ход»: «Ход поля»
 * @param bayt — «байт»: число
 * @return значение: «Ход поля»
 */
fl_status tls_client_shag_bayta_polya(fl_ctx *ctx, fl_value hod, fl_value bayt,
                                      fl_value *result, fl_error *error);

/*
 * Функция flang «Произведение поля».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param hod — «ход»: «Ход поля»
 * @return значение: список: число
 */
fl_status tls_client_proizvedenie_polya(fl_ctx *ctx, fl_value hod,
                                        fl_value *result, fl_error *error);

/*
 * Функция flang «Умножить в поле».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param pervyy — «первый»: список: число
 * @param vtoroy — «второй»: список: число
 * @return значение: список: число
 */
fl_status tls_client_umnozhit_v_pole(fl_ctx *ctx, fl_value pervyy,
                                     fl_value vtoroy, fl_value *result,
                                     fl_error *error);

/*
 * Функция flang «Шаг GHASH».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param hod — «ход»: «Ход GHASH»
 * @param bayt — «байт»: число
 * @return значение: «Ход GHASH»
 */
fl_status tls_client_shag_ghash(fl_ctx *ctx, fl_value hod, fl_value bayt,
                                fl_value *result, fl_error *error);

/*
 * Функция flang «Свод GHASH».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param hod — «ход»: «Ход GHASH»
 * @return значение: список: число
 */
fl_status tls_client_svod_ghash(fl_ctx *ctx, fl_value hod, fl_value *result,
                                fl_error *error);

/*
 * Функция flang «GHASH».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param klyuch — «ключ»: список: число
 * @param dannye — «данные»: список: число
 * @return значение: список: число
 */
fl_status tls_client_ghash(fl_ctx *ctx, fl_value klyuch, fl_value dannye,
                           fl_value *result, fl_error *error);

/*
 * Функция flang «Ключ хеша».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param klyuch — «ключ»: список: число
 * @return значение: список: число
 */
fl_status tls_client_klyuch_hesha(fl_ctx *ctx, fl_value klyuch,
                                  fl_value *result, fl_error *error);

/*
 * Функция flang «Прибавить единицу по младшим четырём».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param schyotchik — «счётчик»: список: число
 * @return значение: список: число
 */
fl_status tls_client_pribavit_edinicu_po_mladshim_chetyryom(fl_ctx *ctx,
                                                            fl_value schyotchik,
                                                            fl_value *result,
                                                            fl_error *error);

/*
 * Функция flang «Шаг гаммы GCM».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param hod — «ход»: «Ход гаммы GCM»
 * @param bayt — «байт»: число
 * @return значение: «Ход гаммы GCM»
 */
fl_status tls_client_shag_gammy_gcm(fl_ctx *ctx, fl_value hod, fl_value bayt,
                                    fl_value *result, fl_error *error);

/*
 * Функция flang «Выход гаммы GCM».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param hod — «ход»: «Ход гаммы GCM»
 * @return значение: список: число
 */
fl_status tls_client_vyhod_gammy_gcm(fl_ctx *ctx, fl_value hod,
                                     fl_value *result, fl_error *error);

/*
 * Функция flang «Шифр GCTR».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param klyuch — «ключ»: список: число
 * @param schyotchik — «счётчик»: список: число
 * @param tekst — «текст»: список: число
 * @return значение: список: число
 */
fl_status tls_client_shifr_gctr(fl_ctx *ctx, fl_value klyuch,
                                fl_value schyotchik, fl_value tekst,
                                fl_value *result, fl_error *error);

/*
 * Функция flang «Набивка до блока».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param bayty — «байты»: список: число
 * @return значение: список: число
 */
fl_status tls_client_nabivka_do_bloka(fl_ctx *ctx, fl_value bayty,
                                      fl_value *result, fl_error *error);

/*
 * Функция flang «Данные GHASH».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param dop — «доп»: список: число
 * @param shifrotekst — «шифротекст»: список: число
 * @return значение: список: число
 */
fl_status tls_client_dannye_ghash(fl_ctx *ctx, fl_value dop,
                                  fl_value shifrotekst, fl_value *result,
                                  fl_error *error);

/*
 * Функция flang «Начальный счётчик».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param klyuch — «ключ»: список: число
 * @param vektor — «вектор»: список: число
 * @return значение: список: число
 */
fl_status tls_client_nachalnyy_schyotchik(fl_ctx *ctx, fl_value klyuch,
                                          fl_value vektor, fl_value *result,
                                          fl_error *error);

/*
 * Функция flang «Тег GCM».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param klyuch — «ключ»: список: число
 * @param vektor — «вектор»: список: число
 * @param dop — «доп»: список: число
 * @param shifrotekst — «шифротекст»: список: число
 * @return значение: список: число
 */
fl_status tls_client_teg_gcm(fl_ctx *ctx, fl_value klyuch, fl_value vektor,
                             fl_value dop, fl_value shifrotekst,
                             fl_value *result, fl_error *error);

/*
 * Функция flang «Зашифровать GCM».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param klyuch — «ключ»: список: число
 * @param vektor — «вектор»: список: число
 * @param dop — «доп»: список: число
 * @param tekst — «текст»: список: число
 * @return значение: «Печать GCM»
 */
fl_status tls_client_zashifrovat_gcm(fl_ctx *ctx, fl_value klyuch,
                                     fl_value vektor, fl_value dop,
                                     fl_value tekst, fl_value *result,
                                     fl_error *error);

/*
 * Функция flang «Расшифровано ли».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param ishod — «исход»: «Исход GCM»
 * @return значение
 */
fl_status tls_client_rasshifrovano_li(fl_ctx *ctx, fl_value ishod,
                                      fl_value *result, fl_error *error);

/*
 * Функция flang «Текст исхода».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param ishod — «исход»: «Исход GCM»
 * @return значение: список: число
 */
fl_status tls_client_tekst_ishoda(fl_ctx *ctx, fl_value ishod, fl_value *result,
                                  fl_error *error);

/*
 * Функция flang «Расшифровать GCM».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param klyuch — «ключ»: список: число
 * @param vektor — «вектор»: список: число
 * @param dop — «доп»: список: число
 * @param shifrotekst — «шифротекст»: список: число
 * @param teg — «тег»: список: число
 * @return значение: «Исход GCM»
 */
fl_status tls_client_rasshifrovat_gcm(fl_ctx *ctx, fl_value klyuch,
                                      fl_value vektor, fl_value dop,
                                      fl_value shifrotekst, fl_value teg,
                                      fl_value *result, fl_error *error);

/*
 * Функция flang «Обратная таблица подстановки».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @return значение: список: число
 */
fl_status tls_client_obratnaya_tablica_podstanovki(fl_ctx *ctx,
                                                   fl_value *result,
                                                   fl_error *error);

/*
 * Функция flang «Обратная подстановка».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param bayt — «байт»: число
 * @return значение: число
 */
fl_status tls_client_obratnaya_podstanovka(fl_ctx *ctx, fl_value bayt,
                                           fl_value *result, fl_error *error);

/*
 * Функция flang «Обратная подстановка блока».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param kvadrat — «квадрат»: список: число
 * @return значение: список: число
 */
fl_status tls_client_obratnaya_podstanovka_bloka(fl_ctx *ctx, fl_value kvadrat,
                                                 fl_value *result,
                                                 fl_error *error);

/*
 * Функция flang «Обратный сдвиг строк».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param kvadrat — «квадрат»: список: число
 * @return значение: список: число
 */
fl_status tls_client_obratnyy_sdvig_strok(fl_ctx *ctx, fl_value kvadrat,
                                          fl_value *result, fl_error *error);

/*
 * Функция flang «Умножить на девять в поле».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param bayt — «байт»: число
 * @return значение: число
 */
fl_status tls_client_umnozhit_na_devyat_v_pole(fl_ctx *ctx, fl_value bayt,
                                               fl_value *result,
                                               fl_error *error);

/*
 * Функция flang «Умножить на одиннадцать в поле».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param bayt — «байт»: число
 * @return значение: число
 */
fl_status tls_client_umnozhit_na_odinnadcat_v_pole(fl_ctx *ctx, fl_value bayt,
                                                   fl_value *result,
                                                   fl_error *error);

/*
 * Функция flang «Умножить на тринадцать в поле».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param bayt — «байт»: число
 * @return значение: число
 */
fl_status tls_client_umnozhit_na_trinadcat_v_pole(fl_ctx *ctx, fl_value bayt,
                                                  fl_value *result,
                                                  fl_error *error);

/*
 * Функция flang «Умножить на четырнадцать в поле».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param bayt — «байт»: число
 * @return значение: число
 */
fl_status tls_client_umnozhit_na_chetyrnadcat_v_pole(fl_ctx *ctx, fl_value bayt,
                                                     fl_value *result,
                                                     fl_error *error);

/*
 * Функция flang «Обратно смешать столбец».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param b0 — «б0»: число
 * @param b1 — «б1»: число
 * @param b2 — «б2»: число
 * @param b3 — «б3»: число
 * @return значение: список: число
 */
fl_status tls_client_obratno_smeshat_stolbec(fl_ctx *ctx, fl_value b0,
                                             fl_value b1, fl_value b2,
                                             fl_value b3, fl_value *result,
                                             fl_error *error);

/*
 * Функция flang «Обратно смешать столбцы».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param kvadrat — «квадрат»: список: число
 * @return значение: список: число
 */
fl_status tls_client_obratno_smeshat_stolbcy(fl_ctx *ctx, fl_value kvadrat,
                                             fl_value *result, fl_error *error);

/*
 * Функция flang «Шаг раунда расшифровки».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param hod — «ход»: «Ход шифра»
 * @param raund — «раунд»: число
 * @return значение: «Ход шифра»
 */
fl_status tls_client_shag_raunda_rasshifrovki(fl_ctx *ctx, fl_value hod,
                                              fl_value raund, fl_value *result,
                                              fl_error *error);

/*
 * Функция flang «Расшифровать блок».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param klyuch — «ключ»: список: число
 * @param blok — «блок»: список: число
 * @return значение: список: число
 */
fl_status tls_client_rasshifrovat_blok(fl_ctx *ctx, fl_value klyuch,
                                       fl_value blok, fl_value *result,
                                       fl_error *error);

/*
 * Функция flang «Шаг CBC вперёд».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param hod — «ход»: «Ход CBC»
 * @param bayt — «байт»: число
 * @return значение: «Ход CBC»
 */
fl_status tls_client_shag_cbc_vperyod(fl_ctx *ctx, fl_value hod, fl_value bayt,
                                      fl_value *result, fl_error *error);

/*
 * Функция flang «Шаг CBC назад».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param hod — «ход»: «Ход CBC»
 * @param bayt — «байт»: число
 * @return значение: «Ход CBC»
 */
fl_status tls_client_shag_cbc_nazad(fl_ctx *ctx, fl_value hod, fl_value bayt,
                                    fl_value *result, fl_error *error);

/*
 * Функция flang «Выход CBC».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param hod — «ход»: «Ход CBC»
 * @return значение: список: число
 */
fl_status tls_client_vyhod_cbc(fl_ctx *ctx, fl_value hod, fl_value *result,
                               fl_error *error);

/*
 * Функция flang «Шифр CBC».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param klyuch — «ключ»: список: число
 * @param vektor — «вектор»: список: число
 * @param tekst — «текст»: список: число
 * @return значение: список: число
 */
fl_status tls_client_shifr_cbc(fl_ctx *ctx, fl_value klyuch, fl_value vektor,
                               fl_value tekst, fl_value *result,
                               fl_error *error);

/*
 * Функция flang «Расшифровка CBC начисто».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param klyuch — «ключ»: список: число
 * @param vektor — «вектор»: список: число
 * @param shifrotekst — «шифротекст»: список: число
 * @return значение: список: число
 */
fl_status tls_client_rasshifrovka_cbc_nachisto(fl_ctx *ctx, fl_value klyuch,
                                               fl_value vektor,
                                               fl_value shifrotekst,
                                               fl_value *result,
                                               fl_error *error);

/*
 * Функция flang «Набивка PKCS7».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param bayty — «байты»: список: число
 * @return значение: список: число
 */
fl_status tls_client_nabivka_pkcs7(fl_ctx *ctx, fl_value bayty,
                                   fl_value *result, fl_error *error);

/*
 * Функция flang «Длина без набивки».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param bayty — «байты»: список: число
 * @return значение: число
 */
fl_status tls_client_dlina_bez_nabivki(fl_ctx *ctx, fl_value bayty,
                                       fl_value *result, fl_error *error);

/*
 * Функция flang «Зашифровать CBC».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param klyuch — «ключ»: список: число
 * @param vektor — «вектор»: список: число
 * @param tekst — «текст»: список: число
 * @return значение: список: число
 */
fl_status tls_client_zashifrovat_cbc(fl_ctx *ctx, fl_value klyuch,
                                     fl_value vektor, fl_value tekst,
                                     fl_value *result, fl_error *error);

/*
 * Функция flang «Тридцать два байта».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param bayty — «байты»: список: число
 * @param smeschenie — «смещение»: число
 * @return значение: список: число
 */
fl_status tls_client_tridcat_dva_bayta(fl_ctx *ctx, fl_value bayty,
                                       fl_value smeschenie, fl_value *result,
                                       fl_error *error);

/*
 * Функция flang «Слово подстановки».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param slovo — «слово»: список: число
 * @return значение: список: число
 */
fl_status tls_client_slovo_podstanovki(fl_ctx *ctx, fl_value slovo,
                                       fl_value *result, fl_error *error);

/*
 * Функция flang «Постоянные раундов 256».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @return значение: список: число
 */
fl_status tls_client_postoyannye_raundov_256(fl_ctx *ctx, fl_value *result,
                                             fl_error *error);

/*
 * Функция flang «Шаг расширения 256».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param rasshirenie — «расширение»: список: число
 * @param postoyannaya — «постоянная»: число
 * @return значение: список: число
 */
fl_status tls_client_shag_rasshireniya_256(fl_ctx *ctx, fl_value rasshirenie,
                                           fl_value postoyannaya,
                                           fl_value *result, fl_error *error);

/*
 * Функция flang «Полшага расширения 256».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param rasshirenie — «расширение»: список: число
 * @param postoyannaya — «постоянная»: число
 * @return значение: список: число
 */
fl_status tls_client_polshaga_rasshireniya_256(fl_ctx *ctx,
                                               fl_value rasshirenie,
                                               fl_value postoyannaya,
                                               fl_value *result,
                                               fl_error *error);

/*
 * Функция flang «Расширение ключа 256».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param klyuch — «ключ»: список: число
 * @return значение: список: число
 */
fl_status tls_client_rasshirenie_klyucha_256(fl_ctx *ctx, fl_value klyuch,
                                             fl_value *result, fl_error *error);

/*
 * Функция flang «Зашифровать блок 256».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param klyuch — «ключ»: список: число
 * @param blok — «блок»: список: число
 * @return значение: список: число
 */
fl_status tls_client_zashifrovat_blok_256(fl_ctx *ctx, fl_value klyuch,
                                          fl_value blok, fl_value *result,
                                          fl_error *error);

/*
 * Функция flang «Расшифровать блок 256».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param klyuch — «ключ»: список: число
 * @param blok — «блок»: список: число
 * @return значение: список: число
 */
fl_status tls_client_rasshifrovat_blok_256(fl_ctx *ctx, fl_value klyuch,
                                           fl_value blok, fl_value *result,
                                           fl_error *error);

/*
 * Функция flang «Шаг гаммы 256».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param hod — «ход»: «Ход гаммы»
 * @param bayt — «байт»: число
 * @return значение: «Ход гаммы»
 */
fl_status tls_client_shag_gammy_256(fl_ctx *ctx, fl_value hod, fl_value bayt,
                                    fl_value *result, fl_error *error);

/*
 * Функция flang «Шифр CTR 256».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param klyuch — «ключ»: список: число
 * @param schyotchik — «счётчик»: список: число
 * @param tekst — «текст»: список: число
 * @return значение: список: число
 */
fl_status tls_client_shifr_ctr_256(fl_ctx *ctx, fl_value klyuch,
                                   fl_value schyotchik, fl_value tekst,
                                   fl_value *result, fl_error *error);

/*
 * Функция flang «Шаг CBC вперёд 256».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param hod — «ход»: «Ход CBC»
 * @param bayt — «байт»: число
 * @return значение: «Ход CBC»
 */
fl_status tls_client_shag_cbc_vperyod_256(fl_ctx *ctx, fl_value hod,
                                          fl_value bayt, fl_value *result,
                                          fl_error *error);

/*
 * Функция flang «Шаг CBC назад 256».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param hod — «ход»: «Ход CBC»
 * @param bayt — «байт»: число
 * @return значение: «Ход CBC»
 */
fl_status tls_client_shag_cbc_nazad_256(fl_ctx *ctx, fl_value hod,
                                        fl_value bayt, fl_value *result,
                                        fl_error *error);

/*
 * Функция flang «Шифр CBC 256».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param klyuch — «ключ»: список: число
 * @param vektor — «вектор»: список: число
 * @param tekst — «текст»: список: число
 * @return значение: список: число
 */
fl_status tls_client_shifr_cbc_256(fl_ctx *ctx, fl_value klyuch,
                                   fl_value vektor, fl_value tekst,
                                   fl_value *result, fl_error *error);

/*
 * Функция flang «Расшифровка CBC 256 начисто».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param klyuch — «ключ»: список: число
 * @param vektor — «вектор»: список: число
 * @param shifrotekst — «шифротекст»: список: число
 * @return значение: список: число
 */
fl_status tls_client_rasshifrovka_cbc_256_nachisto(fl_ctx *ctx, fl_value klyuch,
                                                   fl_value vektor,
                                                   fl_value shifrotekst,
                                                   fl_value *result,
                                                   fl_error *error);

/*
 * Функция flang «Зашифровать CBC 256».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param klyuch — «ключ»: список: число
 * @param vektor — «вектор»: список: число
 * @param tekst — «текст»: список: число
 * @return значение: список: число
 */
fl_status tls_client_zashifrovat_cbc_256(fl_ctx *ctx, fl_value klyuch,
                                         fl_value vektor, fl_value tekst,
                                         fl_value *result, fl_error *error);

/*
 * Функция flang «Ключ хеша 256».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param klyuch — «ключ»: список: число
 * @return значение: список: число
 */
fl_status tls_client_klyuch_hesha_256(fl_ctx *ctx, fl_value klyuch,
                                      fl_value *result, fl_error *error);

/*
 * Функция flang «Шаг гаммы GCM 256».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param hod — «ход»: «Ход гаммы GCM»
 * @param bayt — «байт»: число
 * @return значение: «Ход гаммы GCM»
 */
fl_status tls_client_shag_gammy_gcm_256(fl_ctx *ctx, fl_value hod,
                                        fl_value bayt, fl_value *result,
                                        fl_error *error);

/*
 * Функция flang «Шифр GCTR 256».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param klyuch — «ключ»: список: число
 * @param schyotchik — «счётчик»: список: число
 * @param tekst — «текст»: список: число
 * @return значение: список: число
 */
fl_status tls_client_shifr_gctr_256(fl_ctx *ctx, fl_value klyuch,
                                    fl_value schyotchik, fl_value tekst,
                                    fl_value *result, fl_error *error);

/*
 * Функция flang «Начальный счётчик 256».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param klyuch — «ключ»: список: число
 * @param vektor — «вектор»: список: число
 * @return значение: список: число
 */
fl_status tls_client_nachalnyy_schyotchik_256(fl_ctx *ctx, fl_value klyuch,
                                              fl_value vektor, fl_value *result,
                                              fl_error *error);

/*
 * Функция flang «Тег GCM 256».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param klyuch — «ключ»: список: число
 * @param vektor — «вектор»: список: число
 * @param dop — «доп»: список: число
 * @param shifrotekst — «шифротекст»: список: число
 * @return значение: список: число
 */
fl_status tls_client_teg_gcm_256(fl_ctx *ctx, fl_value klyuch, fl_value vektor,
                                 fl_value dop, fl_value shifrotekst,
                                 fl_value *result, fl_error *error);

/*
 * Функция flang «Зашифровать GCM 256».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param klyuch — «ключ»: список: число
 * @param vektor — «вектор»: список: число
 * @param dop — «доп»: список: число
 * @param tekst — «текст»: список: число
 * @return значение: «Печать GCM»
 */
fl_status tls_client_zashifrovat_gcm_256(fl_ctx *ctx, fl_value klyuch,
                                         fl_value vektor, fl_value dop,
                                         fl_value tekst, fl_value *result,
                                         fl_error *error);

/*
 * Функция flang «Расшифровать GCM 256».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param klyuch — «ключ»: список: число
 * @param vektor — «вектор»: список: число
 * @param dop — «доп»: список: число
 * @param shifrotekst — «шифротекст»: список: число
 * @param teg — «тег»: список: число
 * @return значение: «Исход GCM»
 */
fl_status tls_client_rasshifrovat_gcm_256(fl_ctx *ctx, fl_value klyuch,
                                          fl_value vektor, fl_value dop,
                                          fl_value shifrotekst, fl_value teg,
                                          fl_value *result, fl_error *error);

/*
 * Функция flang «Байт двумя знаками».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param bayt — «байт»: число
 * @return значение: строка
 */
fl_status tls_client_bayt_dvumya_znakami(fl_ctx *ctx, fl_value bayt,
                                         fl_value *result, fl_error *error);

/*
 * Функция flang «Байты шестнадцатеричной строкой».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param bayty — «байты»: список: число
 * @return значение: строка
 */
fl_status tls_client_bayty_shestnadcaterichnoy_strokoy(fl_ctx *ctx,
                                                       fl_value bayty,
                                                       fl_value *result,
                                                       fl_error *error);

/*
 * Функция flang «Знак шестнадцати».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param n — «н»: число
 * @return значение: строка
 */
fl_status tls_client_znak_shestnadcati(fl_ctx *ctx, fl_value n,
                                       fl_value *result, fl_error *error);

/*
 * Функция flang «Октет заглавными».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param oktet — «октет»: число
 * @return значение: строка
 */
fl_status tls_client_oktet_zaglavnymi(fl_ctx *ctx, fl_value oktet,
                                      fl_value *result, fl_error *error);

/*
 * Функция flang «Шаг октетов заглавными».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param nabrano — «набрано»: строка
 * @param oktet — «октет»: число
 * @return значение: строка
 */
fl_status tls_client_shag_oktetov_zaglavnymi(fl_ctx *ctx, fl_value nabrano,
                                             fl_value oktet, fl_value *result,
                                             fl_error *error);

/*
 * Функция flang «Октеты заглавными».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param oktety — «октеты»: список: число
 * @return значение: строка
 */
fl_status tls_client_oktety_zaglavnymi(fl_ctx *ctx, fl_value oktety,
                                       fl_value *result, fl_error *error);

/*
 * Функция flang «Шаг слития».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param nabrano — «набрано»: список: число
 * @param oktet — «октет»: число
 * @return значение: список: число
 */
fl_status tls_client_shag_slitiya(fl_ctx *ctx, fl_value nabrano, fl_value oktet,
                                  fl_value *result, fl_error *error);

/*
 * Функция flang «Слить октеты».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param pervyy — «первый»: список: число
 * @param vtoroy — «второй»: список: число
 * @return значение: список: число
 */
fl_status tls_client_slit_oktety(fl_ctx *ctx, fl_value pervyy, fl_value vtoroy,
                                 fl_value *result, fl_error *error);

/*
 * Функция flang «Тип записи».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param oktety — «октеты»: список: число
 * @return значение: число
 */
fl_status tls_client_tip_zapisi(fl_ctx *ctx, fl_value oktety, fl_value *result,
                                fl_error *error);

/*
 * Функция flang «Имя типа записи».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param metka — «метка»: число
 * @return значение: строка
 */
fl_status tls_client_imya_tipa_zapisi(fl_ctx *ctx, fl_value metka,
                                      fl_value *result, fl_error *error);

/*
 * Функция flang «Версия записи».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param oktety — «октеты»: список: число
 * @return значение: число
 */
fl_status tls_client_versiya_zapisi(fl_ctx *ctx, fl_value oktety,
                                    fl_value *result, fl_error *error);

/*
 * Функция flang «Версия словом».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param versiya — «версия»: число
 * @return значение: строка
 */
fl_status tls_client_versiya_slovom(fl_ctx *ctx, fl_value versiya,
                                    fl_value *result, fl_error *error);

/*
 * Функция flang «Длина записи».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param oktety — «октеты»: список: число
 * @return значение: число
 */
fl_status tls_client_dlina_zapisi(fl_ctx *ctx, fl_value oktety,
                                  fl_value *result, fl_error *error);

/*
 * Функция flang «Тело записи».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param oktety — «октеты»: список: число
 * @return значение: список: число
 */
fl_status tls_client_telo_zapisi(fl_ctx *ctx, fl_value oktety, fl_value *result,
                                 fl_error *error);

/*
 * Функция flang «Запись целая».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param oktety — «октеты»: список: число
 * @return значение
 */
fl_status tls_client_zapis_celaya(fl_ctx *ctx, fl_value oktety,
                                  fl_value *result, fl_error *error);

/*
 * Функция flang «Заголовок записи».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param metka — «метка»: число
 * @param versiya — «версия»: число
 * @param skolko — «сколько»: число
 * @return значение: список: число
 */
fl_status tls_client_zagolovok_zapisi(fl_ctx *ctx, fl_value metka,
                                      fl_value versiya, fl_value skolko,
                                      fl_value *result, fl_error *error);

/*
 * Функция flang «Собрать запись».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param metka — «метка»: число
 * @param versiya — «версия»: число
 * @param telo — «тело»: список: число
 * @return значение: список: число
 */
fl_status tls_client_sobrat_zapis(fl_ctx *ctx, fl_value metka, fl_value versiya,
                                  fl_value telo, fl_value *result,
                                  fl_error *error);

/*
 * Функция flang «Тип рукопожатия».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param telo — «тело»: список: число
 * @return значение: число
 */
fl_status tls_client_tip_rukopozhatiya(fl_ctx *ctx, fl_value telo,
                                       fl_value *result, fl_error *error);

/*
 * Функция flang «Имя типа рукопожатия».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param metka — «метка»: число
 * @return значение: строка
 */
fl_status tls_client_imya_tipa_rukopozhatiya(fl_ctx *ctx, fl_value metka,
                                             fl_value *result, fl_error *error);

/*
 * Функция flang «Длина рукопожатия».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param telo — «тело»: список: число
 * @return значение: число
 */
fl_status tls_client_dlina_rukopozhatiya(fl_ctx *ctx, fl_value telo,
                                         fl_value *result, fl_error *error);

/*
 * Функция flang «Версия привета».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param telo — «тело»: список: число
 * @return значение: число
 */
fl_status tls_client_versiya_priveta(fl_ctx *ctx, fl_value telo,
                                     fl_value *result, fl_error *error);

/*
 * Функция flang «Метка времени привета».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param telo — «тело»: список: число
 * @return значение: число
 */
fl_status tls_client_metka_vremeni_priveta(fl_ctx *ctx, fl_value telo,
                                           fl_value *result, fl_error *error);

/*
 * Функция flang «Случайное число».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param telo — «тело»: список: число
 * @return значение: список: число
 */
fl_status tls_client_sluchaynoe_chislo(fl_ctx *ctx, fl_value telo,
                                       fl_value *result, fl_error *error);

/*
 * Функция flang «Случайные октеты».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param telo — «тело»: список: число
 * @return значение: список: число
 */
fl_status tls_client_sluchaynye_oktety(fl_ctx *ctx, fl_value telo,
                                       fl_value *result, fl_error *error);

/*
 * Функция flang «Длина сессии».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param telo — «тело»: список: число
 * @return значение: число
 */
fl_status tls_client_dlina_sessii(fl_ctx *ctx, fl_value telo, fl_value *result,
                                  fl_error *error);

/*
 * Функция flang «Идентификатор сессии».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param telo — «тело»: список: число
 * @return значение: список: число
 */
fl_status tls_client_identifikator_sessii(fl_ctx *ctx, fl_value telo,
                                          fl_value *result, fl_error *error);

/*
 * Функция flang «Место после сессии».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param telo — «тело»: список: число
 * @return значение: число
 */
fl_status tls_client_mesto_posle_sessii(fl_ctx *ctx, fl_value telo,
                                        fl_value *result, fl_error *error);

/*
 * Функция flang «Длина наборов».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param telo — «тело»: список: число
 * @return значение: число
 */
fl_status tls_client_dlina_naborov(fl_ctx *ctx, fl_value telo, fl_value *result,
                                   fl_error *error);

/*
 * Функция flang «Наборы шифров».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param telo — «тело»: список: число
 * @return значение: список: число
 */
fl_status tls_client_nabory_shifrov(fl_ctx *ctx, fl_value telo,
                                    fl_value *result, fl_error *error);

/*
 * Функция flang «Место сжатия».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param telo — «тело»: список: число
 * @return значение: число
 */
fl_status tls_client_mesto_szhatiya(fl_ctx *ctx, fl_value telo,
                                    fl_value *result, fl_error *error);

/*
 * Функция flang «Длина сжатия».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param telo — «тело»: список: число
 * @return значение: число
 */
fl_status tls_client_dlina_szhatiya(fl_ctx *ctx, fl_value telo,
                                    fl_value *result, fl_error *error);

/*
 * Функция flang «Место расширений клиента».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param telo — «тело»: список: число
 * @return значение: число
 */
fl_status tls_client_mesto_rasshireniy_klienta(fl_ctx *ctx, fl_value telo,
                                               fl_value *result,
                                               fl_error *error);

/*
 * Функция flang «Длина расширений клиента».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param telo — «тело»: список: число
 * @return значение: число
 */
fl_status tls_client_dlina_rasshireniy_klienta(fl_ctx *ctx, fl_value telo,
                                               fl_value *result,
                                               fl_error *error);

/*
 * Функция flang «Расширения клиента».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param telo — «тело»: список: число
 * @return значение: список: число
 */
fl_status tls_client_rasshireniya_klienta(fl_ctx *ctx, fl_value telo,
                                          fl_value *result, fl_error *error);

/*
 * Функция flang «Набор сервера».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param telo — «тело»: список: число
 * @return значение: число
 */
fl_status tls_client_nabor_servera(fl_ctx *ctx, fl_value telo, fl_value *result,
                                   fl_error *error);

/*
 * Функция flang «Сжатие сервера».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param telo — «тело»: список: число
 * @return значение: число
 */
fl_status tls_client_szhatie_servera(fl_ctx *ctx, fl_value telo,
                                     fl_value *result, fl_error *error);

/*
 * Функция flang «Место расширений сервера».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param telo — «тело»: список: число
 * @return значение: число
 */
fl_status tls_client_mesto_rasshireniy_servera(fl_ctx *ctx, fl_value telo,
                                               fl_value *result,
                                               fl_error *error);

/*
 * Функция flang «Длина расширений сервера».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param telo — «тело»: список: число
 * @return значение: число
 */
fl_status tls_client_dlina_rasshireniy_servera(fl_ctx *ctx, fl_value telo,
                                               fl_value *result,
                                               fl_error *error);

/*
 * Функция flang «Расширения сервера».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param telo — «тело»: список: число
 * @return значение: список: число
 */
fl_status tls_client_rasshireniya_servera(fl_ctx *ctx, fl_value telo,
                                          fl_value *result, fl_error *error);

/*
 * Функция flang «Шаг пар».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param hod — «ход»: «Ход пар»
 * @param oktet — «октет»: число
 * @return значение: «Ход пар»
 */
fl_status tls_client_shag_par(fl_ctx *ctx, fl_value hod, fl_value oktet,
                              fl_value *result, fl_error *error);

/*
 * Функция flang «Ход по парам».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param oktety — «октеты»: список: число
 * @return значение: «Ход пар»
 */
fl_status tls_client_hod_po_param(fl_ctx *ctx, fl_value oktety,
                                  fl_value *result, fl_error *error);

/*
 * Функция flang «Пары октетов».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param oktety — «октеты»: список: число
 * @return значение: список: число
 */
fl_status tls_client_pary_oktetov(fl_ctx *ctx, fl_value oktety,
                                  fl_value *result, fl_error *error);

/*
 * Функция flang «Набор словом».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param kod — «код»: число
 * @return значение: строка
 */
fl_status tls_client_nabor_slovom(fl_ctx *ctx, fl_value kod, fl_value *result,
                                  fl_error *error);

/*
 * Функция flang «Группа словом».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param kod — «код»: число
 * @return значение: строка
 */
fl_status tls_client_gruppa_slovom(fl_ctx *ctx, fl_value kod, fl_value *result,
                                   fl_error *error);

/*
 * Функция flang «Имя расширения».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param metka — «метка»: число
 * @return значение: строка
 */
fl_status tls_client_imya_rasshireniya(fl_ctx *ctx, fl_value metka,
                                       fl_value *result, fl_error *error);

/*
 * Функция flang «Печать наборов».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param kody — «коды»: список: число
 * @return значение: строка
 */
fl_status tls_client_pechat_naborov(fl_ctx *ctx, fl_value kody,
                                    fl_value *result, fl_error *error);

/*
 * Функция flang «Печать версий».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param kody — «коды»: список: число
 * @return значение: строка
 */
fl_status tls_client_pechat_versiy(fl_ctx *ctx, fl_value kody, fl_value *result,
                                   fl_error *error);

/*
 * Функция flang «Тип расширения в месте».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param rasshireniya — «расширения»: список: число
 * @param mesto — «место»: число
 * @return значение: число
 */
fl_status tls_client_tip_rasshireniya_v_meste(fl_ctx *ctx,
                                              fl_value rasshireniya,
                                              fl_value mesto, fl_value *result,
                                              fl_error *error);

/*
 * Функция flang «Длина расширения в месте».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param rasshireniya — «расширения»: список: число
 * @param mesto — «место»: число
 * @return значение: число
 */
fl_status tls_client_dlina_rasshireniya_v_meste(fl_ctx *ctx,
                                                fl_value rasshireniya,
                                                fl_value mesto,
                                                fl_value *result,
                                                fl_error *error);

/*
 * Функция flang «Шаг расширений».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param hod — «ход»: «Ход расширений»
 * @param rasshireniya — «расширения»: список: число
 * @return значение: «Ход расширений»
 */
fl_status tls_client_shag_rasshireniy(fl_ctx *ctx, fl_value hod,
                                      fl_value rasshireniya, fl_value *result,
                                      fl_error *error);

/*
 * Функция flang «Обход расширений».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param rasshireniya — «расширения»: список: число
 * @return значение: «Ход расширений»
 */
fl_status tls_client_obhod_rasshireniy(fl_ctx *ctx, fl_value rasshireniya,
                                       fl_value *result, fl_error *error);

/*
 * Функция flang «Печать расширений».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param rasshireniya — «расширения»: список: число
 * @return значение: строка
 */
fl_status tls_client_pechat_rasshireniy(fl_ctx *ctx, fl_value rasshireniya,
                                        fl_value *result, fl_error *error);

/*
 * Функция flang «Сколько расширений».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param rasshireniya — «расширения»: список: число
 * @return значение: число
 */
fl_status tls_client_skolko_rasshireniy(fl_ctx *ctx, fl_value rasshireniya,
                                        fl_value *result, fl_error *error);

/*
 * Функция flang «Шаг поиска».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param hod — «ход»: «Ход поиска»
 * @param rasshireniya — «расширения»: список: число
 * @param iskomyy — «искомый»: число
 * @return значение: «Ход поиска»
 */
fl_status tls_client_shag_poiska(fl_ctx *ctx, fl_value hod,
                                 fl_value rasshireniya, fl_value iskomyy,
                                 fl_value *result, fl_error *error);

/*
 * Функция flang «Поиск расширения».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param rasshireniya — «расширения»: список: число
 * @param metka — «метка»: число
 * @return значение: «Ход поиска»
 */
fl_status tls_client_poisk_rasshireniya(fl_ctx *ctx, fl_value rasshireniya,
                                        fl_value metka, fl_value *result,
                                        fl_error *error);

/*
 * Функция flang «Есть расширение».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param rasshireniya — «расширения»: список: число
 * @param metka — «метка»: число
 * @return значение
 */
fl_status tls_client_est_rasshirenie(fl_ctx *ctx, fl_value rasshireniya,
                                     fl_value metka, fl_value *result,
                                     fl_error *error);

/*
 * Функция flang «Содержимое расширения».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param rasshireniya — «расширения»: список: число
 * @param metka — «метка»: число
 * @return значение: список: число
 */
fl_status tls_client_soderzhimoe_rasshireniya(fl_ctx *ctx,
                                              fl_value rasshireniya,
                                              fl_value metka, fl_value *result,
                                              fl_error *error);

/*
 * Функция flang «Версии клиента».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param rasshireniya — «расширения»: список: число
 * @return значение: список: число
 */
fl_status tls_client_versii_klienta(fl_ctx *ctx, fl_value rasshireniya,
                                    fl_value *result, fl_error *error);

/*
 * Функция flang «Версия сервера».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param rasshireniya — «расширения»: список: число
 * @return значение: число
 */
fl_status tls_client_versiya_servera(fl_ctx *ctx, fl_value rasshireniya,
                                     fl_value *result, fl_error *error);

/*
 * Функция flang «Группа клиента».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param rasshireniya — «расширения»: список: число
 * @return значение: число
 */
fl_status tls_client_gruppa_klienta(fl_ctx *ctx, fl_value rasshireniya,
                                    fl_value *result, fl_error *error);

/*
 * Функция flang «Ключ клиента».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param rasshireniya — «расширения»: список: число
 * @return значение: список: число
 */
fl_status tls_client_klyuch_klienta(fl_ctx *ctx, fl_value rasshireniya,
                                    fl_value *result, fl_error *error);

/*
 * Функция flang «Группа сервера».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param rasshireniya — «расширения»: список: число
 * @return значение: число
 */
fl_status tls_client_gruppa_servera(fl_ctx *ctx, fl_value rasshireniya,
                                    fl_value *result, fl_error *error);

/*
 * Функция flang «Ключ сервера».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param rasshireniya — «расширения»: список: число
 * @return значение: список: число
 */
fl_status tls_client_klyuch_servera(fl_ctx *ctx, fl_value rasshireniya,
                                    fl_value *result, fl_error *error);

/*
 * Функция flang «Два октета».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param n — «н»: число
 * @return значение: список: число
 */
fl_status tls_client_dva_okteta(fl_ctx *ctx, fl_value n, fl_value *result,
                                fl_error *error);

/*
 * Функция flang «Приставка меток».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @return значение: список: число
 */
fl_status tls_client_pristavka_metok(fl_ctx *ctx, fl_value *result,
                                     fl_error *error);

/*
 * Функция flang «Справка вывода».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param baytov — «байтов»: число
 * @param metka — «метка»: список: число
 * @param privyazka — «привязка»: список: число
 * @return значение: список: число
 */
fl_status tls_client_spravka_vyvoda(fl_ctx *ctx, fl_value baytov,
                                    fl_value metka, fl_value privyazka,
                                    fl_value *result, fl_error *error);

/*
 * Функция flang «Растянуть».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param klyuch — «ключ»: список: число
 * @param spravka — «справка»: список: число
 * @param baytov — «байтов»: число
 * @return значение: список: число
 */
fl_status tls_client_rastyanut(fl_ctx *ctx, fl_value klyuch, fl_value spravka,
                               fl_value baytov, fl_value *result,
                               fl_error *error);

/*
 * Функция flang «Вывести с меткой».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param sekret — «секрет»: список: число
 * @param metka — «метка»: список: число
 * @param privyazka — «привязка»: список: число
 * @param baytov — «байтов»: число
 * @return значение: список: число
 */
fl_status tls_client_vyvesti_s_metkoy(fl_ctx *ctx, fl_value sekret,
                                      fl_value metka, fl_value privyazka,
                                      fl_value baytov, fl_value *result,
                                      fl_error *error);

/*
 * Функция flang «Вывести секрет».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param sekret — «секрет»: список: число
 * @param metka — «метка»: список: число
 * @param soobscheniya — «сообщения»: список: число
 * @return значение: список: число
 */
fl_status tls_client_vyvesti_sekret(fl_ctx *ctx, fl_value sekret,
                                    fl_value metka, fl_value soobscheniya,
                                    fl_value *result, fl_error *error);

/*
 * Функция flang «Метка derived».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @return значение: список: число
 */
fl_status tls_client_metka_derived(fl_ctx *ctx, fl_value *result,
                                   fl_error *error);

/*
 * Функция flang «Метка c hs traffic».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @return значение: список: число
 */
fl_status tls_client_metka_c_hs_traffic(fl_ctx *ctx, fl_value *result,
                                        fl_error *error);

/*
 * Функция flang «Метка s hs traffic».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @return значение: список: число
 */
fl_status tls_client_metka_s_hs_traffic(fl_ctx *ctx, fl_value *result,
                                        fl_error *error);

/*
 * Функция flang «Метка c ap traffic».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @return значение: список: число
 */
fl_status tls_client_metka_c_ap_traffic(fl_ctx *ctx, fl_value *result,
                                        fl_error *error);

/*
 * Функция flang «Метка s ap traffic».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @return значение: список: число
 */
fl_status tls_client_metka_s_ap_traffic(fl_ctx *ctx, fl_value *result,
                                        fl_error *error);

/*
 * Функция flang «Метка key».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @return значение: список: число
 */
fl_status tls_client_metka_key(fl_ctx *ctx, fl_value *result, fl_error *error);

/*
 * Функция flang «Метка iv».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @return значение: список: число
 */
fl_status tls_client_metka_iv(fl_ctx *ctx, fl_value *result, fl_error *error);

/*
 * Функция flang «Метка finished».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @return значение: список: число
 */
fl_status tls_client_metka_finished(fl_ctx *ctx, fl_value *result,
                                    fl_error *error);

/*
 * Функция flang «Ранний секрет».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @return значение: список: число
 */
fl_status tls_client_ranniy_sekret(fl_ctx *ctx, fl_value *result,
                                   fl_error *error);

/*
 * Функция flang «Производный ранний».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @return значение: список: число
 */
fl_status tls_client_proizvodnyy_ranniy(fl_ctx *ctx, fl_value *result,
                                        fl_error *error);

/*
 * Функция flang «Секрет рукопожатия».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param obschiy — «общий»: список: число
 * @return значение: список: число
 */
fl_status tls_client_sekret_rukopozhatiya(fl_ctx *ctx, fl_value obschiy,
                                          fl_value *result, fl_error *error);

/*
 * Функция flang «Секрет клиента рукопожатия».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param rukopozhatie — «рукопожатие»: список: число
 * @param stenogramma — «стенограмма»: список: число
 * @return значение: список: число
 */
fl_status tls_client_sekret_klienta_rukopozhatiya(fl_ctx *ctx,
                                                  fl_value rukopozhatie,
                                                  fl_value stenogramma,
                                                  fl_value *result,
                                                  fl_error *error);

/*
 * Функция flang «Секрет сервера рукопожатия».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param rukopozhatie — «рукопожатие»: список: число
 * @param stenogramma — «стенограмма»: список: число
 * @return значение: список: число
 */
fl_status tls_client_sekret_servera_rukopozhatiya(fl_ctx *ctx,
                                                  fl_value rukopozhatie,
                                                  fl_value stenogramma,
                                                  fl_value *result,
                                                  fl_error *error);

/*
 * Функция flang «Главный секрет».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param rukopozhatie — «рукопожатие»: список: число
 * @return значение: список: число
 */
fl_status tls_client_glavnyy_sekret(fl_ctx *ctx, fl_value rukopozhatie,
                                    fl_value *result, fl_error *error);

/*
 * Функция flang «Секрет клиента данных».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param glavnyy — «главный»: список: число
 * @param stenogramma — «стенограмма»: список: число
 * @return значение: список: число
 */
fl_status tls_client_sekret_klienta_dannyh(fl_ctx *ctx, fl_value glavnyy,
                                           fl_value stenogramma,
                                           fl_value *result, fl_error *error);

/*
 * Функция flang «Секрет сервера данных».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param glavnyy — «главный»: список: число
 * @param stenogramma — «стенограмма»: список: число
 * @return значение: список: число
 */
fl_status tls_client_sekret_servera_dannyh(fl_ctx *ctx, fl_value glavnyy,
                                           fl_value stenogramma,
                                           fl_value *result, fl_error *error);

/*
 * Функция flang «Ключ записи».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param sekret — «секрет»: список: число
 * @return значение: список: число
 */
fl_status tls_client_klyuch_zapisi(fl_ctx *ctx, fl_value sekret,
                                   fl_value *result, fl_error *error);

/*
 * Функция flang «Вектор записи».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param sekret — «секрет»: список: число
 * @return значение: список: число
 */
fl_status tls_client_vektor_zapisi(fl_ctx *ctx, fl_value sekret,
                                   fl_value *result, fl_error *error);

/*
 * Функция flang «Вектор с номером».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param vektor — «вектор»: список: число
 * @param nomer — «номер»: число
 * @return значение: список: число
 */
fl_status tls_client_vektor_s_nomerom(fl_ctx *ctx, fl_value vektor,
                                      fl_value nomer, fl_value *result,
                                      fl_error *error);

/*
 * Функция flang «Шифротекст записи».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param lenta — «лента»: список: число
 * @return значение: список: число
 */
fl_status tls_client_shifrotekst_zapisi(fl_ctx *ctx, fl_value lenta,
                                        fl_value *result, fl_error *error);

/*
 * Функция flang «Тег записи».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param lenta — «лента»: список: число
 * @return значение: список: число
 */
fl_status tls_client_teg_zapisi(fl_ctx *ctx, fl_value lenta, fl_value *result,
                                fl_error *error);

/*
 * Функция flang «Расшифровать запись».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param klyuch — «ключ»: список: число
 * @param vektor — «вектор»: список: число
 * @param nomer — «номер»: число
 * @param lenta — «лента»: список: число
 * @return значение: «Исход GCM»
 */
fl_status tls_client_rasshifrovat_zapis(fl_ctx *ctx, fl_value klyuch,
                                        fl_value vektor, fl_value nomer,
                                        fl_value lenta, fl_value *result,
                                        fl_error *error);

/*
 * Функция flang «Открытое записи».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param klyuch — «ключ»: список: число
 * @param vektor — «вектор»: список: число
 * @param nomer — «номер»: число
 * @param lenta — «лента»: список: число
 * @return значение: список: число
 */
fl_status tls_client_otkrytoe_zapisi(fl_ctx *ctx, fl_value klyuch,
                                     fl_value vektor, fl_value nomer,
                                     fl_value lenta, fl_value *result,
                                     fl_error *error);

/*
 * Функция flang «Секрет сервера из журнала».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @return значение: список: число
 */
fl_status tls_client_sekret_servera_iz_zhurnala(fl_ctx *ctx, fl_value *result,
                                                fl_error *error);

/*
 * Функция flang «Первая закрытая запись сервера».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @return значение: список: число
 */
fl_status tls_client_pervaya_zakrytaya_zapis_servera(fl_ctx *ctx,
                                                     fl_value *result,
                                                     fl_error *error);

/*
 * Функция flang «Ключ сервера рукопожатия».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @return значение: строка
 */
fl_status tls_client_klyuch_servera_rukopozhatiya(fl_ctx *ctx, fl_value *result,
                                                  fl_error *error);

/*
 * Функция flang «Вектор сервера рукопожатия».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @return значение: строка
 */
fl_status tls_client_vektor_servera_rukopozhatiya(fl_ctx *ctx, fl_value *result,
                                                  fl_error *error);

/*
 * Функция flang «Открытое первой записи».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @return значение: строка
 */
fl_status tls_client_otkrytoe_pervoy_zapisi(fl_ctx *ctx, fl_value *result,
                                            fl_error *error);

/*
 * Функция flang «Три октета».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param n — «н»: число
 * @return значение: список: число
 */
fl_status tls_client_tri_okteta(fl_ctx *ctx, fl_value n, fl_value *result,
                                fl_error *error);

/*
 * Функция flang «Расширение версий клиента».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @return значение: список: число
 */
fl_status tls_client_rasshirenie_versiy_klienta(fl_ctx *ctx, fl_value *result,
                                                fl_error *error);

/*
 * Функция flang «Расширение групп клиента».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @return значение: список: число
 */
fl_status tls_client_rasshirenie_grupp_klienta(fl_ctx *ctx, fl_value *result,
                                               fl_error *error);

/*
 * Функция flang «Расширение подписей клиента».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @return значение: список: число
 */
fl_status tls_client_rasshirenie_podpisey_klienta(fl_ctx *ctx, fl_value *result,
                                                  fl_error *error);

/*
 * Функция flang «Расширение ключа клиента».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param otkrytyy — «открытый»: список: число
 * @return значение: список: число
 */
fl_status tls_client_rasshirenie_klyucha_klienta(fl_ctx *ctx, fl_value otkrytyy,
                                                 fl_value *result,
                                                 fl_error *error);

/*
 * Функция flang «Расширения своего привета».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param otkrytyy — «открытый»: список: число
 * @return значение: список: число
 */
fl_status tls_client_rasshireniya_svoego_priveta(fl_ctx *ctx, fl_value otkrytyy,
                                                 fl_value *result,
                                                 fl_error *error);

/*
 * Функция flang «Тело своего привета».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param sluchaynoe — «случайное»: список: число
 * @param sessiya — «сессия»: список: число
 * @param otkrytyy — «открытый»: список: число
 * @return значение: список: число
 */
fl_status tls_client_telo_svoego_priveta(fl_ctx *ctx, fl_value sluchaynoe,
                                         fl_value sessiya, fl_value otkrytyy,
                                         fl_value *result, fl_error *error);

/*
 * Функция flang «Свой привет».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param sluchaynoe — «случайное»: список: число
 * @param sessiya — «сессия»: список: число
 * @param otkrytyy — «открытый»: список: число
 * @return значение: список: число
 */
fl_status tls_client_svoy_privet(fl_ctx *ctx, fl_value sluchaynoe,
                                 fl_value sessiya, fl_value otkrytyy,
                                 fl_value *result, fl_error *error);

/*
 * Функция flang «Начало хвоста».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @return значение: «Ход хвоста»
 */
fl_status tls_client_nachalo_hvosta(fl_ctx *ctx, fl_value *result,
                                    fl_error *error);

/*
 * Функция flang «Шаг хвоста».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param hod — «ход»: «Ход хвоста»
 * @param oktet — «октет»: число
 * @return значение: «Ход хвоста»
 */
fl_status tls_client_shag_hvosta(fl_ctx *ctx, fl_value hod, fl_value oktet,
                                 fl_value *result, fl_error *error);

/*
 * Функция flang «Ход хвоста октетов».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param oktety — «октеты»: список: число
 * @return значение: «Ход хвоста»
 */
fl_status tls_client_hod_hvosta_oktetov(fl_ctx *ctx, fl_value oktety,
                                        fl_value *result, fl_error *error);

/*
 * Функция flang «Последний ненулевой».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param oktety — «октеты»: список: число
 * @return значение: число
 */
fl_status tls_client_posledniy_nenulevoy(fl_ctx *ctx, fl_value oktety,
                                         fl_value *result, fl_error *error);

/*
 * Функция flang «Внутренний тип».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param kusok — «кусок»: список: число
 * @return значение: число
 */
fl_status tls_client_vnutrenniy_tip(fl_ctx *ctx, fl_value kusok,
                                    fl_value *result, fl_error *error);

/*
 * Функция flang «Открытое без набивки».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param kusok — «кусок»: список: число
 * @return значение: список: число
 */
fl_status tls_client_otkrytoe_bez_nabivki(fl_ctx *ctx, fl_value kusok,
                                          fl_value *result, fl_error *error);

/*
 * Функция flang «Внутренняя запись».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param soderzhimoe — «содержимое»: список: число
 * @param metka — «метка»: число
 * @return значение: список: число
 */
fl_status tls_client_vnutrennyaya_zapis(fl_ctx *ctx, fl_value soderzhimoe,
                                        fl_value metka, fl_value *result,
                                        fl_error *error);

/*
 * Функция flang «Добавочные записи».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param vnutrennih — «внутренних»: число
 * @return значение: список: число
 */
fl_status tls_client_dobavochnye_zapisi(fl_ctx *ctx, fl_value vnutrennih,
                                        fl_value *result, fl_error *error);

/*
 * Функция flang «Закрытая запись».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param klyuch — «ключ»: список: число
 * @param vektor — «вектор»: список: число
 * @param nomer — «номер»: число
 * @param soderzhimoe — «содержимое»: список: число
 * @param metka — «метка»: число
 * @return значение: список: число
 */
fl_status tls_client_zakrytaya_zapis(fl_ctx *ctx, fl_value klyuch,
                                     fl_value vektor, fl_value nomer,
                                     fl_value soderzhimoe, fl_value metka,
                                     fl_value *result, fl_error *error);

/*
 * Функция flang «Ключ Finished».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param sekret — «секрет»: список: число
 * @return значение: список: число
 */
fl_status tls_client_klyuch_finished(fl_ctx *ctx, fl_value sekret,
                                     fl_value *result, fl_error *error);

/*
 * Функция flang «Свод Finished по своду».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param sekret — «секрет»: список: число
 * @param svod — «свод»: список: число
 * @return значение: список: число
 */
fl_status tls_client_svod_finished_po_svodu(fl_ctx *ctx, fl_value sekret,
                                            fl_value svod, fl_value *result,
                                            fl_error *error);

/*
 * Функция flang «Свод Finished».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param sekret — «секрет»: список: число
 * @param stenogramma — «стенограмма»: список: число
 * @return значение: список: число
 */
fl_status tls_client_svod_finished(fl_ctx *ctx, fl_value sekret,
                                   fl_value stenogramma, fl_value *result,
                                   fl_error *error);

/*
 * Функция flang «Начало сверки».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @return значение: «Ход сверки»
 */
fl_status tls_client_nachalo_sverki(fl_ctx *ctx, fl_value *result,
                                    fl_error *error);

/*
 * Функция flang «Шаг сверки».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param hod — «ход»: «Ход сверки»
 * @param oktet — «октет»: число
 * @param drugie — «другие»: список: число
 * @return значение: «Ход сверки»
 */
fl_status tls_client_shag_sverki(fl_ctx *ctx, fl_value hod, fl_value oktet,
                                 fl_value drugie, fl_value *result,
                                 fl_error *error);

/*
 * Функция flang «Ход сверки октетов».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param pervye — «первые»: список: число
 * @param vtorye — «вторые»: список: число
 * @return значение: «Ход сверки»
 */
fl_status tls_client_hod_sverki_oktetov(fl_ctx *ctx, fl_value pervye,
                                        fl_value vtorye, fl_value *result,
                                        fl_error *error);

/*
 * Функция flang «Октеты сошлись».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param pervye — «первые»: список: число
 * @param vtorye — «вторые»: список: число
 * @return значение
 */
fl_status tls_client_oktety_soshlis(fl_ctx *ctx, fl_value pervye,
                                    fl_value vtorye, fl_value *result,
                                    fl_error *error);

/*
 * Функция flang «Finished сошёлся».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param sekret — «секрет»: список: число
 * @param svod — «свод»: список: число
 * @param predyavleno — «предъявлено»: список: число
 * @return значение
 */
fl_status tls_client_finished_soshyolsya(fl_ctx *ctx, fl_value sekret,
                                         fl_value svod, fl_value predyavleno,
                                         fl_value *result, fl_error *error);

/*
 * Функция flang «Привязка подписи сервера».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @return значение: список: число
 */
fl_status tls_client_privyazka_podpisi_servera(fl_ctx *ctx, fl_value *result,
                                               fl_error *error);

/*
 * Функция flang «Подписываемое сервером по своду».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param svod — «свод»: список: число
 * @return значение: список: число
 */
fl_status tls_client_podpisyvaemoe_serverom_po_svodu(fl_ctx *ctx, fl_value svod,
                                                     fl_value *result,
                                                     fl_error *error);

/*
 * Функция flang «Подписываемое сервером».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param stenogramma — «стенограмма»: список: число
 * @return значение: список: число
 */
fl_status tls_client_podpisyvaemoe_serverom(fl_ctx *ctx, fl_value stenogramma,
                                            fl_value *result, fl_error *error);

/*
 * Функция flang «Два октета с места».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param lenta — «лента»: список: число
 * @param mesto — «место»: число
 * @return значение: число
 */
fl_status tls_client_dva_okteta_s_mesta(fl_ctx *ctx, fl_value lenta,
                                        fl_value mesto, fl_value *result,
                                        fl_error *error);

/*
 * Функция flang «Три октета с места».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param lenta — «лента»: список: число
 * @param mesto — «место»: число
 * @return значение: число
 */
fl_status tls_client_tri_okteta_s_mesta(fl_ctx *ctx, fl_value lenta,
                                        fl_value mesto, fl_value *result,
                                        fl_error *error);

/*
 * Функция flang «Начало обхода записей».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @return значение: «Обход записей»
 */
fl_status tls_client_nachalo_obhoda_zapisey(fl_ctx *ctx, fl_value *result,
                                            fl_error *error);

/*
 * Функция flang «Длина записи с места».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param lenta — «лента»: список: число
 * @param mesto — «место»: число
 * @return значение: число
 */
fl_status tls_client_dlina_zapisi_s_mesta(fl_ctx *ctx, fl_value lenta,
                                          fl_value mesto, fl_value *result,
                                          fl_error *error);

/*
 * Функция flang «Запись с места целая».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param lenta — «лента»: список: число
 * @param mesto — «место»: число
 * @return значение
 */
fl_status tls_client_zapis_s_mesta_celaya(fl_ctx *ctx, fl_value lenta,
                                          fl_value mesto, fl_value *result,
                                          fl_error *error);

/*
 * Функция flang «Шаг обхода записей».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param hod — «ход»: «Обход записей»
 * @param lenta — «лента»: список: число
 * @return значение: «Обход записей»
 */
fl_status tls_client_shag_obhoda_zapisey(fl_ctx *ctx, fl_value hod,
                                         fl_value lenta, fl_value *result,
                                         fl_error *error);

/*
 * Функция flang «Ход по записям».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param lenta — «лента»: список: число
 * @return значение: «Обход записей»
 */
fl_status tls_client_hod_po_zapisyam(fl_ctx *ctx, fl_value lenta,
                                     fl_value *result, fl_error *error);

/*
 * Функция flang «Места записей».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param lenta — «лента»: список: число
 * @return значение: список: число
 */
fl_status tls_client_mesta_zapisey(fl_ctx *ctx, fl_value lenta,
                                   fl_value *result, fl_error *error);

/*
 * Функция flang «Записей в ленте».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param lenta — «лента»: список: число
 * @return значение: число
 */
fl_status tls_client_zapisey_v_lente(fl_ctx *ctx, fl_value lenta,
                                     fl_value *result, fl_error *error);

/*
 * Функция flang «Запись по счёту».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param lenta — «лента»: список: число
 * @param nomer — «номер»: число
 * @return значение: список: число
 */
fl_status tls_client_zapis_po_schyotu(fl_ctx *ctx, fl_value lenta,
                                      fl_value nomer, fl_value *result,
                                      fl_error *error);

/*
 * Функция flang «Октетов в целых записях».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param lenta — «лента»: список: число
 * @return значение: число
 */
fl_status tls_client_oktetov_v_celyh_zapisyah(fl_ctx *ctx, fl_value lenta,
                                              fl_value *result,
                                              fl_error *error);

/*
 * Функция flang «Хвост ленты».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param lenta — «лента»: список: число
 * @return значение: список: число
 */
fl_status tls_client_hvost_lenty(fl_ctx *ctx, fl_value lenta, fl_value *result,
                                 fl_error *error);

/*
 * Функция flang «Начало обхода сообщений».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @return значение: «Обход сообщений»
 */
fl_status tls_client_nachalo_obhoda_soobscheniy(fl_ctx *ctx, fl_value *result,
                                                fl_error *error);

/*
 * Функция flang «Длина сообщения с места».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param telo — «тело»: список: число
 * @param mesto — «место»: число
 * @return значение: число
 */
fl_status tls_client_dlina_soobscheniya_s_mesta(fl_ctx *ctx, fl_value telo,
                                                fl_value mesto,
                                                fl_value *result,
                                                fl_error *error);

/*
 * Функция flang «Сообщение с места целое».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param telo — «тело»: список: число
 * @param mesto — «место»: число
 * @return значение
 */
fl_status tls_client_soobschenie_s_mesta_celoe(fl_ctx *ctx, fl_value telo,
                                               fl_value mesto, fl_value *result,
                                               fl_error *error);

/*
 * Функция flang «Шаг обхода сообщений».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param hod — «ход»: «Обход сообщений»
 * @param telo — «тело»: список: число
 * @return значение: «Обход сообщений»
 */
fl_status tls_client_shag_obhoda_soobscheniy(fl_ctx *ctx, fl_value hod,
                                             fl_value telo, fl_value *result,
                                             fl_error *error);

/*
 * Функция flang «Ход по сообщениям».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param telo — «тело»: список: число
 * @return значение: «Обход сообщений»
 */
fl_status tls_client_hod_po_soobscheniyam(fl_ctx *ctx, fl_value telo,
                                          fl_value *result, fl_error *error);

/*
 * Функция flang «Места сообщений».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param telo — «тело»: список: число
 * @return значение: список: число
 */
fl_status tls_client_mesta_soobscheniy(fl_ctx *ctx, fl_value telo,
                                       fl_value *result, fl_error *error);

/*
 * Функция flang «Сообщений в теле».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param telo — «тело»: список: число
 * @return значение: число
 */
fl_status tls_client_soobscheniy_v_tele(fl_ctx *ctx, fl_value telo,
                                        fl_value *result, fl_error *error);

/*
 * Функция flang «Сообщение по счёту».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param telo — «тело»: список: число
 * @param nomer — «номер»: число
 * @return значение: список: число
 */
fl_status tls_client_soobschenie_po_schyotu(fl_ctx *ctx, fl_value telo,
                                            fl_value nomer, fl_value *result,
                                            fl_error *error);

/*
 * Функция flang «Длина справки о запросе».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param soobschenie — «сообщение»: список: число
 * @return значение: число
 */
fl_status tls_client_dlina_spravki_o_zaprose(fl_ctx *ctx, fl_value soobschenie,
                                             fl_value *result, fl_error *error);

/*
 * Функция flang «Место первого сертификата».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param soobschenie — «сообщение»: список: число
 * @return значение: число
 */
fl_status tls_client_mesto_pervogo_sertifikata(fl_ctx *ctx,
                                               fl_value soobschenie,
                                               fl_value *result,
                                               fl_error *error);

/*
 * Функция flang «Длина сертификата с места».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param soobschenie — «сообщение»: список: число
 * @param mesto — «место»: число
 * @return значение: число
 */
fl_status tls_client_dlina_sertifikata_s_mesta(fl_ctx *ctx,
                                               fl_value soobschenie,
                                               fl_value mesto, fl_value *result,
                                               fl_error *error);

/*
 * Функция flang «Сертификат с места целый».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param soobschenie — «сообщение»: список: число
 * @param mesto — «место»: число
 * @return значение
 */
fl_status tls_client_sertifikat_s_mesta_celyy(fl_ctx *ctx, fl_value soobschenie,
                                              fl_value mesto, fl_value *result,
                                              fl_error *error);

/*
 * Функция flang «Шаг обхода сертификатов».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param hod — «ход»: «Обход сообщений»
 * @param soobschenie — «сообщение»: список: число
 * @return значение: «Обход сообщений»
 */
fl_status tls_client_shag_obhoda_sertifikatov(fl_ctx *ctx, fl_value hod,
                                              fl_value soobschenie,
                                              fl_value *result,
                                              fl_error *error);

/*
 * Функция flang «Ход по сертификатам».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param soobschenie — «сообщение»: список: число
 * @return значение: «Обход сообщений»
 */
fl_status tls_client_hod_po_sertifikatam(fl_ctx *ctx, fl_value soobschenie,
                                         fl_value *result, fl_error *error);

/*
 * Функция flang «Места сертификатов».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param soobschenie — «сообщение»: список: число
 * @return значение: список: число
 */
fl_status tls_client_mesta_sertifikatov(fl_ctx *ctx, fl_value soobschenie,
                                        fl_value *result, fl_error *error);

/*
 * Функция flang «Сертификатов в сообщении».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param soobschenie — «сообщение»: список: число
 * @return значение: число
 */
fl_status tls_client_sertifikatov_v_soobschenii(fl_ctx *ctx,
                                                fl_value soobschenie,
                                                fl_value *result,
                                                fl_error *error);

/*
 * Функция flang «Сертификат по счёту».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param soobschenie — «сообщение»: список: число
 * @param nomer — «номер»: число
 * @return значение: список: число
 */
fl_status tls_client_sertifikat_po_schyotu(fl_ctx *ctx, fl_value soobschenie,
                                           fl_value nomer, fl_value *result,
                                           fl_error *error);

/*
 * Функция flang «Расширение имени узла».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param imya — «имя»: список: число
 * @return значение: список: число
 */
fl_status tls_client_rasshirenie_imeni_uzla(fl_ctx *ctx, fl_value imya,
                                            fl_value *result, fl_error *error);

/*
 * Функция flang «Расширение подписей двух видов».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @return значение: список: число
 */
fl_status tls_client_rasshirenie_podpisey_dvuh_vidov(fl_ctx *ctx,
                                                     fl_value *result,
                                                     fl_error *error);

/*
 * Функция flang «Расширения привета с именем».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param otkrytyy — «открытый»: список: число
 * @param imya — «имя»: список: число
 * @return значение: список: число
 */
fl_status tls_client_rasshireniya_priveta_s_imenem(fl_ctx *ctx,
                                                   fl_value otkrytyy,
                                                   fl_value imya,
                                                   fl_value *result,
                                                   fl_error *error);

/*
 * Функция flang «Тело привета с именем».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param sluchaynoe — «случайное»: список: число
 * @param sessiya — «сессия»: список: число
 * @param otkrytyy — «открытый»: список: число
 * @param imya — «имя»: список: число
 * @return значение: список: число
 */
fl_status tls_client_telo_priveta_s_imenem(fl_ctx *ctx, fl_value sluchaynoe,
                                           fl_value sessiya, fl_value otkrytyy,
                                           fl_value imya, fl_value *result,
                                           fl_error *error);

/*
 * Функция flang «Привет с именем».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param sluchaynoe — «случайное»: список: число
 * @param sessiya — «сессия»: список: число
 * @param otkrytyy — «открытый»: список: число
 * @param imya — «имя»: список: число
 * @return значение: список: число
 */
fl_status tls_client_privet_s_imenem(fl_ctx *ctx, fl_value sluchaynoe,
                                     fl_value sessiya, fl_value otkrytyy,
                                     fl_value imya, fl_value *result,
                                     fl_error *error);

/*
 * Функция flang «Расширения привета клиента».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param otkrytyy — «открытый»: список: число
 * @param imya — «имя»: список: число
 * @return значение: список: число
 */
fl_status tls_client_rasshireniya_priveta_klienta(fl_ctx *ctx,
                                                  fl_value otkrytyy,
                                                  fl_value imya,
                                                  fl_value *result,
                                                  fl_error *error);

/*
 * Функция flang «Привет клиента».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param sluchaynoe — «случайное»: список: число
 * @param otkrytyy — «открытый»: список: число
 * @param imya — «имя»: список: число
 * @return значение: список: число
 */
fl_status tls_client_privet_klienta(fl_ctx *ctx, fl_value sluchaynoe,
                                    fl_value otkrytyy, fl_value imya,
                                    fl_value *result, fl_error *error);

/*
 * Функция flang «Запись привета».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param soobschenie — «сообщение»: список: число
 * @return значение: список: число
 */
fl_status tls_client_zapis_priveta(fl_ctx *ctx, fl_value soobschenie,
                                   fl_value *result, fl_error *error);

/*
 * Функция flang «Приметы записей».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @return значение: список: «Примета записи»
 */
fl_status tls_client_primety_zapisey(fl_ctx *ctx, fl_value *result,
                                     fl_error *error);

/*
 * Функция flang «Вид записи».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param kadr — «кадр»: список: число
 * @return значение: «Вид записи TLS»
 */
fl_status tls_client_vid_zapisi(fl_ctx *ctx, fl_value kadr, fl_value *result,
                                fl_error *error);

/*
 * Функция flang «Запись с места».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param lenta — «лента»: список: число
 * @param mesto — «место»: число
 * @return значение: список: число
 */
fl_status tls_client_zapis_s_mesta(fl_ctx *ctx, fl_value lenta, fl_value mesto,
                                   fl_value *result, fl_error *error);

/*
 * Функция flang «Записи ленты».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param lenta — «лента»: список: число
 * @return значение: список: список: число
 */
fl_status tls_client_zapisi_lenty(fl_ctx *ctx, fl_value lenta, fl_value *result,
                                  fl_error *error);

/*
 * Функция flang «Есть Finished».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param potok — «поток»: список: число
 * @return значение
 */
fl_status tls_client_est_finished(fl_ctx *ctx, fl_value potok, fl_value *result,
                                  fl_error *error);

/*
 * Функция flang «Ход».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param nomer — «номер»: число
 * @param potok — «поток»: список: число
 * @param vidno — «видно»: число
 * @param itog — «итог»: число
 * @return значение: «Ход полёта»
 */
fl_status tls_client_hod(fl_ctx *ctx, fl_value nomer, fl_value potok,
                         fl_value vidno, fl_value itog, fl_value *result,
                         fl_error *error);

/*
 * Функция flang «Шаг полёта».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param hod — «ход»: «Ход полёта»
 * @param kadr — «кадр»: список: число
 * @param klyuch — «ключ»: список: число
 * @param vektor — «вектор»: список: число
 * @return значение: «Ход полёта»
 */
fl_status tls_client_shag_polyota(fl_ctx *ctx, fl_value hod, fl_value kadr,
                                  fl_value klyuch, fl_value vektor,
                                  fl_value *result, fl_error *error);

/*
 * Функция flang «Шаг по виду».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param hod — «ход»: «Ход полёта»
 * @param kadr — «кадр»: список: число
 * @param klyuch — «ключ»: список: число
 * @param vektor — «вектор»: список: число
 * @return значение: «Ход полёта»
 */
fl_status tls_client_shag_po_vidu(fl_ctx *ctx, fl_value hod, fl_value kadr,
                                  fl_value klyuch, fl_value vektor,
                                  fl_value *result, fl_error *error);

/*
 * Функция flang «Шаг закрытой записи».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param hod — «ход»: «Ход полёта»
 * @param ishod — «исход»: «Исход GCM»
 * @return значение: «Ход полёта»
 */
fl_status tls_client_shag_zakrytoy_zapisi(fl_ctx *ctx, fl_value hod,
                                          fl_value ishod, fl_value *result,
                                          fl_error *error);

/*
 * Функция flang «Шаг потока».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param hod — «ход»: «Ход полёта»
 * @param otkrytoe — «открытое»: список: число
 * @param vidno — «видно»: число
 * @return значение: «Ход полёта»
 */
fl_status tls_client_shag_potoka(fl_ctx *ctx, fl_value hod, fl_value otkrytoe,
                                 fl_value vidno, fl_value *result,
                                 fl_error *error);

/*
 * Функция flang «Начало полёта».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @return значение: «Ход полёта»
 */
fl_status tls_client_nachalo_polyota(fl_ctx *ctx, fl_value *result,
                                     fl_error *error);

/*
 * Функция flang «Пройти полёт».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param zapisi — «записи»: список: список: число
 * @param klyuch — «ключ»: список: число
 * @param vektor — «вектор»: список: число
 * @return значение: «Ход полёта»
 */
fl_status tls_client_proyti_polyot(fl_ctx *ctx, fl_value zapisi,
                                   fl_value klyuch, fl_value vektor,
                                   fl_value *result, fl_error *error);

/*
 * Функция flang «Случайное повтора».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @return значение: список: число
 */
fl_status tls_client_sluchaynoe_povtora(fl_ctx *ctx, fl_value *result,
                                        fl_error *error);

/*
 * Функция flang «Привет сервера годен».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param privet — «привет»: список: число
 * @return значение: «Приговор пути»
 */
fl_status tls_client_privet_servera_goden(fl_ctx *ctx, fl_value privet,
                                          fl_value *result, fl_error *error);

/*
 * Функция flang «Тревога словом».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param kadr — «кадр»: список: число
 * @return значение: строка
 */
fl_status tls_client_trevoga_slovom(fl_ctx *ctx, fl_value kadr,
                                    fl_value *result, fl_error *error);

/*
 * Функция flang «Полёт сервера».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param tayna — «тайна»: список: число
 * @param privet — «привет»: список: число
 * @param lenta — «лента»: список: число
 * @return значение: «Итог полёта»
 */
fl_status tls_client_polyot_servera(fl_ctx *ctx, fl_value tayna,
                                    fl_value privet, fl_value lenta,
                                    fl_value *result, fl_error *error);

/*
 * Функция flang «Полёт по первой».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param tayna — «тайна»: список: число
 * @param privet — «привет»: список: число
 * @param zapisi — «записи»: список: список: число
 * @param pervaya — «первая»: список: число
 * @return значение: «Итог полёта»
 */
fl_status tls_client_polyot_po_pervoy(fl_ctx *ctx, fl_value tayna,
                                      fl_value privet, fl_value zapisi,
                                      fl_value pervaya, fl_value *result,
                                      fl_error *error);

/*
 * Функция flang «Полёт за приветом».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param tayna — «тайна»: список: число
 * @param privet — «привет»: список: число
 * @param zapisi — «записи»: список: список: число
 * @param server — «сервер»: список: число
 * @return значение: «Итог полёта»
 */
fl_status tls_client_polyot_za_privetom(fl_ctx *ctx, fl_value tayna,
                                        fl_value privet, fl_value zapisi,
                                        fl_value server, fl_value *result,
                                        fl_error *error);

/*
 * Функция flang «Полёт с ключом».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param tayna — «тайна»: список: число
 * @param privet — «привет»: список: число
 * @param zapisi — «записи»: список: список: число
 * @param server — «сервер»: список: число
 * @return значение: «Итог полёта»
 */
fl_status tls_client_polyot_s_klyuchom(fl_ctx *ctx, fl_value tayna,
                                       fl_value privet, fl_value zapisi,
                                       fl_value server, fl_value *result,
                                       fl_error *error);

/*
 * Функция flang «Приговор хода».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param hod — «ход»: «Ход полёта»
 * @return значение: «Приговор пути»
 */
fl_status tls_client_prigovor_hoda(fl_ctx *ctx, fl_value hod, fl_value *result,
                                   fl_error *error);

/*
 * Функция flang «Полёт по ходу».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param hod — «ход»: «Ход полёта»
 * @param ruk — «рук»: список: число
 * @param para — «пара»: «Пара»
 * @param privety — «приветы»: список: число
 * @param server — «сервер»: список: число
 * @return значение: «Итог полёта»
 */
fl_status tls_client_polyot_po_hodu(fl_ctx *ctx, fl_value hod, fl_value ruk,
                                    fl_value para, fl_value privety,
                                    fl_value server, fl_value *result,
                                    fl_error *error);

/*
 * Функция flang «Итог полёта по коду».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param kod — «код»: строка
 * @param slova — «слова»: строка
 * @return значение: «Итог полёта»
 */
fl_status tls_client_itog_polyota_po_kodu(fl_ctx *ctx, fl_value kod,
                                          fl_value slova, fl_value *result,
                                          fl_error *error);

/*
 * Функция flang «Собрать полёт».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param ser — «сер»: список: число
 * @param pot — «пот»: список: число
 * @param ruk — «рук»: «Пара»
 * @param dan — «дан»: «Пара»
 * @param kon — «кон»: число
 * @return значение: «Полёт»
 */
fl_status tls_client_sobrat_polyot(fl_ctx *ctx, fl_value ser, fl_value pot,
                                   fl_value ruk, fl_value dan, fl_value kon,
                                   fl_value *result, fl_error *error);

/*
 * Функция flang «Полёт из хода».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param hod — «ход»: «Ход полёта»
 * @param ruk — «рук»: список: число
 * @param para — «пара»: «Пара»
 * @param privety — «приветы»: список: число
 * @param server — «сервер»: список: число
 * @return значение: «Полёт»
 */
fl_status tls_client_polyot_iz_hoda(fl_ctx *ctx, fl_value hod, fl_value ruk,
                                    fl_value para, fl_value privety,
                                    fl_value server, fl_value *result,
                                    fl_error *error);

/*
 * Функция flang «Номера сертификатов».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param soobschenie — «сообщение»: список: число
 * @return значение: список: число
 */
fl_status tls_client_nomera_sertifikatov(fl_ctx *ctx, fl_value soobschenie,
                                         fl_value *result, fl_error *error);

/*
 * Функция flang «Сертификаты сообщения».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param soobschenie — «сообщение»: список: число
 * @return значение: список: список: число
 */
fl_status tls_client_sertifikaty_soobscheniya(fl_ctx *ctx, fl_value soobschenie,
                                              fl_value *result,
                                              fl_error *error);

/*
 * Функция flang «Подпись из проверки».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param proverka — «проверка»: список: число
 * @return значение: список: число
 */
fl_status tls_client_podpis_iz_proverki(fl_ctx *ctx, fl_value proverka,
                                        fl_value *result, fl_error *error);

/*
 * Функция flang «Тип сообщения».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param soobscheniya — «сообщения»: список: число
 * @param nomer — «номер»: число
 * @return значение: число
 */
fl_status tls_client_tip_soobscheniya(fl_ctx *ctx, fl_value soobscheniya,
                                      fl_value nomer, fl_value *result,
                                      fl_error *error);

/*
 * Функция flang «Сообщения полёта годны».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param soobscheniya — «сообщения»: список: число
 * @return значение: «Приговор пути»
 */
fl_status tls_client_soobscheniya_polyota_godny(fl_ctx *ctx,
                                                fl_value soobscheniya,
                                                fl_value *result,
                                                fl_error *error);

/*
 * Функция flang «PSS сервера верна».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param list — «лист»: список: число
 * @param proverka — «проверка»: список: число
 * @param stenogramma — «стенограмма»: список: число
 * @return значение
 */
fl_status tls_client_pss_servera_verna(fl_ctx *ctx, fl_value list,
                                       fl_value proverka, fl_value stenogramma,
                                       fl_value *result, fl_error *error);

/*
 * Функция flang «Проверка подписи сервера».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param list — «лист»: список: число
 * @param proverka — «проверка»: список: число
 * @param stenogramma — «стенограмма»: список: число
 * @return значение: «Приговор пути»
 */
fl_status tls_client_proverka_podpisi_servera(fl_ctx *ctx, fl_value list,
                                              fl_value proverka,
                                              fl_value stenogramma,
                                              fl_value *result,
                                              fl_error *error);

/*
 * Функция flang «Первый сертификат».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param serty — «серты»: список: список: число
 * @return значение: список: число
 */
fl_status tls_client_pervyy_sertifikat(fl_ctx *ctx, fl_value serty,
                                       fl_value *result, fl_error *error);

/*
 * Функция flang «До проверки».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param polyot — «полёт»: «Полёт»
 * @param privet — «привет»: список: число
 * @return значение: список: число
 */
fl_status tls_client_do_proverki(fl_ctx *ctx, fl_value polyot, fl_value privet,
                                 fl_value *result, fl_error *error);

/*
 * Функция flang «Проверить полёт».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param polyot — «полёт»: «Полёт»
 * @param privet — «привет»: список: число
 * @param doverie — «доверие»: «Доверие»
 * @return значение: «Приговор пути»
 */
fl_status tls_client_proverit_polyot(fl_ctx *ctx, fl_value polyot,
                                     fl_value privet, fl_value doverie,
                                     fl_value *result, fl_error *error);

/*
 * Функция flang «Проверить путь полёта».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param polyot — «полёт»: «Полёт»
 * @param privet — «привет»: список: число
 * @param doverie — «доверие»: «Доверие»
 * @return значение: «Приговор пути»
 */
fl_status tls_client_proverit_put_polyota(fl_ctx *ctx, fl_value polyot,
                                          fl_value privet, fl_value doverie,
                                          fl_value *result, fl_error *error);

/*
 * Функция flang «Проверить подпись полёта».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param polyot — «полёт»: «Полёт»
 * @param privet — «привет»: список: число
 * @param list — «лист»: список: число
 * @return значение: «Приговор пути»
 */
fl_status tls_client_proverit_podpis_polyota(fl_ctx *ctx, fl_value polyot,
                                             fl_value privet, fl_value list,
                                             fl_value *result, fl_error *error);

/*
 * Функция flang «Финиш сервера сошёлся».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param polyot — «полёт»: «Полёт»
 * @param privet — «привет»: список: число
 * @return значение: «Приговор пути»
 */
fl_status tls_client_finish_servera_soshyolsya(fl_ctx *ctx, fl_value polyot,
                                               fl_value privet,
                                               fl_value *result,
                                               fl_error *error);

/*
 * Функция flang «Финиш клиента записью».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param polyot — «полёт»: «Полёт»
 * @param privet — «привет»: список: число
 * @return значение: список: число
 */
fl_status tls_client_finish_klienta_zapisyu(fl_ctx *ctx, fl_value polyot,
                                            fl_value privet, fl_value *result,
                                            fl_error *error);

/*
 * Функция flang «Запрос записью».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param polyot — «полёт»: «Полёт»
 * @param zapros — «запрос»: список: число
 * @return значение: список: число
 */
fl_status tls_client_zapros_zapisyu(fl_ctx *ctx, fl_value polyot,
                                    fl_value zapros, fl_value *result,
                                    fl_error *error);

/*
 * Функция flang «Ответ клиента».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param polyot — «полёт»: «Полёт»
 * @param privet — «привет»: список: число
 * @param zapros — «запрос»: список: число
 * @return значение: список: число
 */
fl_status tls_client_otvet_klienta(fl_ctx *ctx, fl_value polyot,
                                   fl_value privet, fl_value zapros,
                                   fl_value *result, fl_error *error);

/*
 * Функция flang «Готово с ключами».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param polyot — «полёт»: «Полёт»
 * @param oktety — «октеты»: список: число
 * @return значение: «Итог рукопожатия»
 */
fl_status tls_client_gotovo_s_klyuchami(fl_ctx *ctx, fl_value polyot,
                                        fl_value oktety, fl_value *result,
                                        fl_error *error);

/*
 * Функция flang «Отказ по приговору».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param prigovor — «приговор»: «Приговор пути»
 * @return значение: «Итог рукопожатия»
 */
fl_status tls_client_otkaz_po_prigovoru(fl_ctx *ctx, fl_value prigovor,
                                        fl_value *result, fl_error *error);

/*
 * Функция flang «Финиш по готовому».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param polyot — «полёт»: «Полёт»
 * @param privet — «привет»: список: число
 * @return значение: «Итог рукопожатия»
 */
fl_status tls_client_finish_po_gotovomu(fl_ctx *ctx, fl_value polyot,
                                        fl_value privet, fl_value *result,
                                        fl_error *error);

/*
 * Функция flang «Шаг финиша по полёту».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param itog — «итог»: «Итог полёта»
 * @param privet — «привет»: список: число
 * @return значение: «Итог рукопожатия»
 */
fl_status tls_client_shag_finisha_po_polyotu(fl_ctx *ctx, fl_value itog,
                                             fl_value privet, fl_value *result,
                                             fl_error *error);

/*
 * Функция flang «Шаг финиша».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param tayna — «тайна»: список: число
 * @param privet — «привет»: список: число
 * @param lenta — «лента»: список: число
 * @return значение: «Итог рукопожатия»
 */
fl_status tls_client_shag_finisha(fl_ctx *ctx, fl_value tayna, fl_value privet,
                                  fl_value lenta, fl_value *result,
                                  fl_error *error);

/*
 * Функция flang «Запрос по готовому».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param polyot — «полёт»: «Полёт»
 * @param privet — «привет»: список: число
 * @param doverie — «доверие»: «Доверие»
 * @param zapros — «запрос»: список: число
 * @return значение: «Итог рукопожатия»
 */
fl_status tls_client_zapros_po_gotovomu(fl_ctx *ctx, fl_value polyot,
                                        fl_value privet, fl_value doverie,
                                        fl_value zapros, fl_value *result,
                                        fl_error *error);

/*
 * Функция flang «Запрос по проверенному».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param polyot — «полёт»: «Полёт»
 * @param privet — «привет»: список: число
 * @param doverie — «доверие»: «Доверие»
 * @param zapros — «запрос»: список: число
 * @return значение: «Итог рукопожатия»
 */
fl_status tls_client_zapros_po_proverennomu(fl_ctx *ctx, fl_value polyot,
                                            fl_value privet, fl_value doverie,
                                            fl_value zapros, fl_value *result,
                                            fl_error *error);

/*
 * Функция flang «Шаг рукопожатия».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param tayna — «тайна»: список: число
 * @param privet — «привет»: список: число
 * @param lenta — «лента»: список: число
 * @param doverie — «доверие»: «Доверие»
 * @param zapros — «запрос»: список: число
 * @return значение: «Итог рукопожатия»
 */
fl_status tls_client_shag_rukopozhatiya(fl_ctx *ctx, fl_value tayna,
                                        fl_value privet, fl_value lenta,
                                        fl_value doverie, fl_value zapros,
                                        fl_value *result, fl_error *error);

/*
 * Функция flang «Ответ».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param nomer — «номер»: число
 * @param tekst — «текст»: список: число
 * @param konec — «конец»
 * @param porcha — «порча»
 * @return значение: «Ход ответа»
 */
fl_status tls_client_otvet(fl_ctx *ctx, fl_value nomer, fl_value tekst,
                           fl_value konec, fl_value porcha, fl_value *result,
                           fl_error *error);

/*
 * Функция flang «Начало ответа».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @return значение: «Ход ответа»
 */
fl_status tls_client_nachalo_otveta(fl_ctx *ctx, fl_value *result,
                                    fl_error *error);

/*
 * Функция flang «Шаг ответа».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param hod — «ход»: «Ход ответа»
 * @param kadr — «кадр»: список: число
 * @param klyuch — «ключ»: список: число
 * @param vektor — «вектор»: список: число
 * @return значение: «Ход ответа»
 */
fl_status tls_client_shag_otveta(fl_ctx *ctx, fl_value hod, fl_value kadr,
                                 fl_value klyuch, fl_value vektor,
                                 fl_value *result, fl_error *error);

/*
 * Функция flang «Шаг открытого ответа».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param hod — «ход»: «Ход ответа»
 * @param ishod — «исход»: «Исход GCM»
 * @return значение: «Ход ответа»
 */
fl_status tls_client_shag_otkrytogo_otveta(fl_ctx *ctx, fl_value hod,
                                           fl_value ishod, fl_value *result,
                                           fl_error *error);

/*
 * Функция flang «Ответ по тексту».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param hod — «ход»: «Ход ответа»
 * @param nomer — «номер»: число
 * @param otkrytoe — «открытое»: список: число
 * @return значение: «Ход ответа»
 */
fl_status tls_client_otvet_po_tekstu(fl_ctx *ctx, fl_value hod, fl_value nomer,
                                     fl_value otkrytoe, fl_value *result,
                                     fl_error *error);

/*
 * Функция flang «Отобрать».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param hod — «ход»: «Отбор записей»
 * @param kadr — «кадр»: список: число
 * @param skolko — «сколько»: число
 * @return значение: «Отбор записей»
 */
fl_status tls_client_otobrat(fl_ctx *ctx, fl_value hod, fl_value kadr,
                             fl_value skolko, fl_value *result,
                             fl_error *error);

/*
 * Функция flang «Записи после».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param zapisi — «записи»: список: список: число
 * @param skolko — «сколько»: число
 * @return значение: список: список: число
 */
fl_status tls_client_zapisi_posle(fl_ctx *ctx, fl_value zapisi, fl_value skolko,
                                  fl_value *result, fl_error *error);

/*
 * Функция flang «Ответ сервера».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param klyuch — «ключ»: список: число
 * @param vektor — «вектор»: список: число
 * @param lenta — «лента»: список: число
 * @param propustit — «пропустить»: число
 * @return значение: «Ход ответа»
 */
fl_status tls_client_otvet_servera(fl_ctx *ctx, fl_value klyuch,
                                   fl_value vektor, fl_value lenta,
                                   fl_value propustit, fl_value *result,
                                   fl_error *error);

/*
 * Функция flang «Шестнадцатеричная строка».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param oktety — «октеты»: список: число
 * @return значение: строка
 */
fl_status tls_client_shestnadcaterichnaya_stroka(fl_ctx *ctx, fl_value oktety,
                                                 fl_value *result,
                                                 fl_error *error);

/*
 * Функция flang «Знак ASCII».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param oktet — «октет»: число
 * @return значение: строка
 */
fl_status tls_client_znak_ascii(fl_ctx *ctx, fl_value oktet, fl_value *result,
                                fl_error *error);

/*
 * Функция flang «Шаг строки».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param hod — «ход»: «Ход строки»
 * @param oktet — «октет»: число
 * @return значение: «Ход строки»
 */
fl_status tls_client_shag_stroki(fl_ctx *ctx, fl_value hod, fl_value oktet,
                                 fl_value *result, fl_error *error);

/*
 * Функция flang «Первая строка».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param oktety — «октеты»: список: число
 * @return значение: строка
 */
fl_status tls_client_pervaya_stroka(fl_ctx *ctx, fl_value oktety,
                                    fl_value *result, fl_error *error);

/*
 * Функция flang «Запрос GET».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param uzel — «узел»: строка
 * @param put — «путь»: строка
 * @return значение: список: число
 */
fl_status tls_client_zapros_get(fl_ctx *ctx, fl_value uzel, fl_value put,
                                fl_value *result, fl_error *error);

/*
 * Функция flang «Октеты привета».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param privet — «привет»: строка
 * @return значение: список: число
 */
fl_status tls_client_oktety_priveta(fl_ctx *ctx, fl_value privet,
                                    fl_value *result, fl_error *error);

/*
 * Функция flang «Доверие из слов».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param svyazka — «связка»: строка
 * @param millisekundy — «миллисекунды»: число
 * @param uzel — «узел»: строка
 * @return значение: «Доверие»
 */
fl_status tls_client_doverie_iz_slov(fl_ctx *ctx, fl_value svyazka,
                                     fl_value millisekundy, fl_value uzel,
                                     fl_value *result, fl_error *error);

/*
 * Функция flang «Привет клиента шестнадцатеричным».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param tayna — «тайна»: строка
 * @param sluchaynoe — «случайное»: строка
 * @param uzel — «узел»: строка
 * @return значение: строка
 */
fl_status tls_client_privet_klienta_shestnadcaterichnym(fl_ctx *ctx,
                                                        fl_value tayna,
                                                        fl_value sluchaynoe,
                                                        fl_value uzel,
                                                        fl_value *result,
                                                        fl_error *error);

/*
 * Функция flang «Итог словом».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param itog — «итог»: «Итог рукопожатия»
 * @return значение: строка
 */
fl_status tls_client_itog_slovom(fl_ctx *ctx, fl_value itog, fl_value *result,
                                 fl_error *error);

/*
 * Функция flang «Полёт словами».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param polyot — «полёт»: «Полёт»
 * @return значение: строка
 */
fl_status tls_client_polyot_slovami(fl_ctx *ctx, fl_value polyot,
                                    fl_value *result, fl_error *error);

/*
 * Функция flang «Финиш готового словом».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param polyot — «полёт»: «Полёт»
 * @param privet — «привет»: список: число
 * @return значение: строка
 */
fl_status tls_client_finish_gotovogo_slovom(fl_ctx *ctx, fl_value polyot,
                                            fl_value privet, fl_value *result,
                                            fl_error *error);

/*
 * Функция flang «Финиш словом».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param tayna — «тайна»: строка
 * @param privet — «привет»: строка
 * @param lenta — «лента»: строка
 * @return значение: строка
 */
fl_status tls_client_finish_slovom(fl_ctx *ctx, fl_value tayna, fl_value privet,
                                   fl_value lenta, fl_value *result,
                                   fl_error *error);

/*
 * Функция flang «Полёт из слов».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param chasti — «части»: список: строка
 * @return значение: «Полёт»
 */
fl_status tls_client_polyot_iz_slov(fl_ctx *ctx, fl_value chasti,
                                    fl_value *result, fl_error *error);

/*
 * Функция flang «Байт-список».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param spiski — «списки»: список: список: число
 * @param nomer — «номер»: число
 * @return значение: список: число
 */
fl_status tls_client_bayt_spisok(fl_ctx *ctx, fl_value spiski, fl_value nomer,
                                 fl_value *result, fl_error *error);

/*
 * Функция flang «Строка по счёту».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param stroki — «строки»: список: строка
 * @param nomer — «номер»: число
 * @return значение: строка
 */
fl_status tls_client_stroka_po_schyotu(fl_ctx *ctx, fl_value stroki,
                                       fl_value nomer, fl_value *result,
                                       fl_error *error);

/*
 * Функция flang «Запрос по полёту словом».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param privet — «привет»: строка
 * @param chasti — «части»: список: строка
 * @param svyazka — «связка»: строка
 * @param millisekundy — «миллисекунды»: число
 * @param uzel — «узел»: строка
 * @param put — «путь»: строка
 * @return значение: строка
 */
fl_status tls_client_zapros_po_polyotu_slovom(fl_ctx *ctx, fl_value privet,
                                              fl_value chasti, fl_value svyazka,
                                              fl_value millisekundy,
                                              fl_value uzel, fl_value put,
                                              fl_value *result,
                                              fl_error *error);

/*
 * Функция flang «Ответ сервера словом».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param klyuch — «ключ»: строка
 * @param vektor — «вектор»: строка
 * @param lenta — «лента»: строка
 * @param propustit — «пропустить»: число
 * @return значение: строка
 */
fl_status tls_client_otvet_servera_slovom(fl_ctx *ctx, fl_value klyuch,
                                          fl_value vektor, fl_value lenta,
                                          fl_value propustit, fl_value *result,
                                          fl_error *error);

/*
 * Функция flang «Запрос по полёту октетами».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param privet — «привет»: строка
 * @param chasti — «части»: список: строка
 * @param svyazka — «связка»: строка
 * @param millisekundy — «миллисекунды»: число
 * @param uzel — «узел»: строка
 * @param zapros — «запрос»: строка
 * @return значение: строка
 */
fl_status tls_client_zapros_po_polyotu_oktetami(fl_ctx *ctx, fl_value privet,
                                                fl_value chasti,
                                                fl_value svyazka,
                                                fl_value millisekundy,
                                                fl_value uzel, fl_value zapros,
                                                fl_value *result,
                                                fl_error *error);

/*
 * Функция flang «Ответ сервера октетами».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param klyuch — «ключ»: строка
 * @param vektor — «вектор»: строка
 * @param lenta — «лента»: строка
 * @param propustit — «пропустить»: число
 * @return значение: строка
 */
fl_status tls_client_otvet_servera_oktetami(fl_ctx *ctx, fl_value klyuch,
                                            fl_value vektor, fl_value lenta,
                                            fl_value propustit,
                                            fl_value *result, fl_error *error);

/*
 * Функция flang «мера убывает».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param shag — «шаг»: число
 * @param mera — «мера»: число
 * @return значение: число
 */
fl_status tls_client_mera_ubyvaet(fl_ctx *ctx, fl_value shag, fl_value mera,
                                  fl_value *result, fl_error *error);

/*
 * Функция flang «мера убывает 2».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param shag — «шаг»: число
 * @param mera — «мера»: число
 * @return значение: число
 */
fl_status tls_client_mera_ubyvaet_2(fl_ctx *ctx, fl_value shag, fl_value mera,
                                    fl_value *result, fl_error *error);

/*
 * Функция flang «мера убывает 3».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param shag — «шаг»: число
 * @param mera — «мера»: число
 * @return значение: число
 */
fl_status tls_client_mera_ubyvaet_3(fl_ctx *ctx, fl_value shag, fl_value mera,
                                    fl_value *result, fl_error *error);

/*
 * Функция flang «мера убывает 4».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param shag — «шаг»: число
 * @param mera — «мера»: число
 * @return значение: число
 */
fl_status tls_client_mera_ubyvaet_4(fl_ctx *ctx, fl_value shag, fl_value mera,
                                    fl_value *result, fl_error *error);

/*
 * Функция flang «мера убывает 5».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param shag — «шаг»: число
 * @param mera — «мера»: число
 * @return значение: число
 */
fl_status tls_client_mera_ubyvaet_5(fl_ctx *ctx, fl_value shag, fl_value mera,
                                    fl_value *result, fl_error *error);

/*
 * Функция flang «мера убывает 6».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param shag — «шаг»: число
 * @param mera — «мера»: число
 * @return значение: число
 */
fl_status tls_client_mera_ubyvaet_6(fl_ctx *ctx, fl_value shag, fl_value mera,
                                    fl_value *result, fl_error *error);

/*
 * Функция flang «мера убывает 7».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param shag — «шаг»: число
 * @param mera — «мера»: число
 * @return значение: число
 */
fl_status tls_client_mera_ubyvaet_7(fl_ctx *ctx, fl_value shag, fl_value mera,
                                    fl_value *result, fl_error *error);

/*
 * Функция flang «мера убывает 8».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param shag — «шаг»: число
 * @param mera — «мера»: число
 * @return значение: число
 */
fl_status tls_client_mera_ubyvaet_8(fl_ctx *ctx, fl_value shag, fl_value mera,
                                    fl_value *result, fl_error *error);

/*
 * Функция flang «мера убывает 9».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param shag — «шаг»: число
 * @param mera — «мера»: число
 * @return значение: число
 */
fl_status tls_client_mera_ubyvaet_9(fl_ctx *ctx, fl_value shag, fl_value mera,
                                    fl_value *result, fl_error *error);

/*
 * Вызов функции по её исходному имени flang. Нужен прогонщику и всякому,
 * кто связывает программу с внешним миром динамически (скрипт, FFI, тест).
 */
fl_status tls_client_call(fl_ctx *ctx, const char *name, const fl_value *args,
                          size_t count, fl_value *result, fl_error *error);

/*
 * ТО ЖЕ, НО ЧЕРЕЗ ГРАНИЦУ ВХОДА: объявленные типы сверяются ДО вызова.
 * Значения, пришедшие снаружи — из JSON, из другого языка, от человека, —
 * обязаны заходить ЗДЕСЬ: `_call` их не сверяет, а доказательство завершения
 * `тотальной` стоит НА ТИПЕ и вместе с типом теряется.
 */
fl_status tls_client_enter(fl_ctx *ctx, const char *name, const fl_value *args,
                           size_t count, fl_value *result, fl_error *error);

/*
 * Объявленные типы параметров — данными. Прогонщик сверяет по ним значения,
 * пришедшие снаружи, ДО вызова: доказательство завершения `тотальной` стоит
 * на типе, и значение вне типа выносит вместе с типом и доказательство.
 */
const fl_entry_table *tls_client_entry(void);

#endif /* TLS_CLIENT_H */

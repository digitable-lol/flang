/**
 * Переходник: подключает прогон примера `examples/library-api` к общему набору.
 *
 * Сам тест лежит в проекте примера, потому что он про проект. А набор в
 * package.json собирается образцом `flang/test/*.test.mjs`, и второй образец
 * ради одного примера означал бы правку файла, который правят все. Один
 * импорт дешевле: он регистрирует те же `describe`/`it`, что и прямой запуск
 * `node --test examples/library-api/test/library-api.test.mjs`.
 */
import "../../examples/library-api/test/library-api.test.mjs"

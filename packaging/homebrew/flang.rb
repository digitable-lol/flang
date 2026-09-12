class Flang < Formula
  desc "Проверяемый язык: исполняемая спецификация, печатается в восемь языков"
  homepage "https://github.com/digitable-lol/flang"
  url "https://github.com/digitable-lol/flang/releases/download/v0.7.18/flang-0.7.18-c.tar.gz"
  sha256 "c783c5cbbd1dd06fe9c8584c5562a00b4711fc2627fe2122b4ef70b6a7518ac0"
  license "BSD-2-Clause"
  version "0.7.18"

  depends_on "make" => :build

  def install
    system "make", "CFLAGS=-std=c99 -Wall -Wextra -Werror -pedantic -O2"
    собрано = File.exist?("flang") ? "flang" : "flang_cli"
    bin.install собрано => "flang"

    # Проводник по языку и его уроки. Ставятся ТОЛЬКО если архив их несёт:
    # формула ставит и выпуски постарше, а в них проводника нет вовсе, и
    # безусловная строка отказала бы на них по делу.
    #
    # УРОКИ ЛОЖАТСЯ В share/flang-tutor, А НЕ В share/flang, и это не вкус.
    # Проба ниже требует, чтобы каталогов под share/flang было РОВНО столько,
    # сколько целей у печати; то же требует packaging/asdf/bin/install. Уроки
    # шестым каталогом покрасили бы обе установки, ничего при этом не сломав
    # по существу, — то есть научили бы не верить проверке.
    if File.exist?("flangtutor")
      bin.install "flangtutor"
      (share/"flang-tutor").install Dir["tutor/*"] if Dir.exist?("tutor")
    end

    lib.install Dir["lib*.a"]
    include.install Dir["*.h"]
    if Dir.exist?("runtime")
      (share/"flang").install Dir["runtime/*"]
    elsif Dir.exist?("runtime-c")
      (share/"flang/c").install Dir["runtime-c/*"]
    end
    man1.install "flang.1"
  end

  test do
    исходник = <<~FLANG
      модуль «Проба»

      тотальная функция «Два»
        возвращает число
        2
    FLANG
    запрос = {
      "fn" => "Число связанных функций",
      "args" => [
        { "l" => [{ "r" => [["путь", { "s" => "проба.flang" }], ["текст", { "s" => исходник }]] }] },
        { "s" => "проба.flang" },
      ],
    }.to_json
    ответ = pipe_output("#{bin}/flang", "#{запрос}\n")
    assert_match '"ok":true', ответ
    assert_match '"n":"1"', ответ

    assert_match "flang #{version}", shell_output("#{bin}/flang --version")
    assert_match "flang check", shell_output("#{bin}/flang --help")
    assert_match "flang check", shell_output("#{bin}/flang -h")
    assert_match "flang #{version}", shell_output("#{bin}/flang -v")

    подробно = shell_output("#{bin}/flang check --help")
    assert_match "--proof", подробно
    refute_match "flang test <файл>", подробно

    (testpath/"проба.flang").write(исходник)
    assert_match "проверено", shell_output("#{bin}/flang check проба.flang")

    (testpath/"кривая.flang").write(<<~FLANG)
      модуль «Кривая»

      тотальная функция «Два»
        возвращает число
        "два"
    FLANG
    беда = shell_output("#{bin}/flang check кривая.flang 2>&1", 1)
    assert_match "FLANG_TYPE", беда

    shell_output("#{bin}/flang emit проба.flang --target c --out печать/сюда 2>&1")
    assert_predicate testpath/"печать/сюда/flang_runtime.c", :exist?
    assert_predicate testpath/"печать/сюда/Makefile", :exist?

    справка = shell_output("#{bin}/flang --help")
    строка_целей = справка.lines.find { |с| с.include?("--target") && с.include?("напечатать программу: ") }
    цели = строка_целей.to_s.split("напечатать программу: ").last.to_s.strip.split("|")
    assert_operator цели.length, :>=, 9,
                    "двоичный назвал целей печати #{цели.length}, а их девять: справка «#{строка_целей}»"

    цели.each do |цель|
      shell_output("#{bin}/flang emit проба.flang --target #{цель} --out печать-целей/#{цель} 2>&1")
      refute_empty Dir[testpath/"печать-целей/#{цель}/*"],
                   "flang emit --target #{цель} отчитался успехом, но файлов не положил"
    end

    # Проводник обязан находить уроки ПОСЛЕ УСТАНОВКИ, а не только в дереве:
    # он ищет их рядом с собой и на этаж выше, в share/flang-tutor. Спрашивается
    # ровно то, что человек наберёт первым, и молча этот вопрос не отвечается:
    # без уроков «--список» уходит ненулевым кодом, и shell_output поднимет беду.
    if (bin/"flangtutor").exist?
      уроки = shell_output("#{bin}/flangtutor --список")
      refute_empty уроки.lines, "flangtutor --список не назвал ни одного урока"
      assert_match(/^урок 1 · /, уроки)
    end

    assert_predicate share/"flang/cpp/flang_cpp.hpp", :exist?
    цели.each do |цель|
      assert_predicate share/"flang/#{цель}", :directory?
    end
    assert_equal цели.length, Dir[share/"flang/*"].count { |путь| File.directory?(путь) }
  end
end

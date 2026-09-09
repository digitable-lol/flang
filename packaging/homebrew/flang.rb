class Flang < Formula
  desc "Проверяемый язык: исполняемая спецификация, печатается в восемь языков"
  homepage "https://github.com/digitable-lol/flang"
  url "https://github.com/digitable-lol/flang/releases/download/v0.7.16/flang-0.7.16-c.tar.gz"
  sha256 "740571c8d140b1399e73a4331f7805979ed1483ac93da5cd70e898bcaff1dd5b"
  license "BSD-2-Clause"
  version "0.7.16"

  depends_on "make" => :build

  def install
    system "make", "CFLAGS=-std=c99 -Wall -Wextra -Werror -pedantic -O2"
    собрано = File.exist?("flang") ? "flang" : "flang_cli"
    bin.install собрано => "flang"
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

    assert_predicate share/"flang/cpp/flang_cpp.hpp", :exist?
    цели.each do |цель|
      assert_predicate share/"flang/#{цель}", :directory?
    end
    assert_equal цели.length, Dir[share/"flang/*"].count { |путь| File.directory?(путь) }
  end
end

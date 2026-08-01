#!/usr/bin/env python3
"""Build the confidential FTS research dossier as a publication-style PDF."""

from __future__ import annotations

import html
import re
from datetime import date
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    KeepTogether,
    PageBreak,
    PageTemplate,
    Paragraph,
    Preformatted,
    Spacer,
)

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "output" / "pdf" / "fts-formal-semantics-and-patent-basis.pdf"
SOURCES = [
    ROOT / "research" / "fts-formal-semantics.md",
    ROOT / "research" / "patent-technical-disclosure.md",
]

NAVY = colors.HexColor("#14213D")
BLUE = colors.HexColor("#246BCE")
PALE = colors.HexColor("#EEF4FC")
INK = colors.HexColor("#20242C")
MUTED = colors.HexColor("#5D6674")
RULE = colors.HexColor("#CDD6E3")
WARNING = colors.HexColor("#8A3B12")


def register_fonts() -> None:
    font_dir = Path("/System/Library/Fonts/Supplemental")
    pdfmetrics.registerFont(TTFont("FTS", font_dir / "Arial.ttf"))
    pdfmetrics.registerFont(TTFont("FTS-Bold", font_dir / "Arial Bold.ttf"))
    pdfmetrics.registerFont(TTFont("FTS-Italic", font_dir / "Arial Italic.ttf"))
    pdfmetrics.registerFont(TTFont("FTS-Mono", font_dir / "Courier New.ttf"))
    pdfmetrics.registerFontFamily("FTS", normal="FTS", bold="FTS-Bold", italic="FTS-Italic")


def normalize_punctuation(value: str) -> str:
    value = (
        value.replace("\u2011", "-")
        .replace("\u2012", "-")
        .replace("\u2013", "-")
        .replace("\u2014", "-")
        .replace("\u2212", "-")
    )
    replacements = {
        "Σ": "Sigma", "Γ": "Gamma", "Δ": "Delta", "τ": "tau", "π": "pi",
        "λ": "lambda", "⊢": "|-", "⇓": "=>", "▷": "|", "→": "->",
        "∘": "o", "⊤": "TRUE", "∈": "in", "∀": "forall", "∃": "exists",
        "⟦": "[[", "⟧": "]]", "≤": "<=", "≥": ">=", "≠": "!=", "□": "[QED]",
        "∑": "sum", "∧": "and", "∨": "or", "¬": "not ",
    }
    for source, target in replacements.items():
        value = value.replace(source, target)
    return value


def inline_markup(value: str) -> str:
    value = normalize_punctuation(value)
    links: list[tuple[str, str]] = []

    def hold_link(match: re.Match[str]) -> str:
        links.append((match.group(1), match.group(2)))
        return f"@@LINK{len(links) - 1}@@"

    value = re.sub(r"\[([^\]]+)\]\((https?://[^)]+)\)", hold_link, value)
    value = html.escape(value)
    value = re.sub(r"`([^`]+)`", r'<font name="FTS-Mono">\1</font>', value)
    value = re.sub(r"\*\*([^*]+)\*\*", r"<b>\1</b>", value)
    value = re.sub(r"(?<!\*)\*([^*]+)\*(?!\*)", r"<i>\1</i>", value)
    for index, (label, url) in enumerate(links):
        replacement = f'<link href="{html.escape(url, quote=True)}" color="#246BCE">{html.escape(label)}</link>'
        value = value.replace(f"@@LINK{index}@@", replacement)
    return value


def make_styles() -> dict[str, ParagraphStyle]:
    base = getSampleStyleSheet()
    return {
        "cover_title": ParagraphStyle(
            "CoverTitle", parent=base["Title"], fontName="FTS-Bold", fontSize=25,
            leading=30, textColor=NAVY, alignment=TA_LEFT, spaceAfter=10 * mm,
        ),
        "cover_subtitle": ParagraphStyle(
            "CoverSubtitle", parent=base["Normal"], fontName="FTS", fontSize=13,
            leading=19, textColor=MUTED, alignment=TA_LEFT,
        ),
        "h1": ParagraphStyle(
            "H1", parent=base["Heading1"], fontName="FTS-Bold", fontSize=17,
            leading=21, textColor=NAVY, spaceBefore=8 * mm, spaceAfter=4 * mm,
            keepWithNext=True,
        ),
        "h2": ParagraphStyle(
            "H2", parent=base["Heading2"], fontName="FTS-Bold", fontSize=13,
            leading=16, textColor=BLUE, spaceBefore=5 * mm, spaceAfter=2.5 * mm,
            keepWithNext=True,
        ),
        "h3": ParagraphStyle(
            "H3", parent=base["Heading3"], fontName="FTS-Bold", fontSize=11,
            leading=14, textColor=INK, spaceBefore=4 * mm, spaceAfter=2 * mm,
            keepWithNext=True,
        ),
        "body": ParagraphStyle(
            "Body", parent=base["BodyText"], fontName="FTS", fontSize=9.4,
            leading=13.3, textColor=INK, alignment=TA_JUSTIFY, spaceAfter=2.4 * mm,
        ),
        "bullet": ParagraphStyle(
            "Bullet", parent=base["BodyText"], fontName="FTS", fontSize=9.0,
            leading=11.8, textColor=INK, leftIndent=6 * mm, firstLineIndent=-3.5 * mm,
            bulletIndent=1 * mm, spaceAfter=0.7 * mm,
        ),
        "quote": ParagraphStyle(
            "Quote", parent=base["BodyText"], fontName="FTS-Italic", fontSize=9.2,
            leading=13.2, textColor=NAVY, leftIndent=7 * mm, rightIndent=5 * mm,
            borderColor=BLUE, borderWidth=1.5, borderPadding=4 * mm,
            backColor=PALE, spaceBefore=5 * mm, spaceAfter=6 * mm,
        ),
        "code": ParagraphStyle(
            "Code", parent=base["Code"], fontName="FTS-Mono", fontSize=7.4,
            leading=10, textColor=INK, leftIndent=3 * mm, rightIndent=3 * mm,
            borderColor=RULE, borderWidth=0.5, borderPadding=3 * mm,
            backColor=colors.HexColor("#F7F9FC"), spaceBefore=2 * mm, spaceAfter=3 * mm,
        ),
        "meta": ParagraphStyle(
            "Meta", parent=base["BodyText"], fontName="FTS-Bold", fontSize=9.2,
            leading=13, textColor=WARNING, borderColor=colors.HexColor("#E5B59B"),
            borderWidth=0.7, borderPadding=3 * mm, backColor=colors.HexColor("#FFF6F0"),
            spaceAfter=4 * mm,
        ),
        "small": ParagraphStyle(
            "Small", parent=base["BodyText"], fontName="FTS", fontSize=8,
            leading=11, textColor=MUTED,
        ),
    }


def markdown_flowables(path: Path, styles: dict[str, ParagraphStyle], skip_title: bool = False):
    lines = path.read_text(encoding="utf-8").splitlines()
    story = []
    paragraph: list[str] = []
    code: list[str] = []
    quote: list[str] = []
    in_code = False
    title_skipped = False

    def flush_paragraph() -> None:
        if paragraph:
            story.append(Paragraph(inline_markup(" ".join(part.strip() for part in paragraph)), styles["body"]))
            paragraph.clear()

    def flush_quote() -> None:
        if quote:
            story.append(Paragraph(inline_markup(" ".join(part.strip() for part in quote)), styles["quote"]))
            quote.clear()

    for raw in lines:
        line = normalize_punctuation(raw.rstrip())
        if line.startswith("```"):
            flush_paragraph()
            flush_quote()
            if in_code:
                story.append(Preformatted("\n".join(code), styles["code"], maxLineLength=88))
                code.clear()
            in_code = not in_code
            continue
        if in_code:
            code.append(line)
            continue
        if not line.strip():
            flush_paragraph()
            flush_quote()
            continue
        if line.startswith("# "):
            flush_paragraph()
            if skip_title and not title_skipped:
                title_skipped = True
                continue
            story.append(Paragraph(inline_markup(line[2:]), styles["h1"]))
            continue
        if line.startswith("## "):
            flush_paragraph()
            story.append(Paragraph(inline_markup(line[3:]), styles["h2"]))
            continue
        if line.startswith("### "):
            flush_paragraph()
            story.append(Paragraph(inline_markup(line[4:]), styles["h3"]))
            continue
        if line.startswith("> "):
            flush_paragraph()
            quote.append(line[2:])
            continue
        flush_quote()
        list_match = re.match(r"^(-|\d+\.)\s+(.*)$", line)
        if list_match:
            flush_paragraph()
            marker, content = list_match.groups()
            bullet = "•" if marker == "-" else marker
            story.append(Paragraph(inline_markup(content), styles["bullet"], bulletText=bullet))
            continue
        if line.startswith("**Статус:**"):
            flush_paragraph()
            story.append(Paragraph(inline_markup(line), styles["meta"]))
            continue
        paragraph.append(line)
    flush_paragraph()
    flush_quote()
    if code:
        story.append(Preformatted("\n".join(code), styles["code"], maxLineLength=88))
    return story


class ResearchDoc(BaseDocTemplate):
    def __init__(self, filename: str):
        super().__init__(
            filename,
            pagesize=A4,
            leftMargin=22 * mm,
            rightMargin=20 * mm,
            topMargin=21 * mm,
            bottomMargin=20 * mm,
            title="FTS: формальная семантика и патентная основа",
            author="FTS research project",
            subject="Confidential research preprint and patent technical disclosure",
        )
        frame = Frame(self.leftMargin, self.bottomMargin, self.width, self.height, id="body")
        self.addPageTemplates(PageTemplate(id="research", frames=[frame], onPage=self.decorate))

    def decorate(self, canvas, doc) -> None:
        canvas.saveState()
        width, height = A4
        canvas.setStrokeColor(RULE)
        canvas.setLineWidth(0.5)
        canvas.line(22 * mm, height - 13 * mm, width - 20 * mm, height - 13 * mm)
        canvas.setFont("FTS-Bold", 7.4)
        canvas.setFillColor(NAVY)
        canvas.drawString(22 * mm, height - 10 * mm, "FTS / CONFIDENTIAL RESEARCH DRAFT")
        canvas.setFont("FTS", 7.4)
        canvas.setFillColor(MUTED)
        canvas.drawRightString(width - 20 * mm, 10 * mm, f"{doc.page}")
        canvas.drawString(22 * mm, 10 * mm, "Generated from version-controlled research sources")
        canvas.restoreState()


def build() -> Path:
    register_fonts()
    styles = make_styles()
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    doc = ResearchDoc(str(OUTPUT))

    story = [Spacer(1, 23 * mm)]
    story.append(Paragraph("FTS", styles["cover_title"]))
    story.append(Paragraph("Формальная семантика, проверяемые сертификаты и патентная техническая основа", styles["cover_title"]))
    story.append(Paragraph("Конфиденциальный исследовательский препринт", styles["cover_subtitle"]))
    story.append(Spacer(1, 12 * mm))
    story.append(Paragraph(
        "Документ объединяет формальную модель, доказательства метасвойств, ограничения результата, "
        "фальсифицируемый тестовый протокол и техническое раскрытие для последующего патентного исследования.",
        styles["cover_subtitle"],
    ))
    story.append(Spacer(1, 30 * mm))
    story.append(KeepTogether([
        Paragraph("НЕ ПУБЛИКОВАТЬ ДО ФИКСАЦИИ ПАТЕНТНОЙ СТРАТЕГИИ И ПРИОРИТЕТА", styles["meta"]),
        Paragraph(f"Редакция: {date.today().isoformat()}<br/>Ядро сертификата: fts-proof/1", styles["small"]),
    ]))
    story.append(PageBreak())

    story.extend(markdown_flowables(SOURCES[0], styles, skip_title=True))
    story.append(PageBreak())
    story.append(Paragraph("Приложение A. Патентная техническая основа", styles["h1"]))
    story.extend(markdown_flowables(SOURCES[1], styles, skip_title=True))

    doc.build(story)
    return OUTPUT


if __name__ == "__main__":
    print(build())

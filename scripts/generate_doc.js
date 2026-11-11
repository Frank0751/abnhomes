/**
 * ABN Homes — Platform Build Documentation (.docx)
 *
 * Skill compliance: R1 cover recipe + DS-1 palette, 3-section architecture
 * (cover / TOC / body), English report profile (Times New Roman, pure black
 * body, left-aligned, 1.3x spacing), TOC field + refresh hint + PageBreak,
 * horizontal-only tables with DS-1 table tokens, figures with captions.
 */
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  ImageRun, PageBreak, Header, Footer, PageNumber, NumberFormat,
  AlignmentType, HeadingLevel, WidthType, BorderStyle, ShadingType,
  SectionType, TableLayoutType, TableOfContents,
} = require("docx");
const fs = require("fs");
const CONTENT = require("./doc_content.js");

// ── palette (DS-1 Deep Sea — matches ABN brand navy/teal) ──────────────────
const P = {
  bg: "0B1C2C", accent: "529286", ink: "0B1C2C",
  cover: { titleColor: "FFFFFF", subtitleColor: "B0B8C0", metaColor: "90989F", footerColor: "687078" },
  table: { headerBg: "529286", headerText: "FFFFFF", innerLine: "BECFCC", surface: "E8ECEB" },
};
const NB = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const noBorders = { top: NB, bottom: NB, left: NB, right: NB };
const allNoBorders = { top: NB, bottom: NB, left: NB, right: NB, insideHorizontal: NB, insideVertical: NB };
const FONT = { ascii: "Times New Roman", eastAsia: "SimSun" };

// ── cover layout helpers (design-system.md, verbatim behaviour) ────────────
function splitTitleLines(title, charsPerLine) {
  if (title.length <= charsPerLine) return [title];
  const breakAfter = new Set([..."，。、；：！？", ..."的与和及之在于为", ..."-_—–·/", ..." \t"]);
  const lines = [];
  let remaining = title;
  while (remaining.length > charsPerLine) {
    let breakAt = -1;
    for (let i = charsPerLine; i >= Math.floor(charsPerLine * 0.6); i--) {
      if (i < remaining.length && breakAfter.has(remaining[i - 1])) { breakAt = i; break; }
    }
    if (breakAt === -1) {
      const limit = Math.min(remaining.length, Math.ceil(charsPerLine * 1.3));
      for (let i = charsPerLine + 1; i < limit; i++) {
        if (breakAfter.has(remaining[i - 1])) { breakAt = i; break; }
      }
    }
    if (breakAt === -1) breakAt = charsPerLine;
    lines.push(remaining.slice(0, breakAt).trim());
    remaining = remaining.slice(breakAt).trim();
  }
  if (remaining) lines.push(remaining);
  if (lines.length > 1 && lines[lines.length - 1].length <= 2) {
    const last = lines.pop();
    lines[lines.length - 1] += last;
  }
  return lines;
}

function calcTitleLayout(title, maxWidthTwips, preferredPt = 40, minPt = 24) {
  // English title: average glyph ≈ pt * 11 twips (per estimateTextWidth)
  const charsPerLine = (pt) => Math.floor(maxWidthTwips / (pt * 11));
  let titlePt = preferredPt, lines;
  while (titlePt >= minPt) {
    const cpl = charsPerLine(titlePt);
    if (cpl < 2) { titlePt -= 2; continue; }
    lines = splitTitleLines(title, cpl);
    if (lines.length <= 3) break;
    titlePt -= 2;
  }
  if (!lines || lines.length > 3) { lines = splitTitleLines(title, charsPerLine(minPt)); titlePt = minPt; }
  return { titlePt, titleLines: lines };
}

function calcCoverSpacing(params) {
  const { titleLineCount = 1, titlePt = 36, hasSubtitle = false, hasEnglishLabel = false,
    metaLineCount = 0, fixedHeight = 800, pageHeight = 16838 } = params;
  const SAFETY = 1200;
  const usableHeight = pageHeight - SAFETY;
  const titleHeight = titleLineCount * (titlePt * 23 + 200);
  const subtitleHeight = hasSubtitle ? (12 * 23 + 600) : 0;
  const englishLabelHeight = hasEnglishLabel ? (9 * 23 + 600) : 0;
  const metaHeight = metaLineCount * (10 * 23 + 100);
  const implicitParaHeight = 3 * 300;
  const contentHeight = titleHeight + subtitleHeight + englishLabelHeight + metaHeight + fixedHeight + implicitParaHeight;
  const remainingSpace = usableHeight - contentHeight;
  const safeRemaining = Math.max(remainingSpace, 400);
  const FOOTER_MIN = 800;
  const rawTop = Math.floor(safeRemaining * 0.45);
  const rawBottom = Math.floor(safeRemaining * 0.45);
  const bottomSpacing = Math.max(rawBottom, FOOTER_MIN);
  const topSpacing = Math.max(rawTop - Math.max(0, FOOTER_MIN - rawBottom), 400);
  return { topSpacing, midSpacing: Math.max(safeRemaining - topSpacing - bottomSpacing, 0), bottomSpacing };
}

// ── Recipe R1: Pure Paragraph Cover (left-aligned) ─────────────────────────
function buildCoverR1(config) {
  const C = P.cover;
  const padL = 1200, padR = 800;
  const availableWidth = 11906 - padL - padR - 300;
  const { titlePt, titleLines } = calcTitleLayout(config.title, availableWidth, 40, 24);
  const titleSize = titlePt * 2;
  const spacing = calcCoverSpacing({
    titleLineCount: titleLines.length, titlePt,
    hasSubtitle: !!config.subtitle, hasEnglishLabel: !!config.englishLabel,
    metaLineCount: (config.metaLines || []).length, fixedHeight: 400,
  });
  const accentLeft = { style: BorderStyle.SINGLE, size: 8, color: P.accent, space: 12 };
  const children = [];
  children.push(new Paragraph({ spacing: { before: spacing.topSpacing } }));
  if (config.englishLabel) {
    children.push(new Paragraph({
      indent: { left: padL, right: padR }, spacing: { after: 500 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: P.accent, space: 8 } },
      children: [new TextRun({ text: config.englishLabel.split("").join("  "), size: 18, color: P.accent, font: { ascii: "Arial", eastAsia: "SimHei" }, characterSpacing: 40 })],
    }));
  }
  for (let i = 0; i < titleLines.length; i++) {
    children.push(new Paragraph({
      indent: { left: padL },
      spacing: { after: i < titleLines.length - 1 ? 100 : 300, line: Math.ceil(titlePt * 23), lineRule: "atLeast" },
      children: [new TextRun({ text: titleLines[i], size: titleSize, bold: true, color: C.titleColor, font: { eastAsia: "SimHei", ascii: "Arial" } })],
    }));
  }
  if (config.subtitle) {
    children.push(new Paragraph({
      indent: { left: padL, right: padR }, spacing: { after: 800, line: 312 },
      children: [new TextRun({ text: config.subtitle, size: 24, color: C.subtitleColor, font: { eastAsia: "Microsoft YaHei", ascii: "Arial" } })],
    }));
  }
  for (const line of (config.metaLines || [])) {
    children.push(new Paragraph({
      indent: { left: padL + 200 }, spacing: { after: 80 },
      border: { left: accentLeft },
      children: [new TextRun({ text: line, size: 24, color: C.metaColor, font: { eastAsia: "Microsoft YaHei", ascii: "Arial" } })],
    }));
  }
  children.push(new Paragraph({ spacing: { before: spacing.bottomSpacing } }));
  children.push(new Paragraph({
    indent: { left: padL, right: padR },
    border: { top: { style: BorderStyle.SINGLE, size: 2, color: P.accent, space: 8 } },
    spacing: { before: 200 },
    children: [
      new TextRun({ text: config.footerLeft || "", size: 16, color: C.footerColor, font: { ascii: "Arial" } }),
      new TextRun({ text: "                                        " }),
      new TextRun({ text: config.footerRight || "", size: 16, color: C.footerColor, font: { ascii: "Arial" } }),
    ],
  }));
  return [new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    borders: allNoBorders,
    rows: [new TableRow({
      height: { value: 16838, rule: "exact" },
      children: [new TableCell({ shading: { type: ShadingType.CLEAR, fill: P.bg }, borders: noBorders, children })],
    })],
  })];
}

// ── body builders (English report profile) ─────────────────────────────────
function heading(level, text) {
  const H = { 1: HeadingLevel.HEADING_1, 2: HeadingLevel.HEADING_2, 3: HeadingLevel.HEADING_3 }[level];
  return new Paragraph({
    heading: H,
    spacing: { before: level === 1 ? 360 : 240, after: level === 1 ? 160 : 120, line: 312 },
    children: [new TextRun({ text, bold: true, color: P.ink, font: FONT })],
  });
}

function body(text, opts = {}) {
  // **bold** inline emphasis support
  const runs = [];
  for (const part of String(text).split(/\*\*/)) {
    if (!part) continue;
    runs.push(new TextRun({ text: part, size: 24, color: "000000", font: FONT, bold: runs.length % 2 === 1 }));
  }
  return new Paragraph({
    alignment: AlignmentType.LEFT,
    spacing: { line: 312, after: opts.after ?? 120 },
    children: runs,
  });
}

function bullet(text) {
  return new Paragraph({
    bullet: { level: 0 },
    spacing: { line: 312, after: 60 },
    children: [new TextRun({ text, size: 24, color: "000000", font: FONT })],
  });
}

function numbered(reference, text) {
  return new Paragraph({
    numbering: { reference, level: 0 },
    spacing: { line: 312, after: 80 },
    children: [new TextRun({ text, size: 24, color: "000000", font: FONT })],
  });
}

function figure(fileName, caption, figNo) {
  const data = fs.readFileSync(`/home/z/my-project/download/slides/${fileName}`);
  // All captures are 2560x1440 (2x DPR of 1280x720) — fixed aspect ratio.
  const width = 556, height = Math.round(556 * 1440 / 2560);
  return [
    new Paragraph({
      alignment: AlignmentType.CENTER, spacing: { before: 120, after: 60 }, keepNext: true,
      children: [new ImageRun({ data, transformation: { width, height }, type: "png" })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER, spacing: { after: 160, line: 312 },
      children: [new TextRun({ text: `Figure ${figNo}: ${caption}`, size: 18, color: "808080", font: FONT, italics: true })],
    }),
  ];
}

function dataTable(caption, tableNo, headers, rows, widths) {
  const cell = (text, isHeader, w) => new TableCell({
    width: { size: w, type: WidthType.PERCENTAGE },
    shading: isHeader ? { type: ShadingType.CLEAR, fill: P.table.headerBg } : undefined,
    margins: { top: 60, bottom: 60, left: 120, right: 120 },
    children: [new Paragraph({
      spacing: { line: 312 },
      children: [new TextRun({ text, size: 20, bold: isHeader, color: isHeader ? P.table.headerText : "000000", font: FONT })],
    })],
  });
  return [
    new Paragraph({
      keepNext: true, spacing: { before: 160, after: 80, line: 312 },
      children: [new TextRun({ text: `Table ${tableNo}: ${caption}`, bold: true, size: 21, color: P.ink, font: FONT })],
    }),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: {
        top: { style: BorderStyle.SINGLE, size: 2, color: P.accent },
        bottom: { style: BorderStyle.SINGLE, size: 2, color: P.accent },
        left: NB, right: NB,
        insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: P.table.innerLine },
        insideVertical: NB,
      },
      rows: [
        new TableRow({ tableHeader: true, cantSplit: true, children: headers.map((h, i) => cell(h, true, widths[i])) }),
        ...rows.map((r) => new TableRow({ cantSplit: true, children: r.map((c, i) => cell(c, false, widths[i])) })),
      ],
    }),
    new Paragraph({ spacing: { after: 120 }, children: [] }),
  ];
}

// ── assemble body from content model ───────────────────────────────────────
const numberingConfigs = [];
function renderBlocks(blocks) {
  const out = [];
  for (const b of blocks) {
    if (b.t === "h1") out.push(heading(1, b.x));
    else if (b.t === "h2") out.push(heading(2, b.x));
    else if (b.t === "h3") out.push(heading(3, b.x));
    else if (b.t === "p") out.push(body(b.x));
    else if (b.t === "bullets") b.x.forEach((s) => out.push(bullet(s)));
    else if (b.t === "list") {
      numberingConfigs.push({
        reference: b.ref,
        levels: [{ level: 0, format: "decimal", text: "%1.", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }],
      });
      b.x.forEach((s) => out.push(numbered(b.ref, s)));
    } else if (b.t === "fig") out.push(...figure(b.file, b.cap, b.n));
    else if (b.t === "table") out.push(...dataTable(b.cap, b.n, b.headers, b.rows, b.widths));
  }
  return out;
}

const bodyChildren = renderBlocks(CONTENT.blocks);

// ── footers / headers ──────────────────────────────────────────────────────
const pageFooter = () => new Footer({
  children: [new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ children: [PageNumber.CURRENT], size: 18, color: "808080", font: FONT })],
  })],
});
const bodyHeader = () => new Header({
  children: [new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: "ABN Homes — Platform Build Documentation", size: 18, color: "808080", font: FONT })],
  })],
});

const pgSize = { width: 11906, height: 16838 };
const pgMargin = { top: 1440, bottom: 1440, left: 1701, right: 1417 };

const doc = new Document({
  styles: {
    default: {
      document: { run: { font: FONT, size: 24, color: "000000" }, paragraph: { spacing: { line: 312 } } },
      heading1: { run: { font: FONT, size: 32, bold: true, color: P.ink }, paragraph: { spacing: { before: 360, after: 160, line: 312 }, outlineLevel: 0 } },
      heading2: { run: { font: FONT, size: 28, bold: true, color: P.ink }, paragraph: { spacing: { before: 240, after: 120, line: 312 }, outlineLevel: 1 } },
      heading3: { run: { font: FONT, size: 24, bold: true, color: P.ink }, paragraph: { spacing: { before: 200, after: 100, line: 312 }, outlineLevel: 2 } },
    },
  },
  numbering: { config: numberingConfigs },
  sections: [
    { // 1. cover — margin 0, no footer, no page number
      properties: { page: { size: pgSize, margin: { top: 0, bottom: 0, left: 0, right: 0 } } },
      children: buildCoverR1({
        title: "ABN Homes Operations Platform",
        subtitle: "Complete build documentation — what has been built, how it works, and what comes next",
        englishLabel: "ABN HOMES",
        metaLines: [
          "Prepared for: Frank Koomson — ABN Homes",
          "Platform: abnhomes.vercel.app (live production)",
          "Date: 11 November 2026",
          "Status: Prototype live · payments and SMS in simulation mode",
        ],
        footerLeft: "ABN Homes — Accra, Ghana",
        footerRight: "November 2026",
      }),
    },
    { // 2. front matter (TOC) — no page number footer (report scene allows none)
      properties: { type: SectionType.NEXT_PAGE, page: { size: pgSize, margin: pgMargin } },
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER, spacing: { before: 480, after: 360 },
          children: [new TextRun({ text: "Table of Contents", bold: true, size: 32, font: FONT, color: P.ink })],
        }),
        new TableOfContents("Table of Contents", { hyperlink: true, headingStyleRange: "1-3" }),
        new Paragraph({
          spacing: { before: 200 },
          children: [new TextRun({
            text: "Note: This Table of Contents is generated via field codes. To ensure page number accuracy after editing, please right-click the TOC and select \"Update Field.\"",
            italics: true, size: 18, color: "888888", font: FONT,
          })],
        }),
        // No trailing PageBreak: the body section's NEXT_PAGE break paginates.
      ],
    },
    { // 3. body — Arabic from 1
      properties: {
        type: SectionType.NEXT_PAGE,
        page: { size: pgSize, margin: pgMargin, pageNumbers: { start: 1, formatType: NumberFormat.DECIMAL } },
      },
      headers: { default: bodyHeader() },
      footers: { default: pageFooter() },
      children: bodyChildren,
    },
  ],
});

Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync("/home/z/my-project/download/ABN-Homes-Platform-Documentation.docx", buf);
  console.log("docx written:", buf.length, "bytes");
});

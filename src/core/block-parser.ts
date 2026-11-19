import type {
  BlockNode,
  HeadingNode,
  ParagraphNode,
  HorizontalRuleNode,
  CodeBlockNode,
  BlockquoteNode,
  BulletListNode,
  OrderedListNode,
  ListItemNode,
  TableNode,
  TableCellNode,
  TableAlignment,
  LinkDef,
  Document,
  ParseContext,
} from "./types.js";
import { parseInline, unescapeBackslashes } from "./inline-parser.js";

// ============================================================
// Helpers
// ============================================================

function trimTrailingSpaces(lines: string[]): string[] {
  return lines.map((l) => l.trimEnd());
}

function isBlankLine(line: string): boolean {
  return line.trim() === "";
}

/** Returns true if line is a horizontal rule (---, ***, with optional spaces) */
function isHorizontalRule(line: string): boolean {
  return /^\s*(-\s*){3,}$/.test(line) || /^\s*(\*\s*){3,}$/.test(line);
}

/** Returns heading level, content, and optional anchor id, or null */
function matchHeading(line: string): { level: number; text: string; id?: string } | null {
  const m = line.match(/^(#{1,6})\s+(.+?)(\s+#+\s*)?$/);
  if (!m) return null;
  const raw = m[2].trimEnd();
  const idMatch = raw.match(/^(.*?)\s*\{#([^}]+)\}\s*$/);
  if (idMatch) {
    return { level: m[1].length, text: idMatch[1].trimEnd(), id: idMatch[2] };
  }
  return { level: m[1].length, text: raw };
}

/** Returns code fence info (marker + language + filename) or null */
function matchCodeFence(
  line: string
): { marker: string; language?: string; filename?: string } | null {
  const m = line.match(/^(`{3,}|~{3,})([\w+-]*)(?::(.+))?/);
  if (!m) return null;
  return {
    marker: m[1],
    language: m[2] || undefined,
    filename: m[3] || undefined,
  };
}

/** spec: Code Blocks — a closing fence repeats the opening character at least as many times */
function isClosingFence(line: string, openingMarker: string): boolean {
  return line.length >= openingMarker.length && line === openingMarker[0].repeat(line.length);
}

/** Returns the `>` stripped prefix lines for a blockquote block */
function stripBlockquotePrefix(lines: string[]): string[] {
  return lines.map((l) => l.replace(/^>\s?/, ""));
}

/** Returns list item info if line starts a list item */
function matchListItem(line: string): {
  indent: number;
  marker: "bullet" | "ordered";
  start?: number;
  checked?: boolean;
  textStart: number;
  text: string;
} | null {
  // Bullet list
  const bulletM = line.match(/^(\s*)([-*+])\s+(.*)/);
  if (bulletM) {
    const indent = bulletM[1].length;
    const textStart = indent + 2; // marker + space
    let text = bulletM[3];
    let checked: boolean | undefined;

    // Checklist
    const checkM = text.match(/^\[([ xX])\]\s+(.*)/);
    if (checkM) {
      checked = checkM[1] !== " ";
      text = checkM[2];
    }
    return { indent, marker: "bullet", checked, textStart, text };
  }

  // Ordered list (but not `N\.`)
  const orderedM = line.match(/^(\s*)(\d+)\.\s+(.*)/);
  if (orderedM) {
    // Escaped: `N\.` → not a list (handled before calling this)
    const indent = orderedM[1].length;
    const start = parseInt(orderedM[2], 10);
    const textStart = indent + orderedM[2].length + 2;
    let text = orderedM[3];
    let checked: boolean | undefined;
    const checkM = text.match(/^\[([ xX])\]\s+(.*)/);
    if (checkM) {
      checked = checkM[1] !== " ";
      text = checkM[2];
    }
    return { indent, marker: "ordered", start, checked, textStart, text };
  }

  return null;
}

function codeSpanEnd(text: string, start: number): number {
  let runLength = 0;
  while (text[start + runLength] === "`") runLength++;
  const fence = "`".repeat(runLength);
  let searchFrom = start + runLength;
  while (searchFrom < text.length) {
    const closeIndex = text.indexOf(fence, searchFrom);
    if (closeIndex === -1) break;
    let closeLength = 0;
    while (text[closeIndex + closeLength] === "`") closeLength++;
    if (closeLength === runLength) return closeIndex + runLength;
    searchFrom = closeIndex + closeLength;
  }
  return start + runLength;
}

/** Parse `| a | b | c |` into cell strings (strips leading/trailing `|`).
 *  Does not split on `|` inside backtick code spans or on escaped `\|`. */
function splitTableRow(line: string): string[] {
  const stripped = line.replace(/^\s*~?\s*\|?/, "").trim();
  const cells: string[] = [];
  let cur = "";
  let endsWithSeparator = false;
  for (let i = 0; i < stripped.length; i++) {
    const ch = stripped[i];
    endsWithSeparator = false;
    if (ch === "`") {
      const end = codeSpanEnd(stripped, i);
      cur += stripped.slice(i, end);
      i = end - 1;
    }
    else if (ch === "\\" && i + 1 < stripped.length) { cur += ch + stripped[i + 1]; i++; }
    else if (ch === "|") { cells.push(cur.trim()); cur = ""; endsWithSeparator = true; }
    else { cur += ch; }
  }
  if (!endsWithSeparator) cells.push(cur.trim());
  return cells;
}

/** Parse alignment row cell like `---`, `:---`, `:---:`, `---:` */
function parseAlignment(cell: string): TableAlignment {
  const c = cell.trim();
  const left = c.startsWith(":");
  const right = c.endsWith(":");
  if (left && right) return "center";
  if (left) return "left";
  if (right) return "right";
  return "default";
}

function isAlignmentRow(line: string): boolean {
  const cells = splitTableRow(line);
  return cells.length > 0 && cells.every((c) => /^:?-+:?$/.test(c));
}

const MERGE_LEFT_MARKER = "<<";
const MERGE_UP_MARKER = "^^";

type CellPosition = { row: number; column: number };

type MergedSpan = { colspan: number; rowspan: number };

/**
 * spec: テーブル - セルの結合
 * Assigns every slot of the grid to the origin cell it belongs to.
 * `<<` follows the origin of the slot on its left and `^^` follows the
 * origin of the slot above. Markers without a neighbor are origins
 * themselves. Slots that share an origin share the same object.
 */
function assignOrigins(grid: string[][]): CellPosition[][] {
  const origins: CellPosition[][] = [];
  grid.forEach((cells, row) => {
    const rowOrigins: CellPosition[] = [];
    cells.forEach((cell, column) => {
      if (cell === MERGE_LEFT_MARKER && column > 0) {
        rowOrigins.push(rowOrigins[column - 1]);
      } else if (cell === MERGE_UP_MARKER && row > 0) {
        rowOrigins.push(origins[row - 1][column]);
      } else {
        rowOrigins.push({ row, column });
      }
    });
    origins.push(rowOrigins);
  });
  return origins;
}

/**
 * spec: テーブル - セルの結合
 * Shrinks a merged region until it is a rectangle by turning its last
 * marker in reading order back into plain text. No other slot depends on
 * that marker, because any slot that follows it would come later in
 * reading order. `slots` must be in reading order, starting at the origin.
 */
function shrinkToRectangle(
  origin: CellPosition,
  slots: CellPosition[],
  origins: CellPosition[][]
): MergedSpan {
  const slotCountByColumn: number[] = [];
  let lastColumn = origin.column;
  for (const slot of slots) {
    slotCountByColumn[slot.column] = (slotCountByColumn[slot.column] ?? 0) + 1;
    lastColumn = Math.max(lastColumn, slot.column);
  }
  for (;;) {
    const lastRow = slots[slots.length - 1].row;
    const span = {
      colspan: lastColumn - origin.column + 1,
      rowspan: lastRow - origin.row + 1,
    };
    if (slots.length === span.colspan * span.rowspan) return span;
    const literalSlot = slots.pop()!;
    origins[literalSlot.row][literalSlot.column] = literalSlot;
    slotCountByColumn[literalSlot.column]--;
    while (slotCountByColumn[lastColumn] === 0) lastColumn--;
  }
}

/**
 * spec: テーブル - セルの結合
 * Converts a grid of raw cell strings into rows of origin cells with
 * colspan/rowspan. Slots covered by a merge are omitted from the rows.
 */
function buildMergedRows(grid: string[][], ctx: ParseContext): TableCellNode[][] {
  const origins = assignOrigins(grid);
  const slotsByOrigin = new Map<CellPosition, CellPosition[]>();
  origins.forEach((rowOrigins, row) => {
    rowOrigins.forEach((origin, column) => {
      const slots = slotsByOrigin.get(origin) ?? [];
      slots.push({ row, column });
      slotsByOrigin.set(origin, slots);
    });
  });

  const spanByOrigin = new Map<CellPosition, MergedSpan>();
  for (const [origin, slots] of slotsByOrigin) {
    spanByOrigin.set(origin, shrinkToRectangle(origin, slots, origins));
  }

  return grid.map((cells, row) =>
    cells.flatMap((cell, column): TableCellNode[] => {
      const origin = origins[row][column];
      if (origin.row !== row || origin.column !== column) return [];
      const { colspan, rowspan } = spanByOrigin.get(origin) ?? { colspan: 1, rowspan: 1 };
      return [{
        children: parseInline(cell, ctx),
        ...(colspan > 1 && { colspan }),
        ...(rowspan > 1 && { rowspan }),
      }];
    })
  );
}

// ============================================================
// Pre-scan: collect definitions
// ============================================================

const LINK_DEF_RE =
  /^\[([^\]]+)\]:\s+(\S+)(?:\s+(?:"((?:[^"\\]|\\.)+)"|'((?:[^'\\]|\\.)+)'|\(((?:[^)\\]|\\.)+)\)))?/;
const FOOTNOTE_DEF_RE = /^\[\^([^\]\s]+)\]:\s*(.*)/;

interface Definitions {
  linkDefs: Record<string, LinkDef>;
  rawFootnoteDefs: Record<string, string>;
}

function collectDefinitions(lines: string[]): Definitions {
  const linkDefs: Record<string, LinkDef> = {};
  const rawFootnoteDefs: Record<string, string> = {};

  for (const line of lines) {
    // Footnote defs must be checked before link defs:
    // [^id]: text also matches LINK_DEF_RE (id='^id', href='text')
    const fm = line.match(FOOTNOTE_DEF_RE);
    if (fm) {
      rawFootnoteDefs[fm[1]] = fm[2];
      continue;
    }
    const lm = line.match(LINK_DEF_RE);
    if (lm) {
      const id = lm[1].toLowerCase();
      const title = lm[3] ?? lm[4] ?? lm[5];
      linkDefs[id] = {
        href: unescapeBackslashes(lm[2]),
        title: title === undefined ? undefined : unescapeBackslashes(title),
      };
      continue;
    }
  }

  return { linkDefs, rawFootnoteDefs };
}

/** Remove link/footnote definition lines from the content. */
function removeDefinitionLines(lines: string[]): string[] {
  return lines.filter((l) => !LINK_DEF_RE.test(l) && !FOOTNOTE_DEF_RE.test(l));
}

// ============================================================
// Custom blocks (:::header, :::footer, :::details, :::warp)
// ============================================================

/**
 * spec: Lobster Extensions — where `:::` blocks are recognized.
 * "document": the top level; header/footer are recorded for the page.
 * "container": inside another `:::` block; nested header/footer are dropped.
 * "quote": inside a blockquote; `:::` lines are plain text.
 */
type BlockScope = "document" | "container" | "quote";

type ContainerOpener =
  | { kind: "header" }
  | { kind: "footer" }
  | { kind: "details"; title: string }
  | { kind: "warp"; id: string };

function matchContainerOpener(line: string): ContainerOpener | null {
  if (/^:::header\s*$/.test(line)) return { kind: "header" };
  if (/^:::footer\s*$/.test(line)) return { kind: "footer" };
  const detailsMatch = line.match(/^:::details\s+(.*?)\s*$/);
  if (detailsMatch) return { kind: "details", title: detailsMatch[1] };
  const warpMatch = line.match(/^:::warp\s+(\S+)\s*$/);
  if (warpMatch) return { kind: "warp", id: warpMatch[1] };
  return null;
}

function isContainerCloser(line: string): boolean {
  return /^\s*:::\s*$/.test(line);
}

/**
 * spec: Lobster Extensions — a `:::` block ends at the `:::` line that matches
 * its opener. Nested openers and fenced code are skipped, but a fence that is
 * never closed inside the block does not hide the closing `:::` (the code block
 * then ends with the `:::` block). Returns `lines.length` when the block is
 * never closed.
 */
function findContainerEnd(lines: string[], openerIndex: number): number {
  const unclosedFenceLines = new Set<number>();
  for (;;) {
    let depth = 0;
    let openFence: { marker: string; line: number } | null = null;
    for (let i = openerIndex + 1; i < lines.length; i++) {
      const line = lines[i];
      if (openFence !== null) {
        if (isClosingFence(line, openFence.marker)) openFence = null;
        continue;
      }
      const fence = unclosedFenceLines.has(i) ? null : matchCodeFence(line);
      if (fence) {
        openFence = { marker: fence.marker, line: i };
      } else if (matchContainerOpener(line)) {
        depth++;
      } else if (isContainerCloser(line)) {
        if (depth === 0) return i;
        depth--;
      }
    }
    if (openFence === null) return lines.length;
    unclosedFenceLines.add(openFence.line);
  }
}

function tryParseContainer(
  lines: string[],
  i: number,
  ctx: ParseContext,
  scope: BlockScope
): ContainerParseResult | null {
  if (scope === "quote") return null;
  const opener = matchContainerOpener(lines[i]);
  if (!opener) return null;

  const end = findContainerEnd(lines, i);
  const children = parseBlocks(lines.slice(i + 1, end), ctx, "container");
  const nextIndex = end + 1;

  switch (opener.kind) {
    case "header":
      if (scope === "document") ctx.header = { type: "header_container", children };
      return { node: null, nextIndex };
    case "footer":
      if (scope === "document") ctx.footer = { type: "footer_container", children };
      return { node: null, nextIndex };
    case "warp":
      ctx.warpDefs[opener.id] = { type: "warp_definition", id: opener.id, children };
      return { node: null, nextIndex };
    case "details":
      return { node: { type: "details", title: opener.title, children }, nextIndex };
  }
}

// ============================================================
// Block parsers
// ============================================================

type ParseBlockResult = { node: BlockNode; nextIndex: number };

/** A `:::` block that is recorded elsewhere (header, footer, warp) has no node in place. */
type ContainerParseResult = { node: BlockNode | null; nextIndex: number };

function tryParseHeading(
  lines: string[],
  i: number,
  ctx: ParseContext
): ParseBlockResult | null {
  const m = matchHeading(lines[i]);
  if (!m) return null;
  const node: HeadingNode = {
    type: "heading",
    level: m.level as HeadingNode["level"],
    ...(m.id !== undefined && { id: m.id }),
    children: parseInline(m.text, ctx),
  };
  return { node, nextIndex: i + 1 };
}

function tryParseHorizontalRule(
  lines: string[],
  i: number
): ParseBlockResult | null {
  if (!isHorizontalRule(lines[i])) return null;
  const node: HorizontalRuleNode = { type: "horizontal_rule" };
  return { node, nextIndex: i + 1 };
}

function tryParseCodeBlock(
  lines: string[],
  i: number
): ParseBlockResult | null {
  const fence = matchCodeFence(lines[i]);
  if (!fence) return null;

  const codeLines: string[] = [];
  let j = i + 1;

  while (j < lines.length) {
    if (isClosingFence(lines[j], fence.marker)) {
      j++;
      break;
    }
    codeLines.push(lines[j]);
    j++;
  }

  const node: CodeBlockNode = {
    type: "code_block",
    language: fence.language,
    filename: fence.filename,
    code: codeLines.join("\n"),
  };
  return { node, nextIndex: j };
}

function tryParseBlockquote(
  lines: string[],
  i: number,
  ctx: ParseContext
): ParseBlockResult | null {
  if (!lines[i].startsWith(">")) return null;

  const bqLines: string[] = [];
  let j = i;
  while (j < lines.length && lines[j].startsWith(">")) {
    bqLines.push(lines[j]);
    j++;
  }

  const stripped = stripBlockquotePrefix(bqLines);
  const node: BlockquoteNode = {
    type: "blockquote",
    children: parseBlocks(stripped, ctx, "quote"),
  };
  return { node, nextIndex: j };
}

/**
 * Parse a run of list items (bullet or ordered) starting at line i.
 * Returns a BulletListNode or OrderedListNode at depth 0.
 */
function tryParseList(
  lines: string[],
  i: number,
  ctx: ParseContext
): ParseBlockResult | null {
  const firstItem = matchListItem(lines[i]);
  if (!firstItem) return null;

  return firstItem.marker === "bullet"
    ? parseBulletList(lines, i, 0, ctx)
    : parseOrderedList(lines, i, 0, ctx);
}

function parseBulletList(
  lines: string[],
  startI: number,
  depth: number,
  ctx: ParseContext
): ParseBlockResult {
  const items: ListItemNode[] = [];
  let i = startI;

  while (i < lines.length) {
    if (isBlankLine(lines[i])) {
      i++;
      continue;
    }

    const itemInfo = matchListItem(lines[i]);
    if (!itemInfo || itemInfo.marker !== "bullet") break;
    if (itemInfo.indent < depth) break;

    // Collect continuation lines and sub-items
    const textLines: string[] = [itemInfo.text];
    i++;

    while (i < lines.length) {
      if (isBlankLine(lines[i])) break;
      const next = matchListItem(lines[i]);
      if (next) {
        if (next.indent > itemInfo.indent) {
          // Sub-list: will be parsed below
          break;
        } else {
          break;
        }
      }
      // Continuation line: must be indented past the item's text start
      if (lines[i].match(/^\s/)) {
        textLines.push(lines[i].trimStart());
        i++;
      } else {
        break;
      }
    }

    // Check for sub-list
    let sublist: BulletListNode | OrderedListNode | undefined;
    if (i < lines.length) {
      const next = matchListItem(lines[i]);
      if (next && next.indent > itemInfo.indent) {
        const subResult =
          next.marker === "bullet"
            ? parseBulletList(lines, i, next.indent, ctx)
            : parseOrderedList(lines, i, next.indent, ctx);
        sublist = subResult.node as BulletListNode | OrderedListNode;
        i = subResult.nextIndex;
      }
    }

    items.push({
      checked: itemInfo.checked,
      children: parseInline(textLines.join(" "), ctx),
      sublist,
    });
  }

  const node: BulletListNode = { type: "bullet_list", depth, items };
  return { node, nextIndex: i };
}

function parseOrderedList(
  lines: string[],
  startI: number,
  depth: number,
  ctx: ParseContext
): ParseBlockResult {
  const items: ListItemNode[] = [];
  let i = startI;
  let start = 1;
  let firstItem = true;

  while (i < lines.length) {
    if (isBlankLine(lines[i])) {
      i++;
      continue;
    }

    const itemInfo = matchListItem(lines[i]);
    if (!itemInfo || itemInfo.marker !== "ordered") break;
    if (itemInfo.indent < depth) break;

    if (firstItem) {
      start = itemInfo.start ?? 1;
      firstItem = false;
    }

    const textLines: string[] = [itemInfo.text];
    i++;

    while (i < lines.length) {
      if (isBlankLine(lines[i])) break;
      const next = matchListItem(lines[i]);
      if (next) break;
      if (lines[i].match(/^\s/)) {
        textLines.push(lines[i].trimStart());
        i++;
      } else {
        break;
      }
    }

    let sublist: BulletListNode | OrderedListNode | undefined;
    if (i < lines.length) {
      const next = matchListItem(lines[i]);
      if (next && next.indent > itemInfo.indent) {
        const subResult =
          next.marker === "bullet"
            ? parseBulletList(lines, i, next.indent, ctx)
            : parseOrderedList(lines, i, next.indent, ctx);
        sublist = subResult.node as BulletListNode | OrderedListNode;
        i = subResult.nextIndex;
      }
    }

    items.push({
      checked: itemInfo.checked,
      children: parseInline(textLines.join(" "), ctx),
      sublist,
    });
  }

  const node: OrderedListNode = { type: "ordered_list", depth, start, items };
  return { node, nextIndex: i };
}

/**
 * Parse table (standard `| ... |` or silent `~ | ... |`).
 * spec: テーブル, サイレントテーブル
 */
function tryParseTable(
  lines: string[],
  i: number,
  ctx: ParseContext
): ParseBlockResult | null {
  const line = lines[i];
  const isSilent = /^\s*~\s+\|/.test(line) || /^\s*~\s+/.test(line);

  const isTableLine = (l: string): boolean => {
    if (isSilent) return /^\s*~\s*\|/.test(l) || /^\s*~\s+/.test(l);
    return /^\s*\|/.test(l) || l.includes("|");
  };

  if (!isTableLine(line)) return null;

  // We need at least header + alignment rows
  if (i + 1 >= lines.length) return null;
  if (!isAlignmentRow(lines[i + 1]) && !(isSilent && isAlignmentRow(lines[i + 1].replace(/^\s*~\s*/, "")))) {
    return null;
  }

  // Parse header row
  const rawHeader = isSilent ? line.replace(/^\s*~\s*/, "") : line;
  const headerCells = splitTableRow(rawHeader);
  const columnCount = headerCells.length;
  const [headers] = buildMergedRows([headerCells], ctx);

  // Parse alignment row
  const rawAlign = isSilent
    ? lines[i + 1].replace(/^\s*~\s*/, "")
    : lines[i + 1];
  const alignments: TableAlignment[] = splitTableRow(rawAlign).map(parseAlignment);

  // Parse data rows: pad short rows and drop cells beyond the header width
  const bodyGrid: string[][] = [];
  let j = i + 2;
  while (j < lines.length && isTableLine(lines[j]) && !matchContainerOpener(lines[j])) {
    const rawRow = isSilent ? lines[j].replace(/^\s*~\s*/, "") : lines[j];
    const cells = splitTableRow(rawRow).slice(0, columnCount);
    while (cells.length < columnCount) cells.push("");
    bodyGrid.push(cells);
    j++;
  }
  const rows = buildMergedRows(bodyGrid, ctx);

  const node: TableNode = {
    type: "table",
    isSilent,
    headers,
    alignments,
    rows,
  };
  return { node, nextIndex: j };
}

function startsBlockElement(line: string): boolean {
  return (
    matchHeading(line) !== null ||
    isHorizontalRule(line) ||
    matchCodeFence(line) !== null ||
    line.startsWith(">") ||
    matchListItem(line) !== null ||
    /^\s*\|/.test(line) ||
    /^\s*~\s*\|/.test(line) ||
    /^:::/.test(line)
  );
}

/**
 * Parse a paragraph: lines until blank line or block-level element.
 */
function parseParagraph(
  lines: string[],
  i: number,
  ctx: ParseContext
): ParseBlockResult {
  const textLines: string[] = [];
  let j = i;

  while (j < lines.length) {
    const line = lines[j];
    if (isBlankLine(line)) break;

    // Every block parser has already rejected the first line, so it is always
    // consumed as text (spec: Lobster Extensions — unrecognized `:::` lines).
    if (j > i && startsBlockElement(line)) break;

    textLines.push(line);
    j++;
  }

  // Join lines with \n so inline parser can emit line_break nodes
  const text = textLines.join("\n");
  const children = parseInline(text, ctx);

  // Strip trailing line_break from paragraph
  while (children.length > 0 && children[children.length - 1].type === "line_break") {
    children.pop();
  }

  const node: ParagraphNode = { type: "paragraph", children };
  return { node, nextIndex: j };
}

// ============================================================
// Main block parser
// ============================================================

export function parseBlocks(
  lines: string[],
  ctx: ParseContext,
  scope: BlockScope = "container"
): BlockNode[] {
  const nodes: BlockNode[] = [];
  const trimmed = trimTrailingSpaces(lines);
  let i = 0;

  while (i < trimmed.length) {
    if (isBlankLine(trimmed[i])) {
      i++;
      continue;
    }

    const container = tryParseContainer(trimmed, i, ctx, scope);
    if (container) {
      if (container.node) nodes.push(container.node);
      i = container.nextIndex;
      continue;
    }

    const result =
      tryParseHeading(trimmed, i, ctx) ??
      tryParseHorizontalRule(trimmed, i) ??
      tryParseCodeBlock(trimmed, i) ??
      tryParseBlockquote(trimmed, i, ctx) ??
      tryParseList(trimmed, i, ctx) ??
      tryParseTable(trimmed, i, ctx) ??
      parseParagraph(trimmed, i, ctx);

    nodes.push(result.node);
    i = result.nextIndex;
  }

  return nodes;
}

// ============================================================
// Document parser (entry point)
// ============================================================

export function parseDocument(markdown: string): Document {
  const rawLines = markdown.split("\n");
  const lines = trimTrailingSpaces(rawLines);

  // First pass: collect link/footnote definitions
  const { linkDefs, rawFootnoteDefs } = collectDefinitions(lines);
  const cleanLines = removeDefinitionLines(lines);

  // Build initial parse context (footnote defs parsed inline later)
  const ctx: ParseContext = {
    linkDefs,
    footnoteDefs: {},
    warpDefs: {},
    footnoteRefs: [],
    inlineFootnoteCount: 0,
  };

  // Parse raw footnote def texts into inline nodes
  for (const [id, text] of Object.entries(rawFootnoteDefs)) {
    ctx.footnoteDefs[id] = parseInline(text, ctx);
  }

  const body = parseBlocks(cleanLines, ctx, "document");

  return {
    header: ctx.header,
    footer: ctx.footer,
    body,
    linkDefs,
    footnoteDefs: ctx.footnoteDefs,
    footnoteRefs: ctx.footnoteRefs,
    warpDefs: ctx.warpDefs,
  };
}

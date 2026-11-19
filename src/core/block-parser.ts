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
import { codeSpanEndOrRunEnd, parseInline, unescapeBackslashes } from "./inline-parser.js";

// ============================================================
// Helpers
// ============================================================

function trimTrailingSpaces(lines: string[]): string[] {
  return lines.map((line) => line.trimEnd());
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
  const headingMatch = line.match(/^(#{1,6})\s+(.+?)(\s+#+\s*)?$/);
  if (!headingMatch) return null;
  const raw = headingMatch[2].trimEnd();
  const idMatch = raw.match(/^(.*?)\s*\{#([^}]+)\}\s*$/);
  if (idMatch) {
    return { level: headingMatch[1].length, text: idMatch[1].trimEnd(), id: idMatch[2] };
  }
  return { level: headingMatch[1].length, text: raw };
}

/** Returns code fence info (marker + language + filename) or null */
function matchCodeFence(
  line: string
): { marker: string; language?: string; filename?: string } | null {
  const fenceMatch = line.match(/^(`{3,}|~{3,})([\w+-]*)(?::(.+))?/);
  if (!fenceMatch) return null;
  return {
    marker: fenceMatch[1],
    language: fenceMatch[2] || undefined,
    filename: fenceMatch[3] || undefined,
  };
}

/** spec: Code Block — a closing fence repeats the opening character at least as many times */
function isClosingFence(line: string, openingMarker: string): boolean {
  return line.length >= openingMarker.length && line === openingMarker[0].repeat(line.length);
}

/** Returns the `>` stripped prefix lines for a blockquote block */
function stripBlockquotePrefix(lines: string[]): string[] {
  return lines.map((line) => line.replace(/^>\s?/, ""));
}

type ListMarker = "bullet" | "ordered";

interface ListItemMatch {
  indent: number;
  marker: ListMarker;
  start?: number;
  checked?: boolean;
  text: string;
}

/** spec: Checklist — `[ ]` or `[x]` after the list marker */
function splitChecklistBox(text: string): { checked?: boolean; text: string } {
  const checkboxMatch = text.match(/^\[([ xX])\]\s+(.*)/);
  if (!checkboxMatch) return { text };
  return { checked: checkboxMatch[1] !== " ", text: checkboxMatch[2] };
}

/** spec: Lists — `-`, `*`, `+` or `N.` followed by a space */
function matchListItem(line: string): ListItemMatch | null {
  const bulletMatch = line.match(/^(\s*)[-*+]\s+(.*)/);
  if (bulletMatch) {
    return { indent: bulletMatch[1].length, marker: "bullet", ...splitChecklistBox(bulletMatch[2]) };
  }
  const orderedMatch = line.match(/^(\s*)(\d+)\.\s+(.*)/);
  if (orderedMatch) {
    return {
      indent: orderedMatch[1].length,
      marker: "ordered",
      start: parseInt(orderedMatch[2], 10),
      ...splitChecklistBox(orderedMatch[3]),
    };
  }
  return null;
}

/** Parse `| a | b | c |` into cell strings (strips leading/trailing `|`).
 *  Does not split on `|` inside backtick code spans or on escaped `\|`. */
function splitTableRow(line: string): string[] {
  const stripped = line.replace(/^\s*~?\s*\|?/, "").trim();
  const cells: string[] = [];
  let currentCell = "";
  let endsWithSeparator = false;
  for (let i = 0; i < stripped.length; i++) {
    const character = stripped[i];
    endsWithSeparator = false;
    if (character === "`") {
      const end = codeSpanEndOrRunEnd(stripped, i);
      currentCell += stripped.slice(i, end);
      i = end - 1;
    }
    else if (character === "\\" && i + 1 < stripped.length) { currentCell += character + stripped[i + 1]; i++; }
    else if (character === "|") { cells.push(currentCell.trim()); currentCell = ""; endsWithSeparator = true; }
    else { currentCell += character; }
  }
  if (!endsWithSeparator) cells.push(currentCell.trim());
  return cells;
}

/** Parse alignment row cell like `---`, `:---`, `:---:`, `---:` */
function parseAlignment(cell: string): TableAlignment {
  const trimmedCell = cell.trim();
  const left = trimmedCell.startsWith(":");
  const right = trimmedCell.endsWith(":");
  if (left && right) return "center";
  if (left) return "left";
  if (right) return "right";
  return "default";
}

function isAlignmentRow(line: string): boolean {
  const cells = splitTableRow(line);
  return cells.length > 0 && cells.every((trimmedCell) => /^:?-+:?$/.test(trimmedCell));
}

const MERGE_LEFT_MARKER = "<<";
const MERGE_UP_MARKER = "^^";

type CellPosition = { row: number; column: number };

type MergedSpan = { colspan: number; rowspan: number };

/**
 * spec: Table / Cell Merge
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
 * spec: Table / Cell Merge
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
 * spec: Table / Cell Merge
 * Converts a grid of raw cell strings into rows of origin cells with
 * colspan/rowspan. Slots covered by a merge are omitted from the rows.
 */
function buildMergedRows(grid: string[][], context: ParseContext): TableCellNode[][] {
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
        children: parseInline(cell, context),
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
    const footnoteMatch = line.match(FOOTNOTE_DEF_RE);
    if (footnoteMatch) {
      rawFootnoteDefs[footnoteMatch[1]] = footnoteMatch[2];
      continue;
    }
    const linkMatch = line.match(LINK_DEF_RE);
    if (linkMatch) {
      const id = linkMatch[1].toLowerCase();
      const title = linkMatch[3] ?? linkMatch[4] ?? linkMatch[5];
      linkDefs[id] = {
        href: unescapeBackslashes(linkMatch[2]),
        title: title === undefined ? undefined : unescapeBackslashes(title),
      };
      continue;
    }
  }

  return { linkDefs, rawFootnoteDefs };
}

/** Remove link/footnote definition lines from the content. */
function removeDefinitionLines(lines: string[]): string[] {
  return lines.filter((line) => !LINK_DEF_RE.test(line) && !FOOTNOTE_DEF_RE.test(line));
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
 * For each line after `openerIndex`, whether a code fence opening on that line
 * has a closing fence somewhere below it. Computed in one backward pass by
 * tracking the longest run of backticks and of tildes seen so far.
 */
function findClosableFenceLines(lines: string[], openerIndex: number): Set<number> {
  const closableFenceLines = new Set<number>();
  const longestClosingRun: Record<string, number> = { "`": 0, "~": 0 };
  for (let i = lines.length - 1; i > openerIndex; i--) {
    const fence = matchCodeFence(lines[i]);
    if (fence && longestClosingRun[fence.marker[0]] >= fence.marker.length) {
      closableFenceLines.add(i);
    }
    const closingRun = lines[i].match(/^(`+|~+)$/);
    if (closingRun) {
      const character = closingRun[1][0];
      longestClosingRun[character] = Math.max(longestClosingRun[character], closingRun[1].length);
    }
  }
  return closableFenceLines;
}

/**
 * spec: Lobster Extensions — a `:::` block ends at the `:::` line that matches
 * its opener. Nested openers and fenced code are skipped, but a fence that is
 * never closed does not hide the closing `:::` (the code block then ends with
 * the `:::` block). Returns `lines.length` when the block is never closed.
 */
function findContainerEnd(lines: string[], openerIndex: number): number {
  const closableFenceLines = findClosableFenceLines(lines, openerIndex);
  let depth = 0;
  let openFence: string | null = null;
  for (let i = openerIndex + 1; i < lines.length; i++) {
    const line = lines[i];
    if (openFence !== null) {
      if (isClosingFence(line, openFence)) openFence = null;
      continue;
    }
    const fence = closableFenceLines.has(i) ? matchCodeFence(line) : null;
    if (fence) {
      openFence = fence.marker;
    } else if (matchContainerOpener(line)) {
      depth++;
    } else if (isContainerCloser(line)) {
      if (depth === 0) return i;
      depth--;
    }
  }
  return lines.length;
}

function tryParseContainer(
  lines: string[],
  i: number,
  context: ParseContext,
  scope: BlockScope
): ContainerParseResult | null {
  if (scope === "quote") return null;
  const opener = matchContainerOpener(lines[i]);
  if (!opener) return null;

  const end = findContainerEnd(lines, i);
  const children = parseBlocks(lines.slice(i + 1, end), context, "container");
  const nextIndex = end + 1;

  switch (opener.kind) {
    case "header":
      if (scope === "document") context.header = { type: "header_container", children };
      return { node: null, nextIndex };
    case "footer":
      if (scope === "document") context.footer = { type: "footer_container", children };
      return { node: null, nextIndex };
    case "warp":
      context.warpDefs[opener.id] = { type: "warp_definition", id: opener.id, children };
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
  context: ParseContext
): ParseBlockResult | null {
  const heading = matchHeading(lines[i]);
  if (!heading) return null;
  const node: HeadingNode = {
    type: "heading",
    level: heading.level as HeadingNode["level"],
    ...(heading.id !== undefined && { id: heading.id }),
    children: parseInline(heading.text, context),
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
  context: ParseContext
): ParseBlockResult | null {
  if (!lines[i].startsWith(">")) return null;

  const quoteLines: string[] = [];
  let j = i;
  while (j < lines.length && lines[j].startsWith(">")) {
    quoteLines.push(lines[j]);
    j++;
  }

  const stripped = stripBlockquotePrefix(quoteLines);
  const node: BlockquoteNode = {
    type: "blockquote",
    children: parseBlocks(stripped, context, "quote"),
  };
  return { node, nextIndex: j };
}

function tryParseList(
  lines: string[],
  i: number,
  context: ParseContext
): ParseBlockResult | null {
  const firstItem = matchListItem(lines[i]);
  if (!firstItem) return null;
  return parseList(lines, i, 0, firstItem.marker, context);
}

/**
 * spec: Lists — consecutive items with the same marker type form one list.
 * Indented lines continue the item; a more indented item starts a sublist.
 */
function parseList(
  lines: string[],
  startIndex: number,
  depth: number,
  marker: ListMarker,
  context: ParseContext
): { node: BulletListNode | OrderedListNode; nextIndex: number } {
  const items: ListItemNode[] = [];
  let start = 1;
  let i = startIndex;

  while (i < lines.length) {
    if (isBlankLine(lines[i])) {
      i++;
      continue;
    }

    const item = matchListItem(lines[i]);
    if (!item || item.marker !== marker || item.indent < depth) break;
    if (items.length === 0) start = item.start ?? 1;

    const textLines: string[] = [item.text];
    i++;
    while (i < lines.length && !isBlankLine(lines[i]) && !matchListItem(lines[i]) && /^\s/.test(lines[i])) {
      textLines.push(lines[i].trimStart());
      i++;
    }

    let sublist: BulletListNode | OrderedListNode | undefined;
    const nextItem = i < lines.length ? matchListItem(lines[i]) : null;
    if (nextItem && nextItem.indent > item.indent) {
      const subResult = parseList(lines, i, nextItem.indent, nextItem.marker, context);
      sublist = subResult.node;
      i = subResult.nextIndex;
    }

    items.push({
      checked: item.checked,
      children: parseInline(textLines.join(" "), context),
      sublist,
    });
  }

  const node: BulletListNode | OrderedListNode =
    marker === "bullet"
      ? { type: "bullet_list", depth, items }
      : { type: "ordered_list", depth, start, items };
  return { node, nextIndex: i };
}

/** spec: Silent Table — every row starts with `~` */
function isSilentTableLine(line: string): boolean {
  return /^\s*~\s*\|/.test(line) || /^\s*~\s+/.test(line);
}

/** spec: Table — a row is any line containing `|` */
function isTableLine(line: string, isSilent: boolean): boolean {
  return isSilent ? isSilentTableLine(line) : line.includes("|");
}

/** spec: Table — a line that can start a table ends the preceding paragraph */
function startsWithTablePipe(line: string): boolean {
  return /^\s*(~\s*)?\|/.test(line);
}

/**
 * spec: Table, Silent Table — a header row and an alignment row, then body
 * rows. `splitTableRow` removes the `~` prefix of silent tables.
 */
function tryParseTable(
  lines: string[],
  i: number,
  context: ParseContext,
  scope: BlockScope
): ParseBlockResult | null {
  const isSilent = /^\s*~\s+/.test(lines[i]);
  if (!isTableLine(lines[i], isSilent)) return null;
  if (i + 1 >= lines.length || !isAlignmentRow(lines[i + 1])) return null;

  const headerCells = splitTableRow(lines[i]);
  const columnCount = headerCells.length;
  const [headers] = buildMergedRows([headerCells], context);
  const alignments = splitTableRow(lines[i + 1]).map(parseAlignment);

  const bodyGrid: string[][] = [];
  let j = i + 2;
  while (j < lines.length && isTableLine(lines[j], isSilent) && !(scope !== "quote" && matchContainerOpener(lines[j]))) {
    const cells = splitTableRow(lines[j]).slice(0, columnCount);
    while (cells.length < columnCount) cells.push("");
    bodyGrid.push(cells);
    j++;
  }
  const rows = buildMergedRows(bodyGrid, context);

  const node: TableNode = { type: "table", isSilent, headers, alignments, rows };
  return { node, nextIndex: j };
}

function startsBlockElement(line: string): boolean {
  return (
    matchHeading(line) !== null ||
    isHorizontalRule(line) ||
    matchCodeFence(line) !== null ||
    line.startsWith(">") ||
    matchListItem(line) !== null ||
    startsWithTablePipe(line) ||
    /^:::/.test(line)
  );
}

/**
 * Parse a paragraph: lines until blank line or block-level element.
 */
function parseParagraph(
  lines: string[],
  i: number,
  context: ParseContext
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
  const children = parseInline(text, context);

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
  context: ParseContext,
  scope: BlockScope = "container"
): BlockNode[] {
  const nodes: BlockNode[] = [];
  let i = 0;

  while (i < lines.length) {
    if (isBlankLine(lines[i])) {
      i++;
      continue;
    }

    const container = tryParseContainer(lines, i, context, scope);
    if (container) {
      if (container.node) nodes.push(container.node);
      i = container.nextIndex;
      continue;
    }

    const result =
      tryParseHeading(lines, i, context) ??
      tryParseHorizontalRule(lines, i) ??
      tryParseCodeBlock(lines, i) ??
      tryParseBlockquote(lines, i, context) ??
      tryParseList(lines, i, context) ??
      tryParseTable(lines, i, context, scope) ??
      parseParagraph(lines, i, context);

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
  const context: ParseContext = {
    linkDefs,
    footnoteDefs: {},
    definedFootnoteIds: new Set(Object.keys(rawFootnoteDefs)),
    warpDefs: {},
    inlineFootnoteCount: 0,
  };

  // Parse raw footnote def texts into inline nodes
  for (const [id, text] of Object.entries(rawFootnoteDefs)) {
    context.footnoteDefs[id] = parseInline(text, context);
  }

  const body = parseBlocks(cleanLines, context, "document");

  return {
    header: context.header,
    footer: context.footer,
    body,
    linkDefs,
    footnoteDefs: context.footnoteDefs,
    warpDefs: context.warpDefs,
  };
}

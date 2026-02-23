import type {
  BlockNode,
  InlineNode,
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
  HeaderContainerNode,
  FooterContainerNode,
  DetailsNode,
  WarpDefinitionNode,
  LinkDef,
  Document,
  ParseContext,
} from "./types.js";
import { parseInline } from "./inline-parser.js";

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

/** Returns heading level and content, or null */
function matchHeading(line: string): { level: number; text: string } | null {
  const m = line.match(/^(#{1,6})\s+(.+?)(\s+#+\s*)?$/);
  if (!m) return null;
  return { level: m[1].length, text: m[2].trimEnd() };
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

/** Parse `| a | b | c |` into cell strings (strips leading/trailing `|`) */
function splitTableRow(line: string): string[] {
  const stripped = line.replace(/^\s*~?\s*\|?\s*/, "").replace(/\s*\|?\s*$/, "");
  return stripped.split("|").map((c) => c.trim());
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

// ============================================================
// Pre-scan: collect definitions
// ============================================================

const LINK_DEF_RE = /^\[([^\]]+)\]:\s+(\S+)(?:\s+(?:"([^"]+)"|'([^']+)'|\(([^)]+)\)))?/;
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
      linkDefs[id] = {
        href: lm[2],
        title: lm[3] ?? lm[4] ?? lm[5],
      };
      continue;
    }
  }

  return { linkDefs, rawFootnoteDefs };
}

/**
 * Remove link/footnote definition lines from the content.
 * Also marks warp-block lines for removal (handled by extractCustomBlocks).
 */
function removeDefinitionLines(lines: string[]): string[] {
  return lines.filter((l) => !LINK_DEF_RE.test(l) && !FOOTNOTE_DEF_RE.test(l));
}

// ============================================================
// Custom block extraction (:::header, :::footer, :::warp, :::details)
// ============================================================

interface ExtractedCustomBlocks {
  header?: HeaderContainerNode;
  footer?: FooterContainerNode;
  warpDefs: Record<string, WarpDefinitionNode>;
  remainingLines: string[];
  detailsBlocks: { startIdx: number; node: DetailsNode }[];
}

function extractCustomBlocks(
  lines: string[],
  ctx: ParseContext
): ExtractedCustomBlocks {
  let header: HeaderContainerNode | undefined;
  let footer: FooterContainerNode | undefined;
  const warpDefs: Record<string, WarpDefinitionNode> = {};
  const remainingLines: string[] = [];
  const detailsBlocks: { startIdx: number; node: DetailsNode }[] = [];

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    if (/^:::header\s*$/.test(line)) {
      const innerLines: string[] = [];
      i++;
      while (i < lines.length && !/^\s*:::\s*$/.test(lines[i])) {
        innerLines.push(lines[i]);
        i++;
      }
      i++; // skip :::
      // Parse header content (later, after ctx is populated)
      header = { type: "header_container", children: [] };
      header.children = parseBlocks(innerLines, ctx);
      continue;
    }

    if (/^:::footer\s*$/.test(line)) {
      const innerLines: string[] = [];
      i++;
      while (i < lines.length && !/^\s*:::\s*$/.test(lines[i])) {
        innerLines.push(lines[i]);
        i++;
      }
      i++;
      footer = { type: "footer_container", children: [] };
      footer.children = parseBlocks(innerLines, ctx);
      continue;
    }

    const warpM = line.match(/^:::warp\s+(\S+)\s*$/);
    if (warpM) {
      const id = warpM[1];
      const innerLines: string[] = [];
      i++;
      while (i < lines.length && !/^\s*:::\s*$/.test(lines[i])) {
        innerLines.push(lines[i]);
        i++;
      }
      i++;
      const warpNode: WarpDefinitionNode = {
        type: "warp_definition",
        id,
        children: [], // filled below
      };
      warpNode.children = parseBlocks(innerLines, ctx);
      // If id is duplicated, treat as plain text (spec) — simple: just overwrite
      if (warpDefs[id]) {
        // Duplicate: mark as invalid (renderer will treat as plain text)
        warpNode.id = `__duplicate_${id}`;
      }
      warpDefs[warpM[1]] = warpNode;
      continue;
    }

    const detailsM = line.match(/^:::details\s+(.*?)\s*$/);
    if (detailsM) {
      const title = detailsM[1];
      const innerLines: string[] = [];
      const startIdx = remainingLines.length;
      i++;
      while (i < lines.length && !/^\s*:::\s*$/.test(lines[i])) {
        innerLines.push(lines[i]);
        i++;
      }
      i++;
      const detailsNode: DetailsNode = {
        type: "details",
        title,
        children: parseBlocks(innerLines, ctx),
      };
      // Insert a placeholder line so position is preserved
      remainingLines.push(`__DETAILS_PLACEHOLDER_${detailsBlocks.length}__`);
      detailsBlocks.push({ startIdx, node: detailsNode });
      continue;
    }

    remainingLines.push(line);
    i++;
  }

  return { header, footer, warpDefs, remainingLines, detailsBlocks };
}

// ============================================================
// Block parsers
// ============================================================

type ParseBlockResult = { node: BlockNode; nextIndex: number };

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
  const markerChar = fence.marker[0];
  const markerLen = fence.marker.length;
  let j = i + 1;

  while (j < lines.length) {
    // Closing fence: same char, at least same length
    if (
      lines[j].match(/^(`{3,}|~{3,})$/) &&
      lines[j][0] === markerChar &&
      lines[j].length >= markerLen
    ) {
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
  while (j < lines.length && (lines[j].startsWith(">") || !isBlankLine(lines[j]))) {
    if (lines[j].startsWith(">")) {
      bqLines.push(lines[j]);
    } else {
      // Continuation line (not starting with >) — include as continuation
      bqLines.push(lines[j]);
    }
    j++;
    // Stop at blank line
    if (j < lines.length && isBlankLine(lines[j])) break;
  }

  const stripped = stripBlockquotePrefix(bqLines);
  const node: BlockquoteNode = {
    type: "blockquote",
    children: parseBlocks(stripped, ctx),
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
  const headerCells = splitTableRow(rawHeader).map(
    (c): TableCellNode => ({
      children: parseInline(c, ctx),
    })
  );

  // Parse alignment row
  const rawAlign = isSilent
    ? lines[i + 1].replace(/^\s*~\s*/, "")
    : lines[i + 1];
  const alignments: TableAlignment[] = splitTableRow(rawAlign).map(parseAlignment);

  // Parse data rows
  const rows: TableCellNode[][] = [];
  let j = i + 2;
  while (j < lines.length && isTableLine(lines[j])) {
    const rawRow = isSilent ? lines[j].replace(/^\s*~\s*/, "") : lines[j];
    const cells = splitTableRow(rawRow);

    // Pad to header count if shorter
    while (cells.length < headerCells.length) cells.push("");

    // Handle horizontal cell merge (\|)
    const rowCells: TableCellNode[] = [];
    let colIdx = 0;
    for (let c = 0; c < cells.length; c++) {
      if (cells[c] === "\\") {
        // \| escape → merge with previous cell
        if (rowCells.length > 0) {
          const prev = rowCells[rowCells.length - 1];
          prev.colspan = (prev.colspan ?? 1) + 1;
        }
        colIdx++;
        continue;
      }
      // Handle \--- (vertical merge placeholder)
      if (/^\\-+$/.test(cells[c])) {
        rowCells.push({ children: [{ type: "text", text: "__ROWSPAN__" }] });
        colIdx++;
        continue;
      }
      rowCells.push({
        children: parseInline(cells[c], ctx),
      });
      colIdx++;
    }
    rows.push(rowCells);
    j++;
  }

  const node: TableNode = {
    type: "table",
    isSilent,
    headers: headerCells,
    alignments,
    rows,
  };
  return { node, nextIndex: j };
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

    // Stop if the next line would start a block element
    if (
      matchHeading(line) ||
      isHorizontalRule(line) ||
      matchCodeFence(line) ||
      line.startsWith(">") ||
      matchListItem(line) ||
      /^\s*\|/.test(line) ||
      /^\s*~\s*\|/.test(line) ||
      /^:::/.test(line) ||
      /^__DETAILS_PLACEHOLDER_/.test(line)
    ) {
      break;
    }

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

export function parseBlocks(lines: string[], ctx: ParseContext): BlockNode[] {
  const nodes: BlockNode[] = [];
  const trimmed = trimTrailingSpaces(lines);
  let i = 0;

  while (i < trimmed.length) {
    const line = trimmed[i];

    if (isBlankLine(line)) {
      i++;
      continue;
    }

    // Details placeholder
    if (/^__DETAILS_PLACEHOLDER_\d+__$/.test(line)) {
      // Will be replaced during post-processing
      nodes.push({ type: "paragraph", children: [{ type: "text", text: line }] });
      i++;
      continue;
    }

    let result: ParseBlockResult | null = null;

    result ??= tryParseHeading(trimmed, i, ctx);
    result ??= tryParseHorizontalRule(trimmed, i);
    result ??= tryParseCodeBlock(trimmed, i);
    result ??= tryParseBlockquote(trimmed, i, ctx);
    result ??= tryParseList(trimmed, i, ctx);
    result ??= tryParseTable(trimmed, i, ctx);

    if (!result) {
      result = parseParagraph(trimmed, i, ctx);
    }

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

  // Extract :::header, :::footer, :::warp, :::details blocks
  const extracted = extractCustomBlocks(cleanLines, ctx);

  // Attach warp defs to context so inline parser can resolve [~id]
  ctx.warpDefs = extracted.warpDefs;

  // Parse remaining body blocks
  let body = parseBlocks(extracted.remainingLines, ctx);

  // Replace details placeholders with actual nodes
  if (extracted.detailsBlocks.length > 0) {
    body = body.map((node) => {
      if (
        node.type === "paragraph" &&
        node.children.length === 1 &&
        node.children[0].type === "text"
      ) {
        const text = (node.children[0] as { type: string; text: string }).text;
        const m = text.match(/^__DETAILS_PLACEHOLDER_(\d+)__$/);
        if (m) {
          const idx = parseInt(m[1], 10);
          return extracted.detailsBlocks[idx].node;
        }
      }
      return node;
    });
  }

  return {
    header: extracted.header,
    footer: extracted.footer,
    body,
    linkDefs,
    footnoteDefs: ctx.footnoteDefs,
    footnoteRefs: ctx.footnoteRefs,
    warpDefs: extracted.warpDefs,
  };
}

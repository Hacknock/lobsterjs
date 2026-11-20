import type {
  Document,
  BlockNode,
  InlineNode,
  HeadingNode,
  ParagraphNode,
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
} from "../../core/types.js";

// ============================================================
// Escaping
// ============================================================

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ============================================================
// Render context
// ============================================================

interface RenderContext {
  footnoteDefs: Record<string, InlineNode[]>;
  /** spec: Footnote Reference — ids in the order they are first rendered; the number is the position + 1 */
  footnoteOrder: string[];
  /** How many times each footnote has been referenced so far, for `[1:1]` labels */
  footnoteReferenceCounts: Map<string, number>;
  warpDefs: Record<string, WarpDefinitionNode>;
  /** spec: Warp — a reference inside its own expansion renders nothing */
  expandingWarpIds: Set<string>;
}

// ============================================================
// Inline renderer
// ============================================================

function renderInlineNodes(nodes: InlineNode[], context: RenderContext): string {
  return nodes.map((node) => renderInlineNode(node, context)).join("");
}

function titleAttribute(title: string | undefined): string {
  return title ? ` title="${escapeHtml(title)}"` : "";
}

/**
 * spec: Footnote Reference — references are numbered in the order they are rendered.
 * Repeated references to the same footnote are labelled `[1:1]`, `[1:2]`, …
 */
function renderFootnoteReference(id: string, context: RenderContext): string {
  if (!context.footnoteOrder.includes(id)) context.footnoteOrder.push(id);
  const number = context.footnoteOrder.indexOf(id) + 1;
  const referenceCount = context.footnoteReferenceCounts.get(id) ?? 0;
  context.footnoteReferenceCounts.set(id, referenceCount + 1);
  const label = referenceCount === 0 ? `[${number}]` : `[${number}:${referenceCount}]`;
  const escapedId = escapeHtml(id);
  return `<sup class="lbs-footnote-ref"><a href="#lbs-fn-${escapedId}" id="lbs-fnref-${escapedId}-${referenceCount}">${label}</a></sup>`;
}

/**
 * spec: Warp — a reference without a definition is plain text, and a
 * reference inside its own expansion renders nothing.
 */
function renderWarpReference(id: string, context: RenderContext): string {
  const warp = context.warpDefs[id];
  if (!warp) return escapeHtml(`[~${id}]`);
  if (context.expandingWarpIds.has(id)) return "";
  context.expandingWarpIds.add(id);
  const html = renderBlockNodes(warp.children, context);
  context.expandingWarpIds.delete(id);
  return html;
}

function renderInlineNode(node: InlineNode, context: RenderContext): string {
  switch (node.type) {
    case "text":
      return escapeHtml(node.text);
    case "line_break":
      return "<br>";
    case "emphasis":
      return `<span class="lbs-emphasis">${renderInlineNodes(node.children, context)}</span>`;
    case "strong":
      return `<span class="lbs-strong">${renderInlineNodes(node.children, context)}</span>`;
    case "strikethrough":
      return `<span class="lbs-strikethrough">${renderInlineNodes(node.children, context)}</span>`;
    case "code_span":
      return `<code class="lbs-code-span">${escapeHtml(node.code)}</code>`;
    case "link":
      return `<a href="${escapeHtml(node.href)}"${titleAttribute(node.title)}>${renderInlineNodes(node.text, context)}</a>`;
    case "image": {
      const width = node.width ? ` width="${node.width}"` : "";
      const height = node.height ? ` height="${node.height}"` : "";
      return `<img src="${escapeHtml(node.src)}" alt="${escapeHtml(node.alt)}"${titleAttribute(node.title)}${width}${height} class="lbs-image">`;
    }
    case "footnote_ref":
    case "inline_footnote":
      return renderFootnoteReference(node.id, context);
    case "warp_ref":
      return renderWarpReference(node.id, context);
  }
}

// ============================================================
// Block renderer
// ============================================================

function renderBlockNodes(nodes: BlockNode[], context: RenderContext): string {
  return nodes
    .map((node) => renderBlockNode(node, context))
    .filter((html) => html !== "")
    .join("\n");
}

function renderBlockNode(node: BlockNode, context: RenderContext): string {
  switch (node.type) {
    case "heading":
      return renderHeading(node, context);
    case "paragraph":
      return renderParagraph(node, context);
    case "horizontal_rule":
      return `<hr class="lbs-hr">`;
    case "code_block":
      return renderCodeBlock(node);
    case "blockquote":
      return renderBlockquote(node, context);
    case "bullet_list":
      return renderBulletList(node, context);
    case "ordered_list":
      return renderOrderedList(node, context);
    case "table":
      return renderTable(node, context);
    case "details":
      return renderDetails(node, context);
  }
}

function renderHeading(node: HeadingNode, context: RenderContext): string {
  const content = renderInlineNodes(node.children, context);
  const idAttribute = node.id ? ` id="${escapeHtml(node.id)}"` : "";
  return `<h${node.level} class="lbs-heading-${node.level}"${idAttribute}>${content}</h${node.level}>`;
}

/** spec: Warp — a paragraph that is only a warp reference is replaced by the warp's blocks */
function renderParagraph(node: ParagraphNode, context: RenderContext): string {
  const [onlyChild] = node.children;
  if (node.children.length === 1 && onlyChild.type === "warp_ref" && context.warpDefs[onlyChild.id]) {
    return renderWarpReference(onlyChild.id, context);
  }
  const content = renderInlineNodes(node.children, context);
  return `<p class="lbs-paragraph">${content}</p>`;
}

function renderCodeBlock(node: CodeBlockNode): string {
  const languageAttribute = node.language
    ? ` data-language="${escapeHtml(node.language)}"`
    : "";
  const filename = node.filename
    ? ` data-filename="${escapeHtml(node.filename)}"`
    : "";
  const header = node.filename
    ? `<div class="lbs-code-filename">${escapeHtml(node.filename)}</div>`
    : "";
  const languageClass = node.language ? ` class="language-${escapeHtml(node.language)}"` : "";
  return `<div class="lbs-code-block">${header}<pre${languageAttribute}${filename}><code${languageClass}>${escapeHtml(node.code)}</code></pre></div>`;
}

function renderBlockquote(node: BlockquoteNode, context: RenderContext): string {
  const content = renderBlockNodes(node.children, context);
  return `<blockquote class="lbs-blockquote">${content}</blockquote>`;
}

function renderListItem(
  item: ListItemNode,
  context: RenderContext
): string {
  const checkboxHtml =
    item.checked !== undefined
      ? `<input type="checkbox" class="lbs-checkbox"${item.checked ? " checked" : ""} disabled> `
      : "";
  const textHtml = renderInlineNodes(item.children, context);
  const sublistHtml = item.sublist
    ? "\n" + renderBlockNode(item.sublist, context)
    : "";
  return `<li class="lbs-list-item">${checkboxHtml}${textHtml}${sublistHtml}</li>`;
}

function renderBulletList(node: BulletListNode, context: RenderContext): string {
  const items = node.items.map((item) => renderListItem(item, context)).join("\n");
  return `<ul class="lbs-ul lbs-ul-depth-${node.depth}">\n${items}\n</ul>`;
}

function renderOrderedList(node: OrderedListNode, context: RenderContext): string {
  const startAttr = node.start !== 1 ? ` start="${node.start}"` : "";
  const items = node.items.map((item) => renderListItem(item, context)).join("\n");
  return `<ol class="lbs-ol lbs-ol-depth-${node.depth}"${startAttr}>\n${items}\n</ol>`;
}

/**
 * Returns the starting column of each body cell, skipping columns occupied
 * by rowspans from rows above.
 */
function bodyCellColumns(rows: TableCellNode[][]): number[][] {
  const occupiedUntilRow: number[] = [];
  return rows.map((row, rowIndex) => {
    let column = 0;
    return row.map((cell) => {
      while ((occupiedUntilRow[column] ?? 0) > rowIndex) column++;
      const startColumn = column;
      const colspan = cell.colspan ?? 1;
      for (let offset = 0; offset < colspan; offset++) {
        occupiedUntilRow[startColumn + offset] = rowIndex + (cell.rowspan ?? 1);
      }
      column += colspan;
      return startColumn;
    });
  });
}

function renderTableCell(
  tag: "th" | "td",
  cell: TableCellNode,
  alignment: TableAlignment | undefined,
  context: RenderContext
): string {
  const alignmentAttribute = alignment && alignment !== "default" ? ` style="text-align:${alignment}"` : "";
  const colspan = cell.colspan ? ` colspan="${cell.colspan}"` : "";
  const rowspan = cell.rowspan ? ` rowspan="${cell.rowspan}"` : "";
  return `<${tag}${colspan}${rowspan}${alignmentAttribute}>${renderInlineNodes(cell.children, context)}</${tag}>`;
}

function renderTable(node: TableNode, context: RenderContext): string {
  const tableClass = node.isSilent
    ? "lbs-table lbs-table-silent"
    : "lbs-table";

  let headerColumn = 0;
  const headerCells = node.headers
    .map((cell) => {
      const html = renderTableCell("th", cell, node.alignments[headerColumn], context);
      headerColumn += cell.colspan ?? 1;
      return html;
    })
    .join("");

  const columns = bodyCellColumns(node.rows);
  const bodyRows = node.rows.map((row, rowIndex) => {
    const cells = row.map((cell, cellIndex) =>
      renderTableCell("td", cell, node.alignments[columns[rowIndex][cellIndex]], context)
    );
    return `<tr>${cells.join("")}</tr>`;
  });

  return `<table class="${tableClass}">\n<thead><tr>${headerCells}</tr></thead>\n<tbody>\n${bodyRows.join("\n")}\n</tbody>\n</table>`;
}

function renderHeaderContainer(
  node: HeaderContainerNode,
  context: RenderContext
): string {
  const content = renderBlockNodes(node.children, context);
  return `<header class="lbs-header">${content}</header>`;
}

function renderFooterContainer(
  node: FooterContainerNode,
  context: RenderContext
): string {
  const content = renderBlockNodes(node.children, context);
  return `<footer class="lbs-footer">${content}</footer>`;
}

function renderDetails(node: DetailsNode, context: RenderContext): string {
  const content = renderBlockNodes(node.children, context);
  return `<details class="lbs-details">\n<summary class="lbs-summary">${escapeHtml(node.title)}</summary>\n${content}\n</details>`;
}

// ============================================================
// Footnote section
// ============================================================

/**
 * spec: Footnote Reference — one entry per referenced footnote, in number order.
 * References inside a definition are appended while the section renders.
 */
function renderFootnotes(context: RenderContext): string {
  const items: string[] = [];
  for (let index = 0; index < context.footnoteOrder.length; index++) {
    const id = context.footnoteOrder[index];
    const content = renderInlineNodes(context.footnoteDefs[id] ?? [], context);
    items.push(`<li id="lbs-fn-${escapeHtml(id)}" class="lbs-footnote-item">[${index + 1}] ${content}</li>`);
  }
  if (items.length === 0) return "";
  return `<section class="lbs-footnotes">\n<ol>\n${items.join("\n")}\n</ol>\n</section>`;
}

// ============================================================
// Public renderer
// ============================================================

/**
 * Converts a parsed Document AST into an HTML string.
 * spec: Footer — the footer is placed after the footnote section, but it is
 * rendered before it so that its footnotes are numbered and listed.
 */
export function renderDocument(doc: Document): string {
  const context: RenderContext = {
    footnoteDefs: doc.footnoteDefs,
    footnoteOrder: [],
    footnoteReferenceCounts: new Map(),
    warpDefs: doc.warpDefs,
    expandingWarpIds: new Set(),
  };

  const header = doc.header ? renderHeaderContainer(doc.header, context) : "";
  const body = renderBlockNodes(doc.body, context);
  const footer = doc.footer ? renderFooterContainer(doc.footer, context) : "";
  const footnotes = renderFootnotes(context);

  return [header, body, footnotes, footer].filter(Boolean).join("\n");
}

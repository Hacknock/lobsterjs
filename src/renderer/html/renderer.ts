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
  /** spec: Footnotes — ids in the order they are first rendered; the number is the position + 1 */
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

function renderInlineNodes(nodes: InlineNode[], ctx: RenderContext): string {
  return nodes.map((node) => renderInlineNode(node, ctx)).join("");
}

function titleAttribute(title: string | undefined): string {
  return title ? ` title="${escapeHtml(title)}"` : "";
}

/**
 * spec: Footnotes — references are numbered in the order they are rendered.
 * Repeated references to the same footnote are labelled `[1:1]`, `[1:2]`, …
 */
function renderFootnoteReference(id: string, ctx: RenderContext): string {
  if (!ctx.footnoteOrder.includes(id)) ctx.footnoteOrder.push(id);
  const number = ctx.footnoteOrder.indexOf(id) + 1;
  const referenceCount = ctx.footnoteReferenceCounts.get(id) ?? 0;
  ctx.footnoteReferenceCounts.set(id, referenceCount + 1);
  const label = referenceCount === 0 ? `[${number}]` : `[${number}:${referenceCount}]`;
  const escapedId = escapeHtml(id);
  return `<sup class="lbs-footnote-ref"><a href="#lbs-fn-${escapedId}" id="lbs-fnref-${escapedId}-${referenceCount}">${label}</a></sup>`;
}

function renderWarpReference(id: string, ctx: RenderContext): string {
  const warp = ctx.warpDefs[id];
  if (!warp || ctx.expandingWarpIds.has(id)) return "";
  ctx.expandingWarpIds.add(id);
  const html = renderBlockNodes(warp.children, ctx);
  ctx.expandingWarpIds.delete(id);
  return html;
}

function renderInlineNode(node: InlineNode, ctx: RenderContext): string {
  switch (node.type) {
    case "text":
      return escapeHtml(node.text);
    case "line_break":
      return "<br>";
    case "emphasis":
      return `<span class="lbs-emphasis">${renderInlineNodes(node.children, ctx)}</span>`;
    case "strong":
      return `<span class="lbs-strong">${renderInlineNodes(node.children, ctx)}</span>`;
    case "strikethrough":
      return `<span class="lbs-strikethrough">${renderInlineNodes(node.children, ctx)}</span>`;
    case "code_span":
      return `<code class="lbs-code-span">${escapeHtml(node.code)}</code>`;
    case "link":
      return `<a href="${escapeHtml(node.href)}"${titleAttribute(node.title)}>${renderInlineNodes(node.text, ctx)}</a>`;
    case "image": {
      const width = node.width ? ` width="${node.width}"` : "";
      const height = node.height ? ` height="${node.height}"` : "";
      return `<img src="${escapeHtml(node.src)}" alt="${escapeHtml(node.alt)}"${titleAttribute(node.title)}${width}${height} class="lbs-image">`;
    }
    case "footnote_ref":
    case "inline_footnote":
      return renderFootnoteReference(node.id, ctx);
    case "warp_ref":
      return renderWarpReference(node.id, ctx);
  }
}

// ============================================================
// Block renderer
// ============================================================

function renderBlockNodes(nodes: BlockNode[], ctx: RenderContext): string {
  return nodes.map((node) => renderBlockNode(node, ctx)).join("\n");
}

function renderBlockNode(node: BlockNode, ctx: RenderContext): string {
  switch (node.type) {
    case "heading":
      return renderHeading(node, ctx);
    case "paragraph":
      return renderParagraph(node, ctx);
    case "horizontal_rule":
      return `<hr class="lbs-hr">`;
    case "code_block":
      return renderCodeBlock(node);
    case "blockquote":
      return renderBlockquote(node, ctx);
    case "bullet_list":
      return renderBulletList(node, ctx);
    case "ordered_list":
      return renderOrderedList(node, ctx);
    case "table":
      return renderTable(node, ctx);
    case "details":
      return renderDetails(node, ctx);
  }
}

function renderHeading(node: HeadingNode, ctx: RenderContext): string {
  const content = renderInlineNodes(node.children, ctx);
  const idAttr = node.id ? ` id="${escapeHtml(node.id)}"` : "";
  return `<h${node.level} class="lbs-heading-${node.level}"${idAttr}>${content}</h${node.level}>`;
}

function renderParagraph(node: ParagraphNode, ctx: RenderContext): string {
  const content = renderInlineNodes(node.children, ctx);
  return `<p class="lbs-paragraph">${content}</p>`;
}

function renderCodeBlock(node: CodeBlockNode): string {
  const lang = node.language
    ? ` data-language="${escapeHtml(node.language)}"`
    : "";
  const filename = node.filename
    ? ` data-filename="${escapeHtml(node.filename)}"`
    : "";
  const header = node.filename
    ? `<div class="lbs-code-filename">${escapeHtml(node.filename)}</div>`
    : "";
  const langClass = node.language ? ` class="language-${escapeHtml(node.language)}"` : "";
  return `<div class="lbs-code-block">${header}<pre${lang}${filename}><code${langClass}>${escapeHtml(node.code)}</code></pre></div>`;
}

function renderBlockquote(node: BlockquoteNode, ctx: RenderContext): string {
  const content = renderBlockNodes(node.children, ctx);
  return `<blockquote class="lbs-blockquote">${content}</blockquote>`;
}

function renderListItem(
  item: ListItemNode,
  ctx: RenderContext
): string {
  const checkboxHtml =
    item.checked !== undefined
      ? `<input type="checkbox" class="lbs-checkbox"${item.checked ? " checked" : ""} disabled> `
      : "";
  const textHtml = renderInlineNodes(item.children, ctx);
  const sublistHtml = item.sublist
    ? "\n" + renderBlockNode(item.sublist, ctx)
    : "";
  return `<li class="lbs-list-item">${checkboxHtml}${textHtml}${sublistHtml}</li>`;
}

function renderBulletList(node: BulletListNode, ctx: RenderContext): string {
  const items = node.items.map((item) => renderListItem(item, ctx)).join("\n");
  return `<ul class="lbs-ul lbs-ul-depth-${node.depth}">\n${items}\n</ul>`;
}

function renderOrderedList(node: OrderedListNode, ctx: RenderContext): string {
  const startAttr = node.start !== 1 ? ` start="${node.start}"` : "";
  const items = node.items.map((item) => renderListItem(item, ctx)).join("\n");
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
  ctx: RenderContext
): string {
  const alignAttr = alignment && alignment !== "default" ? ` style="text-align:${alignment}"` : "";
  const colspan = cell.colspan ? ` colspan="${cell.colspan}"` : "";
  const rowspan = cell.rowspan ? ` rowspan="${cell.rowspan}"` : "";
  return `<${tag}${colspan}${rowspan}${alignAttr}>${renderInlineNodes(cell.children, ctx)}</${tag}>`;
}

function renderTable(node: TableNode, ctx: RenderContext): string {
  const tableClass = node.isSilent
    ? "lbs-table lbs-table-silent"
    : "lbs-table";

  let headerColumn = 0;
  const headerCells = node.headers
    .map((cell) => {
      const html = renderTableCell("th", cell, node.alignments[headerColumn], ctx);
      headerColumn += cell.colspan ?? 1;
      return html;
    })
    .join("");

  const columns = bodyCellColumns(node.rows);
  const bodyRows = node.rows.map((row, rowIndex) => {
    const cells = row.map((cell, cellIndex) =>
      renderTableCell("td", cell, node.alignments[columns[rowIndex][cellIndex]], ctx)
    );
    return `<tr>${cells.join("")}</tr>`;
  });

  return `<table class="${tableClass}">\n<thead><tr>${headerCells}</tr></thead>\n<tbody>\n${bodyRows.join("\n")}\n</tbody>\n</table>`;
}

function renderHeaderContainer(
  node: HeaderContainerNode,
  ctx: RenderContext
): string {
  const content = renderBlockNodes(node.children, ctx);
  return `<header class="lbs-header">${content}</header>`;
}

function renderFooterContainer(
  node: FooterContainerNode,
  ctx: RenderContext
): string {
  const content = renderBlockNodes(node.children, ctx);
  return `<footer class="lbs-footer">${content}</footer>`;
}

function renderDetails(node: DetailsNode, ctx: RenderContext): string {
  const content = renderBlockNodes(node.children, ctx);
  return `<details class="lbs-details">\n<summary class="lbs-summary">${escapeHtml(node.title)}</summary>\n${content}\n</details>`;
}

// ============================================================
// Footnote section
// ============================================================

/**
 * spec: Footnotes — one entry per referenced footnote, in number order.
 * References inside a definition are appended while the section renders.
 */
function renderFootnotes(ctx: RenderContext): string {
  const items: string[] = [];
  for (let index = 0; index < ctx.footnoteOrder.length; index++) {
    const id = ctx.footnoteOrder[index];
    const content = renderInlineNodes(ctx.footnoteDefs[id] ?? [], ctx);
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
  const ctx: RenderContext = {
    footnoteDefs: doc.footnoteDefs,
    footnoteOrder: [],
    footnoteReferenceCounts: new Map(),
    warpDefs: doc.warpDefs,
    expandingWarpIds: new Set(),
  };

  const header = doc.header ? renderHeaderContainer(doc.header, ctx) : "";
  const body = renderBlockNodes(doc.body, ctx);
  const footer = doc.footer ? renderFooterContainer(doc.footer, ctx) : "";
  const footnotes = renderFootnotes(ctx);

  return [header, body, footnotes, footer].filter(Boolean).join("\n");
}

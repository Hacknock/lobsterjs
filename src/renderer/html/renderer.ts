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
  TextNode,
  EmphasisNode,
  StrongNode,
  StrikethroughNode,
  CodeSpanNode,
  InlineLinkNode,
  LinkNode,
  ImageNode,
  FootnoteRefNode,
  InlineFootnoteNode,
  WarpRefNode,
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
// Inline renderer
// ============================================================

function renderInlineNodes(nodes: InlineNode[], ctx: RenderContext): string {
  return nodes.map((n) => renderInlineNode(n, ctx)).join("");
}

function renderInlineNode(node: InlineNode, ctx: RenderContext): string {
  switch (node.type) {
    case "text":
      return escapeHtml((node as TextNode).text);

    case "line_break":
      return "<br>";

    case "emphasis": {
      const n = node as EmphasisNode;
      return `<span class="lbs-emphasis">${renderInlineNodes(n.children, ctx)}</span>`;
    }

    case "strong": {
      const n = node as StrongNode;
      return `<span class="lbs-strong">${renderInlineNodes(n.children, ctx)}</span>`;
    }

    case "strikethrough": {
      const n = node as StrikethroughNode;
      return `<span class="lbs-strikethrough">${renderInlineNodes(n.children, ctx)}</span>`;
    }

    case "code_span": {
      const n = node as CodeSpanNode;
      return `<code class="lbs-code-span">${escapeHtml(n.code)}</code>`;
    }

    case "inline_link": {
      const n = node as InlineLinkNode;
      const title = n.title ? ` title="${escapeHtml(n.title)}"` : "";
      return `<a href="${escapeHtml(n.href)}"${title}>${renderInlineNodes(n.text, ctx)}</a>`;
    }

    case "link": {
      const n = node as LinkNode;
      const title = n.title ? ` title="${escapeHtml(n.title)}"` : "";
      return `<a href="${escapeHtml(n.href)}"${title}>${renderInlineNodes(n.text, ctx)}</a>`;
    }

    case "image": {
      const n = node as ImageNode;
      const title = n.title ? ` title="${escapeHtml(n.title)}"` : "";
      const width = n.width ? ` width="${n.width}"` : "";
      const height = n.height ? ` height="${n.height}"` : "";
      return `<img src="${escapeHtml(n.src)}" alt="${escapeHtml(n.alt)}"${title}${width}${height} class="lbs-image">`;
    }

    case "footnote_ref": {
      const n = node as FootnoteRefNode;
      const idx = ctx.footnoteRefs.indexOf(n.id);
      const num = idx + 1;
      const refCount = ctx.footnoteRefCount[n.id] ?? 0;
      ctx.footnoteRefCount[n.id] = refCount + 1;
      const suffix = refCount === 0 ? "" : `:${refCount}`;
      const label = `[${num}${suffix}]`;
      return `<sup class="lbs-footnote-ref"><a href="#lbs-fn-${escapeHtml(n.id)}" id="lbs-fnref-${escapeHtml(n.id)}-${refCount}">${label}</a></sup>`;
    }

    case "inline_footnote": {
      const n = node as InlineFootnoteNode;
      // The id was already registered in ctx.footnoteRefs during parsing
      // Find the id by matching children (they're stored in footnoteDefs)
      // We use the order from footnoteRefs for inline footnotes
      const id = ctx.footnoteRefs.find((r) =>
        r.startsWith("__inline_") && ctx.footnoteDefs[r] === n.children
      );
      if (!id) {
        // Fallback: just render the content
        return renderInlineNodes(n.children, ctx);
      }
      const idx = ctx.footnoteRefs.indexOf(id);
      const num = idx + 1;
      return `<sup class="lbs-footnote-ref"><a href="#lbs-fn-${escapeHtml(id)}">[${num}]</a></sup>`;
    }

    case "warp_ref": {
      const n = node as WarpRefNode;
      const warp = ctx.warpDefs[n.id];
      if (!warp) return "";
      return renderBlockNodes(warp.children, ctx);
    }

    default:
      return "";
  }
}

// ============================================================
// Block renderer
// ============================================================

interface RenderContext {
  footnoteRefs: string[];
  footnoteRefCount: Record<string, number>;
  footnoteDefs: Record<string, InlineNode[]>;
  warpDefs: Record<string, WarpDefinitionNode>;
}

function renderBlockNodes(nodes: BlockNode[], ctx: RenderContext): string {
  return nodes.map((n) => renderBlockNode(n, ctx)).join("\n");
}

function renderBlockNode(node: BlockNode, ctx: RenderContext): string {
  switch (node.type) {
    case "heading":
      return renderHeading(node as HeadingNode, ctx);
    case "paragraph":
      return renderParagraph(node as ParagraphNode, ctx);
    case "horizontal_rule":
      return `<hr class="lbs-hr">`;
    case "code_block":
      return renderCodeBlock(node as CodeBlockNode);
    case "blockquote":
      return renderBlockquote(node as BlockquoteNode, ctx);
    case "bullet_list":
      return renderBulletList(node as BulletListNode, ctx);
    case "ordered_list":
      return renderOrderedList(node as OrderedListNode, ctx);
    case "table":
      return renderTable(node as TableNode, ctx);
    case "header_container":
      return renderHeaderContainer(node as HeaderContainerNode, ctx);
    case "footer_container":
      return renderFooterContainer(node as FooterContainerNode, ctx);
    case "details":
      return renderDetails(node as DetailsNode, ctx);
    case "warp_definition":
      // Warp definitions are not rendered inline; they're referenced via [~id]
      return "";
    default:
      return "";
  }
}

function renderHeading(node: HeadingNode, ctx: RenderContext): string {
  const content = renderInlineNodes(node.children, ctx);
  return `<p class="lbs-heading-${node.level}">${content}</p>`;
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

function renderTable(node: TableNode, ctx: RenderContext): string {
  const tableClass = node.isSilent
    ? "lbs-table lbs-table-silent"
    : "lbs-table";

  // Header
  const headerCells = node.headers
    .map((cell, i) => {
      const align = node.alignments[i];
      const alignAttr = align && align !== "default" ? ` style="text-align:${align}"` : "";
      const colspan = cell.colspan ? ` colspan="${cell.colspan}"` : "";
      return `<th${colspan}${alignAttr}>${renderInlineNodes(cell.children, ctx)}</th>`;
    })
    .join("");

  // Body rows
  const bodyRows = node.rows.map((row) => {
    const cells = row.map((cell, i): string => {
      const align = node.alignments[i];
      const alignAttr = align && align !== "default" ? ` style="text-align:${align}"` : "";
      const colspan = cell.colspan ? ` colspan="${cell.colspan}"` : "";
      const rowspan = cell.rowspan ? ` rowspan="${cell.rowspan}"` : "";

      // Skip rowspan placeholder cells
      const isRowspanPlaceholder =
        cell.children.length === 1 &&
        cell.children[0].type === "text" &&
        (cell.children[0] as TextNode).text === "__ROWSPAN__";
      if (isRowspanPlaceholder) return "";

      return `<td${colspan}${rowspan}${alignAttr}>${renderInlineNodes(cell.children, ctx)}</td>`;
    });
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

function renderFootnotes(doc: Document, ctx: RenderContext): string {
  if (ctx.footnoteRefs.length === 0) return "";

  const items = ctx.footnoteRefs.map((id, i) => {
    const num = i + 1;
    const defNodes = ctx.footnoteDefs[id];
    const content = defNodes ? renderInlineNodes(defNodes, ctx) : "";
    return `<li id="lbs-fn-${escapeHtml(id)}" class="lbs-footnote-item">[${num}] ${content}</li>`;
  });

  return `<section class="lbs-footnotes">\n<ol>\n${items.join("\n")}\n</ol>\n</section>`;
}

// ============================================================
// Public renderer
// ============================================================

/**
 * Converts a parsed Document AST into an HTML string.
 */
export function renderDocument(doc: Document): string {
  const ctx: RenderContext = {
    footnoteRefs: doc.footnoteRefs,
    footnoteRefCount: {},
    footnoteDefs: doc.footnoteDefs,
    warpDefs: doc.warpDefs,
  };

  const parts: string[] = [];

  if (doc.header) {
    parts.push(renderHeaderContainer(doc.header, ctx));
  }

  parts.push(renderBlockNodes(doc.body, ctx));

  if (doc.footnoteRefs.length > 0) {
    parts.push(renderFootnotes(doc, ctx));
  }

  if (doc.footer) {
    parts.push(renderFooterContainer(doc.footer, ctx));
  }

  return parts.filter(Boolean).join("\n");
}

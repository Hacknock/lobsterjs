// ============================================================
// Inline AST Nodes
// ============================================================

export interface TextNode {
  type: "text";
  text: string;
}

/** Italic: *text* or _text_ */
export interface EmphasisNode {
  type: "emphasis";
  children: InlineNode[];
}

/** Bold: **text** or __text__ */
export interface StrongNode {
  type: "strong";
  children: InlineNode[];
}

/** Strikethrough: ~~text~~ */
export interface StrikethroughNode {
  type: "strikethrough";
  children: InlineNode[];
}

/** Inline code: `code` or `` `code` `` */
export interface CodeSpanNode {
  type: "code_span";
  code: string;
}

/** Inline link [text](url "title"), reference link [text][id], or implicit link [text] */
export interface LinkNode {
  type: "link";
  text: InlineNode[];
  href: string;
  title?: string;
}

/** Image: ![alt](url "title" =WxH) */
export interface ImageNode {
  type: "image";
  alt: string;
  src: string;
  title?: string;
  width?: number;
  height?: number;
}

/** Footnote reference: [^id] */
export interface FootnoteRefNode {
  type: "footnote_ref";
  id: string;
}

/** Inline footnote: ^[text] — its content is stored in footnoteDefs under `id` */
export interface InlineFootnoteNode {
  type: "inline_footnote";
  id: string;
}

/** Warp reference used inside silent table cells: [~id] */
export interface WarpRefNode {
  type: "warp_ref";
  id: string;
}

export interface LineBreakNode {
  type: "line_break";
}

export type InlineNode =
  | TextNode
  | EmphasisNode
  | StrongNode
  | StrikethroughNode
  | CodeSpanNode
  | LinkNode
  | ImageNode
  | FootnoteRefNode
  | InlineFootnoteNode
  | WarpRefNode
  | LineBreakNode;

// ============================================================
// Block AST Nodes
// ============================================================

/** # Heading (level 1-6) */
export interface HeadingNode {
  type: "heading";
  level: 1 | 2 | 3 | 4 | 5 | 6;
  id?: string;
  children: InlineNode[];
}

export interface ParagraphNode {
  type: "paragraph";
  children: InlineNode[];
}

/** ---, *** (spec: Horizontal Rule) */
export interface HorizontalRuleNode {
  type: "horizontal_rule";
}

/** ``` or ~~~ fenced code block */
export interface CodeBlockNode {
  type: "code_block";
  language?: string;
  filename?: string;
  code: string;
}

/** > Blockquote */
export interface BlockquoteNode {
  type: "blockquote";
  children: BlockNode[];
}

export interface ListItemNode {
  /** undefined = normal item, true/false = checklist */
  checked?: boolean;
  children: InlineNode[];
  sublist?: BulletListNode | OrderedListNode;
}

/** - item, * item, + item */
export interface BulletListNode {
  type: "bullet_list";
  depth: number;
  items: ListItemNode[];
}

/** 1. item */
export interface OrderedListNode {
  type: "ordered_list";
  depth: number;
  start: number;
  items: ListItemNode[];
}

export type TableAlignment = "default" | "left" | "center" | "right";

export interface TableCellNode {
  children: InlineNode[];
  colspan?: number;
  rowspan?: number;
}

export interface TableNode {
  type: "table";
  isSilent: boolean;
  headers: TableCellNode[];
  alignments: TableAlignment[];
  /** spec: Table / Cell Merge — slots covered by colspan/rowspan are omitted. */
  rows: TableCellNode[][];
}

/** :::header ... ::: */
export interface HeaderContainerNode {
  type: "header_container";
  children: BlockNode[];
}

/** :::footer ... ::: */
export interface FooterContainerNode {
  type: "footer_container";
  children: BlockNode[];
}

/** :::details Title ... ::: */
export interface DetailsNode {
  type: "details";
  title: string;
  children: BlockNode[];
}

/** :::warp id ... ::: */
export interface WarpDefinitionNode {
  type: "warp_definition";
  id: string;
  children: BlockNode[];
}

export type BlockNode =
  | HeadingNode
  | ParagraphNode
  | HorizontalRuleNode
  | CodeBlockNode
  | BlockquoteNode
  | BulletListNode
  | OrderedListNode
  | TableNode
  | DetailsNode;

// ============================================================
// Document
// ============================================================

export interface LinkDef {
  href: string;
  title?: string;
}

export interface Document {
  header?: HeaderContainerNode;
  footer?: FooterContainerNode;
  body: BlockNode[];
  linkDefs: Record<string, LinkDef>;
  footnoteDefs: Record<string, InlineNode[]>;
  warpDefs: Record<string, WarpDefinitionNode>;
}

// ============================================================
// Parse Context (shared state during inline parsing)
// ============================================================

export interface ParseContext {
  linkDefs: Record<string, LinkDef>;
  footnoteDefs: Record<string, InlineNode[]>;
  /** spec: Footnote Reference — a `[^id]` without a definition is plain text */
  definedFootnoteIds: Set<string>;
  warpDefs: Record<string, WarpDefinitionNode>;
  /** Counter for anonymous inline footnotes */
  inlineFootnoteCount: number;
  /** spec: Header — the last top-level `:::header` wins */
  header?: HeaderContainerNode;
  /** spec: Footer — the last top-level `:::footer` wins */
  footer?: FooterContainerNode;
}

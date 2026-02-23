import { describe, it, expect } from "vitest";
import { parseDocument, parseBlocks } from "../src/core/block-parser.js";
import type { ParseContext, HeadingNode, ParagraphNode, CodeBlockNode, HorizontalRuleNode, BlockquoteNode, BulletListNode, OrderedListNode, TableNode } from "../src/core/types.js";

function makeCtx(): ParseContext {
  return {
    linkDefs: {},
    footnoteDefs: {},
    warpDefs: {},
    footnoteRefs: [],
    inlineFootnoteCount: 0,
  };
}

// ============================================================
// Headings
// ============================================================

describe("parseBlocks — headings", () => {
  it("# H1", () => {
    const blocks = parseBlocks(["# Hello"], makeCtx());
    expect(blocks[0].type).toBe("heading");
    const h = blocks[0] as HeadingNode;
    expect(h.level).toBe(1);
    expect(h.children[0]).toEqual({ type: "text", text: "Hello" });
  });

  it("## H2 through ###### H6", () => {
    for (let level = 1; level <= 6; level++) {
      const prefix = "#".repeat(level);
      const blocks = parseBlocks([`${prefix} Level ${level}`], makeCtx());
      expect((blocks[0] as HeadingNode).level).toBe(level);
    }
  });

  it("trailing # is stripped (# Title #)", () => {
    const blocks = parseBlocks(["# Title #"], makeCtx());
    const h = blocks[0] as HeadingNode;
    expect(h.children[0]).toEqual({ type: "text", text: "Title" });
  });

  it("# without space is not a heading", () => {
    const blocks = parseBlocks(["#NoSpace"], makeCtx());
    expect(blocks[0].type).toBe("paragraph");
  });
});

// ============================================================
// Horizontal rule
// ============================================================

describe("parseBlocks — horizontal rule", () => {
  it("---", () => {
    const blocks = parseBlocks(["---"], makeCtx());
    expect(blocks[0].type).toBe("horizontal_rule");
  });

  it("***", () => {
    const blocks = parseBlocks(["***"], makeCtx());
    expect(blocks[0].type).toBe("horizontal_rule");
  });

  it("- - -", () => {
    const blocks = parseBlocks(["- - -"], makeCtx());
    expect(blocks[0].type).toBe("horizontal_rule");
  });

  it("--** is not a horizontal rule", () => {
    const blocks = parseBlocks(["--**"], makeCtx());
    expect(blocks[0].type).not.toBe("horizontal_rule");
  });
});

// ============================================================
// Code block
// ============================================================

describe("parseBlocks — code block", () => {
  it("fenced with ```", () => {
    const blocks = parseBlocks(["```", "const x = 1;", "```"], makeCtx());
    expect(blocks[0].type).toBe("code_block");
    const cb = blocks[0] as CodeBlockNode;
    expect(cb.code).toBe("const x = 1;");
  });

  it("with language: ```js", () => {
    const blocks = parseBlocks(["```js", "console.log('hi');", "```"], makeCtx());
    const cb = blocks[0] as CodeBlockNode;
    expect(cb.language).toBe("js");
  });

  it("with language and filename: ```js:script.js", () => {
    const blocks = parseBlocks(["```js:script.js", "let x;", "```"], makeCtx());
    const cb = blocks[0] as CodeBlockNode;
    expect(cb.language).toBe("js");
    expect(cb.filename).toBe("script.js");
  });

  it("fenced with ~~~", () => {
    const blocks = parseBlocks(["~~~", "code here", "~~~"], makeCtx());
    expect(blocks[0].type).toBe("code_block");
  });

  it("preserves internal markdown as plain text", () => {
    const blocks = parseBlocks(["```", "**not bold**", "```"], makeCtx());
    const cb = blocks[0] as CodeBlockNode;
    expect(cb.code).toBe("**not bold**");
  });
});

// ============================================================
// Blockquote
// ============================================================

describe("parseBlocks — blockquote", () => {
  it("> simple quote", () => {
    const blocks = parseBlocks(["> Hello"], makeCtx());
    expect(blocks[0].type).toBe("blockquote");
    const bq = blocks[0] as BlockquoteNode;
    expect(bq.children[0].type).toBe("paragraph");
  });

  it("nested >> double quote", () => {
    const blocks = parseBlocks(["> > Nested"], makeCtx());
    const bq = blocks[0] as BlockquoteNode;
    expect(bq.children[0].type).toBe("blockquote");
  });
});

// ============================================================
// Lists
// ============================================================

describe("parseBlocks — bullet list", () => {
  it("- item", () => {
    const blocks = parseBlocks(["- Item 1", "- Item 2"], makeCtx());
    expect(blocks[0].type).toBe("bullet_list");
    const list = blocks[0] as BulletListNode;
    expect(list.items).toHaveLength(2);
  });

  it("* item and + item also work", () => {
    for (const marker of ["*", "+"]) {
      const blocks = parseBlocks([`${marker} Item`], makeCtx());
      expect(blocks[0].type).toBe("bullet_list");
    }
  });

  it("checklist: - [ ] and - [x]", () => {
    const blocks = parseBlocks(["- [ ] Todo", "- [x] Done"], makeCtx());
    const list = blocks[0] as BulletListNode;
    expect(list.items[0].checked).toBe(false);
    expect(list.items[1].checked).toBe(true);
  });
});

describe("parseBlocks — ordered list", () => {
  it("1. item", () => {
    const blocks = parseBlocks(["1. First", "2. Second"], makeCtx());
    expect(blocks[0].type).toBe("ordered_list");
    const list = blocks[0] as OrderedListNode;
    expect(list.start).toBe(1);
    expect(list.items).toHaveLength(2);
  });
});

// ============================================================
// Paragraph
// ============================================================

describe("parseBlocks — paragraph", () => {
  it("plain text becomes paragraph", () => {
    const blocks = parseBlocks(["Hello world"], makeCtx());
    expect(blocks[0].type).toBe("paragraph");
  });

  it("blank line separates paragraphs", () => {
    const blocks = parseBlocks(["Para 1", "", "Para 2"], makeCtx());
    expect(blocks).toHaveLength(2);
    expect(blocks[0].type).toBe("paragraph");
    expect(blocks[1].type).toBe("paragraph");
  });
});

// ============================================================
// Table
// ============================================================

describe("parseBlocks — table", () => {
  it("basic table", () => {
    const blocks = parseBlocks([
      "| Name | Age |",
      "| ---- | --- |",
      "| Alice | 30 |",
      "| Bob | 25 |",
    ], makeCtx());
    expect(blocks[0].type).toBe("table");
    const table = blocks[0] as TableNode;
    expect(table.headers).toHaveLength(2);
    expect(table.rows).toHaveLength(2);
    expect(table.isSilent).toBe(false);
  });

  it("alignment row sets alignments", () => {
    const blocks = parseBlocks([
      "| A | B | C | D |",
      "| --- | :--- | :---: | ---: |",
      "| 1 | 2 | 3 | 4 |",
    ], makeCtx());
    const table = blocks[0] as TableNode;
    expect(table.alignments).toEqual(["default", "left", "center", "right"]);
  });

  it("silent table (~ prefix)", () => {
    const blocks = parseBlocks([
      "~ | Col1 | Col2 |",
      "~ | ---- | ---- |",
      "~ | A    | B    |",
    ], makeCtx());
    expect(blocks[0].type).toBe("table");
    const table = blocks[0] as TableNode;
    expect(table.isSilent).toBe(true);
  });
});

// ============================================================
// parseDocument (full document)
// ============================================================

describe("parseDocument", () => {
  it("extracts link definitions", () => {
    const doc = parseDocument("[example]: https://example.com\n\n[Click][example]");
    expect(doc.linkDefs["example"]).toEqual({ href: "https://example.com", title: undefined });
  });

  it("extracts :::header", () => {
    const md = ":::header\nSite Name\n:::\n\nBody text";
    const doc = parseDocument(md);
    expect(doc.header).toBeDefined();
    expect(doc.header?.type).toBe("header_container");
  });

  it("extracts :::footer", () => {
    const md = "Body text\n\n:::footer\n© 2025\n:::";
    const doc = parseDocument(md);
    expect(doc.footer).toBeDefined();
    expect(doc.footer?.type).toBe("footer_container");
  });

  it("extracts :::details", () => {
    const md = ":::details Click to expand\nHidden content\n:::";
    const doc = parseDocument(md);
    expect(doc.body[0].type).toBe("details");
  });

  it("extracts :::warp", () => {
    const md = ":::warp my-section\nWarp content\n:::";
    const doc = parseDocument(md);
    expect(doc.warpDefs["my-section"]).toBeDefined();
  });

  it("closes :::details with indented :::", () => {
    // Formatters (e.g. Prettier) may indent ::: inside a list
    const md = ":::details Title\n- item\n  :::";
    const doc = parseDocument(md);
    expect(doc.body[0].type).toBe("details");
  });

  it("closes :::warp with indented :::", () => {
    const md = ":::warp col\n- item\n      :::";
    const doc = parseDocument(md);
    expect(doc.warpDefs["col"]).toBeDefined();
  });

  it(":::warp nested inside :::details is extracted correctly", () => {
    const md = [
      ":::details Title",
      ":::warp inner",
      "Inner warp content",
      ":::",
      ":::",
    ].join("\n");
    const doc = parseDocument(md);
    expect(doc.body[0].type).toBe("details");
    // warp defined inside details is accessible
    expect(doc.warpDefs["inner"]).toBeDefined();
  });

  it(":::details closes at correct ::: when nested :::warp is present", () => {
    const md = [
      ":::details Title",
      "before",
      ":::warp col",
      "warp content",
      ":::",
      "after",
      ":::",
      "outside",
    ].join("\n");
    const doc = parseDocument(md);
    expect(doc.body[0].type).toBe("details");
    // "outside" should be a separate paragraph, not inside details
    expect(doc.body[1].type).toBe("paragraph");
  });

  it("footnote definition collected", () => {
    const md = "Hello[^note]\n\n[^note]: This is a footnote";
    const doc = parseDocument(md);
    expect(doc.footnoteRefs).toContain("note");
  });

  it("complete document with multiple elements", () => {
    const md = [
      "# Title",
      "",
      "A paragraph with **bold** text.",
      "",
      "- Item 1",
      "- Item 2",
      "",
      "---",
      "",
      "| Col1 | Col2 |",
      "| ---- | ---- |",
      "| A    | B    |",
    ].join("\n");

    const doc = parseDocument(md);
    expect(doc.body.length).toBeGreaterThan(3);
    expect(doc.body[0].type).toBe("heading");
    expect(doc.body[1].type).toBe("paragraph");
  });
});

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

  it("blockquote followed by paragraph does not swallow paragraph", () => {
    const blocks = parseBlocks(["> quote", "regular text"], makeCtx());
    expect(blocks).toHaveLength(2);
    expect(blocks[0].type).toBe("blockquote");
    expect(blocks[1].type).toBe("paragraph");
  });

  it("blockquote contains heading and list", () => {
    const blocks = parseBlocks(["> # Title", "> - item1", "> - item2"], makeCtx());
    const bq = blocks[0] as BlockquoteNode;
    expect(bq.children[0].type).toBe("heading");
    expect(bq.children[1].type).toBe("bullet_list");
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

  it.each([
    [":::"],
    [":::note"],
    ["| a |"],
    ["~ | a |"],
    ["__DETAILS_PLACEHOLDER_x"],
  ])("treats a lone %j line that no block parser accepts as a paragraph", (line) => {
    const blocks = parseBlocks([line], makeCtx());
    expect(blocks).toEqual([{ type: "paragraph", children: [{ type: "text", text: line }] }]);
  });

  it("stops a paragraph before a following ::: line and keeps that line as text", () => {
    const blocks = parseBlocks(["text", ":::"], makeCtx());
    expect(blocks).toEqual([
      { type: "paragraph", children: [{ type: "text", text: "text" }] },
      { type: "paragraph", children: [{ type: "text", text: ":::" }] },
    ]);
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

  it("<< merges a header cell into the cell on its left", () => {
    const blocks = parseBlocks([
      "| Feature | Q1 | << |",
      "| :--- | :--- | :--- |",
      "| Foo | 100 | 200 |",
    ], makeCtx());
    const table = blocks[0] as TableNode;
    expect(table.headers).toHaveLength(2);
    expect(table.headers[1]).toMatchObject({ colspan: 2 });
    expect(table.rows[0]).toHaveLength(3);
  });

  it("repeated << extends colspan", () => {
    const blocks = parseBlocks([
      "| Name | EMEA | << | << |",
      "| --- | --- | --- | --- |",
      "| Alpha | 1 | 2 | 3 |",
    ], makeCtx());
    const table = blocks[0] as TableNode;
    expect(table.headers).toHaveLength(2);
    expect(table.headers[1].colspan).toBe(3);
  });

  it("^^ merges a body cell into the cell above", () => {
    const blocks = parseBlocks([
      "| A | B |",
      "| --- | --- |",
      "| X | 1 |",
      "| ^^ | 2 |",
      "| ^^ | 3 |",
    ], makeCtx());
    const table = blocks[0] as TableNode;
    expect(table.rows[0][0]).toMatchObject({ rowspan: 3 });
    expect(table.rows[1]).toEqual([{ children: [{ type: "text", text: "2" }] }]);
    expect(table.rows[2]).toEqual([{ children: [{ type: "text", text: "3" }] }]);
  });

  it("<< and ^^ together form a rectangular block", () => {
    const blocks = parseBlocks([
      "| A | B | C |",
      "| --- | --- | --- |",
      "| Block | << | x |",
      "| ^^ | ^^ | y |",
    ], makeCtx());
    const table = blocks[0] as TableNode;
    expect(table.rows[0][0]).toMatchObject({ colspan: 2, rowspan: 2 });
    expect(table.rows[1]).toHaveLength(1);
  });

  it("^^ below a colspan cell extends the whole cell", () => {
    const blocks = parseBlocks([
      "| A | B | C |",
      "| --- | --- | --- |",
      "| 1 | span | << |",
      "| 2 | ^^ | ^^ |",
    ], makeCtx());
    const table = blocks[0] as TableNode;
    expect(table.rows[0][1]).toMatchObject({ colspan: 2, rowspan: 2 });
    expect(table.rows[1]).toHaveLength(1);
  });

  it("markers that would form a non-rectangular region are plain text", () => {
    const blocks = parseBlocks([
      "| A | B | C |",
      "| --- | --- | --- |",
      "| 1 | 2 | 3 |",
      "| span | << | << |",
      "| 4 | 5 | ^^ |",
    ], makeCtx());
    const table = blocks[0] as TableNode;
    expect(table.rows[1][0]).toMatchObject({ colspan: 3 });
    expect(table.rows[1][0].rowspan).toBeUndefined();
    expect(table.rows[2][2]).toEqual({ children: [{ type: "text", text: "^^" }] });
  });

  it("only the last marker of a non-rectangular region becomes plain text", () => {
    const blocks = parseBlocks([
      "| A | B |",
      "| --- | --- |",
      "| X | a |",
      "| ^^ | << |",
    ], makeCtx());
    const table = blocks[0] as TableNode;
    expect(table.rows[0][0]).toMatchObject({ rowspan: 2 });
    expect(table.rows[1]).toEqual([{ children: [{ type: "text", text: "<<" }] }]);
  });

  it("markers without a neighbor are plain text", () => {
    const blocks = parseBlocks([
      "| << | ^^ |",
      "| --- | --- |",
      "| ^^ | << |",
      "| << | x |",
    ], makeCtx());
    const table = blocks[0] as TableNode;
    expect(table.headers.map((cell) => cell.children)).toEqual([
      [{ type: "text", text: "<<" }],
      [{ type: "text", text: "^^" }],
    ]);
    expect(table.rows[0][0]).toMatchObject({ colspan: 2 });
    expect(table.rows[0][0].children).toEqual([{ type: "text", text: "^^" }]);
    expect(table.rows[1][0].children).toEqual([{ type: "text", text: "<<" }]);
  });

  it("markers are recognized only as the entire cell content", () => {
    const blocks = parseBlocks([
      "| A | B |",
      "| --- | --- |",
      "| x | a << b |",
      "| y | \\^^ |",
    ], makeCtx());
    const table = blocks[0] as TableNode;
    expect(table.rows[0][1].children).toEqual([{ type: "text", text: "a << b" }]);
    expect(table.rows[1][1].children).toEqual([{ type: "text", text: "^^" }]);
  });

  it("escaped markers are plain text", () => {
    const blocks = parseBlocks([
      "| A | B |",
      "| --- | --- |",
      "| x | \\<< |",
    ], makeCtx());
    const table = blocks[0] as TableNode;
    expect(table.rows[0][1].children).toEqual([{ type: "text", text: "<<" }]);
  });

  it("a full-width block leaves an empty row", () => {
    const blocks = parseBlocks([
      "| A | B |",
      "| --- | --- |",
      "| 1 | << |",
      "| ^^ | ^^ |",
    ], makeCtx());
    const table = blocks[0] as TableNode;
    expect(table.rows[0][0]).toMatchObject({ colspan: 2, rowspan: 2 });
    expect(table.rows[1]).toEqual([]);
  });

  it("merges work in silent tables", () => {
    const blocks = parseBlocks([
      "~ | A | << |",
      "~ | --- | --- |",
      "~ | x | y |",
      "~ | ^^ | z |",
    ], makeCtx());
    const table = blocks[0] as TableNode;
    expect(table.isSilent).toBe(true);
    expect(table.headers[0]).toMatchObject({ colspan: 2 });
    expect(table.rows[0][0]).toMatchObject({ rowspan: 2 });
  });

  it("resolves large non-rectangular regions in linear time", () => {
    const columnCount = 20;
    const rowCount = 2000;
    const lines = [
      "| " + Array.from({ length: columnCount }, (_, column) => `h${column}`).join(" | ") + " |",
      "| " + Array(columnCount).fill("---").join(" | ") + " |",
      "| A | " + Array(columnCount - 1).fill("<<").join(" | ") + " |",
      ...Array.from({ length: rowCount - 1 }, () => "| ^^ | " + Array(columnCount - 1).fill("x").join(" | ") + " |"),
    ];
    const startedAt = performance.now();
    const table = parseBlocks(lines, makeCtx())[0] as TableNode;
    expect(performance.now() - startedAt).toBeLessThan(1000);
    expect(table.rows[0][0]).toMatchObject({ colspan: columnCount });
    expect(table.rows[0][0].rowspan).toBeUndefined();
    expect(table.rows[1][0].children).toEqual([{ type: "text", text: "^^" }]);
  });

  it("\\| is a literal pipe inside a cell", () => {
    const blocks = parseBlocks([
      "| A | B |",
      "| --- | --- |",
      "| a \\| b | c \\|",
    ], makeCtx());
    const table = blocks[0] as TableNode;
    expect(table.rows[0]).toEqual([
      { children: [{ type: "text", text: "a | b" }] },
      { children: [{ type: "text", text: "c |" }] },
    ]);
  });

  it("escaped backslash before a pipe does not escape the pipe", () => {
    const blocks = parseBlocks([
      "| A | B |",
      "| --- | --- |",
      "| path\\\\ | c |",
    ], makeCtx());
    const table = blocks[0] as TableNode;
    expect(table.rows[0]).toEqual([
      { children: [{ type: "text", text: "path\\" }] },
      { children: [{ type: "text", text: "c" }] },
    ]);
  });

  it("an escaped backtick does not open a code span across cells", () => {
    const blocks = parseBlocks([
      "| A | B |",
      "| --- | --- |",
      "| \\`foo` | next |",
    ], makeCtx());
    const table = blocks[0] as TableNode;
    expect(table.rows[0]).toEqual([
      { children: [{ type: "text", text: "`foo`" }] },
      { children: [{ type: "text", text: "next" }] },
    ]);
  });

  it("an unmatched backtick does not open a code span across cells", () => {
    const blocks = parseBlocks([
      "| A | B |",
      "| --- | --- |",
      "| a`b | c |",
    ], makeCtx());
    const table = blocks[0] as TableNode;
    expect(table.rows[0]).toEqual([
      { children: [{ type: "text", text: "a`b" }] },
      { children: [{ type: "text", text: "c" }] },
    ]);
  });

  it("a pipe inside a multi-backtick code span does not split the cell", () => {
    const blocks = parseBlocks([
      "| A | B |",
      "| --- | --- |",
      "| `` a ` | b `` | c |",
    ], makeCtx());
    const table = blocks[0] as TableNode;
    expect(table.rows[0]).toEqual([
      { children: [{ type: "code_span", code: "a ` | b" }] },
      { children: [{ type: "text", text: "c" }] },
    ]);
  });

  it("cells beyond the header width are dropped and short rows are padded", () => {
    const blocks = parseBlocks([
      "| A | B |",
      "| --- | --- |",
      "| 1 | 2 | 3 |",
      "| 4 |",
    ], makeCtx());
    const table = blocks[0] as TableNode;
    expect(table.rows[0]).toHaveLength(2);
    expect(table.rows[1]).toEqual([
      { children: [{ type: "text", text: "4" }] },
      { children: [] },
    ]);
  });

  it("old \\--- syntax is plain text", () => {
    const blocks = parseBlocks([
      "| A |",
      "| --- |",
      "| X |",
      "| \\--- |",
    ], makeCtx());
    const table = blocks[0] as TableNode;
    expect(table.rows[1][0].children).toEqual([{ type: "text", text: "---" }]);
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

  it("removes backslash escapes from link definition destinations and titles", () => {
    const doc = parseDocument('[a\\_id]: https://x/a\\_b "a\\*b \\"c\\""\n\n[label][a\\_id]');
    expect(doc.linkDefs["a\\_id"]).toEqual({ href: "https://x/a_b", title: 'a*b "c"' });
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

  it(":::warp inside a code fence is treated as plain text", () => {
    const md = [
      "```markdown",
      ":::warp my-block",
      "This content can be placed anywhere.",
      ":::",
      "",
      "See it here: [~my-block]",
      "```",
    ].join("\n");
    const doc = parseDocument(md);
    expect(doc.warpDefs["my-block"]).toBeUndefined();
    expect(doc.body[0].type).toBe("code_block");
    const code = doc.body[0] as CodeBlockNode;
    expect(code.code).toContain(":::warp my-block");
    expect(code.code).toContain("See it here: [~my-block]");
  });

  it(":::header inside a code fence is treated as plain text", () => {
    const md = [
      "```",
      ":::header",
      "# Title",
      ":::",
      "```",
    ].join("\n");
    const doc = parseDocument(md);
    expect(doc.header).toBeUndefined();
    expect(doc.body[0].type).toBe("code_block");
  });

  it(":::details inside a code fence is treated as plain text", () => {
    const md = [
      "~~~",
      ":::details Click me",
      "Hidden content",
      ":::",
      "~~~",
    ].join("\n");
    const doc = parseDocument(md);
    expect(doc.body[0].type).toBe("code_block");
    const code = doc.body[0] as CodeBlockNode;
    expect(code.code).toContain(":::details Click me");
  });

  it(":::warp nested inside :::header does not cause infinite loop", () => {
    const md = [
      ":::header",
      "",
      "~ | [~hdr-icon] | [~hdr-title] |",
      "~ | :--- | :--- |",
      "",
      ":::warp hdr-icon",
      "![icon](./icon.png =100x)",
      ":::",
      "",
      ":::warp hdr-title",
      "# Title",
      ":::",
      "",
      ":::",
    ].join("\n");
    const doc = parseDocument(md);
    expect(doc.header).toBeDefined();
    expect(doc.warpDefs["hdr-icon"]).toBeDefined();
    expect(doc.warpDefs["hdr-title"]).toBeDefined();
  });

  it(":::warp nested inside :::footer does not cause infinite loop", () => {
    const md = [
      ":::footer",
      "",
      ":::warp col",
      "Footer content",
      ":::",
      "",
      ":::",
    ].join("\n");
    const doc = parseDocument(md);
    expect(doc.footer).toBeDefined();
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

  it(":::warp nested inside :::warp does not cause infinite loop", () => {
    const md = [
      ":::warp outer",
      ":::warp inner",
      "Inner content",
      ":::",
      ":::",
    ].join("\n");
    const doc = parseDocument(md);
    expect(doc.warpDefs["outer"]).toBeDefined();
    expect(doc.warpDefs["inner"]).toBeDefined();
  });

  it(":::details nested inside :::warp does not cause infinite loop", () => {
    const md = [
      ":::warp warp-with-details",
      ":::details Click me",
      "Hidden content",
      ":::",
      ":::",
    ].join("\n");
    const doc = parseDocument(md);
    expect(doc.warpDefs["warp-with-details"]).toBeDefined();
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

import { describe, it, expect } from "vitest";
import { parseInline } from "../src/core/inline-parser.js";
import type { ParseContext, InlineNode } from "../src/core/types.js";

function makeCtx(overrides: Partial<ParseContext> = {}): ParseContext {
  return {
    linkDefs: {},
    footnoteDefs: {},
    warpDefs: {},
    footnoteRefs: [],
    inlineFootnoteCount: 0,
    ...overrides,
  };
}

function text(t: string): InlineNode {
  return { type: "text", text: t };
}

describe("parseInline — plain text", () => {
  it("returns plain text node", () => {
    const nodes = parseInline("hello world", makeCtx());
    expect(nodes).toEqual([text("hello world")]);
  });

  it("escapes are preserved as-is (escaping is done at render time)", () => {
    const nodes = parseInline("<b>bold</b>", makeCtx());
    expect(nodes).toEqual([text("<b>bold</b>")]);
  });
});

describe("parseInline — code span", () => {
  it("matches single backtick", () => {
    const nodes = parseInline("`code`", makeCtx());
    expect(nodes).toEqual([{ type: "code_span", code: "code" }]);
  });

  it("matches double backtick with space stripping", () => {
    const nodes = parseInline("`` `hello` ``", makeCtx());
    expect(nodes).toEqual([{ type: "code_span", code: "`hello`" }]);
  });

  it("does not interpret markdown inside code span", () => {
    const nodes = parseInline("`**bold**`", makeCtx());
    expect(nodes).toEqual([{ type: "code_span", code: "**bold**" }]);
  });

  it("returns text when backtick is unmatched", () => {
    const nodes = parseInline("`alone", makeCtx());
    expect(nodes).toEqual([text("`alone")]);
  });
});

describe("parseInline — emphasis", () => {
  it("*text*", () => {
    const nodes = parseInline("*hello*", makeCtx());
    expect(nodes).toEqual([
      { type: "emphasis", children: [text("hello")] },
    ]);
  });

  it("_text_", () => {
    const nodes = parseInline("_hello_", makeCtx());
    expect(nodes).toEqual([
      { type: "emphasis", children: [text("hello")] },
    ]);
  });

  it("mixed markers are not recognized (*text_)", () => {
    const nodes = parseInline("*hello_", makeCtx());
    // no matching closer for * → falls through as text
    expect(nodes).toEqual([text("*hello_")]);
  });
});

describe("parseInline — strong", () => {
  it("**text**", () => {
    const nodes = parseInline("**bold**", makeCtx());
    expect(nodes).toEqual([
      { type: "strong", children: [text("bold")] },
    ]);
  });

  it("__text__", () => {
    const nodes = parseInline("__bold__", makeCtx());
    expect(nodes).toEqual([
      { type: "strong", children: [text("bold")] },
    ]);
  });

  it("***text*** → *text* + *", () => {
    const nodes = parseInline("***text***", makeCtx());
    // Triple star: first * literal, then **text**, then * literal
    expect(nodes[0]).toEqual(text("*"));
    expect(nodes[1]).toEqual({ type: "strong", children: [text("text")] });
    expect(nodes[2]).toEqual(text("*"));
  });

  it("**text* → * + *text*", () => {
    const nodes = parseInline("**text*", makeCtx());
    // ** fails (no closing **), each * parsed individually
    expect(nodes).toContainEqual(text("*"));
  });
});

describe("parseInline — strikethrough", () => {
  it("~~text~~", () => {
    const nodes = parseInline("~~hello~~", makeCtx());
    expect(nodes).toEqual([
      { type: "strikethrough", children: [text("hello")] },
    ]);
  });

  it("~~~text~~~ → ~~~ not recognized (triple tilde)", () => {
    // ~~~ at start: the leading ~ is extra, ~~ starts match
    const nodes = parseInline("~~~text~~~", makeCtx());
    // First ~ is literal, then ~~text~~ ... but remaining ~ after ~~ is extra
    // Depends on exact matching: ~~text~~ should be matched
    const strikethoughNode = nodes.find((n) => n.type === "strikethrough");
    expect(strikethoughNode).toBeDefined();
  });

  it("does not span newlines", () => {
    const nodes = parseInline("~~foo\nbar~~", makeCtx());
    // No strikethrough node expected
    expect(nodes.every((n) => n.type !== "strikethrough")).toBe(true);
  });
});

describe("parseInline — inline link", () => {
  it("[text](url)", () => {
    const nodes = parseInline("[Click](https://example.com)", makeCtx());
    expect(nodes).toEqual([
      {
        type: "inline_link",
        text: [text("Click")],
        href: "https://example.com",
        title: undefined,
      },
    ]);
  });

  it('[text](url "title")', () => {
    const nodes = parseInline('[Go](https://example.com "My Site")', makeCtx());
    expect(nodes).toEqual([
      {
        type: "inline_link",
        text: [text("Go")],
        href: "https://example.com",
        title: "My Site",
      },
    ]);
  });

  it("empty text: [](url)", () => {
    const nodes = parseInline("[](https://example.com)", makeCtx());
    expect(nodes[0].type).toBe("inline_link");
  });
});

describe("parseInline — reference link", () => {
  it("[text][id] resolves with linkDefs", () => {
    const ctx = makeCtx({
      linkDefs: { example: { href: "https://example.com", title: "Example" } },
    });
    const nodes = parseInline("[Click][example]", ctx);
    expect(nodes).toEqual([
      {
        type: "link",
        text: [text("Click")],
        href: "https://example.com",
        title: "Example",
      },
    ]);
  });

  it("[text][] uses text as id", () => {
    const ctx = makeCtx({
      linkDefs: { example: { href: "https://example.com" } },
    });
    const nodes = parseInline("[Example][]", ctx);
    expect(nodes[0].type).toBe("link");
    if (nodes[0].type === "link") {
      expect(nodes[0].href).toBe("https://example.com");
    }
  });

  it("unresolved id returns null (no match)", () => {
    const nodes = parseInline("[Click][unknown]", makeCtx());
    // Should not produce a link node
    expect(nodes.every((n) => n.type !== "link")).toBe(true);
  });
});

describe("parseInline — image", () => {
  it("![alt](url)", () => {
    const nodes = parseInline("![logo](logo.png)", makeCtx());
    expect(nodes).toEqual([
      {
        type: "image",
        alt: "logo",
        src: "logo.png",
        title: undefined,
        width: undefined,
        height: undefined,
      },
    ]);
  });

  it("![alt](url =WxH)", () => {
    const nodes = parseInline('![img](photo.jpg =800x600)', makeCtx());
    const img = nodes[0];
    expect(img.type).toBe("image");
    if (img.type === "image") {
      expect(img.width).toBe(800);
      expect(img.height).toBe(600);
    }
  });

  it("![alt](url =Wx) — width only", () => {
    const nodes = parseInline("![img](photo.jpg =300x)", makeCtx());
    const img = nodes[0];
    if (img.type === "image") {
      expect(img.width).toBe(300);
      expect(img.height).toBeUndefined();
    }
  });
});

describe("parseInline — footnote ref", () => {
  it("[^id] records the ref", () => {
    const ctx = makeCtx({
      footnoteDefs: { note: [text("Footnote text")] },
    });
    const nodes = parseInline("Hello[^note] world", ctx);
    const ref = nodes.find((n) => n.type === "footnote_ref");
    expect(ref).toBeDefined();
    expect(ctx.footnoteRefs).toContain("note");
  });
});

describe("parseInline — inline footnote", () => {
  it("^[text] creates inline footnote", () => {
    const ctx = makeCtx();
    const nodes = parseInline("Hello^[inline note] world", ctx);
    const fn = nodes.find((n) => n.type === "inline_footnote");
    expect(fn).toBeDefined();
    expect(ctx.inlineFootnoteCount).toBe(1);
  });
});

describe("parseInline — warp ref", () => {
  it("[~id] produces warp_ref node", () => {
    const nodes = parseInline("[~my-section]", makeCtx());
    expect(nodes).toEqual([{ type: "warp_ref", id: "my-section" }]);
  });
});

describe("parseInline — line break", () => {
  it("newline becomes line_break node", () => {
    const nodes = parseInline("line1\nline2", makeCtx());
    expect(nodes.some((n) => n.type === "line_break")).toBe(true);
  });
});

describe("parseInline — nested", () => {
  it("**bold with *italic* inside**", () => {
    const nodes = parseInline("**bold with *italic* inside**", makeCtx());
    expect(nodes[0].type).toBe("strong");
    if (nodes[0].type === "strong") {
      const emphasisNode = nodes[0].children.find(
        (n) => n.type === "emphasis"
      );
      expect(emphasisNode).toBeDefined();
    }
  });

  it("mixed inline: `code` and **bold**", () => {
    const nodes = parseInline("`code` and **bold**", makeCtx());
    expect(nodes[0].type).toBe("code_span");
    expect(nodes[nodes.length - 1].type).toBe("strong");
  });
});

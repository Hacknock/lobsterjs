import { describe, it, expect } from "vitest";
import { toHTML } from "../../src/index.node.js";

const paragraph = (html: string) => `<p class="lbs-paragraph">${html}</p>`;
const inline = (markdown: string) => toHTML(markdown);
const emphasis = (html: string) => `<span class="lbs-emphasis">${html}</span>`;
const strong = (html: string) => `<span class="lbs-strong">${html}</span>`;
const strikethrough = (html: string) => `<span class="lbs-strikethrough">${html}</span>`;
const code = (html: string) => `<code class="lbs-code-span">${html}</code>`;

describe("Backslash Escapes", () => {
  it.each([
    ["\\*not emphasis\\*", "*not emphasis*"],
    ["\\# not a heading", "# not a heading"],
    ["\\[not a link\\](x)", "[not a link](x)"],
    ["\\`not code\\`", "`not code`"],
    ["\\~\\~not struck\\~\\~", "~~not struck~~"],
  ])("makes ASCII punctuation literal in %j", (markdown, html) => {
    expect(inline(markdown)).toBe(paragraph(html));
  });

  it("can escape every ASCII punctuation character", () => {
    const punctuation = "!\"#$%&'()*+,-./:;<=>?@[\\]^_`{|}~";
    const escaped = Array.from(punctuation, (character) => `\\${character}`).join("");
    expect(inline(`x ${escaped}`)).toBe(
      paragraph("x !&quot;#$%&amp;&#39;()*+,-./:;&lt;=&gt;?@[\\]^_`{|}~")
    );
  });

  it("keeps a backslash before any other character", () => {
    expect(inline("C:\\path")).toBe(paragraph("C:\\path"));
  });

  it("turns \\\\ into a single backslash", () => {
    expect(inline("a\\\\b")).toBe(paragraph("a\\b"));
  });

  it("is not interpreted inside code spans", () => {
    expect(inline("`\\*`")).toBe(paragraph(code("\\*")));
  });

  it("is removed in link destinations and titles", () => {
    expect(inline('[t](http://x/a\\_b "a\\"b")')).toBe(paragraph('<a href="http://x/a_b" title="a&quot;b">t</a>'));
  });

  it("is removed in image alt text and titles", () => {
    expect(inline("![a\\*b](x.png 'c\\'d')")).toBe(
      paragraph('<img src="x.png" alt="a*b" title="c&#39;d" class="lbs-image">')
    );
  });

  it("is removed in reference link definitions", () => {
    expect(inline('[t][id]\n\n[id]: http://x/a\\_b "a\\*b"')).toBe(paragraph('<a href="http://x/a_b" title="a*b">t</a>'));
  });

  it("does not let an escaped ] close link text", () => {
    expect(inline("[a\\]b](http://x)")).toBe(paragraph('<a href="http://x">a]b</a>'));
  });

  it("does not let an escaped ) close a link destination", () => {
    expect(inline("[a](http://x/\\)y)")).toBe(paragraph('<a href="http://x/)y">a</a>'));
  });
});

describe("Delimiter Rules for Emphasis, Strong, and Strikethrough", () => {
  it("an opener followed by whitespace is literal", () => {
    expect(inline("2 * 3 * 4")).toBe(paragraph("2 * 3 * 4"));
  });

  it.each(["a ** b ** c", "a ~~ b ~~ c"])("%j stays as-is", (markdown) => {
    expect(inline(markdown)).toBe(paragraph(markdown));
  });

  it("a closer preceded by whitespace is not a closer", () => {
    expect(inline("*a *")).toBe(paragraph("*a *"));
  });

  it("_ inside a word is literal", () => {
    expect(inline("snake_case_name")).toBe(paragraph("snake_case_name"));
  });

  it("__ inside a word is literal", () => {
    expect(inline("a__b__c")).toBe(paragraph("a__b__c"));
  });

  it("_ between Japanese characters is literal", () => {
    expect(inline("日本_語_です")).toBe(paragraph("日本_語_です"));
  });

  it("_ next to a supplementary-plane letter is intraword", () => {
    expect(inline("𠮷_a_")).toBe(paragraph("𠮷_a_"));
  });

  it("* works inside a word", () => {
    expect(inline("foo*bar*baz")).toBe(paragraph(`foo${emphasis("bar")}baz`));
  });

  it("strong may wrap Japanese brackets", () => {
    expect(inline("**「強調」**です")).toBe(paragraph(`${strong("「強調」")}です`));
  });
});

describe("Code Span", () => {
  it("renders `code`", () => {
    expect(inline("a `code` b")).toBe(paragraph(`a ${code("code")} b`));
  });

  it("uses N backticks to include fewer backticks", () => {
    expect(inline("`` `code` ``")).toBe(paragraph(code("`code`")));
  });

  it("strips one space on each side when the delimiter has two or more backticks", () => {
    expect(inline("``  a  ``")).toBe(paragraph(code(" a ")));
  });

  it("keeps spaces with a single backtick", () => {
    expect(inline("` a `")).toBe(paragraph(code(" a ")));
  });

  it("does not parse Markdown inside", () => {
    expect(inline("`**a** [b](c)`")).toBe(paragraph(code("**a** [b](c)")));
  });

  it("escapes HTML inside", () => {
    expect(inline("`<b>`")).toBe(paragraph(code("&lt;b&gt;")));
  });

  it("closes only at a backtick run of the same length", () => {
    expect(inline("``a```b``")).toBe(paragraph(code("a```b")));
  });

  it("keeps an unclosed backtick run as text", () => {
    expect(inline("x ```a`")).toBe(paragraph("x ```a`"));
  });
});

describe("Emphasis (Italic)", () => {
  it.each(["*text*", "_text_"])("renders %j", (markdown) => {
    expect(inline(markdown)).toBe(paragraph(emphasis("text")));
  });

  it("needs the same character on both sides", () => {
    expect(inline("*text_")).toBe(paragraph("*text_"));
  });

  it("cannot span newlines", () => {
    expect(inline("*a\nb*")).toBe(paragraph("*a<br>b*"));
  });

  it("**text* is a literal * and emphasis", () => {
    expect(inline("**text*")).toBe(paragraph(`*${emphasis("text")}`));
  });
});

describe("Strong (Bold)", () => {
  it.each(["**text**", "__text__"])("renders %j", (markdown) => {
    expect(inline(markdown)).toBe(paragraph(strong("text")));
  });

  it("cannot span newlines", () => {
    expect(inline("**a\nb**")).toBe(paragraph("**a<br>b**"));
  });

  it("***text*** is a literal *, strong, and a literal *", () => {
    expect(inline("***text***")).toBe(paragraph(`*${strong("text")}*`));
  });

  it("can contain emphasis", () => {
    expect(inline("**bold *italic* bold**")).toBe(paragraph(strong(`bold ${emphasis("italic")} bold`)));
  });
});

describe("Strikethrough", () => {
  it("renders ~~text~~", () => {
    expect(inline("~~text~~")).toBe(paragraph(strikethrough("text")));
  });

  it("recognizes only the innermost ~~ pair of ~~~text~~~", () => {
    expect(inline("a ~~~text~~~")).toBe(paragraph(`a ~${strikethrough("text")}~`));
  });

  it("cannot span newlines", () => {
    expect(inline("~~a\nb~~")).toBe(paragraph("~~a<br>b~~"));
  });
});

describe("Inline Link", () => {
  it("renders [text](url)", () => {
    expect(inline("[text](http://x)")).toBe(paragraph('<a href="http://x">text</a>'));
  });

  it.each(['"T"', "'T'", "(T)"])("accepts the title %s", (title) => {
    expect(inline(`[text](http://x ${title})`)).toBe(paragraph('<a href="http://x" title="T">text</a>'));
  });

  it("allows an empty url and empty text", () => {
    expect(inline("[text]() [](http://x)")).toBe(paragraph('<a href="">text</a> <a href="http://x"></a>'));
  });

  it("does not allow a space between ] and (", () => {
    expect(inline("[text] (http://x)")).toBe(paragraph("[text] (http://x)"));
  });

  it("parses Markdown in the text", () => {
    expect(inline("[**b**](http://x)")).toBe(paragraph(`<a href="http://x">${strong("b")}</a>`));
  });

  it("escapes the url and title", () => {
    expect(inline('[t](a"b "c<d")')).toBe(paragraph('<a href="a&quot;b" title="c&lt;d">t</a>'));
  });
});

describe("Reference Link", () => {
  it("resolves [text][id] with a definition anywhere in the document", () => {
    expect(inline("[text][id]\n\n[id]: http://x")).toBe(paragraph('<a href="http://x">text</a>'));
  });

  it("uses the text as the id for [text][]", () => {
    expect(inline("[Docs][]\n\n[docs]: http://x")).toBe(paragraph('<a href="http://x">Docs</a>'));
  });

  it("resolves [text] when the text matches a definition", () => {
    expect(inline("[Docs]\n\n[docs]: http://x")).toBe(paragraph('<a href="http://x">Docs</a>'));
  });

  it("looks up ids case-insensitively", () => {
    expect(inline("[text][ID]\n\n[id]: http://x")).toBe(paragraph('<a href="http://x">text</a>'));
  });

  it.each(['"T"', "'T'", "(T)"])("accepts the definition title %s", (title) => {
    expect(inline(`[text][id]\n\n[id]: http://x ${title}`)).toBe(paragraph('<a href="http://x" title="T">text</a>'));
  });

  it("lets several references share one definition", () => {
    expect(inline("[a][id] [b][id]\n\n[id]: http://x")).toBe(
      paragraph('<a href="http://x">a</a> <a href="http://x">b</a>')
    );
  });

  it("stays as text without a definition", () => {
    expect(inline("[text][missing]")).toBe(paragraph("[text][missing]"));
  });

  it("uses the last definition of an id", () => {
    expect(inline("[t][id]\n\n[id]: http://a\n[id]: http://b")).toBe(paragraph('<a href="http://b">t</a>'));
  });

  it("does not render definition lines", () => {
    expect(inline("[id]: http://x")).toBe("");
  });
});

describe("Image", () => {
  it("renders ![alt](url)", () => {
    expect(inline("![alt](x.png)")).toBe(paragraph('<img src="x.png" alt="alt" class="lbs-image">'));
  });

  it("accepts a title and a size", () => {
    expect(inline('![alt](x.png "T" =800x600)')).toBe(
      paragraph('<img src="x.png" alt="alt" title="T" width="800" height="600" class="lbs-image">')
    );
  });

  it.each([
    ["=800x", ' width="800"'],
    ["=x600", ' height="600"'],
  ])("accepts a partial size %s", (size, attributes) => {
    expect(inline(`![alt](x.png ${size})`)).toBe(paragraph(`<img src="x.png" alt="alt"${attributes} class="lbs-image">`));
  });

  it("needs ! and [ to be adjacent", () => {
    expect(inline("! [alt](x.png)")).toBe(paragraph('! <a href="x.png">alt</a>'));
  });

  it("escapes the src, alt, and title", () => {
    expect(inline('![a"b](x"y.png "<t>")')).toBe(
      paragraph('<img src="x&quot;y.png" alt="a&quot;b" title="&lt;t&gt;" class="lbs-image">')
    );
  });
});

describe("Evaluation order", () => {
  it("a backslash escape wins over a code span", () => {
    expect(inline("\\`a`")).toBe(paragraph("`a`"));
  });

  it("a code span wins over emphasis that starts later", () => {
    expect(inline("`*a*` *b*")).toBe(paragraph(`${code("*a*")} ${emphasis("b")}`));
  });

  it("an image wins over a link", () => {
    expect(inline("![a](x.png)")).toBe(paragraph('<img src="x.png" alt="a" class="lbs-image">'));
  });

  it("an inline link wins over a reference link", () => {
    expect(inline("[t](http://inline)\n\n[t]: http://reference")).toBe(paragraph('<a href="http://inline">t</a>'));
  });
});

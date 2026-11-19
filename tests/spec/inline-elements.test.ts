import { describe, it, expect } from "vitest";
import { toHTML } from "../../src/index.node.js";

const paragraph = (html: string) => `<p class="lbs-paragraph">${html}</p>`;
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
    expect(toHTML(markdown)).toBe(paragraph(html));
  });

  it("can escape every ASCII punctuation character", () => {
    const punctuation = "!\"#$%&'()*+,-./:;<=>?@[\\]^_`{|}~";
    const escaped = Array.from(punctuation, (character) => `\\${character}`).join("");
    expect(toHTML(`x ${escaped}`)).toBe(
      paragraph("x !&quot;#$%&amp;&#39;()*+,-./:;&lt;=&gt;?@[\\]^_`{|}~")
    );
  });

  it("keeps a backslash before any other character", () => {
    expect(toHTML("C:\\path")).toBe(paragraph("C:\\path"));
  });

  it("turns \\\\ into a single backslash", () => {
    expect(toHTML("a\\\\b")).toBe(paragraph("a\\b"));
  });

  it("is not interpreted inside code spans", () => {
    expect(toHTML("`\\*`")).toBe(paragraph(code("\\*")));
  });

  it("is removed in link destinations and titles", () => {
    expect(toHTML('[t](http://x/a\\_b "a\\"b")')).toBe(paragraph('<a href="http://x/a_b" title="a&quot;b">t</a>'));
  });

  it("is removed in image alt text and titles", () => {
    expect(toHTML("![a\\*b](x.png 'c\\'d')")).toBe(
      paragraph('<img src="x.png" alt="a*b" title="c&#39;d" class="lbs-image">')
    );
  });

  it("is removed in reference link definitions", () => {
    expect(toHTML('[t][id]\n\n[id]: http://x/a\\_b "a\\*b"')).toBe(paragraph('<a href="http://x/a_b" title="a*b">t</a>'));
  });

  it("is removed in parenthesized and single-quoted link titles", () => {
    expect(toHTML("[a](u (x\\)y)) [b](u 'p\\'q')")).toBe(
      paragraph('<a href="u" title="x)y">a</a> <a href="u" title="p&#39;q">b</a>')
    );
  });

  it("is not interpreted in reference link, footnote, or warp ids", () => {
    expect(toHTML("[t][a\\_b] x[^c\\_d]\n\n[a\\_b]: http://x\n[^c\\_d]: note")).toBe(
      paragraph('<a href="http://x">t</a> x<sup class="lbs-footnote-ref"><a href="#lbs-fn-c\\_d" id="lbs-fnref-c\\_d-0">[1]</a></sup>') +
        '\n<section class="lbs-footnotes">\n<ol>\n<li id="lbs-fn-c\\_d" class="lbs-footnote-item">[1] note</li>\n</ol>\n</section>'
    );
  });

  it("does not let an escaped delimiter close emphasis", () => {
    expect(inline("*a \\* b* *c\\**")).toBe(paragraph(`${emphasis("a * b")} ${emphasis("c*")}`));
  });

  it("does not let an escaped ] close link text", () => {
    expect(toHTML("[a\\]b](http://x)")).toBe(paragraph('<a href="http://x">a]b</a>'));
  });

  it("does not let an escaped ) close a link destination", () => {
    expect(toHTML("[a](http://x/\\)y)")).toBe(paragraph('<a href="http://x/)y">a</a>'));
  });
});

describe("Delimiter Rules for Emphasis, Strong, and Strikethrough", () => {
  it("an opener followed by whitespace is literal", () => {
    expect(toHTML("2 * 3 * 4")).toBe(paragraph("2 * 3 * 4"));
  });

  it.each(["a ** b ** c", "a ~~ b ~~ c"])("%j stays as-is", (markdown) => {
    expect(toHTML(markdown)).toBe(paragraph(markdown));
  });

  it("a closer preceded by whitespace is not a closer", () => {
    expect(toHTML("*a *")).toBe(paragraph("*a *"));
  });

  it("_ inside a word is literal", () => {
    expect(toHTML("snake_case_name")).toBe(paragraph("snake_case_name"));
  });

  it("__ inside a word is literal", () => {
    expect(toHTML("a__b__c")).toBe(paragraph("a__b__c"));
  });

  it("_ between Japanese characters is literal", () => {
    expect(toHTML("日本_語_です")).toBe(paragraph("日本_語_です"));
  });

  it("_ next to a supplementary-plane letter is intraword", () => {
    expect(toHTML("𠮷_a_")).toBe(paragraph("𠮷_a_"));
  });

  it("_ followed by a letter does not close", () => {
    expect(toHTML("_foo_bar_")).toBe(paragraph(emphasis("foo_bar")));
  });

  it("_ followed by a supplementary-plane letter does not close", () => {
    expect(toHTML("_name_𠮷")).toBe(paragraph("_name_𠮷"));
  });

  it("_ next to a supplementary-plane non-letter can still delimit", () => {
    expect(inline("😀 _name_ 😀")).toBe(paragraph(`😀 ${emphasis("name")} 😀`));
  });

  it("* works inside a word", () => {
    expect(toHTML("foo*bar*baz")).toBe(paragraph(`foo${emphasis("bar")}baz`));
  });

  it("strong may wrap Japanese brackets", () => {
    expect(toHTML("**「強調」**です")).toBe(paragraph(`${strong("「強調」")}です`));
  });
});

describe("Code Span", () => {
  it("renders `code`", () => {
    expect(toHTML("a `code` b")).toBe(paragraph(`a ${code("code")} b`));
  });

  it("uses N backticks to include fewer backticks", () => {
    expect(toHTML("`` `code` ``")).toBe(paragraph(code("`code`")));
  });

  it("strips one space on each side when the delimiter has two or more backticks", () => {
    expect(toHTML("``  a  ``")).toBe(paragraph(code(" a ")));
  });

  it("keeps spaces with a single backtick", () => {
    expect(toHTML("` a `")).toBe(paragraph(code(" a ")));
  });

  it("does not parse Markdown inside", () => {
    expect(toHTML("`**a** [b](c)`")).toBe(paragraph(code("**a** [b](c)")));
  });

  it("escapes HTML inside", () => {
    expect(toHTML("`<b>`")).toBe(paragraph(code("&lt;b&gt;")));
  });

  it("closes only at a backtick run of the same length", () => {
    expect(toHTML("``a```b``")).toBe(paragraph(code("a```b")));
  });

  it("keeps an unclosed backtick run as text", () => {
    expect(toHTML("x ```a`")).toBe(paragraph("x ```a`"));
  });
});

describe("Emphasis (Italic)", () => {
  it.each(["*text*", "_text_"])("renders %j", (markdown) => {
    expect(toHTML(markdown)).toBe(paragraph(emphasis("text")));
  });

  it("needs the same character on both sides", () => {
    expect(toHTML("*text_")).toBe(paragraph("*text_"));
  });

  it("cannot span newlines", () => {
    expect(toHTML("*a\nb*")).toBe(paragraph("*a<br>b*"));
  });

  it("**text* is a literal * and emphasis", () => {
    expect(toHTML("**text*")).toBe(paragraph(`*${emphasis("text")}`));
  });
});

describe("Strong (Bold)", () => {
  it.each(["**text**", "__text__"])("renders %j", (markdown) => {
    expect(toHTML(markdown)).toBe(paragraph(strong("text")));
  });

  it("cannot span newlines", () => {
    expect(toHTML("**a\nb**")).toBe(paragraph("**a<br>b**"));
  });

  it("***text*** is a literal *, strong, and a literal *", () => {
    expect(toHTML("***text***")).toBe(paragraph(`*${strong("text")}*`));
  });

  it("can contain emphasis", () => {
    expect(toHTML("**bold *italic* bold**")).toBe(paragraph(strong(`bold ${emphasis("italic")} bold`)));
  });
});

describe("Strikethrough", () => {
  it("renders ~~text~~", () => {
    expect(toHTML("~~text~~")).toBe(paragraph(strikethrough("text")));
  });

  it("recognizes only the innermost ~~ pair of ~~~text~~~", () => {
    expect(toHTML("a ~~~text~~~")).toBe(paragraph(`a ~${strikethrough("text")}~`));
  });

  it("cannot span newlines", () => {
    expect(toHTML("~~a\nb~~")).toBe(paragraph("~~a<br>b~~"));
  });
});

describe("Inline Link", () => {
  it("renders [text](url)", () => {
    expect(toHTML("[text](http://x)")).toBe(paragraph('<a href="http://x">text</a>'));
  });

  it.each(['"T"', "'T'", "(T)"])("accepts the title %s", (title) => {
    expect(toHTML(`[text](http://x ${title})`)).toBe(paragraph('<a href="http://x" title="T">text</a>'));
  });

  it("allows an empty url and empty text", () => {
    expect(toHTML("[text]() [](http://x)")).toBe(paragraph('<a href="">text</a> <a href="http://x"></a>'));
  });

  it("does not allow a space between ] and (", () => {
    expect(toHTML("[text] (http://x)")).toBe(paragraph("[text] (http://x)"));
  });

  it("parses Markdown in the text", () => {
    expect(toHTML("[**b**](http://x)")).toBe(paragraph(`<a href="http://x">${strong("b")}</a>`));
  });

  it("escapes the url and title", () => {
    expect(toHTML('[t](a"b "c<d")')).toBe(paragraph('<a href="a&quot;b" title="c&lt;d">t</a>'));
  });
});

describe("Reference Link", () => {
  it("resolves [text][id] with a definition anywhere in the document", () => {
    expect(toHTML("[text][id]\n\n[id]: http://x")).toBe(paragraph('<a href="http://x">text</a>'));
  });

  it("uses the text as the id for [text][]", () => {
    expect(toHTML("[Docs][]\n\n[docs]: http://x")).toBe(paragraph('<a href="http://x">Docs</a>'));
  });

  it("resolves [text] when the text matches a definition", () => {
    expect(toHTML("[Docs]\n\n[docs]: http://x")).toBe(paragraph('<a href="http://x">Docs</a>'));
  });

  it("looks up ids case-insensitively", () => {
    expect(toHTML("[text][ID]\n\n[id]: http://x")).toBe(paragraph('<a href="http://x">text</a>'));
  });

  it.each(['"T"', "'T'", "(T)"])("accepts the definition title %s", (title) => {
    expect(toHTML(`[text][id]\n\n[id]: http://x ${title}`)).toBe(paragraph('<a href="http://x" title="T">text</a>'));
  });

  it("lets several references share one definition", () => {
    expect(toHTML("[a][id] [b][id]\n\n[id]: http://x")).toBe(
      paragraph('<a href="http://x">a</a> <a href="http://x">b</a>')
    );
  });

  it("stays as text without a definition", () => {
    expect(toHTML("[text][missing]")).toBe(paragraph("[text][missing]"));
  });

  it("uses the last definition of an id", () => {
    expect(toHTML("[t][id]\n\n[id]: http://a\n[id]: http://b")).toBe(paragraph('<a href="http://b">t</a>'));
  });

  it("does not render definition lines", () => {
    expect(toHTML("[id]: http://x")).toBe("");
  });
});

describe("Image", () => {
  it("renders ![alt](url)", () => {
    expect(toHTML("![alt](x.png)")).toBe(paragraph('<img src="x.png" alt="alt" class="lbs-image">'));
  });

  it("accepts a title and a size", () => {
    expect(toHTML('![alt](x.png "T" =800x600)')).toBe(
      paragraph('<img src="x.png" alt="alt" title="T" width="800" height="600" class="lbs-image">')
    );
  });

  it.each([
    ["=800x", ' width="800"'],
    ["=x600", ' height="600"'],
  ])("accepts a partial size %s", (size, attributes) => {
    expect(toHTML(`![alt](x.png ${size})`)).toBe(paragraph(`<img src="x.png" alt="alt"${attributes} class="lbs-image">`));
  });

  it("needs ! and [ to be adjacent", () => {
    expect(toHTML("! [alt](x.png)")).toBe(paragraph('! <a href="x.png">alt</a>'));
  });

  it("escapes the src, alt, and title", () => {
    expect(toHTML('![a"b](x"y.png "<t>")')).toBe(
      paragraph('<img src="x&quot;y.png" alt="a&quot;b" title="&lt;t&gt;" class="lbs-image">')
    );
  });
});

describe("Evaluation order", () => {
  it("a backslash escape wins over a code span", () => {
    expect(toHTML("\\`a`")).toBe(paragraph("`a`"));
  });

  it("a code span wins over emphasis that starts later", () => {
    expect(toHTML("`*a*` *b*")).toBe(paragraph(`${code("*a*")} ${emphasis("b")}`));
  });

  it("an inline footnote wins over a footnote reference", () => {
    expect(toHTML("a^[^n]\n\n[^n]: named")).toBe(
      paragraph('a<sup class="lbs-footnote-ref"><a href="#lbs-fn-__inline_1" id="lbs-fnref-__inline_1-0">[1]</a></sup>') +
        '\n<section class="lbs-footnotes">\n<ol>\n<li id="lbs-fn-__inline_1" class="lbs-footnote-item">[1] ^n</li>\n</ol>\n</section>'
    );
  });

  it("an image wins over a link", () => {
    expect(toHTML("![a](x.png)")).toBe(paragraph('<img src="x.png" alt="a" class="lbs-image">'));
  });

  it("an inline link wins over a reference link", () => {
    expect(toHTML("[t](http://inline)\n\n[t]: http://reference")).toBe(paragraph('<a href="http://inline">t</a>'));
  });
});

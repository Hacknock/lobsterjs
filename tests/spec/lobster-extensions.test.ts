import { describe, it, expect } from "vitest";
import { toHTML } from "../../src/index.node.js";

const paragraph = (html: string) => `<p class="lbs-paragraph">${html}</p>`;
const details = (title: string, html: string) =>
  `<details class="lbs-details">\n<summary class="lbs-summary">${title}</summary>\n${html}\n</details>`;
const codeBlock = (code: string) => `<div class="lbs-code-block"><pre><code>${code}</code></pre></div>`;
const table = (head: string, body: string, className = "lbs-table") =>
  `<table class="${className}">\n<thead><tr>${head}</tr></thead>\n<tbody>\n${body}\n</tbody>\n</table>`;

describe("Lobster Extensions", () => {
  it("closes a block at a ::: line, ignoring leading whitespace", () => {
    expect(toHTML(":::details T\n- item\n  :::\nafter")).toBe(
      `${details("T", '<ul class="lbs-ul lbs-ul-depth-0">\n<li class="lbs-list-item">item</li>\n</ul>')}\n${paragraph("after")}`
    );
  });

  it.each([
    [":::note\nhello\n:::", `${paragraph(":::note<br>hello")}\n${paragraph(":::")}`],
    [":::warp\nno id\n:::", `${paragraph(":::warp<br>no id")}\n${paragraph(":::")}`],
    ["text\n\n:::", `${paragraph("text")}\n${paragraph(":::")}`],
  ])("treats %j, which opens or closes no block, as plain text", (markdown, html) => {
    expect(toHTML(markdown)).toBe(html);
  });

  it("skips fenced code when looking for the closing :::", () => {
    expect(toHTML(":::details T\n```\n:::\n```\n:::")).toBe(details("T", codeBlock(":::")));
  });

  it("ends an unclosed code block where the ::: block ends", () => {
    expect(toHTML(":::details T\n```\ncode\n:::\n\nafter")).toBe(`${details("T", codeBlock("code"))}\n${paragraph("after")}`);
  });

  it("ends the paragraph right before an opener without a blank line", () => {
    expect(toHTML("before\n:::details T\nx\n:::\nafter")).toBe(
      `${paragraph("before")}\n${details("T", paragraph("x"))}\n${paragraph("after")}`
    );
  });

  it("ends the list right before an opener", () => {
    expect(toHTML("- a\n:::details T\nx\n:::\n- b")).toBe(
      '<ul class="lbs-ul lbs-ul-depth-0">\n<li class="lbs-list-item">a</li>\n</ul>\n' +
        `${details("T", paragraph("x"))}\n` +
        '<ul class="lbs-ul lbs-ul-depth-0">\n<li class="lbs-list-item">b</li>\n</ul>'
    );
  });

  it("ends the table right before an opener", () => {
    expect(toHTML("| a |\n| - |\n| 1 |\n:::details T | x\ny\n:::")).toBe(
      `${table("<th>a</th>", "<tr><td>1</td></tr>")}\n${details("T | x", paragraph("y"))}`
    );
  });

  it("does not recognize ::: blocks inside a blockquote", () => {
    expect(toHTML("> :::details T\n> x\n> :::")).toBe(
      `<blockquote class="lbs-blockquote">${paragraph(":::details T<br>x")}\n${paragraph(":::")}</blockquote>`
    );
  });

  it("keeps a ::: line with a pipe as a table row inside a blockquote", () => {
    expect(toHTML("> | h | h |\n> | - | - |\n> :::details T | cell")).toBe(
      `<blockquote class="lbs-blockquote">${table("<th>h</th><th>h</th>", "<tr><td>:::details T</td><td>cell</td></tr>")}</blockquote>`
    );
  });

  it("ignores a header or footer nested in another block, with its content", () => {
    expect(toHTML(":::details T\n:::header\nH\n:::\n:::footer\nF\n:::\nbody\n:::")).toBe(details("T", paragraph("body")));
  });
});

describe("Header", () => {
  it("renders before the body wherever it is written", () => {
    expect(toHTML("body\n\n:::header\n# Site\n:::")).toBe(
      `<header class="lbs-header"><h1 class="lbs-heading-1">Site</h1></header>\n${paragraph("body")}`
    );
  });

  it("ignores a header or footer nested inside it", () => {
    expect(toHTML(":::header\n:::header\nX\n:::\n:::footer\nY\n:::\nSite\n:::")).toBe(
      `<header class="lbs-header">${paragraph("Site")}</header>`
    );
  });

  it("uses the last header", () => {
    expect(toHTML(":::header\nA\n:::\n\n:::header\nB\n:::")).toBe(`<header class="lbs-header">${paragraph("B")}</header>`);
  });
});

describe("Footer", () => {
  it("renders at the very end, after the footnote section", () => {
    expect(toHTML(":::footer\nF\n:::\n\nbody[^1]\n\n[^1]: note")).toBe(
      `${paragraph('body<sup class="lbs-footnote-ref"><a href="#lbs-fn-1" id="lbs-fnref-1-0">[1]</a></sup>')}\n` +
        '<section class="lbs-footnotes">\n<ol>\n<li id="lbs-fn-1" class="lbs-footnote-item">[1] note</li>\n</ol>\n</section>\n' +
        `<footer class="lbs-footer">${paragraph("F")}</footer>`
    );
  });

  it("uses the last footer", () => {
    expect(toHTML(":::footer\nA\n:::\n\n:::footer\nB\n:::")).toBe(`<footer class="lbs-footer">${paragraph("B")}</footer>`);
  });
});

describe("Details", () => {
  it("takes the rest of the opening line as an escaped, unparsed title", () => {
    expect(toHTML(":::details **Bold** & <x>\ncontent\n:::")).toBe(
      details("**Bold** &amp; &lt;x&gt;", paragraph("content"))
    );
  });

  it("closes at the right ::: when it contains a warp", () => {
    expect(toHTML(":::details T\n:::warp w\nW\n:::\nx\n:::\n\n[~w]")).toBe(`${details("T", paragraph("x"))}\n${paragraph("W")}`);
  });

  it("closes at the ::: after an unknown :::note inside it", () => {
    expect(toHTML(":::details T\n:::note\ninner\n:::\nafter\n:::")).toBe(
      `${details("T", paragraph(":::note<br>inner"))}\n${paragraph("after")}\n${paragraph(":::")}`
    );
  });

  it("can be nested", () => {
    expect(toHTML(":::details Outer\n:::details Inner\nx\n:::\ny\n:::")).toBe(
      details("Outer", `${details("Inner", paragraph("x"))}\n${paragraph("y")}`)
    );
  });

  it("needs a title", () => {
    expect(toHTML(":::details\nx\n:::")).toBe(`${paragraph(":::details<br>x")}\n${paragraph(":::")}`);
  });
});

describe("Warp", () => {
  it("is not rendered where it is defined", () => {
    expect(toHTML(":::warp a\nhidden\n:::\n\nbody")).toBe(paragraph("body"));
  });

  it("is rendered in the header row of a silent table (pattern A)", () => {
    expect(toHTML("~ | [~left] | [~right] |\n~ | :--- | :--- |\n\n:::warp left\nL\n:::\n\n:::warp right\nR\n:::")).toBe(
      table(
        `<th style="text-align:left">${paragraph("L")}</th><th style="text-align:left">${paragraph("R")}</th>`,
        "",
        "lbs-table lbs-table-silent"
      )
    );
  });

  it("is rendered in a data row of a silent table (pattern B)", () => {
    expect(toHTML("~ | left | right |\n~ | :--- | :--- |\n~ | [~left] | [~right] |\n\n:::warp left\nL\n:::\n\n:::warp right\nR\n:::")).toBe(
      table(
        '<th style="text-align:left">left</th><th style="text-align:left">right</th>',
        `<tr><td style="text-align:left">${paragraph("L")}</td><td style="text-align:left">${paragraph("R")}</td></tr>`,
        "lbs-table lbs-table-silent"
      )
    );
  });

  it("may be defined after it is referenced", () => {
    expect(toHTML("[~later]\n\n:::warp later\n# Later\n:::")).toBe('<h1 class="lbs-heading-1">Later</h1>');
  });

  it("replaces a paragraph that is only a reference with the warp's blocks", () => {
    expect(toHTML(":::warp a\n# Title\n\ntext\n:::\n\n[~a]")).toBe(`<h1 class="lbs-heading-1">Title</h1>\n${paragraph("text")}`);
  });

  it("can be defined inside another ::: block and referenced from it", () => {
    expect(toHTML(":::header\n~ | [~icon] |\n~ | - |\n\n:::warp icon\nI\n:::\n\n:::\n\nbody")).toBe(
      `<header class="lbs-header">${table(`<th>${paragraph("I")}</th>`, "", "lbs-table lbs-table-silent")}</header>\n${paragraph("body")}`
    );
  });

  it("wins over an inline link that starts at the same [", () => {
    expect(toHTML("[~missing](http://x)")).toBe(paragraph("[~missing](http://x)"));
  });

  it("embeds the warp's blocks when the reference is in the middle of a paragraph (not recommended)", () => {
    expect(toHTML(":::warp a\nx\n:::\n\ntext [~a] more")).toBe(paragraph(`text ${paragraph("x")} more`));
  });

  it("uses the last definition of an id", () => {
    expect(toHTML(":::warp a\none\n:::\n\n:::warp a\ntwo\n:::\n\n[~a]")).toBe(paragraph("two"));
  });

  it("accepts any characters other than spaces and ] in the id", () => {
    expect(toHTML(":::warp a.b/c:d\nx\n:::\n\n[~a.b/c:d]")).toBe(paragraph("x"));
  });

  it("renders a reference without a definition as plain text", () => {
    expect(toHTML("see [~missing]")).toBe(paragraph("see [~missing]"));
  });

  it("renders nothing for a reference inside its own expansion", () => {
    expect(toHTML(":::warp a\nbefore [~a] after\n:::\n\n[~a]")).toBe(paragraph("before  after"));
  });

  it("renders nothing for warps that reference each other in a loop", () => {
    expect(toHTML(":::warp a\nA\n\n[~b]\n:::\n\n:::warp b\nB\n\n[~a]\n:::\n\n[~a]")).toBe(
      `${paragraph("A")}\n${paragraph("B")}`
    );
  });

  it("may be referenced more than once", () => {
    expect(toHTML("| [~a] | [~a] |\n| - | - |\n\n:::warp a\nx\n:::")).toBe(
      table(`<th>${paragraph("x")}</th><th>${paragraph("x")}</th>`, "")
    );
  });
});

describe("Silent Table", () => {
  it("adds lbs-table-silent", () => {
    expect(toHTML("~ | Col1 | Col2 |\n~ | ---- | ---- |\n~ | A | B |")).toBe(
      table("<th>Col1</th><th>Col2</th>", "<tr><td>A</td><td>B</td></tr>", "lbs-table lbs-table-silent")
    );
  });

  it("supports cell merges", () => {
    expect(toHTML("~ | a | b |\n~ | - | - |\n~ | x | << |")).toBe(
      table("<th>a</th><th>b</th>", '<tr><td colspan="2">x</td></tr>', "lbs-table lbs-table-silent")
    );
  });

  it("ends at the first row without ~", () => {
    expect(toHTML("~ | a |\n~ | - |\n~ | 1 |\n| 2 |")).toBe(
      `${table("<th>a</th>", "<tr><td>1</td></tr>", "lbs-table lbs-table-silent")}\n${paragraph("| 2 |")}`
    );
  });
});

describe("Robustness", () => {
  it.each([
    ":::",
    ":::note",
    ":::warp",
    "| a |",
    "~ | a |",
    "__DETAILS_PLACEHOLDER_0__",
    ":::details T",
    ":::warp a\n[~a]\n:::\n\n[~a]",
    "[^",
    "^[",
    "[~",
    "![",
    "`",
  ])("renders %j without hanging or throwing", (markdown) => {
    expect(() => toHTML(markdown)).not.toThrow();
  });

  it("handles many unclosed fences inside a block in linear time", () => {
    const start = performance.now();
    toHTML(":::details T\n" + "```js\n".repeat(20000) + ":::");
    expect(performance.now() - start).toBeLessThan(1000);
  });
});

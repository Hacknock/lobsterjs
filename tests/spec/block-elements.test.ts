import { describe, it, expect } from "vitest";
import { toHTML } from "../../src/index.node.js";

const paragraph = (html: string) => `<p class="lbs-paragraph">${html}</p>`;

describe("Headings", () => {
  it.each([1, 2, 3, 4, 5, 6])("the number of # sets the level (%i)", (level) => {
    expect(toHTML(`${"#".repeat(level)} Title`)).toBe(
      `<h${level} class="lbs-heading-${level}">Title</h${level}>`
    );
  });

  it("seven # is not a heading", () => {
    expect(toHTML("####### Title")).toBe(paragraph("####### Title"));
  });

  it("requires a space between # and the text", () => {
    expect(toHTML("#Title")).toBe(paragraph("#Title"));
  });

  it("ignores trailing # preceded by a space", () => {
    expect(toHTML("# Title ##")).toBe('<h1 class="lbs-heading-1">Title</h1>');
  });

  it("parses Markdown in the heading text", () => {
    expect(toHTML("## A **bold** word")).toBe(
      '<h2 class="lbs-heading-2">A <span class="lbs-strong">bold</span> word</h2>'
    );
  });

  it("turns a trailing {#id} into the id attribute", () => {
    expect(toHTML("## My Section {#my-section}")).toBe(
      '<h2 class="lbs-heading-2" id="my-section">My Section</h2>'
    );
  });

  it("escapes the id attribute", () => {
    expect(toHTML('# T {#a" onclick="x}')).toBe(
      '<h1 class="lbs-heading-1" id="a&quot; onclick=&quot;x">T</h1>'
    );
  });
});

describe("Paragraph", () => {
  it("wraps text in a paragraph", () => {
    expect(toHTML("Hello world")).toBe(paragraph("Hello world"));
  });

  it("separates paragraphs with one or more blank lines", () => {
    expect(toHTML("First\n\n\nSecond")).toBe(`${paragraph("First")}\n${paragraph("Second")}`);
  });

  it("escapes HTML in the text", () => {
    expect(toHTML("<b>&\"'</b>")).toBe(paragraph("&lt;b&gt;&amp;&quot;&#39;&lt;/b&gt;"));
  });

  it("trims trailing spaces on every line", () => {
    expect(toHTML("Hello   ")).toBe(paragraph("Hello"));
  });
});

describe("Line Breaks", () => {
  it("turns a newline inside a paragraph into <br>", () => {
    expect(toHTML("line one\nline two")).toBe(paragraph("line one<br>line two"));
  });

  it("does not convert the final newline of a paragraph", () => {
    expect(toHTML("line one\n")).toBe(paragraph("line one"));
  });

  it("does not treat two trailing spaces specially", () => {
    expect(toHTML("line one  \nline two")).toBe(paragraph("line one<br>line two"));
  });
});

describe("Horizontal Rule", () => {
  it.each(["---", "- - -", "***", "* * *", "-----"])("%j is a horizontal rule", (line) => {
    expect(toHTML(line)).toBe('<hr class="lbs-hr">');
  });

  it("mixed characters are not a horizontal rule", () => {
    expect(toHTML("--**")).toBe(paragraph("--**"));
  });
});

describe("Code Block", () => {
  it("renders a fenced block as plain text", () => {
    expect(toHTML("```\n# not a heading\n**not bold**\n```")).toBe(
      '<div class="lbs-code-block"><pre><code># not a heading\n**not bold**</code></pre></div>'
    );
  });

  it("accepts ~~~ fences", () => {
    expect(toHTML("~~~\ncode\n~~~")).toBe('<div class="lbs-code-block"><pre><code>code</code></pre></div>');
  });

  it("emits the language and filename", () => {
    expect(toHTML('```js:hello.js\nconsole.log("Hello");\n```')).toBe(
      '<div class="lbs-code-block"><div class="lbs-code-filename">hello.js</div>' +
        '<pre data-language="js" data-filename="hello.js"><code class="language-js">console.log(&quot;Hello&quot;);</code></pre></div>'
    );
  });

  it("allows a filename without a language", () => {
    expect(toHTML("```:hello.js\nx\n```")).toBe(
      '<div class="lbs-code-block"><div class="lbs-code-filename">hello.js</div><pre data-filename="hello.js"><code>x</code></pre></div>'
    );
  });

  it("takes the rest of the line as the filename", () => {
    expect(toHTML("```js:a:b.js\nx\n```")).toBe(
      '<div class="lbs-code-block"><div class="lbs-code-filename">a:b.js</div><pre data-language="js" data-filename="a:b.js"><code class="language-js">x</code></pre></div>'
    );
  });

  it("allows + and - in the language", () => {
    expect(toHTML("```c++\nx\n```")).toBe(
      '<div class="lbs-code-block"><pre data-language="c++"><code class="language-c++">x</code></pre></div>'
    );
  });

  it("escapes HTML in the code", () => {
    expect(toHTML("```\n<script>\n```")).toBe(
      '<div class="lbs-code-block"><pre><code>&lt;script&gt;</code></pre></div>'
    );
  });

  it("closes only at a fence of the same character that is at least as long", () => {
    expect(toHTML("````\n```\n~~~\n````")).toBe(
      '<div class="lbs-code-block"><pre><code>```\n~~~</code></pre></div>'
    );
  });

  it("needs at least three fence characters", () => {
    expect(toHTML("``js\ncode")).toBe(paragraph("``js<br>code"));
  });

  it("does not interpret backslash escapes", () => {
    expect(toHTML("```\n\\*a\\*\n```")).toBe('<div class="lbs-code-block"><pre><code>\\*a\\*</code></pre></div>');
  });

  it("keeps ::: blocks and references inside it as text", () => {
    expect(toHTML("```markdown\n:::warp a\nx\n:::\n\n[~a]\n```")).toBe(
      '<div class="lbs-code-block"><pre data-language="markdown"><code class="language-markdown">:::warp a\nx\n:::\n\n[~a]</code></pre></div>'
    );
  });

  it("runs to the end of the document when never closed", () => {
    expect(toHTML("```\na\n\nb")).toBe('<div class="lbs-code-block"><pre><code>a\n\nb</code></pre></div>');
  });
});

describe("Blockquote", () => {
  it("wraps lines starting with > in a blockquote", () => {
    expect(toHTML("> one\n> two")).toBe(`<blockquote class="lbs-blockquote">${paragraph("one<br>two")}</blockquote>`);
  });

  it("nests by stacking >", () => {
    expect(toHTML("> Outer\n> > Inner")).toBe(
      `<blockquote class="lbs-blockquote">${paragraph("Outer")}\n` +
        `<blockquote class="lbs-blockquote">${paragraph("Inner")}</blockquote></blockquote>`
    );
  });

  it("continues a quoted paragraph on a following line without >", () => {
    expect(toHTML("> one\ntwo")).toBe(`<blockquote class="lbs-blockquote">${paragraph("one<br>two")}</blockquote>`);
  });

  it("continues the innermost quoted paragraph of a nested quote", () => {
    expect(toHTML("> a\n> > b\nc")).toBe(
      `<blockquote class="lbs-blockquote">${paragraph("a")}\n` +
        `<blockquote class="lbs-blockquote">${paragraph("b<br>c")}</blockquote></blockquote>`
    );
  });

  it("does not continue a quoted list", () => {
    expect(toHTML("> - a\n>   b\nc")).toBe(
      '<blockquote class="lbs-blockquote"><ul class="lbs-ul lbs-ul-depth-0">\n<li class="lbs-list-item">a b</li>\n</ul></blockquote>\n' +
        paragraph("c")
    );
  });

  it("does not continue a quoted table", () => {
    expect(toHTML("> a | b\n> --|--\n> 1 | 2\nlazy")).toBe(
      '<blockquote class="lbs-blockquote"><table class="lbs-table">\n<thead><tr><th>a</th><th>b</th></tr></thead>\n' +
        "<tbody>\n<tr><td>1</td><td>2</td></tr>\n</tbody>\n</table></blockquote>\n" +
        paragraph("lazy")
    );
  });

  it("does not continue a quoted silent table", () => {
    expect(toHTML("> ~ h\n> ~ -\n> ~ 1\nlazy")).toBe(
      '<blockquote class="lbs-blockquote"><table class="lbs-table lbs-table-silent">\n<thead><tr><th>h</th></tr></thead>\n' +
        "<tbody>\n<tr><td>1</td></tr>\n</tbody>\n</table></blockquote>\n" +
        paragraph("lazy")
    );
  });

  it("treats a quoted line that looks like a nested quote as a row of a quoted table", () => {
    expect(toHTML("> | h |\n> | - |\n> > row | value\nlazy")).toBe(
      '<blockquote class="lbs-blockquote"><table class="lbs-table">\n<thead><tr><th>h</th></tr></thead>\n' +
        "<tbody>\n<tr><td>&gt; row</td></tr>\n</tbody>\n</table></blockquote>\n" +
        paragraph("lazy")
    );
  });

  it("treats a quoted line that looks like a fence as a row of a quoted table", () => {
    expect(toHTML("> | h |\n> | - |\n> ```x | y\n> text\nlazy")).toBe(
      '<blockquote class="lbs-blockquote"><table class="lbs-table">\n<thead><tr><th>h</th></tr></thead>\n' +
        "<tbody>\n<tr><td>```x</td></tr>\n</tbody>\n</table>\n" +
        `${paragraph("text<br>lazy")}</blockquote>`
    );
  });

  it("continues a quoted paragraph whose later lines look like a table without a leading pipe", () => {
    expect(toHTML("> intro\n> a | b\n> --|--\nlazy")).toBe(
      `<blockquote class="lbs-blockquote">${paragraph("intro<br>a | b<br>--|--<br>lazy")}</blockquote>`
    );
  });

  it("continues a quoted paragraph with lines that look like a table without a leading pipe", () => {
    expect(toHTML("> quote\na | b\n--|--\n1 | 2")).toBe(
      `<blockquote class="lbs-blockquote">${paragraph("quote<br>a | b<br>--|--<br>1 | 2")}</blockquote>`
    );
  });

  it("continues a quoted paragraph that follows a horizontal rule", () => {
    expect(toHTML("> - - -\n>   text\nlazy")).toBe(
      `<blockquote class="lbs-blockquote"><hr class="lbs-hr">\n${paragraph("  text<br>lazy")}</blockquote>`
    );
  });

  it("continues a paragraph after a closed code block in a nested quote", () => {
    expect(toHTML("> > ```\n> > x\n> > ```\n> > code\nlazy")).toBe(
      '<blockquote class="lbs-blockquote"><blockquote class="lbs-blockquote"><div class="lbs-code-block"><pre><code>x</code></pre></div>\n' +
        `${paragraph("code<br>lazy")}</blockquote></blockquote>`
    );
  });

  it("checks many continuation lines in linear time", () => {
    const start = performance.now();
    const html = toHTML("> a\n" + "b\n".repeat(20000));
    expect(performance.now() - start).toBeLessThan(1000);
    expect(html.startsWith('<blockquote class="lbs-blockquote"><p class="lbs-paragraph">a<br>b<br>')).toBe(true);
  });

  it("ends at a blank line", () => {
    expect(toHTML("> quote\n\nafter")).toBe(
      `<blockquote class="lbs-blockquote">${paragraph("quote")}</blockquote>\n${paragraph("after")}`
    );
  });

  it("does not continue on a line that starts another block", () => {
    expect(toHTML("> quote\n# Heading")).toBe(
      `<blockquote class="lbs-blockquote">${paragraph("quote")}</blockquote>\n<h1 class="lbs-heading-1">Heading</h1>`
    );
  });

  it("does not continue a quoted code block without >", () => {
    expect(toHTML("> ```\n> code\nafter")).toBe(
      '<blockquote class="lbs-blockquote"><div class="lbs-code-block"><pre><code>code</code></pre></div></blockquote>\n' +
        paragraph("after")
    );
  });

  it("allows other Markdown inside", () => {
    expect(toHTML("> # Title\n> - item")).toBe(
      '<blockquote class="lbs-blockquote"><h1 class="lbs-heading-1">Title</h1>\n' +
        '<ul class="lbs-ul lbs-ul-depth-0">\n<li class="lbs-list-item">item</li>\n</ul></blockquote>'
    );
  });
});

describe("Lists", () => {
  const item = (html: string) => `<li class="lbs-list-item">${html}</li>`;

  it.each(["-", "*", "+"])("%s starts a bullet list item", (marker) => {
    expect(toHTML(`${marker} one\n${marker} two`)).toBe(
      `<ul class="lbs-ul lbs-ul-depth-0">\n${item("one")}\n${item("two")}\n</ul>`
    );
  });

  it("requires a space after the marker", () => {
    expect(toHTML("-item")).toBe(paragraph("-item"));
  });

  it("nests more indented items and numbers the depth from 0", () => {
    expect(toHTML("- a\n  - b\n    - c")).toBe(
      '<ul class="lbs-ul lbs-ul-depth-0">\n<li class="lbs-list-item">a\n' +
        '<ul class="lbs-ul lbs-ul-depth-1">\n<li class="lbs-list-item">b\n' +
        '<ul class="lbs-ul lbs-ul-depth-2">\n<li class="lbs-list-item">c</li>\n</ul></li>\n</ul></li>\n</ul>'
    );
  });

  it("nests an ordered list inside a bullet list", () => {
    expect(toHTML("- a\n  1. b")).toBe(
      '<ul class="lbs-ul lbs-ul-depth-0">\n<li class="lbs-list-item">a\n' +
        '<ol class="lbs-ol lbs-ol-depth-1">\n<li class="lbs-list-item">b</li>\n</ol></li>\n</ul>'
    );
  });

  it("nests an ordered list in an ordered list", () => {
    expect(toHTML("1. First\n2. Second\n   1. Nested")).toBe(
      `<ol class="lbs-ol lbs-ol-depth-0">\n${item("First")}\n<li class="lbs-list-item">Second\n` +
        `<ol class="lbs-ol lbs-ol-depth-1">\n${item("Nested")}\n</ol></li>\n</ol>`
    );
  });

  it("joins an indented line to the item", () => {
    expect(toHTML("- first\n  continued")).toBe(
      `<ul class="lbs-ul lbs-ul-depth-0">\n${item("first continued")}\n</ul>`
    );
  });

  it("numbers an ordered list from its first item", () => {
    expect(toHTML("3. three\n4. four")).toBe(
      `<ol class="lbs-ol lbs-ol-depth-0" start="3">\n${item("three")}\n${item("four")}\n</ol>`
    );
  });

  it("omits start when the list starts at 1", () => {
    expect(toHTML("1. one\n2. two")).toBe(`<ol class="lbs-ol lbs-ol-depth-0">\n${item("one")}\n${item("two")}\n</ol>`);
  });

  it("does not treat an escaped dot as an ordered list marker", () => {
    expect(toHTML("1\\. not a list")).toBe(paragraph("1. not a list"));
  });

  it("starts a new list when the marker type changes", () => {
    expect(toHTML("- a\n1. b")).toBe(
      `<ul class="lbs-ul lbs-ul-depth-0">\n${item("a")}\n</ul>\n<ol class="lbs-ol lbs-ol-depth-0">\n${item("b")}\n</ol>`
    );
  });

  it.each([
    ["- [ ] todo", "<input type=\"checkbox\" class=\"lbs-checkbox\" disabled> todo"],
    ["- [x] done", "<input type=\"checkbox\" class=\"lbs-checkbox\" checked disabled> done"],
    ["- [X] done", "<input type=\"checkbox\" class=\"lbs-checkbox\" checked disabled> done"],
  ])("renders checklist item %j", (markdown, html) => {
    expect(toHTML(markdown)).toBe(`<ul class="lbs-ul lbs-ul-depth-0">\n${item(html)}\n</ul>`);
  });

  it("allows checklists in ordered lists", () => {
    expect(toHTML("1. [x] done")).toBe(
      `<ol class="lbs-ol lbs-ol-depth-0">\n${item('<input type="checkbox" class="lbs-checkbox" checked disabled> done')}\n</ol>`
    );
  });
});

describe("Table", () => {
  const table = (head: string, body: string, className = "lbs-table") =>
    `<table class="${className}">\n<thead><tr>${head}</tr></thead>\n<tbody>\n${body}\n</tbody>\n</table>`;

  it("needs a header row and an alignment row", () => {
    expect(toHTML("| Name | Age |\n| --- | --- |\n| Alice | 30 |")).toBe(
      table("<th>Name</th><th>Age</th>", "<tr><td>Alice</td><td>30</td></tr>")
    );
  });

  it("is not a table without an alignment row", () => {
    expect(toHTML("| a | b |\n| 1 | 2 |")).toBe(`${paragraph("| a | b |")}\n${paragraph("| 1 | 2 |")}`);
  });

  it("does not allow spaces inside an alignment marker", () => {
    expect(toHTML("| a |\n| - - |")).toBe(`${paragraph("| a |")}\n${paragraph("| - - |")}`);
  });

  it("allows omitting the outer pipes", () => {
    expect(toHTML("a | b\n--|--\n1 | 2")).toBe(table("<th>a</th><th>b</th>", "<tr><td>1</td><td>2</td></tr>"));
  });

  it("aligns each column", () => {
    expect(toHTML("| a | b | c | d |\n| --- | :-- | :-: | --: |\n| 1 | 2 | 3 | 4 |")).toBe(
      table(
        '<th>a</th><th style="text-align:left">b</th><th style="text-align:center">c</th><th style="text-align:right">d</th>',
        '<tr><td>1</td><td style="text-align:left">2</td><td style="text-align:center">3</td><td style="text-align:right">4</td></tr>'
      )
    );
  });

  it("parses Markdown in cells", () => {
    expect(toHTML("| **a** |\n| --- |\n| `b` |")).toBe(
      table('<th><span class="lbs-strong">a</span></th>', '<tr><td><code class="lbs-code-span">b</code></td></tr>')
    );
  });

  it("leaves missing cells empty and drops cells beyond the header", () => {
    expect(toHTML("| a | b |\n| --- | --- |\n| 1 |\n| 1 | 2 | 3 |")).toBe(
      table("<th>a</th><th>b</th>", "<tr><td>1</td><td></td></tr>\n<tr><td>1</td><td>2</td></tr>")
    );
  });

  describe("Cell Merge", () => {
    it("<< merges with the cell on the left and ^^ with the cell above", () => {
      expect(
        toHTML(
          "| Time | Mon | Tue | Wed |\n| :--- | :--- | :--- | :--- |\n" +
            "| 1st | Math | English | << |\n| 2nd | ^^ | Japanese | Science |\n| 3rd | Assembly | << | << |"
        )
      ).toBe(
        table(
          '<th style="text-align:left">Time</th><th style="text-align:left">Mon</th><th style="text-align:left">Tue</th><th style="text-align:left">Wed</th>',
          '<tr><td style="text-align:left">1st</td><td rowspan="2" style="text-align:left">Math</td><td colspan="2" style="text-align:left">English</td></tr>\n' +
            '<tr><td style="text-align:left">2nd</td><td style="text-align:left">Japanese</td><td style="text-align:left">Science</td></tr>\n' +
            '<tr><td style="text-align:left">3rd</td><td colspan="3" style="text-align:left">Assembly</td></tr>'
        )
      );
    });

    it("merges header cells with <<", () => {
      expect(toHTML("| A | << | B |\n| :- | -: | - |\n| 1 | 2 | 3 |")).toBe(
        table(
          '<th colspan="2" style="text-align:left">A</th><th>B</th>',
          '<tr><td style="text-align:left">1</td><td style="text-align:right">2</td><td>3</td></tr>'
        )
      );
    });

    it("extends a whole colspan cell down with ^^", () => {
      expect(toHTML("| a | b |\n| - | - |\n| x | << |\n| ^^ | ^^ |")).toBe(
        table("<th>a</th><th>b</th>", '<tr><td colspan="2" rowspan="2">x</td></tr>\n<tr></tr>')
      );
    });

    it("forms a rectangular block from << and ^^", () => {
      expect(toHTML("| h | h | h |\n| - | - | - |\n| Block | << | x |\n| ^^ | ^^ | y |")).toBe(
        table(
          "<th>h</th><th>h</th><th>h</th>",
          '<tr><td colspan="2" rowspan="2">Block</td><td>x</td></tr>\n<tr><td>y</td></tr>'
        )
      );
    });

    it("recognizes a marker only as the entire cell content", () => {
      expect(toHTML("| a | b |\n| - | - |\n| 1 | a << b |")).toBe(
        table("<th>a</th><th>b</th>", "<tr><td>1</td><td>a &lt;&lt; b</td></tr>")
      );
    });

    it("keeps markers with nothing to merge with as text", () => {
      expect(toHTML("| << | ^^ |\n| - | - |\n| ^^ | x |")).toBe(
        table("<th>&lt;&lt;</th><th>^^</th>", "<tr><td>^^</td><td>x</td></tr>")
      );
    });

    it("does not merge across the header and body", () => {
      expect(toHTML("| a | b |\n| - | - |\n| ^^ | c |")).toBe(
        table("<th>a</th><th>b</th>", "<tr><td>^^</td><td>c</td></tr>")
      );
    });

    it("renders a row covered entirely by ^^ as an empty row", () => {
      expect(toHTML("| a | b |\n| - | - |\n| 1 | 2 |\n| ^^ | ^^ |")).toBe(
        table("<th>a</th><th>b</th>", '<tr><td rowspan="2">1</td><td rowspan="2">2</td></tr>\n<tr></tr>')
      );
    });

    it("turns the last marker of a non-rectangular region back into text", () => {
      expect(toHTML("| a | b |\n| - | - |\n| x | << |\n| ^^ | y |")).toBe(
        table("<th>a</th><th>b</th>", '<tr><td colspan="2">x</td></tr>\n<tr><td>^^</td><td>y</td></tr>')
      );
    });

    it("shows escaped markers as text", () => {
      expect(toHTML("| a | b |\n| - | - |\n| x | \\<< |")).toBe(
        table("<th>a</th><th>b</th>", "<tr><td>x</td><td>&lt;&lt;</td></tr>")
      );
    });

    it("aligns a merged cell by the column it starts in", () => {
      expect(toHTML("| a | b |\n| :- | -: |\n| x | << |")).toBe(
        table(
          '<th style="text-align:left">a</th><th style="text-align:right">b</th>',
          '<tr><td colspan="2" style="text-align:left">x</td></tr>'
        )
      );
    });

    it("resolves large non-rectangular regions quickly", () => {
      const rows = Array.from({ length: 300 }, () => "| x | << | << | << |\n| ^^ | ^^ | y | << |").join("\n");
      const start = performance.now();
      toHTML(`| a | b | c | d |\n| - | - | - | - |\n${rows}`);
      expect(performance.now() - start).toBeLessThan(1000);
    });
  });

  describe("Literal pipes", () => {
    it("treats \\| as a literal pipe", () => {
      expect(toHTML("| a |\n| - |\n| x \\| y |")).toBe(table("<th>a</th>", "<tr><td>x | y</td></tr>"));
    });

    it("keeps a pipe inside a code span in the cell", () => {
      expect(toHTML("| a |\n| - |\n| `x|y` |")).toBe(
        table("<th>a</th>", '<tr><td><code class="lbs-code-span">x|y</code></td></tr>')
      );
    });

    it("shows \\| inside a code span as-is", () => {
      expect(toHTML("| a |\n| - |\n| `x\\|y` |")).toBe(
        table("<th>a</th>", '<tr><td><code class="lbs-code-span">x\\|y</code></td></tr>')
      );
    });

    it("splits at a pipe after an escaped backslash", () => {
      expect(toHTML("| a | b |\n| - | - |\n| x \\\\| y |")).toBe(
        table("<th>a</th><th>b</th>", "<tr><td>x \\</td><td>y</td></tr>")
      );
    });

    it("splits at a pipe after an escaped backtick", () => {
      expect(toHTML("| a | b |\n| - | - |\n| \\`x | y` |")).toBe(
        table("<th>a</th><th>b</th>", "<tr><td>`x</td><td>y`</td></tr>")
      );
    });

    it("keeps a pipe inside a multi-backtick code span in the cell", () => {
      expect(toHTML("| a | b |\n| - | - |\n| `` x ` | y `` | z |")).toBe(
        table("<th>a</th><th>b</th>", '<tr><td><code class="lbs-code-span">x ` | y</code></td><td>z</td></tr>')
      );
    });

    it("shows an escaped --- in a body cell as text", () => {
      expect(toHTML("| a |\n| - |\n| \\--- |")).toBe(table("<th>a</th>", "<tr><td>---</td></tr>"));
    });

    it("splits at a pipe after an unclosed backtick", () => {
      expect(toHTML("| a | b |\n| - | - |\n| `x | y |")).toBe(
        table("<th>a</th><th>b</th>", "<tr><td>`x</td><td>y</td></tr>")
      );
    });
  });
});

describe("Evaluation order", () => {
  it("prefers a horizontal rule over a list for - - -", () => {
    expect(toHTML("- - -")).toBe('<hr class="lbs-hr">');
  });

  it("ends a paragraph at a line that starts another block", () => {
    expect(toHTML("text\n# Heading\n- item")).toBe(
      `${paragraph("text")}\n<h1 class="lbs-heading-1">Heading</h1>\n` +
        '<ul class="lbs-ul lbs-ul-depth-0">\n<li class="lbs-list-item">item</li>\n</ul>'
    );
  });
});

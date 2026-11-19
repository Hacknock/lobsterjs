import { describe, it, expect } from "vitest";
import { toHTML } from "../../src/index.node.js";

const paragraph = (html: string) => `<p class="lbs-paragraph">${html}</p>`;
const reference = (id: string, label: string, count = 0) =>
  `<sup class="lbs-footnote-ref"><a href="#lbs-fn-${id}" id="lbs-fnref-${id}-${count}">${label}</a></sup>`;
const section = (...items: [id: string, number: number, html: string][]) =>
  "<section class=\"lbs-footnotes\">\n<ol>\n" +
  items.map(([id, number, html]) => `<li id="lbs-fn-${id}" class="lbs-footnote-item">[${number}] ${html}</li>`).join("\n") +
  "\n</ol>\n</section>";

describe("Footnote Reference", () => {
  it("links a reference to its definition in the footnote section", () => {
    expect(toHTML("Lobster[^1] is great.\n\n[^1]: A crustacean.")).toBe(
      `${paragraph(`Lobster${reference("1", "[1]")} is great.`)}\n${section(["1", 1, "A crustacean."])}`
    );
  });

  it("accepts a definition anywhere in the document", () => {
    expect(toHTML("[^n]: note\n\na[^n]")).toBe(`${paragraph(`a${reference("n", "[1]")}`)}\n${section(["n", 1, "note"])}`);
  });

  it("numbers footnotes in the order they are first referenced", () => {
    expect(toHTML("a[^second] b[^first]\n\n[^first]: F\n[^second]: S")).toBe(
      `${paragraph(`a${reference("second", "[1]")} b${reference("first", "[2]")}`)}\n` +
        section(["second", 1, "S"], ["first", 2, "F"])
    );
  });

  it("labels repeated references [1], [1:1], [1:2]", () => {
    expect(toHTML("a[^n] b[^n] c[^n]\n\n[^n]: note")).toBe(
      `${paragraph(`a${reference("n", "[1]")} b${reference("n", "[1:1]", 1)} c${reference("n", "[1:2]", 2)}`)}\n` +
        section(["n", 1, "note"])
    );
  });

  it("numbers the header, the body, and then the footer", () => {
    expect(toHTML(":::footer\nf[^f]\n:::\n\n:::header\nh[^h]\n:::\n\nb[^b]\n\n[^f]: F\n[^h]: H\n[^b]: B")).toBe(
      `<header class="lbs-header">${paragraph(`h${reference("h", "[1]")}`)}</header>\n` +
        `${paragraph(`b${reference("b", "[2]")}`)}\n` +
        `${section(["h", 1, "H"], ["b", 2, "B"], ["f", 3, "F"])}\n` +
        `<footer class="lbs-footer">${paragraph(`f${reference("f", "[3]")}`)}</footer>`
    );
  });

  it("counts a reference inside a warp where the warp is referenced", () => {
    expect(toHTML(":::warp w\nw[^w]\n:::\n\na[^a]\n\n[~w]\n\n[^a]: A\n[^w]: W")).toBe(
      `${paragraph(`a${reference("a", "[1]")}`)}\n${paragraph(`w${reference("w", "[2]")}`)}\n` +
        section(["a", 1, "A"], ["w", 2, "W"])
    );
  });

  it("numbers references inside definitions after the rest", () => {
    expect(toHTML("a[^1] b[^2]\n\n[^1]: one [^3]\n[^2]: two\n[^3]: three")).toBe(
      `${paragraph(`a${reference("1", "[1]")} b${reference("2", "[2]")}`)}\n` +
        section(["1", 1, `one ${reference("3", "[3]")}`], ["2", 2, "two"], ["3", 3, "three"])
    );
  });

  it("lists only referenced footnotes", () => {
    expect(toHTML("a[^used]\n\n[^used]: U\n[^unused]: X [^other]\n[^other]: O")).toBe(
      `${paragraph(`a${reference("used", "[1]")}`)}\n${section(["used", 1, "U"])}`
    );
  });

  it("renders a reference without a definition as plain text", () => {
    expect(toHTML("a[^missing]")).toBe(paragraph("a[^missing]"));
  });

  it("does not allow spaces in the id", () => {
    expect(toHTML("a[^x y]\n\n[^x y]: z")).toBe(paragraph("a[^x y]"));
  });

  it("does not render definition lines", () => {
    expect(toHTML("[^n]: note")).toBe("");
  });

  it("uses the last definition of an id", () => {
    expect(toHTML("a[^n]\n\n[^n]: one\n[^n]: two")).toBe(`${paragraph(`a${reference("n", "[1]")}`)}\n${section(["n", 1, "two"])}`);
  });

  it("parses Markdown in definitions", () => {
    expect(toHTML("a[^n]\n\n[^n]: **bold**")).toBe(
      `${paragraph(`a${reference("n", "[1]")}`)}\n${section(["n", 1, '<span class="lbs-strong">bold</span>'])}`
    );
  });

  it("escapes the id in attributes", () => {
    expect(toHTML('a[^"x"]\n\n[^"x"]: q')).toBe(
      `${paragraph(`a${reference("&quot;x&quot;", "[1]")}`)}\n${section(["&quot;x&quot;", 1, "q"])}`
    );
  });
});

describe("Inline Footnote", () => {
  it("writes the definition inline", () => {
    expect(toHTML("a^[inline note] b")).toBe(
      `${paragraph(`a${reference("__inline_1", "[1]")} b`)}\n${section(["__inline_1", 1, "inline note"])}`
    );
  });

  it("is numbered together with named footnotes", () => {
    expect(toHTML("a[^n] b^[inline]\n\n[^n]: named")).toBe(
      `${paragraph(`a${reference("n", "[1]")} b${reference("__inline_1", "[2]")}`)}\n` +
        section(["n", 1, "named"], ["__inline_1", 2, "inline"])
    );
  });

  it("does not allow a space between ^ and [", () => {
    expect(toHTML("a^ [x]")).toBe(paragraph("a^ [x]"));
  });

  it("does not let an escaped ] close the note", () => {
    expect(toHTML("a^[x \\] y]")).toBe(`${paragraph(`a${reference("__inline_1", "[1]")}`)}\n${section(["__inline_1", 1, "x ] y"])}`);
  });

  it("is not replaced by a named footnote with the same generated id", () => {
    expect(toHTML("a^[inner]\n\n[^__inline_1]: named")).toBe(
      `${paragraph(`a${reference("__inline_2", "[1]")}`)}\n${section(["__inline_2", 1, "inner"])}`
    );
  });
});

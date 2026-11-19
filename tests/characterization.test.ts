import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import { toHTML } from "../src/index.node.js";

function readRepositoryFile(path: string): string {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

function fencedBlocks(markdown: string): string[] {
  const blocks: string[] = [];
  const fencePattern = /^(`{3,}|~{3,})[^\n]*\n([\s\S]*?)\n\1$/gm;
  for (const match of markdown.matchAll(fencePattern)) blocks.push(match[2]);
  return blocks;
}

function renderOrDescribeError(markdown: string): string {
  try {
    return toHTML(markdown);
  } catch (error) {
    return `THROWS ${(error as Error).name}`;
  }
}

const edgeCases = [
  "# T {#a\" onclick=\"x}",
  ":::warp a\n[~a]\n:::\n\n[~a]",
  ":::warp a\n[~b]\n:::\n\n:::warp b\n[~a]\n:::\n\n[~a]",
  ":::details T\n```\n:::\n```\n:::",
  "__DETAILS_PLACEHOLDER_3__\n\n:::details T\nx\n:::",
  "a[^1]\n\n[^1]: one\n[^2]: two [^3]\n[^3]: three",
  "a[^x]",
  ":::warp a\none\n:::\n:::warp a\ntwo\n:::\n\n[~a]",
  ":::warp a\n# Hi\n:::\n\ntext [~a] more",
  "[a][b]",
  ":::note\nhello\n:::",
  ":::warp\nno id\n:::",
  "text\n\n:::",
  ":::details Title\n:::note\ninner\n:::\nafter\n:::",
  "| a |",
  "~ | a |",
  "> :::details T\n> x\n> :::",
  "- a\n  :::note",
  ":::details T\n```\ncode\n:::\n\nafter",
  "para1\n:::warp a\nx\n:::\npara2",
  "- a\n:::warp x\nX\n:::\n- b",
  "| h |\n| - |\n| 1 |\n:::warp a\nx\n:::\n| 2 |",
];

describe("characterization of toHTML output", () => {
  it.each(["docs/content.md", "docs/content-ja.md"])("renders %s", (path) => {
    expect(toHTML(readRepositoryFile(path))).toMatchSnapshot();
  });

  it("renders every fenced example in the specification", () => {
    const examples = fencedBlocks(readRepositoryFile("markdowns/spec.md"));
    expect(examples.map(renderOrDescribeError)).toMatchSnapshot();
  });

  it.each(edgeCases)("renders edge case %j", (markdown) => {
    expect(renderOrDescribeError(markdown)).toMatchSnapshot();
  });
});

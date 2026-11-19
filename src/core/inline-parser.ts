import type {
  InlineNode,
  TextNode,
  EmphasisNode,
  StrongNode,
  StrikethroughNode,
  CodeSpanNode,
  LinkNode,
  ImageNode,
  FootnoteRefNode,
  InlineFootnoteNode,
  WarpRefNode,
  LineBreakNode,
  ParseContext,
} from "./types.js";

type MatchResult = { node: InlineNode; end: number };

const ASCII_PUNCTUATION = /^[!-/:-@[-`{-~]$/;
const WORD_CHARACTER = /^[\p{L}\p{N}]$/u;
const WHITESPACE = /^\s$/;

// ============================================================
// Helpers
// ============================================================

function isAsciiPunctuation(character: string | undefined): boolean {
  return character !== undefined && ASCII_PUNCTUATION.test(character);
}

function isWordCharacter(character: string | undefined): boolean {
  return character !== undefined && WORD_CHARACTER.test(character);
}

function isWhitespaceOrBoundary(character: string | undefined): boolean {
  return character === undefined || WHITESPACE.test(character);
}

function characterStartingAt(text: string, index: number): string | undefined {
  const codePoint = text.codePointAt(index);
  return codePoint === undefined ? undefined : String.fromCodePoint(codePoint);
}

function characterEndingBefore(text: string, index: number): string | undefined {
  return Array.from(text.slice(Math.max(0, index - 2), index)).pop();
}

/**
 * spec: Backslash Escapes — a character preceded by an odd number of `\` is escaped.
 */
function isEscaped(text: string, index: number): boolean {
  let backslashCount = 0;
  for (let i = index - 1; i >= 0 && text[i] === "\\"; i--) backslashCount++;
  return backslashCount % 2 === 1;
}

/**
 * spec: Delimiter Rules for Emphasis, Strong, and Strikethrough
 * An opening delimiter must not be followed by whitespace, and `_` must not
 * be preceded by a word character (intraword `_` is literal).
 */
function canOpenDelimiter(
  text: string,
  delimiterStart: number,
  delimiterLength: number
): boolean {
  if (isWhitespaceOrBoundary(text[delimiterStart + delimiterLength])) return false;
  const character = text[delimiterStart];
  if (character === "_") {
    let beforeRun = delimiterStart - 1;
    while (beforeRun >= 0 && text[beforeRun] === character) beforeRun--;
    if (isWordCharacter(characterEndingBefore(text, beforeRun + 1))) return false;
  }
  return true;
}

/**
 * spec: Delimiter Rules for Emphasis, Strong, and Strikethrough
 * A closing delimiter must not be preceded by whitespace, and `_` must not
 * be followed by a word character.
 */
function canCloseDelimiter(
  text: string,
  delimiterStart: number,
  delimiterLength: number
): boolean {
  if (isWhitespaceOrBoundary(text[delimiterStart - 1])) return false;
  if (
    text[delimiterStart] === "_" &&
    isWordCharacter(characterStartingAt(text, delimiterStart + delimiterLength))
  ) {
    return false;
  }
  return true;
}

/**
 * spec: Backslash Escapes — removes the backslash from escaped ASCII
 * punctuation in raw strings such as link destinations, titles, and alt text.
 */
export function unescapeBackslashes(raw: string): string {
  return raw.replace(/\\([!-/:-@[-`{-~])/g, "$1");
}

/**
 * Finds the first valid closing `delimiter` at or after `searchStart`.
 * Escaped delimiters are skipped. For single-character delimiters, doubled
 * occurrences are skipped so that `*a **b** c*` closes at the last `*`.
 */
function findClosingDelimiter(
  text: string,
  searchStart: number,
  delimiter: string
): number {
  let searchPosition = searchStart;
  while (searchPosition < text.length) {
    const closeIndex = text.indexOf(delimiter, searchPosition);
    if (closeIndex === -1) return -1;
    if (isEscaped(text, closeIndex)) {
      searchPosition = closeIndex + 1;
      continue;
    }
    if (delimiter.length === 1 && text[closeIndex + 1] === delimiter) {
      searchPosition = closeIndex + 2;
      continue;
    }
    if (canCloseDelimiter(text, closeIndex, delimiter.length)) return closeIndex;
    searchPosition = closeIndex + 1;
  }
  return -1;
}

/**
 * Finds the next `]` that closes a `[` opened before `start`.
 * Escaped brackets are ignored. Returns -1 if not found within the same line.
 */
function findClosingBracket(text: string, start: number): number {
  let depth = 1;
  for (let i = start; i < text.length; i++) {
    if (text[i] === "\\" && isAsciiPunctuation(text[i + 1])) i++;
    else if (text[i] === "[") depth++;
    else if (text[i] === "]") {
      depth--;
      if (depth === 0) return i;
    } else if (text[i] === "\n") {
      return -1;
    }
  }
  return -1;
}

/**
 * Finds the next `)` that closes a `(` opened before `start`.
 * Escaped parentheses are ignored. Returns -1 if not found.
 */
function findClosingParen(text: string, start: number): number {
  let depth = 1;
  for (let i = start; i < text.length; i++) {
    if (text[i] === "\\" && isAsciiPunctuation(text[i + 1])) i++;
    else if (text[i] === "(") depth++;
    else if (text[i] === ")") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/**
 * Parses `url "title"`, `url 'title'`, `url (title)`, or just `url`.
 */
function parseLinkContent(content: string): { href: string; title?: string } {
  content = content.trim();
  const titleMatch =
    content.match(/^(\S+)\s+"((?:[^"\\]|\\.)*)"$/) ??
    content.match(/^(\S+)\s+'((?:[^'\\]|\\.)*)'$/) ??
    content.match(/^(\S+)\s+\(((?:[^)\\]|\\.)*)\)$/);
  if (titleMatch) return { href: unescapeBackslashes(titleMatch[1]), title: unescapeBackslashes(titleMatch[2]) };
  return { href: unescapeBackslashes(content) };
}

/**
 * Parses `url "title" =WxH` for images.
 */
function parseImageContent(content: string): {
  href: string;
  title?: string;
  width?: number;
  height?: number;
} {
  content = content.trim();
  const sizeMatch = content.match(/\s+=(\d*)x(\d*)\s*$/);
  let width: number | undefined;
  let height: number | undefined;
  if (sizeMatch) {
    if (sizeMatch[1]) width = parseInt(sizeMatch[1], 10);
    if (sizeMatch[2]) height = parseInt(sizeMatch[2], 10);
    content = content.slice(0, -sizeMatch[0].length).trim();
  }
  return { ...parseLinkContent(content), width, height };
}

// ============================================================
// Individual inline matchers
// ============================================================

function backtickRunLength(text: string, start: number): number {
  let length = 0;
  while (text[start + length] === "`") length++;
  return length;
}

/**
 * spec: Code Span — a code span closes at the next backtick run of exactly
 * the same length. Returns the index of that closing run, or -1.
 */
function findCodeSpanClose(text: string, openStart: number, runLength: number): number {
  const fence = "`".repeat(runLength);
  let searchFrom = openStart + runLength;
  while (searchFrom < text.length) {
    const closeStart = text.indexOf(fence, searchFrom);
    if (closeStart === -1) return -1;
    const closeLength = backtickRunLength(text, closeStart);
    if (closeLength === runLength) return closeStart;
    searchFrom = closeStart + closeLength;
  }
  return -1;
}

/**
 * Returns the end of the code span opening at `start`, or the end of the
 * backtick run when it is never closed (the run is then literal text).
 */
export function codeSpanEndOrRunEnd(text: string, start: number): number {
  const runLength = backtickRunLength(text, start);
  const closeStart = findCodeSpanClose(text, start, runLength);
  return closeStart === -1 ? start + runLength : closeStart + runLength;
}

/**
 * Code span: `code`, `` `code` `` (n backticks)
 * spec: Code Span
 */
function tryMatchCodeSpan(text: string, position: number): MatchResult | null {
  const runLength = backtickRunLength(text, position);
  const closeStart = findCodeSpanClose(text, position, runLength);
  if (closeStart === -1) return null;
  let code = text.slice(position + runLength, closeStart);
  if (runLength > 1 && code.startsWith(" ") && code.endsWith(" ")) {
    code = code.slice(1, -1);
  }
  const node: CodeSpanNode = { type: "code_span", code };
  return { node, end: closeStart + runLength };
}

/**
 * Image: ![alt](url "title" =WxH)
 * spec: Image
 */
function tryMatchImage(text: string, position: number): MatchResult | null {
  if (text[position] !== "!" || text[position + 1] !== "[") return null;

  const altEnd = findClosingBracket(text, position + 2);
  if (altEnd === -1) return null;

  if (text[altEnd + 1] !== "(") return null;

  const urlEnd = findClosingParen(text, altEnd + 2);
  if (urlEnd === -1) return null;

  const alt = unescapeBackslashes(text.slice(position + 2, altEnd));
  const { href, title, width, height } = parseImageContent(
    text.slice(altEnd + 2, urlEnd)
  );

  const node: ImageNode = { type: "image", alt, src: href, title, width, height };
  return { node, end: urlEnd + 1 };
}

/**
 * Inline footnote: ^[text]
 * spec: Inline Footnote
 */
function tryMatchInlineFootnote(
  text: string,
  position: number,
  context: ParseContext
): MatchResult | null {
  if (text[position] !== "^" || text[position + 1] !== "[") return null;

  const end = findClosingBracket(text, position + 2);
  if (end === -1) return null;

  let id: string;
  do {
    context.inlineFootnoteCount++;
    id = `__inline_${context.inlineFootnoteCount}`;
  } while (context.definedFootnoteIds.has(id));
  context.footnoteDefs[id] = parseInline(text.slice(position + 2, end), context);

  const node: InlineFootnoteNode = { type: "inline_footnote", id };
  return { node, end: end + 1 };
}

/**
 * Footnote reference: [^id]
 * spec: Footnote Reference
 */
function tryMatchFootnoteRef(
  text: string,
  position: number,
  context: ParseContext
): MatchResult | null {
  if (text[position] !== "[" || text[position + 1] !== "^") return null;

  const end = text.indexOf("]", position + 2);
  if (end === -1) return null;
  const id = text.slice(position + 2, end);
  if (id.includes(" ") || !context.definedFootnoteIds.has(id)) return null;

  const node: FootnoteRefNode = { type: "footnote_ref", id };
  return { node, end: end + 1 };
}

/**
 * Warp reference: [~id]
 * spec: Warp
 */
function tryMatchWarpRef(text: string, position: number): MatchResult | null {
  if (text[position] !== "[" || text[position + 1] !== "~") return null;

  const end = text.indexOf("]", position + 2);
  if (end === -1) return null;
  const id = text.slice(position + 2, end);
  if (!id || id.includes(" ")) return null;

  const node: WarpRefNode = { type: "warp_ref", id };
  return { node, end: end + 1 };
}

/**
 * Link starting with [
 * Priority: inline link [text](url) > reference link [text][id] or [text][] > implicit link [text]
 * spec: Inline Link, Reference Link
 */
function tryMatchBracketExpression(
  text: string,
  position: number,
  context: ParseContext
): MatchResult | null {
  if (text[position] !== "[") return null;

  // [^ and [~ are footnote and warp references, not links
  if (text[position + 1] === "^") return tryMatchFootnoteRef(text, position, context);
  if (text[position + 1] === "~") return tryMatchWarpRef(text, position);

  const textEnd = findClosingBracket(text, position + 1);
  if (textEnd === -1) return null;

  const linkText = text.slice(position + 1, textEnd);
  const afterBracket = textEnd + 1;

  const linkNode = (href: string, title: string | undefined, end: number): MatchResult => {
    const node: LinkNode = { type: "link", text: parseInline(linkText, context), href, title };
    return { node, end };
  };

  // Inline link: [text](url)
  if (text[afterBracket] === "(") {
    const urlEnd = findClosingParen(text, afterBracket + 1);
    if (urlEnd !== -1) {
      const { href, title } = parseLinkContent(text.slice(afterBracket + 1, urlEnd));
      return linkNode(href, title, urlEnd + 1);
    }
  }

  // Reference link: [text][id], or [text][] using the text as id
  if (text[afterBracket] === "[") {
    const idEnd = text.indexOf("]", afterBracket + 1);
    if (idEnd !== -1) {
      const id = (text.slice(afterBracket + 1, idEnd).trim() || linkText.trim()).toLowerCase();
      const definition = context.linkDefs[id];
      if (definition) return linkNode(definition.href, definition.title, idEnd + 1);
    }
  }

  // Implicit link: [text] whose text matches a link definition
  const implicitDefinition = context.linkDefs[linkText.trim().toLowerCase()];
  if (implicitDefinition) return linkNode(implicitDefinition.href, implicitDefinition.title, afterBracket);

  return null;
}

/**
 * Strong: **text** or __text__
 * spec: Strong (Bold)
 */
function tryMatchStrong(
  text: string,
  position: number,
  context: ParseContext
): MatchResult | null {
  const character = text[position];
  if ((character !== "*" && character !== "_") || text[position + 1] !== character) return null;
  // Don't consume *** (triple) — let the outer loop emit one literal char
  if (text[position + 2] === character) return null;

  if (!canOpenDelimiter(text, position, 2)) return null;

  const delimiter = character + character;
  const contentStart = position + 2;

  const closeIndex = findClosingDelimiter(text, contentStart, delimiter);
  if (closeIndex === -1) return null;

  // Content cannot span newlines
  const content = text.slice(contentStart, closeIndex);
  if (content.includes("\n")) return null;

  const node: StrongNode = {
    type: "strong",
    children: parseInline(content, context),
  };
  return { node, end: closeIndex + 2 };
}

/**
 * Emphasis: *text* or _text_
 * spec: Emphasis (Italic)
 */
function tryMatchEmphasis(
  text: string,
  position: number,
  context: ParseContext
): MatchResult | null {
  const character = text[position];
  if (character !== "*" && character !== "_") return null;
  // Must be single (not **)
  if (text[position + 1] === character) return null;
  if (!canOpenDelimiter(text, position, 1)) return null;

  const contentStart = position + 1;
  const closeIndex = findClosingDelimiter(text, contentStart, character);
  if (closeIndex === -1) return null;

  const content = text.slice(contentStart, closeIndex);
  if (content.includes("\n")) return null;

  const node: EmphasisNode = {
    type: "emphasis",
    children: parseInline(content, context),
  };
  return { node, end: closeIndex + 1 };
}

/**
 * Strikethrough: ~~text~~
 * spec: Strikethrough
 */
function tryMatchStrikethrough(
  text: string,
  position: number,
  context: ParseContext
): MatchResult | null {
  if (text[position] !== "~" || text[position + 1] !== "~") return null;
  // Reject ~~~
  if (text[position + 2] === "~") return null;
  if (!canOpenDelimiter(text, position, 2)) return null;

  const contentStart = position + 2;
  const closeIndex = findClosingDelimiter(text, contentStart, "~~");
  if (closeIndex === -1) return null;

  const content = text.slice(contentStart, closeIndex);
  if (content.includes("\n")) return null;

  const node: StrikethroughNode = {
    type: "strikethrough",
    children: parseInline(content, context),
  };
  return { node, end: closeIndex + 2 };
}

// ============================================================
// Main inline parser
// ============================================================

/**
 * Parses inline Markdown syntax within a single block of text.
 * Evaluation order (left-to-right scan, priority by pattern):
 *   backslash escape > code span > image > inline-footnote > [bracket-exprs] > strong > emphasis > strikethrough > line-break
 */
export function parseInline(text: string, context: ParseContext): InlineNode[] {
  const nodes: InlineNode[] = [];
  let position = 0;
  let textStart = 0;

  function flushText(): void {
    if (position > textStart) {
      const pendingText = text.slice(textStart, position);
      const previousNode = nodes[nodes.length - 1];
      if (previousNode?.type === "text") {
        previousNode.text += pendingText;
      } else {
        nodes.push({ type: "text", text: pendingText } as TextNode);
      }
    }
    textStart = position;
  }

  while (position < text.length) {
    const character = text[position];
    let result: MatchResult | null = null;

    // spec: Backslash Escapes
    if (character === "\\" && isAsciiPunctuation(text[position + 1])) {
      flushText();
      textStart = position + 1;
      position += 2;
      continue;
    }

    if (character === "`") {
      result = tryMatchCodeSpan(text, position);
      if (!result) {
        position += backtickRunLength(text, position);
        continue;
      }
    } else if (character === "!" && text[position + 1] === "[") {
      result = tryMatchImage(text, position);
    } else if (character === "^" && text[position + 1] === "[") {
      result = tryMatchInlineFootnote(text, position, context);
    } else if (character === "[") {
      result = tryMatchBracketExpression(text, position, context);
    } else if (
      (character === "*" || character === "_") &&
      text[position + 1] === character &&
      text[position + 2] !== character
    ) {
      // Potential strong (** or __)
      result = tryMatchStrong(text, position, context);
    } else if (
      (character === "*" || character === "_") &&
      text[position + 1] !== character
    ) {
      // Potential emphasis
      result = tryMatchEmphasis(text, position, context);
    } else if (character === "~" && text[position + 1] === "~" && text[position + 2] !== "~") {
      result = tryMatchStrikethrough(text, position, context);
    } else if (character === "\n") {
      flushText();
      nodes.push({ type: "line_break" } as LineBreakNode);
      position++;
      textStart = position;
      continue;
    }
    // Triple star/underscore: emit one literal char and let the next iteration handle **
    else if (
      (character === "*" || character === "_") &&
      text[position + 1] === character &&
      text[position + 2] === character
    ) {
      position++;
      continue;
    }

    if (result) {
      flushText();
      nodes.push(result.node);
      position = result.end;
      textStart = position;
    } else {
      position++;
    }
  }

  flushText();
  return nodes;
}

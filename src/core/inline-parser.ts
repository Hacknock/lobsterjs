import type {
  InlineNode,
  TextNode,
  EmphasisNode,
  StrongNode,
  StrikethroughNode,
  CodeSpanNode,
  InlineLinkNode,
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

function isAsciiPunctuation(ch: string | undefined): boolean {
  return ch !== undefined && ASCII_PUNCTUATION.test(ch);
}

function isWordCharacter(ch: string | undefined): boolean {
  return ch !== undefined && WORD_CHARACTER.test(ch);
}

function isWhitespaceOrBoundary(ch: string | undefined): boolean {
  return ch === undefined || WHITESPACE.test(ch);
}

function characterStartingAt(text: string, index: number): string | undefined {
  const codePoint = text.codePointAt(index);
  return codePoint === undefined ? undefined : String.fromCodePoint(codePoint);
}

function characterEndingBefore(text: string, index: number): string | undefined {
  return Array.from(text.slice(Math.max(0, index - 2), index)).pop();
}

/**
 * spec: バックスラッシュエスケープ — a character preceded by an odd number of `\` is escaped.
 */
function isEscaped(text: string, index: number): boolean {
  let backslashCount = 0;
  for (let i = index - 1; i >= 0 && text[i] === "\\"; i--) backslashCount++;
  return backslashCount % 2 === 1;
}

/**
 * spec: 強調・強勢・打ち消し線の区切り文字
 * An opening delimiter must not be followed by whitespace, and `_` must not
 * be preceded by a word character (intraword `_` is literal).
 */
function canOpenDelimiter(
  text: string,
  delimiterStart: number,
  delimiterLength: number
): boolean {
  if (isWhitespaceOrBoundary(text[delimiterStart + delimiterLength])) return false;
  const ch = text[delimiterStart];
  if (ch === "_") {
    let beforeRun = delimiterStart - 1;
    while (beforeRun >= 0 && text[beforeRun] === ch) beforeRun--;
    if (isWordCharacter(characterEndingBefore(text, beforeRun + 1))) return false;
  }
  return true;
}

/**
 * spec: 強調・強勢・打ち消し線の区切り文字
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
 * spec: バックスラッシュエスケープ — removes the backslash from escaped ASCII
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
  let searchPos = searchStart;
  while (searchPos < text.length) {
    const closeIdx = text.indexOf(delimiter, searchPos);
    if (closeIdx === -1) return -1;
    if (isEscaped(text, closeIdx)) {
      searchPos = closeIdx + 1;
      continue;
    }
    if (delimiter.length === 1 && text[closeIdx + 1] === delimiter) {
      searchPos = closeIdx + 2;
      continue;
    }
    if (canCloseDelimiter(text, closeIdx, delimiter.length)) return closeIdx;
    searchPos = closeIdx + 1;
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
  const m =
    content.match(/^(\S+)\s+"((?:[^"\\]|\\.)*)"$/) ??
    content.match(/^(\S+)\s+'((?:[^'\\]|\\.)*)'$/) ??
    content.match(/^(\S+)\s+\(((?:[^)\\]|\\.)*)\)$/);
  if (m) return { href: unescapeBackslashes(m[1]), title: unescapeBackslashes(m[2]) };
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

/**
 * Code span: `code`, `` `code` `` (n backticks)
 * spec: コードスパン
 */
function tryMatchCodeSpan(text: string, pos: number): MatchResult | null {
  if (text[pos] !== "`") return null;

  // Count opening backticks
  let count = 0;
  while (pos + count < text.length && text[pos + count] === "`") count++;

  const openStr = "`".repeat(count);
  const contentStart = pos + count;
  let searchPos = contentStart;

  while (searchPos < text.length) {
    const closeIdx = text.indexOf(openStr, searchPos);
    if (closeIdx === -1) return null;
    // Make sure it's not n+1 backticks
    if (text[closeIdx + count] !== "`") {
      let code = text.slice(contentStart, closeIdx);
      // Strip one leading/trailing space if count > 1 and both present
      if (count > 1 && code.startsWith(" ") && code.endsWith(" ")) {
        code = code.slice(1, -1);
      }
      const node: CodeSpanNode = { type: "code_span", code };
      return { node, end: closeIdx + count };
    }
    searchPos = closeIdx + 1;
  }
  return null;
}

/**
 * Image: ![alt](url "title" =WxH)
 * spec: 画像
 */
function tryMatchImage(
  text: string,
  pos: number,
  ctx: ParseContext
): MatchResult | null {
  if (text[pos] !== "!" || text[pos + 1] !== "[") return null;

  const altEnd = findClosingBracket(text, pos + 2);
  if (altEnd === -1) return null;

  if (text[altEnd + 1] !== "(") return null;

  const urlEnd = findClosingParen(text, altEnd + 2);
  if (urlEnd === -1) return null;

  const alt = unescapeBackslashes(text.slice(pos + 2, altEnd));
  const { href, title, width, height } = parseImageContent(
    text.slice(altEnd + 2, urlEnd)
  );

  // suppress unused ctx warning — ctx available for future use (e.g. base URL)
  void ctx;

  const node: ImageNode = { type: "image", alt, src: href, title, width, height };
  return { node, end: urlEnd + 1 };
}

/**
 * Inline footnote: ^[text]
 * spec: インライン脚注
 */
function tryMatchInlineFootnote(
  text: string,
  pos: number,
  ctx: ParseContext
): MatchResult | null {
  if (text[pos] !== "^" || text[pos + 1] !== "[") return null;

  const end = findClosingBracket(text, pos + 2);
  if (end === -1) return null;

  const content = text.slice(pos + 2, end);
  ctx.inlineFootnoteCount++;
  const id = `__inline_${ctx.inlineFootnoteCount}`;
  ctx.footnoteRefs.push(id);
  const children = parseInline(content, ctx);
  // Store the parsed content so the renderer can output it
  ctx.footnoteDefs[id] = children;

  const node: InlineFootnoteNode = { type: "inline_footnote", children };
  return { node, end: end + 1 };
}

/**
 * Footnote reference: [^id]
 * spec: 脚注
 */
function tryMatchFootnoteRef(
  text: string,
  pos: number,
  ctx: ParseContext
): MatchResult | null {
  if (text[pos] !== "[" || text[pos + 1] !== "^") return null;

  const end = text.indexOf("]", pos + 2);
  if (end === -1) return null;
  const id = text.slice(pos + 2, end);
  if (id.includes(" ")) return null;

  if (!ctx.footnoteRefs.includes(id)) {
    ctx.footnoteRefs.push(id);
  }

  const node: FootnoteRefNode = { type: "footnote_ref", id };
  return { node, end: end + 1 };
}

/**
 * Warp reference: [~id]
 * spec: ワープ
 */
function tryMatchWarpRef(text: string, pos: number): MatchResult | null {
  if (text[pos] !== "[" || text[pos + 1] !== "~") return null;

  const end = text.indexOf("]", pos + 2);
  if (end === -1) return null;
  const id = text.slice(pos + 2, end);
  if (!id || id.includes(" ")) return null;

  const node: WarpRefNode = { type: "warp_ref", id };
  return { node, end: end + 1 };
}

/**
 * Link or inline link starting with [
 * Priority: inline link [text](url) > reference link [text][id] > implicit [text][]
 * spec: リンク, インラインリンク
 */
function tryMatchBracketExpression(
  text: string,
  pos: number,
  ctx: ParseContext
): MatchResult | null {
  if (text[pos] !== "[") return null;

  // Inline link must not start with [^ or [~
  if (text[pos + 1] === "^") return tryMatchFootnoteRef(text, pos, ctx);
  if (text[pos + 1] === "~") return tryMatchWarpRef(text, pos);

  const textEnd = findClosingBracket(text, pos + 1);
  if (textEnd === -1) return null;

  const linkText = text.slice(pos + 1, textEnd);
  const afterBracket = textEnd + 1;

  // Inline link: [text](url)
  if (text[afterBracket] === "(") {
    const urlEnd = findClosingParen(text, afterBracket + 1);
    if (urlEnd !== -1) {
      const { href, title } = parseLinkContent(
        text.slice(afterBracket + 1, urlEnd)
      );
      const node: InlineLinkNode = {
        type: "inline_link",
        text: parseInline(linkText, ctx),
        href,
        title,
      };
      return { node, end: urlEnd + 1 };
    }
  }

  // Reference link: [text][id]
  if (text[afterBracket] === "[") {
    const idEnd = text.indexOf("]", afterBracket + 1);
    if (idEnd !== -1) {
      const id = (text.slice(afterBracket + 1, idEnd).trim() || linkText.trim()).toLowerCase();
      const def = ctx.linkDefs[id];
      if (def) {
        const node: LinkNode = {
          type: "link",
          text: parseInline(linkText, ctx),
          href: def.href,
          title: def.title,
        };
        return { node, end: idEnd + 1 };
      }
    }
  }

  // Implicit shortcut: [text][]
  if (text[afterBracket] === "[" && text[afterBracket + 1] === "]") {
    const id = linkText.trim().toLowerCase();
    const def = ctx.linkDefs[id];
    if (def) {
      const node: LinkNode = {
        type: "link",
        text: parseInline(linkText, ctx),
        href: def.href,
        title: def.title,
      };
      return { node, end: afterBracket + 2 };
    }
  }

  // Implicit link (no bracket after): [text] if id matches
  const implicitId = linkText.trim().toLowerCase();
  const implicitDef = ctx.linkDefs[implicitId];
  if (implicitDef) {
    const node: LinkNode = {
      type: "link",
      text: parseInline(linkText, ctx),
      href: implicitDef.href,
      title: implicitDef.title,
    };
    return { node, end: afterBracket };
  }

  return null;
}

/**
 * Strong: **text** or __text__
 * spec: 強勢 - 太字
 */
function tryMatchStrong(
  text: string,
  pos: number,
  ctx: ParseContext
): MatchResult | null {
  const ch = text[pos];
  if ((ch !== "*" && ch !== "_") || text[pos + 1] !== ch) return null;
  // Don't consume *** (triple) — let the outer loop emit one literal char
  if (text[pos + 2] === ch) return null;

  if (!canOpenDelimiter(text, pos, 2)) return null;

  const delim = ch + ch;
  const contentStart = pos + 2;

  const closeIdx = findClosingDelimiter(text, contentStart, delim);
  if (closeIdx === -1) return null;

  // Content cannot span newlines
  const content = text.slice(contentStart, closeIdx);
  if (content.includes("\n")) return null;

  const node: StrongNode = {
    type: "strong",
    children: parseInline(content, ctx),
  };
  return { node, end: closeIdx + 2 };
}

/**
 * Emphasis: *text* or _text_
 * spec: 強調 - 斜体
 */
function tryMatchEmphasis(
  text: string,
  pos: number,
  ctx: ParseContext
): MatchResult | null {
  const ch = text[pos];
  if (ch !== "*" && ch !== "_") return null;
  // Must be single (not **)
  if (text[pos + 1] === ch) return null;
  if (!canOpenDelimiter(text, pos, 1)) return null;

  const contentStart = pos + 1;
  const closeIdx = findClosingDelimiter(text, contentStart, ch);
  if (closeIdx === -1) return null;

  const content = text.slice(contentStart, closeIdx);
  if (content.includes("\n")) return null;

  const node: EmphasisNode = {
    type: "emphasis",
    children: parseInline(content, ctx),
  };
  return { node, end: closeIdx + 1 };
}

/**
 * Strikethrough: ~~text~~
 * spec: 打ち消し線
 */
function tryMatchStrikethrough(
  text: string,
  pos: number,
  ctx: ParseContext
): MatchResult | null {
  if (text[pos] !== "~" || text[pos + 1] !== "~") return null;
  // Reject ~~~
  if (text[pos + 2] === "~") return null;
  if (!canOpenDelimiter(text, pos, 2)) return null;

  const contentStart = pos + 2;
  const closeIdx = findClosingDelimiter(text, contentStart, "~~");
  if (closeIdx === -1) return null;

  const content = text.slice(contentStart, closeIdx);
  if (content.includes("\n")) return null;

  const node: StrikethroughNode = {
    type: "strikethrough",
    children: parseInline(content, ctx),
  };
  return { node, end: closeIdx + 2 };
}

// ============================================================
// Main inline parser
// ============================================================

/**
 * Parses inline Markdown syntax within a single block of text.
 * Evaluation order (left-to-right scan, priority by pattern):
 *   backslash escape > code span > image > inline-footnote > [bracket-exprs] > strong > emphasis > strikethrough > line-break
 */
export function parseInline(text: string, ctx: ParseContext): InlineNode[] {
  const nodes: InlineNode[] = [];
  let pos = 0;
  let textStart = 0;

  function flushText(): void {
    if (pos > textStart) {
      const pendingText = text.slice(textStart, pos);
      const previousNode = nodes[nodes.length - 1];
      if (previousNode?.type === "text") {
        previousNode.text += pendingText;
      } else {
        nodes.push({ type: "text", text: pendingText } as TextNode);
      }
    }
    textStart = pos;
  }

  while (pos < text.length) {
    const ch = text[pos];
    let result: MatchResult | null = null;

    // spec: バックスラッシュエスケープ
    if (ch === "\\" && isAsciiPunctuation(text[pos + 1])) {
      flushText();
      textStart = pos + 1;
      pos += 2;
      continue;
    }

    if (ch === "`") {
      result = tryMatchCodeSpan(text, pos);
    } else if (ch === "!" && text[pos + 1] === "[") {
      result = tryMatchImage(text, pos, ctx);
    } else if (ch === "^" && text[pos + 1] === "[") {
      result = tryMatchInlineFootnote(text, pos, ctx);
    } else if (ch === "[") {
      result = tryMatchBracketExpression(text, pos, ctx);
    } else if (
      (ch === "*" || ch === "_") &&
      text[pos + 1] === ch &&
      text[pos + 2] !== ch
    ) {
      // Potential strong (**/**)
      result = tryMatchStrong(text, pos, ctx);
    } else if (
      (ch === "*" || ch === "_") &&
      text[pos + 1] !== ch
    ) {
      // Potential emphasis
      result = tryMatchEmphasis(text, pos, ctx);
    } else if (ch === "~" && text[pos + 1] === "~" && text[pos + 2] !== "~") {
      result = tryMatchStrikethrough(text, pos, ctx);
    } else if (ch === "\n") {
      flushText();
      nodes.push({ type: "line_break" } as LineBreakNode);
      pos++;
      textStart = pos;
      continue;
    }
    // Triple star/underscore: emit one literal char and let the next iteration handle **
    else if (
      (ch === "*" || ch === "_") &&
      text[pos + 1] === ch &&
      text[pos + 2] === ch
    ) {
      pos++;
      continue;
    }

    if (result) {
      flushText();
      nodes.push(result.node);
      pos = result.end;
      textStart = pos;
    } else {
      pos++;
    }
  }

  flushText();
  return nodes;
}

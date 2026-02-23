function I(e, t) {
  let n = 1;
  for (let r = t; r < e.length; r++)
    if (e[r] === "[") n++;
    else if (e[r] === "]") {
      if (n--, n === 0) return r;
    } else if (e[r] === `
`)
      return -1;
  return -1;
}
function O(e, t) {
  let n = 1;
  for (let r = t; r < e.length; r++)
    if (e[r] === "(") n++;
    else if (e[r] === ")" && (n--, n === 0))
      return r;
  return -1;
}
function M(e) {
  e = e.trim();
  const t = e.match(/^(\S+)\s+"([^"]*)"$/) ?? e.match(/^(\S+)\s+'([^']*)'$/) ?? e.match(/^(\S+)\s+\(([^)]*)\)$/);
  return t ? { href: t[1], title: t[2] } : { href: e };
}
function X(e) {
  e = e.trim();
  const t = e.match(/\s+=(\d*)x(\d*)\s*$/);
  let n, r;
  return t && (t[1] && (n = parseInt(t[1], 10)), t[2] && (r = parseInt(t[2], 10)), e = e.slice(0, -t[0].length).trim()), { ...M(e), width: n, height: r };
}
function K(e, t) {
  if (e[t] !== "`") return null;
  let n = 0;
  for (; t + n < e.length && e[t + n] === "`"; ) n++;
  const r = "`".repeat(n), o = t + n;
  let s = o;
  for (; s < e.length; ) {
    const i = e.indexOf(r, s);
    if (i === -1) return null;
    if (e[i + n] !== "`") {
      let l = e.slice(o, i);
      return n > 1 && l.startsWith(" ") && l.endsWith(" ") && (l = l.slice(1, -1)), { node: { type: "code_span", code: l }, end: i + n };
    }
    s = i + 1;
  }
  return null;
}
function G(e, t, n) {
  if (e[t] !== "!" || e[t + 1] !== "[") return null;
  const r = I(e, t + 2);
  if (r === -1 || e[r + 1] !== "(") return null;
  const o = O(e, r + 2);
  if (o === -1) return null;
  const s = e.slice(t + 2, r), { href: i, title: l, width: c, height: a } = X(
    e.slice(r + 2, o)
  );
  return { node: { type: "image", alt: s, src: i, title: l, width: c, height: a }, end: o + 1 };
}
function J(e, t, n) {
  if (e[t] !== "^" || e[t + 1] !== "[") return null;
  const r = I(e, t + 2);
  if (r === -1) return null;
  const o = e.slice(t + 2, r);
  n.inlineFootnoteCount++;
  const s = `__inline_${n.inlineFootnoteCount}`;
  n.footnoteRefs.push(s);
  const i = m(o, n);
  return n.footnoteDefs[s] = i, { node: { type: "inline_footnote", children: i }, end: r + 1 };
}
function Q(e, t, n) {
  if (e[t] !== "[" || e[t + 1] !== "^") return null;
  const r = e.indexOf("]", t + 2);
  if (r === -1) return null;
  const o = e.slice(t + 2, r);
  return o.includes(" ") ? null : (n.footnoteRefs.includes(o) || n.footnoteRefs.push(o), { node: { type: "footnote_ref", id: o }, end: r + 1 });
}
function U(e, t) {
  if (e[t] !== "[" || e[t + 1] !== "~") return null;
  const n = e.indexOf("]", t + 2);
  if (n === -1) return null;
  const r = e.slice(t + 2, n);
  return !r || r.includes(" ") ? null : { node: { type: "warp_ref", id: r }, end: n + 1 };
}
function V(e, t, n) {
  if (e[t] !== "[") return null;
  if (e[t + 1] === "^") return Q(e, t, n);
  if (e[t + 1] === "~") return U(e, t);
  const r = I(e, t + 1);
  if (r === -1) return null;
  const o = e.slice(t + 1, r), s = r + 1;
  if (e[s] === "(") {
    const c = O(e, s + 1);
    if (c !== -1) {
      const { href: a, title: f } = M(
        e.slice(s + 1, c)
      );
      return { node: {
        type: "inline_link",
        text: m(o, n),
        href: a,
        title: f
      }, end: c + 1 };
    }
  }
  if (e[s] === "[") {
    const c = e.indexOf("]", s + 1);
    if (c !== -1) {
      const a = (e.slice(s + 1, c).trim() || o.trim()).toLowerCase(), f = n.linkDefs[a];
      if (f)
        return { node: {
          type: "link",
          text: m(o, n),
          href: f.href,
          title: f.title
        }, end: c + 1 };
    }
  }
  if (e[s] === "[" && e[s + 1] === "]") {
    const c = o.trim().toLowerCase(), a = n.linkDefs[c];
    if (a)
      return { node: {
        type: "link",
        text: m(o, n),
        href: a.href,
        title: a.title
      }, end: s + 2 };
  }
  const i = o.trim().toLowerCase(), l = n.linkDefs[i];
  return l ? { node: {
    type: "link",
    text: m(o, n),
    href: l.href,
    title: l.title
  }, end: s } : null;
}
function Y(e, t, n) {
  const r = e[t];
  if (r !== "*" && r !== "_" || e[t + 1] !== r || e[t + 2] === r) return null;
  const o = r + r, s = t + 2, i = e.indexOf(o, s);
  if (i === -1) return null;
  const l = e.slice(s, i);
  return l.includes(`
`) ? null : { node: {
    type: "strong",
    children: m(l, n)
  }, end: i + 2 };
}
function Z(e, t, n) {
  const r = e[t];
  if (r !== "*" && r !== "_" || e[t + 1] === r) return null;
  const o = t + 1;
  let s = o;
  for (; s < e.length; ) {
    const i = e.indexOf(r, s);
    if (i === -1) return null;
    if (e[i + 1] === r) {
      s = i + 2;
      continue;
    }
    const l = e.slice(o, i);
    return l.includes(`
`) ? null : { node: {
      type: "emphasis",
      children: m(l, n)
    }, end: i + 1 };
  }
  return null;
}
function x(e, t, n) {
  if (e[t] !== "~" || e[t + 1] !== "~" || e[t + 2] === "~") return null;
  const r = t + 2, o = e.indexOf("~~", r);
  if (o === -1) return null;
  const s = e.slice(r, o);
  return s.includes(`
`) ? null : { node: {
    type: "strikethrough",
    children: m(s, n)
  }, end: o + 2 };
}
function m(e, t) {
  const n = [];
  let r = 0, o = 0;
  function s() {
    r > o && n.push({ type: "text", text: e.slice(o, r) }), o = r;
  }
  for (; r < e.length; ) {
    const i = e[r];
    let l = null;
    if (i === "`")
      l = K(e, r);
    else if (i === "!" && e[r + 1] === "[")
      l = G(e, r);
    else if (i === "^" && e[r + 1] === "[")
      l = J(e, r, t);
    else if (i === "[")
      l = V(e, r, t);
    else if ((i === "*" || i === "_") && e[r + 1] === i && e[r + 2] !== i)
      l = Y(e, r, t);
    else if ((i === "*" || i === "_") && e[r + 1] !== i)
      l = Z(e, r, t);
    else if (i === "~" && e[r + 1] === "~" && e[r + 2] !== "~")
      l = x(e, r, t);
    else if (i === `
`) {
      s(), n.push({ type: "line_break" }), r++, o = r;
      continue;
    } else if ((i === "*" || i === "_") && e[r + 1] === i && e[r + 2] === i) {
      r++;
      continue;
    }
    l ? (s(), n.push(l.node), r = l.end, o = r) : r++;
  }
  return s(), n;
}
function P(e) {
  return e.map((t) => t.trimEnd());
}
function k(e) {
  return e.trim() === "";
}
function B(e) {
  return /^\s*(-\s*){3,}$/.test(e) || /^\s*(\*\s*){3,}$/.test(e);
}
function j(e) {
  const t = e.match(/^(#{1,6})\s+(.+?)(\s+#+\s*)?$/);
  return t ? { level: t[1].length, text: t[2].trimEnd() } : null;
}
function A(e) {
  const t = e.match(/^(`{3,}|~{3,})([\w+-]*)(?::(.+))?/);
  return t ? {
    marker: t[1],
    language: t[2] || void 0,
    filename: t[3] || void 0
  } : null;
}
function ee(e) {
  return e.map((t) => t.replace(/^>\s?/, ""));
}
function b(e) {
  const t = e.match(/^(\s*)([-*+])\s+(.*)/);
  if (t) {
    const r = t[1].length, o = r + 2;
    let s = t[3], i;
    const l = s.match(/^\[([ xX])\]\s+(.*)/);
    return l && (i = l[1] !== " ", s = l[2]), { indent: r, marker: "bullet", checked: i, textStart: o, text: s };
  }
  const n = e.match(/^(\s*)(\d+)\.\s+(.*)/);
  if (n) {
    const r = n[1].length, o = parseInt(n[2], 10), s = r + n[2].length + 2;
    let i = n[3], l;
    const c = i.match(/^\[([ xX])\]\s+(.*)/);
    return c && (l = c[1] !== " ", i = c[2]), { indent: r, marker: "ordered", start: o, checked: l, textStart: s, text: i };
  }
  return null;
}
function D(e) {
  return e.replace(/^\s*~?\s*\|?\s*/, "").replace(/\s*\|?\s*$/, "").split("|").map((n) => n.trim());
}
function te(e) {
  const t = e.trim(), n = t.startsWith(":"), r = t.endsWith(":");
  return n && r ? "center" : n ? "left" : r ? "right" : "default";
}
function S(e) {
  const t = D(e);
  return t.length > 0 && t.every((n) => /^:?-+:?$/.test(n));
}
const H = /^\[([^\]]+)\]:\s+(\S+)(?:\s+(?:"([^"]+)"|'([^']+)'|\(([^)]+)\)))?/, T = /^\[\^([^\]\s]+)\]:\s*(.*)/;
function ne(e) {
  const t = {}, n = {};
  for (const r of e) {
    const o = r.match(T);
    if (o) {
      n[o[1]] = o[2];
      continue;
    }
    const s = r.match(H);
    if (s) {
      const i = s[1].toLowerCase();
      t[i] = {
        href: s[2],
        title: s[3] ?? s[4] ?? s[5]
      };
      continue;
    }
  }
  return { linkDefs: t, rawFootnoteDefs: n };
}
function re(e) {
  return e.filter((t) => !H.test(t) && !T.test(t));
}
function se(e, t) {
  let n, r;
  const o = {}, s = [], i = [];
  let l = 0;
  for (; l < e.length; ) {
    const c = e[l];
    if (/^:::header\s*$/.test(c)) {
      const u = [];
      for (l++; l < e.length && !/^:::\s*$/.test(e[l]); )
        u.push(e[l]), l++;
      l++, n = { type: "header_container", children: [] }, n.children = _(u, t);
      continue;
    }
    if (/^:::footer\s*$/.test(c)) {
      const u = [];
      for (l++; l < e.length && !/^:::\s*$/.test(e[l]); )
        u.push(e[l]), l++;
      l++, r = { type: "footer_container", children: [] }, r.children = _(u, t);
      continue;
    }
    const a = c.match(/^:::warp\s+(\S+)\s*$/);
    if (a) {
      const u = a[1], p = [];
      for (l++; l < e.length && !/^:::\s*$/.test(e[l]); )
        p.push(e[l]), l++;
      l++;
      const d = {
        type: "warp_definition",
        id: u,
        children: []
        // filled below
      };
      d.children = _(p, t), o[u] && (d.id = `__duplicate_${u}`), o[a[1]] = d;
      continue;
    }
    const f = c.match(/^:::details\s+(.*?)\s*$/);
    if (f) {
      const u = f[1], p = [], d = s.length;
      for (l++; l < e.length && !/^:::\s*$/.test(e[l]); )
        p.push(e[l]), l++;
      l++;
      const $ = {
        type: "details",
        title: u,
        children: _(p, t)
      };
      s.push(`__DETAILS_PLACEHOLDER_${i.length}__`), i.push({ startIdx: d, node: $ });
      continue;
    }
    s.push(c), l++;
  }
  return { header: n, footer: r, warpDefs: o, remainingLines: s, detailsBlocks: i };
}
function oe(e, t, n) {
  const r = j(e[t]);
  return r ? { node: {
    type: "heading",
    level: r.level,
    children: m(r.text, n)
  }, nextIndex: t + 1 } : null;
}
function ie(e, t) {
  return B(e[t]) ? { node: { type: "horizontal_rule" }, nextIndex: t + 1 } : null;
}
function le(e, t) {
  const n = A(e[t]);
  if (!n) return null;
  const r = [], o = n.marker[0], s = n.marker.length;
  let i = t + 1;
  for (; i < e.length; ) {
    if (e[i].match(/^(`{3,}|~{3,})$/) && e[i][0] === o && e[i].length >= s) {
      i++;
      break;
    }
    r.push(e[i]), i++;
  }
  return { node: {
    type: "code_block",
    language: n.language,
    filename: n.filename,
    code: r.join(`
`)
  }, nextIndex: i };
}
function ce(e, t, n) {
  if (!e[t].startsWith(">")) return null;
  const r = [];
  let o = t;
  for (; o < e.length && (e[o].startsWith(">") || !k(e[o])) && (e[o].startsWith(">"), r.push(e[o]), o++, !(o < e.length && k(e[o]))); )
    ;
  const s = ee(r);
  return { node: {
    type: "blockquote",
    children: _(s, n)
  }, nextIndex: o };
}
function ae(e, t, n) {
  const r = b(e[t]);
  return r ? r.marker === "bullet" ? R(e, t, 0, n) : C(e, t, 0, n) : null;
}
function R(e, t, n, r) {
  const o = [];
  let s = t;
  for (; s < e.length; ) {
    if (k(e[s])) {
      s++;
      continue;
    }
    const l = b(e[s]);
    if (!l || l.marker !== "bullet" || l.indent < n) break;
    const c = [l.text];
    for (s++; s < e.length && !k(e[s]); ) {
      const f = b(e[s]);
      if (f) {
        if (f.indent > l.indent)
          break;
        break;
      }
      if (e[s].match(/^\s/))
        c.push(e[s].trimStart()), s++;
      else
        break;
    }
    let a;
    if (s < e.length) {
      const f = b(e[s]);
      if (f && f.indent > l.indent) {
        const u = f.marker === "bullet" ? R(e, s, f.indent, r) : C(e, s, f.indent, r);
        a = u.node, s = u.nextIndex;
      }
    }
    o.push({
      checked: l.checked,
      children: m(c.join(" "), r),
      sublist: a
    });
  }
  return { node: { type: "bullet_list", depth: n, items: o }, nextIndex: s };
}
function C(e, t, n, r) {
  const o = [];
  let s = t, i = 1, l = !0;
  for (; s < e.length; ) {
    if (k(e[s])) {
      s++;
      continue;
    }
    const a = b(e[s]);
    if (!a || a.marker !== "ordered" || a.indent < n) break;
    l && (i = a.start ?? 1, l = !1);
    const f = [a.text];
    for (s++; s < e.length && !(k(e[s]) || b(e[s])); )
      if (e[s].match(/^\s/))
        f.push(e[s].trimStart()), s++;
      else
        break;
    let u;
    if (s < e.length) {
      const p = b(e[s]);
      if (p && p.indent > a.indent) {
        const d = p.marker === "bullet" ? R(e, s, p.indent, r) : C(e, s, p.indent, r);
        u = d.node, s = d.nextIndex;
      }
    }
    o.push({
      checked: a.checked,
      children: m(f.join(" "), r),
      sublist: u
    });
  }
  return { node: { type: "ordered_list", depth: n, start: i, items: o }, nextIndex: s };
}
function ue(e, t, n) {
  const r = e[t], o = /^\s*~\s+\|/.test(r) || /^\s*~\s+/.test(r), s = (d) => o ? /^\s*~\s*\|/.test(d) || /^\s*~\s+/.test(d) : /^\s*\|/.test(d) || d.includes("|");
  if (!s(r) || t + 1 >= e.length || !S(e[t + 1]) && !(o && S(e[t + 1].replace(/^\s*~\s*/, ""))))
    return null;
  const i = o ? r.replace(/^\s*~\s*/, "") : r, l = D(i).map(
    (d) => ({
      children: m(d, n)
    })
  ), c = o ? e[t + 1].replace(/^\s*~\s*/, "") : e[t + 1], a = D(c).map(te), f = [];
  let u = t + 2;
  for (; u < e.length && s(e[u]); ) {
    const d = o ? e[u].replace(/^\s*~\s*/, "") : e[u], $ = D(d);
    for (; $.length < l.length; ) $.push("");
    const w = [];
    for (let L = 0; L < $.length; L++) {
      if ($[L] === "\\") {
        if (w.length > 0) {
          const E = w[w.length - 1];
          E.colspan = (E.colspan ?? 1) + 1;
        }
        continue;
      }
      if (/^\\-+$/.test($[L])) {
        w.push({ children: [{ type: "text", text: "__ROWSPAN__" }] });
        continue;
      }
      w.push({
        children: m($[L], n)
      });
    }
    f.push(w), u++;
  }
  return { node: {
    type: "table",
    isSilent: o,
    headers: l,
    alignments: a,
    rows: f
  }, nextIndex: u };
}
function fe(e, t, n) {
  const r = [];
  let o = t;
  for (; o < e.length; ) {
    const c = e[o];
    if (k(c) || j(c) || B(c) || A(c) || c.startsWith(">") || b(c) || /^\s*\|/.test(c) || /^\s*~\s*\|/.test(c) || /^:::/.test(c) || /^__DETAILS_PLACEHOLDER_/.test(c))
      break;
    r.push(c), o++;
  }
  const s = r.join(`
`), i = m(s, n);
  for (; i.length > 0 && i[i.length - 1].type === "line_break"; )
    i.pop();
  return { node: { type: "paragraph", children: i }, nextIndex: o };
}
function _(e, t) {
  const n = [], r = P(e);
  let o = 0;
  for (; o < r.length; ) {
    const s = r[o];
    if (k(s)) {
      o++;
      continue;
    }
    if (/^__DETAILS_PLACEHOLDER_\d+__$/.test(s)) {
      n.push({ type: "paragraph", children: [{ type: "text", text: s }] }), o++;
      continue;
    }
    let i = null;
    i ?? (i = oe(r, o, t)), i ?? (i = ie(r, o)), i ?? (i = le(r, o)), i ?? (i = ce(r, o, t)), i ?? (i = ae(r, o, t)), i ?? (i = ue(r, o, t)), i || (i = fe(r, o, t)), n.push(i.node), o = i.nextIndex;
  }
  return n;
}
function v(e) {
  const t = e.split(`
`), n = P(t), { linkDefs: r, rawFootnoteDefs: o } = ne(n), s = re(n), i = {
    linkDefs: r,
    footnoteDefs: {},
    warpDefs: {},
    footnoteRefs: [],
    inlineFootnoteCount: 0
  };
  for (const [a, f] of Object.entries(o))
    i.footnoteDefs[a] = m(f, i);
  const l = se(s, i);
  i.warpDefs = l.warpDefs;
  let c = _(l.remainingLines, i);
  return l.detailsBlocks.length > 0 && (c = c.map((a) => {
    if (a.type === "paragraph" && a.children.length === 1 && a.children[0].type === "text") {
      const u = a.children[0].text.match(/^__DETAILS_PLACEHOLDER_(\d+)__$/);
      if (u) {
        const p = parseInt(u[1], 10);
        return l.detailsBlocks[p].node;
      }
    }
    return a;
  })), {
    header: l.header,
    footer: l.footer,
    body: c,
    linkDefs: r,
    footnoteDefs: i.footnoteDefs,
    footnoteRefs: i.footnoteRefs,
    warpDefs: l.warpDefs
  };
}
function h(e) {
  return e.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
function g(e, t) {
  return e.map((n) => de(n, t)).join("");
}
function de(e, t) {
  switch (e.type) {
    case "text":
      return h(e.text);
    case "line_break":
      return "<br>";
    case "emphasis":
      return `<span class="lbs-emphasis">${g(e.children, t)}</span>`;
    case "strong":
      return `<span class="lbs-strong">${g(e.children, t)}</span>`;
    case "strikethrough":
      return `<span class="lbs-strikethrough">${g(e.children, t)}</span>`;
    case "code_span":
      return `<code class="lbs-code-span">${h(e.code)}</code>`;
    case "inline_link": {
      const n = e, r = n.title ? ` title="${h(n.title)}"` : "";
      return `<a href="${h(n.href)}"${r}>${g(n.text, t)}</a>`;
    }
    case "link": {
      const n = e, r = n.title ? ` title="${h(n.title)}"` : "";
      return `<a href="${h(n.href)}"${r}>${g(n.text, t)}</a>`;
    }
    case "image": {
      const n = e, r = n.title ? ` title="${h(n.title)}"` : "", o = n.width ? ` width="${n.width}"` : "", s = n.height ? ` height="${n.height}"` : "";
      return `<img src="${h(n.src)}" alt="${h(n.alt)}"${r}${o}${s} class="lbs-image">`;
    }
    case "footnote_ref": {
      const n = e, o = t.footnoteRefs.indexOf(n.id) + 1, s = t.footnoteRefCount[n.id] ?? 0;
      t.footnoteRefCount[n.id] = s + 1;
      const i = s === 0 ? "" : `:${s}`, l = `[${o}${i}]`;
      return `<sup class="lbs-footnote-ref"><a href="#lbs-fn-${h(n.id)}" id="lbs-fnref-${h(n.id)}-${s}">${l}</a></sup>`;
    }
    case "inline_footnote": {
      const n = e, r = t.footnoteRefs.find(
        (i) => i.startsWith("__inline_") && t.footnoteDefs[i] === n.children
      );
      if (!r)
        return g(n.children, t);
      const s = t.footnoteRefs.indexOf(r) + 1;
      return `<sup class="lbs-footnote-ref"><a href="#lbs-fn-${h(r)}">[${s}]</a></sup>`;
    }
    case "warp_ref": {
      const n = e, r = t.warpDefs[n.id];
      return r ? y(r.children, t) : "";
    }
    default:
      return "";
  }
}
function y(e, t) {
  return e.map((n) => F(n, t)).join(`
`);
}
function F(e, t) {
  switch (e.type) {
    case "heading":
      return he(e, t);
    case "paragraph":
      return pe(e, t);
    case "horizontal_rule":
      return '<hr class="lbs-hr">';
    case "code_block":
      return me(e);
    case "blockquote":
      return ge(e, t);
    case "bullet_list":
      return $e(e, t);
    case "ordered_list":
      return be(e, t);
    case "table":
      return ke(e, t);
    case "header_container":
      return q(e, t);
    case "footer_container":
      return N(e, t);
    case "details":
      return we(e, t);
    case "warp_definition":
      return "";
    default:
      return "";
  }
}
function he(e, t) {
  const n = g(e.children, t);
  return `<p class="lbs-heading-${e.level}">${n}</p>`;
}
function pe(e, t) {
  return `<p class="lbs-paragraph">${g(e.children, t)}</p>`;
}
function me(e) {
  const t = e.language ? ` data-language="${h(e.language)}"` : "", n = e.filename ? ` data-filename="${h(e.filename)}"` : "";
  return `<div class="lbs-code-block">${e.filename ? `<div class="lbs-code-filename">${h(e.filename)}</div>` : ""}<pre${t}${n}><code>${h(e.code)}</code></pre></div>`;
}
function ge(e, t) {
  return `<blockquote class="lbs-blockquote">${y(e.children, t)}</blockquote>`;
}
function W(e, t) {
  const n = e.checked !== void 0 ? `<input type="checkbox" class="lbs-checkbox"${e.checked ? " checked" : ""} disabled> ` : "", r = g(e.children, t), o = e.sublist ? `
` + F(e.sublist, t) : "";
  return `<li class="lbs-list-item">${n}${r}${o}</li>`;
}
function $e(e, t) {
  const n = e.items.map((r) => W(r, t)).join(`
`);
  return `<ul class="lbs-ul lbs-ul-depth-${e.depth}">
${n}
</ul>`;
}
function be(e, t) {
  const n = e.start !== 1 ? ` start="${e.start}"` : "", r = e.items.map((o) => W(o, t)).join(`
`);
  return `<ol class="lbs-ol lbs-ol-depth-${e.depth}"${n}>
${r}
</ol>`;
}
function ke(e, t) {
  const n = e.isSilent ? "lbs-table lbs-table-silent" : "lbs-table", r = e.headers.map((s, i) => {
    const l = e.alignments[i], c = l && l !== "default" ? ` style="text-align:${l}"` : "";
    return `<th${s.colspan ? ` colspan="${s.colspan}"` : ""}${c}>${g(s.children, t)}</th>`;
  }).join(""), o = e.rows.map((s) => `<tr>${s.map((l, c) => {
    const a = e.alignments[c], f = a && a !== "default" ? ` style="text-align:${a}"` : "", u = l.colspan ? ` colspan="${l.colspan}"` : "", p = l.rowspan ? ` rowspan="${l.rowspan}"` : "";
    return l.children.length === 1 && l.children[0].type === "text" && l.children[0].text === "__ROWSPAN__" ? "" : `<td${u}${p}${f}>${g(l.children, t)}</td>`;
  }).join("")}</tr>`);
  return `<table class="${n}">
<thead><tr>${r}</tr></thead>
<tbody>
${o.join(`
`)}
</tbody>
</table>`;
}
function q(e, t) {
  return `<header class="lbs-header">${y(e.children, t)}</header>`;
}
function N(e, t) {
  return `<footer class="lbs-footer">${y(e.children, t)}</footer>`;
}
function we(e, t) {
  const n = y(e.children, t);
  return `<details class="lbs-details">
<summary class="lbs-summary">${h(e.title)}</summary>
${n}
</details>`;
}
function _e(e, t) {
  return t.footnoteRefs.length === 0 ? "" : `<section class="lbs-footnotes">
<ol>
${t.footnoteRefs.map((r, o) => {
    const s = o + 1, i = t.footnoteDefs[r], l = i ? g(i, t) : "";
    return `<li id="lbs-fn-${h(r)}" class="lbs-footnote-item">[${s}] ${l}</li>`;
  }).join(`
`)}
</ol>
</section>`;
}
function z(e) {
  const t = {
    footnoteRefs: e.footnoteRefs,
    footnoteRefCount: {},
    footnoteDefs: e.footnoteDefs,
    warpDefs: e.warpDefs
  }, n = [];
  return e.header && n.push(q(e.header, t)), n.push(y(e.body, t)), e.footnoteRefs.length > 0 && n.push(_e(e, t)), e.footer && n.push(N(e.footer, t)), n.filter(Boolean).join(`
`);
}
function ye(e, t) {
  t.innerHTML = z(e);
}
async function Le(e, t = document.body) {
  const n = await fetch(e);
  if (!n.ok)
    throw new Error(`Failed to fetch ${e}: ${n.status} ${n.statusText}`);
  const r = await n.text(), o = v(r);
  ye(o, t);
}
function De() {
  if (typeof document > "u") return;
  const e = document.querySelectorAll(
    'script[src*="lobster"]'
  );
  let t = null;
  e.forEach((n) => {
    n.dataset.src && (t = n.dataset.src);
  }), t && document.addEventListener("DOMContentLoaded", () => {
    Le(t).catch(console.error);
  });
}
function Ie(e) {
  return z(v(e));
}
export {
  De as autoInit,
  Le as loadMarkdown,
  _ as parseBlocks,
  v as parseDocument,
  m as parseInline,
  z as renderDocument,
  ye as renderToDOM,
  Ie as toHTML
};

---
name: lobster-css
description: >
  Generates a CSS stylesheet for a lobster.js page, targeting lbs-* class names.
  Use this whenever the user wants to style a lobster.js page, create a CSS theme for lobster.js,
  customize the visual appearance of a lobster.js site, or asks for CSS that targets lbs-* classes.
  Also trigger when a user describes a visual style (e.g. "dark mode", "minimal", "playful") while
  working on a lobster.js project — even if they don't mention CSS or lbs-* explicitly.
---

Generate a CSS stylesheet for a lobster.js page based on the user's design description.

lobster.js outputs semantic HTML where every element has a predictable `lbs-*` class name. Write CSS targeting these classes to style the page.

Use the design description from the user's message. If no description is given, generate a clean minimal light theme.

---

## HTML structure reference

```html
<!-- Content wrapper -->
<div id="content"> … </div>

<!-- Page regions -->
<header class="lbs-header"> … </header>
<footer class="lbs-footer"> … </footer>

<!-- Headings -->
<h1 class="lbs-heading-1"> … </h1>
<h2 class="lbs-heading-2"> … </h2>
<!-- h3–h6 follow the same pattern -->

<!-- Paragraph -->
<p class="lbs-paragraph"> … </p>

<!-- Inline -->
<em class="lbs-emphasis"> … </em>
<strong class="lbs-strong"> … </strong>
<del class="lbs-strikethrough"> … </del>
<code class="lbs-code-span"> … </code>

<!-- Horizontal rule -->
<hr class="lbs-hr" />

<!-- Code block -->
<div class="lbs-code-block">
  <div class="lbs-code-filename">filename.js</div>   <!-- optional -->
  <pre data-language="js"><code class="language-js"> … </code></pre>
</div>

<!-- Blockquote -->
<blockquote class="lbs-blockquote">
  <p class="lbs-paragraph"> … </p>
</blockquote>

<!-- Lists -->
<ul class="lbs-ul">
  <li class="lbs-list-item"> … </li>
</ul>
<ol class="lbs-ol">
  <li class="lbs-list-item">
    <input type="checkbox" class="lbs-checkbox" /> … <!-- task list -->
  </li>
</ol>

<!-- Table (standard) -->
<table class="lbs-table">
  <thead><tr><th> … </th></tr></thead>
  <tbody><tr><td> … </td></tr></tbody>
</table>

<!-- Table (silent — Warp layout grid) -->
<!-- CRITICAL: Warp column content renders in <thead><tr><th>, NOT <tbody><tr><td> -->
<!-- Never apply display:none to thead on silent tables — it hides all Warp content -->
<table class="lbs-table lbs-table-silent">
  <thead>
    <tr>
      <th><!-- :::warp col-a content rendered here --></th>
      <th><!-- :::warp col-b content rendered here --></th>
    </tr>
  </thead>
  <tbody><!-- typically empty --></tbody>
</table>

<!-- Image -->
<img class="lbs-image" src="…" alt="…" />

<!-- Collapsible -->
<details class="lbs-details">
  <summary class="lbs-summary"> … </summary>
  …
</details>

<!-- Footnotes -->
<span class="lbs-footnote-ref"><a href="#fn-1">[1]</a></span>
<section class="lbs-footnotes">
  <ol>
    <li class="lbs-footnote-item"> … </li>
  </ol>
</section>
```

---

## CSS guidelines

- Use CSS custom properties (`--lbs-*`) in `:root` for colors, fonts, and spacing so the theme is easy to adapt
- Style `#content` for `max-width`, `margin`, `padding`, `font-family`, `line-height`
- Always style `body` for the background color
- For dark themes, also style `::-webkit-scrollbar` for a polished feel
- Do not add inline styles or JavaScript — CSS only
- **Warp / silent table layout:**
  - Warp content lives in `th` cells — style `.lbs-table-silent th` (not `td`)
  - To create column gaps, use `padding-right` on `th` (e.g. `padding: 0 0.75rem 0 0`) and `padding-right: 0` on `th:last-child`
  - Do NOT use `border-collapse: separate` + `border-spacing` — it can break the layout
  - Do NOT hide `thead` on silent tables (`display: none` will hide all Warp content)

Generate a CSS stylesheet for a lobster.js page based on this design description: $ARGUMENTS

lobster.js outputs semantic HTML where every element has a predictable `lbs-*` class name. Write CSS targeting these classes to style the page.

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

<!-- Table (silent — borderless layout grid) -->
<table class="lbs-table lbs-table-silent"> … </table>

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
- If `$ARGUMENTS` is empty, generate a clean minimal light theme

Generate a lobster.js starter page by creating two files: `index.html` and `content.md`.

lobster.js is a Markdown parser that renders `.md` files into web pages directly in the browser — no build step, no bundler, no dependencies.

---

## Behavior

**If `$ARGUMENTS` is empty:**
Create a minimal scaffold only.
- `index.html` — the shell below, title set to "My Page"
- `content.md` — a single placeholder heading: `# My Page`

**If `$ARGUMENTS` is provided:**
Create both files with content tailored to the description: `$ARGUMENTS`
- `index.html` — the same shell, with an appropriate `<title>`
- `content.md` — real content written in lobster.js extended Markdown

---

## index.html — always use this exact structure

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>PAGE TITLE HERE</title>
    <link rel="stylesheet" href="THEME_CDN_URL_HERE" />
  </head>
  <body>
    <div id="content"></div>
    <script type="module">
      import { loadMarkdown } from "https://hacknock.github.io/lobsterjs/lobster.js";
      loadMarkdown("./content.md", document.getElementById("content"));
    </script>
  </body>
</html>
```

For the stylesheet, use the CDN URL directly in the `<link href="...">` — do NOT use a local `./style.css` path. Choose the most appropriate theme and note it in a comment:

| Theme | `<link href="...">` |
| :--- | :--- |
| Default (clean, minimal) | `https://hacknock.github.io/lobsterjs/style.css` |
| Formal (professional, serif, navy) | `https://hacknock.github.io/lobsterjs/themes/formal.css` |
| Engineer (dark, terminal-like) | `https://hacknock.github.io/lobsterjs/themes/engineer.css` |
| Pastel (soft, gentle, lavender/mint) | `https://hacknock.github.io/lobsterjs/themes/pastel.css` |
| Pop (bright, playful, coral/pink) | `https://hacknock.github.io/lobsterjs/themes/pop.css` |

IMPORTANT: The correct base URL is `https://hacknock.github.io/lobsterjs/` — never include `docs/` in the path.

---

## lobster.js extended Markdown syntax (for content.md)

Use these extensions when generating content if `$ARGUMENTS` is provided:

**Page structure blocks:**
```
:::header
# Site Title
Navigation or tagline here
:::

:::footer
© 2025 Name — contact@example.com
:::

:::details Click to expand
Hidden content here.
:::
```

**Multi-column layout with Warp** (for hero sections, feature grids, sidebars):
```
~ | [~col-a]       | [~col-b]       |
~ | :---            | :---            |

:::warp col-a
### Left column
Content here
:::

:::warp col-b
### Right column
Content here
:::
```

**Image sizing:**
```
![Alt text](image.png =800x)
![Alt text](image.png =400x300)
```

**Footnotes:**
```
See the docs[^1] for details.

[^1]: https://example.com
```

Standard Markdown (headings, bold, italic, lists, tables, code blocks, links, images) works as expected.

---

## Content guidelines

- Always wrap the site title and top navigation in `:::header` ... `:::`
- Use `:::footer` for copyright, contact, or links
- Use `:::details` for FAQ entries or supplementary information
- Use Warp multi-column for feature comparisons, hero layouts, or sidebars
- Write content in the same language as `$ARGUMENTS` (default: English)
- Keep content realistic and useful — avoid "Lorem ipsum"

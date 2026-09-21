---
title: Writing docs
description: Author documentation for your app with Markdoc — frontmatter, tags, and build-time validation.
order: 5
---

These pages are plain `.md` files in `src/content/docs`, rendered with
[Markdoc](https://markdoc.dev). Use this system to document **your** app:
edit these files, add new ones, and the sidebar updates automatically.

## Adding a page

{% steps %}

{% step title="Create the file" %}
Add `src/content/docs/my-page.md`. The filename becomes the URL:
`/docs/my-page`. (`index.md` is special — it renders at `/docs`.)
{% /step %}

{% step title="Add frontmatter" %}
Every page needs a `title`; the rest is optional:

```yaml
---
title: My page
description: Shown under the title and in metadata.
order: 5
draft: false
---
```
{% /step %}

{% step title="Write the body" %}
Standard Markdown plus the custom tags below. Validation runs at build
time, so a typo'd tag fails `next build` instead of shipping.
{% /step %}

{% /steps %}

Pages sort by `order` (then title) in the sidebar. Files starting with `_`
and pages with `draft: true` are skipped entirely.

## Custom tags

The tag schema lives in `src/services/markdoc/config.ts`; each tag renders
to a React component in `src/services/markdoc/components/`.

### Callouts

```md {% process=false %}
{% callout type="warning" title="Heads up" %}
Body text. Types: info (default), warning, error.
{% /callout %}
```

renders as:

{% callout type="warning" title="Heads up" %}
Body text. Types: info (default), warning, error.
{% /callout %}

### Numbered steps

```md {% process=false %}
{% steps %}
{% step title="First" %}Do the thing.{% /step %}
{% step title="Second" %}Do the next thing.{% /step %}
{% /steps %}
```

Numbering comes from a CSS counter, so you can reorder steps freely — see
the [Adding a page](#adding-a-page) section above for a live example.

### Images

Plain Markdown images work anywhere. When you need to constrain the display
width, use the tag form:

```md {% process=false %}
![A globe](/globe.svg)

{% image src="/globe.svg" alt="A globe" width=64 /%}
```

{% image src="/globe.svg" alt="A globe" width=64 /%}

Images live in `public/` and are referenced by absolute path.

### YouTube embeds

```md {% process=false %}
{% youtube id="VIDEO_ID" title="What are Stripe Apps?" start=30 /%}
```

Privacy-enhanced (`youtube-nocookie.com`), lazy-loaded, 16:9.

## How it fits together

| Piece | File |
| ----- | ---- |
| Tag schema + heading ids | `src/services/markdoc/config.ts` |
| React components for tags | `src/services/markdoc/components/` |
| Content loader + validation | `src/services/markdoc/content.ts` |
| Renderer | `src/services/markdoc/DocBody.tsx` |
| Route | `src/app/docs/[[...slug]]/page.tsx` |
| Prose styling | `.docs-prose` in `src/app/globals.css` |

The `/docs` route is public — it's listed in `PUBLIC_ROUTES` in
`src/proxy.ts`, so readers never hit the login redirect.

{% callout title="Validation is strict on purpose" %}
`src/services/markdoc/content.ts` validates every page's frontmatter and
Markdoc body when the content tree is first read. An unknown tag, a missing
required attribute, or a missing `title` throws with the file path and line
number — so broken docs fail the build, not the reader.
{% /callout %}

# JS&C Design System & Agency Methodology

> This document is the single source of truth for how JS&C looks, feels, and thinks. It serves two purposes:
>
> 1. **Design System** — The code-level tokens, components, and patterns any builder needs to ship UI that feels native to JS&C.
> 2. **Agency Methodology** — The principles, process, and philosophy behind every design decision.

---

## Part I: Design System

### 1. Visual Identity

JS&C's visual identity is built on a **monochrome + single accent** palette. The aesthetic is editorial, restrained, and high-contrast — inspired by Swiss typographic minimalism, architectural drafting, and boutique consultancy branding.

**Key characteristics:**

- Warm cream backgrounds (`#f4f4ef`) provide a tactile, non-clinical feel vs. pure white
- Near-black ink (`#161714`) for primary text — not pure black, softer on eyes
- Sage-green accent (`#80988f`) is the only color — used sparingly for eyebrows, hover states, and visual rhythm
- Single serif font for display/headings (Georgia), sans-serif for body (Inter)
- No gradients, no heavy shadows, no decorative flourishes
- Border lines (`#d6d8d1`) are light and recede — structure comes from content, not boxes

### 2. Color System

```css
:root {
  /* Background & Surface */
  --color-bg: #f4f4ef; /* page background — warm cream */
  --color-surface: #ffffff; /* card, panel, elevated surfaces */

  /* Text */
  --color-ink: #161714; /* primary text — near-black */
  --color-muted: #5c5e56; /* secondary text — olive-gray */

  /* Structure */
  --color-line: #d6d8d1; /* borders, dividers, hr */

  /* Accent */
  --color-accent: #80988f; /* sage green — the only color */
  --color-accent-soft: #e3e9e6; /* soft sage for chip backgrounds */
}
```

**Usage rules:**

- `--color-bg` is always the body/page background. Never use it as a card background.
- `--color-surface` is for cards, modals, dropdowns, elevated panels.
- `--color-ink` is for all headings and body text on light backgrounds.
- `--color-muted` is for secondary text, meta info, descriptions.
- `--color-line` is for all borders, separators, horizontal rules.
- `--color-accent` is for eyebrows, hover accents, small decorative elements — never for large areas.
- `--color-accent-soft` is for tag/chip backgrounds, subtle hover surfaces.

### 3. Typography System

#### Font Stack

```css
--font-sans: "Inter", "Segoe UI", system-ui, -apple-system, sans-serif;
--font-serif: "Georgia", "Times New Roman", Times, serif;
--font-mono: "IBM Plex Mono", "SFMono-Regular", Menlo, monospace;

--font-body: var(--font-sans);
--font-display: var(--font-serif);
```

#### Type Scale

| Element | Family | Size                         | Weight | Letter-spacing         | Usage                    |
| ------- | ------ | ---------------------------- | ------ | ---------------------- | ------------------------ |
| h1      | serif  | `clamp(2.4rem, 7vw, 4.8rem)` | 400    | `-0.01em`              | Hero titles, page titles |
| h2      | serif  | `clamp(1.4rem, 3.8vw, 2rem)` | 400    | `-0.01em`              | Section headings         |
| h3      | sans   | `1.05rem–1.25rem`            | 500    | `-0.01em`              | Card titles, subheadings |
| h4      | sans   | `0.85rem`                    | 600    | `0.07em uppercase`     | Card labels              |
| body    | sans   | `0.88rem–1rem`               | 400    | normal                 | Paragraphs, descriptions |
| small   | sans   | `0.72rem–0.78rem`            | 400    | `0.06–0.1em uppercase` | Eyebrows, meta, buttons  |
| code    | mono   | `0.78rem`                    | 400    | normal                 | Inline code              |

**Typography rules:**

- Never use Georgia or any serif for body text — only for headings h1-h2 and the brand mark
- The brand mark is serif, `0.9rem`, uppercase, `letter-spacing: 0.07em`
- Section eyebrows (`.section-eyebrow`) are always `0.72rem`, uppercase, `letter-spacing: 0.1em`, accent color
- Buttons are `0.78rem`, uppercase, `letter-spacing: 0.06em`
- Maximum line length for body text should be ~40–50rem (keep readable)
- Body text color is always `var(--color-muted)` for paragraphs/lists, `var(--color-ink)` for headings

### 4. Spacing & Layout

```css
--radius-md: 0.75rem; /* buttons, small cards */
--radius-lg: 1rem; /* large cards, panels */
--shadow-soft: 0 12px 30px -24px rgba(18, 20, 16, 0.35);
--container-max: 72rem; /* 1152px max content width */
```

#### Section Spacing

```
.section        → padding-block: clamp(4rem, 9vw, 7.5rem)
.section--tight → padding-block: clamp(2.5rem, 5vw, 4.5rem)
```

#### Container Width

```
.container → width: min(72rem, calc(100% - 2.5rem))
/* At 680px: calc(100% - 1.6rem) */
```

#### Grid Patterns

- Service cards: `repeat(auto-fit, minmax(16rem, 1fr))` gap: 1rem
- Capability pillars: `repeat(auto-fit, minmax(15rem, 1fr))` gap: 1rem
- Blog index: 2-column, responsive → 1-column at 768px
- Contact: 2-column (`minmax(16rem, 1fr) / minmax(26rem, 1.8fr)`) → stacked at 768px
- Featured work: `15rem auto` sidebar + detail → stacked at 768px

### 5. Component Patterns

#### Buttons

- Always pill-shaped (`border-radius: 999px`)
- Solid button: `--color-ink` bg, `--color-surface` text, hover goes pure black
- Ghost button: semi-transparent white bg, `--color-ink` text, accent hover
- Both: uppercase, letter-spaced, `0.78rem` font
- Default min-height: `2.75rem`, small: `2.25rem`

#### Cards (`.panel-card`)

- Used for all content surfaces — services, capabilities, plans, CTAs, product cards
- Always: 1px `--color-line` border, `--radius-lg`, `--color-surface` bg, `--shadow-soft`
- padding: `1.2rem`
- Hover: subtle lift (`translateY(-2px)`) — only when `prefers-reduced-motion: no-preference`

#### Tags/Chips (`.chip-list`)

- List of `.chip-list li` with: `border-radius: 999px`, `--color-accent-soft` bg, `--color-line` border, `0.74rem` font
- Used for: service tags, capability tags, blog tags, product labels

#### Section Intro (`.section-intro`)

- Eyebrow (`.section-eyebrow`): `0.72rem`, uppercase, accent color
- h2: serif display, large
- Description: muted body text
- Used at the top of every content section

#### Page Pattern

Every page follows the same layout:

```
BaseLayout
  ├── StructuredData (JSON-LD)
  ├── HeaderNav
  ├── <main>
  │     └── <section class="section"> / <section class="section section--tight">
  │           └── <div class="container">
  │                 └── <SectionIntro> + page-specific content
  └── Footer
```

### 6. Footer Layout

```
<footer class="site-footer">
  <div class="container footer-inner">
    <div>    <!-- Brand  2fr -->
      <p class="footer-brand-large">Brand name</p>
      <p class="text-muted">Positioning statement</p>
    </div>
    <div>    <!-- Connect 1fr -->
      <p class="footer-heading">Connect</p>
      <ul class="footer-links">
        <li><a href="https://www.linkedin.com/company/jonathan-simpson-co">LinkedIn</a></li>
      </ul>
    </div>
    <div>    <!-- Read 1fr -->
      <p class="footer-heading">Read</p>
      <ul class="footer-links">
        <li><a href="/blog/">Blog</a></li>
        <li><a href="/work/">Case studies</a></li>
        <li><a href="/products/">Products</a></li>
        <li><a href="/applications/">Applications</a></li>
      </ul>
    </div>
    <div>    <!-- Help 1fr (optional) -->
      <p class="footer-heading">Help</p>
      <ul class="footer-links">
        <li><a href="/support/">Support & FAQ</a></li>
      </ul>
    </div>
    <div>    <!-- Start 1fr -->
      <p class="footer-heading">Start</p>
      <a class="button button--ghost button--small" href="/contact/">Start a project</a>
    </div>
  </div>
  <div class="container footer-meta">
    <p>&copy; 2025 Brand name. All rights reserved.</p>
  </div>
</footer>
```

**Grid:** `.footer-inner` → `2fr 1fr 1fr 1fr 1fr` gap `2rem`. At `≤768px` → `1fr 1fr`, brand spans `grid-column: 1 / -1`.

**`.footer-heading`** — `0.75rem`, uppercase, letter-spacing `0.08em`, color `var(--color-accent)`. Used as the title for each column.

**`.footer-brand-large`** — serif (`--font-display`), `clamp(1.6rem, 4.5vw, 3.5rem)`, near-black (`--color-ink`).

**`.footer-links` a** — `0.9rem`, `--color-ink`, no underline. Hover/focus → `--color-accent`.

**`.site-footer`** — `border-top: 1px solid var(--color-line)`, padding-block `~3rem`.

**`.footer-meta`** — `border-top: 1px solid var(--color-line)`, `0.85rem` muted text.

**Data source:** Links, brand name, and tagline come from `siteConfig.ts`. Social links array: currently `[{ label: "LinkedIn", href: "https://www.linkedin.com/company/jonathan-simpson-co" }]`. Help column renders conditionally.

### 7. Responsive Breakpoints

| Breakpoint     | Changes                                                       |
| -------------- | ------------------------------------------------------------- |
| 960px          | Hero height reduces, grid adjustments                         |
| 768px          | Mobile menu activates, grids stack, cards truncate, TOC hides |
| 680px          | Container padding shrinks, single-column layouts              |
| 64rem (1024px) | Blog TOC sidebar hidden                                       |
| 48rem (768px)  | Blog grid 1-column                                            |

### 8. CSS Architecture

- **Single file:** `src/styles/global.css` (~2,834 lines)
- **Naming convention:** BEM-like (`.block__element--modifier`), flat selectors
- **Custom properties:** All tokens in `:root` at the top — never hardcode values
- **Section comments** delimit logical groups: `/* ======= Services ======= */`
- **Scoped styles** in `.astro` components use `<style>` tags when needed (e.g., shadow-specific overrides, animations)
- **Animation:** Use CSS `transition` for interactive elements (220ms ease). Respect `prefers-reduced-motion` via media query. Hover effects only animate when user has no motion preference.
- **No CSS-in-JS, no CSS modules, no Tailwind.** All styling is traditional global CSS with scoped overrides.

### 9. SEO & Structured Data

- Every page must use `BaseLayout` which provides OG tags, Twitter cards, canonical URL, favicon, and organization JSON-LD
- Every page has a `StructuredData` component for page-specific JSON-LD (`WebSite`, `WebPage`, `CollectionPage`, `BlogPosting`, `BreadcrumbList`, `FAQPage`)
- Blog posts additionally include: `BlogPosting` schema with headline, datePublished, dateModified, image, wordCount, timeRequired, author, publisher
- Sitemap auto-generated via `src/pages/sitemap.xml.ts` — includes all published pages, projects, blog posts
- Robots.txt auto-generated via `src/pages/robots.txt.ts` — disallows `/api/` and `/tickets/`
- Canonical URLs use `Astro.url.pathname` + site base
- Hreflang tags: `en` + `x-default`
- OG image handling: blog posts use 1260x750, other pages 1080x1080

---

## Part II: Agency Methodology

### 10. Design Principles

#### 1. Editorial Restraint

Every element must earn its place. If it doesn't serve the content hierarchy or the user's next decision, remove it. JS&C is not a "more is more" agency — the sites we build communicate through structure, not decoration.

#### 2. Content Is the Interface

Typography and spacing do the heavy lifting. The hierarchy of a page should be legible even without color — it's in the scale, weight, and position of type. Our designs read like editorial layouts because information design comes first.

#### 3. One Accent Color

Sage green (`#80988f`) is the only accent. It's used for:

- Eyebrow labels
- Hover/focus states
- Subtle decorative lines
- Small data indicators

This restriction forces intentionality. If everything is highlighted, nothing is.

#### 4. Dark/Sharp Aesthetic

Contrast is high. Backgrounds are warm cream, text is near-black. Cards have thin, sharp borders (no blurry shadows). The hero uses a full-viewport video with a dark gradient overlay. The brand mark is uppercase serif with tight letter-spacing — it should feel like a letterhead, not a logo.

#### 5. Motion with Purpose

Transitions are fast (220ms), subtle, and always tied to interaction. No decorative animations, no scroll-triggered reveals for the sake of it. Hover effects lift cards 2px. Button hover changes background color. That's it.

#### 6. Build for AEO/GEO

Sites must be discoverable not just through Google but through AI search (ChatGPT, Perplexity, Claude). This means:

- Structured data everywhere (JSON-LD for Organization, Article, BreadcrumbList, FAQPage)
- Clear, answerable H2/H3 headings
- Direct data citations with attribution
- Formal schema markup for entities, products, services

### 11. Design Process

JS&C follows a 5-step process (represented in `ProcessSteps.astro`):

1. **Discovery** — Audit existing systems, understand workflows, identify bottlenecks
2. **Strategy** — Define success metrics, choose technology, plan architecture
3. **Design** — Wireframe → high-fidelity mockup → prototype (iterative, client-reviewed)
4. **Build** — Production-grade code, CI/CD pipelines, automated testing
5. **Launch & Iterate** — Deploy, monitor, train team, continuous improvement

### 12. Tone of Voice & Copy Guidelines

- **Professional, not corporate.** No jargon, no buzzwords. Write like a knowledgeable colleague explaining something complex.
- **Direct and confident.** Use declarative sentences. Avoid hedging ("we believe", "we think", "we try").
- **Specific over vague.** Instead of "improve efficiency", say "eliminate 3 hours of manual morning data pulls".
- **No fluff.** If a sentence can be removed without losing meaning, remove it.
- **Numbers anchor claims.** Every claim about ROI or time savings should reference a specific metric or case study.
- **Services are described as outcomes, not features.** Not "we build n8n workflows" but "we eliminate operational friction with automated pipelines".

### 13. Content Structure (per page)

Every page follows the AIDA-esque structure:

- **Eyebrow** — 2-4 word category label (e.g., "Services", "Capabilities", "Process")
- **Title** — Serif display heading, compelling and clear
- **Description** — 1-3 sentences that expand the title, written in muted color
- **Content** — Cards, grids, lists, or body text
- **CTA** — Every section either has an implicit CTA (contact, explore) or an explicit button in a CTA band

### 14. Accessibility Standards

- All interactive elements must have `:focus-visible` styles
- Buttons with icon-only content need `aria-label`
- Skip-to-content link is present (`.skip-link`)
- Color contrast: ink-on-surface passes AAA, muted-on-surface passes AA
- `prefers-reduced-motion` fully respected — no animations when reduced motion is preferred
- All images have `alt` text
- Semantic HTML throughout: `<main>`, `<nav>`, `<section>`, `<article>`, `<aside>`, `<figure>`
- Lists use `role="list"` where `display` overrides native semantics

### 15. File Organization & Conventions

```
src/
  components/       — Reusable .astro components (PascalCase)
  content/          — Markdown collections: blog/, projects/
  data/             — siteConfig.ts (single source of truth for all content)
  layouts/          — BaseLayout.astro (root HTML shell)
  lib/              — Utility modules (CRM client, ROI calculator)
  pages/            — File-based routing (kebab-case)
    api/            — API endpoints (contact.ts, tickets.ts)
    blog/           — Blog archive + dynamic [slug]
    work/           — Case study archive + dynamic [slug]
  styles/           — global.css (all site styles)
```

**Naming conventions:**

- Components: `PascalCase.astro`
- Pages: `kebab-case.astro` (mirrors route path)
- Content files: `kebab-case.md`
- CSS classes: BEM-ish (`.block__element--modifier`)
- TypeScript interfaces: PascalCase exported from `siteConfig.ts`
- CSS custom properties: `--kebab-case`

### 16. Content Management Strategy

- **No CMS.** All content is managed via:
  - `src/data/siteConfig.ts` for global content (navigation, brands, services, profiles, CTA text, SEO defaults)
  - `src/content/*.md` for blog posts and case studies (Zod-validated frontmatter)
- Content changes require code deployment — this is intentional (version-controlled, reviewable, auditable)
- Blog posts use `pubDate` for scheduling — set a future date and the post won't render in production
- The `draft: true` flag hides content from all environments

### 17. Performance Budget

- Astro SSR with Vercel edge deployment
- Sharp for image optimization
- Full-viewport hero video with poster image fallback and preload
- Auto-generated srcset/sizes for Pexels CDN images in blog posts
- No client-side JavaScript frameworks — only vanilla JS in `<script>` tags
- CSS is a single file (critical path concerns not yet addressed — future consideration)
- Fonts: Inter loaded from system/Google Fonts (no self-hosted fonts currently)

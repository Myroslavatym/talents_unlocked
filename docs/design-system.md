# Talents Unlocked — Design System

This document records the visual decisions for the site (Sprint 1: TU-13, TU-14).
All tokens live at the top of [`public/style.css`](../public/style.css) as CSS custom properties.

## Colors (TU-13)

| Role | Token | Hex | Used for |
| --- | --- | --- | --- |
| Primary | `--primary` | `#5a4ff3` | Buttons, links, active states, focus rings |
| Primary dark | `--primary-dark` | `#4338d6` | Hover / pressed states |
| Primary tint | `--primary-50` | `#eeedff` | Soft backgrounds, badges, chips |
| Ink | `--ink` | `#21242c` | Headings and body text |
| Ink soft / muted | `--ink-soft` / `--muted` | `#3b3e48` / `#5f6470` | Secondary text, captions |
| Sky | `--sky-50` / `--sky-100` | `#f0f5fe` / `#e3ecfc` | Section bands (How it works, Mission) |
| Accent orange | `--orange` | `#ff6b35` | Illustrations, value & team accents |
| Accent yellow | `--yellow` | `#ffb800` | Ratings, decorations |
| Accent green | `--green` | `#1fab54` | Success, correct answers, "new" pulse |
| Accent pink / teal | `--pink` / `--teal` | `#f8a5d1` / `#14bf96` | Decorations only |

Rules:
- One primary colour for all interactive elements so users learn "purple = clickable".
- Accents are for illustration and categorisation, never for body text.
- Body text keeps at least WCAG AA contrast (ink on white ≈ 15:1, muted on white ≈ 5.9:1).

## Typography (TU-13)

| Use | Font | Weight | Size |
| --- | --- | --- | --- |
| Display (h1–h3, brand, stats) | Plus Jakarta Sans | 700–800 | h1 `clamp(38px, 5.2vw, 60px)`, h2 `clamp(30px, 3.4vw, 42px)` |
| Body / UI | Inter | 400–600 | 16px base, 1.6 line-height |
| Eyebrow labels | Inter | 700, uppercase, 1.4px tracking | 13px |

Headings use tight negative letter-spacing for a friendly, modern look; fluid `clamp()` sizes scale smoothly from phone to desktop.

## Layout (TU-13)

- Content width: **1140px** max, 24px side padding (16px on phones).
- Section rhythm: **80px** vertical padding (56px on phones).
- Radii: 8px (`--radius`) for controls, 14px (`--radius-lg`) for cards, 20px for the CTA band.
- Three elevation levels: `--shadow-sm`, `--shadow`, `--shadow-lg`.
- Breakpoints: 1100px (hide small decorations), 960px (stack two-column layouts), 900px (mobile menu), 640px (phone).

Home page structure:

1. Sticky navigation — Courses · How it works · Mission · Team
2. Hero — badge, headline, search, popular topics, stats
3. How it works — Watch / Practice / Track tabs
4. Courses — category filters + course cards with preview modal
5. Mission — statement + four value cards
6. Team — instructor cards
7. Testimonial
8. Call to action
9. Footer with section links

## Useful design features (TU-14)

| Feature | Why it helps | Where |
| --- | --- | --- |
| Sticky nav with active-section highlight | Users always know where they are on a long page | `nav.js`, `.nav-links a[aria-current]` |
| Mobile hamburger menu | Navigation is no longer hidden on phones | `.nav-toggle`, `nav.js` |
| Shadow on scroll | Separates the nav from content only when needed | `.site-nav.is-scrolled` |
| Hero search + popular topics | One click from landing to a relevant course | `.hero-topics`, `home.js` |
| Live course filtering & result count | Instant feedback, no page reloads | `home.js` |
| Course preview modal | See what's inside before signing up | `#course-modal` |
| Tabs for "How it works" | Keeps the page short while explaining three ideas | `.tabs`, `.tab-panel` |
| Visible progress mock-ups (streaks, bars) | Shows the motivation features of the dashboard | `#panel-track` |
| Consistent card hover lift | Signals clickability across courses, values, team | `.course-card`, `.value-card`, `.team-card` |
| Accessibility | Focus rings, ARIA tabs/dialog, `prefers-reduced-motion` support, Escape closes menus | throughout |


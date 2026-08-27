# Procure Lite Design System

> Product-wide source of truth. Page overrides belong in `pages/<page-name>.md`.

## Direction

Procure Lite is a daily operations tool, not a marketing site. The interface should feel calm, exact and dependable: high information signal, restrained decoration, and clear action priority.

- Style: Swiss-inspired operational workspace
- Density: 8/10 on desktop, touch-comfortable on mobile
- Variance: 5/10; use asymmetry only to establish priority
- Motion: 3/10; short feedback transitions, no decorative choreography
- Shape language: 8–18 px radii, with 12 px as the default
- Shadows: shallow and sparse; borders define most surfaces

## Color tokens

| Role | Value | Usage |
| --- | --- | --- |
| Ink | `#14213D` | Sidebar, hero, high-emphasis text |
| Primary | `#2563EB` | Primary actions, active states, focus |
| Primary hover | `#1D4ED8` | Hover and pressed primary actions |
| Teal | `#0F766E` | Healthy flow and distributed states |
| Amber | `#B45309` | Waiting and attention states |
| Red | `#C24141` | Blocking exceptions and destructive actions |
| Canvas | `#F3F5F8` | Application background |
| Surface | `#FFFFFF` | Cards, tables and forms |
| Text | `#172033` | Primary text |
| Muted text | `#526078` | Supporting text |
| Faint text | `#64748B` | Metadata only; maintain 4.5:1 contrast on white |
| Border | `#DFE5ED` | Default dividers and outlines |

Semantic states must always include text or an icon; color alone is not sufficient.

## Typography

Use the platform UI stack so Chinese text remains crisp and no external font request is required:

```css
font-family: "Segoe UI Variable", "Segoe UI", "PingFang SC",
  "Microsoft YaHei UI", system-ui, sans-serif;
```

- Page title: 18 px / 720
- Section title: 14 px / 700
- Body and controls: 12–14 px / 450–650
- Metadata: 11–12 px / 500–680
- Metrics: Cascadia Mono or system monospace, tabular numerals

## Layout

- Desktop: 232 px ink sidebar, compact top bar, 20 px page gutter
- Tablet: two-row ink navigation, content-first single-column workspace
- Mobile: compact brand bar, fixed five-item bottom navigation, 44 px minimum targets
- Dashboard order: priority hero → four real workflow metrics → ledger and actionable side rail
- Do not repeat the same onboarding or KPI content in multiple adjacent cards
- Do not show simulated charts. Link to the real report when real data is unavailable

## Components

- Primary button: blue fill, white label, 8–10 px radius
- Secondary button: white or translucent fill with a visible border
- Card: white surface, 1 px border, 12 px radius, little or no shadow
- Inputs: persistent label, 44 px mobile height, visible focus ring
- Icon buttons: accessible name required; decorative SVGs use `aria-hidden="true"`
- Navigation: active state uses fill plus a blue indicator, never color alone

## Motion and accessibility

- Transitions: 150–220 ms for hover, focus, and state feedback
- Honor `prefers-reduced-motion`
- Minimum normal-text contrast: 4.5:1
- Preserve browser zoom; never disable user scaling
- No horizontal scroll at 390, 768, 1024, or 1440 px
- Keep keyboard focus visible and avoid hover-only information

## Anti-patterns

- Marketing-page hero sections inside daily workflows
- Multiple competing brand colors or gradients
- Emoji used as interface icons
- Fake trend bars, charts, or status indicators
- Repeated explanatory copy that pushes operational data below the fold
- Large shadows, glass effects, and hover movement on dense tables

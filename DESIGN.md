---
name: Field Evidence Logger
description: Tamper-evident presumptive drug test records, read off a calibrated scale.
colors:
  ground: "#13120e"
  rail: "#0e0d0a"
  surface: "#1a1914"
  surface-raised: "#23221b"
  surface-high: "#2c2a22"
  well: "#0f0e0b"
  hairline: "#312f27"
  hairline-strong: "#47443a"
  text: "#efebe0"
  text-secondary: "#b3ad9c"
  text-tertiary: "#8f897a"
  evidence-tape: "#f2c94c"
  evidence-tape-hover: "#f8d872"
  on-tape: "#1c1604"
  result-positive: "#ff6b6b"
  result-negative: "#4ade80"
  result-inconclusive: "#fb923c"
  integrity-verified: "#6fd3e8"
  scale-ink: "#0a0907"
  scale-paper: "#ece6d6"
typography:
  display:
    fontFamily: "Noto Sans Variable, Noto Sans Devanagari Variable, system-ui, sans-serif"
    fontSize: "46px"
    fontWeight: 760
    lineHeight: 1
    letterSpacing: "-0.03em"
  headline:
    fontFamily: "Noto Sans Variable, Noto Sans Devanagari Variable, system-ui, sans-serif"
    fontSize: "24px"
    fontWeight: 650
    lineHeight: 1.2
    letterSpacing: "-0.015em"
  title:
    fontFamily: "Noto Sans Variable, Noto Sans Devanagari Variable, system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 620
    letterSpacing: "-0.015em"
  body:
    fontFamily: "Noto Sans Variable, Noto Sans Devanagari Variable, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Noto Sans Variable, Noto Sans Devanagari Variable, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 560
  metric:
    fontFamily: "Noto Sans Variable, Noto Sans Devanagari Variable, system-ui, sans-serif"
    fontSize: "30px"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-0.02em"
    fontFeature: "tnum"
  mono:
    fontFamily: "ui-monospace, Cascadia Mono, SF Mono, Roboto Mono, Menlo, Consolas, monospace"
    fontSize: "0.9em"
    letterSpacing: "0"
    fontFeature: "tnum"
rounded:
  instrument: "2px"
  sm: "6px"
  md: "8px"
  lg: "12px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  panel: "18px"
  stack: "20px"
  xl: "28px"
  gutter: "36px"
components:
  button-primary:
    backgroundColor: "{colors.evidence-tape}"
    textColor: "{colors.on-tape}"
    rounded: "{rounded.md}"
    padding: "0 16px"
    height: "40px"
  button-primary-hover:
    backgroundColor: "{colors.evidence-tape-hover}"
  button-secondary:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.text}"
    rounded: "{rounded.md}"
    padding: "0 16px"
    height: "40px"
  button-secondary-hover:
    backgroundColor: "{colors.surface-high}"
  button-ghost:
    textColor: "{colors.text-secondary}"
    rounded: "{rounded.md}"
    padding: "0 16px"
    height: "40px"
  button-ghost-hover:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
  input:
    backgroundColor: "{colors.well}"
    textColor: "{colors.text}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "0 12px"
    height: "42px"
  panel:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.lg}"
    padding: "18px"
  badge-positive:
    textColor: "{colors.result-positive}"
    rounded: "{rounded.pill}"
    padding: "0 10px 0 8px"
    height: "26px"
  badge-negative:
    textColor: "{colors.result-negative}"
    rounded: "{rounded.pill}"
    padding: "0 10px 0 8px"
    height: "26px"
  badge-inconclusive:
    textColor: "{colors.result-inconclusive}"
    rounded: "{rounded.pill}"
    padding: "0 10px 0 8px"
    height: "26px"
  badge-verified:
    textColor: "{colors.integrity-verified}"
    rounded: "{rounded.pill}"
    padding: "0 10px 0 8px"
    height: "26px"
  badge-unverified:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.text-secondary}"
    rounded: "{rounded.pill}"
    padding: "0 10px 0 8px"
    height: "26px"
  nav-item:
    textColor: "{colors.text-secondary}"
    rounded: "{rounded.md}"
    padding: "0 12px"
    height: "40px"
  nav-item-active:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.text}"
  shutter:
    backgroundColor: "{colors.evidence-tape}"
    size: "84px"
---

# Design System: Field Evidence Logger

## Overview

**Creative North Star: "The Night Checkpoint Instrument"**

A dark forensic instrument panel lit like a roadside checkpoint under sodium light. The ground is a warm khaki-black, surfaces step up one tone at a time, and every division is a hairline olive-grey rule. Nothing glows. The one bright material is evidence-tape yellow, and it marks what the officer can act on: the primary button, the shutter, focus, selection, the active nav glyph.

Readings are measured, not announced. A result is a word, an icon and a colour together, and it sits on a photo-scale ruler of alternating paper and ink segments with the sample's own swatch as the needle. Integrity has its own cool family, so "verified" never reads as a test result. Identifiers, hashes, ΔE values, RGB triplets and coordinates are set in monospace with tabular figures; everything else is one self-hosted sans that carries English and Hindi in the same voice.

Density is dashboard-honest: compact rows, 13 to 15px working text, a single stat strip rather than hero metrics. The dark theme is the only theme, chosen for the use scene.

**Key Characteristics:**
- Warm khaki-black tonal layering with hairline borders; no glow, no gradients on surfaces.
- One yellow for action, selection and focus.
- Two semantic families: results (red / green / orange) and integrity (cyan / red / khaki-grey).
- Every state is word + icon + colour, never colour alone.
- Monospace only for measured or machine values.
- Authored 24px line icons at 1.75 stroke.
- Signature: the ΔE forensic scale.

## Colors

A warm near-black ground with one tape-yellow action colour and two strictly separated semantic families.

### Primary
- **Evidence Tape Yellow** (`evidence-tape`): primary buttons, the shutter core, focus outlines, text caret, selection tint (32% alpha), active nav and tab icons, links, the brand mark tile, the strip-pad capture guide and tap markers. Hover lifts to **Tape Highlight** (`evidence-tape-hover`). Text on yellow is **Tape Ink** (`on-tape`). A 16% alpha wash (`--accent-soft`) is the input focus ring.

### Secondary (results family)
- **Positive Red** (`result-positive`): positive verdicts, badges, map markers, share bar. Tinted background at 12% alpha, border at 38%.
- **Negative Green** (`result-negative`): negative verdicts; also the online indicator. Background 11%, border 34%.
- **Inconclusive Orange** (`result-inconclusive`): inconclusive verdicts, the hatched ambiguity band on the ΔE scale, pending-sync status, offline indicator and warning notices. Background 12%, border 42%.

### Tertiary (integrity family)
- **Verified Cyan** (`integrity-verified`): verified signatures, completed custody steps and their connecting rules, success notices and toasts, completed capture steps. Background 12%, border 36%.
- **Invalid** reuses Positive Red by token alias (`--bad: var(--pos)`); **Unverified** uses Secondary Text on a raised surface.

### Neutral
- **Checkpoint Ground** (`ground`): page background.
- **Rail Black** (`rail`): desktop rail, login story column, phone tab bar; at 94% alpha with 8px blur for the phone top bar.
- **Surface / Raised / High** (`surface`, `surface-raised`, `surface-high`): panels; hovered rows, active nav and secondary buttons; toasts, popups and avatar.
- **Well** (`well`): inputs, drop zone, raw JSON block. Sits below the ground, not above it.
- **Hairline / Strong Hairline** (`hairline`, `hairline-strong`): panel borders and dividers; input, secondary-button and notice borders, dashed custody nodes, scrollbar thumb.
- **Bone Text / Secondary / Tertiary** (`text`, `text-secondary`, `text-tertiary`): primary copy; supporting copy and labels; metadata, table headers, placeholders.
- **Scale Ink / Scale Paper** (`scale-ink`, `scale-paper`): only for instrument graphics: the ΔE ruler, the working ruler, the colour-card guide.

### Named Rules
**The Tape Rule.** Yellow means "you can act here" or "you are here". It never marks a result, a status or a decorative surface.

**The Two Families Rule.** Results use red, green, orange. Integrity uses cyan, red, khaki-grey. Cyan never shows a test result; green never shows a signature state.

**The Word-and-Icon Rule.** No state is colour-only. Every badge, verdict, custody step and notice carries its word and its icon.

## Typography

**Display / Body Font:** Noto Sans Variable, with Noto Sans Devanagari Variable as companion (system-ui fallback). Self-hosted.
**Mono Font:** platform monospace stack (ui-monospace, Cascadia Mono, SF Mono, Roboto Mono, Menlo, Consolas).

**Character:** One neutral humanist sans with fine-grained variable weights carries both scripts; the monospace is a measuring tool, not a voice.

### Hierarchy
- **Display** (760, 46px, 1; 38px on phone; 30px small variant): the verdict word only.
- **Login headline** (680, clamp(28px, 3.2vw, 40px), 1.15, -0.025em): the login pitch only.
- **Metric** (700, 30px, 1.15, tabular): stat-strip values.
- **Headline** (650, 24px, 1.2; 22px on phone): page h1.
- **Title** (620, 17px): panel and section h2.
- **Body** (400, 15px, 1.5): default copy; supporting paragraphs cap at 68ch, empty states at 44ch.
- **Label** (560, 13px): field labels, stat labels, scale caption; table headers at 12px / 620 in tertiary text.
- **Mono** (0.9em, tabular figures, 0 tracking): IDs, hashes (grouped in 8-character runs), ΔE, RGB, coordinates, step numbers.

### Named Rules
**The Measured Mono Rule.** Monospace is reserved for values a machine produced or a person must compare digit by digit. Prose, labels and headings never use it.

**The Balanced Head Rule.** Headings use `text-wrap: balance` and a slight negative track (-0.015em); larger display sizes tighten further.

## Layout

Desktop is a two-column shell: a sticky 256px rail and a fluid main column with content capped at 1280px and padded 32px top, 36px sides, 56px bottom. Pages stack with a 20px gap. Panel interiors use 18px padding with 14px x 18px heads. Paired panels sit on 16px gaps; capture uses a 28px gap between a 560px viewport column and a side column. Filters use an auto-fit grid with 170px minimum columns.

Breakpoints: at 1180px the dashboard and record detail grids drop to one column; at 960px result, scan, capture and login collapse; at 860px the rail is replaced by a sticky blurred top bar and a fixed bottom tab bar (56px targets, safe-area aware), content padding drops to 20px x 16px with 96px clearance for the tab bar, the stat strip stacks, the custody chain wraps to two columns, and facts lists become single-column.

The capture viewport keeps a 3:4 box sized from screen height so the shutter stays in view; on phone the shutter row moves above the hint.

## Elevation & Depth

Flat by default. Depth is tonal: well below ground, surfaces stepping up through three tones, each edged with a hairline. Shadows appear only on layers that float over content.

### Shadow Vocabulary
- **Float** (`box-shadow: 0 8px 24px rgba(0,0,0,0.45), 0 2px 6px rgba(0,0,0,0.35)`): toasts, map zoom controls, map popups.
- **Marker lift** (`box-shadow: 0 2px 6px rgba(0,0,0,.6)` / `0 1px 4px rgba(0,0,0,.6)`): tap dots on the capture photo and map markers.
- **Swatch edge** (`box-shadow: inset 0 0 0 1px rgba(255,255,255,.16), 0 0 0 1px rgba(0,0,0,.5)`): colour swatches, so any colour reads against the dark ground.
- **Focus wash** (`box-shadow: 0 0 0 3px` tape at 16%): inputs on focus.

### Named Rules
**The Floating-Only Shadow Rule.** A shadow means the element sits above the page (toast, popup, marker). Panels and cards never carry one.

## Shapes

Gently rounded controls (8px) and panels (12px), small elements at 6px, fully pill badges, circles for custody nodes, step numbers, the shutter, avatars and map markers. Instrument graphics stay nearly square (2px) so the ruler reads as a printed scale. Dashed outlines (1.5px) mean "not yet": pending custody nodes, the drop zone, capture guides. Media frames (capture viewport, empty-state icon tile) use 14px, 12px on phone.

## Components

### Buttons
Firm, compact, flat.
- **Shape:** 8px radius, 40px tall (32px small, 48px large, 36px square icon), 600 weight 14px label, 8px icon gap.
- **Primary:** tape yellow with tape-ink text; hover to tape highlight.
- **Secondary:** raised surface with strong hairline border; hover to high surface.
- **Ghost:** transparent with secondary text; hover fills with surface and brightens text.
- **States:** press nudges down 1px; disabled at 42% opacity; focus is the global 2px yellow outline at 2px offset.

### Badges
- **Style:** 26px pill, 1px border, 12.5px / 650, 14px icon leading the word. Tinted background and border at the family alphas above.
- **Variants:** positive, negative, inconclusive (results); verified, invalid, unverified (integrity); pending (orange, clock icon); rejected (invalid style, x icon).

### Panels
- **Corner Style:** 12px.
- **Background:** surface, hairline border, no shadow.
- **Internal Padding:** 18px body; head 14px x 18px with a hairline below.
- **Verdict panel:** same shell at 24px x 26px, border takes the result family's border tint.

### Inputs / Fields
- **Style:** well background, strong hairline border, 8px radius, 42px tall, 15px text; label above at 13px / 560 secondary text.
- **Hover:** border lightens one step.
- **Focus:** border turns tape yellow with a 3px tape wash ring.

### Notices and Toasts
Notice: 8px radius, 1px border, icon at 18px, 14px / 1.45 text; info (raised surface), warn (orange), error (red), ok (cyan), each with a pale tinted text. Toast: high surface, strong hairline, 12px radius, Float shadow, slides up 8px over 250ms on the out-expo curve; error toasts persist, others clear after 6s.

### Navigation
Desktop rail: 40px items, 550 weight secondary text, 11px icon gap; hover fills with surface; active fills with raised surface and turns the icon yellow. The rail foot holds the sync box (online/offline dot and word, pending count, sync button), language toggle and operator block. Phone: blurred rail-black top bar with brand, status dot, sync count, language and sign-out; fixed bottom tab bar, icon over 11.5px label, active label in bone text with yellow icon.

### Chain of Custody
Four steps (Captured, Signed, Synced, Verified) on a grid, joined by 2px rules. Done: solid cyan ring, cyan check, cyan connector. Bad: solid red ring and x, red sub-label. Waiting: dashed strong-hairline ring with a clock. Each step has a 14px / 600 label and a 12px tertiary timestamp or state. A badge-sized form (record status) appears in list rows.

### Capture Shutter
84px circle, 4px bone ring, 64px tape-yellow core; press scales to 95%. Framing guides are dashed SVG outlines, paper for the colour card and yellow for the strip pad, each with a small spaced uppercase in-frame label.

### ΔE Forensic Scale (signature)
A 14px ruler of alternating paper and ink segments (5% each) with major and minor tick rows beneath, an orange hatched inconclusive band centred on the midpoint, and a marker carrying the sample's own swatch (22px, bone ring) on a bone needle that drops in over 500ms. The ends show each reference swatch with its monospace ΔE. The same ruler, animated, is the working indicator; a static copy anchors the login story and the record photo.

## Do's and Don'ts

### Do:
- **Do** keep tape yellow (`evidence-tape`) for primary action, the shutter, focus, selection and the current-location glyph.
- **Do** pair every result and integrity colour with its word and icon.
- **Do** build depth from ground, surface, raised and high tones edged with hairlines.
- **Do** set IDs, hashes, ΔE, RGB and coordinates in monospace with tabular figures, and group long hashes in 8-character runs.
- **Do** draw new icons on the 24px grid with 1.75 stroke, round caps and joins, `currentColor`.
- **Do** keep a dashed outline for "pending / not yet" and a solid one for "done".
- **Do** honour `prefers-reduced-motion`; motion is limited to the needle drop, toast entry, skeleton shimmer and working ruler.

### Don't:
- **Don't** use cyan for a test result or green for a signature state.
- **Don't** put a shadow on a panel or card at rest.
- **Don't** ship a light theme or a slate-blue ground with a sky-blue accent.
- **Don't** use scale paper and ink outside instrument graphics.
- **Don't** add an icon package or icon font; icons are authored inline.

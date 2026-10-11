---
name: Artisan Ops
colors:
  surface: '#fff8f5'
  surface-dim: '#edd5c8'
  surface-bright: '#fff8f5'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#fff1ea'
  surface-container: '#ffeadf'
  surface-container-high: '#fce3d6'
  surface-container-highest: '#f6ded1'
  on-surface: '#251911'
  on-surface-variant: '#52443a'
  inverse-surface: '#3c2d25'
  inverse-on-surface: '#ffede4'
  outline: '#847469'
  outline-variant: '#d6c3b6'
  surface-tint: '#875221'
  primary: '#84501f'
  on-primary: '#ffffff'
  primary-container: '#a16835'
  on-primary-container: '#fffbff'
  inverse-primary: '#feb87e'
  secondary: '#765749'
  on-secondary: '#ffffff'
  secondary-container: '#fed4c2'
  on-secondary-container: '#795a4c'
  tertiary: '#795439'
  on-tertiary: '#ffffff'
  tertiary-container: '#946c4f'
  on-tertiary-container: '#fffbff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#ffdcc2'
  primary-fixed-dim: '#feb87e'
  on-primary-fixed: '#2e1500'
  on-primary-fixed-variant: '#6a3b0b'
  secondary-fixed: '#ffdbcc'
  secondary-fixed-dim: '#e6bead'
  on-secondary-fixed: '#2c160b'
  on-secondary-fixed-variant: '#5c4033'
  tertiary-fixed: '#ffdcc5'
  tertiary-fixed-dim: '#eebd9b'
  on-tertiary-fixed: '#2e1502'
  on-tertiary-fixed-variant: '#613f26'
  background: '#fff8f5'
  on-background: '#251911'
  surface-variant: '#f6ded1'
typography:
  headline-xl:
    fontFamily: Plus Jakarta Sans
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-xl-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 26px
    fontWeight: '700'
    lineHeight: 34px
    letterSpacing: -0.01em
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.015em
  headline-lg-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 26px
    letterSpacing: -0.01em
  title-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: -0.005em
  title-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: 0em
  body-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
    letterSpacing: 0em
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
    letterSpacing: 0em
  body-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 18px
    letterSpacing: 0.005em
  label-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 13px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.02em
  label-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 14px
    letterSpacing: 0.04em
  tabular-data:
    fontFamily: Plus Jakarta Sans
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 18px
    letterSpacing: -0.01em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1.5rem
  gutter-sm: 1rem
  margin: 2rem
  margin-sm: 1rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
  space-2xl: 3rem
---

## Brand & Style

This design system serves an internal administrative and management platform operating across three specialty coffee locations. The user base consists of store general managers, head roasters, inventory coordinators, and corporate operations staff. 

The aesthetic is grounded in a hybrid philosophy: **Warm Corporate Editorial meets Tactile Craft**. It strips away generic, clinical SaaS tropes (harsh cool grays, bright electric blues) and replaces them with an organic, disciplined palette derived from coffee extraction, roasting stages, and ceramic drinkware. 

Key attributes:
- **Operational Precision:** Strict alignments, high data density, unambiguous interactive states, and utilitarian layout rhythms.
- **Roastery Soul:** Nuanced earthen tones, deep espresso anchors, and steamed milk canvas tones that maintain atmospheric connection to the retail floor.
- **Calm Authority:** High contrast where legibility matters (inventory counts, audit trails, authentication), tempered by soft, warm neutral borders and matte surface layering.

## Colors

The palette balances deep roast tones against velvety cream backgrounds, highlighted by caramel and amber interactive points.

### Palette Architecture
- **Primary (`#A76D3A`):** Roasted caramel. Used for primary actions, active navigation states, key metric highlights, and prominent callouts. Dark variant `#8D5422` serves hover and pressed states.
- **Secondary (`#5C4033`):** Deep hazelnut mocha. Employed for secondary structure, section dividers, badge outlines, and sub-navigation indicators.
- **Tertiary (`#785338`):** Medium roast brown. Used for supporting icons, non-critical active indicators, and tertiary action fills.
- **Neutral Dark (`#2B1E16`, `#1A120B`):** Espresso bean tones. Provides high-contrast, fatigue-free typographic hierarchy. Pure `#000000` is strictly avoided to preserve organic warmth.
- **Neutral Surface & Background (`#F9F6F0`, `#F3EDE2`, `#FFFFFF`):** Steamed cream base. `#F9F6F0` serves as the canvas foundation; `#F3EDE2` defines inset panels, sidebars, and inactive inputs; `#FFFFFF` highlights elevated cards and modal containers.
- **Borders & Dividers (`#E5DBD0`):** Warm milk-froth stone tone. Provides low-noise structural containment without severe demarcation.
- **Functional Semantics:**
  - **Error/Destructive:** `#B42318` on pale red linen tint `#FEF3F2`.
  - **Success:** `#2D6A4F` on warm matcha tint `#EDF7F2`.
  - **Warning:** `#B54708` on soft honey tint `#FFFAEB`.
  - **Info:** `#3B5A6B` on muted slate cream tint `#F0F5F8`.

## Typography

The type system is powered by **Plus Jakarta Sans**, chosen for its crisp geometric construction, open apertures, and subtle warmth. It avoids clinical coldness while preserving dense numerical legibility for inventory and sales tables.

### Implementation Rules
- Apply `font-feature-settings: "cv02", "cv03", "cv04", "cv11"` to maintain legible terminal numerals and distinct punctuation marks.
- All pricing, bag weight yields, shift durations, and operational statistics must apply `font-variant-numeric: tabular-nums` to eliminate layout jitter across data tables and live order tickets.
- Heading sizes scale down smoothly for portable floor tablets and phones without losing proportion.
- Line heights are tightened slightly for administrative dashboards compared to standard consumer interfaces to preserve information density above the fold.

## Layout & Spacing

The system runs on a disciplined **8pt baseline and structural spacing scale**, calibrated for dense management grids and clear multi-location oversight.

### Grid Foundations
- **Desktop (1280px+):** Fixed 260px collapsible warm sidebar navigation (`#F3EDE2`) paired with a 12-column fluid canvas with `1.5rem` gutters and `2rem` outer padding.
- **Tablet / In-Store POS Displays (768px - 1279px):** 8-column grid with `1rem` gutters and `1.5rem` margins. The sidebar collapses into an overlay drawer or a condensed icon rail (64px).
- **Mobile (Below 768px):** 4-column single-stack structure with `0.75rem` gutters and `1rem` safe margins. Primary interactions pin to bottom sheets.

### Spacing Philosophy
Internal operations demand low ambient travel distance:
- Use `space-xs` (4px) for label-to-input gaps and badge icon offsets.
- Use `space-sm` (8px) for internal table row cell padding and button internal gaps.
- Use `space-md` (16px) for form element stacks, card internal padding, and table header separation.
- Use `space-lg` (24px) for card-to-card gaps in grid layouts.
- Use `space-xl` (32px) and `space-2xl` (48px) strictly for top-level operational sections (e.g., separating summary KPIs from detailed multi-store breakdown lists).

## Elevation & Depth

Visual hierarchy is maintained through a combination of **tonal layering** and **warm, diffused ambient shadows**. Elements do not float on sterile drop-shadows; they sit on ceramic-like planes with espresso-tinted ambient occlusion.

### Shadow Scale
- **Flat (Floor):** Canvas background (`#F9F6F0`). No shadow. Border: none.
- **Elevation 1 (Cards, Metric Tiles):** Base surface (`#FFFFFF`). Border: 1px solid `#E5DBD0`. Shadow: `0 1px 3px rgba(43, 30, 22, 0.04), 0 1px 2px rgba(43, 30, 22, 0.02)`.
- **Elevation 2 (Dropdowns, Branch Selectors, Hover States):** Base surface (`#FFFFFF`). Border: 1px solid `#E5DBD0`. Shadow: `0 4px 6px -1px rgba(43, 30, 22, 0.07), 0 2px 4px -2px rgba(43, 30, 22, 0.05)`.
- **Elevation 3 (Slide-over Drawers, Modals, Session Dialogs):** Base surface (`#FFFFFF`). Border: 1px solid `#E5DBD0`. Shadow: `0 20px 25px -5px rgba(43, 30, 22, 0.12), 0 8px 10px -6px rgba(43, 30, 22, 0.08)`.

### Tonal Hierarchy
1. Lowest Ground: `#F3EDE2` (Sidebar rails, container gutters)
2. Mid Ground: `#F9F6F0` (Dashboard canvas workspace)
3. Working Surface: `#FFFFFF` (Data tables, forms, cards)
4. Highlight Surface: `#FFFFFF` with `#A76D3A` 2px active keyline indicator

## Shapes

The design uses **Roundedness Level 2** (0.5rem / 8px default radius). This balances modern software crispness with the softened, tactile curves of handcrafted coffee ceramics and stone counters.

### Boundary Rules
- **Base Components (Inputs, Buttons, Badges):** `rounded-md` (`0.5rem` / 8px). Gives controls comfortable click/tap targets without becoming toy-like.
- **Containers (Cards, Modal Boxes, Table Enclosures):** `rounded-lg` (`1rem` / 16px). Softens large blocks of operational data.
- **Pill Elements (Status Indicators, Branch Switcher Pills):** `rounded-full` (`9999px`) reserved specifically for non-interactive state badges and quick-filter pills.
- **Outer Shell:** Inset borders are always centered or interior aligned with a fixed stroke width of 1px (`#E5DBD0`) to avoid layout recalculations during active state transitions.

## Components

### Buttons
- **Primary:** Background `#A76D3A`, text `#FFFFFF`, font-weight 600. Hover: `#8D5422`. Active: `#785338`. Focus: `0 0 0 3px rgba(167, 109, 58, 0.25)`.
- **Secondary:** Background `#FFFFFF`, text `#2B1E16`, border 1px solid `#E5DBD0`. Hover: `#F3EDE2`, border-color `#5C4033`.
- **Destructive:** Background `#FEF3F2`, text `#B42318`, border 1px solid `#FECDCA`. Hover: background `#FEE4E2`.
- **Ghost:** Background transparent, text `#5C4033`. Hover: background `#F3EDE2`.

### Input Fields & Controls
- **Text Inputs & Selects:** Height 40px (desktop), 44px (touch/tablet). Background `#FFFFFF`, border 1px solid `#E5DBD0`, text `#1A120B`, border-radius 8px. 
  - **Placeholder:** `#785338` at 60% opacity.
  - **Focus State:** Border-color `#A76D3A`, outline none, box-shadow `0 0 0 3px rgba(167, 109, 58, 0.20)`.
  - **Error State:** Border-color `#B42318`, box-shadow `0 0 0 3px rgba(180, 35, 24, 0.15)`.
- **Checkboxes & Radios:** 18x18px box, border 1.5px solid `#5C4033`, radius 4px (checkbox) or circular (radio). Checked state: fill `#A76D3A`, check glyph pure white.

### Data Tables & List Views
- **Header Rows:** Background `#F3EDE2`, border-bottom 1px solid `#E5DBD0`, typography `label-md` in uppercase, text color `#5C4033`.
- **Data Rows:** Background `#FFFFFF`, alternating hover state `#F9F6F0`. Row height: compact 44px, standard 56px.
- **Dividers:** 1px horizontal `#E5DBD0`. Vertical column lines omitted; spacing relies on strict grid alignment.

### Cards & Panels
- **Structure:** Background `#FFFFFF`, border 1px solid `#E5DBD0`, border-radius 16px, padding `space-lg` (24px).
- **Header:** Title in `headline-md` (`#2B1E16`), separated by flex row containing auxiliary actions or branch filters.

### Specialized Administrative Components
- **Branch Scope Selector:** Fixed dropdown in top navigation allowing switching between all 3 branch locations or consolidated chain view. Displays location code (e.g., `BR-01: Downtown Roastery`) wrapped in a `#F3EDE2` pill.
- **Batch Roast / Stock Status Chips:**
  - *Optimal:* Background `#EDF7F2`, text `#2D6A4F`, dot indicator `#2D6A4F`.
  - *Low Stock / In Transit:* Background `#FFFAEB`, text `#B54708`, dot indicator `#B54708`.
  - *Critical Depletion:* Background `#FEF3F2`, text `#B42318`, dot indicator `#B42318`.
- **Login Terminal Container:** Centered high-elevation container (`#FFFFFF`, border 1px solid `#E5DBD0`, radius 16px) resting on an espresso ambient gradient background (`#2B1E16` to `#1A120B`), creating a premium entrance to the administrative suite.
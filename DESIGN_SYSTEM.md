# Quickcheck Design System

## Context and Goals

**Design intent:** A dark, premium engineering-tools brand centered on champagne gold accent, structured card-based layouts, and content-first typography that communicates reliability and operational excellence.

**Target audience:** Engineering teams, platform engineers, DevOps practitioners, incident responders.

**Product surface:** Landing/marketing page and authenticated dashboard web app.

**UX objectives:**
- Establish trust through premium dark theme with gold accent
- Communicate reliability through structured card layouts and consistent spacing
- Enable quick scanning of features, pricing, and workflow steps
- Guide users toward signup with clear CTAs

**Primary interaction patterns:**
- Scroll-triggered navigation background
- Smooth anchor scrolling for same-page navigation
- Hover-lift on buttons with spring easing
- Border/background transitions on cards
- Particle background with mouse interaction

---

## Design Tokens and Foundations

### Typography

```
font.family.primary=Plus Jakarta Sans
font.family.stack=Plus Jakarta Sans, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif
font.family.mono=IBM Plex Mono, monospace

font.size.xs=0.65rem    /* ~10px — section titles, badges */
font.size.sm=0.75rem    /* ~12px — eyebrow text, meta labels */
font.size.md=0.875rem   /* ~14px — body text, nav links */
font.size.lg=1rem       /* ~16px — card titles, hero subtitle */
font.size.xl=1.05rem    /* ~17px — pricing card title */
font.size.2xl=clamp(1.8rem, 1.4rem + 1.5vw, 2.8rem)  /* section headings */
font.size.3xl=clamp(2.4rem, 2rem + 2.5vw, 4.4rem)    /* hero headline */
font.size.4xl=clamp(2.6rem, 2.2rem + 3vw, 5rem)      /* future use */

font.weight.regular=400
font.weight.medium=500
font.weight.semibold=600
font.weight.bold=700

lineHeight.tight=1.08     /* hero headlines */
lineHeight.normal=1.15    /* section headings */
lineHeight.relaxed=1.6    /* body text */
```

### Color System

**Brand / Accent (Gold)**
```
color.brand.primary=#c9a86c
color.brand.secondary=#dbb87e
color.brand.gradient=linear-gradient(135deg, #c9a86c 0%, #dbb87e 100%)
color.brand.dim=rgba(201,168,108,0.12)
color.brand.glow=rgba(201,168,108,0.08)
```

**Usage:**
- `brand.primary` — primary button backgrounds, accent borders, checkbox checked, progress fill, feature checkmarks, interactive hover states
- `brand.secondary` — button gradient end, hover states
- `brand.dim` — icon container backgrounds, subtle dividers, badge backgrounds
- `brand.glow` — decorative panel glows, hover highlights

**Text**
```
color.text.primary=#ececee   /* — headings, nav logo, hero headline, active items */
color.text.secondary=#8b8b96 /* — body text, descriptions, nav links, pricing features */
color.text.muted=#55555f     /* — placeholder text, disabled states, meta info */
color.text.inverse=#0b0f19   /* — text on brand-colored backgrounds (buttons, badges) */
```

**Usage:**
- `text.primary` — all headings, active checklist items, primary CTA text
- `text.secondary` — all paragraph text, feature descriptions, navigation links, footer text
- `text.muted` — placeholders, timestamps, section group labels, captions
- `text.inverse` — text on brand-colored backgrounds for readability

**Surface**
```
color.surface.base=#0a0a0b     /* — page background */
color.surface.raised=#111113   /* — cards, modals, hero window, sidebar */
color.surface.elevated=#18181b /* — hover states, secondary surfaces */
color.surface.strong=#222226   /* — progress bar tracks, scrollbar thumbs */
```

**Usage:**
- `surface.base` — body background
- `surface.raised` — all card components (capability, pricing, workflow), hero preview, modals, sidebar
- `surface.elevated` — card hover states, auth button hover, item hover backgrounds
- `surface.strong` — progress bar track, scrollbar thumb, non-interactive backgrounds

**Border**
```
color.border.default=rgba(255,255,255,0.08)  /* — card borders, dividers */
color.border.muted=rgba(255,255,255,0.06)    /* — subtle separators */
color.border.strong=rgba(255,255,255,0.1)    /* — elevated surfaces, modals */
```

**Semantic**
```
color.success=#6daf82   /* — success states, progress completion */
color.danger=#e07a7a    /* — errors, destructive actions, delete */
color.warning=#f59e0b   /* — warnings, dot indicator */
color.error=#ef4444     /* — critical errors, dot indicator */
color.info=#10b981      /* — info states, dot indicator */
```

### Spacing Scale

```
space.1=4px
space.2=6px
space.3=8px
space.4=10px
space.5=12px
space.6=14px
space.7=16px
space.8=20px
space.9=24px
space.10=28px
```

**Layout rhythm rules:**
- Card padding: `space.9` (24px) — capability cards, `space.10` (28px) — pricing cards
- Grid gaps: `space.7` (16px) — all card grids
- Section heading margin-bottom: `space.6` (14px) converted to `0.75rem`
- Section top margin: `space.5` from h2 (3rem)
- Section padding-block: `8rem` desktop, `5rem` tablet, `3.5rem` mobile

### Radius

```
radius.xs=4px       /* — checkboxes, progress bars, step number badges */
radius.sm=6px       /* — pricing badges */
radius.md=8px       /* — step number containers */
radius.lg=10px      /* — icon containers */
radius.xl=12px      /* — auth inputs, quote block */
radius.2xl=14px     /* — cards, hero window, workflow steps */
radius.pill=999px   /* — buttons, eyebrow badges */
```

**Usage rules:**
- Cards use `radius.2xl` (14px) for clean, modern look
- Buttons use `radius.pill` (999px) for pill shape
- Icon containers use `radius.lg` (10px)
- Pricing badge uses `radius.sm` (6px) for subtle distinction
- Checkboxes use `radius.xs` (4px)

### Shadows

```
shadow.1=0 1px 3px rgba(0,0,0,.2), 0 4px 4px rgba(13,21,48,.04)
shadow.2=0 24px 60px rgba(0,0,0,.45), 0 1px 0 rgba(255,255,255,.04) inset
shadow.gold=0 12px 32px rgba(201,168,108,.18), 0 0 0 1px rgba(201,168,108,.08)
```

**Usage rules:**
- `shadow.1` — hero window default
- `shadow.2` — legacy shadow, used for modal elevations
- `shadow.gold` — gold-accented interactive states (unused currently)

### Motion

```
motion.duration.instant=100ms
motion.duration.fast=200ms
motion.duration.normal=250ms
motion.duration.slow=300ms

motion.easing.standard=cubic-bezier(0.22, 1, 0.36, 1)     /* — spring-like ease-out */
motion.easing.emphasized=cubic-bezier(.34, 1.56, .64, 1)  /* — bounce spring for buttons */
```

**Usage guidance:**
- Hover states: `200ms` with standard easing
- Button press: `250ms` with emphasized (spring) easing
- Focus transitions: `200ms` ease
- Modal entry: `300ms` with standard easing
- Scroll reveal: `800ms` ease
- Progress bar animation: `1500ms` with easeOutCubic

---

## Layout System

**Max content width:** `min(1200px, calc(100% - 3rem))`

**Grid system:**
- Capabilities: 3-column CSS Grid with 16px gap
- Workflow: 4-column CSS Grid with 16px gap
- Pricing: 2-column CSS Grid with 16px gap
- Hero: 2-column flexbox (content + visual)

**Breakpoints:**
- Desktop: > 1024px
- Tablet: 901px – 1024px
- Mobile: ≤ 900px
- Extra small: ≤ 480px

**Container rules:**
- `.container` — single source of truth for content width
- Horizontal padding: `1.5rem` from viewport edges
- Cards inside container are full-width within their grid cell

**Section spacing:**
- Desktop: `8rem` padding-block
- Tablet: `5rem` padding-block
- Mobile: `3.5rem` padding-block

**Responsive behavior:**
- Hero: flex → column stack below 900px
- Showcase: flex → column stack below 900px
- Capabilities grid: 3 columns → 1 column below 900px
- Workflow grid: 4 columns → 2 columns below 1024px → 1 column below 900px
- Pricing grid: 2 columns → 1 column below 900px
- Navigation: fixed → hamburger menu below 900px
- Buttons: inline → full width below 480px

---

## Component-Level Rules

### Primary Button (`.btn-primary`)

**Purpose:** Primary call-to-action for critical user actions (sign up, create checklist).

**Anatomy:** Pill-shaped button with gold gradient background, dark text. May contain optional SVG icon.

**Variants:**
- Default: Gold gradient background
- Full-width: `.full-width` modifier for pricing cards

**States:**
- Default: `background: linear-gradient(135deg, #c9a86c, #dbb87e)`, `color: #0b0f19`
- Hover: `translateY(-3px) scale(1.02)`, brighter shadow, `filter: brightness(1.06)`
- Focus-visible: `outline: 2px solid var(--accent)`, `outline-offset: 2px`
- Active: `translateY(0) scale(.98)`, reduced shadow
- Disabled: `opacity: 0.45`, `cursor: not-allowed` (auth variant only)
- Loading: Not currently implemented — should use a spinner + disabled state
- Error: Not currently implemented — should show inline error

**Typography:** `font-size: .875rem`, `font-weight: 700`, `letter-spacing: .02em`
**Spacing:** `padding: .7rem 1.5rem`, `gap: .4rem` for icon
**Responsive:** Full width on mobile ≤ 480px
**Overflow:** `white-space: nowrap` prevents text wrap
**Keyboard:** Focus-visible outline required
**Pointer:** Click triggers navigation or submit
**Touch:** Minimum 44x44px touch target (current ~40px height — should verify)

### Secondary Button (`.btn-secondary`)

**Purpose:** Ghost-style button for secondary actions (View Demo, Get Started).

**Anatomy:** Pill-shaped button with transparent background, subtle border.

**States:**
- Default: `border: 1px solid rgba(122,162,247,.3)`, `background: rgba(122,162,247,.06)`
- Hover: Same lift and scale as primary, brighter border
- Active: `scale(.98)`
- Focus-visible: Same as primary
- Disabled: Not currently implemented

### Capability Card (`.capability-card`)

**Purpose:** Feature block displaying icon, title, and description.

**Anatomy:** Dark surface card with icon container, heading, body text.

**States:**
- Default: `background: var(--surface)`, `border: 1px solid var(--border)`
- Hover: `border-color` brightens, `background` shifts to `var(--surface-2)`
- Focus-within: Gold outline for keyboard navigation

**Typography:**
- Title: `font-size: .95rem`, `font-weight: 600`, `letter-spacing: -.01em`
- Text: `font-size: .85rem`, `color: var(--muted)`, `line-height: 1.6`

**Spacing:** `padding: 24px`, gap between elements: `16px` (icon to title), `8px` (title to text)

**Icon container:** `40x40px`, `border-radius: 10px`, `background: var(--accent-dim)`
**Icon image:** `20x20px`, `opacity: .9`

**Responsive:** Stacked 1 column on mobile

### Pricing Card (`.pricing-card`)

**Purpose:** Plan comparison card showing price, features, and CTA.

**Anatomy:** Dark surface card with title, price, description, feature list, CTA button.

**Variants:**
- Standard: `.pricing-card`
- Featured: `.pricing-card.pricing-featured` — gold-tinted border and gradient background

**Featured badge:** Inline pill, `background: var(--accent)`, `color: #0b0f19`, `padding: 4px 10px`

**States:**
- Default: Standard surface border
- Hover: Brightened border + surface-2 background
- For featured: Gold-tinged border + gold gradient background

**Typography:**
- Title: `1.05rem`, `font-weight: 600`
- Price amount: `2rem`, `font-weight: 700`
- Period: `0.8rem`, `color: var(--muted)`
- Feature items: `0.825rem`, `color: var(--muted)`

**Feature checkmark:** 16x16px rounded box with inline SVG gold checkmark
**Spacing:** `padding: 28px`, `gap: 10px` between features, `24px` before CTA

### Workflow Step (`.workflow-step`)

**Purpose:** Step-by-step process explanation card.

**Anatomy:** Number badge + title + description in a vertical stack.

**Number badge:** `28x28px`, `border-radius: 8px`, `background: var(--accent-dim)`, `color: var(--accent)`

**Typography:**
- Title: `0.9rem`, `font-weight: 600`
- Description: `0.825rem`, `color: var(--muted)`, `line-height: 1.55`

**States:** Same hover behavior as capability cards

### Hero Window (`.hero-window`)

**Purpose:** Product preview showing a fake checklist interface.

**Anatomy:** Window bar (traffic light dots + filename) + content area with progress bar and checklist items.

**Window bar:** `display: flex`, `padding: 12px 16px`, `border-bottom: 1px solid var(--border)`

**Traffic light dots:** Red (`#ef4444`), Yellow (`#f59e0b`), Green (`#10b981`), each `0.6rem` circle

**Checklist items:**
- Default: Dim text (`rgba(192,202,245,.55)`)
- Checked (`.checked`): Full brightness text, gold checkbox background
- Checkbox: `16x16px`, `border-radius: 4px`

### Navigation (`.nav`)

**Purpose:** Fixed top navigation bar with logo, links, and CTA.

**Anatomy:** Logo (image + text) | centered links | CTA button | hamburger (mobile)

**States:**
- Default: Transparent background
- Scrolled: `background: rgba(11,15,25,.82)`, `backdrop-filter: blur(20px)`, bottom border
- Link hover: `color` transitions from muted to text
- Mobile: Hamburger toggles dropdown menu with `open` class

**Responsive:**
- Desktop: Fixed full-width row
- Mobile (≤900px): Logo left, hamburger right, links hidden in dropdown

### Quote Block (`.quote-text`)

**Purpose:** Testimonial/quote with left gold accent border.

**Anatomy:** Block element with left border accent, surface background, rounded corners.

**Typography:** `clamp(1rem, 1.5vw, 1.25rem)`, `line-height: 1.75`

**Spacing:** `padding: 28px 32px`, `margin-bottom: 16px`

### Footer (`.footer`)

**Purpose:** Site footer with brand, navigation columns, and copyright.

**Grid:** Flexbox with `flex-wrap: wrap`, brand column gets `flex: 2`, others `flex: 1`

**Columns:** Product, Resources, Legal — each with heading and link list

**Bottom:** Copyright line with top border separator

### Trust Strip (`.trust-strip`)

**Purpose:** Social proof section showing company logos.

**Typography:** Labels: `0.8rem` uppercase muted, Company names: `0.9rem` semi-bold dim

**Layout:** Centered flexbox with `gap: 2.5rem`

---

## Visual Hierarchy Rules

**Attention direction:**
1. Hero headline (largest text, highest contrast)
2. Primary CTA buttons (gold gradient, highest saturation)
3. Section headings (clamp-sized, tight letter-spacing)
4. Card titles (semibold, structured)
5. Body text (muted secondary color)

**Contrast strategy:**
- Primary text: `#ececee` on `#0a0a0b` — ratio ~16:1 (AAA)
- Secondary text: `#8b8b96` on `#0a0a0b` — ratio ~6.5:1 (AA)
- Muted text: `#55555f` on `#0a0a0b` — ratio ~3.5:1 (AA for large text only)
- Gold accent on dark: `#c9a86c` on `#0a0a0b` — ratio ~7:1 (AA)

**Density strategy:**
- Low density hero section with generous whitespace
- Medium density card grids with 16px gaps
- High density only in checklist items within the auth app

**White-space strategy:**
- Section padding: `8rem` on desktop creates breathing room
- Card padding: `24px` for spacious content
- Feature list: `10px` gap for tight but readable density

**Image usage rules:**
- Icons only (no photography)
- 20x20px inside 40x40px containers for capability cards
- Logo image at 32x32px in nav
- All images must have alt text

**Icon usage rules:**
- Inline SVGs for interactive elements
- PNG images for static capability icons
- Gold color for all brand icons
- 15-16px for UI action icons

---

## Accessibility Requirements

**Target:** WCAG 2.2 AA

### Keyboard Accessibility

- All interactive elements must be keyboard-focusable
- `:focus-visible` must show a 2px gold outline with 2px offset
- `:focus:not(:focus-visible)` must remove outline (mouse click)
- Navigation dropdown must be toggleable with Enter/Space
- Anchor links must be reachable via Tab

PASS: `:focus-visible` outline applied globally
FAIL: No visible focus indicator on nav links

### Focus Management

- Focus order must follow visual order
- Modals must trap focus when open
- When modals close, focus must return to trigger element
- Skip-to-content link recommended for future

### Color Contrast

- Text on background must meet 4.5:1 (AA) for normal text
- Text on background must meet 3:1 (AA) for large text
- Interactive elements must have visible non-color indicators

PASS: `#ececee` on `#0a0a0b` = ~16:1
PASS: `#c9a86c` on `#0a0a0b` = ~7:1
FAIL if text drops below 4.5:1 ratio

### Motion Accessibility

- All animations must respect `prefers-reduced-motion: reduce`
- Implemented: `animation-duration: 0.01ms`, `transition-duration: 0.01ms`
- Particle animation must stop for reduced motion
- Scroll-triggered reveals must disable when reduced motion

PASS: `@media (prefers-reduced-motion: reduce)` block exists
FAIL: Particle background continues animating (enabled via `background.js`)

### Screen Reader Support

- All images must have descriptive `alt` text
- Interactive elements must have `aria-label` when text is not visible
- Navigation must have `aria-label="Primary navigation"`
- Icon-only buttons must have `aria-label`
- Status messages must use `role="status"` or `aria-live`

PASS: Hero capability icons have alt text
FAIL: Pricing feature checkmarks are decorative (should have `aria-hidden="true"`)

### Touch Targets

- All interactive elements must be at least 44x44px
- Current buttons at ~40px height — should increase to 44px
- Mobile nav toggle must have adequate size

### Error Handling

- Error states must be visible and descriptive
- Error messages must be associated with inputs via `aria-describedby`
- Auth form shows inline error banners — pattern should be reused

---

## Content Standards

### Button Labels

- Must be action-oriented: "Start Free", "Get Started", "View Demo", "Create account"
- Must not be ambiguous: Never use "Submit" or "Click here"
- Must use sentence case: "Start Free Trial", not "Start Free Trial"
- Should include the action verb: "Sign In", not "Continue"

### Navigation Labels

- Must be short: 1-2 words
- Must match section headings: "Features" → section "Capabilities"
- Must be consistent across all instances
- Must not use icons without text labels

### Form Labels

- Must be visible (not placeholder-only)
- Must have explicit `for` attribute association
- Should use title case: "Full name", "Work email"
- Error messages must be descriptive: "Please enter a valid email"

### Empty States

- Should include an icon or illustration
- Must include a clear title: "No checklist selected"
- Must include a description: "Create a new checklist..."
- Must include a CTA button
- Must not show raw error codes

### Error Messages

- Must be human-readable: "Something went wrong. Please try again."
- Must not use technical jargon
- Must be visually distinct (semantic `--danger` color)
- Must be dismissible or auto-clearing

### Success Messages

- Should use `--success` color
- Must provide clear next steps
- Should auto-dismiss within 5 seconds (toast pattern)

---

## Responsive Strategy

### Desktop (> 1024px)
- Full navigation with visible links
- 3-column capability grid
- 4-column workflow grid
- Side-by-side hero and showcase
- Full section padding: `8rem`

### Tablet (901px – 1024px)
- Full navigation
- 2-column workflow grid
- Everything else same as desktop

### Mobile (≤ 900px)
- Hamburger navigation with dropdown
- All grids become single column
- Hero and showcase stack vertically
- Section padding: `5rem`
- Cards `width: 100%`

### Extra Small (≤ 480px)
- Reduced container padding
- Section padding: `3.5rem`
- Buttons go full width
- Card padding: `16px`
- Hero headline size reduces
- Quotation padding reduces

---

## Edge Cases

### Very long text
- Card text uses `line-height: 1.6` for readability
- Overflow handled by natural text wrapping
- Nav links `white-space: nowrap` prevents wrapping
- Feature list items wrap naturally within card

### Very short text
- Cards maintain minimum visual presence via padding
- Pricing cards use `flex: 1` to fill available space
- Empty state provides guidance when no content exists

### Empty content
- Empty state block with icon, title, description, and CTAs
- Checklist view falls back to empty state when no checklist selected
- Pricing and feature sections always have content

### Missing images
- Capability icons: `object-fit: contain` prevents distortion
- No broken-image handling currently — should add fallback
- Avatar fallback: "?" character displayed

### Large datasets
- Sidebar scrolls independently (`overflow-y: auto`)
- Checklist items paginate naturally through scroll
- Feature lists limited to 6 items for readability

### Network failures
- Auth errors displayed via inline banners
- Toast system for transient notifications
- Loading states not fully implemented on landing page
- Should add loading skeleton for async operations

### Loading states
- Not currently implemented on landing page
- Auth page has form submission loading via button text
- Should add: spinner, skeleton screens, disabled buttons during load

### Localization
- No current i18n support
- All text is hardcoded in HTML
- Should extract strings for future translation

### Zoom at 200%
- Container uses `min()` for responsive width
- Text uses `rem`/`clamp()` for proper scaling
- Grids should remain readable at 200%
- Navigation dropdown may need scroll at 200%
- Particle background should be disabled at zoom > 150% (performance)

---

## Anti-Patterns and Prohibited Implementations

1. Must Not use raw hex values outside `:root` — always use CSS custom properties
2. Must Not add one-off border-radius values — use the radius token scale
3. Must Not introduce new font families without design system review
4. Must Not use text shadows — rely on color contrast
5. Must Not hide focus indicators — `:focus-visible` must always be visible
6. Must Not use `!important` — restructure specificity instead
7. Must Not use inline styles for layout — use CSS classes
8. Must Not create unbalanced card layouts — grids must align
9. Must Not use horizontal scrolling on page level — `overflow-x: hidden` is enforced
10. Must Not add animations longer than 1500ms without reduced-motion handling
11. Must Not use gradients outside the brand gradient or surface gradients
12. Must Not use white (`#ffffff`) as text color — use `var(--text)` instead
13. Must Not add new cards without matching hover state pattern
14. Must Not remove `white-space: nowrap` from buttons — they must not wrap
15. Must Not change `box-sizing` from `border-box`
16. Must Not use `em` for font sizes — use `rem` or `clamp()`
17. Must Not add icons without alt text or `aria-hidden`
18. Must Not create sections without consistent `section-padding`
19. Must Not introduce new breakpoints — use the 3-tier system
20. Must Not use JavaScript for layout — all responsive behavior must be CSS
21. Must Not use placeholder-only labels in forms
22. Must Not ship a component without its hover state
23. Must Not add card hover effects that use `translateY` lift — use border/background transitions only
24. Must Not use border-radius larger than 14px on cards — use `radius.2xl` max
25. Must Never hardcode the gold accent as `#c9a86c` in component CSS — always use `var(--accent)`

---

## Migration Notes

### Component Architecture (React)

```
src/
├── components/
│   ├── ui/
│   │   ├── Button/
│   │   │   ├── Button.tsx
│   │   │   ├── Button.css
│   │   │   └── index.ts
│   │   ├── Card/
│   │   │   ├── CapabilityCard.tsx
│   │   │   ├── PricingCard.tsx
│   │   │   └── WorkflowStep.tsx
│   │   ├── Navigation/
│   │   │   └── Navigation.tsx
│   │   ├── Hero/
│   │   │   ├── Hero.tsx
│   │   │   └── HeroWindow.tsx
│   │   ├── Footer/
│   │   │   └── Footer.tsx
│   │   ├── Quote/
│   │   │   └── Quote.tsx
│   │   └── TrustStrip/
│   │       └── TrustStrip.tsx
│   ├── sections/
│   │   ├── Capabilities.tsx
│   │   ├── Workflow.tsx
│   │   ├── Pricing.tsx
│   │   └── FinalCTA.tsx
│   └── layout/
│       └── Container.tsx
├── tokens/
│   ├── colors.ts
│   ├── typography.ts
│   ├── spacing.ts
│   └── index.ts
└── styles/
    └── globals.css
```

### Token Architecture (CSS Variables)

```css
:root {
  /* Colors */
  --color-bg: #0a0a0b;
  --color-surface: #111113;
  --color-surface-2: #18181b;
  --color-surface-3: #222226;
  --color-text: #ececee;
  --color-muted: #8b8b96;
  --color-accent: #c9a86c;
  --color-accent-2: #dbb87e;
  --color-accent-dim: rgba(201,168,108,0.12);
  --color-success: #6daf82;
  --color-danger: #e07a7a;

  /* Typography */
  --font-primary: 'Plus Jakarta Sans', system-ui, sans-serif;
  --font-mono: 'IBM Plex Mono', monospace;

  /* Spacing */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-7: 28px;
  --space-8: 32px;

  /* Radius */
  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 12px;
  --radius-xl: 14px;
  --radius-pill: 999px;
}
```

### CSS Variable Strategy

- All tokens in `:root` as CSS custom properties
- Component-specific overrides allowed via class scoping
- No Sass/SCSS required — pure CSS with custom properties
- Theme switching possible by overriding `:root` variables
- Use `var(--token)` everywhere, never raw values in components

---

## QA Checklist

[ ] Typography tokens applied — no raw font-size values outside tokens
[ ] Semantic colors used — no raw hex outside `:root`
[ ] Focus-visible implemented on all interactive elements
[ ] WCAG AA verified for all text/background pairs
[ ] Responsive behavior tested at 1024px, 900px, 480px
[ ] Loading states present for async operations
[ ] Empty states present for checklist view
[ ] Error states present for auth forms
[ ] Keyboard navigation verified — all interactive elements reachable
[ ] Touch targets ≥ 44x44px on mobile
[ ] Overflow handling verified — no horizontal scroll in any breakpoint
[ ] Design tokens enforced — no one-off values in component CSS
[ ] No one-off styles introduced outside component scope
[ ] Component variants documented for all card types
[ ] `prefers-reduced-motion` respected for all animations
[ ] Particle background disabled when `prefers-reduced-motion: reduce`
[ ] All images have descriptive alt text
[ ] All icon-only elements have `aria-label`
[ ] Navigation dropdown closes on outside click
[ ] Smooth scroll works for all anchor links
[ ] Button hover states use spring easing consistently
[ ] Card hover states use border/background transitions only
[ ] Pricing grid has correct 2-column layout
[ ] Capability grid has correct 3-column layout
[ ] Workflow grid has correct responsive stepping (4→2→1 columns)
[ ] Footer stacks correctly on mobile
[ ] Hero window scales correctly on small screens
[ ] Section padding consistent across all sections
[ ] No `!important` in production styles (except mobile auth layout)
[ ] All radius values match the token scale
[ ] All spacing values match the token scale

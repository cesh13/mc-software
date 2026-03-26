# Design System Strategy: The Curated Ledger

This document outlines the visual language and structural principles for this design system. We are moving away from the rigid, boxed-in aesthetics of traditional ERP systems to create a "Curated Ledger"—an experience that feels as much like a high-end editorial magazine as it does a powerful data tool.

## 1. Creative North Star: The Curated Ledger
The goal is to transform dense data into a breathing, organized narrative. We achieve this through **Soft Minimalism**: a philosophy that prioritizes intentional whitespace ("air"), tonal depth over structural lines, and a sophisticated hierarchy that guides the user’s eye through complex information without fatigue.

By utilizing intentional asymmetry—such as offset header alignments and varying card widths—we break the "template" feel and create a UI that feels bespoke and premium.

---

## 2. Color & Surface Philosophy
Color is not just an accent; it is our primary tool for defining architecture.

### The "No-Line" Rule
**Explicit Instruction:** Designers are prohibited from using 1px solid borders to section off large areas of the UI. Structure must be defined through background color shifts. For example, a sidebar or a header should be distinguished from the main content area by transitioning from `surface` to `surface-container-low`, never by a line.

### Surface Hierarchy & Nesting
Treat the interface as a physical stack of fine paper.
* **Base:** `background` (#f7f9ff) acts as the foundation.
* **Secondary Regions:** Use `surface-container-low` for navigation or sidebar areas to create a subtle recessed feel.
* **Content Carriers:** Use `surface-container-lowest` (#ffffff) for primary data cards. The contrast between the soft gray background and the pure white card creates a "lift" that feels natural.
* **Nesting:** High-priority modules within a card should use `surface-container-high` to draw the eye.

### The Glass & Gradient Rule
To prevent the UI from feeling flat, use the following:
* **Glassmorphism:** For floating elements like dropdowns or global search overlays, use `surface-container-lowest` with a 80% opacity and a `20px` backdrop-blur.
* **Signature Textures:** For primary actions or hero data points, use a subtle linear gradient transitioning from `primary` (#3b51d0) to `primary_container` (#687efe). This adds "soul" and professional polish.

---

## 3. Typography
We use **Inter** as our typographic backbone for its exceptional legibility and modern neutrality.

* **Display & Headlines:** Use `display-sm` (2.25rem) for high-level "hero" numbers (e.g., Total Revenue). Keep letter-spacing at -0.02em to maintain a high-end editorial look.
* **Titles:** Use `title-md` (1.125rem) for card headings. Use `on_surface` for maximum readability.
* **Data Labels:** Use `label-md` (0.75rem) with `on_surface_variant` in All Caps with +0.05em tracking for metadata or table headers. This creates a clear distinction between "data" and "labels."
* **Body:** `body-md` (0.875rem) is the workhorse for all user-generated content.

---

## 4. Elevation & Depth
In this design system, depth is a gradient of light, not a collection of boxes.

* **The Layering Principle:** Depth is achieved by "stacking" surface tokens. Place a `surface-container-lowest` card on a `surface` background to create a soft, natural lift.
* **Ambient Shadows:** When an element must float (like a Modal or a FAB), use a custom shadow:
* `box-shadow: 0 12px 32px -4px rgba(44, 51, 60, 0.08);`
* The shadow color must be a tinted version of `on_surface`, never pure black.
* **The "Ghost Border" Fallback:** If containment is absolutely necessary for accessibility in dense tables, use the `outline-variant` token at 15% opacity. High-contrast, 100% opaque borders are strictly forbidden.

---

## 5. Components

### Sidebar Navigation
The sidebar should use `surface-container-low`. Active states are marked by a `primary` vertical pill on the leading edge and a subtle `surface-variant` background for the item container. Icons should use `primary` for active states and `on_surface_variant` for inactive.

### Cards & Data Lists
* **Cards:** Radius `lg` (1rem). No borders. Separation is achieved via `spacing-6` (1.5rem) margins.
* **Lists:** Forbid divider lines. Separate items using `spacing-4` (1rem) vertical padding and a subtle hover state shift to `surface-container-high`.
* **Status Chips:** Use `secondary_container` for the background and `on_secondary_container` for text. For status-specific indicators (Success/Warning/Error), use `tertiary_fixed`, `orange`, or `error_container` with a `full` (9999px) roundedness.

### Interactive Elements
* **Buttons:**
* **Primary:** `primary` background with `on_primary` text. Radius `md` (0.75rem).
* **Secondary:** `surface-container-highest` background. No border.
* **Input Fields:** Use `surface-container-lowest` with a "Ghost Border" of `outline-variant` at 20%. Focus state should transition the border to `primary` at 100% and add a subtle `primary_fixed` outer glow.
* **Data Visualizations:** Use a palette of `primary`, `tertiary`, and `secondary` for charts. Ensure line weights are a minimum of 2px for clarity.

---

## 6. Do’s and Don’ts

### Do
* **Do** use asymmetrical layouts (e.g., a wide data table next to a narrow summary card) to create visual interest.
* **Do** prioritize "white space" over "more data." If a screen is too crowded, move secondary data into a slide-over panel.
* **Do** use `surface-container-lowest` for all interactive card surfaces to make them "pop" from the background.

### Don’t
* **Don't** use 1px solid borders to separate sections. Use tonal shifts in background colors instead.
* **Don't** use standard "drop shadows." Only use the Ambient Shadow specification for floating elements.
* **Don't** crowd icons and text. Use `spacing-3` (0.75rem) as the minimum gap between an icon and its label.
* **Don't** use pure black (#000000) for text. Always use `on_surface` or `on_surface_variant` to maintain the soft, premium feel.
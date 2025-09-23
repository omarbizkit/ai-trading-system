# S-Tier SaaS Dashboard Design Checklist (Cyberpunk Dark Theme Default)

## I. Core Design Philosophy & Strategy

*   [ ] **Dark-First Philosophy:** Default to a dark, cyberpunk-inspired UI (deep black/charcoal base with neon accents). Light mode is optional, not default.
*   [ ] **Users First:** Prioritize usability and avoid neon overload—glow and effects should support readability, not harm it.
*   [ ] **Professional Cyberpunk Aesthetic:** Neon elements (purple, cyan, magenta, electric blue) used sparingly as accents for emphasis.
*   [ ] **Consistency Across Modes:** Ensure neon color system works consistently in both dark and optional light themes.
*   [ ] **Accessibility (WCAG AA+):** Despite neon accents, always maintain high contrast and legible typography.

## II. Design System Foundation (Tokens & Core Components)

*   [ ] **Cyberpunk Color Palette (Dark Default):**
    *   [ ] **Backgrounds:** #0A0A0F (charcoal black), #111122 (deep gray-blue).
    *   [ ] **Primary Accents:** Neon Purple (#9B5DE5), Neon Cyan (#00F5FF), Neon Pink (#FF00A0).
    *   [ ] **Semantic Colors:** Success (#00FF9C neon green), Error (#FF3B3B crimson neon), Warning (#FFD93D yellow neon), Info (#3D9CFF bright blue).
    *   [ ] **Text:** Light gray (#E5E5E5), off-white (#F5F5F7).
    *   [ ] **Glow Effects:** Subtle outer glows on hover (0 0 8px neon accent).
*   [ ] **Establish a Typographic Scale:**
    *   [ ] **Primary Font Family:** Clean sans-serif (Inter, Manrope) with optional tech-style monospace headings.
    *   [ ] **Modular Scale:** Define distinct sizes for H1, H2, H3, H4, Body Large, Body Medium (Default), Body Small/Caption.
    *   [ ] **Font Weights:** Utilize a limited set of weights (Regular, Medium, SemiBold, Bold).
    *   [ ] **Line Height:** Ensure generous line height for readability (1.5–1.7 for body text).
*   [ ] **Define Spacing Units:**
    *   [ ] **Base Unit:** Establish a base unit (e.g., 8px).
    *   [ ] **Spacing Scale:** Use multiples of the base unit for all padding, margins, and layout spacing.
*   [ ] **Define Border Radii:**
    *   [ ] **Consistent Values:** Use sharper radii (4–8px) for a futuristic, sleek feel.
*   [ ] **Develop Core UI Components (with consistent states: default, hover, active, focus, disabled):**
    *   [ ] Buttons (primary, secondary, ghost, destructive, link-style; with icon options)
    *   [ ] Input Fields (text, textarea, select, date picker; with labels, placeholders, helper text, error messages)
    *   [ ] Checkboxes & Radio Buttons
    *   [ ] Toggles/Switches (glow-accented when active)
    *   [ ] Cards (dark base with neon-glow borders on hover)
    *   [ ] Tables (dark rows, neon separators, hover glow)
    *   [ ] Modals/Dialogs (translucent dark backgrounds, neon-lit edges)
    *   [ ] Navigation Elements (Sidebar with glowing highlight states, Tabs)
    *   [ ] Badges/Tags (status indicators in neon semantic colors)
    *   [ ] Tooltips (dark with subtle glow)
    *   [ ] Progress Indicators (neon spinners and bars)
    *   [ ] Icons (modern clean SVG set)
    *   [ ] Avatars

## III. Layout, Visual Hierarchy & Structure

*   [ ] **Responsive Grid System:** Dark neon grid based on a responsive system (e.g., 12-column).
*   [ ] **Strategic Negative Space:** Use space to prevent neon overload and maintain clarity.
*   [ ] **Clear Visual Hierarchy:** Guide with typography, spacing, and neon accents only where needed.
*   [ ] **Consistent Alignment:** Maintain consistent alignment of elements.
*   [ ] **Main Dashboard Layout:**
    *   [ ] Persistent Left Sidebar with neon highlight on active item.
    *   [ ] Content Area with dark neutral background and minimal accents.
    *   [ ] (Optional) Top Bar for global search, user profile, notifications.
*   [ ] **Mobile-First Considerations:** Ensure neon effects scale gracefully on smaller screens.

## IV. Interaction Design & Animations

*   [ ] **Purposeful Micro-interactions:** Subtle neon animations for hovers, clicks, and state changes.
    *   [ ] Feedback should be immediate and clear.
    *   [ ] Animations should be quick (150–300ms) with ease-in-out easing.
*   [ ] **Loading States:** Neon spinners or skeleton loaders with subtle glow.
*   [ ] **Transitions:** Smooth transitions for state changes, modals, and section expansions.
*   [ ] **Avoid Distraction:** Animations should enhance usability, not overwhelm.
*   [ ] **Keyboard Navigation:** All interactive elements must be keyboard accessible with clear neon focus states.

## V. Specific Module Design Tactics

### A. Multimedia Moderation Module

*   [ ] **Clear Media Display:** Prominent dark cards with neon-hover previews.
*   [ ] **Obvious Moderation Actions:** Approve, Reject, Flag buttons styled with neon semantic colors.
*   [ ] **Visible Status Indicators:** Neon badges (Pending = cyan, Approved = green neon, Rejected = red neon).
*   [ ] **Contextual Information:** Show uploader, timestamp, flags alongside media.
*   [ ] **Workflow Efficiency:**
    *   [ ] Bulk Actions supported.
    *   [ ] Keyboard Shortcuts for speed.
*   [ ] **Minimize Fatigue:** Maintain a clean, uncluttered dark interface.

### B. Data Tables Module (Contacts, Admin Settings)

*   [ ] **Readability & Scannability:**
    *   [ ] Left-align text, right-align numbers.
    *   [ ] Clear Headers: Bold, high-contrast.
    *   [ ] Zebra Striping: Subtle opacity shifts, not bright color.
    *   [ ] Legible Typography with neon hover cues.
    *   [ ] Adequate Row Height & Spacing.
*   [ ] **Interactive Controls:**
    *   [ ] Column Sorting with neon-highlighted indicators.
    *   [ ] Intuitive Filtering with glowing input fields.
    *   [ ] Global Table Search.
*   [ ] **Large Datasets:**
    *   [ ] Pagination or infinite scroll.
    *   [ ] Sticky Headers or Frozen Columns if needed.
*   [ ] **Row Interactions:**
    *   [ ] Expandable Rows with neon outline on expand.
    *   [ ] Inline Editing with glowing active field.
    *   [ ] Bulk Actions with neon toolbar.
    *   [ ] Clear Action Icons (Edit, Delete, View).

### C. Configuration Panels Module (Microsite, Admin Settings)

*   [ ] **Clarity & Simplicity:** Clear, unambiguous labels and concise helper text.
*   [ ] **Logical Grouping:** Group settings with neon dividers or subtle glow sections.
*   [ ] **Progressive Disclosure:** Hide advanced settings by default.
*   [ ] **Appropriate Input Types:** Toggles, sliders, and selects styled with neon glow.
*   [ ] **Visual Feedback:** Inline success/error feedback with neon semantic colors.
*   [ ] **Sensible Defaults:** Pre-filled values with reset options.
*   [ ] **Microsite Preview (If Applicable):** Live preview with glowing frame.

## VI. CSS & Styling Architecture

*   [ ] **Choose a Scalable CSS Methodology:**
    *   [ ] Utility-First (Tailwind recommended with neon tokens).
    *   [ ] BEM with Sass if not utility-first.
    *   [ ] CSS-in-JS for scoped components if needed.
*   [ ] **Integrate Design Tokens:** Colors, fonts, spacing, radii must be defined as tokens.
*   [ ] **Maintainability & Readability:** Organized, easy-to-understand CSS.
*   [ ] **Performance:** Optimize delivery; avoid heavy shadow computations.

## VII. General Best Practices

*   [ ] **Iterative Design & Testing:** Continuously test neon readability and adjust.
*   [ ] **Clear Information Architecture:** Logical, consistent navigation.
*   [ ] **Responsive Design:** Looks great across all devices.
*   [ ] **Documentation:** Maintain clear documentation for neon design tokens and components.

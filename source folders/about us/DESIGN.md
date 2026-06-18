---
name: Aegis Traffic Control
colors:
  surface: '#f9f9ff'
  surface-dim: '#cadbfc'
  surface-bright: '#f9f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f0f3ff'
  surface-container: '#e7eeff'
  surface-container-high: '#dfe8ff'
  surface-container-highest: '#d6e3ff'
  on-surface: '#091c35'
  on-surface-variant: '#434654'
  inverse-surface: '#20314b'
  inverse-on-surface: '#ecf0ff'
  outline: '#737685'
  outline-variant: '#c3c6d6'
  surface-tint: '#0c56d0'
  primary: '#003d9b'
  on-primary: '#ffffff'
  primary-container: '#0052cc'
  on-primary-container: '#c4d2ff'
  inverse-primary: '#b2c5ff'
  secondary: '#006c47'
  on-secondary: '#ffffff'
  secondary-container: '#8af5be'
  on-secondary-container: '#00714b'
  tertiary: '#851800'
  on-tertiary: '#ffffff'
  tertiary-container: '#b02300'
  on-tertiary-container: '#ffc6b9'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dae2ff'
  primary-fixed-dim: '#b2c5ff'
  on-primary-fixed: '#001848'
  on-primary-fixed-variant: '#0040a2'
  secondary-fixed: '#8df7c1'
  secondary-fixed-dim: '#71dba6'
  on-secondary-fixed: '#002113'
  on-secondary-fixed-variant: '#005235'
  tertiary-fixed: '#ffdad2'
  tertiary-fixed-dim: '#ffb4a3'
  on-tertiary-fixed: '#3d0600'
  on-tertiary-fixed-variant: '#8b1a00'
  background: '#f9f9ff'
  on-background: '#091c35'
  surface-variant: '#d6e3ff'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  headline-sm:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.05em
  data-mono:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
    letterSpacing: -0.01em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  base: 8px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  gutter: 16px
  margin-mobile: 16px
  margin-desktop: 32px
---

## Brand & Style
The design system is engineered for high-utility, civic-scale traffic management. It prioritizes reliability, immediate legibility, and public trust. The brand persona is authoritative yet accessible—reminiscent of official Digital India initiatives—focused on serving municipal operators and law enforcement.

The visual style is **Corporate Modern with a Functionalist edge**. It avoids decorative trends in favor of high-contrast data visualization, structured information density, and clear status indicators. The interface must feel stable and performant under 24/7 operational conditions, utilizing standard borders and solid surfaces to establish a sense of institutional permanence.

## Colors
The palette is grounded in professional blues and functional neutrals to ensure long-term visual comfort for operators. 

*   **Primary (Civic Blue):** Used for primary actions, navigation headers, and official branding. It signals authority and stability.
*   **Secondary (Success Green):** Utilized for "Clear" traffic status, validated e-challans, and active signals.
*   **Tertiary (Alert Red):** Reserved for congestion alerts, traffic violations, and emergency overrides.
*   **Neutrals:** A range of cool grays (Slate and Charcoal) are used for "Sector" backgrounds, "Chowk" data tables, and secondary labels to reduce eye strain.
*   **Backgrounds:** A very light grey (#F4F5F7) is preferred over pure white to soften the interface for indoor command centers.

## Typography
This design system utilizes **Inter** for its exceptional legibility at small sizes and its neutral, systematic appearance. 

The type hierarchy is strictly defined to handle dense data inputs. **Display-lg** is reserved for high-level "Ward" or "District" metrics. **Data-mono** (Inter with tabular figures) should be used for vehicle registration numbers, GPS coordinates, and timestamp logs to ensure vertical alignment in data tables. Labels use an uppercase style with slight tracking to differentiate them from editable content.

## Layout & Spacing
The layout follows a **Fixed-Fluid Hybrid Grid**. Sidebars for "Sector Navigation" are fixed width (280px), while the central dashboard area is fluid to accommodate wide CCTV feeds and data spreadsheets.

An 8px base unit (the "Aegis Unit") governs all spatial relationships. 
- **Desktop:** 12-column grid, 16px gutters, 32px outer margins.
- **Mobile/Handheld:** 4-column grid, 12px gutters, 16px margins for field officers.
- **Density:** Elements are packed with "Medium" density (16px padding for cards) to maximize information on-screen without compromising touch targets for tablets used in patrol vehicles.

## Elevation & Depth
Depth is communicated through **Tonal Layering and 1px Borders** rather than dramatic shadows. This ensures the UI remains crisp on lower-resolution monitors often found in government offices.

- **Level 0 (Background):** #F4F5F7 for the main canvas.
- **Level 1 (Cards/Tables):** White (#FFFFFF) surface with a 1px border (#DFE1E6). No shadow.
- **Level 2 (Modals/Popovers):** White surface with a tight, 4px blur shadow (Opacity 10%) to suggest the element is temporarily "on top" of the management console.
- **Interactive:** Hover states on list items use a subtle grey tint (#EBECF0) rather than an elevation change.

## Shapes
The shape language is **Soft (0.25rem/4px)**. This minimal rounding provides a modern touch while maintaining a serious, structured, and efficient aesthetic. 

- **Standard Buttons & Inputs:** 4px radius.
- **Outer Container Cards:** 8px (rounded-lg) to create a clear container for "Chowk" status summaries.
- **Status Pills:** Fully rounded (pill-shaped) to distinguish them from interactive buttons.

## Components
### Buttons & Controls
- **Primary Button:** Solid Blue (#0052CC) with white text. High-contrast and identifiable.
- **Secondary/Outline:** 1px border (#42526E) with matching text. Used for "Download Report" or "Export Data."

### Input Fields
- Labels must always be visible above the input field, never as placeholders. 
- Validation states (Success/Error) use solid 2px bottom borders to ensure clarity for users with color vision deficiencies.

### Data Tables (The "Aegis Table")
- Optimized for "Ward-level" traffic stats. 
- Use zebra-striping (Light Grey/White) for readability. 
- Headers are sticky and use the `label-md` typographic style.

### Status Indicators (Chips)
- **Live:** Green background, white text.
- **Congested:** Amber background, black text.
- **Closed:** Red background, white text.
- These must include a small leading icon for accessibility.

### Cards
- Used for "Sector Summaries." 
- Cards should have a 1px stroke and no drop shadow. Content is separated by 1px horizontal dividers.
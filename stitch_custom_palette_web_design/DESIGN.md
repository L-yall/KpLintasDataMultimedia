---
name: Professional Tech Connectivity
colors:
  surface: '#f8f9fa'
  surface-dim: '#d9dadb'
  surface-bright: '#f8f9fa'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f3f4f5'
  surface-container: '#edeeef'
  surface-container-high: '#e7e8e9'
  surface-container-highest: '#e1e3e4'
  on-surface: '#191c1d'
  on-surface-variant: '#3d494b'
  inverse-surface: '#2e3132'
  inverse-on-surface: '#f0f1f2'
  outline: '#6d797c'
  outline-variant: '#bcc9cc'
  surface-tint: '#006876'
  primary: '#006876'
  on-primary: '#ffffff'
  primary-container: '#14a3b8'
  on-primary-container: '#00333a'
  inverse-primary: '#61d6ec'
  secondary: '#286292'
  on-secondary: '#ffffff'
  secondary-container: '#94c8fe'
  on-secondary-container: '#145483'
  tertiary: '#575f67'
  on-tertiary: '#ffffff'
  tertiary-container: '#8d969e'
  on-tertiary-container: '#262f35'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#a2efff'
  primary-fixed-dim: '#61d6ec'
  on-primary-fixed: '#001f25'
  on-primary-fixed-variant: '#004e5a'
  secondary-fixed: '#cfe5ff'
  secondary-fixed-dim: '#99cbff'
  on-secondary-fixed: '#001d34'
  on-secondary-fixed-variant: '#004a78'
  tertiary-fixed: '#dbe4ed'
  tertiary-fixed-dim: '#bfc8d0'
  on-tertiary-fixed: '#141d23'
  on-tertiary-fixed-variant: '#3f484f'
  background: '#f8f9fa'
  on-background: '#191c1d'
  surface-variant: '#e1e3e4'
typography:
  display-lg:
    fontFamily: Hanken Grotesk
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Hanken Grotesk
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
  headline-lg-mobile:
    fontFamily: Hanken Grotesk
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 36px
  headline-md:
    fontFamily: Hanken Grotesk
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  body-lg:
    fontFamily: Hanken Grotesk
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Hanken Grotesk
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-lg:
    fontFamily: Hanken Grotesk
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: 0.01em
  label-sm:
    fontFamily: Hanken Grotesk
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  container-max: 1280px
  gutter: 24px
  margin-desktop: 64px
  margin-mobile: 20px
  stack-sm: 8px
  stack-md: 16px
  stack-lg: 32px
  section-gap: 80px
---

## Brand & Style

The design system is engineered to project the identity of a reliable, high-speed Internet Service Provider. It balances corporate professionalism with a modern, user-centric tech aesthetic. The visual narrative focuses on "stability meets velocity," utilizing a structured grid and crisp elements to evoke trust in infrastructure while maintaining a fast, approachable digital experience.

The chosen style is **Corporate / Modern** with a subtle infusion of **Glassmorphism**. It utilizes clean layouts, substantial whitespace, and sophisticated translucent layers for information cards to suggest transparency and cutting-edge technology. The target audience includes both residential users seeking reliable home connectivity and business clients requiring robust infrastructure.

## Colors

The palette is anchored in a professional blue spectrum to communicate authority and digital innovation. 

- **Primary (Cyan):** Used for actionable elements, progress indicators, and key highlights. It represents the "speed" and "innovation" aspect of the brand.
- **Secondary (Navy):** Applied to headers, footers, and primary brand markers. It provides the "stability" and "professionalism" anchor.
- **Tertiary (Slate):** Used for secondary text, metadata, and non-critical UI decorations.
- **Neutral:** A light gray foundation that keeps the interface feeling airy and clean, allowing the blue tones to remain the primary focus.

Color is used functionally: Cyan drives the user's eye toward conversion points, while Navy defines the structural hierarchy of the page.

## Typography

This design system uses **Hanken Grotesk** across all levels to maintain a cohesive, modern sans-serif look. The typeface was selected for its high legibility and geometric clarity, which reinforces the "high-tech" brand personality.

Headlines use a bold weight and slightly tighter letter-spacing to create a sense of impact and urgency. Body text maintains a generous line height (1.5x) to ensure long-form service descriptions remain readable. For technical data and labels, a medium weight is used to provide clear hierarchy without overwhelming the primary content. Mobile typography is scaled down specifically for headlines to prevent awkward text wrapping on smaller screens.

## Layout & Spacing

The system employs a **12-column fluid grid** for desktop, transitioning to a **4-column grid** for mobile devices. 

- **Desktop:** 1280px max-width container with 24px gutters. Sections are separated by an 80px vertical gap to provide "breathing room" that mirrors a premium service experience.
- **Tablet:** 8-column layout with reduced margins (32px).
- **Mobile:** Single column layout for content cards, with 20px side margins.

Spacing follows a consistent 8px base unit. Component internal padding should favor "roomy" layouts (e.g., 24px or 32px padding for cards) to prevent the UI from feeling cluttered, reinforcing the "user-friendly" design goal.

## Elevation & Depth

Visual hierarchy is established through **Tonal Layers** and **Ambient Shadows**. 

1.  **Base Layer:** Light Neutral (#F8F9FA) for the main background.
2.  **Mid Layer:** White surfaces for primary content cards. These cards use an extra-diffused, low-opacity shadow (e.g., `0px 4px 20px rgba(0, 75, 122, 0.08)`) which incorporates a hint of the secondary Navy color to create a more integrated, sophisticated depth than neutral black shadows.
3.  **Top Layer:** Used for floating buttons (like 'Back to Top') and navigation bars. These use a slightly higher elevation with a more pronounced shadow.

In certain sections, a **Glassmorphism** effect is applied to headers or overlay cards (backdrop-filter: blur(10px)) to add a layer of technological sophistication without sacrificing clarity.

## Shapes

The shape language is **Rounded**, utilizing a consistent corner radius to soften the technical nature of the product and make it feel more approachable.

- **Standard Elements:** 0.5rem (8px) radius for input fields and small buttons.
- **Large Elements:** 1rem (16px) radius for content cards and feature containers.
- **Extra Large Elements:** 1.5rem (24px) for hero section containers or specialized graphic backdrops.

This moderate roundedness avoids the playfulness of "pill" shapes while moving away from the harshness of sharp corners, striking a balance between "modern tech" and "friendly service."

## Components

### Buttons
- **Primary:** Solid Cyan (#14A3B8) with white text. Uses a 0.5rem radius. Hover state involves a slight darken or a subtle upward lift via shadow.
- **Secondary/Ghost:** Outlined in Navy (#004B7A) or Cyan, with transparent backgrounds for less critical actions.
- **Icon Buttons:** Circular containers with 50% radius, used for social links or utility actions.

### Cards
Cards are the primary container for information. They must feature a white background, 1rem rounded corners, and the signature ambient blue-tinted shadow. Features within cards (like service icons) should use the Primary Cyan color.

### Input Fields
Clean, outlined boxes with a 0.5rem radius. The border color should be Tertiary (#6C757D) when inactive, switching to Primary Cyan on focus.

### Accents
Horizontal separators should use a dual-tone approach—a thin gray line with a small Cyan/Navy accent block in the center (as seen in the "Hubungi Kami" section)—to maintain brand consistency across different content blocks.

### Lists & Icons
Iconography should be linear and thin-stroked, matching the weight of the typography. Icons are always housed in soft-colored circular backgrounds or presented in the Primary Cyan color to denote "features" and "benefits."
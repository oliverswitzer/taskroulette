---
version: alpha
name: TaskRoulette
description: Warm, electric, momentum-driven dark UI for an ADHD task paralysis breaker. Dopamine is the product.
colors:
  base: "oklch(12% 0.02 260)"
  surface: "oklch(18% 0.025 260)"
  surface2: "oklch(22% 0.025 260)"
  ink: "oklch(95% 0.01 260)"
  ink-muted: "oklch(60% 0.02 260)"
  border: "oklch(28% 0.025 260)"
  accent: "oklch(72% 0.2 30)"
  accent-glow: "oklch(72% 0.25 30)"
  success: "oklch(75% 0.18 145)"
  wheel-1: "oklch(72% 0.2 30)"
  wheel-2: "oklch(78% 0.18 60)"
  wheel-3: "oklch(82% 0.16 100)"
  wheel-4: "oklch(75% 0.2 145)"
  wheel-5: "oklch(70% 0.22 200)"
  wheel-6: "oklch(68% 0.24 260)"
  wheel-7: "oklch(72% 0.22 300)"
  wheel-8: "oklch(76% 0.2 340)"
typography:
  display:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "2rem"
    fontWeight: "800"
    lineHeight: "1.1"
    letterSpacing: "-0.02em"
  h1:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "1.75rem"
    fontWeight: "700"
    lineHeight: "1.2"
    letterSpacing: "-0.015em"
  h2:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: "600"
    lineHeight: "1.3"
  body-lg:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: "400"
    lineHeight: "1.6"
  body-md:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: "400"
    lineHeight: "1.6"
  body-sm:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: "400"
    lineHeight: "1.5"
  label:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: "600"
    lineHeight: "1.4"
    letterSpacing: "0.04em"
rounded:
  sm: "8px"
  md: "14px"
  lg: "20px"
  xl: "28px"
  full: "9999px"
spacing:
  xs: "8px"
  sm: "12px"
  md: "20px"
  lg: "32px"
  xl: "48px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "oklch(10% 0.01 30)"
    rounded: "{rounded.lg}"
    padding: "18px 32px"
  button-primary-hover:
    backgroundColor: "{colors.accent-glow}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink-muted}"
    rounded: "{rounded.md}"
    padding: "10px 16px"
  task-card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.xl}"
    padding: "28px"
  task-card-active:
    backgroundColor: "{colors.surface2}"
    textColor: "{colors.ink}"
  task-input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "14px 16px"
  badge:
    backgroundColor: "{colors.surface2}"
    textColor: "{colors.ink-muted}"
    rounded: "{rounded.full}"
    padding: "4px 12px"
  badge-warning:
    backgroundColor: "oklch(40% 0.1 30)"
    textColor: "{colors.accent}"
---

## Overview

Dark, electric, warm. The UI is designed to feel like a reward, not a tool. Every surface should feel intentional — nothing generic, nothing clinical.

The base is a deep near-black with a blue-gray hint (not pure black). Accents are warm orange-red in OKLCH, high-chroma, energizing without being aggressive. The wheel uses 8 distinct vibrant OKLCH hues that feel like a real carnival prize wheel — celebratory, not corporate.

Motion energy: exponential ease-out throughout. Nothing bounces, nothing elastics. Smooth deceleration signals trustworthiness. The wheel spin is the emotional peak of the experience — treat it accordingly.

## Colors

- **Base (`oklch(12% 0.02 260)`):** Near-black with a cool blue undertone. Not pure black — feels warmer and more intentional.
- **Surface / Surface2:** Two elevated levels for cards, modals, input fields. Subtle progression.
- **Ink (`oklch(95% 0.01 260)`):** Near-white, almost no chroma. Maximum readability.
- **Ink-muted:** Secondary text. Must still pass 4.5:1 against surface backgrounds.
- **Accent (`oklch(72% 0.2 30)`):** Warm orange-red. The primary action color. Used on primary CTAs, the spin button, the task card glow.
- **Wheel colors (8):** Full vibrant OKLCH arc from warm orange through green, teal, blue, purple, back to pink. Each slice visually distinct, all high-chroma.

## Typography

Inter throughout. One typeface, multiple weights — no pairing needed when the weight contrast is strong.

Mobile-first sizing: body at 1rem (16px), never smaller than 0.875rem for body content. Labels at 0.75rem maximum. Display headings capped at 2rem on mobile — no hero-shouting.

Line length: cap body text at 65ch on desktop. On mobile, padding handles this naturally.

## Layout

Generous padding. ADHD users need breathing room — cramped layouts increase anxiety. Minimum 20px horizontal padding on mobile. Card content at 28px padding.

Single-column layout throughout — this is a focused, one-task-at-a-time tool. No sidebars. No grids except the task list.

## Elevation & Depth

Three levels: base → surface → surface2. No shadows as decoration. Use background elevation to create depth.

Exception: the task card glow effect uses `box-shadow` and `filter: drop-shadow` with the accent color — this is intentional and functional (signals the selected task).

## Shapes

Generous radii — `14px` default on cards/inputs. `20px` on the main task card. `28px` on the floating selected-task card (the hero dopamine moment). Full pill on badges and small controls.

## Components

- **button-primary:** Large, warm orange-red, generous padding (18px 32px), minimum 54px height on mobile. This is the Spin button — it must feel satisfying to tap.
- **button-ghost:** Deemphasized. Small, muted. Used for "Spin again" — intentionally low-key.
- **task-card:** The hero moment. Surface background, XL radius, generous padding. Gets the glow treatment when selected.
- **task-input:** For the task list items. Slightly elevated surface, medium radius.

## Do's and Don'ts

- **Do:** Use OKLCH for every color value. Use `expo-out` easing on all animations. Give the Spin button a minimum 60px height on mobile.
- **Don't:** No gradient text. No glassmorphism (`backdrop-filter` as decoration). No cream or beige. No identical card grids. No side-stripe borders. No border-radius above 28px on any card.

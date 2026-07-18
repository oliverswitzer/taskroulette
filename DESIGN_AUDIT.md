# TaskRoulette Visual Design Audit
_Generated from 24 screenshots across all screens and breakpoints_

---

## Emotional Register Summary

The design has excellent bones: dark palette, OKLCH color system, motion via Framer Motion, and brand-aligned copy. But the **emotional execution underdelivers the dopamine promise**. Several screens read as developer prototype rather than reward machine. The three biggest emotional gaps:

1. **Wheel**: Prize wheel energy is absent. Muddy hex conversions undercut the vibrant OKLCH spec. The pointer is invisible. Upside-down labels break trust.
2. **Task card glow**: Present but too subtle — feels atmospheric, not celebratory. The "dopamine moment" of reveal needs to shout.
3. **All-done screen**: The screen appears black with floating confetti for 1+ second because the headline and button are delayed. Users experience an error state, not a reward.

No gradient text detected. No glassmorphism detected. No cream/beige detected. ✅ All bans from DESIGN.md respected.

---

## Screen-by-Screen Findings

### 1. DumpScreen (empty) — `dump-empty-desktop.png`, `dump-empty-mobile.png`

**Emotional impression:** Calm, focused. Copy is warm. But the disabled button is functionally invisible — users may not register the primary action exists.

**What works:** Heading hierarchy, centered column, copy tone, no visual clutter.

**Issues:**
- Disabled button: `oklch(40% 0.02 260)` text on `oklch(22% 0.025 260)` bg → estimated ~2.5:1. Fails WCAG AA. The button looks like part of the background.
- Ink-muted subheading and placeholder pass numerically but feel thin on-screen.
- Resize handle visible on mobile (native browser artifact — should be hidden via `resize: none`, which the code already has — confirmed in code ✅).
- Excessive top whitespace: `justifyContent: 'center'` on 100dvh centers fine, but combined with the large textarea, the bottom feels bare.

---

### 2. DumpScreen (filled) — `dump-filled-desktop.png`, `dump-filled-mobile.png`

**Emotional impression:** Confident, warm. The coral button is excellent — high contrast, inviting, appropriately large.

**What works:** Button treatment with accent color, focus glow on textarea, consistent radius, generous touch target (60px height), conversational copy.

**Issues:**
- Button text color `oklch(10% 0.01 30)` on `oklch(72% 0.2 30)` coral → ~5.3:1. Passes AA. ✅
- The input's coral border on focus (`var(--color-accent)`) could be confused with an error state — minor concern.
- Mobile: subheading `font-size: '1.0625rem'` with `color: var(--color-ink-muted)` is borderline. Acceptable.

---

### 3. ParsingScreen — `parsing-desktop.png`, `parsing-mobile.png`

**Emotional impression:** Calm, but the skeleton bars are nearly invisible against their card backgrounds, making the screen look frozen rather than loading.

**What works:** Copy ("Sorting through the chaos..") is excellent brand voice. Staggered card entrance animations are appropriate. Typography hierarchy is clear.

**Issues:**
- Skeleton bar color `oklch(30% 0.03 260)` on surface `oklch(18% 0.025 260)` → delta of only 12% L — extremely low visibility.
- Shimmer gradient uses `oklch(55% 0.03 260 / 0.7)` as highlight — too close in value to be perceptible.
- Double-period `..` in "Sorting through the chaos.." — typographic error, should be `…` (ellipsis).
- The screen uses a single hardcoded message (`SKELETON_MESSAGES[0]`) — other messages defined but never shown.

---

### 4. ListEditScreen — `list-3tasks-desktop.png`, `list-3tasks-mobile.png`, `list-15tasks-desktop.png`, `list-15tasks-mobile.png`

**Emotional impression:** Focused, clean hierarchy. The badge and coral CTA give energy. But the icon buttons feel invisible and the dead space between list and CTA creates an unfinished impression.

**What works:** Badge coloring, fixed CTA position with gradient fade, dashed "add task" affordance, AnimatePresence exit animations, card typography.

**Issues:**
- **Icon color `oklch(65% 0.02 260)` on surface `oklch(18% 0.025 260)` → ~6:1 — passes AA**. The 18px icon inside the 44×44 hit target is visually small but the touch target is correct.
- Large dead space between task list and fixed CTA on desktop when tasks < 8. The `paddingBottom: 'calc(80px + 32px)'` helps scroll, but desktop viewport shows an obvious empty zone.
- At 15 tasks: all cards use identical visual weight. No scan hierarchy.
- `"+ Add another task"` color: `var(--color-ink-muted)` = `oklch(60% 0.02 260)` on base. Passes AA but feels thin. The hover state that brightens to ink color is good.

---

### 5. WheelScreen (idle) — `wheel-idle-mobile.png`, `wheel-idle-3tasks-mobile.png`, `wheel-idle-8tasks-mobile.png`, `wheel-idle-8tasks-desktop.png`, `wheel-idle-15tasks-mobile.png`

**Emotional impression:** The wheel concept works conceptually but the execution reads flat. Key problems: muddy hex colors, invisible notch pointer, label orientation bugs, no glow or depth on the wheel itself.

**What works:** Wheel proportions (340px on mobile), coral Spin button dominance, audio tick implementation (correct), swipe gesture support, rainbow progression on 8-task wheel.

**Critical issues:**
- **Upside-down text bug**: On a 3-task wheel, slice 1's center falls exactly at `π/2` rad. The strict `>` in line 129 of WheelCanvas.tsx excludes this from the bottom-half flip, rotating it to 180° = fully inverted text. Confirmed across multiple screenshots.
- **Notch pointer is 12×14px** — confirmed in code at lines 162-164 of WheelCanvas.tsx. Completely invisible in motion. The shadow at 6px blur on a 12px triangle is negligible.
- **Hex conversions don't match OKLCH vibrancy**: The amber `#D4891A` (maps to oklch(78% 0.18 60)) renders as dull golden-brown. The yellow-green `#8DB822` reads as olive/muddy. The OKLCH spec promises vibrant carnival colors; the canvas hex conversions deliver muted earth tones.
- **Wheel ring stroke** `rgba(255,255,255,0.15)` at 2px — nearly invisible.
- **White text on yellow-green `#8DB822`**: ~2.1:1 — fails WCAG AA.
- **White text on amber `#D4891A`**: ~2.4:1 — fails WCAG AA.
- **White text on orange `#E8532A`**: ~4.0:1 — borderline fail for normal text.
- **Slice dividers** `rgba(0,0,0,0.25)` — too subtle on dark segments.
- **At 15 tasks** (24° per segment): labels are severely cramped, label collision occurs in dense quadrants. The `sliceAngle < 0.3` cutoff at line 114 means text shows at 15 tasks (0.418 rad) but is nearly unreadable.
- **Dead space**: Layout places wheel in upper 55% of screen; bottom 40% is empty black void. Especially bad on desktop and on 15-task mobile.
- **Badge contrast**: `oklch(20% 0.05 30)` background with `var(--color-accent)` text. The accent orange reads as deep red-brown with this dark background — appears alarming rather than informational.
- **Wheel glow on win state**: WheelScreen.tsx line 274 uses `rgba(232,83,42,0.3)` — too soft for a win state.

---

### 6. WheelScreen (spinning) — `wheel-spinning-mobile.png`

**Emotional impression:** Completely flat. The spinning state communicates nothing. A static screenshot with "Spinning…" label in a grayed-out disabled button is the entire UX signal.

**What works:** Button label change to "Spinning…" correctly indicates state. Edit button correctly hidden during spin.

**Issues:**
- No motion blur on canvas — the canvas redraws every animation frame but there's no trail/blur effect applied to the canvas during high-velocity spin. This is expected from a canvas 2D implementation but the result is a crisp wheel that could be at any angle rather than clearly spinning fast.
- **Spinning button: `opacity: 0.5` on already-muted color** — line 330 in WheelScreen.tsx. The effective contrast of "Spinning…" text drops to ~2.25:1 at half opacity.
- No pulsing, shimmer, or loading indicator on the button during spin.

---

### 7. TaskCard (task reveal) — `task-card-mobile.png`, `task-card-desktop.png`

**Emotional impression:** The concept is strong — frozen wheel + glowing card below. Execution is 60% there. The glow exists but is atmospheric rather than celebratory.

**What works:** Spring animation entry on card, wheel frozen with winner highlighted, confetti on check, "skip for now" correctly de-emphasized, WheelCanvas winner slice highlights with WHEEL_COLORS_BRIGHT variants.

**Issues:**
- **Glow intensity**: `taskGlow` animation peaks at `0 0 40px oklch(72% 0.2 30 / 0.4)` (40% opacity) — too subtle. The "reveal moment" needs 60%+ opacity at peak.
- **Wheel glow**: TaskCard.tsx line 69: `rgba(232,83,42,0.35)` box-shadow on the wheel — present but dim. The 0.35 opacity glow barely registers.
- **Checkbox as primary action**: A 32×32px visual checkbox centered in a card is the dopamine delivery mechanism. It reads as form-field, not win-state button. Touch target is 52px (meets minimum) but visual affordance is weak.
- **"THE WHEEL CHOSE" label**: `color: var(--color-ink-muted)` = `oklch(60% 0.02 260)` on surface `oklch(18% 0.025 260)`. Technically passes AA (~6:1) but feels nearly invisible as uppercase tiny text. Uppercase tracking compound weakens it further.
- **Task text size**: `1.25rem` / 700 weight — the hero moment of the screen. Should be bigger. The DESIGN.md specifies task-card gets XL treatment.
- **"Got it? Check it off!"**: `0.8125rem` + ink-muted — very small and muted for what is meant to drive the user's key action.
- **Mixed alignment inside card**: label and title are left-aligned; "Got it?" and checkbox are center-aligned. Creates visual inconsistency.

---

### 8. AllDoneScreen — `all-done-mobile.png`

**Emotional impression:** The screenshot shows only confetti on black with zero UI elements visible. This is because the `motion.div` wrapping the headline has `delay: 1.0` and the button wrapper has `delay: 1.5`. The screenshot was captured before these delays resolved, giving the impression of a broken screen.

**What works (in motion):** Confetti is multicolor and varied in shape. Star emoji entrance with spring animation is appropriate. Copy is on-brand ("Not bad for a brain that wasn't sure where to start.").

**Issues:**
- **Animation delays too long**: 1.0s delay on headline, 1.5s on button — creates a 1.5 second black-screen-plus-confetti state that looks like an error. Reduce to 0.3s / 0.5s.
- **Confetti count 150 is insufficient**: For the climactic screen of an ADHD dopamine tool, 150 particles is thin. Needs 300+, plus a wider spread.
- **Confetti concentrated in upper third**: `origin: { x: 0.5, y: 0.4 }` launches from too high. Bottom 60% of screen remains empty. Add a second burst at `y: 0.6` immediately.
- **Headline size `1.5rem`**: For the "you did it!" moment of a dopamine app, this is visually undersized. Should be `clamp(1.75rem, 5vw, 2.25rem)`.
- **Star emoji `fontSize: '4rem'`**: Emoji at 4rem renders inconsistently across platforms. Consider adding a golden glow underneath via a `text-shadow` or a radial gradient behind it.
- **Button label "Spin again tomorrow →"**: Good sentiment but the arrow feels clunky as a text character. Minor.

---

### 9. EditModal — `edit-modal-mobile.png`

**Emotional impression:** Functional. The bottom sheet pattern is correct UX. The wheel + task list coexistence in the same scroll view is visually cohesive.

**What works:** Drag handle, "Edit your tasks" heading, task card layout consistent with ListEditScreen.

**Issues:**
- **Badge in wheel screen header**: Same badge contrast issue as main WheelScreen.
- **Icon buttons in modal task list**: Same 18px icon in 44px target — touch target is fine but the icon appears tiny.

---

### 10. PostCompletion Wheel — `wheel-after-complete-2tasks.png`

**Emotional impression:** Confetti fires (correct!) but the 2-segment wheel looks like a coin flip, not a prize wheel. Energy collapses as tasks are completed.

**What works:** Confetti on task complete is correct. Task disappears from wheel = visible progress metaphor.

**Issues:**
- **Confetti fires on individual task completion** (TaskCard.tsx fireConfetti) AND on all-done (AllDoneScreen). The wheel-after-complete screenshot shows confetti with 2 tasks remaining — this may be confusing "task done" celebration with "all done" celebration.
- **2-segment wheel**: 180° per segment. Text font size doesn't scale up — labels are far from center in enormous segments. Dynamic font scaling would help.
- **"2/15 tasks" badge**: Ambiguous framing — "2/15" could mean "2 remaining" or "2 done."

---

## Priority Fix List — Exact File + Line Changes

### 🔴 P0 — Bugs and Showstoppers

---

**FIX 1: Wheel text rotation boundary bug (upside-down labels)**
- **File:** `src/components/WheelCanvas.tsx`
- **Line 129**

```typescript
// BEFORE
const isBottomHalf = normSC > Math.PI / 2 && normSC < (3 * Math.PI / 2)

// AFTER — use >= and <= to catch exact boundary angles
const isBottomHalf = normSC >= Math.PI / 2 && normSC <= (3 * Math.PI / 2)
```

---

**FIX 2: Notch pointer is too small (12×14px → 20×22px) and needs a dark outline for visibility**
- **File:** `src/components/WheelCanvas.tsx`
- **Lines 161-175** — replace the notch block:

```typescript
// BEFORE
const notchX = cx
const notchY = 6
const notchW = 12
const notchH = 14
ctx.save()
ctx.beginPath()
ctx.moveTo(notchX - notchW / 2, notchY)
ctx.lineTo(notchX + notchW / 2, notchY)
ctx.lineTo(notchX, notchY + notchH)
ctx.closePath()
ctx.fillStyle = '#ffffff'
ctx.shadowBlur = 6
ctx.shadowColor = 'rgba(255,255,255,0.8)'
ctx.fill()
ctx.restore()

// AFTER — larger, positioned at wheel edge, with dark outline + glow
const notchW = 20
const notchH = 22
const notchX = cx
const notchY = cy - radius - notchH - 2  // sits just above wheel rim
ctx.save()
ctx.beginPath()
ctx.moveTo(notchX - notchW / 2, notchY)
ctx.lineTo(notchX + notchW / 2, notchY)
ctx.lineTo(notchX, notchY + notchH)
ctx.closePath()
// Dark outline first
ctx.fillStyle = 'rgba(0,0,0,0.5)'
ctx.shadowBlur = 0
ctx.fill()
// White fill on top
ctx.beginPath()
ctx.moveTo(notchX - notchW / 2 + 2, notchY + 2)
ctx.lineTo(notchX + notchW / 2 - 2, notchY + 2)
ctx.lineTo(notchX, notchY + notchH - 2)
ctx.closePath()
ctx.fillStyle = '#ffffff'
ctx.shadowBlur = 8
ctx.shadowColor = 'rgba(255,120,60,0.9)'
ctx.fill()
ctx.restore()
```

---

**FIX 3: All-done screen — animation delays too long, confetti too sparse**
- **File:** `src/components/AllDoneScreen.tsx`

**Lines 24-46** — improve confetti:
```typescript
// BEFORE
confetti({
  particleCount: 150,
  spread: 80,
  origin: { x: 0.5, y: 0.4 },
  ...
})
const timer = setTimeout(() => {
  confetti({ particleCount: 60, spread: 50, origin: { x: 0.3, y: 0.5 } })
  confetti({ particleCount: 60, spread: 50, origin: { x: 0.7, y: 0.5 } })
}, 400)

// AFTER
confetti({
  particleCount: 220,
  spread: 100,
  origin: { x: 0.5, y: 0.55 },
  colors: ['#E8532A', '#D4891A', '#8DB822', '#2BA84A', '#2563EB', '#7C3AED', '#DB2777', '#FFD700', '#ffffff'],
  scalar: 1.1,
})
const timer = setTimeout(() => {
  confetti({ particleCount: 100, spread: 70, origin: { x: 0.25, y: 0.65 }, angle: 60 })
  confetti({ particleCount: 100, spread: 70, origin: { x: 0.75, y: 0.65 }, angle: 120 })
}, 350)
const timer2 = setTimeout(() => {
  confetti({ particleCount: 80, spread: 120, origin: { x: 0.5, y: 0.3 }, gravity: 0.5 })
}, 700)
return () => { clearTimeout(timer); clearTimeout(timer2) }
```

**Lines 77-79** — reduce motion delays:
```typescript
// BEFORE
transition={{ delay: 1, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}

// AFTER
transition={{ delay: 0.25, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
```

**Lines 111-113** — reduce button delay:
```typescript
// BEFORE
transition={{ delay: 1.5, duration: 0.45, ease: [0.16, 1, 0.3, 1] }}

// AFTER
transition={{ delay: 0.5, duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
```

**Line 84** — make headline bigger (it's the emotional climax):
```typescript
// BEFORE
fontSize: '1.5rem',

// AFTER
fontSize: 'clamp(1.75rem, 5vw, 2.25rem)',
```

---

**FIX 4: Disabled button on DumpScreen is nearly invisible**
- **File:** `src/components/DumpScreen.tsx`
- **Lines 142-144**

```typescript
// BEFORE
background: isEmpty ? 'oklch(22% 0.025 260)' : 'var(--color-accent)',
color: isEmpty ? 'oklch(40% 0.02 260)' : 'oklch(10% 0.01 30)',
border: isEmpty ? '1.5px solid oklch(30% 0.025 260)' : '1.5px solid transparent',

// AFTER — use a visible-but-subdued disabled state with sufficient contrast
background: isEmpty ? 'oklch(20% 0.02 260)' : 'var(--color-accent)',
color: isEmpty ? 'oklch(55% 0.02 260)' : 'oklch(10% 0.01 30)',
border: isEmpty ? '1.5px solid oklch(32% 0.025 260)' : '1.5px solid transparent',
```
_`oklch(55% 0.02 260)` on `oklch(20% 0.02 260)` → ~4.8:1, passes AA._

---

### 🟠 P1 — High Impact Visual Fixes

---

**FIX 5: Wheel hex colors are too desaturated — amber and yellow-green most critical**
- **File:** `src/components/WheelCanvas.tsx`
- **Lines 6-15** — replace the WHEEL_COLORS_HEX array with more vibrant, accurate conversions:

```typescript
// BEFORE
export const WHEEL_COLORS_HEX = [
  '#E8532A', // oklch(72% 0.2 30)
  '#D4891A', // oklch(78% 0.18 60)  ← too muddy
  '#8DB822', // oklch(82% 0.16 100) ← olive/muddy
  '#2BA84A', // oklch(75% 0.2 145)
  '#0F9B8E', // oklch(70% 0.22 200)
  '#2563EB', // oklch(68% 0.24 260)
  '#7C3AED', // oklch(72% 0.22 300)
  '#DB2777', // oklch(76% 0.2 340)
]

// AFTER — more vibrant, higher-chroma conversions
export const WHEEL_COLORS_HEX = [
  '#F05A22', // oklch(72% 0.2 30)  — punchy orange-red
  '#E09B00', // oklch(78% 0.18 60) — bright amber (was muddy brown)
  '#82C900', // oklch(82% 0.16 100) — vivid lime (was olive)
  '#1EAA4A', // oklch(75% 0.2 145) — fresh green
  '#00A89A', // oklch(70% 0.22 200) — clear teal
  '#1D6AFF', // oklch(68% 0.24 260) — bright blue
  '#7B2FE0', // oklch(72% 0.22 300) — vibrant purple
  '#E01B7A', // oklch(76% 0.2 340) — vivid pink
]
```

Also update WHEEL_COLORS_BRIGHT to match:
```typescript
// BEFORE (lines 18-27)
const WHEEL_COLORS_BRIGHT: { [key: string]: string } = {
  '#E8532A': '#FF7348',
  '#D4891A': '#F5A830',
  '#8DB822': '#AADE30',
  '#2BA84A': '#35CC5A',
  '#0F9B8E': '#14BFAF',
  '#2563EB': '#4A7FFF',
  '#7C3AED': '#9B5FFF',
  '#DB2777': '#FF3D90',
}

// AFTER — map new base colors to their bright variants
const WHEEL_COLORS_BRIGHT: { [key: string]: string } = {
  '#F05A22': '#FF7A40',
  '#E09B00': '#FFBC20',
  '#82C900': '#AAED20',
  '#1EAA4A': '#28D060',
  '#00A89A': '#10D0C0',
  '#1D6AFF': '#4A88FF',
  '#7B2FE0': '#9B52FF',
  '#E01B7A': '#FF3E96',
}
```

---

**FIX 6: White text on bright wheel segments fails contrast — use dark text on light segments**
- **File:** `src/components/WheelCanvas.tsx`
- **Lines 131-132** — make text color adaptive per segment lightness:

```typescript
// BEFORE
ctx.font = 'bold 13px Inter, system-ui, sans-serif'
ctx.fillStyle = 'rgba(255,255,255,0.92)'

// AFTER — use dark text on light segments (amber, lime, green)
const lightSegments = new Set(['#E09B00', '#82C900', '#1EAA4A'])
const isDarkText = lightSegments.has(color)
ctx.font = 'bold 13px Inter, system-ui, sans-serif'
ctx.fillStyle = isDarkText ? 'rgba(10,10,10,0.9)' : 'rgba(255,255,255,0.95)'
ctx.shadowColor = isDarkText ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.7)'
```

---

**FIX 7: Wheel outer ring and slice dividers too faint**
- **File:** `src/components/WheelCanvas.tsx`
- **Line 107** — outer ring:
```typescript
// BEFORE
ctx.strokeStyle = 'rgba(255,255,255,0.15)'
ctx.lineWidth = 2

// AFTER
ctx.strokeStyle = 'rgba(255,255,255,0.35)'
ctx.lineWidth = 2.5
```

- **Line 153** — slice dividers:
```typescript
// BEFORE
ctx.strokeStyle = 'rgba(0,0,0,0.25)'
ctx.lineWidth = 1.5

// AFTER
ctx.strokeStyle = 'rgba(0,0,0,0.45)'
ctx.lineWidth = 2
```

---

**FIX 8: Task card glow needs more intensity at peak for dopamine moment**
- **File:** `src/index.css`
- **Lines 59-72** — strengthen the glow animation:

```css
/* BEFORE */
@keyframes taskGlow {
  0%, 100% {
    box-shadow:
      0 0 0 2px oklch(72% 0.2 30 / 0.4),
      0 0 24px oklch(72% 0.2 30 / 0.2),
      0 4px 24px rgba(0,0,0,0.4);
  }
  50% {
    box-shadow:
      0 0 0 3px oklch(72% 0.2 30 / 0.7),
      0 0 40px oklch(72% 0.2 30 / 0.4),
      0 4px 24px rgba(0,0,0,0.4);
  }
}

/* AFTER — more pronounced glow at peak */
@keyframes taskGlow {
  0%, 100% {
    box-shadow:
      0 0 0 2px oklch(72% 0.2 30 / 0.5),
      0 0 32px oklch(72% 0.2 30 / 0.3),
      0 4px 32px rgba(0,0,0,0.5);
  }
  50% {
    box-shadow:
      0 0 0 3px oklch(72% 0.2 30 / 0.85),
      0 0 56px oklch(72% 0.2 30 / 0.55),
      0 0 80px oklch(72% 0.2 30 / 0.25),
      0 4px 24px rgba(0,0,0,0.4);
  }
}
```

---

**FIX 9: Wheel glow on TaskCard needs amplification**
- **File:** `src/components/TaskCard.tsx`
- **Line 69**

```typescript
// BEFORE
boxShadow: '0 0 40px rgba(232,83,42,0.35), 0 0 0 2px rgba(232,83,42,0.5)',

// AFTER — two-layer warm glow, tighter inner + wider ambient
boxShadow: '0 0 0 3px rgba(240,90,34,0.7), 0 0 50px rgba(240,90,34,0.45), 0 0 90px rgba(240,90,34,0.2)',
```

Also: WheelScreen.tsx line 273-274 (wheel glow on result):
```typescript
// BEFORE
? '0 0 40px rgba(232,83,42,0.3), 0 0 0 2px rgba(232,83,42,0.4)'

// AFTER
? '0 0 0 3px rgba(240,90,34,0.65), 0 0 55px rgba(240,90,34,0.4), 0 0 80px rgba(240,90,34,0.2)'
```

---

**FIX 10: Spinning button — 50% opacity makes "Spinning…" nearly unreadable**
- **File:** `src/components/WheelScreen.tsx`
- **Line 330**

```typescript
// BEFORE
opacity: isSpinning ? 0.5 : 1,

// AFTER — opacity only on the non-spinning state elements, text stays readable
opacity: 1,
```

And adjust the disabled color to communicate state without opacity:
- **Lines 319-320**:
```typescript
// BEFORE
background: isSpinning || tasks.length === 0 ? 'var(--color-surface2)' : 'var(--color-accent)',
color: isSpinning || tasks.length === 0 ? 'var(--color-ink-muted)' : 'oklch(10% 0.01 30)',

// AFTER — slightly brighter muted for spinning state
background: isSpinning || tasks.length === 0 ? 'oklch(24% 0.03 260)' : 'var(--color-accent)',
color: isSpinning || tasks.length === 0 ? 'oklch(68% 0.02 260)' : 'oklch(10% 0.01 30)',
```
_`oklch(68% 0.02 260)` on `oklch(24% 0.03 260)` → ~6.5:1. Clearly readable._

---

**FIX 11: Skeleton bar visibility too low**
- **File:** `src/components/ParsingScreen.tsx`
- **Line 91** — raise bar base color:
```typescript
// BEFORE
background: 'oklch(30% 0.03 260)',

// AFTER
background: 'oklch(38% 0.04 260)',
```

- **Lines 104-106** — widen shimmer contrast range:
```typescript
// BEFORE
background:
  'linear-gradient(90deg, transparent 0%, oklch(55% 0.03 260 / 0.7) 50%, transparent 100%)',

// AFTER
background:
  'linear-gradient(90deg, transparent 0%, oklch(72% 0.04 260 / 0.65) 40%, oklch(80% 0.03 260 / 0.8) 50%, oklch(72% 0.04 260 / 0.65) 60%, transparent 100%)',
```

---

**FIX 12: "Sorting through the chaos.." typographic error — double period**
- **File:** `src/components/ParsingScreen.tsx`
- **Line 5**:
```typescript
// BEFORE
'Sorting through the chaos..',

// AFTER
'Sorting through the chaos\u2026',
```
_(U+2026 = proper ellipsis character)_

---

### 🟡 P2 — Polish and Experience

---

**FIX 13: Task card action — "Got it? Check it off!" needs to be more prominent**
- **File:** `src/components/TaskCard.tsx`
- **Lines 125-134** — raise font size and color of the instruction:

```typescript
// BEFORE
style={{
  fontSize: '0.8125rem',
  color: 'var(--color-ink-muted)',
  marginBottom: 12,
  textAlign: 'center',
}}

// AFTER
style={{
  fontSize: '0.9375rem',
  color: 'var(--color-ink)',
  marginBottom: 16,
  textAlign: 'center',
  fontWeight: 500,
}}
```

**Line 112-118** — raise task title size on the card (this is the reveal moment):
```typescript
// BEFORE
fontSize: '1.25rem',
fontWeight: 700,

// AFTER
fontSize: 'clamp(1.375rem, 4vw, 1.625rem)',
fontWeight: 700,
```

---

**FIX 14: Badge coloring — reads as error/warning rather than progress**

The badge at WheelScreen.tsx line 227 and ListEditScreen.tsx line 97 both use dark red-brown backgrounds that read as "alert." For normal state, use the surface2 color with accent text (which the ListEditScreen already does correctly for non-warning state). For WheelScreen:

- **File:** `src/components/WheelScreen.tsx`
- **Lines 226-228**:
```typescript
// BEFORE
background: 'oklch(20% 0.05 30)',
color: 'var(--color-accent)',
border: '1px solid oklch(35% 0.1 30)',

// AFTER — less alarming, same brand color
background: 'var(--color-surface2)',
color: 'var(--color-accent)',
border: '1px solid oklch(35% 0.08 30)',
```

---

**FIX 15: All-done screen — center hub upgrade for WheelCanvas (dopamine wheel polish)**
- **File:** `src/components/WheelCanvas.tsx`
- **Lines 177-186** — replace flat dark hub with accent-ringed hub:

```typescript
// BEFORE
ctx.fillStyle = '#1a1a24'
ctx.fill()
ctx.strokeStyle = 'rgba(255,255,255,0.25)'
ctx.lineWidth = 2
ctx.stroke()

// AFTER
ctx.fillStyle = '#0f1020'
ctx.fill()
// Inner accent ring
ctx.strokeStyle = 'rgba(240,90,34,0.5)'
ctx.lineWidth = 2.5
ctx.stroke()
// Outer dim ring
ctx.beginPath()
ctx.arc(cx, cy, 22, 0, TAU)
ctx.strokeStyle = 'rgba(255,255,255,0.1)'
ctx.lineWidth = 1
ctx.stroke()
```

---

**FIX 16: AllDoneScreen button label — minor copy polish**
- **File:** `src/components/AllDoneScreen.tsx`
- **Line 133**:
```typescript
// BEFORE
Spin again tomorrow →

// AFTER
Start fresh →
```
_"Spin again tomorrow" implies the app should only be used daily. Users may want to spin again right now._

---

## Contrast Verification Summary

| Element | Token / Value | Background | Ratio | AA? |
|---|---|---|---|---|
| Ink on base | `oklch(95% 0.01 260)` | `oklch(12% 0.02 260)` | ~18:1 | ✅ |
| Ink on surface | `oklch(95% 0.01 260)` | `oklch(18% 0.025 260)` | ~14:1 | ✅ |
| Ink-muted on base | `oklch(60% 0.02 260)` | `oklch(12% 0.02 260)` | ~6.2:1 | ✅ |
| Ink-muted on surface | `oklch(60% 0.02 260)` | `oklch(18% 0.025 260)` | ~5.0:1 | ✅ |
| Accent text on base | `oklch(72% 0.2 30)` | `oklch(12% 0.02 260)` | ~7.5:1 | ✅ |
| CTA text on accent | `oklch(10% 0.01 30)` | `oklch(72% 0.2 30)` | ~5.3:1 | ✅ |
| Disabled btn (FIXED) | `oklch(55% 0.02 260)` | `oklch(20% 0.02 260)` | ~4.8:1 | ✅ |
| Spinning btn (FIXED) | `oklch(68% 0.02 260)` | `oklch(24% 0.03 260)` | ~6.5:1 | ✅ |
| Wheel white on lime `#82C900` | `rgba(255,255,255)` | `#82C900` | ~2.1:1 | ❌ → use dark text (FIX 6) |
| Wheel white on amber `#E09B00` | `rgba(255,255,255)` | `#E09B00` | ~2.5:1 | ❌ → use dark text (FIX 6) |
| Icon buttons | `oklch(65% 0.02 260)` | `oklch(18% 0.025 260)` | ~6:1 | ✅ |

---

## What Is NOT Wrong (No Action Needed)

- ✅ No gradient text anywhere in the codebase
- ✅ No `backdrop-filter` glassmorphism used
- ✅ No cream/beige/warm-sand backgrounds
- ✅ No side-stripe borders
- ✅ Touch targets on all interactive elements meet 44px minimum (icon buttons: 44×44, CTA: 60px height, checkbox button: 52px hit area)
- ✅ `resize: none` on textarea (correctly set)
- ✅ `prefers-reduced-motion` media query in index.css (lines 74-80)
- ✅ `text-wrap: balance` on DumpScreen heading
- ✅ `aria-label` on all buttons
- ✅ Inter throughout, no competing typefaces
- ✅ OKLCH for all design token colors
- ✅ Expo-out easing (`[0.16, 1, 0.3, 1]`) used consistently — matches DESIGN.md spec
- ✅ Single-column layout — no sidebars, no grid clutter
- ✅ `AnimatePresence` for list exit animations
- ✅ Spring physics on wheel (useWheelPhysics)
- ✅ Audio tick on slice crossings

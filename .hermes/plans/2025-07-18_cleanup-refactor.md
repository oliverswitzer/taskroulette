# Plan: Codebase Cleanup & Refactor

**Goal:** PR with more deletions than additions. Remove dead code, untracked artifacts, duplicate files, and DRY up repetitive patterns. Research-backed decision on whether to swap hand-rolled code for libraries.

---

## Phase 0: Spikes (separate branch `spike/library-eval`, no merging until go/no-go)

Two library candidates need hands-on spikes before any decision. Each spike:
1. Uses context7 to pull real API docs first
2. Implements the replacement in isolation (no tests, throwaway)
3. Takes a Playwright screenshot or terminal output as evidence
4. Produces a written go/no-go recommendation with diff stats

### Spike A — `use-sound` for MP3 playback

**Hypothesis:** Our 3 MP3 functions (`playCompletionDing`, `playWheelLands`, `playCrowdApplause`) are structurally identical. `use-sound` (backed by Howler.js) could replace the fetch-decode-cache-play pipeline.

**The open question we need to answer:** Does Howler.js work with our iOS MediaStream → `<audio>` routing? Specifically:
- Can Howler play into an existing AudioContext that has a `MediaStreamAudioDestinationNode` as its output?
- If not, does using `<audio src="file.mp3">` (the Howler default) hit the iOS media channel natively without needing the MediaStream trick at all?

**Spike steps:**
1. `npm install use-sound`
2. Research via context7: look up `use-sound` and Howler.js API — `Howl` constructor options, `onplay`, `onstop`, sprite support, AudioContext injection
3. Attempt to replace `playCompletionDing` only with a `useSound` hook call in WheelScreen
4. Test on iOS via Tailscale (mute switch on and off)
5. Measure: net LOC change in audio.ts + App.tsx chain

**Go criteria:** Works on iOS (media channel, not ringer), net deletion of ≥15 lines, no new complexity.
**No-go criteria:** Requires custom Howler AudioContext injection that's more complex than what we have, OR breaks iOS audio channel routing.

---

### Spike B — framer-motion `animate()` for wheel physics

**Hypothesis:** framer-motion is already in the bundle. Its `animate()` function + `inertia` type has built-in deceleration physics. Could replace our hand-rolled RAF loop in `useWheelPhysics.ts` (170 lines → potentially much less).

**The open question:** Can we get a per-frame callback as the angle value changes, so we can fire tick sounds at peg crossings? framer-motion's `animate()` returns a `PlaybackControls` object and can take an `onUpdate` callback — but is the granularity fine enough for 18ms tick intervals?

**Spike steps:**
1. Research via context7: look up framer-motion `animate()` — `inertia` type, `onUpdate`, `onComplete`, `restDelta`, `power`, `timeConstant`, `modifyTarget`
2. In a throwaway `SpikePhy.tsx` component, wire up `animate()` with `type: 'inertia'` and log `onUpdate` call frequency during a spin
3. Check: does it fire at ~60fps? Can we cancel it mid-spin? Can we control min/max duration?
4. Verify winner calculation: our `calculateWinner(angle, sliceCount)` needs to keep working
5. Measure: net LOC change in `useWheelPhysics.ts`

**Go criteria:** `onUpdate` fires at ≥50fps, decel feels natural (matches prize wheel physics), net deletion of ≥40 lines from `useWheelPhysics.ts`, tick firing still works at correct intervals.
**No-go criteria:** `onUpdate` too coarse for tick sync, can't control max duration cap (our 5s MAX_SPIN_MS), or framer-motion's inertia curve feels wrong (too springy / doesn't read as wheel).

---

### After Both Spikes: Go/No-Go Session

Present findings to Oliver:
- Diff stats for each (LOC saved, complexity gained/lost)
- Screenshot or terminal evidence
- Explicit recommendation: merge, skip, or partially adopt

Only after approval: merge any adopted spikes into `cleanup/main-pr` branch.

---

## Phase 1: Safe Deletions (no go/no-go needed — pure cleanup)

These don't require any research, just execution.

### 1.1 Delete dead stub
- `src/hooks/useAudioTick.ts` — 3 lines returning `{ tick: () => {} }`. Real tick is in `audio.ts`. Never meaningfully used.

### 1.2 Migrate salvageable debug specs to `scripts/debug/`
Move and lightly clean up these three — do NOT delete them:
- `tests/e2e/audio-diagnostic.spec.ts` → `scripts/debug/audio-diagnostic.spec.ts`
  - What it does: patches `AudioContext` to spy on every `BufferSourceNode.start()` call, logs phase + timing. Invaluable for audio regressions.
- `tests/e2e/wheel-screenshots.spec.ts` → `scripts/debug/wheel-screenshots.spec.ts`
  - What it does: seeds 3/6/10/15-task localStorage states, captures a screenshot of the wheel at each. Run when touching WheelCanvas.
- `tests/e2e/alldone-screenshot.spec.ts` → `scripts/debug/alldone-screenshot.spec.ts`
  - What it does: seeds 1-task TASK_CARD, triggers confetti burst, captures mid-burst + AllDone screen.

Add `scripts/debug/README.md`:
```
Debug specs — NOT CI. Run manually when investigating specific areas:
  npx playwright test scripts/debug/audio-diagnostic.spec.ts --project=mobile
  npx playwright test scripts/debug/wheel-screenshots.spec.ts --project=mobile
  npx playwright test scripts/debug/alldone-screenshot.spec.ts --project=mobile

Output saved to scripts/debug/output/
```

### 1.3 Delete dead ad-hoc scripts
- `tests/e2e/screenshot.cjs` — thin wrapper, superseded
- `tests/e2e/screenshot.ts` — same
- `tests/e2e/edge-cases.mjs` — old scenario runner, superseded by CI specs
- `tests/edge-cases.mjs` — duplicate at wrong dir level
- `tests/edge-cases-v2.mjs` — v2 of same
- `tests/debug-fails.mjs` — one-off CI debug harness

### 1.4 Delete obsolete configs and template artifacts
- `playwright.vercel.config.ts` — Vercel target with hardcoded Basic Auth (auth removed, CI uses local dev server)
- `src/assets/react.svg` — Vite template default, never imported
- `src/assets/vite.svg` — same

### 1.5 Delete duplicate shadcn artifact
- Root `@/` directory — shadcn init created `@/components/ui/dialog.tsx` at the wrong path. Nothing in `src/` imports from root `@/` (grep confirmed). Real file is at `src/components/ui/dialog.tsx`.

### 1.6 Untrack binary artifacts (git rm --cached + .gitignore)
Files to untrack (keep locally but remove from git):
- `clawlivers-mac-mini.tail60e2f.ts.net.crt` and `.key` — TLS certs, should never be versioned
- `dump-empty-mobile-v2.png`, `dump-filled-mobile-v2.png`, `list-3tasks-mobile-v2.png`, `parsing-mobile-v2.png` — root-level screenshot artifacts, just delete
- `tests/e2e/screenshots/*.png` — ~40 committed PNGs; add glob to .gitignore, `git rm --cached`, keep `.gitkeep`

.gitignore additions:
```
# TLS certs
*.crt
*.key

# Screenshot artifacts
tests/e2e/screenshots/*.png
scripts/debug/output/
*.png
!public/**/*.png
```

---

## Phase 2: DRY Refactors

### Refactor A — audio.ts: extract `_playSample()`
**Only if Spike A is NO-GO.** If use-sound wins, this is moot.

The three play functions are copy-pasted 8-line blocks:
```ts
// Before (x3):
export function playCompletionDing(): void {
  _init()
  if (!audioCtx) return
  audioCtx.resume().catch(() => {})
  if (audioEl) audioEl.play().then(() => { audioElReady = true }).catch(() => {})
  _getBuffer('/audio/task-complete.mp3', 'complete').then(buf => {
    if (buf) _playBuffer(buf, 1.0)
    _scheduleSuspend(2500)
  })
}

// After (x3):
export const playCompletionDing = () => _playSample('/audio/task-complete.mp3', 'complete', 1.0, 2500)
export const playWheelLands     = () => _playSample('/audio/wheel-lands.mp3',   'lands',   0.85, 2500)
export const playCrowdApplause  = () => _playSample('/audio/crowd-applause.mp3', 'crowd',  1.0, 11000)
```

Net: -~20 lines.

### Refactor B — server.ts: extract `extractTasks()`
Both `/api/parse` and `/api/parse-image` do identical post-processing:
```ts
const rawText = content.text.replace(/^```[a-z]*\n?/im, '').replace(/\n?```$/m, '').trim()
const tasks = JSON.parse(rawText) as string[]
return c.json({ tasks: tasks.slice(0, 15) })
```

Extract to a shared `function extractTasks(text: string): string[]`. Net: -~8 lines.

### Refactor C — App.tsx: extract `useHistoryNav()`
The `pushState`/`popstate` back-button wiring is ~40 lines inside App.tsx. Extract to `src/hooks/useHistoryNav.ts`:
```ts
export function useHistoryNav(appState: AppState, onBack: (from: AppState) => void): void
```
Makes App.tsx cleaner and the nav logic independently unit-testable. Net: 0 LOC change but cleaner separation.

---

## PR Structure (incremental commits)

| # | Commit | Files | Expected delta |
|---|---|---|---|
| 1 | `chore: delete dead stub useAudioTick` | rm `src/hooks/useAudioTick.ts` | -3 lines |
| 2 | `chore: migrate debug specs to scripts/debug/` | mv 3 specs + add README | ~0 net |
| 3 | `chore: delete dead ad-hoc test scripts` | rm 6 files | -~200 lines |
| 4 | `chore: remove obsolete configs and template artifacts` | rm 4 files + root @/ dir | -~150 lines |
| 5 | `chore: untrack binary artifacts, update .gitignore` | .gitignore + git rm --cached | -40 files |
| 6 | `refactor: DRY audio.ts with _playSample helper` | `src/audio.ts` | -~20 lines |
| 7 | `refactor: DRY server.ts parse response handling` | `server.ts` | -~8 lines |
| 8 | `refactor: extract useHistoryNav hook from App.tsx` | new hook + App.tsx | ~0 net |
| + | `feat: adopt use-sound` (if Spike A ✅) | audio.ts + components | -~50 lines |
| + | `feat: adopt framer-motion inertia physics` (if Spike B ✅) | useWheelPhysics.ts | -~80 lines |

---

## What We're NOT Doing
- Not rewriting WheelCanvas.tsx (complex but correct, 359 lines of intentional rendering)
- Not splitting App.tsx into sub-pages (too risky without clear seams)
- Not adding XState (overkill for 6 states)
- Not touching DESIGN.md / PRODUCT.md / docs/adrs (valuable, keep)
- No full git history rewrite (git rm --cached is sufficient — no large binary files worth the force-push disruption)

---

## Validation (every commit)
```
npm run typecheck && npm run lint && npm run test && npx playwright test --project=mobile
```

---

## Files Summary
```
DELETE:
  src/hooks/useAudioTick.ts
  tests/e2e/alldone-screenshot.spec.ts    → moved to scripts/debug/
  tests/e2e/audio-diagnostic.spec.ts      → moved to scripts/debug/
  tests/e2e/wheel-screenshot.spec.ts      → moved to scripts/debug/
  tests/e2e/screenshot.cjs
  tests/e2e/screenshot.ts
  tests/e2e/edge-cases.mjs
  tests/edge-cases.mjs
  tests/edge-cases-v2.mjs
  tests/debug-fails.mjs
  playwright.vercel.config.ts
  src/assets/react.svg
  src/assets/vite.svg
  @/ (entire root directory)
  dump-*.png (at root)
  *.crt, *.key

UNTRACK (git rm --cached):
  tests/e2e/screenshots/*.png (~40 files)

MODIFY:
  .gitignore
  src/audio.ts
  server.ts
  src/App.tsx

ADD:
  scripts/debug/README.md
  scripts/debug/audio-diagnostic.spec.ts
  scripts/debug/wheel-screenshots.spec.ts
  scripts/debug/alldone-screenshot.spec.ts
  scripts/debug/output/.gitkeep
  src/hooks/useHistoryNav.ts
```

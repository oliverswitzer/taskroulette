# Debug Specs

Manual debug tools — NOT part of CI. Run when investigating specific areas.

## Usage

```bash
npx playwright test scripts/debug/audio-diagnostic.spec.ts --project=mobile
npx playwright test scripts/debug/wheel-screenshots.spec.ts --project=mobile
npx playwright test scripts/debug/alldone-screenshot.spec.ts --project=mobile
```

Output screenshots saved to `scripts/debug/output/`

## When to use each

- **audio-diagnostic**: Hear ghost echoes or unexpected sounds? Patches `AudioContext` to log every `BufferSourceNode.start()` with phase + timing. Invaluable for audio regression hunting.
- **wheel-screenshots**: Touched `WheelCanvas`? Sanity-check label truncation + slice sizing at 3/6/10/15 tasks.
- **alldone-screenshot**: Touched the completion animation or AllDone screen? Captures the confetti burst mid-frame + AllDone render.

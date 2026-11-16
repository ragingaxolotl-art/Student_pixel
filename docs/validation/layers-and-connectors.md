# Layers, rig connectors and panel sizing

Validation on 2026-11-16: build and lint pass; 555 unit tests pass. The website browser suite contains 38 synthetic cases plus one optional private-character case. All 39 distinct cases passed locally across audited runs, including the private tester. The final six affected resize/save/import checks passed after correcting a grip overlap with the Save drawer.

The suite checks every one of the 273 dither patterns against actual brush pixels and thumbnails at 1, 2 and 4 pixel scales, picker keyboard/scroll behavior and preference persistence. It also verifies stationary workspace/layer scrolling, native group reordering/nesting, whole-group duplication, independent copied IDs, rig connector placement, body/limb motion, undoable Clear joints, hinge/flexible splits and generated-frame parity.

All nine resize controls are exercised by pointer gestures. Layer height grows independently of the frame strip. Resizing still works after Preview, Tools and Layers move to the opposite side or above the canvas. Saved panel placement, full-storage recovery, original rotation, per-pose locks, pinned FX preview and Particle Studio remain covered.

The optional private fixture checks all source layer hashes, IDs, parents and stack order when assigning a leg to a bone. The rest-pose render matches the original artwork. Personal artwork and test screenshots are excluded from this repository and production output.

```sh
npm run lint
npm run build
npm run unit-tests
npm run test:pages
# Optional local character regression; never commit the private file:
PISKEL_TESTER_FILE=/path/to/tester.piskel npm run test:pages
```

Chrome binary overrides are available through CHROME_BIN for unit tests and PAGES_BROWSER_CHANNEL for Playwright.

The title-bar Density control overrides any fixed pattern using the same ordered 4×4 matrix as the FX dithering effect. Its 0–100% range includes empty/solid endpoints; Scale and Colors still apply. Slider keyboard input, painting versus thumbnail parity, mode switching, preference reload and compact-window layout pass. Selecting a pattern restores pattern mode without losing the last density value.

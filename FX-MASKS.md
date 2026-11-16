# Effect-only blends and painted masks

Choose a layer's **FX** button to open its settings. Existing yellow/grey/blue effect dots still toggle and edit saved effects.

## Hide a blend source's artwork

Choose Difference, Multiply, or another color blend, then check **Effect only (hide source artwork)** and Apply. The source's paint changes the artwork layer or group directly below it, including only that target's existing visible pixels. Overhanging source paint disappears, and lower background layers stay unchanged. The target's transparency is preserved. Consecutive effect-only sources affect the same target in order.

Turning the effect dot off also keeps the source artwork hidden. Removing its final blend restores ordinary source artwork. The source pixels remain editable and are never baked into the target.

## Feather an edge

Blend and mask effects have **Feather (pixels)**, from 0 to 32. Zero keeps exact pixel edges. Positive values soften coverage without blurring the painted colors inside the source. Preview changes before Apply; Cancel keeps the saved effect.

## Paint a mask on a layer or group

Select a layer or group, open FX, and choose **Alpha mask / keep overlap**. Use **Create & paint mask** to apply an empty mask and select its new paint layer. Draw to reveal the artwork and erase to hide it. The color picker now includes opacity: opaque paint reveals fully, semi-transparent paint reveals partially. The paint's color does not matter.

To use existing paint instead, choose it in **Mask layer** or use the Above/Below reference. **Hide mask artwork** keeps its own colors out of the result while it controls opacity. **Inverse alpha mask** reverses the coverage. Group masks apply after the nested contents are composited, without editing child pixels; hidden and collapsed groups retain their normal behavior.

Masks, source visibility, feathering, and paint opacity survive `.piskel` saves and undo/redo. A group's own FX button is now usable. A mask source stays enabled for painting even when its artwork is suppressed by the FX.

New group masks live inside their group, so dragging, saving, or duplicating a group keeps its mask with it. A duplicate references its own copied mask. The top **Paint opacity** control can also set partial coverage for brushes and bucket fills, including dithered gradients.

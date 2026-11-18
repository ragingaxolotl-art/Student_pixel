# Asset Library

Open **Asset Library** from the Studios icons. **Save as asset** below the layer stack opens the capture dialog directly. Your artwork becomes reusable, editable assets; no starter art is required.

## Save your artwork

Choose a selection, current layer, layer group, or whole artwork. Choose the current frame or all frames. Captures trim transparent margins using one common crop across the captured animation, preserve selection holes and exact RGBA, and can keep layers editable or merge them. Group hierarchy and internal IDs are copied into the asset rather than linked to the original artwork.

Name the asset, choose a collection and set a placement anchor. Bottom center suits trees and props; center suits clouds. Choose Custom and click the preview for an exact pixel placement point. **Save as new asset** adds an independent asset, even if its name matches another asset. Success is reported only after the IndexedDB transaction commits.

**My library** is shared across projects in this browser on this device. **In this project** shows the asset revisions carried inside the open `.piskel`. **Add to My library** copies a project asset into the reusable device library. Search includes names and collections. Drag the title bar to move the panel and use its bottom-right corner to resize it.

## Place and edit

Select an asset, choose scale, quarter-turn rotation and flip, then **Place on canvas**. A placement ghost follows the cursor. Single places one asset, Repeat lays out copies along a drag at the chosen spacing, and Scatter places the chosen number around a click. Escape ends placement. Each gesture is one undo action.

Each copy is an ordinary independent layer group, selected after placement. The Move tool moves that group's contents; hold Shift to affect all frames, following the editor's existing Move behavior. Expand the group to paint individual layers. A captured animation repeats through the project timeline and respects its original frame rate. Placing it extends the timeline when needed, up to the output budget.

**Edit asset** opens its artwork in the full editor and keeps the original project inside the editing session. Use normal brushes, layers, canvas resizing and animation tools to add detail. **Save as asset → Update saved asset** creates a new immutable library revision; **Save as new asset** creates a separate asset. **Return to project** restores the scene and its timeline/layer selection. If the editing workspace has unsaved artwork changes, returning asks before discarding them. Save the editing session as a `.piskel` if you need to close it before returning; its original project remains embedded.

Existing placements keep their captured revision. Select the updated library asset and choose **Update placed copies** to update untouched copies explicitly in one undo step. Copies that have been painted, renamed, transformed or otherwise changed are kept. Deleting a library entry does not remove the copies embedded in projects.

## Portable saving

Project saves embed every used asset revision once, so reopening the `.piskel` does not require My library. Asset and editing-session metadata participates in backup-change detection. The library itself lives in the separate `PiskelAssetLibrary` IndexedDB database; artwork is not stored in localStorage.

**Download asset** writes a `.piskelasset` with editable layers and animation. **Export library** writes a `.piskelpack` for the currently selected scope, including all assets in that scope. **Import pack** previews the names before an atomic import. Identical revisions are reused; conflicting imports become independent copies. Unsupported versions, damaged PNGs, inconsistent frame layouts and excessive allocations are rejected before importing the batch.

If device saving fails, the capture dialog stays open and **Download asset** still works. Export a pack to transfer the library or retain a copy outside browser storage. Browser/device/origin changes do not sync the library automatically.

Limits: 64 MiB per imported pack, 16 million decoded pixels per asset/pack or generated project, 4096px per side, 256 animation frames, 64 asset layers, and up to 64 placements per gesture. Native project files can include other studios' data; asset capture excludes unrelated project/rig state.

Background Studio's design can use the same `pskl.app.assetLibraryService`; this release adds the shared library and main-editor workflow. A larger offscreen scene/camera workspace is separate from the finite main-editor canvas.

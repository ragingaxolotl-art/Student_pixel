# Tile Studio

Open **Studios → Tile Studio** (the four-tile icon).

## Tiles

Choose a tile resolution from 1–128 pixels in the top bar (8, 16 and 32 are useful starting sizes). Change it at any time: Scale artwork uses nearest-neighbor resampling; Canvas size pads/crops at the top left. It applies to the whole tileset, including all drawing layers, while preserving map links. Undo restores the previous size. Larger resolutions may require fewer map rows/columns to remain within the four-million-pixel output limit. Add a blank tile, slice the current artwork layer/frame or its selection, or import a PNG tileset. PNGs are sliced from the top left; incomplete edge tiles are padded with transparency. Source artwork is preserved.

Paint with Brush, Dither, Erase, Fill, Line, Rectangle or Circle/Ellipse. Shapes support fill, outline or both; Shift constrains circles and squares. Brush size and opacity, primary/secondary colors, palettes and all 273 shared dither patterns are available. Lighten and Darken adjust existing pixels on the selected drawing layer while preserving alpha. Pick samples a color. Wrap edges carries brush strokes over the opposite border. The repeating preview shows seams; Repeat preview changes it from 1×1 up to 9×9. Change the tile name in Properties; Duplicate makes an editable copy. Every map placement refers to its source tile, so source edits update the map.

Each tile starts with four drawing layers: Artwork, Details, Shadows and Highlights. Add up to 16; rename, reorder, show/hide or lock them. Tile thumbnails, seam previews and map placements composite the visible drawing layers. Duplicating a tile preserves its layer stack. Older flat tiles are upgraded automatically when opened.

Select a rectangle to constrain painting, copy, cut or clear pixels on the active tile layer. Copied/cut pixels paste when you click with Brush; Ctrl/Cmd+V returns to paste mode. Escape or Ctrl/Cmd+D clears the selection and paste mode. Ctrl/Cmd+A selects the whole canvas. Delete clears selected pixels. Locks protect edits.

## Map

Select a tile thumbnail and paint the map. Flip and Rotate affect new placements. Pick samples a placement and its transform. Use zoom and the canvas scrollbars to navigate. Fit shows the whole map.

Map layers are listed with the frontmost layer first. Add, rename, reorder, hide or lock them. Painting, cutting, clearing, making unique and deleting respect locks. Maps support up to 128×128 cells and four million output pixels, with up to 16 layers.

Select a rectangular region to copy or cut it, clear it, save a reusable stamp, or make its tiles unique. Copy/Cut enter paste mode: click to place; select a thumbnail or press Escape to leave. Stamps preserve placement transforms; transparent/empty stamp cells leave existing map cells intact. Make unique copies each distinct source tile in the selection once and redirects only the selection to the copies.

Resize preserves the overlapping top-left portion of the map; Undo restores cropped cells. Stamps too large for the new map are removed by resize and restored by Undo.

## Panels and shortcuts

Like Puppet and Particle studios, panels can detach by dragging their Move/resize headers and resize from the lower-right corner. Collapse buttons and panel positions are remembered separately for Tiles and Map on this browser. Reset panels restores the current stage. Tutorials explain seams, map painting and stamps.

B Brush; T Dither; U Lighten; D Darken; E Erase; G Fill; L Line; R Rectangle; C Circle/Ellipse; S Select; I Pick; X swaps colors. Ctrl/Cmd+Z undoes; Ctrl/Cmd+Shift+Z or Ctrl/Cmd+Y redoes. Ctrl/Cmd+C copies the selected map region; Ctrl/Cmd+X cuts it. Right-drag erases. Shortcuts do not interrupt text input.

## Saving and exporting

Edits are saved to the current project's `toolState.tileStudio`. Download a `.piskel` file using the editor's Save panel to keep the entire editable project, including source artwork, tiles, layers, map and stamps. Save to project also explicitly commits the current state. Closing and reopening the studio retains work.

Download project (.piskel) inside Tile Studio saves the entire current project, including the rig, source artwork, tileset, map and tile drawing layers. The main editor’s .piskel download uses the same whole-project serializer. Saving rig settings also preserves Tile Studio data. Export tiles only (JSON) shares the tile workspace without changing the rig in the current project; Map PNG / Tileset PNG export rendered images. The tileset export uses up to eight columns. PNG imports append tiles; JSON imports replace Tile Studio data and are undoable. Invalid JSON is rejected without replacing the current map.

The first release includes static tiles. Automatic terrain rules, animated tiles, tile collections and Scene Studio integration are future work.

## Implementation

This is an original implementation within Student Pixel, using the editor's existing studio panel manager, project cloning/history, serialization, colors and download utilities. Browser tile editors such as victorqribeiro/tileEditor informed the basic tileset-picker/map-painting workflow; no third-party source code or bundled artwork was copied.

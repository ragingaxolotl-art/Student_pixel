# Student_pixel

A browser pixel-art editor based on [Piskel](https://github.com/piskelapp/piskel), with a horizontal frame strip and compact layers along the bottom, nested layer groups, editable layer effects, corrected 45-degree rotation, and Puppet Studio.

**Website:** https://ragingaxolotl-art.github.io/Student_pixel/

Drag the three-line handle on a panel to a highlighted edge to arrange your workspace. Preview, Transform, Palettes, and layer options can use either side; Preview stays pinned while the other panels scroll. Frames and Layers can sit above or below the canvas and be reordered. Tools can use the left or right edge. Click a handle for placement buttons and **Reset layout**, or focus it and use arrow keys. Escape cancels a drag. Layout preferences save in this browser; narrow windows share one side column and restore the wider arrangement when there is room again.

Resize panels with the small gold grips: tool and side-column widths, frame and layer heights, layer width, Preview, Transform, Palettes, and layer options. Sizes save independently of placement. The handles follow panels moved to another edge. Layer and visibility clicks keep the workspace still. Drag a layer's three-line handle onto a group's middle to nest it, or to a row edge to reorder. Shift-click **+** below Layers to duplicate a layer or a whole nested group.

The existing Dither tool opens compact Pattern, Density, Scale and Colors controls beside the project title. Move Density to override the selected pattern with adjustable ordered dithering from 0–100%; its gold label shows when active. Choosing a pattern returns to pattern mode. Its scrollable picker contains 273 separate visual patterns and density steps. The thumbnail and brush share the same sampler at 1, 2 and 4 pixel scales.

Puppet Studio supports manually mapped layered characters, custom joints, pose markers, walking guides, editable joint motion paths, and locks saved independently with each pose. Shoulder/pelvis connectors carry attached limbs with the body while allowing independent bending. Add joints inside solid segments, or explicitly split a segment with hinge or flexible bending. Clear joints starts over without changing artwork. The source layer stack controls artwork order, independently of the skeleton. Lock/unlock records the current marker; different markers that shared a pose stay independent. See [the studio guide](PUPPET-STUDIO.md).

Drawings can be saved in the browser or downloaded as `.piskel` files. Browser saves belong to that browser/device. Moving artwork from the desktop test editor requires exporting and importing its `.piskel` file.

Full browser storage or damaged preferences no longer prevent the tools and canvas from loading. The editor keeps usable preferences in memory and displays a notice when they cannot be saved. Existing stored data stays intact; **Save as .piskel** can still download the project.

Open **Particle Studio** with the sparkle icon in **Studios**, below Palettes. Drag the studio title bar to move its window and the bottom-right grip to resize it; both are remembered in this browser. Move emitters, draw/edit paths, add position keys, adjust timing and particle properties, or start with fire, smoke, rain, snow, sparks, fountain, magic or embers. **Save effect** keeps editable settings in the project; **Generate frames** adds a locked Particle FX layer while preserving the artwork. Effects support local undo/redo and JSON import/export. The Studios launcher panel can also move with its three-line handle.

## Develop and verify

Use Node.js 24 and npm:

```sh
npm ci
npm run lint
npm run build
npm run test:pages
```

The Pages tests run against the built editor under `/Student_pixel/`, checking asset loading, draggable panels, the bottom layout, rotation, per-pose locks, whole-group duplication, layer order, connectors, joint splitting, every dither pattern, adjustable panels, and Particle Studio's controls, saved settings, paths and generated output. Install the test browser with `npx playwright install chromium` when needed. `npm run unit-tests` runs the geometry, particle simulation and editor unit suite using Puppeteer's Chrome.

`npm run preview:pages` serves the production build at http://127.0.0.1:8772/Student_pixel/.

## Publish

In repository Settings → Pages, choose **GitHub Actions** as the deployment source. The **Deploy Student_pixel** workflow checks and builds each push to `main`, runs browser smoke tests, then publishes only `dest/prod`. It can also be run manually from Actions. Changes in pull requests are checked without publishing.

The public repository contains editor code, its icons and vendor libraries, and synthetic tests. Personal artwork, GLB models, private test fixtures, screenshots and local exports are excluded.

## License and attribution

Piskel was created by Julian Descottes and its contributors. Original code is available under the [Apache License 2.0](LICENSE). Existing third-party notices in bundled libraries are retained. This modified version adds the layout, layer, rotation and rigging features described above; it is not an official Piskel release.

# Student_pixel

A browser pixel-art editor based on [Piskel](https://github.com/piskelapp/piskel), with a horizontal frame strip and compact layers along the bottom, nested layer groups, editable layer effects, corrected 45-degree rotation, and Puppet Studio.

**Website:** https://ragingaxolotl-art.github.io/Student_pixel/

Puppet Studio supports manually mapped layered characters, custom joints, pose markers, walking guides, editable joint motion paths, and locks saved independently with each pose. Lock/unlock records the current marker; different markers that shared a pose stay independent. See [the studio guide](PUPPET-STUDIO.md).

Drawings can be saved in the browser or downloaded as `.piskel` files. Browser saves belong to that browser/device. Moving artwork from the desktop test editor requires exporting and importing its `.piskel` file.

## Develop and verify

Use Node.js 24 and npm:

```sh
npm ci
npm run lint
npm run build
npm run test:pages
```

The Pages tests run against the built editor under `/Student_pixel/`, checking asset loading, the bottom layout, rotation, and per-pose lock persistence. Install the test browser with `npx playwright install chromium` when needed. `npm run unit-tests` runs the geometry and editor unit suite using Puppeteer's Chrome.

`npm run preview:pages` serves the production build at http://127.0.0.1:8772/Student_pixel/.

## Publish

In repository Settings → Pages, choose **GitHub Actions** as the deployment source. The **Deploy Student_pixel** workflow checks and builds each push to `main`, runs browser smoke tests, then publishes only `dest/prod`. It can also be run manually from Actions. Changes in pull requests are checked without publishing.

The public repository contains editor code, its icons and vendor libraries, and synthetic tests. Personal artwork, GLB models, private test fixtures, screenshots and local exports are excluded.

## License and attribution

Piskel was created by Julian Descottes and its contributors. Original code is available under the [Apache License 2.0](LICENSE). Existing third-party notices in bundled libraries are retained. This modified version adds the layout, layer, rotation and rigging features described above; it is not an official Piskel release.

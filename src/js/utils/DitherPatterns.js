/** Uniform dither tiles shared by the picker previews and the brush. */
(function () {
  const ns = $.namespace("pskl.utils");
  const catalog = [
    ["checker", "Checkerboard", "classic"],
    ["dots", "Dots", "classic"],
    ["diagonal", "Diagonal", "classic"],
    ["density125", "Classic 12.5%", "density", 12.5],
    ["density25", "Classic 25%", "density", 25],
    ["density375", "Classic 37.5%", "density", 37.5],
    ["density625", "Classic 62.5%", "density", 62.5],
    ["density75", "Classic 75%", "density", 75],
    ["density875", "Classic 87.5%", "density", 87.5],
    ["fine-dots", "Fine dots", "marks"],
    ["spaced-dots", "Spaced dots", "marks"],
    ["round-dots", "Round dots", "marks"],
    ["large-dots", "Large dots", "marks"],
    ["square-dots", "Square dots", "marks"],
    ["large-squares", "Large squares", "marks"],
    ["offset-blocks", "Offset blocks", "marks"],
    ["plus-fine", "Fine crosses", "marks"],
    ["plus-bold", "Bold crosses", "marks"],
    ["x-crosses", "X crosses", "marks"],
    ["diamond-outline", "Open diamonds", "marks"],
    ["diamond-solid", "Solid diamonds", "marks"],
    ["lattice", "Diagonal lattice", "marks"],
    ["h-dense", "Fine horizontal", "marks"],
    ["h-spaced", "Spaced horizontal", "marks"],
    ["h-bold", "Thick horizontal", "marks"],
    ["v-dense", "Fine vertical", "marks"],
    ["v-spaced", "Spaced vertical", "marks"],
    ["v-bold", "Thick vertical", "marks"],
    ["diag-left", "Diagonal left", "marks"],
    ["diag-right", "Diagonal right", "marks"],
    ["diag-broken", "Broken diagonal", "marks"],
    ["diag-bold", "Thick diagonal", "marks"],
    ["crosshatch", "Crosshatch", "marks"],
    ["grid-fine", "Fine grid", "marks"],
    ["grid-wide", "Wide grid", "marks"],
    ["h-dashes", "Horizontal dashes", "marks"],
    ["v-dashes", "Vertical dashes", "marks"],
    ["brick-fine-outline", "Fine brick outline", "brick", 4, 2, false],
    ["brick-fine-solid", "Fine brick solid", "brick", 4, 2, true],
    ["brick-outline", "Brick outline", "brick", 6, 4, false],
    ["brick-solid", "Brick solid", "brick", 6, 4, true],
    ["brick-wide-outline", "Wide brick outline", "brick", 8, 4, false],
    ["brick-wide-solid", "Wide brick solid", "brick", 8, 4, true],
    ["bayer2", "Bayer 2×2", "image"],
    ["ordered", "Bayer 4×4", "image"],
    ["bayer8", "Bayer 8×8", "image"],
    ["bayer16", "Bayer 16×16", "image"],
    ["halftone", "Halftone", "image"],
    ["radial", "Radial", "image"],
    ["horizontal-lines", "Horizontal lines", "image"],
    ["vertical-lines", "Vertical lines", "image"],
    ["diagonal-lines", "Diagonal lines", "image"],
    ["white-noise", "White noise", "image"],
    ["blue-noise", "Blue noise", "image"],
    ["floyd", "Floyd–Steinberg", "diffusion"],
    ["atkinson", "Atkinson", "diffusion"],
    ["stucki", "Stucki", "diffusion"],
    ["sierra-lite", "Sierra Lite", "diffusion"],
    ["burkes", "Burkes", "diffusion"],
    ["sierra", "Sierra", "diffusion"]
  ];
  const toneLevels = [12.5, 25, 37.5, 50, 62.5, 75, 87.5];
  // Each density has one uniform tile; omit repeated or solid intermediate steps.
  for (let i = catalog.length - 1; i >= 0; i--) {
    const entry = catalog[i];
    if (!["image", "diffusion"].includes(entry[2])) {
      continue;
    }
    const levels =
      entry[0] === "bayer2" || entry[0].endsWith("-lines")
        ? [25, 50, 75]
        : entry[0] === "halftone"
          ? [12.5, 25, 37.5, 62.5, 75]
          : entry[0] === "atkinson"
            ? [25, 37.5, 50, 62.5, 75]
            : toneLevels;
    catalog.splice(
      i,
      1,
      ...levels.map((level) => [
        entry[0] + "-tone-" + level,
        entry[1] + " " + level + "%",
        "algorithm-tone",
        level,
        entry[0]
      ])
    );
  }
  // 8×8 masks read from the user's numbered 00–99 sheet; labels and margins excluded.
  const referenceRows = [
    "0000000000000000",
    "1100000011000000",
    "1100440011004400",
    "5500440055004400",
    "5500550055005500",
    "5522550055225500",
    "5522558855225588",
    "55aa558855aa5588",
    "aa55aa55aa55aa55",
    "3333cccc3333cccc",
    "c3e1f0783c1e0f87",
    "c06030180c060381",
    "4020100804020180",
    "4422118844221188",
    "c163361c1c3663c1",
    "e3f77f3e3e7ff7e3",
    "0022118800221108",
    "30cc030030cc0300",
    "0066660000666600",
    "330c33c0330c33c0",
    "0f1e3c78f0e1c387",
    "03060c183060c081",
    "0102040810204080",
    "1122448811224488",
    "4122140814224180",
    "5522558855225588",
    "0008112200881122",
    "6cc693396cc69339",
    "0f0f0f0ff0f0f0f0",
    "030c30c0030c30c0",
    "00ff000000000000",
    "00ff000000ff0000",
    "00ff00ff00ff00ff",
    "0202020202020202",
    "2222222222222222",
    "ffff030303030303",
    "1100100055001000",
    "10387cfeefc78301",
    "0000001818000000",
    "8888444422221111",
    "0055000000000000",
    "0055000000550000",
    "22dd222222dd2222",
    "0200020002000200",
    "2200220022002200",
    "0255020002000200",
    "2255220022552200",
    "0055001182442810",
    "08142a552a140800",
    "1111222244448888",
    "00ffff0000000000",
    "00ffff0000ffff00",
    "aaaaaaaaaaaaaaaa",
    "0606060606060606",
    "6666666666666666",
    "02ff020202020202",
    "22ff222222ff2222",
    "081c3eff3e1c0808",
    "081c3e7f3e1c0800",
    "c0300c03c0300c03",
    "71bb170e1dbbd1e0",
    "180c06133060c080",
    "0010204000040201",
    "0000205000000205",
    "8080aa140808aa41",
    "111111110a0440a0",
    "ee191f1fee91f1f1",
    "081422c122140808",
    "081422c922140808",
    "38220e2238220e22",
    "ffffffff00000000",
    "0f0f0f0f0f0f0f0f",
    "0010387c7c381000",
    "006cfefe7c381000",
    "0010387cfed61010",
    "003838d6fed61010",
    "c70101827c101028",
    "0814224122140800",
    "0814224922140800",
    "007722aa88dd0000",
    "ff81a58181bd81ff",
    "007e425a5a427e00",
    "007e424242427e00",
    "2112844821128448",
    "8844221144881122",
    "1020508805020408",
    "08040a11a0402010",
    "88888f888888f888",
    "202020ff020202ff",
    "0424ee2004772420",
    "0002000000000000",
    "00aa005500aa0055",
    "1144114411441144",
    "8080c021120c3040",
    "0101038448300c02",
    "7751570075457700",
    "7133170074664700",
    "1436770077361400",
    "0000ff88aa22ff00",
    "222e223a222e223a"
  ];
  const referenceMasks = referenceRows.map((hex) =>
    Array.from({ length: 8 }, (_, i) =>
      parseInt(hex.slice(i * 2, i * 2 + 2), 16)
    )
  );
  referenceRows.forEach((_, i) =>
    catalog.push([
      "ref" + String(i).padStart(2, "0"),
      "Pattern " + String(i).padStart(2, "0"),
      "reference",
      i
    ])
  );
  // Each former fade strip is a family of separate, uniform-density patterns.
  [
    ["classic", "Classic"],
    ["rings", "Rings"],
    ["zigzag", "Zigzag"],
    ["noise", "Noise"],
    ["dots", "Dot density"]
  ].forEach(([style, label]) => {
    const levels =
      style === "rings"
        ? [12.5, 25, 37.5, 50, 62.5]
        : style === "zigzag"
          ? [12.5, 37.5, 50, 62.5, 87.5]
          : toneLevels;
    levels.forEach((level) =>
      catalog.push([
        "tone-" + style + "-" + level,
        label + " " + level + "%",
        "tone",
        level,
        style
      ])
    );
  });
  const specs = Object.fromEntries(catalog.map((e) => [e[0], e]));
  const matrices = {
    checker: [
      [2, 0],
      [1, 3]
    ],
    ordered: [
      [0, 8, 2, 10],
      [12, 4, 14, 6],
      [3, 11, 1, 9],
      [15, 7, 13, 5]
    ]
  };
  function bayer(size) {
    if (size === 2) {
      return [
        [0, 2],
        [3, 1]
      ];
    }
    const small = bayer(size / 2),
      half = size / 2,
      base = [
        [0, 2],
        [3, 1]
      ];
    return Array.from({ length: size }, (_, y) =>
      Array.from(
        { length: size },
        (_, x) =>
          4 * small[y % half][x % half] +
          base[Math.floor(y / half)][Math.floor(x / half)]
      )
    );
  }
  const bayers = { 2: bayer(2), 4: bayer(4), 8: bayer(8), 16: bayer(16) };
  const mod = (x, n) => ((x % n) + n) % n;
  function hash(x, y) {
    let n = Math.imul(x + 17, 374761393) ^ Math.imul(y + 47, 668265263);
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
  }
  // Deterministic void-and-cluster threshold mask for blue-noise tiles.
  function blueMask() {
    const n = 16,
      count = n * n,
      mask = new Uint8Array(count),
      field = new Float64Array(count),
      kernel = new Float64Array(count),
      rank = new Uint16Array(count);
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const dx = Math.min(x, n - x),
          dy = Math.min(y, n - y);
        kernel[y * n + x] = Math.exp(-(dx * dx + dy * dy) / 4.5);
      }
    }
    const order = Array.from({ length: count }, (_, i) => i).sort(
      (a, b) => hash(a, 13) - hash(b, 13)
    );
    function add(at, sign) {
      const x = at % n,
        y = Math.floor(at / n);
      for (let i = 0; i < count; i++) {
        field[i] +=
          sign *
          kernel[mod(Math.floor(i / n) - y, n) * n + mod((i % n) - x, n)];
      }
      mask[at] = sign > 0 ? 1 : 0;
    }
    function pick(value, max) {
      let chosen = -1,
        best = max ? -Infinity : Infinity;
      for (let i = 0; i < count; i++) {
        if (mask[i] === value && (max ? field[i] > best : field[i] < best)) {
          chosen = i;
          best = field[i];
        }
      }
      return chosen;
    }
    order.slice(0, count / 2).forEach((i) => add(i, 1));
    for (let i = 0; i < 1024; i++) {
      const cluster = pick(1, true);
      add(cluster, -1);
      const voidAt = pick(0, false);
      add(voidAt, 1);
      if (voidAt === cluster) {
        break;
      }
    }
    const seed = mask.slice();
    for (let r = count / 2 - 1; r >= 0; r--) {
      const at = pick(1, true);
      rank[at] = r;
      add(at, -1);
    }
    field.fill(0);
    mask.fill(0);
    seed.forEach((v, i) => {
      if (v) {
        add(i, 1);
      }
    });
    for (let r = count / 2; r < count; r++) {
      const at = pick(0, false);
      rank[at] = r;
      add(at, 1);
    }
    return rank;
  }
  const blue = blueMask(),
    maskCache = new Map();
  const diffusion = {
    floyd: [
      16,
      [
        [1, 0, 7],
        [-1, 1, 3],
        [0, 1, 5],
        [1, 1, 1]
      ]
    ],
    atkinson: [
      8,
      [
        [1, 0, 1],
        [2, 0, 1],
        [-1, 1, 1],
        [0, 1, 1],
        [1, 1, 1],
        [0, 2, 1]
      ]
    ],
    stucki: [
      42,
      [
        [1, 0, 8],
        [2, 0, 4],
        [-2, 1, 2],
        [-1, 1, 4],
        [0, 1, 8],
        [1, 1, 4],
        [2, 1, 2],
        [-2, 2, 1],
        [-1, 2, 2],
        [0, 2, 4],
        [1, 2, 2],
        [2, 2, 1]
      ]
    ],
    "sierra-lite": [
      4,
      [
        [1, 0, 2],
        [-1, 1, 1],
        [0, 1, 1]
      ]
    ],
    burkes: [
      32,
      [
        [1, 0, 8],
        [2, 0, 4],
        [-2, 1, 2],
        [-1, 1, 4],
        [0, 1, 8],
        [1, 1, 4],
        [2, 1, 2]
      ]
    ],
    sierra: [
      32,
      [
        [1, 0, 5],
        [2, 0, 3],
        [-2, 1, 2],
        [-1, 1, 4],
        [0, 1, 5],
        [1, 1, 4],
        [2, 1, 2],
        [-1, 2, 2],
        [0, 2, 3],
        [1, 2, 2]
      ]
    ]
  };
  function motif(kind, x, y) {
    const u = mod(x, 6) - 2.5,
      v = mod(y, 6) - 2.5;
    switch (kind) {
      case "fine-dots":
        return x % 3 === 0 && y % 3 === 0;
      case "spaced-dots":
        return x % 5 === 0 && y % 5 === 0;
      case "round-dots":
        return Math.hypot(u, v) < 1.6;
      case "large-dots":
        return Math.hypot(u, v) < 2.5;
      case "square-dots":
        return x % 4 < 2 && y % 4 < 2;
      case "large-squares":
        return x % 6 < 4 && y % 6 < 4;
      case "offset-blocks":
        return mod(x + (Math.floor(y / 5) % 2) * 3, 6) < 3 && y % 5 < 3;
      case "plus-fine":
        return (x % 4 === 1 && y % 4 < 3) || (y % 4 === 1 && x % 4 < 3);
      case "plus-bold":
        return (
          (Math.abs(u) < 1 && Math.abs(v) < 2.6) ||
          (Math.abs(v) < 1 && Math.abs(u) < 2.6)
        );
      case "x-crosses":
        return Math.abs(Math.abs(u) - Math.abs(v)) < 0.6;
      case "diamond-outline":
        return Math.abs(Math.abs(u) + Math.abs(v) - 3) < 0.6;
      case "diamond-solid":
        return Math.abs(u) + Math.abs(v) < 3.1;
      case "lattice":
        return mod(x + y, 4) === 0 || mod(x - y, 4) === 0;
      case "h-dense":
        return y % 2 === 0;
      case "h-spaced":
        return y % 5 === 0;
      case "h-bold":
        return y % 6 < 2;
      case "v-dense":
        return x % 2 === 0;
      case "v-spaced":
        return x % 5 === 0;
      case "v-bold":
        return x % 6 < 2;
      case "diag-left":
        return mod(x + y, 4) === 0;
      case "diag-right":
        return mod(x - y, 4) === 0;
      case "diag-broken":
        return mod(x + y, 4) === 0 && x % 4 !== 3;
      case "diag-bold":
        return mod(x + y, 6) < 2;
      case "crosshatch":
        return mod(x + y, 6) === 0 || mod(x - y, 6) === 0;
      case "grid-fine":
        return x % 3 === 0 || y % 3 === 0;
      case "grid-wide":
        return x % 6 === 0 || y % 6 === 0;
      case "h-dashes":
        return x % 6 < 3 && y % 4 === 0;
      case "v-dashes":
        return x % 4 === 0 && y % 6 < 3;
      case "diagonal":
        return (x + y) % 4 < 2;
      default:
        return false;
    }
  }
  function patternMask(kind, width, height, settings) {
    const entry = specs[kind],
      algorithm = entry[2] === "algorithm-tone" ? entry[4] : kind,
      key = [kind, width, height, settings.coverage, settings.scale].join("|");
    if (maskCache.has(key)) {
      return maskCache.get(key);
    }
    const scale = Number(settings.scale),
      w = Math.ceil(width / scale),
      h = Math.ceil(height / scale),
      values = new Float64Array(w * h),
      bits = new Uint8Array(w * h),
      coverage =
        Number(
          ["tone", "algorithm-tone"].includes(entry[2])
            ? entry[3]
            : settings.coverage
        ) / 100;
    // All thumbnails and strokes use one tone throughout, never a gradient strip.
    values.fill(coverage);
    if (diffusion[algorithm]) {
      const [div, kernel] = diffusion[algorithm];
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const at = y * w + x,
            old = values[at],
            bit = old >= 0.5 ? 1 : 0,
            error = old - bit;
          bits[at] = bit;
          kernel.forEach(([dx, dy, weight]) => {
            const nx = x + dx,
              ny = y + dy;
            if (nx >= 0 && nx < w && ny < h) {
              values[ny * w + nx] += (error * weight) / div;
            }
          });
        }
      }
    } else {
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          let selected, threshold;
          if (entry[2] === "reference") {
            selected = !!(referenceMasks[entry[3]][y % 8] & (1 << (x % 8)));
          } else if (entry[2] === "marks") {
            selected = motif(kind, x, y);
          } else if (entry[2] === "brick") {
            const [, , , bw, bh, solid] = entry,
              mortar =
                y % bh === 0 ||
                mod(x + (Math.floor(y / bh) % 2) * Math.floor(bw / 2), bw) ===
                  0;
            selected = solid ? !mortar : mortar;
          } else if (entry[2] === "density") {
            selected = (bayers[8][y % 8][x % 8] + 0.5) / 64 < entry[3] / 100;
          } else if (kind === "checker") {
            selected = (matrices.checker[y % 2][x % 2] + 0.5) / 4 < coverage;
          } else if (kind === "diagonal") {
            selected = (((x + y) % 4) + 0.5) / 4 < coverage;
          } else if (kind === "dots") {
            const dot = [
              [12, 4, 5, 13],
              [6, 0, 1, 7],
              [8, 2, 3, 9],
              [14, 10, 11, 15]
            ];
            selected = (dot[y % 4][x % 4] + 0.5) / 16 < coverage;
          } else {
            if (algorithm === "ordered" || algorithm.startsWith("bayer")) {
              const n =
                algorithm === "ordered" ? 4 : Number(algorithm.substring(5));
              threshold = (bayers[n][y % n][x % n] + 0.5) / (n * n);
            } else if (entry[2] === "tone" && entry[4] === "classic") {
              threshold = (bayers[8][y % 8][x % 8] + 0.5) / 64;
            } else if (entry[2] === "tone" && entry[4] === "rings") {
              const dx = mod(x, 6) - 2.5,
                dy = mod(y, 6) - 2.5;
              threshold = Math.min(1, Math.abs(Math.hypot(dx, dy) - 1.8) / 2.2);
            } else if (entry[2] === "tone" && entry[4] === "zigzag") {
              threshold = (mod(x + Math.abs(mod(y, 6) - 3), 6) + 0.5) / 6;
            } else if (entry[2] === "tone" && entry[4] === "noise") {
              threshold = hash(x, y);
            } else if (entry[2] === "tone" && entry[4] === "dots") {
              threshold = (bayers[4][y % 4][x % 4] + 0.5) / 16;
            } else if (algorithm === "white-noise") {
              threshold = hash(x, y);
            } else if (algorithm === "blue-noise") {
              threshold = (blue[mod(y, 16) * 16 + mod(x, 16)] + 0.5) / 256;
            } else if (algorithm === "halftone") {
              const dx = mod(x, 6) - 2.5,
                dy = mod(y, 6) - 2.5;
              threshold = (dx * dx + dy * dy) / 12.6;
            } else if (algorithm === "radial") {
              threshold = mod(Math.hypot(x - w / 2, y - h / 2), 6) / 6;
            } else if (algorithm === "horizontal-lines") {
              threshold = ((y % 4) + 0.5) / 4;
            } else if (algorithm === "vertical-lines") {
              threshold = ((x % 4) + 0.5) / 4;
            } else {
              threshold = (((x + y) % 4) + 0.5) / 4;
            }
            selected = values[y * w + x] > threshold;
          }
          bits[y * w + x] = selected ? 1 : 0;
        }
      }
    }
    const out = new Uint8Array(width * height);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        out[y * width + x] =
          bits[Math.floor(y / scale) * w + Math.floor(x / scale)];
      }
    }
    if (maskCache.size > 500) {
      maskCache.clear();
    }
    maskCache.set(key, out);
    return out;
  }

  const tileCache = new Map();
  const coverageLevels = ["12.5", "25", "37.5", "50", "62.5", "75", "87.5"];

  function normalize(value) {
    const input = value && typeof value === "object" ? value : {};
    const settings = {
      pattern: Object.hasOwn(specs, input.pattern) ? input.pattern : "checker",
      coverage: coverageLevels.includes(String(input.coverage))
        ? String(input.coverage)
        : "50",
      scale: ["1", "2", "4"].includes(String(input.scale))
        ? String(input.scale)
        : "1",
      colors: input.colors === "primary" ? "primary" : "both",
      mode: input.mode === "density" ? "density" : "pattern",
      density:
        input.density !== null &&
        input.density !== "" &&
        Number.isFinite(Number(input.density))
          ? Math.max(0, Math.min(100, Math.round(Number(input.density))))
          : 50
    };
    const entry = specs[settings.pattern];
    if (["density", "tone", "algorithm-tone"].includes(entry[2])) {
      settings.coverage = String(entry[3]);
    }
    return settings;
  }

  function dimensions(entry) {
    if (entry[2] === "reference") {
      return [8, 8];
    }
    if (entry[2] === "brick") {
      return [entry[3], entry[4] * 2];
    }
    if (entry[2] === "density") {
      return [8, 8];
    }
    if (entry[2] === "tone") {
      return entry[4] === "classic"
        ? [8, 8]
        : entry[4] === "dots"
          ? [4, 4]
          : entry[4] === "noise"
            ? [16, 16]
            : [6, 6];
    }
    if (entry[2] === "algorithm-tone") {
      const algorithm = entry[4];
      if (algorithm === "ordered") {
        return [4, 4];
      }
      if (algorithm.startsWith("bayer")) {
        const n = Number(algorithm.slice(5));
        return [n, n];
      }
      if (algorithm === "halftone") {
        return [6, 6];
      }
      if (algorithm.endsWith("-lines")) {
        return [4, 4];
      }
      if (algorithm.endsWith("-noise")) {
        return [16, 16];
      }
      return [32, 32];
    }
    const sizes = {
      checker: [2, 2],
      dots: [4, 4],
      diagonal: [4, 4],
      "fine-dots": [3, 3],
      "spaced-dots": [5, 5],
      "square-dots": [4, 4],
      "offset-blocks": [6, 10],
      "plus-fine": [4, 4],
      lattice: [4, 4],
      "h-dense": [2, 2],
      "h-spaced": [5, 5],
      "v-dense": [2, 2],
      "v-spaced": [5, 5],
      "diag-left": [4, 4],
      "diag-right": [4, 4],
      "diag-broken": [4, 4],
      "grid-fine": [3, 3],
      "h-dashes": [6, 4],
      "v-dashes": [4, 6]
    };
    return sizes[entry[0]] || [6, 6];
  }

  function tile(settings) {
    const key = [
      settings.mode,
      settings.density,
      settings.pattern,
      settings.coverage,
      settings.scale
    ].join("|");
    if (!tileCache.has(key)) {
      const size =
          settings.mode === "density"
            ? [4, 4]
            : dimensions(specs[settings.pattern]),
        scale = Number(settings.scale);
      const width = size[0] * scale,
        height = size[1] * scale;
      if (tileCache.size > 128) {
        tileCache.clear();
      }
      const bits =
        settings.mode === "density"
          ? Uint8Array.from({ length: width * height }, (_, index) => {
              const x = Math.floor((index % width) / scale),
                y = Math.floor(Math.floor(index / width) / scale);
              return (bayers[4][y][x] + 0.5) / 16 < settings.density / 100
                ? 1
                : 0;
            })
          : patternMask(settings.pattern, width, height, settings);
      tileCache.set(key, {
        width,
        height,
        bits: bits
      });
    }
    return tileCache.get(key);
  }

  ns.DitherPatterns = {
    list: function () {
      return catalog.map((e) => ({
        id: e[0],
        label: e[1],
        family: e[2],
        coverage: e[3],
        kind: e[4]
      }));
    },
    get: function (id) {
      return this.list().find((entry) => entry.id === id);
    },
    normalize: normalize,
    isFixed: function (id) {
      return (
        specs[id] &&
        ["marks", "brick", "reference", "tone", "algorithm-tone"].includes(
          specs[id][2]
        )
      );
    },
    // Coordinates stay anchored to the sprite, even across separate brush strokes.
    sample: function (x, y, settings) {
      const t = tile(settings);
      return !!t.bits[
        mod(Math.floor(y), t.height) * t.width + mod(Math.floor(x), t.width)
      ];
    },
    createMask: function (width, height, value) {
      const settings = normalize(value),
        t = tile(settings),
        out = new Uint8Array(width * height);
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          out[y * width + x] =
            t.bits[mod(y, t.height) * t.width + mod(x, t.width)];
        }
      }
      return out;
    }
  };
})();

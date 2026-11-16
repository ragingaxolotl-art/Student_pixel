describe("Layer effect pixel audit", function () {
  var U = pskl.utils,
    F = pskl.model.Frame;
  function p(r, g, b, a) {
    return (
      (((a === undefined ? 255 : a) << 24) | (b << 16) | (g << 8) | r) >>> 0
    );
  }
  function rgba(v) {
    return [v & 255, (v >>> 8) & 255, (v >>> 16) & 255, v >>> 24];
  }
  function single(value) {
    return F.fromPixelGrid(new Uint32Array([value]), 1, 1);
  }
  function defaults(type, extra) {
    var o = {};
    U.LayerEffectDefinitions.parameters(type).forEach(function (d) {
      o[d.key] = d.value;
    });
    return Object.assign(o, extra || {});
  }
  function effect(type, value, amount, extra, reference, color) {
    var o = defaults(type, extra);
    if (amount !== undefined) {
      o.amount = amount;
    }
    return U.LayerPixelOps.effect(
      single(value),
      single(reference === undefined ? p(64, 128, 192) : reference),
      type,
      o.amount,
      color || "#ffffff",
      o
    ).pixels[0];
  }
  function near(actual, expected, tolerance) {
    rgba(actual).forEach(function (v, i) {
      expect(Math.abs(v - expected[i])).toBeLessThanOrEqual(tolerance || 0);
    });
  }
  var expected = {
    multiply: [48, 32, 96],
    screen: [208, 160, 224],
    overlay: [96, 65, 192],
    darken: [64, 64, 128],
    lighten: [192, 128, 192],
    difference: [128, 64, 64],
    exclusion: [160, 128, 127],
    addColor: [255, 192, 255],
    subtractColor: [0, 64, 64],
    "color-dodge": [255, 171, 255],
    "color-burn": [1, 0, 129],
    "hard-light": [161, 64, 192],
    hue: [205, 77, 77],
    saturationBlend: [64, 128, 192],
    color: [198, 70, 134],
    luminosity: [58, 122, 186]
  };
  Object.keys(expected).forEach(function (mode) {
    it(mode + " matches fixed standard color values", function () {
      var source = mode === "hue" ? p(255, 0, 0) : p(192, 64, 128);
      near(effect(mode, source, 100), expected[mode].concat(255), 1);
    });
  });
  it("soft light has neutral grey and known black/white limits", function () {
    near(
      effect("soft-light", p(128, 128, 128), 100, null, p(64, 128, 192)),
      [64, 128, 192, 255],
      1
    );
    near(
      effect("soft-light", p(0, 0, 0), 100, null, p(128, 128, 128)),
      [64, 64, 64, 255],
      1
    );
    near(
      effect("soft-light", p(255, 255, 255), 100, null, p(64, 64, 64)),
      [128, 128, 128, 255],
      1
    );
  });
  it("Multiply does not mix source transparency into its colors twice", function () {
    near(
      effect("multiply", p(80, 40, 20, 128), 100, null, p(255, 255, 255)),
      [80, 40, 20, 128],
      0
    );
    near(
      U.LayerBlendUtils.pixel(
        p(255, 0, 0),
        p(0, 0, 255, 128),
        "multiply",
        1,
        1
      ),
      [127, 0, 0, 255],
      0
    );
    near(
      U.LayerBlendUtils.pixel(
        p(255, 0, 0, 128),
        p(0, 0, 255, 128),
        "multiply",
        1,
        1
      ),
      [85, 0, 85, 192],
      0
    );
  });
  it("transparent backdrops do not darken Multiply", function () {
    near(
      U.LayerBlendUtils.pixel(0, p(80, 40, 20, 128), "multiply", 1, 1),
      [80, 40, 20, 128],
      0
    );
  });
  [
    "none",
    "grayscale",
    "invert",
    "brightness",
    "hueShift",
    "saturation",
    "tint",
    "neon",
    "shadow"
  ].forEach(function (type) {
    it(type + " neutral settings preserve original pixels", function () {
      var value = p(144, 88, 32, 128),
        amount = ["none"].indexOf(type) !== -1 ? undefined : 0;
      near(effect(type, value, amount), rgba(value), 0);
    });
  });
  it("Invert and Grayscale use their strength setting", function () {
    near(effect("invert", p(255, 0, 0, 128), 25), [191, 64, 64, 128], 0);
    near(effect("grayscale", p(255, 0, 0, 128), 100), [54, 54, 54, 128], 0);
    near(effect("grayscale", p(200, 100, 50), 50), [159, 109, 84, 255], 0);
  });
  it("Hue uses degrees and preserves alpha", function () {
    near(effect("hueShift", p(255, 0, 0, 128), 120), [0, 255, 0, 128], 0);
    near(effect("hueShift", p(255, 0, 0), -120), [0, 0, 255, 255], 0);
  });
  it("Saturation has neutral, grey and fully saturated limits", function () {
    near(effect("saturation", p(255, 0, 0), -100), [128, 128, 128, 255], 0);
    near(effect("saturation", p(96, 128, 160), 100), [1, 128, 255, 255], 1);
  });
  it("Brightness clamps channels and preserves alpha", function () {
    near(
      effect("brightness", p(40, 80, 120, 128), 100),
      [255, 255, 255, 128],
      0
    );
    near(effect("brightness", p(40, 80, 120), -100), [0, 0, 0, 255], 0);
  });
  it("Tint strength interpolates toward the chosen color", function () {
    near(
      effect("tint", p(0, 0, 255, 128), 50, null, undefined, "#ff0000"),
      [128, 0, 128, 128],
      0
    );
  });
  it("Posterize two levels means exactly black and white", function () {
    near(effect("posterize", p(64, 128, 192), 2), [0, 255, 255, 255], 0);
    near(effect("posterize", p(64, 128, 192), 4), [85, 170, 170, 255], 0);
  });
  it("Threshold has exact inclusive boundaries", function () {
    near(effect("threshold", p(127, 127, 127), 128), [0, 0, 0, 255], 0);
    near(effect("threshold", p(128, 128, 128), 128), [255, 255, 255, 255], 0);
    near(effect("threshold", p(0, 0, 0), 0), [255, 255, 255, 255], 0);
  });
  it("Dither gives balanced monotonic coverage", function () {
    function coverage(gray) {
      var f = F.fromPixelGrid(
        new Uint32Array(16).fill(p(gray, gray, gray)),
        4,
        4
      );
      return Array.from(
        U.LayerPixelOps.effect(f, null, "dither", 128, "#fff").pixels
      ).filter(function (v) {
        return (v & 255) === 255;
      }).length;
    }
    expect(coverage(64)).toBe(4);
    expect(coverage(128)).toBe(8);
    expect(coverage(192)).toBe(12);
  });
  it("Outline fills corners, supports width and retains source coverage", function () {
    var f = new F(7, 7);
    f.setPixel(3, 3, p(255, 0, 0, 128));
    [1, 2].forEach(function (width) {
      var result = U.LayerPixelOps.effect(f, null, "outline", width, "#00ff00");
      var occupied = Array.from(result.pixels).filter(function (v) {
        return v >>> 24;
      });
      expect(occupied.length).toBe((width * 2 + 1) * (width * 2 + 1));
      occupied.forEach(function (v) {
        expect(v >>> 24).toBe(128);
      });
      expect(result.getPixel(3, 3)).toBe(f.getPixel(3, 3));
    });
  });
  it("Inner outline preserves partial alpha and interior pixels", function () {
    var f = new F(5, 5);
    for (var y = 1; y <= 3; y++) {
      for (var x = 1; x <= 3; x++) {
        f.setPixel(x, y, p(255, 0, 0, 128));
      }
    }
    var result = U.LayerPixelOps.effect(f, null, "innerOutline", 1, "#00ff00");
    near(result.getPixel(1, 1), [0, 255, 0, 128], 0);
    expect(result.getPixel(2, 2)).toBe(f.getPixel(2, 2));
    expect(result.getPixel(0, 0)).toBe(0);
  });
  it("Shadow supports signed separate offsets and alpha overlap", function () {
    var f = new F(3, 3);
    f.setPixel(1, 0, p(255, 0, 0, 128));
    var result = U.LayerPixelOps.effect(f, null, "shadow", 50, "#000000", {
      shadowX: -1,
      shadowY: 1
    });
    near(result.getPixel(0, 1), [0, 0, 0, 64], 0);
    expect(result.getPixel(1, 0)).toBe(f.getPixel(1, 0));
    f.setPixel(2, 1, p(255, 255, 255, 128));
    result = U.LayerPixelOps.effect(f, null, "shadow", 50, "#000000", {
      shadowX: 1,
      shadowY: 1
    });
    near(result.getPixel(2, 1), [204, 204, 204, 160], 1);
  });
  it("Neon preserves opaque artwork and produces symmetric glow", function () {
    var f = new F(9, 9);
    f.setPixel(4, 4, p(255, 0, 0));
    var result = U.LayerPixelOps.effect(f, null, "neon", 75, "#00ff00", {
      radius: 2
    });
    expect(result.getPixel(4, 4)).toBe(f.getPixel(4, 4));
    expect(result.getPixel(3, 4) >>> 24).toBeGreaterThan(0);
    expect(result.getPixel(3, 4)).toBe(result.getPixel(5, 4));
    expect(result.getPixel(4, 3)).toBe(result.getPixel(4, 5));
  });
  it("Normal map has a flat neutral normal and correct slope direction", function () {
    var f = F.fromPixelGrid(
      new Uint32Array(9).fill(p(128, 128, 128, 128)),
      3,
      3
    );
    var flat = U.LayerPixelOps.effect(f, null, "normalMap", 2, "#fff");
    near(flat.getPixel(1, 1), [128, 128, 255, 128], 0);
    for (var y = 0; y < 3; y++) {
      f.setPixel(0, y, p(0, 0, 0));
      f.setPixel(1, y, p(128, 128, 128));
      f.setPixel(2, y, p(255, 255, 255));
    }
    var slope = U.LayerPixelOps.effect(f, null, "normalMap", 2, "#fff");
    expect(slope.getPixel(1, 1) & 255).toBeLessThan(128);
    expect((slope.getPixel(1, 1) >>> 8) & 255).toBe(128);
  });
  it("LCD grid, RGB cells, scanline and transparency match settings", function () {
    var result = U.LayerPixelOps.effect(
      single(p(255, 255, 255, 128)),
      null,
      "lcd",
      30,
      "#151515"
    );
    expect(result.getWidth()).toBe(4);
    near(result.getPixel(0, 0), [255, 38, 38, 128], 0);
    near(result.getPixel(1, 0), [38, 255, 38, 128], 0);
    near(result.getPixel(2, 0), [38, 38, 255, 128], 0);
    near(result.getPixel(3, 0), [21, 21, 21, 128], 0);
    near(result.getPixel(0, 2), [179, 27, 27, 128], 0);
    expect(
      U.LayerPixelOps.effect(
        single(0),
        null,
        "lcd",
        30,
        "#151515"
      ).pixels.every(function (v) {
        return v === 0;
      })
    ).toBe(true);
  });
  [
    "subtract",
    "add",
    "intersect",
    "xor",
    "inverseMask",
    "invertOverlap",
    "lift"
  ].forEach(function (op) {
    it(op + " keeps dimensions and accepts partial-alpha overlap", function () {
      var a = single(p(255, 0, 0, 128)),
        b = single(p(0, 0, 255, 128)),
        result = U.LayerPixelOps.manipulate(a, b, op);
      expect(result.getWidth()).toBe(1);
      expect(result.getHeight()).toBe(1);
      if (op === "subtract" || op === "intersect" || op === "lift") {
        expect(result.pixels[0] >>> 24).toBe(64);
      }
    });
  });
  ["mask", "maskInverse"].forEach(function (op) {
    it(
      op + " respects reference alpha without changing source pixels",
      function () {
        var target = pskl.model.Layer.fromFrames("Target", [
            single(p(255, 0, 0, 128))
          ]),
          ref = pskl.model.Layer.fromFrames("Reference", [
            single(p(0, 0, 255, 128))
          ]);
        target.rowState.effects = [
          {
            id: "mask",
            operation: op,
            params: { direction: "below" },
            enabled: true,
            frame: null
          }
        ];
        expect(
          U.LayerEffects.frame(target, 0, [ref, target]).pixels[0] >>> 24
        ).toBe(64);
        expect(target.frames[0].pixels[0] >>> 24).toBe(128);
      }
    );
  });
});

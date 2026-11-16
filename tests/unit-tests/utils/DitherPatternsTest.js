describe("Dither pattern library", function () {
  var P = pskl.utils.DitherPatterns;
  function mask(id, scale, coverage) {
    return P.createMask(32, 32, {
      pattern: id,
      scale: scale || 1,
      coverage: coverage || 50
    });
  }
  function rows(id, width, height) {
    var data = P.createMask(width, height, { pattern: id });
    return Array.from({ length: height }, function (_, y) {
      return Array.from(data.slice(y * width, (y + 1) * width)).join("");
    });
  }
  it("preserves the original checkerboard's primary/secondary phase", function () {
    expect(rows("checker", 8, 4)).toEqual([
      "01010101",
      "10101010",
      "01010101",
      "10101010"
    ]);
  });
  it("has separate, uniform dot densities instead of a gradient", function () {
    [12.5, 25, 37.5, 50, 62.5, 75, 87.5].forEach(function (level) {
      var data = P.createMask(16, 8, { pattern: "tone-dots-" + level });
      expect(
        Array.from(data).reduce(function (a, b) {
          return a + b;
        }, 0)
      ).toBe((128 * level) / 100);
      for (var y = 0; y < 8; y++)
        for (var x = 0; x < 16; x++)
          expect(data[y * 16 + x]).toBe(data[(y % 4) * 16 + (x % 4)]);
    });
  });
  it("draws the numbered smile and empty reference tile correctly", function () {
    expect(rows("ref80", 8, 8)).toEqual([
      "11111111",
      "10000001",
      "10100101",
      "10000001",
      "10000001",
      "10111101",
      "10000001",
      "11111111"
    ]);
    expect(Array.from(mask("ref00")).some(Boolean)).toBe(false);
  });
  it("validates stored preferences and fixed density choices", function () {
    expect(
      P.normalize({
        pattern: "missing",
        scale: 0,
        coverage: 100,
        colors: "bad"
      })
    ).toEqual({
      pattern: "checker",
      scale: "1",
      coverage: "50",
      colors: "both",
      mode: "pattern",
      density: 50
    });
    expect(
      P.normalize({ pattern: "tone-dots-25", coverage: 75 }).coverage
    ).toBe("25");
    expect(P.normalize(null).pattern).toBe("checker");
    expect(P.normalize({ pattern: "constructor" }).pattern).toBe("checker");
  });
  it("keeps negative brush-edge coordinates aligned with the tile", function () {
    var settings = P.normalize({ pattern: "tone-rings-25", scale: 2 });
    for (var y = -10; y < 10; y++)
      for (var x = -10; x < 10; x++)
        expect(P.sample(x, y, settings)).toBe(
          P.sample(x + 12, y + 12, settings)
        );
  });
  it("adjustable density overrides fixed motifs and includes empty/solid endpoints", function () {
    [0, 1, 25, 50, 75, 99, 100].forEach(function (density) {
      var a = P.createMask(16, 16, {pattern: "ref80", mode: "density", density: density}),
        b = P.createMask(16, 16, {pattern: "tone-dots-25", mode: "density", density: density});
      expect(Array.from(a)).toEqual(Array.from(b));
      if (density === 0 || density === 100) {
        expect(Array.from(a).every(function (bit) { return bit === density / 100; })).toBe(true);
      }
    });
    expect(Array.from(P.createMask(8,8,{pattern:"ref80",mode:"density",density:25}))).not.toEqual(Array.from(P.createMask(8,8,{pattern:"ref80"})));
  });
  it("uses the FX ordered matrix at matching density steps and keeps every scale aligned", function () {
    var frame = new pskl.model.Frame(4,4);
    for(var y=0;y<4;y++)for(var x=0;x<4;x++)frame.setPixel(x,y,"#808080");
    [0,25,50,75,100].forEach(function(density){
      var fx=pskl.utils.LayerPixelOps.effect(frame,null,"dither",Math.round(255*(1-density/100))),
        base=P.createMask(4,4,{mode:"density",density:density});
      expect(Array.from(fx.pixels).map(function(p){return p&255?1:0;})).toEqual(Array.from(base));
      [1,2,4].forEach(function(scale){
        var settings=P.normalize({mode:"density",density:density,scale:scale});
        for(var yy=-8;yy<8;yy++)for(var xx=-8;xx<8;xx++){
          var bx=((Math.floor(xx/scale)%4)+4)%4,by=((Math.floor(yy/scale)%4)+4)%4;
          expect(Number(P.sample(xx,yy,settings))).toBe(base[by*4+bx]);
        }
      });
    });
    expect(P.normalize({mode:"density",density:NaN}).density).toBe(50);
    expect(P.normalize({mode:"density",density:101}).density).toBe(100);
  });
  it("offers distinct density steps within every separated family", function () {
    var groups = {};
    P.list().forEach(function (entry) {
      if (entry.family !== "tone" && entry.family !== "algorithm-tone") return;
      var family = entry.id.replace(/-[\d.]+$/, ""),
        signature = Array.from(mask(entry.id)).join("");
      groups[family] = groups[family] || [];
      expect(groups[family].indexOf(signature)).toBe(-1);
      groups[family].push(signature);
    });
  });
  P.list().forEach(function (entry) {
    it(
      entry.label + " paints a repeatable binary pattern at every scale",
      function () {
        var base = mask(entry.id, 1);
        expect(base.length).toBe(1024);
        expect(
          Array.from(base).every(function (bit) {
            return bit === 0 || bit === 1;
          })
        ).toBe(true);
        if (entry.id !== "ref00") {
          expect(Array.from(base).some(Boolean)).toBe(true);
          expect(
            Array.from(base).some(function (bit) {
              return !bit;
            })
          ).toBe(true);
        }
        [1, 2, 4].forEach(function (scale) {
          var settings = P.normalize({ pattern: entry.id, scale: scale }),
            data = mask(entry.id, scale);
          expect(Array.from(mask(entry.id, scale))).toEqual(Array.from(data));
          for (var y = 0; y < 32; y++)
            for (var x = 0; x < 32; x++) {
              expect(data[y * 32 + x]).toBe(
                base[Math.floor(y / scale) * 32 + Math.floor(x / scale)]
              );
              expect(Number(P.sample(x, y, settings))).toBe(data[y * 32 + x]);
            }
        });
      }
    );
  });
});

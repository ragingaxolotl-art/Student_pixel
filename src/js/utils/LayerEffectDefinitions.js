(function () {
  var ns = $.namespace("pskl.utils");
  function param(key, label, value, min, max, step) {
    return {
      key: key,
      label: label,
      value: value,
      min: min,
      max: max,
      step: step || 1
    };
  }
  var strength = param("amount", "Strength (%)", 100, 0, 100);
  ns.LayerEffectDefinitions = {
    parameters: function (effect) {
      if (ns.LayerBlendUtils.isBlend(effect)) {
        return [strength];
      }
      switch (effect) {
        case "none":
        case "mask":
        case "maskInverse":
          return [];
        case "outline":
        case "innerOutline":
          return [param("amount", "Width (pixels)", 1, 1, 16)];
        case "shadow":
          return [
            param("shadowX", "Shadow X (pixels)", 1, -128, 128),
            param("shadowY", "Shadow Y (pixels)", 1, -128, 128),
            param("amount", "Shadow opacity (%)", 50, 0, 100)
          ];
        case "neon":
          return [
            param("radius", "Glow radius (pixels)", 4, 1, 32),
            param("amount", "Glow strength (%)", 50, 0, 100)
          ];
        case "normalMap":
          return [param("amount", "Normal strength", 2, 0.1, 64, 0.1)];
        case "lcd":
          return [param("amount", "Scanline darkness (%)", 30, 0, 100)];
        case "hueShift":
          return [param("amount", "Hue rotation (degrees)", 0, -180, 180)];
        case "brightness":
          return [param("amount", "Brightness adjustment (%)", 0, -100, 100)];
        case "saturation":
          return [param("amount", "Saturation adjustment (%)", 0, -100, 100)];
        case "threshold":
        case "dither":
          return [param("amount", "Threshold (0–255)", 128, 0, 255)];
        case "posterize":
          return [param("amount", "Levels per channel", 4, 2, 32)];
        default:
          return [strength];
      }
    },
    usesColor: function (effect) {
      return (
        ["outline", "innerOutline", "shadow", "neon", "tint", "lcd"].indexOf(
          effect
        ) !== -1
      );
    },
    color: function (effect) {
      return effect === "lcd"
        ? "#151515"
        : effect === "shadow"
          ? "#000000"
          : "#ffffff";
    },
    validate: function (effect, o) {
      this.parameters(effect).forEach(function (p) {
        var v = Number(o[p.key]);
        if (
          o[p.key] === "" ||
          !Number.isFinite(v) ||
          v < p.min ||
          v > p.max ||
          (p.step === 1 && !Number.isInteger(v))
        ) {
          throw new Error(
            p.label +
              " must be " +
              p.min +
              " to " +
              p.max +
              (p.step === 1 ? " in whole numbers." : ".")
          );
        }
      });
    }
  };
})();

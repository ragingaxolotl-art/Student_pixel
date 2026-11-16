pskl.utils.ParticleStudioDefinition = {
  id: "particles",
  name: "Particle studio",
  group: "Animate",
  detail: "Seeded multi-emitter particles, forces, sprites and loop baking",
  description:
    "Edit one emitter while previewing the whole effect. Presets are original procedural effects. Save emitter keeps settings in the project; Bake adds or refreshes Particle FX on a protected layer. Current artwork and later frames stay intact.",
  fields: [
    {
      key: "preset",
      label: "Particle preset",
      type: "select",
      values: [
        "fire",
        "smoke",
        "rain",
        "snow",
        "sparks",
        "fountain",
        "magic",
        "embers"
      ]
    },
    { key: "emitter", label: "Selected emitter", type: "select", values: [] },
    { key: "name", label: "Emitter name", type: "text", value: "Fire" },
    { key: "enabled", label: "Emitter enabled", type: "checkbox", value: true },
    {
      key: "frames",
      label: "Particle animation frames",
      value: 24,
      min: 2,
      max: 120
    },
    {
      key: "seed",
      label: "Particle random seed",
      value: 1,
      min: 0,
      max: 65535
    },
    {
      key: "warmup",
      label: "Loop phase / warmup frames",
      value: 0,
      min: 0,
      max: 600
    },
    { key: "count", label: "Particle count", value: 48, min: 1, max: 300 },
    { key: "life", label: "Lifetime frames", value: 24, min: 1, max: 120 },
    {
      key: "lifeJitter",
      label: "Lifetime jitter percent",
      value: 30,
      min: 0,
      max: 100
    },
    {
      key: "mode",
      label: "Emission timing",
      type: "select",
      values: ["continuous", "burst"]
    },
    {
      key: "emission",
      label: "Emission shape",
      type: "select",
      values: ["point", "box", "ring", "line", "layer"]
    },
    {
      key: "shape",
      label: "Particle shape",
      type: "select",
      values: ["circle", "pixel", "square", "triangle", "star", "sprite"]
    },
    {
      key: "sourceLayer",
      label: "Source layer",
      type: "select",
      values: [],
      numeric: true
    },
    {
      key: "spriteMode",
      label: "Sprite frame sequence",
      type: "select",
      values: ["life", "loop", "once", "random"]
    },
    { key: "x", label: "Emitter X", value: 16, min: -4096, max: 4096 },
    { key: "y", label: "Emitter Y", value: 25, min: -4096, max: 4096 },
    {
      key: "areaWidth",
      label: "Emission width / diameter",
      value: 16,
      min: 1,
      max: 4096
    },
    {
      key: "areaHeight",
      label: "Emission height",
      value: 2,
      min: 1,
      max: 4096
    },
    {
      key: "direction",
      label: "Direction degrees",
      value: -90,
      min: -360,
      max: 360
    },
    { key: "spread", label: "Direction spread", value: 35, min: 0, max: 360 },
    { key: "speed", label: "Particle speed", value: 12, min: 0, max: 512 },
    {
      key: "speedJitter",
      label: "Speed jitter percent",
      value: 35,
      min: 0,
      max: 100
    },
    {
      key: "gravity",
      label: "Particle gravity",
      value: -4,
      min: -512,
      max: 512
    },
    { key: "wind", label: "Particle wind", value: 0, min: -512, max: 512 },
    {
      key: "drag",
      label: "Particle drag percent",
      value: 15,
      min: 0,
      max: 100
    },
    {
      key: "turbulence",
      label: "Particle turbulence",
      value: 2,
      min: 0,
      max: 128
    },
    { key: "orbit", label: "Orbit force", value: 0, min: -512, max: 512 },
    {
      key: "spin",
      label: "Particle spin degrees / second",
      value: 0,
      min: -720,
      max: 720
    },
    { key: "size", label: "Start particle size", value: 2, min: 1, max: 32 },
    { key: "sizeEnd", label: "End particle size", value: 0, min: 0, max: 32 },
    {
      key: "alphaStart",
      label: "Start opacity percent",
      value: 100,
      min: 0,
      max: 100
    },
    {
      key: "alphaEnd",
      label: "End opacity percent",
      value: 0,
      min: 0,
      max: 100
    },
    { key: "trails", label: "Trail length", value: 1, min: 0, max: 8 },
    { key: "bounce", label: "Bounce percent", value: 60, min: 0, max: 100 },
    { key: "attractX", label: "Attractor X", value: 16, min: -4096, max: 4096 },
    { key: "attractY", label: "Attractor Y", value: 16, min: -4096, max: 4096 },
    {
      key: "attract",
      label: "Attractor strength",
      value: 0,
      min: -4096,
      max: 4096
    },
    {
      key: "tint",
      label: "Sprite color tint percent",
      value: 0,
      min: 0,
      max: 100
    },
    {
      key: "colorStart",
      label: "Start particle color",
      type: "color",
      value: "#fff6ad"
    },
    {
      key: "colorMid",
      label: "Midlife particle color",
      type: "color",
      value: "#ff8a28"
    },
    {
      key: "colorEnd",
      label: "End particle color",
      type: "color",
      value: "#b82d25"
    },
    {
      key: "blend",
      label: "Particle blend",
      type: "select",
      values: ["over", "add", "screen", "multiply"]
    },
    {
      key: "collision",
      label: "Particle collisions",
      type: "select",
      values: ["none", "canvas", "layer"]
    },
    {
      key: "palette",
      label: "Snap particle colors to palette",
      type: "checkbox"
    },
    {
      key: "alphaDither",
      label: "Dither particle transparency",
      type: "checkbox"
    },
    { key: "followPath", label: "Follow emitter path", type: "checkbox" },
    {
      key: "files",
      label: "Particle effect JSON",
      type: "file",
      accept: ".json,application/json"
    }
  ],
  actions: [
    { id: "bake", label: "Bake particle animation", primary: true },
    { id: "preset", label: "Load particle preset", primary: false },
    { id: "save", label: "Save emitter", primary: false },
    { id: "add", label: "Add emitter", primary: false },
    { id: "delete", label: "Delete emitter", primary: false },
    { id: "up", label: "Emitter earlier", primary: false },
    { id: "down", label: "Emitter later", primary: false },
    { id: "export", label: "Export particle JSON", primary: false },
    { id: "import", label: "Import particle JSON", primary: false },
    { id: "remove-output", label: "Remove particle output", primary: false }
  ]
};

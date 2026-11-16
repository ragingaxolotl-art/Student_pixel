pskl.utils.PuppetStudioDefinition = {
  id: "rig",
  name: "Rig & puppet studio",
  group: "Animate",
  detail: "Layer pivots, bone templates, IK, poses and animation clips",
  description:
    "Preview edits before saving. Bind one source layer per bone, or use original procedural skins. Parent transforms carry children. Drag joint squares in the preview to pose with IK or edit rest geometry. Baking keeps source pixels, hides bound input layers and creates protected output by body group; Remove rig output restores input visibility.",
  fields: [
    {
      key: "template",
      label: "Rig template",
      type: "select",
      values: ["humanoid", "chibi", "quadruped", "winged", "serpent"]
    },
    {
      key: "editMode",
      label: "Joint interaction",
      type: "select",
      values: [
        ["pose", "Pose / IK"],
        ["rest", "Rest skeleton"],
        ["select", "Select joints"]
      ]
    },
    { key: "bone", label: "Selected bone", type: "select", values: [] },
    { key: "boneName", label: "Bone name", type: "text", value: "Body" },
    {
      key: "parent",
      label: "Parent bone",
      type: "select",
      values: [["", "Root / no parent"]]
    },
    {
      key: "binding",
      label: "Bound source layer",
      type: "select",
      numeric: true,
      values: [[-1, "Unbound / procedural skin"]]
    },
    { key: "group", label: "Bone body group", type: "text", value: "Body" },
    {
      key: "restX",
      label: "Rest pivot X",
      value: 16,
      min: -4096,
      max: 4096,
      step: "any"
    },
    {
      key: "restY",
      label: "Rest pivot Y",
      value: 20,
      min: -4096,
      max: 4096,
      step: "any"
    },
    {
      key: "restAngle",
      label: "Rest bone angle",
      value: -90,
      min: -360,
      max: 360,
      step: "any"
    },
    {
      key: "length",
      label: "Bone length",
      value: 8,
      min: 1,
      max: 4096,
      step: "any"
    },
    {
      key: "radius",
      label: "Start joint radius",
      value: 2,
      min: 0,
      max: 64,
      step: "any"
    },
    {
      key: "radiusEnd",
      label: "End joint radius",
      value: 2,
      min: 0,
      max: 64,
      step: "any"
    },
    {
      key: "bulge",
      label: "Skin bulge",
      value: 0,
      min: -64,
      max: 64,
      step: "any"
    },
    {
      key: "rotation",
      label: "Pose rotation",
      value: 0,
      min: -360,
      max: 360,
      step: "any"
    },
    {
      key: "poseX",
      label: "Pose offset X",
      value: 0,
      min: -4096,
      max: 4096,
      step: "any"
    },
    {
      key: "poseY",
      label: "Pose offset Y",
      value: 0,
      min: -4096,
      max: 4096,
      step: "any"
    },
    {
      key: "scaleX",
      label: "Pose X scale percent",
      value: 100,
      min: -400,
      max: 400,
      step: "any"
    },
    {
      key: "scaleY",
      label: "Pose Y scale percent",
      value: 100,
      min: -400,
      max: 400,
      step: "any"
    },
    {
      key: "shear",
      label: "Pose shear percent",
      value: 0,
      min: -200,
      max: 200,
      step: "any"
    },
    {
      key: "order",
      label: "Pose draw order offset",
      value: 0,
      min: -1000,
      max: 1000,
      step: "any"
    },
    {
      key: "targetX",
      label: "IK target X",
      value: 10,
      min: -4096,
      max: 4096,
      step: "any"
    },
    {
      key: "targetY",
      label: "IK target Y",
      value: 20,
      min: -4096,
      max: 4096,
      step: "any"
    },
    {
      key: "skinColor",
      label: "Bone skin color",
      type: "color",
      value: "#6c9fbd"
    },
    {
      key: "bend",
      label: "IK bend direction",
      type: "select",
      values: [
        [1, "Positive"],
        [-1, "Negative"]
      ]
    },
    {
      key: "visible",
      label: "Bone and children visible",
      type: "checkbox",
      value: true
    },
    {
      key: "skin",
      label: "Procedural skin on unbound bones",
      type: "checkbox",
      value: true
    },
    { key: "outline", label: "Outline each skin group", type: "checkbox" },
    {
      key: "outlineColor",
      label: "Rig outline color",
      type: "color",
      value: "#222222"
    },
    {
      key: "referenceFrame",
      label: "Layer binding reference frame",
      value: 1,
      min: 1,
      max: 6000
    },
    {
      key: "poseName",
      label: "Saved pose name",
      type: "text",
      value: "New pose"
    },
    {
      key: "pose",
      label: "Saved rig pose",
      type: "select",
      values: [["", "Working pose / save as new"]]
    },
    { key: "clip", label: "Rig animation clip", type: "select", values: [] },
    { key: "clipName", label: "Rig clip name", type: "text", value: "Loop" },
    { key: "frames", label: "Rig clip frames", value: 24, min: 2, max: 120 },
    { key: "keyFrame", label: "Pose key frame", value: 1, min: 1, max: 120 },
    {
      key: "easing",
      label: "Pose key easing",
      type: "select",
      values: [
        ["linear", "Linear"],
        ["in", "Ease in"],
        ["out", "Ease out"],
        ["in-out", "Ease in/out"]
      ]
    },
    {
      key: "hold",
      label: "Hold pose until next key",
      type: "checkbox",
      value: false
    },
    { key: "loop", label: "Loop rig clip", type: "checkbox", value: true },
    {
      key: "pingpong",
      label: "Ping-pong rig clip",
      type: "checkbox",
      value: false
    },
    {
      key: "previewAnimation",
      label: "Preview rig animation",
      type: "checkbox",
      value: false
    },
    {
      key: "onion",
      label: "Rig onion skin preview",
      type: "checkbox",
      value: false
    },
    {
      key: "skeleton",
      label: "Show skeleton overlay",
      type: "checkbox",
      value: true
    },
    {
      key: "labels",
      label: "Show joint names",
      type: "checkbox",
      value: false
    },
    {
      key: "files",
      label: "Rig and pose JSON",
      type: "file",
      accept: ".json,application/json"
    }
  ],
  actions: [
    { id: "save", label: "Save bone & pose settings", primary: true },
    { id: "template", label: "Load rig template", primary: false },
    { id: "add", label: "Add child bone", primary: false },
    { id: "root", label: "Add root pivot", primary: false },
    { id: "delete", label: "Delete bone", primary: false },
    { id: "disconnect", label: "Disconnect bone", primary: false },
    { id: "ik", label: "Solve two-bone IK", primary: false },
    { id: "mirror", label: "Mirror working pose", primary: false },
    { id: "reset", label: "Reset working pose", primary: false },
    { id: "save-pose", label: "Save named pose", primary: false },
    { id: "load-pose", label: "Load named pose", primary: false },
    { id: "delete-pose", label: "Delete saved pose", primary: false },
    { id: "clip", label: "Create new rig clip", primary: false },
    { id: "key", label: "Add / replace pose key", primary: false },
    { id: "delete-key", label: "Delete pose key", primary: false },
    { id: "delete-clip", label: "Delete rig clip", primary: false },
    { id: "bake", label: "Bake rig animation", primary: false },
    { id: "bake-pose", label: "Bake pose on all frames", primary: false },
    { id: "remove-output", label: "Remove rig output", primary: false },
    { id: "export", label: "Export rig & poses JSON", primary: false },
    { id: "import", label: "Import rig & poses JSON", primary: false }
  ]
};

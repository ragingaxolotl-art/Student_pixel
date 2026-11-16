# Puppet Studio in the bottom-layout editor

This is the active clean editor with frames and layers along the bottom, editable layer FX dots, Normal/FX/− preview tabs, nested layers, and corrected 45-degree rotation. Puppet Studio is an addition to this editor. The separate expanded rigging editor is an archived reference, not the base for this work.

## Open and prepare

Click the Puppet Studio figure icon in Studios, below Palettes. Bring a character with its body parts already on separate layers. Choose its starting frame in the first dialog. A new rig starts with a custom Character pivot; templates are optional. Your artwork is retained.

The window follows the supplied sketch: Rig/Poses/Clips menus at the top left, template above the canvas, joint tools below the canvas, pose timeline beneath those tools, walking-guide controls at the bottom. The right column keeps preview, hierarchy, scrolling properties, and Save Rig/Generate Frames in separate areas.

## Rig your character

Fit bones adjusts pivots and lengths. Pose moves limbs without stretching bone lengths. Add joint extends the selected parent when you click an empty location on the character; click an existing handle to choose a parent. Add/remove joints is also available in the hierarchy. Parent bone builds nested branches.

Lock joint pins the selected pivot in the current pose. Double-click a pivot circle to toggle it; purple square outlines identify pinned joints. Bones can rotate around pinned pivots. Source layers & groups lets you assign existing artwork to a joint. A group binding moves its descendants, except parts assigned individually to other bones. Main-page groups still support nesting, collapse, inherited visibility/opacity/locks, and moving a branch together.

To raise a knee and keep the foot underneath: choose Pose, drag the knee into place, click Lock joint (or double-click the knee), then drag the foot tip. Lock follows the clicked knee/elbow point, even when dragging selected the upper bone's tip. The knee stays fixed while the lower leg rotates at its original length. Click the knee again or select the shin in the hierarchy to unlock it. A terminal tip or ambiguous fork has no unique lower pivot; select the intended joint circle or lower bone instead.

Lock/unlock automatically records the current frame's pose marker. Each marker keeps its own locks; if another marker reused the same named pose, a copy is made so that frame stays unchanged. New, unkeyed editing frames start unlocked and retain their displayed joint positions. If you rotate the foot after locking, use + Pose / replace to record that additional posture change. Returning to an existing marker restores its locks. During playback a keyed lock state lasts until the next marker. Existing foot/hand routes evaluate IK or fixed-pivot rotation from that pose's state; orange still shows portions outside reach. Adding a new marker inside an existing path interval remains protected: remove the path first.

Older global locks are copied into their existing saved and working poses when the rig opens. Their previous appearance is preserved, and individual markers can then be unlocked independently. Locks, explicit unlocked states, and their coordinates survive .piskel and rig JSON saves and undo/redo.

## Author poses and timing

The pose-purpose selector now supports:

- Key pose (red): an important action position.
- Breakdown (green): an authored pose defining the route between keys.
- In-between (purple): an authored intermediate position.
- Anticipation (blue): an authored preparation or pull-back pose.
- Overshoot (orange): an authored pose beyond the target.
- Settle (teal): an authored return or finishing pose.

These are organizational labels on poses you create; selecting Overshoot does not invent or modify a pose. Exaggeration is made by pushing joint positions, rotation or scale further. Use the pose tools to make that change, then record it.

Use the arrows or Pose key frame to choose a time, pose the character, and press + Pose / replace. Click a marker to load its pose. Changing the selector on an existing marker retags it without replacing its pose. Drag markers, or use left/right keys while a marker is focused, to adjust timing. Occupied frames are protected against accidental overwrite. Pose & cycle contains clip duration, easing, holds, and looping. Generate Frames interpolates through the recorded poses, including authored breakdowns and in-betweens.

Walking guides provides floor and head-bob limits. Add, rename, reposition, recolor, hide or remove horizontal/vertical guides. Guides and joint names are vector UI and are excluded from output pixels.

## Draw motion between poses

Select a joint, click between two pose markers, and use the curve button beside the pose-purpose selector (or Poses → Joint motion path). Choose the two adjacent poses and either the joint tip or an unlocked root pivot. Press Draw path, then draw on the canvas. White endpoints stay attached to the saved poses. Drag the interior dots to change the route; focus a dot and use arrow keys for precise changes (Shift moves by a tenth of a sprite pixel).

Scrub Path preview frame or play the preview to inspect the in-betweens. Cyan shows the requested route; orange shows motion limited by the limb's reach. Bone lengths stay fixed. Connected two-bone limb tips use IK; single-piece limbs rotate at their own pivot, without borrowing the torso. Free root pivot paths move a character branch. Connected pivots and pinned roots cannot be moved along a path.

Apply path saves one undoable change. Cancel path or Escape discards the draft. Ctrl/Cmd+Z and redo operate on draft edits while editing a path. Save Rig and Generate Frames become available after Apply or Cancel. Choose Edit saved path to revise it later, or Remove path to restore normal interpolation. Paths persist in .piskel files and exported rig JSON.

The existing poses stay exact. Paths use the first pose's easing and respect holds. Each path spans two adjacent forward pose markers; it cannot cross an authored breakdown or wrap from the last marker to the first. Remove the path before inserting a new marker inside it. Independent joint chains can have separate paths; overlapping paths that control the same chain are rejected. Unsupported scaled/sheared IK chains are rejected before applying.

## Save and generate

Save Rig preserves the editable setup in the project. Save the .piskel file to carry the rig, poses, timeline labels, groups, FX, and artwork together. Rig JSON export/import is separate from the artwork.

The yellow Generate Frames button creates animation frames on protected output layers. Source pixels and editable effect attachments are retained. Source effects are sampled at the reference frame before transformed output is generated. Remove generated frames restores bound source visibility. Save Rig and Generate Frames are separate actions.


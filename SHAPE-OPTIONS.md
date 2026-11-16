# Rectangle and ellipse options

Select the existing Rectangle or Ellipse tool. Fill, Outline color, Fill color,
and outline Width appear beside the project title. In a narrow window, open
**Shape options** in the same title bar.

- **Empty** is the default: draw an outline and leave the interior unchanged.
- **Filled + outline** uses separate fill and outline colors.
- **Fill only** draws the fill color without an outline.

Outline color follows the primary drawing color. Fill initially follows that
color, and can be chosen independently in its picker, including opacity or
transparency. Border width uses the existing pen-size setting, from 1–32 pixels.
Shift constrains a rectangle to a square and an ellipse to a circle.

Rectangle and Ellipse each retain their choices while this editor is open.
Reloading starts both in Empty mode. Options hide when another tool is selected;
the existing Dither tool keeps its own title-bar options.

Preview and committed shapes use the same geometry. Undo/redo records the
actual fill style and colors, so later changes to the options do not change
older strokes. Saved .piskel files preserve the drawn pixels.

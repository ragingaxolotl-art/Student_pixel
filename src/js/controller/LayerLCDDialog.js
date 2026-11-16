(function () {
  pskl.controller.LayersListController.prototype.openLCD = function () {
    var studio = this;
    var c = this.piskelController,
      source = c.getPiskel(),
      selected = c.getCurrentLayer(),
      dialog = document.createElement("dialog");
    dialog.className = "layer-lcd-dialog";
    dialog.setAttribute("aria-label", "LCD screen settings");
    dialog.innerHTML =
      '<h3>LCD screen</h3><p>Scale the whole canvas; apply display cells to this layer across all frames. Other layers scale with crisp pixels. Undo restores the original size.</p><label>Cell size <input aria-label="LCD cell size" type="number" min="4" max="12" value="4"></label><label>Grid width <input aria-label="LCD grid width" type="number" min="1" max="3" value="1"></label><label>Scanline darkness (%) <input aria-label="LCD scanline darkness" type="number" min="0" max="100" value="30"></label><label>Grid color <input aria-label="LCD grid color" type="color" value="#151515"></label><label><input aria-label="LCD RGB subpixels" type="checkbox" checked> RGB subpixels</label><p class="lcd-status" role="status"></p><button type="button" class="lcd-generate">Generate LCD canvas</button><button type="button" class="lcd-cancel">Cancel</button>';
    var pending = studio.options(),
      previousLCD = studio.lcdPreviewOptions,
      generated = false;
    var fields = dialog.querySelectorAll("input"),
      status = dialog.querySelector(".lcd-status"),
      generate = dialog.querySelector(".lcd-generate");
    var options = function () {
      return {
        size: Number(fields[0].value),
        gap: Number(fields[1].value),
        scanline: Number(fields[2].value),
        color: fields[3].value,
        rgb: fields[4].checked
      };
    };
    var check = function () {
      var o = options();
      if (
        source.getWidth() *
          source.getHeight() *
          o.size *
          o.size *
          c.getFrameCount() *
          source.getLayers().length >
        16000000
      ) {
        throw new Error(
          "This output exceeds 16 million layer pixels. Reduce cell size or project size."
        );
      }
      return o;
    };
    fields[2].value = pending.amount;
    fields[3].value = pending.color;
    if (previousLCD) {
      fields[0].value = previousLCD.lcdSize;
      fields[1].value = previousLCD.lcdGap;
      fields[4].checked = previousLCD.lcdRGB;
    }
    var preview = function () {
      try {
        var o = check(),
          utils = pskl.utils.SpriteEffectsUtils;
        utils.integer(o.size, 4, 12, "Cell size");
        utils.integer(o.gap, 1, 3, "Grid width");
        utils.integer(o.scanline, 0, 100, "Scanline darkness");
        if (o.rgb && o.size - o.gap < 3) {
          throw new Error(
            "RGB subpixels need at least three columns inside each cell."
          );
        }
        studio.lcdPreviewOptions = {
          lcdSize: o.size,
          lcdGap: o.gap,
          lcdRGB: o.rgb,
          amount: o.scanline,
          color: o.color
        };
        studio.preview();
        status.textContent =
          source.getWidth() * o.size +
          " × " +
          source.getHeight() * o.size +
          " pixels · all " +
          c.getFrameCount() +
          " frames. See the FX preview tab.";
        generate.disabled = false;
      } catch (e) {
        status.textContent = e.message;
        generate.disabled = true;
      }
    };
    fields.forEach(function (input) {
      input.addEventListener("input", preview);
    });
    generate.onclick = function () {
      try {
        var o = check();
        var layers = source.getLayers().map(function (layer) {
          var output = pskl.model.Layer.fromFrames(
            layer.getName(),
            layer.getFrames().map(function (frame) {
              return layer === selected
                ? pskl.utils.SpriteEffectsUtils.lcd(frame, o)
                : pskl.utils.SpriteEffectsUtils.scale(frame, o.size);
            })
          );
          output.opacity =
            layer === selected
              ? Number(studio.options().opacity) / 100
              : layer.getOpacity();
          output.rowState = JSON.parse(JSON.stringify(layer.rowState));
          return output;
        });
        var result = pskl.model.Piskel.fromLayers(
          layers,
          c.getFPS(),
          source.getDescriptor()
        );
        result.hiddenFrames = source.hiddenFrames.slice();
        c.setPiskel(result, { preserveState: true });
        generated = true;
        studio.closePreview();
        dialog.close();
      } catch (e) {
        status.textContent = e.message;
      }
    };
    dialog.querySelector(".lcd-cancel").onclick = function () {
      dialog.close();
    };
    dialog.addEventListener("close", function () {
      dialog.remove();
      if (!generated) {
        studio.lcdPreviewOptions = previousLCD;
        studio.preview();
      }
    });
    document.body.append(dialog);
    dialog.showModal();
    preview();
  };
})();

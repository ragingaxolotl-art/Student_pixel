(function () {
  var ns = $.namespace("pskl.selection");

  var SELECTION_REPLAY = {
    PASTE: "REPLAY_PASTE",
    ERASE: "REPLAY_ERASE",
    LIFT: "REPLAY_LIFT"
  };

  ns.SelectionManager = function (piskelController) {
    this.piskelController = piskelController;

    this.currentSelection = null;
  };

  ns.SelectionManager.prototype.init = function () {
    $.subscribe(Events.SELECTION_CREATED, this.onSelectionCreated_.bind(this));
    $.subscribe(
      Events.SELECTION_DISMISSED,
      this.onSelectionDismissed_.bind(this)
    );
    $.subscribe(
      Events.SELECTION_MOVE_REQUEST,
      this.onSelectionMoved_.bind(this)
    );
    $.subscribe(Events.CLIPBOARD_COPY, this.copy.bind(this));
    $.subscribe(Events.CLIPBOARD_CUT, this.copy.bind(this));
    $.subscribe(Events.CLIPBOARD_PASTE, this.paste.bind(this));

    var shortcuts = pskl.service.keyboard.Shortcuts;
    pskl.app.shortcutService.registerShortcut(
      shortcuts.SELECTION.DELETE,
      this.onDeleteShortcut_.bind(this)
    );
    pskl.app.shortcutService.registerShortcut(
      shortcuts.SELECTION.COMMIT,
      this.commit.bind(this)
    );
    pskl.app.shortcutService.registerShortcut(
      shortcuts.SELECTION.LIFT,
      this.lift.bind(this)
    );

    $.subscribe(Events.TOOL_SELECTED, this.onToolSelected_.bind(this));
    $.subscribe(
      Events.PISKEL_RESET,
      function () {
        if (
          (this.selectionPiskel_ &&
            this.selectionPiskel_ !== this.piskelController.getPiskel()) ||
          (this.activeTool_ && this.activeTool_.isMovingContent_)
        ) {
          $.publish(Events.SELECTION_DISMISSED);
        }
      }.bind(this)
    );
  };

  /**
   * @private
   */
  ns.SelectionManager.prototype.cleanSelection_ = function () {
    if (this.currentSelection) {
      this.currentSelection.reset();
      this.currentSelection = null;
    }
  };

  /**
   * @private
   */
  ns.SelectionManager.prototype.onToolSelected_ = function (evt, tool) {
    if (this.activeTool_ && this.activeTool_.isMovingContent_) {
      $.publish(Events.SELECTION_DISMISSED);
    }
    var isSelectionTool =
      tool instanceof pskl.tools.drawing.selection.BaseSelect;
    if (!isSelectionTool) {
      $.publish(Events.SELECTION_DISMISSED);
    } else {
      tool.selection = this.currentSelection;
      tool.hasSelection = !!(
        this.currentSelection && this.currentSelection.pixels.length
      );
      if (tool.hasSelection) {
        tool.drawSelectionOnOverlay_(pskl.app.drawingController.overlayFrame);
      }
    }
    this.activeTool_ = isSelectionTool ? tool : null;
  };

  ns.SelectionManager.prototype.lift = function () {
    var c = this.piskelController,
      layer = c.getCurrentLayer(),
      frame = c.getCurrentFrame(),
      g = pskl.utils.LayerGroupUtils;
    if (pskl.app.drawingController.isClicked) {
      return;
    }
    if (!this.currentSelection || !this.currentSelection.pixels.length) {
      $.publish(Events.SHOW_NOTIFICATION, [
        { content: "Select some pixels first." }
      ]);
      return;
    }
    if (
      layer.isLocked() ||
      g.isGroup(layer) ||
      layer.rowState.hidden ||
      g.ancestors(c.getLayers(), layer).some(function (p) {
        return p.rowState.hidden;
      })
    ) {
      $.publish(Events.SHOW_NOTIFICATION, [
        { content: "Choose an unlocked, visible artwork layer to lift pixels." }
      ]);
      return;
    }
    var pixels = ns.BaseSelection.combine(
      [],
      this.currentSelection.pixels,
      "replace",
      frame
    )
      .pixels.map(function (p) {
        return { col: p.col, row: p.row, color: frame.getPixel(p.col, p.row) };
      })
      .filter(function (p) {
        return p.color >>> 24;
      });
    if (!pixels.length) {
      $.publish(Events.SHOW_NOTIFICATION, [
        { content: "The selection contains no painted pixels on this frame." }
      ]);
      return;
    }
    var name = layer.getName() + " · lifted",
      suffix = 2;
    while (
      c.getLayers().some(function (l) {
        return l.getName() === name;
      })
    ) {
      name = layer.getName() + " · lifted " + suffix++;
    }
    var data = {
        type: SELECTION_REPLAY.LIFT,
        pixels: pixels,
        name: name,
        id: pskl.utils.Uuid.generate(),
        parent: layer.rowState.parentGroup || null,
        opacity: layer.getOpacity()
      },
      state = {
        layerIndex: c.getCurrentLayerIndex(),
        frameIndex: c.getCurrentFrameIndex()
      };
    $.publish(Events.SELECTION_DISMISSED);
    this.liftPixels_(frame, data);
    $.publish(Events.PISKEL_SAVE_STATE, {
      type: pskl.service.HistoryService.REPLAY,
      scope: this,
      replay: data,
      state: state
    });
    $.publish(Events.PISKEL_RESET);
  };
  ns.SelectionManager.prototype.liftPixels_ = function (frame, data) {
    var c = this.piskelController,
      source = c.getCurrentLayer(),
      index = c.getCurrentLayerIndex(),
      lifted = pskl.model.Layer.fromFrames(
        data.name,
        source.getFrames().map(function (f) {
          return pskl.model.Frame.createEmptyFromFrame(f);
        })
      ),
      target = lifted.getFrameAt(c.getCurrentFrameIndex());
    lifted.rowState.parentGroup = data.parent;
    lifted.rowState.groupNodeId = data.id;
    lifted.setOpacity(data.opacity);
    data.pixels.forEach(function (p) {
      target.setPixel(p.col, p.row, p.color);
      frame.setPixel(p.col, p.row, Constants.TRANSPARENT_COLOR);
    });
    c.getPiskel().addLayerAt(lifted, index + 1);
    c.getWrappedPiskelController().setCurrentLayerIndex(index + 1);
  };

  /**
   * @private
   */
  ns.SelectionManager.prototype.onSelectionDismissed_ = function (evt) {
    this.cleanSelection_();
  };

  ns.SelectionManager.prototype.onDeleteShortcut_ = function (evt) {
    if (this.currentSelection) {
      this.erase();
    } else {
      return true; // bubble
    }
  };

  ns.SelectionManager.prototype.erase = function () {
    if (this.piskelController.getCurrentLayer().isLocked()) {
      return;
    }
    var pixels = this.currentSelection.pixels;
    var currentFrame = this.piskelController.getCurrentFrame();
    for (var i = 0, l = pixels.length; i < l; i++) {
      currentFrame.setPixel(
        pixels[i].col,
        pixels[i].row,
        Constants.TRANSPARENT_COLOR
      );
    }

    $.publish(Events.PISKEL_SAVE_STATE, {
      type: pskl.service.HistoryService.REPLAY,
      scope: this,
      replay: {
        type: SELECTION_REPLAY.ERASE,
        pixels: JSON.parse(JSON.stringify(pixels))
      }
    });
  };

  ns.SelectionManager.prototype.copy = function (event, domEvent) {
    if (this.currentSelection && this.piskelController.getCurrentFrame()) {
      this.currentSelection.fillSelectionFromFrame(
        this.piskelController.getCurrentFrame()
      );
      if (domEvent) {
        domEvent.clipboardData.setData(
          "text/plain",
          this.currentSelection.stringify()
        );
        domEvent.preventDefault();
      }
      if (event.type === Events.CLIPBOARD_CUT) {
        this.erase();
      }
    }
  };

  ns.SelectionManager.prototype.paste = function (event, domEvent) {
    if (this.piskelController.getCurrentLayer().isLocked()) {
      return;
    }
    var items = domEvent ? domEvent.clipboardData.items : [];

    try {
      for (var i = 0; i < items.length; i++) {
        var item = items[i];

        if (/^image/i.test(item.type)) {
          this.pasteImage_(item);
          event.stopPropagation();
          return;
        }

        if (/^text\/plain/i.test(item.type)) {
          this.pasteText_(item);
          event.stopPropagation();
          return;
        }
      }
    } catch {
      // Some of the clipboard APIs are not available on Safari/IE
      // Allow Piskel to fallback on local currentSelection pasting.
    }

    // temporarily keeping this code path for tests and fallbacks.
    if (this.currentSelection && this.currentSelection.hasPastedContent) {
      this.pastePixelsOnCurrentFrame_(this.currentSelection.pixels);
    }
  };

  ns.SelectionManager.prototype.pasteImage_ = function (clipboardItem) {
    var blob = clipboardItem.getAsFile();
    pskl.utils.FileUtils.readImageFile(
      blob,
      function (image) {
        pskl.app.fileDropperService.dropPosition_ = { x: 0, y: 0 };
        pskl.app.fileDropperService.onImageLoaded_(image, blob);
      }.bind(this)
    );
  };

  ns.SelectionManager.prototype.pasteText_ = function (clipboardItem) {
    var _blob = clipboardItem.getAsString(
      function (selectionString) {
        var selectionData;
        try {
          // TODO: ideally we should validate the parsed data against a piskel selection
          // schema instead of accepting any arbitrary JSON as a valid selection.
          selectionData = JSON.parse(selectionString);
        } catch {
          // The clipboard does not contain a potential piskel selection, dropping.
          return;
        }

        if (!selectionData) {
          return;
        }

        var time = selectionData.time;
        var pixels = selectionData.pixels;

        if (this.currentSelection && this.currentSelection.time >= time) {
          // If the local selection is newer or equal to the one coming from the clipboard event
          // use the local one. The reason is that the "move" information is only updated locally
          // without synchronizing it to the clipboard.
          // TODO: the selection should store the origin of the selection and the selection itself
          // separately.
          pixels = this.currentSelection.pixels;
        }

        if (pixels) {
          // If the current clipboard data is some random text, pixels will not be defined.
          this.pastePixelsOnCurrentFrame_(pixels);
        }
      }.bind(this)
    );
  };

  ns.SelectionManager.prototype.pastePixelsOnCurrentFrame_ = function (pixels) {
    var frame = this.piskelController.getCurrentFrame();

    this.pastePixels_(frame, pixels);

    $.publish(Events.PISKEL_SAVE_STATE, {
      type: pskl.service.HistoryService.REPLAY,
      scope: this,
      replay: {
        type: SELECTION_REPLAY.PASTE,
        pixels: JSON.parse(JSON.stringify(pixels.slice(0)))
      }
    });
  };

  /**
   * If the currently selected tool is a selection tool, call commitSelection handler on
   * the current tool instance.
   */
  ns.SelectionManager.prototype.commit = function () {
    var tool = pskl.app.drawingController.currentToolBehavior;
    var isSelectionTool =
      tool instanceof pskl.tools.drawing.selection.BaseSelect;
    if (isSelectionTool) {
      tool.commitSelection();
    }
  };

  ns.SelectionManager.prototype.replay = function (frame, replayData) {
    if (replayData.type === SELECTION_REPLAY.LIFT) {
      this.liftPixels_(frame, replayData);
    } else if (replayData.type === SELECTION_REPLAY.PASTE) {
      this.pastePixels_(frame, replayData.pixels);
    } else if (replayData.type === SELECTION_REPLAY.ERASE) {
      replayData.pixels.forEach(function (pixel) {
        frame.setPixel(pixel.col, pixel.row, Constants.TRANSPARENT_COLOR);
      });
    }
  };

  ns.SelectionManager.prototype.pastePixels_ = function (frame, pixels) {
    pixels.forEach(function (pixel) {
      if (pixel.color === Constants.TRANSPARENT_COLOR || pixel.color === null) {
        return;
      }
      frame.setPixel(pixel.col, pixel.row, pixel.color);
    });
  };

  /**
   * @private
   */
  ns.SelectionManager.prototype.onSelectionCreated_ = function (
    evt,
    selection
  ) {
    if (selection) {
      this.currentSelection = selection;
      if (this.piskelController.getPiskel) {
        this.selectionPiskel_ = this.piskelController.getPiskel();
      }
    } else {
      console.error("No selection provided to SelectionManager");
    }
  };

  /**
   * @private
   */
  ns.SelectionManager.prototype.onSelectionMoved_ = function (
    evt,
    colDiff,
    rowDiff
  ) {
    if (this.currentSelection) {
      this.currentSelection.move(colDiff, rowDiff);
    } else {
      console.error(
        "Bad state: No currentSelection set when trying to move it in SelectionManager"
      );
    }
  };
})();

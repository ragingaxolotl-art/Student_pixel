(function () {
  var p = pskl.controller.dialogs.ParticleStudioDialogController.prototype,
    u = pskl.utils,
    clone = u.ToolStateUtils.clone;
  p.coordinate = function (event) {
    var rect = this.canvas.getBoundingClientRect();
    return {
      x: Math.max(
        -4096,
        Math.min(
          4096,
          ((event.clientX - rect.left) * this.canvas.width) / rect.width
        )
      ),
      y: Math.max(
        -4096,
        Math.min(
          4096,
          ((event.clientY - rect.top) * this.canvas.height) / rect.height
        )
      )
    };
  };
  p.bindInteraction = function () {
    this.addEventListener(this.wrapper, "pointerdown", function (event) {
      if (
        event.button !== 0 ||
        !event.target.closest(".particle-image") ||
        !this.emitter()
      ) {
        return;
      }
      this.stop();
      this.finishField();
      var e = this.emitter(),
        point = this.coordinate(event),
        pos = this.emitterPosition(e),
        handle = event.target.closest("[data-point]");
      if (
        this.mode === "move" &&
        Math.hypot(point.x - pos.x, point.y - pos.y) >
          Math.max(3, (14 * this.canvas.width) / this.canvas.clientWidth)
      ) {
        var nearest = this.config.emitters
          .slice()
          .reverse()
          .find(
            function (item) {
              var v = this.emitterPosition(item);
              return (
                Math.hypot(point.x - v.x, point.y - v.y) <
                Math.max(3, (14 * this.canvas.width) / this.canvas.clientWidth)
              );
            }.bind(this)
          );
        if (nearest) {
          this.selected = nearest.id;
          this.sync();
          e = nearest;
          pos = this.emitterPosition(e);
        } else {
          return;
        }
      }
      if (this.mode === "edit" && !handle) {
        return;
      }
      event.preventDefault();
      this.wrapper.setPointerCapture(event.pointerId);
      this.gesture = {
        before: clone(this.config),
        point: point,
        position: pos,
        mode: this.mode,
        index: handle ? Number(handle.dataset.point) : -1,
        moved: false
      };
      if (this.mode === "path") {
        e.path = [point];
        e.followPath = false;
        this.paint();
      }
    });
    this.addEventListener(this.wrapper, "pointermove", function (event) {
      if (!this.gesture) {
        return;
      }
      var g = this.gesture,
        e = this.emitter(),
        point = this.coordinate(event),
        original = g.before.emitters.find(function (item) {
          return item.id === e.id;
        });
      g.moved =
        g.moved || Math.hypot(point.x - g.point.x, point.y - g.point.y) > 0.05;
      if (g.mode === "move") {
        var dx = point.x - g.point.x,
          dy = point.y - g.point.y;
        Object.assign(e, clone(original));
        if (e.keys.length) {
          var pos = u.ParticleTimelineUtils.position(e, this.frame);
          u.ParticleTimelineUtils.key(e, this.frame, {
            x: pos.x + dx,
            y: pos.y + dy
          });
        } else {
          u.ParticleTimelineUtils.translate(e, dx, dy);
        }
      } else if (g.mode === "path") {
        var last = e.path[e.path.length - 1];
        if (Math.hypot(last.x - point.x, last.y - point.y) >= 0.4) {
          e.path.push(point);
          if (e.path.length > 128) {
            e.path = e.path.filter(function (_, i) {
              return i % 2 === 0 || i === e.path.length - 1;
            });
          }
        }
      } else if (g.mode === "edit") {
        e.path[g.index] = point;
      } else if (g.mode === "size") {
        var distance = Math.hypot(
          point.x - g.position.x,
          point.y - g.position.y
        );
        e.size = Math.max(1, Math.min(32, Math.round(distance)));
        e.sizeEnd = Math.max(
          0,
          Math.min(32, (original.sizeEnd * e.size) / original.size)
        );
      }
      this.paint();
      clearTimeout(this.renderTimer);
      this.renderTimer = setTimeout(this.render.bind(this), 30);
    });
    var finish = function (event) {
      var g = this.gesture;
      if (!g) {
        return;
      }
      this.gesture = null;
      if (event.type === "pointercancel" || !g.moved) {
        this.config = g.before;
      } else {
        var e = this.emitter();
        if (g.mode === "path" && e.path.length > 1) {
          e.path = u.JointMotionPathUtils.compact(e.path).slice(0, 128);
          e.followPath = true;
          // The route is authored in canvas coordinates; its first point is the base origin.
          var dx = e.path[0].x - e.x,
            dy = e.path[0].y - e.y;
          e.x += dx;
          e.y += dy;
          e.keys.forEach(function (k) {
            k.x += dx;
            k.y += dy;
          });
        }
        try {
          u.ParticleStudioUtils.validate(this.config);
          this.push(g.before);
        } catch (error) {
          this.config = g.before;
          this.status.textContent = error.message;
        }
      }
      this.sync();
      this.render();
    };
    this.addEventListener(this.wrapper, "pointerup", finish);
    this.addEventListener(this.wrapper, "pointercancel", finish);
    this.addEventListener(this.wrapper, "keydown", function (event) {
      var key = event.key.toLowerCase();
      if ((event.ctrlKey || event.metaKey) && ["z", "y"].includes(key)) {
        event.preventDefault();
        event.stopPropagation();
        if (this.gesture) {
          this.config = this.gesture.before;
          this.gesture = null;
          this.sync();
          this.render();
        } else {
          this.undo(key === "y" || event.shiftKey);
        }
        return;
      }
      if (key === "escape" && this.gesture) {
        event.preventDefault();
        event.stopPropagation();
        this.config = this.gesture.before;
        this.gesture = null;
        this.sync();
        this.render();
        return;
      }
      var handle = event.target.closest("[data-point]"),
        delta = {
          ArrowLeft: [-1, 0],
          ArrowRight: [1, 0],
          ArrowUp: [0, -1],
          ArrowDown: [0, 1]
        }[event.key];
      if (handle && delta) {
        event.preventDefault();
        event.stopPropagation();
        var index = Number(handle.dataset.point);
        this.change(function () {
          var point = this.emitter().path[index];
          point.x += delta[0] * (event.shiftKey ? 0.1 : 1);
          point.y += delta[1] * (event.shiftKey ? 0.1 : 1);
        });
        var next = this.overlay.querySelector('[data-point="' + index + '"]');
        if (next) {
          next.focus();
        }
      }
    });
    // Shortcuts in the editor use keyup too; keep studio edits scoped here.
    this.addEventListener(this.wrapper, "keyup", function (event) {
      if (
        (event.ctrlKey || event.metaKey) &&
        ["z", "y"].includes(event.key.toLowerCase())
      ) {
        event.preventDefault();
        event.stopPropagation();
      }
    });
    var track = this.wrapper.querySelector(".particle-track");
    this.addEventListener(track, "dragover", function (event) {
      event.preventDefault();
    });
    this.addEventListener(track, "drop", function (event) {
      event.preventDefault();
      var rect = track.getBoundingClientRect();
      this.retime(
        this.keyDragging,
        Math.round(
          ((event.clientX - rect.left) / rect.width) * (this.config.frames - 1)
        )
      );
    });
    this.addEventListener(track, "click", function (event) {
      if (event.target !== track) {
        return;
      }
      var rect = track.getBoundingClientRect();
      this.frame = Math.max(
        0,
        Math.min(
          this.config.frames - 1,
          Math.round(
            ((event.clientX - rect.left) / rect.width) *
              (this.config.frames - 1)
          )
        )
      );
      this.stop();
      this.draw();
      this.drawTimeline();
    });
  };
  p.bindWindow = function () {
    this.originalWindowStyle = this.wrapper.parentElement.style.cssText;
    var container = this.wrapper.parentElement,
      clamp = function (geometry) {
        var w = Math.max(
            Math.min(520, innerWidth - 12),
            Math.min(innerWidth - 12, geometry.width)
          ),
          h = Math.max(
            Math.min(440, innerHeight - 12),
            Math.min(innerHeight - 12, geometry.height)
          );
        return {
          left: Math.max(6, Math.min(innerWidth - w - 6, geometry.left)),
          top: Math.max(6, Math.min(innerHeight - h - 6, geometry.top)),
          width: w,
          height: h
        };
      };
    var apply = function (g) {
      g = clamp(g);
      ["left", "top", "width", "height"].forEach(function (k) {
        container.style[k] = g[k] + "px";
      });
    };
    var save = function () {
      var rect = container.getBoundingClientRect();
      try {
        localStorage.setItem(
          "piskel.particleStudioWindow",
          JSON.stringify({
            left: rect.left,
            top: rect.top,
            width: rect.width,
            height: rect.height
          })
        );
      } catch (_) {
        /* preferences are optional */
      }
    };
    try {
      var stored = JSON.parse(
        localStorage.getItem("piskel.particleStudioWindow")
      );
      if (
        stored &&
        ["left", "top", "width", "height"].every(function (k) {
          return Number.isFinite(stored[k]);
        })
      ) {
        apply(stored);
      } else {
        apply({
          left: (innerWidth - Math.min(1000, innerWidth - 32)) / 2,
          top: 20,
          width: Math.min(1000, innerWidth - 32),
          height: Math.min(690, innerHeight - 40)
        });
      }
    } catch (_) {
      apply({ left: 20, top: 20, width: 900, height: 650 });
    }
    this.addEventListener(this.wrapper, "pointerdown", function (event) {
      if (event.button !== 0) {
        return;
      }
      var resize = event.target.closest(".particle-resize"),
        heading = event.target.closest(".particle-heading");
      if (!resize && (!heading || event.target.closest("button"))) {
        return;
      }
      var rect = container.getBoundingClientRect();
      this.windowGesture = {
        resize: !!resize,
        x: event.clientX,
        y: event.clientY,
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height
      };
      event.preventDefault();
      this.wrapper.setPointerCapture(event.pointerId);
    });
    this.addEventListener(this.wrapper, "pointermove", function (event) {
      var g = this.windowGesture;
      if (!g) {
        return;
      }
      var dx = event.clientX - g.x,
        dy = event.clientY - g.y;
      apply({
        left: g.left + (g.resize ? 0 : dx),
        top: g.top + (g.resize ? 0 : dy),
        width: g.width + (g.resize ? dx : 0),
        height: g.height + (g.resize ? dy : 0)
      });
    });
    this.addEventListener(this.wrapper, "pointerup", function () {
      if (this.windowGesture) {
        this.windowGesture = null;
        save();
      }
    });
    this.addEventListener(this.wrapper, "pointercancel", function () {
      this.windowGesture = null;
      save();
    });
    this.addEventListener(window, "resize", function () {
      var rect = container.getBoundingClientRect();
      apply({
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height
      });
    });
  };
})();

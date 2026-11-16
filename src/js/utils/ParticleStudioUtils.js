(function () {
  var ns = $.namespace("pskl.utils"),
    u = ns.ParticleSpriteUtils;
  ns.ParticleStudioUtils = {
    preset: function (name, width, height) {
      var o = {
        name: name.charAt(0).toUpperCase() + name.slice(1),
        enabled: true,
        count: 48,
        life: 24,
        lifeJitter: 30,
        mode: "continuous",
        emission: "point",
        x: Math.floor(width / 2),
        y: Math.floor(height * 0.8),
        areaWidth: Math.max(2, Math.floor(width / 2)),
        areaHeight: 2,
        direction: -90,
        spread: 35,
        speed: 12,
        speedJitter: 35,
        gravity: -4,
        wind: 0,
        drag: 15,
        turbulence: 2,
        orbit: 0,
        spin: 0,
        size: 2,
        sizeEnd: 0,
        shape: "circle",
        colorStart: "#fff6ad",
        colorMid: "#ff8a28",
        colorEnd: "#b82d25",
        alphaStart: 100,
        alphaEnd: 0,
        trails: 1,
        blend: "over",
        collision: "none",
        bounce: 60,
        attractX: Math.floor(width / 2),
        attractY: Math.floor(height / 2),
        attract: 0,
        sourceLayer: 0,
        spriteMode: "life",
        tint: 0,
        palette: false,
        alphaDither: false,
        followPath: false
      };
      if (name === "smoke") {
        Object.assign(o, {
          count: 24,
          speed: 5,
          size: 1,
          sizeEnd: 6,
          colorStart: "#777788",
          colorMid: "#555566",
          colorEnd: "#333344",
          alphaStart: 60,
          turbulence: 4,
          gravity: -2
        });
      }
      if (name === "rain") {
        Object.assign(o, {
          emission: "box",
          x: 0,
          y: 0,
          areaWidth: width,
          areaHeight: Math.max(1, height / 4),
          direction: 80,
          spread: 3,
          speed: 40,
          gravity: 15,
          size: 1,
          sizeEnd: 1,
          shape: "pixel",
          trails: 3,
          colorStart: "#b8eaff",
          colorMid: "#8ac4ea",
          colorEnd: "#6389c0",
          alphaEnd: 60
        });
      }
      if (name === "snow") {
        Object.assign(o, {
          emission: "box",
          x: 0,
          y: 0,
          areaWidth: width,
          areaHeight: height,
          direction: 90,
          spread: 20,
          speed: 4,
          gravity: 0,
          turbulence: 3,
          size: 1,
          sizeEnd: 1,
          shape: "pixel",
          trails: 0,
          colorStart: "#ffffff",
          colorMid: "#d8edff",
          colorEnd: "#b1cde5",
          alphaEnd: 0
        });
      }
      if (name === "sparks") {
        Object.assign(o, {
          mode: "burst",
          direction: -90,
          spread: 360,
          speed: 24,
          gravity: 20,
          drag: 5,
          shape: "pixel",
          size: 1,
          trails: 3
        });
      }
      if (name === "fountain") {
        Object.assign(o, {
          colorStart: "#ddffff",
          colorMid: "#43acff",
          colorEnd: "#2943cc",
          gravity: 30,
          speed: 28,
          spread: 25,
          size: 1,
          sizeEnd: 1,
          trails: 2
        });
      }
      if (name === "magic") {
        Object.assign(o, {
          emission: "ring",
          areaWidth: Math.max(2, width / 2),
          direction: -90,
          spread: 360,
          speed: 3,
          gravity: 0,
          turbulence: 3,
          orbit: 8,
          shape: "star",
          size: 3,
          sizeEnd: 0,
          colorStart: "#ffffff",
          colorMid: "#cf79ff",
          colorEnd: "#4f73ff",
          blend: "add"
        });
      }
      if (name === "embers") {
        Object.assign(o, {
          emission: "box",
          x: 0,
          y: height - 2,
          areaWidth: width,
          count: 24,
          speed: 5,
          gravity: -2,
          shape: "pixel",
          size: 1,
          sizeEnd: 1,
          turbulence: 3,
          trails: 0
        });
      }
      return o;
    },
    config: function (p, o) {
      var saved = p.toolState.particleStudio || {
          version: 1,
          frames: 24,
          seed: 1,
          warmup: 0,
          emitters: [
            Object.assign(
              { id: "default" },
              this.preset("fire", p.getWidth(), p.getHeight())
            )
          ]
        },
        config = ns.ToolStateUtils.clone(saved);
      if (
        !Array.isArray(config.emitters) ||
        config.emitters.some(function (e) {
          return !e || typeof e !== "object";
        })
      ) {
        throw new Error("Choose a valid particle effect with emitters.");
      }
      if (config.loop === undefined) {
        config.loop = true;
      }
      config.emitters.forEach(function (e) {
        if (e.start === undefined) {
          e.start = 0;
        }
        if (e.end === undefined) {
          e.end = config.frames - 1;
        }
        if (!e.keys) {
          e.keys = [];
        }
        if (!e.path) {
          e.path =
            e.followPath && p.toolState.motionPath
              ? ns.ToolStateUtils.clone(p.toolState.motionPath.points)
              : [];
        }
        if (!e.pathMode) {
          e.pathMode = "particle";
        }
      });
      if (o) {
        ["frames", "seed", "warmup"].forEach(function (k) {
          config[k] = o[k];
        });
        var selected = config.emitters.find(function (e) {
          return e.id === o.emitter;
        });
        if (selected) {
          Object.keys(this.preset("fire", 1, 1)).forEach(function (k) {
            if (o[k] !== undefined) {
              selected[k] = o[k];
            }
          });
        }
      }
      return config;
    },
    validate: function (config) {
      if (!config || config.version !== 1) {
        throw new Error("Choose a version-1 particle effect.");
      }
      ns.SpriteEffectsUtils.integer(config.frames, 2, 120, "Particle frames");
      ns.SpriteEffectsUtils.integer(config.seed, 0, 65535, "Particle seed");
      ns.SpriteEffectsUtils.integer(config.warmup, 0, 600, "Warmup phase");
      if (!Array.isArray(config.emitters) || config.emitters.length > 8) {
        throw new Error("Use up to eight emitters.");
      }
      if (config.loop !== undefined && typeof config.loop !== "boolean") {
        throw new Error("Invalid loop setting.");
      }
      var work = 0,
        pixels = 0,
        ids = new Set();
      config.emitters.forEach(function (e) {
        if (
          !e ||
          typeof e.name !== "string" ||
          e.name.length > 80 ||
          typeof e.id !== "string" ||
          !/^[a-zA-Z0-9_-]{1,100}$/.test(e.id) ||
          ids.has(e.id)
        ) {
          throw new Error("Invalid emitter name.");
        }
        ids.add(e.id);
        ["enabled", "palette", "alphaDither", "followPath"].forEach(
          function (k) {
            if (typeof e[k] !== "boolean") {
              throw new Error("Invalid emitter " + k + ".");
            }
          }
        );
        if (
          e.sourceId !== undefined &&
          e.sourceId !== null &&
          (typeof e.sourceId !== "string" || e.sourceId.length > 100)
        ) {
          throw new Error("Invalid source layer.");
        }
        ns.SpriteEffectsUtils.integer(
          e.start === undefined ? 0 : e.start,
          0,
          config.frames - 1,
          "Emission start"
        );
        ns.SpriteEffectsUtils.integer(
          e.end === undefined ? config.frames - 1 : e.end,
          e.start || 0,
          config.frames - 1,
          "Emission end"
        );
        if (
          e.pathMode !== undefined &&
          !["particle", "emitter"].includes(e.pathMode)
        ) {
          throw new Error("Choose a particle or emitter path.");
        }
        if (
          e.path !== undefined &&
          (!Array.isArray(e.path) ||
            e.path.length > 128 ||
            e.path.some(function (p) {
              return (
                !p ||
                !Number.isFinite(p.x) ||
                !Number.isFinite(p.y) ||
                Math.abs(p.x) > 4096 ||
                Math.abs(p.y) > 4096
              );
            }))
        ) {
          throw new Error("Invalid particle path.");
        }
        if (
          e.followPath &&
          (!e.path ||
            e.path.length < 2 ||
            e.path.every(function (p) {
              return Math.hypot(p.x - e.path[0].x, p.y - e.path[0].y) < 1e-6;
            }))
        ) {
          throw new Error("Draw a path with at least two different points.");
        }
        var times = new Set();
        if (
          e.keys !== undefined &&
          (!Array.isArray(e.keys) || e.keys.length > 120)
        ) {
          throw new Error("Use up to 120 emitter keys.");
        }
        (e.keys || []).forEach(function (k) {
          if (
            !k ||
            !Number.isInteger(k.at) ||
            k.at < 0 ||
            k.at >= config.frames ||
            times.has(k.at) ||
            !Number.isFinite(k.x) ||
            !Number.isFinite(k.y) ||
            Math.abs(k.x) > 4096 ||
            Math.abs(k.y) > 4096 ||
            !["linear", "in", "out", "in-out"].includes(k.easing || "linear")
          ) {
            throw new Error("Invalid or overlapping emitter key.");
          }
          times.add(k.at);
        });
        ["count", "life", "trails", "sourceLayer"].forEach(function (k) {
          if (!Number.isInteger(e[k])) {
            throw new Error("Emitter " + k + " must be a whole number.");
          }
        });
        var enums = {
          mode: ["continuous", "burst"],
          emission: ["point", "box", "ring", "line", "layer"],
          shape: ["circle", "pixel", "square", "triangle", "star", "sprite"],
          blend: ["over", "add", "screen", "multiply"],
          collision: ["none", "canvas", "layer"],
          spriteMode: ["life", "loop", "once", "random"]
        };
        Object.keys(enums).forEach(function (k) {
          if (enums[k].indexOf(e[k]) === -1) {
            throw new Error("Invalid emitter " + k + ".");
          }
        });
        var ranges = {
          count: [1, 300],
          life: [1, 120],
          lifeJitter: [0, 100],
          x: [-4096, 4096],
          y: [-4096, 4096],
          areaWidth: [1, 4096],
          areaHeight: [1, 4096],
          direction: [-360, 360],
          spread: [0, 360],
          speed: [0, 512],
          speedJitter: [0, 100],
          gravity: [-512, 512],
          wind: [-512, 512],
          drag: [0, 100],
          turbulence: [0, 128],
          orbit: [-512, 512],
          spin: [-720, 720],
          size: [1, 32],
          sizeEnd: [0, 32],
          alphaStart: [0, 100],
          alphaEnd: [0, 100],
          trails: [0, 8],
          bounce: [0, 100],
          attractX: [-4096, 4096],
          attractY: [-4096, 4096],
          attract: [-4096, 4096],
          sourceLayer: [0, 1000],
          tint: [0, 100]
        };
        Object.keys(ranges).forEach(function (k) {
          var range = ranges[k];
          if (!Number.isFinite(e[k]) || e[k] < range[0] || e[k] > range[1]) {
            throw new Error(
              "Emitter " + k + " must be " + range[0] + "–" + range[1] + "."
            );
          }
        });
        ["colorStart", "colorMid", "colorEnd"].forEach(function (k) {
          if (!/^#[0-9a-f]{6}$/i.test(e[k])) {
            throw new Error("Choose valid lifetime colors.");
          }
        });
        if (e.enabled) {
          work += e.count * e.life;
          pixels +=
            e.count *
            Math.min(config.frames, e.life) *
            Math.pow(Math.max(e.size, e.sizeEnd, 1) + 3, 2) *
            (e.trails + 1);
        }
      });
      if (work > 200000) {
        throw new Error(
          "Use fewer particles or shorter lifetimes (200,000 simulation steps maximum)."
        );
      }
      if (pixels > 40000000) {
        throw new Error(
          "Reduce particle size, count or trails (40 million drawing steps maximum)."
        );
      }
      return config;
    }
  };
  ns.ParticleStudioEngine = function (project, config, current, palette) {
    this.project = project;
    this.config = ns.ParticleStudioUtils.validate(config);
    this.width = project.getWidth();
    this.height = project.getHeight();
    this.palette = (palette || []).filter(function (color) {
      return pskl.utils.colorToInt(color) >>> 24;
    });
    this.emitters = [];
    this.fps = Math.max(1, project.getFPS() || 12);
    config.emitters.forEach(
      function (o, index) {
        if (!o.enabled) {
          return;
        }
        var random = u.random(config.seed + Math.imul(index + 1, 2654435761)),
          source = o.sourceId
            ? project.getLayers().find(function (l) {
                return l.toolState.id === o.sourceId;
              })
            : project.getLayerAt(o.sourceLayer);
        if (
          !source ||
          source.toolState.kind === "community-particles" ||
          ns.LayerGroupUtils.isGroup(source)
        ) {
          throw new Error(
            "Choose an existing source layer for " + o.name + "."
          );
        }
        var mask = source.getFrameAt(current),
          points = [],
          seen = 0,
          sprites = [];
        if (o.emission === "layer") {
          mask.forEachPixel(function (color, x, y) {
            if (color >>> 24) {
              seen++;
              if (points.length < 8192) {
                points.push({ x: x, y: y });
              } else {
                var at = Math.floor(random() * seen);
                if (at < 8192) {
                  points[at] = { x: x, y: y };
                }
              }
            }
          });
          if (!points.length) {
            throw new Error("The emission layer has no visible pixels.");
          }
        }
        if (o.shape === "sprite") {
          source
            .getFrames()
            .slice(0, 120)
            .forEach(function (frame) {
              var bounds = ns.ParticleSpriteUtils.bounds(frame);
              if (bounds) {
                if (bounds.width > 64 || bounds.height > 64) {
                  throw new Error("Sprite particles must fit inside 64 × 64.");
                }
                sprites.push(ns.ParticleSpriteUtils.crop(frame, bounds));
              }
            });
          if (!sprites.length) {
            throw new Error("Draw a sprite on the source layer first.");
          }
        }
        var particles = [];
        for (var i = 0; i < o.count; i++) {
          var first = o.start || 0,
            last = o.end === undefined ? config.frames - 1 : o.end,
            birth =
              o.mode === "burst"
                ? first
                : first + Math.floor((i * (last - first + 1)) / o.count),
            life = Math.max(
              1,
              Math.min(
                config.frames,
                Math.round(o.life * (1 - (random() * o.lifeJitter) / 100))
              )
            ),
            origin = ns.ParticleTimelineUtils.position(o, birth),
            x = origin.x,
            y = origin.y,
            angle =
              ((o.direction + (random() - 0.5) * o.spread) * Math.PI) / 180;
          if (o.followPath && o.pathMode === "emitter") {
            var point = ns.ParticleTimelineUtils.route(
              o,
              birth / (config.frames - 1)
            );
            x = point.x + origin.x - o.x;
            y = point.y + origin.y - o.y;
          }
          if (o.emission === "box") {
            x += random() * o.areaWidth;
            y += random() * o.areaHeight;
          } else if (o.emission === "ring") {
            var theta = random() * Math.PI * 2;
            x += (Math.cos(theta) * o.areaWidth) / 2;
            y += (Math.sin(theta) * o.areaWidth) / 2;
          } else if (o.emission === "line") {
            x += random() * o.areaWidth;
          } else if (o.emission === "layer") {
            var point = points[Math.floor(random() * points.length)];
            x = point.x;
            y = point.y;
          }
          var offset = { x: x - origin.x, y: y - origin.y },
            speed = o.speed * (1 + ((random() * 2 - 1) * o.speedJitter) / 100),
            vx = Math.cos(angle) * speed,
            vy = Math.sin(angle) * speed,
            states = [],
            phase = random() * Math.PI * 2,
            dt = 1 / this.fps;
          for (var age = 0; age < life; age++) {
            if (o.followPath && o.pathMode !== "emitter") {
              var guided = ns.ParticleTimelineUtils.route(
                o,
                life <= 1 ? 0 : age / (life - 1)
              );
              x = guided.x + origin.x - o.x + offset.x;
              y = guided.y + origin.y - o.y + offset.y;
            }
            states.push({ x: x, y: y });
            var ax = o.wind + Math.sin(age * 0.5 + phase) * o.turbulence,
              ay = o.gravity + Math.cos(age * 0.4 + phase) * o.turbulence,
              dx = o.attractX - x,
              dy = o.attractY - y,
              distance = Math.max(1, Math.hypot(dx, dy));
            ax +=
              ((dx / distance) * o.attract) / Math.max(1, distance * distance) -
              (dy / distance) * o.orbit;
            ay +=
              ((dy / distance) * o.attract) / Math.max(1, distance * distance) +
              (dx / distance) * o.orbit;
            vx = (vx + ax * dt) * Math.pow(1 - o.drag / 100, dt);
            vy = (vy + ay * dt) * Math.pow(1 - o.drag / 100, dt);
            var nx = x + vx * dt,
              ny = y + vy * dt;
            if (o.collision === "canvas") {
              if (nx < 0 || nx >= this.width) {
                vx = (-vx * o.bounce) / 100;
                nx = Math.max(0, Math.min(this.width - 1, nx));
              }
              if (ny < 0 || ny >= this.height) {
                vy = (-vy * o.bounce) / 100;
                ny = Math.max(0, Math.min(this.height - 1, ny));
              }
            }
            if (
              o.collision === "layer" &&
              mask.getPixel(Math.round(nx), Math.round(ny)) >>> 24
            ) {
              vx = (-vx * o.bounce) / 100;
              vy = (-vy * o.bounce) / 100;
              nx = x;
              ny = y;
            }
            x = nx;
            y = ny;
          }
          particles.push({
            birth: birth,
            life: life,
            states: states,
            phase: phase,
            sprite: Math.floor(random() * Math.max(1, sprites.length))
          });
        }
        this.emitters.push({
          options: o,
          particles: particles,
          sprites: sprites
        });
      }.bind(this)
    );
  };
  ns.ParticleStudioEngine.prototype.plot = function (
    frame,
    x,
    y,
    color,
    blend,
    dither
  ) {
    x = Math.round(x);
    y = Math.round(y);
    if (!frame.containsPixel(x, y) || !(color >>> 24)) {
      return;
    }
    if (dither) {
      if (ns.ParticleSpriteUtils.threshold(x, y) >= (color >>> 24) / 255) {
        return;
      }
      color = (color | 0xff000000) >>> 0;
    }
    var base = frame.getPixel(x, y);
    if (blend !== "over" && base >>> 24) {
      var rgb = 0;
      [0, 8, 16].forEach(function (shift) {
        var a = (color >>> shift) & 255,
          b = (base >>> shift) & 255,
          value =
            blend === "add"
              ? Math.min(255, a + b)
              : blend === "multiply"
                ? (a * b) / 255
                : 255 - ((255 - a) * (255 - b)) / 255;
        rgb |= Math.round(value) << shift;
      });
      color = ((color & 0xff000000) | rgb) >>> 0;
    }
    frame.setPixel(x, y, u.over(base, color));
  };
  ns.ParticleStudioEngine.prototype.render = function (index) {
    var frame = new pskl.model.Frame(this.width, this.height),
      time =
        (((Math.floor(index) + this.config.warmup) % this.config.frames) +
          this.config.frames) %
        this.config.frames;
    if (this.config.loop === false) {
      time = Math.floor(index) + this.config.warmup;
    }
    this.emitters.forEach(
      function (emitter) {
        var o = emitter.options;
        emitter.particles.forEach(
          function (particle) {
            var age =
              this.config.loop === false
                ? time - particle.birth
                : (time - particle.birth + this.config.frames) %
                  this.config.frames;
            if (age < 0 || age >= particle.life) {
              return;
            }
            for (var trail = o.trails; trail >= 0; trail--) {
              var at = age - trail;
              if (at < 0) {
                continue;
              }
              var t = particle.life <= 1 ? 0 : at / (particle.life - 1),
                state = particle.states[at],
                color =
                  t < 0.5
                    ? u.mix(
                        pskl.utils.colorToInt(o.colorStart),
                        pskl.utils.colorToInt(o.colorMid),
                        t * 2
                      )
                    : u.mix(
                        pskl.utils.colorToInt(o.colorMid),
                        pskl.utils.colorToInt(o.colorEnd),
                        (t - 0.5) * 2
                      ),
                alpha =
                  ((o.alphaStart + (o.alphaEnd - o.alphaStart) * t) / 100) *
                  (1 - trail / (o.trails + 1)),
                size = Math.max(0.1, o.size + (o.sizeEnd - o.size) * t),
                angle = (o.spin * at) / this.fps;
              if (o.palette && this.palette.length) {
                var best = this.palette.reduce(
                  function (result, c) {
                    var value = pskl.utils.colorToInt(c),
                      distance =
                        Math.pow((value & 255) - (color & 255), 2) +
                        Math.pow(
                          ((value >>> 8) & 255) - ((color >>> 8) & 255),
                          2
                        ) +
                        Math.pow(
                          ((value >>> 16) & 255) - ((color >>> 16) & 255),
                          2
                        );
                    return distance < result.distance
                      ? { distance: distance, color: value }
                      : result;
                  },
                  { distance: Infinity, color: color }
                );
                color = best.color;
              }
              color =
                ((Math.round((color >>> 24) * alpha) << 24) |
                  (color & 0xffffff)) >>>
                0;
              if (o.shape === "sprite") {
                var count = emitter.sprites.length,
                  fi =
                    o.spriteMode === "life"
                      ? Math.min(count - 1, Math.floor(t * count))
                      : o.spriteMode === "once"
                        ? Math.min(count - 1, at)
                        : o.spriteMode === "random"
                          ? particle.sprite
                          : at % count,
                  sprite = emitter.sprites[fi],
                  stamp = u.stamp(
                    sprite,
                    {
                      size:
                        (size /
                          Math.max(sprite.getWidth(), sprite.getHeight())) *
                        100,
                      angle: angle,
                      sizeJitter: 0,
                      angleJitter: 0,
                      hueJitter: 0,
                      valueJitter: 0,
                      alphaJitter: 0,
                      opacity: 100,
                      colorMode: "original"
                    },
                    u.random(1),
                    0,
                    "white",
                    "black",
                    []
                  ),
                  left = Math.round(state.x) - Math.floor(stamp.getWidth() / 2),
                  top = Math.round(state.y) - Math.floor(stamp.getHeight() / 2);
                stamp.forEachPixel(
                  function (pixel, x, y) {
                    if (pixel >>> 24) {
                      var tinted = u.mix(
                        pixel,
                        (pixel & 0xff000000) | (color & 0xffffff),
                        o.tint / 100
                      );
                      tinted =
                        ((Math.round(((pixel >>> 24) * (color >>> 24)) / 255) <<
                          24) |
                          (tinted & 0xffffff)) >>>
                        0;
                      this.plot(
                        frame,
                        left + x,
                        top + y,
                        tinted,
                        o.blend,
                        o.alphaDither
                      );
                    }
                  }.bind(this)
                );
              } else {
                var radius = o.shape === "pixel" ? 0 : Math.max(0.5, size / 2),
                  limit = Math.ceil(
                    radius *
                      (["square", "triangle"].includes(o.shape)
                        ? Math.SQRT2
                        : 1)
                  ),
                  radians = (angle * Math.PI) / 180,
                  cos = Math.cos(radians),
                  sin = Math.sin(radians);
                for (var dy = -limit; dy <= limit; dy++) {
                  for (var dx = -limit; dx <= limit; dx++) {
                    var rx = cos * dx + sin * dy,
                      ry = -sin * dx + cos * dy,
                      r = Math.hypot(dx, dy),
                      theta = Math.atan2(dy, dx) - (angle * Math.PI) / 180,
                      inside =
                        o.shape === "pixel"
                          ? dx === 0 && dy === 0
                          : o.shape === "square"
                            ? Math.abs(rx) <= radius && Math.abs(ry) <= radius
                            : o.shape === "triangle"
                              ? ry >= -radius &&
                                ry <= radius &&
                                Math.abs(rx) <= (ry + radius) / 2
                              : o.shape === "star"
                                ? r <=
                                  radius * (0.65 + 0.35 * Math.cos(theta * 5))
                                : r <= radius;
                    if (inside) {
                      this.plot(
                        frame,
                        state.x + dx,
                        state.y + dy,
                        color,
                        o.blend,
                        o.alphaDither
                      );
                    }
                  }
                }
              }
            }
          }.bind(this)
        );
      }.bind(this)
    );
    return frame;
  };
})();

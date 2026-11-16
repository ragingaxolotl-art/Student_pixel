(function () {
  var ns = $.namespace("pskl.controller.dialogs");
  ns.PuppetStudioControls = function (owner) {
    this.owner = owner;
    this.service = new pskl.service.PuppetStudioService(
      pskl.app.piskelController
    );
  };
  ns.PuppetStudioControls.prototype.form = function () {
    return this.owner.wrapper.querySelector('[data-extra-tool="rig"]');
  };
  ns.PuppetStudioControls.prototype.read = function () {
    var result = {};
    this.form()
      .querySelectorAll("[data-field]")
      .forEach(function (input) {
        result[input.dataset.field] =
          input.type === "file"
            ? Array.from(input.files)
            : input.type === "checkbox"
              ? input.checked
              : input.type === "number" || input.dataset.numeric === "true"
                ? Number(input.value)
                : input.value;
      });
    return result;
  };
  ns.PuppetStudioControls.prototype.write = function (id, values) {
    var form = this.form();
    Object.keys(values).forEach(function (key) {
      var input = form.elements["rig-" + key];
      if (input) {
        if (input.type === "checkbox") {
          input.checked = values[key];
        } else {
          input.value = values[key] === undefined ? "" : values[key];
        }
      }
    });
  };
  ns.PuppetStudioControls.prototype.buildForm = function () {
    var form = document.createElement("form"),
      definition = pskl.utils.PuppetStudioDefinition;
    form.className = "extra-tools-form community-tool-form";
    form.dataset.extraTool = "rig";
    form.append(document.createElement("h4"), document.createElement("p"));
    definition.fields.forEach(function (field) {
      var label = document.createElement("label"),
        input = document.createElement(
          field.type === "select" ? "select" : "input"
        );
      label.append(document.createTextNode(field.label));
      input.name = "rig-" + field.key;
      input.dataset.field = field.key;
      input.dataset.numeric = String(!!field.numeric);
      input.setAttribute("aria-label", field.label);
      if (field.type === "select") {
        field.values.forEach(function (v) {
          var pair = Array.isArray(v) ? v : [v, v];
          input.append(new Option(pair[1], pair[0]));
        });
      } else {
        input.type = field.type || "number";
        if (input.type === "number") {
          input.min = field.min === undefined ? -4096 : field.min;
          input.max = field.max === undefined ? 4096 : field.max;
          input.step = field.step || 1;
          input.required = true;
        }
        if (field.accept) {
          input.accept = field.accept;
        }
      }
      if (field.value !== undefined) {
        input.value = field.value;
      }
      if (field.type === "checkbox") {
        input.checked = !!field.value;
      }
      label.append(input);
      form.append(label);
    });
    var content = document.createElement("div");
    content.dataset.communityContent = "rig";
    form.append(content);
    var actions = document.createElement("div");
    actions.className = "extra-tools-actions";
    definition.actions.forEach(function (action) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "button" + (action.primary ? " button-primary" : "");
      b.dataset.communityAction = action.id;
      b.textContent = action.label;
      actions.append(b);
    });
    form.append(actions);
    var status = document.createElement("p");
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    form.append(status);
    form.addEventListener("submit", function (e) {
      e.preventDefault();
    });
    actions.addEventListener(
      "click",
      async function (e) {
        var b = e.target.closest("[data-community-action]");
        if (!b || !form.reportValidity()) {
          return;
        }
        b.disabled = true;
        try {
          status.textContent = await this.service.performRig(
            b.dataset.communityAction,
            this.read(),
            this
          );
          this.owner.refreshWorkspacePreview_();
        } catch (error) {
          status.textContent = error.message;
        } finally {
          b.disabled = false;
        }
      }.bind(this)
    );
    this.owner.wrapper.querySelector(".extra-tools-settings").append(form);
  };
})();

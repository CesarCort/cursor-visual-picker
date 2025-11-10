    function setupVisualEditor({ panelEl, initialEl, payload, includeCheckbox, buildSelector }) {
      let currentEl = initialEl;
      const originalTag = initialEl.tagName.toLowerCase();
      const originalHTML = initialEl.outerHTML;
      const baselineProperties = [
        "width","height",
        "margin-top","margin-right","margin-bottom","margin-left",
        "padding-top","padding-right","padding-bottom","padding-left",
        "background-color","color","border","border-radius","display","gap",
        "justify-content","align-items","font-size","font-weight","text-align",
        "text-transform","box-shadow","line-height","letter-spacing"
      ];
      const baselineStyles = {};
      const initialComputed = window.getComputedStyle(initialEl);
      baselineProperties.forEach(prop => {
        baselineStyles[prop] = initialComputed.getPropertyValue(prop);
      });

      const appliedChanges = new Map();
      const controlUpdaters = [];
      const friendlyNames = {
        "width": "ancho",
        "height": "alto",
        "margin-top": "margen superior",
        "margin-right": "margen derecho",
        "margin-bottom": "margen inferior",
        "margin-left": "margen izquierdo",
        "padding-top": "padding superior",
        "padding-right": "padding derecho",
        "padding-bottom": "padding inferior",
        "padding-left": "padding izquierdo",
        "background-color": "color de fondo",
        "color": "color de texto",
        "border": "borde",
        "border-radius": "radio de borde",
        "display": "display",
        "gap": "gap",
        "justify-content": "alineación horizontal",
        "align-items": "alineación vertical",
        "font-size": "tamaño de fuente",
        "font-weight": "peso tipográfico",
        "text-align": "alineación de texto",
        "text-transform": "transformación de texto",
        "box-shadow": "sombra",
        "line-height": "altura de línea",
        "letter-spacing": "espaciado de letras"
      };
      const changeBadgesEl = panelEl.querySelector(".__change_badges");
      const changesBox = panelEl.querySelector(".__changes");
      let tagChange = null;
      let visualSummary = [];

      function normalizeCssValue(value) {
        return (value || "").toString().trim().replace(/\s+/g, " ").toLowerCase();
      }

      function parseLength(value, fallbackUnit = "px") {
        const cleaned = (value || "").toString().trim();
        if (!cleaned) return { value: "", unit: fallbackUnit };
        if (cleaned === "auto") return { value: "", unit: "auto" };
        const match = cleaned.match(/^(-?\d+(?:\.\d+)?)([a-z%]*)$/i);
        if (match) {
          return { value: match[1], unit: match[2] || fallbackUnit };
        }
        return { value: "", unit: fallbackUnit };
      }

      function cssColorToHex(color) {
        const ctx = document.createElement("canvas").getContext("2d");
        if (!ctx) return null;
        ctx.fillStyle = "#000000";
        try {
          ctx.fillStyle = color;
        } catch(_) {
          return null;
        }
        const computed = ctx.fillStyle;
        if (/^#[0-9a-f]{6}$/i.test(computed)) return computed;
        return null;
      }

      function updatePayloadSelection() {
        if (!currentEl) return;
        const rect = currentEl.getBoundingClientRect();
        payload.selection.box = { x: rect.x, y: rect.y, w: rect.width, h: rect.height };
        const selectorValue = buildSelector ? buildSelector(currentEl) : payload.selection.cssSelector;
        if (selectorValue) {
          payload.selection.cssSelector = selectorValue;
        }
        const selectorNode = panelEl.querySelector(".__selector");
        if (selectorNode) selectorNode.textContent = payload.selection.cssSelector || selectorValue || "";
        payload.selection.outerHTML = currentEl.outerHTML.slice(0, 20000);
        payload.selection.text = (currentEl.textContent || "").trim().slice(0, 2000);
        const txtNode = panelEl.querySelector(".__txt");
        if (txtNode) txtNode.textContent = payload.selection.text.slice(0, 140);
        const attrMap = {};
        for (const attr of currentEl.attributes || []) attrMap[attr.name] = attr.value;
        payload.selection.attributes = attrMap;
        const computed = window.getComputedStyle(currentEl);
        const styleKeys = new Set([
          ...Object.keys(payload.selection.styles || {}),
          ...baselineProperties
        ]);
        const updatedStyles = {};
        styleKeys.forEach(key => {
          updatedStyles[key] = computed.getPropertyValue(key);
        });
        payload.selection.styles = updatedStyles;
      }

      function createBadge({ text, type, onRemove }) {
        if (!changeBadgesEl) return;
        const badge = document.createElement("span");
        badge.className = "__change_badge";
        if (type) badge.dataset.type = type;
        const labelNode = document.createElement("span");
        labelNode.textContent = text;
        const closeBtn = document.createElement("button");
        closeBtn.type = "button";
        closeBtn.setAttribute("aria-label", "Eliminar cambio");
        closeBtn.textContent = "×";
        closeBtn.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          if (typeof onRemove === "function") onRemove();
        });
        badge.appendChild(labelNode);
        badge.appendChild(closeBtn);
        changeBadgesEl.appendChild(badge);
      }

      function revertPropertyChange(prop) {
        const baseline = baselineStyles[prop] ?? "";
        if (!currentEl) return;
        applyStyle(prop, baseline.trim().length ? baseline : "");
        controlUpdaters.forEach(fn => fn());
      }

      function revertTagChange() {
        if (!currentEl || !tagChange || tagChange.before === tagChange.after) return;
        const restored = document.createElement(tagChange.before);
        for (const attr of Array.from(currentEl.attributes || [])) {
          restored.setAttribute(attr.name, attr.value);
        }
        restored.innerHTML = currentEl.innerHTML;
        restored.style.cssText = currentEl.style.cssText;
        currentEl.replaceWith(restored);
        currentEl = restored;
        tagChange = null;
        updatePayloadSelection();
        controlUpdaters.forEach(fn => fn());
        updateChangeList();
      }

      function updateChangeList() {
        visualSummary = [];
        if (changeBadgesEl) changeBadgesEl.innerHTML = "";
        if (tagChange && tagChange.after && tagChange.before !== tagChange.after) {
          const text = `convertir ${tagChange.before} → ${tagChange.after}`;
          visualSummary.push(text);
          createBadge({ text, type: "tag", onRemove: () => revertTagChange() });
        }
        const sorted = Array.from(appliedChanges.entries());
        sorted.sort((a, b) => a[0].localeCompare(b[0]));
        for (const [prop, info] of sorted) {
          const before = info.before && info.before.trim() ? info.before.trim() : "(auto)";
          const after = info.after && info.after.trim() ? info.after.trim() : "(auto)";
          const label = friendlyNames[prop] || prop;
          const text = `${label}: ${before} → ${after}`;
          visualSummary.push(text);
          createBadge({ text, type: "style", onRemove: () => revertPropertyChange(prop) });
        }
        if (changesBox) {
          changesBox.hidden = visualSummary.length === 0;
        }
      }

      function recordChange(prop) {
        if (!currentEl) return;
        const inlineValue = currentEl.style.getPropertyValue(prop);
        const computed = window.getComputedStyle(currentEl).getPropertyValue(prop);
        const baseline = baselineStyles[prop] ?? "";
        if (normalizeCssValue(computed) === normalizeCssValue(baseline)) {
          appliedChanges.delete(prop);
        } else {
          appliedChanges.set(prop, {
            before: baseline,
            after: inlineValue || computed
          });
        }
        updateChangeList();
      }

      function applyStyle(prop, value) {
        if (!currentEl) return;
        if (value === "" || value === null) {
          currentEl.style.removeProperty(prop);
        } else {
          currentEl.style.setProperty(prop, value);
        }
        recordChange(prop);
        updatePayloadSelection();
      }

      function createLengthControl({ label, property, units = ["px"], allowAuto = false, step = 1, min, max, range }) {
        const wrapper = document.createElement("div");
        wrapper.className = "__control";
        const labelEl = document.createElement("div");
        labelEl.className = "__control_label";
        labelEl.textContent = label;
        wrapper.appendChild(labelEl);

        const row = document.createElement("div");
        row.className = "__control_row";
        const numberInput = document.createElement("input");
        numberInput.type = "number";
        numberInput.step = step;
        if (typeof min === "number") numberInput.min = String(min);
        if (typeof max === "number") numberInput.max = String(max);
        const baseUnits = units.length ? units.slice() : ["px"];
        const normalizedUnits = allowAuto ? Array.from(new Set([...baseUnits, "auto"])) : Array.from(new Set(baseUnits));
        const unitSelect = document.createElement("select");
        normalizedUnits.forEach(unit => {
          const option = document.createElement("option");
          option.value = unit;
          option.textContent = unit;
          unitSelect.appendChild(option);
        });
        row.appendChild(numberInput);
        row.appendChild(unitSelect);
        wrapper.appendChild(row);

        let slider = null;
        let sliderMin = 0;
        let sliderMax = 300;
        let sliderStep = typeof step === "number" ? step : 1;

        if (range && typeof range === "object") {
          slider = document.createElement("input");
          slider.type = "range";
          slider.className = "__range";
          sliderMin = typeof range.min === "number" ? range.min : sliderMin;
          sliderMax = typeof range.max === "number" ? range.max : sliderMax;
          sliderStep = typeof range.step === "number" ? range.step : sliderStep;
          slider.min = String(sliderMin);
          slider.max = String(sliderMax);
          slider.step = String(sliderStep);
          slider.value = String(sliderMin);
          wrapper.appendChild(slider);
        }

        const sync = () => {
          const styles = window.getComputedStyle(currentEl);
          const parsed = parseLength(styles.getPropertyValue(property), baseUnits[0] || "px");
          if (parsed.unit === "auto") {
            numberInput.value = "";
            if (allowAuto) {
              unitSelect.value = "auto";
            } else {
              unitSelect.value = normalizedUnits[0];
            }
          } else {
            numberInput.value = parsed.value;
            if (normalizedUnits.includes(parsed.unit)) {
              unitSelect.value = parsed.unit;
            } else {
              unitSelect.value = normalizedUnits[0];
            }
          }
          if (slider) {
            const numeric = parseFloat(parsed.value);
            const canUseSlider = parsed.unit === "px" && !Number.isNaN(numeric);
            slider.disabled = !canUseSlider;
            if (canUseSlider) {
              const clamped = Math.min(Math.max(numeric, sliderMin), sliderMax);
              slider.value = String(clamped);
            }
          }
        };
        controlUpdaters.push(sync);
        sync();

        const updateFromInputs = () => {
          const unit = unitSelect.value;
          const val = numberInput.value.trim();
          let finalValue = "";
          if (!val) {
            finalValue = allowAuto && unit === "auto" ? "auto" : "";
          } else if (allowAuto && unit === "auto") {
            finalValue = "auto";
          } else {
            finalValue = `${val}${unit}`;
          }
          applyStyle(property, finalValue);
          if (slider) {
            const numeric = parseFloat(val);
            const canUseSlider = unit === "px" && !Number.isNaN(numeric);
            slider.disabled = !canUseSlider;
            if (canUseSlider) {
              const clamped = Math.min(Math.max(numeric, sliderMin), sliderMax);
              slider.value = String(clamped);
            }
          }
        };

        numberInput.addEventListener("input", updateFromInputs);
        numberInput.addEventListener("change", updateFromInputs);
        numberInput.addEventListener("blur", updateFromInputs);
        unitSelect.addEventListener("change", updateFromInputs);

        if (slider) {
          slider.addEventListener("input", () => {
            const val = slider.value;
            numberInput.value = val;
            if (normalizedUnits.includes("px")) {
              unitSelect.value = "px";
            }
            applyStyle(property, `${val}px`);
          });
        }

        return wrapper;
      }

      function createSelectControl({ label, property, options }) {
        const wrapper = document.createElement("div");
        wrapper.className = "__control";
        const labelEl = document.createElement("div");
        labelEl.className = "__control_label";
        labelEl.textContent = label;
        wrapper.appendChild(labelEl);

        const row = document.createElement("div");
        row.className = "__control_row";
        const select = document.createElement("select");
        const normalizedOptions = [{ value: "", label: "Automático" }, ...options];
        normalizedOptions.forEach(opt => {
          const option = document.createElement("option");
          option.value = opt.value;
          option.textContent = opt.label || (opt.value || "Automático");
          select.appendChild(option);
        });
        row.appendChild(select);
        wrapper.appendChild(row);

        const sync = () => {
          const styles = window.getComputedStyle(currentEl);
          const current = styles.getPropertyValue(property).trim();
          const match = normalizedOptions.find(opt => normalizeCssValue(opt.value) === normalizeCssValue(current));
          select.value = match ? match.value : "";
        };
        controlUpdaters.push(sync);
        sync();

        select.addEventListener("change", () => {
          const val = select.value;
          if (!val) {
            applyStyle(property, "");
          } else {
            applyStyle(property, val);
          }
        });

        return wrapper;
      }

      function createColorControl({ label, property }) {
        const wrapper = document.createElement("div");
        wrapper.className = "__control";
        const labelEl = document.createElement("div");
        labelEl.className = "__control_label";
        labelEl.textContent = label;
        wrapper.appendChild(labelEl);

        const row = document.createElement("div");
        row.className = "__control_row";
        const colorInput = document.createElement("input");
        colorInput.type = "color";
        colorInput.value = "#000000";
        const textInput = document.createElement("input");
        textInput.type = "text";
        textInput.placeholder = "Ej: #0b5fff o transparent";
        row.appendChild(colorInput);
        row.appendChild(textInput);
        wrapper.appendChild(row);

        const sync = () => {
          const styles = window.getComputedStyle(currentEl);
          const value = styles.getPropertyValue(property).trim();
          const hex = cssColorToHex(value);
          if (hex) colorInput.value = hex;
          textInput.value = value;
        };
        controlUpdaters.push(sync);
        sync();

        const apply = (val) => {
          const final = val.trim();
          if (!final) {
            applyStyle(property, "");
            sync();
            return;
          }
          applyStyle(property, final);
        };

        colorInput.addEventListener("input", () => apply(colorInput.value));
        textInput.addEventListener("change", () => apply(textInput.value));
        textInput.addEventListener("blur", () => apply(textInput.value));

        return wrapper;
      }

      function createTextControl({ label, property, placeholder }) {
        const wrapper = document.createElement("div");
        wrapper.className = "__control";
        const labelEl = document.createElement("div");
        labelEl.className = "__control_label";
        labelEl.textContent = label;
        wrapper.appendChild(labelEl);

        const row = document.createElement("div");
        row.className = "__control_row";
        const input = document.createElement("input");
        input.type = "text";
        if (placeholder) input.placeholder = placeholder;
        row.appendChild(input);
        wrapper.appendChild(row);

        const sync = () => {
          const styles = window.getComputedStyle(currentEl);
          input.value = styles.getPropertyValue(property).trim();
        };
        controlUpdaters.push(sync);
        sync();

        const apply = () => {
          const val = input.value.trim();
          if (!val) {
            applyStyle(property, "");
          } else {
            applyStyle(property, val);
          }
        };

        input.addEventListener("change", apply);
        input.addEventListener("blur", apply);

        return wrapper;
      }

      const componentSection = panelEl.querySelector('[data-section="component"] .__section_body');
      if (componentSection) {
        const tagControl = document.createElement("div");
        tagControl.className = "__control";
        const labelEl = document.createElement("div");
        labelEl.className = "__control_label";
        labelEl.textContent = "Tipo de etiqueta";
        tagControl.appendChild(labelEl);

        const row = document.createElement("div");
        row.className = "__control_row";
        const select = document.createElement("select");
        const tagOptions = ["div","section","article","main","header","footer","nav","button","a","span","p","h1","h2","h3","h4","ul","ol","li"];
        tagOptions.forEach(tag => {
          const option = document.createElement("option");
          option.value = tag;
          option.textContent = tag;
          select.appendChild(option);
        });
        row.appendChild(select);
        tagControl.appendChild(row);
        const hint = document.createElement("div");
        hint.className = "__minihelp";
        hint.textContent = "Convierte el nodo para previsualizar otra etiqueta HTML.";
        tagControl.appendChild(hint);
        componentSection.appendChild(tagControl);

        const syncTag = () => {
          select.value = currentEl.tagName.toLowerCase();
        };
        controlUpdaters.push(syncTag);
        syncTag();

        select.addEventListener("change", () => {
          const nextTag = select.value;
          if (!nextTag) return;
          if (currentEl.tagName.toLowerCase() === nextTag.toLowerCase()) return;
          const replacement = document.createElement(nextTag);
          for (const attr of Array.from(currentEl.attributes || [])) {
            replacement.setAttribute(attr.name, attr.value);
          }
          replacement.innerHTML = currentEl.innerHTML;
          replacement.style.cssText = currentEl.style.cssText;
          currentEl.replaceWith(replacement);
          currentEl = replacement;
          tagChange = { before: originalTag, after: nextTag.toLowerCase() };
          updatePayloadSelection();
          controlUpdaters.forEach(fn => fn());
          updateChangeList();
        });
      }

      const layoutSection = panelEl.querySelector('[data-section="layout"] .__section_body');
      if (layoutSection) {
        layoutSection.appendChild(createLengthControl({ label: "Ancho", property: "width", units: ["px","%","vw"], allowAuto: true, step: 1, range: { min: 0, max: 1440, step: 5 } }));
        layoutSection.appendChild(createLengthControl({ label: "Altura", property: "height", units: ["px","%","vh"], allowAuto: true, step: 1, range: { min: 0, max: 900, step: 5 } }));
        layoutSection.appendChild(createLengthControl({ label: "Margen superior", property: "margin-top", units: ["px","%","rem"], step: 1, range: { min: -200, max: 200, step: 1 } }));
        layoutSection.appendChild(createLengthControl({ label: "Margen derecho", property: "margin-right", units: ["px","%","rem"], step: 1, range: { min: -200, max: 200, step: 1 } }));
        layoutSection.appendChild(createLengthControl({ label: "Margen inferior", property: "margin-bottom", units: ["px","%","rem"], step: 1, range: { min: -200, max: 200, step: 1 } }));
        layoutSection.appendChild(createLengthControl({ label: "Margen izquierdo", property: "margin-left", units: ["px","%","rem"], step: 1, range: { min: -200, max: 200, step: 1 } }));
        layoutSection.appendChild(createLengthControl({ label: "Padding superior", property: "padding-top", units: ["px","%","rem"], step: 1, range: { min: 0, max: 200, step: 1 } }));
        layoutSection.appendChild(createLengthControl({ label: "Padding derecho", property: "padding-right", units: ["px","%","rem"], step: 1, range: { min: 0, max: 200, step: 1 } }));
        layoutSection.appendChild(createLengthControl({ label: "Padding inferior", property: "padding-bottom", units: ["px","%","rem"], step: 1, range: { min: 0, max: 200, step: 1 } }));
        layoutSection.appendChild(createLengthControl({ label: "Padding izquierdo", property: "padding-left", units: ["px","%","rem"], step: 1, range: { min: 0, max: 200, step: 1 } }));
        layoutSection.appendChild(createSelectControl({
          label: "Display",
          property: "display",
          options: [
            { value: "block" },
            { value: "inline-block", label: "inline-block" },
            { value: "inline", label: "inline" },
            { value: "flex", label: "flex" },
            { value: "grid", label: "grid" }
          ]
        }));
        layoutSection.appendChild(createSelectControl({
          label: "Justificar contenido",
          property: "justify-content",
          options: [
            { value: "flex-start", label: "inicio" },
            { value: "center", label: "centro" },
            { value: "flex-end", label: "fin" },
            { value: "space-between", label: "espacio entre" },
            { value: "space-around", label: "espacio alrededor" }
          ]
        }));
        layoutSection.appendChild(createSelectControl({
          label: "Alinear items",
          property: "align-items",
          options: [
            { value: "stretch", label: "stretch" },
            { value: "flex-start", label: "inicio" },
            { value: "center", label: "centro" },
            { value: "flex-end", label: "fin" }
          ]
        }));
        layoutSection.appendChild(createLengthControl({ label: "Gap", property: "gap", units: ["px","rem","%"], step: 1, range: { min: 0, max: 160, step: 1 } }));
      }

      const appearanceSection = panelEl.querySelector('[data-section="appearance"] .__section_body');
      if (appearanceSection) {
        appearanceSection.appendChild(createColorControl({ label: "Color de fondo", property: "background-color" }));
        appearanceSection.appendChild(createColorControl({ label: "Color de texto", property: "color" }));
        appearanceSection.appendChild(createLengthControl({ label: "Radio de borde", property: "border-radius", units: ["px","%","rem"], step: 1, range: { min: 0, max: 150, step: 1 } }));
        appearanceSection.appendChild(createTextControl({ label: "Borde", property: "border", placeholder: "Ej: 1px solid #111" }));
        appearanceSection.appendChild(createTextControl({ label: "Sombra", property: "box-shadow", placeholder: "Ej: 0 8px 16px rgba(0,0,0,.15)" }));
      }

      const typographySection = panelEl.querySelector('[data-section="typography"] .__section_body');
      if (typographySection) {
        typographySection.appendChild(createLengthControl({ label: "Tamaño de fuente", property: "font-size", units: ["px","rem","em","%"], step: 0.5, range: { min: 8, max: 120, step: 0.5 } }));
        typographySection.appendChild(createSelectControl({
          label: "Peso",
          property: "font-weight",
          options: [
            { value: "300", label: "300" },
            { value: "400", label: "400 (normal)" },
            { value: "500", label: "500" },
            { value: "600", label: "600" },
            { value: "700", label: "700" },
            { value: "800", label: "800" }
          ]
        }));
        typographySection.appendChild(createSelectControl({
          label: "Alineación",
          property: "text-align",
          options: [
            { value: "left", label: "izquierda" },
            { value: "center", label: "centro" },
            { value: "right", label: "derecha" },
            { value: "justify", label: "justificado" }
          ]
        }));
        typographySection.appendChild(createSelectControl({
          label: "Transformación",
          property: "text-transform",
          options: [
            { value: "uppercase", label: "mayúsculas" },
            { value: "lowercase", label: "minúsculas" },
            { value: "capitalize", label: "capitalizar" }
          ]
        }));
        typographySection.appendChild(createTextControl({ label: "Altura de línea", property: "line-height", placeholder: "Ej: 1.5 o 24px" }));
        typographySection.appendChild(createTextControl({ label: "Espaciado de letras", property: "letter-spacing", placeholder: "Ej: 0.5px" }));
      }

      updatePayloadSelection();
      updateChangeList();

      return {
        resetChanges() {
          if (!currentEl) return;
          const temp = document.createElement("div");
          temp.innerHTML = originalHTML;
          const restored = temp.firstElementChild;
          if (!restored) return;
          currentEl.replaceWith(restored);
          currentEl = restored;
          const latestComputed = window.getComputedStyle(currentEl);
          baselineProperties.forEach(prop => {
            baselineStyles[prop] = latestComputed.getPropertyValue(prop);
          });
          appliedChanges.clear();
          tagChange = null;
          controlUpdaters.forEach(fn => fn());
          updatePayloadSelection();
          updateChangeList();
        },
        syncBeforeSend() {
          updatePayloadSelection();
          const styleChanges = Array.from(appliedChanges.entries()).map(([property, info]) => ({
            property,
            before: info.before,
            after: info.after
          }));
          payload.selection.appliedStyles = styleChanges;
          payload.selection.tagChange = tagChange && tagChange.before !== tagChange.after ? tagChange : null;
          payload.selection.visualChanges = visualSummary.slice();
          if (includeCheckbox && includeCheckbox.checked && visualSummary.length) {
            payload.feedback.visualSummary = `actualizar: ${visualSummary.join("; ")}`;
          } else {
            delete payload.feedback.visualSummary;
          }
          return payload.feedback.visualSummary || "";
        }
      };
    }
// content.js
(function() {
  let picking = false;
  let lastHover = null;
  let panelEl = null;

  const style = document.createElement("style");
  style.textContent = `
    .__cursor_pick_hover { outline: 2px solid rgba(0, 120, 255, .6) !important; cursor: crosshair !important; }
    .__cursor_pick_panel { position: fixed; max-width: 480px; background: #fff; color: #111; border: 1px solid rgba(0,0,0,.12); border-radius: 16px; box-shadow: 0 18px 45px rgba(15,20,35,.22); padding: 16px; z-index: 2147483647; font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; overflow: hidden; backdrop-filter: blur(18px); cursor: default; }
    .__cursor_pick_panel.__dragging { cursor: grabbing; opacity: 0.97; }
    .__cursor_pick_panel .__hdr { display:flex; align-items:center; gap:10px; margin-bottom:12px; }
    .__cursor_pick_panel .__drag_handle { display:flex; align-items:center; gap:6px; padding:4px 10px; border-radius:10px; background:rgba(15,20,40,.06); color:#30334d; font-size:12px; line-height:1; cursor:grab; user-select:none; border:0; font-weight:600; }
    .__cursor_pick_panel .__drag_handle span.__glyph { font-size:16px; }
    .__cursor_pick_panel .__drag_handle:active { cursor:grabbing; background:rgba(15,20,40,.12); }
    .__cursor_pick_panel .__modebar { display:flex; gap:6px; align-items:center; }
    .__cursor_pick_panel .__mode_btn { width:34px; height:30px; border-radius:10px; border:1px solid transparent; background:rgba(11,95,255,.08); color:#0b2a80; font-size:16px; display:flex; align-items:center; justify-content:center; cursor:pointer; transition:all .15s ease; position:relative; }
    .__cursor_pick_panel .__mode_btn.__active { background:#0b5fff; color:white; box-shadow:0 8px 18px rgba(11,95,255,.28); }
    .__cursor_pick_panel .__mode_btn:not(.__active):hover { border-color:rgba(11,95,255,.4); color:#0b5fff; }
    .__cursor_pick_panel .__hdr .__close { border:0; background:transparent; cursor:pointer; font-size:16px; line-height:1; padding:4px; margin-left:auto; color:#444; border-radius:8px; }
    .__cursor_pick_panel .__hdr .__close:hover { background:rgba(15,20,40,.08); }
    .__cursor_pick_panel .__meta { font-size:12px; color:#333; display:grid; gap:4px; margin-bottom:10px; }
    .__cursor_pick_panel .__meta .__k { font-weight:600; margin-right:4px; }
    .__cursor_pick_panel .__viewwrap { display:grid; gap:12px; }
    .__cursor_pick_panel .__view[hidden] { display:none !important; }
    .__cursor_pick_panel .__prompt_hint { font-size:11px; color:#5a5e72; background:rgba(11,95,255,.08); padding:6px 8px; border-radius:8px; margin-bottom:6px; line-height:1.4; }
    .__cursor_pick_panel .__editor { border:1px solid #ececee; border-radius:14px; padding:12px; background:#f7f8fc; display:grid; gap:12px; max-height:320px; overflow:auto; }
    .__cursor_pick_panel .__editor_hdr { display:flex; align-items:center; justify-content:space-between; }
    .__cursor_pick_panel .__editor_hdr strong { font-size:13px; }
    .__cursor_pick_panel .__section { display:grid; gap:8px; }
    .__cursor_pick_panel .__section_title { font-size:12px; font-weight:700; color:#222; text-transform:uppercase; letter-spacing:.02em; }
    .__cursor_pick_panel .__section_body { display:grid; gap:8px; }
    .__cursor_pick_panel .__control { display:grid; gap:6px; font-size:12px; }
    .__cursor_pick_panel .__control_label { font-weight:600; font-size:12px; color:#1f1f24; display:flex; align-items:center; justify-content:space-between; }
    .__cursor_pick_panel .__control_row { display:flex; gap:6px; align-items:center; }
    .__cursor_pick_panel .__control_row input[type="number"],
    .__cursor_pick_panel .__control_row input[type="text"],
    .__cursor_pick_panel .__control_row select { flex:1; border:1px solid #d9d9e3; border-radius:6px; padding:6px 8px; font-size:12px; background:#fff; }
    .__cursor_pick_panel .__control_row input[type="color"] { width:42px; height:26px; padding:0; border-radius:6px; border:1px solid #d9d9e3; }
    .__cursor_pick_panel .__control_row select.__unit { flex:0 0 65px; }
    .__cursor_pick_panel .__control_row.__split { display:grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap:6px; }
    .__cursor_pick_panel .__control_row.__tight { gap:4px; }
    .__cursor_pick_panel .__range { width:100%; accent-color:#0b5fff; background:transparent; }
    .__cursor_pick_panel .__range[disabled] { opacity:.35; cursor:not-allowed; }
    .__cursor_pick_panel .__minihelp { font-size:11px; color:#666; }
    .__cursor_pick_panel .__lbl { display:block; font-weight:600; font-size:12px; margin:8px 0 4px; }
    .__cursor_pick_panel .__ta { width:100%; box-sizing:border-box; border:1px solid #ddd; border-radius:12px; padding:10px; resize:vertical; min-height:96px; font-size:13px; background:#fff; }
    .__cursor_pick_panel .__actions { display:flex; gap:8px; justify-content:flex-end; margin-top:12px; }
    .__cursor_pick_panel .__btn { padding:6px 12px; border-radius:12px; border:1px solid #d0d0d0; background:#f7f7f8; cursor:pointer; font-size:12px; transition:background .15s ease; }
    .__cursor_pick_panel .__btn.__send { background:#0b5fff; border-color:#0b5fff; color:white; }
    .__cursor_pick_panel .__btn.__send:hover { box-shadow:0 8px 22px rgba(11,95,255,.35); }
    .__cursor_pick_panel .__btn.__reset { background:#fff; border-color:#d0d0d0; color:#333; }
    .__cursor_pick_panel .__changes { border:1px dashed #d0d7ff; background:#f1f4ff; padding:10px 12px; border-radius:12px; font-size:12px; display:grid; gap:8px; }
    .__cursor_pick_panel .__changes strong { font-size:12px; }
    .__cursor_pick_panel .__change_badges { display:flex; flex-wrap:wrap; gap:6px; }
    .__cursor_pick_panel .__change_badge { display:inline-flex; align-items:center; gap:6px; padding:4px 10px; border-radius:999px; background:#fff; border:1px solid rgba(74,86,226,.25); color:#2f3277; font-size:11px; line-height:1.3; box-shadow:0 4px 10px rgba(47,50,119,.08); }
    .__cursor_pick_panel .__change_badge[data-type="tag"] { background:#fdf1ff; border-color:rgba(171,71,188,.35); color:#6a1b9a; }
    .__cursor_pick_panel .__change_badge button { border:0; background:transparent; color:inherit; cursor:pointer; padding:0; font-size:12px; line-height:1; display:flex; align-items:center; justify-content:center; border-radius:50%; width:16px; height:16px; }
    .__cursor_pick_panel .__change_badge button:hover { background:rgba(18,18,46,.12); }
    .__cursor_pick_panel .__change_toggle { display:flex; align-items:center; gap:6px; font-size:12px; margin-top:4px; }
    .__cursor_pick_panel .__change_toggle input[type="checkbox"] { width:14px; height:14px; margin:0; accent-color:#0b5fff; }
    .__cursor_pick_panel .__editor_hdr .__btn { padding:4px 8px; font-size:11px; }
  `;
  document.documentElement.appendChild(style);

  function buildRobustSelector(el) {
    if (!el || el.nodeType !== 1) return '';
    const parts = [];
    let cur = el;
    while (cur && cur.nodeType === 1 && cur !== document.documentElement) {
      let part = cur.tagName.toLowerCase();
      if (cur.id) { part += `#${CSS.escape(cur.id)}`; parts.unshift(part); break; }
      const cls = (cur.className || '').toString().trim().split(/\s+/).filter(c => c && !/^\w{7,}$/.test(c));
      if (cls.length) part += '.' + cls.map(c => CSS.escape(c)).join('.');
      const role = cur.getAttribute && cur.getAttribute('role');
      if (role) part += `[role="${role}"]`;
      parts.unshift(part);
      cur = cur.parentElement;
    }
    return parts.join(' > ');
  }

  function getReactFiberFromDom(node) {
    if (!node) return null;
    for (const k in node) {
      if (k.startsWith("__reactFiber$") || k.startsWith("__reactFiber")) return node[k];
      if (k.startsWith("__reactProps$") || k.startsWith("__reactProps")) return { props: node[k] };
    }
    return null;
  }
  function getComponentNameFromFiber(fiber) {
    try {
      return (fiber?.type?.displayName || fiber?.type?.name || null) || null;
    } catch(_) { return null; }
  }
  function getOwnerStack(fiber, limit=5) {
    const owners = [];
    let cur = fiber?.return;
    while (cur && owners.length < limit) {
      const name = getComponentNameFromFiber(cur);
      if (name) owners.push(name);
      cur = cur.return;
    }
    return owners;
  }

  function onMove(e) {
    if (!picking) return;
    const el = e.target;
    if (!el || el.nodeType !== 1) return;
    if (lastHover && lastHover !== el) lastHover.classList.remove("__cursor_pick_hover");
    lastHover = el;
    el.classList.add("__cursor_pick_hover");
  }

  async function onClick(e) {
    if (!picking) return;
    e.preventDefault();
    e.stopPropagation();
    stopPicking();

    const el = e.target;
    const rect = el.getBoundingClientRect();
    const styles = window.getComputedStyle(el);
    const cssSelector = buildRobustSelector(el);
    const outer = el.outerHTML ? el.outerHTML.slice(0, 20000) : null;

    // Attempt React info
    const fiber = getReactFiberFromDom(el);
    const componentName = getComponentNameFromFiber(fiber);
    const ownerStack = getOwnerStack(fiber);

    // Subset de estilos relevantes
    const styleSubsetKeys = [
      "font-family","font-size","font-weight","color","display","width","height","max-width",
      "margin","margin-top","margin-right","margin-bottom","margin-left",
      "padding","padding-top","padding-right","padding-bottom","padding-left",
      "gap","justify-content","align-items","line-height","letter-spacing",
      "text-transform","text-align","background-color","border","border-radius","box-shadow"
    ];
    const styleSubset = {};
    for (const k of styleSubsetKeys) styleSubset[k] = styles.getPropertyValue(k);

    const payload = {
      meta: {
        url: location.href,
        title: document.title,
        timestamp: new Date().toISOString(),
        viewport: { w: window.innerWidth, h: window.innerHeight }
      },
      selection: {
        cssSelector,
        path: [],
        outerHTML: outer,
        text: (el.textContent || "").trim().slice(0, 2000),
        attributes: (function(){
          const out = {}; 
          for (const attr of el.attributes || []) out[attr.name] = attr.value;
          return out;
        })(),
        box: { x: rect.x, y: rect.y, w: rect.width, h: rect.height },
        styles: styleSubset,
        react: {
          componentName,
          ownerStack,
          hasFiber: !!fiber
        }
      },
      feedback: {
        intent: "Describe aquí TU CAMBIO deseado",
        notes: ""
      }
    };

    makePanel(el, payload);
  }

  function toast(msg) {
    const el = document.createElement("div");
    el.textContent = msg;
    Object.assign(el.style, {
      position: "fixed", top: "10px", right: "10px", zIndex: 999999,
      background: "#111", color: "#fff", padding: "8px 12px",
      borderRadius: "8px", fontFamily: "system-ui", boxShadow: "0 2px 10px rgba(0,0,0,.3)"
    });
    document.body.appendChild(el);
    setTimeout(()=>el.remove(), 1500);
  }

  function removePanel() {
    if (panelEl && panelEl.parentNode) panelEl.parentNode.removeChild(panelEl);
    panelEl = null;
  }

  function stopPicking() {
    picking = false;
    if (lastHover) {
      lastHover.classList.remove("__cursor_pick_hover");
      lastHover = null;
    }
    document.removeEventListener("mousemove", onMove, true);
    document.removeEventListener("click", onClick, true);
    document.removeEventListener("keydown", onKeydown, true);
  }

  function onKeydown(e) {
    if (!picking) return;
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      stopPicking();
      removePanel();
    }
  }

  function enablePanelDrag(panel, handle) {
    if (!panel || !handle) return;
    let pointerId = null;
    let offsetX = 0;
    let offsetY = 0;

    function clamp(val, min, max) {
      if (Number.isNaN(val)) return min;
      return Math.min(Math.max(val, min), max);
    }

    const onWindowBlur = () => endDrag();

    const onPointerDown = (e) => {
      if (pointerId !== null || e.button !== 0) return;
      pointerId = e.pointerId;
      const rect = panel.getBoundingClientRect();
      offsetX = e.clientX - rect.left;
      offsetY = e.clientY - rect.top;
      try { handle.setPointerCapture(pointerId); } catch(_) {}
      panel.classList.add("__dragging");
      window.addEventListener("blur", onWindowBlur);
      e.preventDefault();
    };

    const onPointerMove = (e) => {
      if (pointerId === null || e.pointerId !== pointerId) return;
      const width = panel.offsetWidth;
      const height = panel.offsetHeight;
      const maxLeft = Math.max(0, window.innerWidth - width - 12);
      const maxTop = Math.max(0, window.innerHeight - height - 12);
      const nextLeft = clamp(e.clientX - offsetX, 6, maxLeft);
      const nextTop = clamp(e.clientY - offsetY, 6, maxTop);
      panel.style.left = `${nextLeft}px`;
      panel.style.top = `${nextTop}px`;
    };

    const endDrag = (e) => {
      if (pointerId === null || (e && e.pointerId !== pointerId)) return;
      try { handle.releasePointerCapture(pointerId); } catch(_) {}
      pointerId = null;
      panel.classList.remove("__dragging");
      window.removeEventListener("blur", onWindowBlur);
    };

    handle.addEventListener("pointerdown", onPointerDown);
    handle.addEventListener("pointermove", onPointerMove);
    handle.addEventListener("pointerup", endDrag);
    handle.addEventListener("pointercancel", endDrag);
  }

  function makePanel(el, payload) {
    removePanel(); // elimina si ya había uno abierto
    const rect = el.getBoundingClientRect();
    const top = Math.max(10, rect.top + window.scrollY - 8);
    const left = Math.max(10, rect.left + window.scrollX);
  
    panelEl = document.createElement("div");
    panelEl.className = "__cursor_pick_panel";
    // Posicionamiento basado en el elemento clicado
    panelEl.style.position = "fixed";
    panelEl.style.top = top + "px";
    panelEl.style.left = left + "px";
    panelEl.style.zIndex = "2147483647";
    panelEl.innerHTML = `
      <div class="__hdr">
        <button class="__drag_handle" title="Arrastra para mover">
          <span class="__glyph">⋮⋮</span>
          <span>Mover</span>
        </button>
        <div class="__modebar" role="tablist">
          <button class="__mode_btn __active" data-mode="prompt" title="Modo instrucciones">↗</button>
          <button class="__mode_btn" data-mode="visual" title="Modo visual">🎨</button>
        </div>
        <button class="__close" title="Cerrar">✕</button>
      </div>
      <div class="__meta">
        <div><span class="__k">Selector:</span> <code class="__selector"></code></div>
        <div><span class="__k">React:</span> <code class="__react"></code></div>
        <div><span class="__k">Texto:</span> <span class="__txt"></span></div>
      </div>
      <div class="__viewwrap">
        <div class="__view __view_prompt" data-view="prompt">
          <div class="__prompt_hint">Escribe instrucciones claras para Cursor. Usa ⌘/Ctrl + Enter para enviar rápidamente.</div>
          <label class="__lbl">Tu feedback</label>
          <textarea class="__ta" rows="5" placeholder="Describe el cambio que quieres"></textarea>
        </div>
        <div class="__view __view_visual" data-view="visual" hidden>
          <div class="__editor">
            <div class="__editor_hdr">
              <strong>Controles visuales</strong>
              <button class="__btn __reset" type="button" title="Revertir cambios">Restablecer</button>
            </div>
            <div class="__section" data-section="component">
              <div class="__section_title">Componente</div>
              <div class="__section_body"></div>
            </div>
            <div class="__section" data-section="layout">
              <div class="__section_title">Diseño</div>
              <div class="__section_body"></div>
            </div>
            <div class="__section" data-section="appearance">
              <div class="__section_title">Color y bordes</div>
              <div class="__section_body"></div>
            </div>
            <div class="__section" data-section="typography">
              <div class="__section_title">Tipografía</div>
              <div class="__section_body"></div>
            </div>
          </div>
        </div>
      </div>
      <div class="__changes" hidden>
        <strong>Cambios visuales listos</strong>
        <div class="__change_badges"></div>
        <label class="__change_toggle"><input type="checkbox" class="__include_changes" checked /> Incluir estos cambios en el prompt</label>
      </div>
      <div class="__actions">
        <button class="__btn __send">Enviar</button>
        <button class="__btn __cancel">Cancelar</button>
      </div>
    `;
    const dragHandle = panelEl.querySelector(".__drag_handle");
    enablePanelDrag(panelEl, dragHandle);
  
    // 💅 Estilos inline + internos para el panel
    // ... (mismos estilos del ZIP)
  
    // 🧠 Rellena los datos del elemento
    panelEl.querySelector(".__selector").textContent = payload.selection.cssSelector;
    panelEl.querySelector(".__react").textContent = payload.selection.react?.componentName || "—";
    panelEl.querySelector(".__txt").textContent = payload.selection.text.slice(0, 140);
  
    // 🪄 Botones y vistas
    const sendBtn = panelEl.querySelector(".__send");
    const ta = panelEl.querySelector(".__ta");
    const resetBtn = panelEl.querySelector(".__reset");
    const includeCheckbox = panelEl.querySelector(".__include_changes");
    const modeButtons = Array.from(panelEl.querySelectorAll(".__mode_btn"));
    const viewPrompt = panelEl.querySelector(".__view_prompt");
    const viewVisual = panelEl.querySelector(".__view_visual");
  
    function setPanelMode(mode) {
      if (!mode || !panelEl) return;
      panelEl.dataset.mode = mode;
      if (viewPrompt) viewPrompt.hidden = mode !== "prompt";
      if (viewVisual) viewVisual.hidden = mode !== "visual";
      modeButtons.forEach(btn => {
        btn.classList.toggle("__active", btn.dataset.mode === mode);
      });
      if (mode === "prompt" && ta) {
        setTimeout(() => {
          ta.focus();
          ta.setSelectionRange(ta.value.length, ta.value.length);
        }, 80);
      }
    }
  
    modeButtons.forEach(btn => {
      btn.addEventListener("click", (event) => {
        event.preventDefault();
        const mode = btn.dataset.mode;
        if (mode) setPanelMode(mode);
      });
    });
  
    setPanelMode("prompt");

    const visualEditor = setupVisualEditor({
      panelEl,
      initialEl: el,
      payload,
      includeCheckbox,
      buildSelector: buildRobustSelector
    });

    if (resetBtn && visualEditor?.resetChanges) {
      resetBtn.addEventListener("click", () => visualEditor.resetChanges());
    }

    function openDeeplinkUrl(url) {
      try {
        // Iframe oculto (no cambia de pestaña)
        const iframe = document.createElement("iframe");
        iframe.style.display = "none";
        iframe.src = url;
        document.documentElement.appendChild(iframe);
        setTimeout(() => iframe.remove(), 2000);
      } catch(_) {}
      try {
        // Enlace simulado dentro del mismo gesto de usuario
        const a = document.createElement("a");
        a.href = url;
        a.style.display = "none";
        document.documentElement.appendChild(a);
        a.click();
        setTimeout(() => a.remove(), 1000);
      } catch(_) {}
    }

    function buildPromptFromPayload(payload, extraPrompt) {
      const parts = [];
      const title = payload?.meta?.title || "";
      const urlFromPage = payload?.meta?.url || "";
      const selector = payload?.selection?.cssSelector || "";
      const reactName = payload?.selection?.react?.componentName || "";
      const ownerStack = Array.isArray(payload?.selection?.react?.ownerStack) ? payload.selection.react.ownerStack.slice(0, 3).join(" > ") : "";
      const selText = (payload?.selection?.text || "").replace(/\s+/g, " ").trim().slice(0, 500);
      const intent = payload?.feedback?.intent || "";
      const notes = (payload?.feedback?.notes || "").trim();
      const visualSummary = payload?.feedback?.visualSummary;
      const appliedStyles = Array.isArray(payload?.selection?.appliedStyles) ? payload.selection.appliedStyles : [];
      const tagChange = payload?.selection?.tagChange;
      const mergedNotes = extraPrompt && extraPrompt.trim().length ? (notes ? notes + "\n" + extraPrompt.trim() : extraPrompt.trim()) : notes;
      parts.push(`[Web] ${title} — ${urlFromPage}`);
      if (selector) parts.push(`-> CSS selector: ${selector}`);
      if (reactName) parts.push(`-> React component name: ${reactName}${ownerStack ? ` (${ownerStack})` : ""}`);
      if (selText) parts.push(`-> Text in the element: ${selText}`);
      if (visualSummary) parts.push(visualSummary);
      if (tagChange && tagChange.before && tagChange.after) {
        parts.push(`-> Conversión del componente: ${tagChange.before} → ${tagChange.after}`);
      }
      if (appliedStyles.length && appliedStyles.some(item => item?.after)) {
        const formatted = appliedStyles.slice(0, 8).map(ch => `${ch.property}: ${ch.after}`).join("; ");
        parts.push(`-> Ajustes visuales aplicados: ${formatted}`);
      }
      if (mergedNotes) parts.push(`-> What user wants to change: ${mergedNotes}`);
      parts.push(`-> System prompt: You are a frontend code assistant specializing in locating and modifying UI components.

        **Your primary goal**: Given a CSS selector and user intent, you must:
        
        1. **INFER THE ACTUAL COMPONENT FILE** from:
           - The CSS selector path
           - The URL/route structure
           - The text content
           - Common framework conventions (React, Vue, Angular, Svelte)
        
        2. **IDENTIFY THE FRAMEWORK** by analyzing:
           - File extensions (.tsx, .jsx, .vue, .svelte)
           - Project structure (src/pages, src/views, app/, etc.)
           - Package.json dependencies if available
        
        3. **LOCATE THE EXACT CODE** by:
           - Searching for the text content in the codebase
           - Following the route/page structure 
           - Checking common component patterns
        
        4. **MAKE TARGETED CHANGES** that:
           - Fulfill the user's specific intent
           - Preserve existing functionality and styling
           - Follow the project's coding conventions
           - Consider i18n/translations if present
        
        5. **COMMUNICATE CLEARLY** by:
           - Showing the exact file path
           - Displaying before/after code
           - Explaining the changes made
           - Suggesting improvements when relevant
        
        **Important**: Never make assumptions. If you cannot confidently locate the component, ask for clarification or suggest using file search tools.`);
      return parts.filter(Boolean).join("\n").slice(0, 1800);
    }

    function doSend() {
      if (sendBtn.dataset.loading === "1") return;
      sendBtn.dataset.loading = "1";
      const prevText = sendBtn.textContent;
      sendBtn.textContent = "Enviando...";
      sendBtn.disabled = true;
      const feedbackText = panelEl.querySelector(".__ta").value.trim();
      if (feedbackText) {
        payload.feedback.notes = feedbackText;
      }
      if (visualEditor?.syncBeforeSend) {
        visualEditor.syncBeforeSend();
      }
      // Decide flujo según config
      chrome.storage.sync.get({
        endpoint: "http://127.0.0.1:3434/cursor",
        useDeeplink: true,
        extraPrompt: ""
      }).then(cfg => {
        const extraSegments = [];
        if (cfg.extraPrompt) extraSegments.push(cfg.extraPrompt);
        const mergedExtraPrompt = extraSegments.join("\n").trim();
        if (cfg.useDeeplink) {
          const text = buildPromptFromPayload(payload, mergedExtraPrompt);
          const url = `cursor://anysphere.cursor-deeplink/prompt?text=${encodeURIComponent(text)}`;
          openDeeplinkUrl(url);
          sendBtn.textContent = prevText;
          sendBtn.disabled = false;
          sendBtn.dataset.loading = "0";
          if (visualEditor?.resetChanges) visualEditor.resetChanges();
          removePanel();
          toast("✅ Enviado a Cursor");
        } else {
          chrome.runtime.sendMessage({ type: "PICKED_ELEMENT_PAYLOAD", payload }, (resp) => {
            const runtimeError = chrome.runtime.lastError;
            sendBtn.textContent = prevText;
            sendBtn.disabled = false;
            sendBtn.dataset.loading = "0";
            if (visualEditor?.resetChanges) visualEditor.resetChanges();
            removePanel();
            if (runtimeError) {
              console.error("[CursorPick] Error al enviar payload a background:", runtimeError);
              toast("⚠️ Error al enviar");
              return;
            }
            if (resp?.ok) {
              toast("✅ Enviado");
            } else {
              console.error("[CursorPick] Respuesta inesperada del background:", resp);
              toast("⚠️ Error al enviar");
            }
          });
        }
      }).catch((err) => {
        console.error("[CursorPick] No se pudo enviar el prompt. Activando fallback deeplink.", err);
        // Fallback: intenta deeplink simple
        const url = `cursor://anysphere.cursor-deeplink/prompt?text=${encodeURIComponent(payload?.selection?.text || "")}`;
        openDeeplinkUrl(url);
        sendBtn.textContent = prevText;
        sendBtn.disabled = false;
        sendBtn.dataset.loading = "0";
        if (visualEditor?.resetChanges) visualEditor.resetChanges();
        removePanel();
        toast("✅ Enviado (fallback)");
      });
    }

    sendBtn.addEventListener("click", doSend);
    ta.addEventListener("keydown", (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        doSend();
      }
    });
  
    panelEl.querySelector(".__cancel").addEventListener("click", () => {
      if (visualEditor?.resetChanges) visualEditor.resetChanges();
      removePanel();
    });
    panelEl.querySelector(".__close").addEventListener("click", () => {
      if (visualEditor?.resetChanges) visualEditor.resetChanges();
      removePanel();
    });
  
    document.body.appendChild(panelEl);
  }
  
  function startPicking() {
    if (picking) return;
    picking = true;
    toast("🎯 Modo selección activo: haz clic en el elemento");
    // Limpia estado previo
    if (lastHover) {
      lastHover.classList.remove("__cursor_pick_hover");
      lastHover = null;
    }
    removePanel();
    document.addEventListener("mousemove", onMove, true);
    document.addEventListener("click", onClick, true);
    document.addEventListener("keydown", onKeydown, true);
  }

  // Mensajes desde popup
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg?.type === "START_PICK") {
      startPicking();
      sendResponse({ ok: true });
    }
  });
})();
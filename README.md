# Cursor Visual Picker · Visual Editor

> MV3 extension that turns any DOM element into an enriched prompt for Cursor, with live visual controls and ready-to-send deep links.

## ✨ Highlight Reel

- **Floating, draggable HUD** · drop the panel anywhere on the screen and switch between prompt and visual modes instantly.
- **Design-tool-style controls** · sliders, color pickers, tag switching, flex helpers and more applied directly on the page.
- **Change badges** · every tweak becomes a removable pill before you send it to Cursor.
- **Deep link or webhook** · either trigger `cursor://` or ship a payload to your local endpoint.
- **Rich context** · robust CSS selector, `outerHTML`, key styles, bounding box and React metadata when available.

![Demo placeholder](./docs/demo.gif)

## ⚡ Quick Install (Developer Mode)

1. Clone this repository.
2. Open `chrome://extensions` and enable **Developer mode**.
3. Click **Load unpacked** and select the project folder.
4. (Optional) Pin the extension to keep the popup handy.

## 🧭 How It Works

1. Open the popup and configure:
   - `Local endpoint` (e.g. `http://127.0.0.1:3434/cursor`) **or** toggle **Cursor Deeplink**.
   - `Extra prompt` to append fixed notes to every submission.
2. Hit **Pick element** (or use `Cmd/Ctrl+Shift+Y`).
3. Click any node on the page.
4. The floating panel appears:
   - **Prompt mode**: draft instructions, check selector and metadata.
   - **Visual mode**: adjust width, spacing, typography, colors, display, gap, and more.
   - Every modification becomes a **badge** you can remove individually.
5. Press **Send**:
   - With deeplink it opens `cursor://anysphere.cursor-deeplink/prompt`.
   - With endpoint it performs a `POST` with the full payload. Failures are logged in the console as `[CursorPick]`.

## 🛰️ Sample Payload

```json
{
  "meta": { "url": "https://midominio", "title": "Landing", "timestamp": "..." },
  "selection": {
    "cssSelector": "div.hero > h1",
    "outerHTML": "<h1 class=\"hero-title\">Hola</h1>",
    "text": "Hola",
    "box": { "x": 120, "y": 320, "w": 560, "h": 120 },
    "styles": { "font-size": "48px", "color": "rgb(17,17,17)", "display": "block" },
    "appliedStyles": [
      { "property": "font-size", "before": "48px", "after": "56px" },
      { "property": "background-color", "before": "rgba(0,0,0,0)", "after": "#0b5fff" }
    ],
    "tagChange": { "before": "div", "after": "section" },
    "react": { "componentName": "HeroTitle", "ownerStack": ["Hero", "Landing"] }
  },
  "feedback": {
    "notes": "I need stronger contrast in the hero",
    "visualSummary": "update: font size: 48px → 56px; background color: ...",
    "intent": "Describe here THE CHANGE you want"
  }
}
```

## ⚙️ Suggested Local Endpoint (Node/Express)

```js
import express from "express";
const app = express();
app.use(express.json({ limit: "2mb" }));

app.post("/cursor", async (req, res) => {
  const payload = req.body;
  console.log("[CursorPick] Received:", payload.meta?.url, payload.selection?.cssSelector);

  // TODO: build a prompt and forward it to Cursor, your LLM or MCP.
  // Example: write the HTML to disk, trigger a CLI tool, etc.

  res.json({ ok: true });
});

app.listen(3434, () => console.log("Listening http://127.0.0.1:3434"));
```

## 🛠️ Development Notes

- **MV3 extension** → service worker in `background.js`, content script in `content.js`, popup UI in `popup.html`/`popup.js`.
- **Manual reload** → after editing, go back to `chrome://extensions` and click **Reload**.
- **Logging** → open DevTools on the current tab to inspect the content script; transport issues are logged as `[CursorPick]`.
- **Shortcuts** → `Cmd/Ctrl+Shift+Y` toggles the picker (configurable via `manifest.json`).

## 🧩 Roadmap

- Element screenshot + automatic crop.
- Hover/active/focus states inspired by design tools.
- Multi-element selection and grouped prompts.
- Bidirectional Cursor MCP integration.
- Sync prompt presets via `chrome.storage.sync`.

## 🤝 Contributing

1. Fork the project and create a descriptive branch.
2. Keep files ASCII-friendly and respect MV3 constraints.
3. Open a PR with demos (gifs/screens) and a UX summary.

## 📄 License

This project is licensed under [MIT](./LICENSE). Feel free to use, modify, and distribute it as long as you preserve the copyright notice.
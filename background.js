// background.js (service worker)
chrome.runtime.onInstalled.addListener(() => {
  console.log("Cursor Visual Picker: Visual Editor instalado");
  // Crear menú contextual
  try {
    chrome.contextMenus.create({
      id: "cursor-pick-element",
      title: "Cursor: Seleccionar elemento (⌘⇧Y / Ctrl+Shift+Y)",
      contexts: ["page", "selection", "link", "image", "video", "audio"]
    });
  } catch (_) {}
});

// Simple message router
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    try {
      if (msg?.type === "PICKED_ELEMENT_PAYLOAD") {
        const { payload } = msg;

        // Lee config del popup (modo, endpoint, usarDeeplink, prompt extra)
        const cfg = await chrome.storage.sync.get({
          endpoint: "http://127.0.0.1:3434/cursor",
          useDeeplink: false,
          extraPrompt: ""
        });

        payload.feedback = payload.feedback || {};
        if (cfg.extraPrompt && cfg.extraPrompt.trim().length) {
          payload.feedback.notes = (payload.feedback.notes || "") + "\n" + cfg.extraPrompt.trim();
        }

        if (cfg.useDeeplink) {
          // Deeplink a Cursor usando prompt?text=...
          const parts = [];
          const title = payload?.meta?.title || "";
          const urlFromPage = payload?.meta?.url || "";
          const selector = payload?.selection?.cssSelector || "";
          const reactName = payload?.selection?.react?.componentName || "";
          const ownerStack = Array.isArray(payload?.selection?.react?.ownerStack) ? payload.selection.react.ownerStack.slice(0, 3).join(" > ") : "";
          const selText = (payload?.selection?.text || "").replace(/\s+/g, " ").trim().slice(0, 500);
          const intent = payload?.feedback?.intent || "";
          const notes = (payload?.feedback?.notes || "").trim();

          parts.push(`[Web] ${title} — ${urlFromPage}`);
          if (selector) parts.push(`-> CSS selector: ${selector}`);
          if (reactName) parts.push(`-> React component name: ${reactName}${ownerStack ? ` (${ownerStack})` : ""}`);
          if (selText) parts.push(`-> Text in the element: ${selText}`);
          if (intent) parts.push(`-> Intent: ${intent}`);
          if (notes) parts.push(`-> What user wants to change: ${notes}`);
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

3. **LOCATE THE EXACT CODE** by:
   - Searching for the text content in the codebase
   - Following the route/page structure 
   - Checking common component patterns

4. **MAKE TARGETED CHANGES** that:
   - Fulfill the user's specific intent

5. **COMMUNICATE CLEARLY** by:
   - Showing the exact file path
   - Displaying before/after code
   - Explaining the changes made
   - Suggesting improvements when relevant

**Important**: Never make assumptions. If you cannot confidently locate the component, ask for clarification or suggest using file search tools.`);

          const promptText = parts.filter(Boolean).join("\n").slice(0, 1800);
          const url = `cursor://anysphere.cursor-deeplink/prompt?text=${encodeURIComponent(promptText)}`;
          try {
            const tab = await chrome.tabs.create({ url, active: false });
            // Cierra la pestaña efímera en segundo plano para no sacar al usuario de su ventana
            setTimeout(() => {
              if (tab?.id) {
                chrome.tabs.remove(tab.id).catch(() => {});
              }
            }, 2000);
            sendResponse({ ok: true, method: "deeplink", url });
          } catch (e) {
            sendResponse({ ok: false, method: "deeplink", error: String(e) });
          }
          return;
        } else {
          // Llama a servidor local
          const url = cfg.endpoint;
          const res = await fetch(url + "?t=" + Date.now(), {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify(payload)
          });
          const text = await res.text();
          sendResponse({ ok: res.ok, status: res.status, text });
          return;
        }
      }

      if (msg?.type === "START_PICK_FROM_POPUP") {
        // 🔧 Nuevo: encontrar la pestaña activa y mandar START_PICK
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab?.id) {
          await chrome.tabs.sendMessage(tab.id, { type: "START_PICK" });
          sendResponse({ ok: true, tabId: tab.id });
        } else {
          sendResponse({ ok: false, error: "No active tab" });
        }
        return;
      }
      sendResponse({ ok: false, error: "Unknown message type" });
    } catch (e) {
      sendResponse({ ok: false, error: String(e) });
    }
  })();
  return true; // keep message channel open for async
});

// Click del menú contextual
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "cursor-pick-element" && tab?.id) {
    try {
      await chrome.tabs.sendMessage(tab.id, { type: "START_PICK" });
    } catch (e) {
      console.warn("No se pudo iniciar picker en la pestaña", e);
    }
  }
});

// Atajo de teclado para activar el selector
chrome.commands?.onCommand.addListener(async (command) => {
  if (command === "start-pick") {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      try { await chrome.tabs.sendMessage(tab.id, { type: "START_PICK" }); } catch (_) {}
    }
  }
});
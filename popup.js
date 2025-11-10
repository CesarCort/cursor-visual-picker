// popup.js
async function load() {
  const cfg = await chrome.storage.sync.get({
    endpoint: "http://127.0.0.1:3434/cursor",
    useDeeplink: false,
    extraPrompt: ""
  });
  document.getElementById("endpoint").value = cfg.endpoint;
  document.getElementById("useDeeplink").checked = cfg.useDeeplink;
  document.getElementById("extraPrompt").value = cfg.extraPrompt;
}
async function save() {
  const endpoint = document.getElementById("endpoint").value.trim();
  const useDeeplink = document.getElementById("useDeeplink").checked;
  const extraPrompt = document.getElementById("extraPrompt").value;
  await chrome.storage.sync.set({ endpoint, useDeeplink, extraPrompt });
  window.close();
}

document.getElementById("pick").addEventListener("click", async () => {
  // Pide al content script que inicie el modo selección
  chrome.runtime.sendMessage({ type: "START_PICK_FROM_POPUP" }, (resp) => {
    window.close();
  });
});

document.getElementById("save").addEventListener("click", save);
load();
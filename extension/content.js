const script = document.createElement("script");
script.src = chrome.runtime.getURL("injected.js");
document.documentElement.appendChild(script);

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.ping) { sendResponse(true); return; }
  if (!msg.query) return;

  const channel = new MessageChannel();
  channel.port1.onmessage = (e) => sendResponse(e.data);
  window.postMessage({ type: "DIG_JS", query: msg.query }, "*", [channel.port2]);
  return true;
});

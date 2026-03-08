# Architecture

```
popup.html / popup.js
    │
    ├── Auto-scan: uses chrome.scripting.executeScript to read
    │   localStorage, sessionStorage, and document.cookie
    │   directly in the page context. Matches by key name
    │   (token, session, etc.) and by value prefix (eyJ).
    │
    └── Custom search: sends a message via chrome.tabs.sendMessage
            │
        content.js (isolated world)
            │   Injects injected.js into the page and acts as
            │   a bridge using MessageChannel.
            │
        injected.js (main world)
                Runs digJs() which recursively walks the window
                object tree looking for string values matching
                the given prefix.
```

- `popup.js` runs in the extension side panel. It handles the UI, triggers the auto-scan, and the manual search. It also lets you pick which tab to scan.
- `background.js` opens the side panel when you click the extension icon.
- `content.js` runs in the page's isolated world. It can communicate with the extension but cannot access the page's JS objects. It injects `injected.js` and forwards messages between the popup and the injected script.
- `injected.js` runs in the page's main world. It has full access to `window` and all JS objects created by the page. It performs the recursive search.

## Permissions

- `activeTab` allows the extension to interact with the currently active tab only when you click the extension icon. No background access to other tabs.
- `scripting` allows `chrome.scripting.executeScript` to run the auto-scan (read localStorage, sessionStorage, cookies) in the page context.
- `sidePanel` allows the extension to open as a side panel instead of a popup, so it stays open while you interact with the page.
- `tabs` allows reading the list of open tabs so you can choose which one to scan.

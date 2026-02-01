// Content script - bridges between webpage and background service worker

// Inject the provider script into the page
function injectScript() {
  try {
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('inpage.js');
    script.onload = function () {
      script.remove();
    };
    (document.head || document.documentElement).appendChild(script);
  } catch (error) {
    console.error('[QFC] Failed to inject provider:', error);
  }
}

// Run injection early
injectScript();

// Create a long-lived connection to background
let port: chrome.runtime.Port | null = null;

function connect() {
  port = chrome.runtime.connect({ name: 'qfc-content' });

  port.onMessage.addListener((message) => {
    // Forward response to page
    window.postMessage(
      {
        type: 'QFC_RESPONSE',
        id: message.id,
        payload: message,
      },
      '*'
    );
  });

  port.onDisconnect.addListener(() => {
    console.log('[QFC] Port disconnected, reconnecting...');
    port = null;
    // Reconnect after a short delay
    setTimeout(connect, 1000);
  });
}

connect();

// Listen for messages from the injected provider
window.addEventListener('message', (event) => {
  // Only accept messages from the same window
  if (event.source !== window) return;

  const { type, id, payload } = event.data;

  if (type === 'QFC_REQUEST') {
    // Forward request to background
    if (port) {
      port.postMessage({
        id,
        method: payload.method,
        params: payload.params,
        origin: window.location.origin,
      });
    } else {
      // Fallback to sendMessage if port is not available
      chrome.runtime.sendMessage(
        {
          id,
          method: payload.method,
          params: payload.params,
          origin: window.location.origin,
        },
        (response) => {
          window.postMessage(
            {
              type: 'QFC_RESPONSE',
              id,
              payload: response,
            },
            '*'
          );
        }
      );
    }
  }
});

// Notify page that content script is ready
window.postMessage({ type: 'QFC_CONTENT_READY' }, '*');

console.log('[QFC] Content script loaded');

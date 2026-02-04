console.log("Running background.js")

typeof chrome !== 'undefined' && typeof chrome.runtime !== 'undefined'

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {

  console.log("Background script received request:", request);


  if (request.type === "ZAPI_SEND_TEXT") {
    const { endpoint, apiKey, phone, message } = request;

    if (!endpoint || !apiKey) {
      sendResponse({ error: "Endpoint ou API key ausentes" });
      return;
    }

    fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey
      },
      body: JSON.stringify({ phone, message })
    })
      .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        if (!ok) {
          sendResponse({ error: data?.message || "Falha na chamada Z-API" });
          return;
        }
        sendResponse({ data });
      })
      .catch((error) => sendResponse({ error: error.message }));

    return true;
  }

  if (request.type === "FETCH_ORDER") {
    fetch("https://jsonplaceholder.typicode.com/todos/1")
      .then(res => res.json())
      .then(data => sendResponse({ data }))
      .catch(error => sendResponse({ error: error.message }));

    return true;
  }

  if (request.type === "KDS_ORDER") {
    const { endpoint, apiKey, payload } = request;

    if (!endpoint) {
      sendResponse({ error: "Endpoint do KDS ausente" });
      return;
    }

    fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(apiKey ? { "x-api-key": apiKey } : {})
      },
      body: JSON.stringify(payload || {})
    })
      .then((res) => res.text().then((text) => ({ ok: res.ok, text })))
      .then(({ ok, text }) => {
        if (!ok) {
          sendResponse({ error: text || "Falha na chamada KDS" });
          return;
        }
        try {
          sendResponse({ data: JSON.parse(text) });
        } catch {
          sendResponse({ data: text });
        }
      })
      .catch((error) => sendResponse({ error: error.message }));

    return true;
  }

  if (request.type === "KDS_ZONES") {
    const { endpoint, apiKey } = request;

    if (!endpoint) {
      sendResponse({ error: "Endpoint de zonas ausente" });
      return;
    }

    fetch(endpoint, {
      headers: {
        ...(apiKey ? { "x-api-key": apiKey } : {})
      }
    })
      .then((res) => res.text().then((text) => ({ ok: res.ok, text })))
      .then(({ ok, text }) => {
        if (!ok) {
          sendResponse({ error: text || "Falha ao buscar zonas" });
          return;
        }
        try {
          sendResponse({ data: JSON.parse(text) });
        } catch {
          sendResponse({ data: text });
        }
      })
      .catch((error) => sendResponse({ error: error.message }));

    return true;
  }
});

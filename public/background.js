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
});

console.log("Running background.js")

typeof chrome !== 'undefined' && typeof chrome.runtime !== 'undefined'

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {

  console.log("Background script received request:", request);


  if (request.type === "FETCH_ORDER") {
    fetch("https://jsonplaceholder.typicode.com/todos/1")
      .then(res => res.json())
      .then(data => sendResponse({ data }))
      .catch(error => sendResponse({ error: error.message }));

    return true;
  }
});

// main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { initWhatsAppButtonsReact } from "./inject-whatsapp-react";

console.log("🚀 Content script iniciado");

// (se você já cria um container React, mantenha)
const container = document.createElement("div");
container.id = "amodomio-root";
document.body.appendChild(container);

ReactDOM.createRoot(container).render(
  <React.StrictMode>
    {/* <AppSidebar /> */}
  </React.StrictMode>
);

// inicializa o observador que injeta os botões ao lado do telefone
initWhatsAppButtonsReact();

// main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { initWhatsAppButtonsReact } from "./inject-whatsapp-react";
import { initKdsSync } from "./inject-kds-sync";

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

// ✅ Inicializa botões de WhatsApp
initWhatsAppButtonsReact();
// ✅ Inicializa sync KDS
initKdsSync();

// ✅ Inicializa estilização do tempo de produção
// initProductionTime();

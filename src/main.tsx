// main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { initWhatsAppButtonsReact } from "./inject-whatsapp-react";
import { initKdsSync } from "./inject-kds-sync";
import { getModuleFlagKey, getModuleStates, setModuleEnabled, type ModuleId } from "./common/module-flags";
import { bootstrapStorage, readExtensionStorageByPrefix, readLocalStorageByPrefix } from "./common/storage";

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

async function bootstrapAndInitModules() {
  await bootstrapStorage();

  const moduleStates = getModuleStates();

  if (moduleStates.whatsapp) {
    initWhatsAppButtonsReact();
  }

  if (moduleStates.kdsSync || moduleStates.kdsQueueBar) {
    initKdsSync({
      enableSyncButtons: moduleStates.kdsSync,
      enableQueueBar: moduleStates.kdsQueueBar
    });
  }
}

// Helper para ativar/desativar módulos sem precisar editar código.
declare global {
  interface Window {
    amodomioModules?: {
      status: () => ReturnType<typeof getModuleStates>;
      enable: (moduleId: ModuleId) => void;
      disable: (moduleId: ModuleId) => void;
      key: (moduleId: ModuleId) => string;
      reload: () => void;
      diagStorage: () => Promise<{
        local: Record<string, string>;
        extension: Record<string, string>;
        missingInLocal: string[];
        missingInExtension: string[];
      }>;
      printStorage: () => Promise<void>;
    };
  }
}

window.amodomioModules = {
  status: () => getModuleStates(),
  enable: (moduleId: ModuleId) => setModuleEnabled(moduleId, true),
  disable: (moduleId: ModuleId) => setModuleEnabled(moduleId, false),
  key: (moduleId: ModuleId) => getModuleFlagKey(moduleId),
  reload: () => window.location.reload(),
  diagStorage: async () => {
    const local = readLocalStorageByPrefix("amodomio-");
    const extension = await readExtensionStorageByPrefix("amodomio-");
    const localKeys = new Set(Object.keys(local));
    const extensionKeys = new Set(Object.keys(extension));
    const missingInLocal = Array.from(extensionKeys).filter((k) => !localKeys.has(k));
    const missingInExtension = Array.from(localKeys).filter((k) => !extensionKeys.has(k));
    return { local, extension, missingInLocal, missingInExtension };
  },
  printStorage: async () => {
    const diag = await window.amodomioModules!.diagStorage();
    console.log("[amodomio] storage diag", diag);
  }
};

void bootstrapAndInitModules();

// ✅ Inicializa estilização do tempo de produção
// initProductionTime();

import { readStorage, writeStorage } from "./storage";

export type ModuleId = "whatsapp" | "kds_sync" | "kds_queue_bar";

const MODULE_KEYS: Record<ModuleId, string> = {
    whatsapp: "amodomio-module-whatsapp",
    kds_sync: "amodomio-module-kds-sync",
    kds_queue_bar: "amodomio-module-kds-queue-bar"
};

const FALSE_VALUES = new Set(["0", "false", "off", "disabled", "no"]);
const TRUE_VALUES = new Set(["1", "true", "on", "enabled", "yes"]);

export function isModuleEnabled(moduleId: ModuleId, defaultValue = true): boolean {
    const raw = readStorage(MODULE_KEYS[moduleId]).toLowerCase();
    if (!raw) return defaultValue;
    if (FALSE_VALUES.has(raw)) return false;
    if (TRUE_VALUES.has(raw)) return true;
    return defaultValue;
}

export function setModuleEnabled(moduleId: ModuleId, enabled: boolean) {
    writeStorage(MODULE_KEYS[moduleId], enabled ? "1" : "0");
}

export function getModuleStates() {
    return {
        whatsapp: isModuleEnabled("whatsapp", true),
        kdsSync: isModuleEnabled("kds_sync", true),
        kdsQueueBar: isModuleEnabled("kds_queue_bar", true)
    };
}

export function getModuleFlagKey(moduleId: ModuleId): string {
    return MODULE_KEYS[moduleId];
}

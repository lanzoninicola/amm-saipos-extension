declare const chrome: any;

const EXT_KEY_PREFIX = "amodomio-";

function normalizeValue(value: unknown): string {
    if (value === null || value === undefined) return "";
    return String(value).trim();
}

function getRuntimeStorage(): any | null {
    if (typeof chrome === "undefined") return null;
    if (!chrome?.storage?.local) return null;
    return chrome.storage.local;
}

function storageGet(keys: string[] | null): Promise<Record<string, unknown>> {
    const storage = getRuntimeStorage();
    if (!storage) return Promise.resolve({});
    return new Promise((resolve) => {
        storage.get(keys, (result: Record<string, unknown>) => {
            resolve(result || {});
        });
    });
}

function storageSet(data: Record<string, string>): Promise<void> {
    const storage = getRuntimeStorage();
    if (!storage) return Promise.resolve();
    return new Promise((resolve) => {
        storage.set(data, () => resolve());
    });
}

export function readStorage(key: string): string {
    return normalizeValue(localStorage.getItem(key));
}

export function writeStorage(key: string, value: string) {
    const normalized = normalizeValue(value);
    localStorage.setItem(key, normalized);
    void storageSet({ [key]: normalized });
}

export async function bootstrapStorage() {
    const storage = getRuntimeStorage();
    if (!storage) return;

    const remote = await storageGet(null);

    // 1) Hydrate localStorage from extension storage (source of truth).
    for (const [key, rawValue] of Object.entries(remote)) {
        if (!key.startsWith(EXT_KEY_PREFIX)) continue;
        const normalized = normalizeValue(rawValue);
        localStorage.setItem(key, normalized);
    }

    // 2) One-time migration fallback: push local extension keys that don't exist remotely.
    const toMigrate: Record<string, string> = {};
    for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i);
        if (!key || !key.startsWith(EXT_KEY_PREFIX)) continue;
        if (Object.prototype.hasOwnProperty.call(remote, key)) continue;
        toMigrate[key] = normalizeValue(localStorage.getItem(key));
    }
    if (Object.keys(toMigrate).length > 0) {
        await storageSet(toMigrate);
    }
}

export async function readExtensionStorageByPrefix(prefix = EXT_KEY_PREFIX): Promise<Record<string, string>> {
    const raw = await storageGet(null);
    const filtered: Record<string, string> = {};
    for (const [key, value] of Object.entries(raw)) {
        if (!key.startsWith(prefix)) continue;
        filtered[key] = normalizeValue(value);
    }
    return filtered;
}

export function readLocalStorageByPrefix(prefix = EXT_KEY_PREFIX): Record<string, string> {
    const filtered: Record<string, string> = {};
    for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i);
        if (!key || !key.startsWith(prefix)) continue;
        filtered[key] = normalizeValue(localStorage.getItem(key));
    }
    return filtered;
}

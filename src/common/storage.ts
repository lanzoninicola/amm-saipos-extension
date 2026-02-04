export function readStorage(key: string): string {
    return (localStorage.getItem(key) || "").trim();
}

export function writeStorage(key: string, value: string) {
    localStorage.setItem(key, (value || "").trim());
}

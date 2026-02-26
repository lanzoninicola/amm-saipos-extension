export function extractFirstNumber(text: string): string {
    const match = (text || "").match(/\d+/);
    return match ? match[0] : "";
}

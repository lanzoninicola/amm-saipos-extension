import React, { useEffect, useRef, useState } from "react";
import { Banknote, Bike, Check, CreditCard, Loader2, Package, RefreshCw, Settings, Wallet } from "lucide-react";
import ReactDOM from "react-dom/client";
import { createPortal } from "react-dom";
import { fieldStyle, inputStyle, labelStyle } from "./common/inject-ui-common";
import { readStorage, writeStorage } from "./common/storage";
import { extractFirstNumber } from "./common/dom-helpers";

declare const chrome: any;

const PHONE_SELECTOR = 'span[data-qa="sale-customer-phone"]';
const NAME_SELECTOR = 'span[data-qa="sale-name"]';
const WRAPPER_CLASS = "amodomio-wapp-wrapper";
const KDS_MARK_ATTR = "data-amodomio-kds";
const DETAIL_SAVE_BUTTON_SELECTOR = 'button[ng-click="vm.save();"]';
const DETAIL_MODAL_SELECTOR = ".modal-content";
const DETAIL_SYNC_MARK_ATTR = "data-amodomio-kds-detail-sync";
const KDS_SYNC_ORDER_MESSAGE = "KDS_SYNC_ORDER";
const KDS_FETCH_ZONES_MESSAGE = "KDS_FETCH_ZONES";
const KDS_FETCH_ORDER_QUEUE_MESSAGE = "KDS_FETCH_ORDER_QUEUE";
const KDS_PATCH_ORDER_STATUS_MESSAGE = "KDS_PATCH_ORDER_STATUS";
const KDS_QUEUE_BAR_MOUNT_ID = "amodomio-kds-queue-bar-root";
const KDS_QUEUE_BAR_SPACER_ID = "amodomio-kds-queue-bar-spacer";
const DEFAULT_KDS_QUEUE_READ_ENDPOINT = "https://amodomio.com.br/api/kds/orders";

const commandContactByCard = new Map<string, { customerName: string; customerPhone: string }>();

const KDS_STORAGE_KEYS = {
    endpoint: "amodomio-kds-endpoint",
    apiKey: "amodomio-kds-api-key",
    zonesEndpoint: "amodomio-kds-zones-endpoint",
    queueEndpoint: "amodomio-kds-queue-endpoint",
    queuePollSeconds: "amodomio-kds-queue-poll-seconds",
    queueDate: "amodomio-kds-queue-date"
};

function getStoredKdsConfig() {
    return {
        endpoint: readStorage(KDS_STORAGE_KEYS.endpoint),
        apiKey: readStorage(KDS_STORAGE_KEYS.apiKey),
        zonesEndpoint: readStorage(KDS_STORAGE_KEYS.zonesEndpoint),
        queueEndpoint: readStorage(KDS_STORAGE_KEYS.queueEndpoint),
        queuePollSeconds: readStorage(KDS_STORAGE_KEYS.queuePollSeconds),
        queueDate: readStorage(KDS_STORAGE_KEYS.queueDate)
    };
}

function saveStoredKdsConfig({
    endpoint,
    apiKey,
    zonesEndpoint,
    queueEndpoint,
    queuePollSeconds,
    queueDate
}: {
    endpoint: string;
    apiKey?: string;
    zonesEndpoint?: string;
    queueEndpoint?: string;
    queuePollSeconds?: string;
    queueDate?: string;
}) {
    writeStorage(KDS_STORAGE_KEYS.endpoint, endpoint);
    writeStorage(KDS_STORAGE_KEYS.apiKey, apiKey || "");
    writeStorage(KDS_STORAGE_KEYS.zonesEndpoint, zonesEndpoint || "");
    writeStorage(KDS_STORAGE_KEYS.queueEndpoint, queueEndpoint || "");
    writeStorage(KDS_STORAGE_KEYS.queuePollSeconds, queuePollSeconds || "");
    writeStorage(KDS_STORAGE_KEYS.queueDate, queueDate || "");
    window.dispatchEvent(new CustomEvent("amodomio:kds-config-updated"));
}

async function sendKdsOrder(payload: Record<string, unknown>, config?: { endpoint: string; apiKey?: string }) {
    const endpoint = config?.endpoint?.trim() || getStoredKdsConfig().endpoint;
    const apiKey = config?.apiKey?.trim() || getStoredKdsConfig().apiKey;

    if (!endpoint) throw new Error("Configure o endpoint do KDS");

    const runtime = typeof chrome !== "undefined" && chrome?.runtime ? chrome.runtime : null;
    if (!runtime) throw new Error("chrome.runtime indisponível");

    return new Promise<{ ok: boolean; data?: unknown }>((resolve, reject) => {
        runtime.sendMessage(
            {
                type: KDS_SYNC_ORDER_MESSAGE,
                endpoint,
                apiKey,
                payload
            },
            (response: { error?: string; data?: unknown }) => {
                const lastErr = runtime?.lastError;
                if (lastErr) {
                    reject(new Error(lastErr.message));
                    return;
                }
                if (response?.error) {
                    reject(new Error(response.error));
                    return;
                }
                resolve({ ok: true, data: response?.data });
            }
        );
    });
}

type DeliveryZone = { id: string | number; name?: string; title?: string };

const CHANNEL_OPTIONS = ["WHATS/PRESENCIAL/TELE", "CARDAPIO", "AIQFOME", "IFOOD"];

function parseIntOrZero(value: string): number {
    const parsed = parseInt(value || "0", 10);
    return Number.isFinite(parsed) ? parsed : 0;
}

function deriveZonesEndpoint(endpoint: string): string {
    if (!endpoint) return "";
    const replaced = endpoint.replace(/\/order(s)?\/?$/i, "/delivery-zones");
    if (replaced !== endpoint) return replaced;
    return `${endpoint.replace(/\/$/, "")}/delivery-zones`;
}

function deriveQueueEndpoint(endpoint: string): string {
    if (!endpoint) return "";
    const replaced = endpoint.replace(/\/order(s)?\/?$/i, "/orders");
    if (replaced !== endpoint) return replaced;
    return `${endpoint.replace(/\/$/, "")}/orders`;
}

function parsePollSeconds(value?: string | null, fallback = 15): number {
    const n = Number((value || "").replace(",", "."));
    if (!Number.isFinite(n)) return fallback;
    return Math.max(3, Math.min(300, Math.round(n)));
}

function normalizeKdsReadDate(value?: string | null): string {
    const v = (value || "").trim();
    if (!v) return "";
    return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : "";
}

function buildKdsOrdersReadUrl(endpoint: string, date?: string): string {
    const safeDate = normalizeKdsReadDate(date);
    if (!safeDate) return endpoint;
    try {
        const url = new URL(endpoint);
        url.searchParams.set("date", safeDate);
        return url.toString();
    } catch {
        const joiner = endpoint.includes("?") ? "&" : "?";
        return `${endpoint}${joiner}date=${encodeURIComponent(safeDate)}`;
    }
}

function getLocalDateYmd(): string {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
}

async function fetchKdsOrderQueue(config?: { endpoint?: string; apiKey?: string; date?: string }) {
    const stored = getStoredKdsConfig();
    const endpoint = config?.endpoint?.trim() || stored.queueEndpoint || deriveQueueEndpoint(stored.endpoint) || DEFAULT_KDS_QUEUE_READ_ENDPOINT;
    const apiKey = config?.apiKey?.trim() || stored.apiKey;
    const date = normalizeKdsReadDate(config?.date ?? stored.queueDate);

    if (!endpoint) throw new Error("Configure o endpoint de leitura da fila KDS");
    if (!apiKey) throw new Error("Configure a API key do KDS para leitura");

    const runtime = typeof chrome !== "undefined" && chrome?.runtime ? chrome.runtime : null;
    if (!runtime) throw new Error("chrome.runtime indisponível");

    return new Promise<any>((resolve, reject) => {
        runtime.sendMessage(
            {
                type: KDS_FETCH_ORDER_QUEUE_MESSAGE,
                endpoint: buildKdsOrdersReadUrl(endpoint, date),
                apiKey
            },
            (response: { error?: string; data?: any }) => {
                const lastErr = runtime?.lastError;
                if (lastErr) {
                    reject(new Error(lastErr.message));
                    return;
                }
                if (response?.error) {
                    reject(new Error(response.error));
                    return;
                }
                resolve(response?.data);
            }
        );
    });
}

async function patchKdsOrderStatus(config: { endpoint?: string; apiKey?: string; date?: string; commandNumber: string; status: string }) {
    const stored = getStoredKdsConfig();
    const endpoint = config.endpoint?.trim() || stored.queueEndpoint || deriveQueueEndpoint(stored.endpoint) || DEFAULT_KDS_QUEUE_READ_ENDPOINT;
    const apiKey = config.apiKey?.trim() || stored.apiKey;
    const date = normalizeKdsReadDate(config.date ?? stored.queueDate) || getLocalDateYmd();
    const commandNumber = Number(String(config.commandNumber).trim());

    if (!endpoint) throw new Error("Configure o endpoint de leitura KDS");
    if (!apiKey) throw new Error("Configure a API key do KDS");
    if (!Number.isFinite(commandNumber) || commandNumber <= 0) throw new Error("Comanda inválida");

    const runtime = typeof chrome !== "undefined" && chrome?.runtime ? chrome.runtime : null;
    if (!runtime) throw new Error("chrome.runtime indisponível");

    return new Promise<any>((resolve, reject) => {
        runtime.sendMessage(
            {
                type: KDS_PATCH_ORDER_STATUS_MESSAGE,
                endpoint,
                apiKey,
                payload: {
                    date,
                    commandNumber,
                    status: config.status
                }
            },
            (response: { error?: string; data?: any }) => {
                const lastErr = runtime?.lastError;
                if (lastErr) return reject(new Error(lastErr.message));
                if (response?.error) return reject(new Error(response.error));
                resolve(response?.data);
            }
        );
    });
}

function parseNumberText(value?: string | null): number {
    if (!value) return 0;
    const clean = value.replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".");
    const n = Number(clean);
    return Number.isFinite(n) ? n : 0;
}

function parseCommandFromDetailModal(modalEl: Element): string {
    const title = modalEl.querySelector("h4.modal-title")?.textContent?.trim() || "";
    return extractFirstNumber(title);
}

function inferExistsFromResponse(data: unknown): boolean {
    if (typeof data === "boolean") return data;
    if (!data || typeof data !== "object") return false;
    const payload = data as Record<string, unknown>;
    const existsValue = payload.exists ?? payload.found ?? payload.synced ?? payload.alreadyExists ?? payload.ok;
    if (typeof existsValue === "boolean") return existsValue;
    if (typeof existsValue === "number") return existsValue > 0;
    if (typeof existsValue === "string") return ["true", "1", "yes", "ok"].includes(existsValue.toLowerCase());
    return false;
}

function inferSizeBucket(itemName: string): "sizeF" | "sizeM" | "sizeP" | "sizeI" | "sizeFT" | null {
    const normalized = itemName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    if (!normalized.includes("pizza")) return null;
    if (normalized.includes("familia")) return "sizeF";
    if (normalized.includes("media")) return "sizeM";
    if (normalized.includes("pequena")) return "sizeP";
    if (normalized.includes("individual")) return "sizeI";
    if (normalized.includes("fatia") || normalized.includes("taglio")) return "sizeFT";
    return null;
}

type DetailExtractedItem = {
    qty: number;
    itemName: string;
    itemValue: number;
    flavors: string[];
};

type KdsDetailDraft = {
    commandNumber: string;
    customerName: string;
    customerPhone: string;
    orderAmountCents: number;
    sizeF: string;
    sizeM: string;
    sizeP: string;
    sizeI: string;
    sizeFT: string;
    items: DetailExtractedItem[];
};

type KdsQueueSnapshot = {
    aguardandoForno: string[];
    assando: string[];
};
type QueueCommandUiState = "idle" | "loading" | "success";

function normalizeStatusText(value: unknown): string {
    return String(value || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[\s_-]+/g, "")
        .toLowerCase();
}

function normalizeCommandNumber(value: unknown): string {
    const raw = String(value ?? "").trim();
    if (!raw) return "";
    const onlyDigits = raw.match(/\d+/)?.[0] || "";
    return onlyDigits || raw;
}

function readCommandNumberFromObject(obj: Record<string, unknown>): string {
    const candidates = [
        obj.commandNumber,
        obj.comanda,
        obj.command,
        obj.saleNumber,
        obj.orderNumber,
        obj.numeroComanda,
        obj.numero
    ];
    for (const candidate of candidates) {
        const number = normalizeCommandNumber(candidate);
        if (number) return number;
    }
    return "";
}

function extractQueueArray(data: any): any[] {
    if (Array.isArray(data)) return data;
    if (!data || typeof data !== "object") return [];
    if (data.mode === "list" && Array.isArray(data.orders)) return data.orders;
    if (Array.isArray(data.data)) return data.data;
    if (Array.isArray(data.items)) return data.items;
    if (Array.isArray(data.orders)) return data.orders;
    if (Array.isArray(data.rows)) return data.rows;
    return [];
}

function parseKdsQueueSnapshot(data: unknown): KdsQueueSnapshot {
    const empty: KdsQueueSnapshot = { aguardandoForno: [], assando: [] };
    if (!data) return empty;

    if (typeof data === "object" && !Array.isArray(data)) {
        const payload = data as Record<string, unknown>;
        if (payload.mode === "list" && Array.isArray(payload.orders)) {
            const result: KdsQueueSnapshot = { aguardandoForno: [], assando: [] };
            for (const item of payload.orders as unknown[]) {
                if (!item || typeof item !== "object") continue;
                const row = item as Record<string, unknown>;
                const status = normalizeStatusText(row.status);
                const commandNumber = normalizeCommandNumber(row.commandNumber);
                if (!commandNumber) continue;
                if (status === "aguardandoforno") result.aguardandoForno.push(commandNumber);
                if (status === "assando") result.assando.push(commandNumber);
            }
            return result;
        }
        const byStatus = payload.byStatus && typeof payload.byStatus === "object" ? (payload.byStatus as Record<string, unknown>) : null;
        const directAguardando = (byStatus?.aguardandoForno ?? payload.aguardandoForno) as unknown;
        const directAssando = (byStatus?.assando ?? payload.assando) as unknown;
        if (Array.isArray(directAguardando) || Array.isArray(directAssando)) {
            const mapList = (list: unknown) =>
                (Array.isArray(list) ? list : [])
                    .map((item) => {
                        if (typeof item === "object" && item) return readCommandNumberFromObject(item as Record<string, unknown>);
                        return normalizeCommandNumber(item);
                    })
                    .filter(Boolean);
            return {
                aguardandoForno: mapList(directAguardando),
                assando: mapList(directAssando)
            };
        }
    }

    const list = extractQueueArray(data);
    const result: KdsQueueSnapshot = { aguardandoForno: [], assando: [] };
    for (const item of list) {
        if (!item || typeof item !== "object") continue;
        const row = item as Record<string, unknown>;
        const status = normalizeStatusText(row.status ?? row.kdsStatus ?? row.stage ?? row.state ?? row.situation);
        const commandNumber = readCommandNumberFromObject(row);
        if (!commandNumber) continue;
        if (status === "aguardandoforno") result.aguardandoForno.push(commandNumber);
        if (status === "assando") result.assando.push(commandNumber);
    }
    return result;
}

function QueueColumn({
    tone,
    commandNumbers,
    onCommandClick,
    commandUiStateById
}: {
    tone: "amber" | "orange";
    commandNumbers: string[];
    onCommandClick?: (commandNumber: string) => void;
    commandUiStateById?: Record<string, QueueCommandUiState>;
}) {
    const colors =
        tone === "amber"
            ? { bg: "#fff7d6", border: "rgba(245,158,11,0.35)" }
            : { bg: "#ffe5cf", border: "rgba(249,115,22,0.35)" };

    return (
        <div
            style={{
                minWidth: 0,
                display: "flex",
                alignItems: "center",
                gap: 4,
                padding: "0 6px",
                background: colors.bg,
                border: `1px solid ${colors.border}`,
                borderRadius: 6,
                minHeight: 28
            }}
        >
            <div style={{ minWidth: 0, display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap", flex: "1 1 auto" }}>
                {commandNumbers.length === 0 ? <span style={{ fontSize: 10, color: "#6b7280" }}>-</span> : null}
                {commandNumbers.slice(0, 18).map((n) => {
                    const uiState = commandUiStateById?.[n] || "idle";
                    const isLoading = uiState === "loading";
                    const isSuccess = uiState === "success";
                    return (
                        <button
                            type="button"
                            key={`${tone}-${n}`}
                            onClick={() => onCommandClick?.(n)}
                            disabled={isLoading || isSuccess}
                            style={{
                                fontSize: 13,
                                lineHeight: 1.1,
                                padding: "1px 6px",
                                minWidth: 28,
                                minHeight: 22,
                                borderRadius: 999,
                                background: isSuccess ? "#dcfce7" : "#fff",
                                border: "1px solid rgba(17,24,39,0.10)",
                                color: "#111827",
                                fontWeight: 700,
                                cursor: isLoading ? "progress" : isSuccess ? "default" : "pointer",
                                opacity: isSuccess ? 0 : isLoading ? 0.9 : 1,
                                transform: isSuccess ? "translateY(-6px) scale(0.86)" : "translateY(0) scale(1)",
                                transition: "opacity 260ms ease, transform 260ms cubic-bezier(.2,.8,.2,1), background-color 180ms ease",
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center"
                            }}
                            title={
                                isLoading
                                    ? `Finalizando comanda ${n}...`
                                    : isSuccess
                                      ? `Comanda ${n} finalizada`
                                      : `Finalizar comanda ${n}`
                            }
                        >
                            {isLoading ? (
                                <Loader2 size={14} style={{ animation: "amodomio-kds-spin 0.8s linear infinite" }} />
                            ) : isSuccess ? (
                                <Check size={14} color="#15803d" />
                            ) : (
                                n
                            )}
                        </button>
                    );
                })}
                {commandNumbers.length > 18 && <span style={{ fontSize: 10, color: "#6b7280" }}>+{commandNumbers.length - 18}</span>}
            </div>
        </div>
    );
}

function KdsQueueTopBar() {
    const [snapshot, setSnapshot] = useState<KdsQueueSnapshot>({ aguardandoForno: [], assando: [] });
    const [status, setStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
    const [errorMsg, setErrorMsg] = useState("");
    const [topOffset, setTopOffset] = useState(48);
    const [headerLeft, setHeaderLeft] = useState(0);
    const [headerWidth, setHeaderWidth] = useState<number | null>(null);
    const [configOpen, setConfigOpen] = useState(false);
    const [cfgEndpoint, setCfgEndpoint] = useState("");
    const [cfgApiKey, setCfgApiKey] = useState("");
    const [cfgPollSeconds, setCfgPollSeconds] = useState("15");
    const [cfgDate, setCfgDate] = useState("");
    const [commandUiStateById, setCommandUiStateById] = useState<Record<string, QueueCommandUiState>>({});
    const manualRefreshRef = useRef<(() => void) | null>(null);

    useEffect(() => {
        const styleId = "amodomio-kds-queue-animations";
        if (document.getElementById(styleId)) return;
        const styleEl = document.createElement("style");
        styleEl.id = styleId;
        styleEl.textContent = `
          @keyframes amodomio-kds-spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `;
        document.head.appendChild(styleEl);
    }, []);

    useEffect(() => {
        const cfg = getStoredKdsConfig();
        setCfgEndpoint(cfg.queueEndpoint || deriveQueueEndpoint(cfg.endpoint) || DEFAULT_KDS_QUEUE_READ_ENDPOINT);
        setCfgApiKey(cfg.apiKey);
        setCfgPollSeconds(cfg.queuePollSeconds || "15");
        setCfgDate(cfg.queueDate || "");
    }, []);

    useEffect(() => {
        const BAR_HEIGHT = 30;
        const updateHeaderAnchor = () => {
            const headerEl =
                document.querySelector<HTMLElement>("#header") ||
                document.querySelector<HTMLElement>("header#header") ||
                document.querySelector<HTMLElement>("header");
            const rect = headerEl?.getBoundingClientRect();
            const nextTop = rect ? Math.max(0, Math.round(rect.bottom)) : 48;
            setTopOffset(nextTop);
            setHeaderLeft(rect ? Math.round(rect.left) : 0);
            setHeaderWidth(rect ? Math.round(rect.width) : null);

            const spacer = document.getElementById(KDS_QUEUE_BAR_SPACER_ID) as HTMLDivElement | null;
            if (spacer) {
                spacer.style.height = `${BAR_HEIGHT + 2}px`;
            }
        };

        updateHeaderAnchor();
        window.addEventListener("resize", updateHeaderAnchor);
        window.addEventListener("scroll", updateHeaderAnchor, { passive: true });
        const timer = window.setInterval(updateHeaderAnchor, 1500);
        return () => {
            window.removeEventListener("resize", updateHeaderAnchor);
            window.removeEventListener("scroll", updateHeaderAnchor);
            window.clearInterval(timer);
        };
    }, []);

    useEffect(() => {
        let cancelled = false;
        let intervalId: number | null = null;

        const run = async () => {
            const cfg = getStoredKdsConfig();
            const queueEndpoint = cfg.queueEndpoint || deriveQueueEndpoint(cfg.endpoint) || DEFAULT_KDS_QUEUE_READ_ENDPOINT;
            if (!queueEndpoint) {
                if (!cancelled) {
                    setSnapshot({ aguardandoForno: [], assando: [] });
                    setStatus("idle");
                    setErrorMsg("Configure endpoint de leitura KDS");
                }
                return;
            }
            if (!cancelled) {
                setStatus((prev) => (prev === "ok" ? "ok" : "loading"));
                setErrorMsg("");
            }
            try {
                const data = await fetchKdsOrderQueue({ endpoint: queueEndpoint, apiKey: cfg.apiKey });
                if (cancelled) return;
                setSnapshot(parseKdsQueueSnapshot(data));
                setStatus("ok");
                setErrorMsg("");
            } catch (err) {
                if (cancelled) return;
                setStatus("error");
                setErrorMsg(err instanceof Error ? err.message : "Falha ao ler fila KDS");
            }
        };

        manualRefreshRef.current = () => {
            void run();
        };

        run();
        const seconds = parsePollSeconds(getStoredKdsConfig().queuePollSeconds || "15", 15);
        intervalId = window.setInterval(run, seconds * 1000);

        const onStorage = (e: StorageEvent) => {
            if (!e.key) return;
            if (!Object.values(KDS_STORAGE_KEYS).includes(e.key as any)) return;
            run();
            const nextSeconds = parsePollSeconds(getStoredKdsConfig().queuePollSeconds || "15", 15);
            if (intervalId) window.clearInterval(intervalId);
            intervalId = window.setInterval(run, nextSeconds * 1000);
        };
        const onLocalConfigUpdated = () => {
            run();
            const nextSeconds = parsePollSeconds(getStoredKdsConfig().queuePollSeconds || "15", 15);
            if (intervalId) window.clearInterval(intervalId);
            intervalId = window.setInterval(run, nextSeconds * 1000);
        };
        window.addEventListener("storage", onStorage);
        window.addEventListener("amodomio:kds-config-updated", onLocalConfigUpdated as EventListener);

        return () => {
            cancelled = true;
            manualRefreshRef.current = null;
            if (intervalId) window.clearInterval(intervalId);
            window.removeEventListener("storage", onStorage);
            window.removeEventListener("amodomio:kds-config-updated", onLocalConfigUpdated as EventListener);
        };
    }, []);

    const hasData = snapshot.aguardandoForno.length > 0 || snapshot.assando.length > 0;
    const statusColor = status === "error" ? "#b91c1c" : status === "loading" ? "#b45309" : "#64748b";
    const removeCommandFromSnapshot = (commandNumber: string) => {
        setSnapshot((prev) => ({
            aguardandoForno: prev.aguardandoForno.filter((n) => n !== commandNumber),
            assando: prev.assando.filter((n) => n !== commandNumber)
        }));
        setCommandUiStateById((prev) => {
            if (!prev[commandNumber]) return prev;
            const next = { ...prev };
            delete next[commandNumber];
            return next;
        });
    };
    const handleFinalizeCommand = async (commandNumber: string) => {
        if (!commandNumber) return;
        if (commandUiStateById[commandNumber] === "loading" || commandUiStateById[commandNumber] === "success") return;
        setCommandUiStateById((prev) => ({ ...prev, [commandNumber]: "loading" }));
        try {
            const cfg = getStoredKdsConfig();
            await patchKdsOrderStatus({
                endpoint: cfg.queueEndpoint || deriveQueueEndpoint(cfg.endpoint) || DEFAULT_KDS_QUEUE_READ_ENDPOINT,
                apiKey: cfg.apiKey,
                date: cfg.queueDate,
                commandNumber,
                status: "finalizado"
            });
            setCommandUiStateById((prev) => ({ ...prev, [commandNumber]: "success" }));
            window.setTimeout(() => removeCommandFromSnapshot(commandNumber), 260);
            setStatus("ok");
            setErrorMsg("");
        } catch (err) {
            setStatus("error");
            setErrorMsg(err instanceof Error ? err.message : "Falha ao finalizar pedido");
            setCommandUiStateById((prev) => {
                const next = { ...prev };
                delete next[commandNumber];
                return next;
            });
        }
    };
    const saveQuickConfig = () => {
        const current = getStoredKdsConfig();
        saveStoredKdsConfig({
            endpoint: current.endpoint,
            zonesEndpoint: current.zonesEndpoint,
            apiKey: cfgApiKey,
            queueEndpoint: cfgEndpoint.trim(),
            queuePollSeconds: String(parsePollSeconds(cfgPollSeconds || "15", 15)),
            queueDate: normalizeKdsReadDate(cfgDate)
        });
        setCfgPollSeconds(String(parsePollSeconds(cfgPollSeconds || "15", 15)));
        setCfgDate(normalizeKdsReadDate(cfgDate));
        setConfigOpen(false);
    };

    return (
        <div
            style={{
                position: "fixed",
                top: topOffset,
                left: headerLeft,
                width: headerWidth ? `${headerWidth}px` : "100vw",
                zIndex: 2147483000,
                padding: 0,
                pointerEvents: "none"
            }}
        >
            <div
                style={{
                    background: "#f8fafc",
                    border: "1px solid rgba(37,99,235,0.12)",
                    borderRadius: "0 0 8px 8px",
                    boxShadow: "0 2px 8px rgba(15,23,42,0.06)",
                    padding: "0 6px",
                    margin: 0,
                    pointerEvents: "auto"
                }}
            >
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 6, alignItems: "center" }}>
                    <QueueColumn
                        tone="amber"
                        commandNumbers={snapshot.aguardandoForno}
                        onCommandClick={handleFinalizeCommand}
                        commandUiStateById={commandUiStateById}
                    />
                    <QueueColumn
                        tone="orange"
                        commandNumbers={snapshot.assando}
                        onCommandClick={handleFinalizeCommand}
                        commandUiStateById={commandUiStateById}
                    />
                    <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 4 }}>
                        <span
                            title={
                                status === "error"
                                    ? errorMsg || "Falha na leitura KDS"
                                    : status === "loading"
                                      ? "Atualizando fila KDS"
                                      : hasData
                                        ? "Fila KDS atualizada"
                                        : "KDS sem itens"
                            }
                            style={{
                                width: 8,
                                height: 8,
                                borderRadius: 999,
                                background: statusColor,
                                opacity: status === "idle" ? 0.8 : 1
                            }}
                        />
                        <button
                            type="button"
                            title="Atualizar fila KDS"
                            onClick={() => manualRefreshRef.current?.()}
                            style={{
                                border: "1px solid rgba(17,24,39,0.14)",
                                background: "#fff",
                                color: "#334155",
                                width: 24,
                                height: 24,
                                borderRadius: 6,
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                                cursor: "pointer",
                                padding: 0
                            }}
                        >
                            <RefreshCw size={13} style={status === "loading" ? { animation: "amodomio-kds-spin 0.8s linear infinite" } : undefined} />
                        </button>
                        <button
                            type="button"
                            title="Configurações KDS (leitura)"
                            onClick={() => setConfigOpen((prev) => !prev)}
                            style={{
                                border: "1px solid rgba(17,24,39,0.14)",
                                background: "#fff",
                                color: "#334155",
                                width: 24,
                                height: 24,
                                borderRadius: 6,
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                                cursor: "pointer",
                                padding: 0
                            }}
                        >
                            <Settings size={13} />
                        </button>
                        {configOpen && (
                            <div
                                style={{
                                    position: "absolute",
                                    top: 28,
                                    right: 0,
                                    width: "min(360px, calc(100vw - 24px))",
                                    background: "#fff",
                                    border: "1px solid rgba(17,24,39,0.12)",
                                    borderRadius: 8,
                                    boxShadow: "0 10px 24px rgba(0,0,0,0.12)",
                                    padding: 8,
                                    zIndex: 20
                                }}
                            >
                                <div style={{ ...fieldStyle, padding: "0 0 6px" }}>
                                    <label style={{ ...labelStyle, fontSize: 11 }} htmlFor="kds-topbar-endpoint">
                                        Endpoint leitura (GET)
                                    </label>
                                    <input
                                        id="kds-topbar-endpoint"
                                        type="text"
                                        style={{ ...inputStyle, padding: "8px 10px", fontSize: 12, borderRadius: 8 }}
                                        value={cfgEndpoint}
                                        onChange={(e) => setCfgEndpoint(e.target.value)}
                                        placeholder={DEFAULT_KDS_QUEUE_READ_ENDPOINT}
                                    />
                                </div>
                                <div style={{ ...fieldStyle, padding: "0 0 6px" }}>
                                    <label style={{ ...labelStyle, fontSize: 11 }} htmlFor="kds-topbar-apikey">
                                        API key
                                    </label>
                                    <input
                                        id="kds-topbar-apikey"
                                        type="text"
                                        style={{ ...inputStyle, padding: "8px 10px", fontSize: 12, borderRadius: 8 }}
                                        value={cfgApiKey}
                                        onChange={(e) => setCfgApiKey(e.target.value)}
                                        placeholder="api-key"
                                    />
                                </div>
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                                    <div style={{ ...fieldStyle, padding: 0 }}>
                                        <label style={{ ...labelStyle, fontSize: 11 }} htmlFor="kds-topbar-poll">
                                            Intervalo (s)
                                        </label>
                                        <input
                                            id="kds-topbar-poll"
                                            type="number"
                                            min={3}
                                            max={300}
                                            step={1}
                                            style={{ ...inputStyle, padding: "8px 10px", fontSize: 12, borderRadius: 8 }}
                                            value={cfgPollSeconds}
                                            onChange={(e) => setCfgPollSeconds(e.target.value)}
                                            placeholder="15"
                                        />
                                    </div>
                                    <div style={{ ...fieldStyle, padding: 0 }}>
                                        <label style={{ ...labelStyle, fontSize: 11 }} htmlFor="kds-topbar-date">
                                            Data (opcional)
                                        </label>
                                        <input
                                            id="kds-topbar-date"
                                            type="text"
                                            style={{ ...inputStyle, padding: "8px 10px", fontSize: 12, borderRadius: 8 }}
                                            value={cfgDate}
                                            onChange={(e) => setCfgDate(e.target.value)}
                                            placeholder="YYYY-MM-DD"
                                        />
                                    </div>
                                </div>
                                {status === "error" && errorMsg ? (
                                    <div style={{ marginTop: 6, fontSize: 11, color: "#b91c1c" }}>{errorMsg}</div>
                                ) : null}
                                <div style={{ display: "flex", justifyContent: "flex-end", gap: 6, marginTop: 8 }}>
                                    <button
                                        type="button"
                                        onClick={() => setConfigOpen(false)}
                                        style={{
                                            border: "1px solid rgba(17,24,39,0.12)",
                                            background: "#fff",
                                            color: "#334155",
                                            borderRadius: 6,
                                            padding: "6px 8px",
                                            fontSize: 11,
                                            cursor: "pointer"
                                        }}
                                    >
                                        Fechar
                                    </button>
                                    <button
                                        type="button"
                                        onClick={saveQuickConfig}
                                        style={{
                                            border: 0,
                                            background: "#2563eb",
                                            color: "#fff",
                                            borderRadius: 6,
                                            padding: "6px 8px",
                                            fontSize: 11,
                                            fontWeight: 700,
                                            cursor: "pointer"
                                        }}
                                    >
                                        Salvar
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

function extractItemsFromDetailModal(modalEl: Element): DetailExtractedItem[] {
    const rows = Array.from(modalEl.querySelectorAll<HTMLElement>('[data-qa^="sale-item-selected-"]'));
    return rows
        .map((row) => {
            const qtyText =
                row.querySelector<HTMLElement>('[data-qa="item-quantity"]')?.textContent?.trim() ||
                row.querySelector<HTMLElement>('[data-qa="item-decimal-quantity"]')?.textContent?.trim() ||
                "1";
            const qty = Math.max(1, parseNumberText(qtyText));

            const editEl = row.querySelector<HTMLElement>('[data-qa="edit-item"]');
            if (!editEl) return null;
            const clone = editEl.cloneNode(true) as HTMLElement;
            clone.querySelectorAll("small").forEach((small) => small.remove());
            const itemName = clone.textContent?.replace(/\s+/g, " ").trim() || "";

            const flavors = Array.from(editEl.querySelectorAll("small"))
                .map((small) => small.textContent?.replace(/\+/g, "").replace(/\s+/g, " ").trim() || "")
                .filter(Boolean);

            const valueText = row.querySelector<HTMLElement>('[data-qa="item-value"]')?.textContent?.trim() || "0";
            const itemValue = parseNumberText(valueText);

            if (!itemName) return null;
            return { qty, itemName, itemValue, flavors };
        })
        .filter((item): item is DetailExtractedItem => item !== null);
}

function buildDetailDraft(modalEl: Element): KdsDetailDraft {
    const commandNumber = parseCommandFromDetailModal(modalEl);
    if (!commandNumber) throw new Error("Não foi possível identificar o número do pedido.");

    const savedContact = commandContactByCard.get(commandNumber);
    const customerName =
        (modalEl.querySelector('[data-qa="sale-name"]')?.textContent || savedContact?.customerName || "").trim();
    const customerPhone =
        (modalEl.querySelector('[data-qa="sale-customer-phone"]')?.textContent || savedContact?.customerPhone || "").trim();

    const items = extractItemsFromDetailModal(modalEl);
    const sizes = { sizeF: 0, sizeM: 0, sizeP: 0, sizeI: 0, sizeFT: 0 };
    for (const item of items) {
        const bucket = inferSizeBucket(item.itemName);
        if (bucket) sizes[bucket] += item.qty;
    }

    const orderAmountText = modalEl.querySelector('[data-qa="delivery-sale-total-value"]')?.textContent?.trim() || "";
    const orderAmount = parseNumberText(orderAmountText);

    return {
        commandNumber,
        customerName,
        customerPhone,
        orderAmountCents: Math.max(0, Math.round(orderAmount * 100)),
        sizeF: String(sizes.sizeF),
        sizeM: String(sizes.sizeM),
        sizeP: String(sizes.sizeP),
        sizeI: String(sizes.sizeI),
        sizeFT: String(sizes.sizeFT),
        items
    };
}

export function KdsSyncButton({
    commandNumber,
    customerName,
    customerPhone,
    initialOrderAmountCents,
    openOnMount,
    quickCardSyncOnly,
    buttonLabel,
    getDetailDraftOnOpen
}: {
    commandNumber?: string;
    customerName?: string;
    customerPhone?: string;
    initialOrderAmountCents?: number;
    openOnMount?: boolean;
    quickCardSyncOnly?: boolean;
    buttonLabel?: string;
    getDetailDraftOnOpen?: () => KdsDetailDraft;
}) {
    const [modalOpen, setModalOpen] = useState(false);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [endpoint, setEndpoint] = useState(() => getStoredKdsConfig().endpoint);
    const [apiKey, setApiKey] = useState(() => getStoredKdsConfig().apiKey);
    const [zonesEndpoint, setZonesEndpoint] = useState(() => getStoredKdsConfig().zonesEndpoint);
    const [queueEndpoint, setQueueEndpoint] = useState(() => getStoredKdsConfig().queueEndpoint || DEFAULT_KDS_QUEUE_READ_ENDPOINT);
    const [queuePollSeconds, setQueuePollSeconds] = useState(() => getStoredKdsConfig().queuePollSeconds || "15");
    const [queueDate, setQueueDate] = useState(() => getStoredKdsConfig().queueDate);
    const [status, setStatus] = useState<"idle" | "sending" | "ok" | "error">("idle");
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [zones, setZones] = useState<DeliveryZone[]>([]);
    const [zonesLoading, setZonesLoading] = useState(false);
    const [zonesError, setZonesError] = useState<string | null>(null);

    const [commandValue, setCommandValue] = useState(commandNumber || "");
    const [orderAmountCents, setOrderAmountCents] = useState(() => Math.max(0, initialOrderAmountCents || 0));
    const [motoValueCents, setMotoValueCents] = useState(0);
    const orderAmountRef = useRef<HTMLInputElement>(null);
    const [hasMoto, setHasMoto] = useState(false);
    const [takeAway, setTakeAway] = useState(false);
    const [sizeF, setSizeF] = useState("0");
    const [sizeM, setSizeM] = useState("0");
    const [sizeP, setSizeP] = useState("0");
    const [sizeI, setSizeI] = useState("0");
    const [sizeFT, setSizeFT] = useState("0");
    const [channel, setChannel] = useState("CARDAPIO");
    const [deliveryZoneId, setDeliveryZoneId] = useState("");
    const [paymentMethod, setPaymentMethod] = useState<"credit" | "debit" | "cash">("credit");
    const [hoveredSegment, setHoveredSegment] = useState<string | null>(null);
    const [customerNameState, setCustomerNameState] = useState(customerName || "");
    const [customerPhoneState, setCustomerPhoneState] = useState(customerPhone || "");
    const [capturedItems, setCapturedItems] = useState<DetailExtractedItem[]>([]);

    useEffect(() => {
        if (openOnMount) setModalOpen(true);
    }, [openOnMount]);

    useEffect(() => {
        if (!modalOpen) return;
        let detailDraft: KdsDetailDraft | null = null;
        let captureError: string | null = null;
        try {
            detailDraft = getDetailDraftOnOpen ? getDetailDraftOnOpen() : null;
        } catch (err) {
            captureError = err instanceof Error ? err.message : "Falha ao capturar dados do detalhe";
        }
        setCommandValue(detailDraft?.commandNumber || commandNumber || "");
        setOrderAmountCents(detailDraft?.orderAmountCents ?? Math.max(0, initialOrderAmountCents || 0));
        setCustomerNameState(detailDraft?.customerName || customerName || "");
        setCustomerPhoneState(detailDraft?.customerPhone || customerPhone || "");
        setSizeF(detailDraft?.sizeF || "0");
        setSizeM(detailDraft?.sizeM || "0");
        setSizeP(detailDraft?.sizeP || "0");
        setSizeI(detailDraft?.sizeI || "0");
        setSizeFT(detailDraft?.sizeFT || "0");
        setCapturedItems(detailDraft?.items || []);
        setErrorMsg(captureError);
        setStatus("idle");

        const loadZones = async () => {
            const effectiveZonesEndpoint = zonesEndpoint || deriveZonesEndpoint(endpoint);
            if (!effectiveZonesEndpoint) return;
            setZonesLoading(true);
            setZonesError(null);
            try {
                const runtime = typeof chrome !== "undefined" && chrome?.runtime ? chrome.runtime : null;
                if (!runtime) throw new Error("chrome.runtime indisponível");
                const data = await new Promise<any>((resolve, reject) => {
                    runtime.sendMessage(
                        {
                            type: KDS_FETCH_ZONES_MESSAGE,
                            endpoint: effectiveZonesEndpoint,
                            apiKey
                        },
                        (response: { error?: string; data?: any }) => {
                            const lastErr = runtime?.lastError;
                            if (lastErr) {
                                reject(new Error(lastErr.message));
                                return;
                            }
                            if (response?.error) {
                                reject(new Error(response.error));
                                return;
                            }
                            resolve(response?.data);
                        }
                    );
                });
                const list = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : [];
                setZones(list);
            } catch (err) {
                setZonesError(err instanceof Error ? err.message : "Erro ao carregar zonas");
                setZones([]);
            } finally {
                setZonesLoading(false);
            }
        };

        loadZones();
    }, [modalOpen, commandNumber, initialOrderAmountCents, customerName, customerPhone, endpoint, apiKey, zonesEndpoint, getDetailDraftOnOpen]);

    const btnStyle: React.CSSProperties = {
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 28,
        height: 28,
        borderRadius: 6,
        background: status === "ok" ? "#047857" : status === "error" ? "#b91c1c" : "#059669",
        color: "#fff",
        flex: "0 0 auto",
        cursor: "pointer",
        borderWidth: "0px"
    };

    const saveButtonStyle: React.CSSProperties = {
        marginTop: 8,
        width: "100%",
        padding: "8px 10px",
        borderRadius: 6,
        borderWidth: 0,
        background: "#0f766e",
        color: "#fff",
        cursor: "pointer",
        fontSize: 12,
        fontWeight: 600 as const
    };

    const handleSave = () => {
        saveStoredKdsConfig({
            endpoint,
            apiKey,
            zonesEndpoint,
            queueEndpoint,
            queuePollSeconds: String(parsePollSeconds(queuePollSeconds || "15", 15)),
            queueDate: normalizeKdsReadDate(queueDate)
        });
        setQueuePollSeconds(String(parsePollSeconds(queuePollSeconds || "15", 15)));
        setQueueDate(normalizeKdsReadDate(queueDate));
        setSettingsOpen(false);
    };

    const MoneyInputInline = ({
        valueCents,
        onChangeCents,
        placeholder,
        disabled,
        inputRef,
        keepFocus
    }: {
        valueCents: number;
        onChangeCents: (next: number) => void;
        placeholder?: string;
        disabled?: boolean;
        inputRef?: React.RefObject<HTMLInputElement>;
        keepFocus?: boolean;
    }) => {
        const display = (valueCents / 100).toLocaleString("pt-BR", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
        const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
            e.stopPropagation();
            if (disabled) return;
            const k = e.key;
            if (k === "Enter") return;
            if (k === "Backspace") {
                e.preventDefault();
                onChangeCents(Math.floor(valueCents / 10));
                requestAnimationFrame(() => inputRef?.current?.focus());
                return;
            }
            if (k === "Delete" || k === "Del" || e.code === "Delete") {
                e.preventDefault();
                onChangeCents(0);
                requestAnimationFrame(() => inputRef?.current?.focus());
                return;
            }
            if (/^\d$/.test(k)) {
                e.preventDefault();
                const next = (valueCents * 10 + Number(k)) % 1000000000;
                onChangeCents(next);
                requestAnimationFrame(() => inputRef?.current?.focus());
                return;
            }
            if (k === "Tab" || k.startsWith("Arrow") || k === "Home" || k === "End") return;
            e.preventDefault();
        };
        return (
            <input
                type="text"
                inputMode="numeric"
                value={display}
                onKeyDown={onKeyDown}
                onKeyUp={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                onBlur={() => {
                    if (keepFocus) {
                        requestAnimationFrame(() => inputRef?.current?.focus());
                    }
                }}
                onChange={() => {}}
                disabled={disabled}
                ref={inputRef}
                style={{
                    ...inputStyle,
                    textAlign: "right",
                    width: "100%",
                    boxSizing: "border-box",
                    background: disabled ? "#f3f4f6" : inputStyle.background
                }}
                placeholder={placeholder}
            />
        );
    };

    const segmentedButtonStyle = (
        active: boolean,
        hovered: boolean,
        withRightDivider: boolean
    ): React.CSSProperties => ({
        minHeight: 40,
        border: "none",
        borderRight: withRightDivider ? "1px solid rgba(17,24,39,0.24)" : "none",
        background: active ? "#111827" : hovered ? "#f3f4f6" : "transparent",
        color: active ? "#fff" : "#111827",
        fontSize: 14,
        fontWeight: 700,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        cursor: "pointer",
        transition: "background-color 150ms ease, color 150ms ease"
    });
    const modernSelectStyle: React.CSSProperties = {
        ...inputStyle,
        height: 48,
        paddingRight: 36,
        border: "1px solid rgba(17,24,39,0.2)",
        backgroundColor: "#f8fafc",
        boxShadow: "inset 0 1px 1px rgba(17,24,39,0.04)",
        appearance: "none",
        WebkitAppearance: "none",
        MozAppearance: "none",
        backgroundImage:
            "linear-gradient(45deg, transparent 50%, #6b7280 50%), linear-gradient(135deg, #6b7280 50%, transparent 50%)",
        backgroundPosition: "calc(100% - 18px) calc(50% - 3px), calc(100% - 13px) calc(50% - 3px)",
        backgroundSize: "5px 5px, 5px 5px",
        backgroundRepeat: "no-repeat"
    };

    const sizeSegmentButton = (
        label: string,
        value: string,
        setValue: (v: string) => void,
        withRightDivider: boolean
    ) => {
        const numeric = parseIntOrZero(value);
        const hoverKey = `size-${label}`;
        return (
            <button
                type="button"
                onClick={() => setValue(String(numeric + 1))}
                onContextMenu={(e) => {
                    e.preventDefault();
                    setValue(String(Math.max(0, numeric - 1)));
                }}
                onMouseEnter={() => setHoveredSegment(hoverKey)}
                onMouseLeave={() => setHoveredSegment(null)}
                style={segmentedButtonStyle(numeric > 0, hoveredSegment === hoverKey, withRightDivider)}
                title="Clique para +1, botão direito para -1"
            >
                {label}
                {numeric > 0 && <span style={{ fontSize: 11, fontWeight: 600 }}>({numeric})</span>}
            </button>
        );
    };

    const handleSync = async () => {
        setStatus("sending");
        setErrorMsg(null);
        try {
            const payload: Record<string, unknown> = {
                _action: "saveRow",
                date: new Date().toISOString().slice(0, 10),
                commandNumber: commandValue || "",
                orderAmount: (orderAmountCents / 100).toFixed(2),
                motoValue: (motoValueCents / 100).toFixed(2),
                hasMoto: hasMoto ? "on" : "",
                takeAway: takeAway ? "on" : "",
                sizeF: String(parseIntOrZero(sizeF)),
                sizeM: String(parseIntOrZero(sizeM)),
                sizeP: String(parseIntOrZero(sizeP)),
                sizeI: String(parseIntOrZero(sizeI)),
                sizeFT: String(parseIntOrZero(sizeFT)),
                channel: channel || "CARDAPIO",
                deliveryZoneId: hasMoto ? deliveryZoneId || "" : "",
                isCreditCard: paymentMethod === "credit" ? "on" : "",
                customerName: customerNameState || "",
                customerPhone: customerPhoneState || ""
            };
            if (capturedItems.length) {
                payload.items = capturedItems;
            }

            await sendKdsOrder(payload, { endpoint, apiKey });
            setStatus("ok");
            setTimeout(() => setStatus("idle"), 1200);
        } catch (err) {
            setStatus("error");
            setErrorMsg(err instanceof Error ? err.message : "Falha ao sincronizar");
            setTimeout(() => setStatus("idle"), 1500);
        }
    };

    const handleCardPhoneSync = async () => {
        if (!commandValue) {
            setStatus("error");
            setErrorMsg("Comanda não encontrada no card.");
            setTimeout(() => setStatus("idle"), 1800);
            return;
        }
        if (!customerPhoneState) {
            setStatus("error");
            setErrorMsg("Telefone não encontrado no card.");
            setTimeout(() => setStatus("idle"), 1800);
            return;
        }

        setStatus("sending");
        setErrorMsg(null);
        try {
            const check = await sendKdsOrder({
                _action: "existsRow",
                commandNumber: commandValue
            });

            if (!inferExistsFromResponse(check.data)) {
                setStatus("ok");
                setErrorMsg("Pedido ainda não sincronizado. Use o botão no detalhe para enviar completo.");
                setTimeout(() => {
                    setStatus("idle");
                    setErrorMsg(null);
                }, 2200);
                return;
            }

            await sendKdsOrder({
                _action: "updatePhoneIfExists",
                commandNumber: commandValue,
                customerPhone: customerPhoneState,
                customerName: customerNameState || ""
            });

            setStatus("ok");
            setTimeout(() => setStatus("idle"), 1200);
        } catch (err) {
            setStatus("error");
            setErrorMsg(err instanceof Error ? err.message : "Falha ao sincronizar telefone");
            setTimeout(() => setStatus("idle"), 1800);
        }
    };

    return (
        <div style={{ position: "relative" }}>
            <button
                type="button"
                title={
                    quickCardSyncOnly
                        ? `Atualizar telefone no KDS (${status})`
                        : `Sincronizar pedido no KDS (${status})`
                }
                style={
                    buttonLabel
                        ? {
                              marginLeft: 8,
                              padding: "6px 12px",
                              borderRadius: 4,
                              borderWidth: 0,
                              background: status === "ok" ? "#047857" : status === "error" ? "#b91c1c" : "#10b981",
                              color: "#fff",
                              fontSize: 12,
                              fontWeight: 600,
                              cursor: "pointer",
                              height: 34
                          }
                        : btnStyle
                }
                onClick={(e) => {
                    e.stopPropagation();
                    if (quickCardSyncOnly) {
                        void handleCardPhoneSync();
                        return;
                    }
                    setModalOpen(true);
                }}
            >
                {buttonLabel ? buttonLabel : <RefreshCw size={16} />}
            </button>

            {!quickCardSyncOnly &&
                modalOpen &&
                createPortal(
                    <div
                        style={{
                            position: "fixed",
                            inset: 0,
                            background: "rgba(0,0,0,0.35)",
                            zIndex: 2147483646,
                            pointerEvents: "auto"
                        }}
                    >
                        <div
                            style={{
                                position: "fixed",
                                top: "20%",
                                left: "50%",
                                transform: "translateX(-50%)",
                                background: "#fff",
                                borderRadius: 10,
                                boxShadow: "0 12px 32px rgba(0,0,0,0.2)",
                                width: "min(520px, calc(100vw - 24px))",
                                padding: 14,
                                fontFamily: '"Inter", "Segoe UI", Arial, sans-serif',
                                fontSize: 14,
                                zIndex: 2147483647,
                                pointerEvents: "auto"
                            }}
                        >
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                            <div style={{ fontWeight: 700, fontSize: 16 }}>Pedido no KDS</div>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                <button
                                    type="button"
                                    style={{
                                        borderRadius: 6,
                                        border: "1px solid rgba(0,0,0,0.12)",
                                        background: "#f3f4f6",
                                        fontSize: 11,
                                        padding: "4px 8px",
                                        cursor: "pointer"
                                    }}
                                    onClick={() => setSettingsOpen((prev) => !prev)}
                                >
                                    Settings
                                </button>
                                <button
                                    type="button"
                                    style={{
                                        borderRadius: 6,
                                        border: "1px solid rgba(0,0,0,0.12)",
                                        background: "#fff",
                                        fontSize: 12,
                                        padding: "4px 8px",
                                        cursor: "pointer"
                                    }}
                                    onClick={() => {
                                        setModalOpen(false);
                                        setSettingsOpen(false);
                                    }}
                                >
                                    ✕
                                </button>
                            </div>
                        </div>

                        <div style={{ fontSize: 13, color: "#374151", marginBottom: 10 }}>
                            Pedido: <strong>{commandValue || "N/A"}</strong>
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 14, marginBottom: 16 }}>
                            <div style={{ ...fieldStyle, minWidth: 0 }}>
                                <label style={{ ...labelStyle, fontSize: 12 }} htmlFor="kds-command">
                                    Comanda
                                </label>
                                <input
                                    id="kds-command"
                                    type="number"
                                    inputMode="numeric"
                                    style={inputStyle}
                                    value={commandValue}
                                    onChange={(e) => setCommandValue(e.target.value)}
                                    placeholder="Número"
                                />
                            </div>
                            <div style={{ ...fieldStyle, minWidth: 0 }}>
                                <label style={{ ...labelStyle, fontSize: 12 }} htmlFor="kds-order-amount">
                                    Valor pedido
                                </label>
                                <MoneyInputInline
                                    valueCents={orderAmountCents}
                                    onChangeCents={setOrderAmountCents}
                                    placeholder="0,00"
                                    inputRef={orderAmountRef}
                                    keepFocus
                                />
                            </div>
                        </div>
                        <div style={{ marginBottom: 14 }}>
                            <div style={fieldStyle}>
                                <label style={{ ...labelStyle, fontSize: 12 }} htmlFor="kds-channel">
                                    Canal
                                </label>
                                <select
                                    id="kds-channel"
                                    style={modernSelectStyle}
                                    value={channel}
                                    onChange={(e) => setChannel(e.target.value)}
                                >
                                    {CHANNEL_OPTIONS.map((opt) => (
                                        <option key={opt} value={opt}>
                                            {opt}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div
                            style={{
                                display: "grid",
                                gridTemplateColumns: "repeat(6, minmax(0, 1fr))",
                                border: "1px solid rgba(17,24,39,0.34)",
                                borderRadius: 16,
                                overflow: "hidden",
                                marginBottom: 12
                            }}
                        >
                            {sizeSegmentButton("F", sizeF, setSizeF, true)}
                            {sizeSegmentButton("M", sizeM, setSizeM, true)}
                            {sizeSegmentButton("P", sizeP, setSizeP, true)}
                            {sizeSegmentButton("I", sizeI, setSizeI, true)}
                            {sizeSegmentButton("FT", sizeFT, setSizeFT, true)}
                            <button
                                type="button"
                                onClick={() => {
                                    setSizeF("0");
                                    setSizeM("0");
                                    setSizeP("0");
                                    setSizeI("0");
                                    setSizeFT("0");
                                }}
                                onMouseEnter={() => setHoveredSegment("size-reset")}
                                onMouseLeave={() => setHoveredSegment(null)}
                                style={segmentedButtonStyle(false, hoveredSegment === "size-reset", false)}
                            >
                                Zerar
                            </button>
                        </div>

                        <div
                            style={{
                                display: "grid",
                                gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                                border: "1px solid rgba(17,24,39,0.34)",
                                borderRadius: 16,
                                overflow: "hidden",
                                marginBottom: 10
                            }}
                        >
                            <button
                                type="button"
                                onClick={() => {
                                    const next = !hasMoto;
                                    setHasMoto(next);
                                    if (next) setTakeAway(false);
                                }}
                                onMouseEnter={() => setHoveredSegment("delivery")}
                                onMouseLeave={() => setHoveredSegment(null)}
                                style={segmentedButtonStyle(hasMoto, hoveredSegment === "delivery", true)}
                            >
                                <Bike size={14} />
                                Delivery
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    const next = !takeAway;
                                    setTakeAway(next);
                                    if (next) setHasMoto(false);
                                }}
                                onMouseEnter={() => setHoveredSegment("takeaway")}
                                onMouseLeave={() => setHoveredSegment(null)}
                                style={segmentedButtonStyle(takeAway, hoveredSegment === "takeaway", false)}
                            >
                                <Package size={14} />
                                Retirada
                            </button>
                        </div>
                        {hasMoto && (
                            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12, marginBottom: 12 }}>
                                <div style={fieldStyle}>
                                    <label style={{ ...labelStyle, fontSize: 12 }} htmlFor="kds-zone">
                                        Zona de entrega
                                    </label>
                                    <select
                                        id="kds-zone"
                                        style={modernSelectStyle}
                                        value={deliveryZoneId}
                                        onChange={(e) => setDeliveryZoneId(e.target.value)}
                                        disabled={zonesLoading}
                                    >
                                        <option value="">{zonesLoading ? "Carregando..." : "Selecionar zona"}</option>
                                        {zones.map((zone) => (
                                            <option key={String(zone.id)} value={String(zone.id)}>
                                                {zone.name || zone.title || `Zona ${zone.id}`}
                                            </option>
                                        ))}
                                    </select>
                                    {zonesError && <div style={{ color: "#b91c1c", fontSize: 11 }}>{zonesError}</div>}
                                </div>
                                <div style={fieldStyle}>
                                    <label style={{ ...labelStyle, fontSize: 12 }} htmlFor="kds-moto-value">
                                        Valor moto
                                    </label>
                                    <MoneyInputInline
                                        valueCents={motoValueCents}
                                        onChangeCents={setMotoValueCents}
                                        placeholder="0,00"
                                        disabled={!hasMoto}
                                    />
                                </div>
                            </div>
                        )}
                        <div style={{ height: 1, background: "rgba(0,0,0,0.14)", margin: "0 0 10px" }} />
                        <div
                            style={{
                                display: "grid",
                                gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                                border: "1px solid rgba(17,24,39,0.34)",
                                borderRadius: 16,
                                overflow: "hidden",
                                marginBottom: 12
                            }}
                        >
                            <button
                                type="button"
                                onClick={() => setPaymentMethod("credit")}
                                onMouseEnter={() => setHoveredSegment("credit")}
                                onMouseLeave={() => setHoveredSegment(null)}
                                style={segmentedButtonStyle(paymentMethod === "credit", hoveredSegment === "credit", true)}
                            >
                                <CreditCard size={14} />
                                Crédito
                            </button>
                            <button
                                type="button"
                                onClick={() => setPaymentMethod("debit")}
                                onMouseEnter={() => setHoveredSegment("debit")}
                                onMouseLeave={() => setHoveredSegment(null)}
                                style={segmentedButtonStyle(paymentMethod === "debit", hoveredSegment === "debit", true)}
                                title="À vista (Pix/cartão de débito)"
                            >
                                <Wallet size={14} />
                                À vista
                            </button>
                            <button
                                type="button"
                                onClick={() => setPaymentMethod("cash")}
                                onMouseEnter={() => setHoveredSegment("cash")}
                                onMouseLeave={() => setHoveredSegment(null)}
                                style={segmentedButtonStyle(paymentMethod === "cash", hoveredSegment === "cash", false)}
                            >
                                <Banknote size={14} />
                                Dinheiro
                            </button>
                        </div>

                        <div style={{ height: 1, background: "rgba(0,0,0,0.08)", margin: "4px 0 12px" }} />

                        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 14, marginBottom: 14 }}>
                            <div style={{ ...fieldStyle, minWidth: 0 }}>
                                <label style={{ ...labelStyle, fontSize: 12 }} htmlFor="kds-customer-name">
                                    Cliente (opcional)
                                </label>
                                <input
                                    id="kds-customer-name"
                                    type="text"
                                    style={inputStyle}
                                    value={customerNameState}
                                    onChange={(e) => setCustomerNameState(e.target.value)}
                                />
                            </div>
                            <div style={{ ...fieldStyle, minWidth: 0 }}>
                                <label style={{ ...labelStyle, fontSize: 12 }} htmlFor="kds-customer-phone">
                                    Telefone (opcional)
                                </label>
                                <input
                                    id="kds-customer-phone"
                                    type="text"
                                    style={inputStyle}
                                    value={customerPhoneState}
                                    onChange={(e) => setCustomerPhoneState(e.target.value)}
                                />
                            </div>
                        </div>
                        {capturedItems.length > 0 && (
                            <div style={{ marginBottom: 10, border: "1px solid rgba(17,24,39,0.15)", borderRadius: 8, padding: 8 }}>
                                <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Itens capturados do detalhe</div>
                                <div style={{ maxHeight: 120, overflow: "auto", fontSize: 12, color: "#374151" }}>
                                    {capturedItems.map((item, idx) => (
                                        <div key={`${item.itemName}-${idx}`} style={{ marginBottom: 6 }}>
                                            <div>
                                                {item.qty}x {item.itemName} - R$ {item.itemValue.toFixed(2).replace(".", ",")}
                                            </div>
                                            {item.flavors.length > 0 && (
                                                <div style={{ fontSize: 11, color: "#6b7280" }}>Sabores: {item.flavors.join(", ")}</div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <button
                            type="button"
                            style={{
                                width: "100%",
                                padding: "12px 14px",
                                borderRadius: 8,
                                borderWidth: 0,
                                background: "#42b883",
                                color: "#fff",
                                cursor: "pointer",
                                fontSize: 14,
                                fontWeight: 600
                            }}
                            onClick={handleSync}
                        >
                            Salvar
                        </button>

                        {settingsOpen && (
                            <div style={{ marginTop: 10 }}>
                                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 6 }}>Config KDS</div>
                                <div style={fieldStyle}>
                                    <label style={labelStyle} htmlFor="kds-endpoint">
                                        Endpoint
                                    </label>
                                    <input
                                        id="kds-endpoint"
                                        type="text"
                                        style={inputStyle}
                                        value={endpoint}
                                        onChange={(e) => setEndpoint(e.target.value)}
                                        className="placeholder:text-muted-foreground"
                                        placeholder="https://seu-servidor.com.br/api/kds/order"
                                    />
                                </div>
                                <div style={fieldStyle}>
                                    <label style={labelStyle} htmlFor="kds-zones-endpoint">
                                        Endpoint delivery zones
                                    </label>
                                    <input
                                        id="kds-zones-endpoint"
                                        type="text"
                                        style={inputStyle}
                                        value={zonesEndpoint}
                                        onChange={(e) => setZonesEndpoint(e.target.value)}
                                        className="placeholder:text-muted-foreground"
                                        placeholder="https://seu-servidor.com.br/api/kds/delivery-zones"
                                    />
                                </div>
                                <div style={fieldStyle}>
                                    <label style={labelStyle} htmlFor="kds-apikey">
                                        API key (opcional)
                                    </label>
                                    <input
                                        id="kds-apikey"
                                        type="text"
                                        style={inputStyle}
                                        value={apiKey}
                                        onChange={(e) => setApiKey(e.target.value)}
                                        className="placeholder:text-muted-foreground"
                                        placeholder="api-key"
                                    />
                                </div>
                                <div style={fieldStyle}>
                                    <label style={labelStyle} htmlFor="kds-queue-endpoint">
                                        Endpoint leitura fila (GET)
                                    </label>
                                    <input
                                        id="kds-queue-endpoint"
                                        type="text"
                                        style={inputStyle}
                                        value={queueEndpoint}
                                        onChange={(e) => setQueueEndpoint(e.target.value)}
                                        className="placeholder:text-muted-foreground"
                                        placeholder={DEFAULT_KDS_QUEUE_READ_ENDPOINT}
                                    />
                                </div>
                                <div style={fieldStyle}>
                                    <label style={labelStyle} htmlFor="kds-queue-poll-seconds">
                                        Intervalo leitura (segundos)
                                    </label>
                                    <input
                                        id="kds-queue-poll-seconds"
                                        type="number"
                                        min={3}
                                        max={300}
                                        step={1}
                                        style={inputStyle}
                                        value={queuePollSeconds}
                                        onChange={(e) => setQueuePollSeconds(e.target.value)}
                                        className="placeholder:text-muted-foreground"
                                        placeholder="15"
                                    />
                                </div>
                                <div style={fieldStyle}>
                                    <label style={labelStyle} htmlFor="kds-queue-date">
                                        Data leitura (opcional YYYY-MM-DD)
                                    </label>
                                    <input
                                        id="kds-queue-date"
                                        type="text"
                                        style={inputStyle}
                                        value={queueDate}
                                        onChange={(e) => setQueueDate(e.target.value)}
                                        className="placeholder:text-muted-foreground"
                                        placeholder="2026-02-26"
                                    />
                                </div>
                                <button type="button" style={saveButtonStyle} onClick={handleSave}>
                                    Salvar
                                </button>
                            </div>
                        )}

                        {errorMsg && <div style={{ color: "#b91c1c", fontSize: 12, marginTop: 6 }}>{errorMsg}</div>}
                    </div>
                    </div>,
                    document.body
                )}
        </div>
    );
}

export function extractCommandNumberFromCard(anchorEl: HTMLElement | null): string {
    if (!anchorEl) return "";
    let cursor: HTMLElement | null = anchorEl;
    while (cursor && cursor !== document.body) {
        const found = cursor.querySelector<HTMLSpanElement>('span[data-qa="sale-number"]');
        if (found?.textContent?.trim()) {
            return extractFirstNumber(found.textContent.trim());
        }
        cursor = cursor.parentElement;
    }
    return "";
}

function extractCustomerNameFromCard(anchorEl: HTMLElement | null): string {
    if (!anchorEl) return "";
    let cursor: HTMLElement | null = anchorEl;
    while (cursor && cursor !== document.body) {
        const found = cursor.querySelector<HTMLSpanElement>(NAME_SELECTOR);
        if (found?.textContent?.trim()) {
            return found.textContent.trim();
        }
        cursor = cursor.parentElement;
    }
    return "";
}

function parseCurrencyToCents(text: string): number {
    const found =
        text.match(/R\$\s*([\d\.\,]+)/i)?.[1] ||
        text.match(/([\d]{1,3}(?:\.\d{3})*(?:,\d{2})|\d+(?:,\d{2})?)/)?.[1] ||
        "";
    if (!found) return 0;
    const normalized = found.replace(/\./g, "").replace(",", ".");
    const value = Number(normalized);
    if (!Number.isFinite(value)) return 0;
    return Math.max(0, Math.round(value * 100));
}

function extractOrderAmountCentsFromCard(anchorEl: HTMLElement | null): number {
    if (!anchorEl) return 0;
    let cursor: HTMLElement | null = anchorEl;
    while (cursor && cursor !== document.body) {
        const paymentLikeBlocks = cursor.querySelectorAll<HTMLElement>(".pull-left.ng-binding");
        for (const block of paymentLikeBlocks) {
            const text = block.textContent?.replace(/\s+/g, " ").trim() || "";
            if (!text.includes("R$")) continue;
            const cents = parseCurrencyToCents(text);
            if (cents > 0) return cents;
        }
        cursor = cursor.parentElement;
    }
    return 0;
}

function mountKdsOnDetailSaveButton(saveButton: HTMLButtonElement) {
    const modal = saveButton.closest(DETAIL_MODAL_SELECTOR);
    if (!modal) return;
    if (modal.hasAttribute(DETAIL_SYNC_MARK_ATTR)) return;

    const mount = document.createElement("span");
    mount.className = "amodomio-kds-detail-mount";
    saveButton.insertAdjacentElement("afterend", mount);

    ReactDOM.createRoot(mount).render(
        <KdsSyncButton
            buttonLabel="Sync KDS"
            getDetailDraftOnOpen={() => buildDetailDraft(modal)}
        />
    );
    modal.setAttribute(DETAIL_SYNC_MARK_ATTR, "1");
}

function mountKdsOnCard(phoneEl: HTMLSpanElement) {
    const wrapper = phoneEl.closest<HTMLElement>(`.${WRAPPER_CLASS}`);
    if (!wrapper) return;
    if (wrapper.hasAttribute(KDS_MARK_ATTR)) return;

    const kdsMount = document.createElement("div");
    kdsMount.className = "amodomio-kds-mount";

    const col = wrapper.querySelector<HTMLElement>(".amodomio-wapp-col");
    if (col) {
        wrapper.insertBefore(kdsMount, col);
    } else {
        wrapper.appendChild(kdsMount);
    }

    const commandNumber = extractCommandNumberFromCard(phoneEl);
    const initialOrderAmountCents = extractOrderAmountCentsFromCard(phoneEl);
    const customerName = extractCustomerNameFromCard(phoneEl);
    const customerPhone = phoneEl.textContent?.trim() || "";
    if (commandNumber) {
        commandContactByCard.set(commandNumber, { customerName, customerPhone });
    }

    ReactDOM.createRoot(kdsMount).render(
        <KdsSyncButton
            commandNumber={commandNumber}
            customerName={customerName}
            customerPhone={customerPhone}
            initialOrderAmountCents={initialOrderAmountCents}
            quickCardSyncOnly
        />
    );
    wrapper.setAttribute(KDS_MARK_ATTR, "1");
}

function scanAll() {
    document.querySelectorAll<HTMLSpanElement>(PHONE_SELECTOR).forEach((el) => mountKdsOnCard(el));
    document.querySelectorAll<HTMLButtonElement>(DETAIL_SAVE_BUTTON_SELECTOR).forEach((btn) => mountKdsOnDetailSaveButton(btn));
}

function mountKdsQueueTopBar() {
    let mount = document.getElementById(KDS_QUEUE_BAR_MOUNT_ID) as HTMLDivElement | null;
    if (!mount) {
        mount = document.createElement("div");
        mount.id = KDS_QUEUE_BAR_MOUNT_ID;
    }
    let spacer = document.getElementById(KDS_QUEUE_BAR_SPACER_ID) as HTMLDivElement | null;
    if (!spacer) {
        spacer = document.createElement("div");
        spacer.id = KDS_QUEUE_BAR_SPACER_ID;
        spacer.style.width = "100%";
        spacer.style.height = "32px";
        spacer.style.pointerEvents = "none";
        spacer.style.display = "block";
    }

    const headerAnchor =
        document.querySelector<HTMLElement>("#header") ||
        document.querySelector<HTMLElement>("header#header") ||
        document.querySelector<HTMLElement>("header");

    if (headerAnchor?.parentElement) {
        if (headerAnchor.nextElementSibling !== spacer) {
            headerAnchor.insertAdjacentElement("afterend", spacer);
        }
        if (mount.parentElement !== document.body) {
            document.body.appendChild(mount);
        }
    } else if (mount.parentElement !== document.body) {
        document.body.appendChild(mount);
        if (spacer.parentElement !== document.body) {
            document.body.prepend(spacer);
        }
    }
    const existingRoot = (mount as any).__reactRoot as ReturnType<typeof ReactDOM.createRoot> | undefined;
    const root = existingRoot || ReactDOM.createRoot(mount);
    (mount as any).__reactRoot = root;
    root.render(<KdsQueueTopBar />);
}

export function initKdsSync() {
    mountKdsQueueTopBar();
    scanAll();

    const isLocalhost =
        window.location.hostname === "localhost" ||
        window.location.hostname === "127.0.0.1" ||
        window.location.hostname === "0.0.0.0";
    const isDev = typeof import.meta !== "undefined" && (import.meta as any)?.env?.DEV;

    if (isDev || isLocalhost) {
        const onKeyDown = (e: KeyboardEvent) => {
            if (!e.ctrlKey || !e.shiftKey || e.key.toLowerCase() !== "k") return;
            e.preventDefault();
            let mount = document.getElementById("amodomio-kds-dev-root") as HTMLDivElement | null;
            if (!mount) {
                mount = document.createElement("div");
                mount.id = "amodomio-kds-dev-root";
                document.body.appendChild(mount);
            }
            const existingRoot = (mount as any).__reactRoot as ReturnType<typeof ReactDOM.createRoot> | undefined;
            const root = existingRoot || ReactDOM.createRoot(mount);
            (mount as any).__reactRoot = root;
            root.render(
                <KdsSyncButton
                    openOnMount
                    commandNumber="1"
                    initialOrderAmountCents={9990}
                    customerName="Cliente Teste"
                    customerPhone="(41) 99999-0000"
                />
            );
        };
        window.addEventListener("keydown", onKeyDown);
        console.log("[KDS] Hotkey Ctrl+Shift+K habilitado");
    }

    const obs = new MutationObserver((list) => {
        mountKdsQueueTopBar();
        for (const mut of list) {
            mut.addedNodes.forEach((n) => {
                if (n.nodeType !== Node.ELEMENT_NODE) return;
                const el = n as Element;

                if (el.matches?.(PHONE_SELECTOR)) {
                    mountKdsOnCard(el as HTMLSpanElement);
                }
                if (el.matches?.(DETAIL_SAVE_BUTTON_SELECTOR)) {
                    mountKdsOnDetailSaveButton(el as HTMLButtonElement);
                }
                el.querySelectorAll?.<HTMLSpanElement>(PHONE_SELECTOR).forEach((span) => {
                    mountKdsOnCard(span);
                });
                el.querySelectorAll?.<HTMLButtonElement>(DETAIL_SAVE_BUTTON_SELECTOR).forEach((btn) => {
                    mountKdsOnDetailSaveButton(btn);
                });
            });
        }
    });

    obs.observe(document.body, { childList: true, subtree: true });
}

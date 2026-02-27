import { Check, ChevronLeft, ChevronRight, Loader2, RefreshCw, Settings } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom/client";
import { fieldStyle, inputStyle, labelStyle } from "./common/inject-ui-common";
import { readStorage, writeStorage } from "./common/storage";
import { getModuleStates, setModuleEnabled } from "./common/module-flags";

declare const chrome: any;

const KDS_FETCH_ORDER_QUEUE_MESSAGE = "KDS_FETCH_ORDER_QUEUE";
const KDS_PATCH_ORDER_STATUS_MESSAGE = "KDS_PATCH_ORDER_STATUS";
const KDS_QUEUE_BAR_MOUNT_ID = "amodomio-kds-queue-bar-root";
const KDS_QUEUE_BAR_SPACER_ID = "amodomio-kds-queue-bar-spacer";
const KDS_QUEUE_BAR_COLLAPSED_KEY = "amodomio-kds-queue-bar-collapsed";
export const KDS_QUEUE_DEFAULT_ENDPOINT = "https://amodomio.com.br/api/kds/orders";
const DEFAULT_ZAPI_ENDPOINT = "https://amodomio.com.br/api/messages/text";

const ZAPI_STORAGE_KEYS = {
    endpoint: "amodomio-zapi-endpoint",
    apiKey: "amodomio-zapi-api-key",
    operator: "amodomio-zapi-operator"
};

const KDS_STORAGE_KEYS = {
    endpoint: "amodomio-kds-endpoint",
    apiKey: "amodomio-kds-api-key",
    zonesEndpoint: "amodomio-kds-zones-endpoint",
    queueEndpoint: "amodomio-kds-queue-endpoint",
    queuePollSeconds: "amodomio-kds-queue-poll-seconds",
    queueDate: "amodomio-kds-queue-date"
};

type KdsQueueSnapshot = {
    aguardandoForno: string[];
    assando: string[];
};

type QueueCommandUiState = "idle" | "loading" | "success";

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

function getStoredZapiConfig() {
    return {
        endpoint: readStorage(ZAPI_STORAGE_KEYS.endpoint) || DEFAULT_ZAPI_ENDPOINT,
        apiKey: readStorage(ZAPI_STORAGE_KEYS.apiKey),
        operator: readStorage(ZAPI_STORAGE_KEYS.operator)
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

function saveStoredZapiConfig({ endpoint, apiKey, operator }: { endpoint: string; apiKey: string; operator?: string }) {
    writeStorage(ZAPI_STORAGE_KEYS.endpoint, endpoint);
    writeStorage(ZAPI_STORAGE_KEYS.apiKey, apiKey);
    writeStorage(ZAPI_STORAGE_KEYS.operator, operator || "");
}

function deriveKdsZonesEndpoint(endpoint: string): string {
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

async function testRestApiViaBackground(config: {
    endpoint: string;
    apiKey?: string;
    method?: "GET" | "POST" | "PATCH";
    body?: Record<string, unknown>;
}) {
    const runtime = typeof chrome !== "undefined" && chrome?.runtime ? chrome.runtime : null;
    if (!runtime) throw new Error("chrome.runtime indisponível");

    return new Promise<{ ok: boolean; status?: number; data?: unknown }>((resolve, reject) => {
        runtime.sendMessage(
            {
                type: "REST_API_TEST",
                endpoint: config.endpoint.trim(),
                apiKey: (config.apiKey || "").trim(),
                method: config.method || "GET",
                body: config.body
            },
            (response: { error?: string; data?: unknown; status?: number }) => {
                const lastErr = runtime?.lastError;
                if (lastErr) return reject(new Error(lastErr.message));
                if (response?.error) return reject(new Error(response.error));
                resolve({ ok: true, status: response?.status, data: response?.data });
            }
        );
    });
}

async function fetchKdsOrderQueue(config?: { endpoint?: string; apiKey?: string; date?: string }) {
    const stored = getStoredKdsConfig();
    const endpoint = config?.endpoint?.trim() || stored.queueEndpoint || deriveQueueEndpoint(stored.endpoint) || KDS_QUEUE_DEFAULT_ENDPOINT;
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
                if (lastErr) return reject(new Error(lastErr.message));
                if (response?.error) return reject(new Error(response.error));
                resolve(response?.data);
            }
        );
    });
}

async function patchKdsOrderStatus(config: { endpoint?: string; apiKey?: string; date?: string; commandNumber: string; status: string }) {
    const stored = getStoredKdsConfig();
    const endpoint = config.endpoint?.trim() || stored.queueEndpoint || deriveQueueEndpoint(stored.endpoint) || KDS_QUEUE_DEFAULT_ENDPOINT;
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
                payload: { date, commandNumber, status: config.status }
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
    const candidates = [obj.commandNumber, obj.comanda, obj.command, obj.saleNumber, obj.orderNumber, obj.numeroComanda, obj.numero];
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
                    .map((item) => (typeof item === "object" && item ? readCommandNumberFromObject(item as Record<string, unknown>) : normalizeCommandNumber(item)))
                    .filter(Boolean);
            return { aguardandoForno: mapList(directAguardando), assando: mapList(directAssando) };
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
    const colors = tone === "amber" ? { bg: "#fff7d6", border: "rgba(245,158,11,0.35)" } : { bg: "#ffe5cf", border: "rgba(249,115,22,0.35)" };
    return (
        <div style={{ minWidth: 0, display: "flex", alignItems: "center", gap: 4, padding: "0 6px", background: colors.bg, border: `1px solid ${colors.border}`, borderRadius: 6, minHeight: 28 }}>
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
                            title={isLoading ? `Finalizando comanda ${n}...` : isSuccess ? `Comanda ${n} finalizada` : `Finalizar comanda ${n}`}
                        >
                            {isLoading ? <Loader2 size={14} style={{ animation: "amodomio-kds-spin 0.8s linear infinite" }} /> : isSuccess ? <Check size={14} color="#15803d" /> : n}
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
    const [suspendedByOverlay, setSuspendedByOverlay] = useState(false);
    const [collapsed, setCollapsed] = useState(() => readStorage(KDS_QUEUE_BAR_COLLAPSED_KEY) === "1");
    const [configOpen, setConfigOpen] = useState(false);
    const [settingsTab, setSettingsTab] = useState<"modules" | "whatsapp" | "kds_sync" | "kds_queue">("modules");
    const [settingsFeedback, setSettingsFeedback] = useState<{ kind: "success" | "error"; message: string } | null>(null);
    const [cfgWhatsAppEndpoint, setCfgWhatsAppEndpoint] = useState("");
    const [cfgWhatsAppApiKey, setCfgWhatsAppApiKey] = useState("");
    const [cfgWhatsAppOperator, setCfgWhatsAppOperator] = useState("");
    const [cfgKdsEndpoint, setCfgKdsEndpoint] = useState("");
    const [cfgKdsApiKey, setCfgKdsApiKey] = useState("");
    const [cfgKdsZonesEndpoint, setCfgKdsZonesEndpoint] = useState("");
    const [cfgEndpoint, setCfgEndpoint] = useState("");
    const [cfgApiKey, setCfgApiKey] = useState("");
    const [cfgPollSeconds, setCfgPollSeconds] = useState("15");
    const [cfgDate, setCfgDate] = useState("");
    const [moduleStates, setModuleStates] = useState(() => getModuleStates());
    const [commandUiStateById, setCommandUiStateById] = useState<Record<string, QueueCommandUiState>>({});
    const manualRefreshRef = useRef<(() => void) | null>(null);

    useEffect(() => {
        const styleId = "amodomio-kds-queue-animations";
        if (document.getElementById(styleId)) return;
        const styleEl = document.createElement("style");
        styleEl.id = styleId;
        styleEl.textContent = "@keyframes amodomio-kds-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }";
        document.head.appendChild(styleEl);
    }, []);

    useEffect(() => {
        const zapiCfg = getStoredZapiConfig();
        const cfg = getStoredKdsConfig();
        setCfgWhatsAppEndpoint(zapiCfg.endpoint);
        setCfgWhatsAppApiKey(zapiCfg.apiKey);
        setCfgWhatsAppOperator(zapiCfg.operator);
        setCfgKdsEndpoint(cfg.endpoint);
        setCfgKdsApiKey(cfg.apiKey);
        setCfgKdsZonesEndpoint(cfg.zonesEndpoint || deriveKdsZonesEndpoint(cfg.endpoint));
        setCfgEndpoint(cfg.queueEndpoint || deriveQueueEndpoint(cfg.endpoint) || KDS_QUEUE_DEFAULT_ENDPOINT);
        setCfgApiKey(cfg.apiKey);
        setCfgPollSeconds(cfg.queuePollSeconds || "15");
        setCfgDate(cfg.queueDate || "");
    }, []);

    useEffect(() => {
        writeStorage(KDS_QUEUE_BAR_COLLAPSED_KEY, collapsed ? "1" : "");
        const spacer = document.getElementById(KDS_QUEUE_BAR_SPACER_ID) as HTMLDivElement | null;
        if (spacer) spacer.style.height = collapsed ? "0px" : "32px";
        if (collapsed) {
            setConfigOpen(false);
            setSettingsTab("modules");
            setSettingsFeedback(null);
        }
    }, [collapsed]);

    function getHeaderMetrics() {
        const candidates = [
            document.querySelector<HTMLElement>("#header .header-inner"),
            document.querySelector<HTMLElement>("saipos-header .header-inner"),
            document.querySelector<HTMLElement>("#header"),
            document.querySelector<HTMLElement>("header#header"),
            document.querySelector<HTMLElement>("header")
        ].filter(Boolean) as HTMLElement[];

        let bestTop = 0;
        let bestLeft = 0;
        let bestWidth = 0;

        for (const el of candidates) {
            const rect = el.getBoundingClientRect();
            if (rect.width < 100 || rect.height < 20) continue;
            const bottomByRect = rect.bottom;
            const style = window.getComputedStyle(el);
            const topByStyle = Number.parseFloat(style.top || "0");
            const bottomByOffset = Number.isFinite(topByStyle) ? topByStyle + el.offsetHeight : el.offsetHeight;
            const bottom = Math.max(bottomByRect, bottomByOffset);
            if (bottom > bestTop) bestTop = bottom;
            if (rect.width > bestWidth) {
                bestWidth = rect.width;
                bestLeft = rect.left;
            }
        }

        return {
            top: Math.max(0, Math.round(bestTop || 48)),
            left: Math.round(bestLeft || 0),
            width: Math.round(bestWidth || 0)
        };
    }

    useEffect(() => {
        const BAR_HEIGHT = collapsed ? 0 : 30;
        const updateHeaderAnchor = () => {
            const metrics = getHeaderMetrics();
            setTopOffset(metrics.top);
            setHeaderLeft(metrics.left);
            setHeaderWidth(metrics.width > 0 ? metrics.width : null);
            const spacer = document.getElementById(KDS_QUEUE_BAR_SPACER_ID) as HTMLDivElement | null;
            if (spacer) spacer.style.height = `${BAR_HEIGHT + 2}px`;
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
    }, [collapsed]);

    useEffect(() => {
        const isVisible = (el: Element | null): el is HTMLElement => {
            if (!(el instanceof HTMLElement)) return false;
            const style = window.getComputedStyle(el);
            if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) return false;
            const rect = el.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0;
        };
        const hasBlockingOverlay = () => {
            const selectors = ["uib-modal-window", ".modal.in", ".modal.show", ".modal.fade.in", ".sweet-alert", ".swal2-container", "[role='dialog']", ".dialog", ".popover:has(input), .popover:has(textarea)"];
            for (const selector of selectors) {
                const nodes = document.querySelectorAll(selector);
                for (const node of nodes) {
                    if (!isVisible(node)) continue;
                    const rect = (node as HTMLElement).getBoundingClientRect();
                    if (rect.width < 200 || rect.height < 80) continue;
                    return true;
                }
            }
            return false;
        };
        const update = () => setSuspendedByOverlay(hasBlockingOverlay());
        update();
        const obs = new MutationObserver(() => update());
        obs.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "style"] });
        window.addEventListener("resize", update);
        window.addEventListener("scroll", update, { passive: true });
        return () => {
            obs.disconnect();
            window.removeEventListener("resize", update);
            window.removeEventListener("scroll", update);
        };
    }, []);

    useEffect(() => {
        let cancelled = false;
        let intervalId: number | null = null;
        const run = async () => {
            const cfg = getStoredKdsConfig();
            const queueEndpoint = cfg.queueEndpoint || deriveQueueEndpoint(cfg.endpoint) || KDS_QUEUE_DEFAULT_ENDPOINT;
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
            } catch (err) {
                if (cancelled) return;
                setStatus("error");
                setErrorMsg(err instanceof Error ? err.message : "Falha ao ler fila KDS");
            }
        };
        manualRefreshRef.current = () => void run();
        run();
        const seconds = parsePollSeconds(getStoredKdsConfig().queuePollSeconds || "15", 15);
        intervalId = window.setInterval(run, seconds * 1000);
        const onStorage = (e: StorageEvent) => {
            if (!e.key || !Object.values(KDS_STORAGE_KEYS).includes(e.key as any)) return;
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
                endpoint: cfg.queueEndpoint || deriveQueueEndpoint(cfg.endpoint) || KDS_QUEUE_DEFAULT_ENDPOINT,
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

    const saveQueueConfig = () => {
        const current = getStoredKdsConfig();
        saveStoredKdsConfig({
            endpoint: current.endpoint || cfgKdsEndpoint.trim(),
            zonesEndpoint: current.zonesEndpoint || cfgKdsZonesEndpoint.trim(),
            apiKey: cfgApiKey,
            queueEndpoint: cfgEndpoint.trim(),
            queuePollSeconds: String(parsePollSeconds(cfgPollSeconds || "15", 15)),
            queueDate: normalizeKdsReadDate(cfgDate)
        });
        setCfgPollSeconds(String(parsePollSeconds(cfgPollSeconds || "15", 15)));
        setCfgDate(normalizeKdsReadDate(cfgDate));
        setSettingsFeedback({ kind: "success", message: "Configuração KDS Queue salva." });
    };

    const saveWhatsAppConfig = () => {
        if (!cfgWhatsAppEndpoint.trim() || !cfgWhatsAppApiKey.trim()) {
            setSettingsFeedback({ kind: "error", message: "Preencha endpoint e API key da Z-API." });
            return;
        }
        saveStoredZapiConfig({ endpoint: cfgWhatsAppEndpoint.trim(), apiKey: cfgWhatsAppApiKey.trim(), operator: cfgWhatsAppOperator.trim() });
        setSettingsFeedback({ kind: "success", message: "Configuração WhatsApp salva." });
    };

    const saveKdsSyncConfig = () => {
        if (!cfgKdsEndpoint.trim()) {
            setSettingsFeedback({ kind: "error", message: "Preencha o endpoint do KDS Sync." });
            return;
        }
        const effectiveZones = cfgKdsZonesEndpoint.trim() || deriveKdsZonesEndpoint(cfgKdsEndpoint.trim());
        const current = getStoredKdsConfig();
        saveStoredKdsConfig({
            endpoint: cfgKdsEndpoint.trim(),
            apiKey: cfgKdsApiKey.trim(),
            zonesEndpoint: effectiveZones,
            queueEndpoint: current.queueEndpoint || cfgEndpoint.trim(),
            queuePollSeconds: String(parsePollSeconds(current.queuePollSeconds || cfgPollSeconds || "15", 15)),
            queueDate: normalizeKdsReadDate(current.queueDate || cfgDate)
        });
        setCfgKdsZonesEndpoint(effectiveZones);
        setSettingsFeedback({ kind: "success", message: "Configuração KDS Sync salva." });
    };

    const testWhatsAppConfig = async () => {
        if (!cfgWhatsAppEndpoint.trim() || !cfgWhatsAppApiKey.trim()) {
            setSettingsFeedback({ kind: "error", message: "Preencha endpoint e API key da Z-API para testar." });
            return;
        }
        setSettingsFeedback({ kind: "success", message: "Testando WhatsApp..." });
        try {
            const result = await testRestApiViaBackground({
                endpoint: cfgWhatsAppEndpoint.trim(),
                apiKey: cfgWhatsAppApiKey.trim(),
                method: "GET"
            });
            setSettingsFeedback({ kind: "success", message: `WhatsApp OK${result.status ? ` (${result.status})` : ""}` });
        } catch (err) {
            setSettingsFeedback({ kind: "error", message: err instanceof Error ? err.message : "Falha no teste WhatsApp" });
        }
    };

    const testKdsSyncConfig = async () => {
        const endpoint = cfgKdsZonesEndpoint.trim() || deriveKdsZonesEndpoint(cfgKdsEndpoint.trim());
        if (!endpoint || !cfgKdsApiKey.trim()) {
            setSettingsFeedback({ kind: "error", message: "Preencha endpoint de zonas e API key do KDS Sync para testar." });
            return;
        }
        setSettingsFeedback({ kind: "success", message: "Testando KDS Sync..." });
        try {
            const result = await testRestApiViaBackground({
                endpoint,
                apiKey: cfgKdsApiKey.trim(),
                method: "GET"
            });
            setSettingsFeedback({ kind: "success", message: `KDS Sync OK${result.status ? ` (${result.status})` : ""}` });
        } catch (err) {
            setSettingsFeedback({ kind: "error", message: err instanceof Error ? err.message : "Falha no teste KDS Sync" });
        }
    };

    const testKdsQueueConfig = async () => {
        if (!cfgEndpoint.trim() || !cfgApiKey.trim()) {
            setSettingsFeedback({ kind: "error", message: "Preencha endpoint de leitura e API key do KDS Queue para testar." });
            return;
        }
        setSettingsFeedback({ kind: "success", message: "Testando KDS Queue..." });
        try {
            const result = await testRestApiViaBackground({
                endpoint: buildKdsOrdersReadUrl(cfgEndpoint.trim(), cfgDate),
                apiKey: cfgApiKey.trim(),
                method: "GET"
            });
            setSettingsFeedback({ kind: "success", message: `KDS Queue OK${result.status ? ` (${result.status})` : ""}` });
        } catch (err) {
            setSettingsFeedback({ kind: "error", message: err instanceof Error ? err.message : "Falha no teste KDS Queue" });
        }
    };

    const toggleModule = (moduleKey: "whatsapp" | "kdsSync" | "kdsQueueBar") => {
        setModuleStates((prev) => ({ ...prev, [moduleKey]: !prev[moduleKey] }));
    };

    const applyModuleSettings = () => {
        setModuleEnabled("whatsapp", moduleStates.whatsapp);
        setModuleEnabled("kds_sync", moduleStates.kdsSync);
        setModuleEnabled("kds_queue_bar", moduleStates.kdsQueueBar);
        window.location.reload();
    };

    return (
        <div
            style={{
                position: "fixed",
                top: topOffset,
                left: headerLeft,
                width: headerWidth ? `${headerWidth}px` : "100vw",
                zIndex: suspendedByOverlay ? 1 : 2147483000,
                pointerEvents: "none",
                opacity: suspendedByOverlay ? 0 : 1,
                transform: suspendedByOverlay ? "translateY(-6px)" : "translateY(0)",
                transition: "opacity 140ms ease, transform 140ms ease"
            }}
        >
            <div
                style={{
                    background: "#f8fafc",
                    borderBottom: "1px solid rgba(37,99,235,0.12)",
                    boxShadow: "0 1px 4px rgba(15,23,42,0.06)",
                    padding: collapsed ? "0 4px" : "0 6px",
                    pointerEvents: "auto"
                }}
            >
                <div
                    style={{
                        display: "grid",
                        gridTemplateColumns: collapsed ? "auto auto" : "auto 1fr 1fr auto",
                        gap: 6,
                        alignItems: "center"
                    }}
                >
                    <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 4 }}>
                        <button
                            type="button"
                            title="Configurações globais da extensão"
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
                                    left: 0,
                                    width: "min(620px, calc(100vw - 24px))",
                                    maxHeight: "70vh",
                                    overflowY: "auto",
                                    background: "#fff",
                                    border: "1px solid rgba(17,24,39,0.12)",
                                    borderRadius: 8,
                                    boxShadow: "0 10px 24px rgba(0,0,0,0.12)",
                                    padding: 8,
                                    zIndex: 20
                                }}
                            >
                                <div style={{ display: "grid", gridTemplateColumns: "116px minmax(0, 1fr)", gap: 10 }}>
                                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                        <button
                                            type="button"
                                            onClick={() => setSettingsTab("modules")}
                                            style={{
                                                border: settingsTab === "modules" ? "1px solid rgba(37,99,235,0.4)" : "1px solid rgba(17,24,39,0.12)",
                                                background: settingsTab === "modules" ? "#eff6ff" : "#fff",
                                                color: "#1f2937",
                                                borderRadius: 6,
                                                padding: "7px 8px",
                                                fontSize: 11,
                                                fontWeight: 700,
                                                cursor: "pointer",
                                                textAlign: "left"
                                            }}
                                        >
                                            Módulos
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setSettingsTab("whatsapp")}
                                            style={{
                                                border: settingsTab === "whatsapp" ? "1px solid rgba(37,99,235,0.4)" : "1px solid rgba(17,24,39,0.12)",
                                                background: settingsTab === "whatsapp" ? "#eff6ff" : "#fff",
                                                color: "#1f2937",
                                                borderRadius: 6,
                                                padding: "7px 8px",
                                                fontSize: 11,
                                                fontWeight: 700,
                                                cursor: "pointer",
                                                textAlign: "left"
                                            }}
                                        >
                                            WhatsApp
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setSettingsTab("kds_sync")}
                                            style={{
                                                border: settingsTab === "kds_sync" ? "1px solid rgba(37,99,235,0.4)" : "1px solid rgba(17,24,39,0.12)",
                                                background: settingsTab === "kds_sync" ? "#eff6ff" : "#fff",
                                                color: "#1f2937",
                                                borderRadius: 6,
                                                padding: "7px 8px",
                                                fontSize: 11,
                                                fontWeight: 700,
                                                cursor: "pointer",
                                                textAlign: "left"
                                            }}
                                        >
                                            KDS Sync
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setSettingsTab("kds_queue")}
                                            style={{
                                                border: settingsTab === "kds_queue" ? "1px solid rgba(37,99,235,0.4)" : "1px solid rgba(17,24,39,0.12)",
                                                background: settingsTab === "kds_queue" ? "#eff6ff" : "#fff",
                                                color: "#1f2937",
                                                borderRadius: 6,
                                                padding: "7px 8px",
                                                fontSize: 11,
                                                fontWeight: 700,
                                                cursor: "pointer",
                                                textAlign: "left"
                                            }}
                                        >
                                            KDS Queue
                                        </button>
                                    </div>
                                    <div style={{ minWidth: 0 }}>

                                {settingsTab === "modules" && (
                                    <>
                                        <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>Módulos</div>
                                        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, marginBottom: 6 }}>
                                            <input type="checkbox" checked={moduleStates.whatsapp} onChange={() => toggleModule("whatsapp")} />
                                            WhatsApp
                                        </label>
                                        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, marginBottom: 6 }}>
                                            <input type="checkbox" checked={moduleStates.kdsSync} onChange={() => toggleModule("kdsSync")} />
                                            KDS Sync
                                        </label>
                                        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, marginBottom: 10 }}>
                                            <input type="checkbox" checked={moduleStates.kdsQueueBar} onChange={() => toggleModule("kdsQueueBar")} />
                                            KDS Queue Bar
                                        </label>
                                    </>
                                )}

                                {settingsTab === "kds_queue" && (
                                    <>
                                        <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>KDS Queue</div>
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
                                                placeholder={KDS_QUEUE_DEFAULT_ENDPOINT}
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
                                    </>
                                )}

                                {settingsTab === "whatsapp" && (
                                    <>
                                        <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>WhatsApp (Z-API)</div>
                                        <div style={{ ...fieldStyle, padding: "0 0 6px" }}>
                                            <label style={{ ...labelStyle, fontSize: 11 }} htmlFor="global-whatsapp-endpoint">
                                                Endpoint
                                            </label>
                                            <input id="global-whatsapp-endpoint" type="text" style={{ ...inputStyle, padding: "8px 10px", fontSize: 12, borderRadius: 8 }} value={cfgWhatsAppEndpoint} onChange={(e) => setCfgWhatsAppEndpoint(e.target.value)} placeholder={DEFAULT_ZAPI_ENDPOINT} />
                                        </div>
                                        <div style={{ ...fieldStyle, padding: "0 0 6px" }}>
                                            <label style={{ ...labelStyle, fontSize: 11 }} htmlFor="global-whatsapp-apikey">
                                                API key
                                            </label>
                                            <input id="global-whatsapp-apikey" type="text" style={{ ...inputStyle, padding: "8px 10px", fontSize: 12, borderRadius: 8 }} value={cfgWhatsAppApiKey} onChange={(e) => setCfgWhatsAppApiKey(e.target.value)} placeholder="api-key" />
                                        </div>
                                        <div style={{ ...fieldStyle, padding: 0 }}>
                                            <label style={{ ...labelStyle, fontSize: 11 }} htmlFor="global-whatsapp-operator">
                                                Operador (opcional)
                                            </label>
                                            <input id="global-whatsapp-operator" type="text" style={{ ...inputStyle, padding: "8px 10px", fontSize: 12, borderRadius: 8 }} value={cfgWhatsAppOperator} onChange={(e) => setCfgWhatsAppOperator(e.target.value)} placeholder="Nome operador" />
                                        </div>
                                    </>
                                )}

                                {settingsTab === "kds_sync" && (
                                    <>
                                        <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>KDS Sync</div>
                                        <div style={{ ...fieldStyle, padding: "0 0 6px" }}>
                                            <label style={{ ...labelStyle, fontSize: 11 }} htmlFor="global-kds-sync-endpoint">
                                                Endpoint pedido (POST)
                                            </label>
                                            <input id="global-kds-sync-endpoint" type="text" style={{ ...inputStyle, padding: "8px 10px", fontSize: 12, borderRadius: 8 }} value={cfgKdsEndpoint} onChange={(e) => setCfgKdsEndpoint(e.target.value)} placeholder="https://seu-servidor.com.br/api/kds/order" />
                                        </div>
                                        <div style={{ ...fieldStyle, padding: "0 0 6px" }}>
                                            <label style={{ ...labelStyle, fontSize: 11 }} htmlFor="global-kds-sync-zones">
                                                Endpoint zonas (GET)
                                            </label>
                                            <input id="global-kds-sync-zones" type="text" style={{ ...inputStyle, padding: "8px 10px", fontSize: 12, borderRadius: 8 }} value={cfgKdsZonesEndpoint} onChange={(e) => setCfgKdsZonesEndpoint(e.target.value)} placeholder={deriveKdsZonesEndpoint(cfgKdsEndpoint || "https://seu-servidor.com.br/api/kds/order")} />
                                        </div>
                                        <div style={{ ...fieldStyle, padding: 0 }}>
                                            <label style={{ ...labelStyle, fontSize: 11 }} htmlFor="global-kds-sync-apikey">
                                                API key
                                            </label>
                                            <input id="global-kds-sync-apikey" type="text" style={{ ...inputStyle, padding: "8px 10px", fontSize: 12, borderRadius: 8 }} value={cfgKdsApiKey} onChange={(e) => setCfgKdsApiKey(e.target.value)} placeholder="api-key" />
                                        </div>
                                    </>
                                )}

                                {settingsFeedback && (
                                    <div style={{ marginTop: 6, fontSize: 11, color: settingsFeedback.kind === "error" ? "#b91c1c" : "#065f46", background: settingsFeedback.kind === "error" ? "#fef2f2" : "#ecfdf5", border: `1px solid ${settingsFeedback.kind === "error" ? "rgba(239,68,68,0.25)" : "rgba(16,185,129,0.25)"}`, borderRadius: 6, padding: "6px 8px" }}>
                                        {settingsFeedback.message}
                                    </div>
                                )}
                                {status === "error" && errorMsg ? <div style={{ marginTop: 6, fontSize: 11, color: "#b91c1c" }}>{errorMsg}</div> : null}
                                <div style={{ display: "flex", justifyContent: "flex-end", gap: 6, marginTop: 8 }}>
                                    <button
                                        type="button"
                                        onClick={() => setConfigOpen(false)}
                                        style={{ border: "1px solid rgba(17,24,39,0.12)", background: "#fff", color: "#334155", borderRadius: 6, padding: "6px 8px", fontSize: 11, cursor: "pointer" }}
                                    >
                                        Fechar
                                    </button>
                                    {settingsTab === "whatsapp" && (
                                        <>
                                            <button type="button" onClick={() => void testWhatsAppConfig()} style={{ border: 0, background: "#334155", color: "#fff", borderRadius: 6, padding: "6px 8px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                                                Testar
                                            </button>
                                            <button type="button" onClick={saveWhatsAppConfig} style={{ border: 0, background: "#2563eb", color: "#fff", borderRadius: 6, padding: "6px 8px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                                                Salvar WhatsApp
                                            </button>
                                        </>
                                    )}
                                    {settingsTab === "kds_sync" && (
                                        <>
                                            <button type="button" onClick={() => void testKdsSyncConfig()} style={{ border: 0, background: "#334155", color: "#fff", borderRadius: 6, padding: "6px 8px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                                                Testar
                                            </button>
                                            <button type="button" onClick={saveKdsSyncConfig} style={{ border: 0, background: "#2563eb", color: "#fff", borderRadius: 6, padding: "6px 8px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                                                Salvar KDS Sync
                                            </button>
                                        </>
                                    )}
                                    {settingsTab === "kds_queue" && (
                                        <>
                                            <button type="button" onClick={() => void testKdsQueueConfig()} style={{ border: 0, background: "#334155", color: "#fff", borderRadius: 6, padding: "6px 8px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                                                Testar
                                            </button>
                                            <button type="button" onClick={saveQueueConfig} style={{ border: 0, background: "#2563eb", color: "#fff", borderRadius: 6, padding: "6px 8px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                                                Salvar KDS Queue
                                            </button>
                                        </>
                                    )}
                                    {settingsTab === "modules" && (
                                        <button
                                            type="button"
                                            onClick={applyModuleSettings}
                                            style={{ border: 0, background: "#0f766e", color: "#fff", borderRadius: 6, padding: "6px 8px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}
                                        >
                                            Aplicar e recarregar
                                        </button>
                                    )}
                                </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {!collapsed && <QueueColumn tone="amber" commandNumbers={snapshot.aguardandoForno} onCommandClick={handleFinalizeCommand} commandUiStateById={commandUiStateById} />}
                    {!collapsed && <QueueColumn tone="orange" commandNumbers={snapshot.assando} onCommandClick={handleFinalizeCommand} commandUiStateById={commandUiStateById} />}

                    <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 4, justifySelf: "end" }}>
                        {!collapsed && (
                            <>
                                <span title={status === "error" ? errorMsg || "Falha na leitura KDS" : status === "loading" ? "Atualizando fila KDS" : hasData ? "Fila KDS atualizada" : "KDS sem itens"} style={{ width: 8, height: 8, borderRadius: 999, background: statusColor, opacity: status === "idle" ? 0.8 : 1 }} />
                                <button type="button" title="Atualizar fila KDS" onClick={() => manualRefreshRef.current?.()} style={{ border: "1px solid rgba(17,24,39,0.14)", background: "#fff", color: "#334155", width: 24, height: 24, borderRadius: 6, display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: 0 }}>
                                    <RefreshCw size={13} style={status === "loading" ? { animation: "amodomio-kds-spin 0.8s linear infinite" } : undefined} />
                                </button>
                            </>
                        )}
                        <button type="button" title={collapsed ? "Expandir barra KDS" : "Recolher barra KDS"} onClick={() => setCollapsed((prev) => !prev)} style={{ border: "1px solid rgba(17,24,39,0.14)", background: "#fff", color: "#334155", width: 24, height: 24, borderRadius: 6, display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: 0 }}>
                            {collapsed ? <ChevronLeft size={13} /> : <ChevronRight size={13} />}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export function mountKdsQueueTopBar() {
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
        if (headerAnchor.nextElementSibling !== spacer) headerAnchor.insertAdjacentElement("afterend", spacer);
        if (mount.parentElement !== document.body) document.body.appendChild(mount);
    } else {
        if (mount.parentElement !== document.body) document.body.appendChild(mount);
        if (spacer.parentElement !== document.body) document.body.prepend(spacer);
    }

    const existingRoot = (mount as any).__reactRoot as ReturnType<typeof ReactDOM.createRoot> | undefined;
    const root = existingRoot || ReactDOM.createRoot(mount);
    (mount as any).__reactRoot = root;
    root.render(<KdsQueueTopBar />);
}

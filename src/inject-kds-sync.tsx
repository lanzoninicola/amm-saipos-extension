import React, { useEffect, useRef, useState } from "react";
import { Banknote, Bike, CreditCard, Package, RefreshCw, Wallet } from "lucide-react";
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

const KDS_STORAGE_KEYS = {
    endpoint: "amodomio-kds-endpoint",
    apiKey: "amodomio-kds-api-key",
    zonesEndpoint: "amodomio-kds-zones-endpoint"
};

function getStoredKdsConfig() {
    return {
        endpoint: readStorage(KDS_STORAGE_KEYS.endpoint),
        apiKey: readStorage(KDS_STORAGE_KEYS.apiKey),
        zonesEndpoint: readStorage(KDS_STORAGE_KEYS.zonesEndpoint)
    };
}

function saveStoredKdsConfig({ endpoint, apiKey, zonesEndpoint }: { endpoint: string; apiKey?: string; zonesEndpoint?: string }) {
    writeStorage(KDS_STORAGE_KEYS.endpoint, endpoint);
    writeStorage(KDS_STORAGE_KEYS.apiKey, apiKey || "");
    writeStorage(KDS_STORAGE_KEYS.zonesEndpoint, zonesEndpoint || "");
}

async function sendKdsOrder(payload: Record<string, unknown>, config?: { endpoint: string; apiKey?: string }) {
    const endpoint = config?.endpoint?.trim() || getStoredKdsConfig().endpoint;
    const apiKey = config?.apiKey?.trim() || getStoredKdsConfig().apiKey;

    if (!endpoint) throw new Error("Configure o endpoint do KDS");

    const runtime = typeof chrome !== "undefined" && chrome?.runtime ? chrome.runtime : null;
    if (!runtime) throw new Error("chrome.runtime indisponível");

    return new Promise<{ ok: boolean }>((resolve, reject) => {
        runtime.sendMessage(
            {
                type: "KDS_ORDER",
                endpoint,
                apiKey,
                payload
            },
            (response: { error?: string }) => {
                const lastErr = runtime?.lastError;
                if (lastErr) {
                    reject(new Error(lastErr.message));
                    return;
                }
                if (response?.error) {
                    reject(new Error(response.error));
                    return;
                }
                resolve({ ok: true });
            }
        );
    });
}

type DeliveryZone = { id: string | number; name?: string; title?: string };

const CHANNEL_OPTIONS = ["WHATS/PRESENCIAL/TELE", "CARDAPIO", "AIQFOME", "IFOOD"];

function toCents(value?: number | string | null) {
    const n =
        value == null
            ? 0
            : typeof value === "number"
            ? value
            : Number((value as any)?.toString?.() ?? `${value}`);
    const finite = Number.isFinite(n) ? n : 0;
    return Math.max(0, Math.round(finite * 100));
}

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

export function KdsSyncButton({
    commandNumber,
    customerName,
    customerPhone,
    openOnMount
}: {
    commandNumber?: string;
    customerName?: string;
    customerPhone?: string;
    openOnMount?: boolean;
}) {
    const [modalOpen, setModalOpen] = useState(false);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [endpoint, setEndpoint] = useState(() => getStoredKdsConfig().endpoint);
    const [apiKey, setApiKey] = useState(() => getStoredKdsConfig().apiKey);
    const [zonesEndpoint, setZonesEndpoint] = useState(() => getStoredKdsConfig().zonesEndpoint);
    const [status, setStatus] = useState<"idle" | "sending" | "ok" | "error">("idle");
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [zones, setZones] = useState<DeliveryZone[]>([]);
    const [zonesLoading, setZonesLoading] = useState(false);
    const [zonesError, setZonesError] = useState<string | null>(null);

    const [commandValue, setCommandValue] = useState(commandNumber || "");
    const [orderAmountCents, setOrderAmountCents] = useState(0);
    const [motoValueCents, setMotoValueCents] = useState(0);
    const orderAmountRef = useRef<HTMLInputElement | null>(null);
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
    const [customerNameState, setCustomerNameState] = useState(customerName || "");
    const [customerPhoneState, setCustomerPhoneState] = useState(customerPhone || "");

    useEffect(() => {
        if (openOnMount) setModalOpen(true);
    }, [openOnMount]);

    useEffect(() => {
        if (!modalOpen) return;
        setCommandValue(commandNumber || "");
        setCustomerNameState(customerName || "");
        setCustomerPhoneState(customerPhone || "");
        setErrorMsg(null);
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
                            type: "KDS_ZONES",
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
    }, [modalOpen, commandNumber, customerName, customerPhone, endpoint, apiKey, zonesEndpoint]);

    const btnStyle: React.CSSProperties = {
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 28,
        height: 28,
        borderRadius: 6,
        background: "#059669",
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
        saveStoredKdsConfig({ endpoint, apiKey, zonesEndpoint });
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
        inputRef?: React.RefObject<HTMLInputElement | null>;
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

    const pillButton = (
        label: string,
        active: boolean,
        onClick: () => void,
        icon?: React.ReactNode
    ) => (
        <button
            type="button"
            onClick={onClick}
            style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 10px",
                borderRadius: 999,
                border: "1px solid rgba(0,0,0,0.14)",
                background: active ? "#111827" : "#f9fafb",
                color: active ? "#fff" : "#111827",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer"
            }}
        >
            {icon}
            {label}
        </button>
    );

    const sizeBtn = (label: string, value: string, setValue: (v: string) => void) => {
        const numeric = parseIntOrZero(value);
        return (
            <button
                type="button"
                style={{
                    width: 40,
                    height: 40,
                    borderRadius: 999,
                    border: "1px solid rgba(0,0,0,0.18)",
                    background: numeric > 0 ? "#1e40af" : "#fff",
                    color: numeric > 0 ? "#fff" : "#111827",
                    fontWeight: 700,
                    fontSize: 12,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 4
                }}
                onClick={() => setValue(String(numeric + 1))}
                onContextMenu={(e) => {
                    e.preventDefault();
                    setValue(String(Math.max(0, numeric - 1)));
                }}
                title="Clique para +1, botão direito para -1"
            >
                {label}
                {numeric > 0 && <span style={{ fontSize: 11 }}>{numeric}</span>}
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

            await sendKdsOrder(payload, { endpoint, apiKey });
            setStatus("ok");
            setTimeout(() => setStatus("idle"), 1200);
        } catch (err) {
            setStatus("error");
            setErrorMsg(err instanceof Error ? err.message : "Falha ao sincronizar");
            setTimeout(() => setStatus("idle"), 1500);
        }
    };

    return (
        <div style={{ position: "relative" }}>
            <button
                type="button"
                title={`Sincronizar pedido no KDS (${status})`}
                style={btnStyle}
                onClick={(e) => {
                    e.stopPropagation();
                    setModalOpen(true);
                }}
            >
                <RefreshCw size={16} />
            </button>

            {modalOpen &&
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
                                minWidth: 300,
                                padding: 12,
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

                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
                            <div style={fieldStyle}>
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
                            <div style={fieldStyle}>
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
                                    style={{ ...inputStyle, height: 34 }}
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

                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                            {sizeBtn("F", sizeF, setSizeF)}
                            {sizeBtn("M", sizeM, setSizeM)}
                            {sizeBtn("P", sizeP, setSizeP)}
                            {sizeBtn("I", sizeI, setSizeI)}
                            {sizeBtn("FT", sizeFT, setSizeFT)}
                            <button
                                type="button"
                                style={{
                                    height: 32,
                                    padding: "0 10px",
                                    borderRadius: 999,
                                    border: "1px solid rgba(0,0,0,0.12)",
                                    background: "#f3f4f6",
                                    fontSize: 12,
                                    cursor: "pointer"
                                }}
                                onClick={() => {
                                    setSizeF("0");
                                    setSizeM("0");
                                    setSizeP("0");
                                    setSizeI("0");
                                    setSizeFT("0");
                                }}
                            >
                                Zerar
                            </button>
                        </div>

                        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
                            {pillButton("Delivery", hasMoto, () => {
                                const next = !hasMoto;
                                setHasMoto(next);
                                if (next) setTakeAway(false);
                            }, <Bike size={14} />)}
                            {pillButton("Retirada", takeAway, () => {
                                const next = !takeAway;
                                setTakeAway(next);
                                if (next) setHasMoto(false);
                            }, <Package size={14} />)}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                            {pillButton("Crédito", paymentMethod === "credit", () => setPaymentMethod("credit"), <CreditCard size={14} />)}
                            {pillButton("Débito", paymentMethod === "debit", () => setPaymentMethod("debit"), <Wallet size={14} />)}
                            {pillButton("Dinheiro", paymentMethod === "cash", () => setPaymentMethod("cash"), <Banknote size={14} />)}
                        </div>

                        {hasMoto && (
                            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12, marginBottom: 12 }}>
                                <div style={fieldStyle}>
                                    <label style={{ ...labelStyle, fontSize: 12 }} htmlFor="kds-zone">
                                        Zona de entrega
                                    </label>
                                    <select
                                        id="kds-zone"
                                        style={{ ...inputStyle, height: 34 }}
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

                        <div style={{ height: 1, background: "rgba(0,0,0,0.08)", margin: "4px 0 12px" }} />

                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                            <div style={fieldStyle}>
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
                            <div style={fieldStyle}>
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
    const customerName = extractCustomerNameFromCard(phoneEl);
    const customerPhone = phoneEl.textContent?.trim() || "";
    ReactDOM.createRoot(kdsMount).render(
        <KdsSyncButton commandNumber={commandNumber} customerName={customerName} customerPhone={customerPhone} />
    );
    wrapper.setAttribute(KDS_MARK_ATTR, "1");
}

function scanAll() {
    document.querySelectorAll<HTMLSpanElement>(PHONE_SELECTOR).forEach((el) => mountKdsOnCard(el));
}

export function initKdsSync() {
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
                    customerName="Cliente Teste"
                    customerPhone="(41) 99999-0000"
                />
            );
        };
        window.addEventListener("keydown", onKeyDown);
        console.log("[KDS] Hotkey Ctrl+Shift+K habilitado");
    }

    const obs = new MutationObserver((list) => {
        for (const mut of list) {
            mut.addedNodes.forEach((n) => {
                if (n.nodeType !== Node.ELEMENT_NODE) return;
                const el = n as Element;

                if (el.matches?.(PHONE_SELECTOR)) {
                    mountKdsOnCard(el as HTMLSpanElement);
                }
                el.querySelectorAll?.<HTMLSpanElement>(PHONE_SELECTOR).forEach((span) => {
                    mountKdsOnCard(span);
                });
            });
        }
    });

    obs.observe(document.body, { childList: true, subtree: true });
}

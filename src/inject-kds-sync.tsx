import React, { useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import ReactDOM from "react-dom/client";
import { fieldStyle, inputStyle, labelStyle, useOutsideClick } from "./common/inject-ui-common";
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

function normalizeMoney(value: string): number {
    const cleaned = (value || "")
        .replace(/\s/g, "")
        .replace(/\./g, "")
        .replace(",", ".");
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : 0;
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
    customerPhone
}: {
    commandNumber?: string;
    customerName?: string;
    customerPhone?: string;
}) {
    const [modalOpen, setModalOpen] = useState(false);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const ref = useRef<HTMLDivElement | null>(null);
    const [endpoint, setEndpoint] = useState(() => getStoredKdsConfig().endpoint);
    const [apiKey, setApiKey] = useState(() => getStoredKdsConfig().apiKey);
    const [zonesEndpoint, setZonesEndpoint] = useState(() => getStoredKdsConfig().zonesEndpoint);
    const [status, setStatus] = useState<"idle" | "sending" | "ok" | "error">("idle");
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [zones, setZones] = useState<DeliveryZone[]>([]);
    const [zonesLoading, setZonesLoading] = useState(false);
    const [zonesError, setZonesError] = useState<string | null>(null);

    const [rowId, setRowId] = useState("");
    const [commandValue, setCommandValue] = useState(commandNumber || "");
    const [orderAmount, setOrderAmount] = useState("");
    const [motoValue, setMotoValue] = useState("");
    const [hasMoto, setHasMoto] = useState(false);
    const [takeAway, setTakeAway] = useState(false);
    const [sizeF, setSizeF] = useState("0");
    const [sizeM, setSizeM] = useState("0");
    const [sizeP, setSizeP] = useState("0");
    const [sizeI, setSizeI] = useState("0");
    const [sizeFT, setSizeFT] = useState("0");
    const [channel, setChannel] = useState("CARDAPIO");
    const [deliveryZoneId, setDeliveryZoneId] = useState("");
    const [isCreditCard, setIsCreditCard] = useState(false);
    const [customerNameState, setCustomerNameState] = useState(customerName || "");
    const [customerPhoneState, setCustomerPhoneState] = useState(customerPhone || "");

    useOutsideClick(ref, () => {
        if (modalOpen) {
            setModalOpen(false);
            setSettingsOpen(false);
        }
    });

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

    const handleSync = async () => {
        setStatus("sending");
        setErrorMsg(null);
        try {
            const commandNumberNum = parseIntOrZero(commandValue);
            if (!commandNumberNum) throw new Error("Número da comanda inválido");

            const sizes: Record<string, number> = {};
            const sizesMap: Record<string, number> = {
                F: parseIntOrZero(sizeF),
                M: parseIntOrZero(sizeM),
                P: parseIntOrZero(sizeP),
                I: parseIntOrZero(sizeI),
                FT: parseIntOrZero(sizeFT)
            };
            Object.entries(sizesMap).forEach(([key, value]) => {
                if (value > 0) sizes[key] = value;
            });

            const payload: Record<string, unknown> = {
                date: new Date().toISOString().slice(0, 10),
                commandNumber: commandNumberNum
            };

            const orderAmountNum = normalizeMoney(orderAmount);
            const motoValueNum = normalizeMoney(motoValue);

            if (rowId) payload.id = rowId;
            if (orderAmountNum) payload.orderAmount = orderAmountNum;
            if (channel) payload.channel = channel;
            if (Object.keys(sizes).length) payload.sizes = sizes;
            if (hasMoto) payload.hasMoto = true;
            if (takeAway) payload.takeAway = true;
            if (motoValueNum) payload.motoValue = motoValueNum;
            if (hasMoto && deliveryZoneId) payload.deliveryZoneId = deliveryZoneId;
            if (isCreditCard) payload.isCreditCard = true;
            if (customerNameState) payload.customerName = customerNameState;
            if (customerPhoneState) payload.customerPhone = customerPhoneState;

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
        <div ref={ref} style={{ position: "relative" }}>
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

            {modalOpen && (
                <div
                    style={{
                        position: "fixed",
                        inset: 0,
                        background: "rgba(0,0,0,0.25)",
                        zIndex: 9999998
                    }}
                    onClick={() => {
                        setModalOpen(false);
                        setSettingsOpen(false);
                    }}
                >
                    <div
                        style={{
                            position: "absolute",
                            top: "20%",
                            left: "50%",
                            transform: "translateX(-50%)",
                            background: "#fff",
                            borderRadius: 10,
                            boxShadow: "0 12px 32px rgba(0,0,0,0.2)",
                            minWidth: 300,
                            padding: 12
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                            <div style={{ fontWeight: 700, fontSize: 14 }}>Pedido no KDS</div>
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

                        <div style={{ fontSize: 12, color: "#374151", marginBottom: 8 }}>
                            Pedido: <strong>{commandValue || "N/A"}</strong>
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
                            <div style={fieldStyle}>
                                <label style={labelStyle} htmlFor="kds-row-id">
                                    ID
                                </label>
                                <input
                                    id="kds-row-id"
                                    type="text"
                                    style={inputStyle}
                                    value={rowId}
                                    onChange={(e) => setRowId(e.target.value)}
                                    placeholder="ID da linha"
                                />
                            </div>
                            <div style={fieldStyle}>
                                <label style={labelStyle} htmlFor="kds-command">
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
                                <label style={labelStyle} htmlFor="kds-order-amount">
                                    Valor pedido
                                </label>
                                <input
                                    id="kds-order-amount"
                                    type="text"
                                    inputMode="decimal"
                                    style={inputStyle}
                                    value={orderAmount}
                                    onChange={(e) => setOrderAmount(e.target.value)}
                                    placeholder="0,00"
                                />
                            </div>
                            <div style={fieldStyle}>
                                <label style={labelStyle} htmlFor="kds-channel">
                                    Canal
                                </label>
                                <input
                                    id="kds-channel"
                                    type="text"
                                    style={inputStyle}
                                    value={channel}
                                    onChange={(e) => setChannel(e.target.value)}
                                    placeholder="CARDAPIO"
                                />
                            </div>
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 6, marginBottom: 10 }}>
                            <div style={fieldStyle}>
                                <label style={labelStyle} htmlFor="kds-size-f">
                                    F
                                </label>
                                <input
                                    id="kds-size-f"
                                    type="number"
                                    inputMode="numeric"
                                    style={inputStyle}
                                    value={sizeF}
                                    onChange={(e) => setSizeF(e.target.value)}
                                />
                            </div>
                            <div style={fieldStyle}>
                                <label style={labelStyle} htmlFor="kds-size-m">
                                    M
                                </label>
                                <input
                                    id="kds-size-m"
                                    type="number"
                                    inputMode="numeric"
                                    style={inputStyle}
                                    value={sizeM}
                                    onChange={(e) => setSizeM(e.target.value)}
                                />
                            </div>
                            <div style={fieldStyle}>
                                <label style={labelStyle} htmlFor="kds-size-p">
                                    P
                                </label>
                                <input
                                    id="kds-size-p"
                                    type="number"
                                    inputMode="numeric"
                                    style={inputStyle}
                                    value={sizeP}
                                    onChange={(e) => setSizeP(e.target.value)}
                                />
                            </div>
                            <div style={fieldStyle}>
                                <label style={labelStyle} htmlFor="kds-size-i">
                                    I
                                </label>
                                <input
                                    id="kds-size-i"
                                    type="number"
                                    inputMode="numeric"
                                    style={inputStyle}
                                    value={sizeI}
                                    onChange={(e) => setSizeI(e.target.value)}
                                />
                            </div>
                            <div style={fieldStyle}>
                                <label style={labelStyle} htmlFor="kds-size-ft">
                                    FT
                                </label>
                                <input
                                    id="kds-size-ft"
                                    type="number"
                                    inputMode="numeric"
                                    style={inputStyle}
                                    value={sizeFT}
                                    onChange={(e) => setSizeFT(e.target.value)}
                                />
                            </div>
                        </div>

                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
                                <input
                                    type="checkbox"
                                    checked={hasMoto}
                                    onChange={(e) => {
                                        const next = e.target.checked;
                                        setHasMoto(next);
                                        if (next) setTakeAway(false);
                                    }}
                                />
                                Delivery
                            </label>
                            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
                                <input
                                    type="checkbox"
                                    checked={takeAway}
                                    onChange={(e) => {
                                        const next = e.target.checked;
                                        setTakeAway(next);
                                        if (next) setHasMoto(false);
                                    }}
                                />
                                Retirada
                            </label>
                            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
                                <input
                                    type="checkbox"
                                    checked={isCreditCard}
                                    onChange={(e) => setIsCreditCard(e.target.checked)}
                                />
                                Cartão
                            </label>
                        </div>

                        {hasMoto && (
                            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 8, marginBottom: 10 }}>
                                <div style={fieldStyle}>
                                    <label style={labelStyle} htmlFor="kds-zone">
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
                                    <label style={labelStyle} htmlFor="kds-moto-value">
                                        Valor moto
                                    </label>
                                    <input
                                        id="kds-moto-value"
                                        type="text"
                                        inputMode="decimal"
                                        style={inputStyle}
                                        value={motoValue}
                                        onChange={(e) => setMotoValue(e.target.value)}
                                        placeholder="0,00"
                                    />
                                </div>
                            </div>
                        )}

                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
                            <div style={fieldStyle}>
                                <label style={labelStyle} htmlFor="kds-customer-name">
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
                                <label style={labelStyle} htmlFor="kds-customer-phone">
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
                                padding: "10px 12px",
                                borderRadius: 8,
                                borderWidth: 0,
                                background: "#10b981",
                                color: "#fff",
                                cursor: "pointer",
                                fontSize: 13,
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
                </div>
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

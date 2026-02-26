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
<<<<<<< Updated upstream
=======
const DETAIL_SAVE_BUTTON_SELECTOR = 'button[ng-click="vm.save();"]';
const DETAIL_MODAL_SELECTOR = ".modal-content";
const DETAIL_SYNC_MARK_ATTR = "data-amodomio-kds-detail-sync";

const commandContactByCard = new Map<string, { customerName: string; customerPhone: string }>();
>>>>>>> Stashed changes

const KDS_STORAGE_KEYS = {
    endpoint: "amodomio-kds-endpoint",
    apiKey: "amodomio-kds-api-key",
<<<<<<< Updated upstream
    zonesEndpoint: "amodomio-kds-zones-endpoint"
=======
    zonesEndpoint: "amodomio-kds-zones-endpoint",
    sizeKeyF: "amodomio-kds-size-key-f",
    sizeKeyM: "amodomio-kds-size-key-m",
    sizeKeyP: "amodomio-kds-size-key-p",
    sizeKeyI: "amodomio-kds-size-key-i",
    sizeKeyFT: "amodomio-kds-size-key-ft"
};

type KdsSizeIntegrationKeys = {
    sizeF: string;
    sizeM: string;
    sizeP: string;
    sizeI: string;
    sizeFT: string;
};

const DEFAULT_SIZE_KEYS: KdsSizeIntegrationKeys = {
    sizeF: "pizza-bigger",
    sizeM: "pizza-medium",
    sizeP: "pizza-small",
    sizeI: "pizza-individual",
    sizeFT: "pizza-slice"
>>>>>>> Stashed changes
};

function getStoredKdsConfig() {
    return {
        endpoint: readStorage(KDS_STORAGE_KEYS.endpoint),
        apiKey: readStorage(KDS_STORAGE_KEYS.apiKey),
<<<<<<< Updated upstream
        zonesEndpoint: readStorage(KDS_STORAGE_KEYS.zonesEndpoint)
    };
}

function saveStoredKdsConfig({ endpoint, apiKey, zonesEndpoint }: { endpoint: string; apiKey?: string; zonesEndpoint?: string }) {
    writeStorage(KDS_STORAGE_KEYS.endpoint, endpoint);
    writeStorage(KDS_STORAGE_KEYS.apiKey, apiKey || "");
    writeStorage(KDS_STORAGE_KEYS.zonesEndpoint, zonesEndpoint || "");
=======
        zonesEndpoint: readStorage(KDS_STORAGE_KEYS.zonesEndpoint),
        sizeKeys: {
            sizeF: readStorage(KDS_STORAGE_KEYS.sizeKeyF) || DEFAULT_SIZE_KEYS.sizeF,
            sizeM: readStorage(KDS_STORAGE_KEYS.sizeKeyM) || DEFAULT_SIZE_KEYS.sizeM,
            sizeP: readStorage(KDS_STORAGE_KEYS.sizeKeyP) || DEFAULT_SIZE_KEYS.sizeP,
            sizeI: readStorage(KDS_STORAGE_KEYS.sizeKeyI) || DEFAULT_SIZE_KEYS.sizeI,
            sizeFT: readStorage(KDS_STORAGE_KEYS.sizeKeyFT) || DEFAULT_SIZE_KEYS.sizeFT
        } as KdsSizeIntegrationKeys
    };
}

function saveStoredKdsConfig({
    endpoint,
    apiKey,
    zonesEndpoint,
    sizeKeys
}: {
    endpoint: string;
    apiKey?: string;
    zonesEndpoint?: string;
    sizeKeys?: Partial<KdsSizeIntegrationKeys>;
}) {
    writeStorage(KDS_STORAGE_KEYS.endpoint, endpoint);
    writeStorage(KDS_STORAGE_KEYS.apiKey, apiKey || "");
    writeStorage(KDS_STORAGE_KEYS.zonesEndpoint, zonesEndpoint || "");
    writeStorage(KDS_STORAGE_KEYS.sizeKeyF, sizeKeys?.sizeF || "");
    writeStorage(KDS_STORAGE_KEYS.sizeKeyM, sizeKeys?.sizeM || "");
    writeStorage(KDS_STORAGE_KEYS.sizeKeyP, sizeKeys?.sizeP || "");
    writeStorage(KDS_STORAGE_KEYS.sizeKeyI, sizeKeys?.sizeI || "");
    writeStorage(KDS_STORAGE_KEYS.sizeKeyFT, sizeKeys?.sizeFT || "");
>>>>>>> Stashed changes
}

async function sendKdsOrder(payload: Record<string, unknown>, config?: { endpoint: string; apiKey?: string }) {
    const endpoint = config?.endpoint?.trim() || getStoredKdsConfig().endpoint;
    const apiKey = config?.apiKey?.trim() || getStoredKdsConfig().apiKey;

    if (!endpoint) throw new Error("Configure o endpoint do KDS");

    const runtime = typeof chrome !== "undefined" && chrome?.runtime ? chrome.runtime : null;
    if (!runtime) throw new Error("chrome.runtime indisponível");

<<<<<<< Updated upstream
    return new Promise<{ ok: boolean }>((resolve, reject) => {
=======
    return new Promise<{ ok: boolean; data?: unknown }>((resolve, reject) => {
>>>>>>> Stashed changes
        runtime.sendMessage(
            {
                type: "KDS_ORDER",
                endpoint,
                apiKey,
                payload
            },
<<<<<<< Updated upstream
            (response: { error?: string }) => {
=======
            (response: { error?: string; data?: unknown }) => {
>>>>>>> Stashed changes
                const lastErr = runtime?.lastError;
                if (lastErr) {
                    reject(new Error(lastErr.message));
                    return;
                }
                if (response?.error) {
                    reject(new Error(response.error));
                    return;
                }
<<<<<<< Updated upstream
                resolve({ ok: true });
=======
                resolve({ ok: true, data: response?.data });
>>>>>>> Stashed changes
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

<<<<<<< Updated upstream
=======
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
    if (normalized.includes("fatia") || normalized.includes("slice") || normalized.includes("taglio")) return "sizeFT";
    if (normalized.includes("individual")) return "sizeI";
    if (normalized.includes("pequena") || normalized.includes("small")) return "sizeP";
    if (normalized.includes("media") || normalized.includes("medium")) return "sizeM";
    if (normalized.includes("familia") || normalized.includes("grande") || normalized.includes("big")) return "sizeF";
    return null;
}

function sizeCodeFromBucket(bucket: "sizeF" | "sizeM" | "sizeP" | "sizeI" | "sizeFT"): "F" | "M" | "P" | "I" | "FT" {
    if (bucket === "sizeF") return "F";
    if (bucket === "sizeM") return "M";
    if (bucket === "sizeP") return "P";
    if (bucket === "sizeI") return "I";
    return "FT";
}

function buildPizzasPayload(
    items: DetailExtractedItem[],
    sizeKeys: KdsSizeIntegrationKeys
): Array<{
    sizeBucket: "sizeF" | "sizeM" | "sizeP" | "sizeI" | "sizeFT";
    sizeCode: "F" | "M" | "P" | "I" | "FT";
    sizeIntegrationKey: string;
    quantity: number;
    itemName: string;
    flavors: Array<{ name: string }>;
}> {
    return items
        .map((item) => {
            const bucket = inferSizeBucket(item.itemName);
            if (!bucket) return null;
            return {
                sizeBucket: bucket,
                sizeCode: sizeCodeFromBucket(bucket),
                sizeIntegrationKey: sizeKeys[bucket] || "",
                quantity: item.qty,
                itemName: item.itemName,
                flavors: item.flavors.map((name) => ({ name }))
            };
        })
        .filter(
            (
                item
            ): item is {
                sizeBucket: "sizeF" | "sizeM" | "sizeP" | "sizeI" | "sizeFT";
                sizeCode: "F" | "M" | "P" | "I" | "FT";
                sizeIntegrationKey: string;
                quantity: number;
                itemName: string;
                flavors: Array<{ name: string }>;
            } => item !== null
        );
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

>>>>>>> Stashed changes
export function KdsSyncButton({
    commandNumber,
    customerName,
    customerPhone,
    initialOrderAmountCents,
<<<<<<< Updated upstream
    openOnMount
=======
    openOnMount,
    quickCardSyncOnly,
    buttonLabel,
    getDetailDraftOnOpen
>>>>>>> Stashed changes
}: {
    commandNumber?: string;
    customerName?: string;
    customerPhone?: string;
    initialOrderAmountCents?: number;
    openOnMount?: boolean;
<<<<<<< Updated upstream
=======
    quickCardSyncOnly?: boolean;
    buttonLabel?: string;
    getDetailDraftOnOpen?: () => KdsDetailDraft;
>>>>>>> Stashed changes
}) {
    const [modalOpen, setModalOpen] = useState(false);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [endpoint, setEndpoint] = useState(() => getStoredKdsConfig().endpoint);
    const [apiKey, setApiKey] = useState(() => getStoredKdsConfig().apiKey);
    const [zonesEndpoint, setZonesEndpoint] = useState(() => getStoredKdsConfig().zonesEndpoint);
<<<<<<< Updated upstream
=======
    const [sizeKeyF, setSizeKeyF] = useState(() => getStoredKdsConfig().sizeKeys.sizeF);
    const [sizeKeyM, setSizeKeyM] = useState(() => getStoredKdsConfig().sizeKeys.sizeM);
    const [sizeKeyP, setSizeKeyP] = useState(() => getStoredKdsConfig().sizeKeys.sizeP);
    const [sizeKeyI, setSizeKeyI] = useState(() => getStoredKdsConfig().sizeKeys.sizeI);
    const [sizeKeyFT, setSizeKeyFT] = useState(() => getStoredKdsConfig().sizeKeys.sizeFT);
>>>>>>> Stashed changes
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
<<<<<<< Updated upstream
=======
    const [capturedItems, setCapturedItems] = useState<DetailExtractedItem[]>([]);

    const sizeKeys: KdsSizeIntegrationKeys = {
        sizeF: sizeKeyF.trim(),
        sizeM: sizeKeyM.trim(),
        sizeP: sizeKeyP.trim(),
        sizeI: sizeKeyI.trim(),
        sizeFT: sizeKeyFT.trim()
    };
>>>>>>> Stashed changes

    useEffect(() => {
        if (openOnMount) setModalOpen(true);
    }, [openOnMount]);

    useEffect(() => {
        if (!modalOpen) return;
<<<<<<< Updated upstream
        setCommandValue(commandNumber || "");
        setOrderAmountCents(Math.max(0, initialOrderAmountCents || 0));
        setCustomerNameState(customerName || "");
        setCustomerPhoneState(customerPhone || "");
        setErrorMsg(null);
=======
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
>>>>>>> Stashed changes
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
<<<<<<< Updated upstream
    }, [modalOpen, commandNumber, initialOrderAmountCents, customerName, customerPhone, endpoint, apiKey, zonesEndpoint]);
=======
    }, [modalOpen, commandNumber, initialOrderAmountCents, customerName, customerPhone, endpoint, apiKey, zonesEndpoint, getDetailDraftOnOpen]);
>>>>>>> Stashed changes

    const btnStyle: React.CSSProperties = {
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 28,
        height: 28,
        borderRadius: 6,
<<<<<<< Updated upstream
        background: "#059669",
=======
        background: status === "ok" ? "#047857" : status === "error" ? "#b91c1c" : "#059669",
>>>>>>> Stashed changes
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
<<<<<<< Updated upstream
        saveStoredKdsConfig({ endpoint, apiKey, zonesEndpoint });
=======
        saveStoredKdsConfig({ endpoint, apiKey, zonesEndpoint, sizeKeys });
>>>>>>> Stashed changes
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
<<<<<<< Updated upstream
                customerPhone: customerPhoneState || ""
            };
=======
                customerPhone: customerPhoneState || "",
                sizeIntegrationKeys: sizeKeys
            };
            if (capturedItems.length) {
                payload.items = capturedItems;
                payload.pizzas = buildPizzasPayload(capturedItems, sizeKeys);
            }
>>>>>>> Stashed changes

            await sendKdsOrder(payload, { endpoint, apiKey });
            setStatus("ok");
            setTimeout(() => setStatus("idle"), 1200);
        } catch (err) {
            setStatus("error");
            setErrorMsg(err instanceof Error ? err.message : "Falha ao sincronizar");
            setTimeout(() => setStatus("idle"), 1500);
        }
    };

<<<<<<< Updated upstream
=======
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

>>>>>>> Stashed changes
    return (
        <div style={{ position: "relative" }}>
            <button
                type="button"
<<<<<<< Updated upstream
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
=======
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
>>>>>>> Stashed changes
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
<<<<<<< Updated upstream
=======
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
>>>>>>> Stashed changes

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
<<<<<<< Updated upstream
=======
                                <div style={{ fontWeight: 600, fontSize: 12, margin: "8px 0 4px" }}>Chaves integração tamanhos pizza</div>
                                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
                                    <div style={fieldStyle}>
                                        <label style={labelStyle} htmlFor="kds-size-key-f">
                                            Tamanho F
                                        </label>
                                        <input
                                            id="kds-size-key-f"
                                            type="text"
                                            style={inputStyle}
                                            value={sizeKeyF}
                                            onChange={(e) => setSizeKeyF(e.target.value)}
                                            placeholder="ex: TAM_FAMILIA"
                                        />
                                    </div>
                                    <div style={fieldStyle}>
                                        <label style={labelStyle} htmlFor="kds-size-key-m">
                                            Tamanho M
                                        </label>
                                        <input
                                            id="kds-size-key-m"
                                            type="text"
                                            style={inputStyle}
                                            value={sizeKeyM}
                                            onChange={(e) => setSizeKeyM(e.target.value)}
                                            placeholder="ex: TAM_MEDIA"
                                        />
                                    </div>
                                    <div style={fieldStyle}>
                                        <label style={labelStyle} htmlFor="kds-size-key-p">
                                            Tamanho P
                                        </label>
                                        <input
                                            id="kds-size-key-p"
                                            type="text"
                                            style={inputStyle}
                                            value={sizeKeyP}
                                            onChange={(e) => setSizeKeyP(e.target.value)}
                                            placeholder="ex: TAM_PEQUENA"
                                        />
                                    </div>
                                    <div style={fieldStyle}>
                                        <label style={labelStyle} htmlFor="kds-size-key-i">
                                            Tamanho I
                                        </label>
                                        <input
                                            id="kds-size-key-i"
                                            type="text"
                                            style={inputStyle}
                                            value={sizeKeyI}
                                            onChange={(e) => setSizeKeyI(e.target.value)}
                                            placeholder="ex: TAM_INDIVIDUAL"
                                        />
                                    </div>
                                    <div style={fieldStyle}>
                                        <label style={labelStyle} htmlFor="kds-size-key-ft">
                                            Tamanho FT
                                        </label>
                                        <input
                                            id="kds-size-key-ft"
                                            type="text"
                                            style={inputStyle}
                                            value={sizeKeyFT}
                                            onChange={(e) => setSizeKeyFT(e.target.value)}
                                            placeholder="ex: TAM_FATIA"
                                        />
                                    </div>
                                </div>
>>>>>>> Stashed changes
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

<<<<<<< Updated upstream
=======
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

>>>>>>> Stashed changes
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
<<<<<<< Updated upstream
=======
    if (commandNumber) {
        commandContactByCard.set(commandNumber, { customerName, customerPhone });
    }

>>>>>>> Stashed changes
    ReactDOM.createRoot(kdsMount).render(
        <KdsSyncButton
            commandNumber={commandNumber}
            customerName={customerName}
            customerPhone={customerPhone}
            initialOrderAmountCents={initialOrderAmountCents}
<<<<<<< Updated upstream
=======
            quickCardSyncOnly
>>>>>>> Stashed changes
        />
    );
    wrapper.setAttribute(KDS_MARK_ATTR, "1");
}

function scanAll() {
    document.querySelectorAll<HTMLSpanElement>(PHONE_SELECTOR).forEach((el) => mountKdsOnCard(el));
<<<<<<< Updated upstream
=======
    document.querySelectorAll<HTMLButtonElement>(DETAIL_SAVE_BUTTON_SELECTOR).forEach((btn) => mountKdsOnDetailSaveButton(btn));
>>>>>>> Stashed changes
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
        for (const mut of list) {
            mut.addedNodes.forEach((n) => {
                if (n.nodeType !== Node.ELEMENT_NODE) return;
                const el = n as Element;

                if (el.matches?.(PHONE_SELECTOR)) {
                    mountKdsOnCard(el as HTMLSpanElement);
                }
<<<<<<< Updated upstream
                el.querySelectorAll?.<HTMLSpanElement>(PHONE_SELECTOR).forEach((span) => {
                    mountKdsOnCard(span);
                });
=======
                if (el.matches?.(DETAIL_SAVE_BUTTON_SELECTOR)) {
                    mountKdsOnDetailSaveButton(el as HTMLButtonElement);
                }
                el.querySelectorAll?.<HTMLSpanElement>(PHONE_SELECTOR).forEach((span) => {
                    mountKdsOnCard(span);
                });
                el.querySelectorAll?.<HTMLButtonElement>(DETAIL_SAVE_BUTTON_SELECTOR).forEach((btn) => {
                    mountKdsOnDetailSaveButton(btn);
                });
>>>>>>> Stashed changes
            });
        }
    });

    obs.observe(document.body, { childList: true, subtree: true });
}

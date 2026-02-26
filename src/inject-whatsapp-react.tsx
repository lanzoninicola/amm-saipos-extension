// inject-whatsapp-react.tsx
import { MessageSquarePlus, Settings } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom/client";
import { baseMenuStyle, fieldStyle, inputStyle, labelStyle, useOutsideClick } from "./common/inject-ui-common";
import { readStorage, writeStorage } from "./common/storage";

declare const chrome: any;

/** Seletores do DOM renderizado */
const PHONE_SELECTOR = 'span[data-qa="sale-customer-phone"]';
const SALES_SELECTOR = 'small[data-qa="sale-customer-store-sales_count"]';
const NAME_SELECTOR = 'span[data-qa="sale-name"]';

/** Evita montar duas vezes no mesmo span de telefone */
const MARK_ATTR = "data-amodomio-wapp";

/** ====== CONFIGURÁVEL: modelos de respostas rápidas ====== */
const QUICK_REPLIES: string[] = [
    "Posso colocar sua pizza no forno?",
    "O motoboy já saiu para entrega.",
    "Muito obrigado pelo pedido!\n\nAmou a pizza? Deixe sua opinião no Google, sua avaliação em 2 min faz toda a diferença! 🙌\n\n👉 https://g.page/r/CceZSxdctFZHEAE/review"
];

const STORAGE_KEYS = {
    endpoint: "amodomio-zapi-endpoint",
    apiKey: "amodomio-zapi-api-key",
    operator: "amodomio-zapi-operator"
};
const DEFAULT_ZAPI_ENDPOINT = "https://amodomio.com.br/api/messages/text";

type FeedbackKind = "info" | "success" | "error";
type CardFeedback = {
    kind: FeedbackKind;
    message: string;
    autoHideMs?: number;
};

type CardFeedbackController = {
    show: (feedback: CardFeedback) => void;
    clear: () => void;
};

/** Normaliza para E.164 (Brasil por padrão) */
function toE164(text: string): string {
    let digits = (text || "").replace(/\D/g, "");
    if (!digits) return "";
    if (!digits.startsWith("55")) digits = "55" + digits;
    return digits;
}

function getStoredConfig() {
    return {
        endpoint: readStorage(STORAGE_KEYS.endpoint) || DEFAULT_ZAPI_ENDPOINT,
        apiKey: readStorage(STORAGE_KEYS.apiKey),
        operator: readStorage(STORAGE_KEYS.operator)
    };
}

function saveStoredConfig({ endpoint, apiKey, operator }: { endpoint: string; apiKey: string; operator?: string }) {
    writeStorage(STORAGE_KEYS.endpoint, endpoint);
    writeStorage(STORAGE_KEYS.apiKey, apiKey);
    writeStorage(STORAGE_KEYS.operator, operator || "");
}

async function sendViaBackground(
    phone: string,
    message: string,
    config?: { endpoint: string; apiKey: string }
) {
    const e164 = toE164(phone);
    if (!e164) throw new Error("Telefone inválido para envio");

    const endpoint = config?.endpoint?.trim() || getStoredConfig().endpoint;
    const apiKey = config?.apiKey?.trim() || getStoredConfig().apiKey;

    if (!endpoint || !apiKey) throw new Error("Configure endpoint e API key");

    const runtime = typeof chrome !== "undefined" && chrome?.runtime ? chrome.runtime : null;
    if (!runtime) throw new Error("chrome.runtime indisponível");

    return new Promise<{ ok: boolean }>((resolve, reject) => {
        runtime.sendMessage(
            {
                type: "ZAPI_SEND_TEXT",
                endpoint,
                apiKey,
                phone: e164,
                message
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

/** Botão + dropdown de Respostas Rápidas */
function QuickReplies({
    phone,
    customerName,
    onCardFeedback
}: {
    phone: string;
    customerName?: string;
    onCardFeedback?: (feedback: CardFeedback) => void;
}) {
    const [menu, setMenu] = useState<"quick" | "settings" | null>(null);
    const ref = useRef<HTMLDivElement | null>(null);
    const [endpoint, setEndpoint] = useState(() => getStoredConfig().endpoint);
    const [apiKey, setApiKey] = useState(() => getStoredConfig().apiKey);
    const [operator, setOperator] = useState(() => getStoredConfig().operator);
    const [status, setStatus] = useState<"idle" | "sending" | "ok" | "error">("idle");
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [nameState, setNameState] = useState(() => (customerName || "").trim());
    const errorTimerRef = useRef<number | null>(null);

    useOutsideClick(ref, () => setMenu(null));

    useEffect(() => {
        if (customerName && customerName.trim()) {
            setNameState(customerName.trim());
        }
    }, [customerName]);

    useEffect(() => {
        return () => {
            if (errorTimerRef.current) {
                window.clearTimeout(errorTimerRef.current);
            }
        };
    }, []);

    const btnStyle: React.CSSProperties = {
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 28,
        height: 28,
        borderRadius: 6,
        background: "#6b7280", // cinza neutro
        color: "#fff",
        flex: "0 0 auto",
        cursor: "pointer",
        borderWidth: "0px"
    };

    const menuStyle: React.CSSProperties = { ...baseMenuStyle, minWidth: "240px" };

    const itemStyle: React.CSSProperties = {
        padding: "8px 10px",
        borderRadius: 6,
        cursor: "pointer",
        fontSize: 12,
        lineHeight: "16px",
        userSelect: "none" as const
    };

    const saveButtonStyle: React.CSSProperties = {
        marginTop: 8,
        width: "100%",
        padding: "8px 10px",
        borderRadius: 6,
        borderWidth: 0,
        background: "#2563eb",
        color: "#fff",
        cursor: "pointer",
        fontSize: 12,
        fontWeight: 600 as const
    };

    const badgeStyle: React.CSSProperties = {
        marginLeft: 6,
        fontSize: 11,
        color: status === "ok" ? "#16a34a" : status === "error" ? "#dc2626" : "#6b7280"
    };

    const buildMessage = (text: string) => {
        const name = nameState;
        const boldName = name ? `*${name}*` : "";
        const greeting = boldName ? `Olá ${boldName}, ` : "Olá, ";
        const operatorPrefix = operator.trim() ? `*${operator.trim()} disse:*\n\n` : "";
        return `${operatorPrefix}${greeting}${text}`;
    };

    const publishCardFeedback = (feedback: CardFeedback) => {
        onCardFeedback?.(feedback);
    };

    const showTransientError = (message: string, ms = 8000) => {
        setErrorMsg(message);
        if (errorTimerRef.current) {
            window.clearTimeout(errorTimerRef.current);
        }
        errorTimerRef.current = window.setTimeout(() => {
            setErrorMsg(null);
            errorTimerRef.current = null;
        }, ms);
    };

    const handleSend = async (text: string) => {
        setStatus("sending");
        setErrorMsg(null);
        publishCardFeedback({ kind: "info", message: "Enviando mensagem via Z-API..." });
        try {
            const finalMsg = buildMessage(text);
            await sendViaBackground(phone, finalMsg, { endpoint, apiKey });
            setStatus("ok");
            publishCardFeedback({ kind: "success", message: "Mensagem enviada com sucesso.", autoHideMs: 7000 });
            setTimeout(() => setStatus("idle"), 1200);
        } catch (err) {
            const msg = err instanceof Error ? err.message : "Falha ao enviar";
            setStatus("error");
            showTransientError(msg);
            publishCardFeedback({ kind: "error", message: `Falha no envio: ${msg}`, autoHideMs: 10000 });
            setTimeout(() => setStatus("idle"), 1500);
        } finally {
            setMenu(null);
        }
    };

    const handleSave = () => {
        if (!endpoint.trim() || !apiKey.trim()) {
            const msg = "Configure endpoint e API key";
            showTransientError(msg);
            publishCardFeedback({ kind: "error", message: msg, autoHideMs: 8000 });
            return;
        }
        saveStoredConfig({ endpoint, apiKey, operator });
        setErrorMsg(null);
        publishCardFeedback({ kind: "success", message: "Configuração Z-API salva.", autoHideMs: 5000 });
        setMenu(null);
    };

    return (
        <div ref={ref} style={{ position: "relative", display: "flex", alignItems: "center", gap: "6px" }}>
            <button
                type="button"
                title="Respostas rápidas"
                style={btnStyle}
                onClick={(e) => {
                    e.stopPropagation();
                    setMenu((prev) => (prev === "quick" ? null : "quick"));
                }}
            >
                <MessageSquarePlus size={16} />
            </button>

            <button
                type="button"
                title="Configurar endpoint e API key"
                style={{ ...btnStyle, background: "#374151" }}
                onClick={(e) => {
                    e.stopPropagation();
                    setMenu((prev) => (prev === "settings" ? null : "settings"));
                }}
            >
                <Settings size={16} />
            </button>

            {menu === "quick" && (
                <div style={menuStyle} onClick={(e) => e.stopPropagation()}>
                    {QUICK_REPLIES.map((text, i) => (
                        <div
                            key={i}
                            style={itemStyle}
                            onMouseEnter={(e) => ((e.currentTarget.style.background = "rgba(0,0,0,0.05)"))}
                            onMouseLeave={(e) => ((e.currentTarget.style.background = "transparent"))}
                            onClick={() => {
                                handleSend(text);
                            }}
                        >
                            {text}
                        </div>
                    ))}
                    <div style={{ ...itemStyle, cursor: "default", background: "rgba(0,0,0,0.02)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <span style={{ color: "#4b5563" }}>
                            {status === "sending" && "Enviando..."}
                            {status === "ok" && "Enviado"}
                            {status === "error" && (errorMsg || "Erro ao enviar")}
                            {status === "idle" && "Z-API"}
                        </span>
                        <span style={badgeStyle}>{status === "idle" ? "" : status.toUpperCase()}</span>
                    </div>
                </div>
            )}

            {menu === "settings" && (
                <div style={{ ...menuStyle, minWidth: "280px" }} onClick={(e) => e.stopPropagation()}>
                    <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 6 }}>Config Z-API</div>
                    <div style={fieldStyle}>
                        <label style={labelStyle} htmlFor="zapi-endpoint">
                            Endpoint
                        </label>
                        <input
                            id="zapi-endpoint"
                            type="text"
                            style={inputStyle}
                            value={endpoint}
                            onChange={(e) => setEndpoint(e.target.value)}
                            className="placeholder:text-muted-foreground"
                            placeholder={DEFAULT_ZAPI_ENDPOINT}
                        />
                    </div>
                    <div style={fieldStyle}>
                        <label style={labelStyle} htmlFor="zapi-apikey">
                            API key
                        </label>
                        <input
                            id="zapi-apikey"
                            type="text"
                            style={inputStyle}
                            value={apiKey}
                            onChange={(e) => setApiKey(e.target.value)}
                            className="placeholder:text-muted-foreground"
                            placeholder="api-key"
                        />
                    </div>
                    <div style={fieldStyle}>
                        <label style={labelStyle} htmlFor="zapi-operator">
                            Nome do operador (opcional)
                        </label>
                        <input
                            id="zapi-operator"
                            type="text"
                            style={inputStyle}
                            value={operator}
                            onChange={(e) => setOperator(e.target.value)}
                            className="placeholder:text-muted-foreground"
                            placeholder="Fulano"
                        />
                    </div>
                    <button type="button" style={saveButtonStyle} onClick={handleSave}>
                        Salvar
                    </button>
                    {errorMsg && (
                        <div
                            style={{
                                color: "#b91c1c",
                                fontSize: 12,
                                marginTop: 6,
                                display: "flex",
                                alignItems: "flex-start",
                                justifyContent: "space-between",
                                gap: 8
                            }}
                        >
                            <span style={{ flex: "1 1 auto" }}>{errorMsg}</span>
                            <button
                                type="button"
                                title="Fechar mensagem"
                                onClick={() => setErrorMsg(null)}
                                style={{
                                    border: 0,
                                    background: "transparent",
                                    color: "inherit",
                                    cursor: "pointer",
                                    padding: 0,
                                    lineHeight: 1,
                                    fontSize: 16,
                                    fontWeight: 700
                                }}
                            >
                                ×
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

/** Monta wrapper com botões (esq) e coluna (dir) contendo telefone e pedidos */
function mountOnCard(phoneEl: HTMLSpanElement) {
    if (phoneEl.hasAttribute(MARK_ATTR)) return;

    const phoneText = phoneEl.textContent?.trim() || "";
    if (!phoneText) return;

    // tenta achar o "(X pedidos)"
    let salesEl: HTMLElement | null =
        (phoneEl.nextElementSibling as HTMLElement | null)?.matches?.(SALES_SELECTOR)
            ? (phoneEl.nextElementSibling as HTMLElement)
            : null;

    if (!salesEl && phoneEl.parentElement) {
        salesEl = phoneEl.parentElement.querySelector(SALES_SELECTOR);
    }

    // tenta achar nome do cliente em ancestrais
    let nameText = "";
    let cursor: HTMLElement | null = phoneEl;
    while (cursor && cursor !== document.body) {
        const found = cursor.querySelector<HTMLSpanElement>(NAME_SELECTOR);
        if (found?.textContent?.trim()) {
            nameText = found.textContent.trim();
            break;
        }
        cursor = cursor.parentElement;
    }


    const parent = phoneEl.parentElement;
    if (!parent) return;
    const cardListItem = phoneEl.closest("li.kanban-sale") as HTMLElement | null;

    let bannerEl: HTMLDivElement | null = null;
    let bannerTextEl: HTMLDivElement | null = null;
    let bannerCloseEl: HTMLButtonElement | null = null;
    let bannerHideTimer: number | null = null;
    const ensureBanner = () => {
        if (bannerEl) return bannerEl;
        if (!cardListItem) return null;
        const existing = cardListItem.querySelector<HTMLDivElement>(".amodomio-zapi-feedback-banner");
        if (existing) {
            bannerEl = existing;
            return bannerEl;
        }
        bannerEl = document.createElement("div");
        bannerEl.className = "amodomio-zapi-feedback-banner";
        Object.assign(bannerEl.style, {
            display: "none",
            marginTop: "6px",
            padding: "8px 10px",
            borderRadius: "8px",
            fontSize: "12px",
            lineHeight: "1.35",
            border: "1px solid rgba(0,0,0,0.12)",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: "8px"
        } as CSSStyleDeclaration);

        bannerTextEl = document.createElement("div");
        Object.assign(bannerTextEl.style, {
            flex: "1 1 auto",
            minWidth: "0"
        } as CSSStyleDeclaration);

        bannerCloseEl = document.createElement("button");
        bannerCloseEl.type = "button";
        bannerCloseEl.textContent = "×";
        bannerCloseEl.title = "Fechar";
        Object.assign(bannerCloseEl.style, {
            flex: "0 0 auto",
            border: "0",
            background: "transparent",
            color: "inherit",
            cursor: "pointer",
            padding: "0 2px",
            lineHeight: "1",
            fontSize: "16px",
            fontWeight: "700"
        } as CSSStyleDeclaration);
        bannerCloseEl.onclick = (e) => {
            e.stopPropagation();
            if (bannerHideTimer) {
                window.clearTimeout(bannerHideTimer);
                bannerHideTimer = null;
            }
            if (bannerEl) bannerEl.style.display = "none";
        };

        bannerEl.appendChild(bannerTextEl);
        bannerEl.appendChild(bannerCloseEl);

        const cardNode = cardListItem.querySelector("sale-delivery-kanban-card");
        if (cardNode?.parentElement) {
            cardNode.parentElement.insertBefore(bannerEl, cardNode.nextSibling);
        } else {
            cardListItem.appendChild(bannerEl);
        }
        return bannerEl;
    };

    const setCardFeedback = ({ kind, message, autoHideMs }: CardFeedback) => {
        const el = ensureBanner();
        if (!el) return;
        if (bannerHideTimer) {
            window.clearTimeout(bannerHideTimer);
            bannerHideTimer = null;
        }

        const palette =
            kind === "success"
                ? { bg: "#ecfdf5", text: "#065f46", border: "rgba(16,185,129,0.35)" }
                : kind === "error"
                    ? { bg: "#fef2f2", text: "#991b1b", border: "rgba(239,68,68,0.35)" }
                    : { bg: "#eff6ff", text: "#1e3a8a", border: "rgba(59,130,246,0.35)" };

        if (bannerTextEl) {
            bannerTextEl.textContent = message;
        }
        el.style.display = "flex";
        el.style.background = palette.bg;
        el.style.color = palette.text;
        el.style.borderColor = palette.border;

        if (autoHideMs && autoHideMs > 0) {
            bannerHideTimer = window.setTimeout(() => {
                if (!bannerEl) return;
                bannerEl.style.display = "none";
            }, autoHideMs);
        }
    };
    const clearCardFeedback = () => {
        if (bannerHideTimer) {
            window.clearTimeout(bannerHideTimer);
            bannerHideTimer = null;
        }
        if (bannerEl) {
            bannerEl.style.display = "none";
        }
    };
    const cardFeedbackController: CardFeedbackController = {
        show: setCardFeedback,
        clear: clearCardFeedback
    };

    // wrapper horizontal
    const wrapper = document.createElement("div");
    wrapper.className = "amodomio-wapp-wrapper";
    Object.assign(wrapper.style, {
        display: "flex",
        alignItems: "center",
        gap: "4px"
    } as CSSStyleDeclaration);

    // coluna telefone + pedidos
    const col = document.createElement("div");
    col.className = "amodomio-wapp-col";
    Object.assign(col.style, {
        display: "flex",
        flexDirection: "column",
        lineHeight: "1.2",
        gap: "4px"
    } as CSSStyleDeclaration);

    // insere wrapper antes do telefone (telefone será movido para a coluna)
    parent.insertBefore(wrapper, phoneEl);


    const qrMount = document.createElement("div");
    wrapper.appendChild(qrMount);
    ReactDOM.createRoot(qrMount).render(
        <QuickReplies phone={phoneText} customerName={nameText} onCardFeedback={cardFeedbackController.show} />
    );

    // coluna com telefone + (opcional) sales
    wrapper.appendChild(col);
    col.appendChild(phoneEl);
    if (salesEl) col.appendChild(salesEl);

    phoneEl.setAttribute(MARK_ATTR, "1");
}

/** Varre o DOM atual e monta onde faltar */
function scanAll() {
    document.querySelectorAll<HTMLSpanElement>(PHONE_SELECTOR).forEach((el) => mountOnCard(el));
}

/** Observa o DOM (Angular) e monta quando aparecer */
export function initWhatsAppButtonsReact() {
    scanAll();

    const obs = new MutationObserver((list) => {
        for (const mut of list) {
            mut.addedNodes.forEach((n) => {
                if (n.nodeType !== Node.ELEMENT_NODE) return;
                const el = n as Element;

                if (el.matches?.(PHONE_SELECTOR)) {
                    mountOnCard(el as HTMLSpanElement);
                }
                el.querySelectorAll?.<HTMLSpanElement>(PHONE_SELECTOR).forEach((span) => {
                    mountOnCard(span);
                });
            });
        }
    });

    obs.observe(document.body, { childList: true, subtree: true });
}

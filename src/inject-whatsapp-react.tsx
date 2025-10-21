// inject-whatsapp-react.tsx
import { MessageCircle, Copy, MessageSquarePlus, Check } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom/client";

/** Seletores do DOM renderizado */
const PHONE_SELECTOR = 'span[data-qa="sale-customer-phone"]';
const SALES_SELECTOR = 'small[data-qa="sale-customer-store-sales_count"]';

/** Evita montar duas vezes no mesmo span de telefone */
const MARK_ATTR = "data-amodomio-wapp";

/** ====== CONFIGURÁVEL: modelos de respostas rápidas ====== */
const QUICK_REPLIES: string[] = [
    "Posso colocar sua pizza no forno?",
    "O motoboy já saiu para entrega.",
    "Obrigado pela preferência! 🙏 Qualquer dúvida é só chamar."
];

/** Normaliza para E.164 (Brasil por padrão) */
function toE164(text: string): string {
    let digits = (text || "").replace(/\D/g, "");
    if (!digits) return "";
    if (!digits.startsWith("55")) digits = "55" + digits;
    return digits;
}

/** Util: abre WhatsApp Web com texto pré-preenchido */
function openWhatsApp(phoneText: string, message?: string) {
    const e164 = toE164(phoneText);
    if (!e164) return;
    const base = "https://web.whatsapp.com/send";
    const params = new URLSearchParams({ phone: e164 });
    if (message && message.trim()) params.set("text", message);
    const url = `${base}?${params.toString()}`;
    window.open(url, "_blank", "noopener");
}

/** Botão WhatsApp (ícone) */
function WhatsAppIconButton({ phone }: { phone: string }) {
    const e164 = toE164(phone);
    if (!e164) return null;

    const btnStyle: React.CSSProperties = {
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 28,
        height: 28,
        borderRadius: 6,
        background: "#25D366",
        color: "#fff",
        flex: "0 0 auto",
        borderWidth: "0px"
    };

    return (
        <button
            type="button"
            title="Abrir no WhatsApp Web"
            onClick={() => openWhatsApp(phone)}
            style={btnStyle}
        >
            <MessageCircle size={18} />
        </button>
    );
}

/** Botão de copiar número */
function CopyPhoneButton({ phone }: { phone: string }) {
    const e164 = toE164(phone);
    if (!e164) return null;

    const [ok, setOk] = useState(false);

    const btnStyle: React.CSSProperties = {
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 28,
        height: 28,
        borderRadius: 6,
        background: "#0055ff",
        color: "#fff",
        flex: "0 0 auto",
        cursor: "pointer",
        borderWidth: 0
    };

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(e164);
            setOk(true);
            setTimeout(() => setOk(false), 1200);
        } catch {
            setOk(false);
        }
    };

    return (
        <button type="button" onClick={handleCopy} title="Copiar número de telefone" style={btnStyle}>
            {ok ? <Check size={16} /> : <Copy size={16} />}
        </button>
    );
}

/** Botão + dropdown de Respostas Rápidas */
function QuickReplies({ phone }: { phone: string }) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        const onClickOutside = (e: MouseEvent) => {
            if (!ref.current) return;
            if (e.target instanceof Node && !ref.current.contains(e.target)) {
                setOpen(false);
            }
        };
        document.addEventListener("click", onClickOutside);
        return () => document.removeEventListener("click", onClickOutside);
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
        position: "relative",
        borderWidth: "0px"
    };

    const menuStyle: React.CSSProperties = {
        position: "absolute",
        top: "36px",
        left: 0,
        background: "#fff",
        color: "#111",
        border: "1px solid rgba(0,0,0,0.12)",
        borderRadius: 8,
        boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
        minWidth: "240px",
        zIndex: 9999999,
        padding: "6px"
    };

    const itemStyle: React.CSSProperties = {
        padding: "8px 10px",
        borderRadius: 6,
        cursor: "pointer",
        fontSize: 12,
        lineHeight: "16px",
        userSelect: "none" as const
    };

    return (
        <div ref={ref} style={{ position: "relative" }}>
            <button
                type="button"
                title="Respostas rápidas"
                style={btnStyle}
                onClick={(e) => {
                    e.stopPropagation();
                    setOpen((v) => !v);
                }}
            >
                <MessageSquarePlus size={16} />
            </button>

            {open && (
                <div style={menuStyle} onClick={(e) => e.stopPropagation()}>
                    {QUICK_REPLIES.map((text, i) => (
                        <div
                            key={i}
                            style={itemStyle}
                            onMouseEnter={(e) => ((e.currentTarget.style.background = "rgba(0,0,0,0.05)"))}
                            onMouseLeave={(e) => ((e.currentTarget.style.background = "transparent"))}
                            onClick={() => {
                                openWhatsApp(phone, text);
                                setOpen(false);
                            }}
                        >
                            {text}
                        </div>
                    ))}
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

    const parent = phoneEl.parentElement;
    if (!parent) return;

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

    // monta os 3 botões (React)
    const waMount = document.createElement("div");
    wrapper.appendChild(waMount);
    ReactDOM.createRoot(waMount).render(<WhatsAppIconButton phone={phoneText} />);

    const copyMount = document.createElement("div");
    wrapper.appendChild(copyMount);
    ReactDOM.createRoot(copyMount).render(<CopyPhoneButton phone={phoneText} />);

    const qrMount = document.createElement("div");
    wrapper.appendChild(qrMount);
    ReactDOM.createRoot(qrMount).render(<QuickReplies phone={phoneText} />);

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

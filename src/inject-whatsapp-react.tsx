// inject-whatsapp-react.tsx
import { MessageCircle, Copy } from "lucide-react";
import React from "react";
import ReactDOM from "react-dom/client";

/** Seletores fixos do DOM renderizado */
const PHONE_SELECTOR = 'span[data-qa="sale-customer-phone"]';
const SALES_SELECTOR = 'small[data-qa="sale-customer-store-sales_count"]';

/** Evita montar duas vezes no mesmo span de telefone */
const MARK_ATTR = "data-amodomio-wapp";

/** Normaliza para E.164 (Brasil por padrão) */
function toE164(text: string): string {
    let digits = (text || "").replace(/\D/g, "");
    if (!digits) return "";
    if (!digits.startsWith("55")) digits = "55" + digits;
    return digits;
}

/** Botão de WhatsApp */
function WhatsAppIconButton({ phone }: { phone: string }) {
    const e164 = toE164(phone);
    if (!e164) return null;
    const href = `https://web.whatsapp.com/send?phone=${e164}`;

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
    };

    return (
        <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            title="Abrir no WhatsApp Web"
            style={btnStyle}
        >
            <MessageCircle size={18} />
        </a>
    );
}

/** Botão de copiar número */
function CopyPhoneButton({ phone }: { phone: string }) {
    const e164 = toE164(phone);
    if (!e164) return null;

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
        borderWidth: "0px"
    };

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(e164);
        } catch (err) {
            console.error("Falha ao copiar número:", err);
        }
    };

    return (
        <button
            type="button"
            onClick={handleCopy}
            title="Copiar número de telefone"
            style={btnStyle}
        >
            <Copy size={16} />
        </button>
    );
}

/** Monta wrapper com botões (esq) e coluna (dir) contendo telefone e pedidos */
function mountOnCard(phoneEl: HTMLSpanElement) {
    if (phoneEl.hasAttribute(MARK_ATTR)) return;

    const phoneText = phoneEl.textContent?.trim() || "";
    if (!phoneText) return;

    // Tenta achar o "sales count" próximo
    let salesEl: HTMLElement | null =
        (phoneEl.nextElementSibling as HTMLElement | null)?.matches?.(SALES_SELECTOR)
            ? (phoneEl.nextElementSibling as HTMLElement)
            : null;

    if (!salesEl && phoneEl.parentElement) {
        salesEl = phoneEl.parentElement.querySelector(SALES_SELECTOR);
    }

    const parent = phoneEl.parentElement;
    if (!parent) return;

    const wrapper = document.createElement("div");
    wrapper.className = "amodomio-wapp-wrapper";
    Object.assign(wrapper.style, {
        display: "flex",
        alignItems: "center",
        gap: "4px",
    } as CSSStyleDeclaration);

    const col = document.createElement("div");
    col.className = "amodomio-wapp-col";
    Object.assign(col.style, {
        display: "flex",
        flexDirection: "column",
        lineHeight: "1.2",
        gap: "4px",
    } as CSSStyleDeclaration);

    parent.insertBefore(wrapper, phoneEl);

    // botão WhatsApp
    const waMount = document.createElement("div");
    wrapper.appendChild(waMount);
    ReactDOM.createRoot(waMount).render(<WhatsAppIconButton phone={phoneText} />);

    // botão Copiar
    const copyMount = document.createElement("div");
    wrapper.appendChild(copyMount);
    ReactDOM.createRoot(copyMount).render(<CopyPhoneButton phone={phoneText} />);

    // coluna telefone + pedidos
    wrapper.appendChild(col);
    col.appendChild(phoneEl);
    if (salesEl) col.appendChild(salesEl);

    phoneEl.setAttribute(MARK_ATTR, "1");
}

/** Varre o DOM atual e monta onde faltar */
function scanAll() {
    document.querySelectorAll<HTMLSpanElement>(PHONE_SELECTOR).forEach((el) =>
        mountOnCard(el)
    );
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

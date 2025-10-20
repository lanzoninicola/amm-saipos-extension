// inject-whatsapp-react.tsx
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

/** Botão (apenas ícone) */
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
            <svg viewBox="0 0 32 32" width="18" height="18" aria-hidden="true" fill="currentColor">
                <path d="M19.11 17.49c-.29-.15-1.69-.83-1.95-.92-.26-.1-.45-.15-.64.15-.19.29-.73.92-.9 1.11-.17.19-.33.22-.62.07-.29-.15-1.22-.45-2.33-1.44-.86-.77-1.44-1.72-1.61-2.01-.17-.29-.02-.45.13-.6.13-.13.29-.34.43-.51.15-.17.19-.29.29-.48.1-.19.05-.36-.02-.51-.07-.15-.64-1.56-.88-2.14-.23-.56-.47-.49-.64-.49-.17 0-.36-.02-.55-.02-.19 0-.51.07-.78.36-.26.29-1 1-1 2.44 0 1.44 1.02 2.84 1.16 3.03.14.19 2 3.05 4.85 4.27 1.79.77 2.49.84 3.39.71.55-.08 1.69-.69 1.93-1.36.24-.67.24-1.24.17-1.36-.07-.12-.26-.2-.55-.35zM27.24 4.76C24.43 1.95 20.88.5 17.17.5 8.63.5 1.71 7.4 1.71 15.93c0 2.71.72 5.36 2.1 7.69L2 31.5l7.99-2.08c2.27 1.24 4.83 1.89 7.18 1.89h.01c8.54 0 15.46-6.9 15.46-15.43 0-3.71-1.46-7.26-4.27-10.07z" />
            </svg>
        </a>
    );
}

/** Monta wrapper com botão (esq) e coluna (dir) contendo telefone e pedidos */
function mountOnCard(phoneEl: HTMLSpanElement) {
    if (phoneEl.hasAttribute(MARK_ATTR)) return;

    const phoneText = phoneEl.textContent?.trim() || "";
    if (!phoneText) return;

    // Tenta achar o "sales count" próximo
    // 1) irmão seguinte imediato que casa
    let salesEl: HTMLElement | null =
        (phoneEl.nextElementSibling as HTMLElement | null)?.matches?.(SALES_SELECTOR)
            ? (phoneEl.nextElementSibling as HTMLElement)
            : null;

    // 2) se não achou, busca no mesmo container
    if (!salesEl && phoneEl.parentElement) {
        salesEl = phoneEl.parentElement.querySelector(SALES_SELECTOR);
    }

    // Elemento pai onde vamos inserir o wrapper
    const parent = phoneEl.parentElement;
    if (!parent) return;

    // Cria wrapper horizontal
    const wrapper = document.createElement("div");
    wrapper.className = "amodomio-wapp-wrapper";
    Object.assign(wrapper.style, {
        display: "flex",
        alignItems: "center",
        gap: "8px",
    } as CSSStyleDeclaration);

    // Cria coluna para telefone + pedidos
    const col = document.createElement("div");
    col.className = "amodomio-wapp-col";
    Object.assign(col.style, {
        display: "flex",
        flexDirection: "column",
        lineHeight: "1.2",
    } as CSSStyleDeclaration);

    // Inserimos o wrapper antes do telefone atual (o telefone será movido para dentro do col)
    parent.insertBefore(wrapper, phoneEl);

    // 1) mount para o botão (React)
    const mountNode = document.createElement("div");
    mountNode.className = "amodomio-wapp-mount";
    wrapper.appendChild(mountNode);
    ReactDOM.createRoot(mountNode).render(<WhatsAppIconButton phone={phoneText} />);

    // 2) coluna com telefone + (opcional) sales
    wrapper.appendChild(col);
    col.appendChild(phoneEl); // move o telefone para dentro da coluna
    if (salesEl) {
        col.appendChild(salesEl); // move o "(X pedidos)" para baixo do telefone
    }

    // Marca para não duplicar
    phoneEl.setAttribute(MARK_ATTR, "1");
}

/** Varre o DOM atual e monta onde faltar */
function scanAll() {
    document.querySelectorAll<HTMLSpanElement>(PHONE_SELECTOR).forEach((el) => mountOnCard(el));
}

/** Observa o DOM (Angular) e monta quando aparecer */
export function initWhatsAppButtonsReact() {
    // 1) varredura inicial
    scanAll();

    // 2) observer (DOM dinâmico)
    const obs = new MutationObserver((list) => {
        for (const mut of list) {
            mut.addedNodes.forEach((n) => {
                if (n.nodeType !== Node.ELEMENT_NODE) return;
                const el = n as Element;

                // se o próprio nó é o span do telefone
                if (el.matches?.(PHONE_SELECTOR)) {
                    mountOnCard(el as HTMLSpanElement);
                }

                // ou se contém spans de telefone
                el.querySelectorAll?.<HTMLSpanElement>(PHONE_SELECTOR).forEach((span) => {
                    mountOnCard(span);
                });
            });
        }
    });

    obs.observe(document.body, { childList: true, subtree: true });
}

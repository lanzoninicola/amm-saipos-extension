// inject-whatsapp-react.tsx
import React from "react";
import ReactDOM from "react-dom/client";

/** Seleciona exatamente o span do telefone */
const PHONE_SELECTOR = 'span[data-qa="sale-customer-phone"]';

/** Evita montar duas vezes no mesmo span */
const MARK_ATTR = "data-amodomio-wapp";

/** (46) 99105-2049 -> 5546991052049 (assume Brasil se faltar DDI) */
function toE164(brPhoneText: string): string {
    let digits = (brPhoneText || "").replace(/\D/g, "");
    if (!digits) return "";
    if (!digits.startsWith("55")) digits = "55" + digits;
    return digits;
}

function buildWhatsAppUrl(e164: string, message?: string) {
    const base = "https://web.whatsapp.com/send";
    const params = new URLSearchParams({ phone: e164 });
    if (message && message.trim()) params.set("text", message);
    return `${base}?${params.toString()}`;
}

/** Botão React */
function WhatsAppButton({ phoneText }: { phoneText: string }) {
    const e164 = toE164(phoneText);
    if (!e164) return null;

    const href = buildWhatsAppUrl(e164 /*, "Olá! 👋 Aqui é da A Modo Mio."*/);

    // Estilinho neutro para não brigar com o tema do sistema
    const style: React.CSSProperties = {
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        marginLeft: 8,
        padding: "2px 8px",
        borderRadius: 6,
        border: "1px solid rgba(0,0,0,0.15)",
        fontSize: 12,
        lineHeight: "18px",
        textDecoration: "none",
        cursor: "pointer",
        color: "inherit",
        background: "rgba(0,0,0,0.03)",
    };

    return (
        <a href={href} target="_blank" rel="noopener noreferrer" style={style} title="Abrir no WhatsApp Web">
            <svg viewBox="0 0 32 32" width="14" height="14" aria-hidden="true">
                <path
                    d="M19.11 17.49c-.29-.15-1.69-.83-1.95-.92-.26-.1-.45-.15-.64.15-.19.29-.73.92-.9 1.11-.17.19-.33.22-.62.07-.29-.15-1.22-.45-2.33-1.44-.86-.77-1.44-1.72-1.61-2.01-.17-.29-.02-.45.13-.6.13-.13.29-.34.43-.51.15-.17.19-.29.29-.48.1-.19.05-.36-.02-.51-.07-.15-.64-1.56-.88-2.14-.23-.56-.47-.49-.64-.49-.17 0-.36-.02-.55-.02-.19 0-.51.07-.78.36-.26.29-1 1-1 2.44 0 1.44 1.02 2.84 1.16 3.03.14.19 2 3.05 4.85 4.27 1.79.77 2.49.84 3.39.71.55-.08 1.69-.69 1.93-1.36.24-.67.24-1.24.17-1.36-.07-.12-.26-.2-.55-.35zM27.24 4.76C24.43 1.95 20.88.5 17.17.5 8.63.5 1.71 7.4 1.71 15.93c0 2.71.72 5.36 2.1 7.69L2 31.5l7.99-2.08c2.27 1.24 4.83 1.89 7.18 1.89h.01c8.54 0 15.46-6.9 15.46-15.43 0-3.71-1.46-7.26-4.27-10.07z"
                    fill="currentColor"
                />
            </svg>
            WhatsApp
        </a>
    );
}

/** Monta um botão React ao lado de cada telefone novo encontrado */
function mountButtonNextTo(phoneSpan: HTMLSpanElement) {
    if (phoneSpan.hasAttribute(MARK_ATTR)) return;
    const phoneText = phoneSpan.textContent?.trim() || "";
    if (!phoneText) return;

    // wrapper onde o React vai renderizar o botão
    const mount = document.createElement("span");
    mount.className = "amodomio-wapp-mount";
    // insere imediatamente após o span do telefone
    phoneSpan.insertAdjacentElement("afterend", mount);

    // render React
    const root = ReactDOM.createRoot(mount);
    root.render(<WhatsAppButton phoneText={phoneText} />);

    // marca para não duplicar
    phoneSpan.setAttribute(MARK_ATTR, "1");
}

/** Varre o DOM atual e monta botões onde faltar */
function scanAndMountAll() {
    document.querySelectorAll<HTMLSpanElement>(PHONE_SELECTOR).forEach((el) => mountButtonNextTo(el));
}

/** Observa o DOM (Angular) e monta quando aparecer */
export function initWhatsAppButtonsReact() {
    // 1) varredura inicial
    scanAndMountAll();

    // 2) observer para mudanças dinâmicas
    const root = document.body;
    const obs = new MutationObserver((list) => {
        for (const mut of list) {
            mut.addedNodes.forEach((n) => {
                if (n.nodeType !== Node.ELEMENT_NODE) return;
                const el = n as Element;

                // caso o próprio node já seja o span de telefone
                if (el.matches?.(PHONE_SELECTOR)) {
                    mountButtonNextTo(el as HTMLSpanElement);
                }

                // ou se ele contém spans de telefone
                el.querySelectorAll?.<HTMLSpanElement>(PHONE_SELECTOR).forEach((span) => {
                    mountButtonNextTo(span);
                });
            });
        }
    });

    obs.observe(root, { childList: true, subtree: true });
}

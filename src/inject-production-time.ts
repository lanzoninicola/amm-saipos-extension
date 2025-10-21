// inject-production-time.ts
const TIME_SELECTOR = ".card-sale-production-time";

/**
 * Extrai minutos do texto "(1h19m)" ou "(15m)"
 */
function getMinutesFromText(text: string): number {
  const match = text.match(/(\d+)h|(\d+)m/g);
  if (!match) return 0;

  let total = 0;
  match.forEach((part) => {
    if (part.endsWith("h")) total += parseInt(part) * 60;
    if (part.endsWith("m")) total += parseInt(part);
  });
  return total;
}

/**
 * Define a cor com base no SLA
 */
function getSlaColor(minutes: number): string {
  if (minutes <= 15) return "#16a34a"; // verde
  if (minutes <= 30) return "#f59e0b"; // amarelo
  return "#dc2626"; // vermelho
}

/**
 * Aplica o estilo no elemento do tempo de produção
 */
function styleProductionTime(el: HTMLElement) {
  const text = el.textContent?.trim() || "";
  const minutes = getMinutesFromText(text);
  const color = getSlaColor(minutes);

  // Tooltip com texto original
  el.title = text;

  // Exibir apenas último tempo entre parênteses
  const short = text.match(/\(([^)]+)\)/g);
  const last = short ? short[short.length - 1] : text;

  el.innerHTML = `⏳ ${last.replace(/[()]/g, "")}`;
  Object.assign(el.style, {
    color,
    fontWeight: "600",
    fontSize: "14px",
    textAlign: "right",
    lineHeight: "1.2",
  });
}

/**
 * Varre e estiliza todos os tempos
 */
function scanAllProductionTimes() {
  document
    .querySelectorAll<HTMLElement>(TIME_SELECTOR)
    .forEach(styleProductionTime);
}

/**
 * Inicia observador de alterações no DOM
 */
export function initProductionTime() {
  scanAllProductionTimes();

  const observer = new MutationObserver(() => {
    scanAllProductionTimes();
  });

  observer.observe(document.body, { childList: true, subtree: true });
}

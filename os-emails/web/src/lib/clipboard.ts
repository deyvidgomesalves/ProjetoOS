/**
 * Copia um texto para a área de transferência.
 * Usa a API moderna quando disponível (https/localhost) e cai para o método
 * antigo em páginas http simples, garantindo o "Copiar" em qualquer ambiente.
 */
export async function copyText(text: string): Promise<boolean> {
  if (!text) return false;

  if (typeof navigator !== 'undefined' && navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // segue para o fallback
    }
  }

  return fallbackCopy(text);
}

function fallbackCopy(text: string): boolean {
  if (typeof document === 'undefined') return false;

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', 'readonly');
  textarea.style.position = 'fixed';
  textarea.style.top = '-1000px';
  textarea.style.opacity = '0';

  document.body.appendChild(textarea);

  try {
    textarea.select();
    textarea.setSelectionRange(0, text.length);
    const copied = document.execCommand('copy');
    return copied;
  } catch {
    return false;
  } finally {
    document.body.removeChild(textarea);
  }
}

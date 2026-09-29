import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { AlertIcon, CheckIcon, CloseIcon, InfoIcon } from './Icons';

type ToastTone = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  tone: ToastTone;
  message: string;
}

interface ToastContextValue {
  show: (message: string, tone?: ToastTone) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const TONE_CLASSES: Record<ToastTone, string> = {
  success: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  error: 'border-rose-200 bg-rose-50 text-rose-900',
  info: 'border-sky-200 bg-sky-50 text-sky-900',
};

const TONE_ICON_CLASSES: Record<ToastTone, string> = {
  success: 'text-emerald-600',
  error: 'text-rose-600',
  info: 'text-sky-600',
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const counter = useRef(0);

  const remove = useCallback((id: number) => {
    setItems((previous) => previous.filter((item) => item.id !== id));
  }, []);

  const show = useCallback(
    (message: string, tone: ToastTone = 'success') => {
      counter.current += 1;
      const id = counter.current;
      setItems((previous) => [...previous, { id, tone, message }]);
      window.setTimeout(() => remove(id), 4000);
    },
    [remove],
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      show,
      success: (message: string) => show(message, 'success'),
      error: (message: string) => show(message, 'error'),
      info: (message: string) => show(message, 'info'),
    }),
    [show],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col items-center gap-2 p-4 sm:items-end"
        aria-live="polite"
        role="status"
      >
        {items.map((item) => (
          <div
            key={item.id}
            className={`animate-toast-in pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border px-4 py-3 shadow-lg shadow-slate-900/5 ${TONE_CLASSES[item.tone]}`}
          >
            <span className={`mt-0.5 h-5 w-5 flex-none ${TONE_ICON_CLASSES[item.tone]}`}>
              {item.tone === 'success' ? <CheckIcon className="h-5 w-5" /> : null}
              {item.tone === 'error' ? <AlertIcon className="h-5 w-5" /> : null}
              {item.tone === 'info' ? <InfoIcon className="h-5 w-5" /> : null}
            </span>
            <p className="flex-1 text-sm font-medium">{item.message}</p>
            <button
              type="button"
              onClick={() => remove(item.id)}
              className="text-slate-400 transition-colors hover:text-slate-700"
              aria-label="Fechar aviso"
            >
              <CloseIcon className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast precisa ser usado dentro de <ToastProvider>.');
  return context;
}

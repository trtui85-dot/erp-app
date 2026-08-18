import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { X, CheckCircle, AlertCircle, Info } from "lucide-react";

const ToastContext = createContext(null);

let toastId = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const audioRef = useRef(null);

  useEffect(() => {
    audioRef.current = new Audio("/sonsucces.mp3");
    audioRef.current.volume = 0.4;
  }, []);

  const remove = useCallback((id) => {
    setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 400);
  }, []);

  const push = useCallback((msg, type = "info", duration = 4000) => {
    const id = ++toastId;
    setToasts((prev) => [...prev, { id, msg, type, leaving: false }]);
    if (type === "success" && audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {});
    }
    if (duration > 0) setTimeout(() => remove(id), duration);
    return id;
  }, [remove]);

  const success = useCallback((msg) => push(msg, "success"), [push]);
  const error = useCallback((msg) => push(msg, "error"), [push]);
  const info = useCallback((msg) => push(msg, "info"), [push]);

  const icons = { success: CheckCircle, error: AlertCircle, info: Info };

  return (
    <ToastContext.Provider value={{ push, success, error, info, remove }}>
      {children}
      <div className="toast-container">
        {toasts.map((t) => {
          const Icon = icons[t.type] || Info;
          return (
            <div
              key={t.id}
              className={`toast ${t.type}${t.leaving ? " leaving" : ""}`}
              onClick={() => remove(t.id)}
            >
              <Icon size={18} className="toast-icon" />
              <span className="toast-msg">{t.msg}</span>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);

import { useEffect, useRef, useState, useMemo } from "react";
import { X, Inbox, Check, ChevronDown, Search } from "lucide-react";
import { useTranslation } from "react-i18next";

export function SearchSelect({ value, onChange, options = [], placeholder = "", required = false, compact = false }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapRef = useRef(null);
  const inputRef = useRef(null);

  const selected = options.find((o) => String(o.value) === String(value));

  const filtered = useMemo(() => {
    if (!query.trim()) return options;
    const q = query.trim().toLowerCase();
    return options.filter((o) => String(o.label).toLowerCase().includes(q));
  }, [options, query]);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  useEffect(() => { if (open && inputRef.current) inputRef.current.focus(); }, [open]);

  return (
    <div className={`ss-wrap${compact ? " ss-compact" : ""}`} ref={wrapRef}>
      <button type="button" className={`ss-trigger${open ? " ss-open" : ""}${!selected ? " ss-empty" : ""}`} onClick={() => setOpen(!open)}>
        <span className="ss-trigger-text">{selected ? selected.label : placeholder}</span>
        <ChevronDown size={16} className={`ss-chevron${open ? " ss-rotate" : ""}`} />
      </button>
      {open && (
        <div className="ss-dropdown">
          <div className="ss-search">
            <Search size={14} className="ss-search-icon" />
            <input ref={inputRef} className="ss-search-input" type="search" placeholder="..." value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          <div className="ss-options">
            {filtered.length === 0 ? (
              <div className="ss-empty-msg">—</div>
            ) : filtered.map((o) => (
              <button key={o.value} type="button" className={`ss-option${String(o.value) === String(value) ? " ss-selected" : ""}`} onClick={() => { onChange(o.value); setOpen(false); setQuery(""); }}>
                <span className="ss-option-label">{o.label}</span>
                {String(o.value) === String(value) && <Check size={14} className="ss-check" />}
              </button>
            ))}
          </div>
        </div>
      )}
      {required && !value && <input required tabIndex={-1} style={{ position: "absolute", opacity: 0, height: 0 }} />}
    </div>
  );
}

export function PageLoader() {
  return (
    <div className="page-loader">
      <div className="spinner" />
    </div>
  );
}

export function EmptyState({ icon: Icon = Inbox, msg }) {
  const { t } = useTranslation();
  return (
    <div className="empty-state">
      <Icon size={48} strokeWidth={1.2} />
      <p>{msg || t("app.noData")}</p>
    </div>
  );
}

export function Modal({ open, onClose, title, children, wide }) {
  const overlayRef = useRef(null);

  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => (document.body.style.overflow = "");
  }, [open]);

  if (!open) return null;
  return (
    <div className="modal-overlay" ref={overlayRef} onClick={(e) => e.target === overlayRef.current && onClose()}>
      <div className={`modal-content${wide ? " modal-wide" : ""}`}>
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="modal-close" onClick={onClose}><X size={20} /></button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

export function Badge({ children, color = "#6366f1" }) {
  return (
    <span className="badge" style={{ background: color + "22", color, borderColor: color + "44" }}>
      {children}
    </span>
  );
}

export function Confirm({ open, onClose, onConfirm, msg }) {
  if (!open) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content modal-confirm" onClick={(e) => e.stopPropagation()}>
        <p>{msg}</p>
        <div className="confirm-actions">
          <button className="btn btn-ghost" onClick={onClose}>Annuler</button>
          <button className="btn btn-danger" onClick={() => { onConfirm(); onClose(); }}>Supprimer</button>
        </div>
      </div>
    </div>
  );
}

export function DataTable({ columns, children }) {
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            {columns.map((col, i) => (
              <th key={i} style={col.width ? { width: col.width } : {}}>{col.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

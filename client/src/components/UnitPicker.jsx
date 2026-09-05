import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Modal } from "./ui";
import { Minus, Plus, Check } from "lucide-react";

export default function UnitPicker({ title, entries = [], initialKey = null, onAdd, onClose }) {
  const { t } = useTranslation();
  const [sel, setSel] = useState(
    initialKey && entries.some((e) => e.key === initialKey) ? initialKey : (entries[0]?.key ?? null)
  );
  const [qty, setQty] = useState(1);
  const entry = entries.find((e) => e.key === sel) || entries[0] || null;
  const qtyNum = Math.max(1, Number(qty) || 1);
  const useQty = entry && entry.max_qty ? Math.min(qtyNum, entry.max_qty) : qtyNum;

  return (
    <Modal open onClose={onClose} title={title} wide>
      <div className="unit-picker">
        <div className="unit-picker-list">
          {entries.map((e) => (
            <button type="button" key={e.key} className={`unit-picker-item${sel === e.key ? " active" : ""}`} onClick={() => { setSel(e.key); setQty(1); }}>
              <span className="unit-picker-item-name">{e.unit}</span>
              <span className="unit-picker-item-price">{Number(e.price || 0).toLocaleString()} {t("app.currency")}</span>
              <span className="unit-picker-item-stock">{t("pos.stock")}: {Number(e.stock || 0)} {e.unit}</span>
            </button>
          ))}
        </div>
        {entry ? (
          <div className="unit-picker-action">
            <div className="unit-picker-label">{t("pos.selectUnit")} — {entry.unit}</div>
            <div className="unit-picker-qty">
              <button type="button" className="unit-picker-step" onClick={() => setQty(Math.max(1, qtyNum - 1))}><Minus size={16} /></button>
              <input className="unit-picker-input" type="number" min="1" value={qty} onChange={(e) => setQty(e.target.value)} />
              <button type="button" className="unit-picker-step" onClick={() => setQty(qtyNum + 1)}><Plus size={16} /></button>
            </div>
            {entry.max_qty && qtyNum > entry.max_qty && (
              <div className="unit-picker-warn">{t("pos.insufficientStock")} ({t("pos.stock")}: {entry.max_qty})</div>
            )}
            <div className="unit-picker-total">
              <span>{t("pos.total")}</span>
              <b>{(useQty * (entry.price || 0)).toLocaleString()} {t("app.currency")}</b>
            </div>
            <button className="btn btn-primary btn-block" onClick={() => { if (entry) onAdd(entry, useQty); }}>
              <Check size={16} /> {t("pos.add")}
            </button>
          </div>
        ) : (
          <div className="unit-picker-empty">{t("pos.noProducts")}</div>
        )}
      </div>
    </Modal>
  );
}
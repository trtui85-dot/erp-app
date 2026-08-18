import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { http } from "../api";
import { useToast } from "../components/toast";
import { Modal, EmptyState, PageLoader, Badge, SearchSelect } from "../components/ui";
import { Plus, Trash2, Trash, AlertTriangle } from "lucide-react";

const REASONS = ["rotten", "storage", "transport", "expired_display", "other"];

export default function Waste() {
  const { t } = useTranslation();
  const toast = useToast();
  const [records, setRecords] = useState([]);
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ batch_id: "", qty: "", reason: "rotten", date: new Date().toISOString().split("T")[0], notes: "" });

  const loadData = async () => {
    setLoading(true);
    try {
      const [wRes, bRes] = await Promise.all([
        http.get("/waste"),
        http.get("/batches?status=active"),
      ]);
      setRecords(wRes.data);
      setBatches(bRes.data.filter((b) => Number(b.remaining_qty) > 0));
    } catch {}
    finally { setLoading(false); }
  };
  useEffect(() => { loadData(); }, []);

  const selectedBatch = batches.find((b) => b.id === Number(form.batch_id));
  const estimatedLoss = selectedBatch && form.qty ? (Number(form.qty) * Number(selectedBatch.purchase_price)).toFixed(2) : 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.batch_id) return toast.error(t("waste.selectBatch"));
    if (!form.qty || Number(form.qty) <= 0) return toast.error(t("waste.positiveQty"));
    if (selectedBatch && Number(form.qty) > Number(selectedBatch.remaining_qty)) {
      return toast.error(t("waste.exceedRemaining") + ": " + selectedBatch.remaining_qty);
    }
    setSaving(true);
    try {
      await http.post("/waste", {
        batch_id: Number(form.batch_id),
        qty: Number(form.qty),
        reason: form.reason,
        date: form.date,
        notes: form.notes,
      });
      toast.success(t("waste.recorded") + " ✓");
      setModal(false);
      setForm({ batch_id: "", qty: "", reason: "rotten", date: new Date().toISOString().split("T")[0], notes: "" });
      loadData();
    } catch (err) { toast.error(err.response?.data?.error || err.message || "Erreur"); }
    finally { setSaving(false); }
  };

  const handleDelete = async (item) => {
    if (!confirm(t("app.yesDelete"))) return;
    try { await http.delete(`/waste/${item.id}`); toast.success(t("app.delete") + " ✓"); loadData(); }
    catch (err) { toast.error(err.message || "Erreur"); }
  };

  const totalLoss = records.reduce((s, r) => s + Number(r.loss_value || 0), 0);
  const totalQty = records.reduce((s, r) => s + Number(r.qty || 0), 0);

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">{t("waste.title")}</h1>
        <button className="btn btn-primary" onClick={() => { setForm({ batch_id: "", qty: "", reason: "rotten", date: new Date().toISOString().split("T")[0], notes: "" }); setModal(true); }}>
          <Plus size={18} /> {t("waste.add")}
        </button>
      </div>
      {records.length > 0 && (
        <div className="stats-grid" style={{ marginBottom: 16 }}>
          <div className="stat-card" style={{ borderTopColor: "#ef4444" }}>
            <div className="stat-icon" style={{ color: "#ef4444" }}><AlertTriangle size={24} /></div>
            <div className="stat-value">{totalQty.toFixed(1)}</div>
            <div className="stat-label">{t("waste.totalQty")}</div>
          </div>
          <div className="stat-card" style={{ borderTopColor: "#f59e0b" }}>
            <div className="stat-icon" style={{ color: "#f59e0b" }}><Trash size={24} /></div>
            <div className="stat-value">{totalLoss.toLocaleString()} {t("app.currency")}</div>
            <div className="stat-label">{t("waste.totalLoss")}</div>
          </div>
        </div>
      )}
      {loading ? <PageLoader /> : records.length === 0 ? <EmptyState icon={Trash} msg={t("waste.noData")} /> : (
        <div className="card-list">
          {records.map((r) => (
            <div key={r.id} className="card-item">
              <div className="card-main">
                <div className="card-title">{r.product_name}</div>
                <div className="card-sub">{r.batch_code || `#${r.batch_id}`} · {r.date}</div>
                <div className="card-sub">
                  {r.qty} {t("app.unit")} · <Badge color="#ef4444">{t(`waste.reasons.${r.reason}`)}</Badge>
                </div>
                <div className="card-sub" style={{ color: "#ef4444", fontWeight: 600 }}>
                  -{Number(r.loss_value).toLocaleString()} {t("app.currency")}
                </div>
              </div>
              <button className="icon-btn icon-btn-danger" onClick={() => handleDelete(r)}><Trash2 size={16} /></button>
            </div>
          ))}
        </div>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title={t("waste.add")}>
        <form onSubmit={handleSubmit} className="modal-form">
          <div className="input-group">
            <label>{t("waste.batch")}</label>
            <SearchSelect required value={form.batch_id} onChange={(v) => setForm({ ...form, batch_id: v })} placeholder={t("waste.selectBatch")}
              options={batches.map((b) => ({ value: b.id, label: `${b.product_name} — ${b.batch_code || `#${b.id}`} — ${b.remaining_qty} ${b.unit} — ${t("waste.purchase")}: ${b.purchase_price}` }))} />
          </div>
          <div className="input-group">
            <label>{t("waste.qtyWasted")}</label>
            <input type="number" step="0.1" min="0.1" required value={form.qty} onChange={(e) => setForm({ ...form, qty: e.target.value })} />
            {selectedBatch && <small>{t("waste.remaining")}: {selectedBatch.remaining_qty} {selectedBatch.unit}</small>}
          </div>
          <div className="input-group">
            <label>{t("waste.reason")}</label>
            <SearchSelect value={form.reason} onChange={(v) => setForm({ ...form, reason: v })}
              options={REASONS.map((r) => ({ value: r, label: t(`waste.reasons.${r}`) }))} />
          </div>
          <div className="input-group">
            <label>{t("app.date")}</label>
            <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </div>
          <div className="input-group">
            <label>{t("app.note")}</label>
            <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          {estimatedLoss > 0 && (
            <div style={{ padding: "12px 16px", background: "#fef2f2", borderRadius: 8, border: "1px solid #fecaca", marginBottom: 8 }}>
              <strong style={{ color: "#ef4444" }}>{t("waste.estimatedLoss")}: {estimatedLoss} {t("app.currency")}</strong>
            </div>
          )}
          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={() => setModal(false)}>{t("app.cancel")}</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? "..." : t("app.save")}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

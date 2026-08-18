import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { http } from "../api";
import { useToast } from "../components/toast";
import { Modal, EmptyState, PageLoader, DataTable, SearchSelect } from "../components/ui";
import { Plus, Trash2, Receipt } from "lucide-react";

const CATEGORIES = ["transport", "salary", "rent", "utilities", "packaging", "other"];

export default function Expenses() {
  const { t } = useTranslation();
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ category: "transport", amount: "", date: new Date().toISOString().split("T")[0], notes: "" });
  const [saving, setSaving] = useState(false);

  const load = () => {
    http.get("/expenses").then((d) => setItems(d.data)).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const openAdd = () => { setForm({ category: "transport", amount: "", date: new Date().toISOString().split("T")[0], notes: "" }); setModal(true); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await http.post("/expenses", { ...form, amount: Number(form.amount) });
      toast.success(t("app.add") + " ✓");
      setModal(false);
      load();
    } catch (err) { toast.error(err.message || "Erreur"); }
    finally { setSaving(false); }
  };

  const handleDelete = async (item) => {
    if (!confirm(t("app.yesDelete"))) return;
    try { await http.delete(`/expenses/${item.id}`); toast.success(t("app.delete") + " ✓"); load(); }
    catch (err) { toast.error(err.message || "Erreur"); }
  };

  const CAT_COLORS = { transport: "#3b82f6", salary: "#8b5cf6", rent: "#f59e0b", utilities: "#14b8a6", packaging: "#ec4899", other: "#6b7280" };

  const columns = [
    { label: t("app.amount"), width: "110px" },
    { label: t("app.date"), width: "110px" },
    { label: t("expenses.category") },
    { label: "", width: "50px" },
  ];

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">{t("expenses.title")}</h1>
        <button className="btn btn-primary" onClick={openAdd}><Plus size={18} /> {t("expenses.add")}</button>
      </div>
      {loading ? <PageLoader /> : items.length === 0 ? <EmptyState icon={Receipt} msg={t("expenses.noData")} /> : (
        <DataTable columns={columns}>
          {items.map((item) => (
            <tr key={item.id}>
              <td className="card-cell-primary">{item.amount} {t("app.currency")}</td>
              <td>{item.date}</td>
              <td><span className="badge" style={{ background: (CAT_COLORS[item.category] || "#6b7280") + "22", color: CAT_COLORS[item.category] || "#6b7280" }}>{t(`expenses.categories.${item.category}`, item.category)}</span></td>
              <td><button className="icon-btn icon-btn-danger" onClick={() => handleDelete(item)}><Trash2 size={16} /></button></td>
            </tr>
          ))}
        </DataTable>
      )}
      <Modal open={modal} onClose={() => setModal(false)} title={t("expenses.add")}>
        <form onSubmit={handleSubmit} className="modal-form">
          <div className="input-group">
            <label>{t("expenses.category")}</label>
            <SearchSelect value={form.category} onChange={(v) => setForm({ ...form, category: v })}
              options={CATEGORIES.map((c) => ({ value: c, label: t(`expenses.categories.${c}`) }))} />
          </div>
          <div className="input-group">
            <label>{t("expenses.amount")}</label>
            <input type="number" required min="0.01" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
          </div>
          <div className="input-group">
            <label>{t("app.date")}</label>
            <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </div>
          <div className="input-group">
            <label>{t("app.note")}</label>
            <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={() => setModal(false)}>{t("app.cancel")}</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? "..." : t("app.save")}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

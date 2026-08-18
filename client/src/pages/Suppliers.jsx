import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { http } from "../api";
import { useToast } from "../components/toast";
import { Modal, EmptyState, PageLoader } from "../components/ui";
import { Plus, Edit, Trash2, Truck } from "lucide-react";

export default function Suppliers() {
  const { t } = useTranslation();
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState({ name: "", phone: "", specialty: "", notes: "" });
  const [saving, setSaving] = useState(false);

  const load = () => {
    http.get("/suppliers").then((d) => setItems(d.data)).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const openAdd = () => { setEditItem(null); setForm({ name: "", phone: "", specialty: "", notes: "" }); setModal(true); };
  const openEdit = (item) => { setEditItem(item); setForm({ name: item.name, phone: item.phone, specialty: item.specialty || "", notes: item.notes || "" }); setModal(true); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editItem) {
        await http.patch(`/suppliers/${editItem.id}`, form);
        toast.success(t("app.save") + " ✓");
      } else {
        await http.post("/suppliers", form);
        toast.success(t("app.add") + " ✓");
      }
      setModal(false);
      load();
    } catch (err) { toast.error(err.message || "Erreur"); }
    finally { setSaving(false); }
  };

  const handleDelete = async (item) => {
    if (!confirm(t("app.yesDelete"))) return;
    try { await http.delete(`/suppliers/${item.id}`); toast.success(t("app.delete") + " ✓"); load(); }
    catch (err) { toast.error(err.message || "Erreur"); }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">{t("suppliers.title")}</h1>
        <button className="btn btn-primary" onClick={openAdd}><Plus size={18} /> {t("suppliers.add")}</button>
      </div>
      {loading ? <PageLoader /> : items.length === 0 ? <EmptyState icon={Truck} msg={t("suppliers.noData")} /> : (
        <div className="card-list">
          {items.map((item) => (
            <div key={item.id} className="card-item">
              <div className="card-main">
                <div className="card-title">{item.name}</div>
                <div className="card-sub">{item.phone}</div>
                {item.specialty && <div className="card-sub">{item.specialty}</div>}
                {item.last_supply_date && <div className="card-sub">{t("suppliers.lastSupply")}: {item.last_supply_date}</div>}
              </div>
              <div className="card-actions">
                <button className="icon-btn" onClick={() => openEdit(item)}><Edit size={18} /></button>
                <button className="icon-btn icon-btn-danger" onClick={() => handleDelete(item)}><Trash2 size={18} /></button>
              </div>
            </div>
          ))}
        </div>
      )}
      <Modal open={modal} onClose={() => setModal(false)} title={editItem ? t("suppliers.edit") : t("suppliers.add")}>
        <form onSubmit={handleSubmit} className="modal-form">
          <div className="input-group">
            <label>{t("suppliers.name")}</label>
            <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="input-group">
            <label>{t("suppliers.phone")}</label>
            <input required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div className="input-group">
            <label>{t("suppliers.specialty")}</label>
            <input value={form.specialty} onChange={(e) => setForm({ ...form, specialty: e.target.value })} />
          </div>
          <div className="input-group">
            <label>{t("suppliers.notes")}</label>
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

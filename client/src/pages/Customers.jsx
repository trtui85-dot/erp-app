import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { http } from "../api";
import { useToast } from "../components/toast";
import { Modal, EmptyState, PageLoader, DataTable } from "../components/ui";
import { Plus, Edit, Trash2, Users } from "lucide-react";

export default function Customers() {
  const { t } = useTranslation();
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState({ name: "", phone: "", address: "" });
  const [saving, setSaving] = useState(false);

  const load = () => {
    http.get("/customers").then((d) => setItems(d.data)).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const openAdd = () => { setEditItem(null); setForm({ name: "", phone: "", address: "" }); setModal(true); };
  const openEdit = (item) => { setEditItem(item); setForm({ name: item.name, phone: item.phone || "", address: item.address || "" }); setModal(true); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editItem) {
        await http.patch(`/customers/${editItem.id}`, form);
        toast.success(t("app.save") + " ✓");
      } else {
        await http.post("/customers", form);
        toast.success(t("app.add") + " ✓");
      }
      setModal(false);
      load();
    } catch (err) { toast.error(err.message || "Erreur"); }
    finally { setSaving(false); }
  };

  const handleDelete = async (item) => {
    if (!confirm(t("app.yesDelete"))) return;
    try { await http.delete(`/customers/${item.id}`); toast.success(t("app.delete") + " ✓"); load(); }
    catch (err) { toast.error(err.message || "Erreur"); }
  };

  const columns = [
    { label: t("customers.name") },
    { label: t("customers.phone"), width: "120px" },
    { label: t("customers.address") },
    { label: "", width: "80px" },
  ];

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">{t("customers.title")}</h1>
        <button className="btn btn-primary" onClick={openAdd}><Plus size={18} /> {t("customers.add")}</button>
      </div>
      {loading ? <PageLoader /> : items.length === 0 ? <EmptyState icon={Users} msg={t("customers.noData")} /> : (
        <DataTable columns={columns}>
          {items.map((item) => (
            <tr key={item.id}>
              <td className="card-cell-primary">{item.name}</td>
              <td>{item.phone}</td>
              <td>{item.address}</td>
              <td>
                <button className="icon-btn" onClick={() => openEdit(item)}><Edit size={18} /></button>
                <button className="icon-btn icon-btn-danger" onClick={() => handleDelete(item)}><Trash2 size={18} /></button>
              </td>
            </tr>
          ))}
        </DataTable>
      )}
      <Modal open={modal} onClose={() => setModal(false)} title={editItem ? t("customers.edit") : t("customers.add")}>
        <form onSubmit={handleSubmit} className="modal-form">
          <div className="input-group">
            <label>{t("customers.name")}</label>
            <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="input-group">
            <label>{t("customers.phone")}</label>
            <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div className="input-group">
            <label>{t("customers.address")}</label>
            <textarea value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} rows={2} />
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

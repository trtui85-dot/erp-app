import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { http } from "../api";
import { useToast } from "../components/toast";
import { Modal, EmptyState, PageLoader, DataTable, Badge } from "../components/ui";
import { Plus, Edit, Trash2, ShieldCheck, UserX } from "lucide-react";
import { APP_PAGES, parsePerms } from "../permissions";

const emptyForm = { name: "", phone: "", pin: "", role: "WORKER", see_stats: true, permissions: {} };

export default function Users() {
  const { t } = useTranslation();
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = () => {
    http.get("/users").then((d) => setItems(d.data)).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const openAdd = () => { setEditItem(null); setForm(emptyForm); setModal(true); };
  const openEdit = (item) => {
    setEditItem(item);
    setForm({
      name: item.name, phone: item.phone, pin: "",
      role: item.role === "ADMIN" ? "ADMIN" : "WORKER",
      see_stats: item.see_stats !== 0 && item.see_stats !== false,
      permissions: parsePerms(item.permissions),
    });
    setModal(true);
  };

  const togglePage = (key) => {
    setForm((f) => ({ ...f, permissions: { ...f.permissions, [key]: !f.permissions[key] } }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        phone: form.phone.trim(),
        role: form.role,
        see_stats: form.see_stats,
        permissions: form.role === "ADMIN" ? {} : form.permissions,
      };
      if (editItem) {
        if (form.pin) payload.pin = form.pin;
        await http.patch(`/users/${editItem.id}`, payload);
        toast.success(t("app.save") + " âœ“");
      } else {
        payload.pin = form.pin;
        await http.post("/users", payload);
        toast.success(t("app.add") + " âœ“");
      }
      setModal(false);
      load();
    } catch (err) { toast.error(err.message || "Erreur"); }
    finally { setSaving(false); }
  };

  const handleDelete = async (item) => {
    if (!confirm(t("users.confirmDelete"))) return;
    try { await http.delete(`/users/${item.id}`); toast.success(t("app.delete") + " âœ“"); load(); }
    catch (err) { toast.error(err.message || "Erreur"); }
  };

  const columns = [
    { label: t("users.name") },
    { label: t("users.phone"), width: "130px" },
    { label: t("users.role"), width: "100px" },
    { label: t("users.stats"), width: "100px" },
    { label: t("users.pages"), width: "200px" },
    { label: t("users.status"), width: "90px" },
    { label: "", width: "90px" },
  ];

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">{t("users.title")}</h1>
        <button className="btn btn-primary" onClick={openAdd}><Plus size={18} /> {t("users.add")}</button>
      </div>
      {loading ? <PageLoader /> : items.length === 0 ? <EmptyState icon={ShieldCheck} msg={t("users.noData")} /> : (
        <DataTable columns={columns}>
          {items.map((item) => {
            const perms = parsePerms(item.permissions);
            const allowed = APP_PAGES.filter((p) => perms[p] === true);
            return (
              <tr key={item.id}>
                <td className="card-cell-primary">
                  {item.name}
                  {item.role === "ADMIN" && <Badge color="#e11d48">ADMIN</Badge>}
                </td>
                <td dir="ltr">{item.phone}</td>
                <td>{item.role === "ADMIN" ? t("users.admin") : t("users.worker")}</td>
                <td>{item.see_stats === 1 || item.see_stats === true ? <Badge color="#22c55e">âœ“</Badge> : <Badge color="#f43f5e">âœ•</Badge>}</td>
                <td className="users-pages-cell">
                  {item.role === "ADMIN" ? (
                    <span className="muted-text">{t("users.allPages")}</span>
                  ) : allowed.length === 0 ? (
                    <span className="muted-text">â€”</span>
                  ) : (
                    allowed.map((p) => <Badge key={p}>{t(`nav.${p}`)}</Badge>)
                  )}
                </td>
                <td>{item.active === 1 || item.active === true ? <Badge color="#22c55e">{t("users.active")}</Badge> : <Badge color="#f43f5e">{t("users.inactive")}</Badge>}</td>
                <td>
                  <button className="icon-btn" onClick={() => openEdit(item)}><Edit size={18} /></button>
                  <button className="icon-btn icon-btn-danger" onClick={() => handleDelete(item)}><Trash2 size={18} /></button>
                </td>
              </tr>
            );
          })}
        </DataTable>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title={editItem ? t("users.edit") : t("users.add")} wide>
        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-row">
            <div className="input-group">
              <label>{t("users.name")}</label>
              <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="input-group">
              <label>{t("users.phone")}</label>
              <input required dir="ltr" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
          </div>
          <div className="form-row">
            <div className="input-group">
              <label>{editItem ? t("users.pinReset") : t("users.pin")}</label>
              <input required={!editItem} type="password" inputMode="numeric" dir="ltr" placeholder={editItem ? "â€¢â€¢â€¢â€¢" : ""} value={form.pin} onChange={(e) => setForm({ ...form, pin: e.target.value })} />
            </div>
            <div className="input-group">
              <label>{t("users.role")}</label>
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="select-input">
                <option value="WORKER">{t("users.worker")}</option>
                <option value="ADMIN">{t("users.admin")}</option>
              </select>
            </div>
          </div>

          <label className="toggle-check">
            <input type="checkbox" checked={form.see_stats} onChange={(e) => setForm({ ...form, see_stats: e.target.checked })} />
            <span>{t("users.seeStats")}</span>
          </label>

          {form.role === "WORKER" && (
            <div className="users-perms-block">
              <p className="users-perms-title">{t("users.pagesTitle")}</p>
              <div className="users-perms-grid">
                {APP_PAGES.map((key) => (
                  <label key={key} className={`perm-chip${form.permissions[key] ? " perm-chip-on" : ""}`}>
                    <input type="checkbox" checked={!!form.permissions[key]} onChange={() => togglePage(key)} />
                    <span>{t(`nav.${key}`)}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={() => setModal(false)}>{t("app.cancel")}</button>
            <button type="submit" className="btn btn-primary" disabled={saving || (form.role === "WORKER" && !Object.values(form.permissions).some(Boolean) && !form.see_stats)}>{saving ? "..." : t("app.save")}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
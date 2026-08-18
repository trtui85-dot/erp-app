import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { http } from "../api";
import { useToast } from "../components/toast";
import { Modal, EmptyState, PageLoader, SearchSelect } from "../components/ui";
import { FolderOpen, Plus, Edit, Package, AlertTriangle, TrendingUp, ChevronLeft } from "lucide-react";

const ICONS = ["🥬", "🌾", "🥩", "📦", "🧀", "🐟", "🍞", "🍎", "🧃", "🧂", "🫒", "🥛", "🥚", "🫘", "🍯"];

export default function Categories() {
  const { t } = useTranslation();
  const toast = useToast();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [modal, setModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState({ name: "", name_ar: "", icon: "📦", color: "#6b7280", sort_order: 0 });
  const [saving, setSaving] = useState(false);

  const fetchCategories = async () => {
    setLoading(true);
    try {
      const res = await http.get("/categories");
      setCategories(res.data);
    } catch {}
    finally { setLoading(false); }
  };

  const fetchProducts = async (catId) => {
    setLoadingProducts(true);
    try {
      const res = await http.get(`/categories/${catId}/products`);
      setProducts(res.data);
    } catch {}
    finally { setLoadingProducts(false); }
  };

  useEffect(() => { fetchCategories(); }, []);
  useEffect(() => { if (selected) fetchProducts(selected.id); }, [selected]);

  const openAdd = () => { setEditItem(null); setForm({ name: "", name_ar: "", icon: "📦", color: "#6b7280", sort_order: 0 }); setModal(true); };
  const openEdit = (cat) => { setEditItem(cat); setForm({ name: cat.name, name_ar: cat.name_ar || "", icon: cat.icon || "📦", color: cat.color || "#6b7280", sort_order: cat.sort_order || 0 }); setModal(true); };

  const handleSave = async (ev) => {
    ev.preventDefault();
    setSaving(true);
    try {
      if (editItem) { await http.patch(`/categories/${editItem.id}`, form); toast.success(t("app.save") + " ✓"); }
      else { await http.post("/categories", form); toast.success(t("app.add") + " ✓"); }
      setModal(false); fetchCategories();
    } catch (err) { toast.error(err.message || "Erreur"); }
    finally { setSaving(false); }
  };

  const getStockStatus = (p) => {
    if (Number(p.total_stock) <= 0) return { color: "#ef4444", label: t("products.empty") };
    if (Number(p.total_stock) <= Number(p.min_stock || 20)) return { color: "#f59e0b", label: t("products.low") };
    return { color: "#22c55e", label: t("products.ok") };
  };

  if (loading) return <PageLoader />;

  if (selected) {
    return (
      <div className="page-container">
        <div className="page-header">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button className="btn btn-ghost" onClick={() => { setSelected(null); setProducts([]); }}><ChevronLeft size={18} /></button>
            <h1 className="page-title">{selected.icon} {selected.name}</h1>
            <button className="btn btn-ghost" style={{ padding: "4px 8px" }} onClick={() => openEdit(selected)}><Edit size={14} /></button>
          </div>
        </div>
        {loadingProducts ? <PageLoader /> : products.length === 0 ? <EmptyState icon={Package} msg={t("categories.noProducts")} /> : (
          <div className="cat-prod-list">
            {products.map((p) => {
              const status = getStockStatus(p);
              return (
                <div key={p.id} className="cat-prod-row">
                  <div className="cat-prod-top">
                    <span className="cat-prod-name">{p.name}</span>
                    <span className="cat-prod-badge" style={{ color: status.color }}>{status.label}</span>
                  </div>
                  <div className="cat-prod-sub">
                    {Number(p.total_stock).toLocaleString()} {p.unit} · {Number(p.sale_price || 0).toLocaleString()} {t("app.currency")}/{p.unit}
                  </div>
                  {Number(p.danger_batches) > 0 && <div className="cat-prod-danger"><AlertTriangle size={10} /> {p.danger_batches}</div>}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">{t("categories.title")}</h1>
        <button className="btn btn-primary" onClick={openAdd}><Plus size={18} /> {t("categories.add")}</button>
      </div>

      {categories.length === 0 ? <EmptyState icon={FolderOpen} msg={t("categories.noCategories")} /> : (
        <div className="cat-grid">
          {categories.map((cat) => (
            <div key={cat.id} className="cat-card" onClick={() => setSelected(cat)} style={{ borderTopColor: cat.color }}>
              <div className="cat-card-icon">{cat.icon}</div>
              <div className="cat-card-info">
                <div className="cat-card-name">{cat.name}</div>
                <div className="cat-card-count">{cat.product_count} {t("categories.products")}</div>
                <div className="cat-card-meta">
                  <span>{Number(cat.stock_value || 0).toLocaleString()} {t("app.currency")}</span>
                  {Number(cat.danger_count) > 0 && <span className="cat-card-danger"><AlertTriangle size={10} /> {cat.danger_count}</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title={editItem ? t("categories.edit") : t("categories.add")}>
        <form onSubmit={handleSave} className="modal-form">
          <div className="input-group"><label>{t("categories.name")}</label><input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div className="input-group"><label>{t("categories.nameAr")}</label><input value={form.name_ar} onChange={(e) => setForm({ ...form, name_ar: e.target.value })} /></div>
          <div className="input-group"><label>{t("categories.icon")}</label>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {ICONS.map((ic) => (
                <button key={ic} type="button" onClick={() => setForm({ ...form, icon: ic })} style={{ fontSize: "1.3rem", width: 40, height: 40, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 10, border: form.icon === ic ? "2px solid var(--primary)" : "1px solid var(--gray-200)", background: form.icon === ic ? "var(--primary-50)" : "white", cursor: "pointer" }}>{ic}</button>
              ))}
            </div>
          </div>
          <div className="input-group"><label>{t("categories.color")}</label>
            <div style={{ display: "flex", gap: 6 }}>
              {["#22c55e", "#f59e0b", "#ef4444", "#6366f1", "#0d9488", "#ec4899", "#6b7280"].map((c) => (
                <button key={c} type="button" onClick={() => setForm({ ...form, color: c })} style={{ width: 32, height: 32, borderRadius: "50%", background: c, border: form.color === c ? "3px solid white" : "none", outline: form.color === c ? `2px solid ${c}` : "none", cursor: "pointer" }} />
              ))}
            </div>
          </div>
          <div className="input-group"><label>{t("categories.sortOrder")}</label><input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })} /></div>
          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={() => setModal(false)}>{t("app.cancel")}</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? "..." : t("app.save")}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

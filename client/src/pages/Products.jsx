import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { http } from "../api";
import { useToast } from "../components/toast";
import { Modal, EmptyState, PageLoader, Badge, SearchSelect } from "../components/ui";
import { Plus, Edit, Trash2, Package, Search, AlertTriangle, ChevronLeft, FolderOpen } from "lucide-react";

export default function Products() {
  const { t } = useTranslation();
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({ name: "", unit: "kg", price_type: "fixed", current_sale_price: "", min_stock: 20, shelf_life_days: 5, category_id: "" });
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState([]);
  const [selectedCat, setSelectedCat] = useState(null);

  const load = () => {
    http.get("/products").then((d) => setItems(d.data)).catch(() => {}).finally(() => setLoading(false));
    http.get("/categories").then((d) => setCategories(d.data)).catch(() => {});
  };
  useEffect(load, []);

  const catProducts = selectedCat ? items.filter((i) => i.category_id === selectedCat.id) : [];
  const filtered = selectedCat ? catProducts.filter((i) => i.name.toLowerCase().includes(search.toLowerCase())) : [];

  const openAdd = (catId) => { setEditItem(null); setForm({ name: "", unit: "kg", price_type: "fixed", current_sale_price: "", min_stock: 20, shelf_life_days: 5, category_id: catId || "" }); setModal(true); };
  const openEdit = (item) => { setEditItem(item); setForm({ name: item.name, unit: item.unit || "kg", price_type: item.price_type, current_sale_price: item.current_sale_price || "", min_stock: item.min_stock || 20, shelf_life_days: item.shelf_life_days || 5, category_id: item.category_id || "" }); setModal(true); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form, min_stock: Number(form.min_stock) || 20, shelf_life_days: Number(form.shelf_life_days) || 5 };
      if (editItem) {
        await http.patch(`/products/${editItem.id}`, payload);
        toast.success(t("app.save") + " ✓");
      } else {
        await http.post("/products", payload);
        toast.success(t("app.add") + " ✓");
      }
      setModal(false);
      load();
    } catch (err) { toast.error(err.message || "Erreur"); }
    finally { setSaving(false); }
  };

  const handleDelete = async (item) => {
    if (!confirm(t("app.yesDelete"))) return;
    try { await http.delete(`/products/${item.id}`); toast.success(t("app.delete") + " ✓"); load(); }
    catch (err) { toast.error(err.message || "Erreur"); }
  };

  if (loading) return <PageLoader />;

  if (!selectedCat) {
    return (
      <div className="page-container">
        <div className="page-header">
          <h1 className="page-title">{t("categories.title")}</h1>
        </div>
        {categories.length === 0 ? <EmptyState icon={FolderOpen} msg={t("categories.noCategories")} /> : (
          <div className="cat-grid">
            {categories.map((cat) => {
              const count = items.filter((i) => i.category_id === cat.id).length;
              return (
                <div key={cat.id} className="cat-card" onClick={() => { setSelectedCat(cat); setSearch(""); }} style={{ borderTopColor: cat.color }}>
                  <div className="cat-card-icon">{cat.icon}</div>
                  <div className="cat-card-info">
                    <div className="cat-card-name">{cat.name}</div>
                    <div className="cat-card-count">{count} {t("categories.products")}</div>
                  </div>
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
        <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1 }}>
          <button className="btn btn-ghost" onClick={() => { setSelectedCat(null); setSearch(""); }}><ChevronLeft size={18} /></button>
          <h1 className="page-title">{selectedCat.icon} {selectedCat.name}</h1>
        </div>
        <button className="btn btn-primary" onClick={() => openAdd(selectedCat.id)}><Plus size={18} /> {t("products.add")}</button>
      </div>
      <div className="search-wrap">
        <Search size={18} className="search-icon" />
        <input className="search-input" placeholder={t("products.search")} value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      {filtered.length === 0 ? <EmptyState icon={Package} msg={t("products.noData")} /> : (
        <div className="card-list">
          {filtered.map((item) => {
            const isLow = Number(item.total_stock) <= Number(item.min_stock);
            return (
              <div key={item.id} className="card-item">
                <div className="card-main">
                  <div className="card-title">{item.name}</div>
                  <div className="card-sub">{item.unit || "kg"} · {item.price_type === "fixed" ? t("products.fixedPrice") : t("products.variablePrice")}</div>
                  <div className="card-sub">{t("app.price")}: {item.current_sale_price || 0} {t("app.currency")}</div>
                  <div className="card-sub">
                    {t("products.minStock")}: {item.min_stock || 20} · {t("products.shelfLife")}: {item.shelf_life_days || 5} {t("reports.days")}
                  </div>
                  <div className="card-sub">
                    {t("batches.remainingQty")}: <strong>{Number(item.total_stock || 0).toFixed(1)}</strong> · {item.batch_count} {t("batches.title")}
                    {isLow && <Badge color="#ef4444" style={{ marginLeft: 8 }}><AlertTriangle size={12} /> {t("reports.low")}</Badge>}
                  </div>
                </div>
                <div className="card-actions">
                  <button className="icon-btn" onClick={() => openEdit(item)}><Edit size={18} /></button>
                  <button className="icon-btn icon-btn-danger" onClick={() => handleDelete(item)}><Trash2 size={18} /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <Modal open={modal} onClose={() => setModal(false)} title={editItem ? t("products.edit") : t("products.add")}>
        <form onSubmit={handleSubmit} className="modal-form">
          <div className="input-group">
            <label>{t("products.name")}</label>
            <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="input-group">
            <label>{t("categories.title")}</label>
            <SearchSelect value={form.category_id} onChange={(v) => setForm({ ...form, category_id: v })} placeholder={t("categories.title")}
              options={categories.map((c) => ({ value: c.id, label: `${c.icon} ${c.name}` }))} />
          </div>
          <div className="input-group">
            <label>{t("products.unit")}</label>
            <input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="kg" />
          </div>
          <div className="input-group">
            <label>{t("products.priceType")}</label>
            <SearchSelect value={form.price_type} onChange={(v) => setForm({ ...form, price_type: v })}
              options={[{ value: "fixed", label: t("products.fixedPrice") }, { value: "variable", label: t("products.variablePrice") }]} />
          </div>
          <div className="input-group">
            <label>{t("products.currentPrice")}</label>
            <input type="number" step="0.01" value={form.current_sale_price} onChange={(e) => setForm({ ...form, current_sale_price: e.target.value })} />
          </div>
          <div className="input-group" style={{ flexDirection: "row", gap: 8 }}>
            <div style={{ flex: 1 }}>
              <label>{t("products.minStock")}</label>
              <input type="number" step="0.1" min="0" value={form.min_stock} onChange={(e) => setForm({ ...form, min_stock: e.target.value })} />
            </div>
            <div style={{ flex: 1 }}>
              <label>{t("products.shelfLife")}</label>
              <input type="number" min="1" value={form.shelf_life_days} onChange={(e) => setForm({ ...form, shelf_life_days: e.target.value })} />
            </div>
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

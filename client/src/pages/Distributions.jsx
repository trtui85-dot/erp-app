import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { http } from "../api";
import { useToast } from "../components/toast";
import { EmptyState, PageLoader, Badge, Modal } from "../components/ui";
import ProductGrid, { useStockMap } from "../components/ProductGrid";
import { Plus, Trash2, Share2, ChevronLeft, Check } from "lucide-react";

export default function Distributions() {
  const { t } = useTranslation();
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [batches, setBatches] = useState([]);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [settleModal, setSettleModal] = useState(false);
  const [settleDist, setSettleDist] = useState(null);
  const [settleItems, setSettleItems] = useState([]);
  const [form, setForm] = useState({ vendor_name: "", vendor_phone: "", date: new Date().toISOString().split("T")[0], commission_rate: "", notes: "" });
  const [formItems, setFormItems] = useState([]);
  const [saving, setSaving] = useState(false);

  const stockMap = useStockMap(batches);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [distRes, batchRes, prodRes, catRes] = await Promise.all([
        http.get("/distributions"),
        http.get("/batches"),
        http.get("/products").catch(() => ({ data: [] })),
        http.get("/categories").catch(() => ({ data: [] })),
      ]);
      setItems(distRes.data);
      setBatches(batchRes.data);
      setProducts(prodRes.data);
      setCategories(catRes.data);
    } catch {}
    finally { setLoading(false); }
  };
  useEffect(() => { fetchData(); }, []);

  const openAdd = () => {
    setForm({ vendor_name: "", vendor_phone: "", date: new Date().toISOString().split("T")[0], commission_rate: "", notes: "" });
    setFormItems([]);
    setAddOpen(true);
  };

  const batchFor = (entry) => batches.find((b) => b.status === "active" && Number(b.remaining_qty) > 0 && (entry.product_unit_id ? b.product_unit_id === entry.product_unit_id : b.product_id === entry.product_id));

  const pickProduct = (prod, entry) => {
    if (formItems.some((i) => i.product_id === prod.id && (i.product_unit_id || null) === (entry.product_unit_id || null))) {
      toast.error(t("supplyInvoices.alreadyAdded") || "المنتج موجود بالفعل");
      return;
    }
    const batch = batchFor(entry);
    if (!batch) return toast.error(t("pos.insufficientStock"));
    setFormItems((prev) => [...prev, {
      product_id: prod.id,
      product_unit_id: entry.product_unit_id || null,
      unit: entry.unit,
      name: prod.name,
      stock: entry.stock,
      batch_id: batch.id,
      qty_given: 1,
      price: entry.price || batch.sale_price || "",
      batch_qty: Number(batch.remaining_qty),
    }]);
  };

  const updateItem = (index, field, value) => {
    const newItems = [...formItems];
    newItems[index] = { ...newItems[index], [field]: value };
    setFormItems(newItems);
  };

  const formTotal = formItems.reduce((s, it) => s + (Number(it.qty_given) || 0) * (Number(it.price) || 0), 0);

  const handleSave = async () => {
    if (!form.vendor_name) return toast.error(t("distributions.vendor"));
    const valid = formItems.filter((it) => it.batch_id && Number(it.qty_given) > 0);
    if (valid.length === 0) return toast.error(t("distributions.items"));
    for (const it of valid) {
      if (it.qty_given > it.batch_qty) return toast.error(`${it.name}: ${t("pos.insufficientStock")}`);
    }
    setSaving(true);
    try {
      await http.post("/distributions", {
        vendor_name: form.vendor_name,
        vendor_phone: form.vendor_phone,
        date: form.date,
        commission_rate: Number(form.commission_rate) || 0,
        notes: form.notes,
        items: valid.map((it) => ({
          batch_id: Number(it.batch_id),
          qty_given: Number(it.qty_given),
          price: Number(it.price) || 0,
        })),
      });
      toast.success(t("app.save") + " ✓");
      setAddOpen(false);
      fetchData();
    } catch (err) { toast.error(err.message || "Erreur"); }
    finally { setSaving(false); }
  };

  const openSettle = async (dist) => {
    try {
      const res = await http.get(`/distributions/${dist.id}`);
      setSettleDist(res.data);
      setSettleItems((res.data.items || []).map((it) => ({
        ...it,
        qty_sold: it.qty_sold || 0,
        qty_returned: it.qty_returned || 0,
      })));
      setSettleModal(true);
    } catch (err) { toast.error(err.message || "Erreur"); }
  };

  const updateSettleItem = (index, field, value) => {
    const newItems = [...settleItems];
    newItems[index] = { ...newItems[index], [field]: value };
    setSettleItems(newItems);
  };

  const handleSettle = async () => {
    setSaving(true);
    try {
      await http.post(`/distributions/${settleDist.id}/settle`, {
        items: settleItems.map((it) => ({
          id: it.id,
          qty_sold: Number(it.qty_sold),
          qty_returned: Number(it.qty_returned),
        })),
      });
      toast.success(t("distributions.settle") + " ✓");
      setSettleModal(false);
      fetchData();
    } catch (err) { toast.error(err.message || "Erreur"); }
    finally { setSaving(false); }
  };

  const STATUS_COLORS = { active: "#3b82f6", settled: "#22c55e", returned: "#9ca3af" };

  return (
    <div className="page-container">
      {addOpen ? (
        <div className="sup-add-page">
          <div className="page-header">
            <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1 }}>
              <button className="btn btn-ghost" onClick={() => setAddOpen(false)}><ChevronLeft size={18} /></button>
              <h1 className="page-title">{t("distributions.add")}</h1>
            </div>
          </div>

          <div className="section">
            <div className="section-title" style={{ marginBottom: 8 }}>{t("distributions.vendor")}</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 180 }}>
                <span className="sup-mini-label">{t("distributions.vendor")}</span>
                <input className="input-other" style={{ width: "100%" }} value={form.vendor_name} onChange={(e) => setForm({ ...form, vendor_name: e.target.value })} placeholder={t("distributions.vendor")} />
              </div>
              <div style={{ flex: 1, minWidth: 180 }}>
                <span className="sup-mini-label">{t("distributions.phone")}</span>
                <input className="input-other" style={{ width: "100%" }} value={form.vendor_phone} onChange={(e) => setForm({ ...form, vendor_phone: e.target.value })} placeholder={t("distributions.phone")} />
              </div>
              <div style={{ flex: 1, minWidth: 180 }}>
                <span className="sup-mini-label">{t("app.date")}</span>
                <input type="date" className="input-other" style={{ width: "100%" }} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
              </div>
              <div style={{ flex: 1, minWidth: 180 }}>
                <span className="sup-mini-label">{t("distributions.commission")} %</span>
                <input type="number" className="input-other" style={{ width: "100%" }} value={form.commission_rate} onChange={(e) => setForm({ ...form, commission_rate: e.target.value })} placeholder="0" />
              </div>
            </div>
          </div>

          <div className="section" style={{ marginTop: 10 }}>
            <div className="section-title" style={{ marginBottom: 8 }}>{t("supplyInvoices.searchProduct") || "اختر منتجات التوزيع"} — {formItems.length}</div>
            <ProductGrid products={products} batches={batches} categories={categories} onPick={pickProduct} />
          </div>

          <div className="section" style={{ marginTop: 10 }}>
            <div className="section-title" style={{ marginBottom: 8 }}>{t("distributions.items")} — {formItems.length}</div>
            {formItems.length === 0 ? (
              <div style={{ textAlign: "center", color: "var(--gray-400)", padding: "18px 0", fontSize: "0.85rem" }}>{t("supplyInvoices.noItemsHint") || "اختر منتجات من الشبكة أعلاه"}</div>
            ) : formItems.map((it, idx) => (
              <div key={`${it.product_id}-${it.product_unit_id}`} className="sup-item">
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                  <span style={{ fontWeight: 600, flex: 1 }}>{it.name} <span className="sup-mini-label">({it.unit})</span></span>
                  <button className="icon-btn icon-btn-danger" onClick={() => setFormItems(formItems.filter((_, i) => i !== idx))}><Trash2 size={16} /></button>
                </div>
                <div style={{ fontSize: "0.74rem", color: "var(--gray-500)", marginBottom: 4 }}>
                  {t("pos.stock")}: <b>{it.stock} {it.unit}</b> {it.batch_qty !== it.stock ? `| ${t("distributions.batch")}: ${it.batch_qty}` : ""}
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <input className="input-other" style={{ flex: 1 }} type="number" step="any" min="0" max={it.batch_qty} placeholder={t("distributions.qtyGiven")} value={it.qty_given} onChange={(e) => { updateItem(idx, "qty_given", e.target.value); if (Number(e.target.value) > it.batch_qty) toast.error(`${it.name}: ${t("pos.insufficientStock")}`); }} />
                  <input className="input-other" style={{ flex: 1 }} type="number" step="any" min="0" placeholder={t("distributions.price")} value={it.price} onChange={(e) => updateItem(idx, "price", e.target.value)} />
                </div>
              </div>
            ))}
            <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} placeholder={t("app.note")} className="input-other" style={{ width: "100%", marginTop: 8 }} />
          </div>

          <div className="pos-total-card" style={{ marginTop: 10 }}>
            <div className="pos-total">
              <span>{t("app.total")}</span>
              <span className="pos-total-value">{formTotal.toLocaleString()} {t("app.currency")}</span>
            </div>
          </div>

          <button className="btn btn-primary btn-block" style={{ marginTop: 12 }} disabled={saving || formItems.length === 0} onClick={handleSave}>
            <Check size={16} /> {saving ? "..." : t("app.save")}
          </button>
        </div>
      ) : (
        <>
          <div className="page-header">
            <h1 className="page-title">{t("distributions.title")}</h1>
            <button className="btn btn-primary" onClick={openAdd}><Plus size={18} /> {t("distributions.add")}</button>
          </div>
          {loading ? <PageLoader /> : items.length === 0 ? <EmptyState icon={Share2} msg={t("distributions.noData")} /> : (
            <div className="card-list">
              {items.map((d) => (
                <div key={d.id} className="card-item">
                  <div className="card-main">
                    <div className="card-title">{d.vendor_name}</div>
                    <div className="card-sub">{d.date} · {t("app.total")}: {Number(d.total_value).toLocaleString()} {t("app.currency")}</div>
                    {d.commission_rate > 0 && <div className="card-sub">{t("distributions.commission")}: {d.commission_rate}%</div>}
                  </div>
                  <div className="card-actions" style={{ gap: 4 }}>
                    <Badge color={STATUS_COLORS[d.status]}>{t(`distributions.${d.status}`)}</Badge>
                    {d.status === "active" && <button className="btn btn-ghost" onClick={() => openSettle(d)}>{t("distributions.settle")}</button>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <Modal open={settleModal} onClose={() => setSettleModal(false)} title={t("distributions.settle")} wide>
        <form onSubmit={(e) => { e.preventDefault(); handleSettle(); }} className="modal-form">
          {settleItems.map((item, idx) => (
            <div key={idx} className="card-item" style={{ marginBottom: 8 }}>
              <div className="card-main">
                <div className="card-title">{item.product_name || `#${item.batch_id}`} — {item.qty_given} {t("distributions.qtyGiven")}</div>
                <div className="input-group" style={{ flexDirection: "row", gap: 8 }}>
                  <div style={{ flex: 1 }}>
                    <label>{t("distributions.qtySold")}</label>
                    <input type="number" value={item.qty_sold} onChange={(e) => updateSettleItem(idx, "qty_sold", e.target.value)} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label>{t("distributions.qtyReturned")}</label>
                    <input type="number" value={item.qty_returned} onChange={(e) => updateSettleItem(idx, "qty_returned", e.target.value)} />
                  </div>
                </div>
              </div>
            </div>
          ))}
          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={() => setSettleModal(false)}>{t("app.cancel")}</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? "..." : t("app.validate")}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
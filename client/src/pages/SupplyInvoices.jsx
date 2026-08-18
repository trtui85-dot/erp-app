import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { http } from "../api";
import { useToast } from "../components/toast";
import { Modal, EmptyState, PageLoader, DataTable, SearchSelect } from "../components/ui";
import { Plus, Trash2, ClipboardList } from "lucide-react";

const emptyItem = { product_id: "", qty: 1, unit: "kg", purchase_price: "", sale_price: "", expiry_date: "" };

export default function SupplyInvoices() {
  const { t } = useTranslation();
  const toast = useToast();
  const [invoices, setInvoices] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ supplier_id: "", date: new Date().toISOString().split("T")[0], notes: "", items: [{ ...emptyItem }] });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [invRes, supRes, prodRes] = await Promise.all([
        http.get("/supplyinvoices"),
        http.get("/suppliers"),
        http.get("/products"),
      ]);
      setInvoices(invRes.data);
      setSuppliers(supRes.data);
      setProducts(prodRes.data);
    } catch {}
    finally { setLoading(false); }
  };
  useEffect(() => { fetchData(); }, []);

  const openAdd = () => {
    setForm({ supplier_id: "", date: new Date().toISOString().split("T")[0], notes: "", items: [{ ...emptyItem }] });
    setModal(true);
  };

  const updateItem = (index, field, value) => {
    const newItems = [...form.items];
    newItems[index] = { ...newItems[index], [field]: value };
    if (field === "product_id") {
      const prod = products.find((p) => String(p.id) === String(value));
      if (prod) newItems[index].unit = prod.unit || "kg";
    }
    setForm({ ...form, items: newItems });
  };

  const handleSave = async () => {
    if (!form.supplier_id) return toast.error(t("supplyInvoices.selectSupplier"));
    setSaving(true);
    try {
      await http.post("/supplyinvoices", {
        supplier_id: Number(form.supplier_id),
        date: form.date,
        notes: form.notes,
        items: form.items.map((it) => ({
          product_id: Number(it.product_id),
          qty: Number(it.qty),
          unit: it.unit,
          purchase_price: Number(it.purchase_price),
          sale_price: Number(it.sale_price) || Number(it.purchase_price),
          expiry_date: it.expiry_date || null,
        })),
      });
      toast.success(t("supplyInvoices.batchCreated") + " ✓");
      setModal(false);
      fetchData();
    } catch (err) { toast.error(err.message || "Erreur"); }
    finally { setSaving(false); }
  };

  const columns = [
    { label: t("supplyInvoices.supplier") },
    { label: t("app.date"), width: "110px" },
    { label: t("app.total"), width: "120px" },
  ];

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">{t("supplyInvoices.title")}</h1>
        <button className="btn btn-primary" onClick={openAdd}><Plus size={18} /> {t("supplyInvoices.add")}</button>
      </div>
      {loading ? <PageLoader /> : invoices.length === 0 ? <EmptyState icon={ClipboardList} msg={t("supplyInvoices.noData")} /> : (
        <DataTable columns={columns}>
          {invoices.map((inv) => (
            <tr key={inv.id}>
              <td className="card-cell-primary">{inv.supplier_name}</td>
              <td>{inv.date}</td>
              <td>{Number(inv.total).toLocaleString()} {t("app.currency")}</td>
            </tr>
          ))}
        </DataTable>
      )}
      <Modal open={modal} onClose={() => setModal(false)} title={t("supplyInvoices.add")} wide>
        <form onSubmit={(e) => { e.preventDefault(); handleSave(); }} className="modal-form">
          <div className="input-group">
            <label>{t("supplyInvoices.supplier")}</label>
            <SearchSelect required value={form.supplier_id} onChange={(v) => setForm({ ...form, supplier_id: v })} placeholder={t("supplyInvoices.selectSupplier")}
              options={suppliers.map((s) => ({ value: s.id, label: s.name }))} />
          </div>
          <div className="input-group">
            <label>{t("supplyInvoices.date")}</label>
            <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </div>
          <div className="input-group">
            <label>{t("app.note")}</label>
            <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
          </div>
          <div className="section">
            <div className="page-header" style={{ marginBottom: 8 }}>
              <span className="page-subtitle">{t("supplyInvoices.items")}</span>
              <button type="button" className="btn btn-ghost" onClick={() => setForm({ ...form, items: [...form.items, { ...emptyItem }] })}>
                <Plus size={14} /> {t("supplyInvoices.addItem")}
              </button>
            </div>
            {form.items.map((item, idx) => (
              <div key={idx} className="card-item" style={{ marginBottom: 8 }}>
                <div className="card-main" style={{ gap: 4 }}>
                  <SearchSelect compact value={item.product_id} onChange={(v) => updateItem(idx, "product_id", v)} placeholder={t("supplyInvoices.product")}
                    options={products.map((p) => ({ value: p.id, label: p.name }))} />
                  <div className="input-group" style={{ flexDirection: "row", gap: 8 }}>
                    <input type="number" placeholder={t("supplyInvoices.qty")} value={item.qty} onChange={(e) => updateItem(idx, "qty", e.target.value)} style={{ flex: 1 }} />
                    <input placeholder={t("supplyInvoices.unit")} value={item.unit} readOnly style={{ flex: 1, background: "var(--gray-50)", color: "var(--gray-500)" }} />
                  </div>
                  <div className="input-group" style={{ flexDirection: "row", gap: 8 }}>
                    <input type="number" placeholder={t("supplyInvoices.purchasePrice")} value={item.purchase_price} onChange={(e) => updateItem(idx, "purchase_price", e.target.value)} style={{ flex: 1 }} />
                    <input type="number" placeholder={t("supplyInvoices.salePrice")} value={item.sale_price} onChange={(e) => updateItem(idx, "sale_price", e.target.value)} style={{ flex: 1 }} />
                  </div>
                  <input type="date" value={item.expiry_date} onChange={(e) => updateItem(idx, "expiry_date", e.target.value)} />
                </div>
                {form.items.length > 1 && (
                  <button type="button" className="icon-btn icon-btn-danger" onClick={() => setForm({ ...form, items: form.items.filter((_, i) => i !== idx) })}><Trash2 size={16} /></button>
                )}
              </div>
            ))}
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

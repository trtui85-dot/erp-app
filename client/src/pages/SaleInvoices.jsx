import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { http } from "../api";
import { useToast } from "../components/toast";
import { Modal, EmptyState, PageLoader, Badge, SearchSelect } from "../components/ui";
import { Plus, Trash2, ShoppingCart } from "lucide-react";

const emptyItem = { batch_id: "", qty: 1, price: "" };

export default function SaleInvoices() {
  const { t } = useTranslation();
  const toast = useToast();
  const [invoices, setInvoices] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ customer_id: "", date: new Date().toISOString().split("T")[0], type: "retail", paid: "", notes: "", items: [{ ...emptyItem }] });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [invRes, custRes, batchRes] = await Promise.all([
        http.get("/saleinvoices"),
        http.get("/customers"),
        http.get("/batches"),
      ]);
      setInvoices(invRes.data);
      setCustomers(custRes.data);
      setBatches(batchRes.data);
    } catch {}
    finally { setLoading(false); }
  };
  useEffect(() => { fetchData(); }, []);

  const openAdd = () => {
    setForm({ customer_id: "", date: new Date().toISOString().split("T")[0], type: "retail", paid: "", notes: "", items: [{ ...emptyItem }] });
    setModal(true);
  };

  const updateItem = (index, field, value) => {
    const newItems = [...form.items];
    newItems[index] = { ...newItems[index], [field]: value };
    if (field === "batch_id" && value) {
      const batch = batches.find((b) => b.id === Number(value));
      if (batch) newItems[index].price = batch.sale_price;
    }
    setForm({ ...form, items: newItems });
  };

  const total = form.items.reduce((sum, it) => sum + (Number(it.qty) || 0) * (Number(it.price) || 0), 0);

  const handleSave = async () => {
    if (!form.customer_id) return toast.error(t("saleInvoices.selectCustomer"));
    setSaving(true);
    try {
      await http.post("/saleinvoices", {
        customer_id: Number(form.customer_id),
        date: form.date,
        type: form.type,
        paid: Number(form.paid) || 0,
        notes: form.notes,
        items: form.items.map((it) => ({
          batch_id: Number(it.batch_id),
          qty: Number(it.qty),
          price: Number(it.price),
        })),
      });
      toast.success(t("app.save") + " ✓");
      setModal(false);
      fetchData();
    } catch (err) { toast.error(err.message || "Erreur"); }
    finally { setSaving(false); }
  };

  const getPaymentBadge = (inv) => {
    const diff = Number(inv.total) - Number(inv.paid);
    if (diff <= 0) return <span className="inv-badge inv-paid">{t("app.paid")}</span>;
    if (Number(inv.paid) > 0) return <span className="inv-badge inv-partial">{t("debts.partial")}</span>;
    return <span className="inv-badge inv-pending">{t("debts.pending")}</span>;
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">{t("saleInvoices.title")}</h1>
        <button className="btn btn-primary" onClick={openAdd}><Plus size={18} /> {t("saleInvoices.add")}</button>
      </div>
      {loading ? <PageLoader /> : invoices.length === 0 ? <EmptyState icon={ShoppingCart} msg={t("saleInvoices.noData")} /> : (
        <div className="inv-list">
          {invoices.map((inv) => (
            <div key={inv.id} className="inv-row">
              <div className="inv-row-top">
                <span className="inv-name">{inv.customer_name}</span>
                {getPaymentBadge(inv)}
              </div>
              <div className="inv-row-mid">
                <span>{inv.date}</span>
                {inv.type && <span className="inv-type">{inv.type === "wholesale" ? t("saleInvoices.wholesale") : t("saleInvoices.retail")}</span>}
              </div>
              <div className="inv-row-bottom">
                <span className="inv-total">{Number(inv.total).toLocaleString()} {t("app.currency")}</span>
                <span className="inv-paid-amt">{t("app.paid")}: {Number(inv.paid).toLocaleString()}</span>
              </div>
            </div>
          ))}
        </div>
      )}
      <Modal open={modal} onClose={() => setModal(false)} title={t("saleInvoices.add")} wide>
        <form onSubmit={(e) => { e.preventDefault(); handleSave(); }} className="modal-form">
          <div className="input-group">
            <label>{t("saleInvoices.customer")}</label>
            <SearchSelect required value={form.customer_id} onChange={(v) => setForm({ ...form, customer_id: v })} placeholder={t("saleInvoices.selectCustomer")}
              options={customers.map((c) => ({ value: c.id, label: c.name }))} />
          </div>
          <div className="input-group" style={{ flexDirection: "row", gap: 8 }}>
            <div style={{ flex: 1 }}>
              <label>{t("app.date")}</label>
              <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </div>
            <div style={{ flex: 1 }}>
              <label>{t("saleInvoices.type")}</label>
              <SearchSelect value={form.type} onChange={(v) => setForm({ ...form, type: v })}
                options={[{ value: "retail", label: t("saleInvoices.retail") }, { value: "wholesale", label: t("saleInvoices.wholesale") }]} />
            </div>
          </div>
          <div className="section">
            <div className="page-header" style={{ marginBottom: 8 }}>
              <span className="page-subtitle">{t("saleInvoices.items")}</span>
              <button type="button" className="btn btn-ghost" onClick={() => setForm({ ...form, items: [...form.items, { ...emptyItem }] })}>
                <Plus size={14} /> {t("saleInvoices.addItem")}
              </button>
            </div>
            {form.items.map((item, idx) => (
              <div key={idx} className="card-item" style={{ marginBottom: 8 }}>
                <div className="card-main" style={{ gap: 4 }}>
                  <SearchSelect compact value={item.batch_id} onChange={(v) => updateItem(idx, "batch_id", v)} placeholder={t("saleInvoices.batch")}
                    options={batches.filter((b) => Number(b.remaining_qty) > 0).map((b) => ({ value: b.id, label: `${b.product_name} — ${b.remaining_qty} ${b.unit} restant` }))} />
                  <div className="input-group" style={{ flexDirection: "row", gap: 8 }}>
                    <input type="number" placeholder={t("saleInvoices.qty")} value={item.qty} onChange={(e) => updateItem(idx, "qty", e.target.value)} style={{ flex: 1 }} />
                    <input type="number" placeholder={t("saleInvoices.price")} value={item.price} onChange={(e) => updateItem(idx, "price", e.target.value)} style={{ flex: 1 }} />
                  </div>
                </div>
                {form.items.length > 1 && (
                  <button type="button" className="icon-btn icon-btn-danger" onClick={() => setForm({ ...form, items: form.items.filter((_, i) => i !== idx) })}><Trash2 size={16} /></button>
                )}
              </div>
            ))}
          </div>
          <div className="input-group">
            <label>{t("saleInvoices.total")}: {total.toLocaleString()} {t("app.currency")}</label>
          </div>
          <div className="input-group">
            <label>{t("saleInvoices.paid")}</label>
            <input type="number" value={form.paid} onChange={(e) => setForm({ ...form, paid: e.target.value })} placeholder="0" />
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

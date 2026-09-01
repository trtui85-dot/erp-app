import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { http } from "../api";
import { useToast } from "../components/toast";
import { Modal, EmptyState, PageLoader, DataTable, SearchSelect } from "../components/ui";
import { Plus, Trash2, ClipboardList, Printer } from "lucide-react";

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

  const handlePrintA5 = async (inv) => {
    try {
      const res = await http.get(`/supplyinvoices/${inv.id}`);
      const data = res.data;
      const pw = window.open("", "_blank", "width=900,height=700");
      if (!pw) return;
      const items = data.items || [];
      const totalHT = items.reduce((s, it) => s + Number(it.qty || 0) * Number(it.purchase_price || 0), 0);
      const totalVente = items.reduce((s, it) => s + Number(it.qty || 0) * Number(it.sale_price || 0), 0);
      const margin = totalVente - totalHT;
      const now = new Date();
      const dateStr = now.toLocaleDateString("ar-MR", { year: "numeric", month: "long", day: "numeric" });
      const timeStr = now.toLocaleTimeString("ar-MR", { hour: "2-digit", minute: "2-digit" });

      pw.document.write(`<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="utf-8">
<style>
  @page { size: A4; margin: 15mm 20mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Calibri', 'Arial', sans-serif;
    font-size: 11pt;
    color: #1a1a2e;
    background: #fff;
    direction: rtl;
    text-align: right;
    line-height: 1.6;
  }

  .page {
    width: 170mm;
    min-height: 257mm;
    margin: 0 auto;
    padding: 15mm 0;
  }

  /* === HEADER === */
  .header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding-bottom: 20px;
    border-bottom: 3px solid #1a73e8;
    margin-bottom: 25px;
    position: relative;
  }
  .header::after {
    content: '';
    position: absolute;
    bottom: -6px;
    left: 0;
    right: 0;
    height: 1px;
    background: #1a73e8;
  }

  .company-info {
    text-align: right;
  }
  .company-name {
    font-size: 22pt;
    font-weight: 700;
    color: #1a73e8;
    margin-bottom: 4px;
    letter-spacing: 1px;
  }
  .company-sub {
    font-size: 10pt;
    color: #555;
    margin-bottom: 2px;
  }
  .company-contact {
    font-size: 9pt;
    color: #888;
  }

  .invoice-badge {
    background: linear-gradient(135deg, #1a73e8, #4a9af5);
    color: white;
    padding: 14px 24px;
    border-radius: 10px;
    text-align: center;
    min-width: 160px;
    box-shadow: 0 4px 12px rgba(26, 115, 232, 0.3);
  }
  .invoice-badge-title {
    font-size: 10pt;
    opacity: 0.9;
    margin-bottom: 4px;
  }
  .invoice-badge-code {
    font-size: 16pt;
    font-weight: 700;
    letter-spacing: 1px;
  }

  /* === INFO BOX === */
  .info-box {
    display: flex;
    gap: 20px;
    margin-bottom: 25px;
  }
  .info-card {
    flex: 1;
    background: #f8f9ff;
    border: 1px solid #e0e7ff;
    border-radius: 10px;
    padding: 14px 18px;
  }
  .info-card-label {
    font-size: 9pt;
    color: #888;
    margin-bottom: 4px;
    text-transform: uppercase;
    letter-spacing: 1px;
  }
  .info-card-value {
    font-size: 12pt;
    font-weight: 600;
    color: #1a1a2e;
  }

  /* === TABLE === */
  .items-table {
    width: 100%;
    border-collapse: separate;
    border-spacing: 0;
    margin-bottom: 20px;
    border-radius: 10px;
    overflow: hidden;
    border: 1px solid #e0e7ff;
  }
  .items-table thead th {
    background: #1a73e8;
    color: white;
    font-size: 9pt;
    font-weight: 600;
    padding: 12px 14px;
    text-align: right;
    letter-spacing: 0.5px;
  }
  .items-table thead th:first-child {
    text-align: center;
    width: 40px;
  }
  .items-table thead th:last-child {
    text-align: left;
  }
  .items-table tbody td {
    padding: 11px 14px;
    font-size: 10.5pt;
    border-bottom: 1px solid #f0f0f5;
    color: #333;
  }
  .items-table tbody tr:last-child td {
    border-bottom: none;
  }
  .items-table tbody tr:nth-child(even) {
    background: #fafbff;
  }
  .items-table tbody td:first-child {
    text-align: center;
    font-weight: 600;
    color: #1a73e8;
  }
  .items-table tbody td:last-child {
    text-align: left;
    font-weight: 600;
  }

  /* === TOTALS === */
  .totals-section {
    display: flex;
    justify-content: flex-start;
    margin-bottom: 25px;
  }
  .totals-box {
    width: 280px;
    border: 2px solid #1a73e8;
    border-radius: 10px;
    overflow: hidden;
  }
  .totals-row {
    display: flex;
    justify-content: space-between;
    padding: 10px 16px;
    font-size: 10pt;
  }
  .totals-row:not(:last-child) {
    border-bottom: 1px solid #f0f0f5;
  }
  .totals-row.grand {
    background: #1a73e8;
    color: white;
    font-weight: 700;
    font-size: 12pt;
    padding: 12px 16px;
  }
  .totals-label {
    color: #555;
  }
  .totals-row.grand .totals-label {
    color: white;
  }
  .totals-value {
    font-weight: 600;
    color: #1a1a2e;
  }
  .totals-row.grand .totals-value {
    color: white;
  }
  .margin-row {
    background: #e8f5e9;
  }
  .margin-row .totals-value {
    color: #2e7d32;
  }

  /* === NOTES === */
  .notes-box {
    background: #fffde7;
    border: 1px solid #fff9c4;
    border-right: 4px solid #f9a825;
    border-radius: 8px;
    padding: 12px 16px;
    margin-bottom: 25px;
    font-size: 10pt;
    color: #5d4037;
  }
  .notes-label {
    font-weight: 600;
    color: #e65100;
    margin-left: 6px;
  }

  /* === FOOTER === */
  .footer {
    border-top: 2px solid #e0e7ff;
    padding-top: 16px;
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
  }
  .footer-right {
    text-align: right;
  }
  .footer-left {
    text-align: left;
  }
  .footer-brand {
    font-size: 11pt;
    font-weight: 700;
    color: #1a73e8;
    margin-bottom: 4px;
  }
  .footer-sub {
    font-size: 8pt;
    color: #999;
  }
  .footer-date {
    font-size: 8pt;
    color: #999;
    text-align: left;
  }
  .stamp-area {
    margin-top: 30px;
    display: flex;
    justify-content: space-between;
    gap: 40px;
  }
  .stamp-box {
    flex: 1;
    border: 1px dashed #ccc;
    border-radius: 8px;
    padding: 20px;
    text-align: center;
    color: #bbb;
    font-size: 9pt;
    min-height: 80px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
</style>
</head>
<body>
<div class="page">

  <div class="header">
    <div class="company-info">
      <div class="company-name">SIR Solutions Informatiques Rapides</div>
      <div class="company-sub">الإدارة التجارية — نظام إدارة المبيعات والمشتريات</div>
      <div class="company-contact">هاتف: 22222222 | البريد: contact@sir.mr</div>
    </div>
    <div class="invoice-badge">
      <div class="invoice-badge-title">فاتورة شراء</div>
      <div class="invoice-badge-code">${data.invoice_code || "#" + data.id}</div>
    </div>
  </div>

  <div class="info-box">
    <div class="info-card">
      <div class="info-card-label">المورد</div>
      <div class="info-card-value">${data.supplier_name || "—"}</div>
    </div>
    <div class="info-card">
      <div class="info-card-label">تاريخ الفاتورة</div>
      <div class="info-card-value">${data.date || "—"}</div>
    </div>
    <div class="info-card">
      <div class="info-card-label">عدد الأصناف</div>
      <div class="info-card-value">${items.length} صنف</div>
    </div>
  </div>

  ${data.notes ? '<div class="notes-box"><span class="notes-label">ملاحظة:</span>' + data.notes + '</div>' : ''}

  <table class="items-table">
    <thead>
      <tr>
        <th>#</th>
        <th>الصنف</th>
        <th>الكمية</th>
        <th>الوحدة</th>
        <th>سعر الشراء</th>
        <th>سعر البيع</th>
        <th>المجموع الفرعي</th>
      </tr>
    </thead>
    <tbody>
      ${items.map((it, i) => '<tr><td>' + (i + 1) + '</td><td>' + (it.product_name || "") + '</td><td>' + Number(it.qty || 0).toLocaleString() + '</td><td>' + (it.unit || "") + '</td><td>' + Number(it.purchase_price || 0).toLocaleString() + ' MRU</td><td>' + Number(it.sale_price || 0).toLocaleString() + ' MRU</td><td>' + Number((it.qty || 0) * (it.purchase_price || 0)).toLocaleString() + ' MRU</td></tr>').join('')}
    </tbody>
  </table>

  <div class="totals-section">
    <div class="totals-box">
      <div class="totals-row">
        <span class="totals-label">المجموع الفرعي (شراء)</span>
        <span class="totals-value">${totalHT.toLocaleString()} MRU</span>
      </div>
      <div class="totals-row">
        <span class="totals-label">المجموع الفرعي (بيع)</span>
        <span class="totals-value">${totalVente.toLocaleString()} MRU</span>
      </div>
      <div class="totals-row margin-row">
        <span class="totals-label">هامش الربح</span>
        <span class="totals-value">${margin.toLocaleString()} MRU</span>
      </div>
      <div class="totals-row grand">
        <span class="totals-label">المجموع الكلي</span>
        <span class="totals-value">${totalHT.toLocaleString()} MRU</span>
      </div>
    </div>
  </div>

  <div class="stamp-area">
    <div class="stamp-box">ختم المورد</div>
    <div class="stamp-box">ختم الشركة</div>
    <div class="stamp-box">توقيع المستلم</div>
  </div>

  <div class="footer">
    <div class="footer-right">
      <div class="footer-brand">SIR Solutions Informatiques Rapides</div>
      <div class="footer-sub">SIR.MR — نظام الإدارة التجارية</div>
    </div>
    <div class="footer-left">
      <div class="footer-date">${dateStr} — ${timeStr}</div>
      <div class="footer-sub">تمت الطباعة عبر نظام SIR ERP</div>
    </div>
  </div>

</div>
</body>
</html>`);
      pw.document.close();
      setTimeout(() => { pw.print(); }, 500);
    } catch (err) { toast.error("Erreur impression"); }
  };

  const columns = [
    { label: t("supplyInvoices.supplier") },
    { label: t("app.date"), width: "110px" },
    { label: t("app.total"), width: "120px" },
    { label: "", width: "50px" },
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
              <td>
                <button className="icon-btn" onClick={() => handlePrintA5(inv)} title="Imprimer A5"><Printer size={16} /></button>
              </td>
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

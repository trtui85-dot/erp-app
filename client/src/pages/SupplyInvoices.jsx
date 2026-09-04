import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { http } from "../api";
import { useToast } from "../components/toast";
import { PageLoader, DataTable, SearchSelect } from "../components/ui";
import { Plus, Trash2, ClipboardList, Printer, Search, ChevronLeft, CalendarDays, UserPlus, X, Check, PackagePlus } from "lucide-react";

const UNIT_OPTS = ["kg", "g", "caissi", "sac", "carton", "bouteille", "pièce", "lot"];

function ProductPicker({ options, onPick }) {
  const { t } = useTranslation();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const results = (options || []).filter((p) => !q || p.name.toLowerCase().includes(q.toLowerCase())).slice(0, 8);
  return (
    <div style={{ position: "relative" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, border: "1px solid var(--gray-200)", borderRadius: "var(--radius-sm)", padding: "4px 10px", background: "white" }}>
        <Search size={16} style={{ color: "var(--gray-400)" }} />
        <input value={q} onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} placeholder={t("supplyInvoices.searchProduct") || "بحث عن منتج..."} style={{ flex: 1, padding: "8px 0", fontSize: "0.9rem" }} />
        {q && <X size={14} style={{ cursor: "pointer" }} onClick={() => setQ("")} />}
      </div>
      {open && results.length > 0 && (
        <div style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 30, background: "white", border: "1px solid var(--gray-200)", borderRadius: "var(--radius-sm)", boxShadow: "var(--shadow-lg)", maxHeight: 240, overflowY: "auto", marginTop: 4 }}>
          {results.map((p) => (
            <button key={p.id} type="button" style={{ display: "flex", justifyContent: "space-between", width: "100%", padding: "10px 12px", textAlign: "right", borderBottom: "1px solid var(--gray-100)" }} onClick={() => { onPick(p); setQ(""); setOpen(false); }}>
              <span style={{ fontWeight: 500 }}>{p.name}</span>
              {p.unit && <span style={{ color: "var(--gray-400)", fontSize: "0.78rem" }}>{p.unit}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function SupplyInvoices() {
  const { t } = useTranslation();
  const toast = useToast();
  const [invoices, setInvoices] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  const [addOpen, setAddOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [supplierId, setSupplierId] = useState("");
  const [newSupplierName, setNewSupplierName] = useState("");
  const [newSupplierPhone, setNewSupplierPhone] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState([]);
  const [costMode, setCostMode] = useState("per"); // per | total
  const [totalCost, setTotalCost] = useState("");
  const [loadingSold, setLoadingSold] = useState(false);

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
    setItems([]);
    setSupplierId("");
    setNewSupplierName("");
    setNewSupplierPhone("");
    setDate(new Date().toISOString().split("T")[0]);
    setNotes("");
    setCostMode("per");
    setTotalCost("");
    setAddOpen(true);
  };

  const addSoldProducts = async (days) => {
    setLoadingSold(true);
    try {
      const res = await http.get(`/products/sold?days=${days}`);
      const sold = res.data || [];
      if (sold.length === 0) { toast.error(t("supplyInvoices.noSold") || "لا توجد مبيعات في هذه الفترة"); return; }
      const existing = new Set(items.map((i) => i.product_id));
      const added = sold.filter((p) => !existing.has(p.product_id));
      if (added.length === 0) { toast.error(t("supplyInvoices.alreadyAdded") || "المنتجات موجودة بالفعل"); return; }
      setItems((prev) => [...prev, ...added.map((p) => ({
        product_id: p.product_id,
        name: p.product_name,
        unit: p.unit || "kg",
        qty: p.qty_sold || 1,
        sale_price: p.current_sale_price || "",
        purchase_price: "",
        expiry_date: "",
      }))]);
      setLoadingSold(false);
      toast.success(t("supplyInvoices.soldAdded") || "تمت إضافة المنتجات المباعة ✓");
    } catch (err) { toast.error(err.message || "Erreur"); setLoadingSold(false); }
  };

  const addManualProduct = (prod) => {
    if (items.some((i) => i.product_id === prod.id)) { toast.error(t("supplyInvoices.alreadyAdded") || "المنتج موجود بالفعل"); return; }
    setItems((prev) => [...prev, { product_id: prod.id, name: prod.name, unit: prod.unit || "kg", qty: 1, sale_price: prod.current_sale_price || "", purchase_price: "", expiry_date: "" }]);
  };

  const updateItem = (idx, field, value) => {
    setItems(items.map((it, i) => i === idx ? { ...it, [field]: value } : it));
  };

  const computePerItemCosts = () => {
    if (costMode === "per") return items;
    const total = Number(totalCost) || 0;
    const sumQty = items.reduce((s, it) => s + Number(it.qty || 0), 0) || 0;
    return items.map((it) => ({
      ...it,
      purchase_price: sumQty > 0 ? String(Math.round(((total * (Number(it.qty) || 0)) / sumQty) * 100) / 100) : it.purchase_price,
    }));
  };

  const finalTotal = costMode === "total"
    ? Number(totalCost) || 0
    : items.reduce((s, it) => s + (Number(it.qty || 0) * Number(it.purchase_price || 0)), 0);

  const effectiveItems = computePerItemCosts();
  const itemsTotal = effectiveItems.reduce((s, it) => s + (Number(it.qty || 0) * Number(it.purchase_price || 0)), 0);

  const handleSave = async () => {
    if (items.length === 0) return toast.error(t("supplyInvoices.noItems") || "أضف منتجات أولاً");
    setSaving(true);
    try {
      let finalSupplierId = supplierId;
      if (!finalSupplierId && newSupplierName.trim()) {
        const cr = await http.post("/suppliers", { name: newSupplierName.trim(), phone: newSupplierPhone.trim() || "00000000" });
        finalSupplierId = cr.data.id;
      }
      if (!finalSupplierId) { toast.error(t("supplyInvoices.selectSupplier")); setSaving(false); return; }

      const normalized = effectiveItems.map((it) => ({
        product_id: Number(it.product_id),
        qty: Number(it.qty) || 1,
        unit: it.unit || "kg",
        purchase_price: Number(it.purchase_price) || 0,
        sale_price: Number(it.sale_price) || Number(it.purchase_price) || 0,
        expiry_date: it.expiry_date || null,
      }));

      await http.post("/supplyinvoices", { supplier_id: finalSupplierId, date, notes, items: normalized });
      toast.success(t("supplyInvoices.batchCreated") + " ✓");
      setAddOpen(false);
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
      const printItems = data.items || [];
      const totalHT = printItems.reduce((s, it) => s + Number(it.qty || 0) * Number(it.purchase_price || 0), 0);
      const totalVente = printItems.reduce((s, it) => s + Number(it.qty || 0) * Number(it.sale_price || 0), 0);
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
  body { font-family: 'Calibri', 'Arial', sans-serif; font-size: 11pt; color: #1a1a2e; background: #fff; direction: rtl; text-align: right; line-height: 1.6; }
  .page { width: 170mm; min-height: 257mm; margin: 0 auto; padding: 15mm 0; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 20px; border-bottom: 3px solid #1a73e8; margin-bottom: 25px; position: relative; }
  .header::after { content: ''; position: absolute; bottom: -6px; left: 0; right: 0; height: 1px; background: #1a73e8; }
  .company-info { text-align: right; }
  .company-name { font-size: 22pt; font-weight: 700; color: #1a73e8; margin-bottom: 4px; }
  .company-sub { font-size: 10pt; color: #555; margin-bottom: 2px; }
  .company-contact { font-size: 9pt; color: #888; }
  .invoice-badge { background: linear-gradient(135deg, #1a73e8, #4a9af5); color: white; padding: 14px 24px; border-radius: 10px; text-align: center; min-width: 160px; box-shadow: 0 4px 12px rgba(26,115,232,0.3); }
  .invoice-badge-title { font-size: 10pt; opacity: 0.9; margin-bottom: 4px; }
  .invoice-badge-code { font-size: 16pt; font-weight: 700; }
  .info-box { display: flex; gap: 20px; margin-bottom: 25px; }
  .info-card { flex: 1; background: #f8f9ff; border: 1px solid #e0e7ff; border-radius: 10px; padding: 14px 18px; }
  .info-card-label { font-size: 9pt; color: #888; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 1px; }
  .info-card-value { font-size: 12pt; font-weight: 600; color: #1a1a2e; }
  .items-table { width: 100%; border-collapse: separate; border-spacing: 0; margin-bottom: 20px; border-radius: 10px; overflow: hidden; border: 1px solid #e0e7ff; }
  .items-table thead th { background: #1a73e8; color: white; font-size: 9pt; font-weight: 600; padding: 12px 14px; text-align: right; }
  .items-table thead th:first-child { text-align: center; width: 40px; }
  .items-table tbody td { padding: 11px 14px; font-size: 10.5pt; border-bottom: 1px solid #f0f0f5; color: #333; }
  .items-table tbody tr:last-child td { border-bottom: none; }
  .items-table tbody tr:nth-child(even) { background: #fafbff; }
  .items-table tbody td:first-child { text-align: center; font-weight: 600; color: #1a73e8; }
  .totals-section { display: flex; justify-content: flex-start; margin-bottom: 25px; }
  .totals-box { width: 280px; border: 2px solid #1a73e8; border-radius: 10px; overflow: hidden; }
  .totals-row { display: flex; justify-content: space-between; padding: 10px 16px; font-size: 10pt; }
  .totals-row:not(:last-child) { border-bottom: 1px solid #f0f0f5; }
  .totals-row.grand { background: #1a73e8; color: white; font-weight: 700; font-size: 12pt; padding: 12px 16px; }
  .totals-label { color: #555; }
  .totals-row.grand .totals-label { color: white; }
  .totals-value { font-weight: 600; color: #1a1a2e; }
  .totals-row.grand .totals-value { color: white; }
  .margin-row { background: #e8f5e9; }
  .margin-row .totals-value { color: #2e7d32; }
  .notes-box { background: #fffde7; border: 1px solid #fff9c4; border-right: 4px solid #f9a825; border-radius: 8px; padding: 12px 16px; margin-bottom: 25px; font-size: 10pt; color: #5d4037; }
  .notes-label { font-weight: 600; color: #e65100; margin-left: 6px; }
  .footer { border-top: 2px solid #e0e7ff; padding-top: 16px; display: flex; justify-content: space-between; align-items: flex-end; }
  .footer-right { text-align: right; }
  .footer-left { text-align: left; }
  .footer-brand { font-size: 11pt; font-weight: 700; color: #1a73e8; margin-bottom: 4px; }
  .footer-sub { font-size: 8pt; color: #999; }
  .footer-date { font-size: 8pt; color: #999; }
  .stamp-area { margin-top: 30px; display: flex; justify-content: space-between; gap: 40px; }
  .stamp-box { flex: 1; border: 1px dashed #ccc; border-radius: 8px; padding: 20px; text-align: center; color: #bbb; font-size: 9pt; min-height: 80px; display: flex; align-items: center; justify-content: center; }
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
    <div class="info-card"><div class="info-card-label">المورد</div><div class="info-card-value">${data.supplier_name || "—"}</div></div>
    <div class="info-card"><div class="info-card-label">تاريخ الفاتورة</div><div class="info-card-value">${data.date || "—"}</div></div>
    <div class="info-card"><div class="info-card-label">عدد الأصناف</div><div class="info-card-value">${printItems.length} صنف</div></div>
  </div>
  ${data.notes ? '<div class="notes-box"><span class="notes-label">ملاحظة:</span>' + data.notes + '</div>' : ''}
  <table class="items-table">
    <thead><tr><th>#</th><th>الصنف</th><th>الكمية</th><th>الوحدة</th><th>سعر الشراء</th><th>سعر البيع</th><th>المجموع الفرعي</th></tr></thead>
    <tbody>
      ${printItems.map((it, i) => '<tr><td>' + (i + 1) + '</td><td>' + (it.product_name || "") + '</td><td>' + Number(it.qty || 0).toLocaleString() + '</td><td>' + (it.unit || "") + '</td><td>' + Number(it.purchase_price || 0).toLocaleString() + ' MRU</td><td>' + Number(it.sale_price || 0).toLocaleString() + ' MRU</td><td>' + Number((it.qty || 0) * (it.purchase_price || 0)).toLocaleString() + ' MRU</td></tr>').join('')}
    </tbody>
  </table>
  <div class="totals-section"><div class="totals-box">
    <div class="totals-row"><span class="totals-label">المجموع الفرعي (شراء)</span><span class="totals-value">${totalHT.toLocaleString()} MRU</span></div>
    <div class="totals-row"><span class="totals-label">المجموع الفرعي (بيع)</span><span class="totals-value">${totalVente.toLocaleString()} MRU</span></div>
    <div class="totals-row margin-row"><span class="totals-label">هامش الربح</span><span class="totals-value">${margin.toLocaleString()} MRU</span></div>
    <div class="totals-row grand"><span class="totals-label">المجموع الكلي</span><span class="totals-value">${totalHT.toLocaleString()} MRU</span></div>
  </div></div>
  <div class="stamp-area"><div class="stamp-box">ختم المورد</div><div class="stamp-box">ختم الشركة</div><div class="stamp-box">توقيع المستلم</div></div>
  <div class="footer">
    <div class="footer-right"><div class="footer-brand">SIR Solutions Informatiques Rapides</div><div class="footer-sub">SIR.MR — نظام الإدارة التجارية</div></div>
    <div class="footer-left"><div class="footer-date">${dateStr} — ${timeStr}</div><div class="footer-sub">تمت الطباعة عبر نظام SIR ERP</div></div>
  </div>
</div>
</body></html>`);
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
      {addOpen ? (
        <div className="sup-add-page">
          <div className="page-header">
            <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1 }}>
              <button className="btn btn-ghost" onClick={() => setAddOpen(false)}><ChevronLeft size={18} /></button>
              <h1 className="page-title">{t("supplyInvoices.add")}</h1>
            </div>
          </div>

          {/* Supplier */}
          <div className="section">
            <div className="section-title" style={{ marginBottom: 8 }}>{t("supplyInvoices.supplier")}</div>
            <SearchSelect value={supplierId} onChange={setSupplierId} placeholder={t("supplyInvoices.selectSupplier")}
              options={suppliers.map((s) => ({ value: s.id, label: s.name }))} />
            {!supplierId && (
              <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
                <div style={{ flex: 1 }}><span className="sup-mini-label">{t("suppliers.name")}</span><input className="input-other" style={{ width: "100%" }} value={newSupplierName} onChange={(e) => setNewSupplierName(e.target.value)} placeholder={t("suppliers.new") || "اسم المورد الجديد"} /></div>
                <div style={{ flex: 1 }}><span className="sup-mini-label">{t("suppliers.phone")}</span><input className="input-other" style={{ width: "100%" }} value={newSupplierPhone} onChange={(e) => setNewSupplierPhone(e.target.value)} placeholder="36666666" /></div>
              </div>
            )}
            <div style={{ marginTop: 10 }}>
              <label style={{ fontSize: "0.75rem", color: "var(--gray-500)", display: "block", marginBottom: 4 }}>{t("supplyInvoices.date")}</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input-other" style={{ width: "100%" }} />
            </div>
          </div>

          {/* Quick add sold */}
          <div className="section" style={{ marginTop: 10 }}>
            <div className="section-title" style={{ marginBottom: 8 }}>{t("supplyInvoices.quickAdd") || "إضافة منتجات مباعة"}</div>
            <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => addSoldProducts(1)} disabled={loadingSold}>{t("supplyInvoices.today") || "اليوم"}</button>
              <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => addSoldProducts(4)} disabled={loadingSold}>{t("supplyInvoices.fourDays") || "4 أيام"}</button>
              <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => addSoldProducts(7)} disabled={loadingSold}>{t("supplyInvoices.week") || "الأسبوع"}</button>
            </div>
            <ProductPicker options={products} onPick={addManualProduct} />
          </div>

          {/* Items */}
          <div className="section" style={{ marginTop: 10 }}>
            <div className="section-title" style={{ marginBottom: 8 }}>{t("supplyInvoices.items")} — {items.length}</div>
            {items.length === 0 ? (
              <div style={{ textAlign: "center", color: "var(--gray-400)", padding: "18px 0", fontSize: "0.85rem" }}>{t("supplyInvoices.noItemsHint") || "اختر منتجات من المبيعات أو ابحث وأضف منتجًا"}</div>
            ) : items.map((it, idx) => (
              <div key={it.product_id} className="sup-item">
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                  <span style={{ fontWeight: 600, flex: 1 }}>{it.name}</span>
                  <button className="icon-btn icon-btn-danger" onClick={() => setItems(items.filter((_, i) => i !== idx))}><Trash2 size={16} /></button>
                </div>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <div style={{ display: "flex", flex: 1, gap: 4 }}>
                    {UNIT_OPTS.slice(0, 5).map((u) => (
                      <button key={u} type="button" className={`pos-unit-btn${it.unit === u ? " active" : ""}`} onClick={() => updateItem(idx, "unit", u)}>{u}</button>
                    ))}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                  <input className="input-other" style={{ flex: 1 }} type="number" step="any" min="0" value={it.qty} onChange={(e) => updateItem(idx, "qty", e.target.value)} placeholder={t("supplyInvoices.qty")} />
                  <input className="input-other" style={{ flex: 1 }} type="number" step="any" min="0" value={it.purchase_price} onChange={(e) => updateItem(idx, "purchase_price", e.target.value)} placeholder={t("supplyInvoices.purchasePrice")} />
                  <input className="input-other" style={{ flex: 1 }} type="number" step="any" min="0" value={it.sale_price} onChange={(e) => updateItem(idx, "sale_price", e.target.value)} placeholder={t("supplyInvoices.salePrice")} />
                </div>
                <div style={{ marginTop: 6 }}>
                  <input type="date" className="input-other" style={{ width: "100%" }} value={it.expiry_date} onChange={(e) => updateItem(idx, "expiry_date", e.target.value)} />
                </div>
              </div>
            ))}
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder={t("app.note")} className="input-other" style={{ width: "100%", marginTop: 8 }} />
          </div>

          {/* Cost mode */}
          <div className="section" style={{ marginTop: 10 }}>
            <div className="section-title" style={{ marginBottom: 8 }}>{t("supplyInvoices.costMode") || "طريقة إدخال التكلفة"}</div>
            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              <button className={`pos-paytype-btn${costMode === "per" ? " active" : ""}`} style={{ flex: 1 }} onClick={() => setCostMode("per")}>{t("supplyInvoices.costPer") || "سعر لكل منتج"}</button>
              <button className={`pos-paytype-btn${costMode === "total" ? " active" : ""}`} style={{ flex: 1 }} onClick={() => setCostMode("total")}>{t("supplyInvoices.costTotal") || "تكلفة كاملة"}</button>
            </div>
            {costMode === "total" && (
              <div>
                <input className="input-other" style={{ width: "100%" }} type="number" step="any" min="0" value={totalCost} onChange={(e) => setTotalCost(e.target.value)} placeholder={t("supplyInvoices.totalCost") || "التكلفة الكلية للفاتورة"} />
                <div style={{ fontSize: "0.72rem", color: "var(--gray-400)", marginTop: 4 }}>{t("supplyInvoices.totalDistributed") || "سيتم توزيعها على المنتجات حسب الكميات"} ≈ {itemsTotal.toLocaleString()} {t("app.currency")}</div>
              </div>
            )}
          </div>

          <div className="pos-total-card" style={{ marginTop: 10 }}>
            <div className="pos-total">
              <span>{t("app.total")}</span>
              <span className="pos-total-value">{finalTotal.toLocaleString()} {t("app.currency")}</span>
            </div>
          </div>

          <button className="btn btn-primary btn-block" style={{ marginTop: 12 }} disabled={saving || items.length === 0} onClick={handleSave}>
            <Check size={16} /> {saving ? "..." : t("supplyInvoices.save") || "حفظ الفاتورة"}
          </button>
        </div>
      ) : (
        <>
          <div className="page-header">
            <h1 className="page-title">{t("supplyInvoices.title")}</h1>
            <button className="btn btn-primary" onClick={openAdd}><Plus size={18} /> {t("supplyInvoices.add")}</button>
          </div>
          {loading ? <PageLoader /> : invoices.length === 0 ? (
            <button className="empty-click" onClick={openAdd} style={{ border: "none", width: "100%" }}>
              <ClipboardList size={40} style={{ color: "var(--gray-300)", marginBottom: 12 }} />
              <div style={{ color: "var(--gray-400)" }}>{t("supplyInvoices.noData")}</div>
            </button>
          ) : (
            <DataTable columns={columns}>
              {invoices.map((inv) => (
                <tr key={inv.id}>
                  <td className="card-cell-primary">{inv.supplier_name}</td>
                  <td>{inv.date}</td>
                  <td>{Number(inv.total).toLocaleString()} {t("app.currency")}</td>
                  <td><button className="icon-btn" onClick={() => handlePrintA5(inv)} title="طباعة A4"><Printer size={16} /></button></td>
                </tr>
              ))}
            </DataTable>
          )}
        </>
      )}
    </div>
  );
}

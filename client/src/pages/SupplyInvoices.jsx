import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { http } from "../api";
import { useToast } from "../components/toast";
import { PageLoader, DataTable, SearchSelect } from "../components/ui";
import { Plus, Trash2, ClipboardList, Printer, ChevronLeft, Check } from "lucide-react";
import ProductGrid, { useStockMap } from "../components/ProductGrid";

const UNIT_OPTS = ["كيل", "كيس", "الربطة", "بكط", "بطة", "بوش"];

export default function SupplyInvoices() {
  const { t } = useTranslation();
  const toast = useToast();
  const [invoices, setInvoices] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [batches, setBatches] = useState([]);
  const [categories, setCategories] = useState([]);
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

  const stockMap = useStockMap(batches);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [invRes, supRes, prodRes, batRes, catRes] = await Promise.all([
        http.get("/supplyinvoices"),
        http.get("/suppliers"),
        http.get("/products"),
        http.get("/batches").catch(() => ({ data: [] })),
        http.get("/categories").catch(() => ({ data: [] })),
      ]);
      setInvoices(invRes.data);
      setSuppliers(supRes.data);
      setProducts(prodRes.data);
      setBatches(batRes.data);
      setCategories(catRes.data);
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
        stock: stockMap[`p_${p.product_id}`] || 0,
        qty: p.qty_sold || 1,
        sale_price: p.current_sale_price || "",
        purchase_price: "",
        expiry_date: "",
      }))]);
      setLoadingSold(false);
      toast.success(t("supplyInvoices.soldAdded") || "تمت إضافة المنتجات المباعة ✓");
    } catch (err) { toast.error(err.message || "Erreur"); setLoadingSold(false); }
  };

  const addManualProduct = (prod, entry) => {
    const unit = entry ? (entry.unit || prod.unit || "كيس") : (prod.unit || "كيس");
    const unitId = entry ? (entry.product_unit_id || null) : null;
    if (items.some((i) => i.product_id === prod.id && (i.product_unit_id || null) === unitId)) { toast.error(t("supplyInvoices.alreadyAdded") || "المنتج موجود بالفعل"); return; }
    setItems((prev) => [...prev, {
      product_id: prod.id,
      product_unit_id: unitId,
      name: prod.name,
      unit,
      stock: entry ? entry.stock : undefined,
      qty: 1,
      sale_price: entry && entry.price > 0 ? entry.price : (prod.current_sale_price || ""),
      purchase_price: "",
      expiry_date: "",
    }]);
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
        product_unit_id: it.product_unit_id ? Number(it.product_unit_id) : null,
        qty: Number(it.qty) || 1,
        unit: it.unit || "كيس",
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
      const dateP = data.date || "";
      const rows = printItems.length ? printItems : [];

      pw.document.write(`<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
<style>
  * { box-sizing: border-box; }
  @page { size: A4; margin: 0; }
  body { margin: 0; padding: 20px; background: #e9edf2; font-family: "Cairo", Arial, sans-serif; color: #123b70; }
  .invoice { width: 210mm; min-height: 297mm; margin: auto; background: #fff; position: relative; overflow: hidden; border: 1px solid #123b70; padding: 12mm; }
  .top-decoration { position: absolute; top: 0; right: 0; left: 0; height: 35px; background: #123b70; clip-path: polygon(0 0,100% 0,100% 100%,75% 100%,70% 50%,45% 100%,0 100%); }
  .footer-decoration { position: absolute; bottom: 0; right: 0; left: 0; height: 34px; background: #123b70; clip-path: polygon(0 40%,18% 0,48% 75%,72% 10%,100% 0,100% 100%,0 100%); }
  .header { margin-top: 15px; border-bottom: 3px solid #123b70; padding-bottom: 10px; position: relative; }
  .header-content { display: grid; grid-template-columns: 1fr 2fr 1fr; align-items: center; gap: 15px; }
  .contact { text-align: center; font-size: 15px; font-weight: 700; line-height: 2; }
  .contact-row { display: flex; justify-content: center; align-items: center; gap: 7px; }
  .icon { width: 23px; height: 23px; border-radius: 50%; background: #123b70; color: white; display: inline-flex; justify-content: center; align-items: center; font-size: 13px; }
  .institution { text-align: center; }
  .institution-small { font-size: 19px; font-weight: 700; margin-bottom: 0; }
  .institution-name { font-size: 26px; font-weight: 900; line-height: 1.25; margin: 0; }
  .institution-line { width: 80%; height: 3px; background: #123b70; margin: 7px auto; position: relative; }
  .institution-line::after { content: ""; width: 9px; height: 9px; background: #123b70; transform: rotate(45deg); position: absolute; left: 50%; top: -3px; }
  .invoice-title { background: #123b70; color: white; padding: 10px 18px; text-align: center; font-size: 20px; font-weight: 800; position: relative; clip-path: polygon(8% 0,100% 0,100% 100%,8% 100%,0 50%); }
  .invoice-title span { display: block; }
  .invoice-info { margin-top: 8px; text-align: center; font-size: 14px; font-weight: 700; line-height: 2; }
  .line { display: inline-block; min-width: 95px; border-bottom: 1px dotted #555; margin-right: 5px; }
  .supplier { margin-top: 18px; display: grid; grid-template-columns: 1fr 1fr; gap: 8px 30px; font-size: 14px; font-weight: 700; }
  .field { border-bottom: 1px dotted #777; padding-bottom: 4px; min-height: 30px; }
  .products { width: 100%; border-collapse: collapse; margin-top: 14px; font-size: 12px; }
  .products th { background: #123b70; color: #fff; padding: 8px 4px; border: 1px solid #123b70; font-weight: 800; white-space: nowrap; }
  .products td { height: 27px; border: 1px solid #a9b8ca; text-align: center; padding: 3px; }
  .products tbody tr:nth-child(even) { background: #f7f9fc; }
  .number { width: 35px; }
  .product-name { width: 36%; text-align: right !important; padding-right: 8px !important; }
  .unit { width: 12%; }
  .quantity { width: 12%; }
  .unit-price { width: 16%; }
  .total { width: 18%; }
  .bottom { margin-top: 14px; display: grid; grid-template-columns: 1fr 1.5fr; gap: 28px; align-items: start; }
  .summary { border: 1px solid #9baabd; width: 100%; }
  .summary-row { display: grid; grid-template-columns: 1fr 105px; min-height: 32px; border-bottom: 1px solid #fff; }
  .summary-row:last-child { border-bottom: 0; }
  .summary-label { background: #123b70; color: #fff; padding: 5px; font-size: 13px; font-weight: 800; text-align: right; }
  .summary-value { padding: 5px; text-align: center; font-weight: 700; font-size: 13px; }
  .notes { border: 1px solid #7890ad; border-radius: 7px; min-height: 95px; padding: 7px 10px; }
  .notes-title { font-size: 14px; font-weight: 800; }
  .notes-body { font-size: 12px; font-weight: 600; margin-top: 6px; }
  .signature { text-align: center; margin-top: 18px; font-weight: 800; font-size: 13px; }
  .signature-line { width: 150px; border-bottom: 1px dotted #555; margin: 17px auto 0; }
  @media print { body { background: white; padding: 0; } .invoice { width: 210mm; min-height: 297mm; border: 1px solid #123b70; margin: 0; } * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; } }
  @media screen and (max-width: 850px) { body { padding: 0; overflow-x: auto; } .invoice { margin: 10px; } }
</style>
</head>
<body>
<div class="invoice">
  <div class="top-decoration"></div>
  <header class="header">
    <div class="header-content">
      <div class="contact">
        <div class="contact-row"><span class="icon">☎</span><span>رقم المحل : 22222222</span></div>
        <div class="contact-row"><span class="icon">●</span><span>الموقع : انواكشوط</span></div>
      </div>
      <div class="institution">
        <div class="institution-small">مؤسسة</div>
        <div class="institution-name">احمد سالم سيده</div>
        <div class="institution-line"></div>
      </div>
      <div>
        <div class="invoice-title"><span>فاتورة شراء</span><span>منتجات</span></div>
        <div class="invoice-info">رقم الفاتورة : <span class="line">${data.invoice_code || "#" + data.id}</span><br>التاريخ : <span class="line">${dateP}</span></div>
      </div>
    </div>
  </header>
  <section class="supplier">
    <div class="field">اسم المورد : ${data.supplier_name || ""}</div>
    <div class="field">رقم الهاتف : ${data.supplier_phone || ""}</div>
    <div class="field">العنوان : </div>
    <div class="field">رقم التعريف الضريبي : </div>
  </section>
  <table class="products">
    <thead><tr><th class="number">م</th><th class="product-name">اسم المنتج</th><th class="unit">الوحدة</th><th class="quantity">الكمية</th><th class="unit-price">سعر الوحدة</th><th class="total">الإجمالي</th></tr></thead>
    <tbody>
      ${rows.length ? rows.map((it, i) => '<tr><td>' + (i + 1) + '</td><td class="product-name">' + (it.product_name || "") + '</td><td>' + (it.unit || "") + '</td><td>' + Number(it.qty || 0).toLocaleString() + '</td><td>' + Number(it.purchase_price || 0).toLocaleString() + '</td><td>' + Number((it.qty || 0) * (it.purchase_price || 0)).toLocaleString() + '</td></tr>').join('') : Array.from({length: 9}, (_, i) => '<tr><td>' + (i + 1) + '</td><td></td><td></td><td></td><td></td><td></td></tr>').join('')}
    </tbody>
  </table>
  <section class="bottom">
    <div>
      <div class="notes"><div class="notes-title">ملاحظات :</div><div class="notes-body">${data.notes || ""}</div></div>
      <div class="signature">توقيع وختم المؤسسة<div class="signature-line"></div></div>
    </div>
    <div class="summary">
      <div class="summary-row"><div class="summary-label">المجموع الفرعي</div><div class="summary-value">${totalHT.toLocaleString()}</div></div>
      <div class="summary-row"><div class="summary-label">الخصم</div><div class="summary-value">0</div></div>
      <div class="summary-row"><div class="summary-label">ضريبة أخرى</div><div class="summary-value">0</div></div>
      <div class="summary-row"><div class="summary-label">الإجمالي الكلي</div><div class="summary-value">${totalHT.toLocaleString()}</div></div>
    </div>
  </section>
  <div class="footer-decoration"></div>
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
            <ProductGrid products={products} batches={batches} categories={categories} onPick={addManualProduct} />
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
                  {!(it.stock === undefined) && (
                    <span style={{ fontSize: "0.73rem", color: "var(--gray-500)" }}>{t("pos.stock")}: <b>{it.stock} {it.unit}</b></span>
                  )}
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

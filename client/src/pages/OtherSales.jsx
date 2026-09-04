import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { http } from "../api";
import { useToast } from "../components/toast";
import { PageLoader, SearchSelect } from "../components/ui";
import { Plus, Trash2, Check, X, Wallet, Smartphone, CreditCard, Building2, Send, Banknote, Printer, ChevronLeft, ListPlus } from "lucide-react";

const emptyOtherItem = { product_name: "", unit: "kg", qty: 1, price: "" };
const UNITS = ["kg", "g", "caissi", "sac", "pièce", "carton", "bouteille", "lot"];

const METHOD_ICONS = { Wallet, Smartphone, CreditCard, Building2, Send, Banknote };

export default function OtherSales() {
  const { t } = useTranslation();
  const toast = useToast();
  const navigate = useNavigate();
  const [customers, setCustomers] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([{ ...emptyOtherItem }]);
  const [payment, setPayment] = useState(null);
  const [payType, setPayType] = useState("full");
  const [customer, setCustomer] = useState(null);
  const [saving, setSaving] = useState(false);
  const [lastInvoice, setLastInvoice] = useState(null);
  const [openSuggest, setOpenSuggest] = useState(-1);
  const suggestRef = useRef(null);

  useEffect(() => {
    Promise.all([
      http.get("/customers").catch(() => ({ data: [] })),
      http.get("/paymentmethods").catch(() => ({ data: [] })),
      http.get("/products").catch(() => ({ data: [] })),
    ]).then(([cRes, pmRes, pRes]) => {
      setCustomers(cRes.data);
      setPaymentMethods(pmRes.data);
      setProducts(pRes.data);
      if (pmRes.data.length > 0) setPayment(pmRes.data[0]);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const productNames = products.map((p) => p.name);

  const updateItem = (idx, field, value) => {
    setItems(items.map((it, i) => i === idx ? { ...it, [field]: value } : it));
  };

  const pickExisting = (idx, name) => {
    const prod = products.find((p) => p.name === name);
    setItems(items.map((it, i) => i === idx ? {
      ...it,
      product_name: name,
      unit: prod?.unit || it.unit,
      price: prod?.current_sale_price ? prod.current_sale_price : it.price,
    } : it));
    setOpenSuggest(-1);
  };

  const total = items.reduce((s, it) => s + Number(it.qty || 0) * Number(it.price || 0), 0);
  const paid = payType === "full" ? total : payType === "half" ? total / 2 : 0;

  const handleSave = async () => {
    const valid = items.filter((it) => it.product_name.trim() && Number(it.qty) > 0 && Number(it.price) >= 0);
    if (valid.length === 0) return toast.error(t("pos.cartEmpty"));
    setSaving(true);
    try {
      const existingNames = new Set(products.map((p) => p.name.trim().toLowerCase()));
      const toCreate = valid.filter((it) => !existingNames.has(it.product_name.trim().toLowerCase()));
      for (const it of toCreate) {
        try {
          await http.post("/products", {
            name: it.product_name.trim(),
            unit: it.unit || "kg",
            price_type: "fixed",
            current_sale_price: Number(it.price) || 0,
          });
        } catch {}
      }
      const payload = {
        customer_id: customer?.id || null,
        date: new Date().toISOString().split("T")[0],
        type: "other",
        paid,
        payment_method_id: payment?.id || null,
        items: valid.map((it) => ({ product_name: it.product_name.trim(), unit: it.unit || "kg", qty: Number(it.qty), price: Number(it.price) })),
      };
      const res = await http.post("/saleinvoices", payload);
      setLastInvoice(res.data);
      toast.success("✓ " + t("pos.invoiceSaved"));
      setItems([{ ...emptyOtherItem }]);
      http.get("/products").then((d) => setProducts(d.data)).catch(() => {});
    } catch (err) { toast.error(err.message || "Erreur"); }
    finally { setSaving(false); }
  };

  const handlePrint = () => {
    if (!lastInvoice) return;
    const printWindow = window.open("", "_blank", "width=320,height=600");
    if (!printWindow) return;
    const itemsToPrint = lastInvoice.items || [];
    const totalVal = lastInvoice.total;
    const custName = lastInvoice.customer_name || customer?.name || "";
    const code = lastInvoice.invoice_code || "";
    const date = lastInvoice.date || new Date().toISOString().split("T")[0];
    const paymentName = payment?.name || "";

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
    <style>
      @page{size:72mm auto;margin:2mm;}
      *{margin:0;padding:0;box-sizing:border-box;}
      body{font-family:'IBM Plex Sans Arabic','Courier New',monospace;font-size:10px;width:68mm;padding:2mm;text-align:center;color:#111;}
      .line{border-top:1px dashed #999;margin:3mm 0;}
      .bold{font-weight:700;font-size:11px;}
      .small{font-size:8px;color:#666;}
      table{width:100%;border-collapse:collapse;margin:2mm 0;}
      td,th{padding:1mm 0;font-size:9px;text-align:left;}
      th{border-bottom:1px solid #111;font-size:8px;text-transform:uppercase;}
      .r{text-align:right;}
    </style></head><body>
    <div class="bold" style="font-size:14px;">${t("app.title")}</div>
    <div class="small">${t("pos.otherMode")} | ${date} | ${code}</div>
    <div class="line"></div>
    <div class="small">${t("pos.customer")}: ${custName}</div>
    <div class="small">${t("pos.paymentMethod")}: ${paymentName}</div>
    <div class="line"></div>
    <table>
      <tr><th>${t("pos.article")}</th><th class="r">${t("pos.qty")}</th><th class="r">${t("pos.price")}</th><th class="r">${t("pos.total")}</th></tr>
      ${itemsToPrint.map((it) => `<tr><td>${it.product_name || ""}</td><td class="r">${Number(it.qty).toLocaleString()}${it.unit ? " " + it.unit : ""}</td><td class="r">${Number(it.price).toLocaleString()}</td><td class="r">${(Number(it.qty) * Number(it.price)).toLocaleString()}</td></tr>`).join("")}
    </table>
    <div class="line"></div>
    <table>
      <tr><td class="bold">TOTAL</td><td class="r bold" style="font-size:13px;">${Number(totalVal).toLocaleString()} ${t("app.currency")}</td></tr>
    </table>
    <div class="line"></div>
    <div class="small">Solutions Informatiques Rapides - SIR.MR</div>
    </body></html>`;
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.print();
  };

  if (loading) return <PageLoader />;

  return (
    <div className="page-container">
      <div className="page-header">
        <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1 }}>
          <button className="btn btn-ghost" onClick={() => navigate("/pos")}><ChevronLeft size={18} /></button>
          <h1 className="page-title"><ListPlus size={20} style={{ verticalAlign: "-3px" }} /> {t("pos.otherMode")}</h1>
        </div>
      </div>

      <div className="section">
        <div className="section-title" style={{ marginBottom: 10 }}>{t("pos.otherItems")} — {items.length}</div>
        {items.map((it, idx) => {
          const suggestions = it.product_name.trim()
            ? productNames.filter((n) => n.toLowerCase().includes(it.product_name.trim().toLowerCase())).slice(0, 6)
            : productNames.slice(0, 6);
          return (
            <div key={idx} className="pos-other-card" ref={(el) => { if (idx === openSuggest) suggestRef.current = el; }}>
              <div className="pos-other-suggest-wrap">
                <input className="input-other" style={{ width: "100%" }} placeholder={t("pos.otherProductName")} value={it.product_name}
                  onChange={(e) => { updateItem(idx, "product_name", e.target.value); setOpenSuggest(idx); }}
                  onFocus={() => setOpenSuggest(idx)} />
                {openSuggest === idx && suggestions.length > 0 && (
                  <div className="pos-other-suggest">
                    {suggestions.map((n) => (
                      <button type="button" key={n} className="pos-other-suggest-item" onClick={() => pickExisting(idx, n)}>{n}</button>
                    ))}
                  </div>
                )}
              </div>
              <div className="pos-other-units">
                {UNITS.map((u) => (
                  <button key={u} type="button" className={`pos-unit-btn${it.unit === u ? " active" : ""}`} onClick={() => updateItem(idx, "unit", u)}>{u}</button>
                ))}
              </div>
              <div className="pos-other-fields">
                <input className="input-other" style={{ flex: 1 }} type="number" step="any" min="0" placeholder={t("pos.qty")} value={it.qty}
                  onChange={(e) => updateItem(idx, "qty", e.target.value)} />
                <input className="input-other" style={{ flex: 1 }} type="number" step="any" min="0" placeholder={t("pos.price")} value={it.price}
                  onChange={(e) => updateItem(idx, "price", e.target.value)} />
                <button type="button" className="icon-btn icon-btn-danger" onClick={() => setItems(items.filter((_, i) => i !== idx))}><Trash2 size={16} /></button>
              </div>
            </div>
          );
        })}
        <button type="button" className="btn btn-ghost btn-block" style={{ marginTop: 4 }} onClick={() => setItems([...items, { ...emptyOtherItem }])}>
          <Plus size={14} /> {t("supplyInvoices.addItem")}
        </button>
      </div>

      <div className="section" style={{ marginTop: 16 }}>
        <div className="input-group">
          <label>{t("pos.customer")}</label>
          <SearchSelect compact value={customer?.id || ""} onChange={(v) => setCustomer(v ? customers.find((c) => c.id === Number(v)) || null : null)}
            options={[{ value: "", label: t("pos.noCustomer") || "Client (optionnel)" }, ...customers.map((c) => ({ value: c.id, label: c.name }))]} />
        </div>

        <div className="section-title" style={{ margin: "14px 0 8px" }}>{t("pos.paymentMethod")}</div>
        <div className="pos-payment-methods">
          {paymentMethods.map((pm) => {
            const Ic = METHOD_ICONS[pm.icon] || Wallet;
            return (
              <button key={pm.id} className={`pos-payment-btn${payment?.id === pm.id ? " active" : ""}`} onClick={() => setPayment(pm)} style={payment?.id === pm.id ? { borderColor: pm.color, background: pm.color + "11" } : {}}>
                {pm.logo_url ? (
                  <img src={pm.logo_url} alt={pm.name} style={{ width: 22, height: 22, borderRadius: 6, objectFit: "cover" }} />
                ) : (
                  <Ic size={18} color={pm.color} />
                )}
                <span>{pm.name}</span>
              </button>
            );
          })}
        </div>

        <div className="pos-other-pay">
          <button type="button" className={`pos-paytype-btn${payType === "full" ? " active" : ""}`} onClick={() => setPayType("full")}>{t("pos.full")}</button>
          <button type="button" className={`pos-paytype-btn${payType === "half" ? " active" : ""}`} onClick={() => setPayType("half")}>{t("pos.half")}</button>
        </div>

        <div className="pos-total-card">
          <div className="pos-total">
            <span>{t("pos.total")}</span>
            <span className="pos-total-value">{total.toLocaleString()} {t("app.currency")}</span>
          </div>
          {payType === "half" && (
            <div className="pos-total" style={{ marginTop: 2 }}>
              <span>{t("pos.amountDue")}</span>
              <span className="pos-total-value">{paid.toLocaleString()} {t("app.currency")}</span>
            </div>
          )}
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
          <button type="button" className="btn btn-primary" style={{ flex: 1 }} disabled={saving} onClick={handleSave}>
            <Check size={16} /> {saving ? "..." : `${t("pos.pay")} — ${paid.toLocaleString()} ${t("app.currency")}`}
          </button>
        </div>

        {lastInvoice && (
          <div className="pos-print-bar" style={{ marginTop: 10 }}>
            <button className="btn btn-primary btn-block" onClick={handlePrint}><Printer size={16} /> {t("pos.printReceipt")}</button>
            <button className="btn btn-ghost" onClick={() => setLastInvoice(null)}><X size={16} /></button>
          </div>
        )}
      </div>
    </div>
  );
}
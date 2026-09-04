import { useState, useEffect, useRef, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { http } from "../api";
import { useToast } from "../components/toast";
import { PageLoader, Modal, SearchSelect } from "../components/ui";
import { ShoppingCart, Plus, Minus, Trash2, User, CreditCard, Printer, Search, X, Check, Wallet, Smartphone, Building2, Send, Banknote, ArrowDownCircle, FileText, Maximize2, Minimize2, ListPlus } from "lucide-react";

const METHOD_ICONS = { Wallet, Smartphone, CreditCard, Building2, Send, Banknote };

export default function POS() {
  const { t } = useTranslation();
  const toast = useToast();
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [batches, setBatches] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [recentInvoices, setRecentInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [saving, setSaving] = useState(false);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: "", phone: "" });
  const [lastInvoice, setLastInvoice] = useState(null);
  const [selectedRecent, setSelectedRecent] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const receiptRef = useRef(null);

  useEffect(() => {
    if (fullscreen) {
      document.body.classList.add("pos-fullscreen");
    } else {
      document.body.classList.remove("pos-fullscreen");
    }
    return () => document.body.classList.remove("pos-fullscreen");
  }, [fullscreen]);

  useEffect(() => {
    Promise.all([
      http.get("/products"),
      http.get("/batches"),
      http.get("/customers"),
      http.get("/paymentmethods"),
      http.get("/saleinvoices"),
      http.get("/categories").catch(() => ({ data: [] })),
    ]).then(([pRes, bRes, cRes, pmRes, siRes, catRes]) => {
      setProducts(pRes.data);
      setBatches(bRes.data);
      setCustomers(cRes.data);
      setPaymentMethods(pmRes.data);
      setRecentInvoices(siRes.data.slice(0, 10));
      setCategories(catRes.data);
      if (pmRes.data.length > 0) setSelectedPayment(pmRes.data[0]);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const availableProducts = useMemo(() => {
    const map = {};
    batches.forEach((b) => {
      if (b.status === "active" && Number(b.remaining_qty) > 0) {
        const key = b.product_unit_id ? `u_${b.product_unit_id}` : `p_${b.product_id}`;
        if (!map[key]) {
          const prod = products.find((x) => x.id === b.product_id);
          const unitObj = (prod && prod.units && prod.units.find((u) => u.id === b.product_unit_id)) || null;
          map[key] = {
            ...b,
            total_stock: 0,
            product_id: b.product_id,
            product_unit_id: b.product_unit_id || null,
            unit: unitObj ? unitObj.unit : b.unit,
            product_name: b.product_name,
            category_id: b.category_id,
            current_sale_price: (unitObj && Number(unitObj.current_sale_price) > 0) ? Number(unitObj.current_sale_price) : (prod?.current_sale_price || b.sale_price),
          };
        }
        map[key].total_stock += Number(b.remaining_qty);
      }
    });
    return Object.values(map).filter((p) => {
      if (search && !p.product_name.toLowerCase().includes(search.toLowerCase())) return false;
      if (selectedCategory && p.category_id !== selectedCategory) return false;
      return true;
    });
  }, [batches, products, search, selectedCategory]);

  const addToCart = (product) => {
    const exKey = product.product_unit_id ? `u_${product.product_unit_id}` : `p_${product.product_id}`;
    const existing = cart.find((c) => c.cart_key === exKey);
    if (existing) {
      setCart(cart.map((c) => c.cart_key === exKey ? { ...c, qty: c.qty + 1 } : c));
    } else {
      const batch = batches.find((b) => b.status === "active" && Number(b.remaining_qty) > 0 && (b.product_unit_id ? b.product_unit_id === product.product_unit_id : b.product_id === product.product_id));
      setCart([...cart, {
        cart_key: exKey,
        product_id: product.product_id,
        product_unit_id: product.product_unit_id || null,
        product_name: product.unit ? `${product.product_name} (${product.unit})` : product.product_name,
        unit: product.unit,
        batch_id: batch?.id,
        qty: 1,
        price: Number(product.current_sale_price || batch?.sale_price || 0),
        max_qty: Number(batch?.remaining_qty || 0),
      }]);
    }
  };

  const updateQty = (key, delta) => {
    setCart(cart.map((c) => {
      if (c.cart_key !== key) return c;
      const newQty = c.qty + delta;
      if (newQty <= 0) return null;
      if (newQty > c.max_qty) { toast.error(t("pos.insufficientStock")); return c; }
      return { ...c, qty: newQty };
    }).filter(Boolean));
  };

  const removeFromCart = (key) => setCart(cart.filter((c) => c.cart_key !== key));

  const total = cart.reduce((s, c) => s + c.qty * c.price, 0);

  const handleQuickAddCustomer = async () => {
    if (!newCustomer.name) return;
    try {
      const res = await http.post("/customers", newCustomer);
      const fresh = await http.get("/customers");
      setCustomers(fresh.data);
      setSelectedCustomer(fresh.data.find((c) => c.name === newCustomer.name));
      setShowCustomerModal(false);
      setNewCustomer({ name: "", phone: "" });
      toast.success(t("app.add") + " ✓");
    } catch (err) { toast.error(err.message); }
  };

  const handleSave = async () => {
    if (cart.length === 0) return toast.error(t("pos.cartEmpty"));
    setSaving(true);
    try {
      const payload = {
        customer_id: selectedCustomer?.id || null,
        date: new Date().toISOString().split("T")[0],
        type: "retail",
        paid: total,
        payment_method_id: selectedPayment?.id || null,
        items: cart.map((c) => ({ batch_id: c.batch_id, qty: c.qty, price: c.price })),
      };
      const res = await http.post("/saleinvoices", payload);
      setLastInvoice(res.data);
      setCart([]);
      const fresh = await http.get("/saleinvoices");
      setRecentInvoices(fresh.data.slice(0, 10));
      const freshB = await http.get("/batches");
      setBatches(freshB.data);
      toast.success("✓ " + t("pos.invoiceSaved"));
    } catch (err) { toast.error(err.message || "Erreur"); }
    finally { setSaving(false); }
  };

  const handlePrintInvoice = async (inv) => {
    try {
      const res = await http.get(`/saleinvoices/${inv.id}`);
      const data = res.data;
      const pw = window.open("", "_blank", "width=320,height=600");
      if (!pw) return;
      pw.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8">
        <style>@page{size:72mm auto;margin:2mm;}*{margin:0;padding:0;box-sizing:border-box;}body{font-family:'Courier New',monospace;font-size:10px;width:68mm;padding:2mm;text-align:center;color:#111;}.line{border-top:1px dashed #999;margin:3mm 0;}.bold{font-weight:700;font-size:11px;}.small{font-size:8px;color:#666;}table{width:100%;border-collapse:collapse;margin:2mm 0;}td,th{padding:1mm 0;font-size:9px;text-align:left;}th{border-bottom:1px solid #111;font-size:8px;text-transform:uppercase;}.r{text-align:right;}</style></head><body>
        <div class="bold" style="font-size:14px;">مؤسسة احمد سالم سيده</div>
        <div class="small">${data.date} | ${data.invoice_code || ""}</div>
        <div class="line"></div>
        <div class="small">Client: ${data.customer_name || ""}</div>
        <div class="small">Paiement: ${data.payment_method_name || ""}</div>
        <div class="line"></div>
        <table><tr><th>${t("pos.article")}</th><th class="r">Qté</th><th class="r">Prix</th><th class="r">Total</th></tr>
        ${(data.items || []).map(it => `<tr><td>${it.product_name||""}</td><td class="r">${it.qty}</td><td class="r">${Number(it.price).toLocaleString()}</td><td class="r">${Number(it.total).toLocaleString()}</td></tr>`).join("")}
        </table>
        <div class="line"></div>
        <table><tr><td class="bold">TOTAL</td><td class="r bold" style="font-size:13px;">${Number(data.total).toLocaleString()} ${t("app.currency")}</td></tr></table>
        <div class="line"></div>
        <div class="small">SIR.MR</div></body></html>`);
      pw.document.close();
      pw.print();
    } catch {}
  };

  const handleDeleteRecent = async () => {
    if (!selectedRecent) return;
    setDeleting(true);
    try {
      await http.delete(`/saleinvoices/${selectedRecent.id}`);
      toast.success(t("app.delete") + " ✓");
      setSelectedRecent(null);
      Promise.all([http.get("/batches"), http.get("/saleinvoices")]).then(([bRes, sRes]) => {
        setBatches(bRes.data);
        setRecentInvoices(sRes.data.slice(0, 10));
      });
    } catch (err) { toast.error(err.message || "Erreur"); }
    finally { setDeleting(false); }
  };

  const handlePrint = () => {
    const printWindow = window.open("", "_blank", "width=320,height=600");
    if (!lastInvoice || !printWindow) return;
    const items = cart.length > 0 ? cart : (lastInvoice.items || []);
    const totalVal = cart.length > 0 ? total : lastInvoice.total;
    const custName = selectedCustomer?.name || lastInvoice.customer_name || "";
    const code = lastInvoice.invoice_code || "";
    const date = lastInvoice.date || new Date().toISOString().split("T")[0];
    const paymentName = selectedPayment?.name || "";

    let html = `<!DOCTYPE html><html><head><meta charset="utf-8">
    <style>
      @page{size:72mm auto;margin:2mm;}
      *{margin:0;padding:0;box-sizing:border-box;}
      body{font-family:'Courier New',monospace;font-size:10px;width:68mm;padding:2mm;text-align:center;color:#111;}
      .line{border-top:1px dashed #999;margin:3mm 0;}
      .bold{font-weight:700;font-size:11px;}
      .small{font-size:8px;color:#666;}
      table{width:100%;border-collapse:collapse;margin:2mm 0;}
      td,th{padding:1mm 0;font-size:9px;text-align:left;}
      th{border-bottom:1px solid #111;font-size:8px;text-transform:uppercase;}
      .r{text-align:right;}
      .total-line{border-top:2px solid #111;font-weight:700;font-size:12px;padding-top:2mm;}
    </style></head><body>
    <div class="bold" style="font-size:14px;">مؤسسة احمد سالم سيده</div>
    <div class="small">${date} | ${code}</div>
    <div class="line"></div>
    <div class="small">Client: ${custName}</div>
    <div class="small">Paiement: ${paymentName}</div>
    <div class="line"></div>
    <table>
      <tr><th>${t("pos.article")}</th><th class="r">${t("pos.qty")}</th><th class="r">${t("pos.price")}</th><th class="r">${t("pos.total")}</th></tr>
      ${items.map((it) => `<tr><td>${it.product_name || ""}</td><td class="r">${it.qty}</td><td class="r">${Number(it.price).toLocaleString()}</td><td class="r">${(it.qty * it.price).toLocaleString()}</td></tr>`).join("")}
    </table>
    <div class="line"></div>
    <table>
      <tr><td class="bold">${t("pos.total")}</td><td class="r bold" style="font-size:13px;">${Number(totalVal).toLocaleString()} ${t("app.currency")}</td></tr>
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
    <div className="pos-layout">
      <button className="pos-fullscreen-btn" onClick={() => setFullscreen(!fullscreen)} title={fullscreen ? "Exit fullscreen" : "Fullscreen"}>
        {fullscreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
      </button>
      {/* Left: Products */}
      <div className="pos-products">
        <div className="pos-toolbar">
          <div className={`pos-search${searchFocused ? " focused" : ""}`}>
            <Search size={16} className="search-icon" onClick={() => setSearchFocused(true)} />
            <input className="search-input" placeholder={t("pos.searchProducts")} value={search} onChange={(e) => setSearch(e.target.value)} onFocus={() => setSearchFocused(true)} />
            {search && <X size={14} className="search-clear" onClick={() => { setSearch(""); setSearchFocused(false); }} />}
          </div>
          <button className="pos-other-btn" onClick={() => navigate("/otherSales")}>
            <ListPlus size={16} /> {t("pos.otherMode")}
          </button>
        </div>
        {categories.length > 0 && (
          <div className="pos-cat-pills">
            <button className={`pos-cat-pill${selectedCategory === null ? " active" : ""}`} onClick={() => setSelectedCategory(null)}>📦 {t("categories.title")}</button>
            {categories.map((cat) => (
              <button key={cat.id} className={`pos-cat-pill${selectedCategory === cat.id ? " active" : ""}`} onClick={() => setSelectedCategory(selectedCategory === cat.id ? null : cat.id)}>
                {cat.icon} {cat.name}
              </button>
            ))}
          </div>
        )}
        <div className="pos-product-table-wrap">
          <table className="pos-product-table">
            <thead>
              <tr>
                <th>{t("pos.article")}</th>
                <th>{t("pos.price")}</th>
                <th>{t("pos.stock")}</th>
              </tr>
            </thead>
            <tbody>
              {availableProducts.map((p) => (
                <tr key={p.product_unit_id ? `u_${p.product_unit_id}` : `p_${p.product_id}`} className="pos-product-row" onClick={() => addToCart(p)}>
                  <td className="pos-product-name">{p.product_name}{p.unit ? <span className="pos-product-unit"> ({p.unit})</span> : null}</td>
                  <td className="pos-product-price">{Number(p.current_sale_price || p.sale_price || 0).toLocaleString()}</td>
                  <td className="pos-product-stock">{Number(p.total_stock).toLocaleString()} {p.unit ? p.unit : ""}</td>
                </tr>
              ))}
              {availableProducts.length === 0 && <tr><td colSpan={3} className="pos-empty">{t("pos.noProducts")}</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* Right: Cart + Payment */}
      <div className="pos-cart">
        <div className="pos-cart-header">
          <div className="pos-cart-title"><ShoppingCart size={18} /> {t("pos.cart")} ({cart.length})</div>
          <button className="pos-close-cart" onClick={() => setCart([])}><Trash2 size={16} /></button>
        </div>

        <div className="pos-customer-bar">
          <User size={16} />
          <SearchSelect compact value={selectedCustomer?.id || ""} onChange={(v) => setSelectedCustomer(v ? customers.find((c) => c.id === Number(v)) || null : null)}
            options={[{ value: "", label: t("pos.noCustomer") || "Client (optionnel)" }, ...customers.map((c) => ({ value: c.id, label: c.name }))]} />
          <button className="pos-quick-add" onClick={() => setShowCustomerModal(true)}><Plus size={16} /></button>
        </div>

        <div className="pos-cart-items">
          {cart.length === 0 ? (
            <div className="pos-empty-cart">{t("pos.cartEmpty")}</div>
          ) : cart.map((item) => (
            <div key={item.cart_key} className="pos-cart-item">
              <div className="pos-item-info">
                <div className="pos-item-name">{item.product_name}</div>
                <div className="pos-item-price">{Number(item.price).toLocaleString()} × {item.qty}</div>
              </div>
              <div className="pos-item-controls">
                <button className="pos-qty-btn" onClick={() => updateQty(item.cart_key, -1)}><Minus size={14} /></button>
                <span className="pos-item-qty">{item.qty}</span>
                <button className="pos-qty-btn" onClick={() => updateQty(item.cart_key, 1)}><Plus size={14} /></button>
                <button className="pos-item-remove" onClick={() => removeFromCart(item.cart_key)}><X size={14} /></button>
              </div>
            </div>
          ))}
        </div>

        <div className="pos-cart-footer">
          <div className="pos-total">
            <span>{t("pos.total")}</span>
            <span className="pos-total-value">{total.toLocaleString()} {t("app.currency")}</span>
          </div>

          <div className="pos-payment-methods">
            {paymentMethods.map((pm) => {
              const Ic = METHOD_ICONS[pm.icon] || Wallet;
              return (
                <button key={pm.id} className={`pos-payment-btn${selectedPayment?.id === pm.id ? " active" : ""}`} onClick={() => setSelectedPayment(pm)} style={selectedPayment?.id === pm.id ? { borderColor: pm.color, background: pm.color + "11" } : {}}>
                  {pm.logo_url ? (
                    <img src={pm.logo_url.startsWith("http") ? pm.logo_url : pm.logo_url} alt={pm.name} style={{ width: 22, height: 22, borderRadius: 6, objectFit: "cover" }} />
                  ) : (
                    <Ic size={18} color={pm.color} />
                  )}
                  <span>{pm.name}</span>
                </button>
              );
            })}
          </div>

          <button className="pos-pay-btn" onClick={handleSave} disabled={saving || cart.length === 0}>
            {saving ? "..." : <><Check size={18} /> {t("pos.pay")} — {total.toLocaleString()} {t("app.currency")}</>}
          </button>
        </div>

        {lastInvoice && (
          <div className="pos-print-bar">
            <button className="btn btn-primary btn-block" onClick={handlePrint}><Printer size={16} /> {t("pos.printReceipt")}</button>
            <button className="btn btn-ghost" onClick={() => setLastInvoice(null)}><X size={16} /></button>
          </div>
        )}

        <div className="pos-recent">
          <div className="pos-recent-title">{t("pos.recentInvoices")}</div>
          {recentInvoices.map((inv) => (
            <div key={inv.id} className="pos-recent-item" onClick={() => setSelectedRecent(inv)} style={{ cursor: "pointer" }}>
              <div>
                <div className="pos-recent-code">{inv.invoice_code || `#${inv.id}`}</div>
                <div className="pos-recent-cust">{inv.customer_name}</div>
              </div>
              <div className="pos-recent-total">{Number(inv.total).toLocaleString()}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Add Customer */}
      <Modal open={showCustomerModal} onClose={() => setShowCustomerModal(false)} title={t("pos.addCustomer")}>
        <form onSubmit={(e) => { e.preventDefault(); handleQuickAddCustomer(); }} className="modal-form">
          <div className="input-group">
            <label>{t("customers.name")}</label>
            <input required value={newCustomer.name} onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })} />
          </div>
          <div className="input-group">
            <label>{t("customers.phone")}</label>
            <input value={newCustomer.phone} onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })} />
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={() => setShowCustomerModal(false)}>{t("app.cancel")}</button>
            <button type="submit" className="btn btn-primary">{t("app.save")}</button>
          </div>
        </form>
      </Modal>

      {/* Invoice Action Modal */}
      <Modal open={!!selectedRecent} onClose={() => setSelectedRecent(null)}>
        {selectedRecent && (
          <div className="modal-form" style={{ padding: "16px 24px" }}>
            <div style={{ textAlign: "center", marginBottom: 12 }}>
              <FileText size={36} color="var(--primary)" style={{ marginBottom: 8 }} />
              <div style={{ fontWeight: 700, fontSize: "1rem" }}>{selectedRecent.invoice_code || `#${selectedRecent.id}`}</div>
              <div style={{ fontSize: "0.8rem", color: "var(--gray-500)", marginTop: 4 }}>{selectedRecent.customer_name}</div>
              <div style={{ fontWeight: 700, fontSize: "1.1rem", color: "var(--primary)", marginTop: 6 }}>{Number(selectedRecent.total).toLocaleString()} {t("app.currency")}</div>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => { handlePrintInvoice(selectedRecent); setSelectedRecent(null); }}>
                <Printer size={16} /> {t("pos.printReceipt")}
              </button>
              <button className="btn btn-danger" style={{ flex: 1 }} onClick={handleDeleteRecent} disabled={deleting}>
                <Trash2 size={16} /> {deleting ? "..." : t("app.delete")}
              </button>
            </div>
            <button className="btn btn-ghost btn-block" style={{ marginTop: 6 }} onClick={() => setSelectedRecent(null)}>
              {t("app.cancel")}
            </button>
          </div>
        )}
      </Modal>
    </div>
  );
}

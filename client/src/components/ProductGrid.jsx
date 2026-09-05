import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Search, X } from "lucide-react";

export function useStockMap(batches) {
  return useMemo(() => {
    const m = {};
    (batches || []).forEach((b) => {
      if (b.status === "active" && Number(b.remaining_qty) > 0) {
        const key = b.product_unit_id ? `u_${b.product_unit_id}` : `p_${b.product_id}`;
        m[key] = (m[key] || 0) + Number(b.remaining_qty);
      }
    });
    return m;
  }, [batches]);
}

export function productUnitEntries(product, stockMap) {
  const units = (product.units && product.units.filter((u) => u.active !== 0)) || [];
  if (units.length === 0) {
    const key = `p_${product.id}`;
    return [{
      key,
      product_id: product.id,
      product_unit_id: null,
      unit: product.unit || "كيس",
      price: Number(product.current_sale_price || 0),
      stock: stockMap[key] || 0,
    }];
  }
  return units.map((u) => {
    const key = u.id ? `u_${u.id}` : `p_${product.id}`;
    return {
      key,
      product_id: product.id,
      product_unit_id: u.id || null,
      unit: u.unit,
      price: Number(u.current_sale_price || 0),
      stock: stockMap[key] || 0,
    };
  });
}

export default function ProductGrid({ products = [], batches = [], categories = [], onPick, onPickProduct, showStock = true }) {
  const { t } = useTranslation();
  const [q, setQ] = useState("");
  const [selectedCat, setSelectedCat] = useState(null);
  const stockMap = useStockMap(batches);

  const filtered = useMemo(() => {
    return (products || []).filter(
      (p) => (!q || p.name.includes(q)) && (!selectedCat || p.category_id === selectedCat)
    );
  }, [products, q, selectedCat]);

  return (
    <div className="pos-grid-wrap">
      <div className="pos-search" style={{ padding: "8px" }}>
        <Search size={16} style={{ color: "var(--gray-400)", flexShrink: 0 }} />
        <input className="search-input" placeholder={t("supplyInvoices.searchProduct") || "بحث عن منتج..."} value={q} onChange={(e) => setQ(e.target.value)} />
        {q && <X size={14} style={{ cursor: "pointer" }} onClick={() => setQ("")} />}
      </div>
      <div className="pos-cat-chips">
        <button type="button" className={`pos-cat-chip${!selectedCat ? " active" : ""}`} onClick={() => setSelectedCat(null)}>الكل</button>
        {categories.map((c) => (
          <button key={c.id} type="button" className={`pos-cat-chip${selectedCat === c.id ? " active" : ""}`} onClick={() => setSelectedCat(selectedCat === c.id ? null : c.id)}>
            {c.name_ar || c.name}
          </button>
        ))}
      </div>
      <div className="pos-grid">
        {filtered.map((p) => {
          const entries = productUnitEntries(p, stockMap);
          return (
            <button type="button" key={p.id} className="pos-grid-item" onClick={() => onPickProduct && onPickProduct(p, entries)}>
              <span className="pos-grid-name">{p.name}</span>
              <span className="pos-grid-units">
                {entries.map((e) => (
                  <span key={e.key} className="pos-grid-unit-chip" onClick={(ev) => { if (onPick) { ev.stopPropagation(); onPick(p, e); } }}>
                    {e.unit} · <b>{Number(e.price).toLocaleString()}</b>
                    {showStock && <i className="pos-grid-stock-cip">{t("pos.stock")}: {e.stock}</i>}
                  </span>
                ))}
              </span>
            </button>
          );
        })}
        {filtered.length === 0 && <div style={{ gridColumn: "1/-1", textAlign: "center", color: "var(--gray-400)", padding: 20 }}>{t("supplyInvoices.searchProduct") || "لا توجد منتجات"}</div>}
      </div>
    </div>
  );
}
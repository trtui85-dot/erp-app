import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { http } from "../api";
import { useToast } from "../components/toast";
import { PageLoader, EmptyState } from "../components/ui";
import { Sun, Save, Search, X } from "lucide-react";

export default function DailyPrices() {
  const { t } = useTranslation();
  const toast = useToast();
  const [products, setProducts] = useState([]);
  const [prices, setPrices] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    Promise.all([
      http.get("/products").catch(() => ({ data: [] })),
      http.get("/dailyprices").catch(() => ({ data: [] })),
    ]).then(([pRes, dpRes]) => {
      const prods = pRes.data.filter((p) => p.active !== 0);
      setProducts(prods);
      const map = {};
      dpRes.data.forEach((dp) => { map[dp.product_id] = dp.price; });
      prods.forEach((p) => { if (!map[p.id]) map[p.id] = p.current_sale_price || ""; });
      setPrices(map);
      setLoading(false);
    });
  }, []);

  const handleChange = (id, val) => setPrices((prev) => ({ ...prev, [id]: val }));

  const handleSaveAll = async () => {
    setSaving(true);
    try {
      const items = Object.entries(prices).map(([product_id, price]) => ({
        product_id: Number(product_id),
        price: Number(price),
      }));
      await http.post("/dailyprices/bulk", { items });
      toast.success(t("dailyPrices.savedAll"));
    } catch (err) { toast.error(err.message || "Erreur"); }
    finally { setSaving(false); }
  };

  const filtered = products.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()));
  const today = new Date().toLocaleDateString("fr-FR");

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">{t("dailyPrices.title")}</h1>
        <span className="page-subtitle">{t("dailyPrices.today")}: {today}</span>
      </div>
      {loading ? <PageLoader /> : products.length === 0 ? <EmptyState icon={Sun} msg={t("dailyPrices.noProducts")} /> : (
        <>
          <div className="search-wrap" style={{ marginBottom: 16 }}>
            <Search size={18} className="search-icon" />
            <input className="search-input" placeholder={t("products.search")} value={search} onChange={(e) => setSearch(e.target.value)} />
            {search && <button className="search-clear" onClick={() => setSearch("")}><X size={14} /></button>}
          </div>
          <div className="dp-grid">
            {filtered.map((p) => (
              <div key={p.id} className="dp-card">
                <div className="dp-card-name">{p.name}</div>
                <div className="dp-card-unit">{p.unit || "kg"}</div>
                <div className="dp-card-price">
                  <input
                    type="number"
                    step="0.01"
                    className="dp-card-input"
                    value={prices[p.id] || ""}
                    onChange={(e) => handleChange(p.id, e.target.value)}
                  />
                  <span className="dp-card-currency">{t("app.currency")}</span>
                </div>
              </div>
            ))}
          </div>
          <button className="btn btn-primary btn-block" onClick={handleSaveAll} disabled={saving} style={{ marginTop: 16 }}>
            <Save size={18} /> {saving ? "..." : t("dailyPrices.update")}
          </button>
        </>
      )}
    </div>
  );
}

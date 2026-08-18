import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { http } from "../api";
import { useToast } from "../components/toast";
import { PageLoader, EmptyState } from "../components/ui";
import { Sun, Save, CheckCircle } from "lucide-react";

export default function DailyPrices() {
  const { t } = useTranslation();
  const toast = useToast();
  const [products, setProducts] = useState([]);
  const [prices, setPrices] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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

  const today = new Date().toLocaleDateString("fr-FR");

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">{t("dailyPrices.title")}</h1>
        <span className="page-subtitle">{t("dailyPrices.today")}: {today}</span>
      </div>
      {loading ? <PageLoader /> : products.length === 0 ? <EmptyState icon={Sun} msg={t("dailyPrices.noProducts")} /> : (
        <>
          <div className="price-list">
            {products.map((p) => (
              <div key={p.id} className="price-row">
                <div className="price-name">{p.name}</div>
                <div className="price-input-wrap">
                  <input
                    type="number"
                    step="0.01"
                    className="price-input"
                    value={prices[p.id] || ""}
                    onChange={(e) => handleChange(p.id, e.target.value)}
                  />
                  <span className="price-unit">{t("app.currency")}</span>
                </div>
              </div>
            ))}
          </div>
          <button className="btn btn-primary btn-block" onClick={handleSaveAll} disabled={saving}>
            <Save size={18} /> {saving ? "..." : t("dailyPrices.update")}
          </button>
        </>
      )}
    </div>
  );
}

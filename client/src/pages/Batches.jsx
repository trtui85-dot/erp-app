import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { http } from "../api";
import { PageLoader, EmptyState, Badge } from "../components/ui";
import { Layers, AlertTriangle, Clock } from "lucide-react";

const HEALTH_COLORS = { fresh: "#22c55e", warning: "#f59e0b", danger: "#ef4444", finished: "#9ca3af", expired: "#ef4444" };

export default function Batches() {
  const { t } = useTranslation();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    http.get("/batches").then((d) => setItems(d.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const filtered = filter === "all" ? items : items.filter((b) => b.status === filter || (filter === "danger" && b.health === "danger") || (filter === "warning" && b.health === "warning"));
  const lowStockCount = items.filter((b) => b.status === "active" && Number(b.remaining_qty) < (b.min_stock || 10)).length;
  const dangerCount = items.filter((b) => b.health === "danger").length;

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">{t("batches.title")}</h1>
        <div style={{ display: "flex", gap: 8 }}>
          {lowStockCount > 0 && <Badge color="#ef4444"><AlertTriangle size={14} /> {lowStockCount} {t("batches.lowStock")}</Badge>}
          {dangerCount > 0 && <Badge color="#ef4444"><Clock size={14} /> {dangerCount} {t("batches.expiresSoon")}</Badge>}
        </div>
      </div>
      <div className="filter-tabs">
        {["all", "active", "warning", "danger", "sold", "expired"].map((f) => (
          <button key={f} className={`tab${filter === f ? " active" : ""}`} onClick={() => setFilter(f)}>
            {f === "all" ? t("app.all") : t(`batches.${f}`)}
          </button>
        ))}
      </div>
      {loading ? <PageLoader /> : filtered.length === 0 ? <EmptyState icon={Layers} msg={t("batches.noData")} /> : (
        <div className="card-list">
          {filtered.map((b) => {
            const healthColor = HEALTH_COLORS[b.health] || "#9ca3af";
            const lifePct = b.shelf_life_days ? Math.min((b.age_days / b.shelf_life_days) * 100, 100) : 0;
            return (
              <div key={b.id} className="card-item batch-card" style={{ borderLeft: `4px solid ${healthColor}` }}>
                <div className="card-main">
                  <div className="card-title">
                    {b.product_name || `#${b.product_id}`}
                    <span style={{ fontSize: 12, opacity: 0.5, marginLeft: 8 }}>{b.batch_code || `#${b.id}`}</span>
                  </div>
                  <div className="card-sub">{t("batches.remainingQty")}: <strong>{b.remaining_qty}</strong> / {b.initial_qty} {b.unit || "kg"}</div>
                  <div className="card-sub">
                    {t("batches.purchasePrice")}: {b.purchase_price} · {t("batches.salePrice")}: {b.sale_price}
                    {b.sold_qty > 0 && <span> · {t("batches.sold")}: {b.sold_qty}</span>}
                    {b.wasted_qty > 0 && <span style={{ color: "#ef4444" }}> · {t("batches.wasted")}: {b.wasted_qty}</span>}
                  </div>
                  {b.supplier_name && <div className="card-sub">{t("batches.supplier")}: {b.supplier_name}</div>}
                  <div className="card-sub">
                    <Clock size={14} /> {b.arrival_date} · {b.age_days || 0} {t("reports.days")}
                  </div>
                  {b.status === "active" && b.shelf_life_days > 0 && (
                    <div style={{ marginTop: 4 }}>
                      <div style={{ background: "#e5e7eb", borderRadius: 4, height: 6, overflow: "hidden" }}>
                        <div style={{ width: `${lifePct}%`, height: "100%", background: healthColor, borderRadius: 4, transition: "width 0.3s" }} />
                      </div>
                      <span style={{ fontSize: 11, opacity: 0.6 }}>{Math.round(lifePct)}% {t("reports.ofLife")}</span>
                    </div>
                  )}
                </div>
                <Badge color={healthColor}>{b.health === "fresh" ? t("batches.active") : b.health === "warning" ? t("batches.warning") : b.health === "danger" ? t("batches.danger") : t(`batches.${b.status}`)}</Badge>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

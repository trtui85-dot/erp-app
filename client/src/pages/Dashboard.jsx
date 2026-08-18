import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { http } from "../api";
import { PageLoader, Badge } from "../components/ui";
import { Package, Layers, AlertTriangle, AlertOctagon, ShoppingCart, Truck, Trash, Clock } from "lucide-react";

const CATEGORY_ICONS = { sale: ShoppingCart, supply: Truck, debt: AlertOctagon, waste: Trash };
const CATEGORY_COLORS = { sale: "#8b5cf6", supply: "#14b8a6", debt: "#ef4444", waste: "#f59e0b" };

export default function Dashboard() {
  const { t } = useTranslation();
  const [stats, setStats] = useState(null);
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      http.get("/dashboard/stats").catch(() => ({ data: {} })),
      http.get("/dashboard/recent").catch(() => ({ data: [] })),
    ]).then(([s, r]) => {
      setStats(s.data);
      setRecent(r.data);
      setLoading(false);
    });
  }, []);

  if (loading) return <PageLoader />;

  const cards = [
    { key: "totalProducts", icon: Package, value: stats?.total_products || 0, color: "#6366f1" },
    { key: "activeBatches", icon: Layers, value: stats?.total_batches || 0, color: "#22c55e" },
    { key: "lowStock", icon: AlertTriangle, value: stats?.low_stock_count || 0, color: "#f59e0b" },
    { key: "pendingDebts", icon: AlertOctagon, value: stats?.pending_debts_count || 0, color: "#ef4444" },
    { key: "todaySales", icon: ShoppingCart, value: (stats?.today_sales_total || 0).toLocaleString() + " " + t("app.currency"), color: "#8b5cf6" },
    { key: "totalWaste", icon: Trash, value: (stats?.total_waste_loss || 0).toLocaleString() + " " + t("app.currency"), color: "#f59e0b" },
  ];

  const lowStockProducts = stats?.low_stock_products || [];
  const dangerBatches = stats?.danger_batches || [];

  return (
    <div className="dashboard">
      <h1 className="page-title">{t("dashboard.title")}</h1>
      <div className="stats-grid">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <div key={c.key} className="stat-card" style={{ borderTopColor: c.color }}>
              <div className="stat-icon" style={{ color: c.color }}><Icon size={24} /></div>
              <div className="stat-value">{c.value}</div>
              <div className="stat-label">{t(`dashboard.${c.key}`)}</div>
            </div>
          );
        })}
      </div>

      {lowStockProducts.length > 0 && (
        <div className="section">
          <h2 className="section-title"><AlertTriangle size={18} style={{ color: "#f59e0b" }} /> {t("dashboard.lowStockProducts")}</h2>
          <div className="card-list">
            {lowStockProducts.slice(0, 5).map((p) => (
              <div key={p.id} className="card-item" style={{ borderLeft: "3px solid #f59e0b" }}>
                <div className="card-main">
                  <div className="card-title">{p.name}</div>
                  <div className="card-sub">{t("batches.remainingQty")}: {Number(p.total_remaining).toFixed(1)} {t("app.unit")} / min: {p.min_stock}</div>
                </div>
                <Badge color="#f59e0b">{t("reports.low")}</Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {dangerBatches.length > 0 && (
        <div className="section">
          <h2 className="section-title"><Clock size={18} style={{ color: "#ef4444" }} /> {t("dashboard.dangerBatches")}</h2>
          <div className="card-list">
            {dangerBatches.map((b) => (
              <div key={b.id} className="card-item" style={{ borderLeft: "3px solid #ef4444" }}>
                <div className="card-main">
                  <div className="card-title">{b.product_name}</div>
                  <div className="card-sub">{b.batch_code || `#${b.id}`} · {b.remaining_qty} {t("app.unit")} · {b.age_days}/{b.shelf_life_days} {t("reports.days")}</div>
                </div>
                <Badge color="#ef4444">{t("batches.danger")}</Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="section">
        <h2 className="section-title">{t("dashboard.recentActivity")}</h2>
        {recent.length === 0 ? (
          <p className="empty-text">{t("dashboard.noData")}</p>
        ) : (
          <div className="activity-list">
            {recent.map((a, i) => {
              const Icon = CATEGORY_ICONS[a.category] || Package;
              const color = CATEGORY_COLORS[a.category] || "#9ca3af";
              return (
                <div key={i} className="activity-item">
                  <Icon size={16} style={{ color }} />
                  <span className="activity-text">
                    {a.customer_name || a.supplier_name || a.product_name || a.category}
                    {a.total ? ` — ${Number(a.total).toLocaleString()} ${t("app.currency")}` : ""}
                  </span>
                  <span className="activity-date">{a.date || ""}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

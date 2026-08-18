import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { http } from "../api";
import { PageLoader, EmptyState, Badge } from "../components/ui";
import { BarChart3, TrendingUp, AlertTriangle, Package } from "lucide-react";

const HEALTH_COLORS = { fresh: "#22c55e", warning: "#f59e0b", danger: "#ef4444", finished: "#9ca3af", expired: "#ef4444" };

export default function Reports() {
  const { t } = useTranslation();
  const [tab, setTab] = useState("profit");
  const [loading, setLoading] = useState(true);
  const [profitData, setProfitData] = useState([]);
  const [wasteData, setWasteData] = useState([]);
  const [inventoryData, setInventoryData] = useState([]);
  const [healthData, setHealthData] = useState([]);
  const [lowStock, setLowStock] = useState([]);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const loadAll = async () => {
    setLoading(true);
    try {
      const params = {};
      if (fromDate) params.from_date = fromDate;
      if (toDate) params.to_date = toDate;
      const [p, w, inv, h, ls] = await Promise.all([
        http.get("/reports/profit", { params }),
        http.get("/waste/summary"),
        http.get("/reports/inventory"),
        http.get("/reports/batches-health"),
        http.get("/reports/low-stock"),
      ]);
      setProfitData(p.data);
      setWasteData(w.data);
      setInventoryData(inv.data);
      setHealthData(h.data);
      setLowStock(ls.data);
    } catch {}
    finally { setLoading(false); }
  };
  useEffect(() => { loadAll(); }, []);

  const totalRevenue = profitData.reduce((s, r) => s + Number(r.revenue || 0), 0);
  const totalCost = profitData.reduce((s, r) => s + Number(r.cost_of_goods || 0), 0);
  const totalProfit = profitData.reduce((s, r) => s + Number(r.net_profit || 0), 0);
  const totalWasteLoss = wasteData.reduce((s, r) => s + Number(r.total_loss || 0), 0);

  const tabs = [
    { key: "profit", icon: TrendingUp, label: t("reports.profitReport") },
    { key: "waste", icon: AlertTriangle, label: t("reports.wasteReport") },
    { key: "inventory", icon: Package, label: t("reports.inventoryReport") },
    { key: "health", icon: BarChart3, label: t("reports.healthReport") },
  ];

  if (loading) return <PageLoader />;

  return (
    <div className="page-container">
      <h1 className="page-title" style={{ marginBottom: 8 }}>{t("reports.title")}</h1>

      <div className="filter-tabs" style={{ marginBottom: 8 }}>
        {tabs.map((tb) => (
          <button key={tb.key} className={`tab${tab === tb.key ? " active" : ""}`} onClick={() => setTab(tb.key)}>
            <tb.icon size={12} /> {tb.label}
          </button>
        ))}
      </div>

      {tab === "profit" && (
        <div>
          <div className="report-date-filter">
            <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
            <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
            <button className="btn btn-ghost" onClick={loadAll}>{t("reports.filter")}</button>
          </div>
          <div className="rpt-stats">
            <div className="rpt-stat rpt-stat--purple">
              <div className="rpt-stat-val">{totalRevenue.toLocaleString()}</div>
              <div className="rpt-stat-lbl">{t("reports.totalRevenue")}</div>
            </div>
            <div className="rpt-stat rpt-stat--amber">
              <div className="rpt-stat-val">{totalCost.toLocaleString()}</div>
              <div className="rpt-stat-lbl">{t("reports.totalCost")}</div>
            </div>
            <div className="rpt-stat" style={{ borderColor: totalProfit >= 0 ? "#22c55e" : "#ef4444" }}>
              <div className="rpt-stat-val" style={{ color: totalProfit >= 0 ? "#22c55e" : "#ef4444" }}>{totalProfit.toLocaleString()}</div>
              <div className="rpt-stat-lbl">{t("reports.netProfit")}</div>
            </div>
          </div>
          {profitData.length === 0 ? <EmptyState icon={TrendingUp} msg={t("reports.noData")} /> : (
            <div className="rpt-list">
              {profitData.map((r) => (
                <div key={r.product_id} className="rpt-row">
                  <div className="rpt-row-top">
                    <span className="rpt-row-name">{r.product_name}</span>
                    <span className="rpt-row-badge" style={{ color: Number(r.net_profit) >= 0 ? "#22c55e" : "#ef4444" }}>
                      {Number(r.net_profit) >= 0 ? "+" : ""}{Number(r.net_profit).toLocaleString()}
                    </span>
                  </div>
                  <div className="rpt-row-sub">
                    {Number(r.qty_sold).toFixed(1)} {r.unit} · {Number(r.revenue).toLocaleString()} / {Number(r.cost_of_goods).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "waste" && (
        <div>
          {wasteData.length === 0 ? <EmptyState icon={AlertTriangle} msg={t("reports.noWaste")} /> : (
            <>
              <div className="rpt-stats">
                <div className="rpt-stat rpt-stat--red">
                  <div className="rpt-stat-val">{totalWasteLoss.toLocaleString()}</div>
                  <div className="rpt-stat-lbl">{t("reports.totalWasteLoss")}</div>
                </div>
              </div>
              <div className="rpt-list">
                {wasteData.map((r) => (
                  <div key={r.product_id} className="rpt-row">
                    <div className="rpt-row-top">
                      <span className="rpt-row-name">{r.product_name}</span>
                      <span className="rpt-row-badge" style={{ color: Number(r.waste_pct) > 15 ? "#ef4444" : Number(r.waste_pct) > 5 ? "#f59e0b" : "#22c55e" }}>
                        {r.waste_pct}%
                      </span>
                    </div>
                    <div className="rpt-row-sub">
                      {Number(r.total_wasted).toFixed(1)} / {Number(r.total_purchased).toFixed(1)}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {tab === "inventory" && (
        <div>
          {lowStock.length > 0 && (
            <div className="rpt-alert">
              <AlertTriangle size={14} /> {t("reports.lowStockAlerts")}:
              {lowStock.map((p) => <span key={p.id} className="rpt-alert-item">{p.name} ({Number(p.total_remaining).toFixed(1)})</span>)}
            </div>
          )}
          {inventoryData.length === 0 ? <EmptyState icon={Package} msg={t("reports.noData")} /> : (
            <div className="rpt-list">
              {inventoryData.map((r) => (
                <div key={r.product_id} className="rpt-row">
                  <div className="rpt-row-top">
                    <span className="rpt-row-name">{r.product_name}</span>
                    <span className="rpt-row-badge" style={{ color: r.stock_status === "low" ? "#f59e0b" : r.stock_status === "empty" ? "#ef4444" : "#22c55e" }}>
                      {Number(r.total_remaining).toFixed(1)} {r.unit}
                    </span>
                  </div>
                  <div className="rpt-row-sub">
                    {t("reports.sold")}: {Number(r.total_sold).toFixed(1)} · {t("reports.wasted")}: {Number(r.total_wasted).toFixed(1)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "health" && (
        <div>
          {healthData.length === 0 ? <EmptyState icon={BarChart3} msg={t("reports.noActiveBatches")} /> : (
            <div className="rpt-list">
              {healthData.map((b) => (
                <div key={b.id} className="rpt-row">
                  <div className="rpt-row-top">
                    <span className="rpt-row-name">{b.product_name} <span style={{ opacity: 0.5, fontSize: "0.65rem" }}>#{b.id}</span></span>
                    <span className="rpt-row-badge" style={{ color: HEALTH_COLORS[b.health] }}>
                      {b.age_days}j · {b.life_pct}%
                    </span>
                  </div>
                  <div className="rpt-bar">
                    <div className="rpt-bar-fill" style={{ width: `${Math.min(b.life_pct || 0, 100)}%`, background: HEALTH_COLORS[b.health] }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

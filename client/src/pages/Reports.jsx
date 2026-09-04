import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { http } from "../api";
import { PageLoader, EmptyState, Badge } from "../components/ui";
import { BarChart3, TrendingUp, AlertTriangle, Package, Printer } from "lucide-react";

const HEALTH_COLORS = { fresh: "#22c55e", warning: "#f59e0b", danger: "#ef4444", finished: "#9ca3af", expired: "#ef4444" };

const PRINT_STYLE = `
  * { box-sizing: border-box; }
  @page { size: A4; margin: 0; }
  body { margin: 0; padding: 20px; background: #e9edf2; font-family: "Cairo", Arial, sans-serif; color: #123b70; }
  .invoice { width: 210mm; min-height: 297mm; margin: auto; background: #fff; position: relative; overflow: hidden; border: 1px solid #123b70; padding: 12mm; }
  .top-decoration { position: absolute; top: 0; right: 0; left: 0; height: 35px; background: #123b70; clip-path: polygon(0 0,100% 0,100% 100%,75% 100%,70% 50%,45% 100%,0 100%); }
  .footer-decoration { position: absolute; bottom: 0; right: 0; left: 0; height: 34px; background: #123b70; clip-path: polygon(0 40%,18% 0,48% 75%,72% 10%,100% 0,100% 100%,0 100%); }
  .header { margin-top: 15px; border-bottom: 3px solid #123b70; padding-bottom: 10px; }
  .header-content { display: grid; grid-template-columns: 1fr 2fr 1fr; align-items: center; gap: 15px; }
  .contact { text-align: center; font-size: 14px; font-weight: 700; line-height: 2; }
  .contact-row { display: flex; justify-content: center; align-items: center; gap: 7px; }
  .icon { width: 22px; height: 22px; border-radius: 50%; background: #123b70; color: white; display: inline-flex; justify-content: center; align-items: center; font-size: 12px; }
  .institution { text-align: center; }
  .institution-small { font-size: 19px; font-weight: 700; margin-bottom: 0; }
  .institution-name { font-size: 26px; font-weight: 900; line-height: 1.25; margin: 0; }
  .institution-line { width: 80%; height: 3px; background: #123b70; margin: 7px auto; position: relative; }
  .institution-line::after { content: ""; width: 9px; height: 9px; background: #123b70; transform: rotate(45deg); position: absolute; left: 50%; top: -3px; }
  .title-band { background: #123b70; color: white; text-align: center; font-size: 19px; font-weight: 800; padding: 9px 14px; clip-path: polygon(8% 0,100% 0,100% 100%,8% 100%,0 50%); margin: 10px 0; }
  .meta { text-align: center; font-size: 13px; font-weight: 700; }
  .sums { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-top: 14px; }
  .sum-box { border: 1px solid #9baabd; border-radius: 8px; padding: 8px; text-align: center; }
  .sum-box .lbl { font-size: 11px; color: #444; font-weight: 700; }
  .sum-box .val { font-size: 17px; font-weight: 900; color: #123b70; }
  .table { width: 100%; border-collapse: collapse; margin-top: 14px; font-size: 12px; }
  .table th { background: #123b70; color: #fff; padding: 8px 4px; border: 1px solid #123b70; font-size: 11px; font-weight: 800; white-space: nowrap; }
  .table td { height: 26px; border: 1px solid #a9b8ca; text-align: center; padding: 3px; }
  .table tbody tr:nth-child(even) { background: #f7f9fc; }
  .table .rn { text-align: right !important; padding-right: 8px !important; }
  .signature { text-align: center; margin-top: 20px; font-weight: 800; font-size: 13px; }
  .signature-line { width: 150px; border-bottom: 1px dotted #555; margin: 17px auto 0; }
  @media print { body { background: white; padding: 0; } .invoice { width: 210mm; min-height: 297mm; border: 1px solid #123b70; margin: 0; } * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; } }
`;

function buildReportPrint({ title, subtitle, columns, rows, totals }) {
  const pw = window.open("", "_blank", "width=900,height=700");
  if (!pw) return;
  const today = new Date().toLocaleDateString("ar-MR", { year: "numeric", month: "long", day: "numeric" });
  const head = `<tr>${columns.map((c) => `<th style="text-align:${c.align || "center"}">${c.label}</th>`).join("")}</tr>`;
  const body = rows.map((r, i) =>
    `<tr>${columns.map((c) => `<td style="text-align:${c.align || "center"}" class="${c.align === "right" ? "rn" : ""}">${c.render ? c.render(r, i) : (r[c.key] ?? "")}</td>`).join("")}</tr>`
  ).join("");
  const totalsHtml = totals && totals.length ? `
    <div class="sums">${totals.map((t) => `<div class="sum-box"><div class="lbl">${t.label}</div><div class="val">${t.value}</div></div>`).join("")}</div>` : "";
  pw.document.write(`<!DOCTYPE html>
<html lang="ar" dir="rtl"><head><meta charset="UTF-8">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
<style>${PRINT_STYLE}</style></head><body>
<div class="invoice">
  <div class="top-decoration"></div>
  <header class="header"><div class="header-content">
    <div class="contact"><div class="contact-row"><span class="icon">☎</span><span>رقم المحل : 22222222</span></div><div class="contact-row"><span class="icon">●</span><span>الموقع : انواكشوط</span></div></div>
    <div class="institution"><div class="institution-small">مؤسسة</div><div class="institution-name">احمد سالم سيده</div><div class="institution-line"></div></div>
    <div></div>
  </div></header>
  <div class="title-band">${title}</div>
  <div class="meta">${subtitle} | التاريخ : ${today}</div>
  ${totalsHtml}
  <table class="table"><thead>${head}</thead><tbody>${body}</tbody></table>
  <div class="signature">توقيع وختم المؤسسة<div class="signature-line"></div></div>
  <div class="footer-decoration"></div>
</div></body></html>`);
  pw.document.close();
  setTimeout(() => { pw.print(); }, 400);
}

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

  const printProfit = () => {
    const rows = profitData.map((r) => ({
      name: r.product_name,
      unit: r.unit || "-",
      qty: Number(r.qty_sold || 0),
      revenue: Number(r.revenue || 0),
      cost: Number(r.cost_of_goods || 0),
      profit: Number(r.net_profit || 0),
    }));
    buildReportPrint({
      title: "تقرير الأرباح",
      subtitle: "قائمة الأرباح حسب المنتج" + (fromDate || toDate ? ` (${fromDate || "…"} إلى ${toDate || "…"})` : ""),
      columns: [
        { key: "name", label: "المنتج", align: "right" },
        { key: "unit", label: "الوحدة" },
        { key: "qty", label: "الكمية المبيعة" },
        { key: "revenue", label: "الإيرادات" },
        { key: "cost", label: "التكلفة" },
        { key: "profit", label: "صافي الربح" },
      ],
      rows,
      totals: [
        { label: "إجمالي الإيرادات", value: totalRevenue.toLocaleString() },
        { label: "إجمالي التكلفة", value: totalCost.toLocaleString() },
        { label: "صافي الربح", value: totalProfit.toLocaleString() },
      ],
    });
  };

  const printInventory = () => {
    const rows = inventoryData.map((r) => ({
      name: r.product_name,
      unit: r.unit || "-",
      remaining: Number(r.total_remaining || 0),
      purchased: Number(r.total_purchased || 0),
      sold: Number(r.total_sold || 0),
      wasted: Number(r.total_wasted || 0),
      status: r.stock_status === "low" ? "منخفض" : r.stock_status === "empty" ? "فارغ" : "جيد",
    }));
    buildReportPrint({
      title: "تقرير المخزون",
      subtitle: "جرد المخزون حسب المنتج والوحدة",
      columns: [
        { key: "name", label: "المنتج", align: "right" },
        { key: "unit", label: "الوحدة" },
        { key: "remaining", label: "المتبقي" },
        { key: "purchased", label: "المشترى" },
        { key: "sold", label: "المباع" },
        { key: "wasted", label: "التالف" },
        { key: "status", label: "الحالة" },
      ],
      rows,
    });
  };

  const printHealth = () => {
    const rows = healthData.map((b) => ({
      name: b.product_name,
      unit: b.unit || "-",
      remaining: Number(b.remaining_qty || 0),
      age: Number(b.age_days || 0),
      life: Number(b.life_pct || 0) + "%",
      status: b.health === "fresh" ? "طازج" : b.health === "warning" ? "تنبيه" : "خطر",
    }));
    buildReportPrint({
      title: "تقرير عمر المخزون",
      subtitle: "حالة المخزون حسب تاريخ الوصول",
      columns: [
        { key: "name", label: "المنتج", align: "right" },
        { key: "unit", label: "الوحدة" },
        { key: "remaining", label: "المتبقي" },
        { key: "age", label: "العمر (يوم)" },
        { key: "life", label: "نسبة العمر" },
        { key: "status", label: "الحالة" },
      ],
      rows,
    });
  };

  const printWaste = () => {
    const rows = wasteData.map((r) => ({
      name: r.product_name,
      unit: r.unit || "-",
      wasted: Number(r.total_wasted || 0),
      purchased: Number(r.total_purchased || 0),
      pct: Number(r.waste_pct || 0) + "%",
    }));
    buildReportPrint({
      title: "تقرير التالف",
      subtitle: "نسبة التالف حسب المنتج",
      columns: [
        { key: "name", label: "المنتج", align: "right" },
        { key: "unit", label: "الوحدة" },
        { key: "wasted", label: "التالف" },
        { key: "purchased", label: "المشترى" },
        { key: "pct", label: "النسبة" },
      ],
      rows,
    });
  };

  const printCurrent = () => {
    if (tab === "profit") printProfit();
    else if (tab === "inventory") printInventory();
    else if (tab === "health") printHealth();
    else if (tab === "waste") printWaste();
  };

  if (loading) return <PageLoader />;

  return (
    <div className="page-container">
      <div className="page-header" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <h1 className="page-title">{t("reports.title")}</h1>
        <button className="btn btn-primary" onClick={printCurrent}><Printer size={16} /> {t("app.print") || "طباعة"}</button>
      </div>

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

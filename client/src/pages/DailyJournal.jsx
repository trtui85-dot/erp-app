import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { http } from "../api";
import { PageLoader, EmptyState, Modal } from "../components/ui";
import { Calendar, TrendingUp, TrendingDown, Wallet, ShoppingCart, Package, AlertTriangle, ArrowLeftRight, Receipt, FileText, ChevronLeft, ChevronRight } from "lucide-react";

function dateAdd(d, days) {
  const dt = new Date(d);
  dt.setDate(dt.getDate() + days);
  return dt.toISOString().split("T")[0];
}

function formatTime(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

export default function DailyJournal() {
  const { t } = useTranslation();
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [detailInvoice, setDetailInvoice] = useState(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await http.get("/dailyjournal", { params: { date } });
      setData(res.data);
    } catch (err) {
      console.error("DailyJournal error:", err);
      setData(null);
    }
    finally { setLoading(false); }
  };
  useEffect(() => { fetchData(); }, [date]);

  if (loading) return <PageLoader />;
  if (!data) return <EmptyState msg={t("app.error")} />;

  const { sales, expenses, waste, supplies, debtPayments, transfers, net } = data;

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">{t("dailyJournal.title")}</h1>
      </div>

      <div className="dj-date-bar">
        <button className="btn btn-ghost" onClick={() => setDate(dateAdd(date, -1))}><ChevronLeft size={18} /></button>
        <div className="dj-date-display" onClick={() => document.getElementById("dj-date-input").showPicker()}>
          <Calendar size={16} />
          <input id="dj-date-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="dj-date-input" />
          <span className="dj-date-text">{new Date(date + "T00:00:00").toLocaleDateString("ar-DZ", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</span>
        </div>
        <button className="btn btn-ghost" onClick={() => setDate(dateAdd(date, 1))}><ChevronRight size={18} /></button>
      </div>

      {/* NET RESULT - Hero */}
      <div className={`dj-hero ${net >= 0 ? "dj-hero-positive" : "dj-hero-negative"}`}>
        <div className="dj-hero-label">{t("dailyJournal.netDay")}</div>
        <div className="dj-hero-value">{Number(net).toLocaleString()} {t("app.currency")}</div>
        <div className="dj-hero-sub">
          {t("dailyJournal.sales")}: {Number(sales.paid).toLocaleString()} — {t("dailyJournal.expenses")}: {Number(expenses.total + waste.totalValue).toLocaleString()}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="stats-grid" style={{ marginBottom: 16 }}>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: "rgba(34,197,94,0.1)" }}><TrendingUp size={20} color="#22c55e" /></div>
          <div className="stat-info">
            <div className="stat-value" style={{ color: "#22c55e" }}>{Number(sales.total).toLocaleString()}</div>
            <div className="stat-label">{t("dailyJournal.totalSales")} ({sales.count})</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: "rgba(239,68,68,0.1)" }}><TrendingDown size={20} color="#ef4444" /></div>
          <div className="stat-info">
            <div className="stat-value" style={{ color: "#ef4444" }}>{Number(expenses.total).toLocaleString()}</div>
            <div className="stat-label">{t("dailyJournal.totalExpenses")} ({expenses.count})</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: "rgba(245,158,11,0.1)" }}><AlertTriangle size={20} color="#f59e0b" /></div>
          <div className="stat-info">
            <div className="stat-value" style={{ color: "#f59e0b" }}>{Number(waste.totalValue).toLocaleString()}</div>
            <div className="stat-label">{t("dailyJournal.wasteValue")} ({waste.totalQty})</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: "rgba(99,102,241,0.1)" }}><Package size={20} color="#6366f1" /></div>
          <div className="stat-info">
            <div className="stat-value" style={{ color: "#6366f1" }}>{Number(supplies.total).toLocaleString()}</div>
            <div className="stat-label">{t("dailyJournal.supplies")} ({supplies.count})</div>
          </div>
        </div>
      </div>

      {/* Sales by Payment Method */}
      {sales.byMethod.length > 0 && (
        <div className="dj-section">
          <h3 className="dj-section-title"><Wallet size={16} /> {t("dailyJournal.salesByMethod")}</h3>
          <div className="dj-method-chips">
            {sales.byMethod.map((m, i) => (
              <div key={i} className="dj-method-chip">
                <span className="dj-method-name">{m.name}</span>
                <span className="dj-method-total">{Number(m.total).toLocaleString()}</span>
                <span className="dj-method-count">{m.count} {t("dailyJournal.invoices")}</span>
              </div>
            ))}
          </div>
          {sales.unpaid > 0 && (
            <div className="dj-unpaid">{t("dailyJournal.unpaid")}: {Number(sales.unpaid).toLocaleString()} {t("app.currency")}</div>
          )}
        </div>
      )}

      {/* Sale Invoices List */}
      {sales.invoices.length > 0 && (
        <div className="dj-section">
          <h3 className="dj-section-title"><FileText size={16} /> {t("dailyJournal.saleInvoices")} ({sales.count})</h3>
          <div className="dj-list">
            {sales.invoices.map((inv) => (
              <div key={inv.id} className="dj-list-item" onClick={() => setDetailInvoice(inv)}>
                <div className="dj-item-left">
                  <div className="dj-item-primary">{inv.invoice_code || `#${inv.id}`}</div>
                  <div className="dj-item-sub">{inv.customer_name || "—"}</div>
                </div>
                <div className="dj-item-right">
                  <div className="dj-item-amount" style={{ color: "#22c55e" }}>{Number(inv.total).toLocaleString()}</div>
                  <div className="dj-item-sub">{inv.payment_method_name || "—"}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Expenses List */}
      {expenses.items.length > 0 && (
        <div className="dj-section">
          <h3 className="dj-section-title"><Receipt size={16} /> {t("dailyJournal.expenses")} ({expenses.count})</h3>
          <div className="dj-list">
            {expenses.items.map((e) => (
              <div key={e.id} className="dj-list-item">
                <div className="dj-item-left">
                  <div className="dj-item-primary">{t(`expenses.categories.${e.category}`)}</div>
                  <div className="dj-item-sub">{e.notes || "—"}</div>
                </div>
                <div className="dj-item-right">
                  <div className="dj-item-amount" style={{ color: "#ef4444" }}>-{Number(e.amount).toLocaleString()}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Waste */}
      {waste.items.length > 0 && (
        <div className="dj-section">
          <h3 className="dj-section-title"><AlertTriangle size={16} /> {t("dailyJournal.waste")} ({waste.items.length})</h3>
          <div className="dj-list">
            {waste.items.map((w) => (
              <div key={w.id} className="dj-list-item">
                <div className="dj-item-left">
                  <div className="dj-item-primary">{w.product_name} — {w.batch_code || ""}</div>
                  <div className="dj-item-sub">{w.qty} {w.unit} — {t(`waste.reasons.${w.reason}`)}</div>
                </div>
                <div className="dj-item-right">
                  <div className="dj-item-amount" style={{ color: "#f59e0b" }}>{Number(w.loss_value).toLocaleString()}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Supplies */}
      {supplies.invoices.length > 0 && (
        <div className="dj-section">
          <h3 className="dj-section-title"><Package size={16} /> {t("dailyJournal.supplies")} ({supplies.count})</h3>
          <div className="dj-list">
            {supplies.invoices.map((s) => (
              <div key={s.id} className="dj-list-item">
                <div className="dj-item-left">
                  <div className="dj-item-primary">{s.supplier_name || "—"}</div>
                  <div className="dj-item-sub">{s.notes || "—"}</div>
                </div>
                <div className="dj-item-right">
                  <div className="dj-item-amount" style={{ color: "#6366f1" }}>{Number(s.total).toLocaleString()}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Debt Payments */}
      {debtPayments.items.length > 0 && (
        <div className="dj-section">
          <h3 className="dj-section-title"><Wallet size={16} /> {t("dailyJournal.debtPayments")}</h3>
          <div className="dj-list">
            {debtPayments.items.map((dp) => (
              <div key={dp.id} className="dj-list-item">
                <div className="dj-item-left">
                  <div className="dj-item-primary">{dp.customer_name || "—"}</div>
                </div>
                <div className="dj-item-right">
                  <div className="dj-item-amount" style={{ color: "#22c55e" }}>+{Number(dp.amount).toLocaleString()}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Transfers */}
      {transfers.length > 0 && (
        <div className="dj-section">
          <h3 className="dj-section-title"><ArrowLeftRight size={16} /> {t("dailyJournal.transfers")}</h3>
          <div className="dj-list">
            {transfers.map((tr) => (
              <div key={tr.id} className="dj-list-item">
                <div className="dj-item-left">
                  <div className="dj-item-primary">{tr.from_name || "—"} → {tr.to_name || "—"}</div>
                  <div className="dj-item-sub">{tr.note || "—"}</div>
                </div>
                <div className="dj-item-right">
                  <div className="dj-item-amount">{Number(tr.amount).toLocaleString()}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty */}
      {sales.count === 0 && expenses.count === 0 && waste.items.length === 0 && supplies.count === 0 && debtPayments.items.length === 0 && (
        <EmptyState icon={Calendar} msg={t("dailyJournal.noData")} />
      )}

      {/* Invoice Detail Modal */}
      <Modal open={!!detailInvoice} onClose={() => setDetailInvoice(null)} title={detailInvoice ? `${t("dailyJournal.invoice")} ${detailInvoice.invoice_code || ""}` : ""}>
        {detailInvoice && (
          <div className="dj-invoice-detail">
            <div className="dj-detail-row"><span>{t("saleInvoices.customer")}</span><span>{detailInvoice.customer_name || "—"}</span></div>
            <div className="dj-detail-row"><span>{t("app.date")}</span><span>{detailInvoice.date}</span></div>
            <div className="dj-detail-row"><span>{t("dailyJournal.payMethod")}</span><span>{detailInvoice.payment_method_name || "—"}</span></div>
            <div className="dj-detail-row"><span>{t("dailyJournal.payStatus")}</span>
              <span style={{ color: Number(detailInvoice.paid) >= Number(detailInvoice.total) ? "#22c55e" : "#f59e0b" }}>
                {Number(detailInvoice.paid) >= Number(detailInvoice.total) ? t("dailyJournal.paid") : `${t("dailyJournal.partial")}: ${Number(detailInvoice.paid).toLocaleString()}`}
              </span>
            </div>
            <div className="dj-detail-divider" />
            <div className="dj-detail-items">
              {detailInvoice.items.map((it, i) => (
                <div key={i} className="dj-detail-item">
                  <span>{it.product_name} × {it.qty}</span>
                  <span>{Number(it.total).toLocaleString()}</span>
                </div>
              ))}
            </div>
            <div className="dj-detail-divider" />
            <div className="dj-detail-row dj-detail-total"><span>{t("pos.total")}</span><span>{Number(detailInvoice.total).toLocaleString()} {t("app.currency")}</span></div>
          </div>
        )}
      </Modal>
    </div>
  );
}

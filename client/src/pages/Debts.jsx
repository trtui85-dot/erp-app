import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { http } from "../api";
import { useToast } from "../components/toast";
import { Modal, EmptyState, PageLoader, Badge, DataTable } from "../components/ui";
import { AlertTriangle } from "lucide-react";

const STATUS_COLORS = { pending: "#ef4444", partial: "#f59e0b", paid: "#22c55e" };

export default function Debts() {
  const { t } = useTranslation();
  const toast = useToast();
  const [debts, setDebts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [payModal, setPayModal] = useState(false);
  const [selected, setSelected] = useState(null);
  const [payAmount, setPayAmount] = useState("");
  const [saving, setSaving] = useState(false);

  const load = (status) => {
    setLoading(true);
    const params = status && status !== "all" ? `?status=${status}` : "";
    http.get(`/debts${params}`).then((d) => setDebts(d.data)).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(() => { load(filter); }, [filter]);

  const openPay = (debt) => { setSelected(debt); setPayAmount(""); setPayModal(true); };

  const handlePay = async () => {
    if (!payAmount || Number(payAmount) <= 0) return;
    setSaving(true);
    try {
      await http.post(`/debts/${selected.id}/pay`, { amount: Number(payAmount) });
      toast.success(t("app.save") + " ✓");
      setPayModal(false);
      load(filter);
    } catch (err) { toast.error(err.message || "Erreur"); }
    finally { setSaving(false); }
  };

  const columns = [
    { label: t("debts.customer") },
    { label: t("debts.amount"), width: "100px" },
    { label: t("debts.paid"), width: "90px" },
    { label: t("debts.remaining"), width: "90px" },
    { label: t("app.status"), width: "80px" },
  ];

  return (
    <div className="page-container">
      <h1 className="page-title">{t("debts.title")}</h1>
      <div className="filter-tabs">
        {["all", "pending", "partial", "paid"].map((f) => (
          <button key={f} className={`tab${filter === f ? " active" : ""}`} onClick={() => setFilter(f)}>
            {f === "all" ? t("app.all") : t(`debts.${f === "paid" ? "paid_label" : f}`)}
          </button>
        ))}
      </div>
      {loading ? <PageLoader /> : debts.length === 0 ? <EmptyState icon={AlertTriangle} msg={t("debts.noData")} /> : (
        <DataTable columns={columns}>
          {debts.map((d) => {
            const remaining = Number(d.amount) - Number(d.paid);
            return (
              <tr key={d.id} style={{ cursor: "pointer" }} onClick={() => openPay(d)}>
                <td className="card-cell-primary">{d.customer_name || `#${d.customer_id}`}</td>
                <td>{Number(d.amount).toLocaleString()}</td>
                <td>{Number(d.paid).toLocaleString()}</td>
                <td>{remaining.toLocaleString()}</td>
                <td><Badge color={STATUS_COLORS[d.status] || "#6b7280"}>{t(`debts.${d.status === "paid" ? "paid_label" : d.status}`)}</Badge></td>
              </tr>
            );
          })}
        </DataTable>
      )}
      <Modal open={payModal} onClose={() => setPayModal(false)} title={t("debts.pay")}>
        <form onSubmit={(e) => { e.preventDefault(); handlePay(); }} className="modal-form">
          <div className="input-group">
            <label>{t("debts.customer")}: {selected?.customer_name}</label>
          </div>
          <div className="input-group">
            <label>{t("debts.remaining")}: {selected ? (Number(selected.amount) - Number(selected.paid)).toLocaleString() : 0} {t("app.currency")}</label>
          </div>
          <div className="input-group">
            <label>{t("debts.paymentAmount")}</label>
            <input type="number" required min="0.01" step="0.01" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} />
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={() => setPayModal(false)}>{t("app.cancel")}</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? "..." : t("app.validate")}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

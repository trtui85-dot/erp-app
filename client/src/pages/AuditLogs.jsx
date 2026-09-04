import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { http } from "../api";
import { useToast } from "../components/toast";
import { EmptyState, PageLoader, DataTable, Badge } from "../components/ui";
import { FileSearch, RefreshCw } from "lucide-react";

function actionColor(action = "") {
  const a = String(action).toUpperCase();
  if (a.includes("LOGIN_FAILED")) return "#f59e0b";
  if (a.startsWith("LOGIN") || a.startsWith("LOGOUT")) return "#22c55e";
  if (a.startsWith("DELETE")) return "#ef4444";
  if (a.startsWith("POST")) return "#3b82f6";
  if (a.startsWith("PATCH") || a.startsWith("PUT")) return "#8b5cf6";
  return "#6b7280";
}

function formatTime(v) {
  if (!v) return "";
  const d = new Date(v);
  if (isNaN(d)) return String(v);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export default function AuditLogs() {
  const { t } = useTranslation();
  const toast = useToast();
  const [logs, setLogs] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState("");
  const [action, setAction] = useState("");
  const [limit, setLimit] = useState(300);

  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const [fromDate, setFromDate] = useState(todayStr);
  const [toDate, setToDate] = useState(todayStr);

  useEffect(() => {
    http.get("/users").then((d) => setUsers(d.data)).catch(() => {});
  }, []);

  const load = () => {
    setLoading(true);
    const params = { limit };
    if (userId) params.user_id = userId;
    if (action.trim()) params.action = action.trim();
    if (fromDate) params.from_date = fromDate;
    if (toDate) params.to_date = toDate;
    http.get("/users/logs", { params })
      .then((d) => setLogs(d.data))
      .catch((e) => { toast.error(e.message || "Erreur"); setLogs([]); })
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const columns = [
    { label: t("audit.time"), width: "160px" },
    { label: t("audit.user"), width: "150px" },
    { label: t("audit.action"), width: "180px" },
    { label: t("audit.details") },
    { label: t("audit.ip"), width: "130px" },
  ];

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">{t("audit.title")}</h1>
        <button className="btn btn-ghost" onClick={load} disabled={loading}>
          <RefreshCw size={18} /> {t("audit.refresh")}
        </button>
      </div>

      <div className="section" style={{ marginTop: 16 }}>
        <div className="audit-filters">
          <div className="input-group" style={{ minWidth: 160 }}>
            <label>{t("audit.from")}</label>
            <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          </div>
          <div className="input-group" style={{ minWidth: 160 }}>
            <label>{t("audit.to")}</label>
            <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
          </div>
          <div className="input-group" style={{ minWidth: 180 }}>
            <label>{t("audit.user")}</label>
            <select className="select-input" value={userId} onChange={(e) => setUserId(e.target.value)}>
              <option value="">{t("audit.allUsers")}</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.name} ({u.phone})</option>)}
            </select>
          </div>
          <div className="input-group" style={{ minWidth: 180 }}>
            <label>{t("audit.action")}</label>
            <input value={action} onChange={(e) => setAction(e.target.value)} placeholder="LOGIN, POST..." />
          </div>
          <div className="input-group" style={{ minWidth: 120 }}>
            <label>{t("audit.limit")}</label>
            <select className="select-input" value={limit} onChange={(e) => setLimit(Number(e.target.value))}>
              <option value={100}>100</option>
              <option value={300}>300</option>
              <option value={600}>600</option>
              <option value={1000}>1000</option>
            </select>
          </div>
          <button className="btn btn-primary audit-filter-btn" onClick={load}>{t("reports.filter")}</button>
        </div>
      </div>

      <div style={{ marginTop: 20 }}>
        {loading ? <PageLoader /> : logs.length === 0 ? <EmptyState icon={FileSearch} msg={t("audit.noData")} /> : (
          <DataTable columns={columns}>
            {logs.map((log) => (
              <tr key={log.id}>
                <td dir="ltr" className="muted-text">{formatTime(log.created_at)}</td>
                <td className="card-cell-primary">
                  {log.user_name || <span className="muted-text">{t("audit.unknown")}</span>}
                  {log.user_phone && <span className="muted-text" style={{ display: "block" }} dir="ltr">{log.user_phone}</span>}
                </td>
                <td><Badge color={actionColor(log.action)}>{log.action}</Badge></td>
                <td className="muted-text">{log.details || "—"}</td>
                <td dir="ltr"><code className="audit-ip">{log.ip || "—"}</code></td>
              </tr>
            ))}
          </DataTable>
        )}
      </div>
    </div>
  );
}
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { http } from "../api";
import { useToast } from "../components/toast";
import { Modal, EmptyState, PageLoader, Badge, DataTable, SearchSelect } from "../components/ui";
import { Users, Plus, Edit, Wallet, Calendar, ArrowDownCircle, AlertTriangle, CreditCard, X, Check } from "lucide-react";

const ROLES = ["worker", "seller", "driver", "accountant", "manager", "other"];
const SALARY_TYPES = ["monthly", "daily", "piece"];

export default function Employees() {
  const { t } = useTranslation();
  const toast = useToast();
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("list");
  const [modal, setModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState({ name: "", phone: "", role: "worker", salary_type: "daily", salary_amount: "", hire_date: "", notes: "" });
  const [saving, setSaving] = useState(false);

  const [attModal, setAttModal] = useState(null);
  const [attForm, setAttForm] = useState({ date: new Date().toISOString().split("T")[0], work_type: "daily", amount: "", notes: "" });

  const [payModal, setPayModal] = useState(null);
  const [payForm, setPayForm] = useState({ amount: "", payment_method_id: "", notes: "" });
  const [paymentMethods, setPaymentMethods] = useState([]);

  const [advModal, setAdvModal] = useState(null);
  const [advForm, setAdvForm] = useState({ amount: "", date: new Date().toISOString().split("T")[0], notes: "" });

  const [report, setReport] = useState(null);
  const [reportMonth, setReportMonth] = useState(new Date().toISOString().slice(0, 7));

  const fetchData = async () => {
    setLoading(true);
    try {
      const [eRes, pmRes] = await Promise.all([
        http.get("/employees"),
        http.get("/paymentmethods").catch(() => ({ data: [] })),
      ]);
      setEmployees(eRes.data);
      setPaymentMethods(pmRes.data);
    } catch {}
    finally { setLoading(false); }
  };

  const fetchReport = async () => {
    try {
      const res = await http.get("/employee-report", { params: { month: reportMonth } });
      setReport(res.data);
    } catch {}
  };

  useEffect(() => { fetchData(); }, []);
  useEffect(() => { if (tab === "report") fetchReport(); }, [tab, reportMonth]);

  const openAdd = () => { setEditItem(null); setForm({ name: "", phone: "", role: "worker", salary_type: "daily", salary_amount: "", hire_date: "", notes: "" }); setModal(true); };
  const openEdit = (e) => { setEditItem(e); setForm({ name: e.name, phone: e.phone || "", role: e.role, salary_type: e.salary_type, salary_amount: e.salary_amount, hire_date: e.hire_date || "", notes: e.notes || "" }); setModal(true); };

  const handleSave = async (ev) => {
    ev.preventDefault();
    setSaving(true);
    try {
      if (editItem) { await http.patch(`/employees/${editItem.id}`, form); toast.success(t("app.save") + " ✓"); }
      else { await http.post("/employees", form); toast.success(t("app.add") + " ✓"); }
      setModal(false); fetchData();
    } catch (err) { toast.error(err.message || "Erreur"); }
    finally { setSaving(false); }
  };

  const handleAttendance = async (ev) => {
    ev.preventDefault();
    if (!attModal) return;
    setSaving(true);
    try {
      await http.post("/employee-attendance", { employee_id: attModal.id, ...attForm, amount: Number(attForm.amount) || attModal.salary_amount || 0 });
      toast.success("✓");
      setAttModal(null); fetchData();
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  const handlePay = async (ev) => {
    ev.preventDefault();
    if (!payModal) return;
    setSaving(true);
    try {
      await http.post("/employee-payments", {
        employee_id: payModal.id,
        amount: Number(payForm.amount),
        payment_method_id: payForm.payment_method_id || null,
        notes: payForm.notes,
      });
      toast.success("✓");
      setPayModal(null); fetchData();
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  const handleAdvance = async (ev) => {
    ev.preventDefault();
    if (!advModal) return;
    setSaving(true);
    try {
      await http.post("/employee-advances", { employee_id: advModal.id, ...advForm, amount: Number(advForm.amount) });
      toast.success("✓");
      setAdvModal(null); fetchData();
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  const getSalaryLabel = (type) => t(`employees.salaryTypes.${type}`);
  const getRoleLabel = (role) => t(`employees.roles.${role}`);

  if (loading) return <PageLoader />;

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">{t("employees.title")}</h1>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-ghost" onClick={() => setTab(tab === "report" ? "list" : "report")}>
            {tab === "report" ? <><Users size={16} /> {t("employees.list")}</> : <><Wallet size={16} /> {t("employees.monthlyReport")}</>}
          </button>
          <button className="btn btn-primary" onClick={openAdd}><Plus size={18} /> {t("employees.add")}</button>
        </div>
      </div>

      {tab === "list" ? (
        employees.length === 0 ? <EmptyState icon={Users} msg={t("employees.noEmployees")} /> : (
          <div className="stats-grid" style={{ marginBottom: 16 }}>
            {employees.map((emp) => (
              <div key={emp.id} className="stat-card" style={{ cursor: "pointer", opacity: emp.active ? 1 : 0.5 }} onClick={() => openEdit(emp)}>
                <div className="stat-icon" style={{ background: emp.active ? "rgba(26,115,232,0.1)" : "rgba(0,0,0,0.05)" }}>
                  <Users size={20} color={emp.active ? "var(--primary)" : "var(--gray-400)"} />
                </div>
                <div className="stat-info">
                  <div className="stat-value" style={{ fontSize: "0.9rem" }}>{emp.name}</div>
                  <div className="stat-label">{getRoleLabel(emp.role)} — {getSalaryLabel(emp.salary_type)}</div>
                  <div style={{ fontSize: "0.75rem", color: "var(--gray-400)" }}>{Number(emp.salary_amount).toLocaleString()} {t("app.currency")}</div>
                </div>
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 4 }}>
                  <button className="btn btn-ghost" style={{ fontSize: "0.65rem", padding: "2px 6px" }} onClick={(e) => { e.stopPropagation(); setAttModal(emp); }}><Calendar size={12} /> {t("employees.attendance")}</button>
                  <button className="btn btn-ghost" style={{ fontSize: "0.65rem", padding: "2px 6px" }} onClick={(e) => { e.stopPropagation(); setPayModal(emp); setPayForm({ amount: emp.salary_amount || "", payment_method_id: paymentMethods[0]?.id || "", notes: "" }); }}><CreditCard size={12} /> {t("employees.pay")}</button>
                  <button className="btn btn-ghost" style={{ fontSize: "0.65rem", padding: "2px 6px" }} onClick={(e) => { e.stopPropagation(); setAdvModal(emp); }}><ArrowDownCircle size={12} /> {t("employees.advance")}</button>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <label style={{ fontSize: "0.8rem", fontWeight: 500 }}>{t("employees.month")}:</label>
            <input type="month" value={reportMonth} onChange={(e) => setReportMonth(e.target.value)} style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid var(--gray-200)", fontSize: "0.85rem" }} />
          </div>
          {report && (
            <>
              <div className="stats-grid" style={{ marginBottom: 16 }}>
                <div className="stat-card">
                  <div className="stat-icon" style={{ background: "rgba(34,197,94,0.1)" }}><Wallet size={20} color="#22c55e" /></div>
                  <div className="stat-info">
                    <div className="stat-value" style={{ color: "#22c55e" }}>{Number(report.totalPaid).toLocaleString()}</div>
                    <div className="stat-label">{t("employees.totalPaid")}</div>
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon" style={{ background: "rgba(245,158,11,0.1)" }}><AlertTriangle size={20} color="#f59e0b" /></div>
                  <div className="stat-info">
                    <div className="stat-value" style={{ color: "#f59e0b" }}>{Number(report.totalDue - report.totalPaid).toLocaleString()}</div>
                    <div className="stat-label">{t("employees.remaining")}</div>
                  </div>
                </div>
              </div>
              {report.employees.map((emp) => (
                <div key={emp.id} className="dj-list-item" style={{ marginBottom: 6 }}>
                  <div className="dj-item-left">
                    <div className="dj-item-primary">{emp.name}</div>
                    <div className="dj-item-sub">{getRoleLabel(emp.role)} — {getSalaryLabel(emp.salary_type)}: {Number(emp.salary_amount).toLocaleString()}</div>
                  </div>
                  <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: "0.7rem", color: "var(--gray-400)" }}>{t("employees.due")}</div>
                      <div style={{ fontWeight: 600, fontSize: "0.82rem" }}>{Number(emp.totalDue).toLocaleString()}</div>
                    </div>
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: "0.7rem", color: "#22c55e" }}>{t("employees.paid")}</div>
                      <div style={{ fontWeight: 600, fontSize: "0.82rem", color: "#22c55e" }}>{Number(emp.totalPaid).toLocaleString()}</div>
                    </div>
                    {emp.activeAdvances > 0 && <Badge color="#f59e0b">{t("employees.advance")}: {Number(emp.activeAdvances).toLocaleString()}</Badge>}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {/* Add/Edit Modal */}
      <Modal open={modal} onClose={() => setModal(false)} title={editItem ? t("employees.edit") : t("employees.add")}>
        <form onSubmit={handleSave} className="modal-form">
          <div className="input-group"><label>{t("employees.name")}</label><input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div className="input-group"><label>{t("employees.phone")}</label><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
          <div className="input-group"><label>{t("employees.role")}</label>
            <SearchSelect value={form.role} onChange={(v) => setForm({ ...form, role: v })} options={ROLES.map((r) => ({ value: r, label: t(`employees.roles.${r}`) }))} />
          </div>
          <div className="input-group"><label>{t("employees.salaryType")}</label>
            <SearchSelect value={form.salary_type} onChange={(v) => setForm({ ...form, salary_type: v })} options={SALARY_TYPES.map((s) => ({ value: s, label: t(`employees.salaryTypes.${s}`) }))} />
          </div>
          <div className="input-group"><label>{t("employees.salaryAmount")}</label><input type="number" min="0" value={form.salary_amount} onChange={(e) => setForm({ ...form, salary_amount: e.target.value })} /></div>
          <div className="input-group"><label>{t("employees.hireDate")}</label><input type="date" value={form.hire_date} onChange={(e) => setForm({ ...form, hire_date: e.target.value })} /></div>
          <div className="input-group"><label>{t("app.note")}</label><textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={() => setModal(false)}>{t("app.cancel")}</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? "..." : t("app.save")}</button>
          </div>
        </form>
      </Modal>

      {/* Attendance Modal */}
      <Modal open={!!attModal} onClose={() => setAttModal(null)} title={t("employees.attendance") + " — " + (attModal?.name || "")}>
        {attModal && (
          <form onSubmit={handleAttendance} className="modal-form">
            <div className="input-group"><label>{t("app.date")}</label><input type="date" required value={attForm.date} onChange={(e) => setAttForm({ ...attForm, date: e.target.value })} /></div>
            <div className="input-group"><label>{t("employees.workType")}</label>
              <SearchSelect value={attForm.work_type} onChange={(v) => setAttForm({ ...attForm, work_type: v })} options={[{ value: "daily", label: t("employees.workTypes.daily") }, { value: "unloading", label: t("employees.workTypes.unloading") }, { value: "piece", label: t("employees.workTypes.piece") }]} />
            </div>
            <div className="input-group"><label>{t("employees.amount")}</label><input type="number" min="0" value={attForm.amount} onChange={(e) => setAttForm({ ...attForm, amount: e.target.value })} placeholder={String(attModal.salary_amount || 0)} /></div>
            <div className="input-group"><label>{t("app.note")}</label><input value={attForm.notes} onChange={(e) => setAttForm({ ...attForm, notes: e.target.value })} /></div>
            <div className="modal-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setAttModal(null)}>{t("app.cancel")}</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? "..." : t("app.save")}</button>
            </div>
          </form>
        )}
      </Modal>

      {/* Pay Modal */}
      <Modal open={!!payModal} onClose={() => setPayModal(null)} title={t("employees.pay") + " — " + (payModal?.name || "")}>
        {payModal && (
          <form onSubmit={handlePay} className="modal-form">
            <div style={{ padding: "8px 0", fontSize: "0.82rem", color: "var(--gray-500)" }}>
              {t("employees.salaryType")}: {getSalaryLabel(payModal.salary_type)} — {Number(payModal.salary_amount).toLocaleString()} {t("app.currency")}
            </div>
            <div className="input-group"><label>{t("employees.amount")}</label><input type="number" min="0.01" required value={payForm.amount} onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })} /></div>
            <div className="input-group"><label>{t("employees.paymentMethod")}</label>
              <SearchSelect value={payForm.payment_method_id} onChange={(v) => setPayForm({ ...payForm, payment_method_id: v })} options={paymentMethods.map((m) => ({ value: m.id, label: m.name }))} />
            </div>
            <div className="input-group"><label>{t("app.note")}</label><input value={payForm.notes} onChange={(e) => setPayForm({ ...payForm, notes: e.target.value })} /></div>
            <div className="modal-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setPayModal(null)}>{t("app.cancel")}</button>
              <button type="submit" className="btn btn-success" disabled={saving}>{saving ? "..." : <><Check size={16} /> {t("employees.confirmPay")}</>}</button>
            </div>
          </form>
        )}
      </Modal>

      {/* Advance Modal */}
      <Modal open={!!advModal} onClose={() => setAdvModal(null)} title={t("employees.advance") + " — " + (advModal?.name || "")}>
        {advModal && (
          <form onSubmit={handleAdvance} className="modal-form">
            <div className="input-group"><label>{t("employees.amount")}</label><input type="number" min="0.01" required value={advForm.amount} onChange={(e) => setAdvForm({ ...advForm, amount: e.target.value })} /></div>
            <div className="input-group"><label>{t("app.date")}</label><input type="date" value={advForm.date} onChange={(e) => setAdvForm({ ...advForm, date: e.target.value })} /></div>
            <div className="input-group"><label>{t("app.note")}</label><input value={advForm.notes} onChange={(e) => setAdvForm({ ...advForm, notes: e.target.value })} /></div>
            <div className="modal-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setAdvModal(null)}>{t("app.cancel")}</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? "..." : t("app.save")}</button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}

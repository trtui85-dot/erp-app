import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { http } from "../api";
import { useToast } from "../components/toast";
import { Modal, EmptyState, PageLoader, Badge, DataTable, SearchSelect } from "../components/ui";
import { Plus, Edit, Wallet, ArrowDownCircle, ArrowUpCircle, ArrowLeftRight, X, Smartphone, CreditCard, Building2, Send, Banknote, Camera } from "lucide-react";

const TX_ICONS = { deposit: ArrowDownCircle, withdrawal: ArrowUpCircle, transfer: ArrowLeftRight, sale: Wallet, purchase: ArrowUpCircle };

const METHOD_ICONS = { Wallet, Smartphone, CreditCard, Building2, Send, Banknote };

function Logo({ m, size = 40 }) {
  if (m.logo_url) {
    const src = m.logo_url.startsWith("http") ? m.logo_url : m.logo_url;
    return <img src={src} alt={m.name} style={{ width: size, height: size, borderRadius: 10, objectFit: "cover" }} />;
  }
  const Ic = METHOD_ICONS[m.icon] || Wallet;
  return (
    <div style={{ width: size, height: size, borderRadius: 10, background: (m.color || "#6b7280") + "22", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      <Ic size={size * 0.55} color={m.color || "#6b7280"} />
    </div>
  );
}

export default function PaymentMethods() {
  const { t } = useTranslation();
  const toast = useToast();
  const [methods, setMethods] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [txModal, setTxModal] = useState(null);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState({ name: "", type: "cash", account_number: "", icon: "Wallet", color: "#34a853" });
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [txForm, setTxForm] = useState({ amount: "", note: "" });
  const [saving, setSaving] = useState(false);
  const [txType, setTxType] = useState("deposit");
  const [txFilter, setTxFilter] = useState({ type: "" });
  const [transferModal, setTransferModal] = useState(false);
  const [transferForm, setTransferForm] = useState({ from: "", to: "", amount: "", note: "" });
  const fileRef = useRef(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [mRes, tRes] = await Promise.all([
        http.get("/paymentmethods"),
        http.get("/paymentmethods/transactions"),
      ]);
      setMethods(mRes.data);
      setTransactions(tRes.data);
    } catch {}
    finally { setLoading(false); }
  };
  useEffect(() => { fetchData(); }, []);

  const openAdd = () => {
    setEditItem(null);
    setForm({ name: "", type: "cash", account_number: "", icon: "Wallet", color: "#34a853" });
    setLogoFile(null);
    setLogoPreview(null);
    setModal(true);
  };
  const openEdit = (m) => {
    setEditItem(m);
    setForm({ name: m.name, type: m.type, account_number: m.account_number || "", icon: m.icon || "Wallet", color: m.color || "#34a853" });
    setLogoFile(null);
    setLogoPreview(m.logo_url ? (m.logo_url.startsWith("http") ? m.logo_url : m.logo_url) : null);
    setModal(true);
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setLogoFile(file);
      setLogoPreview(URL.createObjectURL(file));
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append("name", form.name);
      fd.append("type", form.type);
      fd.append("account_number", form.account_number || "");
      fd.append("color", form.color);
      if (logoFile) fd.append("logo", logoFile);

      if (editItem) {
        await http.patch(`/paymentmethods/${editItem.id}`, fd);
        toast.success(t("app.save") + " ✓");
      } else {
        await http.post("/paymentmethods", fd);
        toast.success(t("app.add") + " ✓");
      }
      setModal(false);
      fetchData();
    } catch (err) { toast.error(err.message || "Erreur"); }
    finally { setSaving(false); }
  };

  const openTx = (type, method) => { setTxType(type); setTxModal(method); setTxForm({ amount: "", note: "" }); };

  const handleTx = async (e) => {
    e.preventDefault();
    if (!txForm.amount || Number(txForm.amount) <= 0) return;
    setSaving(true);
    try {
      const endpoint = txType === "deposit" ? "/paymentmethods/deposit" : "/paymentmethods/withdrawal";
      await http.post(endpoint, { payment_method_id: txModal.id, amount: Number(txForm.amount), note: txForm.note || null });
      toast.success(txType === "deposit" ? "✓ إيداع" : "✓ سحب");
      setTxModal(null);
      fetchData();
    } catch (err) { toast.error(err.message || "Erreur"); }
    finally { setSaving(false); }
  };

  const handleTransfer = async (e) => {
    e.preventDefault();
    if (!transferForm.from || !transferForm.to || !transferForm.amount) return;
    setSaving(true);
    try {
      await http.post("/paymentmethods/transfer", {
        from_payment_method_id: Number(transferForm.from),
        to_payment_method_id: Number(transferForm.to),
        amount: Number(transferForm.amount),
        note: transferForm.note || null,
      });
      toast.success("✓ تحويل");
      setTransferModal(false);
      fetchData();
    } catch (err) { toast.error(err.message || "Erreur"); }
    finally { setSaving(false); }
  };

  if (loading) return <PageLoader />;

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">{t("paymentMethods.title")}</h1>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-ghost" onClick={() => setTransferModal(true)}><ArrowLeftRight size={16} /> {t("paymentMethods.transfer")}</button>
          <button className="btn btn-primary" onClick={openAdd}><Plus size={18} /> {t("paymentMethods.add")}</button>
        </div>
      </div>

      <div className="stats-grid" style={{ marginBottom: 16 }}>
        {methods.map((m) => (
          <div key={m.id} className="stat-card" style={{ cursor: "pointer" }} onClick={() => openEdit(m)}>
            <Logo m={m} size={44} />
            <div className="stat-info">
              <div className="stat-value" style={{ fontSize: "0.95rem" }}>{Number(m.balance).toLocaleString()} {t("app.currency")}</div>
              <div className="stat-label">{m.name}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => methods[0] && openTx("deposit", methods[0])}>
          <ArrowDownCircle size={16} /> {t("paymentMethods.deposit")}
        </button>
        <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => methods[0] && openTx("withdrawal", methods[0])}>
          <ArrowUpCircle size={16} /> {t("paymentMethods.withdrawal")}
        </button>
      </div>

      <div className="filter-tabs">
        {["", "deposit", "withdrawal", "transfer", "sale"].map((f) => (
          <button key={f} className={`tab${txFilter.type === f ? " active" : ""}`} onClick={() => setTxFilter({ ...txFilter, type: f })}>
            {f === "" ? t("app.all") : t(`paymentMethods.tx_${f}`)}
          </button>
        ))}
      </div>

      {transactions.length === 0 ? (
        <EmptyState icon={Wallet} msg={t("paymentMethods.noTransactions")} />
      ) : (
        <DataTable columns={[
          { label: t("app.type"), width: "90px" },
          { label: t("paymentMethods.method") },
          { label: t("app.amount"), width: "110px" },
          { label: t("app.date"), width: "110px" },
        ]}>
          {transactions
            .filter((tx) => !txFilter.type || tx.ref_type === txFilter.type)
            .map((tx) => {
              const isCredit = tx.ref_type === "deposit" || tx.ref_type === "sale" || (tx.ref_type === "transfer" && tx.to_payment_method_id);
              return (
                <tr key={tx.id}>
                  <td><Badge color={isCredit ? "#22c55e" : "#ef4444"}>{t(`paymentMethods.tx_${tx.ref_type}`)}</Badge></td>
                  <td className="card-cell-primary">{tx.to_name || tx.from_name || "—"}</td>
                  <td style={{ color: isCredit ? "#22c55e" : "#ef4444", fontWeight: 600 }}>{isCredit ? "+" : "-"}{Number(tx.amount).toLocaleString()}</td>
                  <td>{tx.created_at ? new Date(tx.created_at).toLocaleDateString() : "—"}</td>
                </tr>
              );
            })}
        </DataTable>
      )}

      {/* Add/Edit Modal */}
      <Modal open={modal} onClose={() => setModal(false)} title={editItem ? t("paymentMethods.edit") : t("paymentMethods.add")}>
        <form onSubmit={handleSave} className="modal-form">
          <div className="input-group">
            <label>{t("paymentMethods.logo")}</label>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div
                onClick={() => fileRef.current?.click()}
                style={{ width: 64, height: 64, borderRadius: 12, border: "2px dashed var(--gray-300)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", overflow: "hidden", background: "var(--gray-50)", flexShrink: 0 }}
              >
                {logoPreview ? (
                  <img src={logoPreview} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <Camera size={24} color="var(--gray-400)" />
                )}
              </div>
              <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleFileChange} />
              <span style={{ fontSize: "0.75rem", color: "var(--gray-500)" }}>{logoFile ? logoFile.name : t("paymentMethods.logoHint")}</span>
            </div>
          </div>
          <div className="input-group">
            <label>{t("paymentMethods.name")}</label>
            <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={t("paymentMethods.namePlaceholder")} />
          </div>
          <div className="input-group">
            <label>{t("paymentMethods.type")}</label>
            <SearchSelect value={form.type} onChange={(v) => setForm({ ...form, type: v })}
              options={[{ value: "cash", label: t("paymentMethods.type_cash") }, { value: "bank", label: t("paymentMethods.type_bank") }, { value: "wallet", label: t("paymentMethods.type_wallet") }]} />
          </div>
          <div className="input-group">
            <label>{t("paymentMethods.accountNumber")}</label>
            <input value={form.account_number} onChange={(e) => setForm({ ...form, account_number: e.target.value })} placeholder={t("paymentMethods.accountNumberPlaceholder")} />
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={() => setModal(false)}>{t("app.cancel")}</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? "..." : t("app.save")}</button>
          </div>
        </form>
      </Modal>

      {/* Deposit/Withdrawal Modal */}
      <Modal open={!!txModal} onClose={() => setTxModal(null)} title={txType === "deposit" ? t("paymentMethods.deposit") : t("paymentMethods.withdrawal")}>
        {txModal && (
          <form onSubmit={handleTx} className="modal-form">
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0" }}>
              <Logo m={txModal} size={40} />
              <div>
                <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>{txModal.name}</div>
                <div style={{ fontSize: "0.75rem", color: "var(--gray-500)" }}>{t("paymentMethods.balance")}: {Number(txModal.balance).toLocaleString()}</div>
              </div>
            </div>
            <div className="input-group">
              <label>{t("app.amount")}</label>
              <input type="number" required min="0.01" step="0.01" value={txForm.amount} onChange={(e) => setTxForm({ ...txForm, amount: e.target.value })} />
            </div>
            <div className="input-group">
              <label>{t("app.note")}</label>
              <input value={txForm.note} onChange={(e) => setTxForm({ ...txForm, note: e.target.value })} />
            </div>
            <div className="modal-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setTxModal(null)}>{t("app.cancel")}</button>
              <button type="submit" className={`btn ${txType === "deposit" ? "btn-success" : "btn-danger"}`} disabled={saving}>{saving ? "..." : t("app.validate")}</button>
            </div>
          </form>
        )}
      </Modal>

      {/* Transfer Modal */}
      <Modal open={transferModal} onClose={() => setTransferModal(false)} title={t("paymentMethods.transfer")}>
        <form onSubmit={handleTransfer} className="modal-form">
          <div className="input-group">
            <label>{t("paymentMethods.from")}</label>
            <SearchSelect required value={transferForm.from} onChange={(v) => setTransferForm({ ...transferForm, from: v })} placeholder={t("paymentMethods.selectMethod")}
              options={methods.map((m) => ({ value: m.id, label: `${m.name} (${Number(m.balance).toLocaleString()})` }))} />
          </div>
          <div className="input-group">
            <label>{t("paymentMethods.to")}</label>
            <SearchSelect required value={transferForm.to} onChange={(v) => setTransferForm({ ...transferForm, to: v })} placeholder={t("paymentMethods.selectMethod")}
              options={methods.filter((m) => String(m.id) !== String(transferForm.from)).map((m) => ({ value: m.id, label: `${m.name} (${Number(m.balance).toLocaleString()})` }))} />
          </div>
          <div className="input-group">
            <label>{t("app.amount")}</label>
            <input type="number" required min="0.01" step="0.01" value={transferForm.amount} onChange={(e) => setTransferForm({ ...transferForm, amount: e.target.value })} />
          </div>
          <div className="input-group">
            <label>{t("app.note")}</label>
            <input value={transferForm.note} onChange={(e) => setTransferForm({ ...transferForm, note: e.target.value })} />
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={() => setTransferModal(false)}>{t("app.cancel")}</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? "..." : t("app.validate")}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

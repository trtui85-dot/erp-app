import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { http } from "../api";
import { useToast } from "../components/toast";
import { Modal, EmptyState, PageLoader, Badge, SearchSelect } from "../components/ui";
import { Plus, Trash2, Share2 } from "lucide-react";

const emptyItem = { batch_id: "", qty_given: 1, price: "" };

export default function Distributions() {
  const { t } = useTranslation();
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [settleModal, setSettleModal] = useState(false);
  const [settleDist, setSettleDist] = useState(null);
  const [settleItems, setSettleItems] = useState([]);
  const [form, setForm] = useState({ vendor_name: "", vendor_phone: "", date: new Date().toISOString().split("T")[0], commission_rate: "", notes: "", items: [{ ...emptyItem }] });
  const [saving, setSaving] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [distRes, batchRes] = await Promise.all([
        http.get("/distributions"),
        http.get("/batches"),
      ]);
      setItems(distRes.data);
      setBatches(batchRes.data);
    } catch {}
    finally { setLoading(false); }
  };
  useEffect(() => { fetchData(); }, []);

  const openAdd = () => {
    setForm({ vendor_name: "", vendor_phone: "", date: new Date().toISOString().split("T")[0], commission_rate: "", notes: "", items: [{ ...emptyItem }] });
    setModal(true);
  };

  const updateItem = (index, field, value) => {
    const newItems = [...form.items];
    newItems[index] = { ...newItems[index], [field]: value };
    if (field === "batch_id" && value) {
      const batch = batches.find((b) => b.id === Number(value));
      if (batch) newItems[index].price = batch.sale_price;
    }
    setForm({ ...form, items: newItems });
  };

  const handleSave = async () => {
    if (!form.vendor_name) return toast.error(t("distributions.vendor"));
    setSaving(true);
    try {
      await http.post("/distributions", {
        vendor_name: form.vendor_name,
        vendor_phone: form.vendor_phone,
        date: form.date,
        commission_rate: Number(form.commission_rate) || 0,
        notes: form.notes,
        items: form.items.map((it) => ({
          batch_id: Number(it.batch_id),
          qty_given: Number(it.qty_given),
          price: Number(it.price),
        })),
      });
      toast.success(t("app.save") + " ✓");
      setModal(false);
      fetchData();
    } catch (err) { toast.error(err.message || "Erreur"); }
    finally { setSaving(false); }
  };

  const openSettle = async (dist) => {
    try {
      const res = await http.get(`/distributions/${dist.id}`);
      setSettleDist(res.data);
      setSettleItems((res.data.items || []).map((it) => ({
        ...it,
        qty_sold: it.qty_sold || 0,
        qty_returned: it.qty_returned || 0,
      })));
      setSettleModal(true);
    } catch (err) { toast.error(err.message || "Erreur"); }
  };

  const updateSettleItem = (index, field, value) => {
    const newItems = [...settleItems];
    newItems[index] = { ...newItems[index], [field]: value };
    setSettleItems(newItems);
  };

  const handleSettle = async () => {
    setSaving(true);
    try {
      await http.post(`/distributions/${settleDist.id}/settle`, {
        items: settleItems.map((it) => ({
          id: it.id,
          qty_sold: Number(it.qty_sold),
          qty_returned: Number(it.qty_returned),
        })),
      });
      toast.success(t("distributions.settle") + " ✓");
      setSettleModal(false);
      fetchData();
    } catch (err) { toast.error(err.message || "Erreur"); }
    finally { setSaving(false); }
  };

  const STATUS_COLORS = { active: "#3b82f6", settled: "#22c55e", returned: "#9ca3af" };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">{t("distributions.title")}</h1>
        <button className="btn btn-primary" onClick={openAdd}><Plus size={18} /> {t("distributions.add")}</button>
      </div>
      {loading ? <PageLoader /> : items.length === 0 ? <EmptyState icon={Share2} msg={t("distributions.noData")} /> : (
        <div className="card-list">
          {items.map((d) => (
            <div key={d.id} className="card-item">
              <div className="card-main">
                <div className="card-title">{d.vendor_name}</div>
                <div className="card-sub">{d.date} · {t("app.total")}: {Number(d.total_value).toLocaleString()} {t("app.currency")}</div>
                {d.commission_rate > 0 && <div className="card-sub">{t("distributions.commission")}: {d.commission_rate}%</div>}
              </div>
              <div className="card-actions" style={{ gap: 4 }}>
                <Badge color={STATUS_COLORS[d.status]}>{t(`distributions.${d.status}`)}</Badge>
                {d.status === "active" && <button className="btn btn-ghost" onClick={() => openSettle(d)}>{t("distributions.settle")}</button>}
              </div>
            </div>
          ))}
        </div>
      )}
      <Modal open={modal} onClose={() => setModal(false)} title={t("distributions.add")} wide>
        <form onSubmit={(e) => { e.preventDefault(); handleSave(); }} className="modal-form">
          <div className="input-group">
            <label>{t("distributions.vendor")}</label>
            <input required value={form.vendor_name} onChange={(e) => setForm({ ...form, vendor_name: e.target.value })} />
          </div>
          <div className="input-group">
            <label>{t("distributions.phone")}</label>
            <input value={form.vendor_phone} onChange={(e) => setForm({ ...form, vendor_phone: e.target.value })} />
          </div>
          <div className="input-group" style={{ flexDirection: "row", gap: 8 }}>
            <div style={{ flex: 1 }}>
              <label>{t("app.date")}</label>
              <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </div>
            <div style={{ flex: 1 }}>
              <label>{t("distributions.commission")}</label>
              <input type="number" value={form.commission_rate} onChange={(e) => setForm({ ...form, commission_rate: e.target.value })} placeholder="0" />
            </div>
          </div>
          <div className="section">
            <div className="page-header" style={{ marginBottom: 8 }}>
              <span className="page-subtitle">{t("distributions.items")}</span>
              <button type="button" className="btn btn-ghost" onClick={() => setForm({ ...form, items: [...form.items, { ...emptyItem }] })}>
                <Plus size={14} /> {t("distributions.addItem")}
              </button>
            </div>
            {form.items.map((item, idx) => (
              <div key={idx} className="card-item" style={{ marginBottom: 8 }}>
                <div className="card-main" style={{ gap: 4 }}>
                  <SearchSelect compact value={item.batch_id} onChange={(v) => updateItem(idx, "batch_id", v)} placeholder={t("distributions.batch")}
                    options={batches.filter((b) => Number(b.remaining_qty) > 0).map((b) => ({ value: b.id, label: `${b.product_name} — ${b.remaining_qty} restant` }))} />
                  <div className="input-group" style={{ flexDirection: "row", gap: 8 }}>
                    <input type="number" placeholder={t("distributions.qtyGiven")} value={item.qty_given} onChange={(e) => updateItem(idx, "qty_given", e.target.value)} style={{ flex: 1 }} />
                    <input type="number" placeholder={t("distributions.price")} value={item.price} onChange={(e) => updateItem(idx, "price", e.target.value)} style={{ flex: 1 }} />
                  </div>
                </div>
                {form.items.length > 1 && (
                  <button type="button" className="icon-btn icon-btn-danger" onClick={() => setForm({ ...form, items: form.items.filter((_, i) => i !== idx) })}><Trash2 size={16} /></button>
                )}
              </div>
            ))}
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={() => setModal(false)}>{t("app.cancel")}</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? "..." : t("app.save")}</button>
          </div>
        </form>
      </Modal>
      <Modal open={settleModal} onClose={() => setSettleModal(false)} title={t("distributions.settle")} wide>
        <form onSubmit={(e) => { e.preventDefault(); handleSettle(); }} className="modal-form">
          {settleItems.map((item, idx) => (
            <div key={idx} className="card-item" style={{ marginBottom: 8 }}>
              <div className="card-main">
                <div className="card-title">Batch #{item.batch_id} — {item.qty_given} {t("distributions.qtyGiven")}</div>
                <div className="input-group" style={{ flexDirection: "row", gap: 8 }}>
                  <div style={{ flex: 1 }}>
                    <label>{t("distributions.qtySold")}</label>
                    <input type="number" value={item.qty_sold} onChange={(e) => updateSettleItem(idx, "qty_sold", e.target.value)} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label>{t("distributions.qtyReturned")}</label>
                    <input type="number" value={item.qty_returned} onChange={(e) => updateSettleItem(idx, "qty_returned", e.target.value)} />
                  </div>
                </div>
              </div>
            </div>
          ))}
          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={() => setSettleModal(false)}>{t("app.cancel")}</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? "..." : t("app.validate")}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { http } from "../api";
import { useToast } from "../components/toast";
import { PageLoader } from "../components/ui";

export default function Settings() {
  const { t } = useTranslation();
  const toast = useToast();
  const [mode, setMode] = useState("wholesale");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    http.get("/settings").then((d) => {
      const found = Array.isArray(d.data) ? d.data.find((s) => s.setting_key === "distribution_mode") : null;
      if (found) setMode(found.setting_value);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await http.patch("/settings", { distribution_mode: mode });
      toast.success(t("settings.saved") + " ✓");
    } catch (err) { toast.error(err.message || "Erreur"); }
    finally { setSaving(false); }
  };

  if (loading) return <PageLoader />;

  return (
    <div className="page-container">
      <h1 className="page-title">{t("settings.title")}</h1>
      <div className="section" style={{ marginTop: 16 }}>
        <div className="card-item" style={{ flexDirection: "column", gap: 12 }}>
          <h3 className="page-subtitle">{t("settings.distributionMode")}</h3>
          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
            <input type="radio" name="distMode" value="wholesale" checked={mode === "wholesale"} onChange={(e) => setMode(e.target.value)} />
            <span>{t("settings.wholesale")}</span>
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
            <input type="radio" name="distMode" value="commission" checked={mode === "commission"} onChange={(e) => setMode(e.target.value)} />
            <span>{t("settings.commission")}</span>
          </label>
        </div>
      </div>
      <button className="btn btn-primary" onClick={handleSave} disabled={saving} style={{ marginTop: 16 }}>
        {saving ? "..." : t("settings.save")}
      </button>
    </div>
  );
}

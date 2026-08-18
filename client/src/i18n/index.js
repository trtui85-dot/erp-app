import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import fr from "./fr.json";
import ar from "./ar.json";

const savedLang = localStorage.getItem("erp_lang") || "fr";
document.documentElement.dir = savedLang === "ar" ? "rtl" : "ltr";
document.documentElement.lang = savedLang;

i18n.use(initReactI18next).init({
  resources: { fr: { translation: fr }, ar: { translation: ar } },
  lng: savedLang,
  fallbackLng: "fr",
  interpolation: { escapeValue: false },
});

export function toggleLang() {
  const next = i18n.language === "fr" ? "ar" : "fr";
  i18n.changeLanguage(next);
  localStorage.setItem("erp_lang", next);
  document.documentElement.dir = next === "ar" ? "rtl" : "ltr";
  document.documentElement.lang = next;
}

export default i18n;

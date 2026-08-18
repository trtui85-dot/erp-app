import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../auth";
import { toggleLang } from "../i18n";
import { useState, useRef, useEffect } from "react";
import {
  LayoutDashboard, Package, Layers, Sun, Truck, ClipboardList,
  Users, ShoppingCart, AlertTriangle, Share2, Receipt, Trash, BarChart3,
  Settings, LogOut, MoreHorizontal, X, ChevronDown, Globe, CreditCard, Wallet, CalendarDays, FolderTree
} from "lucide-react";

const NAV_ITEMS = [
  { key: "dashboard", icon: LayoutDashboard },
  { key: "pos", icon: CreditCard },
  { key: "categories", icon: FolderTree },
  { key: "products", icon: Package },
  { key: "batches", icon: Layers },
  { key: "dailyPrices", icon: Sun },
  { key: "suppliers", icon: Truck },
  { key: "supplyInvoices", icon: ClipboardList },
  { key: "customers", icon: Users },
  { key: "saleInvoices", icon: ShoppingCart },
  { key: "debts", icon: AlertTriangle },
  { key: "distributions", icon: Share2 },
  { key: "expenses", icon: Receipt },
  { key: "dailyJournal", icon: CalendarDays },
  { key: "employees", icon: Users },
  { key: "waste", icon: Trash },
  { key: "reports", icon: BarChart3 },
  { key: "paymentMethods", icon: Wallet },
  { key: "settings", icon: Settings },
];

const BOTTOM_KEYS = ["dashboard", "pos", "customers", "saleInvoices", "settings"];

export default function Layout({ children }) {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef(null);

  useEffect(() => {
    const close = (e) => {
      if (moreRef.current && !moreRef.current.contains(e.target)) {
        setMoreOpen(false);
      }
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("touchstart", close);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("touchstart", close); };
  }, []);

  useEffect(() => {
    setMoreOpen(false);
  }, [location.pathname]);

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const activeKey = NAV_ITEMS.find((n) => location.pathname === `/${n.key}`)?.key || "dashboard";
  const moreItems = NAV_ITEMS.filter((n) => !BOTTOM_KEYS.includes(n.key) && n.key !== "settings");

  return (
    <div className="app-layout">
      {/* Sidebar desktop */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <img src="/logousigne.png" alt="" className="sidebar-logo" />
          <span className="sidebar-title">{t("app.title")}</span>
        </div>
        <nav className="sidebar-nav">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink key={item.key} to={`/${item.key}`} className={({ isActive }) => `nav-item${isActive ? " active" : ""}`}>
                <Icon size={20} />
                <span>{t(`nav.${item.key}`)}</span>
              </NavLink>
            );
          })}
        </nav>
        <div className="sidebar-footer">
          <button className="nav-item" onClick={toggleLang}><Globe size={20} /><span>{t("nav.more") === "Plus" ? "AR" : "FR"}</span></button>
          <button className="nav-item nav-logout" onClick={handleLogout}><LogOut size={20} /><span>{t("nav.logout")}</span></button>
        </div>
      </aside>

      {/* Main content */}
      <main className="main-content">
        <header className="topbar">
          <div className="topbar-left">
            <img src="/logousigne.png" alt="" className="topbar-logo" />
            <span className="topbar-title">{t("app.title")}</span>
          </div>
          <div className="topbar-right">
            <button className="icon-btn" onClick={toggleLang}><Globe size={20} /></button>
            <span className="topbar-user">{user?.name || "Admin"}</span>
            <button className="icon-btn" onClick={handleLogout}><LogOut size={20} /></button>
          </div>
        </header>
        <div className="page-content">{children}</div>
      </main>

      {/* Bottom nav mobile */}
      {moreOpen && <div className="more-backdrop" onClick={() => setMoreOpen(false)} />}
      <nav className="bottom-nav">
        {BOTTOM_KEYS.filter((k) => k !== "settings").map((key) => {
          const item = NAV_ITEMS.find((n) => n.key === key);
          const Icon = item.icon;
          return (
            <NavLink key={key} to={`/${key}`} className={({ isActive }) => `bnav-item${isActive ? " active" : ""}`}>
              <Icon size={22} />
              <span>{t(`nav.${key}`)}</span>
            </NavLink>
          );
        })}
        <div className="bnav-more-wrap" ref={moreRef}>
          <button className={`bnav-item${moreOpen ? " active" : ""}`} onClick={() => setMoreOpen(!moreOpen)}>
            <MoreHorizontal size={22} />
            <span>{t("nav.more")}</span>
          </button>
          <div className={`bnav-dropdown${moreOpen ? " open" : ""}`}>
            {moreItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink key={item.key} to={`/${item.key}`} className="bnav-drop-item">
                  <Icon size={18} /> {t(`nav.${item.key}`)}
                </NavLink>
              );
            })}
            <button className="bnav-drop-item" onClick={toggleLang}><Globe size={18} /> FR/AR</button>
            <button className="bnav-drop-item" onClick={handleLogout}><LogOut size={18} /> {t("nav.logout")}</button>
          </div>
        </div>
      </nav>

      <footer className="app-footer">
        <a href="https://siir.xo.je" target="_blank" rel="noopener noreferrer">Solutions Informatiques Rapides</a>
        <span className="footer-sub">SIR.MR</span>
      </footer>
    </div>
  );
}

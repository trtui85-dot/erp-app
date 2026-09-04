import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./auth";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Products from "./pages/Products";
import Batches from "./pages/Batches";
import DailyPrices from "./pages/DailyPrices";
import Suppliers from "./pages/Suppliers";
import SupplyInvoices from "./pages/SupplyInvoices";
import Customers from "./pages/Customers";
import SaleInvoices from "./pages/SaleInvoices";
import Debts from "./pages/Debts";
import Distributions from "./pages/Distributions";
import Expenses from "./pages/Expenses";
import Waste from "./pages/Waste";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";
import POS from "./pages/POS";
import OtherSales from "./pages/OtherSales";
import PaymentMethods from "./pages/PaymentMethods";
import DailyJournal from "./pages/DailyJournal";
import Employees from "./pages/Employees";
import Categories from "./pages/Categories";
import Users from "./pages/Users";
import AuditLogs from "./pages/AuditLogs";
import { PageLoader } from "./components/ui";
import { Lock } from "lucide-react";
import { defaultHome, canAccess } from "./permissions";

function NoAccess() {
  return (
    <div className="empty-state" style={{ paddingTop: 48 }}>
      <Lock size={48} strokeWidth={1.2} />
      <p>لا تملك صلاحية الوصول لهذه الصفحة</p>
    </div>
  );
}

export default function App() {
  const { user, ready } = useAuth();

  if (!ready) return <PageLoader />;
  if (!user) return <Login />;

  const home = defaultHome(user);
  const Guard = ({ k, children }) => (canAccess(user, k) ? children : <NoAccess />);

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Navigate to={home} replace />} />
        <Route path="/dashboard" element={<Guard k="dashboard"><Dashboard /></Guard>} />
        <Route path="/products" element={<Guard k="products"><Products /></Guard>} />
        <Route path="/batches" element={<Guard k="batches"><Batches /></Guard>} />
        <Route path="/dailyPrices" element={<Guard k="dailyPrices"><DailyPrices /></Guard>} />
        <Route path="/suppliers" element={<Guard k="suppliers"><Suppliers /></Guard>} />
        <Route path="/supplyInvoices" element={<Guard k="supplyInvoices"><SupplyInvoices /></Guard>} />
        <Route path="/customers" element={<Guard k="customers"><Customers /></Guard>} />
        <Route path="/saleInvoices" element={<Guard k="saleInvoices"><SaleInvoices /></Guard>} />
        <Route path="/debts" element={<Guard k="debts"><Debts /></Guard>} />
        <Route path="/distributions" element={<Guard k="distributions"><Distributions /></Guard>} />
        <Route path="/expenses" element={<Guard k="expenses"><Expenses /></Guard>} />
        <Route path="/waste" element={<Guard k="waste"><Waste /></Guard>} />
        <Route path="/reports" element={<Guard k="reports"><Reports /></Guard>} />
        <Route path="/pos" element={<Guard k="pos"><POS /></Guard>} />
        <Route path="/otherSales" element={<Guard k="otherSales"><OtherSales /></Guard>} />
        <Route path="/paymentMethods" element={<Guard k="paymentMethods"><PaymentMethods /></Guard>} />
        <Route path="/dailyJournal" element={<Guard k="dailyJournal"><DailyJournal /></Guard>} />
        <Route path="/employees" element={<Guard k="employees"><Employees /></Guard>} />
        <Route path="/categories" element={<Guard k="categories"><Categories /></Guard>} />
        <Route path="/users" element={<Guard k="users"><Users /></Guard>} />
        <Route path="/audit" element={<Guard k="audit"><AuditLogs /></Guard>} />
        <Route path="/settings" element={<Guard k="settings"><Settings /></Guard>} />
        <Route path="*" element={<Navigate to={home} replace />} />
      </Routes>
    </Layout>
  );
}
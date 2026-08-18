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
import PaymentMethods from "./pages/PaymentMethods";
import DailyJournal from "./pages/DailyJournal";
import Employees from "./pages/Employees";
import Categories from "./pages/Categories";
import { PageLoader } from "./components/ui";

export default function App() {
  const { user, ready } = useAuth();

  if (!ready) return <PageLoader />;
  if (!user) return <Login />;

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/products" element={<Products />} />
        <Route path="/batches" element={<Batches />} />
        <Route path="/dailyPrices" element={<DailyPrices />} />
        <Route path="/suppliers" element={<Suppliers />} />
        <Route path="/supplyInvoices" element={<SupplyInvoices />} />
        <Route path="/customers" element={<Customers />} />
        <Route path="/saleInvoices" element={<SaleInvoices />} />
        <Route path="/debts" element={<Debts />} />
        <Route path="/distributions" element={<Distributions />} />
        <Route path="/expenses" element={<Expenses />} />
        <Route path="/waste" element={<Waste />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/pos" element={<POS />} />
        <Route path="/paymentMethods" element={<PaymentMethods />} />
        <Route path="/dailyJournal" element={<DailyJournal />} />
        <Route path="/employees" element={<Employees />} />
        <Route path="/categories" element={<Categories />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Layout>
  );
}

import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { authenticate } from './auth.js';
import { pool, migrationPromise } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

import authRoutes from './routes/auth.js';
import productRoutes from './routes/products.js';
import batchRoutes from './routes/batches.js';
import dailyPriceRoutes from './routes/dailyPrices.js';
import supplierRoutes from './routes/suppliers.js';
import supplyInvoiceRoutes from './routes/supplyInvoices.js';
import customerRoutes from './routes/customers.js';
import saleInvoiceRoutes from './routes/saleInvoices.js';
import debtRoutes from './routes/debts.js';
import distributionRoutes from './routes/distributions.js';
import settingsRoutes from './routes/settings.js';
import dashboardRoutes from './routes/dashboard.js';
import expenseRoutes from './routes/expenses.js';
import wasteRoutes from './routes/waste.js';
import reportRoutes from './routes/reports.js';
import paymentMethodRoutes from './routes/paymentMethods.js';
import dailyJournalRoutes from './routes/dailyJournal.js';
import employeeRoutes from './routes/employees.js';
import employeeAttendanceRoutes from './routes/employeeAttendance.js';
import employeePaymentRoutes from './routes/employeePayments.js';
import employeeAdvanceRoutes from './routes/employeeAdvances.js';
import employeeReportRoutes from './routes/employeeReport.js';
import categoryRoutes from './routes/categories.js';
import userRoutes from './routes/users.js';
import { activityLogger } from './logger.js';

const app = express();
const PORT = process.env.PORT || 4001;

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Wait for migration before serving any request
app.use(async (req, res, next) => {
  await migrationPromise;
  next();
});

app.use('/api/auth', authRoutes);

app.use('/api/users', authenticate, userRoutes);

app.use('/api/dashboard', authenticate, dashboardRoutes);
app.use('/api/products', authenticate, activityLogger, productRoutes);
app.use('/api/batches', authenticate, activityLogger, batchRoutes);
app.use('/api/dailyprices', authenticate, activityLogger, dailyPriceRoutes);
app.use('/api/suppliers', authenticate, activityLogger, supplierRoutes);
app.use('/api/supplyinvoices', authenticate, activityLogger, supplyInvoiceRoutes);
app.use('/api/customers', authenticate, activityLogger, customerRoutes);
app.use('/api/saleinvoices', authenticate, activityLogger, saleInvoiceRoutes);
app.use('/api/debts', authenticate, activityLogger, debtRoutes);
app.use('/api/distributions', authenticate, activityLogger, distributionRoutes);
app.use('/api/settings', authenticate, settingsRoutes);
app.use('/api/expenses', authenticate, activityLogger, expenseRoutes);
app.use('/api/waste', authenticate, activityLogger, wasteRoutes);
app.use('/api/reports', authenticate, reportRoutes);
app.use('/api/paymentmethods', authenticate, activityLogger, paymentMethodRoutes);
app.use('/api/dailyjournal', authenticate, activityLogger, dailyJournalRoutes);
app.use('/api/employees', authenticate, activityLogger, employeeRoutes);
app.use('/api/employee-attendance', authenticate, activityLogger, employeeAttendanceRoutes);
app.use('/api/employee-payments', authenticate, activityLogger, employeePaymentRoutes);
app.use('/api/employee-advances', authenticate, activityLogger, employeeAdvanceRoutes);
app.use('/api/employee-report', authenticate, activityLogger, employeeReportRoutes);
app.use('/api/categories', authenticate, activityLogger, categoryRoutes);

if (!process.env.VERCEL) {
  const clientDist = path.resolve(__dirname, '../../client/dist');
  app.use(express.static(clientDist));
  app.get('*', (req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

export default app;

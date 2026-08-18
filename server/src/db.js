import pg from 'pg';
import bcrypt from 'bcryptjs';

const { Pool } = pg;

const DB_URL = process.env.DATABASE_URL || 'postgresql://factory_manager_user:apDO6DzshNP0oLCKmACPunlg53BX0W97@dpg-da2crt15efls73a0lhn0-a/erp_app';

const pool = new Pool({
  connectionString: DB_URL,
  ssl: { rejectUnauthorized: false },
  max: 10,
});

function convertPlaceholders(sql) {
  let idx = 0;
  return sql.replace(/\?/g, () => `$${++idx}`);
}

function convertMySQLtoPG(sql) {
  let s = sql;
  s = s.replace(/CURDATE\(\)/g, 'CURRENT_DATE');
  s = s.replace(/NOW\(\)/g, 'NOW()');
  s = s.replace(/DATE_SUB\(CURDATE\(\),\s*INTERVAL\s+(\d+)\s+DAY\)/gi, "(CURRENT_DATE - INTERVAL '$1 days')");
  s = s.replace(/DATE_ADD\(CURDATE\(\),\s*INTERVAL\s+(\d+)\s+DAY\)/gi, "(CURRENT_DATE + INTERVAL '$1 days')");
  s = s.replace(/DATEDIFF\(CURDATE\(\),\s*([^)]+)\)/gi, "(CURRENT_DATE - ($1::date))::int");
  s = s.replace(/DATEDIFF\(([^,]+),\s*([^)]+)\)/gi, "($2::date - $1::date)::int");
  s = s.replace(/YEAR\(CURDATE\(\)\)/gi, "EXTRACT(YEAR FROM CURRENT_DATE)::int");
  s = s.replace(/YEAR\(([^)]+)\)/gi, "EXTRACT(YEAR FROM ($1::date))::int");
  s = s.replace(/MONTH\(CURDATE\(\)\)/gi, "EXTRACT(MONTH FROM CURRENT_DATE)::int");
  s = s.replace(/MONTH\(([^)]+)\)/gi, "EXTRACT(MONTH FROM ($1::date))::int");
  s = s.replace(/DAY\(([^)]+)\)/gi, "EXTRACT(DAY FROM ($1::date))::int");
  s = s.replace(/DATE_FORMAT\(([^,]+),\s*'([^']+)'\)/gi, (_, expr, fmt) => {
    const pgFmt = fmt.replace(/%Y/g, 'YYYY').replace(/%m/g, 'MM').replace(/%d/g, 'DD').replace(/%H/g, 'HH24').replace(/%i/g, 'MI').replace(/%s/g, 'SS');
    return `TO_CHAR(${expr}, '${pgFmt}')`;
  });
  s = s.replace(/CONCAT\(([^)]+)\)/gi, (_, inner) => {
    const parts = inner.split(',').map(p => p.trim());
    return parts.join(' || ');
  });
  s = s.replace(/LPAD\(([^,]+),\s*([^,]+),\s*([^)]+)\)/gi, "LPAD($1::text, $2::int, $3)");
  s = s.replace(/\bDATE\(([^)]+)\)/gi, "$1::date");
  return s;
}

function isInsert(sql) {
  return /^\s*INSERT\s+INTO/i.test(sql);
}

function toPgDate(v) {
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(v)) {
    const d = new Date(v);
    if (!Number.isNaN(d.getTime())) {
      return d.toISOString().replace('T', ' ').replace('Z', '');
    }
  }
  return v;
}

function expandArrayParams(sql, params) {
  let idx = 0;
  const newParams = [];
  const newSql = sql.replace(/\?/g, () => {
    const p = params[idx++];
    if (Array.isArray(p)) {
      if (p.length === 0) return '(SELECT NULL WHERE false)';
      const placeholders = p.map(() => `$${newParams.length + 1}`).join(',');
      newParams.push(...p);
      return `(${placeholders})`;
    }
    newParams.push(toPgDate(p));
    return `$${newParams.length}`;
  });
  return { sql: newSql, params: newParams };
}

async function execQuery(sql, params = []) {
  const converted = convertMySQLtoPG(sql);
  const { sql: pgSql, params: pgParams } = expandArrayParams(converted, params);

  if (isInsert(converted) && !converted.toLowerCase().includes('returning')) {
    const withReturning = pgSql.replace(/;?\s*$/, '') + ' RETURNING id';
    const result = await pool.query(withReturning, pgParams);
    return [result.rows, [{ insertId: result.rows[0]?.id, affectedRows: result.rowCount }]];
  }

  const result = await pool.query(pgSql, pgParams);
  return [result.rows, [{ affectedRows: result.rowCount }]];
}

function makeConn(conn) {
  return {
    beginTransaction: async () => {
      await conn.query('BEGIN');
    },
    execute: async (sql, params = []) => {
      const converted = convertMySQLtoPG(sql);
      const { sql: pgSql, params: pgParams } = expandArrayParams(converted, params);

      if (isInsert(converted) && !converted.toLowerCase().includes('returning')) {
        const withReturning = pgSql.replace(/;?\s*$/, '') + ' RETURNING id';
        const result = await conn.query(withReturning, pgParams);
        return [result.rows, [{ insertId: result.rows[0]?.id, affectedRows: result.rowCount }]];
      }

      const result = await conn.query(pgSql, pgParams);
      return [result.rows, [{ affectedRows: result.rowCount }]];
    },
    commit: async () => {
      await conn.query('COMMIT');
    },
    rollback: async () => {
      await conn.query('ROLLBACK');
    },
    release: () => {
      conn.release();
    },
  };
}

pool.getConnection = async () => {
  const conn = await pool.connect();
  return makeConn(conn);
};

export { pool };
export const query = execQuery;

async function migrate() {
  const conn = await pool.connect();
  try {
    await conn.query(`CREATE TABLE IF NOT EXISTS suppliers (
      id SERIAL PRIMARY KEY,
      name VARCHAR(150) NOT NULL,
      phone VARCHAR(20) NOT NULL,
      specialty VARCHAR(100) NULL,
      last_supply_date DATE NULL,
      notes TEXT NULL
    )`);

    await conn.query(`CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      phone VARCHAR(20) UNIQUE NOT NULL,
      pin_hash VARCHAR(255) NOT NULL,
      role VARCHAR(20) DEFAULT 'WORKER',
      worker_id INT NULL,
      permissions JSONB NULL,
      active SMALLINT DEFAULT 1
    )`);

    await conn.query(`CREATE TABLE IF NOT EXISTS products (
      id SERIAL PRIMARY KEY,
      name VARCHAR(150) NOT NULL,
      unit VARCHAR(20) DEFAULT 'kg',
      price_type VARCHAR(20) DEFAULT 'fixed',
      current_sale_price DECIMAL(12,2) DEFAULT 0,
      min_stock DECIMAL(12,2) DEFAULT 20,
      shelf_life_days INT DEFAULT 5,
      active SMALLINT DEFAULT 1,
      category_id INT NULL
    )`);

    await conn.query(`CREATE TABLE IF NOT EXISTS batches (
      id SERIAL PRIMARY KEY,
      batch_code VARCHAR(30) NULL,
      product_id INT NOT NULL,
      supplier_id INT NULL,
      arrival_date DATE,
      initial_qty DECIMAL(12,2),
      remaining_qty DECIMAL(12,2),
      sold_qty DECIMAL(12,2) DEFAULT 0,
      wasted_qty DECIMAL(12,2) DEFAULT 0,
      unit VARCHAR(20) DEFAULT 'kg',
      purchase_price DECIMAL(12,2),
      sale_price DECIMAL(12,2),
      expiry_date DATE NULL,
      status VARCHAR(20) DEFAULT 'active',
      notes TEXT NULL,
      FOREIGN KEY (product_id) REFERENCES products(id),
      FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
    )`);

    await conn.query(`CREATE TABLE IF NOT EXISTS daily_prices (
      id SERIAL PRIMARY KEY,
      product_id INT NOT NULL,
      price DECIMAL(12,2),
      date DATE,
      updated_by INT NULL,
      FOREIGN KEY (product_id) REFERENCES products(id)
    )`);

    await conn.query(`CREATE TABLE IF NOT EXISTS price_history (
      id SERIAL PRIMARY KEY,
      product_id INT NOT NULL,
      price DECIMAL(12,2),
      change_date DATE,
      note TEXT NULL
    )`);

    await conn.query(`CREATE TABLE IF NOT EXISTS supply_invoices (
      id SERIAL PRIMARY KEY,
      supplier_id INT NOT NULL,
      date DATE,
      total DECIMAL(12,2) DEFAULT 0,
      notes TEXT NULL,
      created_by INT NULL,
      FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
    )`);

    await conn.query(`CREATE TABLE IF NOT EXISTS supply_invoice_items (
      id SERIAL PRIMARY KEY,
      invoice_id INT NOT NULL,
      product_id INT NOT NULL,
      qty DECIMAL(12,2),
      unit VARCHAR(20) DEFAULT 'kg',
      purchase_price DECIMAL(12,2),
      sale_price DECIMAL(12,2),
      expiry_date DATE NULL,
      batch_id INT NULL,
      FOREIGN KEY (invoice_id) REFERENCES supply_invoices(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id)
    )`);

    await conn.query(`CREATE TABLE IF NOT EXISTS customers (
      id SERIAL PRIMARY KEY,
      name VARCHAR(150) NOT NULL,
      phone VARCHAR(20) NULL,
      address TEXT NULL
    )`);

    await conn.query(`CREATE TABLE IF NOT EXISTS sale_invoices (
      id SERIAL PRIMARY KEY,
      customer_id INT NOT NULL,
      date DATE,
      type VARCHAR(20) DEFAULT 'retail',
      total DECIMAL(12,2) DEFAULT 0,
      paid DECIMAL(12,2) DEFAULT 0,
      notes TEXT NULL,
      created_by INT NULL,
      payment_method_id INT NULL,
      invoice_code VARCHAR(20) NULL,
      FOREIGN KEY (customer_id) REFERENCES customers(id)
    )`);

    await conn.query(`CREATE TABLE IF NOT EXISTS sale_invoice_items (
      id SERIAL PRIMARY KEY,
      invoice_id INT NOT NULL,
      batch_id INT NOT NULL,
      qty DECIMAL(12,2),
      price DECIMAL(12,2),
      total DECIMAL(12,2),
      FOREIGN KEY (invoice_id) REFERENCES sale_invoices(id) ON DELETE CASCADE,
      FOREIGN KEY (batch_id) REFERENCES batches(id)
    )`);

    await conn.query(`CREATE TABLE IF NOT EXISTS debts (
      id SERIAL PRIMARY KEY,
      customer_id INT NOT NULL,
      sale_invoice_id INT NULL,
      amount DECIMAL(12,2),
      paid DECIMAL(12,2) DEFAULT 0,
      status VARCHAR(20) DEFAULT 'pending',
      created_date DATE,
      notes TEXT NULL,
      FOREIGN KEY (customer_id) REFERENCES customers(id)
    )`);

    await conn.query(`CREATE TABLE IF NOT EXISTS debt_payments (
      id SERIAL PRIMARY KEY,
      debt_id INT NOT NULL,
      amount DECIMAL(12,2),
      date DATE,
      notes TEXT NULL,
      FOREIGN KEY (debt_id) REFERENCES debts(id) ON DELETE CASCADE
    )`);

    await conn.query(`CREATE TABLE IF NOT EXISTS distributions (
      id SERIAL PRIMARY KEY,
      vendor_name VARCHAR(150) NOT NULL,
      vendor_phone VARCHAR(20) NULL,
      date DATE,
      total_value DECIMAL(12,2) DEFAULT 0,
      commission_rate DECIMAL(5,2) DEFAULT 0,
      status VARCHAR(20) DEFAULT 'active',
      notes TEXT NULL
    )`);

    await conn.query(`CREATE TABLE IF NOT EXISTS distribution_items (
      id SERIAL PRIMARY KEY,
      distribution_id INT NOT NULL,
      batch_id INT NOT NULL,
      qty_given DECIMAL(12,2),
      qty_sold DECIMAL(12,2) DEFAULT 0,
      qty_returned DECIMAL(12,2) DEFAULT 0,
      price DECIMAL(12,2),
      FOREIGN KEY (distribution_id) REFERENCES distributions(id) ON DELETE CASCADE,
      FOREIGN KEY (batch_id) REFERENCES batches(id)
    )`);

    await conn.query(`CREATE TABLE IF NOT EXISTS waste_records (
      id SERIAL PRIMARY KEY,
      batch_id INT NOT NULL,
      product_id INT NOT NULL,
      qty DECIMAL(12,2) NOT NULL,
      reason VARCHAR(30) DEFAULT 'rotten',
      loss_value DECIMAL(12,2) DEFAULT 0,
      date DATE,
      notes TEXT NULL,
      created_by INT NULL,
      FOREIGN KEY (batch_id) REFERENCES batches(id),
      FOREIGN KEY (product_id) REFERENCES products(id)
    )`);

    await conn.query(`CREATE TABLE IF NOT EXISTS settings (
      id SERIAL PRIMARY KEY,
      setting_key VARCHAR(100) UNIQUE NOT NULL,
      setting_value TEXT
    )`);

    await conn.query(`CREATE TABLE IF NOT EXISTS alerts (
      id SERIAL PRIMARY KEY,
      type VARCHAR(30),
      title VARCHAR(200),
      message TEXT,
      related_id INT NULL,
      is_read SMALLINT DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW()
    )`);

    await conn.query(`CREATE TABLE IF NOT EXISTS expenses (
      id SERIAL PRIMARY KEY,
      category VARCHAR(100),
      amount DECIMAL(12,2),
      date DATE,
      notes TEXT NULL,
      created_by INT NULL
    )`);

    await conn.query(`CREATE TABLE IF NOT EXISTS payment_methods (
      id SERIAL PRIMARY KEY,
      code VARCHAR(20) UNIQUE NOT NULL,
      name VARCHAR(100) NOT NULL,
      type VARCHAR(20) DEFAULT 'cash',
      account_number VARCHAR(50) NULL,
      icon VARCHAR(50) NULL,
      color VARCHAR(20) NULL,
      active SMALLINT DEFAULT 1,
      logo_url VARCHAR(500) NULL,
      created_at DATE DEFAULT CURRENT_DATE
    )`);

    await conn.query(`CREATE TABLE IF NOT EXISTS transactions (
      id SERIAL PRIMARY KEY,
      ref_type VARCHAR(20) NOT NULL,
      ref_id INT NULL,
      from_payment_method_id INT NULL,
      to_payment_method_id INT NULL,
      amount DECIMAL(12,2) NOT NULL,
      balance_after DECIMAL(12,2) DEFAULT 0,
      note TEXT NULL,
      created_by INT NULL,
      created_at TIMESTAMP DEFAULT NOW(),
      FOREIGN KEY (from_payment_method_id) REFERENCES payment_methods(id),
      FOREIGN KEY (to_payment_method_id) REFERENCES payment_methods(id)
    )`);

    await conn.query(`CREATE TABLE IF NOT EXISTS employees (
      id SERIAL PRIMARY KEY,
      name VARCHAR(150) NOT NULL,
      phone VARCHAR(20) NULL,
      role VARCHAR(100) DEFAULT 'worker',
      salary_type VARCHAR(20) DEFAULT 'daily',
      salary_amount DECIMAL(12,2) DEFAULT 0,
      hire_date DATE NULL,
      active SMALLINT DEFAULT 1,
      notes TEXT NULL
    )`);

    await conn.query(`CREATE TABLE IF NOT EXISTS employee_attendance (
      id SERIAL PRIMARY KEY,
      employee_id INT NOT NULL,
      date DATE NOT NULL,
      work_type VARCHAR(100) DEFAULT 'daily',
      supply_invoice_id INT NULL,
      amount DECIMAL(12,2) DEFAULT 0,
      status VARCHAR(20) DEFAULT 'pending',
      notes TEXT NULL,
      created_at TIMESTAMP DEFAULT NOW(),
      FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
    )`);

    await conn.query(`CREATE TABLE IF NOT EXISTS employee_payments (
      id SERIAL PRIMARY KEY,
      employee_id INT NOT NULL,
      amount DECIMAL(12,2) NOT NULL,
      payment_method_id INT NULL,
      period_from DATE NULL,
      period_to DATE NULL,
      notes TEXT NULL,
      created_at TIMESTAMP DEFAULT NOW(),
      FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
    )`);

    await conn.query(`CREATE TABLE IF NOT EXISTS employee_advances (
      id SERIAL PRIMARY KEY,
      employee_id INT NOT NULL,
      amount DECIMAL(12,2) NOT NULL,
      date DATE NOT NULL,
      status VARCHAR(20) DEFAULT 'active',
      deducted_in_payment_id INT NULL,
      notes TEXT NULL,
      created_at TIMESTAMP DEFAULT NOW(),
      FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
    )`);

    await conn.query(`CREATE TABLE IF NOT EXISTS categories (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      name_ar VARCHAR(100) NULL,
      icon VARCHAR(50) DEFAULT '📦',
      color VARCHAR(20) DEFAULT '#6b7280',
      sort_order INT DEFAULT 0,
      active SMALLINT DEFAULT 1,
      created_at TIMESTAMP DEFAULT NOW()
    )`);

    const adminCheck = await conn.query('SELECT id FROM users WHERE phone = $1', ['22222222']);
    if (adminCheck.rows.length === 0) {
      const hash = await bcrypt.hash('2222', 10);
      await conn.query(
        'INSERT INTO users (name, phone, pin_hash, role) VALUES ($1, $2, $3, $4)',
        ['Admin', '22222222', hash, 'ADMIN']
      );
    }

    const settingsCheck = await conn.query('SELECT id FROM settings WHERE setting_key = $1', ['distribution_mode']);
    if (settingsCheck.rows.length === 0) {
      await conn.query(
        'INSERT INTO settings (setting_key, setting_value) VALUES ($1, $2)',
        ['distribution_mode', 'wholesale']
      );
    }

    const pmCheck = await conn.query('SELECT id FROM payment_methods LIMIT 1');
    if (pmCheck.rows.length === 0) {
      await conn.query(`INSERT INTO payment_methods (code, name, type, icon, color) VALUES
        ('CASH', 'الصندوق / Caisse', 'cash', 'Wallet', '#34a853'),
        ('BANKILY', 'بنكيلي', 'wallet', 'Smartphone', '#1a73e8'),
        ('MASRVI', 'مصرفي', 'wallet', 'CreditCard', '#8b5cf6'),
        ('SADAD', 'سداد', 'wallet', 'Send', '#f59e0b'),
        ('BANK', 'حساب بنكي', 'bank', 'Building2', '#0d9488')
      `);
    }

    const catCheck = await conn.query('SELECT COUNT(*) AS c FROM categories');
    if (Number(catCheck.rows[0].c) === 0) {
      await conn.query(`INSERT INTO categories (name, name_ar, icon, color, sort_order) VALUES
        ('Légumes', 'الخضروات', '🥬', '#22c55e', 1),
        ('Denrées alimentaires', 'المواد الغذائية', '🌾', '#f59e0b', 2),
        ('Viandes', 'اللحوم', '🥩', '#ef4444', 3),
        ('Autres', 'أخرى', '📦', '#6b7280', 99)
      `);
    }

    console.log('Migration completed successfully');
  } catch (err) {
    console.error('Migration error:', err);
  } finally {
    conn.release();
  }
}

migrate();

export default pool;

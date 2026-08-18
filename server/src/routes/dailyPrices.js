import { Router } from 'express';
import { query } from '../db.js';
import { requireModule } from '../auth.js';

const router = Router();

router.get('/history', requireModule('dailyPrices'), async (req, res) => {
  try {
    const { product_id } = req.query;
    if (!product_id) {
      return res.status(400).json({ error: 'product_id is required' });
    }
    const [history] = await query(
      'SELECT ph.*, p.name as product_name FROM price_history ph JOIN products p ON ph.product_id = p.id WHERE ph.product_id = ? ORDER BY ph.change_date DESC LIMIT 100',
      [product_id]
    );
    return res.json(history);
  } catch (err) {
    console.error('Price history error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

router.get('/', requireModule('dailyPrices'), async (req, res) => {
  try {
    const date = req.query.date || new Date().toISOString().split('T')[0];
    const [prices] = await query(
      'SELECT dp.*, p.name as product_name, p.unit FROM daily_prices dp JOIN products p ON dp.product_id = p.id WHERE dp.date = ? ORDER BY p.name',
      [date]
    );
    const [allProducts] = await query(
      'SELECT id, name, unit, current_sale_price, price_type FROM products WHERE active = 1 ORDER BY name'
    );
    const priceMap = {};
    prices.forEach((p) => { priceMap[p.product_id] = p; });
    const result = allProducts.map((p) => {
      if (priceMap[p.id]) return { ...priceMap[p.id], product_name: p.name, unit: p.unit };
      return { product_id: p.id, product_name: p.name, unit: p.unit, price: p.current_sale_price || 0, date, _new: true };
    });
    return res.json(result);
  } catch (err) {
    console.error('List daily prices error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

router.post('/', requireModule('dailyPrices'), async (req, res) => {
  try {
    const { product_id, price, date } = req.body;
    if (!product_id || price === undefined) {
      return res.status(400).json({ error: 'product_id and price are required' });
    }
    const priceDate = date || new Date().toISOString().split('T')[0];

    const [existing] = await query(
      'SELECT * FROM daily_prices WHERE product_id = ? AND date = ?',
      [product_id, priceDate]
    );

    if (existing.length > 0) {
      await query('UPDATE daily_prices SET price = ?, updated_by = ? WHERE id = ?', [price, req.user.id, existing[0].id]);
    } else {
      await query(
        'INSERT INTO daily_prices (product_id, price, date, updated_by) VALUES (?, ?, ?, ?)',
        [product_id, price, priceDate, req.user.id]
      );
    }

    await query(
      'INSERT INTO price_history (product_id, price, change_date, note) VALUES (?, ?, ?, ?)',
      [product_id, price, priceDate, 'Daily price update']
    );

    await query('UPDATE products SET current_sale_price = ? WHERE id = ?', [price, product_id]);

    const [result] = await query(
      'SELECT dp.*, p.name as product_name FROM daily_prices dp JOIN products p ON dp.product_id = p.id WHERE dp.product_id = ? AND dp.date = ?',
      [product_id, priceDate]
    );
    return res.status(201).json(result[0]);
  } catch (err) {
    console.error('Set daily price error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

router.post('/bulk', requireModule('dailyPrices'), async (req, res) => {
  try {
    const { items, prices, date } = req.body;
    const priceList = items || prices;
    if (!priceList || !Array.isArray(priceList) || priceList.length === 0) {
      return res.status(400).json({ error: 'items array is required' });
    }
    const priceDate = date || new Date().toISOString().split('T')[0];
    const results = [];

    for (const item of priceList) {
      const { product_id, price } = item;
      if (!product_id || price === undefined) continue;

      const [existing] = await query(
        'SELECT * FROM daily_prices WHERE product_id = ? AND date = ?',
        [product_id, priceDate]
      );

      if (existing.length > 0) {
        await query('UPDATE daily_prices SET price = ?, updated_by = ? WHERE id = ?', [price, req.user.id, existing[0].id]);
      } else {
        await query(
          'INSERT INTO daily_prices (product_id, price, date, updated_by) VALUES (?, ?, ?, ?)',
          [product_id, price, priceDate, req.user.id]
        );
      }

      await query(
        'INSERT INTO price_history (product_id, price, change_date, note) VALUES (?, ?, ?, ?)',
        [product_id, price, priceDate, 'Bulk daily price update']
      );

      await query('UPDATE products SET current_sale_price = ? WHERE id = ?', [price, product_id]);
      results.push({ product_id, price });
    }

    return res.status(201).json({ updated: results.length, prices: results });
  } catch (err) {
    console.error('Bulk daily prices error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

export default router;

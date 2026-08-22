import { Router } from 'express';
import pool, { query } from '../db.js';
import { requireModule } from '../auth.js';

const router = Router();

router.get('/', requireModule('distributions'), async (req, res) => {
  try {
    const [distributions] = await query('SELECT * FROM distributions ORDER BY date DESC');
    return res.json(distributions);
  } catch (err) {
    console.error('List distributions error:', err);
    return res.status(500).json({ error: err.message || 'Server error' });
  }
});

router.get('/:id', requireModule('distributions'), async (req, res) => {
  try {
    const [distributions] = await query('SELECT * FROM distributions WHERE id = ?', [req.params.id]);
    if (distributions.length === 0) {
      return res.status(404).json({ error: 'Distribution not found' });
    }
    const [items] = await query(`
      SELECT di.*, p.name as product_name, b.remaining_qty as batch_remaining_qty
      FROM distribution_items di
      JOIN batches b ON di.batch_id = b.id
      JOIN products p ON b.product_id = p.id
      WHERE di.distribution_id = ?
    `, [req.params.id]);
    return res.json({ ...distributions[0], items });
  } catch (err) {
    console.error('Get distribution error:', err);
    return res.status(500).json({ error: err.message || 'Server error' });
  }
});

router.post('/', requireModule('distributions'), async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const { vendor_name, vendor_phone, date, commission_rate, notes, items } = req.body;
    if (!vendor_name || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'vendor_name and items are required' });
    }

    let totalValue = 0;
    for (const item of items) {
      totalValue += (item.qty_given || 0) * (item.price || 0);
    }

    const distDate = date || new Date().toISOString().split('T')[0];

    const [distResult] = await conn.execute(
      'INSERT INTO distributions (vendor_name, vendor_phone, date, total_value, commission_rate, notes) VALUES (?, ?, ?, ?, ?, ?)',
      [vendor_name, vendor_phone || null, distDate, totalValue, commission_rate || 0, notes || null]
    );
    const distId = distResult.insertId;

    for (const item of items) {
      await conn.execute(
        'INSERT INTO distribution_items (distribution_id, batch_id, qty_given, price) VALUES (?, ?, ?, ?)',
        [distId, item.batch_id, item.qty_given, item.price]
      );

      await conn.execute(
        'UPDATE batches SET remaining_qty = remaining_qty - ? WHERE id = ?',
        [item.qty_given, item.batch_id]
      );
    }

    await conn.commit();

    const [distribution] = await query('SELECT * FROM distributions WHERE id = ?', [distId]);
    const [distItems] = await query('SELECT * FROM distribution_items WHERE distribution_id = ?', [distId]);
    return res.status(201).json({ ...distribution[0], items: distItems });
  } catch (err) {
    await conn.rollback();
    console.error('Create distribution error:', err);
    return res.status(500).json({ error: err.message || 'Server error' });
  } finally {
    conn.release();
  }
});

router.post('/:id/settle', requireModule('distributions'), async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const { items } = req.body;
    const [existing] = await conn.execute('SELECT * FROM distributions WHERE id = ?', [req.params.id]);
    if (existing.length === 0) {
      await conn.rollback();
      return res.status(404).json({ error: 'Distribution not found' });
    }

    const distribution = existing[0];

    if (items && Array.isArray(items)) {
      for (const item of items) {
        await conn.execute(
          'UPDATE distribution_items SET qty_sold = ?, qty_returned = ? WHERE id = ?',
          [item.qty_sold || 0, item.qty_returned || 0, item.id]
        );

        if (item.qty_returned && parseFloat(item.qty_returned) > 0) {
          await conn.execute(
            'UPDATE batches SET remaining_qty = remaining_qty + ? WHERE id = ?',
            [item.qty_returned, item.batch_id]
          );
        }
      }
    }

    const [allItems] = await conn.execute(
      'SELECT * FROM distribution_items WHERE distribution_id = ?',
      [req.params.id]
    );

    let totalSold = 0;
    let totalReturned = 0;
    let totalRevenue = 0;
    for (const item of allItems) {
      totalSold += parseFloat(item.qty_sold) || 0;
      totalReturned += parseFloat(item.qty_returned) || 0;
      totalRevenue += (parseFloat(item.qty_sold) || 0) * (parseFloat(item.price) || 0);
    }

    const commission = totalRevenue * (parseFloat(distribution.commission_rate) / 100);

    await conn.execute(
      'UPDATE distributions SET status = ?, total_value = ? WHERE id = ?',
      ['settled', totalRevenue, req.params.id]
    );

    await conn.commit();

    const [updatedDist] = await query('SELECT * FROM distributions WHERE id = ?', [req.params.id]);
    const [updatedItems] = await query('SELECT * FROM distribution_items WHERE distribution_id = ?', [req.params.id]);
    return res.json({
      ...updatedDist[0],
      items: updatedItems,
      settlement: { total_sold: totalSold, total_returned: totalReturned, total_revenue: totalRevenue, commission }
    });
  } catch (err) {
    await conn.rollback();
    console.error('Settle distribution error:', err);
    return res.status(500).json({ error: err.message || 'Server error' });
  } finally {
    conn.release();
  }
});

router.patch('/:id', requireModule('distributions'), async (req, res) => {
  try {
    const { vendor_name, vendor_phone, commission_rate, status, notes } = req.body;
    const [existing] = await query('SELECT * FROM distributions WHERE id = ?', [req.params.id]);
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Distribution not found' });
    }
    await query(
      'UPDATE distributions SET vendor_name = ?, vendor_phone = ?, commission_rate = ?, status = ?, notes = ? WHERE id = ?',
      [
        vendor_name || existing[0].vendor_name,
        vendor_phone !== undefined ? vendor_phone : existing[0].vendor_phone,
        commission_rate !== undefined ? commission_rate : existing[0].commission_rate,
        status || existing[0].status,
        notes !== undefined ? notes : existing[0].notes,
        req.params.id
      ]
    );
    const [distribution] = await query('SELECT * FROM distributions WHERE id = ?', [req.params.id]);
    return res.json(distribution[0]);
  } catch (err) {
    console.error('Update distribution error:', err);
    return res.status(500).json({ error: err.message || 'Server error' });
  }
});

export default router;

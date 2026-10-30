const express = require('express');
const { body, validationResult } = require('express-validator');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();
router.use(authenticateToken);

/**
 * POST /api/operators/register-device
 * Register or rotate a device public key for the authenticated operator.
 * Body: { deviceId, publicKey, deviceName? }
 */
router.post(
  '/register-device',
  [
    body('deviceId').isString().trim().notEmpty().withMessage('Device ID is required'),
    body('publicKey').isString().trim().notEmpty().withMessage('Public key is required'),
    body('deviceName').optional().isString().trim(),
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed', details: errors.array() });
    }

    const { deviceId, publicKey, deviceName } = req.body;
    const db = req.app.locals.db;
    const operatorId = req.operator.operatorId;

    // A device ID is globally unique. It may only be updated by its owner.
    const existing = db.prepare('SELECT operator_id FROM devices WHERE id = ?').get(deviceId);
    if (existing && existing.operator_id !== operatorId) {
      return res.status(409).json({ error: 'Device ID is already registered to another operator' });
    }

    if (existing) {
      db.prepare(
        `UPDATE devices SET public_key = ?, device_name = ?, registered_at = datetime('now'), active = 1
         WHERE id = ? AND operator_id = ?`
      ).run(publicKey, deviceName || null, deviceId, operatorId);
    } else {
      db.prepare(
        `INSERT INTO devices (id, operator_id, public_key, device_name)
         VALUES (?, ?, ?, ?)`
      ).run(deviceId, operatorId, publicKey, deviceName || null);
    }

    db.prepare(
      'INSERT INTO audit_log (action, operator_id, details, ip_address) VALUES (?, ?, ?, ?)'
    ).run('device_registered', operatorId, `Device: ${deviceId}`, req.ip);

    res.status(201).json({
      message: existing ? 'Device key updated successfully' : 'Device registered successfully',
      deviceId,
    });
  }
);

/** List the authenticated operator's registered devices. */
router.get('/', (req, res) => {
  const devices = req.app.locals.db.prepare(
    `SELECT id, device_name, registered_at, active
     FROM devices WHERE operator_id = ? ORDER BY registered_at DESC`
  ).all(req.operator.operatorId);
  res.json({ devices });
});

module.exports = router;

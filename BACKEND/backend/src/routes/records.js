const express = require('express');
const { body, query, validationResult } = require('express-validator');
const { authenticateToken } = require('../middleware/auth');
const { verifySignature } = require('../utils/crypto');

const router = express.Router();

// All record routes require authentication
router.use(authenticateToken);

/**
 * POST /api/records
 * Submit a test record from the field app.
 *
 * Body: {
 *   id, timestamp, latitude, longitude, operatorId, deviceId,
 *   imageHash, classification, deltaE, correctedRgb, signature
 * }
 */
router.post(
  '/',
  [
    body('id').isString().trim().notEmpty(),
    body('timestamp').isString().notEmpty(),
    body('latitude').isFloat({ min: -90, max: 90 }),
    body('longitude').isFloat({ min: -180, max: 180 }),
    body('operatorId').isString().trim().notEmpty(),
    body('deviceId').isString().trim().notEmpty(),
    body('imageHash').isString().trim().notEmpty(),
    body('classification').isIn(['positive', 'negative', 'inconclusive']),
    body('deltaE').isFloat({ min: 0 }),
    body('correctedRgb').isString().notEmpty(),
    body('signature').isString().notEmpty(),
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed', details: errors.array() });
    }

    const db = req.app.locals.db;
    const record = req.body;

    // Verify the submitting operator matches the token
    if (record.operatorId !== req.operator.operatorId) {
      return res.status(403).json({
        error: 'Operator ID in record does not match authenticated operator',
      });
    }

    // Check for duplicate record
    const existing = db.prepare('SELECT id FROM test_records WHERE id = ?').get(record.id);
    if (existing) {
      // Idempotent: return success for duplicate submissions
      return res.json({ message: 'Record already exists', id: record.id });
    }

    // Look up the device's public key to verify signature
    const device = db.prepare(
      'SELECT public_key FROM devices WHERE id = ? AND operator_id = ? AND active = 1'
    ).get(record.deviceId, record.operatorId);

    let signatureValid = null;
    if (device) {
      // Build the record data that was signed (exclude the signature itself)
      const recordData = {
        timestamp: record.timestamp,
        latitude: record.latitude,
        longitude: record.longitude,
        operatorId: record.operatorId,
        deviceId: record.deviceId,
        imageHash: record.imageHash,
        classification: record.classification,
        deltaE: record.deltaE,
        correctedRgb: record.correctedRgb,
      };
      signatureValid = verifySignature(recordData, record.signature, device.public_key)
        ? 1
        : 0;
    }

    // Insert record
    db.prepare(
      `INSERT INTO test_records
         (id, timestamp, latitude, longitude, operator_id, device_id,
          image_hash, classification, delta_e, corrected_rgb, signature, signature_valid)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      record.id,
      record.timestamp,
      record.latitude,
      record.longitude,
      record.operatorId,
      record.deviceId,
      record.imageHash,
      record.classification,
      record.deltaE,
      record.correctedRgb,
      record.signature,
      signatureValid
    );

    // Audit log
    db.prepare(
      'INSERT INTO audit_log (action, operator_id, record_id, details, ip_address) VALUES (?, ?, ?, ?, ?)'
    ).run(
      'record_submitted',
      record.operatorId,
      record.id,
      `Classification: ${record.classification}, Sig valid: ${signatureValid}`,
      req.ip
    );

    res.status(201).json({
      message: 'Record submitted successfully',
      id: record.id,
      signatureValid: signatureValid === 1,
    });
  }
);

/**
 * GET /api/records
 * List records (paginated, filterable).
 *
 * Query: page, limit, classification, startDate, endDate, operatorId
 */
router.get(
  '/',
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('classification').optional().isIn(['positive', 'negative', 'inconclusive']),
  ],
  (req, res) => {
    const db = req.app.locals.db;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE 1=1';
    const params = [];

    // Filter by operator (non-admin users see only their own records)
    whereClause += ' AND operator_id = ?';
    params.push(req.operator.operatorId);

    if (req.query.classification) {
      whereClause += ' AND classification = ?';
      params.push(req.query.classification);
    }

    if (req.query.startDate) {
      whereClause += ' AND timestamp >= ?';
      params.push(req.query.startDate);
    }

    if (req.query.endDate) {
      whereClause += ' AND timestamp <= ?';
      params.push(req.query.endDate);
    }

    // Count total
    const countRow = db.prepare(
      `SELECT COUNT(*) as total FROM test_records ${whereClause}`
    ).get(...params);

    // Fetch page
    const records = db.prepare(
      `SELECT * FROM test_records ${whereClause}
       ORDER BY timestamp DESC LIMIT ? OFFSET ?`
    ).all(...params, limit, offset);

    res.json({
      records: records.map(formatRecord),
      pagination: {
        page,
        limit,
        total: countRow.total,
        totalPages: Math.ceil(countRow.total / limit),
      },
    });
  }
);

/**
 * GET /api/records/:id
 * Get a single record by ID.
 */
router.get('/:id', (req, res) => {
  const db = req.app.locals.db;
  const record = db.prepare(
    'SELECT * FROM test_records WHERE id = ? AND operator_id = ?'
  ).get(req.params.id, req.operator.operatorId);

  if (!record) {
    return res.status(404).json({ error: 'Record not found' });
  }

  res.json(formatRecord(record));
});

/**
 * POST /api/records/verify
 * Verify a record's signature and integrity.
 *
 * Body: { recordId: string }
 * Returns: { verified: boolean, details: {...} }
 */
router.post(
  '/verify',
  [body('recordId').isString().trim().notEmpty()],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed', details: errors.array() });
    }

    const db = req.app.locals.db;
    const { recordId } = req.body;

    // Find the record
    const record = db.prepare('SELECT * FROM test_records WHERE id = ?').get(recordId);
    if (!record) {
      return res.json({
        verified: false,
        status: 'not_found',
        message: 'Record not found on server',
      });
    }

    // Find the device's public key
    const device = db.prepare(
      'SELECT public_key FROM devices WHERE id = ? AND active = 1'
    ).get(record.device_id);

    if (!device) {
      return res.json({
        verified: false,
        status: 'no_device_key',
        message: 'Device public key not registered',
        record: formatRecord(record),
      });
    }

    // Re-verify the signature
    const recordData = {
      timestamp: record.timestamp,
      latitude: record.latitude,
      longitude: record.longitude,
      operatorId: record.operator_id,
      deviceId: record.device_id,
      imageHash: record.image_hash,
      classification: record.classification,
      deltaE: record.delta_e,
      correctedRgb: record.corrected_rgb,
    };

    const isValid = verifySignature(recordData, record.signature, device.public_key);

    // Update stored validity
    db.prepare(
      'UPDATE test_records SET signature_valid = ? WHERE id = ?'
    ).run(isValid ? 1 : 0, recordId);

    // Audit log
    db.prepare(
      'INSERT INTO audit_log (action, operator_id, record_id, details, ip_address) VALUES (?, ?, ?, ?, ?)'
    ).run(
      'record_verified',
      req.operator.operatorId,
      recordId,
      `Signature valid: ${isValid}`,
      req.ip
    );

    res.json({
      verified: isValid,
      status: isValid ? 'valid' : 'signature_mismatch',
      message: isValid
        ? 'Record signature verified successfully'
        : 'Signature verification failed — record may have been tampered with',
      record: formatRecord(record),
    });
  }
);

/**
 * Format a DB record row for API response.
 */
function formatRecord(row) {
  return {
    id: row.id,
    timestamp: row.timestamp,
    latitude: row.latitude,
    longitude: row.longitude,
    operatorId: row.operator_id,
    deviceId: row.device_id,
    imageHash: row.image_hash,
    classification: row.classification,
    deltaE: row.delta_e,
    correctedRgb: row.corrected_rgb,
    signature: row.signature,
    signatureValid: row.signature_valid === 1,
    receivedAt: row.received_at,
  };
}

module.exports = router;

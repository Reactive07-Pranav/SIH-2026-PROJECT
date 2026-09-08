const express = require('express');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const { generateToken } = require('../middleware/auth');

const router = express.Router();

/**
 * POST /auth/login
 * Authenticate an operator and return a JWT.
 *
 * Body: { operatorId: string, password: string }
 * Returns: { token: string, operatorId: string, name: string }
 */
router.post(
  '/login',
  [
    body('operatorId').isString().trim().notEmpty().withMessage('Operator ID is required'),
    body('password').isString().notEmpty().withMessage('Password is required'),
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed', details: errors.array() });
    }

    const { operatorId, password } = req.body;
    const db = req.app.locals.db;

    // Find operator
    const operator = db.prepare(
      'SELECT id, password_hash, name, active FROM operators WHERE id = ?'
    ).get(operatorId);

    if (!operator) {
      // Log failed attempt
      db.prepare(
        'INSERT INTO audit_log (action, operator_id, details, ip_address) VALUES (?, ?, ?, ?)'
      ).run('login_failed', operatorId, 'Operator not found', req.ip);

      return res.status(401).json({ error: 'Invalid operator ID or password' });
    }

    if (!operator.active) {
      return res.status(403).json({ error: 'Account is deactivated' });
    }

    // Verify password
    const validPassword = bcrypt.compareSync(password, operator.password_hash);
    if (!validPassword) {
      db.prepare(
        'INSERT INTO audit_log (action, operator_id, details, ip_address) VALUES (?, ?, ?, ?)'
      ).run('login_failed', operatorId, 'Invalid password', req.ip);

      return res.status(401).json({ error: 'Invalid operator ID or password' });
    }

    // Generate JWT
    const token = generateToken(operator.id, operator.name);

    // Log successful login
    db.prepare(
      'INSERT INTO audit_log (action, operator_id, details, ip_address) VALUES (?, ?, ?, ?)'
    ).run('login_success', operatorId, 'JWT issued', req.ip);

    res.json({
      token,
      operatorId: operator.id,
      name: operator.name,
    });
  }
);

/**
 * POST /auth/register
 * Register a new operator (hackathon convenience endpoint).
 *
 * Body: { operatorId: string, password: string, name: string, badgeNumber?: string, department?: string }
 */
router.post(
  '/register',
  [
    body('operatorId').isString().trim().notEmpty(),
    body('password').isString().isLength({ min: 4 }),
    body('name').isString().trim().notEmpty(),
    body('badgeNumber').optional().isString().trim(),
    body('department').optional().isString().trim(),
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed', details: errors.array() });
    }

    const { operatorId, password, name, badgeNumber, department } = req.body;
    const db = req.app.locals.db;

    // Check if operator already exists
    const existing = db.prepare('SELECT id FROM operators WHERE id = ?').get(operatorId);
    if (existing) {
      return res.status(409).json({ error: 'Operator ID already exists' });
    }

    // Hash password
    const salt = bcrypt.genSaltSync(10);
    const passwordHash = bcrypt.hashSync(password, salt);

    // Insert operator
    db.prepare(
      `INSERT INTO operators (id, password_hash, name, badge_number, department)
       VALUES (?, ?, ?, ?, ?)`
    ).run(operatorId, passwordHash, name, badgeNumber || null, department || null);

    // Log registration
    db.prepare(
      'INSERT INTO audit_log (action, operator_id, details, ip_address) VALUES (?, ?, ?, ?)'
    ).run('operator_registered', operatorId, `Name: ${name}`, req.ip);

    // Generate JWT for immediate use
    const token = generateToken(operatorId, name);

    res.status(201).json({
      token,
      operatorId,
      name,
      message: 'Operator registered successfully',
    });
  }
);

module.exports = router;

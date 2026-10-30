const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

let db = null;

async function initializeDatabase() {
  const dbPath = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'drug_test.db');
  const dbDir = path.dirname(dbPath);

  // Ensure data directory exists
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  const SQL = await initSqlJs();

  // Load existing database or create new one
  if (fs.existsSync(dbPath)) {
    const buffer = fs.readFileSync(dbPath);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  // Create tables
  db.run(`
    -- Operators table
    CREATE TABLE IF NOT EXISTS operators (
      id TEXT PRIMARY KEY,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      badge_number TEXT,
      department TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      active INTEGER NOT NULL DEFAULT 1
    );

    -- Registered devices (stores public keys)
    CREATE TABLE IF NOT EXISTS devices (
      id TEXT PRIMARY KEY,
      operator_id TEXT NOT NULL,
      public_key TEXT NOT NULL,
      device_name TEXT,
      registered_at TEXT NOT NULL DEFAULT (datetime('now')),
      active INTEGER NOT NULL DEFAULT 1
    );

    -- Test records submitted from the field
    CREATE TABLE IF NOT EXISTS test_records (
      id TEXT PRIMARY KEY,
      timestamp TEXT NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      operator_id TEXT NOT NULL,
      device_id TEXT NOT NULL,
      image_hash TEXT NOT NULL,
      classification TEXT NOT NULL CHECK (classification IN ('positive', 'negative', 'inconclusive')),
      delta_e REAL NOT NULL,
      corrected_rgb TEXT NOT NULL,
      signature TEXT NOT NULL,
      signature_valid INTEGER,
      received_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Audit log
    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      action TEXT NOT NULL,
      operator_id TEXT,
      record_id TEXT,
      details TEXT,
      ip_address TEXT,
      timestamp TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Indexes
    CREATE INDEX IF NOT EXISTS idx_records_operator ON test_records(operator_id);
    CREATE INDEX IF NOT EXISTS idx_records_timestamp ON test_records(timestamp);
    CREATE INDEX IF NOT EXISTS idx_records_classification ON test_records(classification);
    CREATE INDEX IF NOT EXISTS idx_devices_operator ON devices(operator_id);
    CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_log(timestamp);
  `);

  // Save to disk
  saveDatabase(dbPath);

  console.log('Database initialized successfully');
  return createDbWrapper(dbPath);
}

function saveDatabase(dbPath) {
  if (db) {
    const data = db.export();
    fs.writeFileSync(dbPath, data);
  }
}

function createDbWrapper(dbPath) {
  return {
    prepare: (sql) => {
      return {
        get: (...params) => {
          try {
            const stmt = db.prepare(sql);
            stmt.bind(params);
            const result = stmt.step() ? stmt.getAsObject() : null;
            stmt.free();
            return result;
          } catch (e) {
            console.error('Query error:', e.message);
            return null;
          }
        },
        all: (...params) => {
          try {
            const stmt = db.prepare(sql);
            stmt.bind(params);
            const results = [];
            while (stmt.step()) {
              results.push(stmt.getAsObject());
            }
            stmt.free();
            return results;
          } catch (e) {
            console.error('Query error:', e.message);
            return [];
          }
        },
        run: (...params) => {
          try {
            db.run(sql, params);
            saveDatabase(dbPath);
            return { changes: db.getRowsModified() };
          } catch (e) {
            console.error('Query error:', e.message, 'SQL:', sql);
            throw e;
          }
        },
      };
    },
  };
}

module.exports = { initializeDatabase };

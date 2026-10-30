const bcrypt = require('bcryptjs');
const { initializeDatabase } = require('./database');

/**
 * Seed the database with sample operators for testing.
 */
async function seed() {
  const db = await initializeDatabase();

  console.log('Seeding database...');

  // Create test operators
  const operators = [
    {
      id: 'OP001',
      password: 'test123',
      name: 'Officer John Smith',
      badgeNumber: 'B12345',
      department: 'Narcotics Division',
    },
    {
      id: 'OP002',
      password: 'test123',
      name: 'Officer Jane Doe',
      badgeNumber: 'B67890',
      department: 'Patrol Division',
    },
    {
      id: 'admin',
      password: 'admin123',
      name: 'Admin User',
      badgeNumber: 'ADMIN',
      department: 'Administration',
    },
  ];

  for (const op of operators) {
    const existing = db.prepare('SELECT id FROM operators WHERE id = ?').get(op.id);
    if (existing) {
      console.log(`  Operator ${op.id} already exists, skipping...`);
      continue;
    }

    const salt = bcrypt.genSaltSync(10);
    const passwordHash = bcrypt.hashSync(op.password, salt);

    db.prepare(
      `INSERT INTO operators (id, password_hash, name, badge_number, department)
       VALUES (?, ?, ?, ?, ?)`
    ).run(op.id, passwordHash, op.name, op.badgeNumber, op.department);

    console.log(`  ✓ Created operator: ${op.id} (${op.name})`);
  }

  console.log('\nDatabase seeding complete!');
  console.log('\nTest credentials:');
  console.log('  Operator ID: OP001, Password: test123');
  console.log('  Operator ID: OP002, Password: test123');
  console.log('  Operator ID: admin, Password: admin123');
}

seed().catch(console.error);

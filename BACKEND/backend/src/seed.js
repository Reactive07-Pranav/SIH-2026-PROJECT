const bcrypt = require('bcryptjs');
const { initializeDatabase } = require('./database');

/**
 * Seed the database with sample operators for testing.
 */
async function seed() {
  const db = await initializeDatabase();

  console.log('Seeding database...');

  console.log('Database seed complete. No default operator credentials are configured.');
}

seed().catch(console.error);

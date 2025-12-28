const { Pool } = require('pg');
const bcrypt = require('bcrypt');
require('dotenv').config();

async function seedDatabase() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  try {
    console.log('🌱 Seeding database...\n');
    
    // Create admin employee
    const adminPassword = await bcrypt.hash('Admin@123!', 10);
    
    await pool.query(`
      INSERT INTO employees (email, name, role, password_hash, is_active, can_view_all_stores)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (email) DO UPDATE 
      SET password_hash = EXCLUDED.password_hash
    `, ['admin@yourdomain.com', 'Admin User', 'admin', adminPassword, true, true]);
    
    console.log('✅ Created admin user');
    
    // Create demo agent
    const agentPassword = await bcrypt.hash('Agent@123!', 10);
    
    await pool.query(`
      INSERT INTO employees (email, name, role, password_hash, is_active, can_view_all_stores)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (email) DO UPDATE 
      SET password_hash = EXCLUDED.password_hash
    `, ['agent@yourdomain.com', 'Support Agent', 'agent', agentPassword, true, true]);
    
    console.log('✅ Created agent user');
    
    console.log('\n📝 Demo Credentials:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Admin:  admin@yourdomain.com  /  Admin@123!');
    console.log('Agent:  agent@yourdomain.com  /  Agent@123!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('⚠️  IMPORTANT: Change these passwords in production!\n');
    
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

seedDatabase();
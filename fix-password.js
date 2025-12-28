/**
 * Fix admin password
 * Run with: node fix-password.js
 */

require('dotenv').config();
const { Pool } = require('pg');
const { hashPassword, verifyPassword } = require('./backend/auth');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function fixPassword() {
  try {
    const email = 'admin@example.com';
    const newPassword = 'admin123';
    
    console.log('\n🔧 Fixing password for:', email);
    
    // Get current employee
    const result = await pool.query(
      'SELECT * FROM employees WHERE email = $1',
      [email]
    );
    
    if (!result.rows[0]) {
      console.log('❌ User not found!');
      process.exit(1);
    }
    
    const employee = result.rows[0];
    console.log('\n📋 Current user data:');
    console.log('   ID:', employee.id);
    console.log('   Email:', employee.email);
    console.log('   Name:', employee.name);
    console.log('   Role:', employee.role);
    console.log('   Current password_hash:', employee.password_hash);
    console.log('   Hash length:', employee.password_hash?.length);
    
    // Test current password
    console.log('\n🧪 Testing current password hash...');
    const currentWorks = await verifyPassword(newPassword, employee.password_hash);
    console.log('   Current hash works?', currentWorks);
    
    if (currentWorks) {
      console.log('\n✅ Password already works! You can login with:');
      console.log('   Email:', email);
      console.log('   Password:', newPassword);
      process.exit(0);
    }
    
    // Generate new hash
    console.log('\n🔒 Generating new password hash...');
    const newHash = await hashPassword(newPassword);
    console.log('   New hash:', newHash);
    console.log('   New hash length:', newHash.length);
    
    // Test new hash
    console.log('\n🧪 Testing new hash...');
    const newWorks = await verifyPassword(newPassword, newHash);
    console.log('   New hash works?', newWorks);
    
    if (!newWorks) {
      console.log('❌ New hash also doesn\'t work! There\'s a problem with bcrypt.');
      process.exit(1);
    }
    
    // Update database
    console.log('\n💾 Updating database...');
    await pool.query(
      'UPDATE employees SET password_hash = $1, updated_at = NOW() WHERE id = $2',
      [newHash, employee.id]
    );
    
    console.log('\n✅ SUCCESS! Password updated!\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📧 Email:    ', email);
    console.log('🔑 Password: ', newPassword);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

fixPassword();
/**
 * One-time script to create admin user
 * Run with: node create-admin.js
 */

require('dotenv').config();
const db = require('./backend/database');
const { hashPassword } = require('./backend/auth');

async function createAdmin() {
  try {
    console.log('\n🔧 Creating Admin User...\n');
    
    // Admin credentials
    const email = 'admin@example.com';
    const password = 'admin123';
    const name = 'Admin User';
    
    // Check if already exists
    console.log('🔍 Checking if user already exists...');
    const existing = await db.getEmployeeByEmail(email);
    if (existing) {
      console.log('⚠️  User already exists!');
      console.log('   Email:', existing.email);
      console.log('   Name:', existing.name);
      console.log('   ID:', existing.id);
      console.log('\n❌ Please delete the existing user first or use a different email\n');
      process.exit(1);
    }
    
    // Hash password
    console.log('🔒 Hashing password...');
    const password_hash = await hashPassword(password);
    console.log('✅ Password hashed\n');
    
    // Create employee with correct field names
    console.log('👤 Creating admin user...');
    const employee = await db.createEmployee({
      email: email,
      name: name,
      password_hash: password_hash,  // Note: underscore, not camelCase
      role: 'admin',
      can_view_all_stores: true,
      assigned_stores: []
    });
    
    console.log('\n✅ SUCCESS! Admin user created:\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📧 Email:    ', email);
    console.log('🔑 Password: ', password);
    console.log('👤 Name:     ', name);
    console.log('🎭 Role:     ', employee.role);
    console.log('🆔 ID:       ', employee.id);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('You can now login with these credentials!\n');
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error creating admin:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

createAdmin();
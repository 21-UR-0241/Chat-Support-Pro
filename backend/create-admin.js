// backend/create-admin.js
require('dotenv').config();
const { createEmployee } = require('./database');
const { hashPassword } = require('./auth');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function createAdmin() {
  try {
    console.log('\n=================================');
    console.log('🔐 Create Admin User');
    console.log('=================================\n');
    
    const email = await question('Email: ');
    const name = await question('Name: ');
    const password = await question('Password: ');
    
    if (!email || !name || !password) {
      console.error('❌ All fields are required');
      process.exit(1);
    }
    
    if (password.length < 8) {
      console.error('❌ Password must be at least 8 characters');
      process.exit(1);
    }
    
    console.log('\n🔄 Creating admin user...');
    
    const password_hash = await hashPassword(password);
    
    const admin = await createEmployee({
      email,
      name,
      password_hash,
      role: 'admin',
      can_view_all_stores: true,
      assigned_stores: []
    });
    
    console.log('\n✅ Admin user created successfully!\n');
    console.log('=================================');
    console.log('Email:', admin.email);
    console.log('Name:', admin.name);
    console.log('Role:', admin.role);
    console.log('ID:', admin.id);
    console.log('=================================\n');
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error creating admin:', error.message);
    process.exit(1);
  }
}

createAdmin();
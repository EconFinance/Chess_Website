// test-connection.js
// Save this file and run: node test-connection.js

require('dotenv').config();
const { Client } = require('pg');

async function testConnection() {
  console.log('🔍 Testing database connection...\n');
  
  // Check if DATABASE_URL exists
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL not found in environment variables');
    console.error('Please make sure your .env file exists and contains DATABASE_URL');
    return;
  }

  // Parse and display connection info (hiding password)
  const url = process.env.DATABASE_URL;
  const urlPattern = /postgres(?:ql)?:\/\/([^:]+):([^@]+)@([^:\/]+)(?::(\d+))?\/(.+)/;
  const match = url.match(urlPattern);
  
  if (match) {
    console.log('📋 Connection details:');
    console.log(`   User: ${match[1]}`);
    console.log(`   Host: ${match[3]}`);
    console.log(`   Port: ${match[4] || '5432'}`);
    console.log(`   Database: ${match[5]}`);
    console.log(`   SSL: Required for Render\n`);
  }

  // Create a client with explicit timeout
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    },
    connectionTimeoutMillis: 5000, // 5 second timeout
  });

  try {
    console.log('🔌 Attempting to connect...');
    await client.connect();
    console.log('✅ Connected successfully!\n');
    
    // Test query
    const result = await client.query('SELECT NOW() as current_time, current_database() as database');
    console.log('📊 Database info:');
    console.log(`   Current time: ${result.rows[0].current_time}`);
    console.log(`   Database: ${result.rows[0].database}`);
    
    // Check if tables exist
    const tableCheck = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'tournaments'
    `);
    
    if (tableCheck.rows.length > 0) {
      console.log('✅ Tournaments table exists');
      
      // Count tournaments
      const countResult = await client.query('SELECT COUNT(*) as count FROM tournaments');
      console.log(`📈 Current tournament count: ${countResult.rows[0].count}`);
    } else {
      console.log('⚠️  Tournaments table does not exist. Run: node db/createTable.js');
    }
    
  } catch (error) {
    console.error('\n❌ Connection failed!');
    console.error('Error:', error.message);
    
    if (error.code === 'ETIMEDOUT') {
      console.error('\n🔧 Possible solutions:');
      console.error('1. Check if the database is active in Render dashboard');
      console.error('2. Verify the DATABASE_URL is correct');
      console.error('3. Try the External Database URL from Render dashboard');
      console.error('4. Check your internet connection');
      console.error('5. Render free databases pause after 90 days - check if it needs to be resumed');
    } else if (error.code === 'ENOTFOUND') {
      console.error('\n🔧 The hostname cannot be resolved. Check your DATABASE_URL');
    } else if (error.code === '28P01') {
      console.error('\n🔧 Authentication failed. Check your database credentials');
    }
  } finally {
    await client.end();
  }
}

// Run the test
testConnection().then(() => {
  console.log('\n✨ Connection test completed');
}).catch(err => {
  console.error('\n💥 Unexpected error:', err);
});
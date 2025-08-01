// db/db.js
// Only load dotenv in development
if (process.env.NODE_ENV !== 'production') {
  try {
    require('dotenv').config();
  } catch (e) {
    console.log('📌 dotenv not found - using environment variables directly');
  }
}

const { Pool } = require('pg');

// Parse DATABASE_URL and show what we're connecting to
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('❌ DATABASE_URL is not set!');
  console.error('Please create a .env file with DATABASE_URL=your_connection_string');
  process.exit(1);
}

// Log connection details (without password)
const urlParts = connectionString.match(/postgresql:\/\/([^:]+):([^@]+)@([^:\/]+):?(\d+)?\/(.+)/);
if (urlParts) {
  console.log('🔌 Attempting to connect to:');
  console.log(`   Host: ${urlParts[3]}`);
  console.log(`   Port: ${urlParts[4] || '5432'}`);
  console.log(`   Database: ${urlParts[5]}`);
  console.log(`   User: ${urlParts[1]}`);
}

// Create pool with timeout settings
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false, // Required for most cloud providers
  },
  // Add connection timeout settings
  connectionTimeoutMillis: 10000, // 10 seconds
  idleTimeoutMillis: 30000,
  max: 20,
});

// Test the connection with better error handling
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('❌ Database connection error:', err.message);
    console.error('\n🔍 Troubleshooting tips:');
    console.error('1. Check if DATABASE_URL is correct in your .env file');
    console.error('2. Verify the database service is running');
    console.error('3. Check if your IP is whitelisted (for cloud databases)');
    console.error('4. Try connecting with psql: psql $DATABASE_URL');
    console.error('5. Check if the database host is reachable: ping', urlParts?.[3] || 'your-db-host');
  } else {
    console.log('✅ Database connected at:', res.rows[0].now);
  }
});

// Handle pool errors
pool.on('error', (err) => {
  console.error('Unexpected database error:', err);
});

module.exports = pool;
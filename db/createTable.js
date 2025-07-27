const pool = require('./db.js');

// First, let's check if we can use PostGIS
const checkPostGIS = async () => {
  try {
    await pool.query('CREATE EXTENSION IF NOT EXISTS postgis;');
    console.log('✅ PostGIS extension enabled');
    return true;
  } catch (err) {
    console.log('⚠️  PostGIS not available - using simple coordinates instead');
    return false;
  }
};

const createTableQuery = `
  -- Drop existing table if you want a fresh start
  DROP TABLE IF EXISTS tournaments CASCADE;

  -- Create the comprehensive tournaments table
  CREATE TABLE tournaments (
    id SERIAL PRIMARY KEY,
    
    -- Basic tournament info
    name VARCHAR(255) NOT NULL,
    description TEXT,
    tournament_type VARCHAR(20) NOT NULL DEFAULT 'classical' CHECK (tournament_type IN ('classical', 'rapid', 'blitz')),
    time_control VARCHAR(100),
    
    -- Dates
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    registration_deadline DATE,
    
    -- Location (keeping it compatible with your existing fields)
    country_code VARCHAR(2),
    country VARCHAR(100), -- Your existing 'country' field
    location VARCHAR(200), -- Your existing 'location' field (we'll use as city)
    city VARCHAR(100), -- New field for consistency
    venue_name VARCHAR(200),
    venue_address TEXT,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    
    -- Tournament details
    max_players INTEGER,
    current_players INTEGER DEFAULT 0,
    entry_fee DECIMAL(10, 2),
    currency VARCHAR(3) DEFAULT 'EUR',
    prize_fund DECIMAL(12, 2),
    
    -- Rating requirements
    min_rating INTEGER,
    max_rating INTEGER,
    
    -- Organizer info
    organizer_name VARCHAR(200),
    organizer_email VARCHAR(255),
    organizer_phone VARCHAR(50),
    
    -- Links & contact
    website VARCHAR(255),
    source_url TEXT, -- Your existing field
    registration_link VARCHAR(255),
    
    -- Status
    status VARCHAR(20) DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'ongoing', 'completed', 'cancelled')),
    is_fide_rated BOOLEAN DEFAULT true,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Keep your unique constraint
    UNIQUE (name, start_date)
  );
`;

const createIndexesQuery = `
  -- Create indexes for better performance
  CREATE INDEX idx_tournaments_start_date ON tournaments(start_date);
  CREATE INDEX idx_tournaments_type ON tournaments(tournament_type);
  CREATE INDEX idx_tournaments_status ON tournaments(status);
  CREATE INDEX idx_tournaments_country ON tournaments(country);
  CREATE INDEX idx_tournaments_location ON tournaments(location);
  CREATE INDEX idx_tournaments_coordinates ON tournaments(latitude, longitude) 
    WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
`;

const createFunctionsQuery = `
  -- Function to update the updated_at timestamp
  CREATE OR REPLACE FUNCTION update_updated_at_column()
  RETURNS TRIGGER AS $$
  BEGIN
      NEW.updated_at = CURRENT_TIMESTAMP;
      RETURN NEW;
  END;
  $$ language 'plpgsql';

  -- Trigger to automatically update updated_at
  CREATE TRIGGER update_tournaments_updated_at 
    BEFORE UPDATE ON tournaments 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

  -- Simple distance calculation function
  CREATE OR REPLACE FUNCTION get_nearby_tournaments_simple(
      lat DECIMAL,
      lon DECIMAL,
      radius_km INTEGER,
      only_upcoming BOOLEAN DEFAULT true
  )
  RETURNS TABLE (
      tournament_id INTEGER,
      tournament_name VARCHAR,
      distance_km DECIMAL
  ) AS $$
  BEGIN
      RETURN QUERY
      SELECT 
          t.id,
          t.name,
          ROUND((
              6371 * acos(
                  LEAST(1.0, -- Prevent acos domain error
                    cos(radians(lat)) * cos(radians(t.latitude)) *
                    cos(radians(t.longitude) - radians(lon)) +
                    sin(radians(lat)) * sin(radians(t.latitude))
                  )
              )
          )::numeric, 2) as dist_km
      FROM tournaments t
      WHERE t.latitude IS NOT NULL 
      AND t.longitude IS NOT NULL
      AND t.latitude BETWEEN lat - (radius_km / 111.0) AND lat + (radius_km / 111.0)
      AND t.longitude BETWEEN lon - (radius_km / (111.0 * cos(radians(lat)))) 
                          AND lon + (radius_km / (111.0 * cos(radians(lat))))
      AND (NOT only_upcoming OR t.status IN ('upcoming', 'ongoing'))
      AND (
          6371 * acos(
              LEAST(1.0,
                cos(radians(lat)) * cos(radians(t.latitude)) *
                cos(radians(t.longitude) - radians(lon)) +
                sin(radians(lat)) * sin(radians(t.latitude))
              )
          )
      ) <= radius_km
      ORDER BY dist_km;
  END;
  $$ LANGUAGE plpgsql;
`;

const insertSampleData = `
  -- Insert sample data
  INSERT INTO tournaments (
      name, tournament_type, time_control, 
      start_date, end_date, registration_deadline,
      country, location, city, venue_name,
      latitude, longitude,
      max_players, entry_fee, currency, prize_fund,
      organizer_name, organizer_email,
      website, source_url, is_fide_rated, status
  ) VALUES 
  (
      'Munich Chess Open 2025', 'classical', '90+30',
      '2025-08-15', '2025-08-23', '2025-08-10',
      'Germany', 'Munich', 'Munich', 'Holiday Inn Munich City Centre',
      48.1351, 11.5820,
      200, 80.00, 'EUR', 10000.00,
      'Munich Chess Club', 'info@munichopen.de',
      'https://munichopen.de', 'https://chess-results.com/example1', true, 'upcoming'
  ),
  (
      'Berlin Rapid Championship', 'rapid', '15+10',
      '2025-09-05', '2025-09-06', '2025-09-01',
      'Germany', 'Berlin', 'Berlin', 'Estrel Berlin',
      52.5200, 13.4050,
      150, 50.00, 'EUR', 5000.00,
      'Berlin Chess Federation', 'rapid@berlinchess.de',
      'https://berlinchess.de/rapid', 'https://chess-results.com/example2', true, 'upcoming'
  ),
  (
      'Tata Steel Chess 2025', 'classical', '100+30',
      '2025-01-10', '2025-01-26', '2024-12-01',
      'Netherlands', 'Wijk aan Zee', 'Wijk aan Zee', 'De Moriaan Community Centre',
      52.5067, 4.6026,
      14, NULL, 'EUR', 100000.00,
      'Tata Steel Chess', 'info@tatasteelchess.com',
      'https://tatasteelchess.com', 'https://tatasteelchess.com', true, 'upcoming'
  )
  ON CONFLICT (name, start_date) DO NOTHING;
`;

const runMigration = async () => {
  try {
    // Check for PostGIS
    const hasPostGIS = await checkPostGIS();
    
    // Create table
    console.log('📋 Creating tournaments table...');
    await pool.query(createTableQuery);
    console.log('✅ Table created successfully');
    
    // Create indexes
    console.log('📋 Creating indexes...');
    await pool.query(createIndexesQuery);
    console.log('✅ Indexes created successfully');
    
    // Create functions and triggers
    console.log('📋 Creating functions and triggers...');
    await pool.query(createFunctionsQuery);
    console.log('✅ Functions and triggers created successfully');
    
    // Insert sample data
    console.log('📋 Inserting sample data...');
    await pool.query(insertSampleData);
    console.log('✅ Sample data inserted successfully');
    
    // Verify
    const result = await pool.query('SELECT COUNT(*) as count FROM tournaments');
    console.log(`\n✅ Migration complete! ${result.rows[0].count} tournaments in database.`);
    
    // Show sample data
    const sample = await pool.query(`
      SELECT name, location, start_date, tournament_type 
      FROM tournaments 
      ORDER BY start_date 
      LIMIT 5
    `);
    console.log('\n📊 Sample tournaments:');
    console.table(sample.rows);
    
  } catch (err) {
    console.error('❌ Error during migration:', err);
  } finally {
    pool.end();
  }
};

// Run the migration
runMigration();
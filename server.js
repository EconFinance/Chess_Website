const express = require('express');
const cors = require('cors');
const pool = require('./db/db');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    database: 'connected'
  });
});

// Serve index.html for root route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Get all tournaments with filters
app.get('/api/tournaments', async (req, res) => {
  try {
    const {
      type,
      country,
      city,
      startDate,
      endDate,
      search,
      limit = 100,
      offset = 0
    } = req.query;

    let query = 'SELECT * FROM tournaments WHERE 1=1';
    const params = [];
    let paramCount = 0;

    // Build dynamic query based on filters
    if (type && type !== 'all') {
      paramCount++;
      query += ` AND tournament_type = $${paramCount}`;
      params.push(type);
    }

    if (country) {
      paramCount++;
      query += ` AND LOWER(country) = LOWER($${paramCount})`;
      params.push(country);
    }

    if (city) {
      paramCount++;
      query += ` AND LOWER(location) LIKE LOWER($${paramCount})`;
      params.push(`%${city}%`);
    }

    if (startDate) {
      paramCount++;
      query += ` AND start_date >= $${paramCount}`;
      params.push(startDate);
    }

    if (endDate) {
      paramCount++;
      query += ` AND end_date <= $${paramCount}`;
      params.push(endDate);
    }

    if (search) {
      paramCount++;
      query += ` AND (LOWER(name) LIKE LOWER($${paramCount}) OR LOWER(location) LIKE LOWER($${paramCount}))`;
      params.push(`%${search}%`);
    }

    // Add ordering
    query += ' ORDER BY start_date ASC';

    // Add pagination
    paramCount++;
    query += ` LIMIT $${paramCount}`;
    params.push(limit);
    
    paramCount++;
    query += ` OFFSET $${paramCount}`;
    params.push(offset);

    console.log('Query:', query);
    console.log('Params:', params);

    const result = await pool.query(query, params);

    // Get total count for pagination
    let countQuery = 'SELECT COUNT(*) as total FROM tournaments WHERE 1=1';
    const countParams = params.slice(0, -2); // Remove limit and offset
    
    // Rebuild count query with same filters
    if (type && type !== 'all') countQuery += ' AND tournament_type = $1';
    if (country) countQuery += ` AND LOWER(country) = LOWER($${countParams.indexOf(country) + 1})`;
    if (city) countQuery += ` AND LOWER(location) LIKE LOWER($${countParams.indexOf(`%${city}%`) + 1})`;
    if (startDate) countQuery += ` AND start_date >= $${countParams.indexOf(startDate) + 1}`;
    if (endDate) countQuery += ` AND end_date <= $${countParams.indexOf(endDate) + 1}`;
    if (search) countQuery += ` AND (LOWER(name) LIKE LOWER($${countParams.indexOf(`%${search}%`) + 1}) OR LOWER(location) LIKE LOWER($${countParams.indexOf(`%${search}%`) + 1}))`;

    const countResult = await pool.query(countQuery, countParams);

    res.json({
      tournaments: result.rows,
      total: parseInt(countResult.rows[0].total),
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

  } catch (error) {
    console.error('Error fetching tournaments:', error);
    res.status(500).json({ error: 'Failed to fetch tournaments' });
  }
});

// Get single tournament
app.get('/api/tournaments/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM tournaments WHERE id = $1', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Tournament not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching tournament:', error);
    res.status(500).json({ error: 'Failed to fetch tournament' });
  }
});

// Get filter options (countries and cities in database)
app.get('/api/filters/options', async (req, res) => {
  try {
    const [countries, cities] = await Promise.all([
      pool.query('SELECT DISTINCT country FROM tournaments WHERE country IS NOT NULL ORDER BY country'),
      pool.query('SELECT DISTINCT location as city FROM tournaments WHERE location IS NOT NULL ORDER BY location')
    ]);

    res.json({
      countries: countries.rows.map(r => r.country),
      cities: cities.rows.map(r => r.city),
      types: ['classical', 'rapid', 'blitz']
    });
  } catch (error) {
    console.error('Error fetching filter options:', error);
    res.status(500).json({ error: 'Failed to fetch filter options' });
  }
});

// Create a new tournament
app.post('/api/tournaments', async (req, res) => {
  try {
    const {
      name,
      tournament_type = 'classical',
      location,
      country,
      start_date,
      end_date,
      venue_name,
      latitude,
      longitude,
      entry_fee,
      max_players,
      website,
      source_url
    } = req.body;

    const query = `
      INSERT INTO tournaments (
        name, tournament_type, location, country, 
        start_date, end_date, venue_name,
        latitude, longitude, entry_fee, max_players,
        website, source_url
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *
    `;

    const values = [
      name, tournament_type, location, country,
      start_date, end_date, venue_name,
      latitude, longitude, entry_fee, max_players,
      website, source_url
    ];

    const result = await pool.query(query, values);
    res.status(201).json(result.rows[0]);

  } catch (error) {
    console.error('Error creating tournament:', error);
    if (error.code === '23505') { // Unique violation
      res.status(400).json({ error: 'Tournament with this name and date already exists' });
    } else {
      res.status(500).json({ error: 'Failed to create tournament' });
    }
  }
});

// Get tournaments near a location
app.get('/api/tournaments/nearby', async (req, res) => {
  try {
    const { lat, lon, radius = 100 } = req.query;
    
    if (!lat || !lon) {
      return res.status(400).json({ error: 'Latitude and longitude are required' });
    }

    const query = `
      SELECT * FROM get_nearby_tournaments_simple($1, $2, $3, true)
      JOIN tournaments t ON t.id = tournament_id
    `;

    const result = await pool.query(query, [parseFloat(lat), parseFloat(lon), parseInt(radius)]);
    res.json(result.rows);

  } catch (error) {
    console.error('Error fetching nearby tournaments:', error);
    res.status(500).json({ error: 'Failed to fetch nearby tournaments' });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`
🚀 Chess Tournament API running on port ${PORT}
📍 Endpoints:
   GET  /api/health              - Health check
   GET  /api/tournaments         - List tournaments
   GET  /api/tournaments/:id     - Get single tournament
   GET  /api/tournaments/nearby  - Find nearby tournaments
   POST /api/tournaments         - Create tournament
   GET  /api/filters/options     - Get filter options
  `);
});
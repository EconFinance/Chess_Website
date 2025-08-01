// scrapers/scrape-with-geocoding.js

const axios = require('axios');
const cheerio = require('cheerio');
const dayjs = require('dayjs');
const pool = require('../db/db');

const BASE_URL = 'https://chess-calendar.eu/index.php?page=';
const START_YEAR = 2025;
const END_YEAR = 2028;

// Simple geocoding using Nominatim (OpenStreetMap)
async function geocodeLocation(city, country) {
  try {
    const query = `${city}, ${country}`;
    const url = `https://nominatim.openstreetmap.org/search`;
    
    const response = await axios.get(url, {
      params: {
        q: query,
        format: 'json',
        limit: 1
      },
      headers: {
        'User-Agent': 'ChessTournamentScraper/1.0'
      }
    });

    if (response.data && response.data.length > 0) {
      const result = response.data[0];
      return {
        latitude: parseFloat(result.lat),
        longitude: parseFloat(result.lon)
      };
    }
  } catch (error) {
    console.error(`Geocoding error for ${city}, ${country}:`, error.message);
  }
  
  return { latitude: null, longitude: null };
}

// Add delay to respect rate limits
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

(async () => {
  let totalImported = 0;
  let totalSkipped = 0;

  console.log('🚀 Starting tournament scraper with geocoding...\n');

  for (let year = START_YEAR; year <= END_YEAR; year++) {
    for (let month = 1; month <= 12; month++) {
      const page = `${year}-${month}`;
      const url = `${BASE_URL}${page}&all_new=`;
      console.log(`\n📅 Scraping ${page}...`);

      try {
        const { data } = await axios.get(url);
        const $ = cheerio.load(data);
        const tournaments = [];

        $('.calItem').each((_, el) => {
          const name = $(el).find('.weblink').text().trim();
          const location = $(el).find('.city').text().replace(',', '').trim();
          const country = $(el).find('.country').text().replace(',', '').trim();
          const startDateRaw = $(el).find('.startdate').text().trim();
          const endDateRaw = $(el).find('.endDate2').text().trim();
          const sourceUrl = $(el).find('.source a').attr('href') || null;

          const startDate = dayjs(startDateRaw, 'DD.MM.YYYY', true).isValid()
            ? dayjs(startDateRaw, 'DD.MM.YYYY').format('YYYY-MM-DD')
            : null;
          const endDate = dayjs(endDateRaw, 'DD.MM.YYYY', true).isValid()
            ? dayjs(endDateRaw, 'DD.MM.YYYY').format('YYYY-MM-DD')
            : startDate;

          // Only include future tournaments
          if (startDate && dayjs(endDate).isAfter(dayjs().subtract(1, 'day'))) {
            tournaments.push({
              name,
              startDate,
              endDate,
              country,
              location, // This is the city
              city: location, // Set city as well
              sourceUrl
            });
          }
        });

        console.log(`🔎 Found ${tournaments.length} upcoming tournaments`);

        // Process tournaments with geocoding
        for (const t of tournaments) {
          try {
            // Check if tournament already exists
            const existing = await pool.query(
              'SELECT id FROM tournaments WHERE name = $1 AND start_date = $2',
              [t.name, t.startDate]
            );

            if (existing.rows.length > 0) {
              console.log(`⏭️  Skipping duplicate: ${t.name}`);
              totalSkipped++;
              continue;
            }

            // Geocode the location
            console.log(`📍 Geocoding: ${t.location}, ${t.country}`);
            const coords = await geocodeLocation(t.location, t.country);
            
            // Add small delay to respect rate limits
            await delay(1000);

            // Determine tournament type from name (basic heuristic)
            let tournamentType = 'classical';
            const nameLower = t.name.toLowerCase();
            if (nameLower.includes('rapid')) {
              tournamentType = 'rapid';
            } else if (nameLower.includes('blitz')) {
              tournamentType = 'blitz';
            }

            // Insert with all required fields
            await pool.query(
              `INSERT INTO tournaments (
                name, tournament_type, start_date, end_date,
                country, location, city, source_url,
                latitude, longitude, venue_name,
                status, created_at, updated_at
              ) VALUES (
                $1, $2, $3, $4,
                $5, $6, $7, $8,
                $9, $10, $11,
                'upcoming', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
              )
              ON CONFLICT (name, start_date) DO UPDATE SET
                updated_at = CURRENT_TIMESTAMP,
                latitude = EXCLUDED.latitude,
                longitude = EXCLUDED.longitude`,
              [
                t.name,
                tournamentType,
                t.startDate,
                t.endDate,
                t.country,
                t.location, // location field
                t.city,     // city field
                t.sourceUrl,
                coords.latitude,
                coords.longitude,
                t.location  // Use location as venue_name for now
              ]
            );
            
            totalImported++;
            console.log(`✅ Imported: ${t.name} (${coords.latitude ? 'with' : 'without'} coordinates)`);
            
          } catch (dbErr) {
            console.error('❌ DB Insert Error:', dbErr.message);
          }
        }

      } catch (err) {
        console.error(`❌ Failed to scrape ${page}:`, err.message);
      }
    }
  }

  console.log(`\n🎉 Scraping completed!`);
  console.log(`✅ Total tournaments imported: ${totalImported}`);
  console.log(`⏭️  Total tournaments skipped: ${totalSkipped}`);
  
  // Show some statistics
  const stats = await pool.query(`
    SELECT 
      COUNT(*) as total,
      COUNT(latitude) as with_coords,
      COUNT(*) - COUNT(latitude) as without_coords
    FROM tournaments
  `);
  
  console.log('\n📊 Database statistics:');
  console.log(`   Total tournaments: ${stats.rows[0].total}`);
  console.log(`   With coordinates: ${stats.rows[0].with_coords}`);
  console.log(`   Without coordinates: ${stats.rows[0].without_coords}`);
  
  await pool.end();
})();
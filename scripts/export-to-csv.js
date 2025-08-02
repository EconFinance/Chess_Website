const fs = require('fs');
const path = require('path');
const pool = require('../db/db');

async function exportToCSV() {
  try {
    // Query all tournaments
    const result = await pool.query(`
      SELECT 
        id,
        name,
        tournament_type,
        time_control,
        start_date,
        end_date,
        country,
        city,
        venue_name,
        latitude,
        longitude,
        max_players,
        entry_fee,
        currency,
        prize_fund,
        organizer_name,
        organizer_email,
        website,
        source_url,
        is_fide_rated
      FROM tournaments
      ORDER BY start_date
    `);

    // Convert to CSV format
    const headers = Object.keys(result.rows[0]).join(',');
    const rows = result.rows.map(row => {
      return Object.values(row).map(value => {
        // Handle null values and escape commas/quotes
        if (value === null) return '';
        if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      }).join(',');
    });

    const csv = [headers, ...rows].join('\n');
    
    // Save CSV file
    const dataDir = path.join(__dirname, '..', 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir);
    }
    
    fs.writeFileSync(path.join(dataDir, 'tournaments.csv'), csv);
    console.log(`✅ Exported ${result.rows.length} tournaments to data/tournaments.csv`);
    
    // Also create JSON version for easier frontend consumption
    fs.writeFileSync(
      path.join(dataDir, 'tournaments.json'), 
      JSON.stringify(result.rows, null, 2)
    );
    
    // Create metadata file
    fs.writeFileSync(
      path.join(dataDir, 'last-updated.json'),
      JSON.stringify({
        lastUpdated: new Date().toISOString(),
        totalTournaments: result.rows.length
      }, null, 2)
    );
    
  } catch (error) {
    console.error('Export failed:', error);
  } finally {
    await pool.end();
  }
}

exportToCSV();
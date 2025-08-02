const fs = require('fs');
const path = require('path');
const axios = require('axios');
const cheerio = require('cheerio');
const dayjs = require('dayjs');

const BASE_URL = 'https://chess-calendar.eu/index.php?page=';
const START_YEAR = 2025;
const END_YEAR = 2028;

// Geocoding function (same as before)
async function geocodeLocation(city, country) {
  try {
    const query = `${city}, ${country}`;
    const url = `https://nominatim.openstreetmap.org/search`;
    
    const response = await axios.get(url, {
      params: { q: query, format: 'json', limit: 1 },
      headers: { 'User-Agent': 'ChessTournamentScraper/1.0' }
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

async function scrapeToCSV() {
  const tournaments = [];
  const existingTournaments = new Map();
  
  // Load existing data if available
  const csvPath = path.join(__dirname, '..', 'data', 'tournaments.csv');
  if (fs.existsSync(csvPath)) {
    const csvData = fs.readFileSync(csvPath, 'utf-8');
    const lines = csvData.split('\n').slice(1); // Skip header
    lines.forEach(line => {
      if (line.trim()) {
        const cols = line.split(',');
        const key = `${cols[1]}_${cols[4]}`; // name_start_date
        existingTournaments.set(key, true);
      }
    });
  }

  console.log('🚀 Starting tournament scraper...\n');

  for (let year = START_YEAR; year <= END_YEAR; year++) {
    for (let month = 1; month <= 12; month++) {
      const page = `${year}-${month}`;
      const url = `${BASE_URL}${page}&all_new=`;
      console.log(`📅 Scraping ${page}...`);

      try {
        const { data } = await axios.get(url);
        const $ = cheerio.load(data);

        $('.calItem').each((_, el) => {
          const name = $(el).find('.weblink').text().trim();
          const location = $(el).find('.city').text().replace(',', '').trim();
          const country = $(el).find('.country').text().replace(',', '').trim();
          const startDateRaw = $(el).find('.startdate').text().trim();
          const endDateRaw = $(el).find('.endDate2').text().trim();
          const sourceUrl = $(el).find('.source a').attr('href') || '';

          const startDate = dayjs(startDateRaw, 'DD.MM.YYYY', true).isValid()
            ? dayjs(startDateRaw, 'DD.MM.YYYY').format('YYYY-MM-DD')
            : null;
          const endDate = dayjs(endDateRaw, 'DD.MM.YYYY', true).isValid()
            ? dayjs(endDateRaw, 'DD.MM.YYYY').format('YYYY-MM-DD')
            : startDate;

          if (startDate && dayjs(endDate).isAfter(dayjs().subtract(1, 'day'))) {
            const key = `${name}_${startDate}`;
            
            if (!existingTournaments.has(key)) {
              const nameLower = name.toLowerCase();
              let tournamentType = 'classical';
              if (nameLower.includes('rapid')) tournamentType = 'rapid';
              else if (nameLower.includes('blitz')) tournamentType = 'blitz';

              tournaments.push({
                id: Date.now() + Math.random(), // Simple ID generation
                name,
                tournament_type: tournamentType,
                time_control: '',
                start_date: startDate,
                end_date: endDate,
                country,
                city: location,
                venue_name: location,
                latitude: null,
                longitude: null,
                max_players: null,
                entry_fee: null,
                currency: 'EUR',
                prize_fund: null,
                organizer_name: '',
                organizer_email: '',
                website: '',
                source_url: sourceUrl,
                is_fide_rated: true
              });
            }
          }
        });

      } catch (err) {
        console.error(`❌ Failed to scrape ${page}:`, err.message);
      }
    }
  }

  // Geocode new tournaments
  console.log(`\n📍 Geocoding ${tournaments.length} new tournaments...`);
  for (let i = 0; i < tournaments.length; i++) {
    const t = tournaments[i];
    console.log(`[${i + 1}/${tournaments.length}] ${t.city}, ${t.country}`);
    const coords = await geocodeLocation(t.city, t.country);
    t.latitude = coords.latitude;
    t.longitude = coords.longitude;
    await new Promise(resolve => setTimeout(resolve, 1000)); // Rate limit
  }

  // Merge with existing data
  const allTournaments = [...tournaments];
  
  // Load existing if available
  if (fs.existsSync(csvPath)) {
    const existingData = fs.readFileSync(csvPath, 'utf-8');
    const lines = existingData.split('\n').slice(1);
    // Parse existing CSV and add to allTournaments
    // (Implementation depends on CSV parsing library or manual parsing)
  }

  // Sort by start date
  allTournaments.sort((a, b) => new Date(a.start_date) - new Date(b.start_date));

  // Write CSV
  const headers = Object.keys(allTournaments[0]).join(',');
  const rows = allTournaments.map(t => {
    return Object.values(t).map(v => {
      if (v === null) return '';
      if (typeof v === 'string' && (v.includes(',') || v.includes('"'))) {
        return `"${v.replace(/"/g, '""')}"`;
      }
      return v;
    }).join(',');
  });

  const csv = [headers, ...rows].join('\n');
  
  // Save files
  const dataDir = path.join(__dirname, '..', 'data');
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);
  
  fs.writeFileSync(path.join(dataDir, 'tournaments.csv'), csv);
  fs.writeFileSync(path.join(dataDir, 'tournaments.json'), JSON.stringify(allTournaments, null, 2));
  fs.writeFileSync(path.join(dataDir, 'last-updated.json'), JSON.stringify({
    lastUpdated: new Date().toISOString(),
    totalTournaments: allTournaments.length,
    newTournaments: tournaments.length
  }, null, 2));

  console.log(`\n✅ Scraping complete! Added ${tournaments.length} new tournaments.`);
}

scrapeToCSV();
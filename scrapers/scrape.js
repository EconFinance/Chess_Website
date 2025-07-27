// scraper/scrape.js

const axios = require('axios');
const cheerio = require('cheerio');
const dayjs = require('dayjs');
const pool = require('../db/db');

const BASE_URL = 'https://chess-calendar.eu/index.php?page=';
const START_YEAR = 2025;
const END_YEAR = 2028;

(async () => {
  let totalImported = 0;

  for (let year = START_YEAR; year <= END_YEAR; year++) {
    for (let month = 1; month <= 12; month++) {
      const page = `${year}-${month}`;
      const url = `${BASE_URL}${page}&all_new=`;
      console.log(`📅 Scraping ${page}...`);

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

          if (startDate && dayjs(endDate).isAfter(dayjs().subtract(1, 'day'))) {
            tournaments.push({
              name,
              startDate,
              endDate,
              country,
              location,
              city: location || null,
              sourceUrl
            });
          }
        });

        for (const t of tournaments) {
          try {
            await pool.query(
              `INSERT INTO tournaments (
                name, tournament_type, start_date, end_date,
                country, location, city, source_url
              ) VALUES (
                $1, 'classical', $2, $3,
                $4, $5, $6, $7
              )
              ON CONFLICT (name, start_date) DO NOTHING`,
              [
                t.name,
                t.startDate,
                t.endDate,
                t.country,
                t.location,
                t.city,
                t.sourceUrl
              ]
            );
            totalImported++;
          } catch (dbErr) {
            console.error('❌ DB Insert Error:', dbErr.message);
          }
        }

        console.log(`🔎 Found ${tournaments.length} upcoming tournaments`);
      } catch (err) {
        console.error(`❌ Failed to scrape ${page}:`, err.message);
      }
    }
  }

  console.log(`✅ Total tournaments imported: ${totalImported}`);
  await pool.end();
})();

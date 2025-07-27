// scrapers/run-scraper.js
const ChessCalendarScraper = require('./chess-calendar-scraper');
const ChessCalendarPlaywrightScraper = require('./chess-calendar-playwright');

async function runScraper() {
  console.log('Chess Tournament Scraper');
  console.log('=======================\n');
  
  const args = process.argv.slice(2);
  const scraperType = args[0] || 'cheerio';
  const mode = args[1] || 'single';
  const maxPages = parseInt(args[2]) || 5;
  
  console.log(`Configuration:`);
  console.log(`  Scraper: ${scraperType}`);
  console.log(`  Mode: ${mode}`);
  if (mode === 'paginated') {
    console.log(`  Max pages: ${maxPages}`);
  }
  console.log('');
  
  try {
    if (scraperType === 'playwright') {
      console.log('Using Playwright scraper (handles dynamic content better)...\n');
      const scraper = new ChessCalendarPlaywrightScraper();
      
      if (mode === 'paginated') {
        await scraper.scrapeWithPagination(maxPages);
      } else {
        await scraper.scrape();
      }
    } else {
      console.log('Using Cheerio scraper (faster but may miss dynamic content)...\n');
      const scraper = new ChessCalendarScraper();
      
      if (mode === 'paginated') {
        await scraper.scrapeAllPages(maxPages);
      } else {
        await scraper.scrape();
      }
    }
    
    console.log('\n✅ Scraping completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Scraping failed:', error);
    process.exit(1);
  }
}

// Run the scraper
runScraper();

/* 
USAGE:
  node scrapers/run-scraper.js [scraper-type] [mode] [max-pages]
  
  scraper-type: 'cheerio' or 'playwright' (default: cheerio)
  mode: 'single' or 'paginated' (default: single)
  max-pages: number (default: 5, only used in paginated mode)
  
EXAMPLES:
  # Run basic Cheerio scraper
  node scrapers/run-scraper.js
  
  # Run Playwright scraper
  node scrapers/run-scraper.js playwright
  
  # Run Cheerio scraper with pagination (5 pages)
  node scrapers/run-scraper.js cheerio paginated
  
  # Run Playwright scraper with pagination (10 pages)
  node scrapers/run-scraper.js playwright paginated 10
*/
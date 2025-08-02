# Chess Website

# Chess Tournament Finder 🌍♟️

A web application that displays over-the-board (OTB) chess tournaments worldwide on an interactive map, helping players discover and filter tournaments based on their preferences.

![Chess Tournament Finder](https://img.shields.io/badge/Chess-Tournament%20Finder-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Node](https://img.shields.io/badge/node-%3E%3D14.0.0-brightgreen)

## 🎯 Overview

Chess Tournament Finder is a comprehensive platform that aggregates chess tournaments from around the world and presents them on an interactive map interface. The project includes automated scrapers to collect tournament data and a responsive web interface with advanced filtering capabilities.

### Key Features

- 🗺️ **Interactive World Map**: Visual representation of tournaments with clustered markers
- 🔍 **Advanced Filtering**: Filter by tournament type, location, date range, and rating requirements
- 🌙 **Dark Theme UI**: Modern, eye-friendly interface
- 📱 **Mobile Responsive**: Works seamlessly across all devices
- 🔄 **Automated Data Collection**: Web scrapers to keep tournament data up-to-date
- 📊 **Real-time Statistics**: Display of active tournament counts

## 🛠️ Tech Stack

- **Frontend**: HTML5, CSS3, JavaScript (Vanilla)
- **Maps**: Leaflet.js with MarkerCluster
- **Backend**: Node.js, Express.js
- **Database**: CSV File
- **Scraping**: Cheerio, Axios
- **Geocoding**: OpenStreetMap Nominatim API

## 📁 Project Structure

```
chess-tournament-platform/
├── index.html              # Main web interface
├── data/                   # Tournament data directory
│   ├── tournaments.json    # Tournament data in JSON format
│   ├── tournaments.csv     # Tournament data in CSV format
│   └── last-updated.json   # Metadata about last update
├── scrapers/               # Web scraping scripts
│   ├── scrape-to-csv.js    # Scraper that outputs to CSV/JSON
│   └── scrape-with-geocoding.js  # Scraper with geocoding support
├── scripts/                # Utility scripts
│   └── export-to-csv.js    # Export database to CSV
├── package.json            # Node.js dependencies
└── README.md              # This file
```

## 🚀 Getting Started

### Prerequisites

- Node.js (v14.0.0 or higher)
- Python 3 (for local development server)

### Running the Application
1. **Start the web server**
   ```bash
   python -m http.server 8000
   ```

2. **Open in browser**
   ```
   http://localhost:8000
   ```


## 📊 Data Sources

The application scrapes tournament data from:
- [Chess Calendar EU](https://chess-calendar.eu) - Primary source for European tournaments

Data includes:
- Tournament name and type (Classical, Rapid, Blitz)
- Dates and location details
- Entry fees and prize funds
- Organizer information
- Geographic coordinates

## 🔧 Available Scripts

- `npm run update-data` - Scrape latest tournament data and save to JSON/CSV
- `npm run serve` - Start a simple HTTP server for development

## 🗺️ Features in Detail

### Map Interface
- **Marker Clustering**: Groups nearby tournaments for better visualization
- **Custom Icons**: Different chess piece icons for tournament types
- **Popup Information**: Detailed tournament info on marker click

### Filtering Options
- **Tournament Type**: Classical, Rapid, or Blitz
- **Geographic**: Country and city filters
- **Date Range**: Find tournaments within specific dates
- **Rating Range**: Filter by minimum/maximum rating requirements
- **Search**: Free text search for tournament names

### Data Management
- **Automatic Geocoding**: Converts addresses to coordinates
- **Duplicate Detection**: Prevents duplicate tournament entries
- **Rate Limiting**: Respects API limits for geocoding services


- Email: your.email@example.com

---

Made with ♟️ by the chess community, for the chess community.

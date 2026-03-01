# Weather App (React + Vite)

A simple, clean weather app that uses **Open-Meteo** (no API key required).

## Features
- City search with multiple match selection
- "Use my location" button (browser geolocation)
- Current conditions + 5-day forecast
- °F / °C toggle

## Run locally
1) Install Node.js (v18+ recommended)
2) In this folder:

```bash
npm install
npm run dev
```

Then open the URL Vite prints (usually http://localhost:5173).

## Build
```bash
npm run build
npm run preview
```

## Notes
- Weather codes are WMO codes as used by Open-Meteo.
- Some locations may not have precipitation probability; the UI hides it when missing.

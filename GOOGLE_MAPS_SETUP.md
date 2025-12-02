# Google Maps API Setup Guide

## API Key
**Your API Key:** `AIzaSyBPkkXZWll0VifG5kb0DDSsoV5UB-n5pFE`

## Required APIs to Enable

### 1. Maps JavaScript API
**Direct Link:** https://console.cloud.google.com/apis/library/maps-javascript-api.googleapis.com
- **Purpose:** Displays the interactive map
- **Status:** Must be enabled

### 2. Places API
**Direct Link:** https://console.cloud.google.com/apis/library/places-backend.googleapis.com
- **Purpose:** Address autocomplete/search functionality
- **Status:** Must be enabled

### 3. Geocoding API
**Direct Link:** https://console.cloud.google.com/apis/library/geocoding-backend.googleapis.com
- **Purpose:** Converts addresses to coordinates (lat/lng)
- **Status:** Must be enabled

## Step-by-Step Instructions

1. **Go to Google Cloud Console**
   - Visit: https://console.cloud.google.com/
   - Make sure you're in the correct project (the one with your API key)

2. **Enable Maps JavaScript API**
   - Click the link above or search "Maps JavaScript API"
   - Click "ENABLE" button
   - Wait for it to enable (usually instant)

3. **Enable Places API**
   - Click the link above or search "Places API"
   - Click "ENABLE" button
   - Wait for it to enable

4. **Enable Geocoding API**
   - Click the link above or search "Geocoding API"
   - Click "ENABLE" button
   - Wait for it to enable

5. **Verify API Key**
   - Go to: https://console.cloud.google.com/apis/credentials
   - Find your API key: `AIzaSyBPkkXZWll0VifG5kb0DDSsoV5UB-n5pFE`
   - Click on it to edit
   - Under "API restrictions", make sure these 3 APIs are allowed:
     - ✅ Maps JavaScript API
     - ✅ Places API
     - ✅ Geocoding API

6. **Test**
   - Refresh your browser (hard refresh: Ctrl+Shift+R or Cmd+Shift+R)
   - Navigate to Territory View
   - The map should now load correctly

## Troubleshooting

### If APIs are enabled but still getting errors:
1. **Wait 5-10 minutes** - API enablement can take a few minutes to propagate
2. **Check billing** - Google Maps APIs require billing to be enabled
3. **Check API key restrictions** - Make sure localhost is allowed if testing locally:
   - Application restrictions: HTTP referrers
   - Add: `http://localhost:*/*` and `http://127.0.0.1:*/*`

### Billing Note
Google Maps APIs require a billing account, but they offer:
- $200 free credit per month
- Maps JavaScript API: Free up to 28,000 loads/month
- Geocoding API: Free up to 40,000 requests/month
- Places API: Pay-as-you-go pricing

## Current Usage in Code

The API key is used in:
- `src/components/distributor/TerritoryMapView.jsx` - Main map component
- Libraries loaded: `["places"]` for autocomplete


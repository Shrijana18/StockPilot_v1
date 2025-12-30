/**
 * Cloud Function: fetchIndiaLocationData
 * Fetches Indian administrative data (States, Districts, Cities) from external sources
 * This avoids CORS and CSP issues by fetching server-side
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const axios = require('axios');
const { logger } = require('firebase-functions');

// Primary data source: GitHub JSON (reliable, free, no API key needed)
const GITHUB_STATES_DISTRICTS_URL = 'https://raw.githubusercontent.com/sab99r/Indian-States-And-Districts/master/states-and-districts.json';

// Cache in memory (Cloud Functions instances persist for a short time)
const cache = {
  states: null,
  districts: new Map(),
  cities: new Map(),
  cacheTime: new Map(),
  CACHE_DURATION: 6 * 60 * 60 * 1000, // 6 hours
};

/**
 * Generate state code from state name
 * Uses official ISO codes and ensures uniqueness
 */
function generateStateCode(stateName) {
  const originalName = stateName.trim();
  const upperName = originalName.toUpperCase();
  
  // Official ISO 3166-2:IN state codes mapped by exact name (with UT/NCT suffixes)
  // This ensures uniqueness and handles the exact names from the JSON
  const exactCodeMap = {
    'ANDHRA PRADESH': 'AP',
    'ARUNACHAL PRADESH': 'AR',
    'ASSAM': 'AS',
    'BIHAR': 'BR',
    'CHANDIGARH (UT)': 'CH',
    'CHHATTISGARH': 'CG', // Official code is CG, not CH (Chandigarh uses CH)
    'DADRA AND NAGAR HAVELI (UT)': 'DN',
    'DAMAN AND DIU (UT)': 'DD', // Separate from Dadra and Nagar Haveli
    'DELHI (NCT)': 'DL',
    'GOA': 'GA',
    'GUJARAT': 'GJ',
    'HARYANA': 'HR',
    'HIMACHAL PRADESH': 'HP',
    'JHARKHAND': 'JH',
    'KARNATAKA': 'KA',
    'KERALA': 'KL',
    'LAKSHADWEEP (UT)': 'LD',
    'MADHYA PRADESH': 'MP',
    'MAHARASHTRA': 'MH',
    'MANIPUR': 'MN',
    'MEGHALAYA': 'ML',
    'MIZORAM': 'MZ',
    'NAGALAND': 'NL',
    'ODISHA': 'OR',
    'PUDUCHERRY (UT)': 'PY',
    'PUNJAB': 'PB',
    'RAJASTHAN': 'RJ',
    'SIKKIM': 'SK',
    'TAMIL NADU': 'TN',
    'TELANGANA': 'TG',
    'TRIPURA': 'TR',
    'UTTAR PRADESH': 'UP',
    'UTTARAKHAND': 'UT',
    'WEST BENGAL': 'WB',
    'JAMMU AND KASHMIR': 'JK',
    'LADAKH': 'LA',
    'ANDAMAN AND NICOBAR ISLANDS': 'AN',
  };
  
  // Try exact match first (handles names with (UT), (NCT) suffixes)
  if (exactCodeMap[upperName]) {
    return exactCodeMap[upperName];
  }
  
  // Clean name for fallback matching (remove parenthetical content)
  const cleanName = upperName.replace(/\s*\([^)]*\)\s*/g, '').replace(/\s+/g, '');
  
  // Map of clean names (without UT/NCT) for fallback
  const cleanCodeMap = {
    'ANDHRAPRADESH': 'AP',
    'ARUNACHALPRADESH': 'AR',
    'ASSAM': 'AS',
    'BIHAR': 'BR',
    'CHANDIGARH': 'CH',
    'CHHATTISGARH': 'CG',
    'DADRAANDNAGARHAVELI': 'DN',
    'DAMANDDIU': 'DD',
    'DELHI': 'DL',
    'GOA': 'GA',
    'GUJARAT': 'GJ',
    'HARYANA': 'HR',
    'HIMACHALPRADESH': 'HP',
    'JHARKHAND': 'JH',
    'KARNATAKA': 'KA',
    'KERALA': 'KL',
    'LAKSHADWEEP': 'LD',
    'MADHYAPRADESH': 'MP',
    'MAHARASHTRA': 'MH',
    'MANIPUR': 'MN',
    'MEGHALAYA': 'ML',
    'MIZORAM': 'MZ',
    'NAGALAND': 'NL',
    'ODISHA': 'OR',
    'PUDUCHERRY': 'PY',
    'PUNJAB': 'PB',
    'RAJASTHAN': 'RJ',
    'SIKKIM': 'SK',
    'TAMILNADU': 'TN',
    'TELANGANA': 'TG',
    'TRIPURA': 'TR',
    'UTTARPRADESH': 'UP',
    'UTTARAKHAND': 'UT',
    'WESTBENGAL': 'WB',
    'JAMMUANDKASHMIR': 'JK',
    'LADAKH': 'LA',
    'ANDAMANANDNICOBARISLANDS': 'AN',
  };
  
  // Try clean name match
  if (cleanCodeMap[cleanName]) {
    return cleanCodeMap[cleanName];
  }
  
  // Last resort: use first 2 characters (shouldn't happen with proper mapping)
  logger.warn(`No mapping found for state: ${originalName}, using fallback`);
  return cleanName.substring(0, 2);
}

/**
 * Check if cache is valid
 */
function isCacheValid(key) {
  const cachedTime = cache.cacheTime.get(key);
  if (!cachedTime) return false;
  return Date.now() - cachedTime < cache.CACHE_DURATION;
}

/**
 * Fetch states from GitHub JSON
 */
async function fetchStatesFromAPI() {
  try {
    const response = await axios.get(GITHUB_STATES_DISTRICTS_URL, {
      timeout: 10000,
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.data || typeof response.data !== 'object') {
      throw new Error('Invalid data format from API');
    }

    const data = response.data;
    const states = [];

    // GitHub JSON structure: { states: [{ state: "Name", districts: [...] }, ...] }
    if (data.states && Array.isArray(data.states)) {
      const seenCodes = new Set(); // Track codes to ensure uniqueness
      
      data.states.forEach(stateObj => {
        if (stateObj && stateObj.state) {
          const stateName = stateObj.state;
          let stateCode = generateStateCode(stateName);
          
          // Ensure code uniqueness by appending index if duplicate found
          let uniqueCode = stateCode;
          let counter = 1;
          while (seenCodes.has(uniqueCode)) {
            logger.warn(`Duplicate state code ${uniqueCode} for ${stateName}, using fallback`);
            uniqueCode = `${stateCode}${counter}`;
            counter++;
          }
          seenCodes.add(uniqueCode);
          
          states.push({
            id: uniqueCode,
            name: stateName,
            code: uniqueCode,
          });
        }
      });
    }

    // Sort alphabetically
    states.sort((a, b) => a.name.localeCompare(b.name));

    return states;
  } catch (error) {
    logger.error('Error fetching states from API:', error);
    throw new HttpsError('internal', `Failed to fetch states: ${error.message}`);
  }
}

/**
 * Fetch districts for a state from GitHub JSON
 */
async function fetchDistrictsFromAPI(stateId) {
  try {
    const response = await axios.get(GITHUB_STATES_DISTRICTS_URL, {
      timeout: 10000,
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.data || typeof response.data !== 'object') {
      throw new Error('Invalid data format from API');
    }

    const data = response.data;
    const districts = [];

    // GitHub JSON structure: { states: [{ state: "Name", districts: [...] }, ...] }
    if (data.states && Array.isArray(data.states)) {
      // Find state by code or name
      const stateEntry = data.states.find(stateObj => {
        if (!stateObj || !stateObj.state) return false;
        const stateCode = generateStateCode(stateObj.state);
        return stateCode.toUpperCase() === stateId.toUpperCase();
      });

      if (stateEntry && stateEntry.state && Array.isArray(stateEntry.districts)) {
        stateEntry.districts.forEach(districtName => {
          districts.push({
            id: `${stateId.toUpperCase()}_${districtName.toUpperCase().replace(/\s+/g, '_').replace(/[^A-Z0-9_]/g, '').substring(0, 10)}`,
            name: districtName,
            state: stateEntry.state,
            stateId: stateId.toUpperCase(),
          });
        });
      }
    }

    return districts;
  } catch (error) {
    logger.error(`Error fetching districts for state ${stateId}:`, error);
    throw new HttpsError('internal', `Failed to fetch districts: ${error.message}`);
  }
}

/**
 * Main Cloud Function handler
 */
const fetchIndiaLocationDataHandler = onCall(
  {
    region: 'us-central1', // Match other functions
    cors: true,
  },
  async (request) => {
    try {
      const { type, stateId, districtId } = request.data || {};

      // Validate request type
      if (!type || !['states', 'districts', 'cities'].includes(type)) {
        throw new HttpsError('invalid-argument', 'Invalid type. Must be "states", "districts", or "cities"');
      }

      // Fetch states
      if (type === 'states') {
        // Check cache
        if (cache.states && isCacheValid('states')) {
          logger.info('Returning cached states');
          return { success: true, data: cache.states };
        }

        const states = await fetchStatesFromAPI();
        cache.states = states;
        cache.cacheTime.set('states', Date.now());
        return { success: true, data: states };
      }

      // Fetch districts
      if (type === 'districts') {
        if (!stateId) {
          throw new HttpsError('invalid-argument', 'stateId is required for districts');
        }

        // Check cache
        const cacheKey = `districts_${stateId}`;
        if (cache.districts.has(stateId) && isCacheValid(cacheKey)) {
          logger.info(`Returning cached districts for state ${stateId}`);
          return { success: true, data: cache.districts.get(stateId) };
        }

        const districts = await fetchDistrictsFromAPI(stateId);
        cache.districts.set(stateId, districts);
        cache.cacheTime.set(cacheKey, Date.now());
        return { success: true, data: districts };
      }

      // Fetch cities (currently returns empty array as free sources don't provide cities)
      if (type === 'cities') {
        if (!districtId || !stateId) {
          throw new HttpsError('invalid-argument', 'districtId and stateId are required for cities');
        }

        // Check cache
        const cacheKey = `cities_${districtId}`;
        if (cache.cities.has(districtId) && isCacheValid(cacheKey)) {
          logger.info(`Returning cached cities for district ${districtId}`);
          return { success: true, data: cache.cities.get(districtId) };
        }

        // Free sources don't reliably provide cities data
        // Return empty array - can be extended with paid API later
        const cities = [];
        cache.cities.set(districtId, cities);
        cache.cacheTime.set(cacheKey, Date.now());
        return { success: true, data: cities };
      }

    } catch (error) {
      logger.error('Error in fetchIndiaLocationData:', error);
      if (error instanceof HttpsError) {
        throw error;
      }
      throw new HttpsError('internal', `Failed to fetch location data: ${error.message}`);
    }
  }
);

module.exports = fetchIndiaLocationDataHandler;


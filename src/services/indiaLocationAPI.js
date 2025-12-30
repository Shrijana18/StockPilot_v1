/**
 * India Location API Service
 * Fetches Indian administrative data (States, Districts, Cities) from Cloud Function
 * Uses external API via server-side proxy (no CORS issues, always up-to-date)
 */

import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase/firebaseConfig';

// Cloud Function reference
const fetchIndiaLocationDataFn = httpsCallable(functions, 'fetchIndiaLocationData');

// Client-side cache to reduce function calls
const cache = {
  states: null,
  districts: new Map(), // stateId -> districts[]
  cities: new Map(), // districtId -> cities[]
  cacheTime: new Map(), // key -> timestamp
  CACHE_DURATION: 6 * 60 * 60 * 1000, // 6 hours (matches server cache)
};

/**
 * Check if cached data is still valid
 */
const isCacheValid = (key) => {
  const cachedTime = cache.cacheTime.get(key);
  if (!cachedTime) return false;
  return Date.now() - cachedTime < cache.CACHE_DURATION;
};

/**
 * Fetch all Indian states from Cloud Function
 */
export const fetchStates = async () => {
  // Check cache first
  if (cache.states && isCacheValid('states')) {
    return cache.states;
  }

  try {
    const result = await fetchIndiaLocationDataFn({ type: 'states' });
    
    // Validate response structure
    if (!result?.data?.success || !Array.isArray(result?.data?.data)) {
      console.error('Invalid response structure:', result?.data);
      throw new Error('Invalid response from Cloud Function');
    }
    
    const states = result.data.data;
    
    // Validate state objects have required fields
    const validStates = states.filter(state => state && state.id && state.name);
    if (validStates.length === 0) {
      console.error('No valid states in response:', states);
      throw new Error('No valid states found in response');
    }
    
    // Update cache
    cache.states = validStates;
    cache.cacheTime.set('states', Date.now());
    
    return validStates;
  } catch (error) {
    console.error('Error fetching states:', error);
    // Return empty array on error instead of throwing, to prevent UI crash
    return [];
  }
};

/**
 * Fetch districts for a specific state from Cloud Function
 */
export const fetchDistricts = async (stateId) => {
  if (!stateId) return [];

  // Check cache first
  const cacheKey = `districts_${stateId}`;
  if (cache.districts.has(stateId) && isCacheValid(cacheKey)) {
    return cache.districts.get(stateId);
  }

  try {
    const result = await fetchIndiaLocationDataFn({ 
      type: 'districts', 
      stateId 
    });
    
    // Validate response structure
    if (!result?.data?.success || !Array.isArray(result?.data?.data)) {
      console.error('Invalid response structure for districts:', result?.data);
      return [];
    }
    
    const districts = result.data.data;
    
    // Ensure districts have stateId field for consistency and validate required fields
    const districtsWithStateId = districts
      .filter(district => district && district.id && district.name)
      .map(district => ({
        ...district,
        stateId: stateId.toUpperCase(),
      }));
    
    // Update cache
    if (districtsWithStateId.length > 0) {
      cache.districts.set(stateId, districtsWithStateId);
      cache.cacheTime.set(cacheKey, Date.now());
    }
    
    return districtsWithStateId;
  } catch (error) {
    console.error(`Error fetching districts for state ${stateId}:`, error);
    return [];
  }
};

/**
 * Fetch cities/talukas for a specific district from Cloud Function
 * Note: Currently returns empty array as free sources don't provide cities data
 */
export const fetchCities = async (districtId, stateId) => {
  if (!districtId || !stateId) return [];

  // Check cache first
  const cacheKey = `cities_${districtId}`;
  if (cache.cities.has(districtId) && isCacheValid(cacheKey)) {
    return cache.cities.get(districtId);
  }

  try {
    const result = await fetchIndiaLocationDataFn({ 
      type: 'cities', 
      districtId, 
      stateId 
    });
    const cities = result?.data?.data || [];
    
    // Update cache
    cache.cities.set(districtId, cities);
    cache.cacheTime.set(cacheKey, Date.now());
    
    return cities;
  } catch (error) {
    console.error(`Error fetching cities for district ${districtId}:`, error);
    return [];
  }
};

/**
 * Fetch districts for multiple states
 */
export const fetchDistrictsForStates = async (stateIds) => {
  if (!Array.isArray(stateIds) || stateIds.length === 0) return [];

  const allDistricts = [];
  for (const stateId of stateIds) {
    const districts = await fetchDistricts(stateId);
    allDistricts.push(...districts);
  }
  return allDistricts;
};

/**
 * Fetch cities for multiple districts
 */
export const fetchCitiesForDistricts = async (districtIds, stateIds) => {
  if (!Array.isArray(districtIds) || districtIds.length === 0) return [];
  
  // If stateIds is a string (single state), convert to array
  const stateIdsArray = Array.isArray(stateIds) ? stateIds : (stateIds ? [stateIds] : []);

  const allCities = [];
  for (const districtId of districtIds) {
    // Find the state ID for this district if we have state info
    // For now, use the first state ID if provided, or try to infer from districts
    const stateId = stateIdsArray.length > 0 ? stateIdsArray[0] : null;
    const cities = await fetchCities(districtId, stateId);
    allCities.push(...cities);
  }
  return allCities;
};

/**
 * Clear cache (useful for testing or forcing refresh)
 */
export const clearCache = () => {
  cache.states = null;
  cache.districts.clear();
  cache.cities.clear();
  cache.cacheTime.clear();
};


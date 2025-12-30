// Indian Administrative Hierarchy Data
// This provides real data for states, districts, talukas, and villages

export const INDIAN_STATES = [
  { id: 'MH', name: 'Maharashtra', code: 'MH' },
  { id: 'GJ', name: 'Gujarat', code: 'GJ' },
  { id: 'KA', name: 'Karnataka', code: 'KA' },
  { id: 'TN', name: 'Tamil Nadu', code: 'TN' },
  { id: 'UP', name: 'Uttar Pradesh', code: 'UP' },
  { id: 'MP', name: 'Madhya Pradesh', code: 'MP' },
  { id: 'RJ', name: 'Rajasthan', code: 'RJ' },
  { id: 'WB', name: 'West Bengal', code: 'WB' },
  { id: 'BR', name: 'Bihar', code: 'BR' },
  { id: 'AP', name: 'Andhra Pradesh', code: 'AP' },
  { id: 'TG', name: 'Telangana', code: 'TG' },
  { id: 'OR', name: 'Odisha', code: 'OR' },
  { id: 'KL', name: 'Kerala', code: 'KL' },
  { id: 'JH', name: 'Jharkhand', code: 'JH' },
  { id: 'AS', name: 'Assam', code: 'AS' },
  { id: 'PB', name: 'Punjab', code: 'PB' },
  { id: 'HR', name: 'Haryana', code: 'HR' },
  { id: 'DL', name: 'Delhi', code: 'DL' },
  { id: 'JK', name: 'Jammu and Kashmir', code: 'JK' },
  { id: 'UT', name: 'Uttarakhand', code: 'UT' },
  { id: 'HP', name: 'Himachal Pradesh', code: 'HP' },
  { id: 'TR', name: 'Tripura', code: 'TR' },
  { id: 'MN', name: 'Manipur', code: 'MN' },
  { id: 'ML', name: 'Meghalaya', code: 'ML' },
  { id: 'NL', name: 'Nagaland', code: 'NL' },
  { id: 'MZ', name: 'Mizoram', code: 'MZ' },
  { id: 'AR', name: 'Arunachal Pradesh', code: 'AR' },
  { id: 'SK', name: 'Sikkim', code: 'SK' },
  { id: 'GA', name: 'Goa', code: 'GA' },
  { id: 'CH', name: 'Chhattisgarh', code: 'CH' },
];

// Districts by State
export const DISTRICTS_BY_STATE = {
  'MH': [ // Maharashtra
    { id: 'MUM', name: 'Mumbai', state: 'Maharashtra' },
    { id: 'PUN', name: 'Pune', state: 'Maharashtra' },
    { id: 'NAS', name: 'Nashik', state: 'Maharashtra' },
    { id: 'NAG', name: 'Nagpur', state: 'Maharashtra' },
    { id: 'AUR', name: 'Aurangabad', state: 'Maharashtra' },
    { id: 'THA', name: 'Thane', state: 'Maharashtra' },
    { id: 'SOL', name: 'Solapur', state: 'Maharashtra' },
    { id: 'KOL', name: 'Kolhapur', state: 'Maharashtra' },
    { id: 'SAG', name: 'Sangli', state: 'Maharashtra' },
    { id: 'AHM', name: 'Ahmednagar', state: 'Maharashtra' },
    { id: 'JAL', name: 'Jalgaon', state: 'Maharashtra' },
    { id: 'DHU', name: 'Dhule', state: 'Maharashtra' },
    { id: 'NAN', name: 'Nanded', state: 'Maharashtra' },
    { id: 'LAT', name: 'Latur', state: 'Maharashtra' },
    { id: 'OSM', name: 'Osmanabad', state: 'Maharashtra' },
    { id: 'BEED', name: 'Beed', state: 'Maharashtra' },
    { id: 'PAR', name: 'Parbhani', state: 'Maharashtra' },
    { id: 'HIN', name: 'Hingoli', state: 'Maharashtra' },
    { id: 'WAS', name: 'Washim', state: 'Maharashtra' },
    { id: 'BUL', name: 'Buldhana', state: 'Maharashtra' },
    { id: 'AKO', name: 'Akola', state: 'Maharashtra' },
    { id: 'AMR', name: 'Amravati', state: 'Maharashtra' },
    { id: 'YAV', name: 'Yavatmal', state: 'Maharashtra' },
    { id: 'WAR', name: 'Wardha', state: 'Maharashtra' },
    { id: 'CHAN', name: 'Chandrapur', state: 'Maharashtra' },
    { id: 'GAD', name: 'Gadchiroli', state: 'Maharashtra' },
    { id: 'GON', name: 'Gondia', state: 'Maharashtra' },
    { id: 'BHAN', name: 'Bhandara', state: 'Maharashtra' },
    { id: 'RAI', name: 'Raigad', state: 'Maharashtra' },
    { id: 'RAT', name: 'Ratnagiri', state: 'Maharashtra' },
    { id: 'SIN', name: 'Sindhudurg', state: 'Maharashtra' },
    { id: 'SAT', name: 'Satara', state: 'Maharashtra' },
    { id: 'SAN', name: 'Sangli', state: 'Maharashtra' },
  ],
  'GJ': [ // Gujarat
    { id: 'AHM_GJ', name: 'Ahmedabad', state: 'Gujarat' },
    { id: 'SUR', name: 'Surat', state: 'Gujarat' },
    { id: 'VAD', name: 'Vadodara', state: 'Gujarat' },
    { id: 'RAJ', name: 'Rajkot', state: 'Gujarat' },
    { id: 'BHA', name: 'Bhavnagar', state: 'Gujarat' },
    { id: 'JAM', name: 'Jamnagar', state: 'Gujarat' },
    { id: 'GAND', name: 'Gandhinagar', state: 'Gujarat' },
    { id: 'ANAND', name: 'Anand', state: 'Gujarat' },
    { id: 'KACH', name: 'Kachchh', state: 'Gujarat' },
    { id: 'BAN', name: 'Banaskantha', state: 'Gujarat' },
    { id: 'PAT', name: 'Patan', state: 'Gujarat' },
    { id: 'MEH', name: 'Mehsana', state: 'Gujarat' },
    { id: 'SAB', name: 'Sabarkantha', state: 'Gujarat' },
    { id: 'ARA', name: 'Aravalli', state: 'Gujarat' },
    { id: 'MAH', name: 'Mahisagar', state: 'Gujarat' },
    { id: 'PAN', name: 'Panchmahal', state: 'Gujarat' },
    { id: 'DAH', name: 'Dahod', state: 'Gujarat' },
    { id: 'VALS', name: 'Valsad', state: 'Gujarat' },
    { id: 'NAVS', name: 'Navsari', state: 'Gujarat' },
    { id: 'DAN', name: 'Dang', state: 'Gujarat' },
    { id: 'TAP', name: 'Tapi', state: 'Gujarat' },
    { id: 'NAR', name: 'Narmada', state: 'Gujarat' },
    { id: 'CHH', name: 'Chhota Udaipur', state: 'Gujarat' },
    { id: 'BOT', name: 'Botad', state: 'Gujarat' },
    { id: 'AMR_GJ', name: 'Amreli', state: 'Gujarat' },
    { id: 'JUN', name: 'Junagadh', state: 'Gujarat' },
    { id: 'GIR', name: 'Gir Somnath', state: 'Gujarat' },
    { id: 'POR', name: 'Porbandar', state: 'Gujarat' },
    { id: 'DEV', name: 'Devbhumi Dwarka', state: 'Gujarat' },
    { id: 'MOR', name: 'Morbi', state: 'Gujarat' },
    { id: 'SURE', name: 'Surendranagar', state: 'Gujarat' },
  ],
  'MP': [ // Madhya Pradesh
    { id: 'IND', name: 'Indore', state: 'Madhya Pradesh' },
    { id: 'BHO', name: 'Bhopal', state: 'Madhya Pradesh' },
    { id: 'JAB', name: 'Jabalpur', state: 'Madhya Pradesh' },
    { id: 'GWAL', name: 'Gwalior', state: 'Madhya Pradesh' },
    { id: 'UJJ', name: 'Ujjain', state: 'Madhya Pradesh' },
    { id: 'SAG_MP', name: 'Sagar', state: 'Madhya Pradesh' },
    { id: 'RAT_MP', name: 'Ratlam', state: 'Madhya Pradesh' },
    { id: 'REW', name: 'Rewa', state: 'Madhya Pradesh' },
    { id: 'SAT_MP', name: 'Satna', state: 'Madhya Pradesh' },
    { id: 'SID', name: 'Sidhi', state: 'Madhya Pradesh' },
    { id: 'SIN_MP', name: 'Singrauli', state: 'Madhya Pradesh' },
    { id: 'SHA', name: 'Shahdol', state: 'Madhya Pradesh' },
    { id: 'ANU', name: 'Anuppur', state: 'Madhya Pradesh' },
    { id: 'UMR', name: 'Umaria', state: 'Madhya Pradesh' },
    { id: 'KAT', name: 'Katni', state: 'Madhya Pradesh' },
    { id: 'DAM', name: 'Damoh', state: 'Madhya Pradesh' },
    { id: 'PAN_MP', name: 'Panna', state: 'Madhya Pradesh' },
    { id: 'CHH_MP', name: 'Chhatarpur', state: 'Madhya Pradesh' },
    { id: 'TIK', name: 'Tikamgarh', state: 'Madhya Pradesh' },
    { id: 'NIW', name: 'Niwari', state: 'Madhya Pradesh' },
    { id: 'DAT', name: 'Datia', state: 'Madhya Pradesh' },
    { id: 'SHE', name: 'Sheopur', state: 'Madhya Pradesh' },
    { id: 'MOR_MP', name: 'Morena', state: 'Madhya Pradesh' },
    { id: 'BHI', name: 'Bhind', state: 'Madhya Pradesh' },
    { id: 'ASH', name: 'Ashoknagar', state: 'Madhya Pradesh' },
    { id: 'SHI', name: 'Shivpuri', state: 'Madhya Pradesh' },
    { id: 'GUN', name: 'Guna', state: 'Madhya Pradesh' },
    { id: 'RAJ_MP', name: 'Rajgarh', state: 'Madhya Pradesh' },
    { id: 'VID', name: 'Vidisha', state: 'Madhya Pradesh' },
    { id: 'SEH', name: 'Sehore', state: 'Madhya Pradesh' },
    { id: 'RAI_MP', name: 'Raisen', state: 'Madhya Pradesh' },
    { id: 'HOS', name: 'Hoshangabad', state: 'Madhya Pradesh' },
    { id: 'HAR', name: 'Harda', state: 'Madhya Pradesh' },
    { id: 'BET', name: 'Betul', state: 'Madhya Pradesh' },
    { id: 'BUR', name: 'Burhanpur', state: 'Madhya Pradesh' },
    { id: 'KHA', name: 'Khandwa', state: 'Madhya Pradesh' },
    { id: 'KHA_MP', name: 'Khargone', state: 'Madhya Pradesh' },
    { id: 'BAR', name: 'Barwani', state: 'Madhya Pradesh' },
    { id: 'ALI', name: 'Alirajpur', state: 'Madhya Pradesh' },
    { id: 'JHA', name: 'Jhabua', state: 'Madhya Pradesh' },
    { id: 'DHAR', name: 'Dhar', state: 'Madhya Pradesh' },
    { id: 'IND_MP', name: 'Indore', state: 'Madhya Pradesh' },
    { id: 'DEW', name: 'Dewas', state: 'Madhya Pradesh' },
    { id: 'SHA_MP', name: 'Shajapur', state: 'Madhya Pradesh' },
    { id: 'MAN', name: 'Mandsaur', state: 'Madhya Pradesh' },
    { id: 'NEE', name: 'Neemuch', state: 'Madhya Pradesh' },
    { id: 'MAL', name: 'Mandsaur', state: 'Madhya Pradesh' },
  ],
  'KA': [ // Karnataka
    { id: 'BAN_KA', name: 'Bangalore Urban', state: 'Karnataka' },
    { id: 'MYS', name: 'Mysore', state: 'Karnataka' },
    { id: 'HUB', name: 'Hubli', state: 'Karnataka' },
    { id: 'MAN_KA', name: 'Mangalore', state: 'Karnataka' },
    { id: 'BEL', name: 'Belagavi', state: 'Karnataka' },
    { id: 'GUL', name: 'Gulbarga', state: 'Karnataka' },
    { id: 'DAV', name: 'Davangere', state: 'Karnataka' },
    { id: 'SHI_KA', name: 'Shimoga', state: 'Karnataka' },
    { id: 'TUM', name: 'Tumkur', state: 'Karnataka' },
    { id: 'RAI_KA', name: 'Raichur', state: 'Karnataka' },
    { id: 'BID', name: 'Bidar', state: 'Karnataka' },
    { id: 'KOP', name: 'Koppal', state: 'Karnataka' },
    { id: 'GAD_KA', name: 'Gadag', state: 'Karnataka' },
    { id: 'BAG', name: 'Bagalkot', state: 'Karnataka' },
    { id: 'BIJ', name: 'Bijapur', state: 'Karnataka' },
    { id: 'KAL', name: 'Kalaburagi', state: 'Karnataka' },
    { id: 'YAD', name: 'Yadgir', state: 'Karnataka' },
    { id: 'BEL_KA', name: 'Bellary', state: 'Karnataka' },
    { id: 'KOP_KA', name: 'Koppal', state: 'Karnataka' },
    { id: 'RAI_KA2', name: 'Raichur', state: 'Karnataka' },
    { id: 'CHI', name: 'Chitradurga', state: 'Karnataka' },
    { id: 'DAV_KA', name: 'Davangere', state: 'Karnataka' },
    { id: 'CHI_KA', name: 'Chikkamagaluru', state: 'Karnataka' },
    { id: 'UDU', name: 'Udupi', state: 'Karnataka' },
    { id: 'DKS', name: 'Dakshina Kannada', state: 'Karnataka' },
    { id: 'UTT', name: 'Uttara Kannada', state: 'Karnataka' },
    { id: 'HAS', name: 'Hassan', state: 'Karnataka' },
    { id: 'CHAM', name: 'Chamarajanagar', state: 'Karnataka' },
    { id: 'MAN_KA2', name: 'Mandya', state: 'Karnataka' },
    { id: 'MYS_KA', name: 'Mysore', state: 'Karnataka' },
    { id: 'KOD', name: 'Kodagu', state: 'Karnataka' },
  ],
  // Add more states as needed
};

// Helper function to get districts for selected states
export const getDistrictsForStates = (stateIds) => {
  if (!stateIds || stateIds.length === 0) return [];
  return stateIds.flatMap(stateId => DISTRICTS_BY_STATE[stateId] || []);
};

// Helper function to search states
export const searchStates = (query) => {
  if (!query) return INDIAN_STATES;
  const lowerQuery = query.toLowerCase();
  return INDIAN_STATES.filter(state => 
    state.name.toLowerCase().includes(lowerQuery) ||
    state.code.toLowerCase().includes(lowerQuery)
  );
};

// Helper function to search districts
export const searchDistricts = (query, stateIds = []) => {
  const districts = stateIds.length > 0 
    ? getDistrictsForStates(stateIds)
    : Object.values(DISTRICTS_BY_STATE).flat();
  
  if (!query) return districts;
  const lowerQuery = query.toLowerCase();
  return districts.filter(district => 
    district.name.toLowerCase().includes(lowerQuery) ||
    district.state.toLowerCase().includes(lowerQuery)
  );
};


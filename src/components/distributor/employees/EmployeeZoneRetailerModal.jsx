import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { doc, updateDoc, getDoc, collection, query, where, getDocs, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../firebase/firebaseConfig';
import { toast } from 'react-toastify';
import { FiX, FiMapPin, FiUsers, FiCheck, FiLoader } from 'react-icons/fi';
import { fetchStates, fetchDistricts, fetchCities, fetchDistrictsForStates, fetchCitiesForDistricts } from '../../../services/indiaLocationAPI';

const EmployeeZoneRetailerModal = ({ open, onClose, employee, distributorId }) => {
  const [loading, setLoading] = useState(false);
  const [retailers, setRetailers] = useState([]);
  const [loadingRetailers, setLoadingRetailers] = useState(true);
  const [states, setStates] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [cities, setCities] = useState([]);
  const [loadingStates, setLoadingStates] = useState(false);
  const [loadingDistricts, setLoadingDistricts] = useState(false);
  const [loadingCities, setLoadingCities] = useState(false);
  const [formData, setFormData] = useState({
    zones: [],
    territories: [],
    cities: [],
    assignedRetailers: []
  });

  // Reset form data when modal closes or employee changes
  useEffect(() => {
    if (!open) {
      // Reset when modal closes
      setFormData({
        zones: [],
        territories: [],
        cities: [],
        assignedRetailers: []
      });
      setStates([]);
      setDistricts([]);
      setCities([]);
      return;
    }
  }, [open]);

  // Load states when modal opens
  useEffect(() => {
    if (!open) return;
    
    const loadStates = async () => {
      setLoadingStates(true);
      try {
        const statesData = await fetchStates();
        setStates(statesData);
      } catch (error) {
        console.error('Error loading states:', error);
        toast.error('Failed to load states. Using fallback data.');
      } finally {
        setLoadingStates(false);
      }
    };

    loadStates();
  }, [open]);

  // Load districts when zones are selected
  useEffect(() => {
    if (!open || formData.zones.length === 0) {
      setDistricts([]);
      setCities([]);
      return;
    }

    const loadDistricts = async () => {
      setLoadingDistricts(true);
      try {
        const districtsData = await fetchDistrictsForStates(formData.zones);
        setDistricts(districtsData);
      } catch (error) {
        console.error('Error loading districts:', error);
        toast.error('Failed to load districts');
      } finally {
        setLoadingDistricts(false);
      }
    };

    loadDistricts();
  }, [open, formData.zones]);

  // Load cities when territories are selected
  useEffect(() => {
    if (!open || formData.territories.length === 0 || formData.zones.length === 0) {
      setCities([]);
      return;
    }

    const loadCities = async () => {
      setLoadingCities(true);
      try {
        // Get cities for all selected districts across all selected states
        const allCities = await fetchCitiesForDistricts(formData.territories, formData.zones);
        setCities(allCities);
      } catch (error) {
        console.error('Error loading cities:', error);
        toast.error('Failed to load cities');
      } finally {
        setLoadingCities(false);
      }
    };

    loadCities();
  }, [open, formData.territories, formData.zones]);

  // Load employee data and retailers when modal opens
  useEffect(() => {
    if (!open || !employee?.id || !distributorId) return;

    const loadEmployeeData = async () => {
      try {
        // Fetch fresh employee data from Firestore to ensure we have the latest state
        const employeeRef = doc(db, 'businesses', distributorId, 'distributorEmployees', employee.id);
        const employeeSnap = await getDoc(employeeRef);
        
        if (employeeSnap.exists()) {
          const employeeData = employeeSnap.data();
          // Initialize form data with fresh data from Firestore
          setFormData({
            zones: Array.isArray(employeeData.zones) ? [...employeeData.zones] : [],
            territories: Array.isArray(employeeData.territories) ? [...employeeData.territories] : [],
            cities: Array.isArray(employeeData.cities) ? [...employeeData.cities] : [],
            assignedRetailers: Array.isArray(employeeData.assignedRetailers) ? [...employeeData.assignedRetailers] : []
          });
        } else {
          // If employee doesn't exist, reset to empty
          setFormData({
            zones: [],
            territories: [],
            cities: [],
            assignedRetailers: []
          });
        }
      } catch (error) {
        console.error('Error loading employee data:', error);
        toast.error('Failed to load employee data');
        // Reset on error
        setFormData({
          zones: [],
          territories: [],
          cities: [],
          assignedRetailers: []
        });
      }
    };

    loadEmployeeData();
    loadRetailers();
  }, [open, employee?.id, distributorId]); // Use employee.id instead of entire employee object

  const loadRetailers = async () => {
    if (!distributorId) return;
    setLoadingRetailers(true);
    try {
      const retailersRef = collection(db, 'businesses', distributorId, 'connectedRetailers');
      const q = query(retailersRef, where('status', 'in', ['accepted', 'provisioned', 'provisioned-local']));
      const snapshot = await getDocs(q);
      const retailerList = snapshot.docs.map(doc => ({
        id: doc.data().retailerId || doc.id,
        name: doc.data().retailerName || 'Unnamed Retailer',
        city: doc.data().retailerCity || doc.data().city || '',
        state: doc.data().retailerState || doc.data().state || '',
      }));
      setRetailers(retailerList);
    } catch (error) {
      console.error('Error loading retailers:', error);
      toast.error('Failed to load retailers');
    } finally {
      setLoadingRetailers(false);
    }
  };

  const handleStateToggle = async (stateCode) => {
    setFormData(prev => {
      const isRemoving = prev.zones.includes(stateCode);
      const zones = isRemoving
        ? prev.zones.filter(z => z !== stateCode)
        : [...prev.zones, stateCode];
      
      // If removing a state, also remove territories and cities that belong to that state
      let territories = prev.territories;
      let cities = prev.cities;
      
      if (isRemoving) {
        // Get districts for the state being removed
        const stateDistricts = districts.filter(d => d.stateId === stateCode);
        const districtIdsToRemove = stateDistricts.map(d => d.id);
        territories = prev.territories.filter(t => !districtIdsToRemove.includes(t));
        
        // Remove cities that belong to removed districts
        const citiesToRemove = cities.filter(c => districtIdsToRemove.includes(c.districtId));
        const cityIdsToRemove = citiesToRemove.map(c => c.id);
        cities = prev.cities.filter(c => !cityIdsToRemove.includes(c));
      }
      
      return { ...prev, zones, territories, cities };
    });
  };

  const handleDistrictToggle = (districtId) => {
    setFormData(prev => {
      const isRemoving = prev.territories.includes(districtId);
      const territories = isRemoving
        ? prev.territories.filter(t => t !== districtId)
        : [...prev.territories, districtId];
      
      // If removing a district, also remove cities that belong to that district
      let cities = prev.cities;
      if (isRemoving) {
        cities = prev.cities.filter(c => c.districtId !== districtId);
      }
      
      return { ...prev, territories, cities };
    });
  };

  const handleCityToggle = (cityId) => {
    setFormData(prev => {
      const cities = prev.cities.includes(cityId)
        ? prev.cities.filter(c => c !== cityId)
        : [...prev.cities, cityId];
      return { ...prev, cities };
    });
  };

  const handleRetailerToggle = (retailerId) => {
    setFormData(prev => {
      const assignedRetailers = prev.assignedRetailers.includes(retailerId)
        ? prev.assignedRetailers.filter(r => r !== retailerId)
        : [...prev.assignedRetailers, retailerId];
      return { ...prev, assignedRetailers };
    });
  };

  const handleSave = async () => {
    if (!employee?.id || !distributorId) {
      toast.error('Employee ID or Distributor ID is missing');
      return;
    }

    // Validate we're updating the correct employee
    const employeeIdToUpdate = employee.id;
    if (!employeeIdToUpdate) {
      toast.error('Invalid employee ID');
      return;
    }

    setLoading(true);
    try {
      // Use the employee.id as document ID to ensure we update the correct employee
      const employeeRef = doc(db, 'businesses', distributorId, 'distributorEmployees', employeeIdToUpdate);
      
      // Verify the document exists and belongs to the correct employee
      const employeeSnap = await getDoc(employeeRef);
      if (!employeeSnap.exists()) {
        toast.error('Employee not found in database');
        setLoading(false);
        return;
      }

      // Clean up territories and cities: remove any that belong to unselected states/districts
      const selectedStateCodes = Array.isArray(formData.zones) ? formData.zones : [];
      const selectedDistrictIds = Array.isArray(formData.territories) ? formData.territories : [];
      
      // Filter territories to only include those from selected states
      const cleanedTerritories = selectedDistrictIds.filter(districtId => {
        const district = districts.find(d => d.id === districtId);
        return district && selectedStateCodes.includes(district.stateId);
      });

      // Filter cities to only include those from selected districts
      const cleanedCities = (Array.isArray(formData.cities) ? formData.cities : [])
        .filter(cityId => {
          const city = cities.find(c => c.id === cityId);
          return city && cleanedTerritories.includes(city.districtId);
        });

      // Prepare update data with cleaned arrays
      const updateData = {
        zones: selectedStateCodes,
        territories: cleanedTerritories,
        cities: cleanedCities,
        assignedRetailers: Array.isArray(formData.assignedRetailers) ? formData.assignedRetailers : [],
        updatedAt: serverTimestamp()
      };

      // Log for debugging (remove in production if needed)
      console.log(`Updating employee ${employeeIdToUpdate} with data:`, updateData);

      await updateDoc(employeeRef, updateData);
      
      toast.success('Zones, territories, and retailers updated successfully');
      
      // Close modal after successful save
      onClose();
    } catch (error) {
      console.error('Error updating employee:', error);
      console.error('Employee ID:', employeeIdToUpdate, 'Distributor ID:', distributorId);
      toast.error(`Failed to update employee: ${error.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  // Filter districts and cities based on selected states/territories
  const filteredDistricts = useMemo(() => {
    if (formData.zones.length === 0) return [];
    return districts.filter(d => formData.zones.includes(d.stateId));
  }, [districts, formData.zones]);

  const filteredCities = useMemo(() => {
    if (formData.territories.length === 0) return [];
    return cities.filter(c => formData.territories.includes(c.districtId));
  }, [cities, formData.territories]);

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
        
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-7xl max-h-[90vh] bg-gray-900/95 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl overflow-hidden flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-white/10">
            <div>
              <h2 className="text-2xl font-bold text-white">Assign Zones & Retailers</h2>
              <p className="text-sm text-gray-400 mt-1">{employee?.name || 'Employee'}</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
            >
              <FiX className="w-6 h-6" />
            </button>
          </div>

          {/* Content - Scrollable */}
          <div className="flex-1 overflow-y-auto p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Zones (States) */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-lg font-semibold text-white">
                  <FiMapPin className="w-5 h-5 text-emerald-400" />
                  Zones (States)
                </div>
                <div className="bg-white/5 rounded-xl p-4 border border-white/10 max-h-[400px] overflow-y-auto">
                  {loadingStates ? (
                    <div className="flex items-center justify-center py-8">
                      <FiLoader className="w-5 h-5 animate-spin text-emerald-400" />
                      <span className="text-sm text-gray-400 ml-2">Loading states...</span>
                    </div>
                  ) : states.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-4">No states available</p>
                  ) : (
                    states.map(state => (
                      <label
                        key={state.id}
                        className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={formData.zones.includes(state.id)}
                          onChange={() => handleStateToggle(state.id)}
                          className="w-4 h-4 accent-emerald-500"
                        />
                        <span className="text-sm text-gray-200">{state.name}</span>
                      </label>
                    ))
                  )}
                </div>
              </div>

              {/* Territories (Districts) */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-lg font-semibold text-white">
                  <FiMapPin className="w-5 h-5 text-blue-400" />
                  Territories (Districts)
                </div>
                <div className="bg-white/5 rounded-xl p-4 border border-white/10 max-h-[400px] overflow-y-auto">
                  {formData.zones.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-4">
                      Select zones first to see districts
                    </p>
                  ) : loadingDistricts ? (
                    <div className="flex items-center justify-center py-8">
                      <FiLoader className="w-5 h-5 animate-spin text-blue-400" />
                      <span className="text-sm text-gray-400 ml-2">Loading districts...</span>
                    </div>
                  ) : filteredDistricts.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-4">
                      No districts available for selected states
                    </p>
                  ) : (
                    filteredDistricts.map(district => (
                      <label
                        key={district.id}
                        className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={formData.territories.includes(district.id)}
                          onChange={() => handleDistrictToggle(district.id)}
                          className="w-4 h-4 accent-blue-500"
                        />
                        <div className="flex-1">
                          <span className="text-sm text-white">{district.name}</span>
                          <span className="text-xs text-gray-400 block">{district.state}</span>
                        </div>
                      </label>
                    ))
                  )}
                </div>
              </div>

              {/* Cities */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-lg font-semibold text-white">
                  <FiMapPin className="w-5 h-5 text-purple-400" />
                  Cities
                </div>
                <div className="bg-white/5 rounded-xl p-4 border border-white/10 max-h-[400px] overflow-y-auto">
                  {formData.territories.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-4">
                      Select territories first to see cities
                    </p>
                  ) : loadingCities ? (
                    <div className="flex items-center justify-center py-8">
                      <FiLoader className="w-5 h-5 animate-spin text-purple-400" />
                      <span className="text-sm text-gray-400 ml-2">Loading cities...</span>
                    </div>
                  ) : filteredCities.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-4">
                      No cities available for selected territories
                    </p>
                  ) : (
                    filteredCities.map(city => (
                      <label
                        key={city.id}
                        className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={formData.cities.includes(city.id)}
                          onChange={() => handleCityToggle(city.id)}
                          className="w-4 h-4 accent-purple-500"
                        />
                        <div className="flex-1">
                          <span className="text-sm text-white">{city.name}</span>
                          <span className="text-xs text-gray-400 block">{city.district}</span>
                        </div>
                      </label>
                    ))
                  )}
                </div>
              </div>

              {/* Assigned Retailers */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-lg font-semibold text-white">
                  <FiUsers className="w-5 h-5 text-purple-400" />
                  Assigned Retailers
                </div>
                <div className="bg-white/5 rounded-xl p-4 border border-white/10 max-h-[400px] overflow-y-auto">
                  {loadingRetailers ? (
                    <div className="text-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-400 mx-auto"></div>
                      <p className="text-sm text-gray-400 mt-2">Loading retailers...</p>
                    </div>
                  ) : retailers.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-4">
                      No retailers available
                    </p>
                  ) : (
                    retailers.map(retailer => (
                      <label
                        key={retailer.id}
                        className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={formData.assignedRetailers.includes(retailer.id)}
                          onChange={() => handleRetailerToggle(retailer.id)}
                          className="w-4 h-4 accent-purple-500"
                        />
                        <div className="flex-1">
                          <span className="text-sm text-white">{retailer.name}</span>
                          {(retailer.city || retailer.state) && (
                            <span className="text-xs text-gray-400 block">
                              {[retailer.city, retailer.state].filter(Boolean).join(', ')}
                            </span>
                          )}
                        </div>
                      </label>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-4 p-6 border-t border-white/10">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/15 border border-white/20 text-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={loading}
              className="flex items-center gap-2 px-6 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Saving...
                </>
              ) : (
                <>
                  <FiCheck className="w-4 h-4" />
                  Save Changes
                </>
              )}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default EmployeeZoneRetailerModal;


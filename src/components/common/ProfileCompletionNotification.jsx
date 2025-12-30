import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db, auth } from "../../firebase/firebaseConfig";
import { FaExclamationTriangle, FaCheckCircle, FaTimes, FaArrowRight, FaUser, FaBuilding, FaMapMarkerAlt, FaIdCard } from "react-icons/fa";

const ProfileCompletionNotification = ({ onDismiss }) => {
  const [profileData, setProfileData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState(false);
  const navigate = useNavigate();

  // Check if notification was dismissed in this session
  useEffect(() => {
    const dismissedTime = localStorage.getItem('profileNotificationDismissed');
    if (dismissedTime) {
      const dismissedDate = parseInt(dismissedTime, 10);
      const now = Date.now();
      // Show again after 24 hours
      if (now - dismissedDate < 24 * 60 * 60 * 1000) {
        setDismissed(true);
      } else {
        localStorage.removeItem('profileNotificationDismissed');
      }
    }
  }, []);

  useEffect(() => {
    const fetchProfile = async () => {
      const user = auth.currentUser;
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        const userRef = doc(db, "businesses", user.uid);
        const snapshot = await getDoc(userRef);
        if (snapshot.exists()) {
          setProfileData(snapshot.data());
        }
      } catch (error) {
        console.error("Error fetching profile:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, []);

  // Calculate missing fields
  const missingFields = useMemo(() => {
    if (!profileData) return [];
    
    const fields = [];
    
    if (!profileData.ownerName || !profileData.ownerName.trim()) {
      fields.push({ label: "Owner Name", icon: FaUser, section: "owner" });
    }
    if (!profileData.businessName || !profileData.businessName.trim()) {
      fields.push({ label: "Business Name", icon: FaBuilding, section: "business" });
    }
    if (!profileData.address || !profileData.address.trim()) {
      fields.push({ label: "Address", icon: FaMapMarkerAlt, section: "business" });
    }
    if (!profileData.city || !profileData.city.trim()) {
      fields.push({ label: "City", icon: FaMapMarkerAlt, section: "business" });
    }
    if (!profileData.state || !profileData.state.trim()) {
      fields.push({ label: "State", icon: FaMapMarkerAlt, section: "business" });
    }
    if (!profileData.pincode || !profileData.pincode.trim()) {
      fields.push({ label: "Pincode", icon: FaMapMarkerAlt, section: "business" });
    }
    if (!profileData.gstNumber || !profileData.gstNumber.trim()) {
      fields.push({ label: "GST Number", icon: FaIdCard, section: "tax" });
    }
    if (!profileData.flypId || !profileData.flypId.trim()) {
      fields.push({ label: "FLYP ID", icon: FaIdCard, section: "owner" });
    }
    
    return fields;
  }, [profileData]);

  // Check if profile is complete (all critical fields filled)
  const isComplete = missingFields.length === 0;
  const completionPercentage = useMemo(() => {
    if (!profileData) return 0;
    const totalFields = 8; // ownerName, businessName, address, city, state, pincode, gstNumber, flypId
    const completedFields = totalFields - missingFields.length;
    return Math.round((completedFields / totalFields) * 100);
  }, [profileData, missingFields]);

  // Don't show if complete or dismissed
  if (loading || isComplete || dismissed || missingFields.length === 0) {
    return null;
  }

  const handleGoToProfile = () => {
    // Navigate to profile settings with the appropriate section
    const firstMissingSection = missingFields[0]?.section || "owner";
    navigate(`/distributor-dashboard?tab=profile#/distributor-dashboard?tab=profile&section=${firstMissingSection}`);
    if (onDismiss) onDismiss();
  };

  const handleDismiss = () => {
    setDismissed(true);
    // Store dismissal in localStorage to not show again for this session
    localStorage.setItem('profileNotificationDismissed', Date.now().toString());
    if (onDismiss) onDismiss();
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 w-full max-w-2xl px-4"
      >
        <div className="bg-gradient-to-r from-yellow-500/20 via-orange-500/20 to-red-500/20 border-2 border-yellow-500/50 rounded-xl p-4 backdrop-blur-md shadow-2xl">
          <div className="flex items-start gap-4">
            <div className="p-2 bg-yellow-500/20 rounded-lg flex-shrink-0">
              <FaExclamationTriangle className="w-6 h-6 text-yellow-400" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-bold text-white">Complete Your Profile</h3>
                <button
                  onClick={handleDismiss}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <FaTimes className="w-4 h-4" />
                </button>
              </div>
              <p className="text-sm text-gray-300 mb-3">
                Your profile is <span className="font-bold text-yellow-400">{completionPercentage}%</span> complete. 
                Please add the following information to unlock all features:
              </p>
              <div className="space-y-2 mb-4">
                {missingFields.slice(0, 3).map((field, index) => {
                  const Icon = field.icon;
                  return (
                    <div key={index} className="flex items-center gap-2 text-sm text-gray-300">
                      <Icon className="w-4 h-4 text-yellow-400" />
                      <span>{field.label}</span>
                    </div>
                  );
                })}
                {missingFields.length > 3 && (
                  <p className="text-xs text-gray-400 ml-6">
                    +{missingFields.length - 3} more field{missingFields.length - 3 > 1 ? 's' : ''}
                  </p>
                )}
              </div>
              <button
                onClick={handleGoToProfile}
                className="w-full bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white px-4 py-2 rounded-lg font-medium transition-all flex items-center justify-center gap-2"
              >
                Complete Profile Now
                <FaArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default ProfileCompletionNotification;


import React, { useEffect, useState, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getAuth } from "firebase/auth";
import { doc, getDoc, updateDoc, collection, query, where, getDocs, serverTimestamp } from "firebase/firestore";
import { db, storage } from "../../firebase/firebaseConfig";
import { toast } from "react-toastify";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { getFunctions, httpsCallable } from "firebase/functions";
import { useTranslation } from "react-i18next";
import LanguageSwitcher from "../common/LanguageSwitcher";
import { 
  FaUser, FaBuilding, FaPalette, FaWhatsapp, FaCog, 
  FaCheckCircle, FaExclamationCircle, FaEnvelope, 
  FaPhone, FaIdCard, FaMapMarkerAlt, FaCity, FaGlobe,
  FaSave, FaUpload, FaInfoCircle, FaShieldAlt, FaChartLine,
  FaCreditCard, FaBell, FaLock, FaCalendarAlt, FaFileInvoiceDollar,
  FaUniversity, FaStore, FaFacebook, FaArrowRight, FaSpinner,
  FaExclamationTriangle, FaRocket, FaUsers, FaBullhorn, FaChartBar,
  FaShieldVirus, FaLink, FaTimes
} from "react-icons/fa";

// Meta Embedded Signup URL - Tech Provider Configuration
// App ID: 1902565950686087
// Config ID: 844028501834041
const EMBEDDED_SIGNUP_URL = 'https://business.facebook.com/messaging/whatsapp/onboard/?app_id=1902565950686087&config_id=844028501834041&extras=%7B%22sessionInfoVersion%22%3A%223%22%2C%22version%22%3A%22v3%22%7D';

// WhatsApp Setup Section Component - Built from scratch for first-time users
const WhatsAppSetupSection = ({ formData, setFormData, user }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const popupRef = useRef(null);

  const isConnected = formData.whatsappEnabled && formData.whatsappBusinessAccountId;

  // Save WABA data to Firestore
  const saveWABAData = async (wabaId, phoneNumberId, phoneNumber, embeddedData) => {
    if (!user) throw new Error('User not authenticated');

    const userRef = doc(db, 'businesses', user.uid);
    await updateDoc(userRef, {
      whatsappBusinessAccountId: wabaId,
      whatsappPhoneNumberId: phoneNumberId,
      whatsappPhoneNumber: phoneNumber,
      whatsappProvider: 'meta_tech_provider',
      whatsappEnabled: true,
      whatsappCreatedVia: 'embedded_signup',
      whatsappCreatedAt: new Date(),
      whatsappPhoneRegistered: true,
      whatsappPhoneVerificationStatus: 'verified',
      embeddedSignupData: embeddedData
    });
  };

  // Listen for Meta postMessage responses
  useEffect(() => {
    const handleMessage = async (event) => {
      if (!event.origin.includes('facebook.com') && !event.origin.includes('meta.com')) return;

      const data = event.data;
      let wabaId, phoneNumberId, phoneNumber;

      // Handle different response formats
      if (data?.type === 'WHATSAPP_EMBEDDED_SIGNUP' && data.status === 'SUCCESS') {
        wabaId = data.waba_id;
        phoneNumberId = data.phone_number_id;
        phoneNumber = data.phone_number;
      } else if (data?.waba_id || data?.wabaId) {
        wabaId = data.waba_id || data.wabaId;
        phoneNumberId = data.phone_number_id || data.phoneNumberId;
        phoneNumber = data.phone_number || data.phoneNumber;
      }

      if (wabaId) {
        setLoading(false);
        try {
          await saveWABAData(wabaId, phoneNumberId, phoneNumber, data);
          setFormData(prev => ({
            ...prev,
            whatsappBusinessAccountId: wabaId,
            whatsappPhoneNumberId: phoneNumberId,
            whatsappPhoneNumber: phoneNumber,
            whatsappEnabled: true,
            whatsappProvider: 'meta_tech_provider',
            whatsappCreatedVia: 'embedded_signup',
            whatsappPhoneRegistered: true,
            whatsappPhoneVerificationStatus: 'verified',
          }));
          toast.success('WhatsApp Business Account connected successfully!');
        } catch (err) {
          console.error('Error saving WABA:', err);
          setError('Failed to save account. Please try again.');
          toast.error('Failed to save WhatsApp account');
        }
      } else if (data?.status === 'ERROR' || data?.status === 'CANCELLED') {
        setLoading(false);
        setError(data.error_message || 'Signup was cancelled');
        toast.error(data.error_message || 'WhatsApp signup cancelled');
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [setFormData, user]);

  // Open Meta Embedded Signup
  const handleConnect = () => {
    if (!user) {
      toast.error('Please log in to continue');
      return;
    }

    setLoading(true);
    setError(null);

    const width = 800;
    const height = 700;
    const left = (window.screen.width - width) / 2;
    const top = (window.screen.height - height) / 2;

    const popup = window.open(
      EMBEDDED_SIGNUP_URL,
      'WhatsAppSignup',
      `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
    );

    popupRef.current = popup;

    if (!popup || popup.closed) {
      setError('Popup blocked. Please allow popups for this site.');
      setLoading(false);
      toast.error('Please allow popups to connect WhatsApp');
      return;
    }

    // Monitor popup closure
    const checkInterval = setInterval(() => {
      if (popup.closed) {
        clearInterval(checkInterval);
        if (loading) {
          setLoading(false);
          toast.info('WhatsApp signup window was closed');
        }
      }
    }, 1000);
  };

  // If already connected, show simple status
  if (isConnected) {
    return (
      <div className="bg-slate-900/80 border border-white/10 backdrop-blur-md rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-green-500/20 rounded-lg">
            <FaWhatsapp className="w-6 h-6 text-green-400" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">WhatsApp Business Account</h2>
            <p className="text-green-400 text-sm mt-1">✓ Setup Complete - Ready to use</p>
          </div>
        </div>
        <div className="bg-slate-800/60 rounded-lg p-4 space-y-2">
          {formData.whatsappBusinessAccountId && (
            <div className="flex justify-between">
              <span className="text-gray-400">WABA ID:</span>
              <span className="text-white font-mono text-sm">{formData.whatsappBusinessAccountId}</span>
            </div>
          )}
          {formData.whatsappPhoneNumber && (
            <div className="flex justify-between">
              <span className="text-gray-400">Phone:</span>
              <span className="text-white font-mono text-sm">{formData.whatsappPhoneNumber}</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  // FIRST-TIME USER DESIGN - Clean, simple, focused
  return (
    <div className="bg-slate-900/80 border border-white/10 backdrop-blur-md rounded-2xl p-8">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="flex justify-center mb-6">
          <div className="relative">
            <div className="absolute inset-0 bg-green-500/20 rounded-full blur-xl"></div>
            <div className="relative p-5 bg-gradient-to-br from-green-500/20 to-emerald-500/20 rounded-full border-2 border-green-500/50">
              <FaWhatsapp className="w-16 h-16 text-green-400" />
            </div>
          </div>
        </div>
        <h2 className="text-3xl font-bold text-white mb-2">Connect WhatsApp Business</h2>
        <p className="text-gray-400">Set up your WhatsApp Business Account to start messaging customers</p>
      </div>

      {/* Main Action Button */}
      <div className="mb-8">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleConnect}
          disabled={loading}
          className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 disabled:from-gray-600 disabled:to-gray-600 disabled:cursor-not-allowed text-white font-bold py-5 px-6 rounded-xl transition-all flex items-center justify-center gap-3 text-lg shadow-lg shadow-green-500/30"
        >
          {loading ? (
            <>
              <FaSpinner className="animate-spin text-xl" />
              <span>Connecting...</span>
            </>
          ) : (
            <>
              <FaFacebook className="text-2xl" />
              <span>Connect with Facebook</span>
              <FaArrowRight />
            </>
          )}
        </motion.button>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-900/30 border border-red-500/50 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-3">
            <FaExclamationTriangle className="text-red-400" />
            <div className="flex-1">
              <p className="text-red-300 text-sm">{error}</p>
            </div>
            <button
              onClick={handleConnect}
              className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-sm"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Tech Provider Info */}
      <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4 mb-6 text-center">
        <div className="flex items-center justify-center gap-2 mb-2">
          <FaShieldVirus className="text-emerald-400" />
          <span className="text-sm font-semibold text-emerald-400">Meta Tech Provider</span>
        </div>
        <p className="text-xs text-gray-400">Powered by FLYP's official Meta integration</p>
      </div>

      {/* Benefits */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-400 text-center mb-4">What you'll get:</h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-slate-800/40 rounded-lg p-3 text-center">
            <FaBullhorn className="text-green-400 mx-auto mb-2" />
            <p className="text-xs text-gray-300">Marketing Messages</p>
          </div>
          <div className="bg-slate-800/40 rounded-lg p-3 text-center">
            <FaUsers className="text-green-400 mx-auto mb-2" />
            <p className="text-xs text-gray-300">Customer Engagement</p>
          </div>
          <div className="bg-slate-800/40 rounded-lg p-3 text-center">
            <FaChartBar className="text-green-400 mx-auto mb-2" />
            <p className="text-xs text-gray-300">Analytics</p>
          </div>
          <div className="bg-slate-800/40 rounded-lg p-3 text-center">
            <FaRocket className="text-green-400 mx-auto mb-2" />
            <p className="text-xs text-gray-300">API Access</p>
          </div>
        </div>
      </div>

      {/* Simple Instructions */}
      <div className="mt-6 bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <FaInfoCircle className="text-blue-400 mt-0.5 flex-shrink-0" />
          <div className="text-xs text-gray-400 space-y-1">
            <p className="font-semibold text-white mb-1">How it works:</p>
            <p>Click the button above → Log in with Facebook → Follow Meta's setup → Your account connects automatically</p>
          </div>
        </div>
      </div>
    </div>
  );
};

const ProfileSettings = () => {
  const { t } = useTranslation();
  const badgeMap = {
    Retailer: "🛍 Retailer",
    Distributor: "🏢 Distributor",
    "Product Owner": "📦 Product Owner"
  };
  const [formData, setFormData] = useState({
    ownerName: "",
    email: "",
    phone: "",
    businessName: "",
    address: "",
    city: "",
    state: "",
    pincode: "",
    logoUrl: "",
    gstNumber: "",
    businessType: "Retailer",
    invoicePreference: "Minimal",
    whatsappAlerts: false,
    emailNotifications: true,
    smsNotifications: false,
    profileVersion: 0,
    lastUpdated: "",
    businessMode: "Online",
    flypId: "",
    // Banking & Payment (for retailers)
    bankName: "",
    bankBranch: "",
    bankAccountNumber: "",
    bankIfsc: "",
    bankAccountName: "",
    upiId: "",
    // WhatsApp Business Account
    whatsappBusinessAccountId: "",
    whatsappPhoneNumberId: "",
    whatsappPhoneNumber: "",
    whatsappEnabled: false,
    whatsappProvider: "",
    whatsappCreatedVia: "",
    whatsappPhoneRegistered: false,
    whatsappPhoneVerificationStatus: "",
  });
  const [activeSection, setActiveSection] = useState("owner");
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const auth = getAuth();
  const user = auth.currentUser;

  // Calculate profile completion percentage
  const profileCompletion = useMemo(() => {
    const fields = [
      formData.ownerName,
      formData.email,
      formData.phone,
      formData.businessName,
      formData.address,
      formData.city,
      formData.state,
      formData.pincode,
      formData.gstNumber,
      formData.flypId,
      formData.logoUrl,
      formData.bankName,
      formData.bankAccountNumber,
      formData.upiId,
    ];
    const completed = fields.filter(f => f && (typeof f === 'string' ? f.trim() !== "" : true)).length;
    return Math.round((completed / fields.length) * 100);
  }, [formData]);

  // Navigation items with icons - Retailer specific
  const navItems = [
    { id: "owner", label: t("profile.ownerInfo") || "Owner Info", icon: FaUser, color: "from-purple-500 to-pink-500" },
    { id: "business", label: t("profile.businessDetails") || "Business", icon: FaBuilding, color: "from-indigo-500 to-blue-500" },
    { id: "tax", label: "Tax Information", icon: FaFileInvoiceDollar, color: "from-orange-500 to-red-500" },
    { id: "banking", label: "Banking & Payment", icon: FaUniversity, color: "from-blue-500 to-cyan-500" },
    { id: "whatsapp", label: "WhatsApp Business", icon: FaWhatsapp, color: "from-green-500 to-emerald-500" },
    { id: "branding", label: t("profile.branding") || "Branding", icon: FaPalette, color: "from-pink-500 to-rose-500" },
    { id: "notifications", label: "Notifications", icon: FaBell, color: "from-yellow-500 to-orange-500" },
    { id: "preferences", label: t("profile.preferences") || "Preferences", icon: FaCog, color: "from-gray-500 to-slate-500" },
  ];

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;
      const userRef = doc(db, "businesses", user.uid);
      const snapshot = await getDoc(userRef);
      if (snapshot.exists()) {
        const data = snapshot.data();
        setFormData((prev) => {
          // Ensure all string fields are converted to strings to prevent type issues
          const newData = {
            ...prev,
            ...data,
            ownerName: data.ownerName || data.name || "",
            email: data.email || user.email || "",
            bankName: data.bankName ? String(data.bankName) : "",
            bankBranch: data.bankBranch ? String(data.bankBranch) : "",
            bankAccountNumber: data.bankAccountNumber ? String(data.bankAccountNumber) : "",
            bankIfsc: data.bankIfsc ? String(data.bankIfsc) : "",
            bankAccountName: data.bankAccountName ? String(data.bankAccountName) : "",
            upiId: data.upiId ? String(data.upiId) : "",
            city: data.city ? String(data.city) : "",
            state: data.state ? String(data.state) : "",
            pincode: data.pincode != null ? String(data.pincode) : "",
            address: data.address ? String(data.address) : "",
            businessName: data.businessName ? String(data.businessName) : "",
            phone: data.phone ? String(data.phone) : "",
            gstNumber: data.gstNumber ? String(data.gstNumber) : "",
            emailNotifications: data.emailNotifications !== undefined ? data.emailNotifications : true,
            smsNotifications: data.smsNotifications || false,
            // WhatsApp fields
            whatsappBusinessAccountId: data.whatsappBusinessAccountId || "",
            whatsappPhoneNumberId: data.whatsappPhoneNumberId || "",
            whatsappPhoneNumber: data.whatsappPhoneNumber || "",
            whatsappEnabled: data.whatsappEnabled || false,
            whatsappProvider: data.whatsappProvider || "",
            whatsappCreatedVia: data.whatsappCreatedVia || "",
            whatsappPhoneRegistered: data.whatsappPhoneRegistered || false,
            whatsappPhoneVerificationStatus: data.whatsappPhoneVerificationStatus || "",
          };
          return newData;
        });
        if (data.logoUrl) {
          setLogoPreview(data.logoUrl);
        }
      }
      setLoading(false);
    };
    fetchData();
  }, [user]);

  const handleChange = (e) => {
    // Prevent event bubbling
    e.stopPropagation();
    const { name, value, type, checked } = e.target;
    
    // Handle checkboxes separately
    if (type === "checkbox") {
      setFormData((prev) => ({ ...prev, [name]: checked }));
    } else {
      // Ensure value is always a string for consistency
      // Preserve the value exactly as typed (don't convert empty strings incorrectly)
      setFormData((prev) => ({ 
        ...prev, 
        [name]: value !== undefined && value !== null ? String(value) : "" 
      }));
    }
  };

  const handleLogoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setLogoFile(file);
      setLogoPreview(URL.createObjectURL(file));
    }
  };

  const handleSave = async () => {
    if (!user || isSaving) return;
    setIsSaving(true);
    try {
      const userRef = doc(db, "businesses", user.uid);
      
      // First, get the current document to preserve ownerId and other immutable fields
      const currentDoc = await getDoc(userRef);
      if (!currentDoc.exists()) {
        toast.error("Profile not found. Please refresh the page.");
        setIsSaving(false);
        return;
      }
      
      const currentData = currentDoc.data();
      
      // Handle logo upload first if needed
      let logoUrl = formData.logoUrl;
      if (logoFile) {
        const storageRef = ref(storage, `logos/${user.uid}`);
        await uploadBytes(storageRef, logoFile);
        const downloadURL = await getDownloadURL(storageRef);
        logoUrl = downloadURL;
      }

      // Only update allowed fields - explicitly list what can be updated
      // This ensures we don't accidentally overwrite protected fields like ownerId, role, etc.
      const updatedData = {
        // Basic info
        ownerName: formData.ownerName || "",
        businessName: formData.businessName || "",
        phone: formData.phone || "",
        address: formData.address || "",
        city: formData.city || "",
        state: formData.state || "",
        pincode: formData.pincode || "",
        // Tax info
        gstNumber: formData.gstNumber || "",
        // Banking info
        bankName: formData.bankName || "",
        bankBranch: formData.bankBranch || "",
        bankAccountNumber: formData.bankAccountNumber || "",
        bankIfsc: formData.bankIfsc || "",
        bankAccountName: formData.bankAccountName || "",
        upiId: formData.upiId || "",
        // Branding
        logoUrl: logoUrl || "",
        // Preferences
        invoicePreference: formData.invoicePreference || "Minimal",
        businessMode: formData.businessMode || "Online",
        whatsappAlerts: formData.whatsappAlerts || false,
        emailNotifications: formData.emailNotifications !== undefined ? formData.emailNotifications : true,
        smsNotifications: formData.smsNotifications || false,
        // Profile metadata
        profileVersion: (formData.profileVersion || 0) + 1,
        lastUpdated: new Date().toISOString(),
        // Legacy field name for compatibility
        name: formData.ownerName || "",
      };
      
      // Preserve ownerId (required by Firestore rules)
      if (currentData.ownerId) {
        updatedData.ownerId = currentData.ownerId;
      }
      
      // Preserve email if it exists (should not change per rules)
      if (currentData.email) {
        updatedData.email = currentData.email;
      }
      
      // Preserve businessType and role (should not change)
      if (currentData.businessType) {
        updatedData.businessType = currentData.businessType;
      }
      if (currentData.role) {
        updatedData.role = currentData.role;
      }
      if (currentData.flypId) {
        updatedData.flypId = currentData.flypId;
      }

      await updateDoc(userRef, updatedData);

      // Update local state with new logo if uploaded
      if (logoFile) {
        setFormData(prev => ({ ...prev, logoUrl }));
        setLogoPreview(logoUrl);
      }
      setLogoFile(null);
      
      // Update formData with new version
      setFormData(prev => ({
        ...prev,
        profileVersion: updatedData.profileVersion,
        lastUpdated: updatedData.lastUpdated,
        logoUrl: updatedData.logoUrl,
      }));

      toast.success("Profile updated successfully!");

      // Fire-and-forget resync
      try {
        const functions = getFunctions(undefined, "asia-south1");
        const resync = httpsCallable(functions, "resyncRetailerProfile");
        resync().catch((e) =>
          console.warn("[ProfileSync] background resync failed:", e)
        );
      } catch (syncErr) {
        console.warn("[ProfileSync] init failed:", syncErr);
      }
    } catch (err) {
      console.error("Update failed", err);
      let errorMessage = "Failed to update profile.";
      if (err.code === 'permission-denied') {
        errorMessage = "Permission denied. Please check your Firestore security rules or contact support.";
      } else if (err.code === 'unavailable') {
        errorMessage = "Service temporarily unavailable. Please try again.";
      } else if (err.message) {
        errorMessage = `Failed to update profile: ${err.message}`;
      }
      toast.error(errorMessage);
    } finally {
      setIsSaving(false);
    }
  };

  // Generate unique FLYP ID and save to Firestore
  const generateFlypId = async () => {
    if (!user) return;

    const confirm = window.confirm("Are you sure you want to generate your unique FLYP ID? This cannot be changed later.");
    if (!confirm) return;

    const randomId = "FLYP-" + Math.random().toString(36).substring(2, 8).toUpperCase();
    const checkRef = collection(db, "businesses");
    const querySnapshot = await getDocs(query(checkRef, where("flypId", "==", randomId)));

    if (!querySnapshot.empty) {
      toast.error("Try again. FLYP ID already exists.");
      return;
    }

    const userRef = doc(db, "businesses", user.uid);
    await updateDoc(userRef, { flypId: randomId });
    setFormData((prev) => ({ ...prev, flypId: randomId }));
    toast.success("✅ Your FLYP ID has been created!");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8 min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500 mx-auto mb-4"></div>
          <p className="text-white">{t("profile.loadingProfile") || "Loading profile..."}</p>
        </div>
      </div>
    );
  }

  // Form Field Component - Optimized for proper focus handling and accessibility
  const FormField = React.memo(({ label, name, type = "text", value, onChange, placeholder, icon: Icon, required = false, disabled = false, rows }) => {
    // Ensure value is always a string, handle null/undefined/numbers properly
    const stringValue = value != null ? String(value) : "";
    const isValid = required ? stringValue.trim() !== "" : true;
    const InputComponent = rows ? "textarea" : "input";
    const inputId = `field-${name}`;
    
    return (
      <div className="space-y-2">
        <label 
          htmlFor={inputId}
          className="flex items-center gap-2 text-sm font-medium text-gray-300 cursor-pointer"
        >
          {Icon && <Icon className="w-4 h-4 text-emerald-400" />}
          {label}
          {required && <span className="text-red-400">*</span>}
        </label>
        <InputComponent
          id={inputId}
          name={name}
          type={type}
          value={stringValue}
          onChange={onChange}
          placeholder={placeholder}
          disabled={disabled}
          rows={rows}
          autoComplete="off"
          className={`w-full bg-slate-800/80 border ${
            isValid ? "border-white/10" : "border-red-500/50"
          } text-white placeholder-gray-500 px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all ${
            disabled ? "opacity-60 cursor-not-allowed" : "cursor-text"
          }`}
        />
        {required && !isValid && (
          <p className="text-xs text-red-400 flex items-center gap-1">
            <FaExclamationCircle className="w-3 h-3" />
            This field is required
          </p>
        )}
      </div>
    );
  });

  return (
    <div className="w-full max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Header Section */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row md:items-center md:justify-between gap-4"
      >
        <div className="flex-1">
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 via-cyan-400 to-teal-400">
            {t("profile.title") || "Profile Settings"}
          </h1>
          <p className="text-gray-400 mt-1">Manage your retailer profile and preferences</p>
              </div>
        <div className="flex items-center gap-3">
          {/* Profile Completion Badge */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-gradient-to-r from-emerald-500/20 via-cyan-500/20 to-teal-500/20 border border-emerald-500/30 rounded-xl px-4 py-3 backdrop-blur-sm"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-500/20 rounded-lg">
                <FaChartLine className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-white">{profileCompletion}%</span>
                  <span className="text-xs text-gray-400">Complete</span>
                </div>
                <div className="w-24 bg-slate-800/50 rounded-full h-1.5 mt-1 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${profileCompletion}%` }}
                    transition={{ duration: 1, ease: "easeOut" }}
                    className="h-full bg-gradient-to-r from-emerald-500 via-cyan-500 to-teal-500 rounded-full"
                  />
                </div>
              </div>
            </div>
          </motion.div>
          <div className="px-4 py-2 bg-emerald-500/20 border border-emerald-500/30 rounded-lg">
            <span className="text-sm text-emerald-300 font-medium">🛍 Retailer</span>
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar Navigation */}
        <div className="lg:col-span-1">
          <div className="space-y-2 sticky top-4">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeSection === item.id;
              return (
                <motion.button
                  key={item.id}
                  onClick={() => setActiveSection(item.id)}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                    isActive
                      ? `bg-gradient-to-r ${item.color} text-white shadow-lg shadow-emerald-500/50`
                      : "bg-slate-800/60 border border-white/10 text-gray-300 hover:bg-slate-700/60"
                  }`}
                >
                  <Icon className={`w-5 h-5 ${isActive ? "text-white" : "text-gray-400"}`} />
                  <span className="font-medium">{item.label}</span>
                  {isActive && (
                    <motion.div
                      layoutId="activeIndicator"
                      className="ml-auto w-2 h-2 bg-white rounded-full"
                    />
                  )}
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* Main Content */}
        <div className="lg:col-span-3">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeSection}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            onAnimationComplete={() => {
              // Ensure inputs are ready after animation
              // Don't auto-focus to avoid disrupting user flow
            }}
          >
              {/* Owner Information Section */}
            {activeSection === "owner" && (
                <div className="bg-slate-900/80 border border-white/10 backdrop-blur-md rounded-2xl p-6 space-y-6">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                      <div className="p-2 bg-purple-500/20 rounded-lg">
                        <FaUser className="w-6 h-6 text-purple-400" />
                      </div>
                      {t("profile.ownerInformation") || "Owner Information"}
                    </h2>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      label={t("profile.ownerName") || "Owner Name"}
                      name="ownerName"
                      value={formData.ownerName}
                      onChange={handleChange}
                      placeholder={t("profile.enterOwnerName") || "Enter owner name"}
                      icon={FaUser}
                      required
                    />
                    <FormField
                      label={t("profile.emailAddress") || "Email Address"}
                      name="email"
                      type="email"
                      value={formData.email}
                      onChange={handleChange}
                      placeholder={t("profile.enterEmail") || "Enter email address"}
                      icon={FaEnvelope}
                      required
                    />
                    <FormField
                      label={t("profile.phoneNumber") || "Phone Number"}
                      name="phone"
                      type="tel"
                      value={formData.phone}
                      onChange={handleChange}
                      placeholder={t("profile.enterPhoneNumber") || "Enter phone number"}
                      icon={FaPhone}
                      required
                    />
                  </div>

                  {/* FLYP ID Card */}
                  <div className="bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 border border-emerald-500/30 rounded-xl p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-emerald-500/20 rounded-lg">
                          <FaIdCard className="w-5 h-5 text-emerald-400" />
                </div>
                        <div>
                          <h3 className="font-semibold text-white flex items-center gap-2">
                      FLYP ID
                            <FaInfoCircle className="w-4 h-4 text-emerald-400" title="Your unique business identifier" />
                          </h3>
                          <p className="text-xs text-gray-400">Your unique business identifier</p>
                        </div>
                      </div>
                    </div>
                  {formData.flypId ? (
                      <div className="flex items-center gap-3">
                      <input
                        disabled
                        value={formData.flypId ? String(formData.flypId) : ""}
                          className="flex-1 bg-slate-800/80 border border-white/10 text-gray-400 cursor-not-allowed px-4 py-3 rounded-lg"
                      />
                        <span className="px-4 py-2 bg-emerald-500/20 border border-emerald-500/30 rounded-lg text-emerald-300 text-sm font-medium flex items-center gap-2">
                          <FaCheckCircle className="w-4 h-4" />
                          Linked
                        </span>
                    </div>
                  ) : (
                      <motion.button
                      onClick={generateFlypId}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className="w-full bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 text-white px-6 py-3 rounded-lg font-medium transition-all flex items-center justify-center gap-2"
                    >
                        <FaIdCard className="w-5 h-5" />
                        Generate My FLYP ID
                      </motion.button>
                  )}
                </div>

                  <div className="flex justify-end pt-4 border-t border-white/10">
                    <motion.button
                    onClick={handleSave}
                    disabled={isSaving}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className={`bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 text-white px-8 py-3 rounded-lg font-medium transition-all flex items-center gap-2 ${
                        isSaving ? "opacity-60 cursor-not-allowed" : ""
                      }`}
                    >
                      <FaSave className="w-4 h-4" />
                      {isSaving ? "Saving..." : "Save Changes"}
                    </motion.button>
                </div>
              </div>
            )}

              {/* Business Details Section */}
            {activeSection === "business" && (
                <div className="bg-slate-900/80 border border-white/10 backdrop-blur-md rounded-2xl p-6 space-y-6">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                      <div className="p-2 bg-indigo-500/20 rounded-lg">
                        <FaBuilding className="w-6 h-6 text-indigo-400" />
                      </div>
                      {t("profile.businessDetails") || "Business Details"}
                    </h2>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      label={t("profile.businessName") || "Business Name"}
                      name="businessName"
                      value={formData.businessName}
                      onChange={handleChange}
                      placeholder="Enter business name"
                      icon={FaStore}
                      required
                    />
                    <FormField
                      label="Business Type"
                      name="businessType"
                      value={formData.businessType}
                      disabled
                      icon={FaBuilding}
                    />
                    <FormField
                      label={t("retailers.address") || "Address"}
                      name="address"
                      value={formData.address}
                      onChange={handleChange}
                      placeholder="Enter business address"
                      icon={FaMapMarkerAlt}
                      rows={3}
                      required
                    />
                    <FormField
                      label="City"
                      name="city"
                      value={formData.city}
                      onChange={handleChange}
                      placeholder="Enter city"
                      icon={FaCity}
                      required
                    />
                    <FormField
                      label="State"
                      name="state"
                      value={formData.state}
                      onChange={handleChange}
                      placeholder="Enter state"
                      required
                    />
                    <FormField
                      label="Pincode"
                      name="pincode"
                      value={formData.pincode}
                      onChange={handleChange}
                      placeholder="Enter pincode"
                      required
                    />
                    <div className="md:col-span-2">
                      <label 
                        htmlFor="invoicePreference"
                        className="block mb-2 text-sm font-medium text-gray-300 cursor-pointer"
                      >
                        Invoice Preference
                      </label>
                    <select
                      id="invoicePreference"
                      name="invoicePreference"
                      value={formData.invoicePreference || "Minimal"}
                      onChange={handleChange}
                      className="w-full bg-slate-800/80 border border-white/10 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent cursor-pointer"
                    >
                      <option value="Minimal">Minimal</option>
                      <option value="Detailed">Detailed</option>
                      <option value="Modern">Modern</option>
                    </select>
                  </div>
                    <div className="md:col-span-2 bg-slate-800/60 rounded-xl p-4 border border-white/10">
                  <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-gray-300 mb-1">Business Mode</p>
                          <p className="text-xs text-gray-400">Toggle online/offline status</p>
                        </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={formData.businessMode === "Online"}
                        onChange={(e) =>
                          setFormData(prev => ({ ...prev, businessMode: e.target.checked ? "Online" : "Offline" }))
                        }
                      />
                          <div className="w-14 h-7 bg-slate-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-emerald-500 rounded-full peer peer-checked:bg-emerald-500 transition-all"></div>
                          <span className="ml-3 text-sm font-medium text-white">
                            {formData.businessMode}
                          </span>
                        </label>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end pt-4 border-t border-white/10">
                    <motion.button
                      onClick={handleSave}
                      disabled={isSaving}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className={`bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 text-white px-8 py-3 rounded-lg font-medium transition-all flex items-center gap-2 ${
                        isSaving ? "opacity-60 cursor-not-allowed" : ""
                      }`}
                    >
                      <FaSave className="w-4 h-4" />
                      {isSaving ? "Saving..." : "Save Changes"}
                    </motion.button>
                  </div>
                </div>
              )}

              {/* Tax Information Section */}
              {activeSection === "tax" && (
                <div className="bg-slate-900/80 border border-white/10 backdrop-blur-md rounded-2xl p-6 space-y-6">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                      <div className="p-2 bg-orange-500/20 rounded-lg">
                        <FaFileInvoiceDollar className="w-6 h-6 text-orange-400" />
                      </div>
                      Tax Information
                    </h2>
                  </div>

                  <div className="space-y-6">
                    <FormField
                      label={t("profile.gstNumber") || "GST Number"}
                      name="gstNumber"
                      value={formData.gstNumber}
                      onChange={handleChange}
                      placeholder="Enter GST number (15 characters)"
                      icon={FaFileInvoiceDollar}
                    />
                    <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                      <div className="flex items-start gap-3">
                        <FaInfoCircle className="w-5 h-5 text-blue-400 mt-0.5" />
                        <div>
                          <p className="text-sm text-blue-300 font-medium mb-1">GST Information</p>
                          <p className="text-xs text-gray-400">Your GST number is used for tax calculations and invoice generation. Make sure it's accurate.</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end pt-4 border-t border-white/10">
                    <motion.button
                      onClick={handleSave}
                      disabled={isSaving}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className={`bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 text-white px-8 py-3 rounded-lg font-medium transition-all flex items-center gap-2 ${
                        isSaving ? "opacity-60 cursor-not-allowed" : ""
                      }`}
                    >
                      <FaSave className="w-4 h-4" />
                      {isSaving ? "Saving..." : "Save Changes"}
                    </motion.button>
                  </div>
                </div>
              )}

              {/* Banking & Payment Section */}
              {activeSection === "banking" && (
                <div className="bg-slate-900/80 border border-white/10 backdrop-blur-md rounded-2xl p-6 space-y-6">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                      <div className="p-2 bg-blue-500/20 rounded-lg">
                        <FaUniversity className="w-6 h-6 text-blue-400" />
                      </div>
                      Banking & Payment
                    </h2>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      label="Bank Name"
                      name="bankName"
                      value={formData.bankName}
                      onChange={handleChange}
                      placeholder="Enter bank name"
                      icon={FaUniversity}
                    />
                    <FormField
                      label="Bank Branch"
                      name="bankBranch"
                      value={formData.bankBranch}
                      onChange={handleChange}
                      placeholder="Enter branch name"
                    />
                    <FormField
                      label="Account Holder Name"
                      name="bankAccountName"
                      value={formData.bankAccountName}
                      onChange={handleChange}
                      placeholder="Enter account holder name"
                    />
                    <FormField
                      label="Account Number"
                      name="bankAccountNumber"
                      value={formData.bankAccountNumber}
                      onChange={handleChange}
                      placeholder="Enter account number"
                      type="text"
                    />
                    <FormField
                      label="IFSC Code"
                      name="bankIfsc"
                      value={formData.bankIfsc}
                      onChange={handleChange}
                      placeholder="Enter IFSC code"
                    />
                    <FormField
                      label="UPI ID"
                      name="upiId"
                      value={formData.upiId}
                      onChange={handleChange}
                      placeholder="Enter UPI ID (e.g., yourname@paytm)"
                      icon={FaCreditCard}
                    />
                  </div>

                  <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <FaInfoCircle className="w-5 h-5 text-emerald-400 mt-0.5" />
                      <div>
                        <p className="text-sm text-emerald-300 font-medium mb-1">Payment Information</p>
                        <p className="text-xs text-gray-400">This information is used for receiving payments from customers. Keep it secure and up-to-date.</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end pt-4 border-t border-white/10">
                    <motion.button
                      onClick={handleSave}
                      disabled={isSaving}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className={`bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 text-white px-8 py-3 rounded-lg font-medium transition-all flex items-center gap-2 ${
                        isSaving ? "opacity-60 cursor-not-allowed" : ""
                      }`}
                    >
                      <FaSave className="w-4 h-4" />
                      {isSaving ? "Saving..." : "Save Changes"}
                    </motion.button>
                  </div>
                </div>
              )}

              {/* WhatsApp Business Section */}
              {activeSection === "whatsapp" && (
                <WhatsAppSetupSection 
                  formData={formData}
                  setFormData={setFormData}
                  user={user}
                />
              )}

              {/* Branding Section */}
              {activeSection === "branding" && (
                <div className="bg-slate-900/80 border border-white/10 backdrop-blur-md rounded-2xl p-6 space-y-6">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                      <div className="p-2 bg-pink-500/20 rounded-lg">
                        <FaPalette className="w-6 h-6 text-pink-400" />
                      </div>
                      {t("profile.branding") || "Branding & Metadata"}
                    </h2>
                  </div>

                  <div className="grid md:grid-cols-2 gap-6 items-start">
                    <div className="space-y-4">
                      <div>
                        <label className="block mb-2 text-sm font-medium text-gray-300 flex items-center gap-2">
                          <FaUpload className="w-4 h-4 text-pink-400" />
                          Business Logo
                    </label>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleLogoUpload}
                          className="w-full bg-slate-800/80 border border-white/10 text-white placeholder-gray-500 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                        />
                        {logoPreview && (
                          <div className="mt-4">
                            <img 
                              src={logoPreview} 
                              alt="Logo Preview" 
                              className="w-32 h-32 rounded-full object-cover ring-4 ring-emerald-500/50 shadow-lg" 
                            />
                            <p className="text-xs text-gray-400 mt-2">Logo Preview</p>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="space-y-4">
                      {formData.lastUpdated && (
                        <div className="bg-slate-800/60 rounded-xl p-4 border border-white/10">
                          <p className="text-sm text-gray-400 mb-1">Last Updated</p>
                          <p className="text-white font-medium">
                            {new Date(formData.lastUpdated).toLocaleString()}
                          </p>
                        </div>
                      )}
                      {formData.profileVersion > 0 && (
                        <div className="bg-slate-800/60 rounded-xl p-4 border border-white/10">
                          <p className="text-sm text-gray-400 mb-1">Profile Version</p>
                          <p className="text-white font-medium">{formData.profileVersion}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex justify-end pt-4 border-t border-white/10">
                    <motion.button
                      onClick={handleSave}
                      disabled={isSaving}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className={`bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 text-white px-8 py-3 rounded-lg font-medium transition-all flex items-center gap-2 ${
                        isSaving ? "opacity-60 cursor-not-allowed" : ""
                      }`}
                    >
                      <FaSave className="w-4 h-4" />
                      {isSaving ? "Saving..." : "Save Changes"}
                    </motion.button>
                  </div>
                </div>
              )}

              {/* Notifications Section */}
              {activeSection === "notifications" && (
                <div className="bg-slate-900/80 border border-white/10 backdrop-blur-md rounded-2xl p-6 space-y-6">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                      <div className="p-2 bg-yellow-500/20 rounded-lg">
                        <FaBell className="w-6 h-6 text-yellow-400" />
                      </div>
                      Notifications
                    </h2>
                  </div>

                  <div className="space-y-4">
                    <div className="bg-slate-800/60 rounded-xl p-4 border border-white/10">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-gray-300 mb-1">Email Notifications</p>
                          <p className="text-xs text-gray-400">Receive notifications via email</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            className="sr-only peer"
                            checked={formData.emailNotifications}
                            onChange={(e) =>
                              setFormData(prev => ({ ...prev, emailNotifications: e.target.checked }))
                            }
                          />
                          <div className="w-14 h-7 bg-slate-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-yellow-500 rounded-full peer peer-checked:bg-yellow-500 transition-all"></div>
                          <span className="ml-3 text-sm font-medium text-white">
                            {formData.emailNotifications ? "Enabled" : "Disabled"}
                          </span>
                        </label>
                      </div>
                    </div>

                    <div className="bg-slate-800/60 rounded-xl p-4 border border-white/10">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-gray-300 mb-1">SMS Notifications</p>
                          <p className="text-xs text-gray-400">Receive notifications via SMS</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            className="sr-only peer"
                            checked={formData.smsNotifications}
                            onChange={(e) =>
                              setFormData(prev => ({ ...prev, smsNotifications: e.target.checked }))
                            }
                          />
                          <div className="w-14 h-7 bg-slate-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-yellow-500 rounded-full peer peer-checked:bg-yellow-500 transition-all"></div>
                          <span className="ml-3 text-sm font-medium text-white">
                            {formData.smsNotifications ? "Enabled" : "Disabled"}
                          </span>
                        </label>
                      </div>
                    </div>

                    <div className="bg-slate-800/60 rounded-xl p-4 border border-white/10">
                  <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-gray-300 mb-1">WhatsApp Alerts</p>
                          <p className="text-xs text-gray-400">Receive alerts via WhatsApp</p>
                        </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={formData.whatsappAlerts}
                        onChange={(e) =>
                          setFormData(prev => ({ ...prev, whatsappAlerts: e.target.checked }))
                        }
                      />
                          <div className="w-14 h-7 bg-slate-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-green-500 rounded-full peer peer-checked:bg-green-500 transition-all"></div>
                          <span className="ml-3 text-sm font-medium text-white">
                            {formData.whatsappAlerts ? "Enabled" : "Disabled"}
                          </span>
                    </label>
                  </div>
                </div>
                  </div>

                  <div className="flex justify-end pt-4 border-t border-white/10">
                    <motion.button
                    onClick={handleSave}
                    disabled={isSaving}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className={`bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 text-white px-8 py-3 rounded-lg font-medium transition-all flex items-center gap-2 ${
                        isSaving ? "opacity-60 cursor-not-allowed" : ""
                      }`}
                    >
                      <FaSave className="w-4 h-4" />
                      {isSaving ? "Saving..." : "Save Changes"}
                    </motion.button>
                </div>
              </div>
            )}

              {/* Preferences Section */}
            {activeSection === "preferences" && (
                <div className="bg-slate-900/80 border border-white/10 backdrop-blur-md rounded-2xl p-6 space-y-6">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                      <div className="p-2 bg-gray-500/20 rounded-lg">
                        <FaCog className="w-6 h-6 text-gray-400" />
                      </div>
                      {t("profile.preferences") || "Preferences"}
                    </h2>
                  </div>

                  <div className="bg-slate-800/60 rounded-xl p-6 border border-white/10">
                    <h4 className="font-semibold mb-4 flex items-center gap-2 text-white">
                      <FaGlobe className="w-5 h-5 text-emerald-400" />
                      {t("language.changeLanguage") || "Change Language"}
                    </h4>
                    <p className="text-sm text-gray-400 mb-4">
                      {t("language.currentLanguage") || "Select your preferred language"}
                    </p>
                    <div className="flex justify-center items-center">
                      <LanguageSwitcher />
                    </div>
                  </div>

                  <div className="flex justify-end pt-4 border-t border-white/10">
                    <motion.button
                        onClick={handleSave}
                        disabled={isSaving}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className={`bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 text-white px-8 py-3 rounded-lg font-medium transition-all flex items-center gap-2 ${
                        isSaving ? "opacity-60 cursor-not-allowed" : ""
                      }`}
                    >
                      <FaSave className="w-4 h-4" />
                      {isSaving ? "Saving..." : "Save Changes"}
                    </motion.button>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default ProfileSettings;

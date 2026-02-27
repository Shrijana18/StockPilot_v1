import React, { useEffect, useState, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getAuth, deleteUser, reauthenticateWithPopup, reauthenticateWithCredential, GoogleAuthProvider, OAuthProvider, EmailAuthProvider } from "firebase/auth";
import { usePlatform } from "../../hooks/usePlatform.js";
import { doc, getDoc, updateDoc, setDoc, deleteDoc, collection, query, where, getDocs, serverTimestamp } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { db, storage } from "../../firebase/firebaseConfig";
import { toast } from "react-toastify";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { getFunctions, httpsCallable } from "firebase/functions";
import WhatsAppConnection from "../distributor/whatsapp/WhatsAppConnection";
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
  FaShieldVirus, FaLink, FaTimes, FaUserTimes
} from "react-icons/fa";

// WhatsApp Setup Section Component - Single UI source of truth
const WhatsAppSetupSection = ({ formData, setFormData, user }) => (
  <WhatsAppConnection user={user} formData={formData} setFormData={setFormData} />
);

const ProfileSettings = () => {
  const { t } = useTranslation();
  const { isNativeApp } = usePlatform();
  const navigate = useNavigate();
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
    // Cashfree Partner (payment gateway)
    cashfreeMerchantId: "",
    cashfreeOnboardingStatus: "",
    cashfreeActive: false,
  });
  const [activeSection, setActiveSection] = useState("owner");
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteAccountModal, setShowDeleteAccountModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleteAccountLoading, setDeleteAccountLoading] = useState(false);
  const [cashfreeLoading, setCashfreeLoading] = useState(false);

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
    { id: "payments", label: "Payment Setup", icon: FaCreditCard, color: "from-teal-500 to-cyan-500" },
    { id: "whatsapp", label: "WhatsApp Business", icon: FaWhatsapp, color: "from-green-500 to-emerald-500" },
    { id: "branding", label: t("profile.branding") || "Branding", icon: FaPalette, color: "from-pink-500 to-rose-500" },
    { id: "notifications", label: "Notifications", icon: FaBell, color: "from-yellow-500 to-orange-500" },
    { id: "preferences", label: t("profile.preferences") || "Preferences", icon: FaCog, color: "from-gray-500 to-slate-500" },
    { id: "account", label: "Delete account", icon: FaUserTimes, color: "from-red-500 to-rose-500" },
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
            cashfreeMerchantId: data.cashfreeMerchantId || "",
            cashfreeOnboardingStatus: data.cashfreeOnboardingStatus || "",
            cashfreeActive: data.cashfreeActive === true,
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

  // Apple Guideline 5.1.1(v): Account deletion
  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== "DELETE" || !user) return;
    setDeleteAccountLoading(true);
    try {
      const providerId = user.providerData?.[0]?.providerId;
      if (providerId === "google.com") {
        await reauthenticateWithPopup(user, new GoogleAuthProvider());
      } else if (providerId === "apple.com") {
        await reauthenticateWithPopup(user, new OAuthProvider("apple.com"));
      } else {
        const password = window.prompt("Enter your password to confirm account deletion:");
        if (!password) {
          setDeleteAccountLoading(false);
          return;
        }
        const credential = EmailAuthProvider.credential(user.email, password);
        await reauthenticateWithCredential(user, credential);
      }
      await deleteDoc(doc(db, "businesses", user.uid));
      await deleteUser(user);
      toast.success("Account deleted.");
      navigate("/", { replace: true });
      window.location.reload();
    } catch (err) {
      console.error("Delete account error:", err);
      toast.error(err?.message || "Could not delete account. Try again.");
    } finally {
      setDeleteAccountLoading(false);
      setShowDeleteAccountModal(false);
      setDeleteConfirmText("");
    }
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

  FormField.displayName = "FormField";

  const isMobileLayout = isNativeApp || typeof window !== "undefined" && window.innerWidth < 1024;

  return (
    <div className={`w-full max-w-7xl mx-auto space-y-4 ${isMobileLayout ? "p-3 pb-8" : "p-4 sm:p-6 lg:p-8 space-y-6"}`}>
      {/* Header - compact on mobile */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className={`flex flex-col ${isMobileLayout ? "gap-2" : "md:flex-row md:items-center md:justify-between gap-4"}`}
      >
        <div className="flex-1">
          <h1 className={`font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 via-cyan-400 to-teal-400 ${isMobileLayout ? "text-xl" : "text-3xl"}`}>
            {t("profile.title") || "Profile Settings"}
          </h1>
          <p className="text-gray-400 mt-0.5 text-xs sm:text-sm">Manage your retailer profile and preferences</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-gradient-to-r from-emerald-500/20 via-cyan-500/20 to-teal-500/20 border border-emerald-500/30 rounded-xl px-3 py-2 backdrop-blur-sm"
          >
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-emerald-500/20 rounded-lg">
                <FaChartLine className="w-4 h-4 text-emerald-400" />
              </div>
              <div>
                <div className="flex items-baseline gap-1">
                  <span className={`font-bold text-white ${isMobileLayout ? "text-lg" : "text-2xl"}`}>{profileCompletion}%</span>
                  <span className="text-[10px] text-gray-400">Complete</span>
                </div>
                <div className="w-20 bg-slate-800/50 rounded-full h-1 mt-0.5 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${profileCompletion}%` }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                    className="h-full bg-gradient-to-r from-emerald-500 via-cyan-500 to-teal-500 rounded-full"
                  />
                </div>
              </div>
            </div>
          </motion.div>
          <div className="px-3 py-1.5 bg-emerald-500/20 border border-emerald-500/30 rounded-lg">
            <span className="text-xs text-emerald-300 font-medium">🛍 Retailer</span>
          </div>
        </div>
      </motion.div>

      {/* Section nav: horizontal on mobile, sidebar on desktop */}
      {isMobileLayout ? (
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide -mx-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveSection(item.id)}
                className={`flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition ${
                  isActive ? `bg-gradient-to-r ${item.color} text-white` : "bg-white/10 text-gray-300"
                }`}
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </button>
            );
          })}
        </div>
      ) : null}

      <div className={`grid gap-4 ${isMobileLayout ? "grid-cols-1" : "grid-cols-1 lg:grid-cols-4 gap-6"}`}>
        {/* Sidebar Navigation - desktop only */}
        {!isMobileLayout && (
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
        )}

        {/* Main Content */}
        <div className={isMobileLayout ? "" : "lg:col-span-3"}>
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
              {/* Account / Delete account - Apple Guideline 5.1.1(v), easily discoverable */}
            {activeSection === "account" && (
              <div className={`bg-slate-900/80 border border-white/10 backdrop-blur-md rounded-2xl ${isMobileLayout ? 'p-4' : 'p-6'}`}>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-white flex items-center gap-3">
                    <div className="p-2 bg-red-500/20 rounded-lg">
                      <FaUserTimes className="w-5 h-5 text-red-400" />
                    </div>
                    Delete account
                  </h2>
                </div>
                <p className="text-sm text-gray-400 mb-4">
                  Permanently delete your FLYP business account and all associated data. This cannot be undone.
                </p>
                <button
                  type="button"
                  onClick={() => setShowDeleteAccountModal(true)}
                  className="px-4 py-2 rounded-lg border border-red-500/50 text-red-300 hover:bg-red-500/20 transition"
                >
                  Delete my account
                </button>
              </div>
            )}

              {/* Owner Information Section */}
            {activeSection === "owner" && (
                <div className={`bg-slate-900/80 border border-white/10 backdrop-blur-md rounded-2xl space-y-4 ${isMobileLayout ? 'p-4' : 'p-6 space-y-6'}`}>
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
                <div className={`bg-slate-900/80 border border-white/10 backdrop-blur-md rounded-2xl space-y-4 ${isMobileLayout ? 'p-4' : 'p-6 space-y-6'}`}>
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
                <div className={`bg-slate-900/80 border border-white/10 backdrop-blur-md rounded-2xl space-y-4 ${isMobileLayout ? 'p-4' : 'p-6 space-y-6'}`}>
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
                <div className={`bg-slate-900/80 border border-white/10 backdrop-blur-md rounded-2xl space-y-4 ${isMobileLayout ? 'p-4' : 'p-6 space-y-6'}`}>
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

              {/* Payment Setup (Cashfree) Section */}
              {activeSection === "payments" && (
                <div className={`bg-slate-900/80 border border-white/10 backdrop-blur-md rounded-2xl space-y-4 ${isMobileLayout ? 'p-4' : 'p-6 space-y-6'}`}>
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                      <div className="p-2 bg-teal-500/20 rounded-lg">
                        <FaCreditCard className="w-6 h-6 text-teal-400" />
                      </div>
                      Payment Setup
                    </h2>
                  </div>

                  <div className="bg-teal-500/10 border border-teal-500/30 rounded-xl p-4">
                    <div className="flex items-start gap-3">
                      <FaInfoCircle className="w-5 h-5 text-teal-400 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-sm text-teal-300 font-medium mb-1">Cashfree Payments</p>
                        <p className="text-xs text-gray-400">Connect your payment gateway so you can accept card and UPI payments. You’ll complete a short KYC on Cashfree’s secure page; no login required.</p>
                      </div>
                    </div>
                  </div>

                  {formData.cashfreeActive ? (
                    <div className="bg-emerald-500/20 border border-emerald-500/40 rounded-xl p-6">
                      <div className="flex items-center gap-3">
                        <div className="p-3 bg-emerald-500/30 rounded-full">
                          <FaCheckCircle className="w-8 h-8 text-emerald-400" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-white text-lg">Payment gateway active</h3>
                          <p className="text-sm text-gray-400">You can accept payments. Status is updated automatically.</p>
                        </div>
                      </div>
                    </div>
                  ) : formData.cashfreeMerchantId ? (
                    <div className="space-y-4">
                      <div className="bg-slate-800/60 rounded-xl p-4 border border-white/10">
                        <p className="text-sm text-gray-400 mb-1">Status</p>
                        <p className="text-white font-medium capitalize">{formData.cashfreeOnboardingStatus || "Pending"}</p>
                        <p className="text-xs text-gray-500 mt-1">Complete KYC on Cashfree to activate your gateway.</p>
                      </div>
                      <motion.button
                        onClick={async () => {
                          if (!user || cashfreeLoading) return;
                          setCashfreeLoading(true);
                          try {
                            const token = await user.getIdToken();
                            const res = await fetch("https://asia-south1-stockpilotv1.cloudfunctions.net/cashfreeCreateMerchantAndOnboardingLinkHttp", {
                              method: "POST",
                              headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                              body: JSON.stringify({}),
                            });
                            const data = await res.json().catch(() => ({}));
                            if (res.ok && (data?.success || data?.onboardingLink)) {
                              const userRef = doc(db, "businesses", user.uid);
                              const snap = await getDoc(userRef);
                              if (snap.exists()) {
                                const d = snap.data();
                                setFormData(prev => ({
                                  ...prev,
                                  cashfreeMerchantId: d.cashfreeMerchantId || data.merchantId || prev.cashfreeMerchantId,
                                  cashfreeOnboardingStatus: d.cashfreeOnboardingStatus || data.onboardingStatus || prev.cashfreeOnboardingStatus,
                                  cashfreeActive: d.cashfreeActive === true,
                                }));
                              }
                              if (data?.onboardingLink) window.open(data.onboardingLink, "_blank");
                              toast.success("Open the new tab to complete KYC. We’ll update status when you’re done.");
                            } else {
                              toast.error(data?.error || "Could not get setup link.");
                            }
                          } catch (e) {
                            console.error(e);
                            toast.error(e?.message || "Something went wrong.");
                          } finally {
                            setCashfreeLoading(false);
                          }
                        }}
                        disabled={cashfreeLoading}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className="w-full bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 text-white px-6 py-3 rounded-lg font-medium flex items-center justify-center gap-2 disabled:opacity-60"
                      >
                        {cashfreeLoading ? <FaSpinner className="w-5 h-5 animate-spin" /> : <FaLink className="w-5 h-5" />}
                        {cashfreeLoading ? "Opening…" : "Complete KYC (open setup link)"}
                      </motion.button>
                    </div>
                  ) : (
                    <motion.button
                      onClick={async () => {
                        if (!user || cashfreeLoading) return;
                        if (!formData.email?.trim()) {
                          toast.error("Please save your email in Owner Info first.");
                          return;
                        }
                        setCashfreeLoading(true);
                        try {
                          const token = await user.getIdToken();
                          const res = await fetch("https://asia-south1-stockpilotv1.cloudfunctions.net/cashfreeCreateMerchantAndOnboardingLinkHttp", {
                            method: "POST",
                            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                            body: JSON.stringify({}),
                          });
                          const data = await res.json().catch(() => ({}));
                          if (res.ok && (data?.success || data?.onboardingLink)) {
                            const userRef = doc(db, "businesses", user.uid);
                            const snap = await getDoc(userRef);
                            if (snap.exists()) {
                              const d = snap.data();
                              setFormData(prev => ({
                                ...prev,
                                cashfreeMerchantId: d.cashfreeMerchantId || data.merchantId || prev.cashfreeMerchantId,
                                cashfreeOnboardingStatus: d.cashfreeOnboardingStatus || data.onboardingStatus || prev.cashfreeOnboardingStatus,
                                cashfreeActive: d.cashfreeActive === true,
                              }));
                            }
                            if (data?.onboardingLink) window.open(data.onboardingLink, "_blank");
                            toast.success("Open the new tab to complete setup. We’ll update status when you’re done.");
                          } else {
                            toast.error(data?.error || "Could not start setup.");
                          }
                        } catch (e) {
                          console.error(e);
                          toast.error(e?.message || "Something went wrong.");
                        } finally {
                          setCashfreeLoading(false);
                        }
                      }}
                      disabled={cashfreeLoading}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="w-full bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 text-white px-6 py-4 rounded-xl font-medium flex items-center justify-center gap-3"
                    >
                      {cashfreeLoading ? <FaSpinner className="w-6 h-6 animate-spin" /> : <FaCreditCard className="w-6 h-6" />}
                      {cashfreeLoading ? "Setting up..." : "Connect Cashfree"}
                    </motion.button>
                  )}
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
                <div className={`bg-slate-900/80 border border-white/10 backdrop-blur-md rounded-2xl space-y-4 ${isMobileLayout ? 'p-4' : 'p-6 space-y-6'}`}>
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
                <div className={`bg-slate-900/80 border border-white/10 backdrop-blur-md rounded-2xl space-y-4 ${isMobileLayout ? 'p-4' : 'p-6 space-y-6'}`}>
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
                <div className={`bg-slate-900/80 border border-white/10 backdrop-blur-md rounded-2xl space-y-4 ${isMobileLayout ? 'p-4' : 'p-6 space-y-6'}`}>
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

                  {/* Apple Guideline 5.1.1(v): Account deletion */}
                  <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-6 border-white/10">
                    <h4 className="font-semibold mb-2 flex items-center gap-2 text-red-300">
                      <FaUserTimes className="w-5 h-5" />
                      Delete Account
                    </h4>
                    <p className="text-sm text-gray-400 mb-4">
                      Permanently delete your FLYP business account and all associated data. This cannot be undone.
                    </p>
                    <button
                      type="button"
                      onClick={() => setShowDeleteAccountModal(true)}
                      className="px-4 py-2 rounded-lg border border-red-500/50 text-red-300 hover:bg-red-500/20 transition"
                    >
                      Delete my account
                    </button>
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

        {/* Delete Account Modal - Apple 5.1.1(v) */}
        {showDeleteAccountModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <div className="bg-slate-900 border border-white/10 rounded-2xl p-6 max-w-md w-full shadow-xl">
              <h3 className="text-lg font-bold text-white mb-2">Delete Account</h3>
              <p className="text-sm text-gray-400 mb-4">
                This will permanently delete your account and data. Type <strong className="text-red-400">DELETE</strong> to confirm.
              </p>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="Type DELETE to confirm"
                className="w-full px-4 py-3 rounded-lg bg-slate-800 border border-white/10 text-white placeholder-gray-500 mb-4"
              />
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => { setShowDeleteAccountModal(false); setDeleteConfirmText(""); }}
                  className="flex-1 py-3 rounded-lg border border-white/20 text-white hover:bg-white/10 transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteAccount}
                  disabled={deleteConfirmText !== "DELETE" || deleteAccountLoading}
                  className="flex-1 py-3 rounded-lg bg-red-500 text-white hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  {deleteAccountLoading ? "Deleting…" : "Delete Account"}
                </button>
              </div>
            </div>
          </div>
        )}
        </div>
      </div>
    </div>
  );
};

export default ProfileSettings;

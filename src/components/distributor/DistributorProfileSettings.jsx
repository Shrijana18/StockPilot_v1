import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getAuth } from "firebase/auth";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db, storage } from "../../firebase/firebaseConfig";
import { toast } from "react-toastify";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { useTranslation } from "react-i18next";
import LanguageSwitcher from "../common/LanguageSwitcher";

const DistributorProfileSettings = () => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    ownerName: "",
    email: "",
    phone: "",
    businessName: "",
    distributorName: "",
    address: "",
    city: "",
    state: "",
    pincode: "",
    logoUrl: "",
    gstNumber: "",
    businessType: "Distributor",
    invoicePreference: "Minimal",
    whatsappAlerts: false,
    profileVersion: 0,
    lastUpdated: "",
    businessMode: "Online",
    flypId: "",
  });
  const [activeSection, setActiveSection] = useState("owner");
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const auth = getAuth();
  const user = auth.currentUser;

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;
      const userRef = doc(db, "businesses", user.uid);
      const snapshot = await getDoc(userRef);
      if (snapshot.exists()) {
        const data = snapshot.data();
        setFormData((prev) => ({
          ...prev,
          ...data,
          ownerName: data.ownerName || data.name || "",
          businessName: data.businessName || data.distributorName || "",
          distributorName: data.distributorName || data.businessName || "",
          email: data.email || user.email || "",
        }));
        if (data.logoUrl) {
          setLogoPreview(data.logoUrl);
        }
      }
      setLoading(false);
    };
    fetchData();
  }, [user]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
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
      let updatedData = {
        ...formData,
        name: formData.ownerName,
        distributorName: formData.distributorName || formData.businessName,
        businessName: formData.businessName || formData.distributorName,
      };

      if (logoFile) {
        const storageRef = ref(storage, `logos/${user.uid}`);
        await uploadBytes(storageRef, logoFile);
        const downloadURL = await getDownloadURL(storageRef);
        updatedData.logoUrl = downloadURL;
      }

      updatedData.profileVersion = (formData.profileVersion || 0) + 1;
      updatedData.lastUpdated = new Date().toISOString();

      const userRef = doc(db, "businesses", user.uid);
      await updateDoc(userRef, updatedData);

      toast.success(t("profile.changesSaved") || "Profile updated successfully!");
    } catch (err) {
      console.error("Update failed", err);
      toast.error("Failed to update profile.");
    } finally {
      setIsSaving(false);
    }
  };

  // Generate unique FLYP ID
  const generateFlypId = async () => {
    if (!user) return;

    const confirm = window.confirm(t("profile.confirmFlypId") || "Are you sure you want to generate your unique FLYP ID? This cannot be changed later.");
    if (!confirm) return;

    const randomId = "FLYP-" + Math.random().toString(36).substring(2, 8).toUpperCase();
    const userRef = doc(db, "businesses", user.uid);
    await updateDoc(userRef, { flypId: randomId });
    setFormData((prev) => ({ ...prev, flypId: randomId }));
    toast.success("✅ " + (t("profile.flypIdCreated") || "Your FLYP ID has been created!"));
  };

  if (loading) return <div className="flex items-center justify-center p-8 text-white">{t("profile.loadingProfile")}</div>;

  return (
    <div className="w-full max-w-6xl mx-auto p-4 sm:p-6 md:p-8 bg-slate-900/80 border border-white/10 backdrop-blur-md shadow-xl rounded-xl relative z-0">
      <h2 className="text-2xl font-bold mb-6 flex items-center gap-2 bg-clip-text text-transparent bg-gradient-to-r from-sky-300 via-blue-400 to-indigo-400">
        {t("profile.title")}
        <span title={t("profile.distributorRole") || "Your business role in the system"} className="ml-1 px-2 py-1 rounded-full bg-indigo-100 text-indigo-700 text-xs font-medium">
          🏢 {t("distributor.distributorDashboard") || "Distributor"}
        </span>
      </h2>

      <div className="flex flex-col md:flex-row gap-6 min-h-0">
        <div className="w-full md:w-1/4 flex-shrink-0">
          <div className="space-y-4 sticky top-4">
            <button
              onClick={() => setActiveSection("owner")}
              className={`w-full py-2 px-4 rounded-lg shadow transition-all ${
                activeSection === "owner"
                  ? "bg-indigo-600 hover:bg-indigo-700 text-white"
                  : "bg-slate-800/60 border border-white/10 text-white hover:bg-slate-700/60"
              }`}
            >
              <div className="flex items-center gap-2 justify-center">
                <span>👤</span>
                <span>{t("profile.ownerInfo")}</span>
              </div>
            </button>
            <button
              onClick={() => setActiveSection("business")}
              className={`w-full py-2 px-4 rounded-lg shadow transition-all ${
                activeSection === "business"
                  ? "bg-indigo-600 hover:bg-indigo-700 text-white"
                  : "bg-slate-800/60 border border-white/10 text-white hover:bg-slate-700/60"
              }`}
            >
              <div className="flex items-center gap-2 justify-center">
                <span>🏢</span>
                <span>{t("profile.businessDetails")}</span>
              </div>
            </button>
            <button
              onClick={() => setActiveSection("branding")}
              className={`w-full py-2 px-4 rounded-lg shadow transition-all ${
                activeSection === "branding"
                  ? "bg-indigo-600 hover:bg-indigo-700 text-white"
                  : "bg-slate-800/60 border border-white/10 text-white hover:bg-slate-700/60"
              }`}
            >
              <div className="flex items-center gap-2 justify-center">
                <span>🎨</span>
                <span>{t("profile.branding")}</span>
              </div>
            </button>
            <button
              onClick={() => setActiveSection("preferences")}
              className={`w-full py-2 px-4 rounded-lg shadow transition-all ${
                activeSection === "preferences"
                  ? "bg-indigo-600 hover:bg-indigo-700 text-white"
                  : "bg-slate-800/60 border border-white/10 text-white hover:bg-slate-700/60"
              }`}
            >
              <div className="flex items-center gap-2 justify-center">
                <span>⚙️</span>
                <span>{t("profile.preferences")}</span>
              </div>
            </button>
          </div>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={activeSection}
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.3 }}
            className="w-full md:w-3/4 flex-1 min-w-0"
          >
            {activeSection === "owner" && (
              <div className="bg-slate-900/80 border border-white/10 backdrop-blur-md shadow-xl rounded-xl p-6 space-y-6">
                <h3 className="text-lg font-semibold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-sky-300 via-blue-400 to-indigo-400">
                  {t("profile.ownerInformation")}
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="block mb-1 font-medium text-gray-300">{t("profile.ownerName")}</label>
                    <input
                      name="ownerName"
                      value={formData.ownerName}
                      onChange={handleChange}
                      className="w-full bg-slate-800/60 border border-white/10 text-white placeholder-gray-400 px-3 py-2 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder={t("profile.enterOwnerName")}
                    />
                  </div>
                  <div>
                    <label className="block mb-1 font-medium text-gray-300">{t("profile.emailAddress")}</label>
                    <input
                      name="email"
                      type="email"
                      value={formData.email}
                      onChange={handleChange}
                      className="w-full bg-slate-800/60 border border-white/10 text-white placeholder-gray-400 px-3 py-2 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder={t("profile.enterEmail")}
                    />
                  </div>
                  <div>
                    <label className="block mb-1 font-medium text-gray-300">{t("profile.phoneNumber")}</label>
                    <input
                      name="phone"
                      type="tel"
                      value={formData.phone}
                      onChange={handleChange}
                      className="w-full bg-slate-800/60 border border-white/10 text-white placeholder-gray-400 px-3 py-2 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder={t("profile.enterPhoneNumber")}
                    />
                  </div>
                </div>
                <div className="rounded-lg border border-white/10 bg-slate-800/60 p-4">
                  <h4 className="font-semibold mb-2 flex items-center gap-2 bg-clip-text text-transparent bg-gradient-to-r from-sky-300 via-blue-400 to-indigo-400">
                    FLYP ID
                    {formData.flypId && (
                      <span className="text-xs text-indigo-400 font-semibold bg-indigo-900/30 px-2 py-1 rounded-full">
                        ℹ️ {t("common.info")}
                      </span>
                    )}
                  </h4>
                  {formData.flypId ? (
                    <div className="flex items-center gap-2">
                      <input
                        disabled
                        value={formData.flypId}
                        className="w-full bg-slate-700/50 border border-white/10 text-gray-400 cursor-not-allowed px-3 py-2 rounded"
                      />
                      <span className="ml-2 text-green-400 text-xs font-semibold">✅ {t("profile.flypIdLinked") || "FLYP ID Linked"}</span>
                    </div>
                  ) : (
                    <button
                      onClick={generateFlypId}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded transition-all"
                    >
                      🔐 {t("profile.generateFlypId") || "Generate My FLYP ID"}
                    </button>
                  )}
                </div>
                <div className="mt-6 text-right">
                  <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className={`bg-indigo-600 hover:bg-indigo-700 text-white rounded px-5 py-2 transition ${
                      isSaving ? "opacity-60 cursor-not-allowed" : ""
                    }`}
                  >
                    {isSaving ? t("common.loading") : `💾 ${t("profile.saveChanges")}`}
                  </button>
                </div>
              </div>
            )}

            {activeSection === "business" && (
              <div className="bg-slate-900/80 border border-white/10 backdrop-blur-md shadow-xl rounded-xl p-6 space-y-6">
                <h3 className="text-lg font-semibold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-sky-300 via-blue-400 to-indigo-400">
                  {t("profile.businessDetails")}
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="block mb-1 font-medium text-gray-300">{t("profile.businessName")}</label>
                    <input
                      name="businessName"
                      value={formData.businessName}
                      onChange={handleChange}
                      className="w-full bg-slate-800/60 border border-white/10 text-white placeholder-gray-400 px-3 py-2 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder={t("profile.businessName")}
                    />
                  </div>
                  <div>
                    <label className="block mb-1 font-medium text-gray-300">{t("profile.distributorName") || "Distributor Name"}</label>
                    <input
                      name="distributorName"
                      value={formData.distributorName}
                      onChange={handleChange}
                      className="w-full bg-slate-800/60 border border-white/10 text-white placeholder-gray-400 px-3 py-2 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder={t("profile.distributorName") || "Enter distributor name"}
                    />
                  </div>
                  <div>
                    <label className="block mb-1 font-medium text-gray-300">{t("retailers.address")}</label>
                    <textarea
                      name="address"
                      value={formData.address}
                      onChange={handleChange}
                      rows={3}
                      className="w-full bg-slate-800/60 border border-white/10 text-white placeholder-gray-400 px-3 py-2 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder={t("retailers.address")}
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block mb-1 font-medium text-gray-300">{t("retailers.city")}</label>
                      <input
                        name="city"
                        value={formData.city}
                        onChange={handleChange}
                        className="w-full bg-slate-800/60 border border-white/10 text-white placeholder-gray-400 px-3 py-2 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        placeholder={t("retailers.city")}
                      />
                    </div>
                    <div>
                      <label className="block mb-1 font-medium text-gray-300">{t("retailers.state")}</label>
                      <input
                        name="state"
                        value={formData.state}
                        onChange={handleChange}
                        className="w-full bg-slate-800/60 border border-white/10 text-white placeholder-gray-400 px-3 py-2 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        placeholder={t("retailers.state")}
                      />
                    </div>
                    <div>
                      <label className="block mb-1 font-medium text-gray-300">{t("retailers.pincode")}</label>
                      <input
                        name="pincode"
                        value={formData.pincode}
                        onChange={handleChange}
                        className="w-full bg-slate-800/60 border border-white/10 text-white placeholder-gray-400 px-3 py-2 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        placeholder={t("retailers.pincode")}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block mb-1 font-medium text-gray-300">{t("profile.gstNumber")}</label>
                    <input
                      name="gstNumber"
                      value={formData.gstNumber}
                      onChange={handleChange}
                      className="w-full bg-slate-800/60 border border-white/10 text-white placeholder-gray-400 px-3 py-2 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder={t("profile.gstNumber")}
                    />
                  </div>
                  <div>
                    <label className="block mb-1 font-medium text-gray-300">{t("profile.businessType")}</label>
                    <input
                      name="businessType"
                      value={formData.businessType}
                      disabled
                      className="w-full bg-slate-700/50 border border-white/10 text-gray-400 cursor-not-allowed px-3 py-2 rounded"
                    />
                  </div>
                  <div>
                    <label className="block mb-1 font-medium text-gray-300">{t("profile.invoicePreference")}</label>
                    <select
                      name="invoicePreference"
                      value={formData.invoicePreference}
                      onChange={handleChange}
                      className="w-full bg-slate-800/60 border border-white/10 text-white px-3 py-2 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="Minimal">{t("profile.invoiceMinimal") || "Minimal"}</option>
                      <option value="Detailed">{t("profile.invoiceDetailed") || "Detailed"}</option>
                      <option value="Modern">{t("profile.invoiceModern") || "Modern"}</option>
                    </select>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-slate-800/30 rounded-lg">
                    <span className="font-medium text-gray-300">{t("profile.businessMode") || "Business Mode"}</span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={formData.businessMode === "Online"}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            businessMode: e.target.checked ? "Online" : "Offline",
                          }))
                        }
                      />
                      <div className="w-11 h-6 bg-slate-800/60 border border-white/10 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-500 rounded-full peer peer-checked:bg-green-500 transition-all"></div>
                      <span className="ml-3 text-sm text-gray-400">{formData.businessMode}</span>
                    </label>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-slate-800/30 rounded-lg">
                    <span className="font-medium text-gray-300">{t("profile.whatsappAlerts")}</span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={formData.whatsappAlerts}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, whatsappAlerts: e.target.checked }))
                        }
                      />
                      <div className="w-11 h-6 bg-slate-800/60 border border-white/10 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-500 rounded-full peer peer-checked:bg-blue-500 transition-all"></div>
                      <span className="ml-3 text-sm text-gray-400">
                        {formData.whatsappAlerts ? t("common.yes") : t("common.no")}
                      </span>
                    </label>
                  </div>
                </div>
                <div className="mt-6 text-right">
                  <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className={`bg-indigo-600 hover:bg-indigo-700 text-white rounded px-5 py-2 transition ${
                      isSaving ? "opacity-60 cursor-not-allowed" : ""
                    }`}
                  >
                    {isSaving ? t("common.loading") : `💾 ${t("profile.saveChanges")}`}
                  </button>
                </div>
              </div>
            )}

            {activeSection === "preferences" && (
              <div className="bg-slate-900/80 border border-white/10 backdrop-blur-md shadow-xl rounded-xl p-6 space-y-6">
                <h3 className="text-lg font-semibold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-sky-300 via-blue-400 to-indigo-400">
                  {t("profile.preferences")}
                </h3>
                <div className="space-y-6">
                  <div className="rounded-lg border border-white/10 bg-slate-800/80 p-6">
                    <h4 className="font-semibold mb-4 flex items-center gap-2 text-white">
                      <span>🌐</span>
                      {t("language.changeLanguage")}
                    </h4>
                    <p className="text-sm text-gray-400 mb-4">
                      {t("language.currentLanguage")}
                    </p>
                    <div className="flex justify-center items-center">
                      <LanguageSwitcher />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeSection === "branding" && (
              <div className="bg-slate-900/80 border border-white/10 backdrop-blur-md shadow-xl rounded-xl p-6 space-y-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 bg-clip-text text-transparent bg-gradient-to-r from-sky-300 via-blue-400 to-indigo-400">
                  🎨 {t("profile.branding")}
                  <span className="text-sm text-gray-400">
                    ({t("profile.customizeBrand") || "Customize your brand identity"})
                  </span>
                </h3>
                <div className="grid md:grid-cols-2 gap-6 items-start">
                  <div>
                    <label className="block mb-2 font-medium text-gray-300">{t("profile.logo")}</label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleLogoUpload}
                      className="w-full bg-slate-800/60 border border-white/10 text-white placeholder-gray-400 rounded-md px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    {logoPreview && (
                      <div className="mt-3">
                        <img
                          src={logoPreview}
                          alt="Logo Preview"
                          className="w-24 h-24 rounded-full ring-2 ring-indigo-500 shadow-md object-cover"
                        />
                        <p className="text-xs text-gray-400 mt-1">{t("profile.logoPreview") || "Preview of your logo"}</p>
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    {formData.lastUpdated && (
                      <p className="text-sm text-gray-400">
                        <strong>🕒 {t("profile.lastUpdated") || "Last Updated"}:</strong>{" "}
                        {new Date(formData.lastUpdated).toLocaleString()}
                      </p>
                    )}
                    {formData.profileVersion > 0 && (
                      <p className="text-sm text-gray-400">
                        <strong>📄 {t("profile.profileVersion") || "Profile Version"}:</strong> {formData.profileVersion}
                      </p>
                    )}
                  </div>
                </div>
                <div className="mt-6 text-right">
                  <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className={`bg-indigo-600 hover:bg-indigo-700 text-white rounded px-5 py-2 transition ${
                      isSaving ? "opacity-60 cursor-not-allowed" : ""
                    }`}
                  >
                    {isSaving ? t("common.loading") : `💾 ${t("profile.saveChanges")}`}
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};

export default DistributorProfileSettings;


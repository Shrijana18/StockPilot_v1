import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db, auth, functions } from "../../firebase/firebaseConfig";
import { httpsCallable } from "firebase/functions";
import { toast } from "react-toastify";

const MerchantOnboarding = ({ isOpen, onClose, onComplete }) => {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    // Business Information
    businessName: "",
    businessType: "", // sole_proprietorship, partnership, private_limited, llp, etc.
    businessCategory: "", // retail, wholesale, manufacturing, services, etc.
    gstin: "",
    pan: "",
    
    // Contact Information
    email: "",
    phone: "",
    address: "",
    city: "",
    state: "",
    pincode: "",
    
    // Bank Account Details (for settlements)
    bankAccountNumber: "",
    bankIfsc: "",
    bankName: "",
    accountHolderName: "",
    
    // Business Documents (optional for now, can be added later)
    // panDocument: null,
    // gstCertificate: null,
    // bankStatement: null,
  });

  const [userInfo, setUserInfo] = useState(null);
  const [merchantStatus, setMerchantStatus] = useState(null);

  useEffect(() => {
    if (!isOpen) return;
    
    const loadUserInfo = async () => {
      const uid = auth.currentUser?.uid;
      if (!uid) return;
      
      try {
        const userDoc = await getDoc(doc(db, "businesses", uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          setUserInfo(data);
          
          // Pre-fill form with existing user data
          setFormData(prev => ({
            ...prev,
            businessName: data.businessName || data.distributorName || "",
            email: data.email || "",
            phone: data.phone || "",
            address: data.address || "",
            city: data.city || "",
            state: data.state || "",
            gstin: data.gstin || data.gstNumber || "",
            pan: data.pan || "",
          }));
        }
        
        // Check if merchant account already exists
        const billingPrefs = await getDoc(doc(db, "businesses", uid, "preferences", "billing"));
        if (billingPrefs.exists()) {
          const billingData = billingPrefs.data();
          if (billingData.payment?.card?.merchantAccountId) {
            setMerchantStatus({
              status: billingData.payment?.card?.merchantStatus || "active",
              merchantId: billingData.payment?.card?.merchantAccountId,
            });
          }
        }
      } catch (error) {
        console.error("Error loading user info:", error);
      }
    };
    
    loadUserInfo();
  }, [isOpen]);

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const validateStep = (stepNum) => {
    if (stepNum === 1) {
      if (!formData.businessName || !formData.businessType || !formData.businessCategory) {
        toast.error("Please fill all required business information");
        return false;
      }
      if (!formData.gstin || formData.gstin.length !== 15) {
        toast.error("Please enter a valid 15-character GSTIN");
        return false;
      }
      if (!formData.pan || formData.pan.length !== 10) {
        toast.error("Please enter a valid 10-character PAN");
        return false;
      }
    }
    if (stepNum === 2) {
      if (!formData.email || !formData.phone || !formData.address || !formData.city || !formData.state || !formData.pincode) {
        toast.error("Please fill all contact information");
        return false;
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email)) {
        toast.error("Please enter a valid email address");
        return false;
      }
      // Extract 10 digits from phone (remove +91 or other prefixes)
      const phoneDigits = formData.phone.replace(/\D/g, "").slice(-10);
      const phoneRegex = /^[6-9]\d{9}$/;
      if (!phoneRegex.test(phoneDigits)) {
        toast.error("Please enter a valid 10-digit Indian phone number (starting with 6-9)");
        return false;
      }
    }
    if (stepNum === 3) {
      if (!formData.bankAccountNumber || !formData.bankIfsc || !formData.bankName || !formData.accountHolderName) {
        toast.error("Please fill all bank account details");
        return false;
      }
      if (formData.bankIfsc.length !== 11) {
        toast.error("IFSC code must be 11 characters");
        return false;
      }
    }
    return true;
  };

  const handleNext = () => {
    if (validateStep(step)) {
      setStep(prev => prev + 1);
    }
  };

  const handleBack = () => {
    setStep(prev => prev - 1);
  };

  const handleSubmit = async () => {
    if (!validateStep(3)) return;
    
    setLoading(true);
    try {
      const uid = auth.currentUser?.uid;
      if (!uid) {
        toast.error("User not authenticated");
        setLoading(false);
        return;
      }

      // Call Firebase Cloud Function to create merchant account
      const createMerchantAccount = httpsCallable(functions, "createMerchantAccount");
      const result = await createMerchantAccount({
        businessInfo: {
          businessName: formData.businessName,
          businessType: formData.businessType,
          businessCategory: formData.businessCategory,
          gstin: formData.gstin.toUpperCase(),
          pan: formData.pan.toUpperCase(),
        },
        contactInfo: {
          email: formData.email,
          phone: formData.phone.replace(/\D/g, "").slice(-10), // Ensure 10 digits only
          address: formData.address,
          city: formData.city,
          state: formData.state,
          pincode: formData.pincode,
        },
        bankInfo: {
          accountNumber: formData.bankAccountNumber,
          ifsc: formData.bankIfsc.toUpperCase(),
          bankName: formData.bankName,
          accountHolderName: formData.accountHolderName,
        },
        userId: uid,
      });

      if (result.data.success) {
        // Update billing preferences with merchant account info
        const billingRef = doc(db, "businesses", uid, "preferences", "billing");
        const billingSnap = await getDoc(billingRef);
        const existingBilling = billingSnap.exists() ? billingSnap.data() : {};
        
        await setDoc(billingRef, {
          ...existingBilling,
          payment: {
            ...existingBilling.payment,
            card: {
              ...existingBilling.payment?.card,
              enabled: true,
              gateway: result.data.gateway || "razorpay",
              merchantAccountId: result.data.merchantId,
              merchantStatus: result.data.status || "pending",
              paymentLinkEnabled: true,
              onboardedAt: new Date().toISOString(),
            },
          },
        }, { merge: true });

        toast.success("Merchant account created successfully! Your payment gateway will be activated shortly.");
        onComplete?.(result.data);
        onClose();
      } else {
        throw new Error(result.data.error || "Failed to create merchant account");
      }
    } catch (error) {
      console.error("Error creating merchant account:", error);
      
      // Provide more specific error messages
      let errorMessage = "Failed to create merchant account. Please try again.";
      
      if (error.code === "functions/not-found") {
        errorMessage = "Payment gateway service is not available. Please contact support.";
      } else if (error.code === "functions/permission-denied") {
        errorMessage = "You don't have permission to create a merchant account. Please contact support.";
      } else if (error.code === "functions/unauthenticated") {
        errorMessage = "Please log in again to continue.";
      } else if (error.message) {
        errorMessage = error.message;
      } else if (error.details) {
        errorMessage = error.details;
      }
      
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  // If merchant account already exists, show status
  if (merchantStatus) {
    return createPortal(
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
        <div className="w-full max-w-2xl mx-4 rounded-xl border border-white/10 bg-white/10 backdrop-blur-2xl text-white shadow-xl">
          <div className="p-4 md:p-6 border-b border-white/10 flex items-center justify-between">
            <h2 className="text-lg md:text-xl font-semibold">Payment Gateway Status</h2>
            <button className="opacity-80 hover:opacity-100 text-2xl leading-none" onClick={onClose}>×</button>
          </div>
          <div className="p-4 md:p-6 space-y-4">
            <div className="p-4 rounded-lg bg-emerald-500/20 border border-emerald-500/30">
              <p className="font-semibold text-emerald-300 mb-2">✓ Merchant Account Active</p>
              <p className="text-sm text-white/70">Your payment gateway is set up and ready to accept card payments.</p>
              <p className="text-xs text-white/60 mt-2">Merchant ID: {merchantStatus.merchantId}</p>
            </div>
            <button
              className="w-full px-4 py-2 rounded-lg font-medium text-slate-900 bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 hover:shadow-[0_8px_24px_rgba(16,185,129,0.35)]"
              onClick={onClose}
            >
              Close
            </button>
          </div>
        </div>
      </div>,
      document.body
    );
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm overflow-y-auto">
      <div className="w-full max-w-3xl mx-4 my-8 rounded-xl border border-white/10 bg-white/10 backdrop-blur-2xl text-white shadow-xl">
        <div className="p-4 md:p-6 border-b border-white/10 flex items-center justify-between">
          <div>
            <h2 className="text-lg md:text-xl font-semibold">Setup Payment Gateway</h2>
            <p className="text-sm text-white/70 mt-1">Step {step} of 3</p>
          </div>
          <button className="opacity-80 hover:opacity-100 text-2xl leading-none" onClick={onClose} disabled={loading}>×</button>
        </div>

        <div className="p-4 md:p-6 space-y-6">
          {/* Step 1: Business Information */}
          {step === 1 && (
            <div className="space-y-4">
              <h3 className="font-semibold text-base">Business Information</h3>
              
              <div>
                <label className="block text-sm opacity-80 mb-1">Business Name *</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20"
                  value={formData.businessName}
                  onChange={(e) => handleChange("businessName", e.target.value)}
                  placeholder="Enter your business name"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm opacity-80 mb-1">Business Type *</label>
                  <select
                    className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20"
                    value={formData.businessType}
                    onChange={(e) => handleChange("businessType", e.target.value)}
                  >
                    <option value="">Select Type</option>
                    <option value="sole_proprietorship">Sole Proprietorship</option>
                    <option value="partnership">Partnership</option>
                    <option value="private_limited">Private Limited</option>
                    <option value="llp">Limited Liability Partnership (LLP)</option>
                    <option value="public_limited">Public Limited</option>
                    <option value="huf">HUF (Hindu Undivided Family)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm opacity-80 mb-1">Business Category *</label>
                  <select
                    className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20"
                    value={formData.businessCategory}
                    onChange={(e) => handleChange("businessCategory", e.target.value)}
                  >
                    <option value="">Select Category</option>
                    <option value="retail">Retail</option>
                    <option value="wholesale">Wholesale</option>
                    <option value="manufacturing">Manufacturing</option>
                    <option value="services">Services</option>
                    <option value="ecommerce">E-commerce</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm opacity-80 mb-1">GSTIN *</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 uppercase"
                    value={formData.gstin}
                    onChange={(e) => handleChange("gstin", e.target.value.toUpperCase())}
                    placeholder="15-character GSTIN"
                    maxLength={15}
                  />
                </div>

                <div>
                  <label className="block text-sm opacity-80 mb-1">PAN *</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 uppercase"
                    value={formData.pan}
                    onChange={(e) => handleChange("pan", e.target.value.toUpperCase())}
                    placeholder="10-character PAN"
                    maxLength={10}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Contact Information */}
          {step === 2 && (
            <div className="space-y-4">
              <h3 className="font-semibold text-base">Contact Information</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm opacity-80 mb-1">Email *</label>
                  <input
                    type="email"
                    className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20"
                    value={formData.email}
                    onChange={(e) => handleChange("email", e.target.value)}
                    placeholder="business@example.com"
                  />
                </div>

                <div>
                  <label className="block text-sm opacity-80 mb-1">Phone *</label>
                  <input
                    type="tel"
                    className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20"
                    value={formData.phone}
                    onChange={(e) => {
                      // Allow +91 prefix or just digits, strip everything else
                      let value = e.target.value.replace(/[^\d+]/g, "");
                      // If starts with +91, keep it, otherwise just digits
                      if (value.startsWith("+91")) {
                        value = "+91" + value.slice(3).replace(/\D/g, "").slice(0, 10);
                      } else {
                        value = value.replace(/\D/g, "").slice(0, 10);
                      }
                      handleChange("phone", value);
                    }}
                    placeholder="10-digit phone number (e.g., 9828738372 or +919828738372)"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm opacity-80 mb-1">Address *</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20"
                  value={formData.address}
                  onChange={(e) => handleChange("address", e.target.value)}
                  placeholder="Street address"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm opacity-80 mb-1">City *</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20"
                    value={formData.city}
                    onChange={(e) => handleChange("city", e.target.value)}
                    placeholder="City"
                  />
                </div>

                <div>
                  <label className="block text-sm opacity-80 mb-1">State *</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20"
                    value={formData.state}
                    onChange={(e) => handleChange("state", e.target.value)}
                    placeholder="State"
                  />
                </div>

                <div>
                  <label className="block text-sm opacity-80 mb-1">Pincode *</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20"
                    value={formData.pincode}
                    onChange={(e) => handleChange("pincode", e.target.value.replace(/\D/g, ""))}
                    placeholder="6-digit pincode"
                    maxLength={6}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Bank Account Details */}
          {step === 3 && (
            <div className="space-y-4">
              <h3 className="font-semibold text-base">Bank Account Details (for Settlements)</h3>
              <p className="text-sm text-white/70">This account will receive payment settlements from card transactions.</p>
              
              <div>
                <label className="block text-sm opacity-80 mb-1">Account Holder Name *</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20"
                  value={formData.accountHolderName}
                  onChange={(e) => handleChange("accountHolderName", e.target.value)}
                  placeholder="Name as per bank account"
                />
              </div>

              <div>
                <label className="block text-sm opacity-80 mb-1">Bank Name *</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20"
                  value={formData.bankName}
                  onChange={(e) => handleChange("bankName", e.target.value)}
                  placeholder="Bank name"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm opacity-80 mb-1">Account Number *</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20"
                    value={formData.bankAccountNumber}
                    onChange={(e) => handleChange("bankAccountNumber", e.target.value.replace(/\D/g, ""))}
                    placeholder="Bank account number"
                  />
                </div>

                <div>
                  <label className="block text-sm opacity-80 mb-1">IFSC Code *</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 uppercase"
                    value={formData.bankIfsc}
                    onChange={(e) => handleChange("bankIfsc", e.target.value.toUpperCase())}
                    placeholder="11-character IFSC"
                    maxLength={11}
                  />
                </div>
              </div>

              <div className="p-4 rounded-lg bg-blue-500/20 border border-blue-500/30">
                <p className="text-sm text-blue-200">
                  <strong>Note:</strong> Your merchant account will be created automatically. 
                  Once approved (usually within 24-48 hours), you'll be able to accept card payments. 
                  You'll receive email notifications about the status.
                </p>
              </div>
            </div>
          )}

          {/* Progress Indicator */}
          <div className="flex gap-2">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={`flex-1 h-2 rounded ${
                  s <= step ? "bg-emerald-400" : "bg-white/20"
                }`}
              />
            ))}
          </div>
        </div>

        {/* Navigation Buttons */}
        <div className="p-4 md:p-6 border-t border-white/10 flex items-center justify-between">
          <button
            className="px-4 py-2 rounded-lg border border-white/20 hover:bg-white/10 transition"
            onClick={step === 1 ? onClose : handleBack}
            disabled={loading}
          >
            {step === 1 ? "Cancel" : "Back"}
          </button>
          {step < 3 ? (
            <button
              className="px-4 py-2 rounded-lg font-medium text-slate-900 bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 hover:shadow-[0_8px_24px_rgba(16,185,129,0.35)]"
              onClick={handleNext}
              disabled={loading}
            >
              Next
            </button>
          ) : (
            <button
              className="px-4 py-2 rounded-lg font-medium text-slate-900 bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 hover:shadow-[0_8px_24px_rgba(16,185,129,0.35)] disabled:opacity-50"
              onClick={handleSubmit}
              disabled={loading}
            >
              {loading ? "Creating Account..." : "Submit & Create Account"}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default MerchantOnboarding;


import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { db, auth, storage } from "../firebase/firebaseConfig";
import { collection, addDoc, getDocs, query, orderBy, deleteDoc, doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { toast } from "react-toastify";

const LeadManagement = () => {
  const [activeTab, setActiveTab] = useState("list"); // 'list' | 'exhibitor' | 'distributor'
  const [leads, setLeads] = useState([]);
  const [filterType, setFilterType] = useState("all"); // 'all' | 'exhibitor' | 'distributor'
  const [searchQuery, setSearchQuery] = useState("");
  const [editingLead, setEditingLead] = useState(null);
  const [viewingLead, setViewingLead] = useState(null); // Lead being viewed in detail modal

  // Use public collection for event leads (no authentication required)
  const LEADS_COLLECTION = "eventLeads";

  // Exhibitor form state
  const [exhibitorForm, setExhibitorForm] = useState({
    companyName: "",
    productCategory: "",
    totalSKU: "",
    website: "",
    averageAreaOfBusiness: "",
    contactPersonName: "",
    designation: "",
    phone: "",
    email: "",
    conversationQuality: "", // 'excellent' | 'good' | 'okay' | 'poor' | 'no'
    currentSoftware: "",
    problemsFacing: "",
    hasDistributorControl: false,
    providesDistributorSoftware: false,
    hasRetailerConnection: false,
    hasSinglePlatform: false,
    followUpDate: "",
    priority: "medium", // 'high' | 'medium' | 'low'
    notes: "",
    eventName: "Indusfood 2026",
    eventDate: "2026-01-08",
    // Additional intelligent fields
    meetingDate: "",
    meetingTime: "",
    boothNumber: "",
    leadSource: "", // 'walk-in' | 'referral' | 'online' | 'previous-event' | 'other'
    interestLevel: "", // 'very-high' | 'high' | 'medium' | 'low' | 'not-interested'
    decisionMaker: false,
    annualTurnover: "",
    numberOfEmployees: "",
    businessSize: "", // 'small' | 'medium' | 'large' | 'enterprise'
    certifications: "",
    exportCapabilities: false,
    importCapabilities: false,
    preferredPaymentTerms: "",
    preferredCommunicationMethod: "", // 'email' | 'phone' | 'whatsapp' | 'in-person'
    linkedinProfile: "",
    nextAction: "",
    tags: "",
    photos: [], // Array of photo URLs
  });

  // Distributor form state
  const [distributorForm, setDistributorForm] = useState({
    companyName: "",
    products: "",
    distributionAreas: "",
    currentSoftware: "",
    problemsFacing: "",
    connectedCompanies: "",
    conversationQuality: "",
    contactPersonName: "",
    designation: "",
    phone: "",
    email: "",
    followUpDate: "",
    priority: "medium",
    notes: "",
    eventName: "Indusfood 2026",
    eventDate: "2026-01-08",
    // Additional intelligent fields
    meetingDate: "",
    meetingTime: "",
    boothNumber: "",
    leadSource: "",
    interestLevel: "",
    decisionMaker: false,
    annualTurnover: "",
    numberOfEmployees: "",
    businessSize: "",
    certifications: "",
    warehouseCapacity: "",
    deliveryCapabilities: "",
    coverageAreas: "",
    preferredPaymentTerms: "",
    preferredCommunicationMethod: "",
    linkedinProfile: "",
    nextAction: "",
    tags: "",
    photos: [], // Array of photo URLs
  });

  const [loading, setLoading] = useState(false);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);

  // Photo upload handler
  const handlePhotoUpload = async (e, formType) => {
    const files = Array.from(e.target.files);
    const maxPhotos = 4;
    const currentPhotos = formType === "exhibitor" ? exhibitorForm.photos : distributorForm.photos;
    
    if (currentPhotos.length + files.length > maxPhotos) {
      toast.error(`Maximum ${maxPhotos} photos allowed`);
      return;
    }

    setUploadingPhotos(true);
    try {
      const uploadPromises = files.map(async (file) => {
        // Validate file type
        if (!file.type.startsWith('image/')) {
          throw new Error(`${file.name} is not an image file`);
        }

        // Validate file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
          throw new Error(`${file.name} is too large (max 5MB)`);
        }

        const timestamp = Date.now();
        const fileName = `${timestamp}_${file.name}`;
        const storageRef = ref(storage, `eventLeads/photos/${fileName}`);
        
        await uploadBytes(storageRef, file);
        const downloadURL = await getDownloadURL(storageRef);
        return downloadURL;
      });

      const uploadedUrls = await Promise.all(uploadPromises);
      
      if (formType === "exhibitor") {
        setExhibitorForm(prev => ({
          ...prev,
          photos: [...prev.photos, ...uploadedUrls]
        }));
      } else {
        setDistributorForm(prev => ({
          ...prev,
          photos: [...prev.photos, ...uploadedUrls]
        }));
      }
      
      toast.success(`${uploadedUrls.length} photo(s) uploaded successfully`);
    } catch (error) {
      console.error("Error uploading photos:", error);
      toast.error(`Failed to upload photos: ${error.message}`);
    } finally {
      setUploadingPhotos(false);
      // Reset file input
      e.target.value = '';
    }
  };

  // Remove photo handler
  const handleRemovePhoto = async (photoUrl, formType) => {
    try {
      // Extract file path from URL to delete from storage
      // Note: This is a simplified approach - in production, you might want to store the path separately
      const urlParts = photoUrl.split('/');
      const fileName = urlParts[urlParts.length - 1].split('?')[0];
      const storageRef = ref(storage, `eventLeads/photos/${fileName}`);
      
      try {
        await deleteObject(storageRef);
      } catch (deleteError) {
        // If deletion fails, continue anyway (photo might not exist in storage)
        console.warn("Could not delete photo from storage:", deleteError);
      }

      if (formType === "exhibitor") {
        setExhibitorForm(prev => ({
          ...prev,
          photos: prev.photos.filter(url => url !== photoUrl)
        }));
      } else {
        setDistributorForm(prev => ({
          ...prev,
          photos: prev.photos.filter(url => url !== photoUrl)
        }));
      }
      
      toast.success("Photo removed");
    } catch (error) {
      console.error("Error removing photo:", error);
      toast.error("Failed to remove photo");
    }
  };

  // Load leads from public Firestore collection
  useEffect(() => {
    const loadLeads = async () => {
      try {
        const leadsRef = collection(db, LEADS_COLLECTION);
        const q = query(leadsRef, orderBy("createdAt", "desc"));
        const snapshot = await getDocs(q);
        const leadsList = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          leadsList.push({ 
            id: docSnap.id, 
            ...data
          });
        });
        setLeads(leadsList);
      } catch (error) {
        console.error("Error loading leads from Firestore:", error);
        toast.error("Failed to load leads");
      }
    };

    loadLeads();
  }, []);

  // Filter and search leads
  const filteredLeads = leads.filter((lead) => {
    if (filterType !== "all" && lead.type !== filterType) return false;
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      lead.companyName?.toLowerCase().includes(query) ||
      lead.contactPersonName?.toLowerCase().includes(query) ||
      lead.productCategory?.toLowerCase().includes(query) ||
      lead.email?.toLowerCase().includes(query) ||
      lead.phone?.includes(query)
    );
  });

  // Save exhibitor
  const handleSaveExhibitor = async (e) => {
    e.preventDefault();
    e.stopPropagation();

    // Prevent scroll on form submission - blur all inputs
    const form = e.currentTarget;
    const inputs = form.querySelectorAll('input, textarea, select');
    inputs.forEach(input => input.blur());
    
    // Prevent any scroll behavior
    const currentScrollY = window.scrollY;
    window.scrollTo({ top: currentScrollY, behavior: 'instant' });

    // No validation - allow saving with any data (including completely empty)
    setLoading(true);
    try {
      const leadsRef = collection(db, LEADS_COLLECTION);
      const leadData = {
        type: "exhibitor",
        ...exhibitorForm,
      };

      if (editingLead) {
        // Update existing lead in Firestore
        await updateDoc(doc(leadsRef, editingLead.id), {
          ...leadData,
          updatedAt: serverTimestamp(),
        });
        toast.success("Exhibitor updated successfully!");
      } else {
        // Create new lead in Firestore
        await addDoc(leadsRef, {
          ...leadData,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        toast.success("Exhibitor saved successfully!");
      }

      // Reset form
      setExhibitorForm({
        companyName: "",
        productCategory: "",
        totalSKU: "",
        website: "",
        averageAreaOfBusiness: "",
        contactPersonName: "",
        designation: "",
        phone: "",
        email: "",
        conversationQuality: "",
        currentSoftware: "",
        problemsFacing: "",
        hasDistributorControl: false,
        providesDistributorSoftware: false,
        hasRetailerConnection: false,
        hasSinglePlatform: false,
        followUpDate: "",
        priority: "medium",
        notes: "",
        eventName: "Indusfood 2026",
        eventDate: "2026-01-08",
        meetingDate: "",
        meetingTime: "",
        boothNumber: "",
        leadSource: "",
        interestLevel: "",
        decisionMaker: false,
        annualTurnover: "",
        numberOfEmployees: "",
        businessSize: "",
        certifications: "",
        exportCapabilities: false,
        importCapabilities: false,
        preferredPaymentTerms: "",
        preferredCommunicationMethod: "",
        linkedinProfile: "",
        nextAction: "",
        tags: "",
        photos: [],
      });
      setEditingLead(null);
      
      // Reload leads from Firestore
      const q = query(leadsRef, orderBy("createdAt", "desc"));
      const snapshot = await getDocs(q);
      const leadsList = [];
      snapshot.forEach((docSnap) => {
        leadsList.push({ id: docSnap.id, ...docSnap.data() });
      });
      setLeads(leadsList);
      
      // Switch to list tab without scrolling
      setTimeout(() => {
        setActiveTab("list");
        // Prevent any scroll
        window.scrollTo({ top: window.scrollY, behavior: 'instant' });
      }, 100);
    } catch (error) {
      console.error("Error saving exhibitor:", error);
      toast.error("Failed to save exhibitor");
    } finally {
      setLoading(false);
    }
  };

  // Save distributor
  const handleSaveDistributor = async (e) => {
    e.preventDefault();
    e.stopPropagation();

    // Prevent scroll on form submission - blur all inputs
    const form = e.currentTarget;
    const inputs = form.querySelectorAll('input, textarea, select');
    inputs.forEach(input => input.blur());
    
    // Prevent any scroll behavior
    const currentScrollY = window.scrollY;
    window.scrollTo({ top: currentScrollY, behavior: 'instant' });

    // No validation - allow saving with any data (including completely empty)
    setLoading(true);
    try {
      const leadsRef = collection(db, LEADS_COLLECTION);
      const leadData = {
        type: "distributor",
        ...distributorForm,
      };

      if (editingLead) {
        // Update existing lead in Firestore
        await updateDoc(doc(leadsRef, editingLead.id), {
          ...leadData,
          updatedAt: serverTimestamp(),
        });
        toast.success("Distributor updated successfully!");
      } else {
        // Create new lead in Firestore
        await addDoc(leadsRef, {
          ...leadData,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        toast.success("Distributor saved successfully!");
      }

      // Reset form
      setDistributorForm({
        companyName: "",
        products: "",
        distributionAreas: "",
        currentSoftware: "",
        problemsFacing: "",
        connectedCompanies: "",
        conversationQuality: "",
        contactPersonName: "",
        designation: "",
        phone: "",
        email: "",
        followUpDate: "",
        priority: "medium",
        notes: "",
        eventName: "Indusfood 2026",
        eventDate: "2026-01-08",
        meetingDate: "",
        meetingTime: "",
        boothNumber: "",
        leadSource: "",
        interestLevel: "",
        decisionMaker: false,
        annualTurnover: "",
        numberOfEmployees: "",
        businessSize: "",
        certifications: "",
        warehouseCapacity: "",
        deliveryCapabilities: "",
        coverageAreas: "",
        preferredPaymentTerms: "",
        preferredCommunicationMethod: "",
        linkedinProfile: "",
        nextAction: "",
        tags: "",
        photos: [],
      });
      setEditingLead(null);
      
      // Reload leads from Firestore
      const q = query(leadsRef, orderBy("createdAt", "desc"));
      const snapshot = await getDocs(q);
      const leadsList = [];
      snapshot.forEach((docSnap) => {
        leadsList.push({ id: docSnap.id, ...docSnap.data() });
      });
      setLeads(leadsList);
      
      // Switch to list tab without scrolling
      setTimeout(() => {
        setActiveTab("list");
        // Prevent any scroll
        window.scrollTo({ top: window.scrollY, behavior: 'instant' });
      }, 100);
    } catch (error) {
      console.error("Error saving distributor:", error);
      toast.error("Failed to save distributor");
    } finally {
      setLoading(false);
    }
  };

  // Edit lead
  const handleEdit = (lead) => {
    setEditingLead(lead);
    if (lead.type === "exhibitor") {
      setExhibitorForm({
        ...lead,
        photos: lead.photos || [],
      });
      setActiveTab("exhibitor");
    } else {
      setDistributorForm({
        ...lead,
        photos: lead.photos || [],
      });
      setActiveTab("distributor");
    }
  };

  // Delete lead
  const handleDelete = async (leadId) => {
    if (!confirm("Are you sure you want to delete this lead?")) return;

    try {
      const leadRef = doc(db, LEADS_COLLECTION, leadId);
      await deleteDoc(leadRef);
      toast.success("Lead deleted successfully");
      setLeads(leads.filter((l) => l.id !== leadId));
    } catch (error) {
      console.error("Error deleting lead:", error);
      toast.error("Failed to delete lead");
    }
  };

  // Get priority color
  const getPriorityColor = (priority) => {
    switch (priority) {
      case "high":
        return "bg-red-500/20 text-red-300 border-red-500/50";
      case "medium":
        return "bg-amber-500/20 text-amber-300 border-amber-500/50";
      case "low":
        return "bg-blue-500/20 text-blue-300 border-blue-500/50";
      default:
        return "bg-slate-500/20 text-slate-300 border-slate-500/50";
    }
  };

  // Get conversation quality color
  const getConversationColor = (quality) => {
    switch (quality) {
      case "excellent":
        return "bg-emerald-500/20 text-emerald-300";
      case "good":
        return "bg-blue-500/20 text-blue-300";
      case "okay":
        return "bg-amber-500/20 text-amber-300";
      case "poor":
        return "bg-orange-500/20 text-orange-300";
      case "no":
        return "bg-red-500/20 text-red-300";
      default:
        return "bg-slate-500/20 text-slate-300";
    }
  };

  return (
    <div className="relative w-full min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Background */}
      <div className="pointer-events-none fixed inset-0 opacity-30">
        <div className="absolute -top-1/3 -left-1/4 w-[70%] h-[70%] rounded-full blur-3xl bg-blue-500/20" />
        <div className="absolute -bottom-1/3 -right-1/4 w-[70%] h-[70%] rounded-full blur-3xl bg-purple-500/20" />
      </div>

      <div className="relative z-10 p-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">Lead Management</h1>
              <p className="text-white/60">Track exhibitors and distributors from Indusfood 2026</p>
              <p className="text-white/40 text-xs mt-1">💾 Saving to Firestore • No login required • Accessible from Firebase Console</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 flex-wrap">
          <button
            onClick={() => {
              setActiveTab("list");
              setEditingLead(null);
            }}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              activeTab === "list"
                ? "bg-blue-500 text-white"
                : "bg-white/5 text-white/70 hover:bg-white/10"
            }`}
          >
            📋 All Leads ({leads.length})
          </button>
          <button
            onClick={() => {
              setActiveTab("exhibitor");
              setEditingLead(null);
            }}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              activeTab === "exhibitor"
                ? "bg-blue-500 text-white"
                : "bg-white/5 text-white/70 hover:bg-white/10"
            }`}
          >
            🏢 Add Exhibitor
          </button>
          <button
            onClick={() => {
              setActiveTab("distributor");
              setEditingLead(null);
            }}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              activeTab === "distributor"
                ? "bg-blue-500 text-white"
                : "bg-white/5 text-white/70 hover:bg-white/10"
            }`}
          >
            🚚 Add Distributor
          </button>
        </div>

        {/* List View */}
        {activeTab === "list" && (
          <div className="space-y-4">
            {/* Filters */}
            <div className="flex gap-4 flex-wrap items-center">
              <div className="flex-1 min-w-[200px]">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by company, name, email, phone..."
                  className="w-full px-4 py-2 rounded-lg border border-white/10 bg-white/5 text-white placeholder:text-white/40 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 outline-none"
                />
              </div>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="px-4 py-2 rounded-lg border border-white/10 bg-white/5 text-white focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 outline-none"
              >
                <option value="all">All Types</option>
                <option value="exhibitor">Exhibitors</option>
                <option value="distributor">Distributors</option>
              </select>
            </div>

            {/* Leads Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <AnimatePresence>
                {filteredLeads.map((lead) => (
                  <motion.div
                    key={lead.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="rounded-xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] p-4 hover:bg-white/10 transition-all cursor-pointer"
                    onClick={() => setViewingLead(lead)}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-white mb-1">
                          {lead.companyName}
                        </h3>
                        <div className="flex items-center gap-2 mb-2">
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                              lead.type === "exhibitor"
                                ? "bg-blue-500/20 text-blue-300"
                                : "bg-purple-500/20 text-purple-300"
                            }`}
                          >
                            {lead.type === "exhibitor" ? "🏢 Exhibitor" : "🚚 Distributor"}
                          </span>
                          {lead.priority && (
                            <span
                              className={`px-2 py-0.5 rounded-full text-xs font-medium border ${getPriorityColor(
                                lead.priority
                              )}`}
                            >
                              {lead.priority}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEdit(lead);
                          }}
                          className="w-8 h-8 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 flex items-center justify-center transition"
                          title="Edit"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(lead.id);
                          }}
                          className="w-8 h-8 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-300 flex items-center justify-center transition"
                          title="Delete"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>

                    {lead.contactPersonName && (
                      <div className="text-sm text-white/70 mb-2">
                        👤 {lead.contactPersonName}
                        {lead.designation && ` • ${lead.designation}`}
                      </div>
                    )}

                    {lead.phone && (
                      <div className="text-sm text-white/70 mb-1">
                        📞 {lead.phone}
                      </div>
                    )}

                    {lead.email && (
                      <div className="text-sm text-white/70 mb-2">
                        ✉️ {lead.email}
                      </div>
                    )}

                    {lead.type === "exhibitor" && lead.productCategory && (
                      <div className="text-sm text-white/70 mb-2">
                        📦 Category: {lead.productCategory}
                      </div>
                    )}

                    {lead.conversationQuality && (
                      <div className="mb-2">
                        <span
                          className={`px-2 py-1 rounded text-xs font-medium ${getConversationColor(
                            lead.conversationQuality
                          )}`}
                        >
                          {lead.conversationQuality === "excellent"
                            ? "⭐ Excellent"
                            : lead.conversationQuality === "good"
                            ? "👍 Good"
                            : lead.conversationQuality === "okay"
                            ? "👌 Okay"
                            : lead.conversationQuality === "poor"
                            ? "😐 Poor"
                            : "❌ No Conversation"}
                        </span>
                      </div>
                    )}

                    {lead.followUpDate && (
                      <div className="text-xs text-white/60 mb-2">
                        📅 Follow-up: {new Date(lead.followUpDate).toLocaleDateString()}
                      </div>
                    )}

                    {lead.website && (
                      <a
                        href={lead.website.startsWith("http") ? lead.website : `https://${lead.website}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-xs text-blue-400 hover:text-blue-300 underline"
                      >
                        🌐 Visit Website
                      </a>
                    )}

                    {/* Click to view details */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setViewingLead(lead);
                      }}
                      className="w-full mt-3 px-3 py-2 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 text-sm font-medium transition border border-blue-500/50"
                    >
                      View Full Details →
                    </button>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            {filteredLeads.length === 0 && (
              <div className="text-center py-12 text-white/60">
                <div className="text-4xl mb-3">📋</div>
                <div>No leads found</div>
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="mt-2 text-blue-400 hover:text-blue-300"
                  >
                    Clear search
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Exhibitor Form */}
        {activeTab === "exhibitor" && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-4xl mx-auto"
          >
            <form 
              onSubmit={handleSaveExhibitor} 
              className="space-y-6"
              onScroll={(e) => e.preventDefault()}
            >
              <div className="rounded-xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] p-6">
                <h2 className="text-2xl font-bold text-white mb-6">
                  {editingLead ? "Edit Exhibitor" : "Add New Exhibitor"}
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Company Information */}
                  <div className="md:col-span-2">
                    <h3 className="text-lg font-semibold text-white mb-4 border-b border-white/10 pb-2">
                      Company Information
                    </h3>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-white/70 mb-2">
                      Company Name
                    </label>
                    <input
                      type="text"
                      value={exhibitorForm.companyName}
                      onChange={(e) =>
                        setExhibitorForm({ ...exhibitorForm, companyName: e.target.value })
                      }
                      className="w-full px-4 py-2 rounded-lg border border-white/10 bg-white/5 text-white placeholder:text-white/40 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 outline-none"
                      placeholder="Enter company name"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-white/70 mb-2">
                      Product Category
                    </label>
                    <input
                      type="text"
                      value={exhibitorForm.productCategory}
                      onChange={(e) =>
                        setExhibitorForm({ ...exhibitorForm, productCategory: e.target.value })
                      }
                      className="w-full px-4 py-2 rounded-lg border border-white/10 bg-white/5 text-white placeholder:text-white/40 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 outline-none"
                      placeholder="e.g., Beverages, Snacks, Dairy"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-white/70 mb-2">
                      Total SKU
                    </label>
                    <input
                      type="number"
                      value={exhibitorForm.totalSKU}
                      onChange={(e) =>
                        setExhibitorForm({ ...exhibitorForm, totalSKU: e.target.value })
                      }
                      className="w-full px-4 py-2 rounded-lg border border-white/10 bg-white/5 text-white placeholder:text-white/40 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 outline-none"
                      placeholder="Number of SKUs"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-white/70 mb-2">
                      Website
                    </label>
                    <input
                      type="url"
                      value={exhibitorForm.website}
                      onChange={(e) =>
                        setExhibitorForm({ ...exhibitorForm, website: e.target.value })
                      }
                      className="w-full px-4 py-2 rounded-lg border border-white/10 bg-white/5 text-white placeholder:text-white/40 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 outline-none"
                      placeholder="https://example.com"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-white/70 mb-2">
                      Average Area of Business
                    </label>
                    <input
                      type="text"
                      value={exhibitorForm.averageAreaOfBusiness}
                      onChange={(e) =>
                        setExhibitorForm({
                          ...exhibitorForm,
                          averageAreaOfBusiness: e.target.value,
                        })
                      }
                      className="w-full px-4 py-2 rounded-lg border border-white/10 bg-white/5 text-white placeholder:text-white/40 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 outline-none"
                      placeholder="e.g., Pan-India, North India, etc."
                    />
                  </div>

                  {/* Contact Information */}
                  <div className="md:col-span-2 mt-4">
                    <h3 className="text-lg font-semibold text-white mb-4 border-b border-white/10 pb-2">
                      Contact Information
                    </h3>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-white/70 mb-2">
                      Contact Person Name
                    </label>
                    <input
                      type="text"
                      value={exhibitorForm.contactPersonName}
                      onChange={(e) =>
                        setExhibitorForm({
                          ...exhibitorForm,
                          contactPersonName: e.target.value,
                        })
                      }
                      className="w-full px-4 py-2 rounded-lg border border-white/10 bg-white/5 text-white placeholder:text-white/40 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 outline-none"
                      placeholder="Full name"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-white/70 mb-2">
                      Designation
                    </label>
                    <input
                      type="text"
                      value={exhibitorForm.designation}
                      onChange={(e) =>
                        setExhibitorForm({ ...exhibitorForm, designation: e.target.value })
                      }
                      className="w-full px-4 py-2 rounded-lg border border-white/10 bg-white/5 text-white placeholder:text-white/40 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 outline-none"
                      placeholder="e.g., CEO, Sales Manager"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-white/70 mb-2">
                      Phone
                    </label>
                    <input
                      type="tel"
                      value={exhibitorForm.phone}
                      onChange={(e) =>
                        setExhibitorForm({ ...exhibitorForm, phone: e.target.value })
                      }
                      className="w-full px-4 py-2 rounded-lg border border-white/10 bg-white/5 text-white placeholder:text-white/40 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 outline-none"
                      placeholder="+91 1234567890"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-white/70 mb-2">
                      Email
                    </label>
                    <input
                      type="email"
                      value={exhibitorForm.email}
                      onChange={(e) =>
                        setExhibitorForm({ ...exhibitorForm, email: e.target.value })
                      }
                      className="w-full px-4 py-2 rounded-lg border border-white/10 bg-white/5 text-white placeholder:text-white/40 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 outline-none"
                      placeholder="email@example.com"
                    />
                  </div>

                  {/* Conversation & Assessment */}
                  <div className="md:col-span-2 mt-4">
                    <h3 className="text-lg font-semibold text-white mb-4 border-b border-white/10 pb-2">
                      Conversation & Assessment
                    </h3>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-white/70 mb-2">
                      Conversation Quality
                    </label>
                    <select
                      value={exhibitorForm.conversationQuality}
                      onChange={(e) =>
                        setExhibitorForm({
                          ...exhibitorForm,
                          conversationQuality: e.target.value,
                        })
                      }
                      className="w-full px-4 py-2 rounded-lg border border-white/10 bg-white/5 text-white focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 outline-none"
                    >
                      <option value="">Select quality</option>
                      <option value="excellent">⭐ Excellent</option>
                      <option value="good">👍 Good</option>
                      <option value="okay">👌 Okay</option>
                      <option value="poor">😐 Poor</option>
                      <option value="no">❌ No Conversation</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-white/70 mb-2">
                      Priority
                    </label>
                    <select
                      value={exhibitorForm.priority}
                      onChange={(e) =>
                        setExhibitorForm({ ...exhibitorForm, priority: e.target.value })
                      }
                      className="w-full px-4 py-2 rounded-lg border border-white/10 bg-white/5 text-white focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 outline-none"
                    >
                      <option value="high">🔴 High</option>
                      <option value="medium">🟡 Medium</option>
                      <option value="low">🔵 Low</option>
                    </select>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-white/70 mb-2">
                      Current Software/Tools
                    </label>
                    <input
                      type="text"
                      value={exhibitorForm.currentSoftware}
                      onChange={(e) =>
                        setExhibitorForm({ ...exhibitorForm, currentSoftware: e.target.value })
                      }
                      className="w-full px-4 py-2 rounded-lg border border-white/10 bg-white/5 text-white placeholder:text-white/40 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 outline-none"
                      placeholder="e.g., SAP, Tally, Custom ERP, etc."
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-white/70 mb-2">
                      Problems They Are Facing
                    </label>
                    <textarea
                      value={exhibitorForm.problemsFacing}
                      onChange={(e) =>
                        setExhibitorForm({ ...exhibitorForm, problemsFacing: e.target.value })
                      }
                      rows={3}
                      className="w-full px-4 py-2 rounded-lg border border-white/10 bg-white/5 text-white placeholder:text-white/40 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 outline-none"
                      placeholder="Describe the problems they mentioned..."
                    />
                  </div>

                  {/* Platform Capabilities */}
                  <div className="md:col-span-2 mt-4">
                    <h3 className="text-lg font-semibold text-white mb-4 border-b border-white/10 pb-2">
                      Platform Capabilities
                    </h3>
                  </div>

                  <div className="md:col-span-2 space-y-3">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={exhibitorForm.hasDistributorControl}
                        onChange={(e) =>
                          setExhibitorForm({
                            ...exhibitorForm,
                            hasDistributorControl: e.target.checked,
                          })
                        }
                        className="w-5 h-5 rounded border-white/20 bg-white/5 text-blue-500 focus:ring-2 focus:ring-blue-500/50"
                      />
                      <span className="text-white/70">
                        Has Distributor Control System
                      </span>
                    </label>

                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={exhibitorForm.providesDistributorSoftware}
                        onChange={(e) =>
                          setExhibitorForm({
                            ...exhibitorForm,
                            providesDistributorSoftware: e.target.checked,
                          })
                        }
                        className="w-5 h-5 rounded border-white/20 bg-white/5 text-blue-500 focus:ring-2 focus:ring-blue-500/50"
                      />
                      <span className="text-white/70">
                        Provides Software to Distributors
                      </span>
                    </label>

                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={exhibitorForm.hasRetailerConnection}
                        onChange={(e) =>
                          setExhibitorForm({
                            ...exhibitorForm,
                            hasRetailerConnection: e.target.checked,
                          })
                        }
                        className="w-5 h-5 rounded border-white/20 bg-white/5 text-blue-500 focus:ring-2 focus:ring-blue-500/50"
                      />
                      <span className="text-white/70">
                        Has Retailer Connections
                      </span>
                    </label>

                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={exhibitorForm.hasSinglePlatform}
                        onChange={(e) =>
                          setExhibitorForm({
                            ...exhibitorForm,
                            hasSinglePlatform: e.target.checked,
                          })
                        }
                        className="w-5 h-5 rounded border-white/20 bg-white/5 text-blue-500 focus:ring-2 focus:ring-blue-500/50"
                      />
                      <span className="text-white/70">
                        Has Single Platform for All Connections
                      </span>
                    </label>
                  </div>

                  {/* Additional Information */}
                  <div className="md:col-span-2 mt-4">
                    <h3 className="text-lg font-semibold text-white mb-4 border-b border-white/10 pb-2">
                      Additional Information
                    </h3>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-white/70 mb-2">
                      Follow-up Date
                    </label>
                    <input
                      type="date"
                      value={exhibitorForm.followUpDate}
                      onChange={(e) =>
                        setExhibitorForm({ ...exhibitorForm, followUpDate: e.target.value })
                      }
                      className="w-full px-4 py-2 rounded-lg border border-white/10 bg-white/5 text-white focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-white/70 mb-2">
                      Event Name
                    </label>
                    <input
                      type="text"
                      value={exhibitorForm.eventName}
                      onChange={(e) =>
                        setExhibitorForm({ ...exhibitorForm, eventName: e.target.value })
                      }
                      className="w-full px-4 py-2 rounded-lg border border-white/10 bg-white/5 text-white focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 outline-none"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-white/70 mb-2">
                      Notes
                    </label>
                    <textarea
                      value={exhibitorForm.notes}
                      onChange={(e) =>
                        setExhibitorForm({ ...exhibitorForm, notes: e.target.value })
                      }
                      rows={4}
                      className="w-full px-4 py-2 rounded-lg border border-white/10 bg-white/5 text-white placeholder:text-white/40 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 outline-none"
                      placeholder="Additional notes, observations, or important information..."
                    />
                  </div>

                  {/* Event & Meeting Details */}
                  <div className="md:col-span-2 mt-4">
                    <h3 className="text-lg font-semibold text-white mb-4 border-b border-white/10 pb-2">
                      Event & Meeting Details
                    </h3>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-white/70 mb-2">
                      Meeting Date
                    </label>
                    <input
                      type="date"
                      value={exhibitorForm.meetingDate}
                      onChange={(e) =>
                        setExhibitorForm({ ...exhibitorForm, meetingDate: e.target.value })
                      }
                      className="w-full px-4 py-2 rounded-lg border border-white/10 bg-white/5 text-white focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-white/70 mb-2">
                      Meeting Time
                    </label>
                    <input
                      type="time"
                      value={exhibitorForm.meetingTime}
                      onChange={(e) =>
                        setExhibitorForm({ ...exhibitorForm, meetingTime: e.target.value })
                      }
                      className="w-full px-4 py-2 rounded-lg border border-white/10 bg-white/5 text-white focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-white/70 mb-2">
                      Booth Number
                    </label>
                    <input
                      type="text"
                      value={exhibitorForm.boothNumber}
                      onChange={(e) =>
                        setExhibitorForm({ ...exhibitorForm, boothNumber: e.target.value })
                      }
                      className="w-full px-4 py-2 rounded-lg border border-white/10 bg-white/5 text-white placeholder:text-white/40 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 outline-none"
                      placeholder="e.g., A-123"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-white/70 mb-2">
                      Lead Source
                    </label>
                    <select
                      value={exhibitorForm.leadSource}
                      onChange={(e) =>
                        setExhibitorForm({ ...exhibitorForm, leadSource: e.target.value })
                      }
                      className="w-full px-4 py-2 rounded-lg border border-white/10 bg-white/5 text-white focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 outline-none"
                    >
                      <option value="">Select source</option>
                      <option value="walk-in">Walk-in</option>
                      <option value="referral">Referral</option>
                      <option value="online">Online/Website</option>
                      <option value="previous-event">Previous Event</option>
                      <option value="social-media">Social Media</option>
                      <option value="other">Other</option>
                    </select>
                  </div>

                  {/* Business Intelligence */}
                  <div className="md:col-span-2 mt-4">
                    <h3 className="text-lg font-semibold text-white mb-4 border-b border-white/10 pb-2">
                      Business Intelligence
                    </h3>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-white/70 mb-2">
                      Interest Level
                    </label>
                    <select
                      value={exhibitorForm.interestLevel}
                      onChange={(e) =>
                        setExhibitorForm({ ...exhibitorForm, interestLevel: e.target.value })
                      }
                      className="w-full px-4 py-2 rounded-lg border border-white/10 bg-white/5 text-white focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 outline-none"
                    >
                      <option value="">Select level</option>
                      <option value="very-high">🔥 Very High</option>
                      <option value="high">⭐ High</option>
                      <option value="medium">👌 Medium</option>
                      <option value="low">😐 Low</option>
                      <option value="not-interested">❌ Not Interested</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-white/70 mb-2">
                      Business Size
                    </label>
                    <select
                      value={exhibitorForm.businessSize}
                      onChange={(e) =>
                        setExhibitorForm({ ...exhibitorForm, businessSize: e.target.value })
                      }
                      className="w-full px-4 py-2 rounded-lg border border-white/10 bg-white/5 text-white focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 outline-none"
                    >
                      <option value="">Select size</option>
                      <option value="small">Small (1-50 employees)</option>
                      <option value="medium">Medium (51-200 employees)</option>
                      <option value="large">Large (201-1000 employees)</option>
                      <option value="enterprise">Enterprise (1000+ employees)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-white/70 mb-2">
                      Annual Turnover
                    </label>
                    <input
                      type="text"
                      value={exhibitorForm.annualTurnover}
                      onChange={(e) =>
                        setExhibitorForm({ ...exhibitorForm, annualTurnover: e.target.value })
                      }
                      className="w-full px-4 py-2 rounded-lg border border-white/10 bg-white/5 text-white placeholder:text-white/40 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 outline-none"
                      placeholder="e.g., ₹10 Cr, $5M"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-white/70 mb-2">
                      Number of Employees
                    </label>
                    <input
                      type="text"
                      value={exhibitorForm.numberOfEmployees}
                      onChange={(e) =>
                        setExhibitorForm({ ...exhibitorForm, numberOfEmployees: e.target.value })
                      }
                      className="w-full px-4 py-2 rounded-lg border border-white/10 bg-white/5 text-white placeholder:text-white/40 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 outline-none"
                      placeholder="e.g., 150"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={exhibitorForm.decisionMaker}
                        onChange={(e) =>
                          setExhibitorForm({
                            ...exhibitorForm,
                            decisionMaker: e.target.checked,
                          })
                        }
                        className="w-5 h-5 rounded border-white/20 bg-white/5 text-blue-500 focus:ring-2 focus:ring-blue-500/50"
                      />
                      <span className="text-white/70">
                        Is Decision Maker
                      </span>
                    </label>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-white/70 mb-2">
                      Certifications
                    </label>
                    <input
                      type="text"
                      value={exhibitorForm.certifications}
                      onChange={(e) =>
                        setExhibitorForm({ ...exhibitorForm, certifications: e.target.value })
                      }
                      className="w-full px-4 py-2 rounded-lg border border-white/10 bg-white/5 text-white placeholder:text-white/40 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 outline-none"
                      placeholder="e.g., ISO, FSSAI, HACCP"
                    />
                  </div>

                  <div className="md:col-span-2 space-y-3">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={exhibitorForm.exportCapabilities}
                        onChange={(e) =>
                          setExhibitorForm({
                            ...exhibitorForm,
                            exportCapabilities: e.target.checked,
                          })
                        }
                        className="w-5 h-5 rounded border-white/20 bg-white/5 text-blue-500 focus:ring-2 focus:ring-blue-500/50"
                      />
                      <span className="text-white/70">
                        Has Export Capabilities
                      </span>
                    </label>

                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={exhibitorForm.importCapabilities}
                        onChange={(e) =>
                          setExhibitorForm({
                            ...exhibitorForm,
                            importCapabilities: e.target.checked,
                          })
                        }
                        className="w-5 h-5 rounded border-white/20 bg-white/5 text-blue-500 focus:ring-2 focus:ring-blue-500/50"
                      />
                      <span className="text-white/70">
                        Has Import Capabilities
                      </span>
                    </label>
                  </div>

                  {/* Communication & Next Steps */}
                  <div className="md:col-span-2 mt-4">
                    <h3 className="text-lg font-semibold text-white mb-4 border-b border-white/10 pb-2">
                      Communication & Next Steps
                    </h3>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-white/70 mb-2">
                      Preferred Communication Method
                    </label>
                    <select
                      value={exhibitorForm.preferredCommunicationMethod}
                      onChange={(e) =>
                        setExhibitorForm({ ...exhibitorForm, preferredCommunicationMethod: e.target.value })
                      }
                      className="w-full px-4 py-2 rounded-lg border border-white/10 bg-white/5 text-white focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 outline-none"
                    >
                      <option value="">Select method</option>
                      <option value="email">📧 Email</option>
                      <option value="phone">📞 Phone</option>
                      <option value="whatsapp">💬 WhatsApp</option>
                      <option value="in-person">🤝 In-Person</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-white/70 mb-2">
                      Preferred Payment Terms
                    </label>
                    <input
                      type="text"
                      value={exhibitorForm.preferredPaymentTerms}
                      onChange={(e) =>
                        setExhibitorForm({ ...exhibitorForm, preferredPaymentTerms: e.target.value })
                      }
                      className="w-full px-4 py-2 rounded-lg border border-white/10 bg-white/5 text-white placeholder:text-white/40 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 outline-none"
                      placeholder="e.g., Net 30, COD, Advance"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-white/70 mb-2">
                      LinkedIn Profile
                    </label>
                    <input
                      type="url"
                      value={exhibitorForm.linkedinProfile}
                      onChange={(e) =>
                        setExhibitorForm({ ...exhibitorForm, linkedinProfile: e.target.value })
                      }
                      className="w-full px-4 py-2 rounded-lg border border-white/10 bg-white/5 text-white placeholder:text-white/40 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 outline-none"
                      placeholder="https://linkedin.com/in/..."
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-white/70 mb-2">
                      Next Action
                    </label>
                    <input
                      type="text"
                      value={exhibitorForm.nextAction}
                      onChange={(e) =>
                        setExhibitorForm({ ...exhibitorForm, nextAction: e.target.value })
                      }
                      className="w-full px-4 py-2 rounded-lg border border-white/10 bg-white/5 text-white placeholder:text-white/40 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 outline-none"
                      placeholder="e.g., Send proposal, Schedule demo, Follow up next week"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-white/70 mb-2">
                      Tags (comma separated)
                    </label>
                    <input
                      type="text"
                      value={exhibitorForm.tags}
                      onChange={(e) =>
                        setExhibitorForm({ ...exhibitorForm, tags: e.target.value })
                      }
                      className="w-full px-4 py-2 rounded-lg border border-white/10 bg-white/5 text-white placeholder:text-white/40 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 outline-none"
                      placeholder="e.g., premium, export-ready, tech-savvy"
                    />
                  </div>

                  {/* Photos Section */}
                  <div className="md:col-span-2 mt-4">
                    <h3 className="text-lg font-semibold text-white mb-4 border-b border-white/10 pb-2">
                      Photos ({exhibitorForm.photos?.length || 0}/4)
                    </h3>
                    <div className="space-y-4">
                      {/* Photo Upload Button */}
                      <div>
                        <input
                          type="file"
                          id="exhibitor-photo-upload"
                          accept="image/*"
                          multiple
                          onChange={(e) => handlePhotoUpload(e, "exhibitor")}
                          disabled={uploadingPhotos || (exhibitorForm.photos?.length || 0) >= 4}
                          className="hidden"
                        />
                        <label
                          htmlFor="exhibitor-photo-upload"
                          className={`flex items-center justify-center gap-2 px-6 py-4 rounded-lg border-2 border-dashed cursor-pointer transition ${
                            uploadingPhotos || (exhibitorForm.photos?.length || 0) >= 4
                              ? "border-white/20 bg-white/5 opacity-50 cursor-not-allowed"
                              : "border-white/30 bg-white/5 hover:border-blue-500/50 hover:bg-white/10"
                          }`}
                        >
                          {uploadingPhotos ? (
                            <>
                              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                              <span className="text-white/70">Uploading...</span>
                            </>
                          ) : (
                            <>
                              <span className="text-2xl">📷</span>
                              <span className="text-white/70">
                                {(exhibitorForm.photos?.length || 0) >= 4
                                  ? "Maximum 4 photos reached"
                                  : "Click to upload photos (max 4)"}
                              </span>
                            </>
                          )}
                        </label>
                      </div>

                      {/* Photo Thumbnails */}
                      {exhibitorForm.photos && exhibitorForm.photos.length > 0 && (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          {exhibitorForm.photos.map((photoUrl, index) => (
                            <div key={index} className="relative group">
                              <img
                                src={photoUrl}
                                alt={`Photo ${index + 1}`}
                                className="w-full h-32 object-cover rounded-lg border border-white/10"
                              />
                              <button
                                type="button"
                                onClick={() => handleRemovePhoto(photoUrl, "exhibitor")}
                                className="absolute top-2 right-2 bg-red-500/80 hover:bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition"
                                title="Remove photo"
                              >
                                ×
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex gap-4 mt-6">
                  <button
                    type="submit"
                    disabled={loading || uploadingPhotos}
                    className="flex-1 px-6 py-3 rounded-lg bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white font-semibold shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition"
                  >
                    {loading ? "Saving..." : editingLead ? "Update Exhibitor" : "Save Exhibitor"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab("list");
                      setEditingLead(null);
                    }}
                    className="px-6 py-3 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-white transition"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </form>
          </motion.div>
        )}

        {/* Distributor Form */}
        {activeTab === "distributor" && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-4xl mx-auto"
          >
            <form 
              onSubmit={handleSaveDistributor} 
              className="space-y-6"
              onScroll={(e) => e.preventDefault()}
            >
              <div className="rounded-xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] p-6">
                <h2 className="text-2xl font-bold text-white mb-6">
                  {editingLead ? "Edit Distributor" : "Add New Distributor"}
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Company Information */}
                  <div className="md:col-span-2">
                    <h3 className="text-lg font-semibold text-white mb-4 border-b border-white/10 pb-2">
                      Company Information
                    </h3>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-white/70 mb-2">
                      Company Name
                    </label>
                    <input
                      type="text"
                      value={distributorForm.companyName}
                      onChange={(e) =>
                        setDistributorForm({ ...distributorForm, companyName: e.target.value })
                      }
                      className="w-full px-4 py-2 rounded-lg border border-white/10 bg-white/5 text-white placeholder:text-white/40 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 outline-none"
                      placeholder="Enter company name"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-white/70 mb-2">
                      Products They Distribute
                    </label>
                    <input
                      type="text"
                      value={distributorForm.products}
                      onChange={(e) =>
                        setDistributorForm({ ...distributorForm, products: e.target.value })
                      }
                      className="w-full px-4 py-2 rounded-lg border border-white/10 bg-white/5 text-white placeholder:text-white/40 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 outline-none"
                      placeholder="e.g., Beverages, Snacks, Dairy products"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-white/70 mb-2">
                      Distribution Areas
                    </label>
                    <input
                      type="text"
                      value={distributorForm.distributionAreas}
                      onChange={(e) =>
                        setDistributorForm({
                          ...distributorForm,
                          distributionAreas: e.target.value,
                        })
                      }
                      className="w-full px-4 py-2 rounded-lg border border-white/10 bg-white/5 text-white placeholder:text-white/40 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 outline-none"
                      placeholder="e.g., Mumbai, Delhi, Bangalore"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-white/70 mb-2">
                      Connected Companies
                    </label>
                    <input
                      type="text"
                      value={distributorForm.connectedCompanies}
                      onChange={(e) =>
                        setDistributorForm({
                          ...distributorForm,
                          connectedCompanies: e.target.value,
                        })
                      }
                      className="w-full px-4 py-2 rounded-lg border border-white/10 bg-white/5 text-white placeholder:text-white/40 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 outline-none"
                      placeholder="Companies they distribute for"
                    />
                  </div>

                  {/* Contact Information */}
                  <div className="md:col-span-2 mt-4">
                    <h3 className="text-lg font-semibold text-white mb-4 border-b border-white/10 pb-2">
                      Contact Information
                    </h3>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-white/70 mb-2">
                      Contact Person Name
                    </label>
                    <input
                      type="text"
                      value={distributorForm.contactPersonName}
                      onChange={(e) =>
                        setDistributorForm({
                          ...distributorForm,
                          contactPersonName: e.target.value,
                        })
                      }
                      className="w-full px-4 py-2 rounded-lg border border-white/10 bg-white/5 text-white placeholder:text-white/40 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 outline-none"
                      placeholder="Full name"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-white/70 mb-2">
                      Designation
                    </label>
                    <input
                      type="text"
                      value={distributorForm.designation}
                      onChange={(e) =>
                        setDistributorForm({ ...distributorForm, designation: e.target.value })
                      }
                      className="w-full px-4 py-2 rounded-lg border border-white/10 bg-white/5 text-white placeholder:text-white/40 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 outline-none"
                      placeholder="e.g., CEO, Sales Manager"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-white/70 mb-2">
                      Phone
                    </label>
                    <input
                      type="tel"
                      value={distributorForm.phone}
                      onChange={(e) =>
                        setDistributorForm({ ...distributorForm, phone: e.target.value })
                      }
                      className="w-full px-4 py-2 rounded-lg border border-white/10 bg-white/5 text-white placeholder:text-white/40 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 outline-none"
                      placeholder="+91 1234567890"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-white/70 mb-2">
                      Email
                    </label>
                    <input
                      type="email"
                      value={distributorForm.email}
                      onChange={(e) =>
                        setDistributorForm({ ...distributorForm, email: e.target.value })
                      }
                      className="w-full px-4 py-2 rounded-lg border border-white/10 bg-white/5 text-white placeholder:text-white/40 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 outline-none"
                      placeholder="email@example.com"
                    />
                  </div>

                  {/* Assessment */}
                  <div className="md:col-span-2 mt-4">
                    <h3 className="text-lg font-semibold text-white mb-4 border-b border-white/10 pb-2">
                      Assessment
                    </h3>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-white/70 mb-2">
                      Conversation Quality
                    </label>
                    <select
                      value={distributorForm.conversationQuality}
                      onChange={(e) =>
                        setDistributorForm({
                          ...distributorForm,
                          conversationQuality: e.target.value,
                        })
                      }
                      className="w-full px-4 py-2 rounded-lg border border-white/10 bg-white/5 text-white focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 outline-none"
                    >
                      <option value="">Select quality</option>
                      <option value="excellent">⭐ Excellent</option>
                      <option value="good">👍 Good</option>
                      <option value="okay">👌 Okay</option>
                      <option value="poor">😐 Poor</option>
                      <option value="no">❌ No Conversation</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-white/70 mb-2">
                      Priority
                    </label>
                    <select
                      value={distributorForm.priority}
                      onChange={(e) =>
                        setDistributorForm({ ...distributorForm, priority: e.target.value })
                      }
                      className="w-full px-4 py-2 rounded-lg border border-white/10 bg-white/5 text-white focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 outline-none"
                    >
                      <option value="high">🔴 High</option>
                      <option value="medium">🟡 Medium</option>
                      <option value="low">🔵 Low</option>
                    </select>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-white/70 mb-2">
                      Current Software/Tools
                    </label>
                    <input
                      type="text"
                      value={distributorForm.currentSoftware}
                      onChange={(e) =>
                        setDistributorForm({
                          ...distributorForm,
                          currentSoftware: e.target.value,
                        })
                      }
                      className="w-full px-4 py-2 rounded-lg border border-white/10 bg-white/5 text-white placeholder:text-white/40 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 outline-none"
                      placeholder="e.g., SAP, Tally, Custom ERP, etc."
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-white/70 mb-2">
                      Problems They Are Facing
                    </label>
                    <textarea
                      value={distributorForm.problemsFacing}
                      onChange={(e) =>
                        setDistributorForm({
                          ...distributorForm,
                          problemsFacing: e.target.value,
                        })
                      }
                      rows={3}
                      className="w-full px-4 py-2 rounded-lg border border-white/10 bg-white/5 text-white placeholder:text-white/40 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 outline-none"
                      placeholder="Describe the problems they mentioned..."
                    />
                  </div>

                  {/* Additional Information */}
                  <div className="md:col-span-2 mt-4">
                    <h3 className="text-lg font-semibold text-white mb-4 border-b border-white/10 pb-2">
                      Additional Information
                    </h3>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-white/70 mb-2">
                      Follow-up Date
                    </label>
                    <input
                      type="date"
                      value={distributorForm.followUpDate}
                      onChange={(e) =>
                        setDistributorForm({ ...distributorForm, followUpDate: e.target.value })
                      }
                      className="w-full px-4 py-2 rounded-lg border border-white/10 bg-white/5 text-white focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-white/70 mb-2">
                      Event Name
                    </label>
                    <input
                      type="text"
                      value={distributorForm.eventName}
                      onChange={(e) =>
                        setDistributorForm({ ...distributorForm, eventName: e.target.value })
                      }
                      className="w-full px-4 py-2 rounded-lg border border-white/10 bg-white/5 text-white focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 outline-none"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-white/70 mb-2">
                      Notes
                    </label>
                    <textarea
                      value={distributorForm.notes}
                      onChange={(e) =>
                        setDistributorForm({ ...distributorForm, notes: e.target.value })
                      }
                      rows={4}
                      className="w-full px-4 py-2 rounded-lg border border-white/10 bg-white/5 text-white placeholder:text-white/40 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 outline-none"
                      placeholder="Additional notes, observations, or important information..."
                    />
                  </div>

                  {/* Event & Meeting Details */}
                  <div className="md:col-span-2 mt-4">
                    <h3 className="text-lg font-semibold text-white mb-4 border-b border-white/10 pb-2">
                      Event & Meeting Details
                    </h3>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-white/70 mb-2">
                      Meeting Date
                    </label>
                    <input
                      type="date"
                      value={distributorForm.meetingDate}
                      onChange={(e) =>
                        setDistributorForm({ ...distributorForm, meetingDate: e.target.value })
                      }
                      className="w-full px-4 py-2 rounded-lg border border-white/10 bg-white/5 text-white focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-white/70 mb-2">
                      Meeting Time
                    </label>
                    <input
                      type="time"
                      value={distributorForm.meetingTime}
                      onChange={(e) =>
                        setDistributorForm({ ...distributorForm, meetingTime: e.target.value })
                      }
                      className="w-full px-4 py-2 rounded-lg border border-white/10 bg-white/5 text-white focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-white/70 mb-2">
                      Booth Number
                    </label>
                    <input
                      type="text"
                      value={distributorForm.boothNumber}
                      onChange={(e) =>
                        setDistributorForm({ ...distributorForm, boothNumber: e.target.value })
                      }
                      className="w-full px-4 py-2 rounded-lg border border-white/10 bg-white/5 text-white placeholder:text-white/40 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 outline-none"
                      placeholder="e.g., A-123"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-white/70 mb-2">
                      Lead Source
                    </label>
                    <select
                      value={distributorForm.leadSource}
                      onChange={(e) =>
                        setDistributorForm({ ...distributorForm, leadSource: e.target.value })
                      }
                      className="w-full px-4 py-2 rounded-lg border border-white/10 bg-white/5 text-white focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 outline-none"
                    >
                      <option value="">Select source</option>
                      <option value="walk-in">Walk-in</option>
                      <option value="referral">Referral</option>
                      <option value="online">Online/Website</option>
                      <option value="previous-event">Previous Event</option>
                      <option value="social-media">Social Media</option>
                      <option value="other">Other</option>
                    </select>
                  </div>

                  {/* Business Intelligence */}
                  <div className="md:col-span-2 mt-4">
                    <h3 className="text-lg font-semibold text-white mb-4 border-b border-white/10 pb-2">
                      Business Intelligence
                    </h3>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-white/70 mb-2">
                      Interest Level
                    </label>
                    <select
                      value={distributorForm.interestLevel}
                      onChange={(e) =>
                        setDistributorForm({ ...distributorForm, interestLevel: e.target.value })
                      }
                      className="w-full px-4 py-2 rounded-lg border border-white/10 bg-white/5 text-white focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 outline-none"
                    >
                      <option value="">Select level</option>
                      <option value="very-high">🔥 Very High</option>
                      <option value="high">⭐ High</option>
                      <option value="medium">👌 Medium</option>
                      <option value="low">😐 Low</option>
                      <option value="not-interested">❌ Not Interested</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-white/70 mb-2">
                      Business Size
                    </label>
                    <select
                      value={distributorForm.businessSize}
                      onChange={(e) =>
                        setDistributorForm({ ...distributorForm, businessSize: e.target.value })
                      }
                      className="w-full px-4 py-2 rounded-lg border border-white/10 bg-white/5 text-white focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 outline-none"
                    >
                      <option value="">Select size</option>
                      <option value="small">Small (1-50 employees)</option>
                      <option value="medium">Medium (51-200 employees)</option>
                      <option value="large">Large (201-1000 employees)</option>
                      <option value="enterprise">Enterprise (1000+ employees)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-white/70 mb-2">
                      Annual Turnover
                    </label>
                    <input
                      type="text"
                      value={distributorForm.annualTurnover}
                      onChange={(e) =>
                        setDistributorForm({ ...distributorForm, annualTurnover: e.target.value })
                      }
                      className="w-full px-4 py-2 rounded-lg border border-white/10 bg-white/5 text-white placeholder:text-white/40 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 outline-none"
                      placeholder="e.g., ₹10 Cr, $5M"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-white/70 mb-2">
                      Number of Employees
                    </label>
                    <input
                      type="text"
                      value={distributorForm.numberOfEmployees}
                      onChange={(e) =>
                        setDistributorForm({ ...distributorForm, numberOfEmployees: e.target.value })
                      }
                      className="w-full px-4 py-2 rounded-lg border border-white/10 bg-white/5 text-white placeholder:text-white/40 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 outline-none"
                      placeholder="e.g., 150"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={distributorForm.decisionMaker}
                        onChange={(e) =>
                          setDistributorForm({
                            ...distributorForm,
                            decisionMaker: e.target.checked,
                          })
                        }
                        className="w-5 h-5 rounded border-white/20 bg-white/5 text-blue-500 focus:ring-2 focus:ring-blue-500/50"
                      />
                      <span className="text-white/70">
                        Is Decision Maker
                      </span>
                    </label>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-white/70 mb-2">
                      Certifications
                    </label>
                    <input
                      type="text"
                      value={distributorForm.certifications}
                      onChange={(e) =>
                        setDistributorForm({ ...distributorForm, certifications: e.target.value })
                      }
                      className="w-full px-4 py-2 rounded-lg border border-white/10 bg-white/5 text-white placeholder:text-white/40 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 outline-none"
                      placeholder="e.g., ISO, FSSAI, HACCP"
                    />
                  </div>

                  {/* Distributor Specific Fields */}
                  <div className="md:col-span-2 mt-4">
                    <h3 className="text-lg font-semibold text-white mb-4 border-b border-white/10 pb-2">
                      Distribution Capabilities
                    </h3>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-white/70 mb-2">
                      Warehouse Capacity
                    </label>
                    <input
                      type="text"
                      value={distributorForm.warehouseCapacity}
                      onChange={(e) =>
                        setDistributorForm({ ...distributorForm, warehouseCapacity: e.target.value })
                      }
                      className="w-full px-4 py-2 rounded-lg border border-white/10 bg-white/5 text-white placeholder:text-white/40 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 outline-none"
                      placeholder="e.g., 10,000 sq ft, 500 tons"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-white/70 mb-2">
                      Delivery Capabilities
                    </label>
                    <input
                      type="text"
                      value={distributorForm.deliveryCapabilities}
                      onChange={(e) =>
                        setDistributorForm({ ...distributorForm, deliveryCapabilities: e.target.value })
                      }
                      className="w-full px-4 py-2 rounded-lg border border-white/10 bg-white/5 text-white placeholder:text-white/40 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 outline-none"
                      placeholder="e.g., Same-day, Next-day, Express"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-white/70 mb-2">
                      Coverage Areas (Additional)
                    </label>
                    <input
                      type="text"
                      value={distributorForm.coverageAreas}
                      onChange={(e) =>
                        setDistributorForm({ ...distributorForm, coverageAreas: e.target.value })
                      }
                      className="w-full px-4 py-2 rounded-lg border border-white/10 bg-white/5 text-white placeholder:text-white/40 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 outline-none"
                      placeholder="Additional coverage areas beyond main distribution areas"
                    />
                  </div>

                  {/* Communication & Next Steps */}
                  <div className="md:col-span-2 mt-4">
                    <h3 className="text-lg font-semibold text-white mb-4 border-b border-white/10 pb-2">
                      Communication & Next Steps
                    </h3>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-white/70 mb-2">
                      Preferred Communication Method
                    </label>
                    <select
                      value={distributorForm.preferredCommunicationMethod}
                      onChange={(e) =>
                        setDistributorForm({ ...distributorForm, preferredCommunicationMethod: e.target.value })
                      }
                      className="w-full px-4 py-2 rounded-lg border border-white/10 bg-white/5 text-white focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 outline-none"
                    >
                      <option value="">Select method</option>
                      <option value="email">📧 Email</option>
                      <option value="phone">📞 Phone</option>
                      <option value="whatsapp">💬 WhatsApp</option>
                      <option value="in-person">🤝 In-Person</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-white/70 mb-2">
                      Preferred Payment Terms
                    </label>
                    <input
                      type="text"
                      value={distributorForm.preferredPaymentTerms}
                      onChange={(e) =>
                        setDistributorForm({ ...distributorForm, preferredPaymentTerms: e.target.value })
                      }
                      className="w-full px-4 py-2 rounded-lg border border-white/10 bg-white/5 text-white placeholder:text-white/40 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 outline-none"
                      placeholder="e.g., Net 30, COD, Advance"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-white/70 mb-2">
                      LinkedIn Profile
                    </label>
                    <input
                      type="url"
                      value={distributorForm.linkedinProfile}
                      onChange={(e) =>
                        setDistributorForm({ ...distributorForm, linkedinProfile: e.target.value })
                      }
                      className="w-full px-4 py-2 rounded-lg border border-white/10 bg-white/5 text-white placeholder:text-white/40 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 outline-none"
                      placeholder="https://linkedin.com/in/..."
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-white/70 mb-2">
                      Next Action
                    </label>
                    <input
                      type="text"
                      value={distributorForm.nextAction}
                      onChange={(e) =>
                        setDistributorForm({ ...distributorForm, nextAction: e.target.value })
                      }
                      className="w-full px-4 py-2 rounded-lg border border-white/10 bg-white/5 text-white placeholder:text-white/40 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 outline-none"
                      placeholder="e.g., Send proposal, Schedule demo, Follow up next week"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-white/70 mb-2">
                      Tags (comma separated)
                    </label>
                    <input
                      type="text"
                      value={distributorForm.tags}
                      onChange={(e) =>
                        setDistributorForm({ ...distributorForm, tags: e.target.value })
                      }
                      className="w-full px-4 py-2 rounded-lg border border-white/10 bg-white/5 text-white placeholder:text-white/40 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 outline-none"
                      placeholder="e.g., premium, export-ready, tech-savvy"
                    />
                  </div>

                  {/* Photos Section */}
                  <div className="md:col-span-2 mt-4">
                    <h3 className="text-lg font-semibold text-white mb-4 border-b border-white/10 pb-2">
                      Photos ({distributorForm.photos?.length || 0}/4)
                    </h3>
                    <div className="space-y-4">
                      {/* Photo Upload Button */}
                      <div>
                        <input
                          type="file"
                          id="distributor-photo-upload"
                          accept="image/*"
                          multiple
                          onChange={(e) => handlePhotoUpload(e, "distributor")}
                          disabled={uploadingPhotos || (distributorForm.photos?.length || 0) >= 4}
                          className="hidden"
                        />
                        <label
                          htmlFor="distributor-photo-upload"
                          className={`flex items-center justify-center gap-2 px-6 py-4 rounded-lg border-2 border-dashed cursor-pointer transition ${
                            uploadingPhotos || (distributorForm.photos?.length || 0) >= 4
                              ? "border-white/20 bg-white/5 opacity-50 cursor-not-allowed"
                              : "border-white/30 bg-white/5 hover:border-purple-500/50 hover:bg-white/10"
                          }`}
                        >
                          {uploadingPhotos ? (
                            <>
                              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                              <span className="text-white/70">Uploading...</span>
                            </>
                          ) : (
                            <>
                              <span className="text-2xl">📷</span>
                              <span className="text-white/70">
                                {(distributorForm.photos?.length || 0) >= 4
                                  ? "Maximum 4 photos reached"
                                  : "Click to upload photos (max 4)"}
                              </span>
                            </>
                          )}
                        </label>
                      </div>

                      {/* Photo Thumbnails */}
                      {distributorForm.photos && distributorForm.photos.length > 0 && (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          {distributorForm.photos.map((photoUrl, index) => (
                            <div key={index} className="relative group">
                              <img
                                src={photoUrl}
                                alt={`Photo ${index + 1}`}
                                className="w-full h-32 object-cover rounded-lg border border-white/10"
                              />
                              <button
                                type="button"
                                onClick={() => handleRemovePhoto(photoUrl, "distributor")}
                                className="absolute top-2 right-2 bg-red-500/80 hover:bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition"
                                title="Remove photo"
                              >
                                ×
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex gap-4 mt-6">
                  <button
                    type="submit"
                    disabled={loading || uploadingPhotos}
                    className="flex-1 px-6 py-3 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition"
                  >
                    {loading ? "Saving..." : editingLead ? "Update Distributor" : "Save Distributor"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab("list");
                      setEditingLead(null);
                    }}
                    className="px-6 py-3 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-white transition"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </form>
          </motion.div>
        )}

        {/* Lead Detail Modal */}
        {viewingLead && (
          <div 
            className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-md flex items-center justify-center p-4"
            onClick={() => setViewingLead(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900/95 to-slate-800/95 backdrop-blur-xl p-6 shadow-2xl ring-1 ring-white/5"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-6 pb-4 border-b border-white/10">
                <div>
                  <h2 className="text-2xl font-bold text-white mb-2">
                    {viewingLead.companyName}
                  </h2>
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-3 py-1 rounded-full text-sm font-medium ${
                        viewingLead.type === "exhibitor"
                          ? "bg-blue-500/20 text-blue-300"
                          : "bg-purple-500/20 text-purple-300"
                      }`}
                    >
                      {viewingLead.type === "exhibitor" ? "🏢 Exhibitor" : "🚚 Distributor"}
                    </span>
                    {viewingLead.priority && (
                      <span
                        className={`px-3 py-1 rounded-full text-sm font-medium border ${getPriorityColor(
                          viewingLead.priority
                        )}`}
                      >
                        {viewingLead.priority}
                      </span>
                    )}
                    {viewingLead.conversationQuality && (
                      <span
                        className={`px-3 py-1 rounded text-sm font-medium ${getConversationColor(
                          viewingLead.conversationQuality
                        )}`}
                      >
                        {viewingLead.conversationQuality === "excellent"
                          ? "⭐ Excellent"
                          : viewingLead.conversationQuality === "good"
                          ? "👍 Good"
                          : viewingLead.conversationQuality === "okay"
                          ? "👌 Okay"
                          : viewingLead.conversationQuality === "poor"
                          ? "😐 Poor"
                          : "❌ No Conversation"}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setViewingLead(null)}
                  className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition flex items-center justify-center"
                >
                  ✕
                </button>
              </div>

              {/* Content */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Company Information */}
                <div className="md:col-span-2">
                  <h3 className="text-lg font-semibold text-white mb-4 border-b border-white/10 pb-2">
                    Company Information
                  </h3>
                </div>

                {viewingLead.productCategory && (
                  <div>
                    <label className="block text-sm font-medium text-white/70 mb-1">Product Category</label>
                    <div className="text-white">{viewingLead.productCategory}</div>
                  </div>
                )}

                {viewingLead.totalSKU && (
                  <div>
                    <label className="block text-sm font-medium text-white/70 mb-1">Total SKU</label>
                    <div className="text-white">{viewingLead.totalSKU}</div>
                  </div>
                )}

                {viewingLead.website && (
                  <div>
                    <label className="block text-sm font-medium text-white/70 mb-1">Website</label>
                    <a
                      href={viewingLead.website.startsWith("http") ? viewingLead.website : `https://${viewingLead.website}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:text-blue-300 underline"
                    >
                      {viewingLead.website}
                    </a>
                  </div>
                )}

                {viewingLead.averageAreaOfBusiness && (
                  <div>
                    <label className="block text-sm font-medium text-white/70 mb-1">Average Area of Business</label>
                    <div className="text-white">{viewingLead.averageAreaOfBusiness}</div>
                  </div>
                )}

                {/* Distributor specific fields */}
                {viewingLead.type === "distributor" && (
                  <>
                    {viewingLead.products && (
                      <div>
                        <label className="block text-sm font-medium text-white/70 mb-1">Products</label>
                        <div className="text-white">{viewingLead.products}</div>
                      </div>
                    )}
                    {viewingLead.distributionAreas && (
                      <div>
                        <label className="block text-sm font-medium text-white/70 mb-1">Distribution Areas</label>
                        <div className="text-white">{viewingLead.distributionAreas}</div>
                      </div>
                    )}
                    {viewingLead.connectedCompanies && (
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-white/70 mb-1">Connected Companies</label>
                        <div className="text-white">{viewingLead.connectedCompanies}</div>
                      </div>
                    )}
                  </>
                )}

                {/* Contact Information */}
                <div className="md:col-span-2 mt-4">
                  <h3 className="text-lg font-semibold text-white mb-4 border-b border-white/10 pb-2">
                    Contact Information
                  </h3>
                </div>

                {viewingLead.contactPersonName && (
                  <div>
                    <label className="block text-sm font-medium text-white/70 mb-1">Contact Person</label>
                    <div className="text-white">{viewingLead.contactPersonName}</div>
                  </div>
                )}

                {viewingLead.designation && (
                  <div>
                    <label className="block text-sm font-medium text-white/70 mb-1">Designation</label>
                    <div className="text-white">{viewingLead.designation}</div>
                  </div>
                )}

                {viewingLead.phone && (
                  <div>
                    <label className="block text-sm font-medium text-white/70 mb-1">Phone</label>
                    <a href={`tel:${viewingLead.phone}`} className="text-blue-400 hover:text-blue-300">
                      {viewingLead.phone}
                    </a>
                  </div>
                )}

                {viewingLead.email && (
                  <div>
                    <label className="block text-sm font-medium text-white/70 mb-1">Email</label>
                    <a href={`mailto:${viewingLead.email}`} className="text-blue-400 hover:text-blue-300">
                      {viewingLead.email}
                    </a>
                  </div>
                )}

                {/* Assessment */}
                <div className="md:col-span-2 mt-4">
                  <h3 className="text-lg font-semibold text-white mb-4 border-b border-white/10 pb-2">
                    Assessment & Details
                  </h3>
                </div>

                {viewingLead.currentSoftware && (
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-white/70 mb-1">Current Software/Tools</label>
                    <div className="text-white">{viewingLead.currentSoftware}</div>
                  </div>
                )}

                {viewingLead.problemsFacing && (
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-white/70 mb-1">Problems They Are Facing</label>
                    <div className="text-white whitespace-pre-wrap bg-white/5 p-3 rounded-lg border border-white/10">
                      {viewingLead.problemsFacing}
                    </div>
                  </div>
                )}

                {/* Platform Capabilities (Exhibitor only) */}
                {viewingLead.type === "exhibitor" && (
                  <div className="md:col-span-2 mt-4">
                    <h3 className="text-lg font-semibold text-white mb-4 border-b border-white/10 pb-2">
                      Platform Capabilities
                    </h3>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex items-center gap-2">
                        <span className={viewingLead.hasDistributorControl ? "text-emerald-400" : "text-white/40"}>
                          {viewingLead.hasDistributorControl ? "✓" : "✗"}
                        </span>
                        <span className="text-white/70">Has Distributor Control System</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={viewingLead.providesDistributorSoftware ? "text-emerald-400" : "text-white/40"}>
                          {viewingLead.providesDistributorSoftware ? "✓" : "✗"}
                        </span>
                        <span className="text-white/70">Provides Software to Distributors</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={viewingLead.hasRetailerConnection ? "text-emerald-400" : "text-white/40"}>
                          {viewingLead.hasRetailerConnection ? "✓" : "✗"}
                        </span>
                        <span className="text-white/70">Has Retailer Connections</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={viewingLead.hasSinglePlatform ? "text-emerald-400" : "text-white/40"}>
                          {viewingLead.hasSinglePlatform ? "✓" : "✗"}
                        </span>
                        <span className="text-white/70">Has Single Platform for All Connections</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Additional Information */}
                <div className="md:col-span-2 mt-4">
                  <h3 className="text-lg font-semibold text-white mb-4 border-b border-white/10 pb-2">
                    Additional Information
                  </h3>
                </div>

                {viewingLead.followUpDate && (
                  <div>
                    <label className="block text-sm font-medium text-white/70 mb-1">Follow-up Date</label>
                    <div className="text-white">
                      {new Date(viewingLead.followUpDate).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </div>
                  </div>
                )}

                {viewingLead.eventName && (
                  <div>
                    <label className="block text-sm font-medium text-white/70 mb-1">Event</label>
                    <div className="text-white">{viewingLead.eventName}</div>
                  </div>
                )}

                {viewingLead.notes && (
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-white/70 mb-1">Notes</label>
                    <div className="text-white whitespace-pre-wrap bg-white/5 p-3 rounded-lg border border-white/10">
                      {viewingLead.notes}
                    </div>
                  </div>
                )}

                {viewingLead.createdAt && (
                  <div className="md:col-span-2 mt-4 pt-4 border-t border-white/10">
                    <div className="text-xs text-white/50">
                      Created: {new Date(viewingLead.createdAt?.toMillis?.() || viewingLead.createdAt || Date.now()).toLocaleString()}
                    </div>
                  </div>
                )}

                {/* Photos Section */}
                {viewingLead.photos && viewingLead.photos.length > 0 && (
                  <div className="md:col-span-2 mt-4">
                    <h3 className="text-lg font-semibold text-white mb-4 border-b border-white/10 pb-2">
                      Photos ({viewingLead.photos.length})
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {viewingLead.photos.map((photoUrl, index) => (
                        <div key={index} className="relative group">
                          <img
                            src={photoUrl}
                            alt={`Photo ${index + 1}`}
                            className="w-full h-40 object-cover rounded-lg border border-white/10 cursor-pointer hover:opacity-80 transition"
                            onClick={() => window.open(photoUrl, '_blank')}
                          />
                          <div className="absolute inset-0 bg-black/0 hover:bg-black/20 rounded-lg transition flex items-center justify-center opacity-0 group-hover:opacity-100">
                            <span className="text-white text-sm">Click to view full size</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-4 mt-6 pt-6 border-t border-white/10">
                <button
                  onClick={() => {
                    setViewingLead(null);
                    handleEdit(viewingLead);
                  }}
                  className="flex-1 px-6 py-3 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 font-semibold transition border border-blue-500/50"
                >
                  ✏️ Edit Lead
                </button>
                <button
                  onClick={() => setViewingLead(null)}
                  className="px-6 py-3 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-white transition"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LeadManagement;


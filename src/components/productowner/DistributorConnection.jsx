import React, { useEffect, useState, useMemo } from "react";
import { db, auth } from "../../firebase/firebaseConfig";
import ProductOwnerAssignOrderForm from "./ProductOwnerAssignOrderForm";
import OrderDetailModal from "./OrderDetailModal";
import OrderFlow from "./OrderFlow";
import TerritoryManagement from "./TerritoryManagement";
import { fetchStates, fetchDistricts } from "../../services/indiaLocationAPI";
import {
  getStorage,
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
} from "firebase/storage";
import {
  collection,
  getDocs,
  addDoc,
  doc,
  getDoc,
  updateDoc,
  query,
  where,
  onSnapshot,
  setDoc,
  deleteDoc,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "react-toastify";
import {
  FaPlus,
  FaSearch,
  FaUserPlus,
  FaBox,
  FaTruck,
  FaCheckCircle,
  FaClock,
  FaExclamationTriangle,
  FaEye,
  FaEdit,
  FaTrash,
  FaMapMarkerAlt,
  FaIdCard,
  FaLink,
  FaSave,
  FaFileAlt,
  FaBuilding,
  FaUser,
  FaEnvelope,
  FaPhone,
  FaMapPin,
  FaGlobe,
  FaSpinner,
  FaCheck,
  FaTimes,
} from "react-icons/fa";

const DistributorConnection = () => {
  const [activeTab, setActiveTab] = useState("connected"); // Main tabs: connected, orderFlow, territory
  const [distributors, setDistributors] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [showAssignOrderModal, setShowAssignOrderModal] = useState(false);
  const [selectedDistributor, setSelectedDistributor] = useState(null);
  const [showOrderDetailModal, setShowOrderDetailModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [orders, setOrders] = useState([]);
  const [distributorOrderRequests, setDistributorOrderRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [flypIdSearch, setFlypIdSearch] = useState("");
  const [userData, setUserData] = useState(null);
  const [attachmentFiles, setAttachmentFiles] = useState([]);
  const [acceptPolicy, setAcceptPolicy] = useState(false);
  const [disconnectTarget, setDisconnectTarget] = useState(null);
  const [showDisconnectModal, setShowDisconnectModal] = useState(false);
  const [showDistributorDetailPanel, setShowDistributorDetailPanel] = useState(false);
  const [distributorDetailData, setDistributorDetailData] = useState(null);
  const [isEditingDetails, setIsEditingDetails] = useState(false);
  const [editedDistributorInfo, setEditedDistributorInfo] = useState({});
  const [detailPanelStatesList, setDetailPanelStatesList] = useState([]);

  // Fetch product owner user data
  useEffect(() => {
    const fetchUserData = async () => {
      const productOwnerId = auth.currentUser?.uid;
      if (!productOwnerId) return;
      
      try {
        const userDocRef = doc(db, "businesses", productOwnerId);
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
          setUserData(userDocSnap.data());
        }
      } catch (err) {
        console.error("Error fetching user data:", err);
      }
    };
    fetchUserData();
  }, []);

  // Form states
  const [newDistributor, setNewDistributor] = useState({
    businessName: "",
    ownerName: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    state: "",
    stateId: "",
    district: "",
    districtId: "",
    pincode: "",
    gstin: "",
    territory: "",
    location: {
      latitude: "",
      longitude: "",
      address: "",
    },
  });

  // Form validation and smart features
  const [formErrors, setFormErrors] = useState({});
  const [isValidatingPincode, setIsValidatingPincode] = useState(false);
  const [isValidatingGSTIN, setIsValidatingGSTIN] = useState(false);
  const [statesList, setStatesList] = useState([]);
  const [districtsList, setDistrictsList] = useState([]);
  const [duplicateCheck, setDuplicateCheck] = useState({ checking: false, found: false });

  // Load states on mount
  useEffect(() => {
    const loadStates = async () => {
      try {
        const states = await fetchStates();
        setStatesList(states);
      } catch (err) {
        console.error("Error loading states:", err);
      }
    };
    if (showCreateModal) {
      loadStates();
    }
  }, [showCreateModal]);

  // Load districts when state changes
  useEffect(() => {
    const loadDistricts = async () => {
      if (!newDistributor.stateId) {
        setDistrictsList([]);
        return;
      }
      try {
        const districts = await fetchDistricts(newDistributor.stateId);
        setDistrictsList(districts);
      } catch (err) {
        console.error("Error loading districts:", err);
      }
    };
    loadDistricts();
  }, [newDistributor.stateId]);

  // Utility functions
  const validatePhone = (phone) => {
    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.length !== 10) return false;
    return /^[6-9]\d{9}$/.test(cleaned); // Indian mobile number validation
  };

  const formatPhone = (phone) => {
    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.length === 10) {
      return cleaned;
    }
    return phone;
  };

  const validateGSTIN = (gstin) => {
    if (!gstin) return { valid: true, error: null };
    const cleaned = gstin.toUpperCase().replace(/\s/g, "");
    if (cleaned.length !== 15) {
      return { valid: false, error: "GSTIN must be 15 characters" };
    }
    if (!/^[0-9A-Z]{15}$/.test(cleaned)) {
      return { valid: false, error: "GSTIN must be alphanumeric" };
    }
    return { valid: true, error: null, cleaned };
  };

  const extractStateFromGSTIN = (gstin) => {
    if (!gstin || gstin.length < 2) return null;
    const stateCode = gstin.substring(0, 2);
    // Map state codes to state names
    const stateCodeMap = {
      "01": "JAMMU AND KASHMIR", "02": "HIMACHAL PRADESH", "03": "PUNJAB", "04": "CHANDIGARH",
      "05": "UTTARAKHAND", "06": "HARYANA", "07": "DELHI", "08": "RAJASTHAN",
      "09": "UTTAR PRADESH", "10": "BIHAR", "11": "SIKKIM", "12": "ARUNACHAL PRADESH",
      "13": "NAGALAND", "14": "MANIPUR", "15": "MIZORAM", "16": "TRIPURA",
      "17": "MEGHALAYA", "18": "ASSAM", "19": "WEST BENGAL", "20": "JHARKHAND",
      "21": "ODISHA", "22": "CHHATTISGARH", "23": "MADHYA PRADESH", "24": "GUJARAT",
      "25": "DAMAN AND DIU", "26": "DADRA AND NAGAR HAVELI", "27": "MAHARASHTRA",
      "28": "ANDHRA PRADESH", "29": "KARNATAKA", "30": "GOA", "31": "LAKSHADWEEP",
      "32": "KERALA", "33": "TAMIL NADU", "34": "PUDUCHERRY", "35": "ANDAMAN AND NICOBAR ISLANDS",
      "36": "TELANGANA", "37": "ANDHRA PRADESH", "38": "LADAKH"
    };
    return stateCodeMap[stateCode] || null;
  };

  const lookupPincode = async (pincode) => {
    if (!pincode || pincode.length !== 6) return null;
    setIsValidatingPincode(true);
    try {
      // Using public India Post API
      const response = await fetch(`https://api.postalpincode.in/pincode/${pincode}`);
      const data = await response.json();
      if (data && data[0] && data[0].Status === "Success" && data[0].PostOffice && data[0].PostOffice.length > 0) {
        const postOffice = data[0].PostOffice[0];
        return {
          city: postOffice.District || postOffice.Name,
          state: postOffice.State,
          district: postOffice.District,
        };
      }
      return null;
    } catch (err) {
      console.error("Error looking up pincode:", err);
      return null;
    } finally {
      setIsValidatingPincode(false);
    }
  };

  const checkDuplicate = async (email, phone) => {
    if (!email && !phone) return false;
    setDuplicateCheck({ checking: true, found: false });
    try {
      const productOwnerId = auth.currentUser?.uid;
      if (!productOwnerId) return false;

      const distributorsRef = collection(db, `businesses/${productOwnerId}/connectedDistributors`);
      const distributorsSnap = await getDocs(distributorsRef);
      
      const found = distributorsSnap.docs.some(doc => {
        const data = doc.data();
        return (email && (data.email === email || data.distributorEmail === email)) ||
               (phone && (data.phone === phone || data.distributorPhone === phone));
      });

      setDuplicateCheck({ checking: false, found });
      return found;
    } catch (err) {
      console.error("Error checking duplicate:", err);
      setDuplicateCheck({ checking: false, found: false });
      return false;
    }
  };

  const [newOrder, setNewOrder] = useState({
    productId: "",
    productName: "",
    quantity: "",
    priority: "normal",
    notes: "",
  });

  const storage = getStorage();

  // Extract fetchDistributors to be reusable
  const fetchDistributors = async () => {
    const productOwnerId = auth.currentUser?.uid;
    if (!productOwnerId) return;

    setLoading(true);
    try {
      // Fetch connected distributors
      const distributorsRef = collection(
        db,
        `businesses/${productOwnerId}/connectedDistributors`
      );
      const distributorsSnap = await getDocs(distributorsRef);
      const distributorsList = [];

      // Parallel fetch all distributor business docs at once for faster loading
      const distributorPromises = distributorsSnap.docs.map(async (distributorDoc) => {
        const distributorData = distributorDoc.data();
        const distributorId = distributorData.distributorId || distributorDoc.id;

        // Fetch distributor details from businesses collection
        try {
          const distributorBusinessRef = doc(db, "businesses", distributorId);
          const distributorBusinessSnap = await getDoc(distributorBusinessRef);
          if (distributorBusinessSnap.exists()) {
            return {
              id: distributorDoc.id,
              distributorId,
              ...distributorBusinessSnap.data(),
              ...distributorData,
              connectionStatus: distributorData.status || "connected",
              connectedAt: distributorData.connectedAt,
              manualNotes: distributorData.manualNotes || "",
              additionalInfo: distributorData.additionalInfo || "",
              contractDetails: distributorData.contractDetails || "",
              paymentTerms: distributorData.paymentTerms || "",
              specialInstructions: distributorData.specialInstructions || "",
            };
          } else {
            return {
              id: distributorDoc.id,
              distributorId,
              ...distributorData,
              connectionStatus: distributorData.status || "connected",
              manualNotes: distributorData.manualNotes || "",
              additionalInfo: distributorData.additionalInfo || "",
              contractDetails: distributorData.contractDetails || "",
              paymentTerms: distributorData.paymentTerms || "",
              specialInstructions: distributorData.specialInstructions || "",
            };
          }
        } catch (err) {
          console.error("Error fetching distributor details:", err);
          return {
            id: distributorDoc.id,
            distributorId,
            ...distributorData,
            manualNotes: distributorData.manualNotes || "",
            additionalInfo: distributorData.additionalInfo || "",
            contractDetails: distributorData.contractDetails || "",
            paymentTerms: distributorData.paymentTerms || "",
            specialInstructions: distributorData.specialInstructions || "",
          };
        }
      });

      // Wait for all parallel fetches to complete
      distributorsList.push(...(await Promise.all(distributorPromises)));

        setDistributors(distributorsList);

        // Fetch assigned orders to distributors (new Product Owner -> Distributor flow)
        const assignedOrdersRef = collection(db, `businesses/${productOwnerId}/assignedOrdersToDistributors`);
        const assignedOrdersSnap = await getDocs(assignedOrdersRef);
        const ordersList = assignedOrdersSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        // Sort by most recent first
        ordersList.sort((a, b) => {
          const aTime = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : (a.timestamp?.toDate ? a.timestamp.toDate().getTime() : 0);
          const bTime = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : (b.timestamp?.toDate ? b.timestamp.toDate().getTime() : 0);
          return bTime - aTime;
        });
        setOrders(ordersList);

        // Note: Order requests are now fetched via real-time listener in useEffect below
    } catch (err) {
      console.error("Error fetching distributors:", err);
      toast.error("Failed to refresh distributors list");
    } finally {
      setLoading(false);
    }
  };

  // Real-time listener for distributor order requests
  useEffect(() => {
    const productOwnerId = auth.currentUser?.uid;
    if (!productOwnerId) return;

    console.log('[DistributorConnection] Setting up real-time listener for distributor order requests');
    const distributorOrderRequestsRef = collection(db, `businesses/${productOwnerId}/distributorOrderRequests`);
    
    const unsubscribe = onSnapshot(
      distributorOrderRequestsRef,
      (snapshot) => {
        console.log(`[DistributorConnection] Received ${snapshot.docs.length} distributor order requests`);
        const distributorOrderRequestsList = snapshot.docs.map((doc) => ({ 
          id: doc.id, 
          ...doc.data() 
        }));
        
        // Sort by most recent first
        distributorOrderRequestsList.sort((a, b) => {
          const aTime = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : (a.timestamp?.toDate ? a.timestamp.toDate().getTime() : 0);
          const bTime = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : (b.timestamp?.toDate ? b.timestamp.toDate().getTime() : 0);
          return bTime - aTime;
        });
        
        setDistributorOrderRequests(distributorOrderRequestsList);
        
        // Show notification for new orders
        if (distributorOrderRequestsList.length > 0) {
          const latestOrder = distributorOrderRequestsList[0];
          console.log('[DistributorConnection] Latest order:', latestOrder);
        }
      },
      (err) => {
        console.error('[DistributorConnection] Error listening to distributor order requests:', err);
        toast.error('Failed to load order requests. Please refresh.');
      }
    );

    return () => {
      console.log('[DistributorConnection] Cleaning up distributor order requests listener');
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    fetchDistributors();
  }, []);

  // Real-time sync: Listen for distributor profile updates and sync to product owner's view
  useEffect(() => {
    const productOwnerId = auth.currentUser?.uid;
    if (!productOwnerId || distributors.length === 0) return;

    const unsubscribes = [];
    const distributorIds = distributors
      .map((d) => d.distributorId || d.id)
      .filter(Boolean);

    // Set up listeners for each connected distributor's business profile
    distributorIds.forEach((distributorId) => {
      // Listen to distributor's business profile changes
      const distributorProfileRef = doc(db, "businesses", distributorId);
      const unsubscribe = onSnapshot(
        distributorProfileRef,
        async (snapshot) => {
          if (!snapshot.exists()) return;

          const distributorData = snapshot.data();
          
          try {
            // Update product owner's connectedDistributors document with latest distributor profile data
            const connectionRef = doc(
              db,
              `businesses/${productOwnerId}/connectedDistributors/${distributorId}`
            );

            // Get current connection data to preserve connection-specific fields
            const connectionSnap = await getDoc(connectionRef);
            const currentConnectionData = connectionSnap.exists() ? connectionSnap.data() : {};

            // Only update if there are actual changes to avoid unnecessary writes
            const updateData = {
              businessName: distributorData.businessName || currentConnectionData.businessName,
              distributorName: distributorData.businessName || distributorData.distributorName || currentConnectionData.distributorName,
              ownerName: distributorData.ownerName || distributorData.name || currentConnectionData.ownerName,
              email: distributorData.email || currentConnectionData.email,
              distributorEmail: distributorData.email || currentConnectionData.distributorEmail,
              phone: distributorData.phone || currentConnectionData.phone,
              distributorPhone: distributorData.phone || currentConnectionData.distributorPhone,
              address: distributorData.address || currentConnectionData.address,
              distributorAddress: distributorData.address || currentConnectionData.distributorAddress,
              city: distributorData.city || currentConnectionData.city,
              distributorCity: distributorData.city || currentConnectionData.distributorCity,
              state: distributorData.state || currentConnectionData.state,
              distributorState: distributorData.state || currentConnectionData.distributorState,
              pincode: distributorData.pincode || currentConnectionData.pincode,
              gstin: distributorData.gstin || distributorData.gstNumber || currentConnectionData.gstin,
              profileSyncedAt: serverTimestamp(),
            };

            // Check if update is needed
            const needsUpdate = 
              updateData.businessName !== currentConnectionData.businessName ||
              updateData.ownerName !== currentConnectionData.ownerName ||
              updateData.email !== currentConnectionData.email ||
              updateData.phone !== currentConnectionData.phone ||
              updateData.address !== currentConnectionData.address ||
              updateData.city !== currentConnectionData.city ||
              updateData.state !== currentConnectionData.state ||
              updateData.pincode !== currentConnectionData.pincode ||
              updateData.gstin !== currentConnectionData.gstin;

            if (needsUpdate) {
              await updateDoc(connectionRef, updateData);
              // Refresh the distributors list to show updated data
              await fetchDistributors();
            }
          } catch (err) {
            console.error(`Error syncing distributor ${distributorId} profile:`, err);
          }
        },
        (err) => {
          console.error(`Error listening to distributor ${distributorId} profile:`, err);
        }
      );

      unsubscribes.push(unsubscribe);
    });

    // Cleanup listeners on unmount or when distributors change
    return () => {
      unsubscribes.forEach((unsub) => unsub());
    };
  }, [distributors.map((d) => d.distributorId || d.id).filter(Boolean).join(",")]); // Re-run when distributor IDs change

  // Search for distributor by FLYP ID
  const handleSearchByFlypId = async () => {
    if (!flypIdSearch.trim()) {
      toast.error("Please enter a FLYP ID");
      return;
    }

    setSearching(true);
    setSearchResults([]);

    try {
      const distributorId = flypIdSearch.trim();
      
      // Check if distributor exists in businesses collection
      const distributorRef = doc(db, "businesses", distributorId);
      const distributorSnap = await getDoc(distributorRef);

      if (!distributorSnap.exists()) {
        toast.error("Distributor not found with this FLYP ID");
        setSearching(false);
        return;
      }

      const distributorData = distributorSnap.data();
      
      // Check if it's actually a distributor
      if (distributorData.role?.toLowerCase() !== "distributor") {
        toast.error("This FLYP ID belongs to a non-distributor account");
        setSearching(false);
        return;
      }

      // Check if already connected
      const productOwnerId = auth.currentUser?.uid;
      const connectionRef = doc(
        db,
        `businesses/${productOwnerId}/connectedDistributors/${distributorId}`
      );
      const connectionSnap = await getDoc(connectionRef);

      if (connectionSnap.exists()) {
        toast.warning("This distributor is already connected");
        setSearching(false);
        return;
      }

      // Add to search results
      setSearchResults([
        {
          id: distributorId,
          distributorId: distributorId,
          ...distributorData,
          flypId: distributorId,
        },
      ]);
      toast.success("Distributor found!");
    } catch (err) {
      console.error("Error searching distributor:", err);
      toast.error("Failed to search distributor. Please try again.");
    } finally {
      setSearching(false);
    }
  };

  const uploadAttachments = async (files, productOwnerId, distributorId) => {
    if (!files || files.length === 0) return [];
    const uploads = [];
    const errors = [];
    
    for (const file of files) {
      try {
        // Validate file size (max 10MB)
        const maxSize = 10 * 1024 * 1024; // 10MB
        if (file.size > maxSize) {
          errors.push(`${file.name}: File size exceeds 10MB limit`);
          continue;
        }

        // Validate file type
        const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
        if (!allowedTypes.includes(file.type)) {
          errors.push(`${file.name}: Invalid file type. Allowed: PDF, DOC, DOCX, JPG, PNG`);
          continue;
        }

        const timestamp = Date.now();
        const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
        const path = `connections/${productOwnerId}/${distributorId}/${timestamp}-${sanitizedFileName}`;
        const ref = storageRef(storage, path);
        
        await uploadBytes(ref, file);
        const url = await getDownloadURL(ref);
        
        uploads.push({
          name: file.name,
          type: file.type,
          size: file.size,
          url,
          uploadedAt: serverTimestamp(),
          uploadedBy: productOwnerId,
          path,
        });
      } catch (error) {
        console.error(`Error uploading file ${file.name}:`, error);
        errors.push(`${file.name}: ${error.message || 'Upload failed'}`);
      }
    }

    if (errors.length > 0) {
      throw new Error(`Some files failed to upload:\n${errors.join('\n')}`);
    }

    return uploads;
  };

  // Connect to existing distributor
  const handleConnectDistributor = async (distributor) => {
    const productOwnerId = auth.currentUser?.uid;
    if (!productOwnerId || !distributor.distributorId) {
      toast.error("Missing required information. Please try again.");
      return;
    }

    if (!acceptPolicy) {
      toast.error("Please accept the policy before connecting.");
      return;
    }

    try {
      // Verify distributor exists and is actually a distributor
      const distributorDocRef = doc(db, "businesses", distributor.distributorId);
      const distributorDocSnap = await getDoc(distributorDocRef);
      
      if (!distributorDocSnap.exists()) {
        toast.error("Distributor not found. Please verify the FLYP ID.");
        return;
      }
      
      const distributorData = distributorDocSnap.data();
      const distributorRole = distributorData.role?.toLowerCase();
      if (distributorRole !== "distributor") {
        toast.error("The provided ID does not belong to a distributor.");
        return;
      }

      // Fetch product owner details for complete data
      const productOwnerDocRef = doc(db, "businesses", productOwnerId);
      const productOwnerDocSnap = await getDoc(productOwnerDocRef);
      const productOwnerData = productOwnerDocSnap.exists() ? productOwnerDocSnap.data() : {};

      // Upload attachments if provided
      let attachmentsPayload = [];
      if (attachmentFiles && attachmentFiles.length > 0) {
        try {
          attachmentsPayload = await uploadAttachments(
            Array.from(attachmentFiles),
            productOwnerId,
            distributor.distributorId
          );
          if (attachmentsPayload.length > 0) {
            toast.success(`${attachmentsPayload.length} file(s) uploaded successfully`);
          }
        } catch (uploadError) {
          console.error("Error uploading attachments:", uploadError);
          toast.error(uploadError.message || "Failed to upload some files. Connection will proceed without attachments.");
          // Continue with connection even if file upload fails
        }
      }

      // Use batch write to ensure both connections are created atomically
      const batch = writeBatch(db);

      // Add to product owner's connected distributors
      const productOwnerConnectionRef = doc(
        db,
        `businesses/${productOwnerId}/connectedDistributors/${distributor.distributorId}`
      );
      batch.set(productOwnerConnectionRef, {
        distributorId: distributor.distributorId,
        distributorName: distributor.businessName || distributor.distributorName || distributorData.businessName || "",
        distributorEmail: distributor.email || distributorData.email || "",
        distributorPhone: distributor.phone || distributorData.phone || "",
        distributorCity: distributor.city || distributorData.city || "",
        distributorState: distributor.state || distributorData.state || "",
        distributorAddress: distributor.address || distributorData.address || "",
        territory: distributor.territory || "",
        location: distributor.location || {},
        status: "connected",
        connectedAt: serverTimestamp(),
        connectedBy: productOwnerId,
        flypId: distributor.distributorId,
        attachments: attachmentsPayload,
        policiesAccepted: true,
        policyVersion: "v1",
        policyAcceptedAt: serverTimestamp(),
        policyAcceptedBy: productOwnerId,
      }, { merge: true });

      // Add to distributor's connected product owners (bidirectional connection)
      const distributorConnectionRef = doc(
        db,
        `businesses/${distributor.distributorId}/connectedProductOwners/${productOwnerId}`
      );
      batch.set(distributorConnectionRef, {
        productOwnerId: productOwnerId,
        productOwnerName: productOwnerData.businessName || auth.currentUser?.displayName || "Product Owner",
        productOwnerEmail: auth.currentUser?.email || productOwnerData.email || "",
        productOwnerPhone: productOwnerData.phone || "",
        productOwnerAddress: productOwnerData.address || "",
        productOwnerCity: productOwnerData.city || "",
        productOwnerState: productOwnerData.state || "",
        connectedAt: serverTimestamp(),
        status: "connected",
        attachments: attachmentsPayload,
        policiesAccepted: true,
        policyVersion: "v1",
        policyAcceptedAt: serverTimestamp(),
        policyAcceptedBy: productOwnerId,
      }, { merge: true });

      // Commit both writes atomically
      await batch.commit();

      console.log("✅ Connection created successfully:", {
        productOwnerId,
        distributorId: distributor.distributorId,
        productOwnerConnection: `businesses/${productOwnerId}/connectedDistributors/${distributor.distributorId}`,
        distributorConnection: `businesses/${distributor.distributorId}/connectedProductOwners/${productOwnerId}`
      });

      toast.success("Distributor connected successfully!");
      setShowSearchModal(false);
      setFlypIdSearch("");
      setSearchResults([]);
      setAttachmentFiles([]);
      setAcceptPolicy(false);
      
      // Refresh distributors list without reloading page
      await fetchDistributors();
    } catch (err) {
      console.error("Error connecting distributor:", err);
      console.error("Error details:", {
        code: err.code,
        message: err.message,
        productOwnerId,
        distributorId: distributor.distributorId,
        stack: err.stack
      });
      
      // Provide more specific error messages
      let errorMessage = "Failed to connect distributor. ";
      if (err.code === "permission-denied") {
        errorMessage += "Permission denied. Please check Firebase rules.";
      } else if (err.code === "not-found") {
        errorMessage += "Distributor not found.";
      } else {
        errorMessage += err.message || "Please check console for details.";
      }
      
      toast.error(errorMessage);
    }
  };

  const validateForm = () => {
    const errors = {};
    
    if (!newDistributor.businessName.trim()) {
      errors.businessName = "Business name is required";
    }
    
    if (!newDistributor.ownerName.trim()) {
      errors.ownerName = "Owner name is required";
    }
    
    if (!newDistributor.email.trim()) {
      errors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newDistributor.email)) {
      errors.email = "Invalid email format";
    }
    
    if (!newDistributor.phone.trim()) {
      errors.phone = "Phone is required";
    } else if (!validatePhone(newDistributor.phone)) {
      errors.phone = "Invalid phone number (must be 10 digits starting with 6-9)";
    }
    
    if (!newDistributor.address.trim()) {
      errors.address = "Address is required";
    }
    
    if (!newDistributor.city.trim()) {
      errors.city = "City is required";
    }
    
    if (!newDistributor.state.trim()) {
      errors.state = "State is required";
    }
    
    // Territory is now optional
    
    if (newDistributor.pincode && newDistributor.pincode.length !== 6) {
      errors.pincode = "Pincode must be 6 digits";
    }
    
    if (newDistributor.gstin) {
      const gstValidation = validateGSTIN(newDistributor.gstin);
      if (!gstValidation.valid) {
        errors.gstin = gstValidation.error;
      }
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCreateDistributor = async (e) => {
    e.preventDefault();
    const productOwnerId = auth.currentUser?.uid;
    if (!productOwnerId) return;

    // Validate form
    if (!validateForm()) {
      toast.error("Please fix the errors in the form");
      return;
    }

    // Check for duplicates
    const isDuplicate = await checkDuplicate(newDistributor.email, formatPhone(newDistributor.phone));
    if (isDuplicate) {
      toast.error("A distributor with this email or phone already exists");
      return;
    }

    try {
      const formattedPhone = formatPhone(newDistributor.phone);
      const cleanedGSTIN = newDistributor.gstin ? validateGSTIN(newDistributor.gstin).cleaned || newDistributor.gstin.toUpperCase() : "";

      const distributorData = {
        businessName: newDistributor.businessName.trim(),
        ownerName: newDistributor.ownerName.trim(),
        email: newDistributor.email.trim().toLowerCase(),
        phone: formattedPhone,
        address: newDistributor.address.trim(),
        city: newDistributor.city.trim(),
        state: newDistributor.state.trim(),
        stateId: newDistributor.stateId || "",
        district: newDistributor.district || "",
        districtId: newDistributor.districtId || "",
        pincode: newDistributor.pincode || "",
        gstin: cleanedGSTIN,
        territory: newDistributor.territory?.trim() || "",
        location: newDistributor.location,
        role: "distributor",
        createdAt: serverTimestamp(),
        createdBy: productOwnerId,
        status: "connected",
        connectedAt: serverTimestamp(),
        isProvisional: true,
      };

      // Create distributor document
      const distributorRef = doc(
        collection(db, `businesses/${productOwnerId}/connectedDistributors`)
      );
      
      await setDoc(distributorRef, distributorData);

      toast.success("Distributor created and connected successfully!");
      setShowCreateModal(false);
      setFormErrors({});
      setNewDistributor({
        businessName: "",
        ownerName: "",
        email: "",
        phone: "",
        address: "",
        city: "",
        state: "",
        stateId: "",
        district: "",
        districtId: "",
        pincode: "",
        gstin: "",
        territory: "",
        location: {
          latitude: "",
          longitude: "",
          address: "",
        },
      });
      
      // Refresh list without reloading page
      await fetchDistributors();
    } catch (err) {
      console.error("Error creating distributor:", err);
      toast.error("Failed to create distributor. Please try again.");
    }
  };

  const handleDisconnectDistributor = (distributor) => {
    const productOwnerId = auth.currentUser?.uid;
    if (!productOwnerId || !distributor.distributorId) {
      toast.error("Missing required information.");
      return;
    }
    setDisconnectTarget(distributor);
    setShowDisconnectModal(true);
  };

  const confirmDisconnect = async () => {
    if (!disconnectTarget) return;
    const distributor = disconnectTarget;
    const productOwnerId = auth.currentUser?.uid;

    try {
      const batch = writeBatch(db);

      const productOwnerConnectionRef = doc(
        db,
        `businesses/${productOwnerId}/connectedDistributors/${distributor.distributorId}`
      );
      batch.delete(productOwnerConnectionRef);

      const distributorConnectionRef = doc(
        db,
        `businesses/${distributor.distributorId}/connectedProductOwners/${productOwnerId}`
      );
      batch.delete(distributorConnectionRef);

      await batch.commit();

      toast.success("Distributor disconnected successfully!");
      setShowDisconnectModal(false);
      setDisconnectTarget(null);
      
      // Refresh list without reloading page
      await fetchDistributors();
    } catch (err) {
      console.error("Error disconnecting distributor:", err);
      console.error("Error details:", {
        code: err.code,
        message: err.message,
        productOwnerId,
        distributorId: distributor.distributorId
      });
      
      let errorMessage = "Failed to disconnect distributor. ";
      if (err.code === "permission-denied") {
        errorMessage += "Permission denied.";
      } else {
        errorMessage += err.message || "Please check console for details.";
      }
      
      toast.error(errorMessage);
    }
  };

  const openDistributorDetailPanel = async (distributor) => {
    setDistributorDetailData(distributor);
    setEditedDistributorInfo({
      businessName: distributor.businessName || distributor.distributorName || "",
      ownerName: distributor.ownerName || "",
      email: distributor.email || distributor.distributorEmail || "",
      phone: distributor.phone || distributor.distributorPhone || "",
      address: distributor.address || distributor.distributorAddress || "",
      city: distributor.city || distributor.distributorCity || "",
      state: distributor.state || distributor.distributorState || "",
      stateId: distributor.stateId || "",
      district: distributor.district || "",
      districtId: distributor.districtId || "",
      pincode: distributor.pincode || "",
      gstin: distributor.gstin || "",
      territory: distributor.territory || "",
      manualNotes: distributor.manualNotes || "",
      additionalInfo: distributor.additionalInfo || "",
      contractDetails: distributor.contractDetails || "",
      paymentTerms: distributor.paymentTerms || "",
      specialInstructions: distributor.specialInstructions || "",
    });
    setIsEditingDetails(false);
    setShowDistributorDetailPanel(true);
    
    // Load states for edit mode
    try {
      const states = await fetchStates();
      setDetailPanelStatesList(states);
    } catch (err) {
      console.error("Error loading states:", err);
    }
  };

  const closeDistributorDetailPanel = () => {
    setShowDistributorDetailPanel(false);
    setDistributorDetailData(null);
    setIsEditingDetails(false);
    setEditedDistributorInfo({});
  };

  const saveDistributorDetails = async () => {
    const productOwnerId = auth.currentUser?.uid;
    if (!productOwnerId || !distributorDetailData) return;

    const distributorId = distributorDetailData.distributorId || distributorDetailData.id;
    
    // Validate basic fields
    if (!editedDistributorInfo.businessName?.trim()) {
      toast.error("Business name is required");
      return;
    }
    if (!editedDistributorInfo.email?.trim()) {
      toast.error("Email is required");
      return;
    }
    if (!editedDistributorInfo.phone?.trim()) {
      toast.error("Phone is required");
      return;
    }
    if (!validatePhone(editedDistributorInfo.phone)) {
      toast.error("Invalid phone number");
      return;
    }
    
    try {
      const connectionRef = doc(
        db,
        `businesses/${productOwnerId}/connectedDistributors/${distributorId}`
      );

      const formattedPhone = formatPhone(editedDistributorInfo.phone);
      const cleanedGSTIN = editedDistributorInfo.gstin ? validateGSTIN(editedDistributorInfo.gstin).cleaned || editedDistributorInfo.gstin.toUpperCase() : "";

      await updateDoc(connectionRef, {
        // Basic information
        businessName: editedDistributorInfo.businessName.trim(),
        distributorName: editedDistributorInfo.businessName.trim(),
        ownerName: editedDistributorInfo.ownerName.trim(),
        email: editedDistributorInfo.email.trim().toLowerCase(),
        distributorEmail: editedDistributorInfo.email.trim().toLowerCase(),
        phone: formattedPhone,
        distributorPhone: formattedPhone,
        address: editedDistributorInfo.address.trim(),
        distributorAddress: editedDistributorInfo.address.trim(),
        city: editedDistributorInfo.city.trim(),
        distributorCity: editedDistributorInfo.city.trim(),
        state: editedDistributorInfo.state.trim(),
        distributorState: editedDistributorInfo.state.trim(),
        stateId: editedDistributorInfo.stateId || "",
        district: editedDistributorInfo.district || "",
        districtId: editedDistributorInfo.districtId || "",
        pincode: editedDistributorInfo.pincode || "",
        gstin: cleanedGSTIN,
        territory: editedDistributorInfo.territory?.trim() || "",
        // Additional information
        manualNotes: editedDistributorInfo.manualNotes || "",
        additionalInfo: editedDistributorInfo.additionalInfo || "",
        contractDetails: editedDistributorInfo.contractDetails || "",
        paymentTerms: editedDistributorInfo.paymentTerms || "",
        specialInstructions: editedDistributorInfo.specialInstructions || "",
        lastUpdated: serverTimestamp(),
        updatedBy: productOwnerId,
      });

      toast.success("Distributor information saved successfully!");
      setIsEditingDetails(false);
      
      // Refresh to get updated data
      await fetchDistributors();
      
      // Update the current panel data
      const updated = await getDoc(connectionRef);
      if (updated.exists()) {
        const updatedData = updated.data();
        setDistributorDetailData(prev => ({
          ...prev,
          ...updatedData,
          businessName: updatedData.businessName || updatedData.distributorName || prev.businessName,
          ownerName: updatedData.ownerName || prev.ownerName,
          email: updatedData.email || updatedData.distributorEmail || prev.email,
          phone: updatedData.phone || updatedData.distributorPhone || prev.phone,
          address: updatedData.address || updatedData.distributorAddress || prev.address,
          city: updatedData.city || updatedData.distributorCity || prev.city,
          state: updatedData.state || updatedData.distributorState || prev.state,
          pincode: updatedData.pincode || prev.pincode,
          gstin: updatedData.gstin || prev.gstin,
          territory: updatedData.territory || prev.territory,
          manualNotes: updatedData.manualNotes || "",
          additionalInfo: updatedData.additionalInfo || "",
          contractDetails: updatedData.contractDetails || "",
          paymentTerms: updatedData.paymentTerms || "",
          specialInstructions: updatedData.specialInstructions || "",
        }));
        // Also update edited info
        setEditedDistributorInfo({
          businessName: updatedData.businessName || updatedData.distributorName || "",
          ownerName: updatedData.ownerName || "",
          email: updatedData.email || updatedData.distributorEmail || "",
          phone: updatedData.phone || updatedData.distributorPhone || "",
          address: updatedData.address || updatedData.distributorAddress || "",
          city: updatedData.city || updatedData.distributorCity || "",
          state: updatedData.state || updatedData.distributorState || "",
          stateId: updatedData.stateId || "",
          district: updatedData.district || "",
          districtId: updatedData.districtId || "",
          pincode: updatedData.pincode || "",
          gstin: updatedData.gstin || "",
          territory: updatedData.territory || "",
          manualNotes: updatedData.manualNotes || "",
          additionalInfo: updatedData.additionalInfo || "",
          contractDetails: updatedData.contractDetails || "",
          paymentTerms: updatedData.paymentTerms || "",
          specialInstructions: updatedData.specialInstructions || "",
        });
      }
    } catch (err) {
      console.error("Error saving distributor details:", err);
      toast.error("Failed to save information. Please try again.");
    }
  };

  const handleAssignOrderSuccess = () => {
    setShowAssignOrderModal(false);
    setSelectedDistributor(null);
    // Refresh orders if needed
    fetchDistributors();
  };

  const filteredDistributors = distributors.filter((dist) => {
    const query = searchQuery.toLowerCase();
    return (
      dist.businessName?.toLowerCase().includes(query) ||
      dist.ownerName?.toLowerCase().includes(query) ||
      dist.email?.toLowerCase().includes(query) ||
      dist.territory?.toLowerCase().includes(query)
    );
  });

  const getStatusColor = (status) => {
    switch (status) {
      case "connected":
        return "bg-emerald-400/20 text-emerald-300 border-emerald-400/30";
      case "pending":
        return "bg-yellow-400/20 text-yellow-300 border-yellow-400/30";
      case "inactive":
        return "bg-gray-400/20 text-gray-300 border-gray-400/30";
      default:
        return "bg-blue-400/20 text-blue-300 border-blue-400/30";
    }
  };

  const getOrderStatusColor = (status) => {
    switch (status) {
      case "assigned":
        return "bg-blue-400/20 text-blue-300";
      case "accepted":
        return "bg-emerald-400/20 text-emerald-300";
      case "in_transit":
        return "bg-orange-400/20 text-orange-300";
      case "delivered":
        return "bg-green-400/20 text-green-300";
      case "cancelled":
        return "bg-red-400/20 text-red-300";
      default:
        return "bg-gray-400/20 text-gray-300";
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6 text-white p-4"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold">Distributor Connections</h2>
          <p className="text-white/70 text-sm mt-1">
            Manage your distributor network and assign orders
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowSearchModal(true)}
            className="px-4 py-2 bg-blue-500 hover:bg-blue-600 rounded-lg flex items-center gap-2 transition"
          >
            <FaSearch /> Search by FLYP ID
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 rounded-lg flex items-center gap-2 transition"
          >
            <FaPlus /> Create Distributor
          </button>
        </div>
      </div>

      {/* Main Tabs */}
      <div className="flex gap-2 border-b border-white/10">
        {[
          { id: "connected", label: "Connected Distributors", icon: <FaUserPlus /> },
          { 
            id: "orderFlow", 
            label: "Order Flow", 
            icon: <FaBox />,
            badge: distributorOrderRequests.length > 0 ? distributorOrderRequests.filter(o => o.status === 'REQUESTED' || o.statusCode === 'REQUESTED').length : 0
          },
          { id: "territory", label: "Territory", icon: <FaMapMarkerAlt /> },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 flex items-center gap-2 transition ${
              activeTab === tab.id
                ? "border-b-2 border-emerald-400 text-emerald-300"
                : "text-white/70 hover:text-white"
            }`}
          >
            {tab.icon} {tab.label}
            {tab.badge !== undefined && tab.badge > 0 && (
              <span className="ml-1 px-2 py-0.5 bg-red-500 text-white text-xs rounded-full">
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Connected Distributors Tab */}
      {activeTab === "connected" && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          {/* Search */}
          <div className="relative">
            <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white/50" />
            <input
              type="text"
              placeholder="Search distributors..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
            />
          </div>

          {/* Distributors Grid */}
          {loading ? (
            <div className="text-center py-12 text-white/50">Loading distributors...</div>
          ) : filteredDistributors.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredDistributors.map((distributor) => (
                <motion.div
                  key={distributor.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-xl p-4 hover:bg-white/10 transition"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-lg">{distributor.businessName || "Unnamed"}</h3>
                      <p className="text-sm text-white/70">{distributor.ownerName}</p>
                    </div>
                    <span
                      className={`px-2 py-1 rounded-full text-xs border ${getStatusColor(
                        distributor.connectionStatus
                      )}`}
                    >
                      {distributor.connectionStatus}
                    </span>
                  </div>

                  <div className="space-y-2 text-sm text-white/70 mb-4">
                    {distributor.email && (
                      <p>
                        <span className="text-white/50">Email:</span> {distributor.email}
                      </p>
                    )}
                    {distributor.phone && (
                      <p>
                        <span className="text-white/50">Phone:</span> {distributor.phone}
                      </p>
                    )}
                    {distributor.territory && (
                      <p>
                        <span className="text-white/50">Territory:</span> {distributor.territory}
                      </p>
                    )}
                    {distributor.city && (
                      <p>
                        <span className="text-white/50">Location:</span> {distributor.city}
                        {distributor.state && `, ${distributor.state}`}
                      </p>
                    )}
                    {distributor.flypId && (
                      <p className="text-xs text-emerald-400 font-mono">
                        <span className="text-white/50">FLYP ID:</span> {distributor.flypId}
                      </p>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => openDistributorDetailPanel(distributor)}
                      className="flex-1 px-3 py-2 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-400/30 rounded-lg text-blue-300 text-sm transition flex items-center justify-center gap-2"
                    >
                      <FaEye /> View Details
                    </button>
                    <button
                      onClick={() => {
                        setSelectedDistributor(distributor);
                        setShowAssignOrderModal(true);
                      }}
                      className="flex-1 px-3 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/30 rounded-lg text-emerald-300 text-sm transition"
                    >
                      Assign Order
                    </button>
                    <button
                      onClick={() => handleDisconnectDistributor(distributor)}
                      className="px-3 py-2 bg-red-500/20 hover:bg-red-500/30 border border-red-400/30 rounded-lg text-red-300 text-sm transition"
                      title="Disconnect"
                    >
                      <FaTrash />
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-white/50">
              No distributors found. Create your first distributor to get started.
            </div>
          )}
        </motion.div>
      )}

      {/* Order Flow Tab */}
      {activeTab === "orderFlow" && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          <OrderFlow
            distributorOrderRequests={distributorOrderRequests}
            orders={orders}
            onOrderUpdate={() => {
              fetchDistributors();
            }}
            fetchDistributors={fetchDistributors}
          />
        </motion.div>
      )}

      {/* Territory Tab */}
      {activeTab === "territory" && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          <TerritoryManagement distributors={distributors} />
        </motion.div>
      )}

      {/* Create Distributor Modal - Redesigned */}
      <AnimatePresence>
        {showCreateModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => {
              setShowCreateModal(false);
              setFormErrors({});
              setNewDistributor({
                businessName: "",
                ownerName: "",
                email: "",
                phone: "",
                address: "",
                city: "",
                state: "",
                stateId: "",
                district: "",
                districtId: "",
                pincode: "",
                gstin: "",
                territory: "",
                location: {
                  latitude: "",
                  longitude: "",
                  address: "",
                },
              });
            }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-slate-900 rounded-xl border border-white/10 p-6 max-w-3xl w-full max-h-[90vh] overflow-y-auto"
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-2xl font-bold text-white flex items-center gap-2">
                    <FaUserPlus className="text-emerald-400" />
                    Create New Distributor
                  </h3>
                  <p className="text-sm text-white/60 mt-1">Add a new distributor to your network</p>
                </div>
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    setFormErrors({});
                  }}
                  className="text-white/60 hover:text-white transition"
                >
                  <FaTimes className="text-xl" />
                </button>
              </div>

              <form onSubmit={handleCreateDistributor} className="space-y-6">
                {/* Section 1: Basic Information */}
                <div className="bg-white/5 rounded-lg p-5 border border-white/10">
                  <h4 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <FaBuilding className="text-emerald-400" />
                    Basic Information
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-white/80 mb-2">
                        Business Name <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="text"
                        value={newDistributor.businessName}
                        onChange={(e) => {
                          setNewDistributor({ ...newDistributor, businessName: e.target.value });
                          if (formErrors.businessName) {
                            setFormErrors({ ...formErrors, businessName: "" });
                          }
                        }}
                        className={`w-full px-4 py-2.5 bg-white/10 border rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 transition ${
                          formErrors.businessName
                            ? "border-red-400/50 focus:ring-red-400/50"
                            : "border-white/20 focus:ring-emerald-400/50"
                        }`}
                        placeholder="e.g., ABC Traders"
                      />
                      {formErrors.businessName && (
                        <p className="text-red-400 text-xs mt-1">{formErrors.businessName}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-white/80 mb-2">
                        Owner Name <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="text"
                        value={newDistributor.ownerName}
                        onChange={(e) => {
                          setNewDistributor({ ...newDistributor, ownerName: e.target.value });
                          if (formErrors.ownerName) {
                            setFormErrors({ ...formErrors, ownerName: "" });
                          }
                        }}
                        className={`w-full px-4 py-2.5 bg-white/10 border rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 transition ${
                          formErrors.ownerName
                            ? "border-red-400/50 focus:ring-red-400/50"
                            : "border-white/20 focus:ring-emerald-400/50"
                        }`}
                        placeholder="e.g., John Doe"
                      />
                      {formErrors.ownerName && (
                        <p className="text-red-400 text-xs mt-1">{formErrors.ownerName}</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Section 2: Contact Information */}
                <div className="bg-white/5 rounded-lg p-5 border border-white/10">
                  <h4 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <FaEnvelope className="text-blue-400" />
                    Contact Information
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-white/80 mb-2">
                        Email <span className="text-red-400">*</span>
                      </label>
                      <div className="relative">
                        <input
                          type="email"
                          value={newDistributor.email}
                          onChange={async (e) => {
                            const email = e.target.value;
                            setNewDistributor({ ...newDistributor, email });
                            if (formErrors.email) {
                              setFormErrors({ ...formErrors, email: "" });
                            }
                            // Check duplicate on blur
                            if (email && email.includes("@")) {
                              const isDup = await checkDuplicate(email, "");
                              if (isDup && !duplicateCheck.found) {
                                setFormErrors({ ...formErrors, email: "Email already exists" });
                              }
                            }
                          }}
                          className={`w-full px-4 py-2.5 bg-white/10 border rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 transition ${
                            formErrors.email
                              ? "border-red-400/50 focus:ring-red-400/50"
                              : "border-white/20 focus:ring-emerald-400/50"
                          }`}
                          placeholder="owner@business.com"
                        />
                        {duplicateCheck.checking && (
                          <FaSpinner className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-white/50" />
                        )}
                      </div>
                      {formErrors.email && (
                        <p className="text-red-400 text-xs mt-1">{formErrors.email}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-white/80 mb-2">
                        Phone <span className="text-red-400">*</span>
                      </label>
                      <div className="flex gap-2">
                        <span className="inline-flex items-center px-3 rounded-l-lg bg-white/10 border border-r-0 border-white/20 text-white/70 select-none">
                          +91
                        </span>
                        <input
                          type="tel"
                          maxLength={10}
                          value={newDistributor.phone}
                          onChange={async (e) => {
                            const phone = e.target.value.replace(/\D/g, "");
                            setNewDistributor({ ...newDistributor, phone });
                            if (formErrors.phone) {
                              setFormErrors({ ...formErrors, phone: "" });
                            }
                            // Check duplicate when phone is complete
                            if (phone.length === 10) {
                              const isDup = await checkDuplicate("", phone);
                              if (isDup && !duplicateCheck.found) {
                                setFormErrors({ ...formErrors, phone: "Phone already exists" });
                              }
                            }
                          }}
                          className={`flex-1 px-4 py-2.5 bg-white/10 border rounded-r-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 transition ${
                            formErrors.phone
                              ? "border-red-400/50 focus:ring-red-400/50"
                              : "border-white/20 focus:ring-emerald-400/50"
                          }`}
                          placeholder="10-digit number"
                        />
                      </div>
                      {formErrors.phone && (
                        <p className="text-red-400 text-xs mt-1">{formErrors.phone}</p>
                      )}
                      {newDistributor.phone && validatePhone(newDistributor.phone) && (
                        <p className="text-emerald-400 text-xs mt-1 flex items-center gap-1">
                          <FaCheck /> Valid phone number
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Section 3: Location Details */}
                <div className="bg-white/5 rounded-lg p-5 border border-white/10">
                  <h4 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <FaMapMarkerAlt className="text-purple-400" />
                    Location Details
                  </h4>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-white/80 mb-2">
                        Address <span className="text-red-400">*</span>
                      </label>
                      <textarea
                        value={newDistributor.address}
                        onChange={(e) => {
                          setNewDistributor({ ...newDistributor, address: e.target.value });
                          if (formErrors.address) {
                            setFormErrors({ ...formErrors, address: "" });
                          }
                        }}
                        rows={3}
                        className={`w-full px-4 py-2.5 bg-white/10 border rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 transition ${
                          formErrors.address
                            ? "border-red-400/50 focus:ring-red-400/50"
                            : "border-white/20 focus:ring-emerald-400/50"
                        }`}
                        placeholder="Street address, building, area"
                      />
                      {formErrors.address && (
                        <p className="text-red-400 text-xs mt-1">{formErrors.address}</p>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-white/80 mb-2">
                          Pincode
                        </label>
                        <div className="relative">
                          <input
                            type="text"
                            maxLength={6}
                            value={newDistributor.pincode}
                            onChange={async (e) => {
                              const pincode = e.target.value.replace(/\D/g, "");
                              setNewDistributor({ ...newDistributor, pincode });
                              if (formErrors.pincode) {
                                setFormErrors({ ...formErrors, pincode: "" });
                              }
                              // Auto-fill city/state when pincode is complete
                              if (pincode.length === 6) {
                                const locationData = await lookupPincode(pincode);
                                if (locationData) {
                                  setNewDistributor(prev => ({
                                    ...prev,
                                    pincode,
                                    city: prev.city || locationData.city,
                                    state: prev.state || locationData.state,
                                    district: prev.district || locationData.district,
                                  }));
                                  toast.success("Location auto-filled from pincode!");
                                }
                              }
                            }}
                            className={`w-full px-4 py-2.5 bg-white/10 border rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 transition ${
                              formErrors.pincode
                                ? "border-red-400/50 focus:ring-red-400/50"
                                : "border-white/20 focus:ring-emerald-400/50"
                            }`}
                            placeholder="6-digit pincode"
                          />
                          {isValidatingPincode && (
                            <FaSpinner className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-white/50" />
                          )}
                        </div>
                        {formErrors.pincode && (
                          <p className="text-red-400 text-xs mt-1">{formErrors.pincode}</p>
                        )}
                        {newDistributor.pincode.length === 6 && !isValidatingPincode && (
                          <p className="text-xs text-white/50 mt-1">Press Tab to auto-fill location</p>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-white/80 mb-2">
                          City <span className="text-red-400">*</span>
                        </label>
                        <input
                          type="text"
                          value={newDistributor.city}
                          onChange={(e) => {
                            setNewDistributor({ ...newDistributor, city: e.target.value });
                            if (formErrors.city) {
                              setFormErrors({ ...formErrors, city: "" });
                            }
                          }}
                          className={`w-full px-4 py-2.5 bg-white/10 border rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 transition ${
                            formErrors.city
                              ? "border-red-400/50 focus:ring-red-400/50"
                              : "border-white/20 focus:ring-emerald-400/50"
                          }`}
                          placeholder="City name"
                        />
                        {formErrors.city && (
                          <p className="text-red-400 text-xs mt-1">{formErrors.city}</p>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-white/80 mb-2">
                          State <span className="text-red-400">*</span>
                        </label>
                        <select
                          value={newDistributor.stateId}
                          onChange={(e) => {
                            const selectedState = statesList.find(s => s.id === e.target.value);
                            setNewDistributor({
                              ...newDistributor,
                              stateId: e.target.value,
                              state: selectedState ? selectedState.name : "",
                              district: "",
                              districtId: "",
                            });
                            if (formErrors.state) {
                              setFormErrors({ ...formErrors, state: "" });
                            }
                          }}
                          className={`w-full px-4 py-2.5 bg-white/10 border rounded-lg text-white focus:outline-none focus:ring-2 transition ${
                            formErrors.state
                              ? "border-red-400/50 focus:ring-red-400/50"
                              : "border-white/20 focus:ring-emerald-400/50"
                          }`}
                        >
                          <option value="">Select State</option>
                          {statesList.map((state) => (
                            <option key={state.id} value={state.id} className="bg-slate-800">
                              {state.name}
                            </option>
                          ))}
                        </select>
                        {formErrors.state && (
                          <p className="text-red-400 text-xs mt-1">{formErrors.state}</p>
                        )}
                      </div>
                    </div>

                    {newDistributor.stateId && districtsList.length > 0 && (
                      <div>
                        <label className="block text-sm font-medium text-white/80 mb-2">
                          District (Optional)
                        </label>
                        <select
                          value={newDistributor.districtId}
                          onChange={(e) => {
                            const selectedDistrict = districtsList.find(d => d.id === e.target.value);
                            setNewDistributor({
                              ...newDistributor,
                              districtId: e.target.value,
                              district: selectedDistrict ? selectedDistrict.name : "",
                            });
                          }}
                          className="w-full px-4 py-2.5 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
                        >
                          <option value="">Select District</option>
                          {districtsList.map((district) => (
                            <option key={district.id} value={district.id} className="bg-slate-800">
                              {district.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                </div>

                {/* Section 4: Business Details */}
                <div className="bg-white/5 rounded-lg p-5 border border-white/10">
                  <h4 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <FaGlobe className="text-orange-400" />
                    Business Details
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-white/80 mb-2">
                        GSTIN
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          maxLength={15}
                          value={newDistributor.gstin}
                          onChange={async (e) => {
                            let gstin = e.target.value.toUpperCase().replace(/[^0-9A-Z]/g, "");
                            setNewDistributor({ ...newDistributor, gstin });
                            if (formErrors.gstin) {
                              setFormErrors({ ...formErrors, gstin: "" });
                            }
                            // Auto-detect state from GSTIN
                            if (gstin.length >= 2) {
                              const detectedState = extractStateFromGSTIN(gstin);
                              if (detectedState && !newDistributor.state) {
                                const matchingState = statesList.find(s => 
                                  s.name.toUpperCase() === detectedState.toUpperCase()
                                );
                                if (matchingState) {
                                  setNewDistributor(prev => ({
                                    ...prev,
                                    gstin,
                                    stateId: matchingState.id,
                                    state: matchingState.name,
                                  }));
                                  toast.info("State auto-detected from GSTIN");
                                }
                              }
                            }
                            // Validate GSTIN format
                            if (gstin.length === 15) {
                              const validation = validateGSTIN(gstin);
                              if (!validation.valid) {
                                setFormErrors({ ...formErrors, gstin: validation.error });
                              }
                            }
                          }}
                          className={`w-full px-4 py-2.5 bg-white/10 border rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 transition uppercase ${
                            formErrors.gstin
                              ? "border-red-400/50 focus:ring-red-400/50"
                              : "border-white/20 focus:ring-emerald-400/50"
                          }`}
                          placeholder="15-character GSTIN"
                        />
                        {isValidatingGSTIN && (
                          <FaSpinner className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-white/50" />
                        )}
                      </div>
                      {formErrors.gstin && (
                        <p className="text-red-400 text-xs mt-1">{formErrors.gstin}</p>
                      )}
                      {newDistributor.gstin.length === 15 && validateGSTIN(newDistributor.gstin).valid && (
                        <p className="text-emerald-400 text-xs mt-1 flex items-center gap-1">
                          <FaCheck /> Valid GSTIN format
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-white/80 mb-2">
                        Territory / Region
                      </label>
                      <input
                        type="text"
                        value={newDistributor.territory}
                        onChange={(e) => {
                          setNewDistributor({ ...newDistributor, territory: e.target.value });
                          if (formErrors.territory) {
                            setFormErrors({ ...formErrors, territory: "" });
                          }
                        }}
                        className={`w-full px-4 py-2.5 bg-white/10 border rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 transition ${
                          formErrors.territory
                            ? "border-red-400/50 focus:ring-red-400/50"
                            : "border-white/20 focus:ring-emerald-400/50"
                        }`}
                        placeholder="e.g., North Zone, Mumbai Region"
                      />
                      {formErrors.territory && (
                        <p className="text-red-400 text-xs mt-1">{formErrors.territory}</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 pt-4 border-t border-white/10">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateModal(false);
                      setFormErrors({});
                      setNewDistributor({
                        businessName: "",
                        ownerName: "",
                        email: "",
                        phone: "",
                        address: "",
                        city: "",
                        state: "",
                        stateId: "",
                        district: "",
                        districtId: "",
                        pincode: "",
                        gstin: "",
                        territory: "",
                        location: {
                          latitude: "",
                          longitude: "",
                          address: "",
                        },
                      });
                    }}
                    className="flex-1 px-4 py-3 bg-white/10 hover:bg-white/20 rounded-lg transition text-white font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-3 bg-emerald-500 hover:bg-emerald-600 rounded-lg transition text-white font-medium flex items-center justify-center gap-2"
                  >
                    <FaPlus /> Create Distributor
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Search by FLYP ID Modal */}
      <AnimatePresence>
        {showSearchModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => {
              setShowSearchModal(false);
              setFlypIdSearch("");
              setSearchResults([]);
              setAttachmentFiles([]);
              setAcceptPolicy(false);
            }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-slate-900 rounded-xl border border-white/10 p-6 max-w-lg w-full"
            >
              <div className="flex items-center gap-3 mb-4">
                <FaIdCard className="text-2xl text-blue-400" />
                <h3 className="text-xl font-bold">Search Distributor by FLYP ID</h3>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-white/70 mb-2">
                    Enter FLYP ID (Business ID)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={flypIdSearch}
                      onChange={(e) => setFlypIdSearch(e.target.value)}
                      onKeyPress={(e) => e.key === "Enter" && handleSearchByFlypId()}
                      placeholder="Enter distributor's FLYP ID"
                      className="flex-1 px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-400/50"
                    />
                    <button
                      onClick={handleSearchByFlypId}
                      disabled={searching || !flypIdSearch.trim()}
                      className="px-6 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-500/50 disabled:cursor-not-allowed rounded-lg transition flex items-center gap-2"
                    >
                      {searching ? (
                        <>
                          <span className="animate-spin">⏳</span> Searching...
                        </>
                      ) : (
                        <>
                          <FaSearch /> Search
                        </>
                      )}
                    </button>
                  </div>
                  <p className="text-xs text-white/50 mt-2">
                    💡 FLYP ID is the unique business identifier assigned to each distributor on the platform
                  </p>
                </div>

                {/* Search Results */}
                {searchResults.length > 0 && (
                  <div className="mt-4 space-y-3">
                    <h4 className="text-sm font-semibold text-white/80">Search Results</h4>
                    {searchResults.map((distributor) => (
                      <div
                        key={distributor.id}
                        className="p-4 rounded-lg bg-white/5 border border-white/10"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <h5 className="font-semibold text-white mb-1">
                              {distributor.businessName || distributor.distributorName || "Unnamed"}
                            </h5>
                            <p className="text-sm text-white/70">{distributor.ownerName}</p>
                          </div>
                          <span className="px-2 py-1 rounded-full text-xs bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                            Found
                          </span>
                        </div>
                        
                        <div className="space-y-1 text-sm text-white/70 mb-4">
                          {distributor.email && (
                            <p>
                              <span className="text-white/50">Email:</span> {distributor.email}
                            </p>
                          )}
                          {distributor.phone && (
                            <p>
                              <span className="text-white/50">Phone:</span> {distributor.phone}
                            </p>
                          )}
                          {distributor.city && (
                            <p>
                              <span className="text-white/50">Location:</span> {distributor.city}
                              {distributor.state && `, ${distributor.state}`}
                            </p>
                          )}
                          <p className="text-xs text-emerald-400 font-mono">
                            FLYP ID: {distributor.flypId || distributor.id}
                          </p>
                        </div>

                      <div className="space-y-3 mb-4">
                        <div>
                          <label className="block text-sm text-white/80 mb-1">
                            Attach documents (agreements, onboarding PDFs)
                          </label>
                          <input
                            type="file"
                            multiple
                            accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                            onChange={(e) => setAttachmentFiles(e.target.files)}
                            className="w-full text-sm text-white/70 file:mr-3 file:px-3 file:py-2 file:rounded-lg file:border-0 file:bg-white/10 file:text-white hover:file:bg-white/20"
                          />
                          <p className="text-xs text-white/50 mt-1">
                            Uploaded files will be shared with the distributor for records.
                          </p>
                        </div>
                        <div className="flex items-start gap-2 p-3 rounded-lg bg-white/5 border border-white/10">
                          <input
                            type="checkbox"
                            checked={acceptPolicy}
                            onChange={(e) => setAcceptPolicy(e.target.checked)}
                            className="mt-1"
                          />
                          <div className="text-xs text-white/70">
                            I confirm that this distributor agrees to the connection policy and terms. By proceeding,
                            both parties accept the shared documents/agreements.
                          </div>
                        </div>
                      </div>

                        <button
                          onClick={() => handleConnectDistributor(distributor)}
                          className="w-full px-4 py-2 bg-emerald-500 hover:bg-emerald-600 rounded-lg text-white font-medium transition flex items-center justify-center gap-2"
                        >
                          <FaLink /> Connect Distributor
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-4 mt-4 border-t border-white/10">
                <button
                  onClick={() => {
                    setShowSearchModal(false);
                    setFlypIdSearch("");
                    setSearchResults([]);
                    setAttachmentFiles([]);
                    setAcceptPolicy(false);
                  }}
                  className="flex-1 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Disconnect Confirmation */}
      <AnimatePresence>
        {showDisconnectModal && disconnectTarget && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowDisconnectModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-slate-900 rounded-xl border border-white/10 p-6 max-w-md w-full"
            >
              <h3 className="text-lg font-bold text-white mb-2">Disconnect Distributor</h3>
              <p className="text-sm text-white/70 mb-4">
                You are about to disconnect <span className="text-white font-semibold">{disconnectTarget.businessName || disconnectTarget.distributorName}</span>.
                Orders and history remain in your records, but no new actions can be taken until reconnected.
              </p>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowDisconnectModal(false)}
                  className="flex-1 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDisconnect}
                  className="flex-1 px-4 py-2 bg-red-500 hover:bg-red-600 rounded-lg transition text-white"
                >
                  Confirm Disconnect
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Assign Order Modal */}
      <AnimatePresence>
        {showAssignOrderModal && selectedDistributor && (
          <ProductOwnerAssignOrderForm
            distributor={selectedDistributor}
            onClose={() => {
              setShowAssignOrderModal(false);
              setSelectedDistributor(null);
            }}
            onSuccess={handleAssignOrderSuccess}
          />
        )}
      </AnimatePresence>

      {/* Order Detail Modal - Only show if not using OrderFlow component */}
      {activeTab !== "orderFlow" && (
      <AnimatePresence>
        {showOrderDetailModal && selectedOrder && (
          <OrderDetailModal
            order={selectedOrder}
              isDistributorOrderRequest={false}
            onClose={() => {
              setShowOrderDetailModal(false);
              setSelectedOrder(null);
            }}
            onUpdate={() => {
              // Refresh orders list
              fetchDistributors();
            }}
          />
        )}
      </AnimatePresence>
      )}

      {/* Distributor Detail Panel - Large View */}
      <AnimatePresence>
        {showDistributorDetailPanel && distributorDetailData && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={closeDistributorDetailPanel}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-slate-900 rounded-xl border border-white/10 w-full max-w-5xl max-h-[90vh] overflow-y-auto shadow-2xl"
            >
              {/* Header */}
              <div className="sticky top-0 bg-slate-900/95 backdrop-blur-md border-b border-white/10 p-6 flex items-center justify-between z-10">
                <div>
                  <h2 className="text-2xl font-bold text-white mb-1">
                    {distributorDetailData.businessName || "Distributor Details"}
                  </h2>
                  <p className="text-white/60 text-sm">
                    {distributorDetailData.ownerName || "Owner Name"}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {isEditingDetails ? (
                    <>
                      <button
                        onClick={() => {
                          setIsEditingDetails(false);
                          // Reset to original values
                          setEditedDistributorInfo({
                            businessName: distributorDetailData.businessName || distributorDetailData.distributorName || "",
                            ownerName: distributorDetailData.ownerName || "",
                            email: distributorDetailData.email || distributorDetailData.distributorEmail || "",
                            phone: distributorDetailData.phone || distributorDetailData.distributorPhone || "",
                            address: distributorDetailData.address || distributorDetailData.distributorAddress || "",
                            city: distributorDetailData.city || distributorDetailData.distributorCity || "",
                            state: distributorDetailData.state || distributorDetailData.distributorState || "",
                            stateId: distributorDetailData.stateId || "",
                            district: distributorDetailData.district || "",
                            districtId: distributorDetailData.districtId || "",
                            pincode: distributorDetailData.pincode || "",
                            gstin: distributorDetailData.gstin || "",
                            territory: distributorDetailData.territory || "",
                            manualNotes: distributorDetailData.manualNotes || "",
                            additionalInfo: distributorDetailData.additionalInfo || "",
                            contractDetails: distributorDetailData.contractDetails || "",
                            paymentTerms: distributorDetailData.paymentTerms || "",
                            specialInstructions: distributorDetailData.specialInstructions || "",
                          });
                        }}
                        className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white text-sm transition"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={saveDistributorDetails}
                        className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 rounded-lg text-white text-sm transition flex items-center gap-2"
                      >
                        <FaSave /> Save Changes
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => setIsEditingDetails(true)}
                      className="px-4 py-2 bg-blue-500 hover:bg-blue-600 rounded-lg text-white text-sm transition flex items-center gap-2"
                    >
                      <FaEdit /> Edit Information
                    </button>
                  )}
                  <button
                    onClick={closeDistributorDetailPanel}
                    className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white text-sm transition"
                  >
                    Close
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="p-6 space-y-6">
                {/* Basic Information */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-white/5 rounded-xl p-5 border border-white/10">
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                      <FaIdCard /> Basic Information
                    </h3>
                    <div className="space-y-3 text-sm">
                      <div>
                        <span className="text-white/50">Business Name:</span>
                        {isEditingDetails ? (
                          <input
                            type="text"
                            value={editedDistributorInfo.businessName || ""}
                            onChange={(e) => setEditedDistributorInfo({ ...editedDistributorInfo, businessName: e.target.value })}
                            className="w-full mt-1 px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
                          />
                        ) : (
                          <p className="text-white font-medium">{distributorDetailData.businessName || distributorDetailData.distributorName || "N/A"}</p>
                        )}
                      </div>
                      <div>
                        <span className="text-white/50">Owner Name:</span>
                        {isEditingDetails ? (
                          <input
                            type="text"
                            value={editedDistributorInfo.ownerName || ""}
                            onChange={(e) => setEditedDistributorInfo({ ...editedDistributorInfo, ownerName: e.target.value })}
                            className="w-full mt-1 px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
                          />
                        ) : (
                          <p className="text-white font-medium">{distributorDetailData.ownerName || "N/A"}</p>
                        )}
                      </div>
                      <div>
                        <span className="text-white/50">Email:</span>
                        {isEditingDetails ? (
                          <input
                            type="email"
                            value={editedDistributorInfo.email || ""}
                            onChange={(e) => setEditedDistributorInfo({ ...editedDistributorInfo, email: e.target.value })}
                            className="w-full mt-1 px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
                          />
                        ) : (
                          <p className="text-white">{distributorDetailData.email || distributorDetailData.distributorEmail || "N/A"}</p>
                        )}
                      </div>
                      <div>
                        <span className="text-white/50">Phone:</span>
                        {isEditingDetails ? (
                          <div className="flex gap-2 mt-1">
                            <span className="inline-flex items-center px-3 rounded-l-lg bg-white/10 border border-r-0 border-white/20 text-white/70 select-none">+91</span>
                            <input
                              type="tel"
                              maxLength={10}
                              value={editedDistributorInfo.phone || ""}
                              onChange={(e) => setEditedDistributorInfo({ ...editedDistributorInfo, phone: e.target.value.replace(/\D/g, "") })}
                              className="flex-1 px-3 py-2 rounded-r-lg bg-white/10 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
                            />
                          </div>
                        ) : (
                          <p className="text-white">{distributorDetailData.phone || distributorDetailData.distributorPhone || "N/A"}</p>
                        )}
                      </div>
                      <div>
                        <span className="text-white/50">FLYP ID:</span>
                        <p className="text-emerald-400 font-mono text-xs">{distributorDetailData.flypId || distributorDetailData.distributorId || distributorDetailData.id || "N/A"}</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white/5 rounded-xl p-5 border border-white/10">
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                      <FaMapMarkerAlt /> Location Details
                    </h3>
                    <div className="space-y-3 text-sm">
                      <div>
                        <span className="text-white/50">Address:</span>
                        {isEditingDetails ? (
                          <textarea
                            value={editedDistributorInfo.address || ""}
                            onChange={(e) => setEditedDistributorInfo({ ...editedDistributorInfo, address: e.target.value })}
                            rows={2}
                            className="w-full mt-1 px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
                          />
                        ) : (
                          <p className="text-white">{distributorDetailData.address || distributorDetailData.distributorAddress || "N/A"}</p>
                        )}
                      </div>
                      <div>
                        <span className="text-white/50">City:</span>
                        {isEditingDetails ? (
                          <input
                            type="text"
                            value={editedDistributorInfo.city || ""}
                            onChange={(e) => setEditedDistributorInfo({ ...editedDistributorInfo, city: e.target.value })}
                            className="w-full mt-1 px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
                          />
                        ) : (
                          <p className="text-white">{distributorDetailData.city || distributorDetailData.distributorCity || "N/A"}</p>
                        )}
                      </div>
                      <div>
                        <span className="text-white/50">State:</span>
                        {isEditingDetails ? (
                          <select
                            value={editedDistributorInfo.stateId || ""}
                            onChange={(e) => {
                              const selectedState = statesList.find(s => s.id === e.target.value);
                              setEditedDistributorInfo({
                                ...editedDistributorInfo,
                                stateId: e.target.value,
                                state: selectedState ? selectedState.name : editedDistributorInfo.state,
                              });
                            }}
                            className="w-full mt-1 px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
                          >
                            <option value="">Select State</option>
                            {(detailPanelStatesList.length > 0 ? detailPanelStatesList : statesList).map((state) => (
                              <option key={state.id} value={state.id} className="bg-slate-800">
                                {state.name}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <p className="text-white">{distributorDetailData.state || distributorDetailData.distributorState || "N/A"}</p>
                        )}
                      </div>
                      <div>
                        <span className="text-white/50">Pincode:</span>
                        {isEditingDetails ? (
                          <input
                            type="text"
                            maxLength={6}
                            value={editedDistributorInfo.pincode || ""}
                            onChange={(e) => setEditedDistributorInfo({ ...editedDistributorInfo, pincode: e.target.value.replace(/\D/g, "") })}
                            className="w-full mt-1 px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
                          />
                        ) : (
                          <p className="text-white">{distributorDetailData.pincode || "N/A"}</p>
                        )}
                      </div>
                      <div>
                        <span className="text-white/50">Territory:</span>
                        {isEditingDetails ? (
                          <input
                            type="text"
                            value={editedDistributorInfo.territory || ""}
                            onChange={(e) => setEditedDistributorInfo({ ...editedDistributorInfo, territory: e.target.value })}
                            className="w-full mt-1 px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
                          />
                        ) : (
                          <p className="text-white">{distributorDetailData.territory || "N/A"}</p>
                        )}
                      </div>
                      <div>
                        <span className="text-white/50">GSTIN:</span>
                        {isEditingDetails ? (
                          <input
                            type="text"
                            maxLength={15}
                            value={editedDistributorInfo.gstin || ""}
                            onChange={(e) => {
                              let gstin = e.target.value.toUpperCase().replace(/[^0-9A-Z]/g, "");
                              setEditedDistributorInfo({ ...editedDistributorInfo, gstin });
                            }}
                            className="w-full mt-1 px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/50 uppercase"
                          />
                        ) : (
                          <p className="text-white">{distributorDetailData.gstin || "N/A"}</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Connection Information */}
                <div className="bg-white/5 rounded-xl p-5 border border-white/10">
                  <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <FaLink /> Connection Information
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-white/50">Status:</span>
                      <span className={`ml-2 px-2 py-1 rounded-full text-xs ${getStatusColor(distributorDetailData.connectionStatus || "connected")}`}>
                        {distributorDetailData.connectionStatus || "connected"}
                      </span>
                    </div>
                    <div>
                      <span className="text-white/50">Connected:</span>
                      <p className="text-white">
                        {distributorDetailData.connectedAt?.toDate
                          ? distributorDetailData.connectedAt.toDate().toLocaleDateString()
                          : distributorDetailData.connectedAt
                          ? new Date(distributorDetailData.connectedAt).toLocaleDateString()
                          : "N/A"}
                      </p>
                    </div>
                    <div>
                      <span className="text-white/50">Connected By:</span>
                      <p className="text-white">{distributorDetailData.connectedBy || "N/A"}</p>
                    </div>
                  </div>
                </div>

                {/* Attachments */}
                {distributorDetailData.attachments && distributorDetailData.attachments.length > 0 && (
                  <div className="bg-white/5 rounded-xl p-5 border border-white/10">
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                      <FaFileAlt /> Attachments ({distributorDetailData.attachments.length})
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {distributorDetailData.attachments.map((attachment, idx) => (
                        <a
                          key={idx}
                          href={attachment.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-3 p-3 bg-white/5 hover:bg-white/10 rounded-lg transition border border-white/10"
                        >
                          <FaFileAlt className="text-blue-400 text-xl" />
                          <div className="flex-1 min-w-0">
                            <p className="text-white font-medium truncate">{attachment.name}</p>
                            <p className="text-white/50 text-xs">
                              {(attachment.size / 1024 / 1024).toFixed(2)} MB
                            </p>
                          </div>
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {/* Additional Information Fields - Editable */}
                <div className="space-y-4">
                  {/* Manual Notes */}
                  <div className="bg-white/5 rounded-xl p-5 border border-white/10">
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                      <FaEdit /> Manual Notes
                    </h3>
                    {isEditingDetails ? (
                      <textarea
                        value={editedDistributorInfo.manualNotes || ""}
                        onChange={(e) =>
                          setEditedDistributorInfo(prev => ({
                            ...prev,
                            manualNotes: e.target.value,
                          }))
                        }
                        placeholder="Add any manual notes, agreements, or additional information about this distributor..."
                        rows={6}
                        className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
                      />
                    ) : (
                      <div className="p-4 bg-white/5 rounded-lg text-white/70 min-h-[120px] whitespace-pre-wrap">
                        {distributorDetailData.manualNotes || (
                          <span className="text-white/40 italic">No notes added. Click Edit to add manual notes.</span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Additional Info */}
                  <div className="bg-white/5 rounded-xl p-5 border border-white/10">
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                      Additional Information
                    </h3>
                    {isEditingDetails ? (
                      <textarea
                        value={editedDistributorInfo.additionalInfo || ""}
                        onChange={(e) =>
                          setEditedDistributorInfo(prev => ({
                            ...prev,
                            additionalInfo: e.target.value,
                          }))
                        }
                        placeholder="Add any additional information about this distributor..."
                        rows={4}
                        className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
                      />
                    ) : (
                      <div className="p-4 bg-white/5 rounded-lg text-white/70 min-h-[100px] whitespace-pre-wrap">
                        {distributorDetailData.additionalInfo || (
                          <span className="text-white/40 italic">No additional information added.</span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Contract Details */}
                  <div className="bg-white/5 rounded-xl p-5 border border-white/10">
                    <h3 className="text-lg font-semibold text-white mb-4">Contract Details</h3>
                    {isEditingDetails ? (
                      <textarea
                        value={editedDistributorInfo.contractDetails || ""}
                        onChange={(e) =>
                          setEditedDistributorInfo(prev => ({
                            ...prev,
                            contractDetails: e.target.value,
                          }))
                        }
                        placeholder="Add contract details, terms, agreement information..."
                        rows={4}
                        className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
                      />
                    ) : (
                      <div className="p-4 bg-white/5 rounded-lg text-white/70 min-h-[100px] whitespace-pre-wrap">
                        {distributorDetailData.contractDetails || (
                          <span className="text-white/40 italic">No contract details added.</span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Payment Terms */}
                  <div className="bg-white/5 rounded-xl p-5 border border-white/10">
                    <h3 className="text-lg font-semibold text-white mb-4">Payment Terms</h3>
                    {isEditingDetails ? (
                      <textarea
                        value={editedDistributorInfo.paymentTerms || ""}
                        onChange={(e) =>
                          setEditedDistributorInfo(prev => ({
                            ...prev,
                            paymentTerms: e.target.value,
                          }))
                        }
                        placeholder="Add payment terms, conditions, credit terms..."
                        rows={4}
                        className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
                      />
                    ) : (
                      <div className="p-4 bg-white/5 rounded-lg text-white/70 min-h-[100px] whitespace-pre-wrap">
                        {distributorDetailData.paymentTerms || (
                          <span className="text-white/40 italic">No payment terms added.</span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Special Instructions */}
                  <div className="bg-white/5 rounded-xl p-5 border border-white/10">
                    <h3 className="text-lg font-semibold text-white mb-4">Special Instructions</h3>
                    {isEditingDetails ? (
                      <textarea
                        value={editedDistributorInfo.specialInstructions || ""}
                        onChange={(e) =>
                          setEditedDistributorInfo(prev => ({
                            ...prev,
                            specialInstructions: e.target.value,
                          }))
                        }
                        placeholder="Add special instructions, notes, or reminders about this distributor..."
                        rows={4}
                        className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
                      />
                    ) : (
                      <div className="p-4 bg-white/5 rounded-lg text-white/70 min-h-[100px] whitespace-pre-wrap">
                        {distributorDetailData.specialInstructions || (
                          <span className="text-white/40 italic">No special instructions added.</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default DistributorConnection;


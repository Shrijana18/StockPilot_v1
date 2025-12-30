import React, { useEffect, useMemo, useState } from "react";
import { db } from "../../firebase/firebaseConfig";
import { collection, onSnapshot, doc, getDoc, updateDoc, setDoc, getDocs, query, where, serverTimestamp } from "firebase/firestore";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { splitFromMrp } from "../../utils/pricing";
import { pdf } from "@react-pdf/renderer";
import { saveAs } from "file-saver";
import DistributorInvoicePdf from "./DistributorInvoicePdf";
import { FaStore, FaFileInvoice, FaBoxOpen, FaReceipt } from "react-icons/fa";
import { ORDER_STATUSES } from "../../constants/orderStatus";

// Invoice categories
const INVOICE_CATEGORIES = {
  RETAILER: 'retailer',
  MANUAL: 'manual',
  PRODUCT_OWNER: 'productOwner'
};

const DistributorInvoices = () => {
  const auth = getAuth();
  const [distributorId, setDistributorId] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [orderData, setOrderData] = useState(null);
  const [loadingOrder, setLoadingOrder] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [activeCategory, setActiveCategory] = useState(INVOICE_CATEGORIES.RETAILER);
  const [orderTypeMap, setOrderTypeMap] = useState({}); // Maps orderId -> 'retailer' | 'productOwner'
  const [backfillCompleted, setBackfillCompleted] = useState(false);

  // Helper function to create invoice for product owner orders (same logic as OrderDetailModal)
  const createInvoiceForProductOwnerOrder = async (orderId, orderData, currentDistributorId) => {
    try {
      const invoicesCol = collection(db, 'businesses', currentDistributorId, 'invoices');
      const invoiceRef = doc(invoicesCol, orderId);
      const existingInvoiceSnap = await getDoc(invoiceRef);

      if (!existingInvoiceSnap.exists()) {
        console.log('[DistributorInvoices] Creating invoice for product owner order:', orderId);

        // Fetch distributor profile for seller info
        const distributorProfileSnap = await getDoc(doc(db, 'businesses', currentDistributorId));
        const distributorProfile = distributorProfileSnap.exists() ? distributorProfileSnap.data() : {};

        // Fetch product owner profile for buyer info
        const productOwnerId = orderData.productOwnerId;
        let productOwnerProfile = {};
        if (productOwnerId) {
          try {
            const poProfileSnap = await getDoc(doc(db, 'businesses', productOwnerId));
            productOwnerProfile = poProfileSnap.exists() ? poProfileSnap.data() : {};
          } catch (err) {
            console.warn('[DistributorInvoices] Could not fetch product owner profile:', err);
          }
        }

        // Build buyer info (Product Owner)
        const buyerInfo = {
          businessId: productOwnerId || null,
          businessName: productOwnerProfile.businessName || orderData.productOwnerName || 'Product Owner',
          email: productOwnerProfile.email || orderData.productOwnerEmail || null,
          phone: productOwnerProfile.phone || orderData.productOwnerPhone || null,
          city: productOwnerProfile.city || orderData.productOwnerCity || null,
          state: productOwnerProfile.state || orderData.productOwnerState || null,
        };

        // Build seller info (Distributor)
        const sellerInfo = {
          businessId: currentDistributorId,
          businessName: distributorProfile.businessName || distributorProfile.ownerName || distributorProfile.name || null,
          email: distributorProfile.email || null,
          phone: distributorProfile.phone || null,
          city: distributorProfile.city || null,
          state: distributorProfile.state || null,
          gstNumber: distributorProfile.gstNumber || distributorProfile.gstin || null,
        };

        // Get totals from chargesSnapshot or proforma
        const breakdown = orderData?.chargesSnapshot?.breakdown || orderData?.proforma;
        let invoiceTotals = {
          grandTotal: breakdown?.grandTotal 
            ? Number(breakdown.grandTotal)
            : (orderData.grandTotal || orderData.itemsSubTotal || 0),
        };

        // If we have a full breakdown, include all details
        if (breakdown) {
          invoiceTotals = {
            grossItems: Number(breakdown.grossItems || 0),
            lineDiscountTotal: Number(breakdown.lineDiscountTotal || 0),
            itemsSubTotal: Number(breakdown.itemsSubTotal || breakdown.subTotal || 0),
            delivery: Number(breakdown.delivery || 0),
            packing: Number(breakdown.packing || 0),
            insurance: Number(breakdown.insurance || 0),
            other: Number(breakdown.other || 0),
            discountTotal: Number(breakdown.discountTotal || 0),
            taxableBase: Number(breakdown.taxableBase || 0),
            taxType: breakdown.taxType || 'CGST_SGST',
            taxBreakup: breakdown.taxBreakup || {},
            roundOff: Number(breakdown.roundOff || 0),
            grandTotal: Number(breakdown.grandTotal || 0),
          };
        }

        const invoiceNumber = orderData.invoiceNumber || `INV-${(orderId || '').slice(-6).toUpperCase()}`;

        // Determine payment status
        const orderIsPaid = orderData?.isPaid === true || orderData?.paymentStatus === 'Paid' || orderData?.payment?.isPaid === true;
        const paymentMode = orderData?.paymentMode || orderData?.payment?.mode || orderData?.paymentNormalized?.code || 'COD';
        const paymentLabel = orderData?.paymentModeLabel || orderData?.payment?.normalized?.label || paymentMode;

        const invoiceDoc = {
          orderId,
          invoiceNumber,
          distributorId: currentDistributorId,
          productOwnerId: productOwnerId || null,
          retailerId: null, // Explicitly NO retailerId to indicate this is a product owner order
          buyer: buyerInfo,
          seller: sellerInfo,
          totals: invoiceTotals,
          payment: {
            mode: paymentLabel,
            normalized: orderData?.paymentNormalized || { code: paymentMode, label: paymentLabel },
            isPaid: orderIsPaid,
            status: orderIsPaid ? 'Paid' : (orderData?.paymentMode?.toLowerCase() === 'credit' ? 'Payment Due' : 'Pending'),
          },
          deliveryDetails: orderData.deliveryDetails || null,
          deliveryMode: orderData.deliveryMode || null,
          expectedDeliveryDate: orderData.expectedDeliveryDate || null,
          issuedAt: new Date().toISOString(),
          createdAt: serverTimestamp(),
          status: orderIsPaid ? 'Paid' : 'Issued',
          paymentStatus: orderIsPaid ? 'Paid' : 'Pending',
          isPaid: orderIsPaid,
          source: 'product-owner-order', // Mark source to distinguish from retailer orders
        };

        await setDoc(invoiceRef, invoiceDoc, { merge: true });
        console.log('[DistributorInvoices] Invoice created for product owner order:', orderId);
        return true;
      }
      return false;
    } catch (err) {
      console.error('[DistributorInvoices] Failed to create invoice for product owner order:', orderId, err);
      return false;
    }
  };

  // Function to backfill invoices for existing delivered product owner orders
  const backfillProductOwnerInvoices = async () => {
    if (!distributorId || backfillCompleted) return;

    try {
      console.log('[DistributorInvoices] Starting backfill for product owner invoices...');
      setBackfillCompleted(true); // Mark as started to prevent multiple runs
      
      // Check productOwnerOrders collection
      const productOwnerOrdersCol = collection(db, `businesses/${distributorId}/productOwnerOrders`);
      const poOrdersSnapshot = await getDocs(productOwnerOrdersCol);
      
      let createdCount = 0;
      
      for (const orderDoc of poOrdersSnapshot.docs) {
        const orderData = { id: orderDoc.id, ...orderDoc.data() };
        const status = orderData.statusCode || orderData.status;
        
        // Check if order is delivered
        if (status === ORDER_STATUSES.DELIVERED || status === 'Delivered' || status === 'DELIVERED') {
          // Check if invoice already exists
          const invoiceRef = doc(db, `businesses/${distributorId}/invoices`, orderData.id);
          const invoiceSnap = await getDoc(invoiceRef);
          
          if (!invoiceSnap.exists()) {
            const created = await createInvoiceForProductOwnerOrder(orderData.id, orderData, distributorId);
            if (created) createdCount++;
          }
        }
      }

      // Check sentOrdersToProductOwners collection
      const sentOrdersCol = collection(db, `businesses/${distributorId}/sentOrdersToProductOwners`);
      const sentOrdersSnapshot = await getDocs(sentOrdersCol);
      
      for (const orderDoc of sentOrdersSnapshot.docs) {
        const orderData = { id: orderDoc.id, ...orderDoc.data() };
        const status = orderData.statusCode || orderData.status;
        
        // Check if order is delivered
        if (status === ORDER_STATUSES.DELIVERED || status === 'Delivered' || status === 'DELIVERED') {
          // Check if invoice already exists
          const invoiceRef = doc(db, `businesses/${distributorId}/invoices`, orderData.id);
          const invoiceSnap = await getDoc(invoiceRef);
          
          if (!invoiceSnap.exists()) {
            const created = await createInvoiceForProductOwnerOrder(orderData.id, orderData, distributorId);
            if (created) createdCount++;
          }
        }
      }

      if (createdCount > 0) {
        console.log(`[DistributorInvoices] Backfill complete: Created ${createdCount} invoices for delivered product owner orders`);
      } else {
        console.log('[DistributorInvoices] Backfill complete: No new invoices needed');
      }
    } catch (err) {
      console.error('[DistributorInvoices] Error during backfill:', err);
      setBackfillCompleted(false); // Reset on error so it can retry
    }
  };

  const paymentStatusMeta = useMemo(() => {
    if (!selectedInvoice) return { label: "Pending", isPaid: false };
    
    // First check orderData if available (most accurate source)
    if (orderData) {
      const orderIsPaid =
        orderData.isPaid === true ||
        orderData.paymentStatus === 'Paid' ||
        orderData.payment?.isPaid === true;
      if (orderIsPaid) {
        return { label: "Paid", isPaid: true };
      }
    }
    
    // Then check invoice payment object
    const paymentObj = selectedInvoice.payment || {};
    if (typeof paymentObj.isPaid === "boolean") {
      return { label: paymentObj.isPaid ? "Paid" : "Pending", isPaid: paymentObj.isPaid };
    }
    
    // Check invoice-level payment status fields
    const raw =
      paymentObj.status ||
      selectedInvoice.paymentStatus ||
      selectedInvoice.payment?.paymentStatus ||
      selectedInvoice.isPaid !== undefined ? (selectedInvoice.isPaid ? "Paid" : "Pending") : "";
    const normalized = raw.toString().trim().toLowerCase();
    if (["paid", "complete", "completed", "success", "successful"].includes(normalized)) {
      return { label: "Paid", isPaid: true };
    }
    if (["pending", "unpaid", "due", "awaiting"].includes(normalized)) {
      return { label: "Pending", isPaid: false };
    }
    return {
      label: normalized ? normalized.charAt(0).toUpperCase() + normalized.slice(1) : "Pending",
      isPaid: false,
    };
  }, [selectedInvoice, orderData]);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        setDistributorId(user.uid);
      } else {
        setDistributorId(null);
        setLoading(false);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (!distributorId) {
      setLoading(false);
      return;
    }

    // Run backfill once when component loads to create invoices for existing delivered orders
    backfillProductOwnerInvoices();

    console.log('[DistributorInvoices] Fetching invoices for distributorId:', distributorId);
    const invoicesCol = collection(db, `businesses/${distributorId}/invoices`);

    const unsubscribe = onSnapshot(
      invoicesCol,
      async (snapshot) => {
        try {
          console.log('[DistributorInvoices] Snapshot received, size:', snapshot.size);
          const data = [];
          const typeMap = {};
          
          snapshot.forEach((doc) => {
            try {
              const invoiceData = { id: doc.id, ...doc.data() };
              console.log('[DistributorInvoices] Invoice found:', doc.id, invoiceData);
              data.push(invoiceData);
            } catch (err) {
              console.error('[DistributorInvoices] Error parsing invoice:', doc.id, err);
            }
          });

          // Helper function to determine invoice category (inline to avoid closure issues)
          const getInvoiceCategory = async (invoice, currentDistributorId) => {
            // Manual invoices: no orderId
            if (!invoice.orderId) {
              return INVOICE_CATEGORIES.MANUAL;
            }

            // If invoice has retailerId, it's from retailer order
            if (invoice.retailerId || invoice.source === 'distributor-track-orders') {
              return INVOICE_CATEGORIES.RETAILER;
            }

            // Check if order exists in productOwnerOrders or sentOrdersToProductOwners
            try {
              if (currentDistributorId) {
                // Check in productOwnerOrders
                const poOrderRef = doc(db, `businesses/${currentDistributorId}/productOwnerOrders/${invoice.orderId}`);
                const poOrderSnap = await getDoc(poOrderRef);
                if (poOrderSnap.exists()) {
                  return INVOICE_CATEGORIES.PRODUCT_OWNER;
                }

                // Check in sentOrdersToProductOwners
                const sentOrderRef = doc(db, `businesses/${currentDistributorId}/sentOrdersToProductOwners/${invoice.orderId}`);
                const sentOrderSnap = await getDoc(sentOrderRef);
                if (sentOrderSnap.exists()) {
                  return INVOICE_CATEGORIES.PRODUCT_OWNER;
                }

                // Check in orderRequests (retailer orders)
                const retailerOrderRef = doc(db, `businesses/${currentDistributorId}/orderRequests/${invoice.orderId}`);
                const retailerOrderSnap = await getDoc(retailerOrderRef);
                if (retailerOrderSnap.exists()) {
                  return INVOICE_CATEGORIES.RETAILER;
                }
              }
            } catch (err) {
              console.error('[DistributorInvoices] Error checking order type:', invoice.orderId, err);
            }

            // Default fallback: if orderId exists but no retailerId, assume product owner
            return INVOICE_CATEGORIES.PRODUCT_OWNER;
          };

          // Determine invoice types in parallel (only for invoices with orderId)
          const typePromises = data
            .filter(invoice => invoice.orderId) // Only check invoices with orderId
            .map(async (invoice) => {
              try {
                const category = await getInvoiceCategory(invoice, distributorId);
                return { orderId: invoice.orderId, category };
              } catch (err) {
                console.error('[DistributorInvoices] Error categorizing invoice:', invoice.id, err);
                return { orderId: invoice.orderId, category: INVOICE_CATEGORIES.PRODUCT_OWNER }; // Fallback
              }
            });

          if (typePromises.length > 0) {
            const typeResults = await Promise.all(typePromises);
            typeResults.forEach(({ orderId, category }) => {
              if (orderId) {
                typeMap[orderId] = category;
              }
            });
          }

          setOrderTypeMap(typeMap);

          // Sort by issuedAt descending (newest first), with invoices without issuedAt at the end
          data.sort((a, b) => {
            const aDate = a.issuedAt ? new Date(a.issuedAt).getTime() : 0;
            const bDate = b.issuedAt ? new Date(b.issuedAt).getTime() : 0;
            return bDate - aDate; // descending order
          });
          
          console.log('[DistributorInvoices] Setting invoices, count:', data.length);
          setInvoices(data);
          setLoading(false);
        } catch (err) {
          console.error("[DistributorInvoices] Error processing invoices:", err);
          setLoading(false);
        }
      },
      (err) => {
        console.error("[DistributorInvoices] Error loading invoices:", err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [distributorId]);

  // Categorize invoices (simplified - doesn't require async checks for basic categorization)
  const categorizedInvoices = useMemo(() => {
    const categorized = {
      [INVOICE_CATEGORIES.RETAILER]: [],
      [INVOICE_CATEGORIES.MANUAL]: [],
      [INVOICE_CATEGORIES.PRODUCT_OWNER]: [],
    };

    if (!invoices || invoices.length === 0) {
      return categorized;
    }

    invoices.forEach((invoice) => {
      try {
        // Quick categorization based on invoice fields (no async needed for most cases)
        if (!invoice || !invoice.orderId) {
          categorized[INVOICE_CATEGORIES.MANUAL].push(invoice);
        } else if (invoice.retailerId || invoice.source === 'distributor-track-orders') {
          // Has retailerId - definitely a retailer order
          categorized[INVOICE_CATEGORIES.RETAILER].push(invoice);
        } else if (invoice.source === 'product-owner-order' || invoice.productOwnerId) {
          // Explicitly marked as product owner order OR has productOwnerId but no retailerId
          categorized[INVOICE_CATEGORIES.PRODUCT_OWNER].push(invoice);
        } else if (orderTypeMap && orderTypeMap[invoice.orderId]) {
          // Use typeMap if available (from async check)
          categorized[orderTypeMap[invoice.orderId]].push(invoice);
        } else {
          // Default: assume product owner if orderId exists but no retailerId
          // (async check will update this if wrong)
          categorized[INVOICE_CATEGORIES.PRODUCT_OWNER].push(invoice);
        }
      } catch (err) {
        console.error('[DistributorInvoices] Error categorizing invoice:', invoice?.id, err);
        // Fallback to manual if error
        categorized[INVOICE_CATEGORIES.MANUAL].push(invoice);
      }
    });

    return categorized;
  }, [invoices, orderTypeMap]);

  // Get invoices for active category
  const filteredInvoices = useMemo(() => {
    return categorizedInvoices[activeCategory] || [];
  }, [categorizedInvoices, activeCategory]);

  // Get category stats - MUST be before any conditional returns (React hooks rule)
  const categoryStats = useMemo(() => {
    return {
      [INVOICE_CATEGORIES.RETAILER]: categorizedInvoices[INVOICE_CATEGORIES.RETAILER].length,
      [INVOICE_CATEGORIES.MANUAL]: categorizedInvoices[INVOICE_CATEGORIES.MANUAL].length,
      [INVOICE_CATEGORIES.PRODUCT_OWNER]: categorizedInvoices[INVOICE_CATEGORIES.PRODUCT_OWNER].length,
    };
  }, [categorizedInvoices]);

  const getCategoryLabel = (category) => {
    switch (category) {
      case INVOICE_CATEGORIES.RETAILER:
        return 'Retailer Orders';
      case INVOICE_CATEGORIES.MANUAL:
        return 'Manual Billing';
      case INVOICE_CATEGORIES.PRODUCT_OWNER:
        return 'Product Owner Orders';
      default:
        return 'All';
    }
  };

  const getCategoryIcon = (category) => {
    switch (category) {
      case INVOICE_CATEGORIES.RETAILER:
        return <FaStore className="text-lg" />;
      case INVOICE_CATEGORIES.MANUAL:
        return <FaFileInvoice className="text-lg" />;
      case INVOICE_CATEGORIES.PRODUCT_OWNER:
        return <FaBoxOpen className="text-lg" />;
      default:
        return <FaReceipt className="text-lg" />;
    }
  };

  const getBuyerName = (invoice) => {
    if (invoice.buyer?.businessName) return invoice.buyer.businessName;
    if (activeCategory === INVOICE_CATEGORIES.RETAILER) return invoice.buyer?.businessName || 'Retailer';
    if (activeCategory === INVOICE_CATEGORIES.PRODUCT_OWNER) return 'Product Owner';
    return invoice.buyer?.businessName || invoice.customer?.businessName || 'Customer';
  };

  const handleViewInvoice = async (invoice) => {
    if (!invoice) {
      console.error('[DistributorInvoices] handleViewInvoice: invoice is null/undefined');
      return;
    }

    setSelectedInvoice(invoice);
    setLoadingOrder(true);
    setOrderData(null);

    // Fetch order data if orderId exists (always fetch to get latest deliveryDetails)
    if (invoice.orderId && distributorId) {
      try {
        // Determine which collection to check based on invoice type
        let orderRef = null;
        const category = !invoice.orderId ? INVOICE_CATEGORIES.MANUAL :
                        (invoice.retailerId || invoice.source === 'distributor-track-orders') ? INVOICE_CATEGORIES.RETAILER :
                        (orderTypeMap && orderTypeMap[invoice.orderId]) || INVOICE_CATEGORIES.PRODUCT_OWNER;

        if (category === INVOICE_CATEGORIES.RETAILER) {
          orderRef = doc(db, `businesses/${distributorId}/orderRequests`, invoice.orderId);
        } else if (category === INVOICE_CATEGORIES.PRODUCT_OWNER) {
          // Try productOwnerOrders first, then sentOrdersToProductOwners
          const poOrderRef = doc(db, `businesses/${distributorId}/productOwnerOrders`, invoice.orderId);
          const poOrderSnap = await getDoc(poOrderRef);
          if (poOrderSnap.exists()) {
            orderRef = poOrderRef;
          } else {
            const sentOrderRef = doc(db, `businesses/${distributorId}/sentOrdersToProductOwners`, invoice.orderId);
            const sentOrderSnap = await getDoc(sentOrderRef);
            if (sentOrderSnap.exists()) {
              orderRef = sentOrderRef;
            }
          }
        } else {
          // Fallback to orderRequests
          orderRef = doc(db, `businesses/${distributorId}/orderRequests`, invoice.orderId);
        }

        if (orderRef) {
          const orderSnap = await getDoc(orderRef);
          if (orderSnap.exists()) {
            const orderDataFromDb = { id: orderSnap.id, ...orderSnap.data() };
            setOrderData(orderDataFromDb);
            
            // Update invoice with latest deliveryDetails if order has them and invoice doesn't
            // This ensures deliveryDetails added after invoice creation are visible
            if (orderDataFromDb.deliveryDetails && Object.keys(orderDataFromDb.deliveryDetails).length > 0 && (!invoice.deliveryDetails || Object.keys(invoice.deliveryDetails).length === 0)) {
              // Update the invoice document with latest deliveryDetails
              const invoiceRef = doc(db, `businesses/${distributorId}/invoices`, invoice.id);
              updateDoc(invoiceRef, {
                deliveryDetails: orderDataFromDb.deliveryDetails,
                deliveryMode: orderDataFromDb.deliveryMode || invoice.deliveryMode,
                expectedDeliveryDate: orderDataFromDb.expectedDeliveryDate || invoice.expectedDeliveryDate,
              }).catch((updateErr) => {
                console.error('[DistributorInvoices] Error updating invoice deliveryDetails:', updateErr);
              });
            }
          }
        }
      } catch (err) {
        console.error("[DistributorInvoices] Error fetching order data:", err);
      } finally {
        setLoadingOrder(false);
      }
    } else {
      setLoadingOrder(false);
    }
  };

  const closeInvoiceModal = () => {
    setSelectedInvoice(null);
    setOrderData(null);
  };

  const toDate = (value) => {
    if (!value) return null;
    if (value instanceof Date) return value;
    if (typeof value === "number") return new Date(value);
    if (typeof value === "string") {
      const parsed = new Date(value);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
    if (value?.seconds) return new Date(value.seconds * 1000);
    if (value?.toDate) return value.toDate();
    return null;
  };

  const formatDate = (value, options = { day: "2-digit", month: "short", year: "numeric" }) => {
    const date = toDate(value);
    return date ? date.toLocaleDateString("en-IN", options) : "N/A";
  };

  const formatDateTime = (value) => {
    const date = toDate(value);
    return date
      ? date.toLocaleString("en-IN", {
          day: "2-digit",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "N/A";
  };

  const formatCurrency = (value) =>
    `₹${Number(value || 0).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  const getInvoiceFileName = (invoice) => {
    const number = invoice?.invoiceNumber || invoice?.id || "invoice";
    const issued = formatDate(invoice?.issuedAt).replace(/\s+/g, "-");
    return `${number}-${issued}.pdf`;
  };

  const handleDownloadPdf = async () => {
    if (!selectedInvoice) return;
    try {
      setDownloadingPdf(true);
      const doc = (
        <DistributorInvoicePdf invoice={selectedInvoice} order={orderData} />
      );
      const blob = await pdf(doc).toBlob();
      saveAs(blob, getInvoiceFileName(selectedInvoice));
    } catch (err) {
      console.error("[DistributorInvoices] Failed to generate PDF", err);
    } finally {
      setDownloadingPdf(false);
    }
  };

  const buildInvoiceShareLink = () => {
    if (!selectedInvoice || !distributorId) return null;
    const invoiceId = selectedInvoice.id;
    const baseUrl = window.location.origin;
    return `${baseUrl}/invoice/${distributorId}/${invoiceId}`;
  };

  const buildWhatsAppLink = () => {
    if (!selectedInvoice) return null;
    const phoneRaw = selectedInvoice.buyer?.phone;
    const phone = phoneRaw ? phoneRaw.toString().replace(/\D/g, "") : "";
    const invoiceNumber = selectedInvoice.invoiceNumber || selectedInvoice.id;
    const total = formatCurrency(selectedInvoice.totals?.grandTotal || 0);
    const issued = formatDateTime(selectedInvoice.issuedAt);
    const seller =
      selectedInvoice.seller?.businessName ||
      selectedInvoice.seller?.name ||
      "our team";
    const shareLink = buildInvoiceShareLink();
    const message = [
      `Invoice ${invoiceNumber}`,
      `Amount: ${total}`,
      `Issued: ${issued}`,
      ``,
      `View and download your digital invoice:`,
      shareLink || "Link unavailable",
      ``,
      `Thank you for ordering from ${seller}.`,
    ]
      .join("\n")
      .trim();
    const encodedMessage = encodeURIComponent(message);
    const baseUrl = phone ? `https://wa.me/${phone}` : `https://wa.me/`;
    return `${baseUrl}?text=${encodedMessage}`;
  };

  const handleShareWhatsApp = () => {
    const link = buildWhatsAppLink();
    if (!link) return;
    window.open(link, "_blank", "noopener,noreferrer");
  };

  const handleShareEmail = () => {
    if (!selectedInvoice) return;
    const invoiceNumber = selectedInvoice.invoiceNumber || selectedInvoice.id;
    const seller =
      selectedInvoice.seller?.businessName ||
      selectedInvoice.seller?.name ||
      "our team";
    const total = formatCurrency(selectedInvoice.totals?.grandTotal || 0);
    const issued = formatDateTime(selectedInvoice.issuedAt);
    const status = paymentStatusMeta.label;
    const recipient = selectedInvoice.buyer?.email || "";
    const subject = `Invoice ${invoiceNumber} from ${seller}`;
    const body = `Hello ${selectedInvoice.buyer?.businessName || ""},\n\nPlease find your invoice details below:\nInvoice: ${invoiceNumber}\nAmount: ${total}\nIssued: ${issued}\nStatus: ${status}\n\nWe have attached the invoice PDF for your reference.\n\nRegards,\n${seller}`;
    const mailto = `mailto:${recipient}?subject=${encodeURIComponent(
      subject
    )}&body=${encodeURIComponent(body)}`;
    window.open(mailto, "_blank");
  };

  const getPaymentModeLabel = (invoice) => {
    if (!invoice) return "N/A";
    const p = invoice.payment || {};
    return (
      p.mode ||
      p.normalized?.label ||
      p.normalized?.mode ||
      invoice.paymentMode ||
      invoice.paymentUi ||
      "N/A"
    );
  };

  // Get the calculated base/unit price for display based on pricing mode
  const getDisplayBasePrice = (order, idx, item) => {
    const pricingMode = item.pricingMode || "LEGACY";
    const basePrice = Number(item.basePrice || 0);
    const mrp = Number(item.mrp || 0);
    const sellingPrice = Number(item.sellingPrice || item.price || item.unitPrice || 0);
    const baseGstRate = Number(item.gstRate || item.taxRate || 0);

    // Get proforma line if available
    const pLine = Array.isArray(order?.proforma?.lines) ? order.proforma.lines[idx] : undefined;
    const lineGstRate = pLine?.gstRate !== undefined ? Number(pLine.gstRate) : baseGstRate;

    if (pricingMode === "MRP_INCLUSIVE") {
      // MRP is final, calculate base from MRP
      if (mrp > 0 && lineGstRate > 0) {
        const split = splitFromMrp(mrp, lineGstRate);
        return split.base;
      }
      return mrp || sellingPrice;
    } else if (pricingMode === "SELLING_PRICE") {
      // Selling price is final (GST included), calculate base from it
      if (sellingPrice > 0 && lineGstRate > 0) {
        const split = splitFromMrp(sellingPrice, lineGstRate);
        return split.base;
      }
      return sellingPrice;
    } else if (pricingMode === "BASE_PLUS_TAX") {
      // Base price is explicit
      if (basePrice > 0) {
        return basePrice;
      }
      // Fallback: calculate from selling price if base is missing
      if (sellingPrice > 0 && lineGstRate > 0) {
        const split = splitFromMrp(sellingPrice, lineGstRate);
        return split.base;
      }
      return sellingPrice;
    } else {
      // LEGACY: use basePrice if available, otherwise sellingPrice
      return basePrice || sellingPrice;
    }
  };

  // Early return for loading state - must be AFTER all hooks
  if (loading) {
    return (
      <div className="p-6 text-white/70 text-lg font-medium text-center py-12">
        Loading invoices...
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold mb-2 bg-clip-text text-transparent bg-gradient-to-r from-white via-white to-emerald-200">
          Distributor Invoices
        </h1>
        <p className="text-white/60 text-sm">
          Organized by source for easy accounting and tracking
        </p>
      </div>

      {/* Category Tabs */}
      <div className="mb-6 flex flex-wrap gap-3 border-b border-white/10 pb-4">
        {Object.values(INVOICE_CATEGORIES).map((category) => (
          <button
            key={category}
            onClick={() => setActiveCategory(category)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
              activeCategory === category
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 shadow-lg shadow-emerald-500/10'
                : 'bg-white/5 text-white/70 hover:bg-white/10 border border-white/10'
            }`}
          >
            {getCategoryIcon(category)}
            <span>{getCategoryLabel(category)}</span>
            <span className={`px-2 py-0.5 rounded-full text-xs ${
              activeCategory === category
                ? 'bg-emerald-500/30 text-emerald-200'
                : 'bg-white/10 text-white/60'
            }`}>
              {categoryStats[category]}
            </span>
          </button>
        ))}
      </div>

      {/* Category Description */}
      <div className="mb-4 p-4 bg-white/5 rounded-lg border border-white/10">
        <div className="flex items-start gap-3">
          {getCategoryIcon(activeCategory)}
          <div>
            <h3 className="font-semibold text-white mb-1">{getCategoryLabel(activeCategory)}</h3>
            <p className="text-sm text-white/60">
              {activeCategory === INVOICE_CATEGORIES.RETAILER &&
                'Automated invoices generated from retailer order requests. These invoices are created automatically when orders are marked as delivered.'}
              {activeCategory === INVOICE_CATEGORIES.MANUAL &&
                'Manually created invoices for direct sales or custom billing. These are created through the manual billing interface.'}
              {activeCategory === INVOICE_CATEGORIES.PRODUCT_OWNER &&
                'Invoices for orders received from product owners. These represent purchases made by the distributor from product owners.'}
            </p>
          </div>
        </div>
      </div>

      {/* Invoices Table */}
      {loading ? (
        <div className="text-white/70 text-lg font-medium text-center py-12">
          Loading invoices...
        </div>
      ) : filteredInvoices.length === 0 ? (
        <div className="text-center py-12 bg-white/5 rounded-lg border border-white/10">
          <div className="text-6xl mb-4 opacity-50">{getCategoryIcon(activeCategory)}</div>
          <p className="text-white/70 text-lg mb-2">No {getCategoryLabel(activeCategory).toLowerCase()} found</p>
          <p className="text-white/50 text-sm">
            {activeCategory === INVOICE_CATEGORIES.RETAILER && 'Invoices will appear here when retailer orders are marked as delivered.'}
            {activeCategory === INVOICE_CATEGORIES.MANUAL && 'Create invoices manually through the Manual Billing section.'}
            {activeCategory === INVOICE_CATEGORIES.PRODUCT_OWNER && 'Invoices from product owner orders will appear here.'}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto mt-4 border border-white/10 rounded-lg shadow-lg bg-white/5">
          <table className="min-w-full text-sm">
            <thead className="bg-white/10 text-white">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Invoice No</th>
                <th className="px-4 py-3 text-left font-semibold">
                  {activeCategory === INVOICE_CATEGORIES.RETAILER ? 'Retailer' : 
                   activeCategory === INVOICE_CATEGORIES.PRODUCT_OWNER ? 'Product Owner' : 'Customer'}
                </th>
                <th className="px-4 py-3 text-left font-semibold">Amount</th>
                <th className="px-4 py-3 text-left font-semibold">Issued At</th>
                <th className="px-4 py-3 text-left font-semibold">Payment Status</th>
                <th className="px-4 py-3 text-left font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {filteredInvoices.map((inv) => {
                const paymentStatus = inv.payment?.isPaid || inv.isPaid ? 'Paid' : 'Pending';
                return (
                  <tr key={inv.id} className="hover:bg-white/5 transition-colors">
                    <td className="px-4 py-3 text-white font-medium">
                      {inv.invoiceNumber || inv.id}
                    </td>
                    <td className="px-4 py-3 text-white/80">
                      {getBuyerName(inv)}
                    </td>
                    <td className="px-4 py-3 text-emerald-400 font-semibold">
                      ₹{(inv.totals?.grandTotal || 0).toLocaleString("en-IN", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td className="px-4 py-3 text-white/70">
                      {inv.issuedAt ? new Date(inv.issuedAt).toLocaleDateString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric"
                      }) : "--"}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        paymentStatus === 'Paid'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30'
                          : 'bg-amber-500/20 text-amber-300 border border-amber-400/30'
                      }`}>
                        {paymentStatus}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        className="px-4 py-1.5 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-400/30 text-blue-300 rounded-lg font-medium transition-all hover:scale-105"
                        onClick={() => handleViewInvoice(inv)}
                      >
                        View
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Invoice View Modal */}
      {selectedInvoice && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white text-slate-900 rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto border border-slate-200">
            {/* Header with actions */}
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex flex-wrap gap-3 items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Invoice</p>
                <h2 className="text-2xl font-bold text-slate-900">
                  {selectedInvoice.invoiceNumber || selectedInvoice.id}
                </h2>
              </div>
              <div className="flex flex-wrap gap-2 ml-auto">
                <button
                  onClick={handleDownloadPdf}
                  disabled={downloadingPdf || loadingOrder}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
                    downloadingPdf || loadingOrder
                      ? "bg-slate-400 text-white cursor-not-allowed"
                      : "bg-slate-900 text-white hover:bg-slate-800"
                  }`}
                >
                  {downloadingPdf ? "Preparing PDF..." : "Download PDF"}
                </button>
                <button
                  onClick={handleShareWhatsApp}
                  className="px-4 py-2 rounded-lg bg-emerald-500 text-slate-900 text-sm font-semibold hover:bg-emerald-400 transition"
                >
                  Share on WhatsApp
                </button>
                <button
                  onClick={handleShareEmail}
                  className="px-4 py-2 rounded-lg bg-cyan-500 text-slate-900 text-sm font-semibold hover:bg-cyan-400 transition"
                >
                  Send via Email
                </button>
                <button
                  onClick={closeInvoiceModal}
                  className="ml-auto text-slate-400 hover:text-slate-600 text-2xl leading-none px-2"
                >
                  ×
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6 bg-white">
              {/* Invoice Header Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 border border-slate-200 rounded-lg bg-slate-50">
                  <p className="text-xs uppercase text-slate-500">Invoice Number</p>
                  <p className="font-semibold text-xl">
                    {selectedInvoice.invoiceNumber || selectedInvoice.id}
                  </p>
                </div>
                <div className="p-4 border border-slate-200 rounded-lg bg-slate-50">
                  <p className="text-xs uppercase text-slate-500">Issued Date</p>
                  <p className="font-semibold text-lg">
                    {formatDate(selectedInvoice.issuedAt)}
                  </p>
                </div>
              </div>

              {/* Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl border border-emerald-100 bg-emerald-50">
                  <p className="text-xs uppercase text-emerald-700">Grand Total</p>
                  <p className="text-2xl font-bold text-emerald-900">
                    {formatCurrency(selectedInvoice.totals?.grandTotal || 0)}
                  </p>
                </div>
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50">
                  <p className="text-xs uppercase text-slate-500">Payment Status</p>
                  <p
                    className={`text-xl font-semibold ${
                      paymentStatusMeta.isPaid ? "text-emerald-700" : "text-amber-600"
                    }`}
                  >
                    {paymentStatusMeta.label}
                  </p>
                </div>
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50">
                  <p className="text-xs uppercase text-slate-500">Payment Method</p>
                  <p className="text-lg font-semibold">
                    {getPaymentModeLabel(selectedInvoice)}
                  </p>
                </div>
              </div>

              {/* Buyer and Seller Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 border-t border-slate-200 pt-6">
                <div>
                  <h3 className="font-semibold text-slate-900 mb-2">Bill To (Buyer)</h3>
                  <div className="text-sm text-slate-600 space-y-1">
                    <p className="font-medium text-slate-900">
                      {selectedInvoice.buyer?.businessName || "N/A"}
                    </p>
                    {selectedInvoice.buyer?.email && <p>Email: {selectedInvoice.buyer.email}</p>}
                    {selectedInvoice.buyer?.phone && <p>Phone: {selectedInvoice.buyer.phone}</p>}
                    {(selectedInvoice.buyer?.city || selectedInvoice.buyer?.state) && (
                      <p>
                        {[selectedInvoice.buyer.city, selectedInvoice.buyer.state].filter(Boolean).join(", ")}
                      </p>
                    )}
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900 mb-2">Sold By (Seller)</h3>
                  <div className="text-sm text-slate-600 space-y-1">
                    <p className="font-medium text-slate-900">
                      {selectedInvoice.seller?.businessName || "N/A"}
                    </p>
                    {selectedInvoice.seller?.email && <p>Email: {selectedInvoice.seller.email}</p>}
                    {selectedInvoice.seller?.phone && <p>Phone: {selectedInvoice.seller.phone}</p>}
                    {selectedInvoice.seller?.gstNumber && <p>GST: {selectedInvoice.seller.gstNumber}</p>}
                    {(selectedInvoice.seller?.city || selectedInvoice.seller?.state) && (
                      <p>
                        {[selectedInvoice.seller.city, selectedInvoice.seller.state].filter(Boolean).join(", ")}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Order Items */}
              {loadingOrder ? (
                <div className="text-center py-8">
                  <p className="text-gray-600">Loading order items...</p>
                </div>
              ) : orderData ? (
                <div className="border-t border-slate-200 pt-6">
                  <h3 className="font-semibold text-slate-900 mb-4">Order Items</h3>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="bg-slate-100">
                        <tr>
                          <th className="px-4 py-2 text-left text-slate-600">Product Details</th>
                          <th className="px-4 py-2 text-left text-slate-600">SKU</th>
                          <th className="px-4 py-2 text-left text-slate-600">Brand</th>
                          <th className="px-4 py-2 text-left text-slate-600">Category</th>
                          <th className="px-4 py-2 text-right text-slate-600">Unit</th>
                          <th className="px-4 py-2 text-right text-slate-600">Base Price</th>
                          <th className="px-4 py-2 text-right text-slate-600">MRP</th>
                          <th className="px-4 py-2 text-right text-slate-600">GST %</th>
                          <th className="px-4 py-2 text-right text-slate-600">Selling Price</th>
                          <th className="px-4 py-2 text-center text-slate-600">Qty</th>
                          <th className="px-4 py-2 text-right text-slate-600">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(orderData.items || []).map((item, idx) => {
                          const qty = Number(item.quantity || item.qty || 0);
                          const price = Number(item.sellingPrice || item.price || item.unitPrice || 0);
                          const total = qty * price;
                          return (
                            <tr key={idx} className="border-b">
                              <td className="px-4 py-3">
                                <div className="font-medium text-slate-900">{item.productName || item.name || "N/A"}</div>
                                {item.hsnCode && (
                                  <div className="text-xs text-slate-500 mt-0.5">HSN: {item.hsnCode}</div>
                                )}
                              </td>
                              <td className="px-4 py-2">{item.sku || "—"}</td>
                              <td className="px-4 py-2">{item.brand || "—"}</td>
                              <td className="px-4 py-2">{item.category || "—"}</td>
                              <td className="px-4 py-2 text-right">{item.unit || "—"}</td>
                              <td className="px-4 py-2 text-right">
                                {(() => {
                                  const basePrice = getDisplayBasePrice(orderData, idx, item);
                                  return basePrice > 0 ? `₹${basePrice.toFixed(2)}` : "—";
                                })()}
                              </td>
                              <td className="px-4 py-2 text-right">
                                {item.mrp > 0 ? `₹${item.mrp.toFixed(2)}` : "—"}
                              </td>
                              <td className="px-4 py-2 text-right">
                                {(() => {
                                  const gstRate = Number(item.gstRate || item.taxRate || 0);
                                  const pLine = Array.isArray(orderData?.proforma?.lines) ? orderData.proforma.lines[idx] : undefined;
                                  const displayGstRate = pLine?.gstRate !== undefined ? Number(pLine.gstRate) : gstRate;
                                  return displayGstRate > 0 ? `${displayGstRate}%` : "—";
                                })()}
                              </td>
                              <td className="px-4 py-2 text-right">
                                <span className="font-semibold text-emerald-600">₹{price.toFixed(2)}</span>
                              </td>
                              <td className="px-4 py-2 text-center">{qty}</td>
                              <td className="px-4 py-2 text-right">
                                <span className="font-semibold text-slate-900">₹{total.toFixed(2)}</span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="border-t pt-4">
                  <p className="text-slate-300 text-sm">
                    {selectedInvoice.orderId
                      ? "Order data not available"
                      : "No order ID associated with this invoice"}
                  </p>
                </div>
              )}

              {/* Payment and Totals */}
                <div className="border-t border-slate-200 pt-6 space-y-4">
                {/* Full Breakdown */}
                {selectedInvoice.totals && (
                  <div className="pt-2">
                    <h4 className="font-semibold mb-3 text-slate-900">Invoice Breakdown</h4>
                    <div className="space-y-1 text-sm text-slate-600">
                      {selectedInvoice.totals.grossItems !== undefined && (
                        <div className="flex justify-between"><span>Unit Price Total</span><span>₹{Number(selectedInvoice.totals.grossItems || 0).toFixed(2)}</span></div>
                      )}
                      {selectedInvoice.totals.lineDiscountTotal !== undefined && (
                        <div className="flex justify-between"><span>− Line Discounts</span><span>₹{Number(selectedInvoice.totals.lineDiscountTotal || 0).toFixed(2)}</span></div>
                      )}
                      {selectedInvoice.totals.itemsSubTotal !== undefined && (
                        <div className="flex justify-between"><span>Items Sub‑Total</span><span>₹{Number(selectedInvoice.totals.itemsSubTotal || 0).toFixed(2)}</span></div>
                      )}
                      {selectedInvoice.totals.delivery > 0 && (
                        <div className="flex justify-between"><span>+ Delivery</span><span>₹{Number(selectedInvoice.totals.delivery || 0).toFixed(2)}</span></div>
                      )}
                      {selectedInvoice.totals.packing > 0 && (
                        <div className="flex justify-between"><span>+ Packing</span><span>₹{Number(selectedInvoice.totals.packing || 0).toFixed(2)}</span></div>
                      )}
                      {selectedInvoice.totals.insurance > 0 && (
                        <div className="flex justify-between"><span>+ Insurance</span><span>₹{Number(selectedInvoice.totals.insurance || 0).toFixed(2)}</span></div>
                      )}
                      {selectedInvoice.totals.other > 0 && (
                        <div className="flex justify-between"><span>+ Other</span><span>₹{Number(selectedInvoice.totals.other || 0).toFixed(2)}</span></div>
                      )}
                      {selectedInvoice.totals.discountTotal > 0 && (
                        <div className="flex justify-between"><span>− Order Discount</span><span>₹{Number(selectedInvoice.totals.discountTotal || 0).toFixed(2)}</span></div>
                      )}
                      {selectedInvoice.totals.taxableBase !== undefined && (
                        <div className="flex justify-between font-semibold"><span>Taxable Base</span><span>₹{Number(selectedInvoice.totals.taxableBase || 0).toFixed(2)}</span></div>
                      )}
                      {selectedInvoice.totals.taxType && (
                        <div className="flex justify-between">
                          <span>Tax Type</span>
                          <span className="text-xs">
                            {selectedInvoice.totals.taxType === 'IGST'
                              ? `IGST (Interstate)`
                              : `CGST + SGST (Intrastate)`}
                          </span>
                        </div>
                      )}
                      {selectedInvoice.totals.taxType === 'IGST' && selectedInvoice.totals.taxBreakup?.igst !== undefined && (
                        <div className="flex justify-between"><span>IGST</span><span>₹{Number(selectedInvoice.totals.taxBreakup.igst || 0).toFixed(2)}</span></div>
                      )}
                      {selectedInvoice.totals.taxType !== 'IGST' && (
                        <>
                          {selectedInvoice.totals.taxBreakup?.cgst !== undefined && (
                            <div className="flex justify-between"><span>CGST</span><span>₹{Number(selectedInvoice.totals.taxBreakup.cgst || 0).toFixed(2)}</span></div>
                          )}
                          {selectedInvoice.totals.taxBreakup?.sgst !== undefined && (
                            <div className="flex justify-between"><span>SGST</span><span>₹{Number(selectedInvoice.totals.taxBreakup.sgst || 0).toFixed(2)}</span></div>
                          )}
                        </>
                      )}
                      {selectedInvoice.totals.roundOff !== undefined && selectedInvoice.totals.roundOff !== 0 && (
                        <div className="flex justify-between"><span>Round Off</span><span>₹{Number(selectedInvoice.totals.roundOff || 0).toFixed(2)}</span></div>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex justify-between items-center pt-2 border-t">
                  <span className="text-lg font-semibold text-slate-900">Grand Total:</span>
                  <span className="text-2xl font-bold text-slate-900">
                    ₹{Number(selectedInvoice.totals?.grandTotal || 0).toLocaleString("en-IN", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                </div>
              </div>

              {/* Delivery Details Section */}
              {(selectedInvoice.deliveryDetails || selectedInvoice.deliveryMode || selectedInvoice.expectedDeliveryDate || orderData?.deliveryDetails) && (
                <div className="border-t border-slate-200 pt-6">
                  <h4 className="font-semibold mb-3 text-slate-900">🚚 Delivery Information</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm text-slate-600">
                    {(() => {
                      const deliveryDetails = selectedInvoice.deliveryDetails || orderData?.deliveryDetails || {};
                      return (
                        <>
                          {selectedInvoice.deliveryMode || orderData?.deliveryMode ? (
                            <div>
                              <span className="font-medium text-slate-900">Delivery Mode: </span>
                              <span>{selectedInvoice.deliveryMode || orderData?.deliveryMode}</span>
                            </div>
                          ) : null}
                          {selectedInvoice.expectedDeliveryDate || orderData?.expectedDeliveryDate ? (
                            <div>
                              <span className="font-medium text-slate-900">Expected Delivery Date: </span>
                              <span>
                                {formatDate(selectedInvoice.expectedDeliveryDate || orderData?.expectedDeliveryDate)}
                              </span>
                            </div>
                          ) : null}
                          {deliveryDetails.personName && (
                            <div>
                              <span className="font-medium text-slate-900">Delivery Person: </span>
                              <span>
                                {deliveryDetails.personName}
                                {deliveryDetails.personDesignation && ` (${deliveryDetails.personDesignation})`}
                              </span>
                            </div>
                          )}
                          {deliveryDetails.personPhone && (
                            <div>
                              <span className="font-medium text-slate-900">Contact: </span>
                              <span>{deliveryDetails.personPhone}</span>
                            </div>
                          )}
                          {deliveryDetails.vehicleType && (
                            <div>
                              <span className="font-medium text-slate-900">Vehicle Type: </span>
                              <span>{deliveryDetails.vehicleType}</span>
                            </div>
                          )}
                          {deliveryDetails.vehicleNumber && (
                            <div>
                              <span className="font-medium text-slate-900">Vehicle Number: </span>
                              <span>{deliveryDetails.vehicleNumber}</span>
                            </div>
                          )}
                          {deliveryDetails.transportMethod && (
                            <div>
                              <span className="font-medium text-slate-900">Transport Method: </span>
                              <span>{deliveryDetails.transportMethod.replace(/-/g, ' ')}</span>
                            </div>
                          )}
                          {deliveryDetails.awbNumber && (
                            <div>
                              <span className="font-medium text-slate-900">AWB/Tracking Number: </span>
                              <span>{deliveryDetails.awbNumber}</span>
                            </div>
                          )}
                          {deliveryDetails.transportServiceName && (
                            <div>
                              <span className="font-medium text-slate-900">Transport Service: </span>
                              <span>{deliveryDetails.transportServiceName}</span>
                            </div>
                          )}
                          {deliveryDetails.courierName && (
                            <div>
                              <span className="font-medium text-slate-900">Courier: </span>
                              <span>{deliveryDetails.courierName}</span>
                            </div>
                          )}
                          {deliveryDetails.deliveryNotes && (
                            <div className="sm:col-span-2">
                              <span className="font-medium text-slate-900">Delivery Notes: </span>
                              <p className="mt-1 text-slate-600 whitespace-pre-wrap">{deliveryDetails.deliveryNotes}</p>
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                </div>
              )}

              {/* Order ID if available */}
              {selectedInvoice.orderId && (
                <div className="border-t border-slate-200 pt-4">
                  <p className="text-sm text-slate-600">
                    <span className="font-medium">Order ID:</span> {selectedInvoice.orderId}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DistributorInvoices;
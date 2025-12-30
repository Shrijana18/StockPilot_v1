/**
 * Payment Gateway Utilities
 * Handles payment link generation, UPI links, and payment notifications
 */

/**
 * Generate UPI payment link
 * Format: upi://pay?pa=<UPI_ID>&am=<AMOUNT>&cu=INR&tn=<TRANSACTION_NOTE>
 */
export const generateUPILink = (upiId, amount, transactionNote = "") => {
  if (!upiId) return null;
  
  const params = new URLSearchParams({
    pa: upiId.trim(),
    am: amount.toFixed(2),
    cu: "INR",
    ...(transactionNote && { tn: transactionNote.substring(0, 50) }),
  });
  
  return `upi://pay?${params.toString()}`;
};

/**
 * Generate UPI payment link for mobile apps (PhonePe, Google Pay, Paytm)
 */
export const generateUPIAppLink = (upiId, amount, transactionNote = "", app = "phonepe") => {
  if (!upiId) return null;
  
  const apps = {
    phonepe: `phonepe://pay?pa=${encodeURIComponent(upiId)}&am=${amount.toFixed(2)}&cu=INR&tn=${encodeURIComponent(transactionNote || "")}`,
    googlepay: `tez://upi/pay?pa=${encodeURIComponent(upiId)}&am=${amount.toFixed(2)}&cu=INR&tn=${encodeURIComponent(transactionNote || "")}`,
    paytm: `paytmmp://pay?pa=${encodeURIComponent(upiId)}&am=${amount.toFixed(2)}&cu=INR&tn=${encodeURIComponent(transactionNote || "")}`,
  };
  
  return apps[app] || generateUPILink(upiId, amount, transactionNote);
};

/**
 * Generate payment request message for WhatsApp/SMS
 */
export const generatePaymentRequestMessage = ({
  invoiceNumber,
  amount,
  customerName,
  businessName,
  paymentMethods = {},
  invoiceLink = "",
  dueDate = null,
}) => {
  const formattedAmount = `₹${Number(amount).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
  
  let message = `💰 *Payment Request*\n\n`;
  message += `Hello ${customerName || "Customer"},\n\n`;
  message += `Invoice: *${invoiceNumber}*\n`;
  message += `Amount: *${formattedAmount}*\n`;
  
  if (dueDate) {
    message += `Due Date: *${dueDate}*\n`;
  }
  
  message += `\n📱 *Payment Options:*\n\n`;
  
  // UPI Payment
  if (paymentMethods.upi && paymentMethods.upi.upiId) {
    message += `💳 *UPI Payment:*\n`;
    message += `UPI ID: *${paymentMethods.upi.upiId}*\n`;
    if (paymentMethods.upi.upiLink) {
      message += `Tap to pay: ${paymentMethods.upi.upiLink}\n`;
    }
    message += `\n`;
  }
  
  // Card Payment
  if (paymentMethods.card && paymentMethods.card.enabled) {
    message += `💳 *Card Payment:*\n`;
    if (paymentMethods.card.paymentLink) {
      message += `Pay via card: ${paymentMethods.card.paymentLink}\n`;
    } else {
      message += `Contact ${businessName} for card payment details\n`;
    }
    message += `\n`;
  }
  
  // Bank Transfer
  if (paymentMethods.bank && paymentMethods.bank.accountNumber) {
    message += `🏦 *Bank Transfer:*\n`;
    message += `Bank: ${paymentMethods.bank.bankName || "N/A"}\n`;
    message += `Account: ${paymentMethods.bank.accountNumber}\n`;
    message += `IFSC: ${paymentMethods.bank.ifsc || "N/A"}\n`;
    message += `Account Name: ${paymentMethods.bank.accountName || "N/A"}\n`;
    message += `\n`;
  }
  
  if (invoiceLink) {
    message += `\n📄 View invoice: ${invoiceLink}\n`;
  }
  
  message += `\nThank you!\n— ${businessName}`;
  
  return message;
};

/**
 * Generate WhatsApp payment link
 */
export const generateWhatsAppPaymentLink = (phone, message) => {
  if (!phone) return null;
  
  const cleanPhone = phone.toString().replace(/\D/g, "");
  const phoneNumber = cleanPhone.startsWith("91") ? cleanPhone : `91${cleanPhone}`;
  const encodedMessage = encodeURIComponent(message);
  
  return `https://wa.me/${phoneNumber}?text=${encodedMessage}`;
};

/**
 * Generate SMS payment link (for future SMS integration)
 */
export const generateSMSPaymentLink = (phone, message) => {
  if (!phone) return null;
  
  const cleanPhone = phone.toString().replace(/\D/g, "");
  const encodedMessage = encodeURIComponent(message);
  
  return `sms:${cleanPhone}?body=${encodedMessage}`;
};

/**
 * Get payment gateway configuration for a user
 */
export const getPaymentGatewayConfig = async (userId, db) => {
  try {
    const { doc, getDoc } = await import("firebase/firestore");
    const prefRef = doc(db, "businesses", userId, "preferences", "billing");
    const snap = await getDoc(prefRef);
    
    if (!snap.exists()) {
      return getDefaultPaymentConfig();
    }
    
    const data = snap.data();
    return {
      upi: {
        enabled: true,
        upiId: data.payment?.upiId || "",
        upiQrUrl: data.payment?.upiQrUrl || "",
        multipleUpiIds: data.payment?.multipleUpiIds || [],
      },
      card: {
        enabled: data.payment?.card?.enabled || false,
        gateway: data.payment?.card?.gateway || "", // razorpay, stripe, etc.
        merchantId: data.payment?.card?.merchantId || "",
        apiKey: data.payment?.card?.apiKey || "", // Should be encrypted in production
        paymentLinkEnabled: data.payment?.card?.paymentLinkEnabled || false,
      },
      bank: {
        enabled: true,
        bankName: data.bank?.bankName || "",
        branch: data.bank?.branch || "",
        accountNumber: data.bank?.accountNumber || "",
        ifsc: data.bank?.ifsc || "",
        accountName: data.bank?.accountName || "",
      },
      notifications: {
        sendOnInvoice: data.payment?.notifications?.sendOnInvoice || false,
        sendOnCredit: data.payment?.notifications?.sendOnCredit || true,
        autoSendPaymentLink: data.payment?.notifications?.autoSendPaymentLink || false,
      },
    };
  } catch (error) {
    console.error("Error loading payment gateway config:", error);
    return getDefaultPaymentConfig();
  }
};

/**
 * Default payment gateway configuration
 */
export const getDefaultPaymentConfig = () => ({
  upi: {
    enabled: true,
    upiId: "",
    upiQrUrl: "",
    multipleUpiIds: [],
  },
  card: {
    enabled: false,
    gateway: "",
    merchantId: "",
    apiKey: "",
    paymentLinkEnabled: false,
  },
  bank: {
    enabled: true,
    bankName: "",
    branch: "",
    accountNumber: "",
    ifsc: "",
    accountName: "",
  },
  notifications: {
    sendOnInvoice: false,
    sendOnCredit: true,
    autoSendPaymentLink: false,
  },
});

/**
 * Generate payment links for an invoice
 */
export const generateInvoicePaymentLinks = (invoice, paymentConfig) => {
  const amount = invoice.totalAmount || invoice.totals?.grandTotal || 0;
  const invoiceNumber = invoice.invoiceNumber || invoice.invoiceId || "N/A";
  const transactionNote = `Payment for invoice ${invoiceNumber}`;
  
  const links = {
    upi: null,
    upiPhonePe: null,
    upiGooglePay: null,
    upiPaytm: null,
    card: null,
    whatsapp: null,
  };
  
  // UPI Links
  if (paymentConfig.upi?.enabled && paymentConfig.upi?.upiId) {
    links.upi = generateUPILink(paymentConfig.upi.upiId, amount, transactionNote);
    links.upiPhonePe = generateUPIAppLink(paymentConfig.upi.upiId, amount, transactionNote, "phonepe");
    links.upiGooglePay = generateUPIAppLink(paymentConfig.upi.upiId, amount, transactionNote, "googlepay");
    links.upiPaytm = generateUPIAppLink(paymentConfig.upi.upiId, amount, transactionNote, "paytm");
  }
  
  // Card Payment Link (would integrate with Razorpay/Stripe API)
  if (paymentConfig.card?.enabled && paymentConfig.card?.paymentLinkEnabled) {
    // This would call the actual payment gateway API
    // For now, return a placeholder
    links.card = `#card-payment-${invoiceNumber}`;
  }
  
  return links;
};

/**
 * Validate payment gateway configuration
 */
export const validatePaymentConfig = (config) => {
  const errors = [];
  
  if (config.upi?.enabled) {
    if (!config.upi.upiId || !config.upi.upiId.includes("@")) {
      errors.push("UPI ID must be in format: username@bank");
    }
  }
  
  if (config.card?.enabled) {
    if (!config.card.gateway) {
      errors.push("Card gateway must be selected (Razorpay, Stripe, etc.)");
    }
    if (config.card.paymentLinkEnabled && !config.card.merchantId) {
      errors.push("Merchant ID is required for card payment links");
    }
  }
  
  if (config.bank?.enabled) {
    if (!config.bank.accountNumber || config.bank.accountNumber.length < 9) {
      errors.push("Valid bank account number is required");
    }
    if (!config.bank.ifsc || config.bank.ifsc.length !== 11) {
      errors.push("Valid IFSC code is required (11 characters)");
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
};


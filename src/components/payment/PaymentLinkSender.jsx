import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { generatePaymentRequestMessage, generateWhatsAppPaymentLink, generateInvoicePaymentLinks, getPaymentGatewayConfig } from "../../utils/paymentGateway";
import { generatePaymentLink, isPaymentGatewayAvailable } from "../../utils/paymentLinkService";
import { db, auth } from "../../firebase/firebaseConfig";
import { toast } from "react-toastify";

const PaymentLinkSender = ({ isOpen, onClose, invoice, customer }) => {
  const [paymentConfig, setPaymentConfig] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedMethods, setSelectedMethods] = useState({
    upi: true,
    card: false,
    bank: true,
  });
  const [paymentLinks, setPaymentLinks] = useState(null);

  useEffect(() => {
    if (!isOpen || !invoice) return;
    
    const loadConfig = async () => {
      const uid = auth.currentUser?.uid;
      if (!uid) return;
      
      try {
        const config = await getPaymentGatewayConfig(uid, db);
        setPaymentConfig(config);
        
        // Generate payment links
        const links = generateInvoicePaymentLinks(invoice, config);
        setPaymentLinks(links);
      } catch (error) {
        console.error("Error loading payment config:", error);
        toast.error("Failed to load payment settings");
      }
    };
    
    loadConfig();
  }, [isOpen, invoice]);

  const handleSendPaymentLink = async (method = "whatsapp") => {
    if (!invoice || !customer) {
      toast.error("Invoice or customer information missing");
      return;
    }

    setLoading(true);
    try {
      const amount = invoice.totalAmount || invoice.totals?.grandTotal || 0;
      const invoiceNumber = invoice.invoiceNumber || invoice.invoiceId || "N/A";
      const businessName = invoice.seller?.businessName || "Business";
      
      // Build payment methods object
      const paymentMethods = {};
      
      if (selectedMethods.upi && paymentConfig?.upi?.enabled && paymentConfig.upi.upiId) {
        paymentMethods.upi = {
          upiId: paymentConfig.upi.upiId,
          upiLink: paymentLinks?.upi || null,
        };
      }
      
      if (selectedMethods.card && paymentConfig?.card?.enabled) {
        // Generate payment link using backend service if merchant account exists
        if (isPaymentGatewayAvailable(paymentConfig)) {
          try {
            const amount = invoice.totalAmount || invoice.totals?.grandTotal || 0;
            const invoiceId = invoice.invoiceId || invoice.id;
            const linkResult = await generatePaymentLink(invoiceId, amount, {
              name: customer.name || customer.businessName,
              email: customer.email,
              phone: customer.phone,
            });
            
            if (linkResult.success) {
              paymentMethods.card = {
                enabled: true,
                paymentLink: linkResult.paymentLink,
              };
            } else {
              console.warn("Failed to generate card payment link:", linkResult.error);
              paymentMethods.card = {
                enabled: true,
                paymentLink: null,
                error: linkResult.error,
              };
            }
          } catch (error) {
            console.error("Error generating card payment link:", error);
            paymentMethods.card = {
              enabled: true,
              paymentLink: null,
            };
          }
        } else {
          paymentMethods.card = {
            enabled: true,
            paymentLink: paymentLinks?.card || null,
          };
        }
      }
      
      if (selectedMethods.bank && paymentConfig?.bank?.enabled) {
        paymentMethods.bank = paymentConfig.bank;
      }

      // Generate invoice link
      const invoiceLink = invoice.id 
        ? `${window.location.origin}/invoice/${auth.currentUser?.uid}/${invoice.id}`
        : "";

      // Generate payment request message
      const message = generatePaymentRequestMessage({
        invoiceNumber,
        amount,
        customerName: customer.name || customer.businessName || "Customer",
        businessName,
        paymentMethods,
        invoiceLink,
        dueDate: invoice.creditDueDate 
          ? new Date(invoice.creditDueDate).toLocaleDateString("en-IN", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            })
          : null,
      });

      if (method === "whatsapp") {
        const phone = customer.phone || customer.buyer?.phone;
        if (!phone) {
          toast.error("Customer phone number is required");
          setLoading(false);
          return;
        }
        
        const whatsappLink = generateWhatsAppPaymentLink(phone, message);
        if (whatsappLink) {
          window.open(whatsappLink, "_blank");
          toast.success("Opening WhatsApp...");
        } else {
          toast.error("Failed to generate WhatsApp link");
        }
      } else if (method === "copy") {
        // Copy message to clipboard
        await navigator.clipboard.writeText(message);
        toast.success("Payment message copied to clipboard!");
      }

      onClose();
    } catch (error) {
      console.error("Error sending payment link:", error);
      toast.error("Failed to send payment link");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const amount = invoice?.totalAmount || invoice?.totals?.grandTotal || 0;
  const invoiceNumber = invoice?.invoiceNumber || invoice?.invoiceId || "N/A";

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-2xl mx-4 rounded-xl border border-white/10 bg-white/10 backdrop-blur-2xl text-white shadow-xl">
        <div className="p-4 md:p-6 border-b border-white/10 flex items-center justify-between">
          <h2 className="text-lg md:text-xl font-semibold">Send Payment Link</h2>
          <button
            className="opacity-80 hover:opacity-100 text-2xl leading-none"
            onClick={onClose}
            disabled={loading}
          >
            ×
          </button>
        </div>

        <div className="p-4 md:p-6 space-y-4">
          {/* Invoice Summary */}
          <div className="p-4 rounded-lg bg-white/5 border border-white/10">
            <p className="text-sm text-white/70 mb-1">Invoice</p>
            <p className="font-semibold text-lg">{invoiceNumber}</p>
            <p className="text-sm text-white/70 mt-1">
              Amount: <span className="font-semibold text-emerald-300">₹{Number(amount).toFixed(2)}</span>
            </p>
            <p className="text-sm text-white/70">
              Customer: {customer?.name || customer?.businessName || "N/A"}
            </p>
          </div>

          {/* Payment Methods Selection */}
          <div className="space-y-3">
            <h3 className="font-semibold text-base">Select Payment Methods to Include</h3>
            
            {/* UPI */}
            {paymentConfig?.upi?.enabled && paymentConfig.upi.upiId && (
              <label className="flex items-center gap-3 p-3 rounded-lg bg-white/5 border border-white/10 cursor-pointer hover:bg-white/10 transition">
                <input
                  type="checkbox"
                  checked={selectedMethods.upi}
                  onChange={(e) => setSelectedMethods(prev => ({ ...prev, upi: e.target.checked }))}
                  className="w-5 h-5 accent-emerald-400"
                />
                <div className="flex-1">
                  <p className="font-medium">UPI Payment</p>
                  <p className="text-sm text-white/70">{paymentConfig.upi.upiId}</p>
                  {paymentLinks?.upi && (
                    <a
                      href={paymentLinks.upi}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-emerald-300 hover:underline mt-1 inline-block"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Test UPI Link
                    </a>
                  )}
                </div>
              </label>
            )}

            {/* Card */}
            {paymentConfig?.card?.enabled && (
              <label className="flex items-center gap-3 p-3 rounded-lg bg-white/5 border border-white/10 cursor-pointer hover:bg-white/10 transition">
                <input
                  type="checkbox"
                  checked={selectedMethods.card}
                  onChange={(e) => setSelectedMethods(prev => ({ ...prev, card: e.target.checked }))}
                  className="w-5 h-5 accent-emerald-400"
                />
                <div className="flex-1">
                  <p className="font-medium">Card Payment</p>
                  <p className="text-sm text-white/70">
                    {paymentConfig.card.gateway || "Card payment gateway"}
                  </p>
                </div>
              </label>
            )}

            {/* Bank Transfer */}
            {paymentConfig?.bank?.enabled && paymentConfig.bank.accountNumber && (
              <label className="flex items-center gap-3 p-3 rounded-lg bg-white/5 border border-white/10 cursor-pointer hover:bg-white/10 transition">
                <input
                  type="checkbox"
                  checked={selectedMethods.bank}
                  onChange={(e) => setSelectedMethods(prev => ({ ...prev, bank: e.target.checked }))}
                  className="w-5 h-5 accent-emerald-400"
                />
                <div className="flex-1">
                  <p className="font-medium">Bank Transfer</p>
                  <p className="text-sm text-white/70">
                    {paymentConfig.bank.bankName} - {paymentConfig.bank.accountNumber}
                  </p>
                </div>
              </label>
            )}

            {!paymentConfig && (
              <p className="text-sm text-white/60 italic">
                Loading payment configuration...
              </p>
            )}

            {paymentConfig && !paymentConfig.upi?.upiId && !paymentConfig.card?.enabled && !paymentConfig.bank?.accountNumber && (
              <p className="text-sm text-amber-300 italic">
                No payment methods configured. Please set up payment methods in Billing Settings.
              </p>
            )}
          </div>

          {/* Quick UPI App Links */}
          {selectedMethods.upi && paymentLinks?.upi && (
            <div className="p-4 rounded-lg bg-white/5 border border-white/10">
              <p className="text-sm font-medium mb-2">Quick UPI Payment</p>
              <div className="flex flex-wrap gap-2">
                {paymentLinks.upiPhonePe && (
                  <a
                    href={paymentLinks.upiPhonePe}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-sm border border-white/20"
                  >
                    PhonePe
                  </a>
                )}
                {paymentLinks.upiGooglePay && (
                  <a
                    href={paymentLinks.upiGooglePay}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-sm border border-white/20"
                  >
                    Google Pay
                  </a>
                )}
                {paymentLinks.upiPaytm && (
                  <a
                    href={paymentLinks.upiPaytm}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-sm border border-white/20"
                  >
                    Paytm
                  </a>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="p-4 md:p-6 border-t border-white/10 flex items-center justify-end gap-3">
          <button
            className="px-4 py-2 rounded-lg border border-white/20 hover:bg-white/10 transition"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </button>
          <button
            className="px-4 py-2 rounded-lg font-medium text-sm border border-white/20 hover:bg-white/10 transition"
            onClick={() => handleSendPaymentLink("copy")}
            disabled={loading || (!selectedMethods.upi && !selectedMethods.card && !selectedMethods.bank)}
          >
            Copy Message
          </button>
          <button
            className="px-4 py-2 rounded-lg font-medium text-slate-900 bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 hover:shadow-[0_8px_24px_rgba(16,185,129,0.35)] transition disabled:opacity-50"
            onClick={() => handleSendPaymentLink("whatsapp")}
            disabled={loading || (!selectedMethods.upi && !selectedMethods.card && !selectedMethods.bank) || !customer?.phone}
            title={!customer?.phone ? "Customer phone number required" : ""}
          >
            {loading ? "Sending..." : "Send via WhatsApp"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default PaymentLinkSender;


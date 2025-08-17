import moment from "moment";
import React, { useState, useEffect } from "react";
import CustomerForm from "./CustomerForm";
import BillingCart from "./BillingCart";
import InvoiceSettings from "./InvoiceSettings";
import ProductSearch from "./ProductSearch";
import InvoicePreview from "./InvoicePreview";
import { auth, db } from "../../firebase/firebaseConfig";
import { doc, getDoc, updateDoc, setDoc } from "firebase/firestore";

const updateInventoryStock = async (userId, cartItems) => {
  for (const item of cartItems) {
    try {
      // Log brand and category for debugging
      console.log("Updating stock for:", item.name, "ID:", item.id, "Qty:", item.quantity, "Brand:", item.brand, "Category:", item.category);
      const productRef = doc(db, "businesses", userId, "products", item.id);
      const productSnap = await getDoc(productRef);
      if (productSnap.exists()) {
        const currentStock = parseFloat(productSnap.data().quantity) || 0;
        const newStock = currentStock - item.quantity;
        const finalStock = newStock < 0 ? 0 : newStock;

        await updateDoc(productRef, {
          quantity: finalStock,
        });
        console.log("Stock updated to:", finalStock);
      } else {
        console.warn("Product not found for ID:", item.id);
      }
    } catch (error) {
      console.error("Error updating stock for product ID:", item.id, error.message);
    }
  }
};

const CreateInvoice = () => {
  const [customer, setCustomer] = useState({ name: "", phone: "", email: "", address: "" });
  const [cartItems, setCartItems] = useState([]);
  const [settings, setSettings] = useState({
    includeGST: false,
    includeCGST: false,
    includeIGST: false,
    gstRate: 9,
    cgstRate: 9,
    igstRate: 18,
    invoiceType: "",
    paymentMode: ""
  });
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [showPreview, setShowPreview] = useState({ visible: false, issuedAt: null });
  const [userInfo, setUserInfo] = useState(null);
  const [invoiceId, setInvoiceId] = useState("");
  const [invoiceData, setInvoiceData] = useState(null);
  const [splitPayment, setSplitPayment] = useState({ cash: 0, upi: 0, card: 0 });

  useEffect(() => {
    const fetchUserInfo = async () => {
      const user = auth.currentUser;
      if (user) {
        const docRef = doc(db, "businesses", user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setUserInfo({ ...docSnap.data(), uid: user.uid });
        }
      }
    };
    fetchUserInfo();
  }, []);


  const handleCustomerChange = (updated) => {
    setCustomer(updated);
  };

  const handleSubmitInvoice = async () => {
    if (!userInfo) {
      alert("User not authenticated or user info missing.");
      return;
    }
    if (cartItems.length === 0) {
      alert("Cart is empty. Please add products to generate invoice.");
      return;
    }
    const issuedAt = moment().format('YYYY-MM-DDTHH:mm:ss.SSSZ');
    const newInvoiceId = "INV-" + Math.random().toString(36).substr(2, 9).toUpperCase();
    setInvoiceId(newInvoiceId);

    // --- Customer Firestore Save/Update Logic ---
    try {
      if (customer && customer.custId) {
        const customerRef = doc(db, "businesses", userInfo.uid, "customers", customer.custId);
        const customerSnap = await getDoc(customerRef);
        if (customerSnap.exists()) {
          // Merge new fields if missing before updating
          const existingData = customerSnap.data();
          const mergedCustomer = { ...existingData, ...customer, updatedAt: issuedAt };
          await updateDoc(customerRef, mergedCustomer);
        } else {
          await setDoc(customerRef, { ...customer, createdAt: issuedAt });
        }
      }
    } catch (err) {
      console.error("Error saving/updating customer:", err);
      alert("Failed to save customer info. Please try again.");
      return;
    }

    const subtotal = cartItems.reduce((total, item) => {
      const itemTotal = item.quantity * item.price;
      const discount = item.discount || 0;
      return total + itemTotal - (itemTotal * discount / 100);
    }, 0);

    const gstAmount = settings.includeGST ? subtotal * (settings.gstRate / 100) : 0;
    const cgstAmount = settings.includeCGST ? subtotal * (settings.cgstRate / 100) : 0;
    const sgstAmount = settings.includeSGST ? subtotal * (settings.sgstRate / 100) : 0;
    const igstAmount = settings.includeIGST ? subtotal * (settings.igstRate / 100) : 0;

    const totalAmount = parseFloat((subtotal + gstAmount + cgstAmount + sgstAmount + igstAmount).toFixed(2));

    if (settings.paymentMode === "Split") {
      const totalSplit = splitPayment.cash + splitPayment.upi + splitPayment.card;
      if (totalSplit !== totalAmount) {
        alert(`Split payment does not match invoice total. Total: ₹${totalAmount}, Split: ₹${totalSplit}`);
        return;
      }
    }

    let isPaid = false;
    let paidOn = null;
    let creditDueDate = null;

    if (settings.paymentMode?.toLowerCase() === "credit") {
      creditDueDate = settings.creditDueDate || moment().add(7, 'days').format('YYYY-MM-DD');
    } else {
      isPaid = true;
      paidOn = issuedAt;
    }

    // Prevent duplicate split fields from settings
    const cleanedSettings = { ...settings };
    delete cleanedSettings.splitCash;
    delete cleanedSettings.splitUPI;
    delete cleanedSettings.splitCard;
    delete cleanedSettings.splitPayment;

    const syncedSplitPayment = settings.splitPayment || splitPayment;

    console.log("💰 SplitPayment Before Save:", syncedSplitPayment);
    const newInvoiceData = {
      customer,
      custId: customer && customer.custId ? customer.custId : undefined,
      cartItems,
      settings: cleanedSettings,
      paymentMode: settings.paymentMode,
      invoiceType: settings.invoiceType,
      issuedAt,
      invoiceId: newInvoiceId,
      totalAmount,
      splitPayment: syncedSplitPayment,
      creditDueDate,
      isPaid,
      paidOn
    };
    console.log("📦 Invoice Data to Save:", newInvoiceData);
    setInvoiceData(newInvoiceData);
    setShowPreview({ visible: true, issuedAt });
  };

  const handleCancelPreview = () => {
    setShowPreview({ visible: false, issuedAt: null });
  };

  if (showPreview.visible && userInfo && invoiceData) {
    return (
      <InvoicePreview
        customer={customer}
        cartItems={cartItems}
        settings={settings}
        paymentMode={settings.paymentMode}
        invoiceType={settings.invoiceType}
        issuedAt={showPreview.issuedAt}
        invoiceId={invoiceId}
        onCancel={handleCancelPreview}
        onConfirm={async () => {
          try {
            const invoiceRef = doc(db, "businesses", userInfo.uid, "finalizedInvoices", invoiceId);
            await setDoc(invoiceRef, {
              ...invoiceData,
              createdAt: invoiceData.issuedAt,
              isPaid: invoiceData.isPaid,
              paidOn: invoiceData.paidOn,
              creditDueDate: invoiceData.creditDueDate
            });
            console.log("Invoice saved to Firestore:", invoiceId);
            await updateInventoryStock(userInfo.uid, cartItems);
          } catch (error) {
            console.error("Error saving invoice:", error.message);
            alert("Failed to save invoice. Please try again.");
            return;
          }
          setShowPreview({ visible: false, issuedAt: null });
        }}
        taxRates={{
          gst: settings.gstRate,
          cgst: settings.cgstRate,
          igst: settings.igstRate
        }}
        userInfo={{
          businessName: userInfo.businessName || "N/A",
          ownerName: userInfo.ownerName || "N/A",
          address: userInfo.address || "N/A",
          phone: userInfo.phone || "N/A",
          email: userInfo.email || "N/A",
          gstin: userInfo.gstin || "N/A",
          pan: userInfo.pan || "N/A"
        }}
      />
    );
  }

  return (
    <div className="space-y-6 px-4 md:px-6 pb-32 pt-[env(safe-area-inset-top)] text-white">
      {/* Customer Info */}
      <div className="p-4 rounded-xl bg-white/10 backdrop-blur-xl border border-white/10 shadow-[0_8px_40px_rgba(0,0,0,0.35)]">
        <h2 className="text-lg font-semibold mb-2 text-white">Customer Information</h2>
        {userInfo && (
          <CustomerForm customer={customer} onChange={handleCustomerChange} userId={userInfo.uid} />
        )}
      </div>

      {/* Product Search */}
      <div className="p-4 rounded-xl bg-white/10 backdrop-blur-xl border border-white/10 shadow-[0_8px_40px_rgba(0,0,0,0.35)]">
        <h2 className="text-lg font-semibold mb-2 text-white">Add Product</h2>
        <ProductSearch
          onSelect={(product) => {
            const alreadyExists = selectedProducts.find(p => p.id === product.id);
            if (!alreadyExists) {
              const newSelected = [...selectedProducts, product];
              setSelectedProducts(newSelected);
              setCartItems(prev => [...prev, {
                id: product.id,
                name: product.name,
                sku: product.sku || "",
                brand: product.brand || "",
                category: product.category || "",
                quantity: 1,
                price: parseFloat(product.sellingPrice || 0),
                discount: 0,
                unit: product.unit || ""
              }]);
            }
          }}
        />
      </div>

      {/* Invoice Settings */}
      <div className="p-4 rounded-xl bg-white/10 backdrop-blur-xl border border-white/10 shadow-[0_8px_40px_rgba(0,0,0,0.35)]">
        <InvoiceSettings settings={settings} onChange={setSettings} />
        {settings.paymentMode === "Split" && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
            <div>
              <label className="block text-sm font-medium text-white/80 mb-1">Cash Amount</label>
              <input
                type="number"
                value={splitPayment.cash}
                onChange={(e) => {
                  const val = parseFloat(e.target.value) || 0;
                  console.log("💰 Cash Split Updated:", val);
                  setSplitPayment((prev) => ({ ...prev, cash: val }));
                }}
                className="w-full rounded px-3 py-2 bg-white/10 border border-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-white/80 mb-1">UPI Amount</label>
              <input
                type="number"
                value={splitPayment.upi}
                onChange={(e) => {
                  const val = parseFloat(e.target.value) || 0;
                  console.log("💰 UPI Split Updated:", val);
                  setSplitPayment((prev) => ({ ...prev, upi: val }));
                }}
                className="w-full rounded px-3 py-2 bg-white/10 border border-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-white/80 mb-1">Card Amount</label>
              <input
                type="number"
                value={splitPayment.card}
                onChange={(e) => {
                  const val = parseFloat(e.target.value) || 0;
                  console.log("💰 Card Split Updated:", val);
                  setSplitPayment((prev) => ({ ...prev, card: val }));
                }}
                className="w-full rounded px-3 py-2 bg-white/10 border border-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
              />
            </div>
          </div>
        )}
        {settings.paymentMode === "Credit" && (
          <div className="mt-4">
            <label className="block text-sm font-medium text-white/80 mb-1">Credit Due Date (Default: 7 days from today)</label>
            <input
              type="date"
              className="w-full rounded px-3 py-2 bg-white/10 border border-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
              value={settings.creditDueDate || ""}
              onChange={(e) => {
                setSettings((prev) => ({
                  ...prev,
                  creditDueDate: e.target.value
                }));
              }}
            />
          </div>
        )}
      </div>

      {/* Cart */}
      <div className="p-4 rounded-xl bg-white/10 backdrop-blur-xl border border-white/10 shadow-[0_8px_40px_rgba(0,0,0,0.35)]">
        <h2 className="text-lg font-semibold mb-2 text-white">Product Cart</h2>
        <BillingCart
          selectedProducts={selectedProducts}
          cartItems={cartItems}
          onUpdateCart={setCartItems}
          settings={settings}
        />
      </div>

      {/* Submit Button */}
      <div className="hidden md:flex justify-end">
        <button
          onClick={handleSubmitInvoice}
          className="px-6 py-2 rounded-xl font-semibold text-slate-900 bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 hover:shadow-[0_10px_30px_rgba(16,185,129,0.35)] transition"
        >
          Create Bill
        </button>
      </div>
      {/* Mobile Floating Button */}
      <div className="fixed bottom-4 inset-x-4 z-50 md:hidden">
        <button
          onClick={handleSubmitInvoice}
          className="w-full text-slate-900 py-3 rounded-xl shadow-lg text-lg font-semibold bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 hover:shadow-[0_10px_30px_rgba(16,185,129,0.35)]"
        >
          Create Bill
        </button>
      </div>
    </div>
  );
};

export default CreateInvoice;

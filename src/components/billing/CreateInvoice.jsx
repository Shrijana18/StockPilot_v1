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

    const subtotal = cartItems.reduce((total, item) => {
      const itemTotal = item.quantity * item.price;
      const discount = item.discount || 0;
      return total + itemTotal - (itemTotal * discount / 100);
    }, 0);

    const gstAmount = settings.includeGST ? subtotal * (settings.gstRate / 100) : 0;
    const cgstAmount = settings.includeCGST ? subtotal * (settings.cgstRate / 100) : 0;
    const sgstAmount = settings.includeCGST ? subtotal * (settings.cgstRate / 100) : 0;
    const igstAmount = settings.includeIGST ? subtotal * (settings.igstRate / 100) : 0;

    const totalAmount = parseFloat((subtotal + gstAmount + cgstAmount + sgstAmount + igstAmount).toFixed(2));

    const newInvoiceData = {
      customer,
      cartItems,
      settings,
      paymentMode: settings.paymentMode,
      invoiceType: settings.invoiceType,
      issuedAt,
      invoiceId: newInvoiceId,
      totalAmount,
      paymentBreakdown: {
        cash: settings.paymentMode === "Cash" ? 1 : 0,
        upi: settings.paymentMode === "UPI" ? 1 : 0,
        card: settings.paymentMode === "Card" ? 1 : 0
      }
    };
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
              createdAt: invoiceData.issuedAt
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
    <div className="space-y-6">
      {/* Customer Info */}
      <div className="bg-white p-4 rounded shadow">
        <h2 className="text-lg font-semibold mb-2">Customer Information</h2>
        <CustomerForm customer={customer} onChange={handleCustomerChange} />
      </div>

      {/* Product Search */}
      <div className="bg-white p-4 rounded shadow">
        <h2 className="text-lg font-semibold mb-2">Add Product</h2>
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
      <div className="bg-white p-4 rounded shadow">
        <InvoiceSettings settings={settings} onChange={setSettings} />
      </div>

      {/* Cart */}
      <div className="bg-white p-4 rounded shadow">
        <h2 className="text-lg font-semibold mb-2">Product Cart</h2>
        <BillingCart
          selectedProducts={selectedProducts}
          cartItems={cartItems}
          onUpdateCart={setCartItems}
        />
      </div>

      {/* Submit Button */}
      <div className="text-right">
        <button
          onClick={handleSubmitInvoice}
          className="bg-blue-600 text-white px-6 py-2 rounded shadow"
        >
          Create Bill
        </button>
      </div>
    </div>
  );
};

export default CreateInvoice;

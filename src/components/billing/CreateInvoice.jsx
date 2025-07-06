import React, { useState, useEffect } from "react";
import CustomerForm from "./CustomerForm";
import BillingCart from "./BillingCart";
import InvoiceSettings from "./InvoiceSettings";
import ProductSearch from "./ProductSearch";
import InvoicePreview from "./InvoicePreview";
import { auth, db } from "../../firebase/firebaseConfig";
import { doc, getDoc } from "firebase/firestore";

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

  const handleSubmitInvoice = () => {
    if (!userInfo) {
      alert("User not authenticated or user info missing.");
      return;
    }
    if (cartItems.length === 0) {
      alert("Cart is empty. Please add products to generate invoice.");
      return;
    }
    const issuedAt = new Date().toISOString();
    const newInvoiceId = "INV-" + Math.random().toString(36).substr(2, 9).toUpperCase();
    setInvoiceId(newInvoiceId);
    setShowPreview({ visible: true, issuedAt });
  };

  const handleCancelPreview = () => {
    setShowPreview({ visible: false, issuedAt: null });
  };

  if (showPreview.visible && userInfo) {
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
            if (!selectedProducts.find(p => p.id === product.id)) {
              setSelectedProducts([...selectedProducts, product]);
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

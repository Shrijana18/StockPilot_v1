import React, { useState, useEffect } from "react";
import CustomerForm from "../components/CustomerForm";
import InvoiceSettings from "../components/InvoiceSettings";
import ProductCart from "../components/ProductCart";
import InvoiceSummary from "../components/InvoiceSummary";
import { handleAddProduct } from "../firebase/firestoreHelpers";
import { db } from "../firebase/firebaseConfig";
import { collection, addDoc } from "firebase/firestore";
const Billing = ({ currentUser }) => {
  const [customerInfo, setCustomerInfo] = useState({
    name: "",
    phone: "",
    email: "",
  });

  const [invoiceSettings, setInvoiceSettings] = useState({
    includeGST: true,
    invoiceType: "Retail",
  });

  const [cart, setCart] = useState([]);
  const [productSearch, setProductSearch] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  const handleProductAdd = () => {
    const sku = productSearch.trim().toUpperCase();
    const found = {
      id: Date.now(),
      name: sku,
      quantity: 1,
      price: 100,
      discount: 0,
      subtotal: 100,
    };
    setCart([...cart, found]);
    setProductSearch("");
  };

  const handleCartUpdate = (updatedCart) => {
    setCart(updatedCart);
  };

  const handleGenerateInvoice = async () => {
    setIsGenerating(true);
    const subtotal = cart.reduce((sum, item) => sum + item.subtotal, 0);
    const gst = invoiceSettings.includeGST ? subtotal * 0.18 : 0;
    const total = subtotal + gst;

    const invoiceData = {
      customer: customerInfo,
      settings: invoiceSettings,
      cart,
      subtotal,
      gst,
      total,
      createdAt: new Date().toISOString(),
    };

    try {
      await addDoc(
        collection(db, "businesses", currentUser.uid, "finalizedInvoices"),
        invoiceData
      );
      alert("✅ Invoice saved successfully!");
      setCart([]);
      setCustomerInfo({ name: "", phone: "", email: "" });
    } catch (err) {
      console.error("Error saving invoice:", err);
      alert("❌ Failed to save invoice.");
    }
    setIsGenerating(false);
  };

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6 text-center">Billing Dashboard</h1>

      <CustomerForm
        customerInfo={customerInfo}
        setCustomerInfo={setCustomerInfo}
      />

      <InvoiceSettings
        invoiceSettings={invoiceSettings}
        setInvoiceSettings={setInvoiceSettings}
      />

      <ProductCart
        cart={cart}
        setCart={handleCartUpdate}
        productSearch={productSearch}
        setProductSearch={setProductSearch}
        onAddProduct={handleProductAdd}
      />

      <InvoiceSummary
        cart={cart}
        invoiceSettings={invoiceSettings}
        onGenerateInvoice={handleGenerateInvoice}
        isGenerating={isGenerating}
      />
    </div>
  );
};

export default Billing;
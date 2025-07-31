import React, { useState } from "react";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { toast } from "react-toastify";
import axios from "axios";
import { getFirestore, collection, addDoc, serverTimestamp } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const ImportOldInvoice = () => {
  const [file, setFile] = useState(null);
  const [previewURL, setPreviewURL] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [parsedData, setParsedData] = useState(null); // Will hold structured invoice

  const handleFileChange = (e) => {
    const uploadedFile = e.target.files[0];
    if (uploadedFile) {
      setFile(uploadedFile);
      setPreviewURL(URL.createObjectURL(uploadedFile));
    }
  };

  const handleUpload = async () => {
    if (!file) return toast.error("Please select a file first");

    setIsUploading(true);
    const storage = getStorage();
    const fileRef = ref(storage, `oldInvoices/${Date.now()}_${file.name}`);
    
    try {
      await uploadBytes(fileRef, file);
      const downloadURL = await getDownloadURL(fileRef);

      const response = await axios.post(
        "https://us-central1-stockpilotv1.cloudfunctions.net/parseInvoiceFile",
        { fileUrl: downloadURL }
      );

      setParsedData(response.data.structuredInvoice);
      toast.success("Invoice parsed successfully!");
    } catch (error) {
      console.error(error);
      toast.error("Failed to upload or parse file");
    } finally {
      setIsUploading(false);
    }
  };

  const handleSave = async () => {
    if (!parsedData) return;

    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) return toast.error("User not logged in");

    const db = getFirestore();
    const businessId = user.uid; // Adjust if business ID is stored elsewhere
    const invoiceRef = collection(db, "businesses", businessId, "finalizedInvoices");

    const invoiceToSave = {
      createdAt: serverTimestamp(),
      issuedAt: serverTimestamp(),
      invoiceId: `INV-${Date.now().toString().slice(-8)}`,
      invoiceType: "tax",
      paymentMode: "cash",
      totalAmount: parsedData.total || 0,
      customer: {
        name: parsedData.customerName || "N/A",
        phone: parsedData.customerPhone || "",
        address: parsedData.customerAddress || "",
        email: ""
      },
      cartItems: (parsedData.productList || []).map((item, idx) => ({
        name: item.name || `Item ${idx + 1}`,
        quantity: item.quantity || 1,
        price: item.price || 0,
        unit: item.unit || "",
        discount: item.discount || 0,
        brand: item.brand || "",
        category: item.category || "",
        sku: item.sku || "",
        id: `${Date.now()}-${idx}`
      })),
      settings: {
        gstRate: 9,
        cgstRate: 9,
        igstRate: 18,
        includeGST: true,
        includeIGST: false
      },
      paymentBreakdown: {
        cash: parsedData.total || 0,
        upi: 0
      }
    };

    try {
      await addDoc(invoiceRef, invoiceToSave);
      toast.success("Invoice saved successfully!");
      setParsedData(null);
      setFile(null);
      setPreviewURL("");
    } catch (error) {
      console.error("Error saving invoice:", error);
      toast.error("Failed to save invoice");
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h2 className="text-xl font-bold mb-4">Import Old Invoice</h2>
      
      <input type="file" accept=".jpg,.jpeg,.png,.pdf,.xlsx,.xls" onChange={handleFileChange} />
      {previewURL && (
        <div className="mt-4">
          <p className="text-sm text-gray-600">Preview:</p>
          {file?.type?.includes("image") ? (
            <img src={previewURL} alt="Invoice Preview" className="max-w-xs max-h-64 border" />
          ) : (
            <p className="text-sm italic text-blue-600">{file.name}</p>
          )}
        </div>
      )}

      <button
        onClick={handleUpload}
        disabled={isUploading}
        className="mt-4 px-4 py-2 bg-blue-600 text-white rounded"
      >
        {isUploading ? "Uploading..." : "Upload & Parse"}
      </button>

      {parsedData && (
        <div className="mt-6">
          <h3 className="text-lg font-semibold mb-2">Parsed Invoice Preview:</h3>
          <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto">
            {JSON.stringify(parsedData, null, 2)}
          </pre>
          <button
            onClick={handleSave}
            className="mt-4 px-4 py-2 bg-green-600 text-white rounded"
          >
            Save to Firestore
          </button>
        </div>
      )}
    </div>
  );
};

export default ImportOldInvoice;
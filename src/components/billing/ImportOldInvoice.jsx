import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { toast } from "react-toastify";
import axios from "axios";
import { getFirestore, collection, addDoc, serverTimestamp } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import BackfillInvoicePreview from "./BackfillInvoicePreview";

const ImportOldInvoice = () => {
  const [file, setFile] = useState(null);
  const [previewURL, setPreviewURL] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [parsedData, setParsedData] = useState(null); // Will hold structured invoice
  const [backfillMode, setBackfillMode] = useState(""); // "ocr" or "manual"
  const navigate = useNavigate();

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

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h2 className="text-xl font-bold mb-4">Import Old Invoice</h2>

      <div className="mb-4">
        <p className="mb-2 font-medium">How do you want to backfill this invoice?</p>
        <label className="block mb-2">
          <input
            type="radio"
            name="backfillMode"
            value="ocr"
            checked={backfillMode === "ocr"}
            onChange={() => setBackfillMode("ocr")}
            className="mr-2"
          />
          Scan via OCR (AI)
        </label>
        <label className="block mb-4">
          <input
            type="radio"
            name="backfillMode"
            value="manual"
            checked={backfillMode === "manual"}
            onChange={() => {
              setBackfillMode("manual");
              navigate("/create-invoice?mode=backfill");
            }}
            className="mr-2"
          />
          Manually recreate via standard invoice form
        </label>
      </div>

      {backfillMode === "ocr" && (
        <>
          <input
            type="file"
            accept=".jpg,.jpeg,.png,.pdf,.xlsx,.xls"
            onChange={handleFileChange}
          />
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
              <BackfillInvoicePreview
                parsedInvoiceData={parsedData}
                onCancel={() => {
                  setParsedData(null);
                  setFile(null);
                  setPreviewURL("");
                }}
                onConfirmSave={() => {
                  setParsedData(null);
                  setFile(null);
                  setPreviewURL("");
                  toast.success("Invoice saved successfully!");
                }}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ImportOldInvoice;
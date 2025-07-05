

import React, { useState } from "react";
import { storage, db } from "../../firebase/firebaseConfig";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { addDoc, collection } from "firebase/firestore";

const OCRUploadForm = ({ userId }) => {
  const [imageFile, setImageFile] = useState(null);
  const [previewURL, setPreviewURL] = useState("");
  const [uploading, setUploading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    setImageFile(file);
    setPreviewURL(URL.createObjectURL(file));
    setSuccess(false);
  };

  const handleUpload = async () => {
    if (!imageFile || !userId) return;

    setUploading(true);
    try {
      const imageRef = ref(storage, `inventory_ocr/${userId}/${imageFile.name}`);
      await uploadBytes(imageRef, imageFile);
      const url = await getDownloadURL(imageRef);

      // Placeholder: parse products from image - mock example
      const parsedProducts = [
        {
          productName: "Toothbrush",
          brand: "Colgate",
          quantity: 10,
          unit: "pcs",
          costPrice: 15,
          sellingPrice: 20,
          description: "Auto-parsed item from OCR",
          imageURL: url,
          createdAt: new Date(),
        },
      ];

      const batchPromises = parsedProducts.map((product) =>
        addDoc(collection(db, "businesses", userId, "products"), product)
      );

      await Promise.all(batchPromises);

      setSuccess(true);
      setImageFile(null);
      setPreviewURL("");
    } catch (error) {
      console.error("OCR upload error:", error);
    }
    setUploading(false);
  };

  return (
    <div className="p-4 bg-white rounded shadow-md">
      <h3 className="text-lg font-semibold mb-2">OCR Inventory Upload</h3>
      <input type="file" accept="image/*" onChange={handleFileChange} />
      {previewURL && (
        <img
          src={previewURL}
          alt="Preview"
          className="mt-2 w-40 h-40 object-cover border rounded"
        />
      )}
      <button
        onClick={handleUpload}
        className="mt-4 px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
        disabled={uploading || !imageFile}
      >
        {uploading ? "Uploading..." : "Scan & Import"}
      </button>
      {success && <p className="text-green-600 mt-2">Upload successful!</p>}
    </div>
  );
};

export default OCRUploadForm;
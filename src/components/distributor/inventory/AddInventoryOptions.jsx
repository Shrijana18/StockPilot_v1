import { useState } from "react";
import ManualEntryForm from "./ManualEntryForm";
import OCRUploadForm from "./OCRUploadForm";
import AIInventoryForm from "./AIAutogenForm";

const AddInventoryOptions = ({ userId }) => {
  const [selectedOption, setSelectedOption] = useState("manual");

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-gray-800">Add Inventory</h2>

      <div className="border border-gray-300 p-4 rounded-md shadow-sm bg-white">
        <div className="flex space-x-4 mb-4">
          <button
            className={`px-4 py-2 rounded ${
              selectedOption === "manual"
                ? "bg-blue-600 text-white"
                : "bg-gray-200"
            }`}
            onClick={() => setSelectedOption("manual")}
          >
            Manual Entry
          </button>
          <button
            className={`px-4 py-2 rounded ${
              selectedOption === "ocr"
                ? "bg-blue-600 text-white"
                : "bg-gray-200"
            }`}
            onClick={() => setSelectedOption("ocr")}
          >
            OCR Upload
          </button>
          <button
            className={`px-4 py-2 rounded ${
              selectedOption === "ai"
                ? "bg-blue-600 text-white"
                : "bg-gray-200"
            }`}
            onClick={() => setSelectedOption("ai")}
          >
            AI Autogen
          </button>
        </div>

        <div>
          {selectedOption === "manual" && <ManualEntryForm />}
          {selectedOption === "ocr" && <OCRUploadForm distributorId={userId} />}
          {selectedOption === "ai" && <AIInventoryForm userId={userId} />}
        </div>
      </div>
    </div>
  );
};

export default AddInventoryOptions;
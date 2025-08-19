import { useState } from "react";
import ManualEntryForm from "./ManualEntryForm";
import OCRUploadForm from "./OCRUploadForm";
import AIInventoryForm from "./AIAutogenForm";

const AddInventoryOptions = ({ userId }) => {
  const [selectedOption, setSelectedOption] = useState("manual");

  // Small helper for tab button styles (clean, low‑chrome)
  const tabBase =
    "px-3 py-1.5 rounded-lg text-sm transition focus:outline-none ring-1 ring-white/10";
  const tabOn  = "bg-emerald-500 text-slate-900 ring-emerald-400/30";
  const tabOff = "bg-white/5 text-white/90 hover:bg-white/10";

  return (
    <div className="text-white">
      {/* Title row – uncomplicated, no extra card */}
      <div className="mb-3">
        <h2 className="text-xl font-semibold">Add Inventory</h2>
      </div>

      {/* Input method selector – a single clean row */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="text-sm text-white/60">Select method:</span>

        <button
          className={`${tabBase} ${selectedOption === "manual" ? tabOn : tabOff}`}
          onClick={() => setSelectedOption("manual")}
        >
          Manual Entry
        </button>

        <button
          className={`${tabBase} ${selectedOption === "ocr" ? tabOn : tabOff}`}
          onClick={() => setSelectedOption("ocr")}
        >
          OCR Upload
        </button>

        <button
          className={`${tabBase} ${selectedOption === "ai" ? tabOn : tabOff}`}
          onClick={() => setSelectedOption("ai")}
        >
          AI Autogen
        </button>
      </div>

      {/* Form area – rendered directly; no nested background panel */}
      <div className="mt-2">
        {selectedOption === "manual" && <ManualEntryForm />}
        {selectedOption === "ocr" && <OCRUploadForm distributorId={userId} />}
        {selectedOption === "ai" && <AIInventoryForm userId={userId} />}
      </div>
    </div>
  );
};

export default AddInventoryOptions;
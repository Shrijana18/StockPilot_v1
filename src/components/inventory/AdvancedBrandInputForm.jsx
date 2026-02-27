import React, { useState, useEffect, useRef, useCallback } from "react";

const Field = React.forwardRef(
  (
    { id, label, value, onChange, onBlur, placeholder, helper, type = "text", as = "input", rows = 3 },
    ref
  ) => {
    const InputTag = as === "textarea" ? "textarea" : "input";
    return (
      <div className="relative w-full">
        <InputTag
          id={id}
          ref={ref}
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          placeholder=" "
          rows={as === "textarea" ? rows : undefined}
          type={as === "textarea" ? undefined : type}
          className="peer w-full rounded-xl bg-white/10 text-white placeholder-transparent border border-white/15 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 px-3 pt-5 pb-2 outline-none transition-colors"
          autoComplete="off"
        />
        <label
          htmlFor={id}
          className="absolute left-3 top-2 text-white/70 text-sm cursor-text transition-all peer-placeholder-shown:top-3.5 peer-placeholder-shown:text-base peer-placeholder-shown:text-white/40 peer-focus:top-2 peer-focus:text-sm peer-focus:text-cyan-400"
        >
          {label}
        </label>
        {helper && (
          <p className="mt-1 text-xs text-white/50 select-none">{helper}</p>
        )}
      </div>
    );
  }
);

Field.displayName = "Field";

const steps = [
  { label: "Brand & Category" },
  { label: "Product Types & Quantity" },
  { label: "Optional Details" },
];

const ProgressTimeline = ({ step = 0 }) => {
  const titles = [
    "Understanding brand",
    "Finding SKUs",
    "Pricing",
    "Taxes & HSN",
    "Building items",
  ];
  const pct = ((step + 1) / titles.length) * 100;
  return (
    <div className="mt-4 select-none" aria-hidden>
      <div className="flex justify-center gap-4 text-xs text-white/70 mb-2">
        {titles.map((t, i) => (
          <span key={t} className={`${i === step ? "text-emerald-300" : ""}`}>{t}</span>
        ))}
      </div>
      <div className="h-1.5 w-full bg-white/10 rounded">
        <div className="h-1.5 bg-gradient-to-r from-emerald-400 via-cyan-300 to-blue-400 rounded transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
};

const AdvancedBrandInputForm = ({ onGenerate }) => {
  // form state
  const [brandName, setBrandName] = useState("");
  const [category, setCategory] = useState("");
  const [productTypes, setProductTypes] = useState("");
  const [quantity, setQuantity] = useState("20");
  const [description, setDescription] = useState("");
  const [skuHint, setSkuHint] = useState("");
  const [regionNote, setRegionNote] = useState("");
  const [promptOverride, setPromptOverride] = useState("");

  // ui state
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [showOptional, setShowOptional] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [progressStep, setProgressStep] = useState(0);

  const topRef = useRef(null);
  const brandRef = useRef(null);
  const categoryRef = useRef(null);
  const productTypesRef = useRef(null);

  // Advance from Step 0 → Step 1 only when both fields are filled and the user finishes typing.
  const maybeAdvanceFromBasics = useCallback(() => {
    const hasBrand = brandName.trim().length > 0;
    const hasCategory = category.trim().length > 0;
    if (currentStep === 0 && hasBrand && hasCategory) {
      setCurrentStep(1);
      // Focus the first field of next step for a smooth flow
      setTimeout(() => productTypesRef.current?.focus(), 0);
    }
  }, [brandName, category, currentStep]);

  // autofocus first field
  useEffect(() => {
    brandRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!loading) return;
    setProgressStep(0);
    const id = setInterval(() => setProgressStep((s) => (s + 1) % 5), 900);
    return () => clearInterval(id);
  }, [loading]);

  // scroll to the top card on generate so user sees the overlay immediately
  const scrollToTop = useCallback(() => {
    const y = (topRef.current?.getBoundingClientRect().top || 0) + window.scrollY - 24;
    window.scrollTo({ top: y, behavior: "smooth" });
  }, []);

  const generatedPrompt = (qty = quantity) =>
    `
CRITICAL: Generate exactly ${qty} products. Every product MUST be from the Brand and Category below only. Do NOT include products from other brands or other categories. All rows must have the same Brand and same Category.

Start the response with the following header row exactly:
| Product Name | Brand | Category | SKU | Unit | HSN | GST (%) | Pricing Mode | Base Price | MRP | Cost |

Rules:
- Unit must include both quantity and container type (e.g., "100ml Bottle", "250g Jar", "50ml Tube").
- HSN must be a realistic 4–8 digit Indian code; if unknown, give your best estimate.
- GST (%) must be one of: 0, 5, 12, 18, 28.
- Pricing Mode must be either:
  - "MRP_INCLUSIVE" → MRP includes GST; Base Price may be blank if unknown.
  - "BASE_PLUS_GST" → Base Price excludes GST; MRP may be blank if unknown.
- If Pricing Mode = MRP_INCLUSIVE and MRP is present but Base Price missing → leave Base Price blank.
- If Pricing Mode = BASE_PLUS_GST and Base Price present but MRP missing → leave MRP blank.
- Cost can be approximate or blank.
- No text above or below the table.

Brand: ${brandName}
Category: ${category}
Known product types/variants (use these to diversify SKUs within the same brand and category): ${productTypes || "any variants within the category"}
SKU Pattern: ${skuHint}
Region Context: ${regionNote}
Additional Notes: ${description}
`.trim();

  const handleGenerate = async () => {
    if (!brandName || !category) {
      alert("Please enter Brand Name and Product Category.");
      return;
    }
    scrollToTop();
    setLoading(true);
    const payload = {
      prompt: promptOverride.trim() || generatedPrompt(),
      brandName,
      category,
      knownTypes: productTypes,
      quantity,
      description,
      skuHint,
      regionNote,
    };
    try {
      await onGenerate(payload);
    } finally {
      setLoading(false);
    }
  };

  // keyboard: Enter to move next, Cmd/Ctrl+Enter to generate
  const handleKeyDown = (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      handleGenerate();
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (currentStep === 0) {
        // Only advance if both basics are present; otherwise focus the missing one
        if (!brandName.trim()) {
          brandRef.current?.focus();
          return;
        }
        if (!category.trim()) {
          categoryRef.current?.focus();
          return;
        }
        setCurrentStep(1);
        setTimeout(() => productTypesRef.current?.focus(), 0);
      } else if (currentStep < steps.length - 1) {
        setCurrentStep(currentStep + 1);
      }
    }
  };

  // Reset form
  const resetForm = () => {
    setBrandName("");
    setCategory("");
    setProductTypes("");
    setQuantity("20");
    setDescription("");
    setSkuHint("");
    setRegionNote("");
    setPromptOverride("");
    setCurrentStep(0);
    setShowOptional(false);
    brandRef.current?.focus();
  };

  return (
    <section
      ref={topRef}
      onKeyDown={handleKeyDown}
      className="relative max-w-3xl mx-auto w-full px-4 sm:px-6 lg:px-8"
    >
      {/* Stepper Progress Bar */}
      <nav aria-label="Progress" className="mb-6">
        <ol className="flex justify-between border border-white/20 rounded-full overflow-hidden">
          {steps.map((step, i) => (
            <li
              key={step.label}
              className={`relative flex-1 flex items-center justify-center py-2 text-sm font-semibold cursor-pointer select-none
                ${
                  i === currentStep
                    ? "bg-cyan-500 text-slate-900"
                    : i < currentStep
                    ? "bg-cyan-400/70 text-slate-900"
                    : "text-white/60 bg-white/5"
                }
                transition-colors`}
              onClick={() => setCurrentStep(i)}
            >
              {step.label}
              {i < steps.length - 1 && (
                <span
                  aria-hidden="true"
                  className={`absolute right-0 top-1/2 -translate-y-1/2 w-4 h-0.5 bg-white/30 ${
                    i < currentStep ? "bg-cyan-400" : ""
                  }`}
                />
              )}
            </li>
          ))}
        </ol>
      </nav>

      {/* Centered Glassmorphic Card */}
      <div className="relative bg-white/5 backdrop-blur-xl rounded-3xl shadow-lg p-8 min-h-[360px] flex flex-col">
        {/* Steps content with fade */}
        <div className="flex-1 relative">
          {/* Step 0: Brand & Category */}
          <div
            aria-hidden={currentStep !== 0}
            className={`absolute inset-0 transition-all duration-500 ease-in-out ${
              currentStep === 0 ? "opacity-100 z-10 translate-y-0" : "opacity-0 pointer-events-none z-0 translate-y-2"
            }`}
          >
          <div className="grid grid-cols-2 gap-6">
            <Field
              id="brandName"
              label="Brand Name"
              value={brandName}
              onChange={(e) => setBrandName(e.target.value)}
              placeholder="Brand Name"
              helper="The manufacturer or brand family."
              ref={brandRef}
              onBlur={maybeAdvanceFromBasics}
            />
            <Field
              id="category"
              label="Product Category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Product Category"
              helper="Broad category for the items."
              ref={categoryRef}
              onBlur={maybeAdvanceFromBasics}
            />
          </div>
          </div>

          {/* Step 1: Product Types & Quantity */}
          <div
            aria-hidden={currentStep !== 1}
            className={`absolute inset-0 transition-all duration-500 ease-in-out ${
              currentStep === 1 ? "opacity-100 z-10 translate-y-0" : "opacity-0 pointer-events-none z-0 translate-y-2"
            }`}
          >
            <div className="grid grid-cols-2 gap-6">
              <Field
                id="productTypes"
                label="Known Product Types"
                value={productTypes}
                onChange={(e) => setProductTypes(e.target.value)}
                placeholder="e.g., Front Load, Cream Biscuit"
                helper="Comma-separated types help AI diversify SKUs."
                ref={productTypesRef}
              />
              <div className="relative w-full">
                <input
                  id="quantity"
                  type="number"
                  min={6}
                  max={50}
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder=" "
                  className="peer w-full rounded-xl bg-white/10 text-white placeholder-transparent border border-white/20 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 px-3 pt-5 pb-2 outline-none transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <label
                  htmlFor="quantity"
                  className="absolute left-3 top-2 text-white/70 text-sm cursor-pointer transition-all peer-focus:top-2 peer-focus:text-sm peer-focus:text-cyan-400 peer-placeholder-shown:top-3.5 peer-placeholder-shown:text-base peer-placeholder-shown:text-white/40"
                >
                  Quantity of Products
                </label>
                <p className="mt-1 text-xs text-white/50 select-none">
                  How many rows the AI should return (6–50). Enter any number.
                </p>
              </div>
            </div>
          </div>

          {/* Step 2: Optional Details */}
          <div
            aria-hidden={currentStep !== 2}
            className={`absolute inset-0 transition-all duration-500 ease-in-out ${
              currentStep === 2 ? "opacity-100 z-10 translate-y-0" : "opacity-0 pointer-events-none z-0 translate-y-2"
            } flex flex-col`}
          >
            <button
              type="button"
              onClick={() => setShowOptional(!showOptional)}
              className="mb-4 self-start px-4 py-2 rounded-full border border-white/20 text-white/70 hover:bg-white/10 transition select-none"
              aria-expanded={showOptional}
              aria-controls="optional-details"
            >
              {showOptional ? "Hide Optional Details" : "Show Optional Details"}
            </button>
            <div
              id="optional-details"
              className={`overflow-hidden transition-[max-height,opacity] duration-500 ease-in-out ${
                showOptional ? "max-h-[1000px] opacity-100" : "max-h-0 opacity-0"
              }`}
            >
              <Field
                id="description"
                label="Brand Description (optional)"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Short context about brand, lines, audience…"
                helper="Any marketing or positioning hints."
                as="textarea"
                rows={3}
              />
              <Field
                id="skuHint"
                label="SKU Pattern (optional)"
                value={skuHint}
                onChange={(e) => setSkuHint(e.target.value)}
                placeholder="e.g., RL-TEA-*, SMG-WM-*"
                helper="Let AI follow your SKU conventions."
              />
              <Field
                id="regionNote"
                label="Region Context (optional)"
                value={regionNote}
                onChange={(e) => setRegionNote(e.target.value)}
                placeholder="e.g., Popular only in Gujarat"
                helper="Helps AI localize HSN & pricing expectations."
              />
            </div>
          </div>
        </div>

        {/* Magic Generate Button */}
        <div className="mt-6">
          {!loading ? (
            <button
              type="button"
              onClick={handleGenerate}
              className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-cyan-400 to-blue-400 text-slate-900 font-semibold shadow-lg hover:shadow-cyan-500/30 active:scale-[0.99] transition"
            >
              <span aria-hidden>✨</span>
              Magic Generate
            </button>
          ) : (
            <div className="w-full rounded-2xl border border-white/10 bg-slate-900/70 p-5 backdrop-blur-md">
              <div className="mx-auto w-64 h-16 relative">
                {Array.from({ length: 20 }).map((_, i) => (
                  <span
                    key={i}
                    className="absolute bottom-0 w-2 bg-emerald-400/80 rounded-t origin-bottom animate-[bar_1.6s_ease-in-out_infinite]"
                    style={{ left: `${i * 12}px`, height: `${8 + Math.random() * 64}px`, animationDelay: `${i * 60}ms` }}
                  />
                ))}
              </div>
              <div className="mt-3 text-center text-emerald-200 font-medium" aria-live="polite">
                Creating inventory…
              </div>
              <ProgressTimeline step={progressStep} />
            </div>
          )}

          <button
            type="button"
            onClick={resetForm}
            className="mt-3 w-full px-5 py-3 rounded-xl border border-white/20 text-white/70 hover:bg-white/10 transition select-none"
            disabled={loading}
          >
            Reset
          </button>
        </div>
      </div>

      {/* Prompt Preview Toggle */}
      <div className="fixed bottom-6 right-6 z-50">
        <button
          type="button"
          onClick={() => setShowPreview((s) => !s)}
          className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 text-white/90 hover:bg-white/20 backdrop-blur-sm transition select-none"
          aria-expanded={showPreview}
          aria-controls="prompt-preview-panel"
        >
          <span className="text-xl">✨</span> {showPreview ? "Hide AI Prompt" : "Show AI Prompt"}
        </button>
      </div>

      {/* Prompt Preview Panel */}
      {showPreview && (
        <aside
          id="prompt-preview-panel"
          className="fixed top-20 right-6 bottom-6 w-[360px] bg-slate-950/90 backdrop-blur-lg rounded-3xl p-4 shadow-lg overflow-auto text-emerald-200 font-mono text-xs leading-relaxed z-40"
        >
          <textarea
            readOnly
            value={promptOverride.trim() || generatedPrompt()}
            className="w-full h-full bg-transparent resize-none border-none outline-none text-emerald-300"
          />
        </aside>
      )}

      {/* Non-blocking overlay while loading */}
      {loading && (
        <div className="pointer-events-none fixed inset-0 z-[60] grid place-items-center bg-black/40">
          <div className="rounded-2xl px-6 py-5 bg-slate-900/80 border border-white/10 shadow-2xl">
            <div className="flex items-center gap-3 text-cyan-200">
              <span className="h-4 w-4 rounded-full border-2 border-cyan-300 border-t-transparent animate-spin" />
              <span className="font-semibold">Creating inventory…</span>
            </div>
          </div>
        </div>
      )}

      {/* Decorative background particles (subtle, performant) */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-3xl">
        {Array.from({ length: 18 }).map((_, i) => (
          <span
            key={i}
            className="absolute block w-1 h-1 bg-cyan-300/30 rounded-full animate-twinkle"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${i * 0.6}s`,
            }}
          />
        ))}
      </div>
      <style>{`
        @keyframes bar { 0%,100%{transform:scaleY(.3)} 50%{transform:scaleY(1)} }
        @keyframes twinkle { 0%,100%{opacity:.2; transform:translateY(0)} 50%{opacity:.9; transform:translateY(-1px)} }
        .animate-twinkle{ animation: twinkle 3.6s ease-in-out infinite; }
      `}</style>
    </section>
  );
};

export default AdvancedBrandInputForm;
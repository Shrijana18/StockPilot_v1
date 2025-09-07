import React from "react";

/**
 * PANELS — UI-only pieces used by FastBillingMode.
 * Polished visuals + tiny a11y upgrades (no logic changes).
 *
 * - SuggestionPanel: list picker for products/customers/intents
 * - CustomerCard: compact selected-customer summary
 * - SplitPaymentModal: edit split amounts (cash/upi/card)
 * - CreditTermsModal: choose credit due days/date
 */

// ---------- Tiny UI atoms ----------
function Kbd({ children }) {
  return (
    <kbd className="inline-flex items-center px-1.5 py-[2px] rounded-md border border-white/20 bg-white/10 text-[10px] leading-none">
      {children}
    </kbd>
  );
}

function SectionTitle({ children, hint }) {
  return (
    <div className="flex items-center justify-between mb-2">
      <h3 className="text-base font-medium opacity-90" id="panel-title">{children}</h3>
      {hint && <div className="text-[11px] opacity-60">{hint}</div>}
    </div>
  );
}

// ---------------------- SuggestionPanel ----------------------
export function SuggestionPanel({
  title = "Did you mean…?",
  suggestions = [], // [{ key, label, sublabel, price?, onPick } | { key, displayName, unit, brand, sku, price?, add }]
  onPick = () => {},
  onDismiss = () => {},
  hints = [
    { k: 'Say', v: '“add 2 colgate 100g”' },
    { k: 'Qty', v: '“set quantity 3”' },
    { k: 'GST', v: '“gst 12%”' },
  ],
}) {
  React.useEffect(() => {
    const onKey = (e) => {
      if (!suggestions || suggestions.length === 0) return;
      if (e.key === "Escape") { e.preventDefault(); onDismiss?.(); return; }
      if (e.key === "Enter") {
        e.preventDefault();
        const s = suggestions[0];
        if (!s) return;
        if (typeof s.onPick === "function") s.onPick(s);
        else if (typeof onPick === "function" && s.onPick == null && typeof s.add !== "function") onPick(s);
        else s.add?.();
        return;
      }
      if (/^[1-9]$/.test(e.key)) {
        const idx = parseInt(e.key, 10) - 1;
        const s = suggestions[idx];
        if (!s) return;
        e.preventDefault();
        if (typeof s.onPick === "function") s.onPick(s);
        else if (typeof onPick === "function" && s.onPick == null && typeof s.add !== "function") onPick(s);
        else s.add?.();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [suggestions, onPick, onDismiss]);

  if (!suggestions || suggestions.length === 0) return null;
  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center" role="dialog" aria-modal="true" aria-labelledby="panel-title">
      <div className="absolute inset-0 backdrop-blur-[2px] bg-black/60" onClick={onDismiss} />
      <div className="relative z-10 w-full sm:max-w-xl mx-auto rounded-2xl border border-white/10 bg-neutral-900/95 p-4 shadow-2xl animate-in fade-in slide-in-from-bottom-2">
        <SectionTitle hint={<span className="hidden sm:inline">Press <Kbd>1</Kbd>-<Kbd>9</Kbd> or <Kbd>Enter</Kbd></span>}>{title}</SectionTitle>

        {/* Quick voice hints */}
        {hints && hints.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {hints.map((h, i) => (
              <span key={i} className="text-[11px] px-2 py-1 rounded-full bg-white/5 border border-white/10 text-white/80">
                <span className="opacity-60 mr-1">{h.k}:</span>{h.v}
              </span>
            ))}
          </div>
        )}

        <ul className="space-y-2 max-h-72 overflow-auto pr-1">
          {(suggestions ?? []).map((s, i) => {
            const label = s.label ?? s.displayName ?? "—";
            const subParts = [];
            if (s.sublabel) subParts.push(s.sublabel);
            else {
              if (s.unit) subParts.push(s.unit);
              const brandSku = [s.brand, s.sku].filter(Boolean).join(" • ");
              if (brandSku) subParts.push(brandSku);
            }
            const sublabel = subParts.join(" · ");
            const price = typeof s.price === "number" ? s.price : undefined;
            const onChoose = () => {
              if (typeof s.onPick === "function") return s.onPick(s);
              if (typeof onPick === "function" && s.onPick == null && typeof s.add !== "function") return onPick(s);
              return s.add?.();
            };
            return (
              <li key={s.key ?? s.id ?? i}>
                <button
                  type="button"
                  onClick={onChoose}
                  className="group w-full text-left px-3 py-2 rounded-lg border border-white/10 bg-neutral-800/70 hover:bg-neutral-800 transition-colors"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm opacity-90 truncate">{label}</div>
                      {sublabel && <div className="text-xs opacity-60 mt-0.5 truncate">{sublabel}</div>}
                      {price != null && <div className="text-xs text-emerald-300 mt-0.5">₹{price.toFixed(2)}</div>}
                    </div>
                    <span className="text-[10px] opacity-60 border border-white/10 rounded px-1 py-0.5">{i < 9 ? i + 1 : ''}</span>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>

        <div className="mt-3 text-[11px] opacity-60 flex items-center justify-between">
          <div>Tip: press <Kbd>Esc</Kbd> to dismiss</div>
          <div className="hidden sm:block">Voice picks still work while open</div>
        </div>
      </div>
    </div>
  );
}

// ---------------------- CustomerCard ----------------------
export function CustomerCard({ customer, onClear = () => {} }) {
  if (!customer) return null;
  const name = customer.name || customer.displayName || "Customer";
  const phone = customer.phone || customer.mobile || customer.contact || "";
  const email = customer.email || "";

  // Fallback initials without extra helpers
  const initials = String(name)
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3 shadow-inner">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-full bg-emerald-600/30 text-emerald-200 flex items-center justify-center text-sm font-semibold">
            {initials}
          </div>
          <div className="min-w-0">
            <div className="text-sm font-medium text-emerald-100 flex items-center gap-2 min-w-0">
              <span className="truncate max-w-[220px]">{name}</span>
              {customer?.isDraft && (
                <span className="px-2 py-0.5 text-[10px] rounded-full bg-amber-500/15 border border-amber-400/30 text-amber-200 shrink-0">
                  Will create on save
                </span>
              )}
            </div>
            <div className="text-xs opacity-80 truncate">
              {phone && <span className="mr-2">{phone}</span>}
              {email && <span>{email}</span>}
            </div>
            {customer.address && (
              <div className="text-xs opacity-70 mt-0.5 truncate">{customer.address}</div>
            )}
            <div className="text-[11px] opacity-60 mt-0.5">ID: {customer.id || customer.custId || "—"}</div>
          </div>
        </div>
        <button onClick={onClear} className="text-xs px-2 py-1 rounded-md border border-emerald-500/40 text-emerald-200 hover:bg-emerald-500/10">
          Clear
        </button>
      </div>
    </div>
  );
}

// ---------------------- SplitPaymentModal ----------------------
export function SplitPaymentModal({
  open = false,
  total = 0,
  initial = { cash: 0, upi: 0, card: 0 },
  onApply = () => {},
  onClose = () => {},
}) {
  const [cash, setCash] = React.useState(initial.cash || 0);
  const [upi, setUpi] = React.useState(initial.upi || 0);
  const [card, setCard] = React.useState(initial.card || 0);

  React.useEffect(() => {
    setCash(initial.cash || 0);
    setUpi(initial.upi || 0);
    setCard(initial.card || 0);
  }, [open]);

  if (!open) return null;
  const sum = (Number(cash) || 0) + (Number(upi) || 0) + (Number(card) || 0);
  const diff = Math.round((Number(total) - sum) * 100) / 100;
  const pct = Math.max(0, Math.min(100, total ? (sum / total) * 100 : 0));

  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center" role="dialog" aria-modal="true" aria-labelledby="split-title">
      <div className="absolute inset-0 backdrop-blur-[1px] bg-black/60" onClick={onClose} />
      <div className="relative z-10 w-full sm:max-w-md mx-auto rounded-2xl border border-white/10 bg-neutral-900/95 p-4 shadow-2xl animate-in fade-in slide-in-from-bottom-2">
        <div className="flex items-center justify-between mb-3">
          <h3 id="split-title" className="text-base font-medium opacity-90">Split Payment</h3>
          <button className="text-sm opacity-70 hover:opacity-100" onClick={onClose}>Close</button>
        </div>
        <div className="space-y-3">
          <Field label="Cash" value={cash} onChange={setCash} />
          <Field label="UPI" value={upi} onChange={setUpi} />
          <Field label="Card" value={card} onChange={setCard} />
        </div>
        {/* progress bar */}
        <div className="mt-3">
          <div className="h-1.5 rounded bg-white/10 overflow-hidden">
            <div className="h-full bg-emerald-500/70" style={{ width: pct + "%" }} />
          </div>
        </div>
        <div className="mt-3 text-sm opacity-80">
          Total: <span className="opacity-100">₹{Number(total || 0).toFixed(2)}</span>
          <span className={`ml-2 ${diff === 0 ? "text-emerald-400" : diff > 0 ? "text-yellow-400" : "text-red-400"}`}>
            {diff === 0 ? "(balanced)" : diff > 0 ? `(₹${diff.toFixed(2)} remaining)` : `(₹${Math.abs(diff).toFixed(2)} over)`}
          </span>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1.5 rounded-lg border border-white/10 bg-neutral-800/70">Cancel</button>
          <button
            onClick={() => onApply({ cash: Number(cash)||0, upi: Number(upi)||0, card: Number(card)||0 })}
            className="px-3 py-1.5 rounded-lg border border-emerald-500/50 bg-emerald-600/80 hover:bg-emerald-600"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange }) {
  return (
    <label className="block">
      <span className="text-xs opacity-70">{label}</span>
      <input
        type="number"
        inputMode="decimal"
        className="mt-1 w-full px-3 py-2 rounded-lg bg-neutral-800/70 border border-white/10 outline-none focus:ring-2 focus:ring-emerald-400/30"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

// ---------------------- CreditTermsModal ----------------------
export function CreditTermsModal({
  open = false,
  initial = { days: "", date: "" }, // one of these can be used
  onApply = () => {},
  onClose = () => {},
}) {
  const [days, setDays] = React.useState(initial.days || "");
  const [date, setDate] = React.useState(initial.date || "");

  React.useEffect(() => {
    setDays(initial.days || "");
    setDate(initial.date || "");
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center" role="dialog" aria-modal="true" aria-labelledby="credit-title">
      <div className="absolute inset-0 backdrop-blur-[1px] bg-black/60" onClick={onClose} />
      <div className="relative z-10 w-full sm:max-w-md mx-auto rounded-2xl border border-white/10 bg-neutral-900/95 p-4 shadow-2xl animate-in fade-in slide-in-from-bottom-2">
        <div className="flex items-center justify-between mb-3">
          <h3 id="credit-title" className="text-base font-medium opacity-90">Credit Terms</h3>
          <button className="text-sm opacity-70 hover:opacity-100" onClick={onClose}>Close</button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="block col-span-1">
            <span className="text-xs opacity-70">Days</span>
            <input
              type="number"
              className="mt-1 w-full px-3 py-2 rounded-lg bg-neutral-800/70 border border-white/10 outline-none focus:ring-2 focus:ring-emerald-400/30"
              value={days}
              onChange={(e) => setDays(e.target.value)}
              placeholder="e.g., 15"
            />
          </label>
          <label className="block col-span-1">
            <span className="text-xs opacity-70">Due Date</span>
            <input
              type="date"
              className="mt-1 w-full px-3 py-2 rounded-lg bg-neutral-800/70 border border-white/10 outline-none focus:ring-2 focus:ring-emerald-400/30"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1.5 rounded-lg border border-white/10 bg-neutral-800/70">Cancel</button>
          <button
            onClick={() => onApply({ days: days ? Number(days) : undefined, date: date || undefined })}
            className="px-3 py-1.5 rounded-lg border border-emerald-500/50 bg-emerald-600/80 hover:bg-emerald-600"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}

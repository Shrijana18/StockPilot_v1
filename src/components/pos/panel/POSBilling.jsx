import React from "react";
import { motion, AnimatePresence } from "framer-motion";

/**
 * POSBilling
 * ------------------------------------------------------------
 * A clean, modern, and high‑performance billing workspace built to
 * plug into your **existing dashboard logic** without breaking anything.
 *
 * Integration contract (all optional, but recommended):
 * props.inventory: {
 *   searchProducts: (q: string) => Promise<Product[]>,
 *   listByCategory?: (categoryId: string) => Promise<Product[]>,
 *   listPopular?: (limit?: number) => Promise<Product[]>,
 *   listCategories?: () => Promise<Category[]>
 * }
 * props.billing: {
 *   calcTotals?: (cart: CartLine[]) => Totals,   // if omitted, uses local calculator
 *   createInvoice: (payload: InvoiceDraft) => Promise<{ id: string }>
 * }
 * props.mode: 'retail' | 'cafe' (enables Menu section for cafe/restro)
 * props.onBack?: () => void
 * props.onInvoiceSaved?: (id: string) => void
 *
 * NOTE: Wire these to your existing dashboard services to keep logic identical.
 */

// ——— Types (JSDoc for editor intellisense)
/** @typedef {{ id: string, name: string, sku?: string, price: number, taxRate?: number, img?: string, categoryId?: string }} Product */
/** @typedef {{ id: string, name: string }} Category */
/** @typedef {{ product: Product, qty: number, discount?: number }} CartLine */
/** @typedef {{ subTotal: number, tax: number, discount: number, grandTotal: number }} Totals */
/** @typedef {{ lines: CartLine[], totals: Totals, payments: {method: string, amount: number}[], meta?: any }} InvoiceDraft */

const money = (n) => (n ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function localCalcTotals(lines /** @type {CartLine[]} */) {
  let sub = 0, tax = 0, disc = 0;
  for (const l of lines) {
    const line = (l.product.price * l.qty) - (l.discount ?? 0);
    sub += Math.max(line, 0);
    tax += ((l.product.taxRate ?? 0) / 100) * (l.product.price * l.qty);
    disc += (l.discount ?? 0);
  }
  return { subTotal: sub, tax, discount: disc, grandTotal: sub + tax };
}

export default function POSBilling({ inventory = {}, billing = {}, mode = "retail", onBack, onInvoiceSaved }) {
  const [q, setQ] = React.useState("");
  const [results, setResults] = React.useState(/** @type {Product[]} */([]));
  const [loading, setLoading] = React.useState(false);
  const [cart, setCart] = React.useState(/** @type {CartLine[]} */([]));
  const [categories, setCategories] = React.useState(/** @type {Category[]} */([]));
  const [activeCat, setActiveCat] = React.useState(/** @type {string|undefined} */(undefined));
  const [saving, setSaving] = React.useState(false);
  const [notice, setNotice] = React.useState("");

  // Retail vs Cafe/Restro: Inventory browse vs Menu builder
  const [useInventory, setUseInventory] = React.useState(mode !== "cafe");
  const [menuDraft, setMenuDraft] = React.useState({ name: "", price: "", taxRate: "", category: "" });
  const [menuLibrary, setMenuLibrary] = React.useState([]); // local quick buttons for custom items
  // Hidden products state
  const [hiddenProducts, setHiddenProducts] = React.useState(() => {
    const stored = window.localStorage.getItem("pos-hidden-products");
    if (stored) {
      try {
        return new Set(JSON.parse(stored));
      } catch {
        return new Set();
      }
    }
    return new Set();
  });
  // Show hidden products toggle
  const [showHidden, setShowHidden] = React.useState(false);
  // Menu full listing state
  const [menuItems, setMenuItems] = React.useState([]);

  const totals = (billing.calcTotals || localCalcTotals)(cart);

  // Load initial suggestions (popular items or empty)
  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        if (useInventory && inventory.listPopular) {
          const pop = await inventory.listPopular(24);
          if (alive) setResults(pop || []);
        }
        if (mode === "cafe" && useInventory && inventory.listCategories) {
          const cats = await inventory.listCategories();
          if (alive) setCategories(cats || []);
        }
      } catch (_) {}
    })();
    return () => {
      alive = false;
    };
  }, [mode, useInventory]);

  // Load menu full listing (for Menu mode)
  React.useEffect(() => {
    if (!useInventory) {
      // If menuLibrary already has items, use them
      setMenuItems(menuLibrary);
      // If menuLibrary is empty, try to get from props if available
      // (Assume inventory.menuLibrary or billing.menuLibrary)
      if ((!menuLibrary || menuLibrary.length === 0) && (inventory.menuLibrary || billing.menuLibrary)) {
        setMenuItems(inventory.menuLibrary || billing.menuLibrary || []);
      }
    }
  }, [useInventory, menuLibrary, inventory.menuLibrary, billing.menuLibrary]);

  // Search products (inventory mode only)
  async function doSearch(text) {
    setQ(text);
    if (!useInventory) return; // disabled in Menu mode
    if (!text) return;
    if (!inventory.searchProducts) return;
    setLoading(true);
    try {
      const r = await inventory.searchProducts(text);
      setResults(r || []);
    } finally {
      setLoading(false);
    }
  }

  // Category filter (cafe, inventory mode only)
  async function pickCategory(catId) {
    if (!useInventory) return;
    setActiveCat(catId);
    if (inventory.listByCategory) {
      setLoading(true);
      try {
        const r = await inventory.listByCategory(catId);
        setResults(r || []);
      } finally {
        setLoading(false);
      }
    }
  }

  function addToCart(p /** @type {Product} */) {
    setCart(prev => {
      const i = prev.findIndex(l => l.product.id === p.id);
      if (i >= 0) {
        const copy = [...prev];
        copy[i] = { ...copy[i], qty: copy[i].qty + 1 };
        return copy;
      }
      return [...prev, { product: p, qty: 1 }];
    });
    setNotice(`${p.name} added`);
    setTimeout(() => setNotice(""), 1200);
  }

  function decQty(pid) {
    setCart(prev => prev.map(l => l.product.id === pid ? { ...l, qty: Math.max(1, l.qty - 1) } : l));
  }
  function incQty(pid) {
    setCart(prev => prev.map(l => l.product.id === pid ? { ...l, qty: l.qty + 1 } : l));
  }
  function removeLine(pid) {
    setCart(prev => prev.filter(l => l.product.id !== pid));
  }

  async function checkout() {
    if (!billing.createInvoice) { alert("createInvoice() not wired to dashboard yet"); return; }
    setSaving(true);
    try {
      /** @type {InvoiceDraft} */
      const payload = { lines: cart, totals, payments: [] };
      const { id } = await billing.createInvoice(payload);
      setCart([]);
      setNotice("Invoice saved");
      onInvoiceSaved && onInvoiceSaved(id);
    } catch (e) {
      console.error(e);
      alert("Failed to save invoice");
    } finally { setSaving(false); }
  }

  function addMenuDraftToCart() {
    const name = menuDraft.name?.trim();
    const priceNum = parseFloat(String(menuDraft.price).replace(/[^0-9.]/g, "")) || 0;
    const taxNum = parseFloat(String(menuDraft.taxRate).replace(/[^0-9.]/g, "")) || 0;
    if (!name || priceNum <= 0) return alert("Enter item name and price");
    const product = {
      id: `menu-${Date.now()}`,
      name,
      price: priceNum,
      taxRate: taxNum,
      categoryId: menuDraft.category || undefined,
    };
    addToCart(product);
    // store in quick library
    setMenuLibrary((prev) => {
      const exists = prev.find((m) => m.name === name && m.price === priceNum && m.taxRate === taxNum);
      if (exists) return prev;
      return [{ name, price: priceNum, taxRate: taxNum, category: menuDraft.category || "" }, ...prev].slice(0, 12);
    });
    setMenuDraft({ name: "", price: "", taxRate: menuDraft.taxRate, category: menuDraft.category });
  }

  function addMenuQuick(m) {
    const product = {
      id: `menu-${Date.now()}`,
      name: m.name,
      price: m.price,
      taxRate: m.taxRate || 0,
      categoryId: m.category || undefined,
    };
    addToCart(product);
  }

  // Hide/unhide handler
  function toggleProductHidden(pid) {
    setHiddenProducts(prev => {
      const next = new Set(prev);
      if (next.has(pid)) next.delete(pid);
      else next.add(pid);
      window.localStorage.setItem("pos-hidden-products", JSON.stringify(Array.from(next)));
      return next;
    });
  }

  // Advanced card border
  const cardGradient = "border-2 border-transparent bg-clip-padding bg-gradient-to-br from-emerald-100/60 to-cyan-100/40 hover:from-emerald-200/90 hover:to-cyan-200/80";
  const cardBorderGradient = "border bg-gradient-to-br from-emerald-300/60 to-cyan-300/40";

  // Animation variants
  const fadeVariants = {
    initial: { opacity: 0, y: 18 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -18 },
    transition: { duration: 0.22 }
  };

  // Filtered results for inventory (respect hiddenProducts unless showHidden)
  const visibleResults = React.useMemo(() => {
    if (showHidden) return results;
    return results.filter(p => !hiddenProducts.has(p.id));
  }, [results, hiddenProducts, showHidden]);

  // Filtered menu items (for menu full listing)
  const menuFullList = React.useMemo(() => {
    if (!menuItems || menuItems.length === 0) return [];
    // menuItems may not have id, so use name+price as key
    return menuItems;
  }, [menuItems]);

  return (
    <div className="relative h-[calc(100vh-140px)]">
      {/* Top bar */}
      <div className="sticky top-0 z-30 bg-white/80 dark:bg-slate-900/80 backdrop-blur border-b border-slate-200 dark:border-slate-800">
        <div className="px-4 py-3 flex gap-2 items-center">
          <button
            onClick={onBack}
            className="rounded-lg bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 text-slate-900 px-4 py-2 text-sm font-semibold shadow hover:shadow-lg"
          >← Back</button>
          <h2 className="text-lg font-semibold">Billing POS</h2>
          <div className="flex-1" />
          <button
            onClick={checkout}
            disabled={!cart.length || saving}
            className="rounded-lg px-4 py-2 text-sm font-semibold border hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
          >{saving ? 'Saving…' : 'Checkout'}</button>
        </div>
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] h-[calc(100%-56px)]">
        {/* Left: products & search */}
        <div className="border-r border-slate-200 dark:border-slate-800 overflow-y-auto">
          <div className="p-4 space-y-3">
            {/* Mode switch: Inventory vs Menu */}
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs uppercase tracking-wide text-slate-500">Mode</span>
              <div className="inline-flex rounded-xl border overflow-hidden">
                <button
                  onClick={() => setUseInventory(true)}
                  className={`px-3 py-1.5 text-sm ${useInventory ? 'bg-emerald-400/20 text-emerald-900 dark:text-emerald-200' : 'hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                >Inventory</button>
                <button
                  onClick={() => setUseInventory(false)}
                  className={`px-3 py-1.5 text-sm ${!useInventory ? 'bg-emerald-400/20 text-emerald-900 dark:text-emerald-200' : 'hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                >Menu</button>
              </div>
              {/* Show Hidden toggle */}
              <button
                onClick={() => setShowHidden(v => !v)}
                className={`ml-4 px-3 py-1.5 text-xs rounded-xl border font-semibold ${showHidden ? "bg-cyan-400/30 text-cyan-900 dark:text-cyan-200 border-cyan-300" : "hover:bg-slate-50 dark:hover:bg-slate-800"}`}
                type="button"
              >
                {showHidden ? "Showing Hidden" : "Show Hidden"}
              </button>
            </div>
            <AnimatePresence mode="wait" initial={false}>
              {useInventory ? (
                <motion.div
                  key="inventory-section"
                  {...fadeVariants}
                  className=""
                >
                  {/* Section header */}
                  <div className="mb-1">
                    <h3 className="text-base font-bold tracking-tight bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-500 bg-clip-text text-transparent drop-shadow mb-2">Inventory</h3>
                  </div>
                  {/* Search */}
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg text-slate-400 pointer-events-none select-none">🔍</span>
                      <input
                        value={q}
                        onChange={(e) => doSearch(e.target.value)}
                        placeholder="Scan barcode or search products"
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-800/70 backdrop-blur px-9 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-300/40 transition-all"
                        style={{ boxShadow: "0 2px 18px 0 rgba(16, 185, 129, 0.06)" }}
                      />
                    </div>
                    <button onClick={() => { setQ(""); setResults([]); }} className="rounded-xl border px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-800">Clear</button>
                  </div>

                  {/* Cafe categories (inventory) */}
                  {mode === 'cafe' && !!categories.length && (
                    <div className="flex gap-2 overflow-x-auto no-scrollbar pt-1">
                      {categories.map(c => {
                        // Pick an emoji or fallback
                        const icons = ["🍔", "🥤", "🍕", "🍟", "🍜", "🍱", "🍩", "🥗", "🍰", "🍛", "☕️", "🍣", "🍲", "🍦"];
                        const icon = c.icon || icons[(c.id?.length || 0) % icons.length] || "🍴";
                        // Gradient colors for category chips
                        const gradients = [
                          "from-pink-400 via-fuchsia-500 to-indigo-400",
                          "from-orange-400 via-yellow-400 to-lime-400",
                          "from-cyan-400 via-teal-400 to-emerald-400",
                          "from-purple-400 via-blue-400 to-green-400",
                          "from-rose-400 via-pink-400 to-violet-400"
                        ];
                        const grad = gradients[(c.id?.length || 0) % gradients.length];
                        return (
                          <button
                            key={c.id}
                            onClick={() => pickCategory(c.id)}
                            className={`flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-semibold transition-all
                              bg-gradient-to-r ${grad} text-white shadow-md border-0
                              ${activeCat === c.id ? "ring-2 ring-emerald-400/80 scale-105" : "opacity-90 hover:opacity-100 hover:shadow-lg"}
                            `}
                            style={{ boxShadow: activeCat === c.id ? "0 0 0 3px rgba(16,185,129,0.19)" : undefined }}
                          >
                            <span className="text-base mr-1">{icon}</span>
                            {c.name}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Results grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 mt-2">
                    <AnimatePresence>
                      {visibleResults.map(p => {
                        const displayName = p.productName || p.name || "Unnamed";
                        const displayPrice = p.mrp || p.sellingPrice || p.basePrice || p.price || 0;
                        const displayImg = p.imageUrl || p.img;
                        // Find category name if available
                        const catObj = categories?.find?.(c => c.id === p.categoryId);
                        const catName = catObj?.name || "";
                        // Category icon
                        const icons = ["🍔", "🥤", "🍕", "🍟", "🍜", "🍱", "🍩", "🥗", "🍰", "🍛", "☕️", "🍣", "🍲", "🍦"];
                        const icon = catObj?.icon || icons[(p.categoryId?.length || 0) % icons.length] || "🍴";
                        return (
                          <motion.div
                            key={p.id}
                            layout
                            initial={{ opacity: 0, scale: 0.96, y: 24 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.92, y: -24 }}
                            transition={{ duration: 0.18 }}
                            whileHover={{
                              scale: 1.04,
                              boxShadow: "0 8px 48px 0 rgba(16, 185, 129, 0.22)",
                              background: "linear-gradient(120deg,rgba(16,185,129,0.10),rgba(6,182,212,0.10))"
                            }}
                            className={`group rounded-2xl border-2 border-transparent bg-white/70 dark:bg-slate-800/70 backdrop-blur p-3 text-left relative flex flex-col transition-all`}
                            style={{
                              borderImage: "linear-gradient(120deg,#34d399 30%,#06b6d4 70%) 1",
                              boxShadow: "0 2px 18px 0 rgba(16, 185, 129, 0.08)"
                            }}
                          >
                            {displayImg ? (
                              <img src={displayImg} alt={displayName} className="w-full h-32 object-cover rounded-xl mb-2 shadow-sm" />
                            ) : (
                              <div className="w-full h-32 rounded-xl bg-gradient-to-br from-emerald-400/10 to-cyan-400/10 mb-2 flex items-center justify-center text-3xl text-slate-300">{icon}</div>
                            )}
                            <div className="mt-1 text-base font-semibold line-clamp-2 relative z-10">{displayName}</div>
                            <div className="text-xs text-slate-600 dark:text-slate-300 relative z-10">₹ {money(displayPrice)}</div>
                            {catName && (
                              <div className="flex items-center gap-1 text-xs text-slate-400 mt-1">
                                <span>{icon}</span>
                                <span>{catName}</span>
                              </div>
                            )}
                            <div className="flex-1" />
                            <div className="flex items-center justify-between mt-2">
                              <button
                                onClick={() => addToCart(p)}
                                className="rounded-lg bg-gradient-to-r from-emerald-400 via-teal-200 to-cyan-300 text-slate-900 px-3 py-1.5 text-xs font-semibold shadow hover:shadow-lg z-10 transition-all"
                                type="button"
                              >Add to Cart</button>
                              {/* Hide/Unhide toggle */}
                              <button
                                onClick={e => { e.stopPropagation(); toggleProductHidden(p.id); }}
                                className={`ml-1 px-2 py-1 text-xs rounded border shadow-sm bg-white/80 dark:bg-slate-900/80
                                  ${hiddenProducts.has(p.id) ? "border-rose-300 text-rose-600" : "border-emerald-200 text-emerald-700"}
                                `}
                                type="button"
                              >
                                {hiddenProducts.has(p.id) ? "Unhide" : "Hide"}
                              </button>
                            </div>
                            {showHidden && hiddenProducts.has(p.id) && (
                              <span className="absolute top-2 left-2 px-2 py-1 text-xs bg-rose-100 text-rose-700 rounded font-semibold z-20">Hidden</span>
                            )}
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>
                    {!loading && !visibleResults.length && (
                      <div className="col-span-full text-sm text-slate-500">No products. Try a search.</div>
                    )}
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="menu-section"
                  {...fadeVariants}
                  className=""
                >
                  {/* Section header */}
                  <div className="mb-1">
                    <h3 className="text-base font-bold tracking-tight bg-gradient-to-r from-cyan-500 via-emerald-400 to-teal-500 bg-clip-text text-transparent drop-shadow mb-2">Menu</h3>
                  </div>
                  {/* Menu Builder (no inventory) */}
                  <div className="rounded-2xl border p-3 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <input
                        value={menuDraft.name}
                        onChange={(e) => setMenuDraft({ ...menuDraft, name: e.target.value })}
                        placeholder="Item name (e.g., Cappuccino)"
                        className="rounded-xl border px-3 py-2 text-sm bg-white dark:bg-slate-900"
                      />
                      <input
                        value={menuDraft.category}
                        onChange={(e) => setMenuDraft({ ...menuDraft, category: e.target.value })}
                        placeholder="Category (optional)"
                        className="rounded-xl border px-3 py-2 text-sm bg-white dark:bg-slate-900"
                      />
                      <input
                        value={menuDraft.price}
                        onChange={(e) => setMenuDraft({ ...menuDraft, price: e.target.value })}
                        placeholder="Price"
                        className="rounded-xl border px-3 py-2 text-sm bg-white dark:bg-slate-900"
                      />
                      <input
                        value={menuDraft.taxRate}
                        onChange={(e) => setMenuDraft({ ...menuDraft, taxRate: e.target.value })}
                        placeholder="Tax % (optional)"
                        className="rounded-xl border px-3 py-2 text-sm bg-white dark:bg-slate-900"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button onClick={addMenuDraftToCart} className="rounded-xl bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 text-slate-900 px-4 py-2 text-sm font-semibold shadow hover:shadow-lg">Add to cart</button>
                      <button onClick={() => setMenuDraft({ name: "", price: "", taxRate: menuDraft.taxRate, category: menuDraft.category })} className="rounded-xl border px-4 py-2 text-sm">Clear</button>
                    </div>
                  </div>
                  {/* Quick Menu buttons */}
                  {!!menuLibrary.length && (
                    <div className="mt-3">
                      <div className="text-xs uppercase tracking-wide text-slate-500 mb-2">Quick items</div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2">
                        {menuLibrary.map((m, idx) => (
                          <motion.button
                            key={idx}
                            onClick={() => addMenuQuick(m)}
                            whileHover={{ scale: 1.03 }}
                            className={`rounded-xl border px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-all`}
                          >
                            <div className="font-medium truncate">{m.name}</div>
                            <div className="text-xs text-slate-600 dark:text-slate-300">₹ {money(m.price)} {m.taxRate ? `• ${m.taxRate}%` : ''}</div>
                          </motion.button>
                        ))}
                      </div>
                    </div>
                  )}
                  {/* Menu full listing grid */}
                  {!!menuFullList.length && (
                    <div className="mt-6">
                      <div className="text-xs uppercase tracking-wide text-slate-500 mb-2">All Menu Items</div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
                        {menuFullList.map((m, idx) => (
                          <motion.div
                            key={m.id || m.name + m.price + idx}
                            whileHover={{ scale: 1.03, boxShadow: "0 2px 24px 0 rgba(16, 185, 129, 0.10)" }}
                            className={`rounded-2xl ${cardBorderGradient} bg-white/70 dark:bg-slate-900/60 p-3 text-left flex flex-col transition-all`}
                          >
                            <div className="flex-1">
                              <div className="font-medium truncate text-sm">{m.name}</div>
                              <div className="text-xs text-slate-600 dark:text-slate-300">₹ {money(m.price)} {m.taxRate ? `• ${m.taxRate}%` : ''}</div>
                              {m.category && (
                                <div className="text-xs text-slate-400 mt-1">{m.category}</div>
                              )}
                            </div>
                            <button
                              onClick={() => addMenuQuick(m)}
                              className="mt-2 rounded-lg bg-gradient-to-r from-emerald-400 via-teal-200 to-cyan-300 text-slate-900 px-3 py-1 text-xs font-semibold shadow hover:shadow-lg"
                            >Add</button>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Right: cart */}
        <div className="overflow-y-auto">
          <div className="p-4 h-full flex flex-col">
            {/* Sticky cart header */}
            <div className="sticky top-0 z-20 bg-white/80 dark:bg-slate-900/80 backdrop-blur rounded-t-xl px-2 py-2 flex items-center gap-2 mb-2 border-b border-slate-200 dark:border-slate-800 shadow-sm">
              <span className="text-xl">🛒</span>
              <div className="text-base font-semibold tracking-tight">Cart</div>
            </div>
            <div className="space-y-2 flex-1 overflow-auto pb-2">
              <AnimatePresence>
                {cart.map(line => {
                  const cartDisplayName = line.product.productName || line.product.name;
                  const cartDisplayPrice = line.product.mrp || line.product.sellingPrice || line.product.basePrice || line.product.price;
                  const cartImg = line.product.imageUrl || line.product.img;
                  return (
                    <motion.div
                      key={line.product.id}
                      layout
                      initial={{ opacity: 0, scale: 0.97, y: 18 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.93, y: -18 }}
                      transition={{ duration: 0.18 }}
                      className="flex items-center gap-3 rounded-xl border border-slate-200 dark:border-slate-800 p-2 bg-white/70 dark:bg-slate-800/70 backdrop-blur shadow-sm"
                    >
                      {cartImg ? (
                        <img src={cartImg} alt={cartDisplayName} className="w-11 h-11 object-cover rounded-lg border border-slate-200 dark:border-slate-700" />
                      ) : (
                        <div className="w-11 h-11 rounded-lg bg-gradient-to-br from-emerald-400/10 to-cyan-400/10 flex items-center justify-center text-lg text-slate-300">🛍️</div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{cartDisplayName}</div>
                        <div className="text-xs text-slate-500">₹ {money(cartDisplayPrice)} {line.product.taxRate ? `• ${line.product.taxRate}%` : ''}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => decQty(line.product.id)}
                          className="rounded-lg w-8 h-8 flex items-center justify-center bg-gradient-to-br from-cyan-200/60 to-emerald-200/60 border-0 hover:from-cyan-300 hover:to-emerald-300 transition-all shadow-sm text-lg font-bold"
                          type="button"
                          aria-label="Decrease"
                        >−</button>
                        <div className="w-6 text-center text-base">{line.qty}</div>
                        <button
                          onClick={() => incQty(line.product.id)}
                          className="rounded-lg w-8 h-8 flex items-center justify-center bg-gradient-to-br from-emerald-200/60 to-cyan-200/60 border-0 hover:from-emerald-300 hover:to-cyan-300 transition-all shadow-sm text-lg font-bold"
                          type="button"
                          aria-label="Increase"
                        >＋</button>
                      </div>
                      <div className="w-24 text-right text-sm font-semibold">₹ {money(cartDisplayPrice * line.qty - (line.discount ?? 0))}</div>
                      <button
                        onClick={() => removeLine(line.product.id)}
                        className="rounded-lg w-8 h-8 flex items-center justify-center bg-gradient-to-br from-rose-200/60 to-pink-200/60 border-0 hover:from-rose-300 hover:to-pink-300 transition-all shadow-sm text-lg font-bold"
                        type="button"
                        aria-label="Remove"
                      >×</button>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
              {!cart.length && <div className="text-sm text-slate-500">Your cart is empty.</div>}
            </div>

            {/* Totals */}
            <div className="mt-3 rounded-xl border p-3 space-y-1 text-sm relative bg-white/80 dark:bg-slate-900/80 backdrop-blur shadow">
              <div className="flex justify-between"><span>Subtotal</span><span>₹ {money(totals.subTotal)}</span></div>
              <div className="flex justify-between"><span>Tax</span><span>₹ {money(totals.tax)}</span></div>
              {totals.discount > 0 && (
                <div className="flex justify-between"><span>Discount</span><span>− ₹ {money(totals.discount)}</span></div>
              )}
              <div className="flex justify-between text-base font-semibold pt-1 border-t"><span>Total</span><span>₹ {money(totals.grandTotal)}</span></div>
              <button
                onClick={checkout}
                disabled={!cart.length || saving}
                className="w-full mt-2 rounded-xl bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 text-slate-900 px-4 py-2 font-semibold shadow hover:shadow-lg disabled:opacity-50 transition-all"
              >{saving ? 'Saving…' : 'Checkout'}</button>
              {/* Clear Cart button */}
              {cart.length > 0 && (
                <button
                  onClick={() => setCart([])}
                  className="absolute -left-2 -bottom-2 text-xs rounded-full px-3 py-1 bg-gradient-to-r from-rose-400 via-pink-400 to-fuchsia-400 text-white shadow-md border-0 font-semibold hover:scale-105 transition-all"
                  style={{ boxShadow: "0 2px 16px 0 rgba(244,63,94,0.14)" }}
                  type="button"
                >Clear Cart</button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Notice */}
      <AnimatePresence>
        {notice && (
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 20 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 px-0 py-0"
            style={{ zIndex: 9999 }}
          >
            <div className="flex items-center gap-2 rounded-full border-2 px-5 py-3 bg-white/70 dark:bg-slate-800/70 backdrop-blur text-emerald-700 dark:text-emerald-300 text-base font-semibold shadow-lg pointer-events-none select-none"
              style={{
                borderImage: "linear-gradient(90deg,#34d399,#06b6d4,#a21caf,#f472b6) 1",
                boxShadow: "0 8px 48px 0 rgba(16, 185, 129, 0.14)"
              }}
            >
              <span className="text-2xl">✅</span>
              <span>{notice}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

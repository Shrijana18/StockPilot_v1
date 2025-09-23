import React, { useState, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

// Firebase / Firestore imports
import { db } from "../../../firebase/firebaseConfig";
import { getAuth } from "firebase/auth";
import {
  collection,
  addDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  doc,
  setDoc,
} from "firebase/firestore";

// NEW: Food Icons (token-based icon system)
import { IconTokens, getIconSVG, getIconEmoji } from "./foodIcons";

/**
 * Firestore shape used here:
 * businesses/{uid}/categories/{categoryId}
 * businesses/{uid}/items/{autoId}
 */

// ---------- Helpers ----------
const generateId = (prefix = "") =>
  prefix +
  Math.random().toString(36).substring(2, 10) +
  Date.now().toString(36);

// Helper so both "nonveg" and "non-veg" work consistently in UI & storage
const normalizeType = (t = "veg") =>
  String(t).toLowerCase().replace(/\s+/g, "").replace("-", "") === "nonveg"
    ? "nonveg"
    : "veg";

// Default emoji fallback (only used if no icon token)
const fallbackEmojiById = (id) =>
  id === "veg" ? "🥗" :
  id === "nonveg" ? "🍗" :
  id === "burgers" ? "🍔" :
  id === "sandwiches" ? "🥪" :
  id === "tandoor" ? "🔥" :
  id === "beverages" ? "🥤" :
  id === "breads" ? "🥖" :
  id === "rice" ? "🍚" :
  id === "tiffin" ? "🍽️" :
  id === "dosa" ? "🫓" :
  id === "pastries" ? "🧁" :
  id === "cakes" ? "🎂" :
  id === "fries" ? "🍟" :
  "🍽️";

// Map common category ids to default icon tokens (so new cats get nice icons)
const mapCategoryIdToIcon = (id = "") => {
  const key = String(id).toLowerCase();
  const table = {
    veg: "veg",
    nonveg: "nonveg",
    burgers: "burger",
    sandwiches: "sandwich",
    tandoor: "tandoor",
    beverages: "drink", // or "beverage"
    drinks: "drink",
    breads: "bread",
    rice: "rice",
    tiffin: "plate",
    dosa: "dosa",
    pastries: "pastry",
    cakes: "cake",
    fries: "fries",
    wraps: "wrap",
    sides: "side",
    quickbites: "snack",
    vegpizza: "pizza-veg",
    nonvegpizza: "pizza-nonveg",
    cocktails: "cocktail",
    mocktails: "mocktail",
    smallplates: "small-plate",
  };
  return table[key] || null;
};

// Token/SVG renderer with graceful fallbacks
const Icon = ({ token, fallback, className = "w-4 h-4" }) => {
  if (token) {
    const svg = getIconSVG(token);
    if (svg) {
      return (
        <span
          className={className}
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      );
    }
    const emoji = getIconEmoji(token);
    if (emoji) return <span className={className} style={{display:"inline-flex",alignItems:"center",justifyContent:"center"}}>{emoji}</span>;
  }
  return <span className={className} style={{display:"inline-flex",alignItems:"center",justifyContent:"center"}}>{fallback || "🍽️"}</span>;
};

// ---------- Defaults / Templates ----------
const DEFAULT_CATEGORIES = [
  { id: "veg", name: "Veg", icon: "veg" },
  { id: "nonveg", name: "Non-Veg", icon: "nonveg" },
  { id: "sandwiches", name: "Sandwiches", icon: "sandwich" },
  { id: "burgers", name: "Burgers", icon: "burger" },
  { id: "tandoor", name: "Tandoor", icon: "tandoor" },
  { id: "rice", name: "Rice", icon: "rice" },
];

const MENU_TEMPLATES = {
  cafe: {
    label: "Café Starter",
    description: "Coffee, tea, sandwiches, light bites.",
    categories: [
      { id: "beverages", name: "Beverages", icon: "drink" },
      { id: "sandwiches", name: "Sandwiches", icon: "sandwich" },
      { id: "quickbites", name: "Quick Bites", icon: "snack" },
    ],
    items: [
      { name: "Filter Coffee", price: 35, tax: 5, type: "veg", categoryId: "beverages" },
      { name: "Masala Chai", price: 25, tax: 5, type: "veg", categoryId: "beverages" },
      { name: "Cold Coffee", price: 120, tax: 5, type: "veg", categoryId: "beverages" },
      { name: "Veg Grill Sandwich", price: 110, tax: 5, type: "veg", categoryId: "sandwiches" },
      { name: "Cheese Toast", price: 90, tax: 5, type: "veg", categoryId: "quickbites" },
    ],
  },
  north: {
    label: "North Indian",
    description: "Curries, breads, rice — classic thali picks.",
    categories: [
      { id: "veg", name: "Veg", icon: "veg" },
      { id: "nonveg", name: "Non-Veg", icon: "nonveg" },
      { id: "breads", name: "Breads", icon: "bread" },
      { id: "rice", name: "Rice", icon: "rice" },
    ],
    items: [
      { name: "Paneer Butter Masala", price: 220, tax: 5, type: "veg", categoryId: "veg" },
      { name: "Dal Tadka", price: 160, tax: 5, type: "veg", categoryId: "veg" },
      { name: "Chicken Curry", price: 260, tax: 5, type: "nonveg", categoryId: "nonveg" },
      { name: "Butter Naan", price: 40, tax: 5, type: "veg", categoryId: "breads" },
      { name: "Jeera Rice", price: 140, tax: 5, type: "veg", categoryId: "rice" },
    ],
  },
  south: {
    label: "South Indian",
    description: "Idli, dosa, vada, filter coffee.",
    categories: [
      { id: "tiffin", name: "Tiffin", icon: "plate" },
      { id: "dosa", name: "Dosa", icon: "dosa" },
      { id: "beverages", name: "Beverages", icon: "drink" },
    ],
    items: [
      { name: "Idli (2 pc)", price: 40, tax: 5, type: "veg", categoryId: "tiffin" },
      { name: "Medu Vada (2 pc)", price: 50, tax: 5, type: "veg", categoryId: "tiffin" },
      { name: "Masala Dosa", price: 90, tax: 5, type: "veg", categoryId: "dosa" },
      { name: "Mysore Masala Dosa", price: 120, tax: 5, type: "veg", categoryId: "dosa" },
      { name: "Filter Coffee", price: 35, tax: 5, type: "veg", categoryId: "beverages" },
    ],
  },
  pizzeria: {
    label: "Pizzeria",
    description: "Classic and loaded pizzas, sides and drinks.",
    categories: [
      { id: "vegpizza", name: "Veg Pizzas", icon: "pizza-veg" },
      { id: "nonvegpizza", name: "Non-Veg Pizzas", icon: "pizza-nonveg" },
      { id: "sides", name: "Sides", icon: "side" },
      { id: "drinks", name: "Drinks", icon: "drink" },
    ],
    items: [
      { name: "Margherita", price: 199, tax: 5, type: "veg", categoryId: "vegpizza" },
      { name: "Farmhouse", price: 349, tax: 5, type: "veg", categoryId: "vegpizza" },
      { name: "Chicken Pepperoni", price: 399, tax: 5, type: "nonveg", categoryId: "nonvegpizza" },
      { name: "Garlic Bread", price: 129, tax: 5, type: "veg", categoryId: "sides" },
      { name: "Cola", price: 60, tax: 0, type: "veg", categoryId: "drinks" },
    ],
  },
  fastfood: {
    label: "Fast Food",
    description: "Burgers, fries, wraps, shakes.",
    categories: [
      { id: "burgers", name: "Burgers", icon: "burger" },
      { id: "wraps", name: "Wraps", icon: "wrap" },
      { id: "fries", name: "Fries", icon: "fries" },
      { id: "beverages", name: "Beverages", icon: "drink" },
    ],
    items: [
      { name: "Veg Burger", price: 89, tax: 5, type: "veg", categoryId: "burgers" },
      { name: "Chicken Burger", price: 129, tax: 5, type: "nonveg", categoryId: "burgers" },
      { name: "Paneer Wrap", price: 139, tax: 5, type: "veg", categoryId: "wraps" },
      { name: "French Fries", price: 79, tax: 5, type: "veg", categoryId: "fries" },
      { name: "Thick Shake", price: 149, tax: 5, type: "veg", categoryId: "beverages" },
    ],
  },
  bar: {
    label: "Bar",
    description: "Cocktails, mocktails and small plates.",
    categories: [
      { id: "cocktails", name: "Cocktails", icon: "cocktail" },
      { id: "mocktails", name: "Mocktails", icon: "mocktail" },
      { id: "smallplates", name: "Small Plates", icon: "small-plate" },
    ],
    items: [
      { name: "Mojito", price: 299, tax: 18, type: "veg", categoryId: "cocktails" },
      { name: "Whiskey Sour", price: 349, tax: 18, type: "veg", categoryId: "cocktails" },
      { name: "Virgin Mary", price: 199, tax: 5, type: "veg", categoryId: "mocktails" },
      { name: "Nachos", price: 199, tax: 5, type: "veg", categoryId: "smallplates" },
      { name: "Chicken Wings", price: 299, tax: 5, type: "nonveg", categoryId: "smallplates" },
    ],
  },
  bakery: {
    label: "Bakery / Desserts",
    description: "Cakes, pastries and shakes.",
    categories: [
      { id: "cakes", name: "Cakes", icon: "cake" },
      { id: "pastries", name: "Pastries", icon: "pastry" },
      { id: "beverages", name: "Beverages", icon: "drink" },
    ],
    items: [
      { name: "Chocolate Truffle Slice", price: 90, tax: 5, type: "veg", categoryId: "pastries" },
      { name: "Black Forest Cake (1/2 kg)", price: 450, tax: 5, type: "veg", categoryId: "cakes" },
      { name: "Red Velvet Pastry", price: 110, tax: 5, type: "veg", categoryId: "pastries" },
      { name: "Thick Chocolate Shake", price: 160, tax: 5, type: "veg", categoryId: "beverages" },
    ],
  },
};

// ---------- Component ----------
const CreateMenu = ({ onBack }) => {
  // State
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState("grid"); // 'grid' | 'list'
  const [showUnavailable, setShowUnavailable] = useState(false);

  const [categories, setCategories] = useState([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [items, setItems] = useState([]);

  const [activeTab, setActiveTab] = useState("manual"); // manual | quick | ai
  const [showQuickStart, setShowQuickStart] = useState(false); // legacy flag (still drives the top "Quick Start" button)
  const [showPreview, setShowPreview] = useState(false);

  const [categoryModalMode, setCategoryModalMode] = useState("add"); // 'add' | 'edit'
  const [categoryModalValue, setCategoryModalValue] = useState({ id: "", name: "", icon: "" });

  const [showItemModal, setShowItemModal] = useState(false);
  const [itemModalMode, setItemModalMode] = useState("add"); // 'add' | 'edit'
  const [itemModalValue, setItemModalValue] = useState({
    id: "",
    name: "",
    price: "",
    tax: "",
    type: "veg",
    image: "",
    categoryId: "",
    available: true,
  });

  const [aiForm, setAiForm] = useState({
    industry: "restaurant",   // restaurant | cafe | pizzeria | bar | fastfood
    cuisine: "north",         // north | south | continental | mixed
    priceBand: "mid",         // low | mid | high
    vegRatio: 70,             // % veg items
  });

  const fileInputRef = useRef(null);

  // decorate background
  const particles = useMemo(
    () =>
      Array.from({ length: 28 }).map((_, i) => ({
        id: i,
        top: Math.random() * 100,
        left: Math.random() * 100,
        size: 2 + Math.random() * 2,
        delay: Math.random() * 6,
        opacity: 0.25 + Math.random() * 0.35,
      })),
    []
  );

  // --- Firestore helpers for Categories ---
  const getUid = () => getAuth().currentUser?.uid || null;
  const getCatRef = (uid) => collection(db, "businesses", uid, "categories");

  const upsertCategories = (cats) => {
    setCategories((prev) => {
      const byId = new Map(prev.map((c) => [c.id, c]));
      for (const c of cats) if (!byId.has(c.id)) byId.set(c.id, { ...byId.get(c.id), ...c });
      return Array.from(byId.values());
    });
  };

  // Create/update categories in Firestore (id is used as the doc id)
  const ensureCategoriesExist = async (cats = []) => {
    const uid = getUid();
    if (!uid || !cats.length) return;
    const ref = getCatRef(uid);
    const toState = [];
    for (const c of cats) {
      const id = c.id || generateId("cat");
      const iconToken = c.icon || mapCategoryIdToIcon(id) || null;
      await setDoc(doc(ref, id), { name: c.name || id, icon: iconToken }, { merge: true });
      toState.push({ id, name: c.name || id, icon: iconToken });
    }
    // merge into state without duplicates
    setCategories((prev) => {
      const map = new Map(prev.map((x) => [x.id, x]));
      toState.forEach((x) => map.set(x.id, { ...(map.get(x.id) || {}), ...x }));
      return Array.from(map.values());
    });
  };

  const seedItemsBulk = async (bulk) => {
    const uid = getUid();
    if (!uid) return;
    const itemsRef = collection(db, "businesses", uid, "items");
    const created = [];
    for (const base of bulk) {
      const data = {
        ...base,
        type: normalizeType(base.type),
        available: base.available !== false,
      };
      const ref = await addDoc(itemsRef, data);
      created.push({ ...data, id: ref.id });
    }
    setItems((prev) => [...prev, ...created]);
  };

  const applyTemplate = async (key) => {
    const tpl = MENU_TEMPLATES[key];
    if (!tpl) return;
    await ensureCategoriesExist(tpl.categories);
    // normalize "type"
    await seedItemsBulk(tpl.items.map((it) => ({ ...it, type: normalizeType(it.type) })));
    if (tpl.categories[0]) setSelectedCategoryId(tpl.categories[0].id);
    setShowQuickStart(false);
  };

  const handleCSVUpload = async (file) => {
    if (!file) return;
    const text = await file.text();

    // Simple CSV parser: name,categoryId,price,tax,type,image,available
    const rows = text.split(/\r?\n/).map((r) => r.trim()).filter(Boolean);
    if (rows.length === 0) return;
    const header = rows[0].toLowerCase();
    const useHeader = /(^|,)name(,|$)/.test(header);
    const dataRows = useHeader ? rows.slice(1) : rows;

    const parsed = [];
    for (const r of dataRows) {
      // Keep commas inside quotes intact
      const cols = [];
      let cur = "", inQ = false;
      for (let i = 0; i < r.length; i++) {
        const ch = r[i];
        if (ch === '"') inQ = !inQ;
        else if (ch === "," && !inQ) {
          cols.push(cur); cur = "";
          continue;
        }
        if (ch !== "," || inQ) cur += ch;
      }
      cols.push(cur);

      const [
        name,
        categoryId,
        price,
        tax,
        type = "veg",
        image = "",
        available = "true",
      ] = cols.map((c) => String(c || "").replace(/^"|"$/g, "").trim());

      if (!name || !categoryId) continue;
      parsed.push({
        name: name.trim(),
        categoryId: categoryId.trim(),
        price: parseFloat(price) || 0,
        tax: parseFloat(tax) || 0,
        type: normalizeType(type),
        image: image || "",
        available: String(available).toLowerCase() !== "false",
      });
    }

    // Upsert categories that appear in CSV but not in state
    const csvCats = Array.from(new Set(parsed.map((p) => p.categoryId))).map((id) => ({
      id,
      name: id
        .split(/[_\s-]+/)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" "),
      icon: mapCategoryIdToIcon(id) || null,
    }));

    await ensureCategoriesExist(csvCats);
    await seedItemsBulk(parsed);
    if (csvCats[0]) setSelectedCategoryId(csvCats[0].id);
    setShowQuickStart(false);
  };

  const handleAIGenerate = async () => {
    // Local "AI-like" generator (no network calls).
    const packs = {
      north: ["veg", "nonveg", "breads", "rice"],
      south: ["tiffin", "dosa", "beverages"],
      continental: ["salads", "mains", "desserts"],
      mixed: ["veg", "nonveg", "quickbites"],
    };
    const labels = {
      veg: "Veg",
      nonveg: "Non-Veg",
      breads: "Breads",
      rice: "Rice",
      tiffin: "Tiffin",
      dosa: "Dosa",
      beverages: "Beverages",
      salads: "Salads",
      mains: "Mains",
      desserts: "Desserts",
      quickbites: "Quick Bites",
    };

    const cats = (packs[aiForm.cuisine] || packs.north).map((id) => ({
      id,
      name: labels[id] || id,
      icon: mapCategoryIdToIcon(id) || null,
    }));
    upsertCategories(cats);
    await ensureCategoriesExist(cats);

    const seed = [];
    const vegBias = Math.min(100, Math.max(0, Number(aiForm.vegRatio) || 60));
    const chooseType = () => (Math.random() * 100 < vegBias ? "veg" : "nonveg");
    const basePrice =
      aiForm.priceBand === "low" ? 80 : aiForm.priceBand === "high" ? 260 : 150;

    cats.forEach((c) => {
      for (let i = 0; i < 3; i++) {
        const t = chooseType();
        const name =
          c.id === "veg"
            ? ["Paneer Masala", "Aloo Mutter", "Veg Kadhai"][i]
            : c.id === "nonveg"
            ? ["Chicken Curry", "Kadai Chicken", "Mutton Rogan"][i] || "Chicken Roast"
            : c.id === "breads"
            ? ["Butter Naan", "Tandoori Roti", "Lachha Paratha"][i]
            : c.id === "rice"
            ? ["Jeera Rice", "Veg Pulao", "Curd Rice"][i]
            : c.id === "tiffin"
            ? ["Idli", "Medu Vada", "Upma"][i]
            : c.id === "dosa"
            ? ["Masala Dosa", "Mysore Dosa", "Plain Dosa"][i]
            : c.id === "beverages"
            ? ["Filter Coffee", "Masala Chai", "Lassi"][i]
            : c.id === "salads"
            ? ["Greek Salad", "Caesar Salad", "Quinoa Salad"][i]
            : c.id === "mains"
            ? ["Grilled Chicken", "Pasta Alfredo", "Veg Steak"][i]
            : c.id === "desserts"
            ? ["Brownie", "Cheesecake", "Gulab Jamun"][i]
            : ["Quick Bite A", "Quick Bite B", "Quick Bite C"][i];

        seed.push({
          name,
          categoryId: c.id,
          price: Math.max(20, Math.round(basePrice + (i - 1) * 30 + (t === "veg" ? -10 : 20))),
          tax: c.id === "beverages" ? 0 : 5,
          type: normalizeType(t),
          image: "",
          available: true,
        });
      }
    });

    await seedItemsBulk(seed);
    if (cats[0]) setSelectedCategoryId(cats[0].id);
    setShowQuickStart(false);
  };

  // Fetch items on mount
  useEffect(() => {
    (async () => {
      try {
        const uid = getUid();
        if (!uid) return;
        const itemsRef = collection(db, "businesses", uid, "items");
        const snapshot = await getDocs(itemsRef);
        if (snapshot.empty) {
          // Seed a few defaults so the UI isn't empty on first run
          const starterItems = [
            { name: "Paneer Butter Masala", price: 180, tax: 5, type: "veg", categoryId: "veg", available: true },
            { name: "Chicken Curry", price: 220, tax: 5, type: "nonveg", categoryId: "nonveg", available: true },
            { name: "Veg Sandwich", price: 120, tax: 5, type: "veg", categoryId: "sandwiches", available: true },
            { name: "Cheese Burger", price: 150, tax: 5, type: "veg", categoryId: "burgers", available: true },
            { name: "Tandoori Roti", price: 25, tax: 5, type: "veg", categoryId: "breads", available: true },
            { name: "Veg Fried Rice", price: 160, tax: 5, type: "veg", categoryId: "rice", available: true },
          ];
          await seedItemsBulk(starterItems);
        } else {
          const fetchedItems = [];
          snapshot.forEach((docSnap) => {
            const d = docSnap.data() || {};
            fetchedItems.push({
              id: docSnap.id,
              ...d,
              type: normalizeType(d.type),
              available: d.available !== false,
            });
          });
          setItems(fetchedItems);
        }
      } catch (err) {
        console.error("Error fetching items:", err);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch Categories on mount and seed defaults if empty
  useEffect(() => {
    (async () => {
      const uid = getUid();
      if (!uid) return;
      const ref = getCatRef(uid);
      const snap = await getDocs(ref);
      if (snap.empty) {
        // Seed defaults with deterministic ids so existing items (veg/nonveg...) match
        await Promise.all(
          DEFAULT_CATEGORIES.map((c) =>
            setDoc(doc(ref, c.id), { name: c.name, icon: c.icon || mapCategoryIdToIcon(c.id) || null }, { merge: true })
          )
        );
        setCategories(DEFAULT_CATEGORIES.map((c) => ({ ...c, icon: c.icon || mapCategoryIdToIcon(c.id) || null })));
        setSelectedCategoryId(DEFAULT_CATEGORIES[0]?.id || "");
      } else {
        const list = [];
        snap.forEach((d) => list.push({ id: d.id, ...(d.data() || {}) }));
        setCategories(list);
        setSelectedCategoryId(list[0]?.id || "");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [previewCategoryId, setPreviewCategoryId] = useState(selectedCategoryId);
  useEffect(() => setPreviewCategoryId(selectedCategoryId), [selectedCategoryId]);

  const isAvailable = (it) => it.available !== false;

  // Toggle availability (persist)
  const toggleAvailability = async (item) => {
    try {
      const uid = getUid();
      if (!uid) return;
      const ref = doc(db, "businesses", uid, "items", item.id);
      const next = !isAvailable(item);
      await updateDoc(ref, { available: next });
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, available: next } : i)));
    } catch (e) {
      console.error("Failed to toggle availability", e);
    }
  };

  // ---------- Category handlers ----------
  const [showCategoryModal, setShowCategoryModal] = useState(false);

  const handleAddCategory = () => {
    setCategoryModalMode("add");
    setCategoryModalValue({ id: "", name: "", icon: "" });
    setShowCategoryModal(true);
  };

  const handleEditCategory = (cat) => {
    setCategoryModalMode("edit");
    setCategoryModalValue({ id: cat.id, name: cat.name || "", icon: cat.icon || "" });
    setShowCategoryModal(true);
  };

  const handleDeleteCategory = async (catId) => {
    if (!window.confirm("Delete this category?")) return;
    const uid = getUid();
    if (uid) {
      try {
        await deleteDoc(doc(getCatRef(uid), catId));
      } catch (e) {
        console.error("Failed to delete category:", e);
      }
    }
    setCategories((prev) => prev.filter((c) => c.id !== catId));
    setItems((prev) => prev.filter((i) => i.categoryId !== catId));
    if (selectedCategoryId === catId) {
      const rest = categories.filter((c) => c.id !== catId);
      setSelectedCategoryId(rest[0]?.id || "");
    }
  };

  const handleCategoryModalSave = async () => {
    if (!categoryModalValue.name.trim()) return;
    const uid = getUid();
    if (!uid) return;
    const ref = getCatRef(uid);

    const payload = {
      name: categoryModalValue.name,
      icon: categoryModalValue.icon || null,
    };

    if (categoryModalMode === "add") {
      const id = generateId("cat");
      try {
        await setDoc(doc(ref, id), payload, { merge: true });
        setCategories((prev) => [...prev, { id, ...payload }]);
        setSelectedCategoryId(id);
      } catch (e) {
        console.error("Failed to add category:", e);
      }
    } else if (categoryModalMode === "edit") {
      try {
        await updateDoc(doc(ref, categoryModalValue.id), payload);
        setCategories((prev) =>
          prev.map((c) =>
            c.id === categoryModalValue.id ? { ...c, ...payload } : c
          )
        );
      } catch (e) {
        console.error("Failed to update category:", e);
      }
    }
    setShowCategoryModal(false);
  };

  // ---------- Item handlers ----------
  const handleAddItem = () => {
    setItemModalMode("add");
    setItemModalValue({
      id: "",
      name: "",
      price: "",
      tax: "",
      type: "veg",
      image: "",
      categoryId: selectedCategoryId,
      available: true,
    });
    setShowItemModal(true);
  };

  const handleEditItem = (item) => {
    setItemModalMode("edit");
    setItemModalValue({ ...item });
    setShowItemModal(true);
  };

  const handleDeleteItem = async (id) => {
    if (!window.confirm("Delete this item?")) return;
    try {
      const uid = getUid();
      if (!uid) return;
      const itemDocRef = doc(db, "businesses", uid, "items", id);
      await deleteDoc(itemDocRef);
      setItems((prev) => prev.filter((i) => i.id !== id));
    } catch (err) {
      console.error("Error deleting item:", err);
    }
  };

  const handleItemModalSave = async () => {
    if (!itemModalValue.name.trim() || itemModalValue.price === "" || itemModalValue.price === null) return;
    const uid = getUid();
    if (!uid) return;

    try {
      if (itemModalMode === "add") {
        const data = {
          ...itemModalValue,
          price: parseFloat(itemModalValue.price),
          tax: parseFloat(itemModalValue.tax) || 0,
          type: normalizeType(itemModalValue.type),
          available: itemModalValue.available !== false,
        };
        delete data.id; // Don't store id in doc
        const itemsRef = collection(db, "businesses", uid, "items");
        const docRef = await addDoc(itemsRef, data);
        setItems((prev) => [...prev, { ...data, id: docRef.id }]);
      } else if (itemModalMode === "edit") {
        const data = {
          ...itemModalValue,
          price: parseFloat(itemModalValue.price),
          tax: parseFloat(itemModalValue.tax) || 0,
          type: normalizeType(itemModalValue.type),
        };
        const { id, ...updateData } = data;
        const itemDocRef = doc(db, "businesses", uid, "items", id);
        await updateDoc(itemDocRef, updateData);
        setItems((prev) => prev.map((i) => (i.id === id ? { ...data } : i)));
      }
      setShowItemModal(false);
    } catch (err) {
      console.error("Error saving item:", err);
    }
  };

  // UI derived
  const selectedCategory = categories.find((c) => c.id === selectedCategoryId);
  const itemsInCategory = items.filter((i) => i.categoryId === selectedCategoryId);
  const itemsInCategoryFiltered = itemsInCategory.filter((i) => {
    if (!showUnavailable && i.available === false) return false;
    if (!search.trim()) return true;
    return i.name.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div className="relative w-full min-h-screen bg-transparent">
      {/* Aurora / noise backdrop */}
      <div className="pointer-events-none fixed inset-0 opacity-[0.9]">
        <div className="absolute -top-1/3 -left-1/4 w-[70%] h-[70%] rounded-full blur-3xl bg-emerald-500/20" />
        <div className="absolute -bottom-1/3 -right-1/4 w-[70%] h-[70%] rounded-full blur-3xl bg-cyan-500/20" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,_rgba(16,185,129,0.08),_transparent_50%),radial-gradient(ellipse_at_top,_rgba(6,182,212,0.05),_transparent_40%)]" />
        <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_center,rgba(0,0,0,0)_45%,rgba(0,0,0,0.28))]" />
      </div>

      {/* Particles */}
      <div className="pointer-events-none fixed inset-0 z-0">
        {particles.map((p) => (
          <motion.span
            key={p.id}
            className="absolute rounded-full bg-white"
            style={{ top: `${p.top}%`, left: `${p.left}%`, width: p.size, height: p.size, opacity: p.opacity }}
            animate={{ opacity: [0, p.opacity, 0] }}
            transition={{ repeat: Infinity, duration: 6 + p.delay, ease: "easeInOut", delay: p.delay }}
          />
        ))}
      </div>

      {/* Top Bar */}
      <div className="sticky top-0 z-30 bg-transparent backdrop-blur-sm">
        <div className="px-4 py-3 flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="rounded-lg bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 text-slate-900 px-4 py-2 text-sm font-semibold shadow hover:shadow-emerald-600/30 hover:shadow-lg transition"
            >
              ← Back to POS
            </button>
          )}
          <h1 className="text-lg font-semibold text-white/90">Menu Builder</h1>
          <div className="flex-1" />
          {/* Tab Bar */}
          <div className="flex items-center gap-2">
            {["manual", "quick", "ai"].map((t) => (
              <button
                key={t}
                onClick={() => setActiveTab(t)}
                className={`px-3 py-2 rounded-lg text-sm capitalize ${
                  activeTab === t ? "bg-emerald-500 text-slate-900 font-semibold shadow" : "text-white/80 hover:bg-white/5"
                }`}
              >
                {t === "manual" ? "Manual" : t === "quick" ? "Quick Start" : "AI"}
              </button>
            ))}
          </div>
          <div className="hidden md:flex items-center gap-2">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40">🔍</span>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search items…"
                className="pl-9 pr-3 py-2 rounded-xl border border-white/10 bg-white/5 text-white/90 placeholder:text-white/40 backdrop-blur outline-none text-sm focus:ring-2 focus:ring-emerald-300/40"
              />
            </div>
            <div className="inline-flex rounded-xl overflow-hidden border border-white/10">
              <button
                onClick={() => setViewMode("grid")}
                className={`px-3 py-2 text-sm ${viewMode === "grid" ? "bg-white/10 text-white" : "text-white/70 hover:bg-white/5"}`}
              >
                Grid
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`px-3 py-2 text-sm ${viewMode === "list" ? "bg-white/10 text-white" : "text-white/70 hover:bg-white/5"}`}
              >
                List
              </button>
            </div>
            <label className="flex items-center gap-2 text-sm text-white/80">
              <input
                type="checkbox"
                className="accent-emerald-400"
                checked={showUnavailable}
                onChange={(e) => setShowUnavailable(e.target.checked)}
              />
              Show unavailable
            </label>
          </div>
          <button
            onClick={() => setShowQuickStart((v) => !v)}
            className={`ml-2 rounded-lg border border-white/10 px-3 py-2 text-sm ${
              items.length === 0
                ? "bg-emerald-500 text-slate-900 font-semibold shadow hover:shadow-lg"
                : "text-white/90 hover:bg-white/5"
            }`}
          >
            Quick Start
          </button>
          <button
            onClick={() => setShowPreview(true)}
            className="ml-2 rounded-lg border border-white/10 text-white/90 px-3 py-2 text-sm hover:bg-white/5"
          >
            Preview Menu
          </button>
          <button
            onClick={handleAddCategory}
            className="ml-2 rounded-lg border border-white/10 text-white/90 px-3 py-2 text-sm hover:bg-white/5"
          >
            + Category
          </button>
          <button
            onClick={handleAddItem}
            className="rounded-lg bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 text-slate-900 px-3 py-2 text-sm font-semibold shadow hover:shadow-lg"
          >
            + Item
          </button>
        </div>
      </div>

      {/* Manual Tab */}
      {activeTab === "manual" && (
        <div className="relative z-20 flex min-h-[calc(100vh-160px)] px-4 md:px-6 pb-4">
          {/* Left Pane: Categories */}
          <div className="w-1/4 min-w-[210px] bg-white/5 backdrop-blur flex flex-col shadow-[inset_-1px_0_rgba(255,255,255,0.06)] rounded-xl border border-white/10">
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <h2 className="text-lg font-semibold tracking-wide text-white/90">Categories</h2>
              <motion.button
                whileHover={{ scale: 1.1, rotate: 5 }}
                whileTap={{ scale: 0.95 }}
                className="rounded-full bg-emerald-500 text-white w-8 h-8 flex items-center justify-center shadow-md"
                onClick={handleAddCategory}
                title="Add Category"
              >
                <span className="text-xl font-bold">+</span>
              </motion.button>
            </div>
            <div className="flex-1 overflow-y-auto px-2 py-3">
              {categories.length === 0 && <div className="text-center text-white/40 mt-8">No categories</div>}
              {categories.map((cat) => (
                <motion.div
                  key={cat.id}
                  layout
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ type: "spring", damping: 22, stiffness: 200 }}
                  className={`group flex items-center mb-2 last:mb-0 rounded-lg px-3 py-2 cursor-pointer transition ${
                    selectedCategoryId === cat.id ? "ring-2 ring-emerald-400/60 bg-white/10" : "hover:bg-white/5"
                  }`}
                  onClick={() => setSelectedCategoryId(cat.id)}
                >
                  <span className="mr-2 text-white/90">
                    <Icon token={cat.icon || mapCategoryIdToIcon(cat.id)} fallback={fallbackEmojiById(cat.id)} className="w-5 h-5" />
                  </span>
                  <span className="flex-1 font-medium text-white/90 truncate">{cat.name}</span>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-2">
                    <button
                      className="text-xs text-white/60 hover:text-emerald-300 px-1"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditCategory(cat);
                      }}
                      title="Edit"
                    >
                      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path d="M15.232 5.232l3.536 3.536M16.732 3.732a2.5 2.5 0 113.536 3.536L7 21H3v-4L16.732 3.732z" />
                      </svg>
                    </button>
                    <button
                      className="text-xs text-white/60 hover:text-red-400 px-1"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteCategory(cat.id);
                      }}
                      title="Delete"
                    >
                      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Right Pane: Items */}
          <div className="flex-1 flex flex-col ml-4 rounded-xl border border-white/10 bg-white/5 backdrop-blur">
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
              <h2 className="text-lg font-semibold tracking-wide text-white/90">
                {selectedCategory ? selectedCategory.name : "Select a Category"}
              </h2>
              <div className="md:hidden flex-1" />
              <div className="md:hidden flex items-center gap-2">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40">🔍</span>
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search items…"
                    className="pl-9 pr-3 py-2 rounded-xl border border-white/10 bg-white/5 text-white/90 placeholder:text-white/40 backdrop-blur outline-none text-sm focus:ring-2 focus:ring-emerald-300/40"
                  />
                </div>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-6 bg-[radial-gradient(1200px_600px_at_60%_20%,rgba(16,185,129,0.06),transparent),radial-gradient(1000px_500px_at_80%_80%,rgba(6,182,212,0.05),transparent)]">
              {selectedCategory ? (
                viewMode === "grid" ? (
                  <motion.div layout className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
                    <AnimatePresence>
                      {itemsInCategoryFiltered.length === 0 && (
                        <motion.div
                          key="no-items"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="col-span-full text-center text-white/40 mt-8"
                        >
                          No items match your filters.
                        </motion.div>
                      )}
                      {itemsInCategoryFiltered.map((item) => (
                        <motion.div
                          key={item.id}
                          layout
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 20 }}
                          transition={{ type: "spring", damping: 18, stiffness: 160 }}
                          className={`relative flex flex-col rounded-2xl p-4 group border border-white/10 bg-white/5 text-white/90 shadow-[0_10px_30px_rgba(0,0,0,0.35)] backdrop-blur transition transform hover:-translate-y-1 hover:shadow-[0_18px_46px_rgba(20,184,166,0.35)] ${
                            item.available === false ? "opacity-60" : ""
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-2">
                            {normalizeType(item.type) === "veg" ? (
                              <span className="w-3 h-3 bg-emerald-400 rounded-full border border-emerald-600" title="Veg"></span>
                            ) : (
                              <span className="w-3 h-3 bg-red-400 rounded-full border border-red-600" title="Non-Veg"></span>
                            )}
                            <span className="text-sm font-semibold truncate">{item.name}</span>
                          </div>
                          {item.image && (
                            <img
                              src={item.image}
                              alt={item.name}
                              className="w-full h-28 object-cover rounded-lg mb-2 border border-white/10"
                              onError={(e) => (e.currentTarget.style.display = "none")}
                            />
                          )}
                          <div className="flex-1" />
                          <div className="flex justify-between items-center mt-2">
                            <span className="text-base font-bold">₹{item.price}</span>
                            <span className="text-xs text-white/60">Tax: {item.tax}%</span>
                          </div>
                          <div className="mt-3 flex items-center justify-between">
                            <label className="flex items-center gap-2 text-xs text-white/70">
                              <input type="checkbox" checked={item.available !== false} onChange={() => toggleAvailability(item)} />
                              Available
                            </label>
                            <div className="flex gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                              <button className="text-xs text-white/60 hover:text-emerald-300 p-1" onClick={() => handleEditItem(item)} title="Edit">
                                ✏️
                              </button>
                              <button className="text-xs text-white/60 hover:text-red-400 p-1" onClick={() => handleDeleteItem(item.id)} title="Delete">
                                🗑️
                              </button>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </motion.div>
                ) : (
                  <div className="divide-y rounded-xl border border-white/10">
                    {itemsInCategoryFiltered.map((item) => (
                      <div key={item.id} className={`flex items-center gap-3 p-3 ${item.available === false ? "opacity-60" : ""}`}>
                        {item.image ? (
                          <img src={item.image} alt={item.name} className="w-14 h-14 rounded object-cover border border-white/10" />
                        ) : (
                          <div className="w-14 h-14 rounded bg-white/5 border border-white/10" />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-white/90 truncate">{item.name}</div>
                          <div className="text-xs text-white/60">Tax {item.tax}% • {normalizeType(item.type) === "veg" ? "veg" : "non-veg"}</div>
                        </div>
                        <div className="w-24 text-right font-semibold text-white/90">₹{item.price}</div>
                        <label className="ml-2 flex items-center gap-1 text-xs text-white/70">
                          <input type="checkbox" checked={item.available !== false} onChange={() => toggleAvailability(item)} />
                          Available
                        </label>
                        <button className="ml-2 text-xs text-white/60 hover:text-emerald-300" onClick={() => handleEditItem(item)}>Edit</button>
                        <button className="ml-1 text-xs text-white/60 hover:text-red-400" onClick={() => handleDeleteItem(item.id)}>Delete</button>
                      </div>
                    ))}
                  </div>
                )
              ) : (
                <div className="text-center text-white/40 mt-8">Select a category to view items.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Quick Start Panel */}
      {activeTab === "quick" && (
        <div className="relative z-20 mx-4 md:mx-6 mb-4">
          <div className="rounded-2xl border border-white/10 bg-slate-950/80 text-white shadow-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-white/10 bg-slate-900/60 backdrop-blur flex items-center gap-3">
              <h3 className="text-lg font-semibold">Quick Start</h3>
              <span className="text-white/60 text-sm">Create your menu in minutes</span>
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Templates */}
              <div>
                <div className="mb-3 text-white/80 font-medium">Use a template</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {Object.entries(MENU_TEMPLATES).map(([key, tpl]) => (
                    <button
                      key={key}
                      onClick={() => applyTemplate(key)}
                      className="text-left rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition p-4 w-full"
                    >
                      <div className="text-base font-semibold mb-1">{tpl.label}</div>
                      <div className="text-sm text-white/70">{tpl.description}</div>
                      <div className="mt-3 text-xs text-white/50">
                        {tpl.categories.length} categories • {tpl.items.length} items
                      </div>
                    </button>
                  ))}
                </div>
              </div>
              {/* Import */}
              <div>
                <div className="mb-3 text-white/80 font-medium">Import from CSV / Sheet</div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <p className="text-sm text-white/70">Upload a CSV with columns:</p>
                  <pre className="mt-2 text-xs text-white/60 bg-black/30 rounded p-3 overflow-x-auto">
                    name,categoryId,price,tax,type,image,available{"\n"}Idli,veg,40,5,veg,,true
                  </pre>
                  <div className="mt-3 flex items-center gap-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv"
                      className="hidden"
                      onChange={(e) => handleCSVUpload(e.target.files?.[0])}
                    />
                    <button
                      className="rounded-lg bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 text-slate-900 px-3 py-2 text-sm font-semibold shadow hover:shadow-lg"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      Upload CSV
                    </button>
                  </div>
                </div>
                <div className="mt-6 rounded-xl border border-white/10 bg-white/5 p-4">
                  <div className="mb-2 text-white/80 font-medium">Start empty</div>
                  <p className="text-sm text-white/70 mb-3">
                    Add categories and items manually. You can always open Quick Start later.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AI Generator */}
      {activeTab === "ai" && (
        <div className="relative z-20 mx-4 md:mx-6 mb-4">
          <div className="rounded-2xl border border-white/10 bg-slate-950/80 text-white shadow-xl overflow-hidden p-6">
            <h3 className="text-lg font-semibold mb-4">✨ AI Menu Generator</h3>
            <p className="text-sm text-white/70 mb-4">Describe your place and we’ll scaffold categories and items for you.</p>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-white/70 text-xs mb-1">Industry</label>
                <select
                  className="w-full border border-white/10 bg-white/5 text-white rounded px-2 py-2 text-sm"
                  value={aiForm.industry}
                  onChange={(e) => setAiForm((v) => ({ ...v, industry: e.target.value }))}
                >
                  <option value="restaurant">Restaurant</option>
                  <option value="cafe">Café</option>
                  <option value="pizzeria">Pizzeria</option>
                  <option value="fastfood">Fast Food</option>
                  <option value="bar">Bar</option>
                </select>
              </div>
              <div>
                <label className="block text-white/70 text-xs mb-1">Cuisine</label>
                <select
                  className="w-full border border-white/10 bg-white/5 text-white rounded px-2 py-2 text-sm"
                  value={aiForm.cuisine}
                  onChange={(e) => setAiForm((v) => ({ ...v, cuisine: e.target.value }))}
                >
                  <option value="north">North Indian</option>
                  <option value="south">South Indian</option>
                  <option value="continental">Continental</option>
                  <option value="mixed">Mixed</option>
                </select>
              </div>
              <div>
                <label className="block text-white/70 text-xs mb-1">Price band</label>
                <select
                  className="w-full border border-white/10 bg-white/5 text-white rounded px-2 py-2 text-sm"
                  value={aiForm.priceBand}
                  onChange={(e) => setAiForm((v) => ({ ...v, priceBand: e.target.value }))}
                >
                  <option value="low">Low</option>
                  <option value="mid">Mid</option>
                  <option value="high">High</option>
                </select>
              </div>
              <div>
                <label className="block text-white/70 text-xs mb-1">Veg ratio (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  className="w-full border border-white/10 bg-white/5 text-white rounded px-2 py-2 text-sm"
                  value={aiForm.vegRatio}
                  onChange={(e) => setAiForm((v) => ({ ...v, vegRatio: e.target.value }))}
                />
              </div>
            </div>
            <button
              className="rounded-lg bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 text-slate-900 px-3 py-2 text-sm font-semibold shadow hover:shadow-lg"
              onClick={handleAIGenerate}
            >
              Generate Menu
            </button>
          </div>
        </div>
      )}

      {/* Modals */}
      {/* Category Modal */}
      <AnimatePresence>
        {showCategoryModal && (
          <motion.div
            className="fixed inset-0 z-40 flex items-center justify-center bg-black/60"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: "spring", stiffness: 200, damping: 24 }}
              className="bg-slate-900 text-white border border-white/10 rounded-xl shadow-2xl w-[28rem] p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold mb-4">
                {categoryModalMode === "add" ? "Add Category" : "Edit Category"}
              </h3>

              <div className="mb-4">
                <label className="block text-white/70 text-xs mb-1">Name</label>
                <input
                  type="text"
                  className="w-full border border-white/10 bg-white/5 text-white placeholder:text-white/40 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-300/40"
                  placeholder="Category name"
                  value={categoryModalValue.name}
                  onChange={(e) => setCategoryModalValue((v) => ({ ...v, name: e.target.value }))}
                  autoFocus
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-white/70 text-xs">Icon</label>
                  <div className="flex items-center gap-2 text-xs text-white/60">
                    <span>Selected:</span>
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-white/5 border border-white/10">
                      <Icon token={categoryModalValue.icon || "empty"} fallback="🍽️" />
                      <code className="opacity-70">{categoryModalValue.icon || "none"}</code>
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-8 gap-2 max-h-40 overflow-y-auto p-2 rounded border border-white/10 bg-white/5">
                  {IconTokens.map((t) => (
                    <button
                      key={t}
                      type="button"
                      className={`p-2 rounded border transition ${
                        categoryModalValue.icon === t
                          ? "border-emerald-400 bg-emerald-500/20"
                          : "border-white/10 bg-white/5 hover:bg-white/10"
                      }`}
                      onClick={() => setCategoryModalValue((v) => ({ ...v, icon: t }))}
                      title={t}
                    >
                      <Icon token={t} fallback="🍽️" />
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 mt-5">
                <button
                  className="px-4 py-2 rounded bg-white/5 hover:bg-white/10 text-white/80"
                  onClick={() => setShowCategoryModal(false)}
                >
                  Cancel
                </button>
                <motion.button
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.96 }}
                  className="px-4 py-2 rounded bg-emerald-500 hover:bg-emerald-600 text-white font-medium"
                  onClick={handleCategoryModalSave}
                >
                  {categoryModalMode === "add" ? "Add" : "Save"}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Item Modal */}
      <AnimatePresence>
        {showItemModal && (
          <motion.div
            className="fixed inset-0 z-40 flex items-center justify-center bg-black/60"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: "spring", stiffness: 200, damping: 24 }}
              className="bg-slate-900 text-white border border-white/10 rounded-2xl shadow-2xl w-96 p-7"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold mb-4">
                {itemModalMode === "add" ? "Add Item" : "Edit Item"}
              </h3>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleItemModalSave();
                }}
              >
                <div className="mb-3">
                  <label className="block text-white/70 text-sm mb-1">Name</label>
                  <input
                    type="text"
                    className="w-full border border-white/10 bg-white/5 text-white placeholder:text-white/40 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-300/40"
                    placeholder="Item name"
                    value={itemModalValue.name}
                    onChange={(e) => setItemModalValue((v) => ({ ...v, name: e.target.value }))}
                    required
                  />
                </div>
                <div className="mb-3 flex gap-3">
                  <div className="flex-1">
                    <label className="block text-white/70 text-sm mb-1">Price (₹)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className="w-full border border-white/10 bg-white/5 text-white placeholder:text-white/40 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-300/40"
                      placeholder="Price"
                      value={itemModalValue.price}
                      onChange={(e) =>
                        setItemModalValue((v) => ({ ...v, price: e.target.value.replace(/^0+(?!\.)/, "") }))
                      }
                      required
                    />
                  </div>
                  <div className="w-24">
                    <label className="block text-white/70 text-sm mb-1">Tax %</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className="w-full border border-white/10 bg-white/5 text-white placeholder:text-white/40 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-300/40"
                      placeholder="Tax"
                      value={itemModalValue.tax}
                      onChange={(e) =>
                        setItemModalValue((v) => ({ ...v, tax: e.target.value.replace(/^0+(?!\.)/, "") }))
                      }
                    />
                  </div>
                </div>
                <div className="mb-3 flex gap-3">
                  <div className="flex-1">
                    <label className="block text-white/70 text-sm mb-1">Type</label>
                    <select
                      className="w-full border border-white/10 bg-white/5 text-white placeholder:text-white/40 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-300/40"
                      value={itemModalValue.type}
                      onChange={(e) => setItemModalValue((v) => ({ ...v, type: e.target.value }))}
                    >
                      <option value="veg">Veg</option>
                      <option value="nonveg">Non-Veg</option>
                    </select>
                  </div>
                  <div className="flex-1">
                    <label className="block text-white/70 text-sm mb-1">Image URL</label>
                    <input
                      type="url"
                      className="w-full border border-white/10 bg-white/5 text-white placeholder:text-white/40 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-300/40"
                      placeholder="https://..."
                      value={itemModalValue.image}
                      onChange={(e) => setItemModalValue((v) => ({ ...v, image: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between mb-3">
                  <label className="flex items-center gap-2 text-xs text-white/70">
                    <input
                      type="checkbox"
                      checked={itemModalValue.available !== false}
                      onChange={(e) => setItemModalValue((v) => ({ ...v, available: e.target.checked }))}
                    />
                    Available
                  </label>
                  <div className="text-xs text-white/50">Category: {selectedCategory?.name || "—"}</div>
                </div>
                <div className="flex justify-end gap-2 mt-1">
                  <button
                    type="button"
                    className="px-4 py-2 rounded bg-white/5 hover:bg-white/10 text-white/80"
                    onClick={() => setShowItemModal(false)}
                  >
                    Cancel
                  </button>
                  <motion.button
                    whileHover={{ scale: 1.04 }}
                    whileTap={{ scale: 0.96 }}
                    type="submit"
                    className="px-4 py-2 rounded bg-emerald-500 hover:bg-emerald-600 text-white font-medium"
                  >
                    {itemModalMode === "add" ? "Add" : "Save"}
                  </motion.button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Preview Modal */}
      <AnimatePresence>
        {showPreview && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 30, opacity: 0 }}
              transition={{ type: "spring", stiffness: 220, damping: 24 }}
              className="relative w-[92vw] max-w-6xl max-h-[86vh] overflow-hidden rounded-2xl border border-white/10 bg-slate-950 text-white shadow-2xl"
            >
              {/* header */}
              <div className="flex items-center gap-3 px-5 py-3 border-b border-white/10 bg-slate-900/60 backdrop-blur">
                <h3 className="text-lg font-semibold">Live Menu Preview</h3>
                <span className="text-white/50 text-sm">(what your staff/guests see)</span>
                <div className="flex-1" />
                <button onClick={() => setShowPreview(false)} className="rounded-lg px-3 py-2 text-sm bg-white/10 hover:bg-white/15">Close</button>
              </div>

              {/* body */}
              <div className="flex h-[72vh]">
                {/* categories chips */}
                <div className="w-56 border-r border-white/10 p-4 bg-white/5">
                  <div className="space-y-2">
                    {categories.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => setPreviewCategoryId(c.id)}
                        className={`w-full text-left px-3 py-2 rounded-lg transition border ${
                          previewCategoryId === c.id ? 'bg-emerald-500/15 border-emerald-300/30' : 'bg-white/5 border-white/10 hover:bg-white/10'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Icon token={c.icon || mapCategoryIdToIcon(c.id)} fallback={fallbackEmojiById(c.id)} />
                          <span className="truncate">{c.name}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* items grid */}
                <div className="flex-1 p-5 overflow-y-auto bg-[radial-gradient(1200px_600px_at_60%_20%,rgba(16,185,129,0.06),transparent),radial-gradient(1000px_500px_at_80%_80%,rgba(6,182,212,0.05),transparent)]">
                  <div className="mb-4 flex items-center gap-3">
                    <div className="relative max-w-sm w-full">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40">🔍</span>
                      <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search items…"
                        className="w-full pl-9 pr-3 py-2 rounded-xl border border-white/10 bg-white/5 text-white/90 placeholder:text-white/40 backdrop-blur outline-none text-sm focus:ring-2 focus:ring-emerald-300/40"
                      />
                    </div>
                    <div className="text-white/60 text-sm">{items.filter(i=>i.categoryId===previewCategoryId && (showUnavailable || isAvailable(i))).length} items</div>
                    <div className="flex-1" />
                    <label className="flex items-center gap-2 text-sm text-white/80">
                      <input type="checkbox" className="accent-emerald-400" checked={showUnavailable} onChange={(e)=>setShowUnavailable(e.target.checked)} />
                      Show unavailable
                    </label>
                    <button onClick={handleAddItem} className="rounded-lg bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 text-slate-900 px-3 py-2 text-sm font-semibold shadow hover:shadow-lg">+ Item</button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
                    {items
                      .filter(i=>i.categoryId===previewCategoryId)
                      .filter(i=> showUnavailable || isAvailable(i))
                      .filter(i=> !search.trim() || i.name.toLowerCase().includes(search.toLowerCase()))
                      .map((item)=> (
                        <div key={item.id} className={`relative rounded-2xl p-4 border border-white/10 bg-white/5 backdrop-blur shadow-[0_10px_30px_rgba(0,0,0,0.35)] ${isAvailable(item)?'':'opacity-60'}`}>
                          {item.image && <img src={item.image} alt={item.name} className="w-full h-28 object-cover rounded-lg mb-2 border border-white/10" onError={(e)=> (e.target.style.display='none')} />}
                          <div className="flex items-center gap-2">
                            {item.type === 'veg' ? (
                              <span className="w-3 h-3 bg-emerald-400 rounded-full border border-emerald-600" />
                            ) : (
                              <span className="w-3 h-3 bg-red-400 rounded-full border border-red-600" />
                            )}
                            <div className="font-medium truncate">{item.name}</div>
                            <div className="ml-auto font-semibold">₹{item.price}</div>
                          </div>
                          <div className="mt-3 flex items-center justify-between">
                            <label className="flex items-center gap-2 text-xs text-white/70">
                              <input type="checkbox" checked={isAvailable(item)} onChange={()=>toggleAvailability(item)} />
                              Available
                            </label>
                            <div className="flex gap-2 text-xs">
                              <button className="text-white/60 hover:text-emerald-300" onClick={()=>handleEditItem(item)}>Edit</button>
                              <button className="text-white/60 hover:text-red-400" onClick={()=>handleDeleteItem(item.id)}>Delete</button>
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CreateMenu;
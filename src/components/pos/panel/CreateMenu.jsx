import React, { useState, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { usePOSTheme } from "../POSThemeContext";

// Firebase / Firestore imports
import { db, storage } from "../../../firebase/firebaseConfig";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
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
import fetchGoogleImages from "../../../utils/fetchGoogleImages";

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

// ── Curated food image DB (watermark-free, Unsplash License) ────────────────
const FOOD_IMG_DB = [
  // Beverages
  { id:"b1", label:"Latte Art",      cat:"beverages", tags:"coffee latte hot espresso cappuccino cream",   url:"https://images.unsplash.com/photo-1495474472-8738373d1cf2?w=240&h=240&fit=crop&auto=format&q=75" },
  { id:"b2", label:"Iced Coffee",    cat:"beverages", tags:"cold coffee iced brew americano mocha",        url:"https://images.unsplash.com/photo-1461023058943-07fcbe16d735?w=240&h=240&fit=crop&auto=format&q=75" },
  { id:"b3", label:"Coffee Cup",     cat:"beverages", tags:"coffee cup espresso morning black",             url:"https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=240&h=240&fit=crop&auto=format&q=75" },
  { id:"b4", label:"Citrus Juice",   cat:"beverages", tags:"juice orange fresh citrus lemonade healthy",    url:"https://images.unsplash.com/photo-1500673922987-e212871fec22?w=240&h=240&fit=crop&auto=format&q=75" },
  { id:"b5", label:"Smoothie",       cat:"beverages", tags:"smoothie shake milkshake thick creamy",         url:"https://images.unsplash.com/photo-1553530666-ba11a7da3888?w=240&h=240&fit=crop&auto=format&q=75" },
  { id:"b6", label:"Cold Brew",      cat:"beverages", tags:"cold brew coffee glass iced dark",              url:"https://images.unsplash.com/photo-1461023058943-07fcbe16d735?w=240&h=240&fit=crop&auto=format&q=75" },
  // Indian
  { id:"i1", label:"Biryani",        cat:"indian",    tags:"biryani rice dum pulao basmati aromatic",      url:"https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=240&h=240&fit=crop&auto=format&q=75" },
  { id:"i2", label:"Paneer Curry",   cat:"indian",    tags:"paneer curry masala makhani butter tikka",     url:"https://images.unsplash.com/photo-1567620832903-9fc6debc209f?w=240&h=240&fit=crop&auto=format&q=75" },
  { id:"i3", label:"Butter Chicken", cat:"indian",    tags:"chicken butter tikka masala curry orange",     url:"https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?w=240&h=240&fit=crop&auto=format&q=75" },
  { id:"i4", label:"Dosa",           cat:"indian",    tags:"dosa masala south india crispy golden",        url:"https://images.unsplash.com/photo-1589301760014-8bbd4e1bc0e7?w=240&h=240&fit=crop&auto=format&q=75" },
  { id:"i5", label:"Indian Bread",   cat:"indian",    tags:"naan roti bread garlic paratha butter",        url:"https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=240&h=240&fit=crop&auto=format&q=75" },
  { id:"i6", label:"Samosa",         cat:"indian",    tags:"samosa snack fried crispy chaat potato",      url:"https://images.unsplash.com/photo-1601050690597-df0568f70950?w=240&h=240&fit=crop&auto=format&q=75" },
  // Fast Food
  { id:"f1", label:"Burger",         cat:"fastfood",  tags:"burger beef bun hamburger patty juicy",        url:"https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=240&h=240&fit=crop&auto=format&q=75" },
  { id:"f2", label:"Pizza",          cat:"fastfood",  tags:"pizza margherita cheese slice tomato",         url:"https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=240&h=240&fit=crop&auto=format&q=75" },
  { id:"f3", label:"Sandwich",       cat:"fastfood",  tags:"sandwich bread grilled toast club sub",        url:"https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=240&h=240&fit=crop&auto=format&q=75" },
  { id:"f4", label:"French Fries",   cat:"fastfood",  tags:"fries potato chips fried crispy golden",      url:"https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=240&h=240&fit=crop&auto=format&q=75" },
  { id:"f5", label:"Pasta",          cat:"fastfood",  tags:"pasta spaghetti noodles italian cheese",      url:"https://images.unsplash.com/photo-1555949258-eb67b1ef0ceb?w=240&h=240&fit=crop&auto=format&q=75" },
  { id:"f6", label:"Tacos",          cat:"fastfood",  tags:"taco wrap tortilla mexican street food",      url:"https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=240&h=240&fit=crop&auto=format&q=75" },
  // Desserts
  { id:"d1", label:"Chocolate Cake", cat:"desserts",  tags:"cake chocolate slice dessert sweet birthday",  url:"https://images.unsplash.com/photo-1563729784474-d77dce1ae7e5?w=240&h=240&fit=crop&auto=format&q=75" },
  { id:"d2", label:"Ice Cream",      cat:"desserts",  tags:"ice cream gelato scoop cone sweet",            url:"https://images.unsplash.com/photo-1488477181069-e10eb29e24e4?w=240&h=240&fit=crop&auto=format&q=75" },
  { id:"d3", label:"Croissant",      cat:"desserts",  tags:"croissant pastry bakery butter flaky",         url:"https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=240&h=240&fit=crop&auto=format&q=75" },
  { id:"d4", label:"Waffles",        cat:"desserts",  tags:"waffles syrup pancake breakfast sweet cream",  url:"https://images.unsplash.com/photo-1484723091739-30a097e8f929?w=240&h=240&fit=crop&auto=format&q=75" },
  // Healthy
  { id:"h1", label:"Green Salad",    cat:"healthy",   tags:"salad green healthy vegetable fresh bowl",    url:"https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=240&h=240&fit=crop&auto=format&q=75" },
  { id:"h2", label:"Buddha Bowl",    cat:"healthy",   tags:"bowl buddha quinoa grain healthy colorful",   url:"https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=240&h=240&fit=crop&auto=format&q=75" },
  { id:"h3", label:"Avocado Toast",  cat:"healthy",   tags:"avocado toast bread healthy breakfast egg",   url:"https://images.unsplash.com/photo-1541519227354-08fa5d50c820?w=240&h=240&fit=crop&auto=format&q=75" },
  { id:"h4", label:"Soup",           cat:"healthy",   tags:"soup tomato broth warm healthy comfort",      url:"https://images.unsplash.com/photo-1547592180-85f173990554?w=240&h=240&fit=crop&auto=format&q=75" },
  // Aesthetic
  { id:"a1", label:"Overhead Shot",  cat:"aesthetic", tags:"overhead flat lay food photography dark",     url:"https://images.unsplash.com/photo-1540914124281-342587941389?w=240&h=240&fit=crop&auto=format&q=75" },
  { id:"a2", label:"Dark & Moody",   cat:"aesthetic", tags:"dark moody elegant food background dramatic", url:"https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=240&h=240&fit=crop&auto=format&q=75" },
  { id:"a3", label:"Fine Dining",    cat:"aesthetic", tags:"fine dining elegant plated restaurant upscale",url:"https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=240&h=240&fit=crop&auto=format&q=75" },
  { id:"a4", label:"Café Morning",   cat:"aesthetic", tags:"cafe coffee morning breakfast aesthetic light", url:"https://images.unsplash.com/photo-1445116572660-236099ec97a0?w=240&h=240&fit=crop&auto=format&q=75" },
];

const autoDetectImgCat = (name) => {
  const n = (name || "").toLowerCase();
  if (/coffee|latte|cappuccino|espresso|chai|tea|juice|shake|smoothie|lassi|soda|drink|beverage|water/.test(n)) return "beverages";
  if (/biryani|paneer|curry|dal|tikka|masala|dosa|idli|samosa|naan|roti|paratha|chole|rajma|sabzi|khichdi/.test(n)) return "indian";
  if (/burger|pizza|sandwich|fries|wrap|taco|pasta|noodle|wings|nugget|hot dog|hotdog/.test(n)) return "fastfood";
  if (/cake|ice cream|dessert|sweet|brownie|pastry|waffle|gulab|kheer|halwa|pudding|cookie|tart/.test(n)) return "desserts";
  if (/salad|bowl|soup|healthy|avocado|quinoa|detox/.test(n)) return "healthy";
  return "all";
};

// ── PreviewItemCard ──────────────────────────────────────────────────────────
function PreviewItemCard({ item, onEdit, onToggle }) {
  const { tc } = usePOSTheme();
  const isVeg = (item.type || "").toLowerCase() === "veg";
  const available = item.available !== false;
  return (
    <div className={`relative rounded-2xl overflow-hidden border transition-all ${available ? "border-white/8 bg-white/4 hover:border-white/15 hover:bg-white/6" : "border-white/5 bg-white/2 opacity-50"}`}>
      {/* Image */}
      <div className={`relative w-full h-32 overflow-hidden ${tc.mutedBg}`}>
        {item.image ? (
          <img src={item.image} alt={item.name} className="w-full h-full object-cover" onError={e => e.currentTarget.style.display="none"} />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-4xl opacity-10">🍽️</div>
        )}
        {/* Veg badge — Indian standard square */}
        <div className={`absolute top-2 left-2 w-4 h-4 rounded-sm border-2 flex items-center justify-center ${isVeg ? "border-emerald-400 bg-black/60" : "border-red-400 bg-black/60"}`}>
          <div className={`w-2 h-2 rounded-full ${isVeg ? "bg-emerald-400" : "bg-red-400"}`} />
        </div>
        {!available && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
            <span className="text-[10px] font-bold text-white/50 bg-black/60 px-2 py-0.5 rounded-full uppercase tracking-wide">Unavailable</span>
          </div>
        )}
        {item.calories && (
          <div className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded-full bg-black/70 backdrop-blur text-[9px] text-amber-300/80 font-semibold">{item.calories} kcal</div>
        )}
      </div>
      {/* Body */}
      <div className="p-3">
        <p className="font-bold text-white/90 text-sm line-clamp-1 mb-0.5">{item.name}</p>
        {item.description && <p className="text-[10px] text-white/40 line-clamp-2 mb-1.5 leading-relaxed">{item.description}</p>}
        {item.ingredients && (
          <div className="flex flex-wrap gap-1 mb-1.5">
            {item.ingredients.split(",").slice(0,3).map((ing, i) => ing.trim() && (
              <span key={i} className="text-[9px] px-1.5 py-0.5 rounded-full bg-white/5 border border-white/8 text-white/35">{ing.trim()}</span>
            ))}
          </div>
        )}
        <div className="flex items-center justify-between mt-1">
          <span className="text-base font-black text-white">₹{item.price}</span>
          <div className="flex items-center gap-1.5">
            <button onClick={onToggle} className={`w-7 h-3.5 rounded-full transition-colors relative ${available ? "bg-emerald-500" : "bg-white/15"}`}>
              <span className={`absolute top-0.5 w-2.5 h-2.5 rounded-full bg-white shadow transition-all ${available ? "left-3.5" : "left-0.5"}`} />
            </button>
            <button onClick={onEdit} className="text-white/25 hover:text-emerald-300 transition text-xs">✏️</button>
          </div>
        </div>
        {item.tax > 0 && <p className="text-[9px] text-white/20 mt-0.5">{item.tax}% GST incl.</p>}
      </div>
    </div>
  );
}

// ---------- Component ----------
const CreateMenu = ({ onBack }) => {
  const { tc } = usePOSTheme();
  // State
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState("grid"); // 'grid' | 'list'
  const [showUnavailable, setShowUnavailable] = useState(false);

  const [categories, setCategories] = useState([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [items, setItems] = useState([]);

  const [activeTab, setActiveTab] = useState("manual"); // manual | quick | import
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
    images: [],
    categoryId: "",
    available: true,
    description: "",
    ingredients: "",
    calories: "",
  });
  const [itemModalTab, setItemModalTab] = useState("basic"); // basic | details | images
  const [aiDescKeywords, setAiDescKeywords] = useState("");
  const [aiDescGenerating, setAiDescGenerating] = useState(false);
  const [itemImageUploading, setItemImageUploading] = useState(false);
  const [itemContextMenu, setItemContextMenu] = useState(null); // { itemId, x, y }
  const [showTemplatePreview, setShowTemplatePreview] = useState(null); // template key
  const [aiCalorieGenerating, setAiCalorieGenerating] = useState(false);
  const [imgSubTab, setImgSubTab] = useState("pick"); // "pick" | "upload" | "url"
  const [imgPickSearch, setImgPickSearch] = useState("");
  const [imgPickCat, setImgPickCat] = useState("all");
  const [googleImgQuery,   setGoogleImgQuery]   = useState("");
  const [googleImgResults, setGoogleImgResults] = useState([]);
  const [googleImgLoading, setGoogleImgLoading] = useState(false);
  const [showGstField,     setShowGstField]     = useState(false);
  const [imgPreviewIdx,    setImgPreviewIdx]    = useState(0);

  const [aiForm, setAiForm] = useState({
    industry: "restaurant",   // restaurant | cafe | pizzeria | bar | fastfood
    cuisine: "north",         // north | south | continental | mixed
    priceBand: "mid",         // low | mid | high
    vegRatio: 70,             // % veg items
  });

  const fileInputRef = useRef(null);
  const importDropRef = useRef(null);

  // ── Smart Import state ──────────────────────────────────────────────────────
  const [importFiles, setImportFiles] = useState([]); // [{ file, preview, id }]
  const [importScanning, setImportScanning] = useState(false);
  const [importResults, setImportResults] = useState([]); // parsed menu rows
  const [importHint, setImportHint] = useState(""); // e.g. "North Indian restaurant"
  const [importDragging, setImportDragging] = useState(false);
  const [importToast, setImportToast] = useState(null);
  const [importSaving, setImportSaving] = useState(false);

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

  // ── Item Modal helpers ──────────────────────────────────────────────────────
  const generateAIDescription = () => {
    const name = itemModalValue.name.trim();
    const kw = (aiDescKeywords || name).toLowerCase();
    const isVeg = normalizeType(itemModalValue.type) === "veg";
    setAiDescGenerating(true);

    const has = (...words) => words.some(w => kw.includes(w));
    const spicy   = has("spicy","hot","fiery","bold","chili","pepper","masala","tikka");
    const creamy  = has("creamy","rich","buttery","smooth","malai","makhani","cheese","paneer");
    const fresh   = has("fresh","light","healthy","crisp","garden","salad","green","mint");
    const smoky   = has("smoky","grilled","tandoor","charred","bbq","coal","roasted");
    const sweet   = has("sweet","caramel","chocolate","dessert","sugar","honey","halwa","gulab");
    const tangy   = has("tangy","sour","tamarind","lemon","lime","amchur","chaat","pickle");
    const crispy  = has("crispy","crunchy","fried","golden","deep fried","pakora");
    const biryani = has("biryani","pulao","dum");
    const cafe    = has("coffee","latte","cappuccino","cold brew","espresso");

    const flavor = spicy   ? "bold, fiery spices" :
                   creamy  ? "a lusciously rich and creamy sauce" :
                   fresh   ? "light, garden-fresh ingredients" :
                   smoky   ? "a deep, smoky char from the tandoor" :
                   sweet   ? "a delicate sweetness and comforting warmth" :
                   tangy   ? "a zesty, tangy punch of flavor" :
                   crispy  ? "an irresistibly crispy golden crust" :
                   biryani ? "fragrant basmati, whole spices and slow dum cooking" :
                   cafe    ? "carefully sourced beans and expert brewing" :
                   "a harmonious blend of hand-picked spices";

    const method = smoky   ? "slow-cooked over a wood flame" :
                   biryani ? "sealed in a dum vessel to lock in every aroma" :
                   crispy  ? "fried to perfection for that signature crunch" :
                   creamy  ? "simmered low and slow until velvety smooth" :
                   "prepared fresh to order";

    const vibe = isVeg
      ? ["A vegetarian delight", "Pure vegetarian comfort", "A plant-based masterpiece"][Math.floor(Math.random()*3)]
      : ["A non-vegetarian classic", "A protein-rich indulgence", "A chef's signature"  ][Math.floor(Math.random()*3)];

    const pairings = creamy || biryani ? "raita or a squeeze of fresh lemon" :
                     spicy             ? "a cooling mint chutney or lassi" :
                     cafe              ? "a buttery croissant or slice of cake" :
                     crispy            ? "our house dipping sauce" :
                     "naan or steamed rice";

    const kwIngr = aiDescKeywords.trim()
      ? `featuring ${aiDescKeywords.trim()}`
      : "made with premium, hand-picked ingredients";

    const closing = [
      "A must-try for anyone who loves bold, authentic flavors.",
      "Every bite tells a story of tradition, care, and culinary passion.",
      "Crafted with love — a true crowd favourite that keeps guests coming back.",
      "Ideal for sharing, though once you taste it, you may not want to!",
      "An absolute staple — order it once and it becomes your go-to.",
    ][Math.floor(Math.random()*5)];

    const desc = `${name || "This dish"} is ${vibe} ${kwIngr}, celebrated for ${flavor}. It is ${method}, ensuring every serving is packed with depth and authenticity. Best enjoyed with ${pairings} to complete the experience. ${closing}`;

    setTimeout(() => {
      setItemModalValue(v => ({ ...v, description: desc }));
      setAiDescGenerating(false);
    }, 900);
  };

  const suggestAICalories = () => {
    const combined = (itemModalValue.name + " " + (itemModalValue.ingredients || "")).toLowerCase();
    const has = (...words) => words.some(w => combined.includes(w));
    setAiCalorieGenerating(true);
    setTimeout(() => {
      let cal = 220;
      if (has("biryani","pulao","fried rice")) cal = 380 + Math.floor(Math.random()*80);
      else if (has("burger","pizza","sandwich","wrap")) cal = 420 + Math.floor(Math.random()*120);
      else if (has("chicken","mutton","fish","prawn","egg")) cal = 290 + Math.floor(Math.random()*90);
      else if (has("paneer","cheese","cream","butter","makhani")) cal = 310 + Math.floor(Math.random()*90);
      else if (has("halwa","gulab","kheer","ice cream","cake","brownie")) cal = 340 + Math.floor(Math.random()*100);
      else if (has("salad","raita","soup")) cal = 75 + Math.floor(Math.random()*55);
      else if (has("dal","lentil")) cal = 170 + Math.floor(Math.random()*60);
      else if (has("tea","chai","coffee")) cal = 50 + Math.floor(Math.random()*50);
      else if (has("juice","shake","lassi","smoothie")) cal = 130 + Math.floor(Math.random()*80);
      else if (has("bread","naan","roti","paratha")) cal = 180 + Math.floor(Math.random()*80);
      else cal = 200 + Math.floor(Math.random()*120);
      setItemModalValue(v => ({ ...v, calories: String(cal) }));
      setAiCalorieGenerating(false);
    }, 700);
  };

  const handleItemImageUpload = async (files) => {
    const valid = Array.from(files).filter(f => f.type.startsWith("image/") && f.size <= 8 * 1024 * 1024);
    if (!valid.length) return;
    const uid = getUid();
    if (!uid) return;
    setItemImageUploading(true);
    try {
      const urls = [];
      for (const file of valid) {
        const path = `businesses/${uid}/menuItems/${Date.now()}-${file.name}`;
        const sRef = storageRef(storage, path);
        await uploadBytes(sRef, file);
        const url = await getDownloadURL(sRef);
        urls.push(url);
      }
      setItemModalValue(v => ({
        ...v,
        images: [...(v.images || []), ...urls],
        image: v.image || urls[0] || "",
      }));
    } catch (e) {
      console.error("Image upload error:", e);
    }
    setItemImageUploading(false);
  };

  const handleMoveItemToCategory = async (itemId, newCategoryId) => {
    const uid = getUid();
    if (!uid) return;
    try {
      await updateDoc(doc(db, "businesses", uid, "items", itemId), { categoryId: newCategoryId });
      setItems(prev => prev.map(i => i.id === itemId ? { ...i, categoryId: newCategoryId } : i));
    } catch (e) {
      console.error("Move item error:", e);
    }
    setItemContextMenu(null);
  };

  // ── Smart Import helpers ────────────────────────────────────────────────────
  const showImportToast = (msg, type = "info") => {
    setImportToast({ msg, type });
    setTimeout(() => setImportToast(null), 3500);
  };

  const toBase64 = (file) =>
    new Promise((res, rej) => {
      const r = new FileReader();
      r.readAsDataURL(file);
      r.onload = () => res(r.result.split(",")[1]);
      r.onerror = rej;
    });

  const handleImportFiles = (files) => {
    const valid = Array.from(files).filter(
      (f) => f.size <= 10 * 1024 * 1024 && (f.type.startsWith("image/") || f.type === "application/pdf")
    );
    if (!valid.length) { showImportToast("Only images or PDFs under 10MB", "error"); return; }
    const newEntries = valid.map((file) => {
      const id = Math.random().toString(36).slice(2);
      const preview = file.type.startsWith("image/") ? URL.createObjectURL(file) : null;
      return { id, file, preview };
    });
    setImportFiles((prev) => [...prev, ...newEntries]);
  };

  const handleImportScan = async () => {
    if (!importFiles.length) { showImportToast("Add at least one file first", "error"); return; }
    setImportScanning(true);
    setImportResults([]);
    const aiUrl =
      (typeof import.meta !== "undefined" && import.meta.env?.VITE_PARSE_CATALOGUE_AI_URL) ||
      "https://us-central1-stockpilotv1.cloudfunctions.net/parseCatalogueWithAI";

    const allRows = [];
    for (const entry of importFiles) {
      try {
        const b64 = await toBase64(entry.file);
        const isPdf = entry.file.type === "application/pdf";
        const body = isPdf
          ? { pdfBase64: b64, mimeType: "application/pdf" }
          : { imageBase64: b64 };
        body.menuHint = importHint.trim() || "restaurant menu — extract dish name, price, veg or non-veg type, category";
        const ctrl = new AbortController();
        const tid = setTimeout(() => ctrl.abort(), 130000);
        const resp = await fetch(aiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: ctrl.signal,
        });
        clearTimeout(tid);
        const data = await resp.json();
        const products = data?.products || [];
        products.forEach((p) => {
          const rawType = String(p.type || p.brand || "").toLowerCase();
          const isNonVeg = rawType.includes("nonveg") || rawType.includes("non-veg") || rawType.includes("nonvegetarian") || rawType.includes("chicken") || rawType.includes("mutton") || rawType.includes("fish") || rawType.includes("egg") || rawType.includes("meat");
          allRows.push({
            _id: Math.random().toString(36).slice(2),
            name: p.name || p.productName || "",
            price: String(p.price || p.sellingPrice || ""),
            tax: String(p.tax || "5"),
            type: isNonVeg ? "nonveg" : "veg",
            categoryId: (p.category || "").toLowerCase().replace(/\s+/g, "") || "general",
            categoryName: p.category || "General",
            available: true,
          });
        });
      } catch (err) {
        console.error("Import scan error for", entry.file.name, err);
      }
    }

    if (!allRows.length) {
      showImportToast("No items found. Try a clearer image or add a hint.", "error");
    } else {
      setImportResults(allRows);
      showImportToast(`✅ Found ${allRows.length} items — review and save`, "success");
    }
    setImportScanning(false);
  };

  const updateImportRow = (id, field, value) => {
    setImportResults((prev) => prev.map((r) => r._id === id ? { ...r, [field]: value } : r));
  };

  const removeImportRow = (id) => {
    setImportResults((prev) => prev.filter((r) => r._id !== id));
  };

  const handleImportSave = async () => {
    if (!importResults.length) return;
    setImportSaving(true);
    try {
      const uniqueCats = [...new Map(
        importResults.map((r) => [r.categoryId, { id: r.categoryId, name: r.categoryName || r.categoryId }])
      ).values()];
      await ensureCategoriesExist(uniqueCats);
      await seedItemsBulk(
        importResults
          .filter((r) => r.name.trim())
          .map((r) => ({
            name: r.name.trim(),
            price: parseFloat(r.price) || 0,
            tax: parseFloat(r.tax) || 5,
            type: normalizeType(r.type),
            categoryId: r.categoryId,
            available: r.available !== false,
            image: "",
          }))
      );
      if (uniqueCats[0]) setSelectedCategoryId(uniqueCats[0].id);
      setImportResults([]);
      setImportFiles([]);
      setActiveTab("manual");
      showImportToast(`✅ ${importResults.length} items saved to menu!`, "success");
    } catch (e) {
      console.error("Import save error:", e);
      showImportToast("Failed to save items", "error");
    }
    setImportSaving(false);
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

  // Auto-detect image category when switching to photos tab
  useEffect(() => {
    if (itemModalTab === "images") {
      setImgPickCat(autoDetectImgCat(itemModalValue.name));
      setImgPickSearch("");
      setImgSubTab("pick");
    }
  }, [itemModalTab]); // eslint-disable-line

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
    setItemModalTab("basic");
    setAiDescKeywords("");
    setShowGstField(false);
    setGoogleImgResults([]);
    setGoogleImgQuery("");
    setItemModalValue({
      id: "",
      name: "",
      price: "",
      tax: "",
      type: "veg",
      image: "",
      images: [],
      categoryId: selectedCategoryId || (categories[0]?.id ?? ""),
      available: true,
      description: "",
      ingredients: "",
      calories: "",
    });
    setShowItemModal(true);
  };

  const handleEditItem = (item) => {
    setItemModalMode("edit");
    setItemModalTab("basic");
    setAiDescKeywords("");
    setShowGstField(!!(item.tax && parseFloat(item.tax) > 0));
    setGoogleImgResults([]);
    setGoogleImgQuery(item.name || "");
    setItemModalValue({
      ...item,
      images: item.images || [],
      description: item.description || "",
      ingredients: item.ingredients || "",
      calories: item.calories || "",
    });
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
    <div className="relative w-full h-full min-h-screen overflow-y-auto" style={tc.bg}>
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 -left-16 w-[60%] h-[60%] rounded-full blur-[120px]" style={{ background: `radial-gradient(circle, ${tc.auroraBlob2} 0%, transparent 65%)` }} />
        <div className="absolute -bottom-32 -right-16 w-[55%] h-[55%] rounded-full blur-[120px]" style={{ background: `radial-gradient(circle, ${tc.auroraBlob1} 0%, transparent 65%)` }} />
      </div>

      {/* Top Bar */}
      <div className={`sticky top-0 z-30 ${tc.headerBg}`}>
        <div className="px-4 py-3 flex items-center gap-3">
          {onBack && (
            <motion.button
              onClick={onBack}
              whileHover={{ scale: 1.04, x: -1 }}
              whileTap={{ scale: 0.97 }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${tc.backBtn}`}
            >
              ← Back to POS
            </motion.button>
          )}
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-emerald-500/25 to-teal-500/15 border border-emerald-400/20 flex items-center justify-center text-sm">📜</div>
            <h1 className={`text-sm font-bold ${tc.textPrimary}`}>Menu Builder</h1>
          </div>
          <div className="flex-1" />
          {/* Tab Bar */}
          <div className={`flex items-center gap-1 p-0.5 rounded-xl border ${tc.mutedBg} ${tc.borderSoft}`}>
            {["manual", "quick", "import"].map((t) => (
              <motion.button
                key={t}
                whileTap={{ scale: 0.96 }}
                onClick={() => setActiveTab(t)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeTab === t
                    ? t === "import"
                      ? "bg-gradient-to-r from-violet-500 to-indigo-500 text-white shadow-md shadow-violet-500/20"
                      : "bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-md shadow-emerald-500/20"
                    : `${tc.textMuted} hover:bg-white/[0.06]`
                }`}
              >
                {t === "manual" ? "✏️ Manual" : t === "quick" ? "⚡ Quick Start" : "🤖 Smart Import"}
              </motion.button>
            ))}
          </div>
          <div className="hidden md:flex items-center gap-2">
            <div className="relative">
              <span className={`absolute left-3 top-1/2 -translate-y-1/2 ${tc.textMuted}`}>🔍</span>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search items…"
                className={`pl-9 pr-3 py-2 rounded-xl backdrop-blur outline-none text-sm focus:ring-2 focus:ring-emerald-400/30 w-44 ${tc.inputBg}`}
              />
            </div>
            <div className={`inline-flex rounded-xl overflow-hidden border ${tc.borderSoft} ${tc.mutedBg}`}>
              <button
                onClick={() => setViewMode("grid")}
                className={`px-3 py-2 text-xs font-semibold transition-all ${
                  viewMode === "grid" ? `bg-white/12 ${tc.textPrimary}` : `${tc.textMuted} hover:bg-white/[0.05]`
                }`}
              >
                Grid
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`px-3 py-2 text-xs font-semibold transition-all ${
                  viewMode === "list" ? `bg-white/12 ${tc.textPrimary}` : `${tc.textMuted} hover:bg-white/[0.05]`
                }`}
              >
                List
              </button>
            </div>
            <label className={`flex items-center gap-2 text-xs cursor-pointer ${tc.textSub}`}>
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
            className={`ml-2 rounded-lg px-3 py-2 text-sm ${
              items.length === 0
                ? "bg-emerald-500 text-slate-900 font-semibold shadow hover:shadow-lg"
                : `border ${tc.borderSoft} ${tc.textSub} hover:bg-white/5`
            }`}
          >
            Quick Start
          </button>
          <button
            onClick={() => setShowPreview(true)}
            className={`ml-2 rounded-lg border px-3 py-2 text-sm hover:bg-white/5 ${tc.borderSoft} ${tc.textSub}`}
          >
            Preview Menu
          </button>
          <button
            onClick={handleAddCategory}
            className={`ml-2 rounded-lg border px-3 py-2 text-sm hover:bg-white/5 ${tc.borderSoft} ${tc.textSub}`}
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
          <div className={`w-1/4 min-w-[210px] backdrop-blur flex flex-col rounded-xl border ${tc.cardBg}`}>
            <div className={`flex items-center justify-between p-4 border-b ${tc.borderSoft}`}>
              <h2 className={`text-lg font-semibold tracking-wide ${tc.textSub}`}>Categories</h2>
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
              {categories.length === 0 && <div className={`text-center mt-8 ${tc.textMuted}`}>No categories</div>}
              {categories.map((cat) => (
                <motion.div
                  key={cat.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.12 }}
                  className={`group flex items-center mb-2 last:mb-0 rounded-lg px-3 py-2 cursor-pointer transition ${
                    selectedCategoryId === cat.id ? "ring-2 ring-emerald-400/60 bg-white/10" : "hover:bg-white/5"
                  }`}
                  onClick={() => setSelectedCategoryId(cat.id)}
                >
                  <span className={`mr-2 ${tc.textSub}`}>
                    <Icon token={cat.icon || mapCategoryIdToIcon(cat.id)} fallback={fallbackEmojiById(cat.id)} className="w-5 h-5" />
                  </span>
                  <span className={`flex-1 font-medium truncate ${tc.textSub}`}>{cat.name}</span>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-2">
                    <button
                      className={`text-xs px-1 hover:text-emerald-300 ${tc.textMuted}`}
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
                      className={`text-xs px-1 hover:text-red-400 ${tc.textMuted}`}
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
          <div className={`flex-1 flex flex-col ml-4 rounded-xl border backdrop-blur ${tc.cardBg}`}>
            <div className={`flex items-center justify-between px-6 py-4 border-b ${tc.borderSoft}`}>
              <h2 className={`text-lg font-semibold tracking-wide ${tc.textSub}`}>
                {selectedCategory ? selectedCategory.name : "Select a Category"}
              </h2>
              <div className="md:hidden flex-1" />
              <div className="md:hidden flex items-center gap-2">
                <div className="relative">
                  <span className={`absolute left-3 top-1/2 -translate-y-1/2 ${tc.textMuted}`}>🔍</span>
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search items…"
                    className={`pl-9 pr-3 py-2 rounded-xl backdrop-blur outline-none text-sm focus:ring-2 focus:ring-emerald-300/40 ${tc.inputBg}`}
                  />
                </div>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-6 bg-[radial-gradient(1200px_600px_at_60%_20%,rgba(16,185,129,0.06),transparent),radial-gradient(1000px_500px_at_80%_80%,rgba(6,182,212,0.05),transparent)]">
              {selectedCategory ? (
                viewMode === "grid" ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    <AnimatePresence mode="popLayout">
                      {itemsInCategoryFiltered.length === 0 && (
                        <motion.div
                          key="no-items"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.15 }}
                          className={`col-span-full text-center mt-8 ${tc.textMuted}`}
                        >
                          No items match your filters.
                        </motion.div>
                      )}
                      {itemsInCategoryFiltered.map((item) => (
                        <motion.div
                          key={item.id}
                          initial={{ opacity: 0, scale: 0.97 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.97 }}
                          transition={{ duration: 0.15 }}
                          className={`relative flex flex-col rounded-2xl overflow-hidden group border transition-all duration-200 ${
                            item.available === false
                              ? `${tc.cardBg} opacity-55`
                              : normalizeType(item.type) === "veg"
                                ? "border-emerald-500/20 bg-gradient-to-b from-slate-800 to-slate-800/80 hover:border-emerald-400/50 hover:shadow-[0_8px_32px_rgba(16,185,129,0.18)]"
                                : "border-red-500/20 bg-gradient-to-b from-slate-800 to-slate-800/80 hover:border-red-400/50 hover:shadow-[0_8px_32px_rgba(239,68,68,0.15)]"
                          }`}
                        >
                          {/* Image area */}
                          <div className={`relative w-full h-32 overflow-hidden ${tc.mutedBg}`}>
                            {item.image ? (
                              <img src={item.image} alt={item.name} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-108" onError={e => e.currentTarget.style.display="none"} />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <span className="text-5xl opacity-10">🍽️</span>
                              </div>
                            )}
                            {/* Gradient overlay for legibility */}
                            <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-transparent to-transparent pointer-events-none" />

                            {/* Veg/NonVeg badge */}
                            <div className={`absolute top-2 left-2 w-5 h-5 rounded border-2 flex items-center justify-center shadow-md ${normalizeType(item.type) === "veg" ? "border-emerald-400 bg-black/70" : "border-red-400 bg-black/70"}`}>
                              <div className={`w-2.5 h-2.5 rounded-full ${normalizeType(item.type) === "veg" ? "bg-emerald-400" : "bg-red-400"}`} />
                            </div>

                            {/* Price badge overlaid on image */}
                            <div className="absolute bottom-2 left-2">
                              <span className="px-2 py-0.5 rounded-lg bg-black/70 backdrop-blur text-white font-black text-sm">₹{item.price}</span>
                            </div>

                            {/* ⋯ menu — always visible, clear purpose */}
                            <div className="absolute top-1.5 right-1.5">
                              <div className="relative">
                                <button
                                  onClick={e => { e.stopPropagation(); setItemContextMenu(itemContextMenu?.itemId === item.id ? null : { itemId: item.id }); }}
                                  className="w-7 h-7 rounded-lg bg-black/70 backdrop-blur text-white/80 hover:text-white hover:bg-black/90 flex items-center justify-center text-sm font-bold transition border border-white/15"
                                  title="Actions"
                                >⋯</button>
                                {itemContextMenu?.itemId === item.id && (
                                  <div className={`absolute right-0 top-8 z-50 w-48 rounded-2xl border shadow-2xl backdrop-blur-xl overflow-hidden text-xs ${tc.modalBg}`}>
                                    {/* Quick actions */}
                                    <button onClick={() => { handleEditItem(item); setItemContextMenu(null); }} className="w-full px-3.5 py-2.5 text-left text-emerald-300 hover:bg-emerald-500/12 transition flex items-center gap-2 font-semibold">
                                      <span className="text-base">✏️</span> Edit item
                                    </button>
                                    <button onClick={() => { handleDeleteItem(item.id); setItemContextMenu(null); }} className="w-full px-3.5 py-2.5 text-left text-red-400 hover:bg-red-500/12 transition flex items-center gap-2 font-semibold border-b border-white/8">
                                      <span className="text-base">🗑️</span> Delete item
                                    </button>
                                    {/* Move to category */}
                                    {categories.filter(c => c.id !== item.categoryId).length > 0 && (
                                      <>
                                        <div className={`px-3 pt-2 pb-1 font-semibold uppercase tracking-wider text-[9px] ${tc.textMuted}`}>Move to</div>
                                        {categories.filter(c => c.id !== item.categoryId).map(c => (
                                          <button key={c.id} onClick={() => handleMoveItemToCategory(item.id, c.id)} className="w-full px-3.5 py-2 text-left text-white/60 hover:bg-white/8 hover:text-white transition flex items-center gap-2">
                                            <Icon token={c.icon || mapCategoryIdToIcon(c.id)} fallback={fallbackEmojiById(c.id)} className="w-3 h-3" />
                                            {c.name}
                                          </button>
                                        ))}
                                      </>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Unavailable overlay */}
                            {item.available === false && (
                              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                                <span className="px-2.5 py-1 rounded-lg bg-black/70 text-white/50 text-[10px] font-bold uppercase tracking-widest">Unavailable</span>
                              </div>
                            )}
                          </div>

                          {/* Card body */}
                          <div className="p-3 flex flex-col gap-1">
                            <span className={`text-sm font-bold leading-tight line-clamp-1 ${tc.textPrimary}`}>{item.name}</span>
                            {item.description
                              ? <p className={`text-[10px] line-clamp-2 leading-relaxed ${tc.textSub}`}>{item.description}</p>
                              : <p className={`text-[10px] italic ${tc.textMuted}`}>No description</p>
                            }
                            <div className={`flex items-center justify-between mt-1 pt-1.5 border-t ${tc.borderSoft}`}>
                              <button
                                onClick={() => toggleAvailability(item)}
                                className={`flex items-center gap-1.5 text-[10px] font-bold transition ${item.available !== false ? "text-emerald-400" : "text-white/30"}`}
                              >
                                <span className={`w-7 h-3.5 rounded-full transition-colors relative inline-flex items-center ${item.available !== false ? "bg-emerald-500" : "bg-white/15"}`}>
                                  <span className={`absolute w-2.5 h-2.5 rounded-full bg-white shadow transition-all ${item.available !== false ? "left-3.5" : "left-0.5"}`} />
                                </span>
                                {item.available !== false ? "Available" : "Off"}
                              </button>
                              <div className="flex items-center gap-1">
                                {item.calories && <span className="text-[9px] text-amber-300/50 bg-amber-500/8 border border-amber-500/15 px-1.5 py-0.5 rounded-full">{item.calories}k</span>}
                                {item.tax > 0 && <span className={`text-[9px] ${tc.textMuted}`}>{item.tax}%</span>}
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                ) : (
                  <div className={`divide-y rounded-xl border ${tc.borderSoft}`}>
                    {itemsInCategoryFiltered.map((item) => (
                      <div key={item.id} className={`flex items-center gap-3 p-3 ${item.available === false ? "opacity-60" : ""}`}>
                        {item.image ? (
                          <img src={item.image} alt={item.name} className={`w-14 h-14 rounded object-cover border ${tc.borderSoft}`} />
                        ) : (
                          <div className={`w-14 h-14 rounded border ${tc.mutedBg} ${tc.borderSoft}`} />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className={`font-medium truncate ${tc.textSub}`}>{item.name}</div>
                          <div className={`text-xs ${tc.textMuted}`}>Tax {item.tax}% • {normalizeType(item.type) === "veg" ? "veg" : "non-veg"}</div>
                        </div>
                        <div className={`w-24 text-right font-semibold ${tc.textSub}`}>₹{item.price}</div>
                        <label className={`ml-2 flex items-center gap-1 text-xs ${tc.textMuted}`}>
                          <input type="checkbox" checked={item.available !== false} onChange={() => toggleAvailability(item)} />
                          Available
                        </label>
                        <button className={`ml-2 text-xs hover:text-emerald-300 ${tc.textMuted}`} onClick={() => handleEditItem(item)}>Edit</button>
                        <button className={`ml-1 text-xs hover:text-red-400 ${tc.textMuted}`} onClick={() => handleDeleteItem(item.id)}>Delete</button>
                      </div>
                    ))}
                  </div>
                )
              ) : (
                <div className={`text-center mt-8 ${tc.textMuted}`}>Select a category to view items.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Quick Start Panel */}
      {activeTab === "quick" && (
        <div className="relative z-20 mx-4 md:mx-6 mb-6 space-y-6">
          {/* Header */}
          <div className="flex items-center gap-4">
            <div>
              <h2 className={`text-xl font-bold ${tc.textPrimary}`}>⚡ Quick Start</h2>
              <p className={`text-sm mt-0.5 ${tc.textMuted}`}>Pick a template and be ready in under 60 seconds</p>
            </div>
            <div className="ml-auto flex gap-2">
              <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={e => handleCSVUpload(e.target.files?.[0])} />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 rounded-xl text-sm font-semibold border border-white/15 text-white/70 hover:bg-white/8 hover:text-white transition flex items-center gap-2"
              >📊 Import CSV</button>
              <button
                onClick={() => setActiveTab("import")}
                className="px-4 py-2 rounded-xl text-sm font-semibold bg-gradient-to-r from-violet-500/20 to-indigo-500/20 border border-violet-500/30 text-violet-300 hover:from-violet-500/30 hover:to-indigo-500/30 transition flex items-center gap-2"
              >🤖 Import from Photo/PDF</button>
            </div>
          </div>

          {/* Template Cards */}
          {(() => {
            const TEMPLATE_META = {
              cafe:     { emoji: "☕", gradient: "from-amber-500/20 via-orange-500/10 to-transparent", border: "border-amber-500/25", accent: "text-amber-300", badge: "bg-amber-500/15 text-amber-300 border-amber-500/30" },
              north:    { emoji: "🍛", gradient: "from-orange-500/20 via-red-500/10 to-transparent", border: "border-orange-500/25", accent: "text-orange-300", badge: "bg-orange-500/15 text-orange-300 border-orange-500/30" },
              south:    { emoji: "🥥", gradient: "from-green-500/20 via-emerald-500/10 to-transparent", border: "border-green-500/25", accent: "text-green-300", badge: "bg-green-500/15 text-green-300 border-green-500/30" },
              pizzeria: { emoji: "🍕", gradient: "from-red-500/20 via-rose-500/10 to-transparent", border: "border-red-500/25", accent: "text-red-300", badge: "bg-red-500/15 text-red-300 border-red-500/30" },
              fastfood: { emoji: "🍔", gradient: "from-yellow-500/20 via-amber-500/10 to-transparent", border: "border-yellow-500/25", accent: "text-yellow-300", badge: "bg-yellow-500/15 text-yellow-300 border-yellow-500/30" },
              bar:      { emoji: "🍹", gradient: "from-purple-500/20 via-indigo-500/10 to-transparent", border: "border-purple-500/25", accent: "text-purple-300", badge: "bg-purple-500/15 text-purple-300 border-purple-500/30" },
              bakery:   { emoji: "🎂", gradient: "from-pink-500/20 via-rose-500/10 to-transparent", border: "border-pink-500/25", accent: "text-pink-300", badge: "bg-pink-500/15 text-pink-300 border-pink-500/30" },
            };
            return (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {Object.entries(MENU_TEMPLATES).map(([key, tpl]) => {
                  const meta = TEMPLATE_META[key] || TEMPLATE_META.cafe;
                  return (
                    <motion.button
                      key={key}
                      whileHover={{ scale: 1.02, y: -2 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setShowTemplatePreview(key)}
                      className={`relative text-left rounded-2xl border ${meta.border} bg-gradient-to-br ${meta.gradient} backdrop-blur-sm overflow-hidden p-5 group transition-all hover:shadow-xl shadow-sm`}
                    >
                      {/* Glow */}
                      <div className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-br from-white/5 to-transparent" />

                      <div className="text-4xl mb-3 select-none">{meta.emoji}</div>
                      <div className={`font-bold text-sm mb-1 ${tc.textPrimary}`}>{tpl.label}</div>
                      <div className={`text-[11px] mb-3 leading-relaxed ${tc.textMuted}`}>{tpl.description}</div>

                      {/* Sample items */}
                      <div className="space-y-0.5 mb-3">
                        {tpl.items.slice(0, 3).map((item, i) => (
                          <div key={i} className={`flex items-center gap-1.5 text-[10px] ${tc.textMuted}`}>
                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${normalizeType(item.type) === "veg" ? "bg-emerald-400" : "bg-red-400"}`} />
                            <span className="truncate">{item.name}</span>
                            <span className={`ml-auto shrink-0 ${tc.textMuted}`}>₹{item.price}</span>
                          </div>
                        ))}
                        {tpl.items.length > 3 && <div className="text-[10px] text-white/25">+{tpl.items.length - 3} more</div>}
                      </div>

                      <div className="flex items-center justify-between">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${meta.badge}`}>
                          {tpl.categories.length} cats · {tpl.items.length} items
                        </span>
                        <span className={`text-xs font-bold ${meta.accent} opacity-0 group-hover:opacity-100 transition-opacity`}>Apply →</span>
                      </div>
                    </motion.button>
                  );
                })}

                {/* Start empty card */}
                <motion.button
                  whileHover={{ scale: 1.02, y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setActiveTab("manual")}
                  className="text-left rounded-2xl border border-white/8 bg-white/3 hover:bg-white/5 hover:border-white/15 backdrop-blur p-5 transition-all group"
                >
                  <div className="text-4xl mb-3 select-none opacity-30">✏️</div>
                  <div className="font-bold text-white/40 text-sm mb-1">Start Empty</div>
                  <div className="text-[11px] text-white/25 mb-3">Add categories and items manually at your own pace.</div>
                  <span className="text-[10px] font-semibold text-white/20 group-hover:text-white/40 transition">Go to Manual →</span>
                </motion.button>
              </div>
            );
          })()}

          {/* CSV Import info */}
          <div className="rounded-2xl border border-white/8 bg-white/3 p-5">
            <div className="flex items-start gap-4">
              <div className="text-2xl shrink-0">📊</div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-white/70 mb-1">Import from Google Sheets / Excel / CSV</p>
                <p className="text-xs text-white/40 mb-3">Export your existing menu as CSV with these columns and upload:</p>
                <pre className="text-[11px] text-emerald-300/60 bg-black/30 rounded-xl px-4 py-2.5 overflow-x-auto font-mono border border-white/5">
{`name,categoryId,price,tax,type,image,available
Paneer Butter Masala,veg,220,5,veg,,true
Chicken Curry,nonveg,260,5,nonveg,,true`}
                </pre>
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="shrink-0 px-4 py-2 rounded-xl text-sm font-bold bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/20 transition hover:shadow-emerald-500/30"
              >Upload CSV</button>
            </div>
          </div>
        </div>
      )}

      {/* Smart Import Tab — WOW redesign */}
      {activeTab === "import" && (
        <div className="relative z-20 mx-4 md:mx-6 mb-6">
          {/* Toast */}
          <AnimatePresence>
            {importToast && (
              <motion.div
                initial={{ opacity: 0, y: -16, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -16, scale: 0.96 }}
                className={`fixed top-20 right-6 z-50 px-5 py-3.5 rounded-2xl shadow-2xl text-sm font-semibold backdrop-blur border flex items-center gap-2 ${
                  importToast.type === "error" ? "bg-red-600/90 border-red-500/50 text-white" :
                  importToast.type === "success" ? "bg-emerald-600/90 border-emerald-500/50 text-white" :
                  `${tc.cardBg} border-white/15 ${tc.textPrimary}`
                }`}
              >{importToast.msg}</motion.div>
            )}
          </AnimatePresence>

          {/* ── HERO ── */}
          <div className="relative rounded-3xl overflow-hidden mb-6 border border-violet-500/20">
            <div className="absolute inset-0 bg-gradient-to-br from-violet-900/60 via-indigo-900/40 to-slate-900/80" />
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute top-0 left-1/4 w-96 h-96 rounded-full blur-3xl bg-violet-500/15" />
              <div className="absolute bottom-0 right-1/4 w-96 h-96 rounded-full blur-3xl bg-indigo-500/10" />
            </div>
            <div className="relative p-7 flex flex-col md:flex-row items-start md:items-center gap-6">
              <motion.div
                animate={{ rotate: [0, 5, -5, 0], scale: [1, 1.05, 1] }}
                transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
                className="text-6xl select-none shrink-0"
              >🤖</motion.div>
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h2 className="text-2xl font-black text-white tracking-tight">Smart Import</h2>
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-violet-500 text-white uppercase tracking-wider">AI Powered</span>
                </div>
                <p className="text-white/60 text-sm max-w-lg leading-relaxed">
                  Upload any menu — photo, PDF, handwritten card, or even a <strong className="text-white/90">Zomato/Swiggy screenshot</strong>. Our AI extracts every dish instantly. Zero typing.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {[["📸","Menu Photo"],["📄","PDF Menu"],["🗒️","Handwritten"],["📋","Price List"],["📱","Zomato Screenshot"]].map(([ic,lb]) => (
                    <span key={lb} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-white/8 border border-white/12 text-white/70">
                      <span>{ic}</span>{lb}
                    </span>
                  ))}
                </div>
              </div>
              {/* Step flow */}
              <div className="shrink-0 hidden lg:flex flex-col gap-1.5">
                {[
                  [importFiles.length > 0 ? "✓" : "1", "Upload files", importFiles.length > 0],
                  [importHint ? "✓" : "2", "Add hint", !!importHint],
                  [importScanning ? "…" : importResults.length > 0 ? "✓" : "3", "AI scans", importResults.length > 0 || importScanning],
                  [importResults.length > 0 ? "4" : "4", "Review & save", false],
                ].map(([num, label, done], i) => (
                  <div key={i} className={`flex items-center gap-2 text-xs ${done ? "text-emerald-300" : "text-white/30"}`}>
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black border ${done ? "bg-emerald-500 border-emerald-400 text-white" : "border-white/15 bg-white/5"}`}>{num}</span>
                    {label}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-5 gap-5">
            {/* ── LEFT PANEL (upload + controls) ── */}
            <div className="xl:col-span-2 space-y-4">

              {/* Upload zone */}
              <div
                ref={importDropRef}
                onDragOver={e => { e.preventDefault(); setImportDragging(true); }}
                onDragLeave={() => setImportDragging(false)}
                onDrop={e => { e.preventDefault(); setImportDragging(false); handleImportFiles(e.dataTransfer.files); }}
                onClick={() => document.getElementById("import-file-input")?.click()}
                className={`relative rounded-2xl border-2 transition-all duration-300 flex flex-col items-center justify-center p-8 min-h-[180px] cursor-pointer select-none overflow-hidden group ${
                  importDragging
                    ? "border-violet-400 bg-violet-500/15 shadow-[0_0_40px_rgba(139,92,246,0.3)]"
                    : importFiles.length > 0
                      ? "border-violet-500/40 bg-violet-500/8 hover:border-violet-400/60"
                      : "border-white/10 bg-white/3 hover:border-violet-400/40 hover:bg-violet-500/5"
                }`}
              >
                <input id="import-file-input" type="file" accept="image/*,.pdf" multiple className="hidden" onChange={e => handleImportFiles(e.target.files)} />
                {/* Animated corner pulse when files added */}
                {importFiles.length > 0 && (
                  <motion.div
                    animate={{ opacity: [0.3, 0.7, 0.3] }}
                    transition={{ repeat: Infinity, duration: 2 }}
                    className="absolute inset-0 rounded-2xl border-2 border-violet-400/30 pointer-events-none"
                  />
                )}
                <AnimatePresence mode="wait">
                  {importDragging ? (
                    <motion.div key="drop" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.8, opacity: 0 }} className="flex flex-col items-center gap-2">
                      <div className="text-5xl">📂</div>
                      <p className="text-violet-300 font-bold text-sm">Drop to add files</p>
                    </motion.div>
                  ) : importFiles.length > 0 ? (
                    <motion.div key="has-files" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center gap-1">
                      <div className="text-3xl mb-1">✅</div>
                      <p className="text-emerald-300 font-bold text-sm">{importFiles.length} file{importFiles.length > 1 ? "s" : ""} ready</p>
                      <p className="text-white/40 text-xs">Click to add more</p>
                    </motion.div>
                  ) : (
                    <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center gap-2">
                      <motion.div animate={{ y: [0, -4, 0] }} transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }} className="text-4xl">📤</motion.div>
                      <p className="text-white/70 font-semibold text-sm text-center">Drag & drop or click to upload</p>
                      <p className="text-white/35 text-xs text-center">Images (JPG, PNG, WEBP) · PDF · Up to 10MB · Multiple OK</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* File thumbnails */}
              <AnimatePresence>
                {importFiles.length > 0 && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="grid grid-cols-3 gap-2">
                    {importFiles.map((entry) => (
                      <motion.div key={entry.id} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="relative rounded-xl overflow-hidden border border-white/10 bg-white/5 group">
                        {entry.preview
                          ? <img src={entry.preview} alt={entry.file.name} className="w-full h-20 object-cover" />
                          : <div className={`w-full h-20 flex items-center justify-center text-3xl ${tc.mutedBg}`}>📄</div>
                        }
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-all rounded-xl" />
                        <button
                          onClick={e => { e.stopPropagation(); setImportFiles(p => p.filter(f => f.id !== entry.id)); }}
                          className="absolute top-1 right-1 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                        >×</button>
                        <div className="absolute bottom-0 inset-x-0 px-1.5 py-0.5 bg-black/60 backdrop-blur-sm">
                          <p className="text-[9px] text-white/60 truncate">{entry.file.name}</p>
                        </div>
                      </motion.div>
                    ))}
                    <button
                      onClick={() => document.getElementById("import-file-input")?.click()}
                      className="rounded-xl border-2 border-dashed border-white/10 hover:border-violet-400/50 h-24 flex flex-col items-center justify-center text-white/25 hover:text-violet-300 transition gap-1"
                    >
                      <span className="text-xl">+</span>
                      <span className="text-[9px]">Add more</span>
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Hint input */}
              <div>
                <label className="block text-xs text-white/50 mb-1.5 font-medium">
                  Restaurant hint <span className="text-white/25 font-normal">(helps AI categorize better)</span>
                </label>
                <input
                  value={importHint}
                  onChange={e => setImportHint(e.target.value)}
                  placeholder="e.g. North Indian, South Indian café, Fast food, Pizzeria…"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-white/10 bg-white/5 text-white text-sm placeholder:text-white/25 focus:outline-none focus:ring-2 focus:ring-violet-400/50 transition"
                />
              </div>

              {/* Scan button */}
              <motion.button
                whileHover={{ scale: importScanning || !importFiles.length ? 1 : 1.01 }}
                whileTap={{ scale: importScanning || !importFiles.length ? 1 : 0.98 }}
                onClick={handleImportScan}
                disabled={importScanning || !importFiles.length}
                className="relative w-full py-3.5 rounded-2xl font-black text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed overflow-hidden"
                style={{ background: "linear-gradient(135deg, #7c3aed, #4f46e5, #7c3aed)", backgroundSize: "200% 200%" }}
              >
                {/* Animated shimmer */}
                {!importScanning && importFiles.length > 0 && (
                  <motion.div
                    animate={{ x: ["-100%", "200%"] }}
                    transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white/15 to-transparent pointer-events-none"
                  />
                )}
                <span className="relative flex items-center justify-center gap-2 text-white">
                  {importScanning ? (
                    <>
                      <motion.span animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.8, ease: "linear" }} className="inline-block text-base">⚙️</motion.span>
                      AI is reading your menu…
                    </>
                  ) : (
                    <><span className="text-base">🤖</span> Scan & Extract All Dishes</>
                  )}
                </span>
              </motion.button>
              {importScanning && (
                <motion.div
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="rounded-xl border border-violet-500/20 bg-violet-900/15 p-3 text-center"
                >
                  <div className="flex justify-center gap-1 mb-1.5">
                    {[0,1,2,3,4].map(i => (
                      <motion.div key={i} animate={{ scaleY: [0.4, 1, 0.4] }} transition={{ repeat: Infinity, duration: 0.8, delay: i * 0.12 }} className="w-1 h-4 rounded-full bg-violet-400" />
                    ))}
                  </div>
                  <p className="text-violet-300 text-xs font-semibold">Analyzing {importFiles.length} image{importFiles.length > 1 ? "s" : ""}…</p>
                  <p className="text-white/30 text-[10px] mt-0.5">Detecting dishes, prices, categories & veg markers</p>
                </motion.div>
              )}

              {/* Other sources */}
              <div className="rounded-2xl border border-white/8 bg-white/3 p-4">
                <p className="text-[11px] font-bold text-white/40 uppercase tracking-widest mb-3">💡 Also works with</p>
                <div className="space-y-2.5">
                  {[
                    ["📱", "Zomato / Swiggy screenshot", "Screenshot the full menu page"],
                    ["📦", "Old POS export PDF", "Most POS systems can export to PDF"],
                    ["🖼️", "Physical menu card photo", "Just snap a photo with your phone"],
                    ["⚡", "Quick Start templates", "Pre-built menus ready in 1 click"],
                  ].map(([ic, title, sub]) => (
                    <div key={title} className="flex items-start gap-2.5">
                      <span className="text-base shrink-0 mt-0.5">{ic}</span>
                      <div>
                        <p className="text-xs text-white/60 font-medium">{title}</p>
                        <p className="text-[10px] text-white/30">{sub}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ── RIGHT PANEL (results) ── */}
            <div className="xl:col-span-3">
              <AnimatePresence mode="wait">
                {/* Empty state */}
                {importResults.length === 0 && !importScanning && (
                  <motion.div key="empty-results" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="rounded-2xl border border-white/8 bg-white/3 min-h-[420px] flex flex-col items-center justify-center text-center p-10"
                  >
                    <div className="w-20 h-20 rounded-3xl bg-white/5 border border-white/10 flex items-center justify-center text-4xl mb-4 mx-auto">🍽️</div>
                    <p className="text-white/30 font-semibold text-sm mb-1">No items yet</p>
                    <p className="text-white/20 text-xs max-w-xs">Upload your menu photos or PDF and click Scan — AI will extract all dishes here for review.</p>
                    <div className="mt-6 flex gap-2 flex-wrap justify-center">
                      {["Dishes detected automatically", "Prices extracted", "Auto veg/non-veg detection", "Editable before saving"].map(t => (
                        <span key={t} className="px-2.5 py-1 rounded-full text-[10px] font-medium bg-white/5 border border-white/8 text-white/30">{t}</span>
                      ))}
                    </div>
                  </motion.div>
                )}

                {/* Scanning state */}
                {importScanning && (
                  <motion.div key="scanning" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="rounded-2xl border border-violet-500/25 bg-gradient-to-br from-violet-900/20 to-indigo-900/20 min-h-[420px] flex flex-col items-center justify-center text-center p-10"
                  >
                    <motion.div
                      animate={{ scale: [1, 1.1, 1], rotate: [0, 5, -5, 0] }}
                      transition={{ repeat: Infinity, duration: 2 }}
                      className="text-7xl mb-6 select-none"
                    >🤖</motion.div>
                    <p className="text-violet-300 font-black text-lg mb-2">Reading your menu…</p>
                    <p className="text-white/40 text-sm mb-6">Detecting every dish, price and ingredient</p>
                    {/* Fake progress bars */}
                    <div className="w-full max-w-xs space-y-2">
                      {["Parsing text content", "Detecting dish names", "Extracting prices", "Classifying veg/non-veg"].map((label, i) => (
                        <div key={label} className="flex items-center gap-2">
                          <motion.div
                            animate={{ opacity: [0.3, 1, 0.3] }}
                            transition={{ repeat: Infinity, duration: 1.5, delay: i * 0.3 }}
                            className="flex-1"
                          >
                            <div className="flex items-center justify-between text-[10px] text-white/30 mb-0.5">
                              <span>{label}</span>
                            </div>
                            <div className="h-1 rounded-full bg-white/8 overflow-hidden">
                              <motion.div
                                animate={{ width: ["0%", "100%", "100%"] }}
                                transition={{ repeat: Infinity, duration: 2, delay: i * 0.4 }}
                                className="h-full rounded-full bg-gradient-to-r from-violet-500 to-indigo-400"
                              />
                            </div>
                          </motion.div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}

                {/* Results */}
                {importResults.length > 0 && (
                  <motion.div key="results" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                    className={`rounded-2xl border border-emerald-500/20 backdrop-blur overflow-hidden ${tc.cardBg}`}
                  >
                    {/* Results header */}
                    <div className="px-5 py-4 bg-gradient-to-r from-emerald-900/30 to-teal-900/20 border-b border-emerald-500/15 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-emerald-500/20 flex items-center justify-center text-base">✅</div>
                      <div>
                        <p className="text-sm font-bold text-white">AI extracted {importResults.length} items</p>
                        <p className="text-[11px] text-white/40">Review and edit before saving to your menu</p>
                      </div>
                      <button onClick={() => setImportResults([])} className="ml-auto text-white/20 hover:text-white/50 text-xs transition px-2 py-1 rounded-lg hover:bg-white/8">✕ Clear</button>
                    </div>

                    {/* Table */}
                    <div className="max-h-[400px] overflow-y-auto">
                      <table className="w-full text-xs">
                        <thead className={`sticky top-0 backdrop-blur border-b border-white/8 ${tc.headerBg}`}>
                          <tr>
                            <th className="px-4 py-2.5 text-left text-white/40 font-semibold">Dish Name</th>
                            <th className="px-2 py-2.5 text-left text-white/40 font-semibold">₹ Price</th>
                            <th className="px-2 py-2.5 text-left text-white/40 font-semibold">Tax</th>
                            <th className="px-2 py-2.5 text-left text-white/40 font-semibold">Category</th>
                            <th className="px-2 py-2.5 text-center text-white/40 font-semibold">Type</th>
                            <th className="px-2 py-2.5 text-center text-white/40 font-semibold">On</th>
                            <th className="px-2 py-2.5" />
                          </tr>
                        </thead>
                        <tbody>
                          {importResults.map((row, idx) => (
                            <motion.tr
                              key={row._id}
                              initial={{ opacity: 0, x: -8 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: idx * 0.03 }}
                              className="border-b border-white/5 hover:bg-white/3 group transition"
                            >
                              <td className="px-4 py-2">
                                <input value={row.name} onChange={e => updateImportRow(row._id, "name", e.target.value)}
                                  className="w-full bg-transparent focus:bg-white/5 border-b border-transparent focus:border-violet-400/60 outline-none text-white/85 py-0.5 px-0.5 rounded transition text-xs" />
                              </td>
                              <td className="px-2 py-2">
                                <div className="flex items-center gap-0.5">
                                  <span className="text-white/25 text-[10px]">₹</span>
                                  <input type="number" value={row.price} onChange={e => updateImportRow(row._id, "price", e.target.value)}
                                    className="w-16 bg-transparent focus:bg-white/5 border-b border-transparent focus:border-violet-400/60 outline-none text-white/85 py-0.5 px-0.5 rounded transition text-xs" />
                                </div>
                              </td>
                              <td className="px-2 py-2">
                                <div className="flex items-center gap-0.5">
                                  <input type="number" value={row.tax} onChange={e => updateImportRow(row._id, "tax", e.target.value)}
                                    className="w-8 bg-transparent focus:bg-white/5 border-b border-transparent focus:border-violet-400/60 outline-none text-white/60 py-0.5 px-0.5 rounded transition text-xs" />
                                  <span className="text-white/20 text-[10px]">%</span>
                                </div>
                              </td>
                              <td className="px-2 py-2">
                                <input value={row.categoryName} onChange={e => updateImportRow(row._id, "categoryName", e.target.value)}
                                  className="w-24 bg-transparent focus:bg-white/5 border-b border-transparent focus:border-violet-400/60 outline-none text-white/50 py-0.5 px-0.5 rounded transition text-xs" />
                              </td>
                              <td className="px-2 py-2 text-center">
                                <button
                                  onClick={() => updateImportRow(row._id, "type", row.type === "veg" ? "nonveg" : "veg")}
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-black border transition ${
                                    row.type === "veg"
                                      ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/25"
                                      : "bg-red-500/15 text-red-300 border-red-500/30 hover:bg-red-500/25"
                                  }`}
                                >{row.type === "veg" ? "🌿 V" : "🍗 NV"}</button>
                              </td>
                              <td className="px-2 py-2 text-center">
                                <button
                                  onClick={() => updateImportRow(row._id, "available", !row.available)}
                                  className={`w-8 h-4 rounded-full transition-all relative ${row.available ? "bg-emerald-500" : "bg-white/15"}`}
                                >
                                  <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow-sm transition-all ${row.available ? "left-4.5" : "left-0.5"}`} />
                                </button>
                              </td>
                              <td className="px-2 py-2 text-center">
                                <button onClick={() => removeImportRow(row._id)} className="w-5 h-5 rounded-full text-white/15 hover:text-red-400 hover:bg-red-500/10 transition flex items-center justify-center text-base leading-none">×</button>
                              </td>
                            </motion.tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Footer */}
                    <div className={`px-5 py-4 border-t border-white/8 flex items-center justify-between gap-3 ${tc.mutedBg}`}>
                      <div>
                        <p className="text-xs text-white/40">All fields editable · Categories auto-created</p>
                        <p className="text-[10px] text-white/25 mt-0.5">{importResults.filter(r => r.available).length} available · {importResults.filter(r => !r.available).length} unavailable</p>
                      </div>
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={handleImportSave}
                        disabled={importSaving}
                        className="px-6 py-2.5 rounded-xl text-sm font-black bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white shadow-lg shadow-emerald-500/25 transition disabled:opacity-50 flex items-center gap-2"
                      >
                        {importSaving ? (
                          <><motion.span animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.8, ease: "linear" }}>⏳</motion.span> Saving…</>
                        ) : (
                          <><span>💾</span> Save {importResults.length} items to Menu</>
                        )}
                      </motion.button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
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
              className={`border rounded-xl shadow-2xl w-[28rem] p-6 ${tc.modalBg}`}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className={`text-lg font-semibold mb-4 ${tc.textPrimary}`}>
                {categoryModalMode === "add" ? "Add Category" : "Edit Category"}
              </h3>

              <div className="mb-4">
                <label className={`block text-xs mb-1 ${tc.textSub}`}>Name</label>
                <input
                  type="text"
                  className={`w-full rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-300/40 ${tc.inputBg}`}
                  placeholder="Category name"
                  value={categoryModalValue.name}
                  onChange={(e) => setCategoryModalValue((v) => ({ ...v, name: e.target.value }))}
                  autoFocus
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className={`block text-xs ${tc.textSub}`}>Icon</label>
                  <div className={`flex items-center gap-2 text-xs ${tc.textMuted}`}>
                    <span>Selected:</span>
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded border ${tc.mutedBg} ${tc.borderSoft}`}>
                      <Icon token={categoryModalValue.icon || "empty"} fallback="🍽️" />
                      <code className="opacity-70">{categoryModalValue.icon || "none"}</code>
                    </span>
                  </div>
                </div>
                <div className={`grid grid-cols-8 gap-2 max-h-40 overflow-y-auto p-2 rounded border ${tc.mutedBg} ${tc.borderSoft}`}>
                  {IconTokens.map((t) => (
                    <button
                      key={t}
                      type="button"
                      className={`p-2 rounded border transition ${
                        categoryModalValue.icon === t
                          ? "border-emerald-400 bg-emerald-500/20"
                          : `${tc.borderSoft} ${tc.mutedBg} hover:bg-white/10`
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
                  className={`px-4 py-2 rounded transition ${tc.outlineBtn}`}
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

      {/* Item Modal — full redesign */}
      <AnimatePresence>
        {showItemModal && (
          <motion.div
            className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowItemModal(false)}
          >
            <motion.div
              initial={{ scale: 0.93, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.93, opacity: 0, y: 20 }}
              transition={{ type: "spring", stiffness: 260, damping: 26 }}
              className={`relative w-full max-w-3xl rounded-3xl border shadow-[0_32px_80px_rgba(0,0,0,0.6)] overflow-hidden ${tc.modalBg}`}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Glow accent */}
              <div className="pointer-events-none absolute -top-20 -right-20 w-64 h-64 rounded-full blur-[80px]" style={{ background: "radial-gradient(circle, rgba(16,185,129,0.08) 0%, transparent 70%)" }} />
              <div className="pointer-events-none absolute -bottom-20 -left-20 w-64 h-64 rounded-full blur-[80px]" style={{ background: "radial-gradient(circle, rgba(99,102,241,0.07) 0%, transparent 70%)" }} />

              {/* Header */}
              <div className={`relative flex items-center gap-3 px-6 py-4 border-b ${tc.borderSoft}`}>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold ${
                  normalizeType(itemModalValue.type) === "veg"
                    ? "bg-emerald-500/20 text-emerald-300"
                    : "bg-red-500/20 text-red-300"
                }`}>
                  {normalizeType(itemModalValue.type) === "veg" ? "🌿" : "🌗"}
                </div>
                <div>
                  <h3 className={`text-base font-bold ${tc.textPrimary}`}>{itemModalMode === "add" ? "Add New Item" : "Edit Item"}</h3>
                  <p className={`text-[11px] ${tc.textMuted}`}>Fill in details to create a rich menu card</p>
                </div>
                <div className="ml-auto flex items-center gap-3">
                  {/* Available toggle */}
                  <div className="flex items-center gap-2">
                    <span className={`text-xs ${tc.textMuted}`}>Available</span>
                    <button
                      type="button"
                      onClick={() => setItemModalValue(v => ({ ...v, available: !v.available }))}
                      className={`w-10 h-5 rounded-full transition-colors relative ${itemModalValue.available ? "bg-emerald-500" : "bg-white/20"}`}
                    >
                      <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${itemModalValue.available ? "left-5.5 translate-x-0.5" : "left-0.5"}`} />
                    </button>
                  </div>
                  <button onClick={() => setShowItemModal(false)} className={`w-8 h-8 rounded-lg flex items-center justify-center transition hover:bg-white/10 ${tc.textMuted}`}>✕</button>
                </div>
              </div>

              {/* Tabs */}
              <div className="flex gap-1 px-6 pt-4 pb-0">
                {[["basic","✏️ Basic Info"],["details","✨ Description & Nutrition"],["images","🖼️ Photos"]].map(([t,label]) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setItemModalTab(t)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                      itemModalTab === t
                        ? `bg-white/10 ${tc.textPrimary} border ${tc.borderSoft}`
                        : `${tc.textMuted} hover:bg-white/5`
                    }`}
                  >{label}</button>
                ))}
              </div>

              <form onSubmit={(e) => { e.preventDefault(); handleItemModalSave(); }} className="p-6">

                {/* ── Tab: Basic Info ── */}
                {itemModalTab === "basic" && (
                  <div className="space-y-4">
                    {/* Name + Type row */}
                    <div className="flex gap-3 items-end">
                      <div className="flex-1">
                        <label className={`block text-xs mb-1.5 font-medium ${tc.textSub}`}>Dish Name *</label>
                        <input
                          autoFocus
                          type="text"
                          required
                          value={itemModalValue.name}
                          onChange={e => setItemModalValue(v => ({ ...v, name: e.target.value }))}
                          placeholder="e.g. Paneer Butter Masala"
                          className={`w-full px-3 py-2.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-400/40 text-sm ${tc.inputBg}`}
                        />
                      </div>
                      {/* Veg / Non-Veg pill toggle */}
                      <div className="shrink-0">
                        <label className={`block text-xs mb-1.5 font-medium ${tc.textSub}`}>Type</label>
                        <div className={`flex rounded-xl overflow-hidden border ${tc.borderSoft}`}>
                          <button type="button"
                            onClick={() => setItemModalValue(v => ({ ...v, type: "veg" }))}
                            className={`px-3 py-2.5 text-xs font-bold transition flex items-center gap-1.5 ${normalizeType(itemModalValue.type) === "veg" ? "bg-emerald-500 text-white" : `${tc.mutedBg} ${tc.textMuted} hover:bg-white/10`}`}
                          ><span className="w-2.5 h-2.5 rounded-full bg-current opacity-70" />VEG</button>
                          <button type="button"
                            onClick={() => setItemModalValue(v => ({ ...v, type: "nonveg" }))}
                            className={`px-3 py-2.5 text-xs font-bold transition flex items-center gap-1.5 ${normalizeType(itemModalValue.type) === "nonveg" ? "bg-red-500 text-white" : `${tc.mutedBg} ${tc.textMuted} hover:bg-white/10`}`}
                          ><span className="w-2.5 h-2.5 rounded-full bg-current opacity-70" />NON-VEG</button>
                        </div>
                      </div>

                    </div>

                    {/* Price + Category */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className={`block text-xs mb-1.5 font-medium ${tc.textSub}`}>Price (₹) *</label>
                        <div className="relative">
                          <span className={`absolute left-3 top-1/2 -translate-y-1/2 text-sm ${tc.textMuted}`}>₹</span>
                          <input
                            type="number" min="0" step="0.01" required
                            value={itemModalValue.price}
                            onChange={e => setItemModalValue(v => ({ ...v, price: e.target.value.replace(/^0+(?!\.)/, "") }))}
                            placeholder="0"
                            className={`w-full pl-7 pr-3 py-2.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-400/40 text-sm ${tc.inputBg}`}
                          />
                        </div>
                      </div>
                      <div>
                        <label className={`block text-xs mb-1.5 font-medium ${tc.textSub}`}>Category</label>
                        <select
                          value={itemModalValue.categoryId}
                          onChange={e => setItemModalValue(v => ({ ...v, categoryId: e.target.value }))}
                          className={`w-full px-3 py-2.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-400/40 text-sm ${tc.inputBg}`}
                        >
                          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                      </div>
                    </div>

                    {/* GST Tax — optional toggle */}
                    {!showGstField ? (
                      <button type="button" onClick={() => setShowGstField(true)}
                        className={`flex items-center gap-1.5 text-xs hover:text-amber-300 transition py-1 group ${tc.textMuted}`}
                      >
                        <span className={`w-4 h-4 rounded border flex items-center justify-center text-[10px] group-hover:border-amber-400/40 group-hover:text-amber-300 transition ${tc.borderSoft} ${tc.textMuted}`}>+</span>
                        Add GST Tax <span className={`group-hover:text-amber-300/50 ${tc.textMuted}`}>(optional)</span>
                      </button>
                    ) : (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="flex items-end gap-2">
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1.5">
                            <label className={`text-xs font-medium ${tc.textSub}`}>GST Tax %</label>
                            <div className="flex gap-1">
                              {[0,5,12,18].map(v => (
                                <button key={v} type="button" onClick={() => setItemModalValue(f => ({ ...f, tax: String(v) }))}
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition border ${parseFloat(itemModalValue.tax||0)===v ? "bg-amber-500/20 border-amber-500/40 text-amber-300" : "border-white/10 text-white/30 hover:bg-white/8 hover:text-white/60"}`}
                                >{v}%</button>
                              ))}
                            </div>
                          </div>
                          <input
                            type="number" min="0" step="0.01" autoFocus
                            value={itemModalValue.tax}
                            onChange={e => setItemModalValue(v => ({ ...v, tax: e.target.value.replace(/^0+(?!\.)/, "") }))}
                            placeholder="e.g. 5"
                            className="w-full px-3 py-2.5 rounded-xl border border-amber-500/25 bg-amber-500/5 text-white placeholder:text-white/25 focus:outline-none focus:ring-2 focus:ring-amber-400/30 text-sm"
                          />
                        </div>
                        <button type="button" onClick={() => { setShowGstField(false); setItemModalValue(v => ({ ...v, tax: "" })); }}
                          className="mb-0.5 px-2.5 py-2.5 rounded-xl border border-white/8 text-white/30 hover:text-red-400 hover:border-red-400/30 text-xs transition"
                        >✕ Remove</button>
                      </motion.div>
                    )}

                    {/* Quick image URL */}
                    <div>
                      <label className={`block text-xs mb-1.5 font-medium ${tc.textSub}`}>Main Image URL <span className={tc.textMuted}>(or use Photos tab for upload)</span></label>
                      <input
                        type="url"
                        value={itemModalValue.image}
                        onChange={e => setItemModalValue(v => ({ ...v, image: e.target.value }))}
                        placeholder="https://example.com/dish.jpg"
                        className={`w-full px-3 py-2.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-400/40 text-sm ${tc.inputBg}`}
                      />
                    </div>

                    {/* Price preview */}
                    {itemModalValue.price && (
                      <div className="rounded-xl bg-emerald-500/8 border border-emerald-500/20 px-4 py-3 flex items-center gap-4">
                        <div>
                          <p className="text-[10px] text-emerald-300/70 font-medium uppercase tracking-wider">Base Price</p>
                          <p className="text-lg font-bold text-emerald-300">₹{parseFloat(itemModalValue.price || 0).toFixed(0)}</p>
                        </div>
                        {itemModalValue.tax > 0 && (
                          <>
                            <span className={tc.textMuted}>+</span>
                            <div>
                              <p className={`text-[10px] font-medium uppercase tracking-wider ${tc.textMuted}`}>GST ({itemModalValue.tax}%)</p>
                              <p className={`text-sm font-semibold ${tc.textSub}`}>₹{(parseFloat(itemModalValue.price || 0) * parseFloat(itemModalValue.tax || 0) / 100).toFixed(2)}</p>
                            </div>
                            <span className={tc.textMuted}>=</span>
                            <div>
                              <p className={`text-[10px] font-medium uppercase tracking-wider ${tc.textMuted}`}>Total</p>
                              <p className={`text-lg font-bold ${tc.textPrimary}`}>₹{(parseFloat(itemModalValue.price || 0) * (1 + parseFloat(itemModalValue.tax || 0) / 100)).toFixed(0)}</p>
                            </div>
                          </>
                        )}
                        <div className="ml-auto">
                          <span className={`px-2.5 py-1 rounded-lg text-[11px] font-bold ${itemModalValue.available ? "bg-emerald-500/20 text-emerald-300" : "bg-white/10 text-white/40"}`}>
                            {itemModalValue.available ? "● Available" : "○ Unavailable"}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* ── Tab: Description & Nutrition ── */}
                {itemModalTab === "details" && (
                  <div className="space-y-4">
                    {/* AI Description */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className={`text-xs font-medium ${tc.textSub}`}>Description</label>
                        <span className="text-[10px] text-violet-300/70 font-medium">✨ AI powered</span>
                      </div>
                      {/* Keywords input */}
                      <div className="flex gap-2 mb-2">
                        <input
                          type="text"
                          value={aiDescKeywords}
                          onChange={e => setAiDescKeywords(e.target.value)}
                          placeholder="Type keywords: spicy, creamy, tomato, cheese…"
                          className={`flex-1 px-3 py-2 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-400/50 border border-violet-500/40 ${tc.inputBg}`}
                        />
                        <button
                          type="button"
                          onClick={generateAIDescription}
                          disabled={aiDescGenerating}
                          className="px-4 py-2 rounded-xl text-sm font-bold bg-gradient-to-r from-violet-500 to-indigo-500 text-white disabled:opacity-60 flex items-center gap-1.5 transition hover:shadow-lg hover:shadow-violet-500/25 whitespace-nowrap"
                        >
                          {aiDescGenerating ? (
                            <motion.span animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.8, ease: "linear" }}>⏳</motion.span>
                          ) : "✨"} Generate
                        </button>
                      </div>
                      <p className={`text-[10px] mb-2 ${tc.textMuted}`}>e.g. "spicy, creamy, paneer, cashew gravy" → AI writes a rich description</p>
                      <textarea
                        rows={4}
                        value={itemModalValue.description}
                        onChange={e => setItemModalValue(v => ({ ...v, description: e.target.value }))}
                        placeholder="Describe how it's made, the flavors, the story behind it…"
                        className={`w-full px-3 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/40 resize-none leading-relaxed ${tc.inputBg}`}
                      />
                    </div>

                    {/* Ingredients */}
                    <div>
                      <label className={`block text-xs mb-1.5 font-medium ${tc.textSub}`}>Ingredients <span className={`font-normal ${tc.textMuted}`}>(comma-separated)</span></label>
                      <input
                        type="text"
                        value={itemModalValue.ingredients}
                        onChange={e => setItemModalValue(v => ({ ...v, ingredients: e.target.value }))}
                        placeholder="Paneer, Butter, Tomatoes, Cream, Spices…"
                        className={`w-full px-3 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/40 ${tc.inputBg}`}
                      />
                      {/* Tag preview */}
                      {itemModalValue.ingredients && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {itemModalValue.ingredients.split(",").map((ing, i) => ing.trim() && (
                            <span key={i} className={`px-2 py-0.5 rounded-full border text-[11px] ${tc.mutedBg} ${tc.borderSoft} ${tc.textSub}`}>{ing.trim()}</span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Calories + serving */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className={`text-xs font-medium ${tc.textSub}`}>Calories (kcal)</label>
                        <button
                          type="button"
                          onClick={suggestAICalories}
                          disabled={aiCalorieGenerating || (!itemModalValue.name && !itemModalValue.ingredients)}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-amber-500/15 border border-amber-500/30 text-amber-300 hover:bg-amber-500/25 transition disabled:opacity-40"
                        >
                          {aiCalorieGenerating ? (
                            <motion.span animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.7, ease: "linear" }} className="inline-block">⏳</motion.span>
                          ) : "🔥"} Suggest from ingredients
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="relative">
                          <input
                            type="number" min="0"
                            value={itemModalValue.calories}
                            onChange={e => setItemModalValue(v => ({ ...v, calories: e.target.value }))}
                            placeholder="e.g. 350"
                            className={`w-full px-3 py-2.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400/40 text-sm ${tc.inputBg}`}
                          />
                          {itemModalValue.calories && (
                            <span className={`absolute right-3 top-1/2 -translate-y-1/2 text-xs ${tc.textMuted}`}>kcal</span>
                          )}
                        </div>
                        <div className="rounded-xl bg-amber-500/5 border border-amber-500/15 p-3 flex flex-col justify-center">
                          {itemModalValue.calories ? (
                            <div>
                              <p className="text-[10px] text-amber-300/60 uppercase tracking-wider font-medium">Energy</p>
                              <p className="text-xl font-black text-amber-300">{itemModalValue.calories} <span className="text-xs font-normal opacity-60">kcal</span></p>
                            </div>
                          ) : (
                            <p className="text-xs text-white/20 text-center">AI will estimate →</p>
                          )}
                        </div>
                      </div>
                      <p className="text-[10px] text-amber-300/40 mt-1.5 flex items-center gap-1">⚠️ AI estimated — please follow ideal nutritional guidelines. For reference only.</p>
                    </div>
                  </div>
                )}

                {/* ── Tab: Photos ── */}
                {itemModalTab === "images" && (
                  <div className="space-y-3">

                    {/* ── Veg / Non-Veg — bold prominent selector ── */}
                    <div className="grid grid-cols-2 gap-2">
                      <button type="button" onClick={() => setItemModalValue(v => ({ ...v, type: "veg" }))}
                        className={`relative flex items-center gap-3 px-4 py-3 rounded-2xl border-2 font-bold text-sm transition-all ${
                          normalizeType(itemModalValue.type) === "veg"
                            ? "border-emerald-400 bg-emerald-500/15 text-emerald-300 shadow-[0_0_16px_rgba(16,185,129,0.25)]"
                            : "border-white/10 bg-white/3 text-white/40 hover:border-emerald-400/30 hover:bg-emerald-500/5 hover:text-white/70"
                        }`}
                      >
                        <span className={`w-5 h-5 rounded border-2 flex-shrink-0 flex items-center justify-center ${
                          normalizeType(itemModalValue.type) === "veg" ? "border-emerald-400" : "border-white/20"
                        }`}>
                          <span className={`w-2.5 h-2.5 rounded-full ${
                            normalizeType(itemModalValue.type) === "veg" ? "bg-emerald-400" : "bg-white/20"
                          }`} />
                        </span>
                        <span>🌿 Veg</span>
                        {normalizeType(itemModalValue.type) === "veg" && (
                          <span className="ml-auto text-emerald-400 text-base">✓</span>
                        )}
                      </button>
                      <button type="button" onClick={() => setItemModalValue(v => ({ ...v, type: "nonveg" }))}
                        className={`relative flex items-center gap-3 px-4 py-3 rounded-2xl border-2 font-bold text-sm transition-all ${
                          normalizeType(itemModalValue.type) === "nonveg"
                            ? "border-red-400 bg-red-500/15 text-red-300 shadow-[0_0_16px_rgba(239,68,68,0.22)]"
                            : "border-white/10 bg-white/3 text-white/40 hover:border-red-400/30 hover:bg-red-500/5 hover:text-white/70"
                        }`}
                      >
                        <span className={`w-5 h-5 rounded border-2 flex-shrink-0 flex items-center justify-center ${
                          normalizeType(itemModalValue.type) === "nonveg" ? "border-red-400" : "border-white/20"
                        }`}>
                          <span className={`w-2.5 h-2.5 rounded-full ${
                            normalizeType(itemModalValue.type) === "nonveg" ? "bg-red-400" : "bg-white/20"
                          }`} />
                        </span>
                        <span>🍗 Non-Veg</span>
                        {normalizeType(itemModalValue.type) === "nonveg" && (
                          <span className="ml-auto text-red-400 text-base">✓</span>
                        )}
                      </button>
                    </div>

                    {/* ── Sub-tabs ── */}
                    <div className="flex gap-1 p-1 rounded-xl bg-white/4 border border-white/8">
                      {[["pick","🔍 Find Image"],["upload","📷 Upload"],["url","🔗 URL"]].map(([t, label]) => (
                        <button key={t} type="button" onClick={() => setImgSubTab(t)}
                          className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition ${imgSubTab === t ? "bg-white/10 text-white border border-white/15" : "text-white/40 hover:text-white/70"}`}
                        >{label}</button>
                      ))}
                    </div>

                    {/* ── Sub-tab: Google Image Search ── */}
                    {imgSubTab === "pick" && (() => {
                      const isSelected = (url) => itemModalValue.image === url || (itemModalValue.images || []).includes(url);
                      const pickImage = (url) => {
                        if (isSelected(url)) return;
                        setItemModalValue(v => ({
                          ...v,
                          image: v.image || url,
                          images: [...(v.images || []), url],
                        }));
                      };
                      const GAPI_KEY = (typeof import.meta !== "undefined" && import.meta.env?.VITE_GOOGLE_API_KEY) || "AIzaSyBPkkXZWll0VifG5kb0DDSsoV5UB-n5pFE";
                      const GCSE_CX  = (typeof import.meta !== "undefined" && import.meta.env?.VITE_GOOGLE_CSE_CX)  || "82ccaaa87aa2e40a6";
                      const runSearch = async (q) => {
                        if (!q?.trim()) return;
                        setGoogleImgLoading(true);
                        const tryQueries = [
                          `${q.trim()} food dish photo`,
                          `${q.trim()} restaurant drink`,
                          `${q.trim()} recipe`,
                        ];
                        let found = [];
                        for (const sq of tryQueries) {
                          try {
                            const res = await fetch(
                              `https://www.googleapis.com/customsearch/v1?q=${encodeURIComponent(sq)}&searchType=image&key=${GAPI_KEY}&cx=${GCSE_CX}&num=8&imgType=photo&safe=active`
                            );
                            if (res.ok) {
                              const data = await res.json();
                              found = (data.items || [])
                                .filter(it => it.link?.startsWith("http"))
                                .map(it => it.link);
                              if (found.length >= 3) break;
                            }
                          } catch { /* try next */ }
                        }
                        setGoogleImgResults(found);
                        setGoogleImgLoading(false);
                      };
                      return (
                        <div className="space-y-3">
                          {/* Search bar */}
                          <div className="flex gap-2">
                            <div className="relative flex-1">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 text-sm">🔍</span>
                              <input
                                type="text"
                                value={googleImgQuery}
                                onChange={e => setGoogleImgQuery(e.target.value)}
                                onKeyDown={e => e.key === "Enter" && runSearch(googleImgQuery)}
                                placeholder={`Search Google Images for "${itemModalValue.name || "your dish"}"…`}
                                className={`w-full pl-9 pr-8 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/40 ${tc.inputBg}`}
                              />
                              {googleImgQuery && <button type="button" onClick={() => { setGoogleImgQuery(""); setGoogleImgResults([]); }} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/25 hover:text-white/50 transition text-xs">✕</button>}
                            </div>
                            <motion.button
                              type="button"
                              whileTap={{ scale: 0.95 }}
                              onClick={() => runSearch(googleImgQuery || itemModalValue.name)}
                              disabled={googleImgLoading}
                              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-500 text-white text-xs font-bold hover:opacity-90 transition disabled:opacity-50 flex items-center gap-1.5 shrink-0"
                            >
                              {googleImgLoading
                                ? <motion.span animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.8, ease: "linear" }} className="inline-block">⟳</motion.span>
                                : "🌐"
                              }
                              {googleImgLoading ? "Searching…" : "Search"}
                            </motion.button>
                          </div>

                          {/* Quick-search chips */}
                          {!googleImgResults.length && !googleImgLoading && (
                            <div className="flex gap-1.5 flex-wrap">
                              {[itemModalValue.name, "biryani", "paneer", "burger", "coffee", "cake", "dosa"].filter(Boolean).slice(0,6).map(term => (
                                <button key={term} type="button"
                                  onClick={() => { setGoogleImgQuery(term); runSearch(term); }}
                                  className="px-2.5 py-1 rounded-full text-[11px] font-semibold border border-blue-400/20 bg-blue-500/8 text-blue-300/70 hover:bg-blue-500/20 hover:text-blue-200 transition"
                                >{term}</button>
                              ))}
                            </div>
                          )}

                          {/* Loading skeleton */}
                          {googleImgLoading && (
                            <div className="grid grid-cols-4 gap-2">
                              {Array.from({length: 8}).map((_, i) => (
                                <motion.div key={i} animate={{ opacity: [0.3, 0.7, 0.3] }} transition={{ repeat: Infinity, duration: 1.2, delay: i * 0.1 }}
                                  className="rounded-xl bg-white/5 h-16 border border-white/6"
                                />
                              ))}
                            </div>
                          )}

                          {/* Results grid */}
                          {!googleImgLoading && googleImgResults.length > 0 && (
                            <div className="grid grid-cols-4 gap-2 max-h-52 overflow-y-auto pr-0.5">
                              {googleImgResults.map((url, idx) => {
                                const sel = isSelected(url);
                                return (
                                  <button key={idx} type="button" onClick={() => pickImage(url)}
                                    className={`relative rounded-xl overflow-hidden border-2 transition group ${sel ? "border-emerald-400 ring-2 ring-emerald-400/40" : "border-white/8 hover:border-blue-400/60 hover:shadow-[0_0_12px_rgba(59,130,246,0.3)]"}`}
                                  >
                                    <img src={url} alt={`result-${idx}`} className="w-full h-16 object-cover group-hover:scale-105 transition-transform duration-200"
                                      onError={e => { e.currentTarget.parentElement.style.display = "none"; }}
                                    />
                                    {sel
                                      ? <div className="absolute inset-0 bg-emerald-500/30 flex items-center justify-center"><span className="text-xl text-white font-black">✓</span></div>
                                      : <div className="absolute inset-0 bg-black/0 group-hover:bg-blue-500/15 transition flex items-center justify-center opacity-0 group-hover:opacity-100"><span className="text-xs font-bold text-white bg-blue-500/80 px-2 py-0.5 rounded-lg">Select</span></div>
                                    }
                                  </button>
                                );
                              })}
                            </div>
                          )}

                          {/* Empty state */}
                          {!googleImgLoading && !googleImgResults.length && (
                            <div className="flex flex-col items-center justify-center py-6 gap-2 text-center rounded-xl border border-white/6 bg-white/2">
                              <span className="text-3xl opacity-20">🌐</span>
                              <p className="text-xs text-white/30">Search Google Images above to find real dish photos</p>
                              <p className="text-[10px] text-white/20">Click a photo to instantly use it as your dish image — no download needed</p>
                            </div>
                          )}

                          {/* Info badge */}
                          {googleImgResults.length > 0 && (
                            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-500/5 border border-blue-500/15">
                              <span className="text-blue-300/60 text-xs">💡</span>
                              <p className="text-[10px] text-blue-300/50">Click any image to instantly set it as your dish photo · No saving to desktop needed</p>
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {/* ── Sub-tab: Upload ── */}
                    {imgSubTab === "upload" && (
                      <div
                        className="rounded-2xl border-2 border-dashed border-white/12 hover:border-emerald-400/40 bg-white/3 hover:bg-emerald-500/5 transition-all cursor-pointer flex flex-col items-center justify-center py-8 gap-2"
                        onClick={() => document.getElementById("item-img-input")?.click()}
                      >
                        <input id="item-img-input" type="file" accept="image/*" multiple className="hidden" onChange={e => handleItemImageUpload(e.target.files)} />
                        {itemImageUploading ? (
                          <><motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }} className="text-3xl">🔄</motion.div><p className="text-sm text-white/50">Uploading to Firebase…</p></>
                        ) : (
                          <><div className="text-4xl">📷</div><p className="text-sm text-white/70 font-semibold">Drop photos here or click to browse</p><p className="text-xs text-white/30">JPG · PNG · WEBP · Max 8MB each · Multiple allowed</p></>
                        )}
                      </div>
                    )}

                    {/* ── Sub-tab: URL ── */}
                    {imgSubTab === "url" && (
                      <div className="space-y-2">
                        <p className="text-xs text-white/40">Paste any image URL directly</p>
                        <div className="flex gap-2">
                          <input type="url" id="photo-url-paste" placeholder="https://example.com/dish-photo.jpg"
                            className={`flex-1 px-3 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/30 ${tc.inputBg}`}
                          />
                          <button type="button"
                            onClick={() => { const url = document.getElementById("photo-url-paste")?.value?.trim(); if (url) { setItemModalValue(v => ({ ...v, image: v.image || url, images: [...(v.images||[]), url] })); document.getElementById("photo-url-paste").value = ""; }}}
                            className="px-4 py-2.5 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-sm font-bold hover:bg-emerald-500/30 transition"
                          >Add</button>
                        </div>
                        <p className="text-[10px] text-white/25">Tip: right-click any food image on the web → "Copy image address" then paste here</p>
                      </div>
                    )}

                    {/* ── Gallery: swipeable carousel ── */}
                    {(() => {
                      const allImgs = [
                        ...(itemModalValue.images || []),
                        ...(itemModalValue.image && !(itemModalValue.images||[]).includes(itemModalValue.image) ? [itemModalValue.image] : []),
                      ];
                      if (allImgs.length === 0) return null;
                      const safeIdx = Math.min(imgPreviewIdx, allImgs.length - 1);
                      const goTo = (i) => setImgPreviewIdx(Math.max(0, Math.min(i, allImgs.length - 1)));
                      const removeImg = (i) => {
                        setItemModalValue(v => {
                          const imgs = allImgs.filter((_, j) => j !== i);
                          return { ...v, images: imgs, image: imgs[0] || "" };
                        });
                        goTo(Math.max(0, i - 1));
                      };
                      const setMain = (i) => {
                        const url = allImgs[i];
                        setItemModalValue(v => {
                          const others = allImgs.filter((_, j) => j !== i);
                          return { ...v, images: [url, ...others], image: url };
                        });
                        goTo(0);
                      };
                      return (
                        <div className={`rounded-2xl border overflow-hidden ${tc.cardBg}`}>
                          {/* Header */}
                          <div className="flex items-center justify-between px-3 py-2 border-b border-white/8">
                            <p className="text-xs text-white/50 flex items-center gap-1.5 font-medium">
                              <span>🖼️</span> {allImgs.length} photo{allImgs.length > 1 ? "s" : ""}
                              {safeIdx === 0 && <span className="px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[9px] font-bold">MAIN</span>}
                            </p>
                            <button type="button" onClick={() => setImgSubTab("pick")} className="text-[11px] text-white/30 hover:text-blue-300 transition">+ Add more</button>
                          </div>

                          {/* Big preview */}
                          <div className={`relative w-full h-40 overflow-hidden ${tc.mutedBg}`}>
                            <AnimatePresence mode="wait">
                              <motion.img
                                key={safeIdx}
                                src={allImgs[safeIdx]}
                                alt={`preview-${safeIdx}`}
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                transition={{ duration: 0.18 }}
                                className="w-full h-full object-cover"
                                onError={e => e.currentTarget.style.opacity = "0.1"}
                              />
                            </AnimatePresence>

                            {/* Prev / Next arrows */}
                            {allImgs.length > 1 && (
                              <>
                                <button type="button" onClick={() => goTo(safeIdx - 1)} disabled={safeIdx === 0}
                                  className="absolute left-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/60 backdrop-blur border border-white/15 text-white/80 hover:text-white hover:bg-black/80 transition flex items-center justify-center text-xs disabled:opacity-25 disabled:pointer-events-none"
                                >‹</button>
                                <button type="button" onClick={() => goTo(safeIdx + 1)} disabled={safeIdx === allImgs.length - 1}
                                  className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/60 backdrop-blur border border-white/15 text-white/80 hover:text-white hover:bg-black/80 transition flex items-center justify-center text-xs disabled:opacity-25 disabled:pointer-events-none"
                                >›</button>
                              </>
                            )}

                            {/* Action buttons on current image */}
                            <div className="absolute bottom-2 right-2 flex gap-1.5">
                              {safeIdx !== 0 && (
                                <button type="button" onClick={() => setMain(safeIdx)}
                                  className="px-2 py-1 rounded-lg bg-black/70 backdrop-blur text-amber-300 text-[10px] font-bold border border-amber-400/30 hover:bg-amber-500/20 transition"
                                >★ Set Main</button>
                              )}
                              <button type="button" onClick={() => removeImg(safeIdx)}
                                className="px-2 py-1 rounded-lg bg-black/70 backdrop-blur text-red-400 text-[10px] font-bold border border-red-400/30 hover:bg-red-500/20 transition"
                              >✕ Remove</button>
                            </div>
                          </div>

                          {/* Dot indicators */}
                          {allImgs.length > 1 && (
                            <div className="flex items-center justify-center gap-1.5 py-2 border-t border-white/5">
                              {allImgs.map((_, i) => (
                                <button key={i} type="button" onClick={() => goTo(i)}
                                  className={`rounded-full transition-all ${i === safeIdx ? "w-5 h-2 bg-emerald-400" : "w-2 h-2 bg-white/20 hover:bg-white/40"}`}
                                />
                              ))}
                            </div>
                          )}

                          {/* Horizontal scrollable thumbnails */}
                          {allImgs.length > 1 && (
                            <div className="flex gap-1.5 px-3 pb-3 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
                              {allImgs.map((url, i) => (
                                <button key={i} type="button" onClick={() => goTo(i)}
                                  className={`relative flex-shrink-0 w-12 h-12 rounded-xl overflow-hidden border-2 transition ${i === safeIdx ? "border-emerald-400 ring-1 ring-emerald-400/40" : "border-white/10 hover:border-white/30 opacity-60 hover:opacity-100"}`}
                                >
                                  <img src={url} alt={`thumb-${i}`} className="w-full h-full object-cover" onError={e => e.currentTarget.style.opacity="0"} />
                                  {i === 0 && <div className="absolute bottom-0 left-0 right-0 bg-emerald-500/80 text-[7px] text-white text-center font-black py-0.5">MAIN</div>}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                )}

                {/* Footer actions */}
                <div className={`flex items-center justify-between mt-6 pt-5 border-t ${tc.borderSoft}`}>
                  <div className="flex gap-2">
                    {itemModalTab !== "basic" && (
                      <button type="button" onClick={() => setItemModalTab(itemModalTab === "details" ? "basic" : "details")} className={`px-3 py-2 rounded-xl text-xs font-medium hover:bg-white/8 transition ${tc.textMuted}`}>← Back</button>
                    )}
                  </div>
                  <div className="flex gap-2 items-center">
                    <button type="button" onClick={() => setShowItemModal(false)} className={`px-4 py-2 rounded-xl text-sm hover:bg-white/8 transition ${tc.textMuted}`}>Cancel</button>
                    {itemModalTab !== "images" ? (
                      <button type="button" onClick={() => setItemModalTab(itemModalTab === "basic" ? "details" : "images")} className={`px-4 py-2 rounded-xl text-sm font-semibold border hover:bg-white/8 transition ${tc.borderSoft} ${tc.textSub}`}>Next →</button>
                    ) : null}
                    <motion.button
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                      type="submit"
                      className="px-5 py-2 rounded-xl text-sm font-bold bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white shadow-lg shadow-emerald-500/20 transition"
                    >
                      {itemModalMode === "add" ? "✓ Add Item" : "✓ Save Changes"}
                    </motion.button>
                  </div>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Preview Modal — Next-Gen Restaurant App Style */}
      <AnimatePresence>
        {showPreview && (
          <motion.div
            className="fixed inset-0 z-50 flex items-end justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowPreview(false)}
          >
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
            <motion.div
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              transition={{ type: "spring", stiffness: 280, damping: 32 }}
              className="relative w-full max-w-5xl h-[92vh] rounded-t-3xl overflow-hidden shadow-[0_-20px_80px_rgba(0,0,0,0.8)] flex flex-col"
              style={{ background: "linear-gradient(180deg, #0a0a0f 0%, #0f0f18 100%)" }}
              onClick={e => e.stopPropagation()}
            >
              {/* Drag handle */}
              <div className="flex justify-center pt-3 pb-1 shrink-0">
                <div className="w-10 h-1 rounded-full bg-white/15" />
              </div>

              {/* Restaurant header */}
              <div className="px-5 pt-2 pb-4 shrink-0">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-2xl">🍽️</span>
                      <h2 className="text-xl font-black text-white tracking-tight">Live Menu Preview</h2>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 uppercase tracking-wider">Live</span>
                    </div>
                    <p className="text-white/40 text-xs">What your customers see · {items.filter(i => showUnavailable || isAvailable(i)).length} items across {categories.length} categories</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-1.5 text-xs text-white/50 cursor-pointer">
                      <input type="checkbox" className="accent-emerald-400 w-3 h-3" checked={showUnavailable} onChange={e => setShowUnavailable(e.target.checked)} />
                      Show unavailable
                    </label>
                    <button onClick={() => setShowPreview(false)} className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white/70 hover:text-white flex items-center justify-center text-sm transition">✕</button>
                  </div>
                </div>

                {/* Search bar */}
                <div className="relative mt-3">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30 text-sm">🔍</span>
                  <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search dishes, drinks, desserts…"
                    className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-white/8 bg-white/5 text-white/90 placeholder:text-white/25 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/30 transition"
                  />
                  {search && <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition">✕</button>}
                </div>

                {/* Category pills — horizontal scroll */}
                <div className="flex gap-2 mt-3 overflow-x-auto pb-1 scrollbar-none" style={{ scrollbarWidth: "none" }}>
                  <button
                    onClick={() => setPreviewCategoryId("")}
                    className={`shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold transition border ${
                      previewCategoryId === "" ? "bg-emerald-500 border-emerald-400 text-white shadow-[0_0_16px_rgba(16,185,129,0.4)]" : "border-white/10 bg-white/5 text-white/50 hover:bg-white/8 hover:text-white/80"
                    }`}
                  >🍽️ All</button>
                  {categories.map(c => {
                    const count = items.filter(i => i.categoryId === c.id && (showUnavailable || isAvailable(i))).length;
                    return (
                      <button key={c.id} onClick={() => setPreviewCategoryId(c.id)}
                        className={`shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold transition border ${
                          previewCategoryId === c.id ? "bg-emerald-500 border-emerald-400 text-white shadow-[0_0_16px_rgba(16,185,129,0.4)]" : "border-white/10 bg-white/5 text-white/50 hover:bg-white/8 hover:text-white/80"
                        }`}
                      >
                        <Icon token={c.icon || mapCategoryIdToIcon(c.id)} fallback={fallbackEmojiById(c.id)} />
                        {c.name}
                        {count > 0 && <span className="ml-0.5 text-[9px] opacity-60">{count}</span>}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Items scroll area */}
              <div className="flex-1 overflow-y-auto px-5 pb-6">
                {(() => {
                  const visibleItems = items
                    .filter(i => !previewCategoryId || i.categoryId === previewCategoryId)
                    .filter(i => showUnavailable || isAvailable(i))
                    .filter(i => !search.trim() || i.name.toLowerCase().includes(search.toLowerCase()));

                  if (visibleItems.length === 0) {
                    return (
                      <div className="flex flex-col items-center justify-center h-48 text-center">
                        <div className="text-4xl mb-3 opacity-20">🍽️</div>
                        <p className="text-white/30 text-sm">{search ? "No items match your search" : "No items in this category"}</p>
                      </div>
                    );
                  }

                  // Group by category when "All" is selected
                  if (!previewCategoryId && !search.trim()) {
                    return categories.map(cat => {
                      const catItems = visibleItems.filter(i => i.categoryId === cat.id);
                      if (!catItems.length) return null;
                      return (
                        <div key={cat.id} className="mb-8">
                          <div className="flex items-center gap-2 mb-4">
                            <span className="text-xl"><Icon token={cat.icon || mapCategoryIdToIcon(cat.id)} fallback={fallbackEmojiById(cat.id)} /></span>
                            <h3 className="text-base font-black text-white">{cat.name}</h3>
                            <div className="flex-1 h-px bg-white/8 ml-2" />
                            <span className="text-[11px] text-white/30">{catItems.length} items</span>
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                            {catItems.map(item => <PreviewItemCard key={item.id} item={item} onEdit={() => { setShowPreview(false); handleEditItem(item); }} onToggle={() => toggleAvailability(item)} />)}
                          </div>
                        </div>
                      );
                    });
                  }

                  return (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 pt-1">
                      {visibleItems.map(item => <PreviewItemCard key={item.id} item={item} onEdit={() => { setShowPreview(false); handleEditItem(item); }} onToggle={() => toggleAvailability(item)} />)}
                    </div>
                  );
                })()}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Template Preview Modal */}
      <AnimatePresence>
        {showTemplatePreview && MENU_TEMPLATES[showTemplatePreview] && (() => {
          const tpl = MENU_TEMPLATES[showTemplatePreview];
          const TEMPLATE_META = {
            cafe:     { emoji: "☕", gradient: "from-amber-500/20 to-transparent", border: "border-amber-500/25", accent: "bg-amber-500", badge: "bg-amber-500/15 text-amber-300 border-amber-500/30" },
            north:    { emoji: "🍛", gradient: "from-orange-500/20 to-transparent", border: "border-orange-500/25", accent: "bg-orange-500", badge: "bg-orange-500/15 text-orange-300 border-orange-500/30" },
            south:    { emoji: "🥥", gradient: "from-green-500/20 to-transparent", border: "border-green-500/25", accent: "bg-green-500", badge: "bg-green-500/15 text-green-300 border-green-500/30" },
            pizzeria: { emoji: "🍕", gradient: "from-red-500/20 to-transparent", border: "border-red-500/25", accent: "bg-red-500", badge: "bg-red-500/15 text-red-300 border-red-500/30" },
            fastfood: { emoji: "🍔", gradient: "from-yellow-500/20 to-transparent", border: "border-yellow-500/25", accent: "bg-yellow-500", badge: "bg-yellow-500/15 text-yellow-300 border-yellow-500/30" },
            bar:      { emoji: "🍹", gradient: "from-purple-500/20 to-transparent", border: "border-purple-500/25", accent: "bg-purple-500", badge: "bg-purple-500/15 text-purple-300 border-purple-500/30" },
            bakery:   { emoji: "🎂", gradient: "from-pink-500/20 to-transparent", border: "border-pink-500/25", accent: "bg-pink-500", badge: "bg-pink-500/15 text-pink-300 border-pink-500/30" },
          };
          const meta = TEMPLATE_META[showTemplatePreview] || TEMPLATE_META.cafe;
          const grouped = tpl.categories.map(cat => ({
            ...cat,
            items: tpl.items.filter(i => i.categoryId === cat.id),
          }));
          return (
            <motion.div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowTemplatePreview(null)}
            >
              <motion.div
                initial={{ scale: 0.93, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.93, opacity: 0, y: 20 }}
                transition={{ type: "spring", stiffness: 260, damping: 26 }}
                className={`relative w-full max-w-3xl max-h-[88vh] rounded-3xl border ${meta.border} bg-gradient-to-br ${meta.gradient} shadow-[0_32px_80px_rgba(0,0,0,0.7)] overflow-hidden flex flex-col ${tc.modalBg}`}
                onClick={e => e.stopPropagation()}
              >
                {/* Header */}
                <div className="px-6 pt-6 pb-4 shrink-0">
                  <div className="flex items-start gap-4">
                    <div className="text-5xl shrink-0">{meta.emoji}</div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h2 className="text-xl font-black text-white">{tpl.label}</h2>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black border ${meta.badge}`}>{tpl.categories.length} categories · {tpl.items.length} items</span>
                      </div>
                      <p className="text-white/50 text-sm">{tpl.description}</p>
                    </div>
                    <button onClick={() => setShowTemplatePreview(null)} className="w-8 h-8 rounded-full bg-white/8 hover:bg-white/15 text-white/50 hover:text-white flex items-center justify-center text-sm transition shrink-0">✕</button>
                  </div>

                  {/* Stats */}
                  <div className="flex gap-3 mt-4">
                    {[
                      ["📂", `${tpl.categories.length} Categories`],
                      ["🍽️", `${tpl.items.length} Menu Items`],
                      ["🌿", `${tpl.items.filter(i => (i.type||"veg").toLowerCase()==="veg").length} Veg`],
                      ["🍗", `${tpl.items.filter(i => (i.type||"").toLowerCase()==="nonveg").length} Non-Veg`],
                    ].map(([ic, lb]) => (
                      <div key={lb} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 border border-white/8 text-xs text-white/60">
                        <span>{ic}</span><span>{lb}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Warning if existing menu */}
                {(categories.length > 0 || items.length > 0) && (
                  <div className="mx-6 mb-3 px-4 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-center gap-2 shrink-0">
                    <span className="text-amber-300 text-sm">⚠️</span>
                    <p className="text-amber-300/80 text-xs"><strong className="font-bold">Heads up:</strong> You already have {categories.length} categories and {items.length} items. Applying this template will add on top — it won't delete your existing menu.</p>
                  </div>
                )}

                {/* Item list scrollable */}
                <div className="flex-1 overflow-y-auto px-6 pb-4">
                  <div className="space-y-5">
                    {grouped.map(cat => (
                      <div key={cat.id}>
                        <div className="flex items-center gap-2 mb-2.5">
                          <div className="font-bold text-white/80 text-sm">{cat.name}</div>
                          <span className="text-[10px] text-white/30 px-1.5 py-0.5 rounded-full bg-white/5 border border-white/8">{cat.items.length} items</span>
                          <div className="flex-1 h-px bg-white/6" />
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {cat.items.map((item, i) => (
                            <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/4 border border-white/6">
                              <div className={`w-3 h-3 rounded-sm border-2 flex items-center justify-center shrink-0 ${(item.type||"veg").toLowerCase()==="veg" ? "border-emerald-400" : "border-red-400"}`}>
                                <div className={`w-1.5 h-1.5 rounded-full ${(item.type||"veg").toLowerCase()==="veg" ? "bg-emerald-400" : "bg-red-400"}`} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs text-white/80 font-medium truncate">{item.name}</p>
                              </div>
                              <span className="text-xs font-bold text-white/60 shrink-0">₹{item.price}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Footer */}
                <div className={`px-6 py-4 border-t border-white/8 flex items-center gap-3 shrink-0 backdrop-blur ${tc.mutedBg}`}>
                  <p className="text-xs text-white/35 flex-1">You can edit, delete or add items after applying.</p>
                  <button onClick={() => setShowTemplatePreview(null)} className="px-4 py-2.5 rounded-xl text-sm text-white/50 hover:text-white hover:bg-white/8 transition">Cancel</button>
                  <motion.button
                    whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                    onClick={() => { applyTemplate(showTemplatePreview); setShowTemplatePreview(null); }}
                    className={`px-6 py-2.5 rounded-xl text-sm font-black text-white shadow-lg transition flex items-center gap-2 ${meta.accent} hover:opacity-90`}
                  >
                    ⚡ Apply This Template
                  </motion.button>
                </div>
              </motion.div>
            </motion.div>
          );
        })()}
      </AnimatePresence>
    </div>
  );
};

export default CreateMenu;
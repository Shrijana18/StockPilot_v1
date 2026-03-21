/**
 * ingredientEstimator.js
 * Smart keyword-based ingredient estimation for common Indian restaurant items.
 * Used when the user has not manually configured ingredients for a menu item.
 */

// ── Ingredient categories ─────────────────────────────────────────────────────
export const INGREDIENT_CATEGORIES = [
  "Dairy & Beverages",
  "Grains & Flour",
  "Vegetables",
  "Meat & Protein",
  "Spices & Masala",
  "Oils & Condiments",
  "Sweeteners",
  "Packaging",
  "Other",
];

// ── Master ingredient DB ──────────────────────────────────────────────────────
// Each entry: { keywords[], ingredients[{ name, unit, qtyPerUnit, category }] }
// qtyPerUnit = quantity of ingredient needed per 1 serving of the menu item
const INGREDIENT_DB = [
  // ── BEVERAGES ──────────────────────────────────────────────────────────────
  {
    keywords: ["cold coffee", "cold brew", "iced coffee"],
    ingredients: [
      { name: "Cold Coffee Premix / Instant Coffee", unit: "g",  qtyPerUnit: 25,  category: "Dairy & Beverages" },
      { name: "Milk",                                unit: "ml", qtyPerUnit: 180, category: "Dairy & Beverages" },
      { name: "Sugar",                               unit: "g",  qtyPerUnit: 20,  category: "Sweeteners"        },
      { name: "Ice Cubes",                           unit: "g",  qtyPerUnit: 100, category: "Other"             },
      { name: "Cream (optional)",                    unit: "ml", qtyPerUnit: 20,  category: "Dairy & Beverages" },
    ],
  },
  {
    keywords: ["hot coffee", "espresso", "cappuccino", "latte", "americano"],
    ingredients: [
      { name: "Coffee Beans / Powder",               unit: "g",  qtyPerUnit: 18,  category: "Dairy & Beverages" },
      { name: "Milk",                                unit: "ml", qtyPerUnit: 120, category: "Dairy & Beverages" },
      { name: "Sugar",                               unit: "g",  qtyPerUnit: 10,  category: "Sweeteners"        },
    ],
  },
  {
    keywords: ["chai", "tea", "masala chai", "ginger tea", "cutting"],
    ingredients: [
      { name: "Tea Leaves (CTC)",                    unit: "g",  qtyPerUnit: 5,   category: "Dairy & Beverages" },
      { name: "Milk",                                unit: "ml", qtyPerUnit: 100, category: "Dairy & Beverages" },
      { name: "Sugar",                               unit: "g",  qtyPerUnit: 12,  category: "Sweeteners"        },
      { name: "Ginger",                              unit: "g",  qtyPerUnit: 3,   category: "Vegetables"        },
      { name: "Cardamom (Elaichi)",                  unit: "g",  qtyPerUnit: 0.5, category: "Spices & Masala"   },
    ],
  },
  {
    keywords: ["lassi", "sweet lassi", "salted lassi", "mango lassi"],
    ingredients: [
      { name: "Yogurt (Curd)",                       unit: "ml", qtyPerUnit: 200, category: "Dairy & Beverages" },
      { name: "Sugar",                               unit: "g",  qtyPerUnit: 25,  category: "Sweeteners"        },
      { name: "Milk",                                unit: "ml", qtyPerUnit: 50,  category: "Dairy & Beverages" },
      { name: "Ice",                                 unit: "g",  qtyPerUnit: 80,  category: "Other"             },
    ],
  },
  {
    keywords: ["milkshake", "milk shake", "shake", "thick shake"],
    ingredients: [
      { name: "Milk",                                unit: "ml", qtyPerUnit: 200, category: "Dairy & Beverages" },
      { name: "Ice Cream",                           unit: "g",  qtyPerUnit: 80,  category: "Dairy & Beverages" },
      { name: "Sugar / Flavour Syrup",               unit: "g",  qtyPerUnit: 25,  category: "Sweeteners"        },
      { name: "Ice",                                 unit: "g",  qtyPerUnit: 50,  category: "Other"             },
    ],
  },
  {
    keywords: ["juice", "fresh juice", "orange juice", "mosambi", "watermelon juice"],
    ingredients: [
      { name: "Fresh Fruit (seasonal)",              unit: "g",  qtyPerUnit: 250, category: "Vegetables"        },
      { name: "Sugar / Black Salt",                  unit: "g",  qtyPerUnit: 10,  category: "Sweeteners"        },
      { name: "Ice",                                 unit: "g",  qtyPerUnit: 50,  category: "Other"             },
    ],
  },
  {
    keywords: ["mocktail", "lemonade", "nimbu pani", "shikanji", "lemon"],
    ingredients: [
      { name: "Lemon",                               unit: "pcs",qtyPerUnit: 1,   category: "Vegetables"        },
      { name: "Sugar Syrup",                         unit: "ml", qtyPerUnit: 30,  category: "Sweeteners"        },
      { name: "Water / Soda",                        unit: "ml", qtyPerUnit: 200, category: "Other"             },
      { name: "Black Salt (Kala Namak)",             unit: "g",  qtyPerUnit: 1,   category: "Spices & Masala"   },
      { name: "Ice",                                 unit: "g",  qtyPerUnit: 80,  category: "Other"             },
    ],
  },

  // ── SOUTH INDIAN ───────────────────────────────────────────────────────────
  {
    keywords: ["dosa", "masala dosa", "plain dosa", "crispy dosa", "rava dosa"],
    ingredients: [
      { name: "Dosa Batter (Rice + Urad Dal)",       unit: "g",  qtyPerUnit: 150, category: "Grains & Flour"   },
      { name: "Oil / Ghee",                          unit: "ml", qtyPerUnit: 10,  category: "Oils & Condiments" },
      { name: "Potato (for masala)",                 unit: "g",  qtyPerUnit: 80,  category: "Vegetables"        },
      { name: "Onion",                               unit: "g",  qtyPerUnit: 30,  category: "Vegetables"        },
      { name: "Mustard Seeds",                       unit: "g",  qtyPerUnit: 2,   category: "Spices & Masala"   },
      { name: "Curry Leaves",                        unit: "g",  qtyPerUnit: 2,   category: "Vegetables"        },
      { name: "Turmeric Powder",                     unit: "g",  qtyPerUnit: 1,   category: "Spices & Masala"   },
    ],
  },
  {
    keywords: ["idli", "mini idli", "soft idli"],
    ingredients: [
      { name: "Idli Batter (Rice + Urad Dal)",       unit: "g",  qtyPerUnit: 120, category: "Grains & Flour"   },
      { name: "Sambar (lentil)",                     unit: "ml", qtyPerUnit: 100, category: "Grains & Flour"   },
      { name: "Coconut Chutney Ingredients",         unit: "g",  qtyPerUnit: 30,  category: "Vegetables"        },
    ],
  },
  {
    keywords: ["medu vada", "vada", "sambar vada"],
    ingredients: [
      { name: "Urad Dal",                            unit: "g",  qtyPerUnit: 80,  category: "Grains & Flour"   },
      { name: "Oil (for frying)",                    unit: "ml", qtyPerUnit: 50,  category: "Oils & Condiments" },
      { name: "Green Chilli",                        unit: "g",  qtyPerUnit: 5,   category: "Vegetables"        },
      { name: "Ginger",                              unit: "g",  qtyPerUnit: 3,   category: "Vegetables"        },
    ],
  },
  {
    keywords: ["uttapam", "uthappam"],
    ingredients: [
      { name: "Dosa Batter",                         unit: "g",  qtyPerUnit: 150, category: "Grains & Flour"   },
      { name: "Onion (chopped)",                     unit: "g",  qtyPerUnit: 40,  category: "Vegetables"        },
      { name: "Tomato (chopped)",                    unit: "g",  qtyPerUnit: 30,  category: "Vegetables"        },
      { name: "Green Chilli",                        unit: "g",  qtyPerUnit: 5,   category: "Vegetables"        },
      { name: "Oil",                                 unit: "ml", qtyPerUnit: 10,  category: "Oils & Condiments" },
    ],
  },

  // ── SNACKS ─────────────────────────────────────────────────────────────────
  {
    keywords: ["samosa", "samosas"],
    ingredients: [
      { name: "All Purpose Flour (Maida)",           unit: "g",  qtyPerUnit: 60,  category: "Grains & Flour"   },
      { name: "Potato",                              unit: "g",  qtyPerUnit: 80,  category: "Vegetables"        },
      { name: "Peas (Matar)",                        unit: "g",  qtyPerUnit: 20,  category: "Vegetables"        },
      { name: "Oil (for frying)",                    unit: "ml", qtyPerUnit: 80,  category: "Oils & Condiments" },
      { name: "Cumin Seeds (Jeera)",                 unit: "g",  qtyPerUnit: 2,   category: "Spices & Masala"   },
      { name: "Coriander Powder",                    unit: "g",  qtyPerUnit: 2,   category: "Spices & Masala"   },
      { name: "Garam Masala",                        unit: "g",  qtyPerUnit: 1,   category: "Spices & Masala"   },
    ],
  },
  {
    keywords: ["vada pav", "wada pav"],
    ingredients: [
      { name: "Potato",                              unit: "g",  qtyPerUnit: 100, category: "Vegetables"        },
      { name: "Besan (Chickpea Flour)",              unit: "g",  qtyPerUnit: 40,  category: "Grains & Flour"   },
      { name: "Pav Bread",                           unit: "pcs",qtyPerUnit: 1,   category: "Grains & Flour"   },
      { name: "Oil (for frying)",                    unit: "ml", qtyPerUnit: 60,  category: "Oils & Condiments" },
      { name: "Mustard Seeds",                       unit: "g",  qtyPerUnit: 2,   category: "Spices & Masala"   },
      { name: "Turmeric Powder",                     unit: "g",  qtyPerUnit: 1,   category: "Spices & Masala"   },
      { name: "Green Chutney Ingredients",           unit: "g",  qtyPerUnit: 20,  category: "Vegetables"        },
    ],
  },
  {
    keywords: ["bread pakora", "pakora", "pakoda", "bhajiya", "bhajji"],
    ingredients: [
      { name: "Besan (Chickpea Flour)",              unit: "g",  qtyPerUnit: 60,  category: "Grains & Flour"   },
      { name: "Bread Slices",                        unit: "pcs",qtyPerUnit: 2,   category: "Grains & Flour"   },
      { name: "Oil (for frying)",                    unit: "ml", qtyPerUnit: 80,  category: "Oils & Condiments" },
      { name: "Red Chilli Powder",                   unit: "g",  qtyPerUnit: 2,   category: "Spices & Masala"   },
      { name: "Salt",                                unit: "g",  qtyPerUnit: 2,   category: "Spices & Masala"   },
    ],
  },
  {
    keywords: ["pani puri", "golgappa", "puchka", "water puri"],
    ingredients: [
      { name: "Pani Puri (Puris)",                   unit: "pcs",qtyPerUnit: 6,   category: "Grains & Flour"   },
      { name: "Tamarind (Imli)",                     unit: "g",  qtyPerUnit: 10,  category: "Spices & Masala"   },
      { name: "Mint (Pudina)",                       unit: "g",  qtyPerUnit: 10,  category: "Vegetables"        },
      { name: "Black Salt",                          unit: "g",  qtyPerUnit: 2,   category: "Spices & Masala"   },
      { name: "Boiled Potato / Chickpeas",           unit: "g",  qtyPerUnit: 50,  category: "Vegetables"        },
    ],
  },
  {
    keywords: ["spring roll", "spring rolls"],
    ingredients: [
      { name: "Spring Roll Sheets",                  unit: "pcs",qtyPerUnit: 3,   category: "Grains & Flour"   },
      { name: "Cabbage (shredded)",                  unit: "g",  qtyPerUnit: 60,  category: "Vegetables"        },
      { name: "Carrot (shredded)",                   unit: "g",  qtyPerUnit: 30,  category: "Vegetables"        },
      { name: "Oil (for frying)",                    unit: "ml", qtyPerUnit: 80,  category: "Oils & Condiments" },
      { name: "Soy Sauce",                           unit: "ml", qtyPerUnit: 10,  category: "Oils & Condiments" },
    ],
  },

  // ── RICE DISHES ────────────────────────────────────────────────────────────
  {
    keywords: ["biryani", "dum biryani", "chicken biryani", "mutton biryani", "veg biryani", "hyderabadi"],
    ingredients: [
      { name: "Basmati Rice",                        unit: "g",  qtyPerUnit: 150, category: "Grains & Flour"   },
      { name: "Chicken / Mutton / Vegetables",       unit: "g",  qtyPerUnit: 150, category: "Meat & Protein"   },
      { name: "Onion (Birista / fried)",             unit: "g",  qtyPerUnit: 50,  category: "Vegetables"        },
      { name: "Yogurt (Curd)",                       unit: "g",  qtyPerUnit: 50,  category: "Dairy & Beverages" },
      { name: "Ghee",                                unit: "ml", qtyPerUnit: 15,  category: "Oils & Condiments" },
      { name: "Biryani Masala",                      unit: "g",  qtyPerUnit: 8,   category: "Spices & Masala"   },
      { name: "Saffron (Kesar)",                     unit: "g",  qtyPerUnit: 0.1, category: "Spices & Masala"   },
      { name: "Mint (Pudina)",                       unit: "g",  qtyPerUnit: 10,  category: "Vegetables"        },
    ],
  },
  {
    keywords: ["fried rice", "chinese rice", "schezwan rice", "veg fried rice", "egg fried rice"],
    ingredients: [
      { name: "Cooked Rice",                         unit: "g",  qtyPerUnit: 200, category: "Grains & Flour"   },
      { name: "Mixed Vegetables",                    unit: "g",  qtyPerUnit: 80,  category: "Vegetables"        },
      { name: "Egg (optional)",                      unit: "pcs",qtyPerUnit: 1,   category: "Meat & Protein"   },
      { name: "Soy Sauce",                           unit: "ml", qtyPerUnit: 15,  category: "Oils & Condiments" },
      { name: "Cooking Oil",                         unit: "ml", qtyPerUnit: 20,  category: "Oils & Condiments" },
      { name: "Spring Onion",                        unit: "g",  qtyPerUnit: 20,  category: "Vegetables"        },
    ],
  },
  {
    keywords: ["pulao", "jeera rice", "plain rice", "steamed rice"],
    ingredients: [
      { name: "Rice (Basmati / Regular)",            unit: "g",  qtyPerUnit: 150, category: "Grains & Flour"   },
      { name: "Ghee / Oil",                          unit: "ml", qtyPerUnit: 8,   category: "Oils & Condiments" },
      { name: "Cumin Seeds (Jeera)",                 unit: "g",  qtyPerUnit: 2,   category: "Spices & Masala"   },
      { name: "Salt",                                unit: "g",  qtyPerUnit: 2,   category: "Spices & Masala"   },
    ],
  },

  // ── BREADS ─────────────────────────────────────────────────────────────────
  {
    keywords: ["roti", "chapati", "phulka", "tawa roti"],
    ingredients: [
      { name: "Whole Wheat Flour (Atta)",            unit: "g",  qtyPerUnit: 50,  category: "Grains & Flour"   },
      { name: "Oil / Ghee",                          unit: "g",  qtyPerUnit: 3,   category: "Oils & Condiments" },
    ],
  },
  {
    keywords: ["naan", "garlic naan", "butter naan", "kulcha"],
    ingredients: [
      { name: "All Purpose Flour (Maida)",           unit: "g",  qtyPerUnit: 80,  category: "Grains & Flour"   },
      { name: "Yogurt (Curd)",                       unit: "g",  qtyPerUnit: 20,  category: "Dairy & Beverages" },
      { name: "Butter / Ghee",                       unit: "g",  qtyPerUnit: 10,  category: "Dairy & Beverages" },
      { name: "Garlic (for garlic naan)",            unit: "g",  qtyPerUnit: 5,   category: "Vegetables"        },
    ],
  },
  {
    keywords: ["paratha", "aloo paratha", "paneer paratha", "gobi paratha", "stuffed paratha"],
    ingredients: [
      { name: "Whole Wheat Flour (Atta)",            unit: "g",  qtyPerUnit: 80,  category: "Grains & Flour"   },
      { name: "Filling (Potato / Paneer / Gobi)",    unit: "g",  qtyPerUnit: 60,  category: "Vegetables"        },
      { name: "Ghee / Butter",                       unit: "g",  qtyPerUnit: 10,  category: "Oils & Condiments" },
      { name: "Mixed Spices",                        unit: "g",  qtyPerUnit: 3,   category: "Spices & Masala"   },
    ],
  },

  // ── DAL & CURRIES ──────────────────────────────────────────────────────────
  {
    keywords: ["dal", "dal tadka", "dal makhani", "dal fry", "lentil"],
    ingredients: [
      { name: "Dal (Toor / Urad / Masoor)",          unit: "g",  qtyPerUnit: 80,  category: "Grains & Flour"   },
      { name: "Onion",                               unit: "g",  qtyPerUnit: 30,  category: "Vegetables"        },
      { name: "Tomato",                              unit: "g",  qtyPerUnit: 30,  category: "Vegetables"        },
      { name: "Butter / Oil",                        unit: "g",  qtyPerUnit: 10,  category: "Oils & Condiments" },
      { name: "Cumin Seeds",                         unit: "g",  qtyPerUnit: 2,   category: "Spices & Masala"   },
      { name: "Turmeric, Coriander Powder",          unit: "g",  qtyPerUnit: 3,   category: "Spices & Masala"   },
    ],
  },
  {
    keywords: ["paneer", "paneer butter masala", "shahi paneer", "palak paneer", "kadai paneer", "matar paneer"],
    ingredients: [
      { name: "Paneer (Cottage Cheese)",             unit: "g",  qtyPerUnit: 120, category: "Dairy & Beverages" },
      { name: "Onion",                               unit: "g",  qtyPerUnit: 50,  category: "Vegetables"        },
      { name: "Tomato Puree",                        unit: "ml", qtyPerUnit: 80,  category: "Vegetables"        },
      { name: "Cream",                               unit: "ml", qtyPerUnit: 30,  category: "Dairy & Beverages" },
      { name: "Butter / Oil",                        unit: "g",  qtyPerUnit: 15,  category: "Oils & Condiments" },
      { name: "Spices (Garam Masala, Kasuri Methi)", unit: "g",  qtyPerUnit: 5,   category: "Spices & Masala"   },
    ],
  },
  {
    keywords: ["chicken curry", "chicken masala", "butter chicken", "murgh", "murg"],
    ingredients: [
      { name: "Chicken",                             unit: "g",  qtyPerUnit: 200, category: "Meat & Protein"   },
      { name: "Onion",                               unit: "g",  qtyPerUnit: 60,  category: "Vegetables"        },
      { name: "Tomato",                              unit: "g",  qtyPerUnit: 60,  category: "Vegetables"        },
      { name: "Yogurt (Curd)",                       unit: "g",  qtyPerUnit: 30,  category: "Dairy & Beverages" },
      { name: "Cream",                               unit: "ml", qtyPerUnit: 25,  category: "Dairy & Beverages" },
      { name: "Butter / Oil",                        unit: "g",  qtyPerUnit: 15,  category: "Oils & Condiments" },
      { name: "Chicken Masala / Mixed Spices",       unit: "g",  qtyPerUnit: 8,   category: "Spices & Masala"   },
    ],
  },
  {
    keywords: ["mutton", "lamb curry", "rogan josh", "mutton curry"],
    ingredients: [
      { name: "Mutton",                              unit: "g",  qtyPerUnit: 200, category: "Meat & Protein"   },
      { name: "Onion",                               unit: "g",  qtyPerUnit: 70,  category: "Vegetables"        },
      { name: "Tomato",                              unit: "g",  qtyPerUnit: 50,  category: "Vegetables"        },
      { name: "Yogurt",                              unit: "g",  qtyPerUnit: 40,  category: "Dairy & Beverages" },
      { name: "Oil / Ghee",                          unit: "g",  qtyPerUnit: 20,  category: "Oils & Condiments" },
      { name: "Whole Spices + Masala",               unit: "g",  qtyPerUnit: 10,  category: "Spices & Masala"   },
    ],
  },

  // ── FAST FOOD ──────────────────────────────────────────────────────────────
  {
    keywords: ["burger", "veg burger", "chicken burger", "aloo tikki burger"],
    ingredients: [
      { name: "Burger Bun",                          unit: "pcs",qtyPerUnit: 1,   category: "Grains & Flour"   },
      { name: "Burger Patty (Veg/Chicken)",          unit: "g",  qtyPerUnit: 80,  category: "Meat & Protein"   },
      { name: "Lettuce / Cabbage",                   unit: "g",  qtyPerUnit: 20,  category: "Vegetables"        },
      { name: "Tomato (sliced)",                     unit: "g",  qtyPerUnit: 20,  category: "Vegetables"        },
      { name: "Onion (sliced)",                      unit: "g",  qtyPerUnit: 15,  category: "Vegetables"        },
      { name: "Mayonnaise / Sauce",                  unit: "ml", qtyPerUnit: 20,  category: "Oils & Condiments" },
      { name: "Cheese Slice",                        unit: "pcs",qtyPerUnit: 1,   category: "Dairy & Beverages" },
    ],
  },
  {
    keywords: ["pizza", "margherita", "veg pizza", "chicken pizza"],
    ingredients: [
      { name: "Pizza Dough / Base",                  unit: "g",  qtyPerUnit: 200, category: "Grains & Flour"   },
      { name: "Pizza Sauce (Tomato)",                unit: "g",  qtyPerUnit: 60,  category: "Oils & Condiments" },
      { name: "Mozzarella Cheese",                   unit: "g",  qtyPerUnit: 80,  category: "Dairy & Beverages" },
      { name: "Toppings (Vegetables / Chicken)",     unit: "g",  qtyPerUnit: 100, category: "Vegetables"        },
      { name: "Oregano / Chilli Flakes",             unit: "g",  qtyPerUnit: 2,   category: "Spices & Masala"   },
    ],
  },
  {
    keywords: ["sandwich", "grilled sandwich", "club sandwich", "toast sandwich"],
    ingredients: [
      { name: "Bread Slices",                        unit: "pcs",qtyPerUnit: 2,   category: "Grains & Flour"   },
      { name: "Filling (Veg / Chicken / Egg)",       unit: "g",  qtyPerUnit: 80,  category: "Meat & Protein"   },
      { name: "Butter / Mayo",                       unit: "g",  qtyPerUnit: 15,  category: "Oils & Condiments" },
      { name: "Tomato, Onion, Cucumber",             unit: "g",  qtyPerUnit: 40,  category: "Vegetables"        },
      { name: "Cheese Slice (optional)",             unit: "pcs",qtyPerUnit: 1,   category: "Dairy & Beverages" },
    ],
  },
  {
    keywords: ["pasta", "penne", "spaghetti", "white sauce pasta", "red sauce pasta", "arabiata"],
    ingredients: [
      { name: "Pasta (uncooked)",                    unit: "g",  qtyPerUnit: 80,  category: "Grains & Flour"   },
      { name: "Pasta Sauce (Red / White)",           unit: "ml", qtyPerUnit: 100, category: "Oils & Condiments" },
      { name: "Cheese (Parmesan / Mozzarella)",      unit: "g",  qtyPerUnit: 30,  category: "Dairy & Beverages" },
      { name: "Vegetables / Chicken",                unit: "g",  qtyPerUnit: 60,  category: "Vegetables"        },
      { name: "Butter / Olive Oil",                  unit: "ml", qtyPerUnit: 15,  category: "Oils & Condiments" },
    ],
  },
  {
    keywords: ["noodles", "hakka noodles", "chow mein", "maggi"],
    ingredients: [
      { name: "Noodles (dry)",                       unit: "g",  qtyPerUnit: 80,  category: "Grains & Flour"   },
      { name: "Mixed Vegetables",                    unit: "g",  qtyPerUnit: 80,  category: "Vegetables"        },
      { name: "Soy Sauce / Schezwan Sauce",          unit: "ml", qtyPerUnit: 20,  category: "Oils & Condiments" },
      { name: "Cooking Oil",                         unit: "ml", qtyPerUnit: 20,  category: "Oils & Condiments" },
      { name: "Spring Onion",                        unit: "g",  qtyPerUnit: 15,  category: "Vegetables"        },
    ],
  },

  // ── SOUPS ──────────────────────────────────────────────────────────────────
  {
    keywords: ["soup", "sweet corn soup", "tomato soup", "manchow soup", "hot sour soup"],
    ingredients: [
      { name: "Soup Base / Stock",                   unit: "ml", qtyPerUnit: 200, category: "Other"             },
      { name: "Main Ingredient (Tomato/Corn/Mixed)", unit: "g",  qtyPerUnit: 80,  category: "Vegetables"        },
      { name: "Corn Flour (thickener)",              unit: "g",  qtyPerUnit: 15,  category: "Grains & Flour"   },
      { name: "Butter / Oil",                        unit: "g",  qtyPerUnit: 5,   category: "Oils & Condiments" },
    ],
  },

  // ── DESSERTS ───────────────────────────────────────────────────────────────
  {
    keywords: ["gulab jamun"],
    ingredients: [
      { name: "Milk Powder / Khoya",                 unit: "g",  qtyPerUnit: 50,  category: "Dairy & Beverages" },
      { name: "Maida",                               unit: "g",  qtyPerUnit: 15,  category: "Grains & Flour"   },
      { name: "Sugar (for syrup)",                   unit: "g",  qtyPerUnit: 60,  category: "Sweeteners"        },
      { name: "Oil (for frying)",                    unit: "ml", qtyPerUnit: 80,  category: "Oils & Condiments" },
      { name: "Cardamom Powder",                     unit: "g",  qtyPerUnit: 0.5, category: "Spices & Masala"   },
    ],
  },
  {
    keywords: ["ice cream", "ice-cream", "soft serve", "sundae", "cone"],
    ingredients: [
      { name: "Ice Cream Mix / Scoops",              unit: "g",  qtyPerUnit: 80,  category: "Dairy & Beverages" },
      { name: "Toppings / Sauce",                    unit: "g",  qtyPerUnit: 20,  category: "Sweeteners"        },
      { name: "Cone / Cup",                          unit: "pcs",qtyPerUnit: 1,   category: "Packaging"         },
    ],
  },
  {
    keywords: ["kheer", "rice kheer", "payasam"],
    ingredients: [
      { name: "Rice",                                unit: "g",  qtyPerUnit: 40,  category: "Grains & Flour"   },
      { name: "Milk",                                unit: "ml", qtyPerUnit: 300, category: "Dairy & Beverages" },
      { name: "Sugar",                               unit: "g",  qtyPerUnit: 40,  category: "Sweeteners"        },
      { name: "Cardamom, Saffron",                   unit: "g",  qtyPerUnit: 1,   category: "Spices & Masala"   },
      { name: "Dry Fruits",                          unit: "g",  qtyPerUnit: 10,  category: "Other"             },
    ],
  },
  {
    keywords: ["brownie", "chocolate brownie", "warm brownie"],
    ingredients: [
      { name: "Dark Chocolate / Cocoa Powder",       unit: "g",  qtyPerUnit: 30,  category: "Sweeteners"        },
      { name: "Butter",                              unit: "g",  qtyPerUnit: 40,  category: "Dairy & Beverages" },
      { name: "Sugar",                               unit: "g",  qtyPerUnit: 50,  category: "Sweeteners"        },
      { name: "Egg",                                 unit: "pcs",qtyPerUnit: 1,   category: "Meat & Protein"   },
      { name: "Maida",                               unit: "g",  qtyPerUnit: 30,  category: "Grains & Flour"   },
    ],
  },

  // ── BREAKFAST ──────────────────────────────────────────────────────────────
  {
    keywords: ["poha", "kanda poha", "onion poha"],
    ingredients: [
      { name: "Flattened Rice (Poha)",               unit: "g",  qtyPerUnit: 100, category: "Grains & Flour"   },
      { name: "Onion",                               unit: "g",  qtyPerUnit: 40,  category: "Vegetables"        },
      { name: "Mustard Seeds, Curry Leaves",         unit: "g",  qtyPerUnit: 3,   category: "Spices & Masala"   },
      { name: "Oil",                                 unit: "ml", qtyPerUnit: 15,  category: "Oils & Condiments" },
      { name: "Turmeric, Salt",                      unit: "g",  qtyPerUnit: 2,   category: "Spices & Masala"   },
    ],
  },
  {
    keywords: ["upma", "rava upma", "semolina"],
    ingredients: [
      { name: "Semolina (Rava / Suji)",              unit: "g",  qtyPerUnit: 80,  category: "Grains & Flour"   },
      { name: "Mixed Vegetables",                    unit: "g",  qtyPerUnit: 50,  category: "Vegetables"        },
      { name: "Oil",                                 unit: "ml", qtyPerUnit: 15,  category: "Oils & Condiments" },
      { name: "Mustard Seeds, Curry Leaves",         unit: "g",  qtyPerUnit: 3,   category: "Spices & Masala"   },
    ],
  },
  {
    keywords: ["omelette", "egg omelette", "masala omelette", "egg"],
    ingredients: [
      { name: "Egg",                                 unit: "pcs",qtyPerUnit: 2,   category: "Meat & Protein"   },
      { name: "Onion",                               unit: "g",  qtyPerUnit: 20,  category: "Vegetables"        },
      { name: "Green Chilli, Coriander",             unit: "g",  qtyPerUnit: 5,   category: "Vegetables"        },
      { name: "Oil / Butter",                        unit: "g",  qtyPerUnit: 8,   category: "Oils & Condiments" },
      { name: "Salt, Pepper",                        unit: "g",  qtyPerUnit: 2,   category: "Spices & Masala"   },
    ],
  },
];

// ── Estimator function ─────────────────────────────────────────────────────────
/**
 * Returns estimated ingredients for a menu item based on its name.
 * @param {string} itemName - Menu item name
 * @returns {Array} Array of ingredient objects, or empty if no match
 */
export function estimateIngredients(itemName) {
  if (!itemName) return [];
  const name = itemName.toLowerCase().trim();

  for (const entry of INGREDIENT_DB) {
    for (const keyword of entry.keywords) {
      if (name.includes(keyword) || keyword.includes(name)) {
        return entry.ingredients.map(ing => ({ ...ing }));
      }
    }
  }

  // Partial keyword matching — check individual words
  const words = name.split(/[\s-_]+/);
  for (const word of words) {
    if (word.length < 3) continue;
    for (const entry of INGREDIENT_DB) {
      for (const keyword of entry.keywords) {
        if (keyword.includes(word)) {
          return entry.ingredients.map(ing => ({ ...ing }));
        }
      }
    }
  }

  return [];
}

/**
 * Returns a confidence label for the estimation.
 */
export function estimationConfidence(itemName) {
  const name = (itemName || "").toLowerCase();
  for (const entry of INGREDIENT_DB) {
    for (const keyword of entry.keywords) {
      if (name.includes(keyword)) return "high";
    }
  }
  const words = name.split(/[\s-_]+/).filter(w => w.length >= 3);
  for (const word of words) {
    for (const entry of INGREDIENT_DB) {
      for (const keyword of entry.keywords) {
        if (keyword.includes(word)) return "medium";
      }
    }
  }
  return "none";
}

// const cors = require('cors')({ origin: true });
// FLYP Voice • Minimal Parser HTTP Function (Node 20, ESM)
// Entry: export const parseAndAct = (req,res)
// Returns a normalized shape: { ok:true, action: string, slots: object }
// so the frontend can switch on action names directly.

// --- CORS helper: reflect allowed origins (dev + prod) ---
function setCors(req, res) {
  const origin = req.headers.origin || "";

  // Allow any localhost origin (any port) during development; fallback to wildcard for others
  const isLocalhost = /^http:\/\/localhost(?::\d+)?$/.test(origin);
  const allowOrigin = isLocalhost ? origin : "*"; // tighten for prod domains later

  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Origin", allowOrigin);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  // Echo requested headers if present so complex requests succeed
  const reqHeaders = req.headers["access-control-request-headers"];
  res.setHeader(
    "Access-Control-Allow-Headers",
    reqHeaders && typeof reqHeaders === "string" ? reqHeaders : "Content-Type, Authorization"
  );
  res.setHeader("Access-Control-Max-Age", "3600");
}

// --- normalize brand/product name (handle common misspellings) ---
function normalizeName(name) {
  const n = String(name || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
  const map = {
    "chawanprash": "chyawanprash",
    "chavanprash": "chyawanprash",
    "chawyanparsh": "chyawanprash",
    "parle g": "parle-g",
    "col get": "colgate",
    "col gate": "colgate",
    "colgat": "colgate",
    "dabur": "dabur",
    "dabar": "dabur",
    "dab ur": "dabur",
    "pest": "paste",
    "tooth pest": "toothpaste",
    "tooth pest dabur": "dabur toothpaste",
    "haldirum": "haldiram",
    "haldiran": "haldiram",
    "parachut": "parachute",
    "parashut": "parachute",
    "coca cola": "coca-cola",
    "pepsi cola": "pepsi",
    "biscut": "biscuit"
  };
  if (map[n]) return map[n];
  if (n.startsWith("dabur red")) return "dabur red paste";
  return n;
}

// --- basic multilingual numbers ---
const numberMap = {
  // English
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  // Hindi (latin)
  ek: 1, do: 2, teen: 3, char: 4, paanch: 5, chhe: 6, saat: 7, aath: 8, nau: 9, das: 10,
  // Hindi (devanagari)
  "एक": 1, "दो": 2, "तीन": 3, "चार": 4, "पांच": 5, "छह": 6, "सात": 7, "आठ": 8, "नौ": 9, "दस": 10,
  // Marathi (latin-ish) — placeholders; real spellings may vary
  don: 2, sah: 6, saatM: 7, aathM: 8, nauM: 9, dah: 10,
  // Marathi (devanagari common forms)
  "दोन": 2, "तीन": 3, "चार": 4, "पाच": 5, "सहा": 6, "सात": 7, "आठ": 8, "नऊ": 9, "दहा": 10
};

function toNumber(tok) {
  if (!tok) return null;
  const n = Number(tok.replace?.(/,/g, ""));
  if (!Number.isNaN(n)) return n;
  const key = tok.toLowerCase?.().trim();
  return numberMap[key] ?? null;
}

// Normalize some common unit words
function normalizeUnit(s) {
  if (!s) return null;
  const t = s.toLowerCase();
  if (["g", "gm", "gms", "gram", "grams", "ग्राम"].includes(t)) return "g";
  if (["kg", "किलो", "किलो그램"].includes(t)) return "kg";
  if (["ml", "मि.ली."].includes(t)) return "ml";
  if (["l", "ltr", "लिटर", "लीटर"].includes(t)) return "l";
  if (["pcs", "piece", "pieces", "पीस"].includes(t)) return "pcs";
  return t;
}

function parseText(raw) {
  const text = (raw || "").trim();
  // strip common filler like "add product", "add item", "please", etc.
  const pre = text
    .replace(/^\s*(please|plz)\s+/i, "")
    .replace(/^\s*(add\s+(product|item)\s+)/i, "add ")
    .replace(/^\s*(add\s+)/i, "add ")
    .trim();
  if (!pre) return { type: "UNKNOWN" };

  // order-level intents
  if (/\b(create bill|finalize|generate(?: invoice)?)\b/i.test(pre)) return { type: "CREATE_BILL" };
  if (/\bcancel\b/i.test(pre)) return { type: "CANCEL_BILL" };

  // payment
  if (/\bupi\b/i.test(pre)) return { type: "SET_PAYMENT", mode: "UPI" };
  if (/(cash|नकद)/i.test(pre)) return { type: "SET_PAYMENT", mode: "CASH" };
  if (/\bcard\b/i.test(pre)) return { type: "SET_PAYMENT", mode: "CARD" };

  // discount (order level): "order discount 5 percent" / "discount 50 rupay"
  const discPct = pre.match(/discount\s+(\d+(?:\.\d+)?)\s*%/i);
  if (discPct) return { type: "SET_ORDER_DISCOUNT", mode: "PCT", value: Number(discPct[1]) };
  const discPctWord = pre.match(/discount\s+(\d+(?:\.\d+)?)\s*(?:percent|per\s*cent)/i);
  if (discPctWord) return { type: "SET_ORDER_DISCOUNT", mode: "PCT", value: Number(discPctWord[1]) };
  const discAmt = pre.match(/discount\s+(\d+(?:\.\d+)?)\s*(rs|rup(?:ee)?|रु|₹)/i);
  if (discAmt) return { type: "SET_ORDER_DISCOUNT", mode: "AMT", value: Number(discAmt[1]) };

  // add charges: "delivery charge 40"
  const charge = pre.match(/(delivery|packing|other|insurance)\s+(?:charge\s*)?(\d+(?:\.\d+)?)/i);
  if (charge) return { type: "ADD_CHARGE", chargeType: charge[1].toLowerCase(), amount: Number(charge[2]) };

  // add item patterns
  // examples: "add 2 dove 200 g", "दूध 1 लीटर", "parle g 2 pcs"
  const re = new RegExp(
    String.raw`(?:add|जोड़|डाल|put)?\s*` +                  // verb
    String.raw`(\d+|एक|दो|तीन|चार|पांच|ek|do|teen|char|paanch|one|two|three|four|five)?\s*` + // qty
    String.raw`([\w\u0900-\u097F][\w\s\-\u0900-\u097F]+?)\s*` + // name
    String.raw`(\d+(?:\.\d+)?)?\s*` +                       // size value
    String.raw`(g|kg|ml|l|ltr|pcs|लीटर|ग्राम|पीस)?\b` +     // size unit
    String.raw`(?:\s*(?:at|@)\s*(\d+(?:\.\d+)?)\s*(?:rs|rup(?:ee)?|रु|₹)?)?`, // optional price "at 45 rs"
    "i"
  );
  const m = pre.match(re);
  if (m) {
    const qty = toNumber(m[1]) ?? 1;
    const name = normalizeName((m[2] || "").trim());
    const sizeVal = m[3] ? Number(m[3]) : null;
    const unit = normalizeUnit(m[4]);
    const size = sizeVal && unit ? `${sizeVal}${unit}` : null;
    const price = m[5] ? Number(m[5]) : null;
    return { type: "ADD_ITEM", rawName: name, qty, size, price };
  }

  // quantity adjustment: "pepsi +2" / "dove minus 1"
  const adj = pre.match(/([\w\u0900-\u097F\-\s]+)\s*([+\-])(\d+)/i);
  if (adj) return { type: "ADJUST_QTY", rawName: normalizeName(adj[1].trim()), delta: (adj[2] === "+" ? 1 : -1) * Number(adj[3]) };

  return { type: "UNKNOWN" };
}

// Map internal parse result → normalized frontend action
function normalizeForFrontend(parsed) {
  switch (parsed?.type) {
    case "ADD_ITEM":
      return { action: "add_to_cart", slots: { name: parsed.rawName, qty: parsed.qty, size: parsed.size, price: parsed.price ?? undefined } };
    case "SET_PAYMENT":
      return { action: "set_payment", slots: { mode: parsed.mode } };
    case "ADD_CHARGE":
      return { action: "apply_charge", slots: { type: parsed.chargeType, amount: parsed.amount } };
    case "CREATE_BILL":
      return { action: "create_bill", slots: {} };
    case "CANCEL_BILL":
      return { action: "cancel_bill", slots: {} };
    case "ADJUST_QTY":
      return { action: "adjust_qty", slots: { name: parsed.rawName, delta: parsed.delta } };
    case "SET_ORDER_DISCOUNT":
      return { action: "set_order_discount", slots: { mode: parsed.mode, value: parsed.value } };
    default:
      return { action: "unknown", slots: {} };
  }
}

const functions = require('firebase-functions');

exports.parse = functions.https.onRequest((req, res) => {
  setCors(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(204).send('');
  }

  try {
    const { transcript, userId } = req.body;
    if (!transcript || !userId) {
      return res.status(400).json({ error: 'Missing transcript or userId' });
    }

    const parsed = parseText(transcript);
    const norm = normalizeForFrontend(parsed);
    return res.json({ ok: true, ...norm, raw: parsed });
  } catch (error) {
    console.error("❌ parse error", error);
    return res.status(500).json({ error: "Internal error" });
  }
});
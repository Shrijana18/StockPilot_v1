

const { onCall } = require("firebase-functions/v2/https");
const vision = require("@google-cloud/vision");
const axios = require("axios");

/**
 * Callable: parseInvoiceFile
 * Input:
 *  {
 *    base64File?: string,      // image or pdf base64 (no data: prefix)
 *    mimeType?: string,        // e.g., "image/jpeg" | "application/pdf"
 *    ocrText?: string,         // optional: if provided, OCR step is skipped
 *    hints?: { country?: "IN", currency?: "INR" }
 *  }
 * Output:
 *  {
 *    success: boolean,
 *    vendor: { name, gstin, address, phone, email },
 *    invoice: { number, date, dueDate, currency, subtotal, taxTotal, total },
 *    items: [
 *      { name, hsnCode, gstRate, quantity, unit, unitPrice, discount, tax, total }
 *    ],
 *    rawText?: string
 *  }
 */
module.exports = onCall(async (request) => {
  try {
    const { base64File, mimeType = "", ocrText, hints = {} } = request.data || {};
    if (!base64File && !ocrText) {
      throw new Error("Provide either base64File or ocrText");
    }

    // 1) OCR (if needed)
    let fullText = (ocrText || "").trim();
    if (!fullText && base64File) {
      const client = new vision.ImageAnnotatorClient();
      const isPdf = (mimeType || "").toLowerCase().includes("pdf");
      if (isPdf) {
        // For PDF: use documentTextDetection with pages 1-3 to cap cost/time
        const [result] = await client.documentTextDetection({
          image: { content: Buffer.from(base64File, "base64") }
        });
        fullText = result?.fullTextAnnotation?.text || "";
      } else {
        const [result] = await client.textDetection({
          image: { content: Buffer.from(base64File, "base64") }
        });
        const detections = result?.textAnnotations || [];
        fullText = detections[0]?.description || "";
      }
    }

    if (!fullText) {
      return { success: false, message: "OCR produced no text" };
    }

    // 2) OpenAI parse → structured JSON
    const openaiApiKey = process.env.OPENAI_API_KEY;
    const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
    if (!openaiApiKey) throw new Error("Missing OpenAI API key");

    const systemPrompt = `
You are an expert invoice parser for Indian retail (GST). 
Return STRICT JSON ONLY. No markdown, no text around it.
Target schema:
{
  "vendor": { "name": "", "gstin": "", "address": "", "phone": "", "email": "" },
  "invoice": { "number": "", "date": "", "dueDate": "", "currency": "INR", "subtotal": 0, "taxTotal": 0, "total": 0 },
  "items": [
    { "name": "", "hsnCode": "", "gstRate": 0, "quantity": 0, "unit": "", "unitPrice": 0, "discount": 0, "tax": 0, "total": 0 }
  ]
}

Rules:
- Currency default to ${hints.currency || "INR"}.
- If GSTIN present in text, extract to vendor.gstin (15-alphanumeric).
- Extract HSN if present (4–8 digits). gstRate must be one of [0,5,12,18,28].
- quantity may be integer or decimal. unitPrice/total numeric.
- If subtotal/tax/total visible, populate. Else compute where possible.
- Dates should be ISO if possible (YYYY-MM-DD). If ambiguous, keep exact as text.
- Keep items distinct; avoid header lines.
`;

    const userPrompt = `
Country: ${hints.country || "IN"}
Text:
"""
${fullText.slice(0, 25000)}
"""
Return ONLY JSON.
`;

    const payload = {
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: 0.1
    };

    const response = await axios.post("https://api.openai.com/v1/chat/completions", payload, {
      headers: {
        "Authorization": `Bearer ${openaiApiKey}`,
        "Content-Type": "application/json"
      },
      timeout: 30000
    });

    const raw = response.data?.choices?.[0]?.message?.content?.trim() || "";

    // Strict JSON parse (with fallback to first {...} block)
    let parsed = null;
    try {
      parsed = JSON.parse(raw);
    } catch {
      const m = raw.match(/\{[\s\S]*\}$/m);
      if (m) {
        parsed = JSON.parse(m[0]);
      }
    }
    if (!parsed || !parsed.items) {
      return { success: false, message: "Parser did not return valid JSON", rawText: fullText };
    }

    // 3) Post-normalization
    const snapGst = (v) => {
      const allowed = [0, 5, 12, 18, 28];
      const n = Number(String(v).replace(/[^\d.]/g, "")) || 0;
      return allowed.reduce((best, r) => (Math.abs(r - n) < Math.abs(best - n) ? r : best), 0);
    };
    const toNum = (v) => {
      if (v === null || v === undefined || v === "") return 0;
      const n = Number(String(v).replace(/[^\d.-]/g, ""));
      return Number.isFinite(n) ? n : 0;
    };
    const cleanHSN = (v) => (String(v || "").replace(/\D/g, "").slice(0, 8));
    const asStr = (v) => (v === null || v === undefined ? "" : String(v));

    const items = Array.isArray(parsed.items) ? parsed.items.map((it) => {
      const quantity = toNum(it.quantity);
      const unitPrice = toNum(it.unitPrice);
      const discount = toNum(it.discount);
      const gstRate = snapGst(it.gstRate);
      const lineBase = Math.max(0, quantity * unitPrice - discount);
      const tax = +(lineBase * (gstRate / 100)).toFixed(2);
      const total = +(lineBase + tax).toFixed(2);
      return {
        name: asStr(it.name),
        hsnCode: cleanHSN(it.hsnCode),
        gstRate,
        quantity,
        unit: asStr(it.unit),
        unitPrice,
        discount,
        tax,
        total
      };
    }) : [];

    // Totals
    const subtotal = items.reduce((s, r) => s + Math.max(0, r.quantity * r.unitPrice - r.discount), 0);
    const taxTotal = items.reduce((s, r) => s + r.tax, 0);
    const computedTotal = +(subtotal + taxTotal).toFixed(2);

    const invoice = {
      number: asStr(parsed.invoice?.number),
      date: asStr(parsed.invoice?.date),
      dueDate: asStr(parsed.invoice?.dueDate),
      currency: parsed.invoice?.currency || (hints.currency || "INR"),
      subtotal: toNum(parsed.invoice?.subtotal) || +subtotal.toFixed(2),
      taxTotal: toNum(parsed.invoice?.taxTotal) || +taxTotal.toFixed(2),
      total: toNum(parsed.invoice?.total) || computedTotal
    };

    const vendor = {
      name: asStr(parsed.vendor?.name),
      gstin: (parsed.vendor?.gstin || "").toString().trim(),
      address: asStr(parsed.vendor?.address),
      phone: asStr(parsed.vendor?.phone),
      email: asStr(parsed.vendor?.email)
    };

    return {
      success: true,
      vendor,
      invoice,
      items,
      rawText: process.env.NODE_ENV === "production" ? undefined : fullText
    };
  } catch (error) {
    console.error("parseInvoiceFile Error:", error);
    return {
      success: false,
      message: error.message || "Failed to parse invoice"
    };
  }
});
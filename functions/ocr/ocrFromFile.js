/**
 * Unified OCR: accepts image or PDF (base64), returns extracted text and parsed products.
 * Used by retailer and distributor OCR upload to build inventory from images or price-list PDFs.
 */
const { onRequest } = require("firebase-functions/v2/https");
const cors = require("cors");
const vision = require("@google-cloud/vision");
const { parsePriceListText } = require("./parsePriceListText");

let pdfParse;
try {
  pdfParse = require("pdf-parse");
} catch (e) {
  pdfParse = null;
}

const client = new vision.ImageAnnotatorClient();
const corsHandler = cors({ origin: true });

function normalizePayload(body) {
  const pdfBase64 = body.pdfBase64 || body.fileBase64;
  const imageBase64 = body.imageBase64 || body.base64Image;
  const mime = body.mimeType || body.mime || "";
  if (pdfBase64 && (mime === "application/pdf" || !imageBase64)) {
    return { type: "pdf", base64: pdfBase64 };
  }
  if (imageBase64) {
    return { type: "image", base64: imageBase64 };
  }
  if (body.fileBase64 && mime === "application/pdf") {
    return { type: "pdf", base64: body.fileBase64 };
  }
  if (body.fileBase64) {
    return { type: "image", base64: body.fileBase64 };
  }
  return null;
}

async function extractTextFromPdf(buffer) {
  if (!pdfParse) {
    throw new Error("PDF support not available: pdf-parse not installed.");
  }
  const data = await pdfParse(buffer);
  return data.text || "";
}

async function extractTextFromImage(buffer) {
  const [result] = await client.textDetection({ image: { content: buffer } });
  const detections = result.textAnnotations;
  if (!detections || detections.length === 0) return "";
  return detections[0].description || "";
}

module.exports = onRequest(
  {
    region: "us-central1",
    memory: "1GiB",
    timeoutSeconds: 120,
  },
  (req, res) => {
    corsHandler(req, res, async () => {
      if (req.method === "OPTIONS") {
        res.set("Access-Control-Allow-Origin", "*");
        res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        res.set("Access-Control-Allow-Headers", "Content-Type");
        return res.status(204).send("");
      }

      if (req.method !== "POST") {
        return res.status(405).json({ success: false, error: "Method not allowed" });
      }

      try {
        const body = typeof req.body === "object" ? req.body : {};
        const payload = normalizePayload(body);
        if (!payload || !payload.base64) {
          return res.status(400).json({
            success: false,
            error: "Missing file. Send imageBase64 or pdfBase64 (and optionally mimeType).",
          });
        }

        const buffer = Buffer.from(payload.base64, "base64");
        if (buffer.length === 0) {
          return res.status(400).json({ success: false, error: "Invalid base64 data." });
        }

        let fullText = "";
        if (payload.type === "pdf") {
          fullText = await extractTextFromPdf(buffer);
        } else {
          fullText = await extractTextFromImage(buffer);
        }

        const products = parsePriceListText(fullText);

        return res.status(200).json({
          success: true,
          text: fullText,
          lines: fullText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean),
          totalLines: fullText.split(/\r?\n/).length,
          products,
        });
      } catch (error) {
        console.error("ocrFromFile Error:", error);
        return res.status(500).json({
          success: false,
          error: error.message || "Failed to process file",
          products: [],
        });
      }
    });
  }
);

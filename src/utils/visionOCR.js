// src/utils/visionOCR.js
import vision from "@google-cloud/vision";
import path from "path";
import { fileURLToPath } from "url";

// Needed for ES Modules (Vite)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load credentials
const keyPath = path.resolve(__dirname, "../../visionKey.json");

const client = new vision.ImageAnnotatorClient({
  keyFilename: keyPath,
});

export async function runOCRWithVision(imageUrl) {
  try {
    const [result] = await client.textDetection(imageUrl);
    const detections = result.textAnnotations;
    if (!detections.length) return [];

    const rawText = detections[0].description;
    console.log("Raw OCR text:", rawText);

    const lines = rawText.split("\n");
    const products = [];

    for (let line of lines) {
      const match = line.match(/^(.+?)\s+(\d+)\s*(pcs|kg|ltr|ml)?$/i);
      if (match) {
        const [, productName, quantity, unit] = match;
        products.push({
          productName: productName.trim(),
          brand: "Auto-detected",
          quantity: parseInt(quantity),
          unit: unit || "pcs",
          costPrice: 0,
          sellingPrice: 0,
          description: "Detected via Google Vision OCR",
          imageURL: imageUrl,
        });
      }
    }

    return products;
  } catch (err) {
    console.error("Vision OCR Error:", err);
    throw err;
  }
}
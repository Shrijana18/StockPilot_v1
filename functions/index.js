require("dotenv").config();
const { onCall, onRequest } = require("firebase-functions/v2/https");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { HttpsError } = require("firebase-functions/v2/https");
const express = require("express");
const app = express();
app.use(express.json());
const admin = require("firebase-admin");
const vision = require("@google-cloud/vision");
const cors = require("cors");
const corsHandler = cors({ origin: true });

admin.initializeApp();

const client = new vision.ImageAnnotatorClient();

const { setGlobalOptions } = require("firebase-functions/v2");

setGlobalOptions({ region: "asia-south1", memory: "1GB", timeoutSeconds: 60 });

exports.ocrFromImage = onRequest(async (req, res) => {
  corsHandler(req, res, async () => {
    try {
      const { imageBase64 } = req.body;
      if (!imageBase64) {
        return res.status(400).json({ error: "Missing imageBase64 in request body." });
      }

      const [result] = await client.textDetection({ image: { content: imageBase64 } });
      const detections = result.textAnnotations;

      if (!detections || detections.length === 0) {
        return res.status(200).json({ products: [] });
      }

      const rawText = detections[0].description;
      const lines = rawText
        .split("\n")
        .map(line => line.trim().replace(/[•₹]/g, "").replace(/[-=]/g, " "))
        .filter(line => line && line.length > 2);

      const productRegex = /^(.+?)\s+(\d+)\s*(pcs|kg|ltr|g|ml|litres|packs|boxes)?\s*(₹?\d+)?$/i;

      const parsedProducts = [];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const match = line.match(productRegex);

        if (match) {
          const name = match[1].replace(/\s{2,}/g, " ").trim();
          const quantity = parseInt(match[2]);
          const unit = (match[3] || 'pcs').toLowerCase();
          const price = match[4] ? parseInt(match[4].replace(/[₹]/g, '')) : null;

          parsedProducts.push({ name, quantity, unit, price });
        } 
        // Handle multi-line fallback
        else if (
          i + 1 < lines.length &&
          /^\d+\s*(pcs|kg|ltr|g|ml|litres|packs|boxes)?\s*(₹?\d+)?$/i.test(lines[i + 1])
        ) {
          const name = line.replace(/\s{2,}/g, " ").trim();
          const qtyLine = lines[i + 1].trim();
          const qtyMatch = qtyLine.match(/^(\d+)\s*(pcs|kg|ltr|g|ml|litres|packs|boxes)?\s*(₹?\d+)?$/i);
          if (qtyMatch) {
            const quantity = parseInt(qtyMatch[1]);
            const unit = (qtyMatch[2] || 'pcs').toLowerCase();
            const price = qtyMatch[3] ? parseInt(qtyMatch[3].replace(/[₹]/g, '')) : null;

            parsedProducts.push({ name, quantity, unit, price });
            i++; // skip next line
          }
        }
      }

      return res.status(200).json({ products: parsedProducts });
    } catch (error) {
      console.error("OCR Error:", error);
      res.status(500).json({ error: "OCR processing failed." });
    }
  });
});

exports.createEmployee = onCall(async (request) => {
  const { name, email, password, role, phone, flypId } = request.data;
  const context = request.auth;

  if (!context || !context.uid) {
    throw new HttpsError("unauthenticated", "User not authenticated");
  }

  const retailerId = context.uid;

  try {
    const userRecord = await admin.auth().createUser({
      email,
      password,
      displayName: name,
    });

    await admin.firestore()
      .collection("businesses")
      .doc(retailerId)
      .collection("employees")
      .doc(userRecord.uid)
      .set({
        uid: userRecord.uid,
        name,
        email,
        role,
        phone: phone || "",
        flypId: flypId || "",
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

    return { success: true, uid: userRecord.uid };
  } catch (error) {
    console.error("CreateEmployee Error:", error);
    throw new HttpsError("internal", error.message);
  }
});

exports.generateAssistantReply = onDocumentCreated("assistantQueries/{docId}", async (event) => {
  const snap = event.data;
  if (!snap) return;

  const data = snap.data();
  const prompt = data && data.prompt;
  if (!prompt) return;

  try {
    const reply = "Assistant reply generation has been migrated to Gemini. Please update logic accordingly.";

    await event.data.ref.update({
      reply,
      replyTimestamp: new Date()
    });
  } catch (error) {
    console.error("OpenAI Reply Error:", error);
  }
});

const axios = require("axios");

exports.employeeLogin = onCall(async (request) => {
  const { flypId, phone, password } = request.data;

  if (!flypId || !phone || !password) {
    throw new HttpsError("invalid-argument", "Missing fields");
  }

  const db = admin.firestore();
  let employeeDoc = null;
  let employeeData = null;
  let retailerId = null;

  const businessesSnapshot = await db.collection("businesses").get();

  for (const businessDoc of businessesSnapshot.docs) {
    const employeesRef = businessDoc.ref.collection("employees");
    const employeeSnapshot = await employeesRef
      .where("flypId", "==", flypId)
      .where("phone", "==", phone)
      .limit(1)
      .get();

    if (!employeeSnapshot.empty) {
      employeeDoc = employeeSnapshot.docs[0];
      employeeData = employeeDoc.data();
      retailerId = businessDoc.id;
      break;
    }
  }

  if (!employeeData) {
    throw new HttpsError("not-found", "Employee not found");
  }

  if (employeeData.password !== password) {
    throw new HttpsError("unauthenticated", "Incorrect password");
  }

  return {
    success: true,
    employeeId: employeeData.uid,
    name: employeeData.name,
    role: employeeData.role,
    retailerId,
  };
});
// AI Inventory generation from a single brand (region: us-central1)
exports.generateInventoryByBrand = onRequest({ region: "us-central1" }, (req, res) => {
  corsHandler(req, res, async () => {
    try {
      const { prompt } = req.body;

      if (!prompt || typeof prompt !== "string") {
        return res.status(400).json({ error: "Missing or invalid prompt" });
      }

      const userPrompt = prompt;

      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro-latest:generateContent`;

      const payload = {
        contents: [
          {
            parts: [{ text: userPrompt }],
          },
        ],
      };

      const loadedKey = process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.slice(0, 10) : "undefined";
      console.log("🔥 GEMINI KEY LOADED:", loadedKey);

      let response;
      let retries = 2;
      while (retries > 0) {
        try {
          response = await axios.post(endpoint, payload, {
            headers: { "Content-Type": "application/json" },
            params: { key: process.env.GEMINI_API_KEY },
            timeout: 15000
          });
          break; // success
        } catch (apiError) {
          if (apiError.response && apiError.response.status === 503 && retries > 1) {
            console.warn("503 error, retrying...");
            retries--;
            await new Promise(r => setTimeout(r, 1000)); // wait 1 sec
          } else {
            console.error("Gemini API Request Failed:", apiError.message);
            return res.status(500).json({ error: "Gemini API Request Failed", details: apiError.message });
          }
        }
      }

      let rawText = "";
      try {
        const candidates = response.data && response.data.candidates;
        console.log("Gemini candidates:", JSON.stringify(candidates, null, 2));
        if (candidates && Array.isArray(candidates)) {
          for (const c of candidates) {
            const part = (c && c.content && c.content.parts && c.content.parts[0] && c.content.parts[0].text)
              ? c.content.parts[0].text.trim()
              : "";
            if (part && part.includes("| Product Name")) {
              rawText = part;
              break;
            }
          }
        }

        if (!rawText) {
          console.warn("Gemini raw candidates:", JSON.stringify(response.data, null, 2));
          console.error("Gemini response did not contain a valid table");
          return res.status(500).json({ error: "No valid inventory table found", rawResponse: response.data });
        }

        console.log("Gemini rawText:", rawText);
      } catch (e) {
        console.error("Error extracting Gemini response text", e);
        return res.status(500).json({ error: "Error extracting Gemini response" });
      }

      const tableStartIndex = rawText.indexOf("| Product Name");
      const table = tableStartIndex !== -1 ? rawText.slice(tableStartIndex).trim() : "";
      const lines = table
        .split("\n")
        .filter(line =>
          line.includes("|") &&
          !/^[-|]+$/.test(line) &&
          !(line.toLowerCase().startsWith("| product name"))
        );

      const inventoryList = lines.map(line => {
        const parts = line
          .replace(/^\|/, "")           // remove leading |
          .replace(/\|$/, "")           // remove trailing |
          .split("|")
          .map(p => p.trim().replace(/\*.*?\*/g, ""));

        if (parts.some(p => p.includes("*"))) return null; // skip corrupted rows

        // Table columns: | Product Name | Brand | Category | SKU | Price (INR) | Unit |
        return {
          productName: parts[0] || "",
          brand: parts[1] || "",
          category: parts[2] || "General",
          sku: parts[3] || "",
          price: /^\d+$/.test(parts[4]) ? parts[4] : "50",
          unit: parts[5] || "pcs",
          imageUrl: "",
        };
      }).filter(item => item && item.productName && item.sku);

      if (inventoryList.length === 0) {
        return res.status(200).json({ inventory: [], message: "No clean rows parsed" });
      }

      return res.status(200).json({ inventory: inventoryList });
    } catch (error) {
      console.error("generateInventoryByBrand Error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });
});
// Parse Invoice File via OCR + Gemini
exports.parseInvoiceFile = onRequest({ region: "us-central1" }, async (req, res) => {
  corsHandler(req, res, async () => {
    try {
      const { fileUrl } = req.body;
      if (!fileUrl || typeof fileUrl !== "string") {
        return res.status(400).json({ error: "Missing or invalid fileUrl" });
      }

      // Download image as buffer
      const imageResponse = await axios.get(fileUrl, { responseType: "arraybuffer" });
      const imageBase64 = Buffer.from(imageResponse.data, "binary").toString("base64");

      // OCR using Google Vision
      const [result] = await client.textDetection({ image: { content: imageBase64 } });
      const detections = result.textAnnotations;
      if (!detections || detections.length === 0) {
        return res.status(200).json({ message: "No text found", structuredInvoice: {} });
      }

      const rawText = detections[0].description;

      const geminiPrompt = `
You are an invoice extraction AI. Output only a strict JSON object. No markdown, no extra commentary. Use this format:

{
  "customerName": "...",
  "customerPhone": "...",
  "invoiceDate": "...",
  "productList": [
    {
      "name": "...",
      "quantity": ...,
      "unit": "...",
      "price": ...
    }
  ],
  "subtotal": ...,
  "tax": ...,
  "total": ...
}

Raw OCR Text:
"""
${rawText}
"""`;

      const response = await axios.post(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro-latest:generateContent",
        {
          contents: [{ parts: [{ text: geminiPrompt }] }],
        },
        {
          headers: { "Content-Type": "application/json" },
          params: { key: process.env.GEMINI_API_KEY },
        }
      );

      let reply = "";
      const candidates = response.data && response.data.candidates;
      if (candidates && candidates.length > 0 && candidates[0].content && candidates[0].content.parts.length > 0) {
        reply = candidates[0].content.parts[0].text.trim();
        if (reply.startsWith("```")) {
          reply = reply.replace(/```(json|txt)?/gi, "").replace(/```/g, "").trim();
        }
        console.log("🧾 Cleaned Gemini reply:\n", reply);
      }

      // Try to parse reply to JSON
      let structuredInvoice = {};
      try {
        structuredInvoice = JSON.parse(reply);
      } catch (e) {
        console.warn("❌ Failed to parse Gemini response:", reply);
        structuredInvoice = { error: true, rawText, rawReply: reply };
      }

      return res.status(200).json({ structuredInvoice });
    } catch (error) {
      console.error("parseInvoiceFile Error:", error.message);
      return res.status(500).json({ error: "Internal server error", details: error.message });
    }
  });
});
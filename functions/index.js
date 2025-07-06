const functions = require("firebase-functions");
const cors = require("cors")({ origin: true });
const vision = require("@google-cloud/vision");

const client = new vision.ImageAnnotatorClient();

exports.ocrFromImage = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    try {
      const { base64 } = req.body;
      if (!base64) {
        return res.status(400).json({ error: "Missing 'base64' in request body." });
      }

      const [result] = await client.textDetection({
        image: { content: base64 },
      });
      const detections = result.textAnnotations;

      if (!detections || detections.length === 0) {
        return res.status(200).json({ products: [] });
      }

      const rawText = detections[0].description;
      const lines = rawText.split("\n").map(line => line.trim()).filter(line => line);

      const products = lines.map((line) => {
        const words = line.split(" ");
        const qtyMatch = line.match(/\d+\s*(pcs|ltr|kg|g|ml|box|m|pack|k|rs)/i) || [];

        return {
          productName: words.slice(0, -1).join(" ") || "",
          quantity: qtyMatch[0] || "",
          unit: "",
          brand: "",
          costPrice: "",
          sellingPrice: "",
          description: line,
        };
      });

      res.status(200).json({ products });
    } catch (err) {
      console.error("OCR error:", err);
      res.status(500).json({ error: "OCR failed" });
    }
  });
});
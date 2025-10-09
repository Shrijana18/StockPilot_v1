

const { onCall } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const vision = require("@google-cloud/vision");

const client = new vision.ImageAnnotatorClient();

module.exports = onCall(async (request) => {
  try {
    const { base64Image } = request.data || {};
    if (!base64Image) {
      throw new Error("Missing base64Image");
    }

    // Decode base64 image
    const imageBuffer = Buffer.from(base64Image, "base64");

    // Perform OCR detection
    const [result] = await client.textDetection({ image: { content: imageBuffer } });
    const detections = result.textAnnotations;

    if (!detections || detections.length === 0) {
      return { success: false, message: "No text detected" };
    }

    // Extract clean text lines
    const fullText = detections[0].description || "";
    const lines = fullText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    return {
      success: true,
      text: fullText,
      lines,
      totalLines: lines.length,
    };
  } catch (error) {
    console.error("OCR Error:", error);
    return {
      success: false,
      message: error.message || "Failed to process image with OCR",
    };
  }
});
const functions = require("firebase-functions");
const { onRequest, onCall } = require("firebase-functions/v2/https");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");
const vision = require("@google-cloud/vision");
const cors = require("cors")({ origin: true });
const { Configuration, OpenAIApi } = require("openai");

admin.initializeApp();

const client = new vision.ImageAnnotatorClient();

exports.ocrFromImage = onRequest({ region: "asia-south1", memory: "1GiB" }, (req, res) => {
  cors(req, res, async () => {
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
      const lines = rawText.trim().split("\n").filter(line => line);
      const products = lines.map(line => {
        const match = line.match(/^(.*?)(\d+)\s*(pcs|ltr|kg|gm|ml)?\s*(₹?\d+)?$/i);
        if (!match) {
          return {
            productName: line,
            quantity: "",
            unit: "",
            costPrice: "",
            sellingPrice: "",
            sku: "",
            brand: "",
            category: "",
            description: "",
            imageUrl: ""
          };
        }

       return {
  productName: (match[1] && match[1].trim()) || "",
  quantity: match[2] || "",
  unit: match[3] || "",
  costPrice: (match[4] && match[4].replace("₹", "")) || "",
  sellingPrice: "",
  sku: "",
  brand: "",
  category: "",
  description: "",
  imageUrl: ""
};
      });

      return res.status(200).json({ products });
    } catch (error) {
      console.error("OCR Error:", error);
      return res.status(500).json({ error: "OCR processing failed" });
    }
  });
});

exports.createEmployee = onCall({ region: "asia-south1" }, async (request) => {
  const { name, email, password, role, phone, flypId } = request.data;
  const context = request.auth;

  if (!context || !context.uid) {
    throw new functions.https.HttpsError('unauthenticated', 'User not authenticated');
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
    throw new functions.https.HttpsError('internal', error.message);
  }
});

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY
});
const openai = new OpenAIApi(configuration);

exports.generateAssistantReply = onDocumentCreated(
  {
    document: "assistantQueries/{docId}",
    region: "asia-south1",
    memory: "1GiB",
    cpu: 1
  },
  async (event) => {
    const snap = event.data;
    if (!snap) return;

    const data = snap.data();
    const prompt = data && data.prompt;
    if (!prompt) return;

    try {
      const db = admin.firestore();

      let inventoryContext = "";
      if (data.distributorId) {
        const inventorySnapshot = await db
          .collection("businesses")
          .doc(data.distributorId)
          .collection("products")
          .get();

        const inventoryItems = inventorySnapshot.docs.map((doc) => {
          const item = doc.data();
          const name = item.name || "Unnamed Item";
          const price = item.sellingPrice ? `₹${item.sellingPrice}` : "Price not listed";
          const status = item.quantity > 0 ? "In Stock" : "Sold Out";
          return `- ${name}: ${price} (${status})`;
        });

        inventoryContext = inventoryItems.length > 0
          ? `Distributor Inventory:\n${inventoryItems.join("\n")}`
          : "Distributor has no inventory listed.";
      }

      const completion = await openai.createChatCompletion({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: `You are a helpful assistant for a distributor business. Your job is to answer retailer queries based on available inventory. Format your reply in a polite, professional, and human tone. Use emojis where helpful. Here's the distributor's inventory:\n\n${inventoryContext}`
          },
          {
            role: "user",
            content: prompt
          }
        ]
      });

      const reply = completion.data.choices[0].message.content;

      if (data.userId && data.distributorId) {
        const reverseChatRef = db
          .collection("businesses")
          .doc(data.distributorId)
          .collection("connectedRetailers")
          .doc(data.userId)
          .collection("assistantChats");

        await reverseChatRef.add({
          message: reply,
          sender: "assistant",
          timestamp: admin.firestore.Timestamp.now()
        });

        // Also write to the retailer's side so both sides receive the reply.
        const mirrorChatRef = db
          .collection("businesses")
          .doc(data.userId)
          .collection("connectedDistributors")
          .doc(data.distributorId)
          .collection("assistantChats");

        await mirrorChatRef.add({
          message: reply,
          sender: "assistant",
          timestamp: admin.firestore.Timestamp.now()
        });
      }

      // The following block is now redundant since the above handles both sides.
      // if (data.userId) {
      //   const distributorId = data.distributorId || "N/A";
      //   const chatRef = db
      //     .collection("businesses")
      //     .doc(data.userId)
      //     .collection("connectedDistributors")
      //     .doc(distributorId)
      //     .collection("assistantChats");
      //
      //   await chatRef.add({
      //     message: reply,
      //     sender: "assistant",
      //     timestamp: admin.firestore.Timestamp.now()
      //   });
      // }

      await snap.ref.update({
        reply,
        replyTimestamp: new Date()
      });
    } catch (error) {
      console.error("OpenAI Reply Error:", error);
    }
  });

exports.employeeLogin = onCall({ region: "asia-south1" }, async (request) => {
  const { flypId, phone, password } = request.data;

  if (!flypId || !phone || !password) {
    throw new functions.https.HttpsError('invalid-argument', 'Missing fields');
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
    throw new functions.https.HttpsError('not-found', 'Employee not found');
  }

  if (employeeData.password !== password) {
    throw new functions.https.HttpsError('unauthenticated', 'Incorrect password');
  }

  return {
    success: true,
    employeeId: employeeData.uid,
    name: employeeData.name,
    role: employeeData.role,
    retailerId,
  };
});
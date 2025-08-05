import { db, auth } from "../firebase/firebaseConfig";
import { doc, collection, addDoc, serverTimestamp } from "firebase/firestore";

export const logInventoryChange = async ({
  productId,
  sku,
  productName,
  brand,
  category,
  previousData = {},
  updatedData = {},
  action = "updated", // or 'created', 'deleted'
  source = "manual", // 'billing', 'OCR', 'AI', 'distributor'
}) => {
  const userId = auth.currentUser?.uid;
  if (!userId || !productId) return;

  const changes = {};

  for (const key in updatedData) {
    if (previousData[key] !== updatedData[key]) {
      changes[key] = {
        from: previousData[key] !== undefined ? previousData[key] : null,
        to: updatedData[key] !== undefined ? updatedData[key] : null,
      };
    }
  }

  if (Object.keys(changes).length === 0) return; // nothing changed

  try {
    const logRef = collection(db, `businesses/${userId}/inventoryLogs`);
    await addDoc(logRef, {
      productId,
      sku,
      productName: productName || "N/A",
      brand: brand || "N/A",
      category: category || "N/A",
      changes,
      action,
      source,
      modifiedAt: serverTimestamp(),
      modifiedAtISO: new Date().toISOString(),
      modifiedBy: auth.currentUser?.email || "unknown",
    });
  } catch (error) {
    console.error("Failed to log inventory change:", error);
  }
};
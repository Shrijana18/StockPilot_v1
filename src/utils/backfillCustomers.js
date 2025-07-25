import { collection, getDocs, setDoc, doc, updateDoc } from "firebase/firestore";
import { db, auth } from "../firebase/firebaseConfig";

export const runCustomerBackfill = async () => {
  const user = auth.currentUser;
  if (!user) {
    console.error("No authenticated user found.");
    return;
  }

  const userId = user.uid;
  const invoicesRef = collection(db, `businesses/${userId}/finalizedInvoices`);
  const customersRef = collection(db, `businesses/${userId}/customers`);

  const snap = await getDocs(invoicesRef);

  let count = 1600;
  let created = 0;

  for (const docSnap of snap.docs) {
    const data = docSnap.data();
    const invoiceId = docSnap.id;

    // Already has custId? Skip
    if (data.customer?.custId) continue;

    const { name, phone, email, address } = data.customer || {};
    if (!name || (!phone && !email)) continue; // Insufficient info

    // Check if customer already exists
    const existingSnap = await getDocs(customersRef);
    let existingCustId = null;

    for (const customerDoc of existingSnap.docs) {
      const custData = customerDoc.data();
      if (
        custData.name === name &&
        custData.phone === (phone || "") &&
        custData.email === (email || "")
      ) {
        existingCustId = customerDoc.id;
        break;
      }
    }

    if (existingCustId) {
      // Just update invoice with existing customer ID
      await updateDoc(doc(invoicesRef, invoiceId), {
        "customer.custId": existingCustId,
      });
      console.log(`🔁 Linked existing customer ${existingCustId} to invoice ${invoiceId}`);
      continue;
    }

    const custId = `CUST-${count++}`;

    try {
      await setDoc(doc(customersRef, custId), {
        name,
        phone: phone || "",
        email: email || "",
        address: address || "",
        createdAt: new Date(),
      });

      await updateDoc(doc(invoicesRef, invoiceId), {
        "customer.custId": custId,
      });

      console.log(`✅ Created ${custId} and linked to invoice ${invoiceId}`);
      created++;
    } catch (err) {
      console.error(`❌ Error processing invoice ${invoiceId}:`, err);
    }
  }

  if (created === 0) {
    console.log("🎯 No customers needed backfilling.");
  } else {
    console.log(`🎉 Backfilled ${created} customers successfully!`);
  }
};
import { useEffect, useState } from "react";
import { db, auth } from "../../firebase/firebaseConfig";
import { collection, onSnapshot } from "firebase/firestore";
import AddInventoryOptions from "./inventory/AddInventoryOptions";
import ViewInventory from "./inventory/ViewInventory";
import { motion } from "framer-motion";
// import { auth, db } from "../../firebase";

const DistributorInventory = () => {
  const [inventory, setInventory] = useState([]);
  const [selectedTab, setSelectedTab] = useState("add");
  const distributorId = auth.currentUser?.uid;

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    const inventoryRef = collection(db, `businesses/${user.uid}/products`);
    const unsubscribe = onSnapshot(inventoryRef, (snapshot) => {
      const items = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setInventory(items);
    });

    return () => unsubscribe();
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="p-2 md:p-4 text-white"
    >
      {/* Top action row — mirrors retailer: Add / View / Group / Low Stock */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        {[
          { id: "add", label: "Add Inventory" },
          { id: "view", label: "View Inventory" },
          { id: "group", label: "Item Groups" },
          { id: "lowstock", label: "Low Stock Alerts" },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setSelectedTab(t.id)}
            className={
              `px-4 py-2 rounded-lg text-sm font-medium transition-colors border ` +
              (selectedTab === t.id
                ? "bg-emerald-500 text-slate-900 border-transparent shadow"
                : "bg-white/10 text-white/90 border-white/15 hover:bg-white/15")
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Section title — keep structure consistent with Retailer */}
      {selectedTab === 'add' && (
        <div className="mb-4">
          <h3 className="text-base font-semibold">Select Inventory Input Method</h3>
        </div>
      )}

      {/* Content area — flat, single-surface like Retailer */}
      <div className="mt-3">
        {selectedTab === "add" && (
          <div className="mt-2">
            <AddInventoryOptions userId={distributorId} role="distributor" />
          </div>
        )}

        {selectedTab === "view" && (
          <div className="mt-2">
            <ViewInventory userId={distributorId} db={db} role="distributor" />
          </div>
        )}

        {selectedTab === "group" && (
          <div className="text-white/70 italic">This tab is under construction.</div>
        )}
        {selectedTab === "lowstock" && (
          <div className="text-white/70 italic">This tab is under construction.</div>
        )}
      </div>
    </motion.div>
  );
};

export default DistributorInventory;
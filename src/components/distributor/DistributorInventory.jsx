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
      transition={{ duration: 0.6 }}
      className="p-6"
    >

      <div className="flex space-x-4 mb-4">
        {["add", "view", "group", "lowstock"].map((tab) => (
          <button
            key={tab}
            className={`px-4 py-2 rounded shadow-sm transition duration-200 ease-in-out transform hover:scale-105 ${
              selectedTab === tab
                ? "bg-blue-600 text-white ring-2 ring-offset-2 ring-blue-400"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
            onClick={() => setSelectedTab(tab)}
          >
            {tab === "add"
              ? "Add Inventory"
              : tab === "view"
              ? "View Inventory"
              : tab === "group"
              ? "Item Groups"
              : "Low Stock Alerts"}
          </button>
        ))}
      </div>

      {selectedTab === "add" && (
        <div className="mt-4">
          <AddInventoryOptions userId={distributorId} role="distributor" />
        </div>
      )}

      {selectedTab === "view" && (
        <div className="mt-6">
          <ViewInventory userId={distributorId} db={db} role="distributor" />
        </div>
      )}

      {["group", "lowstock"].includes(selectedTab) && (
        <div className="text-gray-500 italic mt-4">This tab is under construction.</div>
      )}
    </motion.div>
  );
};

export default DistributorInventory;
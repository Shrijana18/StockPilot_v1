import React, { useState, useEffect, useCallback } from "react";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../../firebase/firebaseConfig";

const debounce = (func, delay) => {
  let timer;
  return (...args) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => func(...args), delay);
  };
};

const generateCustId = () => {
  const random = Math.floor(1000 + Math.random() * 9000);
  return `CUST-${random}`;
};

const CustomerForm = ({ customer, onChange, userId }) => {
  const [suggestions, setSuggestions] = useState([]);
  const [isSuggestionVisible, setIsSuggestionVisible] = useState(false);

  const fetchCustomerSuggestions = async (name) => {
    if (!userId || !name) return;
    const q = collection(db, "businesses", userId, "customers");
    const querySnapshot = await getDocs(q);
    const filtered = [];
    const lowerName = name.toLowerCase();

    querySnapshot.forEach((doc) => {
      const data = doc.data();
      if (
        (data.name && data.name.toLowerCase().includes(lowerName)) ||
        (data.phone && data.phone.includes(name))
      ) {
        filtered.push({ id: doc.id, ...data });
      }
    });

    const results = filtered; // keep duplicates
    setSuggestions(results);
    setIsSuggestionVisible(true);
  };

  const debouncedFetchSuggestions = useCallback(
    debounce((name) => fetchCustomerSuggestions(name), 300),
    []
  );

  const handleChange = async (e) => {
    const { name, value } = e.target;
    if (name === "name") {
      if (value.length > 1) debouncedFetchSuggestions(value);
      else {
        setSuggestions([]);
        setIsSuggestionVisible(false);
      }
    }
    onChange((prev) => ({
      ...prev,
      [name]: value,
      custId: prev?.custId || generateCustId(),
    }));
  };

  const handleSelectSuggestion = (customerData) => {
    setSuggestions([]);
    setIsSuggestionVisible(false);
    onChange({
      ...customerData,
      custId: customerData?.custId || generateCustId(),
    });
  };

  return (
    <div className="p-4 md:p-6 rounded-xl mb-6 space-y-4 bg-white/10 backdrop-blur-xl border border-white/10 shadow-[0_8px_40px_rgba(0,0,0,0.35)] text-white">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
        <label className="flex flex-col space-y-1 relative" htmlFor="name">
          <span className="mb-1 font-medium text-white/80">Customer Name</span>
          <input
            id="name"
            type="text"
            name="name"
            value={customer?.name || ""}
            onChange={handleChange}
            placeholder="Enter customer name"
            className="p-2 rounded bg-white/10 border border-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
            autoComplete="off"
            onBlur={() => setTimeout(() => setIsSuggestionVisible(false), 150)}
            onFocus={() => {
              if (suggestions.length > 0) setIsSuggestionVisible(true);
            }}
          />
          {isSuggestionVisible && suggestions.length > 0 && (
            <div className="mb-2 p-2 rounded bg-white/5 backdrop-blur-xl border border-white/10">
              <div className="font-medium mb-1">Select Customer</div>
              <ul className="border border-white/10 rounded bg-[#0B0F14]/70 backdrop-blur-xl shadow-[0_8px_30px_rgba(0,0,0,0.35)] max-h-40 overflow-y-auto z-10 w-full">
                {suggestions.map((cust) => (
                  <li
                    key={cust.custId || cust.id}
                    onClick={() => handleSelectSuggestion(cust)}
                    className="p-2 hover:bg-white/10 cursor-pointer border-b border-white/10 flex flex-col"
                  >
                    <div className="font-semibold text-base">
                      👤 {cust.name} <span className="text-xs text-white/60">• {cust.custId}</span>
                    </div>
                    <div className="text-sm text-white/70 mt-1">
                      📞 {cust.phone || "No Phone"} &nbsp;&nbsp; 📍 {cust.address || "No Address"}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </label>
        <label className="flex flex-col space-y-1" htmlFor="phone">
          <span className="mb-1 font-medium text-white/80">Phone Number</span>
          <input
            id="phone"
            type="tel"
            name="phone"
            value={customer?.phone || ''}
            onChange={handleChange}
            placeholder="Enter phone number"
            className="p-2 rounded bg-white/10 border border-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
          />
        </label>
        <label className="flex flex-col space-y-1" htmlFor="email">
          <span className="mb-1 font-medium text-white/80">Email Address</span>
          <input
            id="email"
            type="email"
            name="email"
            value={customer?.email || ''}
            onChange={handleChange}
            placeholder="Enter email address"
            className="p-2 rounded bg-white/10 border border-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
          />
        </label>
        <label className="flex flex-col space-y-1" htmlFor="address">
          <span className="mb-1 font-medium text-white/80">Customer Address</span>
          <input
            id="address"
            type="text"
            name="address"
            value={customer?.address || ''}
            onChange={handleChange}
            placeholder="Enter customer address"
            className="p-2 rounded bg-white/10 border border-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
          />
        </label>
      </div>
    </div>
  );
}

export default CustomerForm;
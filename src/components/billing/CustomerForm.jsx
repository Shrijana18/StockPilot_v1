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
    const q = query(
      collection(db, "businesses", userId, "customers"),
      where("name", ">=", name),
      where("name", "<=", name + "\uf8ff")
    );
    const querySnapshot = await getDocs(q);
    const uniqueByName = {};
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      if (!uniqueByName[data.name]) {
        uniqueByName[data.name] = { id: doc.id, ...data };
      }
    });
    const results = Object.values(uniqueByName);
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
    <div className="bg-white p-4 rounded shadow mb-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <label className="flex flex-col relative" htmlFor="name">
          <span className="mb-1 font-medium">Customer Name</span>
          <input
            id="name"
            type="text"
            name="name"
            value={customer?.name || ''}
            onChange={handleChange}
            placeholder="Enter customer name"
            className="border p-2 rounded"
            autoComplete="off"
            onBlur={() => setTimeout(() => setIsSuggestionVisible(false), 150)}
            onFocus={() => {
              if (suggestions.length > 0) setIsSuggestionVisible(true);
            }}
          />
          {isSuggestionVisible && suggestions.length > 0 && (
            <ul className="border rounded bg-white shadow max-h-40 overflow-y-auto z-10 absolute mt-1 w-full">
              {suggestions.map((cust) => (
                <li
                  key={cust.custId || cust.id}
                  onClick={() => handleSelectSuggestion(cust)}
                  className="p-2 hover:bg-gray-100 cursor-pointer"
                >
                  {cust.name} ({cust.phone || "No Phone"}) – {cust.custId}
                </li>
              ))}
            </ul>
          )}
        </label>
        <label className="flex flex-col" htmlFor="phone">
          <span className="mb-1 font-medium">Phone Number</span>
          <input
            id="phone"
            type="tel"
            name="phone"
            value={customer?.phone || ''}
            onChange={handleChange}
            placeholder="Enter phone number"
            className="border p-2 rounded"
          />
        </label>
        <label className="flex flex-col" htmlFor="email">
          <span className="mb-1 font-medium">Email Address</span>
          <input
            id="email"
            type="email"
            name="email"
            value={customer?.email || ''}
            onChange={handleChange}
            placeholder="Enter email address"
            className="border p-2 rounded"
          />
        </label>
        <label className="flex flex-col" htmlFor="address">
          <span className="mb-1 font-medium">Customer Address</span>
          <input
            id="address"
            type="text"
            name="address"
            value={customer?.address || ''}
            onChange={handleChange}
            placeholder="Enter customer address"
            className="border p-2 rounded"
          />
        </label>
      </div>
    </div>
  );
}

export default CustomerForm;
import React from "react";

const CustomerForm = ({ customerInfo, setCustomerInfo }) => {
  const handleChange = (e) => {
    setCustomerInfo({
      ...customerInfo,
      [e.target.name]: e.target.value,
    });
  };

  return (
    <div className="bg-white p-4 rounded shadow mb-4">
      <h2 className="text-lg font-semibold mb-2">Customer Information</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <input
          type="text"
          name="name"
          value={customerInfo.name}
          onChange={handleChange}
          placeholder="Customer Name"
          className="border p-2 rounded"
        />
        <input
          type="tel"
          name="phone"
          value={customerInfo.phone}
          onChange={handleChange}
          placeholder="Phone Number"
          className="border p-2 rounded"
        />
        <input
          type="email"
          name="email"
          value={customerInfo.email}
          onChange={handleChange}
          placeholder="Email Address"
          className="border p-2 rounded"
        />
        <input
          type="text"
          name="address"
          value={customerInfo.address}
          onChange={handleChange}
          placeholder="Customer Address"
          className="border p-2 rounded"
        />
      </div>
    </div>
  );
};

export default CustomerForm;
import React from "react";

const CustomerForm = ({ customer, onChange }) => {
  const handleChange = (e) => {
    onChange({
      ...customer,
      [e.target.name]: e.target.value,
    });
  };

  return (
    <div className="bg-white p-4 rounded shadow mb-4">
      <h2 className="text-lg font-semibold mb-2">Customer Information</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <label className="flex flex-col" htmlFor="name">
          <span className="mb-1 font-medium">Customer Name</span>
          <input
            id="name"
            type="text"
            name="name"
            value={customer?.name || ''}
            onChange={handleChange}
            placeholder="Enter customer name"
            className="border p-2 rounded"
          />
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
};

export default CustomerForm;
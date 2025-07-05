import React from 'react';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase/firebaseConfig';
import { useNavigate } from 'react-router-dom';

const ProductOwnerDashboard = () => {
  const navigate = useNavigate();

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      navigate('/');
    } catch (error) {
      console.error("Sign out error:", error);
    }
  };

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <div className="w-64 bg-gray-900 text-white p-6">
        <h2 className="text-2xl font-bold mb-8">Product Owner</h2>
        <ul className="space-y-4">
          <li className="hover:text-yellow-400 cursor-pointer">Dashboard</li>
          <li className="hover:text-yellow-400 cursor-pointer">Production</li>
          <li className="hover:text-yellow-400 cursor-pointer">Inventory</li>
          <li className="hover:text-yellow-400 cursor-pointer">Reports</li>
          <li className="hover:text-yellow-400 cursor-pointer">Business Insights</li>
        </ul>
        <button 
          onClick={handleSignOut}
          className="mt-12 bg-red-600 hover:bg-red-700 text-white py-2 px-4 rounded">
          Sign Out
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 bg-gray-100 p-10 overflow-y-auto">
        <h1 className="text-3xl font-semibold mb-6">Welcome Product Owner!</h1>
        <p className="text-gray-600 mb-6">
          Here's your central hub to manage production cycles, oversee inventory, and analyze supply performance.
        </p>
        <div className="grid grid-cols-3 gap-6">
          <div className="bg-white shadow p-6 rounded">
            <h2 className="text-xl font-bold">Active Products</h2>
            <p className="text-green-600 text-3xl mt-2">145</p>
          </div>
          <div className="bg-white shadow p-6 rounded">
            <h2 className="text-xl font-bold">Production Units</h2>
            <p className="text-blue-600 text-3xl mt-2">32</p>
          </div>
          <div className="bg-white shadow p-6 rounded">
            <h2 className="text-xl font-bold">Pending Shipments</h2>
            <p className="text-orange-600 text-3xl mt-2">9</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductOwnerDashboard;

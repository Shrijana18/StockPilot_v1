import React from 'react';

const LandingPage = () => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-orange-100 via-yellow-100 to-green-100 text-center px-6">
      <h1 className="text-5xl font-extrabold mb-4">Welcome to BusinessPilot 🚀</h1>
      <p className="text-lg mb-8 text-gray-700">
        Your smart inventory & billing assistant, on autopilot.
      </p>
      <div className="space-x-4">
        <a href="/register" className="px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-xl shadow-md text-lg">
          Register
        </a>
        <a href="/login" className="px-6 py-3 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-xl shadow-md text-lg">
          Sign In
        </a>
      </div>
    </div>
  );
};

export default LandingPage;


import React from "react";

const MobileNavbar = () => {
  return (
    <div className="bg-blue-600 text-white p-4 flex justify-between items-center shadow-md">
      <div className="text-lg font-bold">FLYP</div>
      <div className="flex gap-3 text-sm">
        <button className="bg-white text-blue-600 px-2 py-1 rounded">Menu</button>
        <button className="bg-white text-blue-600 px-2 py-1 rounded">Profile</button>
      </div>
    </div>
  );
};

export default MobileNavbar;
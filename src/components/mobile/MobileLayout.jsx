

import React from "react";
import MobileNavbar from "./MobileNavbar";
import MobileFooter from "./MobileFooter";

const MobileLayout = ({ children }) => {
  return (
    <div className="flex flex-col min-h-screen bg-white text-black">
      <MobileNavbar />
      <main className="flex-grow p-4 overflow-y-auto">{children}</main>
      <MobileFooter />
    </div>
  );
};

export default MobileLayout;


import React, { createContext, useState, useContext } from 'react';

const AnalyticsFilterContext = createContext();

export const AnalyticsFilterProvider = ({ children }) => {
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);

  return (
    <AnalyticsFilterContext.Provider
      value={{
        selectedProduct,
        setSelectedProduct,
        selectedDate,
        setSelectedDate,
      }}
    >
      {children}
    </AnalyticsFilterContext.Provider>
  );
};

export const useAnalyticsFilter = () => useContext(AnalyticsFilterContext);
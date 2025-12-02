import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, where, getDocs, onSnapshot } from 'firebase/firestore';
import { db } from '../../../firebase/firebaseConfig';

/**
 * SmartShelfView - Shows stock remaining grouped by location (shelf/rack/aisle)
 * Provides quick view of what's running low in each location
 */
const SmartShelfView = ({ userId, products }) => {
  const [groupBy, setGroupBy] = useState('shelf'); // 'shelf', 'rack', 'aisle', 'floor'
  const [lowStockThreshold, setLowStockThreshold] = useState(10);
  const [selectedLocation, setSelectedLocation] = useState(null);

  // Group products by location
  const groupedProducts = useMemo(() => {
    const groups = {};
    
    products.forEach(product => {
      const location = product.location || {};
      let key = '';
      let label = '';

      if (groupBy === 'shelf' && location.shelf) {
        key = location.shelf;
        label = location.fullPath || 'Unknown Shelf';
      } else if (groupBy === 'rack' && location.rack) {
        key = location.rack;
        label = location.fullPath?.split(' > ').slice(0, -1).join(' > ') || 'Unknown Rack';
      } else if (groupBy === 'aisle' && location.aisle) {
        key = location.aisle;
        label = location.fullPath?.split(' > ').slice(0, -2).join(' > ') || 'Unknown Aisle';
      } else if (groupBy === 'floor' && location.floor) {
        key = location.floor;
        label = location.fullPath?.split(' > ')[0] || 'Unknown Floor';
      } else {
        key = 'unassigned';
        label = 'Unassigned Location';
      }

      if (!groups[key]) {
        groups[key] = {
          key,
          label,
          products: [],
          totalQuantity: 0,
          lowStockCount: 0,
        };
      }

      groups[key].products.push(product);
      groups[key].totalQuantity += Number(product.quantity || 0);
      if (Number(product.quantity || 0) <= lowStockThreshold) {
        groups[key].lowStockCount++;
      }
    });

    return Object.values(groups).sort((a, b) => {
      if (a.key === 'unassigned') return 1;
      if (b.key === 'unassigned') return -1;
      return a.label.localeCompare(b.label);
    });
  }, [products, groupBy, lowStockThreshold]);

  const getStatusColor = (quantity) => {
    const qty = Number(quantity || 0);
    if (qty === 0) return 'bg-red-500';
    if (qty <= lowStockThreshold) return 'bg-yellow-500';
    return 'bg-emerald-500';
  };

  const getStatusText = (quantity) => {
    const qty = Number(quantity || 0);
    if (qty === 0) return 'Out of Stock';
    if (qty <= lowStockThreshold) return 'Low Stock';
    return 'In Stock';
  };

  return (
    <div className="text-white">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-4 mb-6 p-4 rounded-xl bg-white/5 border border-white/10">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium">Group By:</label>
          <select
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value)}
            className="px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
          >
            <option value="shelf">Shelf</option>
            <option value="rack">Rack</option>
            <option value="aisle">Aisle</option>
            <option value="floor">Floor</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm font-medium">Low Stock Threshold:</label>
          <input
            type="number"
            value={lowStockThreshold}
            onChange={(e) => setLowStockThreshold(Number(e.target.value))}
            className="w-20 px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
            min="0"
          />
        </div>

        <div className="ml-auto text-sm text-white/70">
          {groupedProducts.length} {groupBy}(s) • {products.length} products
        </div>
      </div>

      {/* Location Groups */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {groupedProducts.map((group) => (
          <div
            key={group.key}
            className={`p-4 rounded-xl border ${
              selectedLocation === group.key
                ? 'border-emerald-400 bg-emerald-500/10'
                : 'border-white/10 bg-white/5 hover:bg-white/10'
            } transition-all cursor-pointer`}
            onClick={() => setSelectedLocation(selectedLocation === group.key ? null : group.key)}
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <h3 className="font-semibold text-sm mb-1">{group.label}</h3>
                <p className="text-xs text-white/60">
                  {group.products.length} product{group.products.length !== 1 ? 's' : ''}
                </p>
              </div>
              {group.lowStockCount > 0 && (
                <span className="px-2 py-1 rounded-full text-xs font-semibold bg-yellow-500/20 text-yellow-300">
                  {group.lowStockCount} Low
                </span>
              )}
            </div>

            {/* Stats */}
            <div className="mb-3 space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-white/70">Total Quantity:</span>
                <span className="font-semibold">{group.totalQuantity}</span>
              </div>
              {group.lowStockCount > 0 && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-yellow-300">Low Stock Items:</span>
                  <span className="font-semibold text-yellow-300">{group.lowStockCount}</span>
                </div>
              )}
            </div>

            {/* Product List (if expanded) */}
            {selectedLocation === group.key && (
              <div className="mt-3 pt-3 border-t border-white/10 space-y-2 max-h-64 overflow-y-auto">
                {group.products.map((product) => {
                  const qty = Number(product.quantity || 0);
                  return (
                    <div
                      key={product.id}
                      className="flex items-center justify-between p-2 rounded bg-white/5 hover:bg-white/10"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{product.productName}</p>
                        <p className="text-xs text-white/60">{product.sku}</p>
                      </div>
                      <div className="flex items-center gap-2 ml-2">
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${getStatusColor(qty)}`}>
                          {qty}
                        </span>
                        <span className="text-xs text-white/60">{getStatusText(qty)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Quick Actions */}
            {selectedLocation === group.key && (
              <div className="mt-3 pt-3 border-t border-white/10 flex gap-2">
                <button
                  className="flex-1 px-3 py-1.5 rounded-lg text-xs bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300"
                  onClick={(e) => {
                    e.stopPropagation();
                    // TODO: Navigate to reorder view
                  }}
                >
                  Reorder Low Stock
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Empty State */}
      {groupedProducts.length === 0 && (
        <div className="text-center py-12 text-white/60">
          <p className="text-lg mb-2">No products with locations found</p>
          <p className="text-sm">Assign locations to products to see them grouped here</p>
        </div>
      )}
    </div>
  );
};

export default SmartShelfView;


import React, { useEffect, useState, useMemo } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../firebase/firebaseConfig';
import { usePlatform } from '../../hooks/usePlatform';

const THRESHOLD = 5; // show when quantity <= THRESHOLD

const LowStockAlertWidget = ({ userId }) => {
  const { isNativeApp, isMobileViewport } = usePlatform();
  const [lowStockItems, setLowStockItems] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchLowStockItems = async () => {
      try {
        if (!userId) return;
        setLoading(true);
        const q = collection(db, 'businesses', userId, 'products');
        const snapshot = await getDocs(q);
        const lowStock = [];
        snapshot.forEach(doc => {
          const data = doc.data() || {};
          const quantity = Number(data.quantity ?? 0);
          if (quantity <= THRESHOLD) {
            lowStock.push({ ...data, id: doc.id, quantity });
          }
        });
        // sort by quantity asc, then name
        lowStock.sort((a, b) => (a.quantity - b.quantity) || String(a.productName || '').localeCompare(String(b.productName || '')));
        setLowStockItems(lowStock);
      } catch (error) {
        console.error('Error fetching low stock items:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchLowStockItems();
  }, [userId]);

  const summary = useMemo(() => {
    const critical = lowStockItems.filter(i => i.quantity <= 1).length;
    const warning = lowStockItems.filter(i => i.quantity > 1 && i.quantity <= 3).length;
    const low = lowStockItems.filter(i => i.quantity > 3 && i.quantity <= THRESHOLD).length;
    return { critical, warning, low, total: lowStockItems.length };
  }, [lowStockItems]);

  const LevelPill = ({ qty }) => {
    const cls = qty <= 1
      ? 'bg-rose-500/15 text-rose-200 border-rose-400/25'
      : qty <= 3
      ? 'bg-amber-500/15 text-amber-200 border-amber-400/25'
      : 'bg-sky-500/15 text-sky-200 border-sky-400/25';
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] border ${cls}`}>
        <span className="opacity-80">Qty</span>
        <strong className="tabular-nums">{qty}</strong>
      </span>
    );
  };

  return (
    <div className="relative rounded-2xl text-white w-full">
      {/* subtle aurora wash for cohesion */}
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-fuchsia-400/6 via-sky-400/6 to-emerald-400/6 pointer-events-none" />

      <div className={`relative ${isNativeApp ? 'p-4 sm:p-5' : 'p-5'} rounded-[16px] bg-white/5 backdrop-blur-xl border border-white/10 ring-1 ring-white/5 shadow-[0_12px_40px_rgba(2,6,23,0.45)]`}>
        {/* Header */}
        <div className="flex items-center justify-between mb-3 sm:mb-3">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-white/10 border border-white/10 ring-1 ring-white/10 shadow-[0_2px_8px_rgba(0,0,0,0.25)]">
              {/* alert icon */}
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-amber-200" aria-hidden="true">
                <path fill="currentColor" d="M1 21h22L12 2 1 21zm12-3h-2v2h2v-2zm0-6h-2v5h2v-5z" />
              </svg>
            </span>
            <h3 className="text-[18px] md:text-[19px] font-semibold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-white to-emerald-200">
              Low Stock Alerts
            </h3>
          </div>
          <span className="hidden sm:inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[13px] leading-none backdrop-blur">
            <span className="text-rose-200">{summary.critical}</span> critical • <span className="text-amber-200">{summary.warning}</span> warn • <span className="text-sky-200">{summary.low}</span> low
          </span>
        </div>

        {/* Content */}
        {loading ? (
          <div className="text-sm text-white/70">Loading…</div>
        ) : lowStockItems.length === 0 ? (
          <div className="flex items-center gap-2 text-sm text-white/70">
            <svg viewBox="0 0 24 24" className="h-4 w-4 opacity-70" aria-hidden="true">
              <path fill="currentColor" d="M12 22C6.48 22 2 17.52 2 12S6.48 2 12 2s10 4.48 10 10-4.48 10-10 10zm-1-6h2v2h-2v-2zm0-10h2v8h-2V6z" />
            </svg>
            All items are sufficiently stocked.
          </div>
        ) : (
          <div className={`overflow-y-auto pr-1 ${isNativeApp ? 'max-h-[350px]' : 'max-h-[300px]'}`}>
            <ul className="space-y-2 text-sm">
              {lowStockItems.map((item) => (
                <li key={item.id} className="group rounded-xl border border-white/10 bg-white/5 hover:bg-white/8 transition-all p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold bg-clip-text text-transparent bg-gradient-to-r from-emerald-200 to-sky-300 truncate">
                          {item.productName || 'Unnamed Product'}
                        </span>
                        {item.SKU && (
                          <span className="text-[11px] text-white/60">• {item.SKU}</span>
                        )}
                      </div>
                      {item.brand && (
                        <div className="text-[11px] text-white/60 mt-0.5 truncate">{item.brand}</div>
                      )}
                    </div>

                    <div className="shrink-0 flex items-center gap-2">
                      <LevelPill qty={item.quantity} />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

export default LowStockAlertWidget;
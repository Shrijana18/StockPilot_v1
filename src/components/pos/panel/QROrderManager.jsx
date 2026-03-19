import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { QRCodeCanvas } from "qrcode.react";
import { collection, onSnapshot } from "firebase/firestore";
import { db, auth } from "../../../firebase/firebaseConfig";
import { usePOSTheme } from "../POSThemeContext";
import { usePOSBusiness } from "../POSBusinessContext";
import { generateQRPrint, printThermalContent } from "../../../utils/thermalPrinter";

const getUid = () => auth.currentUser?.uid;

// ── Per-table QR Card ─────────────────────────────────────────────────────────
function TableQRCard({ table, bizUid, bizName, idx }) {
  const wrapperRef = useRef(null);
  const [copied, setCopied] = useState(false);

  const qrUrl = `${window.location.origin}/qr-order?biz=${bizUid}&table=${table.id}`;

  const getCanvas = () => wrapperRef.current?.querySelector("canvas");

  const downloadQR = useCallback(() => {
    const src = getCanvas();
    if (!src) return;

    const pad = 28;
    const labelH = 70;
    const off = document.createElement("canvas");
    off.width  = src.width  + pad * 2;
    off.height = src.height + pad * 2 + labelH;
    const ctx = off.getContext("2d");

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, off.width, off.height);

    // thin green top bar
    ctx.fillStyle = "#10b981";
    ctx.fillRect(0, 0, off.width, 5);

    ctx.drawImage(src, pad, pad + 5);

    ctx.textAlign = "center";
    const cx = off.width / 2;
    const qrB = src.height + pad + 5;

    ctx.font = "bold 15px -apple-system,sans-serif";
    ctx.fillStyle = "#111827";
    ctx.fillText(bizName, cx, qrB + 22);

    ctx.font = "bold 20px -apple-system,sans-serif";
    ctx.fillStyle = "#10b981";
    ctx.fillText(table.name || `Table ${table.number}`, cx, qrB + 48);

    ctx.font = "10px -apple-system,sans-serif";
    ctx.fillStyle = "#9ca3af";
    ctx.fillText("Scan to order · Powered by FLYP", cx, qrB + 65);

    const a = document.createElement("a");
    a.download = `QR-${(table.name || `Table-${table.number}`).replace(/\s+/g, "-")}.png`;
    a.href = off.toDataURL("image/png");
    a.click();
  }, [table, bizName]);

  const printTent = useCallback(() => {
    const src = getCanvas();
    if (!src) return;
    const dataUrl = src.toDataURL("image/png");
    const tName = table.name || `Table ${table.number}`;

    const qrData = {
      tableName: tName,
      tableZone: table.zone || "",
      qrCodeDataUrl: dataUrl,
      businessName: bizName,
    };

    printThermalContent(generateQRPrint(qrData), `QR Code — ${tName}`);
  }, [table, bizName]);

  const copyLink = useCallback(() => {
    navigator.clipboard.writeText(qrUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  }, [qrUrl]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay: idx * 0.04, duration: 0.2 }}
      className="rounded-2xl border border-white/8 bg-white/3 hover:border-emerald-500/20 hover:bg-white/5 transition-all overflow-hidden"
    >
      {/* Card header */}
      <div className="px-4 pt-4 pb-2 flex items-center justify-between">
        <div>
          <p className="font-black text-white text-sm">{table.name || `Table ${table.number}`}</p>
          {table.zone && <p className="text-[10px] text-white/40 capitalize mt-0.5">{table.zone}</p>}
          {table.capacity && <p className="text-[10px] text-white/25 mt-0.5">👥 {table.capacity} seats</p>}
        </div>
        <div className="w-9 h-9 rounded-xl bg-emerald-500/12 border border-emerald-500/20 flex items-center justify-center text-lg">🪑</div>
      </div>

      {/* QR Code */}
      <div className="flex items-center justify-center mx-4 mb-3 py-4 rounded-2xl bg-white" ref={wrapperRef}>
        <QRCodeCanvas
          value={qrUrl}
          size={152}
          level="H"
          includeMargin={false}
          bgColor="#ffffff"
          fgColor="#111827"
        />
      </div>

      {/* URL strip */}
      <div className="mx-4 mb-3 px-2.5 py-1.5 rounded-xl bg-white/4 border border-white/6">
        <p className="text-[9px] text-white/25 font-mono truncate">{qrUrl}</p>
      </div>

      {/* Action buttons */}
      <div className="px-4 pb-4 grid grid-cols-3 gap-2">
        <motion.button whileTap={{ scale: 0.94 }} onClick={downloadQR}
          className="py-2.5 rounded-xl bg-emerald-500/12 border border-emerald-500/18 text-emerald-300 text-[10px] font-black hover:bg-emerald-500/22 transition flex flex-col items-center gap-1"
        ><span className="text-sm">⬇️</span>Download</motion.button>

        <motion.button whileTap={{ scale: 0.94 }} onClick={printTent}
          className="py-2.5 rounded-xl bg-blue-500/12 border border-blue-500/18 text-blue-300 text-[10px] font-black hover:bg-blue-500/22 transition flex flex-col items-center gap-1"
        ><span className="text-sm">🖨️</span>Print</motion.button>

        <motion.button whileTap={{ scale: 0.94 }} onClick={copyLink}
          className={`py-2.5 rounded-xl border text-[10px] font-black transition flex flex-col items-center gap-1 ${
            copied ? "bg-violet-500/20 border-violet-400/25 text-violet-200"
                   : "bg-white/5 border-white/8 text-white/45 hover:bg-white/10"
          }`}
        ><span className="text-sm">{copied ? "✅" : "🔗"}</span>{copied ? "Copied!" : "Copy"}</motion.button>
      </div>
    </motion.div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function QROrderManager() {
  const { tc } = usePOSTheme();
  const { uid: bizUid, bizName, bizAddress, bizCity, bizPhone, bizGST } = usePOSBusiness();
  const [tables,  setTables]  = useState([]);
  const [loading, setLoading] = useState(true);

  // Reactive uid — covers auth race when component mounts before IndexedDB restores
  const [uid, setUid] = useState(() => getUid() || null);
  useEffect(() => auth.onAuthStateChanged(u => setUid(u?.uid || null)), []);

  useEffect(() => {
    if (!uid) { setLoading(false); return; }

    const unsub = onSnapshot(
      collection(db, "businesses", uid, "tables"),
      snap => {
        setTables(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (a.number || 0) - (b.number || 0)));
        setLoading(false);
      },
      () => setLoading(false)
    );
    return unsub;
  }, [uid]);

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden" style={tc.bg}>

      {/* Header */}
      <div className={`px-6 pt-5 pb-4 shrink-0 border-b ${tc.borderSoft}`}>
        {/* Business info bar */}
        {bizName && bizName !== "Restaurant" && (
          <div className={`flex items-center gap-3 mb-4 px-4 py-2.5 rounded-2xl border ${tc.borderSoft} ${tc.mutedBg}`}>
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500/20 to-teal-500/10 border border-emerald-400/20 flex items-center justify-center text-sm font-black text-emerald-300 shrink-0">
              {bizName.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-bold truncate ${tc.textPrimary}`}>{bizName}</p>
              {(bizAddress || bizCity) && (
                <p className={`text-[10px] truncate ${tc.textMuted}`}>{[bizAddress, bizCity].filter(Boolean).join(", ")}</p>
              )}
            </div>
            {bizGST && <span className={`text-[9px] font-mono px-2 py-0.5 rounded-lg bg-white/5 border border-white/8 ${tc.textMuted} shrink-0`}>GST: {bizGST}</span>}
            {bizPhone && <a href={`tel:${bizPhone}`} className="text-[10px] text-emerald-400 hover:underline shrink-0">{bizPhone}</a>}
          </div>
        )}
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-xl">📱</span>
              <h1 className={`text-xl font-black ${tc.textPrimary}`}>QR Code Ordering</h1>
              <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-emerald-500/15 text-emerald-300 border border-emerald-500/25 uppercase tracking-wider flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />Live
              </span>
            </div>
            <p className={`text-[11px] ${tc.textMuted}`}>One QR per table · Customers scan → browse menu → place orders directly to kitchen</p>
          </div>
          <div className="text-right shrink-0">
            <p className={`text-2xl font-black ${tc.textPrimary}`}>{tables.length}</p>
            <p className={`text-[10px] ${tc.textMuted}`}>tables</p>
          </div>
        </div>

        {/* How it works */}
        <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-emerald-500/6 border border-emerald-500/15">
          <span className="text-lg shrink-0 mt-0.5">💡</span>
          <div className="space-y-1">
            <p className="text-xs font-bold text-emerald-200">How it works</p>
            <div className="flex items-center gap-4 text-[11px] text-emerald-300/55">
              <span>1️⃣ Download or print QR</span>
              <span>→</span>
              <span>2️⃣ Stick on table</span>
              <span>→</span>
              <span>3️⃣ Customers scan &amp; order</span>
              <span>→</span>
              <span>4️⃣ Order appears on KDS</span>
            </div>
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3">
            <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
              className="w-8 h-8 border-2 border-emerald-500/20 border-t-emerald-400 rounded-full" />
            <p className={`text-sm ${tc.textMuted}`}>Loading tables…</p>
          </div>
        ) : tables.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3 text-center">
            <div className="text-5xl opacity-15">🪑</div>
            <p className={`text-sm font-medium ${tc.textSub}`}>No tables found</p>
            <p className={`text-xs ${tc.textMuted}`}>Add tables in Tables &amp; Orders first, then QR codes appear here automatically</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
            {tables.map((table, idx) => (
              <TableQRCard key={table.id} table={table} bizUid={uid} bizName={bizName} idx={idx} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

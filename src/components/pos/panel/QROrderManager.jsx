import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { QRCodeCanvas } from "qrcode.react";
import { collection, onSnapshot, doc, getDoc } from "firebase/firestore";
import { db, auth } from "../../../firebase/firebaseConfig";

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
    const zone  = table.zone ? ` · ${table.zone}` : "";

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>Table QR · ${tName}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#fff;display:flex;align-items:center;justify-content:center;min-height:100vh}
.card{width:88mm;border:2px solid #e5e7eb;border-radius:12px;overflow:hidden;text-align:center;box-shadow:0 4px 20px rgba(0,0,0,.08)}
.stripe{height:6px;background:linear-gradient(90deg,#10b981,#0d9488)}
.inner{padding:8mm}
.biz{font-size:13px;font-weight:700;color:#111827;letter-spacing:1px;text-transform:uppercase;margin-bottom:6px}
.sep{border:none;border-top:1px dashed #d1d5db;margin:8px 0}
.tname{font-size:26px;font-weight:900;color:#10b981;margin:6px 0 2px}
.zone{font-size:11px;color:#9ca3af;margin-bottom:10px}
.qrbox{background:#fff;padding:8px;display:inline-block;border:1.5px solid #f3f4f6;border-radius:8px;margin-bottom:10px}
.qrbox img{width:58mm;height:58mm;display:block}
.cta{font-size:13px;font-weight:700;color:#111827;margin-bottom:3px}
.sub{font-size:10px;color:#9ca3af;line-height:1.4;margin-bottom:6px}
.url{font-size:8px;color:#d1d5db;font-family:monospace;word-break:break-all}
.powered{font-size:8px;color:#d1d5db;letter-spacing:1.5px;text-transform:uppercase;margin-top:8px}
@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
</style></head><body>
<div class="card">
  <div class="stripe"></div>
  <div class="inner">
    <div class="biz">${bizName}</div>
    <hr class="sep">
    <div class="tname">${tName}</div>
    ${zone ? `<div class="zone">${zone}</div>` : ""}
    <div class="qrbox"><img src="${dataUrl}" /></div>
    <div class="cta">📱 Scan to order</div>
    <div class="sub">Browse our menu and place your order<br>directly from your phone</div>
    <div class="url">${qrUrl}</div>
    <div class="powered">Powered by FLYP POS</div>
  </div>
</div>
</body></html>`;

    const win = window.open("", "_blank", "width=430,height=640");
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 600);
  }, [table, bizName, qrUrl]);

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
  const [tables,  setTables]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [bizName, setBizName] = useState("Restaurant");
  const uid = getUid();

  useEffect(() => {
    if (!uid) { setLoading(false); return; }

    getDoc(doc(db, "businesses", uid))
      .then(snap => { if (snap.exists()) setBizName(snap.data()?.businessName || snap.data()?.name || "Restaurant"); })
      .catch(() => {});

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
    <div className="flex-1 flex flex-col h-full overflow-hidden" style={{ background: "linear-gradient(180deg,#070b12 0%,#060a10 100%)" }}>

      {/* Header */}
      <div className="px-6 pt-5 pb-4 border-b border-white/6 shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-xl">📱</span>
              <h1 className="text-xl font-black text-white">QR Code Ordering</h1>
              <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-emerald-500/15 text-emerald-300 border border-emerald-500/25 uppercase tracking-wider flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />Live
              </span>
            </div>
            <p className="text-[11px] text-white/35">One QR per table · Customers scan → browse menu → place orders directly to kitchen</p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-2xl font-black text-white">{tables.length}</p>
            <p className="text-[10px] text-white/30">tables</p>
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
            <p className="text-white/30 text-sm">Loading tables…</p>
          </div>
        ) : tables.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3 text-center">
            <div className="text-5xl opacity-15">🪑</div>
            <p className="text-white/30 text-sm font-medium">No tables found</p>
            <p className="text-white/20 text-xs">Add tables in Tables &amp; Orders first, then QR codes appear here automatically</p>
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

import html2canvas from "html2canvas";
import React, { useEffect, useRef } from "react";
import ReactDOM from "react-dom";
import PropTypes from "prop-types";
import { QRCodeCanvas } from "qrcode.react";

// --- Unified QR payload helpers ---
const b64u = (str) =>
  btoa(unescape(encodeURIComponent(str)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

function buildProductPayload(product, { version = 1, bid = null } = {}) {
  if (!product) return null;
  // Try to find a stable id
  const id =
    product.id ||
    product.docId ||
    product._id ||
    product.productId ||
    product.firebaseId ||
    product.uid ||
    product.sku; // fallback to SKU if unique in your store

  if (!id) return null;

  const payload = {
    v: version,
    t: "product",
    id,                 // stable product id
    bid: bid || null,   // business/tenant id (optional but recommended)
    sku: product.sku || null,
    b: product.batchId || null, // optional batch/lot
  };
  // Compact JSON and base64url-encode for denser QR
  const json = JSON.stringify(payload);
  return b64u(json);
}

const formatINR = (n) => {
  const num = Number(n);
  if (!isFinite(num)) return null;
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    }).format(num);
  } catch {
    return `₹${num.toFixed(2)}`;
  }
};

const modalRoot = document.body;
const LABEL_WIDTH_PX = 480; // wider label for cleaner downloads

export default function QRCodeGenerator({ value, onClose, product, size = 220, autoPayload = true, payloadVersion = 1, businessId = null }) {
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  const labelRef = useRef(null);
  const QR_SIZE = Math.min(300, LABEL_WIDTH_PX - 80);

  const qrString = React.useMemo(() => {
    if (autoPayload && product) {
      const built = buildProductPayload(product, { version: payloadVersion, bid: businessId || null });
      return built || String(value || "");
    }
    return String(value || "");
  }, [autoPayload, product, payloadVersion, value, businessId]);

  function onBackdropClick(e) {
    if (e.target === e.currentTarget) {
      onClose();
    }
  }

  return ReactDOM.createPortal(
    <div
      onClick={onBackdropClick}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        backgroundColor: "rgba(0,0,0,0.6)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 9999,
        padding: 20,
        boxSizing: "border-box",
      }}
      aria-modal="true"
      role="dialog"
      aria-labelledby="qr-modal-title"
    >
      <div
        style={{
          backgroundColor: "white",
          borderRadius: 8,
          maxWidth: 560,
          width: "100%",
          padding: 24,
          boxSizing: "border-box",
          position: "relative",
          textAlign: "center",
          boxShadow: "0 2px 10px rgba(0,0,0,0.2)",
          fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
        }}
      >
        <button
          onClick={onClose}
          aria-label="Close QR code modal"
          style={{
            position: "absolute",
            top: 12,
            right: 12,
            background: "transparent",
            border: "none",
            fontSize: 24,
            cursor: "pointer",
            lineHeight: 1,
            color: "#555",
          }}
          type="button"
        >
          &times;
        </button>
        <h2 id="qr-modal-title" style={{ marginTop: 0, marginBottom: 16 }}>
          Product QR Code
        </h2>
        {/* Note: Visible label shows human-readable fields; encoded QR carries a compact versioned payload. */}
        <div
          ref={labelRef}
          style={{
            backgroundColor: "#fff",
            width: LABEL_WIDTH_PX,
            boxSizing: "border-box",
            padding: 16,
            margin: "0 auto",
            border: "1px solid #e5e7eb",
            borderRadius: 8,
            display: "inline-block",
            textAlign: "left",
          }}
        >
          <div style={{ fontSize: 12, color: "#111827", marginBottom: 8, fontWeight: 600 }}>
            Product QR Label
          </div>

          {product && (
            <div style={{ marginBottom: 10, fontSize: 14, color: "#111827", lineHeight: 1.5 }}>
              {product.productName && (
                <div><strong>Product:</strong> {product.productName}</div>
              )}
              {product.brand && (
                <div><strong>Brand:</strong> {product.brand}</div>
              )}
              {product.sku && (
                <div><strong>SKU:</strong> {product.sku}</div>
              )}
              {product.unit && (
                <div><strong>Unit:</strong> {product.unit}</div>
              )}
              {/* Selling price: try common keys */}
              {(() => {
                const price =
                  product.sell ??
                  product.sellingPrice ??
                  product.selling_price ??
                  product.price;
                const p = formatINR(price);
                return p ? (<div><strong>Price:</strong> {p}</div>) : null;
              })()}
            </div>
          )}

          <div style={{ height: 1, background: "#e5e7eb", margin: "8px 0 12px 0" }} />

          <div style={{ display: "flex", justifyContent: "center" }}>
            <QRCodeCanvas value={qrString} size={QR_SIZE} />
          </div>

          {product?.productName && (
            <div style={{ textAlign: "center", marginTop: 8, fontSize: 12, color: "#374151" }}>
              {product.productName}
            </div>
          )}
        </div>
        <div style={{ marginTop: 16 }}>
          <button
            type="button"
            onClick={async () => {
              try {
                const container = labelRef.current;
                if (!container) return;
                const canvas = await html2canvas(container, {
                  backgroundColor: "#fff",
                  scale: Math.max(2, window.devicePixelRatio || 2),
                  useCORS: true,
                  logging: false,
                });
                const pngUrl = canvas.toDataURL("image/png");
                const downloadLink = document.createElement("a");
                const safe = (s) => String(s).trim().replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_\-]/g, "");
                let filename = "qr-code.png";
                if (product?.productName) filename = `${safe(product.productName)}-label.png`;
                else if (product?.sku) filename = `${safe(product.sku)}-label.png`;
                downloadLink.href = pngUrl;
                downloadLink.download = filename;
                document.body.appendChild(downloadLink);
                downloadLink.click();
                document.body.removeChild(downloadLink);
              } catch {
                // fail silently
              }
            }}
            style={{
              cursor: "pointer",
              padding: "10px 18px",
              fontSize: 14,
              borderRadius: 8,
              border: "1px solid #2563eb",
              background: "linear-gradient(180deg,#60a5fa,#2563eb)",
              color: "white",
              userSelect: "none",
              boxShadow: "0 6px 18px rgba(37,99,235,.25)"
            }}
          >
            Download PNG
          </button>
        </div>
      </div>
    </div>,
    modalRoot
  );
}

QRCodeGenerator.propTypes = {
  value: PropTypes.string,
  onClose: PropTypes.func.isRequired,
  product: PropTypes.shape({
    productName: PropTypes.string,
    brand: PropTypes.string,
    sku: PropTypes.string,
    unit: PropTypes.string,
    price: PropTypes.number,
  }),
  size: PropTypes.number,
  autoPayload: PropTypes.bool,
  payloadVersion: PropTypes.number,
  businessId: PropTypes.string,
};

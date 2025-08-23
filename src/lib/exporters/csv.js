

// src/lib/exporters/csv.js
// Proforma‑aware CSV exporter for orders
// - Prefers locked values from order.proforma (lines[i].price / lines[i].gross, grandTotal)
// - Falls back to item price * qty when proforma is not present
// - Includes a Grand Total row
// - Handles CSV escaping safely

// Safely quote CSV cells (handle quotes, commas, newlines)
function q(val) {
  const s = String(val ?? "");
  // Always wrap in quotes and escape internal quotes
  return `"${s.replace(/"/g, '""')}"`;
}

// Get proforma-aware price for a line
function linePrice(order, item, index) {
  const ln = Array.isArray(order?.proforma?.lines) ? order.proforma.lines[index] : undefined;
  if (ln && ln.price != null) return Number(ln.price) || 0;
  return Number(item?.price) || 0;
}

// Get proforma-aware subtotal/gross for a line
function lineSubtotal(order, item, index) {
  const ln = Array.isArray(order?.proforma?.lines) ? order.proforma.lines[index] : undefined;
  if (ln && ln.gross != null) return Number(ln.gross) || 0;
  const qty = Number(item?.quantity) || 0;
  const price = linePrice(order, item, index);
  return qty * price;
}

// Build CSV text for an order
export function orderToCSV(order) {
  const headers = [
    "Product Name",
    "Brand",
    "SKU",
    "Qty",
    "Price",
    "Subtotal",
  ];

  const items = Array.isArray(order?.items) ? order.items : [];

  const bodyRows = items.map((item, i) => {
    const name = item.productName || item.name || "";
    const brand = item.brand || "";
    const sku = item.sku || "";
    const qty = Number(item.quantity ?? item.qty ?? 0) || 0;
    const price = linePrice(order, item, i);
    const subtotal = lineSubtotal(order, item, i);

    return [name, brand, sku, qty, price, subtotal];
  });

  const computedSum = bodyRows.reduce((acc, r) => acc + (Number(r[5]) || 0), 0);
  const grandTotal = Number(order?.proforma?.grandTotal ?? computedSum) || 0;

  const metaTop = [
    ["Order ID", order?.id || ""],
    ["Distributor", order?.distributorName || order?.distributorBusinessName || ""],
    ["Retailer", order?.retailerName || order?.retailerBusinessName || ""],
    ["Payment Mode", order?.paymentMode || order?.paymentMethod || ""],
    ["Tax Type", order?.proforma?.taxType || ""],
  ];

  // Assemble CSV lines
  const lines = [];
  // Meta block
  metaTop.forEach((row) => lines.push(`${q(row[0])},${q(row[1])}`));
  if (metaTop.length) lines.push(""); // blank line

  // Header
  lines.push(headers.map(q).join(","));
  // Body
  bodyRows.forEach((r) => lines.push(r.map(q).join(",")));

  // Totals row
  lines.push([q(""), q(""), q(""), q(""), q("Grand Total"), q(grandTotal.toFixed(2))].join(","));

  return lines.join("\n");
}

// Trigger a CSV file download in the browser
export function downloadCSV(filename, csvText) {
  const blob = new Blob([csvText], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename && filename.endsWith(".csv") ? filename : `${filename || "order"}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  // Revoke after a short delay for Safari compatibility
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

// Convenience: export and download in one go
export function exportOrderCSV(order, filename = "order.csv") {
  const csv = orderToCSV(order);
  downloadCSV(filename, csv);
}
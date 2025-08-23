

// src/lib/exporters/excel.js
// Proforma‑aware Excel (XLSX) exporter for orders
// Requires dependency: xlsx
//   npm i xlsx

import * as XLSX from "xlsx";

// Helpers — prefer locked values from order.proforma when available
const linePrice = (order, item, index) => {
  const ln = Array.isArray(order?.proforma?.lines) ? order.proforma.lines[index] : undefined;
  if (ln && ln.price != null) return Number(ln.price) || 0;
  return Number(item?.price) || 0;
};

const lineSubtotal = (order, item, index) => {
  const ln = Array.isArray(order?.proforma?.lines) ? order.proforma.lines[index] : undefined;
  if (ln && ln.gross != null) return Number(ln.gross) || 0;
  const qty = Number(item?.quantity ?? item?.qty ?? 0) || 0;
  const price = linePrice(order, item, index);
  return qty * price;
};

const grandTotal = (order, computed) => {
  if (order?.proforma?.grandTotal != null) return Number(order.proforma.grandTotal) || 0;
  return Number(computed || 0);
};

/**
 * downloadOrderExcel(order, filename?)
 * Creates an .xlsx workbook with:
 *  - Meta sheet (Order, Distributor, Retailer, Payment, Tax Type)
 *  - Items sheet with Price/Subtotal proforma-aware
 *  - Totals row with Grand Total
 */
export function downloadOrderExcel(order, filename = "order.xlsx") {
  const items = Array.isArray(order?.items) ? order.items : [];

  // Sheet 1 — Items
  const itemRows = items.map((item, i) => {
    const price = linePrice(order, item, i);
    const qty = Number(item?.quantity ?? item?.qty ?? 0) || 0;
    const subtotal = lineSubtotal(order, item, i);
    return {
      "Product Name": item.productName || item.name || "",
      Brand: item.brand || "",
      SKU: item.sku || "",
      Qty: qty,
      Price: price,
      Subtotal: subtotal,
    };
  });

  const computedSum = itemRows.reduce((acc, r) => acc + (Number(r.Subtotal) || 0), 0);
  const total = grandTotal(order, computedSum);

  itemRows.push({
    "Product Name": "",
    Brand: "",
    SKU: "",
    Qty: "",
    Price: "Grand Total",
    Subtotal: Number(total || 0),
  });

  const wsItems = XLSX.utils.json_to_sheet(itemRows, { header: [
    "Product Name", "Brand", "SKU", "Qty", "Price", "Subtotal"
  ]});

  // Format some columns as numbers with 2 decimals
  const range = XLSX.utils.decode_range(wsItems['!ref']);
  for (let R = 1; R <= range.e.r; R++) {
    // Qty (col 3), Price (col 4), Subtotal (col 5) — 0-based indexes
    [3, 4, 5].forEach((C) => {
      const cellRef = XLSX.utils.encode_cell({ r: R, c: C });
      const cell = wsItems[cellRef];
      if (cell && typeof cell.v === 'number') {
        cell.t = 'n';
        cell.z = "0.00";
      }
    });
  }

  // Sheet 0 — Meta
  const metaRows = [
    { Field: "Order ID", Value: order?.id || "" },
    { Field: "Distributor", Value: order?.distributorName || order?.distributorBusinessName || "" },
    { Field: "Retailer", Value: order?.retailerName || order?.retailerBusinessName || "" },
    { Field: "Payment Mode", Value: order?.paymentMode || order?.paymentMethod || "" },
    { Field: "Tax Type", Value: order?.proforma?.taxType || "" },
  ];
  const wsMeta = XLSX.utils.json_to_sheet(metaRows, { header: ["Field", "Value"] });

  // Workbook assembly
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, wsMeta, "Meta");
  XLSX.utils.book_append_sheet(wb, wsItems, "Items");

  // File name
  const fname = filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`;
  XLSX.writeFile(wb, fname);
}

// Convenience one-liner
export function exportOrderExcel(order, filename = "order.xlsx") {
  return downloadOrderExcel(order, filename);
}
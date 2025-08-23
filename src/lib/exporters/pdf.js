

// src/lib/exporters/pdf.js
// Proforma‑aware PDF exporter for orders using jsPDF + autoTable
// Requires deps:
//   npm i jspdf jspdf-autotable

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

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

const fmt = (n) => Number(n || 0).toFixed(2);

/**
 * downloadOrderPDF(order, filename?)
 * Renders a simple invoice/proforma style PDF with:
 *  - Header (Distributor, Retailer, Order ID, Payment, Tax Type)
 *  - Items table (Qty, Price, Subtotal) — proforma-aware
 *  - Proforma Summary (if present): charges/discount/taxes/round-off/grand total
 */
export function downloadOrderPDF(order, filename = "order.pdf") {
  const doc = new jsPDF({ unit: "pt", format: "a4" });

  // Margins
  const marginLeft = 40;
  let cursorY = 40;

  // Header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  const distributorTitle = order?.distributorBusinessName || order?.distributorName || "Distributor";
  doc.text(distributorTitle, marginLeft, cursorY);
  cursorY += 18;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const retailerTitle = order?.retailerBusinessName || order?.retailerName || "Retailer";
  const linesHeader = [
    `Order ID: ${order?.id || ""}`,
    `Retailer: ${retailerTitle}`,
    `Payment: ${order?.paymentMode || order?.paymentMethod || "N/A"}`,
    order?.proforma?.taxType ? `Tax Type: ${order.proforma.taxType}` : null,
  ].filter(Boolean);

  linesHeader.forEach((t) => {
    cursorY += 14;
    doc.text(t, marginLeft, cursorY);
  });

  // Items rows
  const items = Array.isArray(order?.items) ? order.items : [];
  const itemRows = items.map((item, i) => {
    const price = linePrice(order, item, i);
    const qty = Number(item?.quantity ?? item?.qty ?? 0) || 0;
    const subtotal = lineSubtotal(order, item, i);
    return [
      item.productName || item.name || "",
      item.brand || "",
      item.sku || "",
      qty,
      fmt(price),
      fmt(subtotal),
    ];
  });

  autoTable(doc, {
    startY: cursorY + 20,
    head: [["Product Name", "Brand", "SKU", "Qty", "Price", "Subtotal"]],
    body: itemRows,
    styles: { fontSize: 9, cellPadding: 4 },
    headStyles: { fillColor: [33, 150, 243] },
    columnStyles: {
      3: { halign: "right" },
      4: { halign: "right" },
      5: { halign: "right" },
    },
    theme: "grid",
    margin: { left: marginLeft, right: marginLeft },
  });

  let afterTableY = (doc.lastAutoTable && doc.lastAutoTable.finalY) || cursorY + 40;

  // Compute totals
  const computedSum = itemRows.reduce((acc, r) => acc + Number(r[5] || 0), 0);
  const total = grandTotal(order, computedSum);

  // Proforma Summary (if exists)
  if (order?.proforma) {
    const p = order.proforma;
    const taxType = p.taxType || "Tax";
    const taxRows = [];
    if (p.taxBreakup?.igst != null) {
      taxRows.push(["IGST", fmt(p.taxBreakup.igst)]);
    } else if (p.taxBreakup) {
      if (p.taxBreakup.cgst != null) taxRows.push(["CGST", fmt(p.taxBreakup.cgst)]);
      if (p.taxBreakup.sgst != null) taxRows.push(["SGST", fmt(p.taxBreakup.sgst)]);
    }

    const summary = [
      ["Sub-Total (pre-charges)", fmt(p.subTotal)],
      ["Delivery", fmt(p.orderCharges?.delivery)],
      ["Packing", fmt(p.orderCharges?.packing)],
      ["Insurance", fmt(p.orderCharges?.insurance)],
      ["Other", fmt(p.orderCharges?.other)],
      ["Order Discount", `- ${fmt(p.discountTotal)}`],
      ["Taxable Base", fmt(p.taxableBase)],
      ...taxRows,
      ["Round Off", fmt(p.roundOff)],
      ["Grand Total", fmt(p.grandTotal)],
    ];

    autoTable(doc, {
      startY: afterTableY + 16,
      head: [["Proforma", "Amount (₹)"]],
      body: summary,
      styles: { fontSize: 9, cellPadding: 4 },
      headStyles: { fillColor: [76, 175, 80] },
      columnStyles: { 1: { halign: "right" } },
      theme: "grid",
      margin: { left: marginLeft, right: marginLeft },
    });

    afterTableY = (doc.lastAutoTable && doc.lastAutoTable.finalY) || afterTableY;
  } else {
    // If no proforma, show computed total
    autoTable(doc, {
      startY: afterTableY + 16,
      head: [["Totals", "Amount (₹)"]],
      body: [["Grand Total", fmt(total)]],
      styles: { fontSize: 9, cellPadding: 4 },
      headStyles: { fillColor: [76, 175, 80] },
      columnStyles: { 1: { halign: "right" } },
      theme: "grid",
      margin: { left: marginLeft, right: marginLeft },
    });

    afterTableY = (doc.lastAutoTable && doc.lastAutoTable.finalY) || afterTableY;
  }

  // Footer note
  const footerY = Math.min(afterTableY + 28, doc.internal.pageSize.getHeight() - 40);
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text("Generated by Flyp — amounts include applicable taxes/charges as per Proforma.", marginLeft, footerY);

  const fname = filename.endsWith(".pdf") ? filename : `${filename}.pdf`;
  doc.save(fname);
}

// Convenience one-liner
export function exportOrderPDF(order, filename = "order.pdf") {
  return downloadOrderPDF(order, filename);
}
// InvoicePDF.jsx
import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: {
    backgroundColor: "#0f172a", // dark background
    padding: 24,
    fontFamily: "Helvetica",
    color: "#fff",
    fontSize: 11,
  },
  headerCard: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#273244",
    backgroundColor: "#0f213a",
    padding: 12,
  },
  row: { flexDirection: "row" },
  between: { flexDirection: "row", justifyContent: "space-between" },
  mt12: { marginTop: 12 },
  mt16: { marginTop: 16 },
  heading: {
    textAlign: "center",
    fontSize: 14,
    fontWeight: 700,
    letterSpacing: 2,
    marginTop: 10,
    marginBottom: 8,
  },
  label: { color: "#9fb0c8" },
  table: {
    marginTop: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#273244",
    overflow: "hidden",
  },
  th: {
    backgroundColor: "#142538",
    color: "#cfe3ff",
    fontWeight: 600,
    paddingVertical: 6,
    paddingHorizontal: 6,
    borderRightWidth: 1,
    borderRightColor: "#273244",
  },
  td: {
    paddingVertical: 6,
    paddingHorizontal: 6,
    borderRightWidth: 1,
    borderRightColor: "#273244",
    borderTopWidth: 1,
    borderTopColor: "#273244",
    whiteSpace: "nowrap",
    wordBreak: "keep-all",
  },
  num: { fontFamily: "Courier", textAlign: "right" },
  right: { textAlign: "right" },
  watermark: {
    position: "absolute",
    top: "38%",
    left: 0,
    right: 0,
    textAlign: "center",
    opacity: 0.08,
    fontSize: 60,
    fontWeight: 800,
    letterSpacing: 10,
  },
  footer: {
    position: "absolute",
    bottom: 18,
    left: 24,
    right: 24,
    borderTopWidth: 1,
    borderTopColor: "#273244",
    paddingTop: 6,
    color: "#9fb0c8",
    textAlign: "right",
    fontSize: 9,
  },
});

const currency = (n) => `₹${(Number(n) || 0).toFixed(2)}`;

export default function InvoicePDF({
  customer = {},
  retailer = {},
  items = [],
  heading = "TAX INVOICE",
  invoiceId = "",
  issuedOn = "",
  now = "",
  totals = {},
  paymentMode = "",
  invoiceType = "",
}) {
  const {
    subtotal = 0,
    rowTax = 0,
    cgstTotal = 0,
    sgstTotal = 0,
    igstTotal = 0,
    grandTotal = 0,
    totalDiscount = 0,
  } = totals;

  return (
    <Document title={`Invoice ${invoiceId}`}>
      <Page size="A4" style={styles.page} wrap>
        {/* Watermark */}
        <Text style={styles.watermark}>FLYP</Text>

        {/* Header */}
        <View style={styles.headerCard}>
          <View style={styles.between}>
            <View>
              <Text style={{ fontSize: 11, fontWeight: 700 }}>
                {heading}
              </Text>
              <Text style={styles.label}>Invoice ID: {invoiceId}</Text>
              <Text style={styles.label}>Issued On: {issuedOn}</Text>
              <Text style={styles.label}>Now: {now}</Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={{ fontWeight: 600 }}>Retailer</Text>
              <Text>{retailer.businessName || "Retailer"}</Text>
              <Text>{retailer.ownerName || ""}</Text>
              <Text>{retailer.phone || ""}</Text>
              <Text>{retailer.email || ""}</Text>
              <Text>{retailer.address || ""}</Text>
              <Text>GSTIN: {retailer.gstNumber || "N/A"}</Text>
              <Text>PAN: {retailer.pan || "N/A"}</Text>
            </View>
          </View>

          <View style={[styles.row, styles.mt12]}>
            <View>
              <Text style={{ fontWeight: 600 }}>Customer</Text>
              <Text>{customer.name || "—"}</Text>
              <Text>{customer.phone || "—"}</Text>
              <Text>{customer.email || "—"}</Text>
              <Text>{customer.address || "—"}</Text>
            </View>
          </View>
        </View>

        <Text style={styles.heading}>{heading}</Text>

        {/* Products Table */}
        <View style={styles.table}>
          <View style={styles.row}>
            <Text style={[styles.th, { width: "20%" }]}>Name</Text>
            <Text style={[styles.th, { width: "10%" }]}>Brand</Text>
            <Text style={[styles.th, { width: "10%" }]}>Category</Text>
            <Text style={[styles.th, { width: "8%" }]}>Unit</Text>
            <Text style={[styles.th, { width: "6%" }, styles.right]} wrap={false}>
              Qty
            </Text>
            <Text style={[styles.th, { width: "12%" }, styles.right]} wrap={false}>
              Unit (Net)
            </Text>
            <Text style={[styles.th, { width: "8%" }, styles.right]} wrap={false}>
              Discount
            </Text>
            <Text style={[styles.th, { width: "10%" }, styles.right]} wrap={false}>Net</Text>
            <Text style={[styles.th, { width: "6%" }, styles.right]} wrap={false}>
              GST%
            </Text>
            <Text style={[styles.th, { width: "10%" }, styles.right]} wrap={false}>
              Tax
            </Text>
            <Text style={[styles.th, { width: "10%" }, styles.right]} wrap={false}>
              Total
            </Text>
          </View>

          {items.map((it, idx) => (
            <View key={idx} style={styles.row}>
              <Text style={[styles.td, { width: "20%" }]}>
                {it.displayName || it.name || "—"}
              </Text>
              <Text style={[styles.td, { width: "10%" }]}>{it.brand || "-"}</Text>
              <Text style={[styles.td, { width: "10%" }]}>
                {it.category || "-"}
              </Text>
              <Text style={[styles.td, { width: "8%" }]}>{it.unit || "-"}</Text>
              <Text style={[styles.td, { width: "6%" }, styles.right, styles.num]} wrap={false}>
                {it.qty || 1}
              </Text>
              <Text
                style={[styles.td, { width: "12%" }, styles.right, styles.num]}
                wrap={false}
              >
                {currency(it.unitPrice || 0)}
              </Text>
              <Text style={[styles.td, { width: "8%" }, styles.right]} wrap={false}>
                {it.discount ? `${it.discount}%` : "—"}
              </Text>
              <Text
                style={[styles.td, { width: "10%" }, styles.right, styles.num]}
                wrap={false}
              >
                {currency(it.net || 0)}
              </Text>
              <Text style={[styles.td, { width: "6%" }, styles.right]} wrap={false}>
                {it.gstRate ? `${it.gstRate}%` : "—"}
              </Text>
              <Text
                style={[styles.td, { width: "10%" }, styles.right, styles.num]}
                wrap={false}
              >
                {currency(it.tax || 0)}
              </Text>
              <Text
                style={[styles.td, { width: "10%" }, styles.right, styles.num]}
                wrap={false}
              >
                {currency(it.total || 0)}
              </Text>
            </View>
          ))}
        </View>

        {/* Summary */}
        <View style={[styles.headerCard, styles.mt16]}>
          <Text style={{ fontWeight: 600, marginBottom: 6 }}>
            Tax Summary
          </Text>
          <View style={styles.between}>
            <Text style={styles.label}>Net Subtotal:</Text>
            <Text>{currency(subtotal)}</Text>
          </View>
          <View style={styles.between}>
            <Text style={styles.label}>Total Discount:</Text>
            <Text>{currency(totalDiscount)}</Text>
          </View>
          <View style={styles.between}>
            <Text style={styles.label}>Total Tax:</Text>
            <Text>{currency(rowTax)}</Text>
          </View>
          {cgstTotal > 0 && (
            <View style={styles.between}>
              <Text style={styles.label}>CGST:</Text>
              <Text>{currency(cgstTotal)}</Text>
            </View>
          )}
          {sgstTotal > 0 && (
            <View style={styles.between}>
              <Text style={styles.label}>SGST:</Text>
              <Text>{currency(sgstTotal)}</Text>
            </View>
          )}
          {igstTotal > 0 && (
            <View style={styles.between}>
              <Text style={styles.label}>IGST:</Text>
              <Text>{currency(igstTotal)}</Text>
            </View>
          )}
          <View style={[styles.between, { marginTop: 6 }]}>
            <Text style={{ fontWeight: 700 }}>Grand Total:</Text>
            <Text style={{ fontWeight: 900 }}>{currency(grandTotal)}</Text>
          </View>
        </View>

        {/* Footer */}
        <Text style={styles.footer}>
          Powered by FLYP • flypnow.com — Page{" "}
          <Text
            render={({ pageNumber, totalPages }) =>
              `${pageNumber} of ${totalPages}`
            }
          />
        </Text>
      </Page>
    </Document>
  );
}

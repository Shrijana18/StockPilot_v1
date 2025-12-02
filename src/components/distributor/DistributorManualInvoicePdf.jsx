import React from "react";
import { Document, Page, Text, View, StyleSheet, Image } from "@react-pdf/renderer";
import { splitFromMrp } from "../../utils/pricing";

/* ---------- Amount in words (Indian system) ---------- */
function amountInWordsIndian(num) {
  try {
    const n = Math.round(Number(num || 0));
    if (!isFinite(n)) return "Zero";
    const a = ["","One","Two","Three","Four","Five","Six","Seven","Eight","Nine","Ten","Eleven","Twelve","Thirteen","Fourteen","Fifteen","Sixteen","Seventeen","Eighteen","Nineteen"]; 
    const b = ["","","Twenty","Thirty","Forty","Fifty","Sixty","Seventy","Eighty","Ninety"]; 
    const u = (s) => s? s+" ":"";
    const two = (num) => num < 20 ? a[num] : (b[Math.floor(num/10)] + (num%10?" "+a[num%10]:""));
    const three = (num) => {
      const h = Math.floor(num/100), rest = num%100;
      return (h? a[h] + " Hundred" + (rest?" ":"") : "") + (rest? two(rest):"");
    }
    let str = "";
    let crore = Math.floor(n/10000000); let rem = n%10000000;
    let lakh = Math.floor(rem/100000); rem = rem%100000;
    let thousand = Math.floor(rem/1000); rem = rem%1000;
    let hundred = rem;
    if (crore) str += u(three(crore)) + "Crore ";
    if (lakh) str += u(three(lakh)) + "Lakh ";
    if (thousand) str += u(three(thousand)) + "Thousand ";
    if (hundred) str += three(hundred);
    return (str.trim() || "Zero");
  } catch { return "Zero"; }
}

const styles = StyleSheet.create({
  page: {
    padding: 30,
    fontSize: 8,
    fontFamily: "Helvetica",
    color: "#111827",
    backgroundColor: "#FFFFFF",
  },
  header: {
    marginBottom: 12,
    paddingBottom: 10,
    borderBottomWidth: 2,
    borderBottomColor: "#E5E7EB",
  },
  heading: {
    fontSize: 20,
    fontWeight: 700,
    marginBottom: 3,
    color: "#111827",
  },
  invoiceMeta: {
    fontSize: 7,
    color: "#6B7280",
    marginTop: 2,
    lineHeight: 1.3,
  },
  sectionTitle: {
    fontSize: 9,
    fontWeight: 700,
    marginBottom: 5,
    textTransform: "uppercase",
    letterSpacing: 0.3,
    color: "#374151",
  },
  card: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 6,
    padding: 8,
    marginBottom: 8,
    backgroundColor: "#FAFAFA",
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },
  infoText: {
    fontSize: 8,
    lineHeight: 1.4,
    color: "#374151",
    marginBottom: 2,
  },
  table: {
    marginTop: 6,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 4,
    overflow: "hidden",
    backgroundColor: "#FFFFFF",
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#F3F4F6",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    alignItems: "center",
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#F3F4F6",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
  },
  th: {
    fontWeight: 700,
    fontSize: 7,
    padding: 4,
    paddingVertical: 6,
    color: "#374151",
    textAlign: "left",
  },
  td: {
    fontSize: 7,
    padding: 4,
    paddingVertical: 4,
    color: "#111827",
    lineHeight: 1.3,
    textAlign: "left",
  },
  tdRight: {
    fontSize: 7,
    padding: 4,
    paddingVertical: 4,
    color: "#111827",
    lineHeight: 1.3,
    textAlign: "right",
  },
  bold: {
    fontWeight: 700,
  },
  breakdownRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 7,
    marginBottom: 2,
    paddingVertical: 1,
  },
  breakdownTotal: {
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 9,
    fontWeight: 700,
    marginTop: 4,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    color: "#111827",
  },
  footer: {
    marginTop: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    textAlign: "center",
    fontSize: 7,
    color: "#6B7280",
  },
  grandTotalBox: {
    backgroundColor: "#ECFDF5",
    borderWidth: 1,
    borderColor: "#10B981",
    borderRadius: 4,
    padding: 8,
    marginTop: 8,
  },
  taxSummary: {
    marginTop: 8,
    padding: 8,
    backgroundColor: "#FAFAFA",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 4,
  },
  taxSummaryTitle: {
    fontSize: 10,
    fontWeight: 700,
    marginBottom: 6,
    color: "#111827",
  },
  taxSummaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 3,
    fontSize: 8,
  },
  taxSummaryTotal: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 4,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: "#D1D5DB",
    fontSize: 10,
    fontWeight: 700,
  },
  twoColumn: {
    flexDirection: "row",
    gap: 8,
  },
  column: {
    flex: 1,
  },
});

const currency = (value) =>
  `₹${Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const toDate = (value) => {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === "number") return new Date(value);
  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (value?.seconds) return new Date(value.seconds * 1000);
  if (value?.toDate) return value.toDate();
  return null;
};

const formatDate = (value) => {
  const d = toDate(value);
  return d
    ? d.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "N/A";
};

const formatDateTime = (value) => {
  const d = toDate(value);
  return d
    ? d.toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "N/A";
};

const getDisplayBasePrice = (item) => {
  const pricingMode = item.pricingMode || "LEGACY";
  const basePrice = Number(item.basePrice || 0);
  const mrp = Number(item.mrp || 0);
  const sellingPrice = Number(item.sellingPrice || item.price || item.unitPrice || 0);
  const gstRate = Number(item.gstRate || item.taxRate || 0);

  if (pricingMode === "MRP_INCLUSIVE") {
    if (mrp > 0 && gstRate > 0) {
      const split = splitFromMrp(mrp, gstRate);
      return split.base;
    }
    return mrp || sellingPrice;
  }
  if (pricingMode === "SELLING_PRICE" || pricingMode === "BASE_PLUS_GST") {
    if (sellingPrice > 0 && gstRate > 0) {
      const split = splitFromMrp(sellingPrice, gstRate);
      return split.base;
    }
    return sellingPrice;
  }
  if (pricingMode === "BASE_PLUS_TAX") {
    if (basePrice > 0) return basePrice;
    if (sellingPrice > 0 && gstRate > 0) {
      const split = splitFromMrp(sellingPrice, gstRate);
      return split.base;
    }
    return sellingPrice;
  }
  return basePrice || sellingPrice;
};

const DistributorManualInvoicePdf = ({ invoice = {} }) => {
  const items = Array.isArray(invoice.items) 
    ? invoice.items 
    : Array.isArray(invoice.cartItems) 
    ? invoice.cartItems 
    : [];
  const totals = invoice.totals || {};
  
  // Calculate tax totals from items if taxBreakup is missing or incorrect
  const useIGST = totals.taxType === "IGST";
  let calculatedCgst = 0;
  let calculatedSgst = 0;
  let calculatedIgst = 0;
  let calculatedTotalTax = 0;
  let calculatedSubtotal = 0;
  let calculatedTotalDiscount = 0;
  
  items.forEach((item) => {
    const qty = Number(item.quantity || item.qty || 1);
    const price = Number(item.sellingPrice || item.price || item.unitPrice || 0);
    const gstRate = Number(item.gstRate || item.taxRate || 0);
    const basePrice = getDisplayBasePrice(item);
    const discPct = Number(item.discount || item.discountPct || 0);
    const discAmt = Number(item.discountAmount || 0);
    const unitNet = basePrice;
    const unitDiscount = discAmt > 0 ? discAmt / qty : unitNet * (discPct / 100);
    const netSubtotal = (unitNet - unitDiscount) * qty;
    const taxAmt = netSubtotal * (gstRate / 100);
    
    calculatedSubtotal += netSubtotal;
    calculatedTotalDiscount += discAmt > 0 ? discAmt : unitNet * qty * (discPct / 100);
    calculatedTotalTax += taxAmt;
    
    if (useIGST) {
      calculatedIgst += taxAmt;
    } else {
      calculatedCgst += taxAmt / 2;
      calculatedSgst += taxAmt / 2;
    }
  });
  
  // Use calculated values if taxBreakup is missing or totals are 0
  const finalCgst = totals.taxBreakup?.cgst > 0 ? totals.taxBreakup.cgst : calculatedCgst;
  const finalSgst = totals.taxBreakup?.sgst > 0 ? totals.taxBreakup.sgst : calculatedSgst;
  const finalIgst = totals.taxBreakup?.igst > 0 ? totals.taxBreakup.igst : calculatedIgst;
  const finalTotalTax = finalCgst + finalSgst + finalIgst;
  const finalSubtotal = totals.itemsSubTotal || totals.taxableBase || calculatedSubtotal;
  const finalTotalDiscount = totals.lineDiscountTotal || totals.discountTotal || calculatedTotalDiscount;
  
  // Determine payment status
  let paymentStatus = "Pending";
  const paymentObj = invoice.payment || {};
  if (typeof paymentObj.isPaid === "boolean") {
    paymentStatus = paymentObj.isPaid ? "Paid" : "Pending";
  } else {
    const raw = paymentObj.status || invoice.paymentStatus || invoice.isPaid;
    if (raw === true || raw === "Paid" || raw === "paid") {
      paymentStatus = "Paid";
    } else if (raw === false || raw === "Pending" || raw === "pending") {
      paymentStatus = "Pending";
    }
  }

  return (
    <Document title={invoice.invoiceNumber || invoice.id || "Invoice"}>
      <Page size="A4" style={styles.page} wrap>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.heading}>TAX INVOICE</Text>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.invoiceMeta}>
                <Text style={styles.bold}>Invoice No: </Text>
                {invoice.invoiceNumber || invoice.invoiceId || invoice.id || "N/A"}
              </Text>
              <Text style={styles.invoiceMeta}>
                <Text style={styles.bold}>Date: </Text>
                {formatDate(invoice.issuedAt || invoice.createdAt)}
              </Text>
              <Text style={styles.invoiceMeta}>
                <Text style={styles.bold}>Status: </Text>
                {paymentStatus}
              </Text>
            </View>
            <View style={{ flex: 1, alignItems: "flex-end" }}>
              <View style={styles.grandTotalBox}>
                <Text style={[styles.sectionTitle, { fontSize: 8, marginBottom: 4 }]}>Grand Total</Text>
                <Text style={[styles.infoText, styles.bold, { fontSize: 16, color: "#059669" }]}>
                  {currency(totals.grandTotal || invoice.totalAmount || 0)}
                </Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.row}>
          <View style={[styles.card, { flex: 1 }]}>
            <Text style={styles.sectionTitle}>Bill To (Buyer)</Text>
            <Text style={styles.infoText}>{invoice.buyer?.businessName || invoice.customer?.name || invoice.customer?.businessName || "N/A"}</Text>
            {(invoice.buyer?.email || invoice.customer?.email) && (
              <Text style={styles.infoText}>Email: {invoice.buyer?.email || invoice.customer?.email}</Text>
            )}
            {(invoice.buyer?.phone || invoice.customer?.phone) && (
              <Text style={styles.infoText}>Phone: {invoice.buyer?.phone || invoice.customer?.phone}</Text>
            )}
            {((invoice.buyer?.city || invoice.customer?.city) || (invoice.buyer?.state || invoice.customer?.state)) && (
              <Text style={styles.infoText}>
                {[
                  invoice.buyer?.city || invoice.customer?.city,
                  invoice.buyer?.state || invoice.customer?.state
                ].filter(Boolean).join(", ")}
              </Text>
            )}
            {(invoice.buyer?.address || invoice.customer?.address) && (
              <Text style={styles.infoText}>{invoice.buyer?.address || invoice.customer?.address}</Text>
            )}
          </View>
          <View style={[styles.card, { flex: 1 }]}>
            <Text style={styles.sectionTitle}>Sold By (Seller)</Text>
            <Text style={styles.infoText}>{invoice.seller?.businessName || "N/A"}</Text>
            {invoice.seller?.email && <Text style={styles.infoText}>Email: {invoice.seller.email}</Text>}
            {invoice.seller?.phone && <Text style={styles.infoText}>Phone: {invoice.seller.phone}</Text>}
            {invoice.seller?.gstNumber && <Text style={styles.infoText}>GST: {invoice.seller.gstNumber}</Text>}
            {(invoice.seller?.city || invoice.seller?.state) && (
              <Text style={styles.infoText}>
                {[invoice.seller?.city, invoice.seller?.state].filter(Boolean).join(", ")}
              </Text>
            )}
            {invoice.seller?.address && (
              <Text style={styles.infoText}>{invoice.seller.address}</Text>
            )}
          </View>
        </View>

        {/* Products Table */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>PRODUCTS</Text>
          {items.length === 0 ? (
            <Text style={styles.infoText}>No items available.</Text>
          ) : (
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={[styles.th, { flex: 2.8 }]}>Name</Text>
                <Text style={[styles.th, { flex: 1.0 }]}>Unit</Text>
                <Text style={[styles.th, { flex: 0.6, textAlign: "right" }]}>Qty</Text>
                <Text style={[styles.th, { flex: 1.2, textAlign: "right" }]}>Unit (Net)</Text>
                <Text style={[styles.th, { flex: 0.8, textAlign: "right" }]}>Discount</Text>
                <Text style={[styles.th, { flex: 1.0, textAlign: "right" }]}>Net</Text>
                <Text style={[styles.th, { flex: 0.8, textAlign: "right" }]}>GST %</Text>
                <Text style={[styles.th, { flex: 0.8, textAlign: "right" }]}>Tax</Text>
                <Text style={[styles.th, { flex: 1.0, textAlign: "right" }]}>Total</Text>
              </View>
              {items.map((item, idx) => {
                const qty = Number(item.quantity || item.qty || 1);
                const price = Number(item.sellingPrice || item.price || item.unitPrice || 0);
                const gstRate = Number(item.gstRate || item.taxRate || 0);
                const basePrice = getDisplayBasePrice(item);
                const discPct = Number(item.discount || item.discountPct || 0);
                const discAmt = Number(item.discountAmount || 0);
                const unitNet = basePrice;
                const unitDiscount = discAmt > 0 ? discAmt / qty : unitNet * (discPct / 100);
                const netSubtotal = (unitNet - unitDiscount) * qty;
                const taxAmt = netSubtotal * (gstRate / 100);
                const lineTotal = netSubtotal + taxAmt;
                const useIGST = totals.taxType === "IGST";
                const cgstPct = useIGST ? 0 : gstRate / 2;
                const sgstPct = useIGST ? 0 : gstRate / 2;
                const cgstAmt = useIGST ? 0 : taxAmt / 2;
                const sgstAmt = useIGST ? 0 : taxAmt / 2;
                const igstAmt = useIGST ? taxAmt : 0;
                return (
                  <React.Fragment key={idx}>
                    <View style={styles.tableRow}>
                      <Text style={[styles.td, { flex: 2.8 }]}>
                        {item.productName || item.name || "N/A"}
                      </Text>
                      <Text style={[styles.td, { flex: 1.0 }]}>{item.unit || item.packSize || "—"}</Text>
                      <Text style={[styles.tdRight, { flex: 0.6 }]}>{qty}</Text>
                      <Text style={[styles.tdRight, { flex: 1.2 }]}>{currency(unitNet)}</Text>
                      <Text style={[styles.tdRight, { flex: 0.8 }]}>
                        {discAmt > 0 ? currency(discAmt) : (discPct > 0 ? `${discPct}%` : "—")}
                      </Text>
                      <Text style={[styles.tdRight, { flex: 1.0 }]}>{currency(netSubtotal)}</Text>
                      <Text style={[styles.tdRight, { flex: 0.8 }]}>{gstRate > 0 ? `${gstRate.toFixed(2).replace(/\.00$/, "")}%` : "—"}</Text>
                      <Text style={[styles.tdRight, { flex: 0.8 }]}>{currency(taxAmt)}</Text>
                      <Text style={[styles.tdRight, { flex: 1.0 }]}>{currency(lineTotal)}</Text>
                    </View>
                    {/* Tax breakdown row */}
                    <View style={[styles.tableRow, { backgroundColor: "#F9FAFB", paddingVertical: 2 }]}>
                      <Text style={[styles.td, { flex: 2.8, fontSize: 6, color: "#6B7280" }]}></Text>
                      <Text style={[styles.td, { flex: 1.0, fontSize: 6, color: "#6B7280" }]}></Text>
                      <Text style={[styles.tdRight, { flex: 6.2, fontSize: 6, color: "#6B7280" }]}>
                        {useIGST ? (
                          `IGST ${cgstPct.toFixed(2).replace(/\.00$/, "")}% = ${currency(igstAmt)}`
                        ) : (
                          `CGST ${cgstPct.toFixed(2).replace(/\.00$/, "")}% = ${currency(cgstAmt)} • SGST ${sgstPct.toFixed(2).replace(/\.00$/, "")}% = ${currency(sgstAmt)}`
                        )}
                      </Text>
                    </View>
                  </React.Fragment>
                );
              })}
            </View>
          )}
        </View>

        {/* Tax Summary - Matching Digital Preview */}
        <View style={styles.taxSummary}>
          <Text style={styles.taxSummaryTitle}>Tax Summary</Text>
          <View style={{ alignItems: "flex-end" }}>
            <View style={styles.taxSummaryRow}>
              <Text style={{ fontSize: 8, color: "#6B7280", marginRight: 12 }}>Net Subtotal:</Text>
              <Text style={{ fontSize: 8 }}>{currency(finalSubtotal)}</Text>
            </View>
            <View style={styles.taxSummaryRow}>
              <Text style={{ fontSize: 8, color: "#6B7280", marginRight: 12 }}>Total Discount:</Text>
              <Text style={{ fontSize: 8 }}>{currency(finalTotalDiscount)}</Text>
            </View>
            <View style={styles.taxSummaryRow}>
              <Text style={{ fontSize: 8, color: "#6B7280", marginRight: 12 }}>Total Tax:</Text>
              <Text style={{ fontSize: 8 }}>{currency(finalTotalTax)}</Text>
            </View>
            {finalCgst > 0 && (
              <View style={styles.taxSummaryRow}>
                <Text style={{ fontSize: 8, color: "#6B7280", marginRight: 12 }}>CGST:</Text>
                <Text style={{ fontSize: 8 }}>{currency(finalCgst)}</Text>
              </View>
            )}
            {finalSgst > 0 && (
              <View style={styles.taxSummaryRow}>
                <Text style={{ fontSize: 8, color: "#6B7280", marginRight: 12 }}>SGST:</Text>
                <Text style={{ fontSize: 8 }}>{currency(finalSgst)}</Text>
              </View>
            )}
            {finalIgst > 0 && (
              <View style={styles.taxSummaryRow}>
                <Text style={{ fontSize: 8, color: "#6B7280", marginRight: 12 }}>IGST:</Text>
                <Text style={{ fontSize: 8 }}>{currency(finalIgst)}</Text>
              </View>
            )}
            {(totals.delivery || totals.orderCharges?.delivery || 0) > 0 && (
              <View style={styles.taxSummaryRow}>
                <Text style={{ fontSize: 8, color: "#6B7280", marginRight: 12 }}>Delivery:</Text>
                <Text style={{ fontSize: 8 }}>{currency(totals.delivery || totals.orderCharges?.delivery || 0)}</Text>
              </View>
            )}
            {(totals.packing || totals.orderCharges?.packing || 0) > 0 && (
              <View style={styles.taxSummaryRow}>
                <Text style={{ fontSize: 8, color: "#6B7280", marginRight: 12 }}>Packing:</Text>
                <Text style={{ fontSize: 8 }}>{currency(totals.packing || totals.orderCharges?.packing || 0)}</Text>
              </View>
            )}
            {(totals.insurance || totals.orderCharges?.insurance || 0) > 0 && (
              <View style={styles.taxSummaryRow}>
                <Text style={{ fontSize: 8, color: "#6B7280", marginRight: 12 }}>Insurance:</Text>
                <Text style={{ fontSize: 8 }}>{currency(totals.insurance || totals.orderCharges?.insurance || 0)}</Text>
              </View>
            )}
            {(totals.other || totals.orderCharges?.other || 0) > 0 && (
              <View style={styles.taxSummaryRow}>
                <Text style={{ fontSize: 8, color: "#6B7280", marginRight: 12 }}>Other:</Text>
                <Text style={{ fontSize: 8 }}>{currency(totals.other || totals.orderCharges?.other || 0)}</Text>
              </View>
            )}
            <View style={{ height: 1, backgroundColor: "#D1D5DB", marginVertical: 4, width: "100%" }}></View>
            <View style={styles.taxSummaryTotal}>
              <Text style={{ fontSize: 10, fontWeight: 700 }}>Grand Total:</Text>
              <Text style={{ fontSize: 12, fontWeight: 700, color: "#059669" }}>
                {currency(totals.grandTotal || invoice.totalAmount || 0)}
              </Text>
            </View>
          </View>
          <Text style={{ fontSize: 7, color: "#6B7280", marginTop: 6 }}>
            Payment Mode: {(invoice.payment?.mode || invoice.paymentMode || "N/A").toUpperCase()} | Invoice Type: {(invoice.invoiceType || "Tax").charAt(0).toUpperCase() + (invoice.invoiceType || "Tax").slice(1)}
          </Text>
          {paymentStatus === "Paid" && invoice.payment?.paidOn && (
            <Text style={{ fontSize: 7, color: "#10B981", marginTop: 2 }}>
              ✅ Paid on: {formatDate(invoice.payment.paidOn)} via {(invoice.payment.paidVia || invoice.paidVia || "").toUpperCase()}
            </Text>
          )}
        </View>

        {/* Bank Details + UPI */}
        <View style={[styles.row, { marginTop: 8 }]}>
          <View style={[styles.card, { flex: 1, marginRight: 4 }]}>
            <Text style={styles.sectionTitle}>Bank Details</Text>
            <Text style={styles.infoText}>
              {invoice.seller?.bank?.bankName || invoice.bank?.bankName || "Bank"}
              {invoice.seller?.bank?.branch || invoice.bank?.branch ? ` — ${invoice.seller?.bank?.branch || invoice.bank?.branch}` : ""}
            </Text>
            {(invoice.seller?.bank?.accountNumber || invoice.bank?.accountNumber) && (
              <Text style={styles.infoText}>Account: {invoice.seller?.bank?.accountNumber || invoice.bank?.accountNumber}</Text>
            )}
            {(invoice.seller?.bank?.ifsc || invoice.bank?.ifsc) && (
              <Text style={styles.infoText}>IFSC: {invoice.seller?.bank?.ifsc || invoice.bank?.ifsc}</Text>
            )}
            {(invoice.seller?.bank?.accountName || invoice.bank?.accountName) && (
              <Text style={styles.infoText}>Name: {invoice.seller?.bank?.accountName || invoice.bank?.accountName}</Text>
            )}
          </View>
          <View style={[styles.card, { flex: 1, marginLeft: 4 }]}>
            <Text style={styles.sectionTitle}>UPI</Text>
            <Text style={styles.infoText}>{invoice.seller?.payment?.upiId || invoice.payment?.upiId || "—"}</Text>
          </View>
        </View>

        {/* Amount in Words + Authorized Signatory */}
        <View style={[styles.row, { marginTop: 8 }]}>
          <View style={[styles.card, { flex: 1, marginRight: 4 }]}>
            <Text style={[styles.sectionTitle, { fontSize: 8, marginBottom: 4 }]}>Amount in Words</Text>
            <Text style={[styles.infoText, { fontSize: 9, fontWeight: 500 }]}>
              Rupees {amountInWordsIndian(totals.grandTotal || invoice.totalAmount || 0)} Only
            </Text>
          </View>
          <View style={[styles.card, { flex: 1, marginLeft: 4 }]}>
            <Text style={[styles.sectionTitle, { fontSize: 8, marginBottom: 4 }]}>Authorized Signatory</Text>
            <View style={{ height: 20, borderBottomWidth: 1, borderBottomColor: "#D1D5DB", marginBottom: 4 }}></View>
            <Text style={[styles.infoText, { fontSize: 7, color: "#6B7280" }]}>Seal & Signature</Text>
          </View>
        </View>

        {/* Footer */}
        <View style={{ marginTop: 12, paddingTop: 8, borderTopWidth: 1, borderTopColor: "#E5E7EB", flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Image 
              src="/assets/flyp_logo.png" 
              style={{ width: 24, height: 24, opacity: 0.8 }}
              cache={false}
            />
            <Text style={styles.footer}>Powered by FLYP</Text>
          </View>
          <Text style={[styles.footer, { fontStyle: "italic" }]}>Thank you for your business!</Text>
        </View>
      </Page>
    </Document>
  );
};

export default DistributorManualInvoicePdf;


import React from "react";
import { Document, Page, Text, View, StyleSheet, Image } from "@react-pdf/renderer";

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

// Calculate line totals from invoice items
const calculateLineTotals = (item) => {
  const qty = Number(item.quantity || item.qty || 1);
  const price = Number(item.price || item.unitPrice || item.sellingPrice || 0);
  const gstRate = Number(item.gstRate || item.taxRate || item.inlineGstRate || 0);
  const discPct = Number(item.discount || item.discountPct || 0);
  const discAmt = Number(item.discountAmount || 0);
  
  // Calculate unit net (base price)
  let unitNet = price;
  if (item.normalized && (item.pricingMode === "MRP_INCLUSIVE" || item.pricingMode === "BASE_PLUS_GST")) {
    unitNet = Number(item.normalized.unitPriceNet || price);
  }
  
  // Calculate discount
  const unitDiscount = discAmt > 0 ? discAmt / qty : unitNet * (discPct / 100);
  const netSubtotal = (unitNet - unitDiscount) * qty;
  const taxAmt = netSubtotal * (gstRate / 100);
  const lineTotal = netSubtotal + taxAmt;
  
  return {
    unitNet,
    unitDiscount,
    netSubtotal,
    taxAmt,
    lineTotal,
    qty,
    gstRate,
    discPct,
    discAmt,
  };
};

// Determine if IGST should be used (different states)
const determineIGST = (customer = {}, retailer = {}) => {
  const customerState = (customer.state || "").toUpperCase().trim();
  const retailerState = (retailer.state || "").toUpperCase().trim();
  return customerState && retailerState && customerState !== retailerState;
};

const RetailerInvoicePdf = ({ invoice = {}, userInfo = {}, billingSettings = {} }) => {
  const items = Array.isArray(invoice.cartItems) ? invoice.cartItems : [];
  const customer = invoice.customer || {};
  const retailer = userInfo || {};
  
  // Calculate totals from items
  let subtotal = 0;
  let totalTax = 0;
  let totalDiscount = 0;
  let cgstTotal = 0;
  let sgstTotal = 0;
  let igstTotal = 0;
  
  const useIGST = determineIGST(customer, retailer);
  
  items.forEach((item) => {
    const line = calculateLineTotals(item);
    subtotal += line.netSubtotal;
    totalTax += line.taxAmt;
    totalDiscount += line.discAmt > 0 ? line.discAmt : line.unitNet * line.qty * (line.discPct / 100);
    
    if (useIGST) {
      igstTotal += line.taxAmt;
    } else {
      cgstTotal += line.taxAmt / 2;
      sgstTotal += line.taxAmt / 2;
    }
  });
  
  // Add extra charges
  const deliveryFee = Number(invoice.settings?.deliveryFee || invoice.deliveryFee || 0);
  const packagingFee = Number(invoice.settings?.packagingFee || invoice.packagingFee || 0);
  const otherCharge = Number(invoice.settings?.otherCharge || 0);
  const insuranceCharge = Number(invoice.settings?.insuranceValue || invoice.insuranceValue || 0);
  const chargesTotal = deliveryFee + packagingFee + otherCharge + insuranceCharge;
  
  const grandTotal = subtotal + totalTax + chargesTotal;
  
  // Payment status
  const isPaid = invoice.isPaid || invoice.settings?.isPaid || false;
  const paymentMode = (invoice.paymentMode || invoice.settings?.paymentMode || "CASH").toUpperCase();
  const invoiceType = (invoice.invoiceType || "Tax").charAt(0).toUpperCase() + (invoice.invoiceType || "Tax").slice(1);
  
  // Format invoice date
  const invoiceDate = formatDate(invoice.createdAt || invoice.issuedAt);
  
  // Bank and payment details from billing settings
  const bank = billingSettings.bank || {};
  const payment = billingSettings.payment || {};

  return (
    <Document title={invoice.id || "Invoice"}>
      <Page size="A4" style={styles.page} wrap>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.heading}>TAX INVOICE</Text>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.invoiceMeta}>
                <Text style={styles.bold}>Invoice No: </Text>
                {invoice.id || "N/A"}
              </Text>
              <Text style={styles.invoiceMeta}>
                <Text style={styles.bold}>Date: </Text>
                {invoiceDate}
              </Text>
              <Text style={styles.invoiceMeta}>
                <Text style={styles.bold}>Status: </Text>
                {isPaid ? "Paid" : "Pending"}
              </Text>
            </View>
            <View style={{ flex: 1, alignItems: "flex-end" }}>
              <View style={styles.grandTotalBox}>
                <Text style={[styles.sectionTitle, { fontSize: 8, marginBottom: 4 }]}>Grand Total</Text>
                <Text style={[styles.infoText, styles.bold, { fontSize: 16, color: "#059669" }]}>
                  {currency(grandTotal)}
                </Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.row}>
          <View style={[styles.card, { flex: 1 }]}>
            <Text style={styles.sectionTitle}>Bill To (Customer)</Text>
            <Text style={styles.infoText}>{customer.name || customer.businessName || "N/A"}</Text>
            {customer.email && <Text style={styles.infoText}>Email: {customer.email}</Text>}
            {customer.phone && <Text style={styles.infoText}>Phone: {customer.phone}</Text>}
            {(customer.city || customer.state) && (
              <Text style={styles.infoText}>
                {[customer.city, customer.state].filter(Boolean).join(", ")}
              </Text>
            )}
            {customer.address && <Text style={styles.infoText}>{customer.address}</Text>}
          </View>
          <View style={[styles.card, { flex: 1 }]}>
            <Text style={styles.sectionTitle}>Sold By (Retailer)</Text>
            <Text style={styles.infoText}>{retailer.businessName || retailer.name || "N/A"}</Text>
            {retailer.email && <Text style={styles.infoText}>Email: {retailer.email}</Text>}
            {retailer.phone && <Text style={styles.infoText}>Phone: {retailer.phone}</Text>}
            {retailer.gstNumber && <Text style={styles.infoText}>GST: {retailer.gstNumber}</Text>}
            {(retailer.city || retailer.state) && (
              <Text style={styles.infoText}>
                {[retailer.city, retailer.state].filter(Boolean).join(", ")}
              </Text>
            )}
            {retailer.address && <Text style={styles.infoText}>{retailer.address}</Text>}
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
                const line = calculateLineTotals(item);
                const useIGSTLine = determineIGST(customer, retailer);
                const cgstPct = useIGSTLine ? 0 : line.gstRate / 2;
                const sgstPct = useIGSTLine ? 0 : line.gstRate / 2;
                const cgstAmt = useIGSTLine ? 0 : line.taxAmt / 2;
                const sgstAmt = useIGSTLine ? 0 : line.taxAmt / 2;
                const igstAmt = useIGSTLine ? line.taxAmt : 0;
                
                return (
                  <React.Fragment key={idx}>
                    <View style={styles.tableRow}>
                      <Text style={[styles.td, { flex: 2.8 }]}>
                        {item.name || item.productName || item.displayName || "N/A"}
                      </Text>
                      <Text style={[styles.td, { flex: 1.0 }]}>{item.unit || item.packSize || "—"}</Text>
                      <Text style={[styles.tdRight, { flex: 0.6 }]}>{line.qty}</Text>
                      <Text style={[styles.tdRight, { flex: 1.2 }]}>{currency(line.unitNet)}</Text>
                      <Text style={[styles.tdRight, { flex: 0.8 }]}>
                        {line.discAmt > 0 ? currency(line.discAmt) : (line.discPct > 0 ? `${line.discPct}%` : "—")}
                      </Text>
                      <Text style={[styles.tdRight, { flex: 1.0 }]}>{currency(line.netSubtotal)}</Text>
                      <Text style={[styles.tdRight, { flex: 0.8 }]}>{line.gstRate > 0 ? `${line.gstRate.toFixed(2).replace(/\.00$/, "")}%` : "—"}</Text>
                      <Text style={[styles.tdRight, { flex: 0.8 }]}>{currency(line.taxAmt)}</Text>
                      <Text style={[styles.tdRight, { flex: 1.0 }]}>{currency(line.lineTotal)}</Text>
                    </View>
                    {/* Tax breakdown row */}
                    <View style={[styles.tableRow, { backgroundColor: "#F9FAFB", paddingVertical: 2 }]}>
                      <Text style={[styles.td, { flex: 2.8, fontSize: 6, color: "#6B7280" }]}></Text>
                      <Text style={[styles.td, { flex: 1.0, fontSize: 6, color: "#6B7280" }]}></Text>
                      <Text style={[styles.tdRight, { flex: 6.2, fontSize: 6, color: "#6B7280" }]}>
                        {useIGSTLine ? (
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

        {/* Tax Summary */}
        <View style={styles.taxSummary}>
          <Text style={styles.taxSummaryTitle}>Tax Summary</Text>
          <View style={{ alignItems: "flex-end" }}>
            <View style={styles.taxSummaryRow}>
              <Text style={{ fontSize: 8, color: "#6B7280", marginRight: 12 }}>Net Subtotal:</Text>
              <Text style={{ fontSize: 8 }}>{currency(subtotal)}</Text>
            </View>
            <View style={styles.taxSummaryRow}>
              <Text style={{ fontSize: 8, color: "#6B7280", marginRight: 12 }}>Total Discount:</Text>
              <Text style={{ fontSize: 8 }}>{currency(totalDiscount)}</Text>
            </View>
            <View style={styles.taxSummaryRow}>
              <Text style={{ fontSize: 8, color: "#6B7280", marginRight: 12 }}>Total Tax:</Text>
              <Text style={{ fontSize: 8 }}>{currency(totalTax)}</Text>
            </View>
            {cgstTotal > 0 && (
              <View style={styles.taxSummaryRow}>
                <Text style={{ fontSize: 8, color: "#6B7280", marginRight: 12 }}>CGST:</Text>
                <Text style={{ fontSize: 8 }}>{currency(cgstTotal)}</Text>
              </View>
            )}
            {sgstTotal > 0 && (
              <View style={styles.taxSummaryRow}>
                <Text style={{ fontSize: 8, color: "#6B7280", marginRight: 12 }}>SGST:</Text>
                <Text style={{ fontSize: 8 }}>{currency(sgstTotal)}</Text>
              </View>
            )}
            {igstTotal > 0 && (
              <View style={styles.taxSummaryRow}>
                <Text style={{ fontSize: 8, color: "#6B7280", marginRight: 12 }}>IGST:</Text>
                <Text style={{ fontSize: 8 }}>{currency(igstTotal)}</Text>
              </View>
            )}
            {deliveryFee > 0 && (
              <View style={styles.taxSummaryRow}>
                <Text style={{ fontSize: 8, color: "#6B7280", marginRight: 12 }}>Delivery:</Text>
                <Text style={{ fontSize: 8 }}>{currency(deliveryFee)}</Text>
              </View>
            )}
            {packagingFee > 0 && (
              <View style={styles.taxSummaryRow}>
                <Text style={{ fontSize: 8, color: "#6B7280", marginRight: 12 }}>Packing:</Text>
                <Text style={{ fontSize: 8 }}>{currency(packagingFee)}</Text>
              </View>
            )}
            {insuranceCharge > 0 && (
              <View style={styles.taxSummaryRow}>
                <Text style={{ fontSize: 8, color: "#6B7280", marginRight: 12 }}>Insurance:</Text>
                <Text style={{ fontSize: 8 }}>{currency(insuranceCharge)}</Text>
              </View>
            )}
            {otherCharge > 0 && (
              <View style={styles.taxSummaryRow}>
                <Text style={{ fontSize: 8, color: "#6B7280", marginRight: 12 }}>Other:</Text>
                <Text style={{ fontSize: 8 }}>{currency(otherCharge)}</Text>
              </View>
            )}
            <View style={{ height: 1, backgroundColor: "#D1D5DB", marginVertical: 4, width: "100%" }}></View>
            <View style={styles.taxSummaryTotal}>
              <Text style={{ fontSize: 10, fontWeight: 700 }}>Grand Total:</Text>
              <Text style={{ fontSize: 12, fontWeight: 700, color: "#059669" }}>
                {currency(grandTotal)}
              </Text>
            </View>
          </View>
          <Text style={{ fontSize: 7, color: "#6B7280", marginTop: 6 }}>
            Payment Mode: {paymentMode} | Invoice Type: {invoiceType}
          </Text>
          {isPaid && invoice.settings?.paidOn && (
            <Text style={{ fontSize: 7, color: "#10B981", marginTop: 2 }}>
              ✅ Paid on: {formatDate(invoice.settings.paidOn)} via {(invoice.settings.paidVia || invoice.paidVia || "").toUpperCase()}
            </Text>
          )}
        </View>

        {/* Bank Details + UPI */}
        <View style={[styles.row, { marginTop: 8 }]}>
          <View style={[styles.card, { flex: 1, marginRight: 4 }]}>
            <Text style={styles.sectionTitle}>Bank Details</Text>
            <Text style={styles.infoText}>
              {bank.bankName || "Bank"}
              {bank.branch ? ` — ${bank.branch}` : ""}
            </Text>
            {bank.accountNumber && (
              <Text style={styles.infoText}>Account: {bank.accountNumber}</Text>
            )}
            {bank.ifsc && (
              <Text style={styles.infoText}>IFSC: {bank.ifsc}</Text>
            )}
            {bank.accountName && (
              <Text style={styles.infoText}>Name: {bank.accountName}</Text>
            )}
          </View>
          <View style={[styles.card, { flex: 1, marginLeft: 4 }]}>
            <Text style={styles.sectionTitle}>UPI</Text>
            <Text style={styles.infoText}>{payment.upiId || "—"}</Text>
          </View>
        </View>

        {/* Amount in Words + Authorized Signatory */}
        <View style={[styles.row, { marginTop: 8 }]}>
          <View style={[styles.card, { flex: 1, marginRight: 4 }]}>
            <Text style={[styles.sectionTitle, { fontSize: 8, marginBottom: 4 }]}>Amount in Words</Text>
            <Text style={[styles.infoText, { fontSize: 9, fontWeight: 500 }]}>
              Rupees {amountInWordsIndian(grandTotal)} Only
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

export default RetailerInvoicePdf;


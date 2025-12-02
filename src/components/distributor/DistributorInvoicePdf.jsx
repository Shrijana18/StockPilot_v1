import React from "react";
import { Document, Page, Text, View, StyleSheet, Image } from "@react-pdf/renderer";
import { splitFromMrp } from "../../utils/pricing";

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
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#F3F4F6",
    backgroundColor: "#FFFFFF",
  },
  th: {
    fontWeight: 700,
    fontSize: 7,
    padding: 4,
    color: "#374151",
  },
  td: {
    fontSize: 7,
    padding: 4,
    color: "#111827",
    lineHeight: 1.3,
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

const getDisplayBasePrice = (order, idx, item) => {
  const pricingMode = item.pricingMode || "LEGACY";
  const basePrice = Number(item.basePrice || 0);
  const mrp = Number(item.mrp || 0);
  const sellingPrice = Number(item.sellingPrice || item.price || item.unitPrice || 0);
  const baseGstRate = Number(item.gstRate || item.taxRate || 0);
  const pLine = Array.isArray(order?.proforma?.lines) ? order.proforma.lines[idx] : undefined;
  const lineGstRate = pLine?.gstRate !== undefined ? Number(pLine.gstRate) : baseGstRate;

  if (pricingMode === "MRP_INCLUSIVE") {
    if (mrp > 0 && lineGstRate > 0) {
      const split = splitFromMrp(mrp, lineGstRate);
      return split.base;
    }
    return mrp || sellingPrice;
  }
  if (pricingMode === "SELLING_PRICE") {
    if (sellingPrice > 0 && lineGstRate > 0) {
      const split = splitFromMrp(sellingPrice, lineGstRate);
      return split.base;
    }
    return sellingPrice;
  }
  if (pricingMode === "BASE_PLUS_TAX") {
    if (basePrice > 0) return basePrice;
    if (sellingPrice > 0 && lineGstRate > 0) {
      const split = splitFromMrp(sellingPrice, lineGstRate);
      return split.base;
    }
    return sellingPrice;
  }
  return basePrice || sellingPrice;
};

const DistributorInvoicePdf = ({ invoice = {}, order = null }) => {
  // Get items from order or invoice, with fallback
  const items = Array.isArray(order?.items) 
    ? order.items 
    : Array.isArray(invoice?.items) 
    ? invoice.items 
    : [];
  const totals = invoice.totals || {};
  
  // Determine payment status - check order first (most accurate), then invoice
  let paymentStatus = "Pending";
  if (order) {
    const orderIsPaid =
      order.isPaid === true ||
      order.paymentStatus === 'Paid' ||
      order.payment?.isPaid === true;
    if (orderIsPaid) {
      paymentStatus = "Paid";
    }
  } else {
    // Fallback to invoice payment fields
    const paymentObj = invoice.payment || {};
    if (typeof paymentObj.isPaid === "boolean") {
      paymentStatus = paymentObj.isPaid ? "Paid" : "Pending";
    } else {
      const raw = paymentObj.status || invoice.paymentStatus || invoice.isPaid;
      if (raw === true || raw === "Paid" || raw === "paid") {
        paymentStatus = "Paid";
      } else if (raw === false || raw === "Pending" || raw === "pending") {
        paymentStatus = "Pending";
      } else {
        paymentStatus = invoice.paymentStatus || (invoice.payment?.isPaid ? "Paid" : "Pending");
      }
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
                {invoice.invoiceNumber || invoice.id || "N/A"}
              </Text>
              <Text style={styles.invoiceMeta}>
                <Text style={styles.bold}>Date: </Text>
                {formatDate(invoice.issuedAt)}
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
                  {currency(totals.grandTotal || 0)}
                </Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.row}>
          <View style={[styles.card, { flex: 1 }]}>
            <Text style={styles.sectionTitle}>Bill To (Buyer)</Text>
            <Text style={styles.infoText}>{invoice.buyer?.businessName || "N/A"}</Text>
            {invoice.buyer?.email && <Text style={styles.infoText}>Email: {invoice.buyer.email}</Text>}
            {invoice.buyer?.phone && <Text style={styles.infoText}>Phone: {invoice.buyer.phone}</Text>}
            {(invoice.buyer?.city || invoice.buyer?.state) && (
              <Text style={styles.infoText}>
                {[invoice.buyer?.city, invoice.buyer?.state].filter(Boolean).join(", ")}
              </Text>
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
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Order Items</Text>
          {items.length === 0 ? (
            <Text style={styles.infoText}>Order details not available.</Text>
          ) : (
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={[styles.th, { flex: 2.5 }]}>Product</Text>
                <Text style={[styles.th, { flex: 0.8 }]}>SKU</Text>
                <Text style={[styles.th, { flex: 0.6 }]}>Brand</Text>
                <Text style={[styles.th, { flex: 0.7 }]}>GST %</Text>
                <Text style={[styles.th, { flex: 0.9 }]}>Base</Text>
                <Text style={[styles.th, { flex: 0.9 }]}>Selling</Text>
                <Text style={[styles.th, { flex: 0.5 }]}>Qty</Text>
                <Text style={[styles.th, { flex: 1 }]}>Total</Text>
              </View>
              {items.map((item, idx) => {
                const qty = Number(item.quantity || item.qty || 0);
                const price = Number(item.sellingPrice || item.price || item.unitPrice || 0);
                const total = qty * price;
                const gstRate = Number(item.gstRate || item.taxRate || 0);
                const basePrice = getDisplayBasePrice(order || invoice, idx, item);
                return (
                  <View key={idx} style={styles.tableRow}>
                    <Text style={[styles.td, { flex: 2.5 }]}>
                      {item.productName || item.name || "N/A"}
                      {item.hsnCode ? `\nHSN: ${item.hsnCode}` : ""}
                    </Text>
                    <Text style={[styles.td, { flex: 0.8 }]}>{item.sku || "—"}</Text>
                    <Text style={[styles.td, { flex: 0.6 }]}>{item.brand || "—"}</Text>
                    <Text style={[styles.td, { flex: 0.7 }]}>{gstRate > 0 ? `${gstRate}%` : "—"}</Text>
                    <Text style={[styles.td, { flex: 0.9 }]}>{currency(basePrice)}</Text>
                    <Text style={[styles.td, { flex: 0.9 }]}>{currency(price)}</Text>
                    <Text style={[styles.td, { flex: 0.5 }]}>{qty}</Text>
                    <Text style={[styles.td, { flex: 1 }]}>{currency(total)}</Text>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Invoice Breakdown</Text>
          <View>
            {totals.grossItems !== undefined && (
              <View style={styles.breakdownRow}>
                <Text>Unit Price Total</Text>
                <Text>{currency(totals.grossItems)}</Text>
              </View>
            )}
            {totals.lineDiscountTotal !== undefined && (
              <View style={styles.breakdownRow}>
                <Text>- Line Discounts</Text>
                <Text>{currency(totals.lineDiscountTotal)}</Text>
              </View>
            )}
            {totals.itemsSubTotal !== undefined && (
              <View style={styles.breakdownRow}>
                <Text>Items Sub-Total</Text>
                <Text>{currency(totals.itemsSubTotal)}</Text>
              </View>
            )}
            {totals.delivery > 0 && (
              <View style={styles.breakdownRow}>
                <Text>+ Delivery</Text>
                <Text>{currency(totals.delivery)}</Text>
              </View>
            )}
            {totals.packing > 0 && (
              <View style={styles.breakdownRow}>
                <Text>+ Packing</Text>
                <Text>{currency(totals.packing)}</Text>
              </View>
            )}
            {totals.insurance > 0 && (
              <View style={styles.breakdownRow}>
                <Text>+ Insurance</Text>
                <Text>{currency(totals.insurance)}</Text>
              </View>
            )}
            {totals.other > 0 && (
              <View style={styles.breakdownRow}>
                <Text>+ Other</Text>
                <Text>{currency(totals.other)}</Text>
              </View>
            )}
            {totals.discountTotal > 0 && (
              <View style={styles.breakdownRow}>
                <Text>- Order Discount</Text>
                <Text>{currency(totals.discountTotal)}</Text>
              </View>
            )}
            {totals.taxableBase !== undefined && (
              <View style={styles.breakdownRow}>
                <Text style={styles.bold}>Taxable Base</Text>
                <Text style={styles.bold}>{currency(totals.taxableBase)}</Text>
              </View>
            )}
            {totals.taxBreakup && (
              <>
                {totals.taxBreakup.igst !== undefined && (
                  <View style={styles.breakdownRow}>
                    <Text>IGST</Text>
                    <Text>{currency(totals.taxBreakup.igst)}</Text>
                  </View>
                )}
                {totals.taxBreakup.cgst !== undefined && (
                  <View style={styles.breakdownRow}>
                    <Text>CGST</Text>
                    <Text>{currency(totals.taxBreakup.cgst)}</Text>
                  </View>
                )}
                {totals.taxBreakup.sgst !== undefined && (
                  <View style={styles.breakdownRow}>
                    <Text>SGST</Text>
                    <Text>{currency(totals.taxBreakup.sgst)}</Text>
                  </View>
                )}
              </>
            )}
            {totals.roundOff !== undefined && totals.roundOff !== 0 && (
              <View style={styles.breakdownRow}>
                <Text>Round Off</Text>
                <Text>{currency(totals.roundOff)}</Text>
              </View>
            )}
            <View style={styles.breakdownTotal}>
              <Text>Grand Total</Text>
              <Text>{currency(totals.grandTotal || 0)}</Text>
            </View>
          </View>
        </View>

        {invoice.orderId && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Order Reference</Text>
            <Text style={styles.infoText}>Order ID: {invoice.orderId}</Text>
          </View>
        )}

        {/* Delivery Details Section */}
        {(invoice.deliveryDetails || invoice.deliveryMode || invoice.expectedDeliveryDate) && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Delivery Information</Text>
            <View style={{ marginTop: 4 }}>
              {invoice.deliveryMode && (
                <Text style={styles.infoText}>
                  <Text style={styles.bold}>Delivery Mode: </Text>
                  {invoice.deliveryMode}
                </Text>
              )}
              {invoice.expectedDeliveryDate && (
                <Text style={styles.infoText}>
                  <Text style={styles.bold}>Expected Delivery Date: </Text>
                  {formatDate(invoice.expectedDeliveryDate)}
                </Text>
              )}
              {invoice.deliveryDetails?.personName && (
                <Text style={styles.infoText}>
                  <Text style={styles.bold}>Delivery Person: </Text>
                  {invoice.deliveryDetails.personName}
                  {invoice.deliveryDetails.personDesignation && ` (${invoice.deliveryDetails.personDesignation})`}
                </Text>
              )}
              {invoice.deliveryDetails?.personPhone && (
                <Text style={styles.infoText}>
                  <Text style={styles.bold}>Contact: </Text>
                  {invoice.deliveryDetails.personPhone}
                </Text>
              )}
              {invoice.deliveryDetails?.vehicleType && (
                <Text style={styles.infoText}>
                  <Text style={styles.bold}>Vehicle Type: </Text>
                  {invoice.deliveryDetails.vehicleType}
                </Text>
              )}
              {invoice.deliveryDetails?.vehicleNumber && (
                <Text style={styles.infoText}>
                  <Text style={styles.bold}>Vehicle Number: </Text>
                  {invoice.deliveryDetails.vehicleNumber}
                </Text>
              )}
              {invoice.deliveryDetails?.transportMethod && (
                <Text style={styles.infoText}>
                  <Text style={styles.bold}>Transport Method: </Text>
                  {invoice.deliveryDetails.transportMethod.replace(/-/g, ' ')}
                </Text>
              )}
              {invoice.deliveryDetails?.awbNumber && (
                <Text style={styles.infoText}>
                  <Text style={styles.bold}>AWB/Tracking Number: </Text>
                  {invoice.deliveryDetails.awbNumber}
                </Text>
              )}
              {invoice.deliveryDetails?.transportServiceName && (
                <Text style={styles.infoText}>
                  <Text style={styles.bold}>Transport Service: </Text>
                  {invoice.deliveryDetails.transportServiceName}
                </Text>
              )}
              {invoice.deliveryDetails?.courierName && (
                <Text style={styles.infoText}>
                  <Text style={styles.bold}>Courier: </Text>
                  {invoice.deliveryDetails.courierName}
                </Text>
              )}
              {invoice.deliveryDetails?.deliveryNotes && (
                <Text style={[styles.infoText, { marginTop: 4 }]}>
                  <Text style={styles.bold}>Delivery Notes: </Text>
                  {"\n"}
                  {invoice.deliveryDetails.deliveryNotes}
                </Text>
              )}
            </View>
          </View>
        )}

        {/* Payment Information Section */}
        {invoice.payment && (
          <View style={[styles.section, { marginTop: 12, padding: 8, backgroundColor: "#F3F4F6" }]}>
            <Text style={[styles.heading, { fontSize: 10, marginBottom: 6 }]}>💳 Payment Information</Text>
            {invoice.payment.isPaid ? (
              <View>
                <Text style={styles.infoText}>
                  <Text style={styles.bold}>Status: </Text>
                  <Text style={{ color: "#10B981" }}>Paid</Text>
                </Text>
                {invoice.payment.receivedMethodLabel && (
                  <Text style={styles.infoText}>
                    <Text style={styles.bold}>Payment Received Via: </Text>
                    {invoice.payment.receivedMethodLabel}
                  </Text>
                )}
                {invoice.payment.receivedTransactionId && (
                  <Text style={styles.infoText}>
                    <Text style={styles.bold}>Transaction ID: </Text>
                    {invoice.payment.receivedTransactionId}
                  </Text>
                )}
                {invoice.payment.receivedReference && (
                  <Text style={styles.infoText}>
                    <Text style={styles.bold}>Reference: </Text>
                    {invoice.payment.receivedReference}
                  </Text>
                )}
                {invoice.payment.receivedAt && (
                  <Text style={styles.infoText}>
                    <Text style={styles.bold}>Received At: </Text>
                    {formatDate(invoice.payment.receivedAt)}
                  </Text>
                )}
                {invoice.payment.receivedBy?.name && (
                  <Text style={styles.infoText}>
                    <Text style={styles.bold}>Received By: </Text>
                    {invoice.payment.receivedBy.name}
                    {invoice.payment.receivedBy.type === 'employee' && (
                      <Text style={{ fontSize: 7, color: "#6B7280" }}> (Employee)</Text>
                    )}
                  </Text>
                )}
                {invoice.payment.receivedNotes && (
                  <Text style={[styles.infoText, { marginTop: 4 }]}>
                    <Text style={styles.bold}>Notes: </Text>
                    {invoice.payment.receivedNotes}
                  </Text>
                )}
              </View>
            ) : (
              <Text style={styles.infoText}>
                <Text style={styles.bold}>Status: </Text>
                <Text style={{ color: "#F59E0B" }}>Pending</Text>
              </Text>
            )}
            {invoice.payment.mode && (
              <Text style={[styles.infoText, { marginTop: 4 }]}>
                <Text style={styles.bold}>Original Payment Mode: </Text>
                {invoice.payment.mode}
              </Text>
            )}
          </View>
        )}

        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 12, paddingTop: 8, borderTopWidth: 1, borderTopColor: "#E5E7EB" }}>
          <Image 
            src="/assets/flyp_logo.png" 
            style={{ width: 24, height: 24, opacity: 0.8 }}
            cache={false}
          />
          <Text style={styles.footer}>Powered by FLYP · {formatDate(new Date().toISOString())}</Text>
        </View>
      </Page>
    </Document>
  );
};

export default DistributorInvoicePdf;


/**
 * Thermal Printer Utilities for 80mm Receipt Printers
 * Optimized for standard cafe/restaurant thermal printers
 * Paper width: 80mm (approximately 48 characters at 12pt)
 */

const THERMAL_WIDTH = 48;

export const ThermalPrinterStyles = `
  @media print {
    @page {
      size: 80mm auto;
      margin: 0;
    }
    
    body {
      margin: 0;
      padding: 0;
      font-family: 'Courier New', 'Consolas', monospace;
      font-size: 12pt;
      line-height: 1.4;
      color: #000;
      background: #fff;
    }
    
    .thermal-receipt {
      width: 80mm;
      max-width: 80mm;
      margin: 0 auto;
      padding: 5mm;
      background: white;
    }
    
    .thermal-header {
      text-align: center;
      margin-bottom: 3mm;
      border-bottom: 2px dashed #000;
      padding-bottom: 3mm;
    }
    
    .thermal-title {
      font-size: 16pt;
      font-weight: bold;
      margin: 2mm 0;
      letter-spacing: 1px;
    }
    
    .thermal-subtitle {
      font-size: 11pt;
      font-weight: bold;
      margin: 1mm 0;
    }
    
    .thermal-info {
      font-size: 10pt;
      margin: 0.5mm 0;
    }
    
    .thermal-section {
      margin: 3mm 0;
      border-bottom: 1px dashed #000;
      padding-bottom: 2mm;
    }
    
    .thermal-row {
      display: flex;
      justify-content: space-between;
      margin: 1mm 0;
      font-size: 11pt;
    }
    
    .thermal-item-row {
      margin: 1.5mm 0;
    }
    
    .thermal-item-name {
      font-weight: bold;
      font-size: 11pt;
    }
    
    .thermal-item-details {
      display: flex;
      justify-content: space-between;
      font-size: 10pt;
      margin-left: 3mm;
    }
    
    .thermal-bold {
      font-weight: bold;
      font-size: 12pt;
    }
    
    .thermal-total {
      font-weight: bold;
      font-size: 14pt;
      margin: 2mm 0;
      border-top: 2px solid #000;
      border-bottom: 2px solid #000;
      padding: 2mm 0;
    }
    
    .thermal-footer {
      text-align: center;
      margin-top: 3mm;
      font-size: 10pt;
      border-top: 2px dashed #000;
      padding-top: 3mm;
    }
    
    .thermal-qr {
      text-align: center;
      margin: 3mm 0;
    }
    
    .thermal-qr canvas {
      max-width: 40mm !important;
      height: auto !important;
      margin: 0 auto;
      display: block;
    }
    
    .thermal-divider {
      border-top: 1px dashed #000;
      margin: 2mm 0;
    }
    
    .thermal-double-divider {
      border-top: 2px solid #000;
      margin: 2mm 0;
    }
    
    /* Hide non-print elements */
    .no-print {
      display: none !important;
    }
  }
  
  /* Screen preview styles */
  @media screen {
    .thermal-receipt {
      width: 80mm;
      max-width: 100%;
      margin: 20px auto;
      padding: 10mm;
      background: white;
      box-shadow: 0 0 10px rgba(0,0,0,0.1);
      font-family: 'Courier New', 'Consolas', monospace;
      color: #000;
    }
    
    .thermal-header {
      text-align: center;
      margin-bottom: 5mm;
      border-bottom: 2px dashed #000;
      padding-bottom: 5mm;
    }
    
    .thermal-title {
      font-size: 16pt;
      font-weight: bold;
      margin: 2mm 0;
    }
    
    .thermal-subtitle {
      font-size: 11pt;
      font-weight: bold;
      margin: 1mm 0;
    }
    
    .thermal-info {
      font-size: 10pt;
      margin: 0.5mm 0;
    }
    
    .thermal-section {
      margin: 3mm 0;
      border-bottom: 1px dashed #000;
      padding-bottom: 2mm;
    }
    
    .thermal-row {
      display: flex;
      justify-content: space-between;
      margin: 1mm 0;
      font-size: 11pt;
    }
    
    .thermal-item-row {
      margin: 1.5mm 0;
    }
    
    .thermal-item-name {
      font-weight: bold;
      font-size: 11pt;
    }
    
    .thermal-item-details {
      display: flex;
      justify-content: space-between;
      font-size: 10pt;
      margin-left: 3mm;
    }
    
    .thermal-bold {
      font-weight: bold;
      font-size: 12pt;
    }
    
    .thermal-total {
      font-weight: bold;
      font-size: 14pt;
      margin: 2mm 0;
      border-top: 2px solid #000;
      border-bottom: 2px solid #000;
      padding: 2mm 0;
    }
    
    .thermal-footer {
      text-align: center;
      margin-top: 3mm;
      font-size: 10pt;
      border-top: 2px dashed #000;
      padding-top: 3mm;
    }
    
    .thermal-qr {
      text-align: center;
      margin: 3mm 0;
    }
    
    .thermal-qr canvas {
      max-width: 40mm;
      height: auto;
      margin: 0 auto;
      display: block;
    }
    
    .thermal-divider {
      border-top: 1px dashed #000;
      margin: 2mm 0;
    }
    
    .thermal-double-divider {
      border-top: 2px solid #000;
      margin: 2mm 0;
    }
  }
`;

export const formatMoney = (amount) => {
  return `₹${Number(amount || 0).toFixed(2)}`;
};

export const padLine = (left, right, width = THERMAL_WIDTH) => {
  const leftStr = String(left);
  const rightStr = String(right);
  const spaces = width - leftStr.length - rightStr.length;
  return leftStr + ' '.repeat(Math.max(0, spaces)) + rightStr;
};

export const centerText = (text, width = THERMAL_WIDTH) => {
  const spaces = Math.floor((width - text.length) / 2);
  return ' '.repeat(Math.max(0, spaces)) + text;
};

// ── Core print function — writes HTML directly, no DOM lookup needed ──────────
export const printThermalContent = (htmlContent, title = "Receipt") => {
  const PRINT_CSS = `
    @page { size: 80mm auto; margin: 0; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Courier New', 'Consolas', monospace;
      font-size: 13pt;
      line-height: 1.5;
      color: #000;
      background: #fff;
      width: 80mm;
      padding: 4mm;
    }
    .thermal-receipt { width: 100%; }
    .thermal-header { text-align: center; border-bottom: 2px dashed #000; padding-bottom: 3mm; margin-bottom: 3mm; }
    .thermal-title { font-size: 18pt; font-weight: 900; letter-spacing: 1px; margin-bottom: 1mm; }
    .thermal-subtitle { font-size: 12pt; font-weight: bold; margin: 1mm 0; }
    .thermal-info { font-size: 10pt; margin: 0.5mm 0; }
    .thermal-section { margin: 2mm 0; padding-bottom: 2mm; border-bottom: 1px dashed #000; }
    .thermal-row { display: flex; justify-content: space-between; align-items: flex-start; margin: 1mm 0; font-size: 11pt; }
    .thermal-item-row { margin: 2mm 0; }
    .thermal-item-name { font-weight: bold; font-size: 12pt; }
    .thermal-item-details { display: flex; justify-content: space-between; font-size: 10pt; padding-left: 3mm; margin-top: 0.5mm; }
    .thermal-bold { font-weight: bold; font-size: 12pt; }
    .thermal-total { font-weight: 900; font-size: 15pt; border-top: 2px solid #000; border-bottom: 2px solid #000; padding: 2mm 0; margin: 2mm 0; }
    .thermal-footer { text-align: center; border-top: 2px dashed #000; padding-top: 3mm; margin-top: 3mm; font-size: 10pt; }
    .thermal-divider { border-top: 1px dashed #000; margin: 2mm 0; }
    .thermal-double-divider { border-top: 2px solid #000; margin: 2mm 0; }
    .thermal-qr { text-align: center; margin: 3mm 0; }
    .thermal-qr img { max-width: 40mm; height: auto; display: block; margin: 0 auto; }
    .thermal-logo { display: block; max-width: 28mm; max-height: 20mm; height: auto; margin: 0 auto 2mm; object-fit: contain; }
    .rush-banner { background: #000; color: #fff; text-align: center; padding: 2mm; font-weight: 900; font-size: 13pt; margin-bottom: 3mm; }
    .kot-item { border-bottom: 1px dotted #ccc; padding: 1.5mm 0; }
    .kot-qty { font-size: 14pt; font-weight: 900; }
  `;

  const fullHtml = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=80mm">
<base href="${window.location.origin}/">
<title>${title}</title>
<style>${PRINT_CSS}</style>
</head>
<body>${htmlContent}</body>
</html>`;

  // Try popup window first
  const win = window.open('', '_blank', 'width=420,height=700,scrollbars=yes,resizable=yes');
  if (win) {
    win.document.open();
    win.document.write(fullHtml);
    win.document.close();
    win.focus();
    // Let document fully load then print
    win.onload = () => { win.print(); };
    // Fallback timeout if onload doesn't fire
    setTimeout(() => {
      try { win.print(); } catch (_) {}
    }, 600);
    return;
  }

  // Fallback: hidden iframe (in case popups are blocked)
  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:80mm;height:0;border:none;';
  document.body.appendChild(iframe);
  iframe.contentDocument.open();
  iframe.contentDocument.write(fullHtml);
  iframe.contentDocument.close();
  setTimeout(() => {
    try {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    } catch (_) {}
    setTimeout(() => document.body.removeChild(iframe), 2000);
  }, 500);
};

// Legacy alias — kept for any remaining callers
export const printThermalReceipt = (_, htmlContent) => printThermalContent(htmlContent);

export const generateKOT = (orderData) => {
  const { items, tableName, tableZone, roundNumber, isRush, timestamp, logoUrl } = orderData;
  const date = new Date(timestamp || Date.now());
  
  return `
    <div class="thermal-receipt" id="thermal-kot">
      <div class="thermal-header">
        ${logoUrl ? `<img src="${logoUrl}" alt="logo" class="thermal-logo" />` : ''}
        <div class="thermal-title">KITCHEN ORDER</div>
        ${isRush ? '<div class="thermal-subtitle" style="color: #f00;">🚨 RUSH ORDER 🚨</div>' : ''}
        <div class="thermal-info">${date.toLocaleString('en-IN')}</div>
      </div>
      
      <div class="thermal-section">
        <div class="thermal-row">
          <span class="thermal-bold">Table:</span>
          <span class="thermal-bold">${tableName || 'Walk-in'}</span>
        </div>
        ${tableZone ? `<div class="thermal-row"><span>Zone:</span><span>${tableZone}</span></div>` : ''}
        <div class="thermal-row">
          <span>Round:</span>
          <span>#${roundNumber || 1}</span>
        </div>
      </div>
      
      <div class="thermal-section">
        <div class="thermal-bold" style="margin-bottom: 2mm;">ITEMS:</div>
        ${items.map(item => `
          <div class="thermal-item-row" style="${item.cancelled ? 'opacity:0.5;' : ''}">
            <div class="thermal-item-name" style="${item.cancelled ? 'text-decoration:line-through;' : ''}">
              ${item.qty || 1}x ${item.product?.name || item.name || 'Item'}
              ${item.cancelled ? ' <span style="font-size:9pt;font-weight:900;letter-spacing:1px;">[VOID]</span>' : ''}
            </div>
            ${!item.cancelled && item.note ? `<div style="margin-left: 5mm; font-style: italic; font-size: 10pt;">Note: ${item.note}</div>` : ''}
          </div>
        `).join('')}
      </div>
      
      <div class="thermal-footer">
        <div style="display:flex;align-items:center;justify-content:center;gap:3mm;">
          <img src="assets/flyp_logo.png" alt="FLYP" style="width:8mm;height:8mm;object-fit:contain;" />
          <span style="font-size:9pt;font-weight:900;letter-spacing:1px;">FLYP POS</span>
        </div>
      </div>
    </div>
  `;
};

export const generateInvoice = (invoiceData) => {
  const { 
    invoiceId, 
    items, 
    totals, 
    customer, 
    tableName, 
    tableZone, 
    paymentMethod,
    businessName,
    businessAddress,
    gstNumber,
    fssaiNumber,
    timestamp,
    logoUrl
  } = invoiceData;
  
  const date = new Date(timestamp || Date.now());
  
  return `
    <div class="thermal-receipt" id="thermal-invoice">
      <div class="thermal-header">
        ${logoUrl ? `<img src="${logoUrl}" alt="logo" class="thermal-logo" />` : ''}
        <div class="thermal-title">${businessName || 'RESTAURANT'}</div>
        ${businessAddress ? `<div class="thermal-info">${businessAddress}</div>` : ''}
        ${gstNumber ? `<div class="thermal-info">GST: ${gstNumber}</div>` : ''}
        ${fssaiNumber ? `<div class="thermal-info">FSSAI: ${fssaiNumber}</div>` : ''}
        <div class="thermal-divider"></div>
        <div class="thermal-subtitle">TAX INVOICE</div>
        <div class="thermal-info">Invoice: ${invoiceId || 'N/A'}</div>
        <div class="thermal-info">${date.toLocaleString('en-IN')}</div>
      </div>
      
      <div class="thermal-section">
        ${customer?.name ? `<div class="thermal-row"><span>Customer:</span><span>${customer.name}</span></div>` : ''}
        ${customer?.phone ? `<div class="thermal-row"><span>Phone:</span><span>${customer.phone}</span></div>` : ''}
        ${tableName ? `<div class="thermal-row"><span>Table:</span><span>${tableName}</span></div>` : ''}
        ${tableZone ? `<div class="thermal-row"><span>Zone:</span><span>${tableZone}</span></div>` : ''}
        ${invoiceData.servedBy ? `<div class="thermal-row"><span>Served By:</span><span>${invoiceData.servedBy}</span></div>` : ''}
      </div>
      
      <div class="thermal-section">
        <div class="thermal-row thermal-bold">
          <span>ITEM</span>
          <span>AMOUNT</span>
        </div>
        <div class="thermal-divider"></div>
        ${items.map(item => {
          const name = item.product?.name || item.name || 'Item';
          const qty = item.qty || item.quantity || 1;
          const price = Number(item.product?.price || item.price || 0);
          const total = qty * price;
          
          return `
            <div class="thermal-item-row">
              <div class="thermal-item-name">${name}</div>
              <div class="thermal-item-details">
                <span>${qty} x ${formatMoney(price)}</span>
                <span>${formatMoney(total)}</span>
              </div>
            </div>
          `;
        }).join('')}
      </div>
      
      <div class="thermal-section">
        <div class="thermal-row">
          <span>Subtotal:</span>
          <span>${formatMoney(totals.subTotal || 0)}</span>
        </div>
        ${totals.tax ? `
          <div class="thermal-row">
            <span>Tax (GST):</span>
            <span>${formatMoney(totals.tax)}</span>
          </div>
        ` : ''}
        ${totals.extraCharge ? `
          <div class="thermal-row">
            <span>Service Charge:</span>
            <span>${formatMoney(totals.extraCharge)}</span>
          </div>
        ` : ''}
        ${totals.discount ? `
          <div class="thermal-row">
            <span>Discount:</span>
            <span>-${formatMoney(totals.discount)}</span>
          </div>
        ` : ''}
        <div class="thermal-double-divider"></div>
        <div class="thermal-row thermal-total">
          <span>TOTAL:</span>
          <span>${formatMoney(totals.grandTotal || 0)}</span>
        </div>
      </div>
      
      ${paymentMethod ? `
        <div class="thermal-section">
          <div class="thermal-row thermal-bold">
            <span>Payment Mode:</span>
            <span>${paymentMethod}</span>
          </div>
        </div>
      ` : ''}
      
      <div class="thermal-footer">
        <div style="margin-bottom: 2mm;">Thank you for dining with us!</div>
        <div style="display:flex;align-items:center;justify-content:center;gap:3mm;margin-top:2mm;">
          <img src="assets/flyp_logo.png" alt="FLYP" style="width:10mm;height:10mm;object-fit:contain;" />
          <span style="font-size:9pt;font-weight:900;letter-spacing:1px;">Powered by FLYP POS</span>
        </div>
      </div>
    </div>
  `;
};

export const generateQRPrint = (qrData) => {
  const { tableName, tableZone, qrCodeDataUrl, businessName } = qrData;
  
  return `
    <div class="thermal-receipt" id="thermal-qr">
      <div class="thermal-header">
        <div class="thermal-title">${businessName || 'RESTAURANT'}</div>
        <div class="thermal-subtitle">Scan to Order</div>
      </div>
      
      <div class="thermal-qr">
        <img src="${qrCodeDataUrl}" style="max-width: 40mm; height: auto; display: block; margin: 0 auto;" />
      </div>
      
      <div class="thermal-section" style="text-align: center;">
        <div class="thermal-bold" style="font-size: 14pt; margin: 2mm 0;">
          ${tableName || 'Table'}
        </div>
        ${tableZone ? `<div class="thermal-info">${tableZone}</div>` : ''}
      </div>
      
      <div class="thermal-footer">
        <div style="margin-bottom: 2mm;">Scan QR code with your phone</div>
        <div style="margin-bottom: 2mm;">to view menu & place order</div>
        <div>Powered by FLYP</div>
      </div>
    </div>
  `;
};

import{e as T,d as I,c as b,b as P,s as $}from"./firebase-DWi1MSv1.js";import{d as y,w as U}from"./index-DRC3F7i0.js";import{httpsCallable as R}from"./index.esm-Bux_mLJ0.js";import"./whatsappConfig-B767RKqS.js";const m={META:"meta",META_TECH_PROVIDER:"meta_tech_provider",TWILIO:"twilio",DIRECT:"direct"};function A(n){if(!n)return null;let e=n.replace(/\D/g,"");return e.startsWith("91")&&e.length===12?`+${e}`:(e.startsWith("0")&&(e=e.substring(1)),e.length===10?`+91${e}`:e.length===12&&e.startsWith("91")?`+${e}`:null)}async function W(n){try{const e=await T(I(y,"businesses",n));if(!e.exists())return null;const a=e.data();return{enabled:a.whatsappEnabled||!1,provider:a.whatsappProvider||m.DIRECT,apiKey:a.whatsappApiKey||"",apiSecret:a.whatsappApiSecret||"",phoneNumberId:a.whatsappPhoneNumberId||"",businessAccountId:a.whatsappBusinessAccountId||"",accessToken:a.whatsappAccessToken||"",twilioAccountSid:a.twilioAccountSid||"",twilioAuthToken:a.twilioAuthToken||"",twilioWhatsAppFrom:a.twilioWhatsAppFrom||"",verified:a.whatsappVerified||!1,lastVerifiedAt:a.whatsappLastVerifiedAt||null,createdVia:a.whatsappCreatedVia||null,webhookConfigured:a.whatsappWebhookConfigured||!1}}catch(e){return console.error("Error fetching WhatsApp config:",e),null}}async function C(n,e,a,r=null,t={}){const s=n.phoneNumberId,o=n.accessToken;if(!s||!o)throw new Error("Meta WhatsApp API credentials not configured");const i=`https://graph.facebook.com/v18.0/${s}/messages`;let c;t.imageUrl?c={messaging_product:"whatsapp",to:e.replace("+",""),type:"image",image:{link:t.imageUrl,caption:a||""}}:t.documentUrl?c={messaging_product:"whatsapp",to:e.replace("+",""),type:"document",document:{link:t.documentUrl,filename:t.filename||"document",caption:a||""}}:r?c={messaging_product:"whatsapp",to:e.replace("+",""),type:"template",template:{name:r.name,language:{code:r.language||"en"},components:r.components||[]}}:c={messaging_product:"whatsapp",to:e.replace("+",""),type:"text",text:{body:a}};try{const l=await fetch(i,{method:"POST",headers:{Authorization:`Bearer ${o}`,"Content-Type":"application/json"},body:JSON.stringify(c)}),d=await l.json();if(!l.ok){const E=d.error?.message||"Failed to send WhatsApp message",p=d.error?.code||d.error?.error_subcode,h=d.error?.error_subcode,u=new Error(E);throw u.code=p,u.subcode=h,u.metaError=d.error,(p===10||h===10)&&(u.permissionError=!0),(p===131030||h===131030)&&(u.recipientError=!0),u}return{success:!0,messageId:d.messages?.[0]?.id,data:d,canTrackStatus:!0}}catch(l){throw console.error("Meta WhatsApp API error:",l),l}}async function _(n,e,a){const r=n.twilioAccountSid,t=n.twilioAuthToken,s=n.twilioWhatsAppFrom||"whatsapp:+14155238886";if(!r||!t)throw new Error("Twilio credentials not configured");const o=`https://api.twilio.com/2010-04-01/Accounts/${r}/Messages.json`,i=new URLSearchParams;i.append("From",s),i.append("To",`whatsapp:${e}`),i.append("Body",a);try{const c=await fetch(o,{method:"POST",headers:{Authorization:`Basic ${btoa(`${r}:${t}`)}`,"Content-Type":"application/x-www-form-urlencoded"},body:i.toString()}),l=await c.json();if(!c.ok)throw new Error(l.message||"Failed to send WhatsApp message via Twilio");return{success:!0,messageId:l.sid,data:l}}catch(c){throw console.error("Twilio WhatsApp API error:",c),c}}function f(n,e){const a=n.replace(/[^0-9]/g,""),r=encodeURIComponent(e);return`https://wa.me/${a}?text=${r}`}async function k(n,e,a,r={}){try{const t=A(e);if(!t)throw new Error("Invalid phone number format");const s=await W(n);if(!s||!s.enabled){const c={success:!0,method:"direct",link:f(t,a),message:"WhatsApp not configured. Use direct link."};if(r.logMessage!==!1)try{await g(n,t,a,c,r)}catch(l){console.warn("Could not log WhatsApp message (non-critical):",l)}return c}let o;switch(s.provider){case m.META_TECH_PROVIDER:try{const d=await R(U,"sendMessageViaTechProvider")({to:t,message:a,template:r.template||null,options:{imageUrl:r.metadata?.imageUrl||null,documentUrl:r.metadata?.documentUrl||null,filename:r.metadata?.filename||null,metadata:r.metadata||{}}});o={success:d.data?.success||!1,messageId:d.data?.messageId||null,method:"tech_provider",data:d.data?.data||{},canTrackStatus:!0}}catch(l){throw console.error("Tech Provider send error:",l),l}break;case m.META:o=await C(s,t,a,r.template,{imageUrl:r.metadata?.imageUrl||null,documentUrl:r.metadata?.documentUrl||null,filename:r.metadata?.filename||null});break;case m.TWILIO:o=await _(s,t,a);break;case m.DIRECT:default:const c={success:!0,method:"direct",link:f(t,a)};if(r.logMessage!==!1)try{await g(n,t,a,c,r)}catch(l){console.warn("Could not log WhatsApp message (non-critical):",l)}return c}if(r.logMessage!==!1)try{await g(n,t,a,o,{...r,metadata:{...r.metadata||{},imageUrl:r.metadata?.imageUrl||null}})}catch(i){console.warn("Could not log WhatsApp message (non-critical):",i)}return{success:!0,method:s.provider,...o}}catch(t){console.error("Error sending WhatsApp message:",t);const s=A(e);if(s){const o=f(s,a),i=t.message?.includes("#131030")||t.message?.includes("not in allowed list")||t.code===131030||t.subcode===131030;return{success:!1,error:t.message,errorCode:i?"RECIPIENT_NOT_ALLOWED":void 0,method:"direct_fallback",link:o}}throw t}}function w(n){if(n===null||typeof n!="object")return n;if(Array.isArray(n))return n.map(w).filter(a=>a!==void 0);const e={};for(const a in n)n[a]!==void 0&&(e[a]=w(n[a]));return e}async function g(n,e,a,r,t={}){try{const s=b(y,"businesses",n,"whatsappMessages"),o={...t.metadata||{},imageUrl:t.metadata?.imageUrl||null,videoUrl:t.metadata?.videoUrl||null,linkUrl:t.metadata?.linkUrl||null,productIds:t.metadata?.productIds||[],productCount:t.metadata?.productCount||0,retailerId:t.metadata?.retailerId||null,retailerName:t.metadata?.retailerName||null,templateId:t.metadata?.templateId||null,templateName:t.metadata?.templateName||null},i=w(o);await P(s,{to:e,message:a,status:r.success!==!1?"sent":"failed",method:r.method||"unknown",messageId:r.messageId||null,orderId:t.orderId||null,messageType:t.messageType||"general",createdAt:$(),metadata:i})}catch(s){console.error("Error logging WhatsApp message:",s)}}async function N(n,e,a){const r=e.retailerPhone||e.phone;if(!r)throw new Error("Retailer phone number not found");let o={QUOTED:`📋 *Proforma Invoice Sent*

Your order #${e.id||"N/A"} has been quoted. Please review and accept the proforma invoice.`,ACCEPTED:`✅ *Order Accepted*

Your order #${e.id||"N/A"} has been accepted and is being processed.`,PACKED:`📦 *Order Packed*

Your order #${e.id||"N/A"} has been packed and is ready for dispatch.`,SHIPPED:`🚚 *Order Shipped*

Your order #${e.id||"N/A"} has been shipped. Tracking details will be shared soon.`,OUT_FOR_DELIVERY:`🚛 *Out for Delivery*

Your order #${e.id||"N/A"} is out for delivery and will reach you soon!`,DELIVERED:`✅ *Order Delivered*

Your order #${e.id||"N/A"} has been delivered successfully. Thank you for your business!`,REJECTED:`❌ *Order Rejected*

Unfortunately, your order #${e.id||"N/A"} could not be processed. Please contact us for assistance.`}[a]||`📦 *Order Update*

Your order #${e.id||"N/A"} status has been updated to: ${a}`;return e.totalAmount&&(o+=`

💰 Total Amount: ₹${e.totalAmount.toFixed(2)}`),e.items&&e.items.length>0&&(o+=`

📋 Items:
${e.items.slice(0,5).map(i=>`• ${i.name||i.productName} (${i.quantity||1})`).join(`
`)}`,e.items.length>5&&(o+=`
...and ${e.items.length-5} more items`)),o+=`

_Powered by FLYP_`,await k(n,r,o,{orderId:e.id,messageType:"order_status_update",metadata:{status:a,orderId:e.id}})}async function O(n,e,a,r=""){if(!a)throw new Error("Retailer phone number required");if(!e||e.length===0)throw new Error("At least one product required");let t=`📦 *Stock Refill Reminder*

`;if(r?t+=`Hello *${r}*,

`:t+=`Hello!

`,e.length===1){const s=e[0];t+=`Your product *${s.name||"N/A"}* is running low on stock.

`,t+=`📊 *Current Stock:* ${s.quantity||0} ${s.unit||"units"}

`}else t+=`You have *${e.length} products* running low on stock:

`,e.forEach((s,o)=>{t+=`${o+1}. *${s.name||"Unnamed Product"}*
`,t+=`   📊 Stock: ${s.quantity||0} ${s.unit||"units"}

`});return t+=`💡 We recommend placing an order soon to avoid stockout.

`,t+=`Reply to this message to place your order!

`,t+="_Powered by FLYP_",await k(n,a,t,{messageType:"bulk_stock_reminder",metadata:{productIds:e.map(s=>s.id),productNames:e.map(s=>s.name),productCount:e.length}})}export{m as W,O as a,N as b,W as g,k as s};

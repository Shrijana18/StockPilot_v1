# Cashfree Partner – Embedded Merchant Onboarding (No Manual Add)

As an embedded partner, you **do not need to manually add merchants** in the Cashfree Partner Dashboard. Use **APIs + Embeddable Onboarding Link + Webhooks** so users create and activate their own gateway from inside your platform.

---

## Summary

| Approach | Manual add? | Where merchant signs up | How you know they’re active |
|----------|-------------|--------------------------|------------------------------|
| **Dashboard only** | Yes – you add each merchant | Cashfree / referral link | You check dashboard |
| **API + Embeddable Link + Webhook** | **No** | Inside your app (your UI → Cashfree KYC page) | Webhook `MERCHANT_ONBOARDING_STATUS` → `ACTIVE` |

Use the **API + embeddable link + webhook** flow to embed the setup in your platform.

---

## 1. Get Partner API key and store it securely

1. Log in to [Partner Dashboard](https://partner.cashfree.com) (or test: sign up via [test signup](https://test.cashfree.com/partner-ui/authentication/signup?product=embedded)).
2. Go to **Developers** → **API Keys** → **Generate API Key**. Copy the key (it looks like `XqeG7tXHHNlP3aa9ce9ab2ba77f2d6fcaa10f0e68602ffde2b31`).
3. **Do not put the API key in code or commit it to git.** Store it as a Firebase secret:

   ```bash
   firebase functions:secrets:set CASHFREE_PARTNER_API_KEY
   ```
   When prompted, paste your Partner API key. Then redeploy functions:

   ```bash
   firebase deploy --only functions
   ```

   The app uses this secret in the callable function `cashfreeCreateMerchantAndOnboardingLink` and in the webhook `cashfreeMerchantOnboardingWebhook`.

**Base URLs**

- Test: `https://api-sandbox.cashfree.com/partners`
- Production: `https://api.cashfree.com/partners`

**Header for all requests**

- `x-partner-apikey`: your Partner API key  
- `x-api-version`: `2023-01-01` (or latest)

---

## 2. Embedded flow (user “creates account” from your platform)

High level:

1. Your user clicks “Enable Payments” / “Connect Cashfree” in your app.
2. Your backend calls **Create Merchant** (once per user) and then **Create Embeddable Onboarding Link**.
3. Your frontend opens the returned **onboarding_link** (new tab or iframe). User does **not** need to log in to Cashfree; they complete KYC on that link.
4. Cashfree sends a **webhook** when status changes. When `onboarding_status` is `ACTIVE`, you enable the gateway for that merchant in your app.

No manual add in the dashboard.

---

## 3. APIs to use

### Step A – Create merchant (once per user)

**POST** `/merchants`

Creates a sub-merchant under your partner account. You choose `merchant_id` (e.g. your user/store ID).

**Required body (minimal):**

- `merchant_id` – unique ID (e.g. `store_abc123` or your Firestore user/store id). Max 40 chars, alphanumeric, hyphen, underscore.
- `merchant_email` – merchant’s email
- `merchant_name` – business/brand name
- `poc_phone` – contact phone
- `merchant_site_url` – website URL (e.g. your app URL or placeholder)

Optional: `business_details`, `website_details`, `bank_account_details`, `signatory_details`, `additional_details` (see [Create Merchant](https://www.cashfree.com/docs/api-reference/platforms/latest/merchant-onboarding/create-merchant)).

**Response:** `merchant_id`, `onboarding_status` (e.g. `Created`, `Email Verified`), `product_status`, etc.

Store `merchant_id` in your DB (e.g. in the retailer/distributor profile) so you can create links and interpret webhooks later.

---

### Step B – Create embeddable onboarding link (no Cashfree login)

**POST** `/merchants/{merchant_id}/onboarding_link`

**Headers:** same as above (`x-partner-apikey`, `x-api-version`).

**Body:**

```json
{
  "type": "account_onboarding",
  "return_url": "https://yourapp.com/settings/payments"
}
```

- `return_url` – where to send the user after they finish KYC (e.g. your “Payments” or “Settings” page).

**Response:**

- `onboarding_link` – URL to open in browser or iframe (link expires in ~1 hour).
- `expires_at`, `created_at`

Use this URL in your frontend: open in new tab or iframe so the user completes KYC on Cashfree’s page. They do **not** need to create a Cashfree login first for this link.

---

### Step C – Get merchant status (optional)

**GET** `/merchants/{merchant_id}`

Use when you need to poll or show “Pending KYC” / “Active” in your UI. Prefer relying on webhooks for activation.

---

## 4. Webhook setup in Cashfree Partner Dashboard

In the **Add Webhook** modal (Partner Dashboard → **Developers** → **Webhook** → **Add Webhook URL**):

1. **Webhook URL:**  
   Use your Cloud Function URL:
   ```text
   https://us-central1-stockpilotv1.cloudfunctions.net/cashfreeMerchantOnboardingWebhook
   ```
   (Replace `stockpilotv1` with your Firebase project ID if different.)

2. **Active Events:**  
   In the “Search event” / checkbox list, find and select:
   - **Merchant Onboarding Status** (or `MERCHANT_ONBOARDING_STATUS`).

   You do **not** need to select Payment Success, Refund, Settlement, etc. for retailer onboarding; only the merchant onboarding event is required so your app knows when a retailer’s gateway is **ACTIVE**.

3. Click **Add Webhook**.

After this, Cashfree will send `MERCHANT_ONBOARDING_STATUS` to your function when a retailer completes or updates onboarding. Your function updates Firestore so the retailer dashboard shows “Payment gateway active”.

---

## 5. Webhooks – know when a merchant is active

Configure one endpoint in the Partner Dashboard so you don’t have to poll.

1. Partner Dashboard → **Developers** → **Webhooks**.
2. Add your HTTPS URL (e.g. `https://yourapi.com/webhooks/cashfree/merchant-onboarding`).

**Event:** `MERCHANT_ONBOARDING_STATUS`  
Fired when onboarding status changes (e.g. email verified, KYC approved, **account activated**).

**Payload (conceptually):**

```json
{
  "type": "MERCHANT_ONBOARDING_STATUS",
  "event_time": "2026-01-30T15:04:05Z",
  "data": {
    "merchant_id": "store_abc123",
    "merchant_name": "Business A",
    "created_at": "2026-01-30T10:00:00+05:30",
    "onboarding_status": "ACTIVE"
  }
}
```

When `data.onboarding_status === "ACTIVE"`:

- Treat that merchant as “gateway enabled” in your platform.
- Update your DB (e.g. set `cashfreeMerchantId`, `cashfreeActive: true` for that store/user).

**Security:** Verify the webhook signature using the headers and your Partner API key (see [Webhooks](https://www.cashfree.com/docs/api-reference/platforms/latest/merchant-onboarding/webhooks)). Use the **raw body** for signature verification (before parsing JSON).

---

## 6. Enable/disable in your platform

- **Enable:** You don’t “enable” on Cashfree’s side via API for onboarding – the merchant gets enabled when KYC is approved and you get `onboarding_status: ACTIVE` in the webhook. In **your** app, enable the gateway for that user/store when you receive that webhook (e.g. show “Payments active”, allow them to accept payments).
- **Disable:** For “disable” in your app, you can:
  - Only hide/disable the gateway in your UI and stop using that merchant for new orders, or
  - Check Cashfree docs for any partner-level “suspend sub-merchant” or similar API if they offer it.

So: **enable/disable in your platform** = update your DB and UI based on **Create Merchant + onboarding link + MERCHANT_ONBOARDING_STATUS webhook**. No need to manually add merchants in the dashboard.

---

## 7. Flow recap

```
Your platform                          Cashfree
─────────────────────────────────────────────────────────────────
User clicks "Enable Payments"
        │
        ▼
Backend: POST /partners/merchants  ──►  Create sub-merchant
        (merchant_id, email, name, ...)
        │
        ◄── merchant_id, onboarding_status
        │
Backend: POST /partners/merchants/{id}/onboarding_link
        (type: account_onboarding, return_url)
        │
        ◄── onboarding_link (URL)
        │
Frontend: open onboarding_link (tab/iframe)
        │                              User completes KYC on Cashfree page
        │                              (no Cashfree login required)
        │
        │                              Cashfree sends webhook
        ◄────────────────────────────  MERCHANT_ONBOARDING_STATUS
        │                              (onboarding_status: ACTIVE)
        │
Backend: verify signature, update DB,
         enable gateway for that merchant in your app
```

---

## 8. References

- [Merchant Onboarding – Getting Started](https://www.cashfree.com/docs/api-reference/platforms/latest/merchant-onboarding/getting-started)
- [Create Merchant](https://www.cashfree.com/docs/api-reference/platforms/latest/merchant-onboarding/create-merchant)
- [Create Embeddable Onboarding Link (no login)](https://www.cashfree.com/docs/api-reference/platforms/latest/merchant-onboarding/create-embeddable-onboarding-link-does-not-require-login)
- [Merchant Onboarding Webhooks](https://www.cashfree.com/docs/api-reference/platforms/latest/merchant-onboarding/webhooks)

---

## 9. Retailer dashboard – Payment Setup (implemented)

In **Retailer Dashboard → Profile Settings**, the **Payment Setup** section:

- **Connect Cashfree:** Creates the sub-merchant and opens the embeddable onboarding link in a new tab. The retailer completes KYC on Cashfree (no Cashfree login required).
- **Complete KYC:** If the merchant exists but is not yet active, the retailer can open a new onboarding link to finish KYC.
- **Payment gateway active:** Shown when the webhook has set `cashfreeActive: true` (onboarding status `ACTIVE`).

Data is stored on `businesses/{uid}`: `cashfreeMerchantId`, `cashfreeOnboardingStatus`, `cashfreeActive`. The webhook updates these when Cashfree sends `MERCHANT_ONBOARDING_STATUS`.

---

## 10. Optional: Backend service shape

You can add a small backend (e.g. Firebase Cloud Function or your API) that:

1. **Create merchant + link:** Accepts your internal user/store id, email, name, phone, site URL; calls Create Merchant (with `merchant_id` = your id), then Create Embeddable Onboarding Link; returns `onboarding_link` and saves `merchant_id` in Firestore.
2. **Webhook:** One HTTP endpoint that receives Cashfree webhooks, verifies signature, and on `MERCHANT_ONBOARDING_STATUS` with `ACTIVE` updates Firestore (e.g. `cashfreeActive: true`) so your app can enable the gateway for that merchant.

If you want, we can wire this into your existing Firebase/Firestore and retailer/distributor profile next (e.g. where to store `merchant_id`, which screen opens the onboarding link, and where to add the webhook).

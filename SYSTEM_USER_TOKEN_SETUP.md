# System User Token Setup - FLYP Shri (Admin)

## ✅ Current Configuration

**System User:** FLYP Shri (Admin)
- **ID:** `61585528485890`
- **Access Level:** Admin access
- **Status:** ✅ Recommended for use (has Full Control over App and WhatsApp accounts)

**Token:**
```
EAAbCX6enA4cBQQEw4v4NwwIfHV6ub1rdoea9rp9Dt0vvQ1ZC8l7wQfCHLNh2zJKnzuPcZBHAhRDlrMw4VbHHI8cH5akI49dpjPFCvy9eCiBML5aZB9nwoVVUZCcjjNnZBgRZCFb543KaiCbKwtqn9RYSJuVV4WFXZA34aURvg7DM9qOBZCvwEd9ErJAAwCHN6iw6AAZDZD
```

---

## 🔧 Setup Instructions

### Option 1: Firebase Secrets (Production - Recommended)

1. **Set the secret:**
   ```bash
   firebase functions:secrets:set META_SYSTEM_USER_TOKEN
   ```

2. **When prompted, paste the token:**
   ```
   EAAbCX6enA4cBQQEw4v4NwwIfHV6ub1rdoea9rp9Dt0vvQ1ZC8l7wQfCHLNh2zJKnzuPcZBHAhRDlrMw4VbHHI8cH5akI49dpjPFCvy9eCiBML5aZB9nwoVVUZCcjjNnZBgRZCFb543KaiCbKwtqn9RYSJuVV4WFXZA34aURvg7DM9qOBZCvwEd9ErJAAwCHN6iw6AAZDZD
   ```

3. **Grant access to functions:**
   ```bash
   firebase functions:secrets:access META_SYSTEM_USER_TOKEN
   ```

4. **Redeploy functions:**
   ```bash
   firebase deploy --only functions
   ```

---

### Option 2: Environment Variable (Local Development)

1. **Create or update `.env` file** in the `functions` directory:
   ```bash
   cd functions
   ```

2. **Add to `.env`:**
   ```
   META_SYSTEM_USER_TOKEN=EAAbCX6enA4cBQQEw4v4NwwIfHV6ub1rdoea9rp9Dt0vvQ1ZC8l7wQfCHLNh2zJKnzuPcZBHAhRDlrMw4VbHHI8cH5akI49dpjPFCvy9eCiBML5aZB9nwoVVUZCcjjNnZBgRZCFb543KaiCbKwtqn9RYSJuVV4WFXZA34aURvg7DM9qOBZCvwEd9ErJAAwCHN6iw6AAZDZD
   ```

3. **Make sure `.env` is in `.gitignore`** (never commit tokens!)

---

## ✅ Verification

### Test Token Access

You can verify the token works by testing an API call:

```bash
curl "https://graph.facebook.com/v18.0/me?access_token=EAAbCX6enA4cBQQEw4v4NwwIfHV6ub1rdoea9rp9Dt0vvQ1ZC8l7wQfCHLNh2zJKnzuPcZBHAhRDlrMw4VbHHI8cH5akI49dpjPFCvy9eCiBML5aZB9nwoVVUZCcjjNnZBgRZCFb543KaiCbKwtqn9RYSJuVV4WFXZA34aURvg7DM9qOBZCvwEd9ErJAAwCHN6iw6AAZDZD"
```

**Expected Response:**
```json
{
  "id": "61585528485890",
  "name": "FLYP Shri"
}
```

### Test Business Manager Access

```bash
curl "https://graph.facebook.com/v18.0/1337356574811477?access_token=EAAbCX6enA4cBQQEw4v4NwwIfHV6ub1rdoea9rp9Dt0vvQ1ZC8l7wQfCHLNh2zJKnzuPcZBHAhRDlrMw4VbHHI8cH5akI49dpjPFCvy9eCiBML5aZB9nwoVVUZCcjjNnZBgRZCFb543KaiCbKwtqn9RYSJuVV4WFXZA34aURvg7DM9qOBZCvwEd9ErJAAwCHN6iw6AAZDZD&fields=id,name"
```

**Expected Response:**
```json
{
  "id": "1337356574811477",
  "name": "FLYP Corporation Private Limited"
}
```

---

## 🔄 Token Expiration & Renewal

**Token Duration:**
- System User tokens typically don't expire automatically
- But they can be revoked manually

**If Token Expires:**
1. Go to: https://business.facebook.com/settings/system-users?business_id=1337356574811477
2. Select "FLYP Shri" (ID: `61585528485890`)
3. Click "Generate token"
4. Copy the new token
5. Update Firebase Secret or `.env` file
6. Redeploy functions

---

## ⚠️ Security Notes

1. **Never commit tokens to Git:**
   - Always use `.gitignore` for `.env` files
   - Use Firebase Secrets for production

2. **Token Access:**
   - Only people with Full Control of Business Manager can generate tokens
   - Keep tokens secure and private

3. **Token Rotation:**
   - Consider rotating tokens periodically for security
   - Update in Firebase Secrets when rotating

---

## 📋 Summary

**System User:** FLYP Shri (Admin) - ID `61585528485890` ✅
**Token:** Set in Firebase Secrets or `.env` file
**Status:** Ready to use after setup

**Next Steps:**
1. Set token in Firebase Secrets (production)
2. Or add to `.env` file (local development)
3. Redeploy functions if using Firebase Secrets
4. Test Embedded Signup flow


# CORS Error Fix Attempt - detectNewWABA Function

## 🔴 Current Issue

**Error:** `Access to fetch at 'https://us-central1-stockpilotv1.cloudfunctions.net/detectNewWABA' from origin 'http://localhost:5173' has been blocked by CORS policy: Response to preflight request doesn't pass access control check: No 'Access-Control-Allow-Origin' header is present on the requested resource.`

## 🔍 Root Cause Analysis

The CORS error is happening because:

1. **Firebase Functions v2 `onCall` functions** should handle CORS automatically
2. **But the preflight OPTIONS request is failing** - the function isn't responding with CORS headers
3. **The Firebase SDK's `httpsCallable`** should use a special protocol that bypasses CORS, but it seems to be making a direct HTTP request instead

## ✅ Fixes Applied

1. ✅ **Added `invoker: "public"`** to `detectNewWABA` function configuration
2. ✅ **Updated all function calls** to use `functions` instance from `firebaseConfig` instead of creating new instances
3. ✅ **Added auth token verification** before calling functions
4. ✅ **Redeployed the function** with new configuration

## ⚠️ Why It's Still Failing

The CORS error suggests that:
- The Firebase SDK might not be properly handling the callable function protocol
- The function might need explicit CORS handling (like `onRequest` functions)
- There might be a Firebase Functions v2 configuration issue

## 🔧 Next Steps to Try

### Option 1: Convert to `onRequest` with Explicit CORS (Recommended)

Convert `detectNewWABA` from `onCall` to `onRequest` with explicit CORS handling:

```javascript
exports.detectNewWABA = onRequest(
  {
    region: "us-central1",
    cors: true,
    memory: "256MiB",
    timeoutSeconds: 30,
    secrets: [META_SYSTEM_USER_TOKEN_SECRET],
  },
  async (req, res) => {
    cors(req, res, async () => {
      // Handle OPTIONS preflight
      if (req.method === "OPTIONS") {
        res.set("Access-Control-Allow-Origin", "*");
        res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
        res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
        return res.status(204).send("");
      }

      // Verify authentication
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const idToken = authHeader.split("Bearer ")[1];
      // Verify token and get uid...
      // Rest of function logic...
    });
  }
);
```

Then update the frontend to call it via HTTP with auth token.

### Option 2: Check Firebase SDK Version

Ensure you're using a compatible version of Firebase SDK that properly handles `onCall` functions.

### Option 3: Use Firebase Emulator for Local Development

If testing on localhost, consider using Firebase Emulator which handles CORS differently.

## 📝 Current Status

- ✅ Function redeployed with `invoker: "public"`
- ✅ Frontend updated to use `functions` instance from `firebaseConfig`
- ❌ CORS error still persists
- ⚠️ Need to convert to `onRequest` or find alternative solution

---

**Recommendation:** Convert `detectNewWABA` to `onRequest` with explicit CORS handling, as this is more reliable for localhost development.

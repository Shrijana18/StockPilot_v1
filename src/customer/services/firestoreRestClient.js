import { Capacitor } from '@capacitor/core';

const IS_NATIVE = Capacitor?.isNativePlatform?.() === true;
const PROJECT_ID = 'stockpilotv1';
const API_KEY = 'AIzaSyBPkkXZWll0VifG5kb0DDSsoV5UB-n5pFE';
const BASE_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
const DEFAULT_TIMEOUT_MS = 10000;

const withTimeout = async (promise, ms = DEFAULT_TIMEOUT_MS) =>
  Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('Firestore REST request timed out')), ms)),
  ]);

const encodePath = (path) => path.split('/').map(encodeURIComponent).join('/');

const fromFirestoreValue = (v) => {
  if (!v || typeof v !== 'object') return null;
  if ('nullValue' in v) return null;
  if ('stringValue' in v) return v.stringValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('timestampValue' in v) return v.timestampValue;
  if ('geoPointValue' in v) {
    const gp = v.geoPointValue;
    return { latitude: gp.latitude, longitude: gp.longitude };
  }
  if ('arrayValue' in v) {
    const values = v.arrayValue?.values || [];
    return values.map(fromFirestoreValue);
  }
  if ('mapValue' in v) {
    const out = {};
    const fields = v.mapValue?.fields || {};
    Object.keys(fields).forEach((k) => {
      out[k] = fromFirestoreValue(fields[k]);
    });
    return out;
  }
  return null;
};

const toFirestoreValue = (v) => {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'string') return { stringValue: v };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') {
    return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  }
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toFirestoreValue) } };
  if (typeof v === 'object') {
    // GeoPoint-like object
    if (
      Object.prototype.hasOwnProperty.call(v, 'latitude') &&
      Object.prototype.hasOwnProperty.call(v, 'longitude')
    ) {
      return {
        geoPointValue: {
          latitude: Number(v.latitude),
          longitude: Number(v.longitude),
        },
      };
    }
    const fields = {};
    Object.keys(v).forEach((k) => {
      fields[k] = toFirestoreValue(v[k]);
    });
    return { mapValue: { fields } };
  }
  return { stringValue: String(v) };
};

const decodeDocument = (doc) => {
  if (!doc) return null;
  const name = doc.name || '';
  const id = name.split('/').pop();
  const fields = doc.fields || {};
  const data = {};
  Object.keys(fields).forEach((k) => {
    data[k] = fromFirestoreValue(fields[k]);
  });
  return { id, ...data };
};

const toFields = (data) => {
  const fields = {};
  Object.keys(data || {}).forEach((k) => {
    fields[k] = toFirestoreValue(data[k]);
  });
  return fields;
};

const restFetchJson = async (url, options = {}, timeoutMs = DEFAULT_TIMEOUT_MS, idToken = null) => {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };
  if (idToken) {
    headers['Authorization'] = `Bearer ${idToken}`;
  }
  const response = await withTimeout(
    fetch(url, {
      ...options,
      headers,
    }),
    timeoutMs
  );

  let json = null;
  try {
    json = await response.json();
  } catch (_) {
    json = null;
  }

  if (!response.ok) {
    if (response.status === 404) {
      return null;
    }
    const msg = json?.error?.message || `HTTP ${response.status}`;
    throw new Error(`Firestore REST error: ${msg}`);
  }

  return json;
};

export const shouldUseRestFallback = () => IS_NATIVE;

export const listDocumentsRest = async (collectionPath, pageSize = 200, idToken = null) => {
  const path = encodePath(collectionPath);
  const url = `${BASE_URL}/${path}?key=${API_KEY}&pageSize=${pageSize}`;
  const json = await restFetchJson(url, {}, DEFAULT_TIMEOUT_MS, idToken);
  const documents = json?.documents || [];
  return documents.map(decodeDocument);
};

export const getDocumentRest = async (documentPath, idToken = null) => {
  const path = encodePath(documentPath);
  const url = `${BASE_URL}/${path}?key=${API_KEY}`;
  const json = await restFetchJson(url, {}, DEFAULT_TIMEOUT_MS, idToken);
  return json ? decodeDocument(json) : null;
};

export const createDocumentRest = async (collectionPath, data) => {
  const path = encodePath(collectionPath);
  const url = `${BASE_URL}/${path}?key=${API_KEY}`;
  const json = await restFetchJson(url, {
    method: 'POST',
    body: JSON.stringify({ fields: toFields(data) }),
  });
  return decodeDocument(json);
};

export const upsertDocumentRest = async (documentPath, data, idToken = null) => {
  const path = encodePath(documentPath);
  const url = `${BASE_URL}/${path}?key=${API_KEY}`;
  const json = await restFetchJson(url, {
    method: 'PATCH',
    body: JSON.stringify({ fields: toFields(data) }),
  }, DEFAULT_TIMEOUT_MS, idToken);
  return decodeDocument(json);
};

export const deleteDocumentRest = async (documentPath) => {
  const path = encodePath(documentPath);
  const url = `${BASE_URL}/${path}?key=${API_KEY}`;
  await restFetchJson(url, { method: 'DELETE' });
};

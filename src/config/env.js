

const isDev = import.meta.env.DEV;

export const HSN_GST_URL = isDev
  ? '/api/getHSNAndGST' // used in local dev server
  : 'https://us-central1-stockpilotv1.cloudfunctions.net/generateHSNAndGST';
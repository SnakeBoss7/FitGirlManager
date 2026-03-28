export const API_BASES = import.meta.env.PROD
  ? [
      'https://fitgirlmanager-udb0.onrender.com', // Priority URL
      'https://fitgirlmanager.onrender.com'       // Fallback URL
    ]
  : ['']; // Use vite proxy in dev

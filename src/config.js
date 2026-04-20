export const API_BASES = import.meta.env.PROD
  ? [
      'https://fitgirlmanager-48at.onrender.com'  // Primary URL
      // Removed suspended fallbacks to avoid console CORS errors
    ]
  : ['']; // Use vite proxy in dev

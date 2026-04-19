export const API_BASES = import.meta.env.PROD
  ? [
      'https://fitgirlmanager-48at.onrender.com',  // Primary URL (try first)
      'https://fitgirlmanager.onrender.com',        // Fallback #1
      'https://fitgirlmanager-udb0.onrender.com'   // Fallback #2
    ]
  : ['']; // Use vite proxy in dev

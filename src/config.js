export const API_BASES = import.meta.env.PROD
  ? [
      'https://fitgirlmanager.onrender.com',      // Priority URL (working)
      'https://fitgirlmanager-udb0.onrender.com'  // Fallback URL (spinning up/down)
    ]
  : ['']; // Use vite proxy in dev

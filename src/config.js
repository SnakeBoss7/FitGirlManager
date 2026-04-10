export const API_BASES = import.meta.env.PROD
  ? [
      'https://fitgirlmanager.onrender.com'
    ]
  : ['']; // Use vite proxy in dev

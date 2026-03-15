# Deployment Guide — FitGirl Repack Manager

## Architecture

```
Frontend (React/Vite)  →  Backend (FastAPI/Python)
   Vercel                     Render
```

- **Frontend** on Vercel (static site, free tier)
- **Backend** on Render (web service, free tier)

---

## 1. Deploy Backend on Render

### A. Push to GitHub

Make sure `backend/` is in your repo root.

### B. Create Render Web Service

1. Go to [render.com](https://render.com) → **New → Web Service**
2. Connect your GitHub repo
3. Configure:

| Setting | Value |
|---|---|
| **Root Directory** | `backend` |
| **Runtime** | Python |
| **Build Command** | `pip install -r requirements.txt` |
| **Start Command** | `uvicorn main:app --host 0.0.0.0 --port $PORT` |
| **Instance Type** | Free |

4. Click **Create Web Service**
5. Copy the URL (e.g. `https://fitgirl-api.onrender.com`)

---

## 2. Deploy Frontend on Vercel

### A. Update API base URL

Create `src/config.js`:
```js
export const API_BASE = import.meta.env.PROD
  ? 'https://your-render-url.onrender.com'  // ← your Render URL
  : ''  // dev uses vite proxy
```

Update `src/api.js`:
```js
import { API_BASE } from './config'

export async function scrape(url) {
  const res = await fetch(`${API_BASE}/api/scrape`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Unknown error' }))
    throw new Error(err.detail || `HTTP ${res.status}`)
  }
  return res.json()
}
```

Update proxy URLs in `App.jsx`:
```js
// Change fetch URL from /api/proxy to:
`${API_BASE}/api/proxy?url=...&filename=...`
```

### B. Update CORS on backend

In `backend/main.py`, add your Vercel domain:
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5174",
        "https://your-app.vercel.app",  # ← add this
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### C. Deploy to Vercel

1. Go to [vercel.com](https://vercel.com) → **New Project**
2. Import your GitHub repo
3. Configure:

| Setting | Value |
|---|---|
| **Framework** | Vite |
| **Root Directory** | `.` (project root) |
| **Build Command** | `npm run build` |
| **Output Directory** | `dist` |

4. Add environment variable:
   - `VITE_API_URL` = `https://your-render-url.onrender.com`

5. Click **Deploy**

---

## 3. Post-Deploy Checklist

- [ ] Backend health: `curl https://your-render-url.onrender.com/docs`
- [ ] Frontend loads at your Vercel URL
- [ ] Scraping works end-to-end
- [ ] Downloads stream correctly through the proxy
- [ ] CORS allows your Vercel domain

> **Note:** Render free tier sleeps after 15 min of inactivity. First request after sleep takes ~30s to cold-start.

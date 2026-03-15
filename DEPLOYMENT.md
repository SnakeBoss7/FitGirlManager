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

I have already created `src/config.js` for you. It now points to your Render URL:
```js
export const API_BASE = import.meta.env.PROD
  ? 'https://fitgirlmanager.onrender.com'
  : ''
```

---

### B. Update CORS on backend

I have updated `backend/main.py` with this list:
```python
        allow_origins=[
            "http://localhost:5173",
            "http://localhost:5174",
            "https://fitgirlmanager.onrender.com",
            # Add your Vercel URL here once you have it!
        ],
```

---

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

4. Click **Deploy**

---

## 3. Post-Deploy Checklist

- [ ] Backend health: `curl https://your-render-url.onrender.com/docs`
- [ ] Frontend loads at your Vercel URL
- [ ] Scraping works end-to-end
- [ ] Downloads stream correctly through the proxy
- [ ] CORS allows your Vercel domain

> **Note:** Render free tier sleeps after 15 min of inactivity. First request after sleep takes ~30s to cold-start.

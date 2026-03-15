from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes.scrape import router as scrape_router
from routes.proxy import router as proxy_router

app = FastAPI(
    title="FitGirl Repack Manager API",
    description="Scrape FitGirl repacks pages and manage download queues.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5173",
        "https://fitgirlmanager.onrender.com",
        "https://fit-girl-manager.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(scrape_router, prefix="/api")
app.include_router(proxy_router, prefix="/api")


@app.get("/api/health")
async def health():
    return {"status": "ok"}

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes.scrape import router as scrape_router
from routes.proxy import router as proxy_router
from routes.resolve import router as resolve_router

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
        "https://fitgirlmanager-udb0.onrender.com",
        "https://fitgirlmanager-48at.onrender.com",
        "https://fit-girl-manager.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Length", "Content-Disposition"],
)

app.include_router(scrape_router, prefix="/api")
app.include_router(proxy_router, prefix="/api")
app.include_router(resolve_router, prefix="/api")


@app.api_route("/api/health", methods=["GET", "HEAD"])
async def health():
    return {"status": "ok"}

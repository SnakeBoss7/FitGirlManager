import asyncio
from fastapi import APIRouter, HTTPException
from models import ScrapeRequest, ScrapeResponse, ItemStatus
from scraper import scrape_fitgirl, HEADERS
from resolver import resolve_fuckingfast
import httpx

router = APIRouter()


@router.post("/scrape", response_model=ScrapeResponse)
async def scrape(req: ScrapeRequest):
    try:
        game, size, items = await scrape_fitgirl(req.url)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Failed to fetch page: {exc}")

    if not items:
        raise HTTPException(
            status_code=404,
            detail="No supported download links found on this page.",
        )

    # Determine primary hoster label (most common non-failed hoster)
    from collections import Counter
    hoster_counts = Counter(i.hoster for i in items)
    primary_hoster = hoster_counts.most_common(1)[0][0] if hoster_counts else "unknown"

    return ScrapeResponse(
        game=game,
        hoster=primary_hoster,
        totalFiles=len(items),
        totalSizeEstimate=size,
        queue=items,
    )

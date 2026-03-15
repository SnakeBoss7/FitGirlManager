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

    # Throttle to 5 concurrent resolutions to avoid 429 rate-limiting
    sem = asyncio.Semaphore(5)

    async def _resolve(item, client):
        if item.hoster == "fuckingfast":
            async with sem:
                item.status = ItemStatus.resolving
                resolved = await resolve_fuckingfast(item.url, client)
                if resolved:
                    item.url = resolved
                    item.status = ItemStatus.pending
                else:
                    item.status = ItemStatus.failed
        return item

    # Add Referer specifically for FuckingFast so it doesn't block resolution
    res_headers = HEADERS.copy()
    res_headers["Referer"] = "https://fuckingfast.co/"

    async with httpx.AsyncClient(
        headers=res_headers,
        follow_redirects=True,
        timeout=60,
    ) as client:
        items = await asyncio.gather(*[_resolve(i, client) for i in items])
        items = list(items)

    # Determine primary hoster label (most common non-failed hoster)
    from collections import Counter
    valid = [i for i in items if i.status != ItemStatus.failed]
    hoster_counts = Counter(i.hoster for i in valid)
    primary_hoster = hoster_counts.most_common(1)[0][0] if hoster_counts else "unknown"

    return ScrapeResponse(
        game=game,
        hoster=primary_hoster,
        totalFiles=len(items),
        totalSizeEstimate=size,
        queue=items,
    )

import asyncio
from fastapi import APIRouter
from models import ResolveRequest, ResolveResponse
from resolver import resolve_fuckingfast
from routes.proxy import _shared_client

router = APIRouter()


@router.post("/resolve", response_model=ResolveResponse)
async def resolve_batch(req: ResolveRequest):
    """
    Takes a list of FuckingFast URLs and resolves them all concurrently.
    This speeds up the overall process by pre-calculating the direct download links.
    """
    
    # We only care about unique URLs to avoid redundant work
    unique_urls = list(set(req.urls))
    
    async def resolve_one(url: str):
        if "fuckingfast.co" not in url:
            return url, None
        
        # If it's already a /dl/ URL, no need to resolve
        if "/dl/" in url:
            return url, url
            
        resolved = await resolve_fuckingfast(url, _shared_client)
        return url, resolved

    # Limit concurrency for resolving to avoid triggering site-wide rate limits too hard
    # Even though resolve_fuckingfast handles 429s, we should be polite.
    sem = asyncio.Semaphore(5)

    async def sem_resolve(url: str):
        async with sem:
            return await resolve_one(url)

    tasks = [sem_resolve(url) for url in unique_urls]
    results = await asyncio.gather(*tasks)
    
    return ResolveResponse(resolved={url: res for url, res in results})

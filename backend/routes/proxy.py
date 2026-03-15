import httpx
from fastapi import APIRouter
from fastapi.responses import StreamingResponse

router = APIRouter()

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/123.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "en-US,en;q=0.9",
    "Referer": "https://fuckingfast.co/",
}

@router.get("/proxy")
async def proxy_download(url: str, filename: str):
    # 60 second inactivity timeout in case hoster hangs
    client = httpx.AsyncClient(headers=HEADERS, follow_redirects=True, timeout=60.0)
    req = client.build_request("GET", url)
    
    try:
        r = await client.send(req, stream=True)
    except Exception as e:
        await client.aclose()
        from fastapi import HTTPException
        raise HTTPException(status_code=502, detail=f"Proxy error: {str(e)}")

    async def stream_generator():
        try:
            async for chunk in r.aiter_bytes(chunk_size=65536):
                yield chunk
        finally:
            await r.aclose()
            await client.aclose()

    res_headers = {
        "Content-Disposition": f"attachment; filename=\"{filename}\""
    }
    
    if "content-length" in r.headers:
        res_headers["Content-Length"] = r.headers["content-length"]

    return StreamingResponse(
        stream_generator(),
        media_type="application/octet-stream",
        headers=res_headers
    )

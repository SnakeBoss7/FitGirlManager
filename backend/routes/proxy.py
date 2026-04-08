import httpx
from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse
import asyncio

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

# Shared client: reuses TCP connections across requests (no per-request handshake overhead)
_shared_client = httpx.AsyncClient(
    headers=HEADERS,
    follow_redirects=True,
    timeout=httpx.Timeout(connect=15.0, read=120.0, write=30.0, pool=10.0),
    limits=httpx.Limits(max_connections=20, max_keepalive_connections=10),
)


@router.get("/proxy")
async def proxy_download(url: str, filename: str, request: Request):
    from fastapi import HTTPException

    # On-the-fly URL resolution for fuckingfast (shared client, no close)
    if "fuckingfast.co" in url and "/dl/" not in url:
        from resolver import resolve_fuckingfast
        resolved = await resolve_fuckingfast(url, _shared_client)
        if not resolved:
            raise HTTPException(status_code=502, detail="Failed to resolve download URL")
        url = resolved

    # Forward Range header from the browser to enable resume
    req_headers = {}
    range_header = request.headers.get("range")
    if range_header:
        req_headers["Range"] = range_header

    req = _shared_client.build_request("GET", url, headers=req_headers)

    try:
        r = await _shared_client.send(req, stream=True)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Proxy error: {str(e)}")

    async def stream_generator():
        try:
            # 256 KB chunks — reduces syscall frequency vs 64 KB while keeping latency low
            async for chunk in r.aiter_bytes(chunk_size=262144):
                if await request.is_disconnected():
                    break
                yield chunk
        except asyncio.CancelledError:
            pass
        except Exception:
            pass
        finally:
            await r.aclose()

    res_headers = {
        "Content-Disposition": f'attachment; filename="{filename}"',
        "Cache-Control": "no-store",
        # Allow browser to send Range requests (enables resume)
        "Accept-Ranges": "bytes",
    }

    if "content-length" in r.headers:
        res_headers["Content-Length"] = r.headers["content-length"]

    # Forward content-range header if upstream returns a partial response (206)
    if "content-range" in r.headers:
        res_headers["Content-Range"] = r.headers["content-range"]

    ct = r.headers.get("content-type")
    media_type = ct if ct and ct != "application/octet-stream" else "application/octet-stream"

    # Use 206 Partial Content if upstream responded with it
    status_code = r.status_code if r.status_code in (200, 206) else 200

    return StreamingResponse(
        stream_generator(),
        status_code=status_code,
        media_type=media_type,
        headers=res_headers,
    )

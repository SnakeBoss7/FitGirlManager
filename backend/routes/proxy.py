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


@router.get("/proxy")
async def proxy_download(url: str, filename: str, request: Request):
    from fastapi import HTTPException
    client = httpx.AsyncClient(headers=HEADERS, follow_redirects=True, timeout=60.0)

    # On-the-fly URL resolution for fuckingfast
    if "fuckingfast.co" in url and "/dl/" not in url:
        from resolver import resolve_fuckingfast
        resolved = await resolve_fuckingfast(url, client)
        if not resolved:
            await client.aclose()
            raise HTTPException(status_code=502, detail="Failed to resolve download URL")
        url = resolved

    req = client.build_request("GET", url)

    try:
        r = await client.send(req, stream=True)
    except Exception as e:
        await client.aclose()
        raise HTTPException(status_code=502, detail=f"Proxy error: {str(e)}")

    async def stream_generator():
        try:
            async for chunk in r.aiter_bytes(chunk_size=65536):
                # Check if client disconnected — stop streaming to free server resources
                if await request.is_disconnected():
                    break
                yield chunk
        except asyncio.CancelledError:
            # Client cancelled the request (closed browser tab, cancelled download)
            pass
        except Exception:
            pass
        finally:
            await r.aclose()
            await client.aclose()

    res_headers = {
        "Content-Disposition": f'attachment; filename="{filename}"',
        "Cache-Control": "no-store",
    }

    if "content-length" in r.headers:
        res_headers["Content-Length"] = r.headers["content-length"]

    # Forward content-type if upstream sends one (helps browser deduce file type)
    ct = r.headers.get("content-type")
    media_type = ct if ct and ct != "application/octet-stream" else "application/octet-stream"

    return StreamingResponse(
        stream_generator(),
        media_type=media_type,
        headers=res_headers,
    )

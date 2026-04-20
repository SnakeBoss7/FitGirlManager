import re
from urllib.parse import urlparse
import asyncio
from typing import Optional
import httpx

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/123.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "en-US,en;q=0.9",
    "Referer": "https://fuckingfast.co/",
}

# Primary: extract from window.open("...") in inline script
DL_URL_RE = re.compile(r'window\.open\("(https://(?:[\w-]+\.)?fuckingfast\.co/dl/[^"]+)"')

# Fallback 1: direct <a href="..."> link to /dl/
DL_HREF_RE = re.compile(r'href=["\']+(https://(?:[\w-]+\.)?fuckingfast\.co/dl/[^"\'>\s]+)["\']')

# Fallback 2: any /dl/ URL anywhere in the page source
DL_ANYWHERE_RE = re.compile(r'(https://(?:[\w-]+\.)?fuckingfast\.co/dl/[\w\-./]+)')


def _extract_dl_url(html: str) -> Optional[str]:
    """Try multiple patterns to find the real /dl/ URL from fuckingfast page HTML."""
    m = DL_URL_RE.search(html)
    if m:
        return m.group(1)
    m = DL_HREF_RE.search(html)
    if m:
        return m.group(1)
    m = DL_ANYWHERE_RE.search(html)
    if m:
        return m.group(1)
    return None


async def resolve_fuckingfast(url: str, client: httpx.AsyncClient, max_retries: int = 5) -> Optional[str]:
    """
    Fetch a fuckingfast.co page and extract the real /dl/ download URL.
    Handles 429 rate-limiting with exponential backoff + jitter.
    Uses multiple fallback extraction strategies.
    """
    for attempt in range(max_retries):
        try:
            resp = await client.get(url)

            # Rate limited — back off exponentially
            if resp.status_code == 429:
                wait = (2 ** attempt) + 0.5  # 1.5, 2.5, 4.5, 8.5, 16.5 seconds
                await asyncio.sleep(wait)
                continue

            # Server error — short retry
            if resp.status_code >= 500:
                if attempt < max_retries - 1:
                    await asyncio.sleep(1 + attempt)
                    continue
                return None

            # Any other non-200 — give up
            if resp.status_code != 200:
                return None

            # Verify we landed on fuckingfast.co
            final_host = urlparse(str(resp.url)).netloc.lower()
            if "fuckingfast.co" not in final_host:
                return None

            # Try all extraction strategies
            dl_url = _extract_dl_url(resp.text)
            if dl_url:
                return dl_url

            # Page loaded but no /dl/ link found by any method
            return None

        except httpx.TimeoutException:
            if attempt < max_retries - 1:
                await asyncio.sleep(1 + attempt)
                continue
        except Exception:
            if attempt < max_retries - 1:
                await asyncio.sleep(1)
                continue

    return None

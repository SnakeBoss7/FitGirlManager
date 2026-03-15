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

# Regex to find the direct /dl/ URL from inline script
DL_URL_RE = re.compile(r'window\.open\("(https://fuckingfast\.co/dl/[^"]+)"')


async def resolve_fuckingfast(url: str, client: httpx.AsyncClient, max_retries: int = 5) -> Optional[str]:
    """
    Fetch a fuckingfast.co page and extract the real /dl/ download URL.
    Handles 429 rate-limiting with exponential backoff.
    """
    for attempt in range(max_retries):
        try:
            resp = await client.get(url)

            # Rate limited — back off exponentially
            if resp.status_code == 429:
                wait = 2 ** attempt  # 1, 2, 4, 8, 16 seconds
                await asyncio.sleep(wait)
                continue

            # Server error — short retry
            if resp.status_code >= 500:
                if attempt < max_retries - 1:
                    await asyncio.sleep(1)
                    continue
                return None

            # Any other non-200 — give up
            if resp.status_code != 200:
                return None

            # Verify we landed on fuckingfast.co
            final_host = urlparse(str(resp.url)).netloc.lower()
            if "fuckingfast.co" not in final_host:
                return None

            # Extract the /dl/ URL from inline script
            match = DL_URL_RE.search(resp.text)
            if match:
                return match.group(1)

            # Page loaded but no /dl/ link found
            return None

        except Exception:
            if attempt < max_retries - 1:
                await asyncio.sleep(1)
                continue

    return None

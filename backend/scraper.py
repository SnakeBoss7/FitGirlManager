import re
from urllib.parse import urlparse
import httpx
from bs4 import BeautifulSoup
from typing import List, Optional, Tuple
from models import QueueItem, ItemStatus

TRUSTED_HOSTERS = {
    "datanodes.to": "datanodes",
    "fuckingfast.co": "fuckingfast",
}

VALID_EXTENSIONS = (".rar", ".zip", ".iso", ".bin", ".7z")
PART_PATTERN = re.compile(r"\.part\d+", re.IGNORECASE)

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/123.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "en-US,en;q=0.9",
}


def _is_valid_filename(name: str) -> bool:
    """Check if filename has a known file extension or a .partNNN pattern."""
    lower = name.lower()
    if any(lower.endswith(ext) for ext in VALID_EXTENSIONS):
        return True
    if PART_PATTERN.search(lower):
        return True
    return False


def _get_hoster_key(url: str) -> Optional[str]:
    """Return the canonical hoster key if the URL domain is trusted."""
    try:
        host = urlparse(url).netloc.lower()
        for domain, key in TRUSTED_HOSTERS.items():
            if domain in host:
                return key
    except Exception:
        pass
    return None


def _extract_size_from_title(soup: BeautifulSoup) -> Optional[str]:
    """Try to pull size info from the page (FitGirl includes it in the article body)."""
    try:
        for p in soup.select("article p, .entry-content p"):
            text = p.get_text(" ", strip=True)
            if "repack size" in text.lower() or "original size" in text.lower():
                # grab something like "12.3 GB"
                m = re.search(r"[\d.,]+\s*(?:GB|MB|TB)", text, re.IGNORECASE)
                if m:
                    return m.group(0)
    except Exception:
        pass
    return None


async def scrape_fitgirl(page_url: str) -> Tuple[str, Optional[str], List[QueueItem]]:
    """
    Fetch a FitGirl Repacks page and return (game_title, size_estimate, queue_items).
    Only datanodes.to and fuckingfast.co links are collected.
    """
    async with httpx.AsyncClient(
        headers=HEADERS,
        follow_redirects=True,
        timeout=30,
    ) as client:
        resp = await client.get(page_url)
        resp.raise_for_status()
        html = resp.text

    soup = BeautifulSoup(html, "html.parser")

    # Game title
    title_el = soup.select_one("h1.entry-title")
    game_title = title_el.get_text(strip=True) if title_el else "Unknown Game"

    # Size estimate
    size_estimate = _extract_size_from_title(soup)

    # Spoiler blocks that contain download links
    # FitGirl usually has one spoiler per hoster labelled by the hoster name.
    # We collect ALL links and filter by hoster domain.
    items: List[QueueItem] = []
    idx = 1

    spoiler_contents = soup.select(".su-spoiler-content")
    for block in spoiler_contents:
        for a_tag in block.find_all("a", href=True):
            href: str = a_tag["href"].strip()
            hoster_key = _get_hoster_key(href)
            if not hoster_key:
                continue

            # Filename: prefer link text, fall back to URL last segment
            link_text = a_tag.get_text(strip=True)
            if not link_text:
                link_text = href.rstrip("/").split("/")[-1]

            # Strip the anchor fragment for filename if it looks like a filename
            # e.g. https://fuckingfast.co/v8jb5nm593lc#filename.rar
            fragment = href.split("#")[-1] if "#" in href else ""
            if fragment and _is_valid_filename(fragment):
                filename = fragment
            elif _is_valid_filename(link_text):
                filename = link_text
            else:
                # Neither looks like a real file — try fragment anyway
                filename = fragment or link_text

            if not _is_valid_filename(filename):
                # Flag as suspicious and skip
                continue

            # Force it to be just the basename (fix for datanodes returning full URLs)
            filename = filename.split("/")[-1]

            lower_name = filename.lower()
            is_language = "fg-selective-" in lower_name or "setup-fitgirl-selective-" in lower_name
            is_optional = "fg-optional" in lower_name

            items.append(
                QueueItem(
                    index=idx,
                    filename=filename,
                    url=href,
                    hoster=hoster_key,
                    status=ItemStatus.pending,
                    isLanguage=is_language,
                    isOptional=is_optional,
                )
            )
            idx += 1

    return game_title, size_estimate, items

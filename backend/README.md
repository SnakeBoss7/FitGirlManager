# FitGirl Backend Service

This is the Python 3.15 backend service that powers the FitGirl Scraper & Download Manager. 

It is built on **FastAPI** for high-performance asynchronous API routing, and utilizes **BeautifulSoup** for HTML parsing and **httpx** for async network requests.

## Architecture & Flow

The backend handles two primary responsibilities:

### 1. Scraping the FitGirl Website
**Endpoints:** `POST /api/scrape`  
**Core Files:** `routes/scrape.py`, `scraper.py`

When the user submits a FitGirl URL:
1. The backend performs an async HTTP GET request to the provided FitGirl page.
2. `scraper.py` parses the document using `BeautifulSoup`. It looks specifically inside `.su-spoiler-content` tags (which FitGirl uses to hide download links).
3. It iterates over every `<a>` tag, scanning for supported file hosters (currently locked to `fuckingfast.co`).
4. It performs basic file-name validation (e.g. looking for `.rar` extensions).
5. It flags special files (like `isLanguage` or `isOptional`) based on standard FitGirl naming conventions (`fg-selective-*`, `fg-optional-*`).
6. The compiled queue array is serialized via Pydantic (`models.py`) and passed back to the frontend.

### 2. Resolving Links and Downloading Files
**Endpoints:** `POST /api/download/stream`  
**Core Files:** `routes/download.py`, `resolver.py`, `downloader.py`

When the frontend initiates a download:
1. An asynchronous stream (Server-Sent Events) is opened between the frontend and backend.
2. A background `asyncio` task is launched, managing a semaphore pool that caps concurrent downloads (e.g., maximum 3 at a time).
3. **The Resolver Phase (`resolver.py`)**: `fuckingfast.co` links are not direct links. The backend first hits the hoster page, and uses regex scanning to extract the true `/dl/` direct URL hidden inside inline JavaScript tags on the ad page. This bypasses the need for the user to visit the site manually.
4. **The Downloader Phase (`downloader.py`)**: Using the direct link, `httpx` downloads the file chunk-by-chunk. It actively measures bytes received.
5. While downloading, the backend continuously yields `progress` events through the active SSE connection back to the React UI, reporting `bytesDone`, `total`, 'done', or 'error' statuses.
6. Checkpoint resumes (using `Range` headers) and automatic Retries are built into `downloader.py` to ensure large repacks eventually finish even if network connections drop.

## Local Setup

```bash
cd backend
pip install -r requirements.txt
python -m uvicorn main:app --reload --port 8000
```

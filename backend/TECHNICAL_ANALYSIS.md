# Performance & Logic Overview: FitGirl Download Manager

This document explains exactly how the system handles performance, data storage, and link extraction.

## 1. How it finds links (Scraping Strategy)
The system uses a **Selective DOM Scraping** approach:
*   **Targeting**: It doesn't crawl the whole site. It only targets specific `su-spoiler-content` divs (FitGirl's download link containers).
*   **Filtering**: It uses a Domain Whitelist (`fuckingfast.co`, `datanodes.to`). Any link not matching these is ignored immediately during the parse phase.
*   **Concurrent Resolution (Performance Boost)**: 
    *   Instead of resolving links one-by-one, the backend uses `asyncio.gather()`. 
    *   When you scrape a page with 100 files, the backend launches 100 simultaneous network requests to the hoster.
    *   This drops the wait time from **~3 minutes** down to **~4-5 seconds**.

## 2. Where it stores data (Storage Logic)
The system is designed to be "Diskless" on the backend side to maximize speed:
*   **Backend Storage**: **NONE.** The Python server never saves files to its own hard drive. It acts only as a "Pipe" (Stream Proxy).
*   **Frontend Storage**: **Persisted State.** The list of files (the queue) is saved in the browser's `localStorage`. If you refresh the page or close your browser, the queue is re-loaded automatically.
*   **Physical Disk Storage**: **Direct Browser Writing.** 
    *   It uses the modern **File System Access API** (`window.showDirectoryPicker`).
    *   Once you grant permission to a folder, the browser writes data chunks directly to your hard drive as they arrive.
    *   This avoids the "Save As" popup for every single file and prevents the browser from crashing due to high RAM usage.

## 3. How things are downloading (The Pipe Architecture)
The download flow is optimized for direct streaming:
1.  **Request**: The Frontend asks for a specific chunk of a file.
2.  **Proxying**: The Backend (`/api/proxy`) fetches that chunk from the file hoster (like FuckingFast).
3.  **Streaming**: The Backend immediately passess those bytes to the Frontend without saving them.
4.  **Writing**: The Frontend receives the bytes as a `ReadableStream` and writes them into the local file handle.

### Performance Statistics
*   **Concurrency**: Controlled by a user-configurable semaphore (default 3, up to 10). This prevents your internet connection from choking while still allowing parallel downloads.
*   **Memory Usage**: Extemely low. Since it uses **Stream Processing**, only a small "buffer" of the file (a few KB) exists in RAM at any given moment, even for a 100GB game.
*   **Retry Logic**: 
    *   **Backend**: 3 retries during global link resolution.
    *   **Frontend**: Manual "Retry" button for files that fail mid-stream due to router disconnects or hoster timeouts.

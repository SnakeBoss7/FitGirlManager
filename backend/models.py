from typing import Optional, List, Dict
from pydantic import BaseModel
from enum import Enum


class ItemStatus(str, Enum):
    pending = "pending"
    resolving = "resolving"
    downloading = "downloading"
    done = "done"
    failed = "failed"
    skipped = "skipped"


class QueueItem(BaseModel):
    index: int
    filename: str
    url: str
    hoster: str
    status: ItemStatus = ItemStatus.pending
    size: Optional[str] = None
    retries: int = 0
    isLanguage: bool = False
    isOptional: bool = False


class ScrapeRequest(BaseModel):
    url: str


class ScrapeResponse(BaseModel):
    game: str
    hoster: str
    totalFiles: int
    totalSizeEstimate: Optional[str] = None
    queue: List[QueueItem]


class DownloadRequest(BaseModel):
    queue: List[QueueItem]
    download_dir: Optional[str] = None  # defaults to ~/Downloads/FitGirl
    max_concurrent: int = 3


class ResolveRequest(BaseModel):
    urls: List[str]


class ResolveResponse(BaseModel):
    # Mapping of original URL to resolved URL (or none if failed)
    resolved: Dict[str, Optional[str]]

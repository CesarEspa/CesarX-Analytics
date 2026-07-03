"""Fetches recent news per ETF from NewsAPI."""

from datetime import datetime, timedelta, timezone

import httpx

from .config import settings

NEWS_API_URL = "https://newsapi.org/v2/everything"

# Search terms per tracked symbol — tuned so headlines are actually about
# what moves each fund.
QUERY_MAP: dict[str, str] = {
    "VGT": '"technology stocks" OR "tech sector" OR Nasdaq',
    "QQQ": '"Nasdaq 100" OR QQQ OR "tech stocks"',
    "VOO": '"S&P 500" OR "stock market"',
    "SPY": '"S&P 500" OR "stock market"',
    "NVDA": "Nvidia",
    "VTI": '"stock market" OR "total market"',
    "DIA": '"Dow Jones"',
    "IWM": '"Russell 2000" OR "small cap stocks"',
    "SMH": 'semiconductors OR "chip stocks"',
    "GLD": '"gold price" OR "gold market"',
}


class NewsError(Exception):
    pass


def fetch_news(symbol: str, page_size: int = 8) -> list[dict]:
    if not settings.news_api_key:
        raise NewsError("NEWS_API_KEY is not configured")

    query = QUERY_MAP.get(symbol.upper(), symbol.upper())
    since = (datetime.now(timezone.utc) - timedelta(days=7)).date().isoformat()

    response = httpx.get(
        NEWS_API_URL,
        params={
            "q": query,
            "from": since,
            "language": "en",
            "sortBy": "publishedAt",
            "pageSize": page_size,
            "apiKey": settings.news_api_key,
        },
        timeout=15,
    )

    if response.status_code != 200:
        raise NewsError(f"NewsAPI error {response.status_code}: {response.text[:200]}")

    articles = response.json().get("articles", [])
    return [
        {
            "title": a.get("title") or "",
            "description": a.get("description") or "",
            "source": (a.get("source") or {}).get("name") or "",
            "url": a.get("url") or "",
            "published_at": a.get("publishedAt") or "",
        }
        for a in articles
        if a.get("title") and a.get("title") != "[Removed]"
    ]

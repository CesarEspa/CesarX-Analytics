"""Recent news per ETF: NewsAPI when a key is configured, Yahoo Finance otherwise."""

from datetime import datetime, timedelta, timezone

import httpx
import yfinance as yf

from .config import settings

NEWS_API_URL = "https://newsapi.org/v2/everything"
MAX_AGE_DAYS = 14

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
    if settings.news_api_key:
        try:
            return _unique_titles(_fetch_newsapi(symbol, page_size * 2))[:page_size]
        except (NewsError, httpx.HTTPError):
            pass  # a quota or network problem should not leave the panel empty
    return _unique_titles(_fetch_yahoo(symbol, page_size * 2))[:page_size]


def _unique_titles(articles: list[dict]) -> list[dict]:
    """The same wire story is often republished by several outlets."""
    seen: set[str] = set()
    unique = []
    for article in articles:
        key = article["title"].rsplit(" - ", 1)[0].strip().lower()
        if key not in seen:
            seen.add(key)
            unique.append(article)
    return unique


def _fetch_newsapi(symbol: str, page_size: int) -> list[dict]:
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


def _fetch_yahoo(symbol: str, limit: int) -> list[dict]:
    try:
        items = yf.Ticker(symbol).news or []
    except Exception as e:
        raise NewsError("No se pudieron obtener las noticias en este momento.") from e

    oldest = datetime.now(timezone.utc) - timedelta(days=MAX_AGE_DAYS)
    articles: list[dict] = []
    for item in items:
        content = item.get("content") or {}
        title = content.get("title")
        published = content.get("pubDate") or ""
        link = (content.get("canonicalUrl") or {}).get("url") or (content.get("clickThroughUrl") or {}).get("url")
        if not title or not link or not published:
            continue
        try:
            if datetime.fromisoformat(published.replace("Z", "+00:00")) < oldest:
                continue
        except ValueError:
            continue
        articles.append(
            {
                "title": title,
                "description": content.get("summary") or "",
                "source": (content.get("provider") or {}).get("displayName") or "Yahoo Finance",
                "url": link,
                "published_at": published,
            }
        )
    return articles[:limit]

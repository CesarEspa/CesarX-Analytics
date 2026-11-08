from datetime import datetime, timedelta, timezone

from app import lexicon, news


def yahoo_item(title, days_ago=1):
    published = (datetime.now(timezone.utc) - timedelta(days=days_ago)).isoformat().replace("+00:00", "Z")
    return {
        "content": {
            "title": title,
            "summary": "resumen",
            "pubDate": published,
            "provider": {"displayName": "Reuters"},
            "canonicalUrl": {"url": "https://example.com/a"},
        }
    }


def test_yahoo_articles_are_mapped_and_old_ones_dropped(monkeypatch):
    fake = type("T", (), {"news": [yahoo_item("Fresh"), yahoo_item("Old", days_ago=40)]})()
    monkeypatch.setattr(news.yf, "Ticker", lambda _: fake)
    monkeypatch.setattr(news.settings, "news_api_key", "")

    articles = news.fetch_news("SPY")

    assert [a["title"] for a in articles] == ["Fresh"]
    assert articles[0]["source"] == "Reuters"
    assert articles[0]["url"] == "https://example.com/a"


def test_headline_tone():
    assert lexicon.classify("Stocks surge to record high") == "positive"
    assert lexicon.classify("Shares tumble on recession fears") == "negative"
    assert lexicon.classify("Fund publishes quarterly report") == "neutral"


def test_overall_tone_and_summary():
    articles = [{"title": "Stocks surge"}, {"title": "Stocks rally"}, {"title": "Markets slide"}]

    overall, outlook, tones = lexicon.analyze(articles)

    assert overall == "positive"
    assert tones == ["positive", "positive", "negative"]
    assert "2 tienen tono positivo" in outlook

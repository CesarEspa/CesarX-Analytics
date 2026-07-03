"""CesarX Analytics — AI microservice (Fase 2 + Fase 4).

Endpoints:
  GET /health              -> service status + which API keys are configured
  GET /predict/{symbol}    -> 1-month trend prediction (scikit-learn)
  GET /news/{symbol}       -> recent news + Claude sentiment analysis + outlook
"""

from fastapi import FastAPI, HTTPException

from .cache import TTLCache
from .config import settings
from .news import NewsError, fetch_news
from .prediction import PredictionError, predict_trend
from .sentiment import SentimentError, analyze_sentiment

app = FastAPI(
    title="CesarX Analytics — AI Service",
    version="0.1.0",
    description="Predicción de tendencia (scikit-learn) y análisis de sentimiento de noticias (NewsAPI + Claude).",
)

# Shared by symbol so repeat lookups (any user, any request) don't re-hit
# NewsAPI/Claude or re-train the model. Predictions change slowly (1-month
# trend), so they get a longer TTL than news.
predict_cache = TTLCache(ttl_seconds=6 * 3600)
news_cache = TTLCache(ttl_seconds=3 * 3600)


@app.get("/health")
def health() -> dict:
    return {
        "status": "ok",
        "news_api_configured": bool(settings.news_api_key),
        "anthropic_configured": bool(settings.anthropic_api_key),
    }


@app.get("/predict/{symbol}")
def predict(symbol: str) -> dict:
    key = symbol.upper()
    cached = predict_cache.get(key)
    if cached is not None:
        return cached

    try:
        result = predict_trend(symbol)
    except PredictionError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e
    except Exception as e:  # yfinance/network hiccups
        raise HTTPException(status_code=502, detail=f"Prediction failed for {symbol}: {e}") from e

    predict_cache.set(key, result)
    return result


@app.get("/news/{symbol}")
def news(symbol: str) -> dict:
    key = symbol.upper()
    cached = news_cache.get(key)
    if cached is not None:
        return cached

    result = _build_news_response(symbol)
    news_cache.set(key, result)
    return result


def _build_news_response(symbol: str) -> dict:
    try:
        articles = fetch_news(symbol)
    except NewsError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e

    if not articles:
        return {
            "symbol": symbol.upper(),
            "overall_sentiment": "neutral",
            "outlook": "No se encontraron noticias recientes para este ETF.",
            "articles": [],
        }

    try:
        analysis = analyze_sentiment(symbol, articles)
    except SentimentError:
        # Degrade gracefully: show headlines even when Claude isn't configured
        # or the API call fails — sentiment just comes back neutral.
        return {
            "symbol": symbol.upper(),
            "overall_sentiment": "neutral",
            "outlook": (
                "Análisis de sentimiento no disponible (configura ANTHROPIC_API_KEY en ai-service/.env). "
                "Mostrando titulares sin clasificar."
            ),
            "articles": [{**a, "sentiment": "neutral", "reason": ""} for a in articles],
        }

    sentiment_by_index = {a.index: a for a in analysis.articles}
    enriched = []
    for i, article in enumerate(articles):
        item = sentiment_by_index.get(i)
        enriched.append(
            {
                **article,
                "sentiment": item.sentiment if item else "neutral",
                "reason": item.reason if item else "",
            }
        )

    return {
        "symbol": symbol.upper(),
        "overall_sentiment": analysis.overall_sentiment,
        "outlook": analysis.outlook,
        "articles": enriched,
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app.main:app", host="0.0.0.0", port=settings.ai_service_port, reload=True)

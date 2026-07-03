"""Sentiment analysis of ETF news using the Claude API.

One Claude call classifies every headline (positive / negative / neutral for
the holder of that ETF) and writes a short outlook in Spanish answering the
question the investor actually has: given today's news, what could happen to
my position?
"""

from typing import Literal

import anthropic
from pydantic import BaseModel, Field

from .config import settings

MODEL = "claude-opus-4-8"


class SentimentError(Exception):
    pass


class ArticleSentiment(BaseModel):
    index: int = Field(description="Index of the article in the provided list, starting at 0")
    sentiment: Literal["positive", "negative", "neutral"]
    reason: str = Field(description="One short sentence in Spanish explaining the classification")


class NewsAnalysis(BaseModel):
    overall_sentiment: Literal["positive", "negative", "neutral"]
    outlook: str = Field(
        description=(
            "2-3 frases en español dirigidas a un inversor que tiene este ETF: "
            "qué podría pasar con el precio a corto plazo dado el tono de las noticias"
        )
    )
    articles: list[ArticleSentiment]


def analyze_sentiment(symbol: str, articles: list[dict]) -> NewsAnalysis:
    if not settings.anthropic_api_key:
        raise SentimentError("ANTHROPIC_API_KEY is not configured")
    if not articles:
        raise SentimentError("No articles to analyze")

    client = anthropic.Anthropic(api_key=settings.anthropic_api_key)

    articles_text = "\n".join(
        f"[{i}] {a['title']} — {a['description']} (fuente: {a['source']}, {a['published_at']})"
        for i, a in enumerate(articles)
    )

    prompt = (
        f"Eres un analista financiero. Un inversor tiene una posición en el ETF/acción {symbol.upper()}.\n"
        f"Clasifica el sentimiento de cada una de estas noticias DESDE LA PERSPECTIVA de ese inversor "
        f"(¿la noticia es buena, mala o neutral para su posición?), y luego escribe un outlook corto.\n\n"
        f"Noticias:\n{articles_text}"
    )

    try:
        response = client.messages.parse(
            model=MODEL,
            max_tokens=16000,
            thinking={"type": "adaptive"},
            messages=[{"role": "user", "content": prompt}],
            output_format=NewsAnalysis,
        )
    except anthropic.AuthenticationError as e:
        raise SentimentError("Invalid ANTHROPIC_API_KEY") from e
    except anthropic.APIStatusError as e:
        raise SentimentError(f"Claude API error {e.status_code}: {e.message}") from e
    except anthropic.APIConnectionError as e:
        raise SentimentError("Could not reach the Claude API") from e

    if response.parsed_output is None:
        raise SentimentError("Claude returned an unparseable response")

    return response.parsed_output

"""Keyword-based tone of English financial headlines, used when Claude is unavailable."""

import re
from collections import Counter

POSITIVE = {
    "beat", "beats", "boost", "boosts", "breakout", "bullish", "climb", "climbs", "gain", "gains", "growth",
    "high", "higher", "jump", "jumps", "optimism", "outperform", "outperforms", "profit", "profits", "rallies",
    "rally", "rebound", "rebounds", "record", "recovery", "rise", "rises", "soar", "soars", "strong", "surge",
    "surges", "tops", "upgrade", "upgrades", "win", "wins",
}
NEGATIVE = {
    "bearish", "concern", "concerns", "crash", "crashes", "cut", "cuts", "decline", "declines", "downgrade",
    "downgrades", "drop", "drops", "fall", "falls", "fear", "fears", "lawsuit", "loss", "losses", "lower",
    "miss", "misses", "plunge", "plunges", "recession", "risk", "risks", "selloff", "sell-off", "slide",
    "slides", "slump", "slumps", "tumble", "tumbles", "underperform", "warning", "warns", "weak", "worries",
}

LABELS = {"positive": "positivo", "negative": "negativo", "neutral": "neutral"}


def classify(text: str) -> str:
    words = re.findall(r"[a-z][a-z-]*", text.lower())
    score = sum(w in POSITIVE for w in words) - sum(w in NEGATIVE for w in words)
    if score > 0:
        return "positive"
    if score < 0:
        return "negative"
    return "neutral"


def analyze(articles: list[dict]) -> tuple[str, str, list[str]]:
    """Returns the overall tone, a Spanish summary and one tone per article."""
    tones = [classify(a["title"]) for a in articles]
    counts = Counter(tones)
    if counts["positive"] > counts["negative"]:
        overall = "positive"
    elif counts["negative"] > counts["positive"]:
        overall = "negative"
    else:
        overall = "neutral"

    outlook = (
        f"De {len(articles)} titulares recientes, {counts['positive']} tienen tono positivo, "
        f"{counts['negative']} negativo y {counts['neutral']} neutral. El tono general es {LABELS[overall]}. "
        "Es un conteo automático de palabras clave: orienta sobre el ambiente, no anticipa el precio."
    )
    return overall, outlook, tones

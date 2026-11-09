"""Turns a forecast and today's news into a plain explanation, using only computed numbers."""

from .prediction import BASELINE

_LONG_HORIZON_SESSIONS = 63
_TONES = {"positive": "positivo", "negative": "negativo", "neutral": "neutral"}
_TONE_EFFECT = {"positive": "up", "negative": "down", "neutral": "neutral"}
_METHODS = {
    "claude": "analizado por Claude",
    "keywords": "estimado por palabras clave, una lectura aproximada",
}


def _signed(value: float) -> str:
    return f"{value:+.2f}%"


def _effect_of(value: float) -> str:
    return "up" if value > 0 else "down" if value < 0 else "neutral"


def _forecast_reason(result: dict) -> dict:
    label = result["horizon_label"]
    validation = result["validation"]
    expected = _signed(result["predicted_return_pct"])
    effect = _effect_of(result["predicted_return_pct"])

    if not validation["enough_periods"]:
        periods = validation["independent_periods"]
        count = f"{periods} periodo" if periods == 1 else f"{periods} periodos"
        text = (
            f"A {label} solo hay {count} sin solapar para comprobar un modelo, y eso no alcanza para confiar en él. "
            f"La cifra ({expected}) es el promedio del activo en los últimos 10 años: lo que pasaría si se repite "
            "ese pasado, no una predicción de lo que va a ocurrir."
        )
    elif result["model"] == BASELINE:
        text = (
            f"Ningún modelo superó al promedio histórico en datos que no había visto, "
            f"así que la cifra ({expected}) es ese promedio."
        )
    else:
        strength = "con respaldo estadístico" if validation["reliable"] else "por poco y sin respaldo estadístico"
        pushes = "; ".join(f"{d['label'].lower()} ({_signed(d['impact_pct'])})" for d in result["drivers"])
        detail = f" Lo que más mueve el resultado hoy: {pushes}." if pushes else ""
        text = f"{result['model']} superó al promedio histórico {strength} y estima {expected}.{detail}"
    return {"source": "Modelo", "effect": effect, "text": text}


def _base_rate_reason(result: dict) -> dict:
    base = result["base_rate"]
    text = (
        f"Históricamente, en ventanas de {result['horizon_label']}, subió el {base['pct_up']:.0f}% de las veces. "
        f"El resultado típico fue {_signed(base['median_return_pct'])}; "
        f"el 10% peor quedó por debajo de {_signed(base['p10_return_pct'])} "
        f"y el 10% mejor por encima de {_signed(base['p90_return_pct'])}."
    )
    return {"source": "Historial", "effect": _effect_of(base["median_return_pct"]), "text": text}


def _analogs_reason(result: dict) -> dict | None:
    analogs = result["analogs"]
    if analogs is None:
        return None
    text = (
        f"Hoy está {analogs['description']}. En las {analogs['windows']} sesiones parecidas, "
        f"subió después el {analogs['pct_up']:.0f}% de las veces, con un resultado típico de "
        f"{_signed(analogs['median_return_pct'])}."
    )
    if result["horizon_sessions"] >= _LONG_HORIZON_SESSIONS:
        text += " A este plazo esas sesiones se reducen a muy pocas épocas distintas, así que es solo una referencia."
    return {"source": "Situaciones parecidas", "effect": _effect_of(analogs["median_return_pct"]), "text": text}


def _trend_reason(result: dict) -> dict:
    effect = {"bullish": "up", "bearish": "down", "mixed": "neutral"}[result["history"]["trend"]]
    return {"source": "Gráfica", "effect": effect, "text": result["history"]["summary"]}


def _risk_reason(result: dict) -> dict:
    history = result["history"]
    interval = result["interval"]
    agitated = history["volatility_pct"] > history["typical_volatility_pct"]
    consequence = (
        "Con esta agitación, el precio puede salirse del rango más de lo normal."
        if agitated
        else "No hay agitación fuera de lo normal que amplíe ese margen."
    )
    text = (
        f"El rango va de {_signed(interval['low_return_pct'])} a {_signed(interval['high_return_pct'])} y sale de los "
        f"errores pasados, no de la volatilidad actual, que es {history['volatility_pct']:.1f}% frente a "
        f"{history['typical_volatility_pct']:.1f}% normal. {consequence}"
    )
    return {"source": "Riesgo", "effect": "neutral", "text": text}


def _headlines(news: dict) -> str:
    wanted = news["overall_sentiment"]
    titles = [a["title"] for a in news["articles"] if a.get("sentiment") == wanted and wanted != "neutral"][:2]
    if not titles:
        return ""
    return " Titulares en esa línea: " + " / ".join(f"«{t}»" for t in titles) + "."


def _news_reason(result: dict, news: dict | None) -> dict:
    if not news or news.get("analysis_method") == "none" or not news.get("articles"):
        return {"source": "Noticias", "effect": "neutral", "text": "No hay noticias recientes para contrastar esta proyección."}

    tone = news["overall_sentiment"]
    method = _METHODS.get(news.get("analysis_method"), "de ejemplo")
    reach = (
        "A este plazo, lo publicado hoy suele pesar poco frente a resultados, tasas de interés y ciclo económico."
        if result["horizon_sessions"] >= _LONG_HORIZON_SESSIONS
        else "Puede pesar en el corto plazo, sobre todo si sorprende al mercado."
    )
    text = (
        f"De {len(news['articles'])} noticias recientes, el tono es {_TONES[tone]} ({method}).{_headlines(news)} "
        f"{reach} Este tono no cambia la cifra proyectada, porque no hay historial con el que validar su efecto."
    )
    return {"source": "Noticias", "effect": _TONE_EFFECT[tone], "text": text}


def _caveat(result: dict) -> str:
    validation = result["validation"]
    coverage = (
        f"En la evaluación con datos no vistos, el rango contuvo el {validation['interval_coverage_pct']:.0f}% de los "
        f"resultados, frente al {result['interval']['level']}% buscado. "
        if validation["enough_periods"]
        else "A este plazo no se puede comprobar si el rango acierta: solo resume lo ocurrido en estos 10 años. "
    )
    return (
        f"{coverage}Ningún método puede dar el precio exacto: muestra lo más probable y su margen de error. "
        "Estimación estadística, no asesoría financiera."
    )


def explain(result: dict, news: dict | None) -> dict:
    interval = result["interval"]
    verb = {"UP": "subir", "DOWN": "bajar", "SIDEWAYS": "moverse poco"}[result["direction"]]
    headline = (
        f"A {result['horizon_label']}, lo esperado es {verb}: de {result['current_price']:.2f} a "
        f"{result['predicted_price']:.2f} ({_signed(result['predicted_return_pct'])}), con un rango probable "
        f"de {interval['low_price']:.2f} a {interval['high_price']:.2f}."
    )
    reasons = [
        _forecast_reason(result),
        _base_rate_reason(result),
        _analogs_reason(result),
        _trend_reason(result),
        _risk_reason(result),
        _news_reason(result, news),
    ]
    return {"headline": headline, "reasons": [r for r in reasons if r], "caveat": _caveat(result)}

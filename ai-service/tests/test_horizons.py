import numpy as np
import pandas as pd
import pytest

from app import prediction
from app.cache import TTLCache
from app.explanation import explain


class FakeTicker:
    def __init__(self, closes):
        self.closes = closes

    def history(self, **_):
        return pd.DataFrame({"Close": self.closes})


@pytest.fixture
def ten_years(monkeypatch):
    rng = np.random.default_rng(11)
    values = 100 * np.cumprod(1 + rng.normal(0.0005, 0.01, 2500))
    closes = pd.Series(values, index=pd.bdate_range("2016-01-01", periods=2500))
    monkeypatch.setattr(prediction.yf, "Ticker", lambda _: FakeTicker(closes))
    monkeypatch.setattr(prediction, "_macro_cache", TTLCache(ttl_seconds=0))
    return closes


@pytest.mark.parametrize("key", list(prediction.HORIZONS))
def test_each_horizon_projects_exactly_that_far(ten_years, key):
    plan = prediction.HORIZONS[key]
    result = prediction.predict_trend("VGT", key)

    assert result["horizon"] == key
    assert result["horizon_days"] == plan.calendar_days
    assert len(result["forecast_path"]) == plan.sessions
    assert result["forecast_path"][-1]["expected"] == pytest.approx(result["predicted_price"], abs=0.02)
    assert result["interval"]["low_price"] <= result["predicted_price"] <= result["interval"]["high_price"]


@pytest.mark.parametrize("key", ["6m", "1y"])
def test_long_horizons_never_claim_a_validated_model(ten_years, key):
    result = prediction.predict_trend("VGT", key)

    assert result["model"] == prediction.BASELINE
    assert result["validation"]["enough_periods"] is False
    assert result["confidence"] == "LOW"
    assert result["drivers"] == []
    assert "no una predicción" in explain(result, None)["reasons"][0]["text"]


def test_unknown_horizon_is_rejected():
    with pytest.raises(prediction.PredictionError):
        prediction.predict_trend("VGT", "2y")


def test_too_little_history_for_a_long_horizon_is_an_error(monkeypatch):
    rng = np.random.default_rng(3)
    closes = pd.Series(100 * np.cumprod(1 + rng.normal(0, 0.01, 1100)), index=pd.bdate_range("2020-01-01", periods=1100))
    monkeypatch.setattr(prediction.yf, "Ticker", lambda _: FakeTicker(closes))
    monkeypatch.setattr(prediction, "_macro_cache", TTLCache(ttl_seconds=0))

    with pytest.raises(prediction.PredictionError):
        prediction.predict_trend("NEW", "1y")


def test_direction_needs_a_larger_move_at_longer_horizons():
    assert prediction.direction_for(0.03, 5) == "UP"
    assert prediction.direction_for(0.03, 252) == "SIDEWAYS"


def test_explanation_cites_news_without_claiming_it_changed_the_number(ten_years):
    result = prediction.predict_trend("VGT", "1w")
    news = {
        "analysis_method": "keywords",
        "overall_sentiment": "negative",
        "articles": [{"title": "Caen los chips", "sentiment": "negative"}, {"title": "Otra", "sentiment": "neutral"}],
    }

    explanation = explain(result, news)
    reason = next(r for r in explanation["reasons"] if r["source"] == "Noticias")

    assert reason["effect"] == "down"
    assert "Caen los chips" in reason["text"]
    assert "no cambia la cifra" in reason["text"]
    assert "exacto" in explanation["caveat"]
    assert f"{result['predicted_price']:.2f}" in explanation["headline"]


def test_explanation_survives_missing_news(ten_years):
    result = prediction.predict_trend("VGT", "1w")
    reason = next(r for r in explain(result, None)["reasons"] if r["source"] == "Noticias")
    assert "No hay noticias" in reason["text"]

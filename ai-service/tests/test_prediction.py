import numpy as np
import pandas as pd
import pytest

from app import prediction
from app.cache import TTLCache


class FakeTicker:
    def __init__(self, closes):
        self.closes = closes

    def history(self, **_):
        return pd.DataFrame({"Close": self.closes})


@pytest.mark.parametrize(
    "r2,expected",
    [
        (-0.2, "LOW"),
        (0.0, "LOW"),
        (0.0519, "LOW"),
        (0.10, "LOW"),
        (0.11, "MEDIUM"),
        (0.30, "MEDIUM"),
        (0.31, "HIGH"),
    ],
)
def test_confidence_label_follows_explained_variance(r2, expected):
    assert prediction.confidence_label(r2) == expected


def series(days, seed=7, drift=0.0005, vol=0.01):
    rng = np.random.default_rng(seed)
    values = 100 * np.cumprod(1 + rng.normal(drift, vol, days))
    return pd.Series(values, index=pd.bdate_range("2020-01-01", periods=days))


def use_history(monkeypatch, closes):
    monkeypatch.setattr(prediction.yf, "Ticker", lambda _: FakeTicker(closes))
    monkeypatch.setattr(prediction, "_macro_cache", TTLCache(ttl_seconds=0))


def test_features_do_not_use_future_prices():
    closes = series(400)
    changed = closes.copy()
    changed.iloc[300:] = changed.iloc[300:] * 3

    original = prediction._build_features(closes).iloc[:300]
    with_new_future = prediction._build_features(changed).iloc[:300]

    pd.testing.assert_frame_equal(original, with_new_future)


def test_rsi_stays_between_0_and_100():
    rsi = prediction._rsi(series(300, vol=0.03)).dropna()

    assert ((rsi >= 0) & (rsi <= 100)).all()


def test_prediction_has_consistent_values(monkeypatch):
    closes = series(1200)
    use_history(monkeypatch, closes)

    result = prediction.predict_trend("qqq")

    assert result["symbol"] == "QQQ"
    assert result["direction"] in {"UP", "DOWN", "SIDEWAYS"}
    assert result["confidence"] in {"LOW", "MEDIUM", "HIGH"}
    assert result["current_price"] == pytest.approx(closes.iloc[-1], abs=0.01)
    expected = result["current_price"] * (1 + result["predicted_return_pct"] / 100)
    assert result["predicted_price"] == pytest.approx(expected, rel=1e-3)
    # The last sessions have no known forward return, so they can't be training rows.
    assert result["trained_samples"] <= len(closes) - prediction.HORIZON_TRADING_DAYS


@pytest.mark.parametrize(
    "predicted_return,direction",
    [(0.05, "UP"), (0.011, "UP"), (0.01, "SIDEWAYS"), (-0.01, "SIDEWAYS"), (-0.011, "DOWN")],
)
def test_direction_thresholds(predicted_return, direction):
    assert prediction.direction_for(predicted_return) == direction


class RecordingModel:
    train_sizes = []

    def fit(self, X, y):
        type(self).train_sizes.append(len(X))
        return self

    def predict(self, X):
        return np.zeros(len(X))


def test_walk_forward_leaves_a_purge_gap_before_each_test_block():
    RecordingModel.train_sizes = []
    rows = 1000
    X = pd.DataFrame({"x": np.arange(rows, dtype=float)})
    y = pd.Series(np.zeros(rows))

    prediction._walk_forward(X, y, {"m": RecordingModel}, horizon=21)

    starts = prediction._fold_edges(rows)[:-1]
    assert RecordingModel.train_sizes == [int(start) - 21 for start in starts]


def test_noise_is_not_reported_as_reliable_skill():
    rng = np.random.default_rng(1)
    actual = rng.normal(0, 0.05, 600)
    predicted = rng.normal(0, 0.05, 600)

    assert not prediction._beats_benchmark_reliably(actual, predicted, np.zeros(600))


def test_real_skill_is_detected():
    rng = np.random.default_rng(2)
    actual = rng.normal(0, 0.05, 600)
    predicted = actual + rng.normal(0, 0.005, 600)

    assert prediction._beats_benchmark_reliably(actual, predicted, np.zeros(600))


def test_random_walk_never_gets_more_than_low_confidence(monkeypatch):
    use_history(monkeypatch, series(1500, seed=11))

    assert prediction.predict_trend("QQQ")["confidence"] == "LOW"


def test_forecast_path_and_interval_are_coherent(monkeypatch):
    use_history(monkeypatch, series(1200))

    result = prediction.predict_trend("QQQ")
    path = result["forecast_path"]

    assert len(path) == prediction.HORIZON_TRADING_DAYS
    assert all(a["timestamp"] < b["timestamp"] for a, b in zip(path, path[1:]))
    assert all(p["low"] <= p["expected"] <= p["high"] for p in path)
    assert path[-1]["expected"] == pytest.approx(result["predicted_price"], abs=0.02)
    assert result["interval"]["low_price"] <= result["predicted_price"] <= result["interval"]["high_price"]
    assert 0 <= result["prob_up_pct"] <= 100
    assert sum(c["selected"] for c in result["candidates"]) == 1


def test_history_description_of_a_steady_rise():
    closes = pd.Series(100 * 1.001 ** np.arange(400), index=pd.bdate_range("2023-01-02", periods=400))

    result = prediction.describe_history(closes)

    assert result["trend"] == "bullish"
    assert result["return_1m_pct"] == pytest.approx((1.001**21 - 1) * 100, abs=0.01)
    assert result["drawdown_pct"] == 0
    assert "alcista" in result["summary"]


def test_history_description_of_a_steady_fall():
    closes = pd.Series(100 * 0.999 ** np.arange(400), index=pd.bdate_range("2023-01-02", periods=400))

    assert prediction.describe_history(closes)["trend"] == "bearish"


def test_short_history_is_rejected(monkeypatch):
    use_history(monkeypatch, series(100))

    with pytest.raises(prediction.PredictionError):
        prediction.predict_trend("NEW")


def test_empty_history_is_rejected(monkeypatch):
    monkeypatch.setattr(
        prediction.yf,
        "Ticker",
        lambda _: type("Empty", (), {"history": lambda self, **__: pd.DataFrame()})(),
    )

    with pytest.raises(prediction.PredictionError):
        prediction.predict_trend("NOPE")

import numpy as np
import pandas as pd
import pytest

from app import prediction


class FakeTicker:
    def __init__(self, closes):
        self.closes = closes

    def history(self, **_):
        return pd.DataFrame({"Close": self.closes})


def series(days, seed=7, drift=0.0005, vol=0.01):
    rng = np.random.default_rng(seed)
    values = 100 * np.cumprod(1 + rng.normal(drift, vol, days))
    return pd.Series(values, index=pd.bdate_range("2020-01-01", periods=days))


def use_history(monkeypatch, closes):
    monkeypatch.setattr(prediction.yf, "Ticker", lambda _: FakeTicker(closes))


class FixedReturnModel:
    """Stands in for Ridge so the direction thresholds can be tested exactly."""

    predicted = 0.0

    def __init__(self, **_):
        pass

    def fit(self, X, y):
        return self

    def predict(self, X):
        return np.full(len(X), type(self).predicted)


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
    # The last 21 sessions have no known forward return, so they can't be training rows.
    assert result["trained_samples"] <= len(closes) - prediction.HORIZON_TRADING_DAYS


@pytest.mark.parametrize(
    "predicted_return,direction",
    [(0.05, "UP"), (0.021, "UP"), (0.02, "SIDEWAYS"), (-0.02, "SIDEWAYS"), (-0.021, "DOWN")],
)
def test_direction_thresholds(monkeypatch, predicted_return, direction):
    use_history(monkeypatch, series(1200))
    FixedReturnModel.predicted = predicted_return
    monkeypatch.setattr(prediction, "Ridge", FixedReturnModel)

    assert prediction.predict_trend("QQQ")["direction"] == direction


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

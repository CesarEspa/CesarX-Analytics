"""1-month trend prediction with scikit-learn.

Trains a Ridge regression per symbol on ~5 years of daily closes from Yahoo
Finance. Features are simple technical indicators; the target is the forward
21-trading-day return (~1 calendar month). A time-ordered holdout (last 20%)
provides an honest R² that is mapped to a coarse confidence label.

This is intentionally a basic, explainable model — it demonstrates the ML
pipeline (features -> train -> validate -> predict) rather than trying to
beat the market.
"""

from datetime import datetime, timezone

import numpy as np
import pandas as pd
import yfinance as yf
from sklearn.linear_model import Ridge
from sklearn.metrics import r2_score

HORIZON_TRADING_DAYS = 21  # ~1 calendar month
MIN_SAMPLES = 250


class PredictionError(Exception):
    pass


def _rsi(closes: pd.Series, window: int = 14) -> pd.Series:
    delta = closes.diff()
    gain = delta.clip(lower=0).rolling(window).mean()
    loss = (-delta.clip(upper=0)).rolling(window).mean()
    rs = gain / loss.replace(0, np.nan)
    return 100 - (100 / (1 + rs))


def _build_features(closes: pd.Series) -> pd.DataFrame:
    df = pd.DataFrame(index=closes.index)
    df["ret_5"] = closes.pct_change(5)
    df["ret_10"] = closes.pct_change(10)
    df["ret_21"] = closes.pct_change(21)
    df["ret_63"] = closes.pct_change(63)
    df["sma5_over_sma20"] = closes.rolling(5).mean() / closes.rolling(20).mean() - 1
    df["sma20_over_sma50"] = closes.rolling(20).mean() / closes.rolling(50).mean() - 1
    df["volatility_21"] = closes.pct_change().rolling(21).std()
    df["rsi_14"] = _rsi(closes) / 100
    return df


def confidence_label(r2: float) -> str:
    """Label from out-of-sample R²: HIGH needs over 30% of variance explained."""
    if r2 > 0.30:
        return "HIGH"
    if r2 > 0.10:
        return "MEDIUM"
    return "LOW"


def predict_trend(symbol: str) -> dict:
    history = yf.Ticker(symbol).history(period="5y", interval="1d", auto_adjust=True)
    if history.empty or "Close" not in history:
        raise PredictionError(f"No price history available for {symbol}")

    closes = history["Close"].dropna()
    if len(closes) < MIN_SAMPLES:
        raise PredictionError(f"Not enough history for {symbol} ({len(closes)} days)")

    features = _build_features(closes)
    target = closes.shift(-HORIZON_TRADING_DAYS) / closes - 1  # forward 1-month return

    data = features.copy()
    data["target"] = target
    latest_features = features.iloc[[-1]].dropna()
    data = data.dropna()

    if len(data) < MIN_SAMPLES or latest_features.empty:
        raise PredictionError(f"Not enough clean samples to train for {symbol}")

    X = data.drop(columns=["target"])
    y = data["target"]

    # Time-ordered split: train on the first 80%, validate on the last 20%.
    split = int(len(data) * 0.8)
    model = Ridge(alpha=1.0)
    model.fit(X.iloc[:split], y.iloc[:split])
    r2 = r2_score(y.iloc[split:], model.predict(X.iloc[split:]))

    # Refit on everything before predicting from today's features.
    model.fit(X, y)
    predicted_return = float(model.predict(latest_features)[0])

    current_price = float(closes.iloc[-1])
    predicted_price = current_price * (1 + predicted_return)

    if predicted_return > 0.02:
        direction = "UP"
    elif predicted_return < -0.02:
        direction = "DOWN"
    else:
        direction = "SIDEWAYS"

    confidence = confidence_label(r2)

    return {
        "symbol": symbol.upper(),
        "horizon_days": 30,
        "current_price": round(current_price, 2),
        "predicted_price": round(predicted_price, 2),
        "predicted_return_pct": round(predicted_return * 100, 2),
        "direction": direction,
        "confidence": confidence,
        "model": "Ridge regression (scikit-learn), forward 21-trading-day return",
        "holdout_r2": round(float(r2), 4),
        "trained_samples": int(len(data)),
        "as_of": datetime.now(timezone.utc).isoformat(),
    }

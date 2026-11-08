"""One-week ETF return forecast, validated the way a time series must be.

Pipeline: ~10 years of daily data -> leakage-free features (price, volume,
volatility, VIX, 10Y yields) -> purged walk-forward validation of several
models against a historical-mean benchmark -> model chosen on the earlier
folds, scored on later folds it never saw -> conformal interval from
out-of-sample errors.

Short-term returns are close to unpredictable, so a model is only used when it
beats the benchmark on the untouched folds. Otherwise the forecast falls back
to the historical mean and the response says so.
"""

from datetime import datetime, timezone
from math import ceil

import numpy as np
import pandas as pd
import yfinance as yf
from sklearn.dummy import DummyRegressor
from sklearn.ensemble import HistGradientBoostingRegressor, RandomForestRegressor
from sklearn.linear_model import Ridge
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

from .cache import TTLCache

HORIZON_TRADING_DAYS = 5  # one week: less than half the margin of a one-month forecast
DIRECTION_THRESHOLD = 0.01
HISTORY_PERIOD = "10y"
MIN_SAMPLES = 500
WALK_FORWARD_FOLDS = 5
SELECTION_FOLDS = 3
INTERVAL_LEVEL = 80
BASELINE = "Media histórica"
ENSEMBLE = "Ensamble"
SEED = 42

MACRO_SYMBOLS = {"vix": "^VIX", "tnx": "^TNX"}
_macro_cache = TTLCache(ttl_seconds=6 * 3600)

FACTOR_LABELS = {
    "ret_5": "Retorno de 5 días",
    "ret_21": "Retorno de 1 mes",
    "ret_63": "Retorno de 3 meses",
    "ret_126": "Retorno de 6 meses",
    "ret_252": "Retorno de 12 meses",
    "sma5_over_sma20": "Media de 5 días frente a 20",
    "sma20_over_sma50": "Media de 20 días frente a 50",
    "dist_sma200": "Distancia a la media de 200 días",
    "volatility_21": "Volatilidad de 1 mes",
    "vol_ratio": "Volatilidad reciente frente a 3 meses",
    "drawdown_252": "Caída desde el máximo anual",
    "rsi_14": "RSI de 14 días",
    "volume_z": "Volumen frente a su media",
    "vix": "Nivel del VIX",
    "vix_change": "Cambio mensual del VIX",
    "tnx_change": "Cambio mensual del bono a 10 años",
}


class PredictionError(Exception):
    pass


def _rsi(closes: pd.Series, window: int = 14) -> pd.Series:
    delta = closes.diff()
    gain = delta.clip(lower=0).rolling(window).mean()
    loss = (-delta.clip(upper=0)).rolling(window).mean()
    rs = gain / loss.replace(0, np.nan)
    return 100 - (100 / (1 + rs))


def _build_features(closes: pd.Series, volume: pd.Series | None = None) -> pd.DataFrame:
    """Every value at date t uses only data known at the close of t."""
    daily = closes.pct_change()
    df = pd.DataFrame(index=closes.index)
    for days in (5, 21, 63, 126, 252):
        df[f"ret_{days}"] = closes.pct_change(days)
    df["sma5_over_sma20"] = closes.rolling(5).mean() / closes.rolling(20).mean() - 1
    df["sma20_over_sma50"] = closes.rolling(20).mean() / closes.rolling(50).mean() - 1
    df["dist_sma200"] = closes / closes.rolling(200).mean() - 1
    df["volatility_21"] = daily.rolling(21).std()
    df["vol_ratio"] = df["volatility_21"] / daily.rolling(63).std()
    df["drawdown_252"] = closes / closes.rolling(252).max() - 1
    df["rsi_14"] = _rsi(closes) / 100
    if volume is not None and (volume > 0).mean() > 0.95:
        log_volume = np.log(volume.where(volume > 0))
        df["volume_z"] = (log_volume - log_volume.rolling(63).mean()) / log_volume.rolling(63).std()
    return df


def _normalized(series: pd.Series) -> pd.Series:
    index = pd.DatetimeIndex(series.index)
    if index.tz is not None:
        index = index.tz_localize(None)
    return pd.Series(series.to_numpy(), index=index.normalize()).dropna()


def _macro_closes() -> dict[str, pd.Series]:
    cached = _macro_cache.get("macro")
    if cached is not None:
        return cached

    result: dict[str, pd.Series] = {}
    for name, ticker in MACRO_SYMBOLS.items():
        try:
            history = yf.Ticker(ticker).history(period=HISTORY_PERIOD, interval="1d", auto_adjust=True)
            if not history.empty and "Close" in history:
                result[name] = _normalized(history["Close"])
        except Exception:  # macro data is an enhancement: forecasts work without it
            continue
    _macro_cache.set("macro", result)
    return result


def _add_macro_features(features: pd.DataFrame) -> pd.DataFrame:
    macro = _macro_closes()
    df = features.copy()
    if "vix" in macro:
        vix = macro["vix"].reindex(df.index).ffill()
        df["vix"] = vix
        df["vix_change"] = vix.pct_change(21)
    if "tnx" in macro:
        df["tnx_change"] = macro["tnx"].reindex(df.index).ffill().diff(21)
    # A macro series that barely overlaps must not shrink the training set.
    optional = [c for c in ("vix", "vix_change", "tnx_change") if c in df]
    too_sparse = [c for c in optional if df[c].iloc[300:].isna().mean() > 0.02]
    return df.drop(columns=too_sparse)


def _model_builders() -> dict:
    return {
        BASELINE: lambda: DummyRegressor(strategy="mean"),
        "Ridge": lambda: make_pipeline(StandardScaler(), Ridge(alpha=50.0)),
        "Random Forest": lambda: RandomForestRegressor(
            n_estimators=80, max_depth=4, min_samples_leaf=40, max_features=0.5, random_state=SEED
        ),
        "Gradient Boosting": lambda: HistGradientBoostingRegressor(
            max_iter=80, learning_rate=0.04, max_depth=3, min_samples_leaf=40, l2_regularization=1.0, random_state=SEED
        ),
    }


def _fold_edges(n: int, folds: int = WALK_FORWARD_FOLDS) -> np.ndarray:
    return np.linspace(n // 2, n, folds + 1, dtype=int)


def _walk_forward(X: pd.DataFrame, y: pd.Series, builders: dict, horizon: int = HORIZON_TRADING_DAYS) -> dict:
    """Out-of-sample predictions; training stops `horizon` rows before each test block."""
    predictions = {name: np.full(len(X), np.nan) for name in builders}
    edges = _fold_edges(len(X))
    for start, end in zip(edges[:-1], edges[1:]):
        train_end = start - horizon
        for name, build in builders.items():
            model = build().fit(X.iloc[:train_end], y.iloc[:train_end])
            predictions[name][start:end] = model.predict(X.iloc[start:end])
    return predictions


def _with_ensemble(predictions: dict) -> dict:
    members = [p for name, p in predictions.items() if name != BASELINE]
    return {**predictions, ENSEMBLE: np.mean(members, axis=0)}


def _r2_against(actual: np.ndarray, predicted: np.ndarray, benchmark: np.ndarray) -> float:
    """Out-of-sample R²: 1 means perfect, 0 means no better than the benchmark."""
    denominator = float(np.sum((actual - benchmark) ** 2))
    if denominator == 0:
        return 0.0
    return 1 - float(np.sum((actual - predicted) ** 2)) / denominator


def _beats_benchmark_reliably(
    actual: np.ndarray, predicted: np.ndarray, benchmark: np.ndarray, block: int = HORIZON_TRADING_DAYS
) -> bool:
    """One-sided 95% block bootstrap on the squared-error gap (returns overlap, so blocks)."""
    gap = (actual - benchmark) ** 2 - (actual - predicted) ** 2
    if len(gap) <= block or gap.mean() <= 0:
        return False
    rng = np.random.default_rng(SEED)
    blocks = ceil(len(gap) / block)
    starts = rng.integers(0, len(gap) - block + 1, size=(1000, blocks))
    indices = (starts[:, :, None] + np.arange(block)).reshape(1000, -1)
    return bool(np.quantile(gap[indices].mean(axis=1), 0.05) > 0)


def confidence_label(r2: float) -> str:
    """Label from out-of-sample R²: HIGH needs over 30% of variance explained."""
    if r2 > 0.30:
        return "HIGH"
    if r2 > 0.10:
        return "MEDIUM"
    return "LOW"


def direction_for(predicted_return: float) -> str:
    if predicted_return > DIRECTION_THRESHOLD:
        return "UP"
    if predicted_return < -DIRECTION_THRESHOLD:
        return "DOWN"
    return "SIDEWAYS"


def _interval_quantiles(residuals: np.ndarray) -> tuple[float, float]:
    tail = (100 - INTERVAL_LEVEL) / 200
    return float(np.quantile(residuals, tail)), float(np.quantile(residuals, 1 - tail))


def _top_factors(model, X: pd.DataFrame, y: pd.Series, limit: int = 3) -> list[dict]:
    """Permutation importance: how much error grows when a feature is scrambled."""
    rng = np.random.default_rng(SEED)
    base_error = np.abs(y.to_numpy() - model.predict(X)).mean()
    scores = {}
    for column in X.columns:
        shuffled = X.copy()
        shuffled[column] = rng.permutation(shuffled[column].to_numpy())
        scores[column] = float(np.abs(y.to_numpy() - model.predict(shuffled)).mean() - base_error)
    total = sum(max(s, 0) for s in scores.values())
    if total <= 0:
        return []
    ranked = sorted(scores.items(), key=lambda item: item[1], reverse=True)[:limit]
    return [
        {"feature": name, "label": FACTOR_LABELS.get(name, name), "weight_pct": round(100 * score / total, 1)}
        for name, score in ranked
        if score > 0
    ]


def describe_history(closes: pd.Series) -> dict:
    """What the chart has actually done, in numbers and one plain sentence."""
    last = float(closes.iloc[-1])

    def change(days: int) -> float | None:
        return round((last / float(closes.iloc[-days - 1]) - 1) * 100, 2) if len(closes) > days else None

    year = closes.iloc[-252:]
    sma50 = float(closes.rolling(50).mean().iloc[-1])
    sma200 = float(closes.rolling(200).mean().iloc[-1])
    daily = closes.pct_change().dropna()
    volatility = float(daily.iloc[-21:].std() * np.sqrt(252) * 100)
    typical_volatility = float(daily.iloc[-252:].rolling(21).std().dropna().median() * np.sqrt(252) * 100)
    high = float(year.max())
    drawdown = (last / high - 1) * 100
    rsi = float(_rsi(closes).iloc[-1])

    if last > sma50 > sma200:
        trend, trend_text = "bullish", "alcista: el precio está sobre sus medias de 50 y 200 días"
    elif last < sma50 < sma200:
        trend, trend_text = "bearish", "bajista: el precio está bajo sus medias de 50 y 200 días"
    else:
        trend, trend_text = "mixed", "mixta: el precio y sus medias de 50 y 200 días no están alineados"

    if volatility > typical_volatility * 1.25:
        volatility_text = "más agitado de lo normal"
    elif volatility < typical_volatility * 0.8:
        volatility_text = "más tranquilo de lo normal"
    else:
        volatility_text = "dentro de lo normal"

    if rsi >= 70:
        rsi_text = " El RSI indica sobrecompra."
    elif rsi <= 30:
        rsi_text = " El RSI indica sobreventa."
    else:
        rsi_text = ""

    place = "en su máximo anual" if drawdown > -0.5 else f"a {abs(drawdown):.1f}% de su máximo anual"
    summary = f"Tendencia {trend_text}. Está {place} y el último mes ha sido {volatility_text}.{rsi_text}"

    return {
        "trend": trend,
        "summary": summary,
        "return_1m_pct": change(21),
        "return_3m_pct": change(63),
        "return_6m_pct": change(126),
        "return_1y_pct": change(252),
        "volatility_pct": round(volatility, 1),
        "typical_volatility_pct": round(typical_volatility, 1),
        "drawdown_pct": round(drawdown, 2),
        "high_52w": round(high, 2),
        "low_52w": round(float(year.min()), 2),
        "sma50": round(sma50, 2),
        "sma200": round(sma200, 2),
        "rsi": round(rsi, 1),
    }


def _forecast_path(last_date: pd.Timestamp, price: float, log_return: float, low: float, high: float) -> list[dict]:
    """Daily path to the horizon: drift grows linearly, uncertainty with the square root of time."""
    dates = pd.bdate_range(last_date + pd.Timedelta(days=1), periods=HORIZON_TRADING_DAYS)
    path = []
    for step, date in enumerate(dates, start=1):
        fraction = step / HORIZON_TRADING_DAYS
        root = np.sqrt(fraction)
        center = log_return * fraction
        path.append(
            {
                "date": date.date().isoformat(),
                "timestamp": int(date.tz_localize("UTC").timestamp()) + 20 * 3600,
                "expected": round(price * float(np.exp(center)), 2),
                "low": round(price * float(np.exp(center + low * root)), 2),
                "high": round(price * float(np.exp(center + high * root)), 2),
            }
        )
    return path


def _candidate_report(actual: np.ndarray, predictions: dict, benchmark: np.ndarray, chosen: str) -> list[dict]:
    report = []
    for name, predicted in predictions.items():
        report.append(
            {
                "name": name,
                "r2_oos": round(_r2_against(actual, predicted, benchmark), 4),
                "mae_pct": round(float(np.abs(actual - predicted).mean()) * 100, 2),
                "directional_accuracy_pct": round(float(np.mean(np.sign(predicted) == np.sign(actual))) * 100, 1),
                "selected": name == chosen,
            }
        )
    return report


def predict_trend(symbol: str) -> dict:
    history = yf.Ticker(symbol).history(period=HISTORY_PERIOD, interval="1d", auto_adjust=True)
    if history.empty or "Close" not in history:
        raise PredictionError(f"No price history available for {symbol}")

    closes = _normalized(history["Close"])
    if len(closes) < MIN_SAMPLES:
        raise PredictionError(f"Not enough history for {symbol} ({len(closes)} days)")

    volume = _normalized(history["Volume"]).reindex(closes.index) if "Volume" in history else None
    features = _add_macro_features(_build_features(closes, volume))
    target = np.log(closes.shift(-HORIZON_TRADING_DAYS) / closes).rename("target")

    latest_features = features.iloc[[-1]].dropna()
    data = features.join(target).dropna()
    if len(data) < MIN_SAMPLES or latest_features.empty:
        raise PredictionError(f"Not enough clean samples to train for {symbol}")

    X = data.drop(columns=["target"])
    y = data["target"]

    builders = _model_builders()
    predictions = _with_ensemble(_walk_forward(X, y, builders, HORIZON_TRADING_DAYS))
    edges = _fold_edges(len(X))
    selection = np.arange(edges[0], edges[SELECTION_FOLDS] - HORIZON_TRADING_DAYS)
    holdout = np.arange(edges[SELECTION_FOLDS], len(X))
    actual = y.to_numpy()

    # Choose on the selection folds; the holdout folds stay untouched for the score.
    selection_scores = {
        name: _r2_against(actual[selection], p[selection], predictions[BASELINE][selection])
        for name, p in predictions.items()
        if name != BASELINE
    }
    best = max(selection_scores, key=selection_scores.get)

    benchmark = predictions[BASELINE][holdout]
    best_holdout = predictions[best][holdout]
    r2 = _r2_against(actual[holdout], best_holdout, benchmark)
    reliable = _beats_benchmark_reliably(actual[holdout], best_holdout, benchmark, HORIZON_TRADING_DAYS)
    used = best if r2 > 0 else BASELINE

    # Interval calibrated on earlier errors, then checked against the holdout.
    used_oos = predictions[used]
    low_q, high_q = _interval_quantiles(actual[selection] - used_oos[selection])
    coverage = float(
        np.mean((actual[holdout] >= used_oos[holdout] + low_q) & (actual[holdout] <= used_oos[holdout] + high_q))
    )

    # Final fit on all labelled rows, then forecast from today's features.
    fit = {name: build().fit(X, y) for name, build in builders.items()}
    today = latest_features[X.columns]
    today_by_model = {name: float(model.predict(today)[0]) for name, model in fit.items()}
    if used == ENSEMBLE:
        log_return = float(np.mean([v for k, v in today_by_model.items() if k != BASELINE]))
    else:
        log_return = today_by_model[used]

    residuals = actual[edges[0]:] - used_oos[edges[0]:]
    final_low, final_high = _interval_quantiles(residuals)
    prob_up = float(np.mean(log_return + residuals > 0)) * 100

    explainer = fit["Gradient Boosting" if best == ENSEMBLE else best]
    current_price = float(closes.iloc[-1])
    predicted_return = float(np.exp(log_return) - 1)

    return {
        "symbol": symbol.upper(),
        "horizon_days": 7,
        "current_price": round(current_price, 2),
        "predicted_price": round(current_price * (1 + predicted_return), 2),
        "predicted_return_pct": round(predicted_return * 100, 2),
        "direction": direction_for(predicted_return),
        "confidence": confidence_label(r2) if reliable else "LOW",
        "model": used,
        "best_candidate": best,
        "holdout_r2": round(r2, 4),
        "trained_samples": int(len(data)),
        "prob_up_pct": round(prob_up, 1),
        "interval": {
            "level": INTERVAL_LEVEL,
            "low_price": round(current_price * float(np.exp(log_return + final_low)), 2),
            "high_price": round(current_price * float(np.exp(log_return + final_high)), 2),
            "low_return_pct": round(float(np.exp(log_return + final_low) - 1) * 100, 2),
            "high_return_pct": round(float(np.exp(log_return + final_high) - 1) * 100, 2),
        },
        "validation": {
            "method": f"Walk-forward de {WALK_FORWARD_FOLDS} bloques con purga de {HORIZON_TRADING_DAYS} sesiones",
            "holdout_rows": int(len(holdout)),
            "independent_periods": int(len(holdout) // HORIZON_TRADING_DAYS),
            "beats_baseline": r2 > 0,
            "reliable": reliable,
            "interval_coverage_pct": round(coverage * 100, 1),
            "baseline_directional_accuracy_pct": round(float(np.mean(actual[holdout] > 0)) * 100, 1),
        },
        "candidates": _candidate_report(actual[holdout], {n: p[holdout] for n, p in predictions.items()}, benchmark, used),
        "top_factors": _top_factors(explainer, X.iloc[edges[0]:], y.iloc[edges[0]:]),
        "history": describe_history(closes),
        "forecast_path": _forecast_path(closes.index[-1], current_price, log_return, final_low, final_high),
        "as_of": datetime.now(timezone.utc).isoformat(),
    }

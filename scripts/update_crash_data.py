#!/usr/bin/env python3
"""Update the crash dashboard indicator data (crash/crash_indicators_data.json).

Fetches live market data from Yahoo Finance, then uses OpenAI Responses API
with web search to fill in indicators that aren't available via free APIs and
to generate interpretations.
"""

import json
import os
import sys
from datetime import datetime, timezone

import yfinance as yf
from openai import OpenAI

OUTPUT_PATH = os.path.normpath(
    os.path.join(os.path.dirname(__file__), "..", "crash", "crash_indicators_data.json")
)


def fetch_market_data():
    """Fetch quantitative market data from Yahoo Finance."""
    data = {}

    # --- VIX ---
    try:
        vix = yf.Ticker("^VIX")
        hist = vix.history(period="1y")
        if not hist.empty:
            data["vix"] = {
                "current_value": round(float(hist["Close"].iloc[-1]), 2),
                "as_of_date": hist.index[-1].strftime("%Y-%m-%d"),
                "range_52w_low": round(float(hist["Close"].min()), 2),
                "range_52w_high": round(float(hist["Close"].max()), 2),
            }
    except Exception as exc:
        print(f"Warning: VIX fetch failed: {exc}", file=sys.stderr)

    # --- S&P 500 ---
    try:
        sp = yf.Ticker("^GSPC")
        hist = sp.history(period="2y")
        if not hist.empty:
            close = hist["Close"]
            price = float(close.iloc[-1])
            ma50 = float(close.rolling(50).mean().iloc[-1])
            ma200 = float(close.rolling(200).mean().iloc[-1])

            # RSI-14
            delta = close.diff()
            gain = delta.where(delta > 0, 0.0).rolling(14).mean().iloc[-1]
            loss = (-delta.where(delta < 0, 0.0)).rolling(14).mean().iloc[-1]
            rsi = 100.0 - (100.0 / (1.0 + float(gain) / float(loss))) if loss else 100.0

            high_52w = float(close[-252:].max()) if len(close) >= 252 else float(close.max())
            ath = float(close.max())

            data["sp500"] = {
                "current_price": round(price, 2),
                "as_of_date": hist.index[-1].strftime("%Y-%m-%d"),
                "ma_50": round(ma50, 2),
                "ma_200": round(ma200, 2),
                "pct_above_50dma": round((price / ma50 - 1) * 100, 2),
                "pct_above_200dma": round((price / ma200 - 1) * 100, 2),
                "rsi_14": round(rsi, 2),
                "high_52w": round(high_52w, 2),
                "ath": round(ath, 2),
                "drawdown_from_52w_high_pct": round((1 - price / high_52w) * 100, 2),
                "drawdown_from_ath_pct": round((1 - price / ath) * 100, 2),
            }
    except Exception as exc:
        print(f"Warning: S&P 500 fetch failed: {exc}", file=sys.stderr)

    # --- Treasury yields (10Y & 2Y via Yahoo Finance) ---
    try:
        tnx = yf.Ticker("^TNX")  # 10-year yield × 10
        twy = yf.Ticker("^IRX")  # 13-week T-bill (2Y not directly on YF, approximate)
        h10 = tnx.history(period="5d")
        # Try 2-year via "2YY=F" or just use 10Y for now
        try:
            t2y = yf.Ticker("^TYX")  # 30-year as proxy fallback
            h2 = t2y.history(period="5d")
        except Exception:
            h2 = None

        if not h10.empty:
            y10 = float(h10["Close"].iloc[-1])
            data["treasury_10y"] = round(y10, 3)
            data["treasury_10y_date"] = h10.index[-1].strftime("%Y-%m-%d")
    except Exception as exc:
        print(f"Warning: Treasury yield fetch failed: {exc}", file=sys.stderr)

    return data


def generate_crash_json(market_data):
    """Use OpenAI Responses API + web search to build the full JSON."""
    client = OpenAI()
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    generated_at = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    prompt = f"""You are a senior financial analyst. Generate a comprehensive, accurate
market crash indicators JSON dataset for today ({today}).

### Real market data fetched just now from Yahoo Finance:
```json
{json.dumps(market_data, indent=2)}
```

### Output specification

Produce a single JSON object with these top-level keys (follow the structure
EXACTLY — the front-end dashboard parses each field):

1. **metadata** — generated_at ("{generated_at}"), analysis_date, data_source,
   disclaimer, dashboard_version "1.0".

2. **sentiment_indicators**
   - `vix`: Use real VIX data above. Include name, variant, current_value,
     unit, as_of_date, historical_average, normal_range, lookback_period,
     range_52w (low/high/percentile), risk_level, interpretation, source,
     methodology_note, freshness_days.
   - `put_call_ratio`: CBOE total put/call ratio + sub_metrics.
   - `fear_greed_index`: CNN Fear & Greed composite 0-100 + source_bands,
     current_category, recent_history, components.

3. **valuation_indicators**
   - `shiller_cape`: Cyclically Adjusted PE Ratio with historical context,
     implied_future_return, valuation_thresholds.
   - `buffett_indicator`: Wilshire 5000 / GDP with components,
     warren_buffett_zones.

4. **macro_indicators**
   - `yield_curve_10y2y`: 10Y-2Y spread, recent_values, inversion_check,
     recession_signal.

5. **technical_indicators**
   - `sp500_technicals`: Use real S&P data above. Sub-indicators for
     price_vs_50dma, price_vs_200dma, rsi_14, drawdown_52w, drawdown_ath.
     Each with name, value, unit, risk_level, interpretation.
     Overall risk_level and overall_interpretation.

6. **market_breadth**
   - `sp500_above_50dma`, `sp500_above_200dma`, `advance_decline_ratio`,
     `overall_breadth_assessment`.

7. **leverage_indicators**
   - `finra_margin_debt` with relative_metrics, risks, regulatory_note.

8. **private_credit_indicators**
   - `overview`, `default_rates` (with breakdown), `borrower_health`,
     `pik_usage`, `liquidity_risk` (with gated_funds list),
     `bank_interconnectedness` (with major_exposures),
     `shadow_defaults`, `sector_vulnerabilities` (sectors array),
     `systemic_risk_assessment` (crash_transmission_channels,
     mitigating_factors, comparison_to_2008, regulatory_gaps).

9. **overall_assessment**
   - generated_at, analysis_date, overall_crash_risk_level (one of LOW /
     MODERATE / ELEVATED / HIGH / EXTREME), confidence 0-10,
     risk_categories (near_term_stress, valuation_vulnerability,
     technical_regime, market_structure, macro_environment, private_credit),
     key_warnings (array of strings), mitigating_factors,
     scenario_analysis (base_case, correction_case, crash_case each with
     probability, outlook, description, timeframe, triggers),
     recommendation_framework (risk_management, monitoring,
     timeframe_considerations), historical_context, disclaimer.

### Rules
- Use the REAL market data provided for VIX and S&P 500 fields.
- For every other indicator, search the web for the most current value and
  set freshness_days to the number of days since that value was published.
- All numeric values must be JSON numbers (not strings).
- risk_level values: "Low", "Moderate", "Elevated", "High".
- Output ONLY raw JSON — no markdown fences, no commentary, no explanation."""

    response = client.responses.create(
        model="gpt-4o",
        tools=[{"type": "web_search_preview"}],
        input=prompt,
    )

    text = response.output_text.strip()
    if text.startswith("```"):
        text = text[text.index("\n") + 1 :]
    if text.endswith("```"):
        text = text[:-3]
    text = text.strip()

    return json.loads(text)


def main():
    print("Fetching market data from Yahoo Finance …")
    market_data = fetch_market_data()
    for key, val in market_data.items():
        if isinstance(val, dict):
            print(f"  {key}: {json.dumps(val)}")
        else:
            print(f"  {key}: {val}")

    print("Generating crash indicators JSON via OpenAI …")
    crash_json = generate_crash_json(market_data)

    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    with open(OUTPUT_PATH, "w", encoding="utf-8") as fh:
        json.dump(crash_json, fh, indent=2)
        fh.write("\n")

    print(f"✓ Crash data written to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()

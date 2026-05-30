#!/usr/bin/env python3
"""Generate the daily morning briefing HTML page.

Uses weather.gov for real weather data and Anthropic Claude API with
web search to curate current news articles.
"""

import json
import os
import sys
from datetime import datetime, timezone, timedelta

import anthropic
import requests

DAILY_DIR = os.path.join(os.path.dirname(__file__), "..", "daily")
OUTPUT_PATH = os.path.normpath(os.path.join(DAILY_DIR, "index.html"))

# Austin, TX 78759 coordinates
LATITUDE = 30.4015
LONGITUDE = -97.7254
NWS_USER_AGENT = "(bourov.github.io daily-briefing, github-actions)"


def fetch_weather():
    """Fetch current weather and forecast for Austin, TX from weather.gov."""
    headers = {"User-Agent": NWS_USER_AGENT, "Accept": "application/geo+json"}
    try:
        point = requests.get(
            f"https://api.weather.gov/points/{LATITUDE},{LONGITUDE}",
            headers=headers,
            timeout=15,
        )
        point.raise_for_status()
        props = point.json()["properties"]

        forecast = requests.get(
            props["forecast"], headers=headers, timeout=15
        )
        forecast.raise_for_status()
        periods = forecast.json()["properties"]["periods"]

        obs_url = f"{props['observationStations']}"
        stations = requests.get(obs_url, headers=headers, timeout=15)
        stations.raise_for_status()
        station_id = stations.json()["features"][0]["properties"]["stationIdentifier"]

        obs = requests.get(
            f"https://api.weather.gov/stations/{station_id}/observations/latest",
            headers=headers,
            timeout=15,
        )
        obs.raise_for_status()
        observation = obs.json()["properties"]

        return {"forecast_periods": periods[:6], "current_observation": {
            "temperature_c": observation.get("temperature", {}).get("value"),
            "humidity": observation.get("relativeHumidity", {}).get("value"),
            "wind_speed_kmh": observation.get("windSpeed", {}).get("value"),
            "wind_direction": observation.get("windDirection", {}).get("value"),
            "description": observation.get("textDescription"),
        }}
    except Exception as exc:
        print(f"Warning: weather fetch failed: {exc}", file=sys.stderr)
        return None


def extract_text(response):
    """Extract concatenated text from an Anthropic response."""
    return "".join(
        block.text for block in response.content if block.type == "text"
    )


def generate_briefing_html(weather_data):
    """Call Anthropic Claude API with web search to produce the briefing."""
    client = anthropic.Anthropic()

    ct = timezone(timedelta(hours=-5))          # CDT (summer)
    now = datetime.now(ct)
    date_long = now.strftime("%B %-d, %Y")      # e.g. May 30, 2026

    weather_block = ""
    if weather_data:
        weather_block = (
            "Real-time weather data from weather.gov for Austin, TX:\n"
            + json.dumps(weather_data, indent=2, default=str)
        )

    prompt = f"""Generate a COMPLETE, self-contained HTML page for today's Daily Morning Briefing.

Date: {date_long}
Prepared at: 6:00 AM CT
Location: Austin, TX

{weather_block}

### Required sections (in order):

1. **Weather — Austin, TX (ZIP 78759)** (🌤️)
   Table rows: current temp (°C + feels-like), tonight low, tomorrow high,
   precipitation chance, humidity, wind, conditions, sunrise/sunset.
   {"Use the real weather.gov data above." if weather_data else "Look up today's Austin TX weather."}
   Source line: "National Weather Service — {date_long}"

2. **Positive Russia News** (✅) — 2-3 uplifting or constructive stories from
   Russia published in the last 24 hours. Real URLs only. Exclude The Moscow
   Times.

3. **Neutral Russia News** (📰) — 2-4 factual, objective items about Russia
   from the last 24 hours. Real URLs only.

4. **St. Petersburg News** (🏛️) — 4-6 items from Saint Petersburg, Russia.
   Mix English and Russian sources; tag each with an EN or RU badge.

5. **Semiconductor & Investor News** (💹)
   - Sub-section **KLAC (KLA Corporation)** (🔬): 3-5 recent items.
   - Sub-section **CPO (Co-Packaged Optics)** (💡): 1-2 recent items.

### Styling rules (match exactly):
- `<meta charset="UTF-8">`, viewport meta, CSP meta:
  `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src 'self'; frame-ancestors 'none'">`
- Body: font-family 'Segoe UI', Arial, sans-serif; background #f5f5f5
- `.container`: max-width 750px, white bg, 8px border-radius, box-shadow
- `.header`: gradient #1a237e → #283593, white text, h1 + subtitle line
- `.section`: 20px 30px padding, bottom border #eee
- News `<li>`: background #fafafa, 4px border-radius, 3px solid #ddd left
  border, linked headline + source/date line
- Language badges: EN = #e8f4fd bg / #1565C0 text; RU = #e8e8e8 bg / #555
- `.footer`: #f0f0f0 bg, small centered text noting 24-hour sources,
  "The Moscow Times excluded. Deduplicated against 30-day history."

Output ONLY the raw HTML (no markdown fences, no commentary).
Every news link must be a real, verifiable URL from a genuine publication."""

    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=16000,
        tools=[{"type": "web_search_20250305", "name": "web_search", "max_uses": 10}],
        messages=[{"role": "user", "content": prompt}],
    )

    html = extract_text(response)
    # Strip markdown fences if the model wrapped the output
    if html.startswith("```"):
        first_newline = html.index("\n")
        html = html[first_newline + 1 :]
    if html.endswith("```"):
        html = html[: -3]
    return html.strip()


def main():
    weather = fetch_weather()
    html = generate_briefing_html(weather)

    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    with open(OUTPUT_PATH, "w", encoding="utf-8") as fh:
        fh.write(html)
        if not html.endswith("\n"):
            fh.write("\n")

    print(f"Daily briefing written to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()

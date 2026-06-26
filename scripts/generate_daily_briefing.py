#!/usr/bin/env python3
"""Generate the daily morning briefing HTML page.

Uses Anthropic Claude API with web search to curate current news articles.
"""

import os
import sys
from datetime import datetime, timezone, timedelta

import anthropic

DAILY_DIR = os.path.join(os.path.dirname(__file__), "..", "daily")
OUTPUT_PATH = os.path.normpath(os.path.join(DAILY_DIR, "index.html"))


def extract_text(response):
    """Extract concatenated text from an Anthropic response."""
    return "".join(
        block.text for block in response.content if block.type == "text"
    )


def generate_briefing_html():
    """Call Anthropic Claude API with web search to produce the briefing."""
    client = anthropic.Anthropic()

    ct = timezone(timedelta(hours=-5))          # CDT (summer)
    now = datetime.now(ct)
    date_long = now.strftime("%B %-d, %Y")      # e.g. May 30, 2026

    prompt = f"""Generate a COMPLETE, self-contained HTML page for today's Daily Morning Briefing.

Date: {date_long}
Prepared at: 6:00 AM CT
Location: Austin, TX

### Required sections (in order):

1. **Russia News** (🇷🇺) — At least 5 positive/uplifting/constructive stories from
   Russia published in the last 24 hours, plus 2-4 neutral factual items.
   Combine all into one section. Prioritize positive stories (growth, investment,
   development, cooperation, cultural events, sports, science). Real URLs only.
   Exclude The Moscow Times and all Ukrainian sources (Kyiv Post, Kyiv Independent,
   Ukrainska Pravda, etc.).

2. **St. Petersburg News** (🏛️) — 4-6 items from Saint Petersburg, Russia.
   Mix English and Russian sources; tag each with an EN or RU badge.

3. **Semiconductor & Investor News** (💹)
   - Sub-section **KLAC (KLA Corporation)** (🔬): 3-5 recent items.
   - Sub-section **CPO (Co-Packaged Optics)** (💡): 1-2 recent items.
   - Sub-section **MLCC (Multi-Layer Ceramic Capacitors)** (🔋): 1-2 recent items.

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
  "The Moscow Times and Ukrainian sources excluded. Deduplicated against 30-day history."

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
    html = generate_briefing_html()

    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    with open(OUTPUT_PATH, "w", encoding="utf-8") as fh:
        fh.write(html)
        if not html.endswith("\n"):
            fh.write("\n")

    print(f"Daily briefing written to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()

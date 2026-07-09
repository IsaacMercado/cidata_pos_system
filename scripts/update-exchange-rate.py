#!/usr/bin/env python3
"""
Scrape BCV exchange rate and send to the API endpoint via HTTP POST.

Usage:
    python scripts/update-exchange-rate.py [--url URL]

The default URL is http://localhost:8787/api/exchange-rate

Uses only stdlib — no pip dependencies required.
"""

import json
import re
import ssl
import sys
from urllib.request import Request, urlopen
from urllib.error import URLError

API_URL = "http://localhost:8787/api/exchange-rate"
BCV_URL = "https://www.bcv.org.ve/"


def scrape_bcv() -> dict[str, float]:
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE

    try:
        with urlopen(BCV_URL, context=ctx, timeout=15) as resp:
            html = resp.read().decode("utf-8", errors="replace")
    except Exception as e:
        print(f"Error al conectar con BCV: {e}", file=sys.stderr)
        return {}

    import xml.etree.ElementTree as etree

    print(etree.fromstring(html))

    raise RuntimeError

    rates: dict[str, float] = {}

    patterns = {
        "USD": r'<span>\s*USD\s*</span>.*?<strong[^>]*>\s*([\d.,]+)',
        "EUR": r'<span>\s*EUR\s*</span>.*?<strong[^>]*>\s*([\d.,]+)',
    }

    for currency, pattern in patterns.items():
        match = re.search(pattern, html, re.DOTALL)
        if match:
            value = match.group(1).replace(",", ".")
            try:
                rates[currency] = float(value)
            except ValueError:
                pass

    return rates


def send_rate(currency: str, rate: float, api_url: str):
    body = json.dumps({
        "currencyFrom": currency,
        "currencyTo": "VES",
        "rate": rate,
    }).encode("utf-8")

    req = Request(
        api_url,
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    try:
        with urlopen(req, timeout=10) as resp:
            result = json.loads(resp.read().decode("utf-8"))
            if result.get("success"):
                print(f"  {currency}/VES: {rate} -> OK")
            else:
                print(f"  {currency}/VES: {rate} -> ERROR: {result}", file=sys.stderr)
    except URLError as e:
        print(f"  Error enviando {currency}: {e}", file=sys.stderr)


def main():
    api_url = API_URL
    if len(sys.argv) > 1 and sys.argv[1] == "--url" and len(sys.argv) > 2:
        api_url = sys.argv[2]

    print(f"API: {api_url}")
    print("Scrapeando BCV...")

    rates = scrape_bcv()
    if not rates:
        print("No se obtuvo ninguna tasa.", file=sys.stderr)
        sys.exit(1)

    print(f"Tasas obtenidas: {rates}")
    print("Enviando...")

    for currency, rate in rates.items():
        if rate > 0:
            send_rate(currency, rate, api_url)

    print("Listo.")


if __name__ == "__main__":
    main()

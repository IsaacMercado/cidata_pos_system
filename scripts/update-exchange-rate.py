#!/usr/bin/env python3
"""
Scrape BCV exchange rate and send to the API endpoint via HTTP POST.

Usage:
    python scripts/update-exchange-rate.py [--url URL] [--email EMAIL] [--password PASSWORD]

Environment variables (alternative to flags):
    POS_API_URL, POS_EMAIL, POS_PASSWORD

Uses only stdlib — no pip dependencies required.
"""

import argparse
import json
import os
import re
import ssl
import sys
from html.parser import HTMLParser
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

API_URL = os.getenv("POS_API_URL", "http://localhost:8787")
BCV_URL = "https://www.bcv.org.ve/"


class BCVRateParser(HTMLParser):
    """Parse BCV HTML to extract USD/VES rate using html.parser (stdlib)."""

    def __init__(self):
        super().__init__()
        self.in_span = False
        self.in_strong = False
        self.span_text = ""
        self.rates = {}
        self._current_currency = None

    def handle_starttag(self, tag, attrs):
        attrs_dict = dict(attrs)
        if tag == "span":
            self.in_span = True
            self.span_text = ""
        elif tag == "strong" and self.in_span:
            self.in_strong = True

    def handle_endtag(self, tag):
        if tag == "span":
            self.in_span = False
            # Check if this span contained a currency code
            text = self.span_text.strip().upper()
            if text in ("USD", "EUR"):
                self._current_currency = text
        elif tag == "strong":
            self.in_strong = False

    def handle_data(self, data):
        if self.in_span:
            self.span_text += data
        elif self.in_strong and self._current_currency:
            # This strong tag contains the rate value
            value_str = data.strip().replace(",", ".")
            try:
                rate = float(value_str)
                if rate > 0:
                    self.rates[self._current_currency] = rate
            except ValueError:
                pass
            self._current_currency = None


def scrape_bcv() -> dict[str, float]:
    """Fetch BCV page and parse exchange rates."""
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE

    try:
        req = Request(
            BCV_URL, headers={"User-Agent": "Mozilla/5.0 (compatible; POS-Bot/1.0)"}
        )
        with urlopen(req, context=ctx, timeout=15) as resp:
            html = resp.read().decode("utf-8", errors="replace")
    except Exception as e:
        print(f"Error al conectar con BCV: {e}", file=sys.stderr)
        return {}

    parser = BCVRateParser()
    try:
        parser.feed(html)
    except Exception as e:
        print(f"Error parseando HTML del BCV: {e}", file=sys.stderr)
        return {}

    return parser.rates


def login(api_url: str, email: str, password: str) -> str | None:
    """Authenticate and return JWT token."""
    url = f"{api_url}/api/auth/login"
    body = json.dumps({"email": email, "password": password}).encode("utf-8")

    req = Request(
        url,
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    try:
        with urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            return data.get("token")
    except HTTPError as e:
        err_body = e.read().decode("utf-8", errors="replace")
        print(f"Login falló ({e.code}): {err_body}", file=sys.stderr)
    except URLError as e:
        print(f"Error de red en login: {e}", file=sys.stderr)
    except Exception as e:
        print(f"Error inesperado en login: {e}", file=sys.stderr)

    return None


def send_rate(api_url: str, token: str, currency: str, rate: float) -> bool:
    """Send exchange rate to API."""
    url = f"{api_url}/api/exchange-rate"
    body = json.dumps(
        {
            "currencyFrom": currency,
            "currencyTo": "VES",
            "rate": rate,
        }
    ).encode("utf-8")

    req = Request(
        url,
        data=body,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {token}",
        },
        method="POST",
    )

    try:
        with urlopen(req, timeout=10) as resp:
            result = json.loads(resp.read().decode("utf-8"))
            if result.get("success"):
                print(f"  {currency}/VES: {rate} -> OK")
                return True
            else:
                print(f"  {currency}/VES: {rate} -> ERROR: {result}", file=sys.stderr)
                return False
    except HTTPError as e:
        err_body = e.read().decode("utf-8", errors="replace")
        print(f"  {currency}/VES: {rate} -> HTTP {e.code}: {err_body}", file=sys.stderr)
        return False
    except URLError as e:
        print(f"  {currency}/VES: {rate} -> Error de red: {e}", file=sys.stderr)
        return False
    except Exception as e:
        print(f"  {currency}/VES: {rate} -> Error inesperado: {e}", file=sys.stderr)
        return False


def main():
    parser = argparse.ArgumentParser(description="Actualizar tasa de cambio BCV en POS")
    parser.add_argument(
        "--url", default=API_URL, help="URL base de la API (default: %(default)s)"
    )
    parser.add_argument(
        "--email", default=os.getenv("POS_EMAIL"), help="Email para login"
    )
    parser.add_argument(
        "--password", default=os.getenv("POS_PASSWORD"), help="Password para login"
    )
    args = parser.parse_args()

    if not args.email or not args.password:
        print(
            "Error: Se requieren --email y --password (o variables POS_EMAIL / POS_PASSWORD)",
            file=sys.stderr,
        )
        sys.exit(1)

    api_url = args.url.rstrip("/")

    print(f"API: {api_url}")
    print("Login...")

    token = login(api_url, args.email, args.password)
    if not token:
        sys.exit(1)

    print("Scrapeando BCV...")
    rates = scrape_bcv()

    if not rates:
        print("No se obtuvo ninguna tasa.", file=sys.stderr)
        sys.exit(1)

    print(f"Tasas obtenidas: {rates}")
    print("Enviando...")

    success = 0
    for currency, rate in rates.items():
        if rate > 0 and send_rate(api_url, token, currency, rate):
            success += 1

    print(f"Listo. {success}/{len(rates)} tasas actualizadas.")
    if success == 0:
        sys.exit(1)


if __name__ == "__main__":
    main()

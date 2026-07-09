export async function getExchangeRateVES(): Promise<Record<string, number>> {
  const exchange_rates: Record<string, number> = {};

  try {
    const response = await fetch(
      "https://www.bcv.org.ve/",
      {
        method: "GET",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
          "Accept-Language": "es-ES,es;q=0.9",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      },
    );
    const html = await response.text();
    console.log(html)

    const currencies: Record<string, RegExp> = {
      USD: /<span>\s*USD\s*<\/span>.*?<strong[^>]*>\s*([\d.,]+)/s,
      EUR: /<span>\s*EUR\s*<\/span>.*?<strong[^>]*>\s*([\d.,]+)/s,
    };

    for (const [currency, regex] of Object.entries(currencies)) {
      const match = html.match(regex);
      if (match) {
        exchange_rates[currency] = parseFloat(match[1].replace(",", "."));
      }
    }
  } catch (error) {
    console.error("BCV scrape error:", error);
    return exchange_rates;
  }

  return exchange_rates;
}

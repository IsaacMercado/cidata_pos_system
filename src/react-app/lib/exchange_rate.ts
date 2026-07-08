export async function getExchangeRate(): Promise<Record<string, number>> {
  const exchange_rates: Record<string, number> = {};

  try {
    const response = await fetch("https://www.bcv.org.ve/", {
      tls: { rejectUnauthorized: false },
    } as any);
    const text = await response.text();

    if (response.ok) {
      const currencies: Record<string, RegExp> = {
        USD: /<span>\s*USD\s*<\/span>.*?<strong[^>]*>\s*([\d.,]+)/s,
        EUR: /<span>\s*EUR\s*<\/span>.*?<strong[^>]*>\s*([\d.,]+)/s,
        CNY: /<span>\s*CNY\s*<\/span>.*?<strong[^>]*>\s*([\d.,]+)/s,
        TRY: /<span>\s*TRY\s*<\/span>.*?<strong[^>]*>\s*([\d.,]+)/s,
        RUB: /<span>\s*RUB\s*<\/span>.*?<strong[^>]*>\s*([\d.,]+)/s,
      };

      for (const [currency, regex] of Object.entries(currencies)) {
        const match = text.match(regex);
        if (match) {
          const value = parseFloat(match[1].replace(",", "."));
          exchange_rates[currency] = value;
        }
      }
    }
  } catch (error) {
    console.error(error);
    return exchange_rates;
  }

  return exchange_rates;
}

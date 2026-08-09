//! Subcomando `scrape`: descarga tasas de cambio del BCV.

use std::collections::HashMap;
use std::path::PathBuf;

use clap::Args;
use scraper::{Html, Selector};

#[derive(Args, Debug)]
pub struct ScrapeArgs {
    /// URL a consultar (por defecto la página principal del BCV).
    #[arg(long, env = "BCV_URL", default_value = "https://www.bcv.org.ve/")]
    pub url: String,

    /// Ruta al archivo PEM con el certificado CA raíz a usar para validar la conexión.
    /// Si se omite, se lee de la variable de entorno BCV_CA_CERT_PATH.
    #[arg(long, env = "BCV_CA_CERT_PATH")]
    pub cert: Option<PathBuf>,

    /// Deshabilitar la verificación de certificados (equivalente a danger_accept_invalid_certs).
    /// Si se establece, tiene prioridad sobre --cert.
    #[arg(long, env = "BCV_INSECURE", default_value_t = false)]
    pub insecure: bool,
}

/// Extrae las tasas de cambio del HTML del BCV.
fn get_currency_data(body: &str) -> HashMap<String, f64> {
    let mut data: HashMap<String, f64> = HashMap::new();
    let document = Html::parse_document(body);

    let currency_selector = Selector::parse("div[class^='views-row'] div[id]").unwrap();
    let strong_selector = Selector::parse("strong").unwrap();
    let span_selector = Selector::parse("span").unwrap();

    for elm in document.select(&currency_selector) {
        if elm.value().attr("id").is_some() {
            if let Some(name) = elm.select(&span_selector).next() {
                let name = name
                    .text()
                    .collect::<Vec<_>>()
                    .join("")
                    .trim()
                    .to_uppercase();

                if name.len() != 3 {
                    continue;
                }

                if let Some(elm_value) = elm.select(&strong_selector).next() {
                    let value: f64 = elm_value
                        .text()
                        .collect::<Vec<_>>()
                        .join("")
                        .trim()
                        .replace('.', "")
                        .replace(',', ".")
                        .parse()
                        .unwrap_or(0.0);
                    if value != 0.0 {
                        data.insert(name, value);
                    }
                }
            }
        }
    }
    data
}

pub fn run(args: ScrapeArgs) -> Result<(), u8> {
    crate::client::run(args.cert.as_deref(), args.insecure, |c| {
        let body = match c.get(&args.url).send().and_then(|r| r.text()) {
            Ok(b) => b,
            Err(e) => {
                eprintln!("Error descargando '{}': {}", args.url, e);
                return Err(4);
            }
        };

        let data = get_currency_data(&body);
        if data.is_empty() {
            eprintln!("No se encontraron tasas en la página.");
            return Err(5);
        }

        let mut keys: Vec<&String> = data.keys().collect();
        keys.sort();
        for key in keys {
            println!("{} - {}", key, data[key]);
        }
        Ok(())
    })
}

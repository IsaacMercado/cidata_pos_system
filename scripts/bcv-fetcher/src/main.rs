use std::collections::HashMap;
use std::path::PathBuf;
use std::process::ExitCode;

use clap::Parser;
use scraper::{Html, Selector};

/// Descarga tasas de cambio del BCV.
#[derive(Parser, Debug)]
#[command(name = "bcv-fetcher", version, about, long_about = None)]
struct Cli {
    /// URL a consultar (por defecto la página principal del BCV).
    #[arg(long, env = "BCV_URL", default_value = "https://www.bcv.org.ve/")]
    url: String,

    /// Ruta al archivo PEM con el certificado CA raíz a usar para validar la conexión.
    /// Si se omite, se lee de la variable de entorno BCV_CA_CERT_PATH.
    #[arg(long, env = "BCV_CA_CERT_PATH")]
    cert: Option<PathBuf>,

    /// Deshabilitar la verificación de certificados (equivalente a danger_accept_invalid_certs).
    /// Si se establece, tiene prioridad sobre --cert.
    #[arg(long, env = "BCV_INSECURE", default_value_t = false)]
    insecure: bool,
}

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

enum BuildError {
    CertRead(String),
    Build(String),
}

fn build_client(
    cert_path: Option<&PathBuf>,
    insecure: bool,
) -> Result<reqwest::blocking::Client, BuildError> {
    let mut builder = reqwest::blocking::Client::builder();

    if insecure {
        builder = builder.danger_accept_invalid_certs(true);
    } else if let Some(path) = cert_path {
        let pem = std::fs::read(path).map_err(|e| {
            BuildError::CertRead(format!("leyendo certificado '{}': {}", path.display(), e))
        })?;
        let ca = reqwest::Certificate::from_pem(&pem).map_err(|e| {
            BuildError::CertRead(format!("parseando PEM '{}': {}", path.display(), e))
        })?;
        builder = builder.add_root_certificate(ca);
    }

    builder
        .build()
        .map_err(|e| BuildError::Build(e.to_string()))
}

fn main() -> ExitCode {
    let cli = Cli::parse();

    let client = match build_client(cli.cert.as_ref(), cli.insecure) {
        Ok(c) => c,
        Err(BuildError::CertRead(msg)) => {
            eprintln!("Error de certificado: {msg}");
            return ExitCode::from(2);
        }
        Err(BuildError::Build(msg)) => {
            eprintln!("Error construyendo cliente HTTP: {msg}");
            return ExitCode::from(3);
        }
    };

    let body = match client.get(&cli.url).send().and_then(|r| r.text()) {
        Ok(b) => b,
        Err(e) => {
            eprintln!("Error descargando '{}': {}", cli.url, e);
            return ExitCode::from(4);
        }
    };

    let data = get_currency_data(&body);
    if data.is_empty() {
        eprintln!("No se encontraron tasas en la página.");
        return ExitCode::from(5);
    }

    let mut keys: Vec<&String> = data.keys().collect();
    keys.sort();
    for key in keys {
        println!("{} - {}", key, data[key]);
    }
    ExitCode::SUCCESS
}

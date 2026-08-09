//! Constructor del cliente HTTP con soporte para certificado CA personalizado.

use std::path::Path;

pub enum BuildError {
    CertRead(String),
    Build(String),
}

impl BuildError {
    pub fn code(&self) -> u8 {
        match self {
            BuildError::CertRead(_) => 2,
            BuildError::Build(_) => 3,
        }
    }

    pub fn msg(&self) -> String {
        match self {
            BuildError::CertRead(m) => format!("Error de certificado: {m}"),
            BuildError::Build(m) => format!("Error construyendo cliente HTTP: {m}"),
        }
    }
}

/// Construye un `reqwest::blocking::Client` usando el certificado PEM en `cert_path`
/// como raíz confiable, o sin verificación TLS si `insecure` es true.
pub fn build(
    cert_path: Option<&Path>,
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

/// Construye un cliente usando un PEM embebido (bytes) en vez de un archivo.
#[allow(dead_code)]
pub fn build_from_pem(pem: &[u8]) -> Result<reqwest::blocking::Client, BuildError> {
    let ca = reqwest::Certificate::from_pem(pem)
        .map_err(|e| BuildError::CertRead(format!("parseando PEM embebido: {e}")))?;
    reqwest::blocking::Client::builder()
        .add_root_certificate(ca)
        .build()
        .map_err(|e| BuildError::Build(e.to_string()))
}

/// Ejecuta una función con un cliente construido; imprime el error y devuelve el código
/// de salida apropiado si la construcción falla.
pub fn run<F>(cert_path: Option<&Path>, insecure: bool, f: F) -> Result<(), u8>
where
    F: FnOnce(reqwest::blocking::Client) -> Result<(), u8>,
{
    match build(cert_path, insecure) {
        Ok(client) => f(client),
        Err(e) => {
            eprintln!("{}", e.msg());
            Err(e.code())
        }
    }
}

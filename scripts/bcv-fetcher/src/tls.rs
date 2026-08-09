//! Utilidades TLS para inspeccionar la cadena de certificados del BCV
//! y descargar el intermedio correcto desde Sectigo.

use std::time::Duration;

use x509_parser::prelude::*;

/// Un certificado X.509 parseado en formato PEM.
pub struct ParsedCert {
    pub subject: String,
    pub issuer: String,
    pub subject_key_id: Option<String>,
    pub authority_key_id: Option<String>,
    /// URL donde se puede descargar el certificado que firma a este (AIA - CA Issuers).
    pub ca_issuers_url: Option<String>,
}

impl ParsedCert {
    pub fn from_pem(pem: &[u8]) -> Result<Self, String> {
        let pem_obj = Pem::iter_from_buffer(pem)
            .next()
            .ok_or("no se encontró bloque PEM")?
            .map_err(|e| format!("parseando PEM: {e}"))?;
        let cert = pem_obj.parse_x509()
            .map_err(|e| format!("parseando X.509: {e}"))?;

        let subject = cert.subject().to_string();
        let issuer = cert.issuer().to_string();

        let mut subject_key_id: Option<String> = None;
        let mut authority_key_id: Option<String> = None;
        let mut ca_issuers_url: Option<String> = None;

        for ext in cert.iter_extensions() {
            match ext.parsed_extension() {
                ParsedExtension::SubjectKeyIdentifier(kid) => {
                    subject_key_id = Some(to_hex_colon(kid.0));
                }
                ParsedExtension::AuthorityKeyIdentifier(aki) => {
                    authority_key_id = aki.key_identifier.as_ref().map(|id| to_hex_colon(id.0));
                }
                ParsedExtension::AuthorityInfoAccess(aia) => {
                    let ca_issuers_oid = x509_parser::der_parser::oid!(1.3.6.1.5.5.7.48.2);
                    for desc in &aia.accessdescs {
                        if desc.access_method == ca_issuers_oid {
                            if let GeneralName::URI(ref uri) = desc.access_location {
                                ca_issuers_url = Some(uri.to_string());
                            }
                        }
                    }
                }
                _ => {}
            }
        }

        Ok(Self {
            subject,
            issuer,
            subject_key_id,
            authority_key_id,
            ca_issuers_url,
        })
    }
}

/// Convierte bytes a hex con dos-puntos (formato estándar X.509).
fn to_hex_colon(bytes: &[u8]) -> String {
    bytes
        .iter()
        .map(|b| format!("{b:02X}"))
        .collect::<Vec<_>>()
        .join(":")
}

/// Realiza una conexión TLS al host:port, extrae los certificados que el servidor
/// envía en la cadena y los devuelve como PEM.
///
/// Usa `openssl s_client` como subproceso para evitar reimplementar TLS a mano.
pub fn fetch_chain_pems(host: &str, port: u16) -> Result<Vec<Vec<u8>>, String> {
    use std::process::Command;

    let output = Command::new("openssl")
        .args([
            "s_client",
            "-connect",
            &format!("{host}:{port}"),
            "-showcerts",
            "-servername",
            host,
        ])
        .stdin(std::process::Stdio::null())
        .stderr(std::process::Stdio::piped())
        .output()
        .map_err(|e| format!("ejecutando openssl s_client: {e}"))?;

    let stdout = String::from_utf8_lossy(&output.stdout);

    let mut certs: Vec<Vec<u8>> = Vec::new();
    let mut current = String::new();
    let mut in_cert = false;
    for line in stdout.lines() {
        if line.contains("-----BEGIN CERTIFICATE-----") {
            in_cert = true;
            current.clear();
            current.push_str(line);
            current.push('\n');
        } else if line.contains("-----END CERTIFICATE-----") {
            in_cert = false;
            current.push_str(line);
            current.push('\n');
            certs.push(current.as_bytes().to_vec());
        } else if in_cert {
            current.push_str(line);
            current.push('\n');
        }
    }

    if certs.is_empty() {
        return Err("openssl s_client no devolvió ningún certificado".to_string());
    }
    Ok(certs)
}

/// Descarga un certificado desde una URL HTTP(S) (formato DER, como los expone
/// crt.sectigo.com) y lo convierte a PEM.
pub fn download_cert_as_pem(url: &str) -> Result<Vec<u8>, String> {
    if !url.starts_with("http://") && !url.starts_with("https://") {
        return Err(format!("URL no soportada para descarga: {url}"));
    }

    let client = reqwest::blocking::Client::builder()
        .danger_accept_invalid_certs(true)
        .timeout(Duration::from_secs(30))
        .build()
        .map_err(|e| format!("construyendo cliente para descargar intermedio: {e}"))?;

    let der = client
        .get(url)
        .send()
        .map_err(|e| format!("descargando {url}: {e}"))?
        .bytes()
        .map_err(|e| format!("leyendo cuerpo de {url}: {e}"))?
        .to_vec();

    der_to_pem(&der)
}

/// Convierte un certificado DER (binario) a PEM (texto).
fn der_to_pem(der: &[u8]) -> Result<Vec<u8>, String> {
    use base64::Engine;
    use base64::engine::general_purpose::STANDARD;

    let b64 = STANDARD.encode(der);
    let mut pem = String::new();
    pem.push_str("-----BEGIN CERTIFICATE-----\n");
    for chunk in b64.as_bytes().chunks(64) {
        pem.push_str(std::str::from_utf8(chunk).unwrap_or(""));
        pem.push('\n');
    }
    pem.push_str("-----END CERTIFICATE-----\n");
    Ok(pem.into_bytes())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn hex_colon_formatea_bien() {
        assert_eq!(to_hex_colon(&[0x68, 0xC0, 0x12]), "68:C0:12");
        assert_eq!(to_hex_colon(&[]), "");
    }

    #[test]
    fn der_a_pem_tiene_begin_y_end() {
        let der = vec![0u8; 10];
        let pem = der_to_pem(&der).unwrap();
        let text = String::from_utf8(pem).unwrap();
        assert!(text.contains("-----BEGIN CERTIFICATE-----"));
        assert!(text.contains("-----END CERTIFICATE-----"));
    }
}

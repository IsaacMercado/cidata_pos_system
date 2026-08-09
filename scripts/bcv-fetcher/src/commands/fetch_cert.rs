//! Subcomando `fetch-cert`: descarga el intermedio de Sectigo que el BCV necesita.
//!
//! Sigue estos pasos:
//! 1. Se conecta por TLS al host y extrae los certificados PEM que el servidor envía.
//! 2. Parsea el leaf y lee su Authority Key Identifier (AKID) y la URL de CA Issuers (AIA).
//! 3. Descarga el intermedio correcto desde esa URL (en formato DER) y lo convierte a PEM.
//! 4. Verifica que el subject del intermedio coincida con el issuer del leaf.
//! 5. Guarda el PEM en el path indicado.

use std::path::PathBuf;

use clap::Args;

use crate::tls::{self, ParsedCert};

#[derive(Args, Debug)]
pub struct FetchCertArgs {
    /// Host del cual extraer el leaf y descargar el intermedio correcto.
    #[arg(long, default_value = "www.bcv.org.ve")]
    pub host: String,

    /// Puerto TLS.
    #[arg(long, default_value_t = 443u16)]
    pub port: u16,

    /// Archivo donde guardar el intermedio en formato PEM.
    /// Si se omite, se imprime a stdout.
    #[arg(long, short = 'o')]
    pub output: Option<PathBuf>,

    /// Saltar la verificación de consistencia entre el issuer del leaf
    /// y el subject del intermedio descargado.
    #[arg(long, default_value_t = false)]
    pub skip_verify: bool,
}

pub fn run(args: FetchCertArgs) -> Result<(), u8> {
    // Paso 1: extraer los certificados PEM que el servidor envía.
    eprintln!("→ Conectando a {}:{} …", args.host, args.port);
    let chain = match tls::fetch_chain_pems(&args.host, args.port) {
        Ok(c) => c,
        Err(e) => {
            eprintln!("Error extrayendo la cadena TLS: {e}");
            return Err(10);
        }
    };
    eprintln!("  Servidor envió {} certificado(s).", chain.len());

    // Paso 2: parsear el leaf (primer certificado).
    let leaf_pem = &chain[0];
    let leaf = match ParsedCert::from_pem(leaf_pem) {
        Ok(c) => c,
        Err(e) => {
            eprintln!("Error parseando el leaf: {e}");
            return Err(11);
        }
    };
    eprintln!("  Leaf subject : {}", leaf.subject);
    eprintln!("  Leaf issuer  : {}", leaf.issuer);
    if let Some(k) = &leaf.authority_key_id {
        eprintln!("  Leaf AKID    : {k}");
    }

    // Paso 3: leer la URL del CA Issuers (AIA) del leaf.
    let aia_url = match &leaf.ca_issuers_url {
        Some(u) => u,
        None => {
            eprintln!("Error: el leaf no tiene extensión AIA (CA Issuers URL).");
            return Err(12);
        }
    };
    eprintln!("  AIA CA Issuers URL: {aia_url}");

    // Paso 4: descargar el intermedio en PEM.
    eprintln!("→ Descargando intermedio desde {aia_url} …");
    let intermediate_pem = match tls::download_cert_as_pem(aia_url) {
        Ok(p) => p,
        Err(e) => {
            eprintln!("Error descargando intermedio: {e}");
            return Err(13);
        }
    };

    // Paso 5: parsear el intermedio descargado.
    let intermediate = match ParsedCert::from_pem(&intermediate_pem) {
        Ok(c) => c,
        Err(e) => {
            eprintln!("Error parseando intermedio descargado: {e}");
            return Err(14);
        }
    };
    eprintln!("  Intermedio subject: {}", intermediate.subject);
    eprintln!("  Intermedio issuer : {}", intermediate.issuer);
    if let Some(k) = &intermediate.subject_key_id {
        eprintln!("  Intermedio SKID   : {k}");
    }

    // Paso 6: verificar subject del intermedio == issuer del leaf.
    if !args.skip_verify {
        if leaf.issuer != intermediate.subject {
            eprintln!(
                " WARN: el issuer del leaf no coincide con el subject del intermedio descargado."
            );
            eprintln!("   Leaf issuer         : {}", leaf.issuer);
            eprintln!("   Intermedio subject  : {}", intermediate.subject);
            return Err(15);
        }
        eprintln!("  OK: issuer del leaf coincide con subject del intermedio.");

        if let (Some(aki), Some(skid)) = (&leaf.authority_key_id, &intermediate.subject_key_id) {
            if aki == skid {
                eprintln!("  OK: AKID del leaf coincide con SKID del intermedio.");
            } else {
                eprintln!(
                    " WARN: AKID del leaf ({aki}) no coincide con SKID del intermedio ({skid})."
                );
            }
        }
    }

    // Paso 7: guardar o imprimir el PEM.
    match &args.output {
        Some(path) => {
            if let Err(e) = std::fs::write(path, &intermediate_pem) {
                eprintln!("Error escribiendo '{}': {}", path.display(), e);
                return Err(16);
            }
            eprintln!("→ Intermedio guardado en {}", path.display());
        }
        None => {
            print!(
                "{}",
                String::from_utf8_lossy(&intermediate_pem)
            );
        }
    }

    Ok(())
}

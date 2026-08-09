use std::process::ExitCode;

use clap::{Parser, Subcommand};

mod client;
mod commands;
mod tls;

/// Descarga tasas de cambio del BCV.
#[derive(Parser, Debug)]
#[command(name = "bcv-fetcher", version, about, long_about = None)]
struct Cli {
    #[command(subcommand)]
    command: Command,
}

#[derive(Subcommand, Debug)]
enum Command {
    /// Descarga y muestra las tasas de cambio de la página del BCV.
    Scrape(commands::scrape::ScrapeArgs),
    /// Descarga el certificado intermedio de Sectigo que el BCV necesita para completar
    /// su cadena TLS y lo guarda como PEM.
    FetchCert(commands::fetch_cert::FetchCertArgs),
}

fn main() -> ExitCode {
    let cli = Cli::parse();

    let result = match cli.command {
        Command::Scrape(args) => commands::scrape::run(args),
        Command::FetchCert(args) => commands::fetch_cert::run(args),
    };

    match result {
        Ok(()) => ExitCode::SUCCESS,
        Err(code) => ExitCode::from(code),
    }
}

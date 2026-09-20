//! Dumps the native engine's AST JSON for every corpus document, for the
//! cross-build determinism check (NFR-6, task 2.7): native output must equal
//! the WASM/node output the web build serves, document for document.
//!
//! Run: cargo run -p onemark-engine --example dump_corpus -- <corpus_dir> <out_dir>

use std::fs;
use std::path::PathBuf;

use onemark_engine::{parse_to_json, ParseOptions};

fn main() {
    let mut args = std::env::args().skip(1);
    let corpus_dir = PathBuf::from(args.next().expect("corpus dir required"));
    let out_dir = PathBuf::from(args.next().expect("out dir required"));
    fs::create_dir_all(&out_dir).expect("out dir creatable");

    let options = ParseOptions::gfm();
    let mut count = 0usize;
    for entry in fs::read_dir(&corpus_dir).expect("corpus dir readable") {
        let path = entry.expect("entry readable").path();
        if path.extension().and_then(|e| e.to_str()) != Some("md") {
            continue;
        }
        let source = fs::read_to_string(&path).expect("corpus file readable");
        let name = path.file_stem().and_then(|s| s.to_str()).expect("utf8 stem");
        let json = parse_to_json(&source, &options);
        fs::write(out_dir.join(format!("{name}.json")), json).expect("write native dump");
        count += 1;
    }
    println!("dumped {count} native ASTs to {}", out_dir.display());
}

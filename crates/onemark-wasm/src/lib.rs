//! The wasm-bindgen boundary (tech spec §5).
//!
//! Exposes both transport designs, because OQ-4 is measured across this boundary
//! and a benchmark needs both arms:
//!
//! * `parse_to_json` — design A: the AST crosses as JSON, TypeScript renders.
//! * `render_to_html` — design B: Rust parses *and* renders, one string crosses.
//!
//! The Rust-side cost of both is already measured (see `docs/session-logs/`);
//! what this crate adds is the cost of the copy across the boundary itself.
//!
//! Options cross as a JSON string rather than as a bound struct: it keeps the
//! boundary to primitives, which is one less thing to keep in sync by hand.

use onemark_engine::{Dialect, Extensions, ParseOptions};
use wasm_bindgen::prelude::*;

/// Identifies which engine build produced a given AST. Surfaced through
/// `MarkdownEngine.id` so a determinism failure names its own culprit (NFR-6).
#[wasm_bindgen]
pub fn engine_id() -> String {
    "comrak-wasm".to_string()
}

#[wasm_bindgen]
pub fn engine_version() -> String {
    onemark_engine::ENGINE_VERSION.to_string()
}

/// Design A — parses and returns the AST as a JSON string.
#[wasm_bindgen]
pub fn parse_to_json(source: &str, options_json: &str) -> Result<String, JsError> {
    let options = decode_options(options_json)?;
    Ok(onemark_engine::parse_to_json(source, &options))
}

/// Design B — parses and renders, returning HTML.
///
/// The HTML is **not** sanitised here. Sanitisation is a render-layer
/// responsibility (NFR-2) and lives in TypeScript, where the allowlist sits
/// next to the rest of the render pipeline.
#[wasm_bindgen]
pub fn render_to_html(source: &str, options_json: &str) -> Result<String, JsError> {
    let options = decode_options(options_json)?;
    Ok(onemark_engine::render_to_html(source, &options))
}

fn decode_options(options_json: &str) -> Result<ParseOptions, JsError> {
    let value: serde_json::Value = serde_json::from_str(options_json)
        .map_err(|e| JsError::new(&format!("options are not valid JSON: {e}")))?;

    let dialect = value
        .get("dialect")
        .and_then(|d| d.as_str())
        .unwrap_or("gfm");
    if dialect != "gfm" {
        return Err(JsError::new(&format!(
            "unsupported dialect `{dialect}`; v1 is GFM only (ADR-0008)"
        )));
    }

    let ext = value.get("extensions");
    let flag = |name: &str| -> bool {
        ext.and_then(|e| e.get(name))
            .and_then(|v| v.as_bool())
            .unwrap_or(true)
    };

    Ok(ParseOptions {
        dialect: Dialect::Gfm,
        extensions: Extensions {
            tables: flag("tables"),
            strikethrough: flag("strikethrough"),
            autolink: flag("autolink"),
            task_list: flag("taskList"),
            footnotes: flag("footnotes"),
            alerts: flag("alerts"),
            math: flag("math"),
            frontmatter: flag("frontmatter"),
        },
    })
}

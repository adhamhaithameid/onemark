//! OQ-4 — how should the AST cross the WASM boundary (tech spec §5)?
//!
//! Design A: Rust parses, serialises the AST to JSON, TypeScript renders.
//! Design B: Rust parses *and* renders, one HTML string crosses.
//!
//! This measures the Rust-side cost of each on the M1 budget document (5 MB),
//! which is the half of the question that does not need a wasm32 toolchain.
//! The remaining half — the cost of the copy across the wasm-bindgen boundary
//! and `JSON.parse` on the JS side — is measured in M0.3.
//!
//! Run: `cargo run --release -p onemark-engine --example transport_bench`

use std::time::Instant;

use onemark_engine::{parse, parse_to_json, ParseOptions};

/// One repetition of realistic GitHub-flavoured markdown.
const CHUNK: &str = r#"
## Section heading

Ordinary paragraph text with **strong**, _emphasis_, `code`, a [link](https://example.com/page)
and an autolink https://example.org that the parser has to scan for.

> [!NOTE]
> An alert block, because these are on the v1 critical path.

| column a | column b | column c |
|:---------|:--------:|---------:|
| one      | two      | three    |
| four     | five     | six      |

- [x] a completed task
- [ ] an outstanding task
  - a nested bullet
  - another one

```rust
fn main() {
    println!("fenced code the renderer will hand to Shiki");
}
```

A footnote reference[^note] and some inline math $E = mc^2$.

[^note]: The footnote definition.
"#;

fn synthetic_document(target_bytes: usize) -> String {
    let mut doc = String::with_capacity(target_bytes + CHUNK.len());
    while doc.len() < target_bytes {
        doc.push_str(CHUNK);
    }
    doc
}

fn median(mut xs: Vec<f64>) -> f64 {
    xs.sort_by(|a, b| a.partial_cmp(b).unwrap());
    xs[xs.len() / 2]
}

fn time<T>(runs: usize, mut f: impl FnMut() -> T) -> (f64, T) {
    // Warm up first: the allocator and the CPU caches both need a pass before the
    // numbers mean anything. Without this the first sample dominates the median.
    for _ in 0..2 {
        std::hint::black_box(f());
    }

    let mut samples = Vec::with_capacity(runs);
    let mut last = None;
    for _ in 0..runs {
        let t0 = Instant::now();
        let out = f();
        samples.push(t0.elapsed().as_secs_f64() * 1000.0);
        last = Some(out);
    }
    (median(samples), last.unwrap())
}

fn main() {
    let runs: usize = std::env::var("BENCH_RUNS")
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(9);

    for target in [100 * 1024usize, 1024 * 1024, 5 * 1024 * 1024] {
        let doc = synthetic_document(target);
        let mb = doc.len() as f64 / (1024.0 * 1024.0);
        let options = ParseOptions::gfm();

        println!(
            "\n=== document: {:.2} MB ({} bytes), {runs} runs after warmup, median ===",
            mb,
            doc.len()
        );

        let (parse_ms, ast) = time(runs, || parse(&doc, &options));
        let node_count = count(&ast);
        println!("  parse only .................. {parse_ms:8.2} ms   ({node_count} nodes)");

        let (json_ms, json) = time(runs, || parse_to_json(&doc, &options));
        println!(
            "  A: parse + JSON serialise ... {json_ms:8.2} ms   (payload {:.2} MB, {:.1}x source)",
            json.len() as f64 / (1024.0 * 1024.0),
            json.len() as f64 / doc.len() as f64
        );

        let (html_ms, html) = time(runs, || {
            let arena = comrak::Arena::new();
            let mut o = comrak::Options::default();
            o.extension.table = true;
            o.extension.strikethrough = true;
            o.extension.autolink = true;
            o.extension.tasklist = true;
            o.extension.footnotes = true;
            o.extension.alerts = true;
            o.extension.math_dollars = true;
            o.extension.front_matter_delimiter = Some("---".to_string());
            let root = comrak::parse_document(&arena, &doc, &o);
            let mut out = String::new();
            comrak::format_html(root, &o, &mut out).unwrap();
            out
        });
        println!(
            "  B: parse + HTML in Rust ..... {html_ms:8.2} ms   (payload {:.2} MB, {:.1}x source)",
            html.len() as f64 / (1024.0 * 1024.0),
            html.len() as f64 / doc.len() as f64
        );

        // How much of design A's payload is source positions? They are needed for
        // scroll-sync, but only on block-level nodes — not on every inline text run.
        let (strip_ms, stripped) = time(runs, || {
            let mut ast = parse(&doc, &options);
            strip_inline_positions(&mut ast);
            serde_json::to_string(&ast).unwrap()
        });
        println!(
            "  A': block-only positions .... {strip_ms:8.2} ms   (payload {:.2} MB, {:.1}x source)",
            stripped.len() as f64 / (1024.0 * 1024.0),
            stripped.len() as f64 / doc.len() as f64
        );

        let serialise_only = json_ms - parse_ms;
        println!(
            "  → serialisation overhead .... {serialise_only:8.2} ms   ({:.0}% of design A)",
            (serialise_only / json_ms) * 100.0
        );
    }
}

/// Drops `position` from inline nodes, keeping it on block-level nodes.
/// Scroll-sync maps viewport lines to blocks; it never needs an inline range.
fn strip_inline_positions(n: &mut onemark_engine::MarkdownNode) {
    const BLOCK: &[&str] = &[
        "document",
        "heading",
        "paragraph",
        "block_quote",
        "list",
        "item",
        "task_item",
        "code_block",
        "html_block",
        "thematic_break",
        "table",
        "table_row",
        "footnote_definition",
        "alert",
        "frontmatter",
    ];
    if !BLOCK.contains(&n.node_type.as_str()) {
        n.position = None;
    }
    if let Some(kids) = n.children.as_mut() {
        for k in kids {
            strip_inline_positions(k);
        }
    }
}

fn count(n: &onemark_engine::MarkdownNode) -> usize {
    1 + n.kids().iter().map(count).sum::<usize>()
}

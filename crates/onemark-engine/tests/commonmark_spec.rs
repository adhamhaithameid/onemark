//! Metric M3 — CommonMark conformance (PRD §5.2, tech spec §8).
//!
//! **What this gates in M0:** the *parser* layer only. OneMark's own AST → HTML
//! renderer does not exist until M1.1, so this runs the spec against comrak's
//! HTML output and answers "is the engine we chose actually conformant?".
//! In M1 the same suite re-points at `fidelity/runner.ts` and gates the real
//! render path. The number this prints is the M0 baseline.
//!
//! CommonMark is measured with **every GFM extension off**: autolinks and
//! strikethrough change the expected output, so leaving them on would measure a
//! different specification.

use std::path::PathBuf;

#[derive(serde::Deserialize)]
struct Case {
    markdown: String,
    html: String,
    example: u32,
    section: String,
}

/// The CommonMark pass-rate required by M3.
const M3_THRESHOLD: f64 = 99.0;

fn spec_path() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../fidelity/spec/commonmark-0.31.2.json")
}

fn render_commonmark(markdown: &str) -> String {
    let arena = comrak::Arena::new();
    // Bare CommonMark: no extensions.
    let mut options = comrak::Options::default();
    // The spec expects raw HTML to pass through verbatim; comrak escapes it by
    // default. This flag is correct *here*, where we are measuring conformance.
    // It is not how the product renders: in OneMark raw HTML crosses the parser
    // untouched and is then stripped by the render-layer sanitiser (NFR-2), which
    // is the only place that decision belongs.
    options.render.r#unsafe = true;
    let root = comrak::parse_document(&arena, markdown, &options);
    let mut out = String::new();
    comrak::format_html(root, &options, &mut out).expect("formatting cannot fail into a String");
    out
}

#[test]
fn commonmark_conformance_meets_m3() {
    let raw = std::fs::read_to_string(spec_path()).expect("spec suite is committed to the repo");
    let cases: Vec<Case> = serde_json::from_str(&raw).expect("spec suite parses");

    let mut passed = 0usize;
    let mut failures: Vec<(u32, String)> = Vec::new();

    for case in &cases {
        if render_commonmark(&case.markdown) == case.html {
            passed += 1;
        } else {
            failures.push((case.example, case.section.clone()));
        }
    }

    let total = cases.len();
    let rate = (passed as f64 / total as f64) * 100.0;

    println!(
        "\nCommonMark 0.31.2 — {passed}/{total} passed ({rate:.2}%), M3 requires {M3_THRESHOLD}%"
    );

    if !failures.is_empty() {
        let mut by_section: std::collections::BTreeMap<String, Vec<u32>> = Default::default();
        for (example, section) in &failures {
            by_section
                .entry(section.clone())
                .or_default()
                .push(*example);
        }
        println!("failing sections:");
        for (section, examples) in &by_section {
            println!(
                "  {:<28} {} — examples {:?}",
                section,
                examples.len(),
                examples
            );
        }
    }

    assert!(
        rate >= M3_THRESHOLD,
        "CommonMark conformance {rate:.2}% is below the M3 threshold of {M3_THRESHOLD}%"
    );
}

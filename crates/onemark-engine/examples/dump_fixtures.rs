//! Emits AST fixtures consumed by the TypeScript contract tests.
//!
//! This is what keeps the two halves of the `MarkdownEngine` boundary honest:
//! the fixtures are produced by the real Rust engine, and `packages/engine`
//! asserts its TypeScript types against them. A shape change on either side
//! fails the other side's tests.
//!
//! Run: `cargo run -p onemark-engine --example dump_fixtures`

use std::fs;
use std::path::PathBuf;

use onemark_engine::{parse, ParseOptions};

const FIXTURES: &[(&str, &str)] = &[
    ("heading", "# hello\n"),
    ("gfm_table", "| a | b |\n|:--|--:|\n| 1 | 2 |\n"),
    ("task_list", "- [x] done\n- [ ] todo\n"),
    ("alert", "> [!WARNING]\n> careful\n"),
    ("math", "$x^2$\n\n$$y = 1$$\n"),
    ("frontmatter", "---\ntitle: hi\n---\n\n# body\n"),
    ("code_block", "```rust\nfn main() {}\n```\n"),
    ("footnote", "text[^a]\n\n[^a]: note\n"),
];

fn main() {
    let out_dir =
        PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../packages/engine/test/fixtures");
    fs::create_dir_all(&out_dir).expect("fixture directory is creatable");

    let options = ParseOptions::gfm();
    let mut manifest = Vec::new();

    for (name, source) in FIXTURES {
        // Serialise the AST directly rather than round-tripping through
        // `serde_json::Value`: `Value` sorts object keys, which would make the
        // committed fixture a different byte sequence from what the engine
        // actually emits — and the determinism test compares byte sequences.
        let ast = parse(source, &options);
        let body = serde_json::to_string_pretty(&ast).unwrap();
        fs::write(out_dir.join(format!("{name}.json")), body + "\n").unwrap();
        manifest.push(serde_json::json!({ "name": name, "source": source }));
    }

    fs::write(
        out_dir.join("manifest.json"),
        serde_json::to_string_pretty(&manifest).unwrap() + "\n",
    )
    .unwrap();

    println!("wrote {} fixtures to {}", FIXTURES.len(), out_dir.display());
}

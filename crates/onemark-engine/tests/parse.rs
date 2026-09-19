//! Tests the public seam: `MarkdownEngine` as realised in Rust (tech spec §3).
//! These assert on the AST contract, never on comrak internals — a parser swap
//! (ADR-0002) must leave every one of these green.

use onemark_engine::{parse, ParseOptions};

#[test]
fn parses_an_atx_heading_into_the_ast_contract() {
    let doc = parse("# hello", &ParseOptions::gfm());

    assert_eq!(doc.node_type, "document");

    let heading = &doc.children.as_ref().unwrap()[0];
    assert_eq!(heading.node_type, "heading");
    assert_eq!(heading.attr_u64("level"), Some(1));

    let text = &heading.children.as_ref().unwrap()[0];
    assert_eq!(text.node_type, "text");
    assert_eq!(text.literal.as_deref(), Some("hello"));
}

/// Conversion must not recurse over document depth.
///
/// This is a security property, not a style preference. Nesting depth is
/// attacker-controlled, and the wasm32 stack is 1 MB: a recursive converter
/// trapped there with `memory access out of bounds`, which leaves the module
/// instance permanently unusable rather than raising a catchable error.
#[test]
fn pathological_nesting_does_not_exhaust_the_stack() {
    let options = ParseOptions::gfm();

    for source in [
        ">".repeat(50_000) + " x",
        "*".repeat(20_000) + "x" + &"*".repeat(20_000),
        (0..3_000)
            .map(|i| " ".repeat(i * 2) + "- x")
            .collect::<Vec<_>>()
            .join("\n"),
    ] {
        let doc = parse(&source, &options);
        assert_eq!(doc.node_type, "document");

        // Measured iteratively: a recursive measurement would fail for exactly
        // the reason this test exists.
        let mut max_depth = 0usize;
        let mut stack = vec![(&doc, 1usize)];
        while let Some((node, depth)) = stack.pop() {
            max_depth = max_depth.max(depth);
            for child in node.kids() {
                stack.push((child, depth + 1));
            }
        }
        // The marker itself sits one level below the deepest converted node, so
        // a truncated tree is `MAX_DEPTH + 1` deep. What matters is that it is
        // bounded by a constant rather than by the input.
        assert!(
            max_depth <= onemark_engine::MAX_DEPTH + 1,
            "depth {max_depth} exceeded the cap of {} (+1 for the marker)",
            onemark_engine::MAX_DEPTH
        );
    }
}

/// Truncation must be visible in the tree, not a silent drop.
#[test]
fn exceeding_the_depth_limit_leaves_a_marker() {
    let doc = parse(&(">".repeat(2_000) + " x"), &ParseOptions::gfm());

    let mut found = false;
    let mut stack = vec![&doc];
    while let Some(node) = stack.pop() {
        if node.node_type == "truncated" {
            found = true;
            assert_eq!(node.attr_str("reason"), Some("max_depth_exceeded"));
        }
        for child in node.kids() {
            stack.push(child);
        }
    }
    assert!(found, "a truncated subtree must be marked");
}

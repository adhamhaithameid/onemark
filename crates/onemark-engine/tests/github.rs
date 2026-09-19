//! The GitHub-specific parser features from PRD §6.1, plus the source positions
//! that scroll-sync (M1.16) depends on.

use onemark_engine::{parse, MarkdownNode, ParseOptions};

fn first_of(node: &MarkdownNode, ty: &str) -> MarkdownNode {
    fn walk(n: &MarkdownNode, ty: &str, out: &mut Option<MarkdownNode>) {
        if out.is_some() {
            return;
        }
        if n.node_type == ty {
            *out = Some(n.clone());
            return;
        }
        for c in n.kids() {
            walk(c, ty, out);
        }
    }
    let mut out = None;
    walk(node, ty, &mut out);
    out.unwrap_or_else(|| panic!("no `{ty}` node in tree"))
}

/// OQ-3: alerts are a parser-layer feature, so the renderer receives a typed node
/// rather than having to sniff a blockquote's first line.
#[test]
fn github_alerts_parse_to_typed_alert_nodes() {
    for (marker, expected) in [
        ("NOTE", "note"),
        ("TIP", "tip"),
        ("IMPORTANT", "important"),
        ("WARNING", "warning"),
        ("CAUTION", "caution"),
    ] {
        let md = format!("> [!{marker}]\n> body text\n");
        let doc = parse(&md, &ParseOptions::gfm());

        let alert = first_of(&doc, "alert");
        assert_eq!(
            alert.attr_str("alert_type"),
            Some(expected),
            "marker {marker}"
        );
        assert_eq!(
            first_of(&alert, "text").literal.as_deref(),
            Some("body text")
        );
    }
}

#[test]
fn a_blockquote_without_a_marker_stays_a_blockquote() {
    let doc = parse("> plain quote\n", &ParseOptions::gfm());
    assert_eq!(first_of(&doc, "block_quote").node_type, "block_quote");
}

#[test]
fn math_delimiters_are_parsed_but_left_untypeset() {
    let doc = parse("$x^2$\n\n$$y = 1$$\n", &ParseOptions::gfm());

    fn all_math(n: &MarkdownNode, out: &mut Vec<MarkdownNode>) {
        if n.node_type == "math" {
            out.push(n.clone());
        }
        for c in n.kids() {
            all_math(c, out);
        }
    }
    let mut found = Vec::new();
    all_math(&doc, &mut found);

    assert_eq!(found.len(), 2);
    assert_eq!(found[0].attr_bool("display"), Some(false));
    assert_eq!(found[0].literal.as_deref(), Some("x^2"));
    assert_eq!(found[1].attr_bool("display"), Some(true));
    // The literal crosses the boundary verbatim; KaTeX typesets it renderer-side.
    assert_eq!(found[1].literal.as_deref(), Some("y = 1"));
}

#[test]
fn yaml_frontmatter_is_captured_as_its_own_node() {
    let doc = parse("---\ntitle: hi\n---\n\n# body\n", &ParseOptions::gfm());

    let fm = first_of(&doc, "frontmatter");
    assert!(fm.literal.as_deref().unwrap().contains("title: hi"));
    assert_eq!(first_of(&doc, "heading").attr_u64("level"), Some(1));
}

#[test]
fn positions_carry_byte_offsets_resolvable_against_the_source() {
    let source = "# one\n\nsecond para\n";
    let doc = parse(source, &ParseOptions::gfm());

    let heading = first_of(&doc, "heading");
    let pos = heading.position.unwrap();
    assert_eq!(pos.start.line, 1);
    assert_eq!(pos.start.column, 1);
    assert_eq!(pos.start.offset, 0);

    let para = first_of(&doc, "paragraph");
    let start = para.position.unwrap().start;
    assert_eq!(start.line, 3);
    // The offset must index the real byte in the source, not an approximation.
    assert_eq!(&source[start.offset..start.offset + 6], "second");
}

#[test]
fn attribute_order_is_stable_so_output_is_byte_identical() {
    // NFR-6: determinism. Serialising the same document twice must not differ.
    let source = "| a | b |\n|:--|--:|\n| 1 | 2 |\n\n- [x] t\n";
    let a = onemark_engine::parse_to_json(source, &ParseOptions::gfm());
    let b = onemark_engine::parse_to_json(source, &ParseOptions::gfm());
    assert_eq!(a, b);
    assert!(a.contains(r#""alignments":"left,right""#));
}

//! GFM extension coverage at the AST contract (PRD §6.1, metric M4).

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

#[test]
fn tables_carry_column_alignments() {
    let md = "| a | b |\n|:--|--:|\n| 1 | 2 |\n";
    let doc = parse(md, &ParseOptions::gfm());

    let table = first_of(&doc, "table");
    assert_eq!(table.attr_u64("columns"), Some(2));
    assert_eq!(table.attr_str("alignments"), Some("left,right"));

    let cell = first_of(&table, "table_cell");
    assert_eq!(first_of(&cell, "text").literal.as_deref(), Some("a"));
}

#[test]
fn task_items_report_their_checked_state() {
    let doc = parse("- [x] done\n- [ ] todo\n", &ParseOptions::gfm());

    let list = first_of(&doc, "list");
    let items: Vec<_> = list
        .kids()
        .iter()
        .filter(|n| n.node_type == "task_item")
        .collect();

    assert_eq!(items.len(), 2, "both list entries should be task items");
    assert_eq!(items[0].attr_bool("checked"), Some(true));
    assert_eq!(items[1].attr_bool("checked"), Some(false));
}

#[test]
fn footnote_definitions_and_references_are_linked_by_name() {
    let doc = parse("text[^a]\n\n[^a]: the note\n", &ParseOptions::gfm());

    assert_eq!(
        first_of(&doc, "footnote_reference").attr_str("name"),
        Some("a")
    );
    assert_eq!(
        first_of(&doc, "footnote_definition").attr_str("name"),
        Some("a")
    );
}

#[test]
fn strikethrough_and_autolinks_are_recognised() {
    let doc = parse("~~gone~~ https://example.com\n", &ParseOptions::gfm());

    assert_eq!(first_of(&doc, "strikethrough").node_type, "strikethrough");
    assert_eq!(
        first_of(&doc, "link").attr_str("url"),
        Some("https://example.com")
    );
}

#[test]
fn fenced_code_blocks_keep_their_info_string_and_body() {
    let doc = parse("```rust\nfn main() {}\n```\n", &ParseOptions::gfm());

    let code = first_of(&doc, "code_block");
    assert_eq!(code.attr_str("info"), Some("rust"));
    assert_eq!(code.attr_bool("fenced"), Some(true));
    assert_eq!(code.literal.as_deref(), Some("fn main() {}\n"));
}

#[test]
fn ordered_lists_report_start_and_tightness() {
    let doc = parse("3. one\n4. two\n", &ParseOptions::gfm());

    let list = first_of(&doc, "list");
    assert_eq!(list.attr_str("list_type"), Some("ordered"));
    assert_eq!(list.attr_u64("start"), Some(3));
    assert_eq!(list.attr_bool("tight"), Some(true));
}

#[test]
fn links_and_images_expose_url_and_title() {
    let doc = parse("[t](/u \"ti\")\n\n![a](/i)\n", &ParseOptions::gfm());

    let link = first_of(&doc, "link");
    assert_eq!(link.attr_str("url"), Some("/u"));
    assert_eq!(link.attr_str("title"), Some("ti"));

    let image = first_of(&doc, "image");
    assert_eq!(image.attr_str("url"), Some("/i"));
}

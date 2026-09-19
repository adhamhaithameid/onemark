//! OneMark's markdown engine.
//!
//! Wraps `comrak` behind OneMark's own AST contract (ADR-0002, ADR-0003). Callers
//! never see a comrak type: the whole point of the boundary is that the parser
//! underneath can be replaced without touching anything above it.
//!
//! The AST mirrors `MarkdownNode` in the technical spec §3 field for field, so the
//! JSON this crate emits deserialises straight into the TypeScript interface.

use std::collections::BTreeMap;

use comrak::nodes::{AlertType, AstNode, ListDelimType, ListType, NodeValue, TableAlignment};
use comrak::Arena;
use serde::Serialize;

/// A node in OneMark's AST. Mirrors `MarkdownNode` in tech spec §3.
///
/// `attrs` is a `BTreeMap` rather than a `HashMap` on purpose: NFR-6 requires
/// byte-identical output on every platform, and hash iteration order is not stable.
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct MarkdownNode {
    #[serde(rename = "type")]
    pub node_type: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub children: Option<Vec<MarkdownNode>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub literal: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub attrs: Option<BTreeMap<String, AttrValue>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub position: Option<Span>,
}

impl MarkdownNode {
    /// Reads an integer attribute. Returns `None` when absent or not an integer.
    pub fn attr_u64(&self, key: &str) -> Option<u64> {
        match self.attrs.as_ref()?.get(key)? {
            AttrValue::Int(n) if *n >= 0 => Some(*n as u64),
            _ => None,
        }
    }

    /// Reads a string attribute.
    pub fn attr_str(&self, key: &str) -> Option<&str> {
        match self.attrs.as_ref()?.get(key)? {
            AttrValue::Str(s) => Some(s),
            _ => None,
        }
    }

    /// Reads a boolean attribute.
    pub fn attr_bool(&self, key: &str) -> Option<bool> {
        match self.attrs.as_ref()?.get(key)? {
            AttrValue::Bool(b) => Some(*b),
            _ => None,
        }
    }

    /// Convenience accessor for children, so callers stop unwrapping `Option<Vec<_>>`.
    pub fn kids(&self) -> &[MarkdownNode] {
        self.children.as_deref().unwrap_or(&[])
    }
}

/// `string | number | boolean | null` on the TypeScript side.
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(untagged)]
pub enum AttrValue {
    Str(String),
    Int(i64),
    Bool(bool),
    Null,
}

/// A source range. Required for scroll-sync (M1.16) and future inline preview.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
pub struct Span {
    pub start: Point,
    pub end: Point,
}

/// A source position.
///
/// `line` and `column` are 1-based, as comrak reports them. `offset` is a
/// **byte** offset from the start of the document, computed here because comrak
/// does not carry one.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
pub struct Point {
    pub line: usize,
    pub column: usize,
    pub offset: usize,
}

/// Dialect selector. GFM is the only value in v1 (ADR-0008).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Dialect {
    Gfm,
}

/// Which extensions the parse enables. Mirrors `ParseOptions.extensions` in tech spec §3.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Extensions {
    pub tables: bool,
    pub strikethrough: bool,
    pub autolink: bool,
    pub task_list: bool,
    pub footnotes: bool,
    /// `> [!NOTE]` — native to comrak, resolved as OQ-3.
    pub alerts: bool,
    /// `$…$` / `$$…$$` delimiters only. Typesetting is renderer-side.
    pub math: bool,
    pub frontmatter: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ParseOptions {
    pub dialect: Dialect,
    pub extensions: Extensions,
}

impl ParseOptions {
    /// The v1 configuration: GFM with every extension the done-line requires.
    pub fn gfm() -> Self {
        ParseOptions {
            dialect: Dialect::Gfm,
            extensions: Extensions {
                tables: true,
                strikethrough: true,
                autolink: true,
                task_list: true,
                footnotes: true,
                alerts: true,
                math: true,
                frontmatter: true,
            },
        }
    }
}

impl Default for ParseOptions {
    fn default() -> Self {
        Self::gfm()
    }
}

/// Maximum AST nesting depth.
///
/// Deeper documents are truncated with a `truncated` marker node rather than
/// rendered. This is a product limit, not a stack limit — the conversion itself
/// is iterative and has no depth ceiling — chosen because a document nested
/// thousands of levels deep is pathological rather than useful, and because
/// every downstream consumer (renderers, validators, walkers) would otherwise
/// need its own unbounded recursion to match. Real documents do not approach it.
pub const MAX_DEPTH: usize = 400;

/// Engine identity, surfaced through the `MarkdownEngine` interface.
pub const ENGINE_ID: &str = "comrak-native";
pub const ENGINE_VERSION: &str = env!("CARGO_PKG_VERSION");

/// Parses markdown into OneMark's AST.
pub fn parse(source: &str, options: &ParseOptions) -> MarkdownNode {
    let arena = Arena::new();
    let comrak_options = to_comrak_options(options);
    let root = comrak::parse_document(&arena, source, &comrak_options);
    let lines = LineIndex::new(source);
    convert(root, &lines)
}

/// Parses markdown and serialises the AST to JSON — the form that crosses the
/// WASM boundary (tech spec §5, design A).
pub fn parse_to_json(source: &str, options: &ParseOptions) -> String {
    serde_json::to_string(&parse(source, options)).expect("AST is always serialisable")
}

/// Renders markdown straight to HTML inside Rust — design B in tech spec §5.
///
/// The output is **not** sanitised. Sanitisation is render-layer (NFR-2) and
/// lives in TypeScript beside the rest of the render pipeline.
pub fn render_to_html(source: &str, options: &ParseOptions) -> String {
    let arena = Arena::new();
    let comrak_options = to_comrak_options(options);
    let root = comrak::parse_document(&arena, source, &comrak_options);
    let mut out = String::new();
    comrak::format_html(root, &comrak_options, &mut out)
        .expect("formatting into a String cannot fail");
    out
}

fn to_comrak_options(options: &ParseOptions) -> comrak::Options<'static> {
    let Dialect::Gfm = options.dialect;
    let ext = options.extensions;

    let mut o = comrak::Options::default();
    o.extension.table = ext.tables;
    o.extension.strikethrough = ext.strikethrough;
    o.extension.autolink = ext.autolink;
    o.extension.tasklist = ext.task_list;
    o.extension.footnotes = ext.footnotes;
    o.extension.alerts = ext.alerts;
    o.extension.math_dollars = ext.math;
    if ext.frontmatter {
        o.extension.front_matter_delimiter = Some("---".to_string());
    }
    // GitHub emits heading anchors; the renderer owns that, so the parser stays quiet.
    o.extension.header_ids = None;
    o
}

/// Byte offsets of the start of every line, so a 1-based line/column pair can be
/// resolved to an absolute offset in O(1).
struct LineIndex {
    starts: Vec<usize>,
    len: usize,
}

impl LineIndex {
    fn new(source: &str) -> Self {
        let mut starts = vec![0usize];
        for (i, b) in source.bytes().enumerate() {
            if b == b'\n' {
                starts.push(i + 1);
            }
        }
        LineIndex {
            starts,
            len: source.len(),
        }
    }

    fn offset(&self, line: usize, column: usize) -> usize {
        let base = match self.starts.get(line.saturating_sub(1)) {
            Some(&b) => b,
            None => self.len,
        };
        (base + column.saturating_sub(1)).min(self.len)
    }
}

/// Builds one node once its children are already converted.
fn build<'a>(node: &'a AstNode<'a>, kids: Vec<MarkdownNode>, lines: &LineIndex) -> MarkdownNode {
    let data = node.data.borrow();
    let (node_type, literal, attrs) = describe(&data.value);

    let sp = data.sourcepos;
    let position = Some(Span {
        start: Point {
            line: sp.start.line,
            column: sp.start.column,
            offset: lines.offset(sp.start.line, sp.start.column),
        },
        end: Point {
            line: sp.end.line,
            column: sp.end.column,
            offset: lines.offset(sp.end.line, sp.end.column),
        },
    });

    MarkdownNode {
        node_type,
        children: if kids.is_empty() { None } else { Some(kids) },
        literal,
        attrs: if attrs.is_empty() { None } else { Some(attrs) },
        position,
    }
}

/// Converts comrak's tree into OneMark's AST **iteratively**.
///
/// This was recursive, and that was a denial-of-service bug. Markdown nesting
/// depth is attacker-controlled — `"*".repeat(5000)` produces a tree ~2500 deep —
/// and while a native 8 MB stack absorbs that, the wasm32 stack is 1 MB. Blowing
/// it there is not a clean error: it traps with `memory access out of bounds` and
/// leaves the module instance **permanently unusable**, so one pathological
/// document killed every later render in the session.
///
/// An explicit heap stack removes the depth limit from our own code entirely.
/// `MAX_DEPTH` below is a separate, deliberate product limit.
fn convert<'a>(root: &'a AstNode<'a>, lines: &LineIndex) -> MarkdownNode {
    struct Frame<'a> {
        node: &'a AstNode<'a>,
        next_child: Option<&'a AstNode<'a>>,
        children: Vec<MarkdownNode>,
    }

    let mut stack: Vec<Frame<'a>> = vec![Frame {
        node: root,
        next_child: root.first_child(),
        children: Vec::new(),
    }];

    loop {
        let frame = stack
            .last_mut()
            .expect("stack is never empty before the root is returned");

        if let Some(child) = frame.next_child {
            frame.next_child = child.next_sibling();

            // Beyond the depth limit the subtree is replaced by a marker rather
            // than dropped silently, so a truncated render is visible in the
            // output instead of looking like a rendering bug.
            if stack.len() >= MAX_DEPTH {
                let mut attrs = BTreeMap::new();
                attrs.insert("reason".into(), AttrValue::Str("max_depth_exceeded".into()));
                attrs.insert("limit".into(), AttrValue::Int(MAX_DEPTH as i64));
                stack.last_mut().unwrap().children.push(MarkdownNode {
                    node_type: "truncated".to_string(),
                    children: None,
                    literal: None,
                    attrs: Some(attrs),
                    position: None,
                });
                continue;
            }

            stack.push(Frame {
                node: child,
                next_child: child.first_child(),
                children: Vec::new(),
            });
            continue;
        }

        let frame = stack.pop().expect("checked above");
        let built = build(frame.node, frame.children, lines);
        match stack.last_mut() {
            Some(parent) => parent.children.push(built),
            None => return built,
        }
    }
}

type Described = (String, Option<String>, BTreeMap<String, AttrValue>);

/// Maps a comrak node onto OneMark's vocabulary.
///
/// This function is the entire ADR-0002 boundary: comrak's names and shapes stop
/// here. The match is exhaustive on purpose — swapping the parser underneath
/// should surface as a compile error, never as silently different output.
fn describe(value: &NodeValue) -> Described {
    let mut attrs: BTreeMap<String, AttrValue> = BTreeMap::new();

    let (name, literal): (&str, Option<String>) = match value {
        NodeValue::Document => ("document", None),
        NodeValue::Paragraph => ("paragraph", None),
        NodeValue::BlockQuote => ("block_quote", None),
        NodeValue::ThematicBreak => ("thematic_break", None),
        NodeValue::SoftBreak => ("soft_break", None),
        NodeValue::LineBreak => ("line_break", None),
        NodeValue::Emph => ("emph", None),
        NodeValue::Strong => ("strong", None),
        NodeValue::Strikethrough => ("strikethrough", None),
        NodeValue::Superscript => ("superscript", None),
        NodeValue::Escaped => ("escaped", None),

        NodeValue::Text(t) => ("text", Some(t.to_string())),
        NodeValue::HtmlInline(h) => ("html_inline", Some(h.clone())),
        NodeValue::Raw(r) => ("raw", Some(r.clone())),
        NodeValue::FrontMatter(f) => ("frontmatter", Some(f.clone())),

        NodeValue::Heading(h) => {
            attrs.insert("level".into(), AttrValue::Int(h.level as i64));
            attrs.insert("setext".into(), AttrValue::Bool(h.setext));
            ("heading", None)
        }

        NodeValue::Code(c) => ("code", Some(c.literal.clone())),

        NodeValue::CodeBlock(c) => {
            attrs.insert("fenced".into(), AttrValue::Bool(c.fenced));
            // GitHub reads only the first word of the info string as the language.
            let lang = c.info.split_whitespace().next().unwrap_or("");
            attrs.insert("info".into(), AttrValue::Str(c.info.clone()));
            attrs.insert("lang".into(), AttrValue::Str(lang.to_string()));
            ("code_block", Some(c.literal.clone()))
        }

        NodeValue::HtmlBlock(h) => ("html_block", Some(h.literal.clone())),

        NodeValue::List(l) => {
            insert_list_attrs(&mut attrs, l);
            ("list", None)
        }
        NodeValue::Item(l) => {
            insert_list_attrs(&mut attrs, l);
            ("item", None)
        }
        NodeValue::TaskItem(t) => {
            attrs.insert("checked".into(), AttrValue::Bool(t.symbol.is_some()));
            attrs.insert(
                "symbol".into(),
                match t.symbol {
                    Some(c) => AttrValue::Str(c.to_string()),
                    None => AttrValue::Null,
                },
            );
            ("task_item", None)
        }

        NodeValue::Table(t) => {
            let alignments: Vec<&str> = t.alignments.iter().map(alignment_name).collect();
            attrs.insert("alignments".into(), AttrValue::Str(alignments.join(",")));
            attrs.insert("columns".into(), AttrValue::Int(t.num_columns as i64));
            attrs.insert("rows".into(), AttrValue::Int(t.num_rows as i64));
            ("table", None)
        }
        NodeValue::TableRow(is_header) => {
            attrs.insert("header".into(), AttrValue::Bool(*is_header));
            ("table_row", None)
        }
        NodeValue::TableCell => ("table_cell", None),

        NodeValue::Link(l) => {
            insert_link_attrs(&mut attrs, l);
            ("link", None)
        }
        NodeValue::Image(l) => {
            insert_link_attrs(&mut attrs, l);
            ("image", None)
        }

        NodeValue::FootnoteDefinition(f) => {
            attrs.insert("name".into(), AttrValue::Str(f.name.clone()));
            attrs.insert(
                "references".into(),
                AttrValue::Int(f.total_references as i64),
            );
            ("footnote_definition", None)
        }
        NodeValue::FootnoteReference(f) => {
            // `ref_num` is deliberately not exposed. comrak assigns footnote
            // numbering during *rendering*, not parsing, so at this point it is
            // always 1 — a field that looks authoritative and is not. Numbering
            // depends on document order of first reference, which makes it a
            // render concern; `packages/renderer` computes it.
            attrs.insert("name".into(), AttrValue::Str(f.name.clone()));
            ("footnote_reference", None)
        }

        NodeValue::Alert(a) => {
            attrs.insert(
                "alert_type".into(),
                AttrValue::Str(alert_name(&a.alert_type).into()),
            );
            attrs.insert(
                "title".into(),
                match &a.title {
                    Some(t) => AttrValue::Str(t.clone()),
                    None => AttrValue::Null,
                },
            );
            attrs.insert("multiline".into(), AttrValue::Bool(a.multiline));
            ("alert", None)
        }

        NodeValue::Math(m) => {
            attrs.insert("display".into(), AttrValue::Bool(m.display_math));
            attrs.insert("dollars".into(), AttrValue::Bool(m.dollar_math));
            ("math", Some(m.literal.clone()))
        }

        NodeValue::MultilineBlockQuote(_) => ("block_quote", None),

        // Extensions outside v1 (ADR-0008). Disabled in `to_comrak_options`, so these
        // arms are unreachable in practice — they exist to keep the match total.
        NodeValue::DescriptionList => ("description_list", None),
        NodeValue::DescriptionItem(_) => ("description_item", None),
        NodeValue::DescriptionTerm => ("description_term", None),
        NodeValue::DescriptionDetails => ("description_details", None),
        NodeValue::Highlight => ("highlight", None),
        NodeValue::Underline => ("underline", None),
        NodeValue::Subscript => ("subscript", None),
        NodeValue::SpoileredText => ("spoiler", None),
        NodeValue::Subtext => ("subtext", None),
        NodeValue::EscapedTag(t) => ("escaped_tag", Some(t.clone())),
        NodeValue::WikiLink(w) => {
            attrs.insert("url".into(), AttrValue::Str(w.url.clone()));
            ("wikilink", None)
        }
    };

    (name.to_string(), literal, attrs)
}

fn insert_list_attrs(attrs: &mut BTreeMap<String, AttrValue>, l: &comrak::nodes::NodeList) {
    let list_type = match l.list_type {
        ListType::Bullet => "bullet",
        ListType::Ordered => "ordered",
    };
    attrs.insert("list_type".into(), AttrValue::Str(list_type.into()));
    attrs.insert("start".into(), AttrValue::Int(l.start as i64));
    attrs.insert("tight".into(), AttrValue::Bool(l.tight));
    attrs.insert("task_list".into(), AttrValue::Bool(l.is_task_list));
    let delimiter = match l.delimiter {
        ListDelimType::Period => "period",
        ListDelimType::Paren => "paren",
    };
    attrs.insert("delimiter".into(), AttrValue::Str(delimiter.into()));
}

fn insert_link_attrs(attrs: &mut BTreeMap<String, AttrValue>, l: &comrak::nodes::NodeLink) {
    attrs.insert("url".into(), AttrValue::Str(l.url.clone()));
    attrs.insert("title".into(), AttrValue::Str(l.title.clone()));
}

fn alignment_name(a: &TableAlignment) -> &'static str {
    match a {
        TableAlignment::None => "none",
        TableAlignment::Left => "left",
        TableAlignment::Center => "center",
        TableAlignment::Right => "right",
    }
}

fn alert_name(a: &AlertType) -> &'static str {
    match a {
        AlertType::Note => "note",
        AlertType::Tip => "tip",
        AlertType::Important => "important",
        AlertType::Warning => "warning",
        AlertType::Caution => "caution",
    }
}

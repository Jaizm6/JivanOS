#![forbid(unsafe_code)]

use std::collections::HashSet;
use wasm_bindgen::prelude::*;

const FNV_OFFSET_BASIS: u64 = 0xcbf29ce484222325;
const FNV_PRIME: u64 = 0x100000001b3;

/// Computes the 64-bit FNV-1a hash of a UTF-8 string and formats it as 16 lowercase hex chars.
/// Matches `computeFnv1a64Hex` in `src/utils/quoteSync.ts` bit-for-bit.
#[wasm_bindgen]
pub fn content_hash(json: &str) -> String {
    let mut hash: u64 = FNV_OFFSET_BASIS;
    for &byte in json.as_bytes() {
        hash ^= u64::from(byte);
        hash = hash.wrapping_mul(FNV_PRIME);
    }
    format!("{:016x}", hash)
}

/// Returns the 0-based indices into `new_keys` that duplicate any entry in `existing_keys`
/// or an earlier entry in `new_keys`.
#[wasm_bindgen]
pub fn find_duplicates(existing_keys: Vec<String>, new_keys: Vec<String>) -> Vec<u32> {
    let mut seen: HashSet<String> = HashSet::with_capacity(existing_keys.len() + new_keys.len());
    for key in existing_keys {
        seen.insert(key);
    }

    let mut dup_indices: Vec<u32> = Vec::new();
    for (idx, key) in new_keys.into_iter().enumerate() {
        if !seen.insert(key) {
            if let Ok(i) = u32::try_from(idx) {
                dup_indices.push(i);
            }
        }
    }
    dup_indices
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct CategoryEntry {
    id: String,
    id_lower: String,
    name_lower: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct ParsedQuote {
    text: String,
    author: String,
    category: String,
    source: Option<String>,
}

fn parse_known_categories(known_categories_json: &str) -> Vec<CategoryEntry> {
    // Minimal panic-free JSON extractor for [{"id":"...","name":"..."}]
    let mut result = Vec::new();
    let bytes = known_categories_json.as_bytes();
    let len = bytes.len();
    let mut i = 0;

    let read_json_string = |pos: &mut usize| -> Option<String> {
        if *pos >= len || bytes[*pos] != b'"' {
            return None;
        }
        *pos += 1;
        let mut out = String::new();
        while *pos < len {
            let b = bytes[*pos];
            if b == b'"' {
                *pos += 1;
                return Some(out);
            }
            if b == b'\\' && *pos + 1 < len {
                *pos += 1;
                let esc = bytes[*pos];
                match esc {
                    b'"' => out.push('"'),
                    b'\\' => out.push('\\'),
                    b'/' => out.push('/'),
                    b'n' => out.push('\n'),
                    b'r' => out.push('\r'),
                    b't' => out.push('\t'),
                    _ => out.push(esc as char),
                }
                *pos += 1;
                continue;
            }
            if let Some(ch) = known_categories_json[*pos..].chars().next() {
                out.push(ch);
                *pos += ch.len_utf8();
            } else {
                break;
            }
        }
        None
    };

    while i < len {
        if bytes[i] == b'{' {
            i += 1;
            let mut id_val: Option<String> = None;
            let mut name_val: Option<String> = None;
            while i < len && bytes[i] != b'}' {
                if bytes[i] == b'"' {
                    if let Some(key) = read_json_string(&mut i) {
                        while i < len && (bytes[i].is_ascii_whitespace() || bytes[i] == b':') {
                            i += 1;
                        }
                        if i < len && bytes[i] == b'"' {
                            if let Some(val) = read_json_string(&mut i) {
                                if key == "id" {
                                    id_val = Some(val);
                                } else if key == "name" {
                                    name_val = Some(val);
                                }
                            }
                        }
                    } else {
                        i += 1;
                    }
                } else {
                    i += 1;
                }
            }
            if let Some(id) = id_val {
                let name = name_val.unwrap_or_else(|| id.clone());
                result.push(CategoryEntry {
                    id_lower: id.trim().to_lowercase(),
                    name_lower: name.trim().to_lowercase(),
                    id,
                });
            }
        }
        i += 1;
    }

    result
}

fn resolve_category_id(raw: &str, categories: &[CategoryEntry]) -> String {
    let trimmed = raw.trim().to_lowercase();
    if trimmed.is_empty() {
        return "wisdom".to_string();
    }
    for cat in categories {
        if cat.id_lower == trimmed || cat.name_lower == trimmed {
            return cat.id.clone();
        }
    }
    "wisdom".to_string()
}

fn detect_csv_delimiter(content: &str) -> char {
    let mut in_quotes = false;
    let mut comma_count: usize = 0;
    let mut semi_count: usize = 0;
    let mut chars = content.chars().peekable();

    while let Some(ch) = chars.next() {
        if ch == '"' {
            if in_quotes && chars.peek() == Some(&'"') {
                chars.next();
            } else {
                in_quotes = !in_quotes;
            }
        } else if !in_quotes {
            if ch == '\n' || ch == '\r' {
                if comma_count > 0 || semi_count > 0 {
                    break;
                }
            } else if ch == ',' {
                comma_count += 1;
            } else if ch == ';' {
                semi_count += 1;
            }
        }
    }

    if semi_count > comma_count {
        ';'
    } else {
        ','
    }
}

fn parse_csv_rows(content: &str) -> Vec<Vec<String>> {
    let clean = content.strip_prefix('\u{feff}').unwrap_or(content);
    if clean.is_empty() {
        return Vec::new();
    }
    let delimiter = detect_csv_delimiter(clean);

    let mut rows: Vec<Vec<String>> = Vec::new();
    let mut row: Vec<String> = Vec::new();
    let mut field = String::new();
    let mut in_quotes = false;
    let mut chars = clean.chars().peekable();

    while let Some(ch) = chars.next() {
        if in_quotes {
            if ch == '"' {
                if chars.peek() == Some(&'"') {
                    field.push('"');
                    chars.next();
                } else {
                    in_quotes = false;
                }
            } else {
                field.push(ch);
            }
        } else if ch == '"' && field.is_empty() {
            in_quotes = true;
        } else if ch == delimiter {
            row.push(std::mem::take(&mut field));
        } else if ch == '\r' {
            if chars.peek() == Some(&'\n') {
                chars.next();
            }
            row.push(std::mem::take(&mut field));
            rows.push(std::mem::take(&mut row));
        } else if ch == '\n' {
            row.push(std::mem::take(&mut field));
            rows.push(std::mem::take(&mut row));
        } else {
            field.push(ch);
        }
    }

    if !field.is_empty() || !row.is_empty() {
        row.push(field);
        rows.push(row);
    }

    rows
}

fn map_header_col(cell: &str) -> Option<&'static str> {
    match cell.trim().to_lowercase().as_str() {
        "quote" | "text" | "content" | "body" => Some("text"),
        "author" | "speaker" | "by" => Some("author"),
        "category" | "topic" => Some("category"),
        "source" | "book" | "reference" => Some("source"),
        _ => None,
    }
}

fn looks_like_csv_header(row: &[String]) -> bool {
    if row.len() < 2 {
        return false;
    }
    let matches = row.iter().filter(|c| map_header_col(c).is_some()).count();
    matches >= 2
}

fn looks_like_csv_rows(rows: &[Vec<String>]) -> bool {
    if let Some(first) = rows
        .iter()
        .find(|r| r.iter().any(|c| !c.trim().is_empty()))
    {
        if looks_like_csv_header(first) {
            return true;
        }
        // Multiple columns across non-empty rows indicates headerless CSV
        if first.len() >= 2 {
            return true;
        }
    }
    false
}

fn parse_plain_text_lines(content: &str, categories: &[CategoryEntry]) -> (Vec<ParsedQuote>, usize) {
    let mut rows = Vec::new();
    let mut empty_count = 0usize;

    for raw_line in content.lines() {
        let line = raw_line.trim();
        if line.is_empty() {
            continue;
        }

        let candidates = [" — ", " – ", " - ", "—", "–"];
        let mut sep_found: Option<(usize, usize)> = None;
        for sep in &candidates {
            if let Some(idx) = line.rfind(sep) {
                if idx > 0 {
                    sep_found = Some((idx, sep.len()));
                    break;
                }
            }
        }

        let (raw_text, author_part, cat_part, src_part) = if let Some((idx, sep_len)) = sep_found {
            let text_seg = line[..idx].trim();
            let tail = line[idx + sep_len..].trim();
            let mut pipes = tail.split('|').map(|s| s.trim());
            let author = pipes.next().unwrap_or("");
            let cat = pipes.next().unwrap_or("");
            let src = pipes.next().unwrap_or("");
            (text_seg, author, cat, src)
        } else {
            let mut pipes = line.split('|').map(|s| s.trim());
            let text_seg = pipes.next().unwrap_or("");
            let cat = pipes.next().unwrap_or("");
            let src = pipes.next().unwrap_or("");
            (text_seg, "", cat, src)
        };

        let text = raw_text
            .trim_start_matches(|c| c == '"' || c == '\u{201c}')
            .trim_end_matches(|c| c == '"' || c == '\u{201d}')
            .trim();

        if text.is_empty() {
            empty_count += 1;
            continue;
        }

        rows.push(ParsedQuote {
            text: text.to_string(),
            author: if author_part.is_empty() {
                "Unknown".to_string()
            } else {
                author_part.to_string()
            },
            category: resolve_category_id(cat_part, categories),
            source: if src_part.is_empty() {
                None
            } else {
                Some(src_part.to_string())
            },
        });
    }

    (rows, empty_count)
}

fn push_json_escaped(out: &mut String, s: &str) {
    out.push('"');
    for ch in s.chars() {
        match ch {
            '"' => out.push_str("\\\""),
            '\\' => out.push_str("\\\\"),
            '\n' => out.push_str("\\n"),
            '\r' => out.push_str("\\r"),
            '\t' => out.push_str("\\t"),
            c if (c as u32) < 0x20 => {
                out.push_str(&format!("\\u{:04x}", c as u32));
            }
            c => out.push(c),
        }
    }
    out.push('"');
}

fn serialize_result(rows: &[ParsedQuote], empty_count: usize) -> String {
    let mut out = String::with_capacity(rows.len() * 96 + 32);
    out.push_str("{\"rows\":[");
    for (i, q) in rows.iter().enumerate() {
        if i > 0 {
            out.push(',');
        }
        out.push_str("{\"text\":");
        push_json_escaped(&mut out, &q.text);
        out.push_str(",\"author\":");
        push_json_escaped(&mut out, &q.author);
        out.push_str(",\"category\":");
        push_json_escaped(&mut out, &q.category);
        if let Some(ref src) = q.source {
            out.push_str(",\"source\":");
            push_json_escaped(&mut out, src);
        }
        out.push('}');
    }
    out.push_str("],\"emptyCount\":");
    out.push_str(&empty_count.to_string());
    out.push('}');
    out
}

/// Parses CSV or plain-text quote imports into JSON `{"rows":[...],"emptyCount":N}`.
/// Never panics on malformed input.
#[wasm_bindgen]
pub fn parse_import(text: &str, known_categories_json: &str) -> String {
    if text.trim().is_empty() {
        return "{\"rows\":[],\"emptyCount\":0}".to_string();
    }

    let categories = parse_known_categories(known_categories_json);
    let csv_rows = parse_csv_rows(text);

    if looks_like_csv_rows(&csv_rows) {
        let first_idx = csv_rows
            .iter()
            .position(|r| r.iter().any(|c| !c.trim().is_empty()))
            .unwrap_or(0);
        let has_header = csv_rows
            .get(first_idx)
            .map(|r| looks_like_csv_header(r))
            .unwrap_or(false);

        let mut text_idx: Option<usize> = Some(0);
        let mut author_idx: Option<usize> = Some(1);
        let mut category_idx: Option<usize> = Some(2);
        let mut source_idx: Option<usize> = Some(3);
        let start_row = if has_header {
            text_idx = None;
            author_idx = None;
            category_idx = None;
            source_idx = None;
            if let Some(header) = csv_rows.get(first_idx) {
                for (idx, cell) in header.iter().enumerate() {
                    match map_header_col(cell) {
                        Some("text") if text_idx.is_none() => text_idx = Some(idx),
                        Some("author") if author_idx.is_none() => author_idx = Some(idx),
                        Some("category") if category_idx.is_none() => category_idx = Some(idx),
                        Some("source") if source_idx.is_none() => source_idx = Some(idx),
                        _ => {}
                    }
                }
            }
            if text_idx.is_none() {
                text_idx = Some(0);
            }
            first_idx + 1
        } else {
            first_idx
        };

        let mut parsed = Vec::new();
        let mut empty_count = 0usize;

        for cols in csv_rows.iter().skip(start_row) {
            if cols.iter().all(|c| c.trim().is_empty()) {
                continue;
            }
            let text_val = text_idx
                .and_then(|i| cols.get(i))
                .map(|s| s.trim())
                .unwrap_or("");
            if text_val.is_empty() {
                empty_count += 1;
                continue;
            }
            let author_val = author_idx
                .and_then(|i| cols.get(i))
                .map(|s| s.trim())
                .unwrap_or("");
            let cat_val = category_idx
                .and_then(|i| cols.get(i))
                .map(|s| s.trim())
                .unwrap_or("");
            let src_val = source_idx
                .and_then(|i| cols.get(i))
                .map(|s| s.trim())
                .unwrap_or("");

            parsed.push(ParsedQuote {
                text: text_val.to_string(),
                author: if author_val.is_empty() {
                    "Unknown".to_string()
                } else {
                    author_val.to_string()
                },
                category: resolve_category_id(cat_val, &categories),
                source: if src_val.is_empty() {
                    None
                } else {
                    Some(src_val.to_string())
                },
            });
        }

        return serialize_result(&parsed, empty_count);
    }

    let (parsed, empty_count) = parse_plain_text_lines(text, &categories);
    serialize_result(&parsed, empty_count)
}

#[cfg(test)]
mod tests {
    use super::*;

    const SAMPLE_CATS: &str = r#"[
        {"id":"wisdom","name":"Wisdom"},
        {"id":"discipline","name":"Discipline"},
        {"id":"stoicism","name":"Stoicism"}
    ]"#;

    #[test]
    fn fnv1a_matches_standard_vectors_and_unicode() {
        assert_eq!(content_hash(""), "cbf29ce484222325");
        assert_eq!(content_hash("hello"), "a430d84680aabd0b");
        let devanagari = "कर्मण्येवाधिकारस्ते मा फलेषु कदाचन";
        assert_eq!(content_hash(devanagari).len(), 16);
    }

    #[test]
    fn handles_empty_input() {
        assert_eq!(parse_import("", SAMPLE_CATS), "{\"rows\":[],\"emptyCount\":0}");
        assert_eq!(parse_import("   \n\r\n  ", SAMPLE_CATS), "{\"rows\":[],\"emptyCount\":0}");
    }

    #[test]
    fn handles_quoted_fields_doubled_quotes_and_newlines() {
        let csv = "Quote,Author,Category,Source\n\"He said, \"\"Stay focused\"\"\nEvery single day.\",Marcus Aurelius,Stoicism,Meditations";
        let out = parse_import(csv, SAMPLE_CATS);
        assert!(out.contains("He said, \\\"Stay focused\\\"\\nEvery single day."));
        assert!(out.contains("\"author\":\"Marcus Aurelius\""));
        assert!(out.contains("\"category\":\"stoicism\""));
        assert!(out.contains("\"source\":\"Meditations\""));
    }

    #[test]
    fn handles_semicolon_delimiter_and_devanagari() {
        let csv = "Author;Quote;Category\nगीता;\"कर्मण्येवाधिकारस्ते; मा फलेषु कदाचन\";Discipline";
        let out = parse_import(csv, SAMPLE_CATS);
        assert!(out.contains("कर्मण्येवाधिकारस्ते; मा फलेषु कदाचन"));
        assert!(out.contains("\"author\":\"गीता\""));
        assert!(out.contains("\"category\":\"discipline\""));
    }

    #[test]
    fn handles_duplicate_detection() {
        let existing = vec!["a\0b".to_string(), "c\0d".to_string()];
        let incoming = vec![
            "a\0b".to_string(),
            "e\0f".to_string(),
            "e\0f".to_string(),
            "c\0d".to_string(),
        ];
        assert_eq!(find_duplicates(existing, incoming), vec![0, 2, 3]);
    }

    #[test]
    fn handles_one_megabyte_csv_without_panic() {
        let mut big = String::with_capacity(1_100_000);
        big.push_str("Quote,Author,Category,Source\n");
        let row = "\"Discipline equals freedom, every day.\",Jocko Willink,Discipline,Field Manual\n";
        while big.len() < 1_050_000 {
            big.push_str(row);
        }
        let out = parse_import(&big, SAMPLE_CATS);
        assert!(out.starts_with("{\"rows\":["));
        assert!(out.ends_with(",\"emptyCount\":0}"));
    }
}

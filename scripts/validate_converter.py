#!/usr/bin/env python3
"""Verify that both shipped compact data and extractor-style flat data parse."""

from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
spec = spec_from_file_location("convert_extraction", ROOT / "convert_extraction.py")
converter = module_from_spec(spec)
spec.loader.exec_module(converter)

compact = converter.read_json(ROOT / "data" / "vox_sessions_08-15Jul.json.gz")
metadata = converter.read_json(ROOT / "data" / "movie_metadata_08-15Jul.json")
compact_rows, compact_raw, compact_duplicates = converter.parse_rows(compact)
converter.validate(compact, metadata, compact_rows, compact_raw)

flat = {
    "catalog": metadata,
    "cinemas": compact["cinemas"],
    "sessions": compact_rows,
}
flat_rows, flat_raw, flat_duplicates = converter.parse_rows(flat)
converter.validate(flat, metadata, flat_rows, flat_raw)

assert len(compact_rows) == len(flat_rows) == 6500
assert compact_duplicates == 1
assert flat_duplicates == 0
assert compact_rows == flat_rows
print("Validated compact and handoff-style flat extraction compatibility (6,500 sessions).")


# PDF Master roadmap

**Shipping first:** a privacy-first PDF editor and toolbox usable from a normal web UI or by Remote Arc via DOM.

## v0.1 — In the app
- [x] Render a PDF, zoom, navigate, edit native AcroForm text/checkbox values.
- [x] Detect reviewable field suggestions on text-based PDFs, including inline labels like Birthday / Date / Month.
- [x] Place, edit, drag, resize new text, date, checkbox and typed signature fields.
- [x] Export a new PDF with genuine editable AcroForm fields.
- [x] Locally autosave and import/export JSON field drafts.
- [x] Merge, split by page range, rotate/reorder/remove pages.
- [x] Safe optimize or explicitly rasterize with quality control and loss warnings.
- [x] Hover/focus expanding tool rail and fields drawer; pin drawer; keyboard focus; reduced-motion support.
- [x] Accessible DOM labels so Browser Runner / Shared Tabs can fill fields without a dedicated MCP.

## Next: correctness and document coverage
- [ ] True OCR for image-only PDFs with a clear per-page confidence score and manual review.
- [ ] Embedded multilingual fonts (CJK and non-Latin input) for reliable PDF field appearance.
- [ ] Better suggestion geometry: columns, table cells, radio buttons and multi-line labels.
- [ ] Highlight, sticky notes, text stamps, image stamps and visual handwritten signatures.
- [ ] Drag page thumbnail reordering, batch renaming and multi-file jobs.
- [ ] Fidelity regression tests on complex PDF forms, rotated pages, huge/scanned PDFs.
- [ ] Optional true flattening; preserve interactive fields by default.
- [ ] Responsive mobile editing and touch-optimized canvas.

## Later: advanced workflow
- [ ] Verified permanent content redaction (not merely drawing opaque rectangles).
- [ ] Password protection/unlocking with a capable PDF engine, mindful of encryption security.
- [ ] High-fidelity extraction and font/layout-aware existing text editing where feasible.
- [ ] Batch CLI / deterministic operation API, then optionally an MCP interface to expose safe actions to AI.
- [ ] Privacy-respecting templates and offline/PWA caching.

## Engineering constraints
- Don't make unsafe claims: a scanned image is not searchable until OCR.
- Strong raster compression destroys searchable text, native forms and links.
- Merely painting over text is **not** secure redaction.
- Typed names are not cryptographic signatures.
- Documents must not be uploaded without explicit consent.
- Before releasing a feature, test it on actual export documents and inspect output.

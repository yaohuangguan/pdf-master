# PDF Master

A local-first, AI-ready PDF editor and toolbox.

## Features
Edit & fill native and newly created PDF fields, merge, split, compress, organize, locally save drafts, export editable PDFs.

## AI through Remote Arc
Use a shared tab or Browser Runner. Upload a PDF, pin the Fields sidebar, fill labeled HTML inputs, and export. All controls use normal HTML semantics, accessible labels, and data-field identifiers. No separate MCP is necessary for basic edits.

## Limitations
Label suggestions require selectable PDF text, not OCR. Image-only scans need manual fields. PDF text content cannot be semantically replaced in this version. Typed signatures are not digital signatures. Strong image-based compression loses selectable text, native forms and links. Safe optimization might increase file size.

## Development

```bash
npm ci
npm run dev
npm run build
npm test
```

Deploy `dist/` as static Cloudflare Pages assets.

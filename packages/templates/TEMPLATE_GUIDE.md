# Thermal Label Studio Template Guide

This folder contains starter JSON templates for two print modes:

- `sticker_sheet_2x3`: 6 stickers on one 4x6 label (2 columns × 3 rows)
- `full_label_4x6`: one full 4x6 design

All templates share one lightweight schema so OpenClaw (or any script) can replace fields before rendering/printing.

## File Layout

- `index.json` — manifest of all templates
- `sticker-sheets/*.template.json` — 2x3 sticker sheet templates
- `full-size/*.template.json` — full-size 4x6 templates

## Template Schema (v1)

```json
{
  "schemaVersion": "tls.template/v1",
  "id": "cute-mail-bears-sheet",
  "name": "Cute Mail Bears",
  "mode": "sticker_sheet_2x3",
  "canvas": {
    "width": 800,
    "height": 1200,
    "dpi": 203,
    "unit": "px"
  },
  "theme": {
    "tags": ["cute", "pastel", "mail"],
    "defaultPalette": {
      "bg": "#fff7fb",
      "fg": "#2f2235",
      "accent": "#ff6fae"
    }
  },
  "fields": {
    "recipient_name": {
      "type": "text",
      "label": "Recipient",
      "default": "Monroe",
      "maxLength": 32
    },
    "icon_image": {
      "type": "image",
      "label": "Optional icon",
      "required": false,
      "fit": "cover"
    }
  },
  "elements": [
    {
      "type": "text",
      "field": "recipient_name",
      "x": 120,
      "y": 180,
      "w": 260,
      "h": 64,
      "style": {
        "fontFamily": "Baloo",
        "fontSize": 42,
        "align": "center"
      }
    },
    {
      "type": "image",
      "field": "icon_image",
      "optional": true,
      "x": 36,
      "y": 36,
      "w": 84,
      "h": 84,
      "style": {
        "shape": "circle",
        "stroke": "#ff6fae"
      }
    }
  ]
}
```

## Field Types

- `text`
  - Editable string token
  - Use `maxLength` and `multiline` for validation
- `image`
  - Optional or required uploaded image placeholder
  - Typical fits: `cover`, `contain`

## How OpenClaw Can Replace Fields Programmatically

### 1) Build a replacement payload

```json
{
  "recipient_name": "Ava",
  "sender_name": "Monroe",
  "short_note": "Fragile ♥",
  "icon_image": "/tmp/star.png"
}
```

### 2) Merge values into the template (Node.js example)

```js
import fs from 'node:fs';

const template = JSON.parse(fs.readFileSync('cute-mail-bears-sheet.template.json', 'utf8'));
const values = {
  recipient_name: 'Ava',
  sender_name: 'Monroe',
  short_note: 'Fragile ♥',
  icon_image: '/tmp/star.png'
};

for (const [fieldId, fieldDef] of Object.entries(template.fields)) {
  const incoming = values[fieldId];
  if (incoming === undefined) continue;

  if (fieldDef.type === 'text') {
    fieldDef.value = String(incoming);
  } else if (fieldDef.type === 'image') {
    fieldDef.value = String(incoming); // path/URL/asset key
  }
}

fs.writeFileSync('/tmp/filled-template.json', JSON.stringify(template, null, 2));
```

### 3) Render

Renderer reads `elements[*].field` and pulls `template.fields[field].value` (or `default` if missing).

## Notes

- All starter templates use a 4x6 canvas at `800x1200 @ 203dpi`.
- Sticker sheets are pre-laid out for 6 cells.
- Image placeholders are optional in all starter templates to keep text-only runs easy.

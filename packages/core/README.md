# @tls/core

Shared types and render pipeline stubs.

## Commands

```bash
pnpm --filter @tls/core build
```

## Source-image crops

`LabelImageElement.crop` optionally stores a non-destructive region in original
image pixels: `{ x, y, width, height, sourceWidth, sourceHeight }`. Positions must
be finite and nonnegative; dimensions must be finite and positive; the region
must stay inside the supplied source dimensions. The original raster data URL
is retained. The caller supplies the decoded source image's dimensions.

`add-image` accepts `crop` either directly or on `element`. `update-image` accepts
`crop` to replace the region, `crop: null` to restore the full image, or an omitted
`crop` to retain the current region. Existing documents without a crop render as
before. Both `contain` and `cover` operate on the selected region, with rotation
still applied around the image frame's center. The shared SVG renderer clips
both the source region and destination frame for preview and print preparation.

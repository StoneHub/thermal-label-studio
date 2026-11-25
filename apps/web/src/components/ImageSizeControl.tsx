import React from "react";
import type { LabelImageElement } from "@tls/core";
import { MIN_IMAGE_SCALE_PERCENT, imageScalePercent, printedCropSize, scaleImageToPercent, type Size } from "../lib/editorModel";

interface Props {
  image: LabelImageElement;
  label: Size;
  draft: number | null;
  disabled?: boolean;
  onDraft: (percent: number) => void;
  /** Apply the draft, or the given percentage, as one undoable edit. */
  onCommit: (percent?: number) => void;
}

/**
 * Size slider for the selected image. 100% is the largest size that fits the
 * label, so cropping first and then scaling up enlarges the kept area.
 */
export function ImageSizeControl({ image, label, draft, disabled, onDraft, onCommit }: Props) {
  const percent = draft ?? imageScalePercent(image, label);
  const shown = draft === null ? image : { ...image, ...scaleImageToPercent(image, label, draft) };
  const printed = printedCropSize(shown);
  const commitKeys = (event: React.KeyboardEvent) => {
    if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End"].includes(event.key)) onCommit();
  };
  return <div className="image-controls">
    <label className="field-label" htmlFor="image-size">Size</label>
    <div className="size-control">
      <input id="image-size" type="range" min={MIN_IMAGE_SCALE_PERCENT} max={100} step={1} value={percent} disabled={disabled}
        aria-valuetext={`${percent}% of the largest size that fits`}
        onChange={(event) => onDraft(event.currentTarget.valueAsNumber)}
        onPointerUp={() => onCommit()} onKeyUp={commitKeys} onBlur={() => onCommit()} />
      <output htmlFor="image-size">{percent}%</output>
    </div>
    <div className="property-button-row">
      <button className="button" type="button" disabled={disabled || percent <= MIN_IMAGE_SCALE_PERCENT} onClick={() => onCommit(Math.max(MIN_IMAGE_SCALE_PERCENT, percent - 10))}>Smaller</button>
      <button className="button" type="button" disabled={disabled || percent >= 100} onClick={() => onCommit(100)}>Largest</button>
    </div>
    <p className="image-setting-summary">{printed
      ? `Prints about ${printed.width.toFixed(1)} × ${printed.height.toFixed(1)} in`
      : "100% is the largest size that fits the label."}</p>
  </div>;
}

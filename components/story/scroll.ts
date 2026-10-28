/** Step anchors and positions use the same scroll coordinate system. */
export function positionAt(scroll: number, anchors: readonly number[], hold: number): number {
  if (anchors.length < 2 || scroll <= anchors[0]) return 0;
  const last = anchors.length - 1;
  if (scroll >= anchors[last]) return last;
  const end = anchors.findIndex((anchor, index) => index > 0 && scroll < anchor);
  const fraction = (scroll - anchors[end - 1]) / Math.max(1, anchors[end] - anchors[end - 1]);
  return end - 1 + Math.max(0, (fraction - hold) / (1 - hold));
}

/** Enter a step when its leading edge crosses the reader's trigger line. */
export function stepAt(scroll: number, anchors: readonly number[]): number {
  let index = 0;
  while (index + 1 < anchors.length && scroll >= anchors[index + 1]) index++;
  return index;
}

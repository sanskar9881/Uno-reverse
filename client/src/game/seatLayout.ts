/**
 * Opponents sit on an arc from the left edge, over the top, to the right edge,
 * in turn order (clockwise), starting with the player after you. Positions are
 * seat centers in pixels inside a box of the given size.
 */
export function arcPositions(
  count: number,
  box: { width: number; height: number },
  seat: { width: number; height: number },
): Array<{ x: number; y: number }> {
  const start = 160;
  const end = 380;
  const cx = box.width / 2;
  const cy = box.height * 0.52;
  const rx = Math.max(0, box.width / 2 - seat.width / 2 - 8);
  const ryUp = Math.max(0, cy - seat.height / 2 - 4);
  const ryDown = Math.max(0, box.height - cy - seat.height / 2 - 4);
  return Array.from({ length: count }, (_, i) => {
    const angle = ((start + ((i + 0.5) * (end - start)) / count) * Math.PI) / 180;
    const sin = Math.sin(angle);
    return { x: cx + rx * Math.cos(angle), y: cy + (sin < 0 ? ryUp : ryDown) * sin };
  });
}

/** Turn order rotated so it starts right after `selfId` (self excluded). */
export function opponentsInSeatOrder(turnOrder: string[], selfId: string): string[] {
  const index = turnOrder.indexOf(selfId);
  if (index === -1) return [...turnOrder];
  return [...turnOrder.slice(index + 1), ...turnOrder.slice(0, index)];
}

/** `lengths[row * width + column]` is the LCS length of the two tails that start there. */
function tailLengths(
  previous: readonly string[],
  next: readonly string[],
  head: number,
  rows: number,
  columns: number
): Uint32Array {
  const width = columns + 1;
  const lengths = new Uint32Array((rows + 1) * width);
  for (let row = rows - 1; row >= 0; row -= 1) {
    for (let column = columns - 1; column >= 0; column -= 1) {
      const isSame = previous[head + row] === next[head + column];
      const skipPrevious = lengths[(row + 1) * width + column] ?? 0;
      const skipNext = lengths[row * width + column + 1] ?? 0;
      const keepBoth = (lengths[(row + 1) * width + column + 1] ?? 0) + 1;
      lengths[row * width + column] = isSame
        ? keepBoth
        : Math.max(skipPrevious, skipNext);
    }
  }
  return lengths;
}

/**
 * Longest common subsequence of two block lists. `matches[i]` is the index in
 * `next` that `previous[i]` survived as, or -1 when it was changed or removed.
 *
 * Runs on every keystroke: the shared head and tail are skipped first, so a
 * single edited block costs one pass over the document.
 */
export function alignBlocks(
  previous: readonly string[],
  next: readonly string[]
): number[] {
  const matches = new Array<number>(previous.length).fill(-1);
  let head = 0;
  while (
    head < previous.length &&
    head < next.length &&
    previous[head] === next[head]
  ) {
    matches[head] = head;
    head += 1;
  }
  let previousEnd = previous.length;
  let nextEnd = next.length;
  while (
    previousEnd > head &&
    nextEnd > head &&
    previous[previousEnd - 1] === next[nextEnd - 1]
  ) {
    previousEnd -= 1;
    nextEnd -= 1;
    matches[previousEnd] = nextEnd;
  }

  const rows = previousEnd - head;
  const columns = nextEnd - head;
  if (rows === 0 || columns === 0) {
    return matches;
  }

  const width = columns + 1;
  const lengths = tailLengths(previous, next, head, rows, columns);

  let row = 0;
  let column = 0;
  while (row < rows && column < columns) {
    const skipPrevious = lengths[(row + 1) * width + column] ?? 0;
    const skipNext = lengths[row * width + column + 1] ?? 0;
    if (previous[head + row] === next[head + column]) {
      matches[head + row] = head + column;
      row += 1;
      column += 1;
    } else if (skipPrevious >= skipNext) {
      row += 1;
    } else {
      column += 1;
    }
  }
  return matches;
}

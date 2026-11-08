/** Layout numbers of the Overview hero cards and their mini charts, kept in one place. */

export const HERO_CARD_MIN_HEIGHT = "min-h-[235px]";
export const MINI_CHART_HEIGHT = "h-28 sm:h-32";

/** Bar charts show at most this many groups; the Records chart folds the rest into "Others". */
export const MINI_CHART_MAX_BARS = 6;
/** X-axis labels longer than this are cut with an ellipsis. */
export const MINI_CHART_TICK_MAX_CHARS = 7;
/** Space the bar labels (top) and the axis labels need. */
export const MINI_CHART_MARGIN = { top: 14, right: 2, bottom: 0, left: 2 } as const;
export const MINI_CHART_TICK_Y_OFFSET = 8;
/** Room under the bars for an axis label on two lines. */
export const MINI_CHART_AXIS_HEIGHT = 40;
export const MINI_CHART_TICK_LINE_HEIGHT = 14;

/** Width of the category labels of the horizontal expiry strip; wide enough for "Expires within 30 days" on one line. */
export const EXPIRY_CHART_LABEL_WIDTH = { compact: 180, full: 196 } as const;
/** Keeps a small non-zero bar visible. */
export const MINI_CHART_MIN_BAR_SIZE = 3;
export const MINI_CHART_BAR_RADIUS: [number, number, number, number] = [3, 3, 0, 0];

/** Half-donut gauge geometry. */
export const GAUGE_CENTER_Y = "85%";
export const GAUGE_INNER_RADIUS = "70%";
export const GAUGE_OUTER_RADIUS = "100%";
export const GAUGE_SEGMENT_GAP_DEGREES = 3;

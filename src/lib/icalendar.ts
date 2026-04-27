import type { ActivityId } from "../types";

/** Map event titles / summaries → activity id (Google Calendar & legacy helpers). */
export function inferActivityFromSummary(summary: string): ActivityId {
  const s = summary.toLowerCase();
  if (/(sleep|rest|bed)/.test(s)) return "sleep";
  if (/(gym|workout|run|lift|sport)/.test(s)) return "gym";
  if (/(class|lecture|school|uni)/.test(s)) return "class";
  if (/(focus|study|deep)/.test(s)) return "focus";
  if (/(commute|drive|bus|train)/.test(s)) return "commute";
  if (/(social|party|dinner|lunch with)/.test(s)) return "social";
  if (/(travel|flight)/.test(s)) return "travel";
  if (/(chill|free|relax|tv)/.test(s)) return "chill";
  if (/(work|meeting|office|email)/.test(s)) return "work";
  return "work";
}

import { SchedulePostHCard } from "./SchedulePostHCard";
import type { SchedulePostDoc } from "../lib/schedulePosts";

type FeedPostCardProps = {
  data: SchedulePostDoc;
  onOpen: () => void;
  variant: "feed" | "profile";
};

/** Feed-optimized post row (reuses schedule post data, calmer list styling). */
export function FeedPostCard(props: FeedPostCardProps) {
  return <SchedulePostHCard {...props} variant={props.variant} className="feed-post-card" />;
}

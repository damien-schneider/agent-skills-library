import { cronJobs } from "convex/server";

import { internal } from "./_generated/api";

const crons = cronJobs();

// Run every 6 hours to archive skills with score < -10
crons.interval(
  "archive low-score skills",
  { hours: 6 },
  internal.skills.archiveLowScoreSkills
);

export default crons;

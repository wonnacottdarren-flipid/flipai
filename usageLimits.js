import { incrementUsage } from "./db.js";

const FREE_PLAN_LIMIT = 3;

export function canUserSearch(user) {
  if (!user) return false;

  // paid users = unlimited
  if (user.plan === "pro" || user.plan === "premium") {
    return true;
  }

  const usage = Number(user.usageCount || 0);
  return usage < FREE_PLAN_LIMIT;
}

export function recordSearchUsage(user) {
  if (!user) return;

  // do not count for paid users
  if (user.plan === "pro" || user.plan === "premium") {
    return;
  }

  try {
    incrementUsage(user.id);
  } catch (err) {
    console.error("Failed to increment usage:", err);
  }
}

export function getRemainingSearches(user) {
  if (!user) return 0;

  if (user.plan === "pro" || user.plan === "premium") {
    return "unlimited";
  }

  const usage = Number(user.usageCount || 0);
  return Math.max(0, FREE_PLAN_LIMIT - usage);
}

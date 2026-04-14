import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const USERS_FILE = path.join(__dirname, "users.json");

function ensureUsersFile() {
  if (!fs.existsSync(USERS_FILE)) {
    fs.writeFileSync(USERS_FILE, JSON.stringify({ users: [] }, null, 2), "utf8");
  }
}

function readUsersFile() {
  ensureUsersFile();

  try {
    const raw = fs.readFileSync(USERS_FILE, "utf8");
    const parsed = JSON.parse(raw);

    if (parsed && Array.isArray(parsed.users)) {
      return parsed;
    }

    return { users: [] };
  } catch (error) {
    console.error("readUsersFile error:", error);
    return { users: [] };
  }
}

function writeUsersFile(data) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(data, null, 2), "utf8");
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function currentUsagePeriod() {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

export function safeUser(user) {
  if (!user) return null;

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    createdAt: user.createdAt || null,
    stripeCustomerId: user.stripeCustomerId || null,
    stripeSubscriptionId: user.stripeSubscriptionId || null,
    subscriptionStatus: user.subscriptionStatus || "free",
    plan: user.plan || "free",
    usageCount: Number(user.usageCount || 0),
    usagePeriod: user.usagePeriod || currentUsagePeriod(),
  };
}

export function getUserByEmail(email) {
  const cleanEmail = normalizeEmail(email);
  const data = readUsersFile();

  return data.users.find((user) => normalizeEmail(user.email) === cleanEmail) || null;
}

export function getUserById(id) {
  const data = readUsersFile();
  return data.users.find((user) => user.id === id) || null;
}

export function getUserByStripeCustomerId(stripeCustomerId) {
  const data = readUsersFile();
  return data.users.find((user) => user.stripeCustomerId === stripeCustomerId) || null;
}

export function createUser({ name, email, passwordHash }) {
  const data = readUsersFile();

  const user = {
    id: crypto.randomUUID(),
    name: String(name || "").trim(),
    email: normalizeEmail(email),
    passwordHash,
    createdAt: new Date().toISOString(),
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    subscriptionStatus: "free",
    plan: "free",
    usageCount: 0,
    usagePeriod: currentUsagePeriod(),
  };

  data.users.push(user);
  writeUsersFile(data);

  return user;
}

export function updateUser(updatedUser) {
  const data = readUsersFile();
  const index = data.users.findIndex((user) => user.id === updatedUser.id);

  if (index === -1) {
    throw new Error("User not found.");
  }

  data.users[index] = updatedUser;
  writeUsersFile(data);

  return updatedUser;
}

export function resetUsageIfNeeded(user) {
  const currentUser = getUserById(user.id);
  if (!currentUser) return null;

  const period = currentUsagePeriod();

  if (currentUser.usagePeriod !== period) {
    currentUser.usagePeriod = period;
    currentUser.usageCount = 0;
    updateUser(currentUser);
  }

  return currentUser;
}

export function incrementUsage(userId) {
  const user = getUserById(userId);

  if (!user) {
    throw new Error("User not found.");
  }

  user.usageCount = Number(user.usageCount || 0) + 1;
  updateUser(user);

  return user;
}

export function enforceUsage(user) {
  const currentUser = resetUsageIfNeeded(user);

  if (!currentUser) {
    throw new Error("User not found.");
  }

  const usage = Number(currentUser.usageCount || 0);
  const plan = String(currentUser.plan || "free").toLowerCase();
  const status = String(currentUser.subscriptionStatus || "free").toLowerCase();

  // Pro = unlimited
  if (plan === "pro" && (status === "active" || status === "trialing")) {
    return currentUser;
  }

  // Starter = 25 analyses
  if (plan === "starter" && (status === "active" || status === "trialing")) {
    if (usage >= 25) {
      const error = new Error("Starter limit reached. Upgrade to Pro for unlimited analyses.");
      error.statusCode = 403;
      throw error;
    }
    return currentUser;
  }

  // Free = 5 analyses
  if (usage >= 5) {
    const error = new Error("Free limit reached. Upgrade to continue.");
    error.statusCode = 403;
    throw error;
  }

  return currentUser;
}

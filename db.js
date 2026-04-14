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

    if (Array.isArray(parsed)) {
      return { users: parsed };
    }

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
    usagePeriod: user.usagePeriod || null,
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

export function createUser({ name, email, passwordHash }) {
  const data = readUsersFile();

  const now = new Date();
  const usagePeriod = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;

  const user = {
    id: crypto.randomUUID(),
    name: String(name || "").trim(),
    email: normalizeEmail(email),
    passwordHash,
    createdAt: now.toISOString(),
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    subscriptionStatus: "free",
    plan: "free",
    usageCount: 0,
    usagePeriod,
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

  const now = new Date();
  const currentPeriod = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;

  if (currentUser.usagePeriod !== currentPeriod) {
    currentUser.usageCount = 0;
    currentUser.usagePeriod = currentPeriod;
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

  if (
    currentUser.subscriptionStatus !== "active" &&
    currentUser.subscriptionStatus !== "trialing" &&
    Number(currentUser.usageCount || 0) >= 5
  ) {
    const error = new Error("Free usage limit reached.");
    error.statusCode = 403;
    throw error;
  }

  return currentUser;
}

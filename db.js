import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const USERS_FILE = path.join(__dirname, "users.json");

function ensureUsersFile() {
  if (!fs.existsSync(USERS_FILE)) {
    fs.writeFileSync(USERS_FILE, "[]", "utf8");
  }
}

function readUsers() {
  ensureUsersFile();

  try {
    const raw = fs.readFileSync(USERS_FILE, "utf8");
    const parsed = JSON.parse(raw);

    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error("readUsers error:", error);
    return [];
  }
}

function writeUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), "utf8");
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
    subscriptionStatus: user.subscriptionStatus || "free",
    usageCount: user.usageCount || 0,
    usageResetAt: user.usageResetAt || null,
    stripeCustomerId: user.stripeCustomerId || null,
  };
}

export function getUserByEmail(email) {
  const cleanEmail = normalizeEmail(email);
  const users = readUsers();

  return users.find((user) => normalizeEmail(user.email) === cleanEmail) || null;
}

export function getUserById(id) {
  const users = readUsers();
  return users.find((user) => user.id === id) || null;
}

export function createUser({ name, email, passwordHash }) {
  const users = readUsers();

  const user = {
    id: crypto.randomUUID(),
    name: String(name || "").trim(),
    email: normalizeEmail(email),
    passwordHash,
    subscriptionStatus: "free",
    usageCount: 0,
    usageResetAt: new Date().toISOString(),
    stripeCustomerId: null,
    createdAt: new Date().toISOString(),
  };

  users.push(user);
  writeUsers(users);

  return user;
}

export function updateUser(updatedUser) {
  const users = readUsers();
  const index = users.findIndex((user) => user.id === updatedUser.id);

  if (index === -1) {
    throw new Error("User not found.");
  }

  users[index] = updatedUser;
  writeUsers(users);

  return updatedUser;
}

export function resetUsageIfNeeded(user) {
  const currentUser = getUserById(user.id);

  if (!currentUser) return null;

  const now = new Date();
  const resetAt = currentUser.usageResetAt
    ? new Date(currentUser.usageResetAt)
    : null;

  if (!resetAt || now - resetAt > 1000 * 60 * 60 * 24 * 30) {
    currentUser.usageCount = 0;
    currentUser.usageResetAt = now.toISOString();
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

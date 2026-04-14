import fs from "fs";
import path from "path";
import crypto from "crypto";

const DATA_DIR = path.join(process.cwd(), "flipai_data");
const USERS_FILE = path.join(DATA_DIR, "users.json");

export const PLAN_CONFIG = {
  starter: { name: "Starter", monthlyLimit: 10 },
  growth: { name: "Growth", monthlyLimit: 50 },
  pro: { name: "Pro", monthlyLimit: null },
};

function ensureDb() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(USERS_FILE)) {
    fs.writeFileSync(USERS_FILE, JSON.stringify({ users: [] }, null, 2));
  }
}

function readDb() {
  ensureDb();
  return JSON.parse(fs.readFileSync(USERS_FILE, "utf8"));
}

function writeDb(db) {
  ensureDb();
  fs.writeFileSync(USERS_FILE, JSON.stringify(db, null, 2));
}

export function createUser({ name, email, passwordHash }) {
  const db = readDb();
  const now = new Date().toISOString();
  const user = {
    id: crypto.randomUUID(),
    name,
    email: email.toLowerCase(),
    passwordHash,
    createdAt: now,
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    subscriptionStatus: "free",
    plan: "free",
    usageCount: 0,
    usagePeriod: new Date().toISOString().slice(0, 7),
  };
  db.users.push(user);
  writeDb(db);
  return user;
}

export function getUserByEmail(email) {
  const db = readDb();
  return db.users.find((u) => u.email === String(email).toLowerCase()) || null;
}

export function getUserById(id) {
  const db = readDb();
  return db.users.find((u) => u.id === id) || null;
}

export function getUserByStripeCustomerId(customerId) {
  const db = readDb();
  return db.users.find((u) => u.stripeCustomerId === customerId) || null;
}

export function updateUser(userId, updater) {
  const db = readDb();
  const index = db.users.findIndex((u) => u.id === userId);
  if (index === -1) return null;
  db.users[index] = updater(db.users[index]);
  writeDb(db);
  return db.users[index];
}

export function resetUsageIfNeeded(user) {
  const currentPeriod = new Date().toISOString().slice(0, 7);
  if (user.usagePeriod !== currentPeriod) {
    return updateUser(user.id, (u) => ({
      ...u,
      usagePeriod: currentPeriod,
      usageCount: 0,
    }));
  }
  return user;
}

export function safeUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    plan: user.plan,
    subscriptionStatus: user.subscriptionStatus,
    usageCount: user.usageCount,
    usagePeriod: user.usagePeriod,
    usageLimit: PLAN_CONFIG[user.plan]?.monthlyLimit ?? null,
  };
}

export function enforceUsage(user) {
  const cfg = PLAN_CONFIG[user.plan];
  if (!cfg || cfg.monthlyLimit === null) return { allowed: true, limit: null };
  if (user.usageCount >= cfg.monthlyLimit) {
    return { allowed: false, limit: cfg.monthlyLimit };
  }
  return { allowed: true, limit: cfg.monthlyLimit };
}

export function incrementUsage(user) {
  return updateUser(user.id, (u) => ({
    ...u,
    usageCount: (u.usageCount || 0) + 1,
  }));
}

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const USERS_FILE = path.join(__dirname, "users.json");

// Ensure file exists
if (!fs.existsSync(USERS_FILE)) {
  fs.writeFileSync(USERS_FILE, JSON.stringify({ users: [] }, null, 2));
}

// Read users
function readData() {
  const raw = fs.readFileSync(USERS_FILE, "utf8");
  return JSON.parse(raw);
}

// Write users
function writeData(data) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(data, null, 2));
}

// Normalize email
function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

// Safe user (hide password)
export function safeUser(user) {
  if (!user) return null;

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    subscriptionStatus: user.subscriptionStatus || "free",
    usageCount: user.usageCount || 0,
  };
}

// Get by email
export function getUserByEmail(email) {
  const data = readData();
  const clean = normalizeEmail(email);

  return data.users.find(u => normalizeEmail(u.email) === clean) || null;
}

// Get by ID
export function getUserById(id) {
  const data = readData();
  return data.users.find(u => u.id === id) || null;
}

// Create user
export function createUser({ name, email, passwordHash }) {
  const data = readData();

  const user = {
    id: crypto.randomUUID(),
    name: String(name || "").trim(),
    email: normalizeEmail(email),
    passwordHash,
    subscriptionStatus: "free",
    usageCount: 0,
    createdAt: new Date().toISOString(),
  };

  data.users.push(user);
  writeData(data);

  return user;
}

// Usage helpers (simple versions)
export function resetUsageIfNeeded(user) {
  return user;
}

export function incrementUsage(userId) {
  const data = readData();
  const user = data.users.find(u => u.id === userId);

  if (!user) return null;

  user.usageCount = (user.usageCount || 0) + 1;
  writeData(data);

  return user;
}

export function enforceUsage(user) {
  return user;
}

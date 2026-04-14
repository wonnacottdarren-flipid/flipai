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

// Read file
function readUsers() {
  const raw = fs.readFileSync(USERS_FILE, "utf8");
  const data = JSON.parse(raw);

  return Array.isArray(data.users) ? data.users : [];
}

// Write file
function writeUsers(users) {
  fs.writeFileSync(
    USERS_FILE,
    JSON.stringify({ users }, null, 2),
    "utf8"
  );
}

// Normalize email
function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

// Safe user
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
  const users = readUsers();
  const clean = normalizeEmail(email);

  return users.find(u => normalizeEmail(u.email) === clean) || null;
}

// Get by ID
export function getUserById(id) {
  const users = readUsers();
  return users.find(u => u.id === id) || null;
}

// Create user
export function createUser({ name, email, passwordHash }) {
  const users = readUsers();

  const user = {
    id: crypto.randomUUID(),
    name: String(name || "").trim(),
    email: normalizeEmail(email),
    passwordHash,
    createdAt: new Date().toISOString(),
    subscriptionStatus: "free",
    usageCount: 0,
  };

  users.push(user);
  writeUsers(users);

  return user;
}

// Usage functions (keep simple)
export function resetUsageIfNeeded(user) {
  return user;
}

export function incrementUsage(userId) {
  const users = readUsers();
  const user = users.find(u => u.id === userId);

  if (!user) return null;

  user.usageCount = (user.usageCount || 0) + 1;
  writeUsers(users);

  return user;
}

export function enforceUsage(user) {
  return user;
}

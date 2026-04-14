import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import {
  createUser,
  getUserByEmail,
  getUserById,
  resetUsageIfNeeded,
  safeUser,
} from "./db.js";

const JWT_SECRET = process.env.JWT_SECRET || "change_me";
const isProd = process.env.NODE_ENV === "production";

export function setAuthCookie(res, user) {
  const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: "30d" });
  res.cookie("flipai_token", token, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    maxAge: 1000 * 60 * 60 * 24 * 30,
  });
}

export function clearAuthCookie(res) {
  res.clearCookie("flipai_token", {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
  });
}

export function requireAuth(req, res, next) {
  try {
    const token = req.cookies.flipai_token;
    if (!token) return res.status(401).json({ error: "Please sign in first." });

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = getUserById(decoded.userId);
    if (!user) return res.status(401).json({ error: "User not found." });

    req.user = resetUsageIfNeeded(user);
    next();
  } catch {
    return res.status(401).json({ error: "Your session has expired. Please sign in again." });
  }
}

export function requirePaidPlan(req, res, next) {
  if (!["active", "trialing"].includes(req.user.subscriptionStatus)) {
    return res.status(403).json({ error: "You need an active paid plan to use FlipAI analysis." });
  }
  next();
}

export async function signupHandler(req, res) {
  try {
    const { name, email, password } = req.body || {};
    if (!name || !email || !password) {
      return res.status(400).json({ error: "Name, email, and password are required." });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters." });
    }
    if (getUserByEmail(email)) {
      return res.status(409).json({ error: "An account with this email already exists." });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = createUser({ name, email, passwordHash });
    setAuthCookie(res, user);
    return res.json({ user: safeUser(user) });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Could not create account." });
  }
}

export async function loginHandler(req, res) {
  try {
    const { email, password } = req.body || {};
    const user = getUserByEmail(email || "");
    if (!user) return res.status(401).json({ error: "Invalid email or password." });

    const ok = await bcrypt.compare(password || "", user.passwordHash);
    if (!ok) return res.status(401).json({ error: "Invalid email or password." });

    setAuthCookie(res, user);
    return res.json({ user: safeUser(resetUsageIfNeeded(user)) });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Could not sign in." });
  }
}

export function logoutHandler(_req, res) {
  clearAuthCookie(res);
  return res.json({ ok: true });
}

import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "ujiankita-secret-change-in-production";
const EXPIRES_IN = "24h";

/**
 * @param {{ userId: string; username: string; role: string }} payload
 */
export function generateToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: EXPIRES_IN });
}

/**
 * @param {string} token
 * @returns {{ userId: string; username: string; role: string } | null}
 */
export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

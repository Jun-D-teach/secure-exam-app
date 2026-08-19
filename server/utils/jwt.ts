import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "ujiankita-secret-change-in-production";
const EXPIRES_IN = "24h";

export interface JwtPayload {
  userId: string;
  username: string;
  role: string;
}

export function generateToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: EXPIRES_IN });
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JwtPayload;
  } catch {
    return null;
  }
}

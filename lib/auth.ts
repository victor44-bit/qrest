// lib/auth.ts
import { SignJWT, jwtVerify, JWTPayload } from "jose";

const secret = new TextEncoder().encode(process.env.JWT_SECRET || "dev-secret");

export async function signSession(
  payload: JWTPayload,
  // jose supports strings like "7d", "1h", "30m", or a numeric timestamp (in seconds)
  expiresIn: string | number = "7d"
) {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt()
    .setExpirationTime(expiresIn) // <- this is the correct method
    .sign(secret);
}

export async function verifySession<T extends JWTPayload = JWTPayload>(token: string): Promise<T> {
  const { payload } = await jwtVerify(token, secret);
  return payload as T;
}

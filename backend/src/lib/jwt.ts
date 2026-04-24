import { SignJWT, jwtVerify } from "jose";
import { env } from "./env";

const secret = new TextEncoder().encode(env.JWT_SECRET);

export async function mintJwt(
  teacherId: string,
  ttlSeconds = 60 * 15
): Promise<string> {
  return new SignJWT({ sub: teacherId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + ttlSeconds)
    .sign(secret);
}

export async function verifyJwt(token: string): Promise<{ teacherId: string }> {
  const { payload } = await jwtVerify(token, secret);
  if (typeof payload.sub !== "string") throw new Error("invalid jwt");
  return { teacherId: payload.sub };
}

/**
 * 用户与短信验证码（OTP）存取。配置 DATABASE_URL 走 PostgreSQL，否则内存回退（本地/CI/无 DB）。
 * OTP 以 scrypt 加盐哈希存储，带 5 分钟过期与尝试次数上限。
 */
import { randomBytes, randomInt, scryptSync, timingSafeEqual } from "node:crypto";
import { getPool, usePostgres } from "./db";

export interface User {
  id: string;
  phone: string;
  name: string | null;
}

const OTP_TTL_MS = 5 * 60_000;
const OTP_MAX_ATTEMPTS = 5;

function newUserId(): string {
  return `u_${randomBytes(12).toString("base64url")}`;
}

/** 生成 6 位数字验证码（CSPRNG）。 */
export function generateOtpCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

function hashCode(code: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(code, salt, 32);
  return `${salt.toString("hex")}:${hash.toString("hex")}`;
}

function verifyCodeHash(code: string, stored: string): boolean {
  const [saltHex, hashHex] = stored.split(":");
  if (!saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const actual = scryptSync(code, Buffer.from(saltHex, "hex"), expected.length);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

// ---- 内存回退 ----
const memUsers = new Map<string, User>(); // key: phone
type OtpRow = { codeHash: string; expiresAt: number; attempts: number };
const memOtp = new Map<string, OtpRow>(); // key: phone

export async function getUserByPhone(phone: string): Promise<User | null> {
  if (usePostgres) {
    const { rows } = await getPool().query(`SELECT id, phone, name FROM users WHERE phone = $1`, [
      phone,
    ]);
    return rows[0] ? { id: rows[0].id, phone: rows[0].phone, name: rows[0].name ?? null } : null;
  }
  return memUsers.get(phone) ?? null;
}

/** 取或建：登录成功后据手机号确保用户存在。 */
export async function upsertUserByPhone(phone: string): Promise<User> {
  const existing = await getUserByPhone(phone);
  if (existing) return existing;
  const user: User = { id: newUserId(), phone, name: null };
  if (usePostgres) {
    // 并发下另一个请求可能已插入：ON CONFLICT 后回读，保证返回库中权威行。
    await getPool().query(
      `INSERT INTO users (id, phone) VALUES ($1, $2) ON CONFLICT (phone) DO NOTHING`,
      [user.id, phone],
    );
    return (await getUserByPhone(phone)) ?? user;
  }
  memUsers.set(phone, user);
  return user;
}

/** 生成并存储该手机号的验证码（覆盖旧码、重置尝试次数）。 */
export async function saveOtp(phone: string, code: string): Promise<void> {
  const codeHash = hashCode(code);
  if (usePostgres) {
    await getPool().query(
      `INSERT INTO otp_codes (phone, code_hash, expires_at, attempts, created_at)
       VALUES ($1, $2, $3, 0, now())
       ON CONFLICT (phone) DO UPDATE SET code_hash = $2, expires_at = $3, attempts = 0, created_at = now()`,
      [phone, codeHash, new Date(Date.now() + OTP_TTL_MS).toISOString()],
    );
    return;
  }
  memOtp.set(phone, { codeHash, expiresAt: Date.now() + OTP_TTL_MS, attempts: 0 });
}

/**
 * 校验验证码：成功消费（删除）并返回 true；失败累计尝试，超限或过期即失效。
 * 先原子自增 attempts 再比对，缩小并发暴力窗口。
 */
export async function verifyOtp(phone: string, code: string): Promise<boolean> {
  if (usePostgres) {
    const pool = getPool();
    const { rows } = await pool.query(
      `UPDATE otp_codes SET attempts = attempts + 1 WHERE phone = $1
       RETURNING code_hash, expires_at, attempts`,
      [phone],
    );
    const row = rows[0];
    if (!row) return false;
    const expired = new Date(row.expires_at).getTime() < Date.now();
    if (expired || row.attempts > OTP_MAX_ATTEMPTS) {
      await pool.query(`DELETE FROM otp_codes WHERE phone = $1`, [phone]);
      return false;
    }
    if (verifyCodeHash(code, row.code_hash)) {
      await pool.query(`DELETE FROM otp_codes WHERE phone = $1`, [phone]);
      return true;
    }
    return false;
  }
  const row = memOtp.get(phone);
  if (!row) return false;
  row.attempts += 1;
  if (row.expiresAt < Date.now() || row.attempts > OTP_MAX_ATTEMPTS) {
    memOtp.delete(phone);
    return false;
  }
  if (verifyCodeHash(code, row.codeHash)) {
    memOtp.delete(phone);
    return true;
  }
  return false;
}

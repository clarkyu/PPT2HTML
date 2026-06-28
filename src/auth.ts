/**
 * Auth.js (NextAuth v5) 配置。手机号 + 验证码（Credentials），JWT 会话。
 * 用 Credentials 时 v5 仅支持 JWT 策略，故无需第三方 adapter——用户/验证码走自有 pg + 内存回退。
 */
import { randomBytes } from "node:crypto";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { normalizePhone } from "@/auth/phone";
import { upsertUserByPhone, verifyOtp } from "@/lib/user-store";
import { rateLimit } from "@/lib/rate-limit";

// 未配 AUTH_SECRET 时：生产留空交给 NextAuth 的 MissingSecret 硬失败；非生产用「每次启动随机」的
// 临时密钥（不可预测、不入库——避免固定占位被离线复现伪造 JWT；代价仅本地重启会话失效）。
if (!process.env.AUTH_SECRET && process.env.NODE_ENV !== "production") {
  process.env.AUTH_SECRET = randomBytes(32).toString("base64");
  console.warn("[auth] 使用每次启动随机生成的临时 AUTH_SECRET（仅本地开发，重启将失效所有会话）");
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  // 显式固定会话 cookie 安全语义，不依赖部署层透传 x-forwarded-proto：
  // 生产启用 Secure + __Secure-/__Host- 前缀；开发态走 http localhost。
  useSecureCookies: process.env.NODE_ENV === "production",
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      name: "phone-otp",
      credentials: { phone: {}, code: {} },
      authorize: async (creds) => {
        const phone = normalizePhone(String(creds?.phone ?? ""));
        const code = String(creds?.code ?? "");
        if (!phone || !/^\d{6}$/.test(code)) return null;
        // 校验侧限流（按手机号）：堵住「刷新码重置 attempts」绕过的暴力面，
        // 不随 saveOtp 清零，独立于下发额度。多副本部署需换 Redis（见 rate-limit.ts）。
        if (!rateLimit(`otpverify:phone:${phone}`, 10, 10 * 60_000)) return null;
        if (!(await verifyOtp(phone, code))) return null;
        const user = await upsertUserByPhone(phone);
        return { id: user.id, phone: user.phone, name: user.name ?? undefined };
      },
    }),
  ],
  callbacks: {
    jwt: ({ token, user }) => {
      if (user) {
        token.uid = user.id;
        token.phone = (user as { phone?: string }).phone;
      }
      return token;
    },
    session: ({ session, token }) => {
      const t = token as { uid?: string; phone?: string };
      if (t.uid) {
        session.user.id = t.uid;
        session.user.phone = t.phone ?? "";
      }
      return session;
    },
  },
});

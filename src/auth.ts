/**
 * Auth.js (NextAuth v5) 配置。手机号 + 验证码（Credentials），JWT 会话。
 * 用 Credentials 时 v5 仅支持 JWT 策略，故无需第三方 adapter——用户/验证码走自有 pg + 内存回退。
 */
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { normalizePhone } from "@/auth/phone";
import { upsertUserByPhone, verifyOtp } from "@/lib/user-store";

// 开发/CI 未配 AUTH_SECRET 时给一个不安全的占位，避免本地崩溃；生产必须显式配置（否则 NextAuth 报错）。
if (!process.env.AUTH_SECRET && process.env.NODE_ENV !== "production") {
  process.env.AUTH_SECRET = "dev-insecure-secret-yanke";
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
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

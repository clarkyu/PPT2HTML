import type { DefaultSession } from "next-auth";

// 会话/用户上携带手机号与稳定用户 id（供归属校验）。
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      phone: string;
    } & DefaultSession["user"];
  }
  interface User {
    phone?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    uid?: string;
    phone?: string;
  }
}

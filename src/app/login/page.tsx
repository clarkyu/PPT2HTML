"use client";

/**
 * 登录：手机号 + 短信验证码（Auth.js Credentials）。
 * 离线/开发（mock 渠道）下接口会回显验证码，便于自测；真实短信时不回显。
 */
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { isValidPhone } from "@/auth/phone";

type Step = "phone" | "code";
const RESEND_COOLDOWN = 60;

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const requestCode = async () => {
    setBusy(true);
    setError(null);
    setDevCode(null);
    try {
      const res = await fetch("/api/auth/otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const data = (await res.json()) as { error?: string; devCode?: string };
      if (!res.ok) throw new Error(data.error || "验证码下发失败");
      setStep("code");
      setCooldown(RESEND_COOLDOWN);
      if (data.devCode) setDevCode(data.devCode);
    } catch (e) {
      setError(e instanceof Error ? e.message : "出错了");
    } finally {
      setBusy(false);
    }
  };

  const submitCode = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await signIn("credentials", { phone, code, redirect: false });
      if (!res || res.error) throw new Error("验证码错误或已过期，请重试");
      router.push("/");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "登录失败");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-sm flex-col justify-center px-4 py-10">
      <Link href="/" className="text-sm text-muted hover:text-foreground">
        ← 返回
      </Link>
      <h1 className="mt-6 font-heading text-2xl font-bold">登录言课</h1>
      <p className="mt-2 text-sm text-muted">手机号 + 验证码即可登录，未注册将自动创建账户。</p>

      {error && (
        <p role="alert" aria-live="polite" className="mt-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}
      {devCode && (
        <p className="mt-4 rounded-lg bg-accent/15 px-3 py-2 text-xs text-foreground/80">
          离线模式验证码：<strong className="font-mono">{devCode}</strong>（仅开发环境回显）
        </p>
      )}

      {step === "phone" ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            requestCode();
          }}
          className="mt-6 space-y-3"
        >
          <label htmlFor="login-phone" className="sr-only">
            手机号
          </label>
          <input
            id="login-phone"
            type="tel"
            inputMode="numeric"
            autoComplete="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="请输入手机号"
            className="w-full rounded-lg border border-muted/30 bg-background p-3 text-base outline-none focus:border-primary"
          />
          <button
            type="submit"
            disabled={busy || !isValidPhone(phone)}
            className="w-full rounded-lg bg-primary px-5 py-2.5 font-medium text-white hover:opacity-90 disabled:opacity-40"
          >
            {busy ? "发送中…" : "获取验证码"}
          </button>
        </form>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submitCode();
          }}
          className="mt-6 space-y-3"
        >
          <label htmlFor="login-code" className="sr-only">
            验证码
          </label>
          <input
            id="login-code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            placeholder="请输入 6 位验证码"
            className="w-full rounded-lg border border-muted/30 bg-background p-3 text-center font-mono text-lg tracking-widest outline-none focus:border-primary"
          />
          <button
            type="submit"
            disabled={busy || code.length !== 6}
            className="w-full rounded-lg bg-primary px-5 py-2.5 font-medium text-white hover:opacity-90 disabled:opacity-40"
          >
            {busy ? "登录中…" : "登录"}
          </button>
          <div className="flex items-center justify-between text-sm">
            <button
              type="button"
              onClick={requestCode}
              disabled={busy || cooldown > 0}
              className="text-primary hover:underline disabled:text-muted disabled:no-underline"
            >
              {cooldown > 0 ? `${cooldown}s 后可重发` : "重新发送验证码"}
            </button>
            <button
              type="button"
              onClick={() => {
                setStep("phone");
                setCode("");
                setError(null);
                setCooldown(0);
              }}
              className="text-muted hover:text-foreground"
            >
              换个手机号
            </button>
          </div>
          <p className="text-center text-xs text-muted">验证码 5 分钟内有效</p>
        </form>
      )}
    </main>
  );
}

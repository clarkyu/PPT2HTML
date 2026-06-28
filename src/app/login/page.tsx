"use client";

/**
 * 登录：手机号 + 短信验证码（Auth.js Credentials）。
 * 离线/开发（mock 渠道）下接口会回显验证码，便于自测；真实短信时不回显。
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn } from "next-auth/react";

type Step = "phone" | "code";

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [devCode, setDevCode] = useState<string | null>(null);

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
        <p className="mt-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600">{error}</p>
      )}
      {devCode && (
        <p className="mt-4 rounded-lg bg-accent/15 px-3 py-2 text-xs text-foreground/80">
          离线模式验证码：<strong className="font-mono">{devCode}</strong>（仅开发环境回显）
        </p>
      )}

      {step === "phone" ? (
        <div className="mt-6 space-y-3">
          <input
            type="tel"
            inputMode="numeric"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="请输入手机号"
            className="w-full rounded-lg border border-muted/30 bg-background p-3 text-base outline-none focus:border-primary"
          />
          <button
            onClick={requestCode}
            disabled={busy || phone.trim().length < 6}
            className="w-full rounded-lg bg-primary px-5 py-2.5 font-medium text-white hover:opacity-90 disabled:opacity-40"
          >
            {busy ? "发送中…" : "获取验证码"}
          </button>
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            placeholder="请输入 6 位验证码"
            className="w-full rounded-lg border border-muted/30 bg-background p-3 text-center font-mono text-lg tracking-widest outline-none focus:border-primary"
          />
          <button
            onClick={submitCode}
            disabled={busy || code.length !== 6}
            className="w-full rounded-lg bg-primary px-5 py-2.5 font-medium text-white hover:opacity-90 disabled:opacity-40"
          >
            {busy ? "登录中…" : "登录"}
          </button>
          <button
            onClick={() => {
              setStep("phone");
              setCode("");
              setError(null);
            }}
            className="w-full text-center text-sm text-muted hover:text-foreground"
          >
            换个手机号
          </button>
        </div>
      )}
    </main>
  );
}

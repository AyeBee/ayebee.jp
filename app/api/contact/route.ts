// app/api/contact/route.ts
// Next.js App Router 用の問い合わせAPI
// - ランタイム: Node.js（Edge不可：nodemailer使用のため）
// - 送信: AWS SES (SMTP) 経由
// - 軽量レート制限 & 簡易バリデーション & （任意）hCaptcha対応

import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { readFileSync } from "fs";

export const runtime = "nodejs";        // nodemailerを使うためEdgeは不可
export const dynamic = "force-dynamic"; // 念のためキャッシュ無効

// --- レート制限（超簡易・インメモリ / 1分5回/IP） ---
const limiter = new Map<string, { count: number; ts: number }>();
const WINDOW_MS = 60000;
const MAX_REQ = 5;

const readSecret = (path: string): string => {
  try { return readFileSync(path, "utf8").trim(); }
  catch { return ""; }
}

const rateLimit = (ip: string): boolean => {
  const now = Date.now();
  const rec = limiter.get(ip);
  if (!rec || now - rec.ts > WINDOW_MS) {
    limiter.set(ip, { count: 1, ts: now });
    return true;
  }
  if (rec.count >= MAX_REQ) {
    return false;
  }
  rec.count++;
  return true;
}

const isEmail = (s: string): boolean => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

const sanitize = (s: string): string => {
  return String(s ?? "").toString().trim();
};

const getClientIp = (req: NextRequest): string => {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd && fwd.length) return fwd.split(",")[0].trim();

  return (
    req.headers.get("x-real-ip") ??
    req.headers.get("cf-connecting-ip") ??
    req.headers.get("fastly-client-ip") ??
    req.headers.get("fly-client-ip") ??
    req.headers.get("true-client-ip") ??
    req.headers.get("x-client-ip") ??
    req.headers.get("x-cluster-client-ip") ??
    (process.env.NODE_ENV === "development" ? "127.0.0.1" : "unknown")
  );
};

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req) || "unknown";

    if (!rateLimit(ip)) {
      return NextResponse.json(
        { ok: false, error: "Too many requests" },
        { status: 429 }
      );
    }

    const body = await req.json().catch(() => ({} as any));
    const organization = sanitize(body.organization || "");
    const name = sanitize(body.name);
    const email = sanitize(body.email);
    const message = sanitize(body.message);
    const website = sanitize(body.website || ""); // ハニーポット
    const hcaptchaToken = body.hcaptchaToken ? String(body.hcaptchaToken) : "";

    // ハニーポット：埋まってたら拒否
    if (website) {
      return NextResponse.json(
        { ok: false, error: "Bad request" },
        { status: 400 }
      );
    }

    // 必須チェック & 形式
    if (!name || !email || !message || !isEmail(email)) {
      return NextResponse.json(
        { ok: false, error: "Invalid payload" },
        { status: 400 }
      );
    }

//  // --- （任意）hCaptcha検証 ---
//  if (process.env.HCAPTCHA_SECRET && hcaptchaToken) {
//    const r = await fetch("https://hcaptcha.com/siteverify", {
//      method: "POST",
//      headers: { "Content-Type": "application/x-www-form-urlencoded" },
//      body: new URLSearchParams({
//        secret: process.env.HCAPTCHA_SECRET!,
//        response: hcaptchaToken,
//      }),
//    }).then((r) => r.json() as Promise<{ success: boolean }>);
//    if (!r.success) {
//      return NextResponse.json(
//        { ok: false, error: "hCaptcha failed" },
//        { status: 400 }
//      );
//    }
//  }

    // --- メール送信（nodemailer + SES SMTP） ---
    const requiredEnv = [
      "SMTP_HOST",
      "SMTP_PORT",
      "MAIL_FROM",
      "MAIL_TO",
    ] as const;
    for (const k of requiredEnv) {
      if (!process.env[k]) {
        return NextResponse.json(
          { ok: false, error: `Server misconfigured: ${k} missing` },
          { status: 500 }
        );
      }
    }

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST!,
      port: Number(process.env.SMTP_PORT || 587),
      secure: Number(process.env.SMTP_PORT || 587) === 465, // 465ならtrue
      auth: {
        user: process.env.SMTP_USER ?? readSecret("/run/secrets/smtp_user"),
        pass: process.env.SMTP_PASS ?? readSecret("/run/secrets/smtp_pass")
      }
    });

    const info = await transporter.sendMail({
      from: process.env.MAIL_FROM!,
      to: process.env.MAIL_TO!,
      replyTo: `${name} <${email}>`,
      subject: `【ayebee.jpの問い合わせ】${name}${organization ? ` / ${organization}` : ""}`,
      text: `
以下の通り問い合わせがありました。

IPアドレス: ${ip}
組織名: ${organization || "（未入力）"}
お名前: ${name}
メール: ${email}

メッセージ:
${message}
`
    });
    

    // 2通目：送信者（ユーザー）へ自動返信
    await transporter.sendMail({
    from: process.env.MAIL_FROM!,                 // ← あなたのドメイン
    to: email,                                    // ← ユーザーのメール
    replyTo: process.env.MAIL_TO!,                // 返信先はあなた側に
    headers: {
        "Auto-Submitted": "auto-replied",
        "X-Auto-Response-Suppress": "All",
    },
    subject: "【自動返信】お問い合わせを受け付けました",
    text: `${name} 様

あやびーと申します。

この度はウェブサイトよりお問い合わせありがとうございました。
以下の内容で受け付けました。

すべてのお問い合わせに返信することはできませんが、すべて目を通しております。

------------------------------
組織名: ${organization || "（未入力）"}
お名前: ${name}
メール: ${email}

メッセージ:
${message}
------------------------------

この度はお問い合わせいただきありがとうございました。

※本メールは送信専用の自動送信です。`,
    });

    return NextResponse.json({ ok: true, id: info.messageId });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "server error" },
      { status: 500 }
    );
  }
}

export async function GET() {
  // 動作確認用（不要なら削除）
  return NextResponse.json({ ok: true, method: "GET" });
}

export async function OPTIONS() {
  // CORSが必要な場合にここで許可ヘッダを返す（今回は同一オリジン想定なので最小）
  return NextResponse.json({ ok: true });
}

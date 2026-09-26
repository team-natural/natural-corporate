import { z } from "zod";

// Shared between the lead form script (components/diagnosis/LeadForm.astro via lead-form.ts)
// and /api/v1/leads/ so pre-submit and server validation cannot drift — same as contact/schema.ts.
export const LEAD_PURPOSES = ["briefing", "service", "paid", "question"] as const;
export type LeadPurpose = (typeof LEAD_PURPOSES)[number];

export const LEAD_PURPOSE_LABELS: Record<LeadPurpose, string> = {
  briefing: "15分のオンライン結果解説を希望",
  service: "サービスについて相談したい",
  paid: "有料のIT・DX現状診断について",
  question: "担当者に質問したい",
};

export const leadSchema = z.object({
  responseId: z.string({ error: "不正な入力です。" }).trim().max(32, { error: "不正な入力です。" }).optional(),
  token: z.string({ error: "不正な入力です。" }).trim().max(128, { error: "不正な入力です。" }).optional(),
  purpose: z.enum(LEAD_PURPOSES, { error: "ご希望の内容を選択してください。" }),
  company: z.string({ error: "会社名を入力してください。" }).trim().min(1, { error: "会社名を入力してください。" }).max(200, { error: "会社名が長すぎます。" }),
  name: z.string({ error: "お名前を入力してください。" }).trim().min(1, { error: "お名前を入力してください。" }).max(100, { error: "お名前が長すぎます。" }),
  email: z.email({ error: "メールアドレスを正しく入力してください。" }).max(254, { error: "メールアドレスを正しく入力してください。" }),
  phone: z.string({ error: "電話番号の形式が正しくありません。" }).trim().max(50, { error: "電話番号が長すぎます。" }).optional(),
  message: z.string({ error: "入力内容を確認してください。" }).trim().max(2000, { error: "ご質問は2000文字以内で入力してください。" }).optional(),
  privacyAgree: z.literal(true, { error: "プライバシーポリシーへの同意が必要です。" }),
  turnstileToken: z.string({ error: "認証を完了してください。" }).min(1, { error: "認証を完了してください。" }),
  website: z.string({ error: "不正な入力です。" }).optional(), // honeypot — checked separately before this schema runs
});

export type LeadFormValues = z.infer<typeof leadSchema>;

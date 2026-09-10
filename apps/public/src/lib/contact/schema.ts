import { z } from "zod";

// Shared between the client-side script in src/pages/contact.astro (pre-submit
// field validation) and worker/index.ts (authoritative server-side check) so
// the two never drift out of sync.
export const contactSchema = z.object({
  inquiryType: z.string({ error: "お問い合わせ項目を選択してください。" }).trim().min(1, { error: "お問い合わせ項目を選択してください。" }).max(100, { error: "お問い合わせ項目が長すぎます。" }),
  company: z.string({ error: "会社名の形式が正しくありません。" }).trim().max(200, { error: "会社名が長すぎます。" }).optional(),
  name: z.string({ error: "お名前を入力してください。" }).trim().min(1, { error: "お名前を入力してください。" }).max(100, { error: "お名前が長すぎます。" }),
  email: z.email({ error: "メールアドレスを正しく入力してください。" }).max(254, { error: "メールアドレスを正しく入力してください。" }),
  phone: z.string({ error: "電話番号の形式が正しくありません。" }).trim().max(50, { error: "電話番号が長すぎます。" }).optional(),
  message: z.string({ error: "お問い合わせ内容を入力してください（5000文字以内）。" }).trim().min(1, { error: "お問い合わせ内容を入力してください（5000文字以内）。" }).max(5000, { error: "お問い合わせ内容を入力してください（5000文字以内）。" }),
  privacyAgree: z.literal(true, { error: "プライバシーポリシーへの同意が必要です。" }),
  turnstileToken: z.string({ error: "認証を完了してください。" }).min(1, { error: "認証を完了してください。" }),
  website: z.string({ error: "不正な入力です。" }).optional(), // honeypot — checked separately before this schema runs
});

export type ContactFormValues = z.infer<typeof contactSchema>;

// Client script for components/diagnosis/LeadForm.astro. On an outbound run (`?t=`) the
// "15 分解説" / "相談する" CTAs open this form instead of leaving for /contact/, so the
// contact details land on the saved response (POST /api/v1/leads/).

import { leadSchema, type LeadPurpose } from "./lead-schema";
import { briefingBookingHref } from "./routes";
import { trackDiagnosisEvent } from "./analytics";

export interface LeadFormContext {
  slug: string;
  version: number;
  resultId: string;
  token: string;
  responseId: string | null;
}

const CTA_PURPOSE: Record<string, LeadPurpose> = { briefing_15min: "briefing", service_contact: "service", contact: "question", paid_diagnosis: "paid" };

const FIELD_IDS: Record<string, string> = { purpose: "lead-purpose", company: "lead-company", name: "lead-name", email: "lead-email", phone: "lead-phone", message: "lead-message", privacyAgree: "lead-privacy-agree", turnstileToken: "lead-turnstile" };

let turnstileLoaded = false;
function loadTurnstile() {
  if (turnstileLoaded) return;
  turnstileLoaded = true;
  const script = document.createElement("script");
  script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
  script.async = true;
  script.defer = true;
  document.head.appendChild(script);
}

export function initLeadForm(ctx: LeadFormContext): void {
  const section = document.getElementById("diagnosis-lead-form");
  const form = document.getElementById("lead-form") as HTMLFormElement | null;
  if (!section || !form) return;

  // `as unknown as`: @cloudflare/workers-types declares its own global Element (HTMLRewriter),
  // which shadows the DOM one in .ts files and breaks the direct cast.
  const purposeField = document.getElementById(FIELD_IDS.purpose) as unknown as HTMLSelectElement;
  const submitButton = document.getElementById("lead-submit") as unknown as HTMLButtonElement;
  const successNote = document.getElementById("lead-form-success")!;
  const errorNote = document.getElementById("lead-form-error")!;

  section.classList.remove("hidden");
  loadTurnstile();

  const open = (purpose: LeadPurpose) => {
    purposeField.value = purpose;
    section.scrollIntoView({ behavior: "smooth", block: "start" });
    (document.getElementById(FIELD_IDS.company) as unknown as HTMLInputElement).focus({ preventScroll: true });
  };

  // Everything that would have left for /contact/ or the booking tool now stays on the page.
  for (const link of document.querySelectorAll<HTMLAnchorElement>("[data-cta-kind]")) {
    const purpose = CTA_PURPOSE[link.dataset.ctaKind ?? ""];
    if (!purpose) continue;
    link.addEventListener("click", (event) => {
      event.preventDefault();
      open(purpose);
    });
  }

  const clearErrors = () => {
    for (const el of form.querySelectorAll<HTMLElement>("[data-error-for]")) {
      el.textContent = "";
      el.classList.add("hidden");
    }
    errorNote.classList.add("hidden");
  };

  const showFieldError = (field: string, message: string) => {
    const el = form.querySelector<HTMLElement>(`[data-error-for="${FIELD_IDS[field] ?? field}"]`);
    if (!el) return;
    el.textContent = message;
    el.classList.remove("hidden");
  };

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearErrors();

    const data = new FormData(form);
    const candidate = {
      responseId: ctx.responseId ?? undefined,
      token: ctx.token,
      purpose: data.get("purpose"),
      company: data.get("company"),
      name: data.get("name"),
      email: data.get("email"),
      phone: data.get("phone") || undefined,
      message: data.get("message") || undefined,
      privacyAgree: data.get("privacy-agree") === "on",
      turnstileToken: data.get("cf-turnstile-response"),
      website: data.get("website") || undefined,
    };

    const parsed = leadSchema.safeParse(candidate);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) showFieldError(String(issue.path[0] ?? ""), issue.message);
      return;
    }

    submitButton.disabled = true;
    try {
      const res = await fetch("/api/v1/leads/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(parsed.data) });
      const json = (await res.json().catch(() => ({}))) as { message?: string; errors?: Record<string, string[] | undefined> };
      if (!res.ok) {
        for (const [field, messages] of Object.entries(json.errors ?? {})) if (messages?.[0]) showFieldError(field, messages[0]);
        errorNote.textContent = json.message ?? "送信に失敗しました。時間をおいて再度お試しください。";
        errorNote.classList.remove("hidden");
        (window as unknown as { turnstile?: { reset: () => void } }).turnstile?.reset();
        return;
      }

      trackDiagnosisEvent("diagnosis_cta_click", { diagnosis: ctx.slug, version: ctx.version, result_id: ctx.resultId, cta: `lead_${parsed.data.purpose}` });
      form.classList.add("hidden");
      const booking = parsed.data.purpose === "briefing" ? briefingBookingHref(window.location.href) : null;
      successNote.textContent = parsed.data.purpose === "briefing" ? "受け付けました。担当者より日程調整のご連絡をいたします。" : "受け付けました。担当者より折り返しご連絡いたします。";
      if (booking && !booking.startsWith("/")) {
        const link = document.createElement("a");
        link.href = booking;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.className = "mt-2 block font-medium text-natural-teal-dark underline-offset-2 hover:underline";
        link.textContent = "いますぐ日程を選ぶ";
        successNote.appendChild(link);
      }
      successNote.classList.remove("hidden");
    } finally {
      submitButton.disabled = false;
    }
  });
}

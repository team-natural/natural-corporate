import { computeResult, decodeAnswers, findWeakestAxisIndex, findStrengthAxisIndexes, hasBalanceWarning, MAX_AXIS_SCORE } from "./scoring";
import { buildContactMessage } from "./contact-message";
import { diagnosisContactHref, briefingBookingHref, PARAM_VERSION, PARAM_FROM, PARAM_ANSWERS, PARAM_SCORES } from "../../lib/diagnosis/routes";
import { trackDiagnosisEvent } from "../../lib/diagnosis/analytics";

const dataEl = document.getElementById("diagnosis-result-data");
const data = JSON.parse(dataEl.textContent);
const { slug, version, title, otherSlug, levelId, level, levelName, axes, questions, thresholds, weakestAxisSteps, strengthThreshold, maxStrengths, balanceNote, briefingFirstAxisIds, flagFirstSteps, briefingCta } = data;

const params = new URLSearchParams(window.location.search);
const from = params.get(PARAM_FROM);
// A URL without `v` was minted by v1: it carries `s` only, so just the v1 blocks (axis bars,
// weakest axis) are shown.
const isV2 = params.get(PARAM_VERSION) === String(version);
const maxTotal = axes.length * MAX_AXIS_SCORE;

function parseScores(raw) {
  if (!raw) return null;
  const parts = raw.split(".");
  if (parts.length !== axes.length) return null;
  const scores = parts.map(Number);
  if (scores.some((n) => !Number.isInteger(n) || n < 0 || n > MAX_AXIS_SCORE)) return null;
  return scores;
}

const answers = isV2 ? decodeAnswers(questions, params.get(PARAM_ANSWERS)) : null;
const computed = answers ? computeResult({ questions, axes, thresholds, strengthThreshold, maxStrengths, balanceNote }, answers) : null;
const scores = computed ? computed.axisScores : parseScores(params.get(PARAM_SCORES));
const flags = computed ? computed.flags : (params.get("f") ?? "").split(".").filter(Boolean);

let weakestAxis = null;
if (scores) {
  axes.forEach((axis, index) => {
    document.getElementById(`diagnosis-axis-fill-${index}`).style.width = `${(scores[index] / MAX_AXIS_SCORE) * 100}%`;
    document.getElementById(`diagnosis-axis-value-${index}`).textContent = `${scores[index]} / ${MAX_AXIS_SCORE}`;
  });

  const weakestIndex = findWeakestAxisIndex(scores);
  weakestAxis = axes[weakestIndex];
  const step = weakestAxisSteps.find((s) => s.axisId === weakestAxis.id);
  if (step) {
    document.getElementById("diagnosis-weakest-heading").textContent = `まず着手すべきは【${weakestAxis.name}】です`;
    document.getElementById("diagnosis-weakest-body").textContent = step.body;
    document.getElementById("diagnosis-weakest-service").textContent = `関連サービス: ${step.relatedService}`;
  }
  document.getElementById("diagnosis-axis-section").classList.remove("hidden");
}

if (isV2 && scores) {
  const totalScore = scores.reduce((sum, score) => sum + score, 0);
  const reason = document.getElementById("diagnosis-reason");
  reason.textContent = `判定理由: 10問の合計 ${totalScore} / ${maxTotal}点。軸別: ${axes.map((axis, index) => `${axis.name} ${scores[index]}`).join(" / ")}`;
  reason.classList.remove("hidden");

  const weakestIndex = findWeakestAxisIndex(scores);
  if (hasBalanceWarning(level, scores[weakestIndex], balanceNote)) {
    const note = document.getElementById("diagnosis-balance-note");
    note.textContent = `総合ではレベル${level}ですが、【${axes[weakestIndex].name}】は初期段階です。ここが土台の弱点になっています。`;
    note.classList.remove("hidden");
  }

  const strengthIndexes = findStrengthAxisIndexes(scores, strengthThreshold, maxStrengths);
  if (strengthIndexes.length > 0) {
    const list = document.getElementById("diagnosis-strengths-list");
    for (const index of strengthIndexes) {
      document.getElementById(`diagnosis-axis-badge-${index}`).classList.remove("hidden");
      const item = document.createElement("li");
      item.className = "flex gap-2";
      const name = document.createElement("span");
      name.className = "flex-shrink-0 font-bold text-emerald-700";
      name.textContent = axes[index].name;
      const text = document.createElement("span");
      text.textContent = axes[index].strength;
      item.append(name, text);
      list.appendChild(item);
    }
    document.getElementById("diagnosis-strengths").classList.remove("hidden");
  }

  const firstSteps = [axes[weakestIndex].firstStep, ...flags.map((flag) => flagFirstSteps[flag]).filter(Boolean)];
  const stepsList = document.getElementById("diagnosis-first-steps-list");
  firstSteps.forEach((text, index) => {
    const item = document.createElement("li");
    item.className = "flex gap-3";
    const number = document.createElement("span");
    number.className = "flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-natural-cream text-xs font-bold text-natural-teal-dark";
    number.textContent = String(index + 1);
    const body = document.createElement("span");
    body.textContent = text;
    item.append(number, body);
    stepsList.appendChild(item);
  });
  document.getElementById("diagnosis-first-steps").classList.remove("hidden");
}

// People/organisation and rules weaknesses need a conversation before any development
// service, so the briefing takes the primary slot (BIZ-04 §13).
const primaryLink = document.querySelector("#diagnosis-next-steps-heading ~ a[data-cta-kind]");
if (isV2 && weakestAxis && briefingFirstAxisIds.includes(weakestAxis.id) && primaryLink && primaryLink.dataset.ctaKind !== briefingCta.kind) {
  const existingBriefing = document.querySelector(`li > a[data-cta-kind="${briefingCta.kind}"]`);
  const demoted = primaryLink.cloneNode(true);
  demoted.className = existingBriefing ? existingBriefing.className : "flex h-full items-center gap-2 rounded-xl border border-natural-gray px-4 py-3 text-sm text-natural-text transition-colors hover:border-natural-teal hover:bg-natural-cream";
  const item = document.createElement("li");
  item.appendChild(demoted);
  const list = primaryLink.parentElement.querySelector("ul");
  list.prepend(item);
  if (existingBriefing) existingBriefing.closest("li").remove();

  primaryLink.dataset.ctaKind = briefingCta.kind;
  delete primaryLink.dataset.inquiryType;
  primaryLink.querySelector(".material-symbols-outlined").textContent = "calendar_month";
  primaryLink.lastChild.textContent = briefingCta.label;
}

// CTA hrefs were built without scores; rebuild the ones that carry the result over.
const resultUrl = window.location.href;
const contactMessage = buildContactMessage({
  title,
  version,
  levelName,
  totalScore: scores ? scores.reduce((sum, score) => sum + score, 0) : null,
  maxTotal,
  axisScores: scores ? axes.map((axis, index) => ({ name: axis.name, score: scores[index] })) : [],
  resultUrl: scores ? resultUrl : null,
});
for (const link of document.querySelectorAll("[data-cta-kind]")) {
  const kind = link.dataset.ctaKind;
  if (kind === "service_contact" || kind === "contact") link.href = diagnosisContactHref(contactMessage, link.dataset.inquiryType || undefined);
  if (kind === "briefing_15min") link.href = briefingBookingHref(scores ? resultUrl : null);
  // One round trip only: arriving from the other diagnosis, don't send the visitor back.
  if (kind === "cross_diagnosis" && from === otherSlug) (link.closest("li") ?? link.closest("section") ?? link).classList.add("hidden");

  link.addEventListener("click", () => {
    trackDiagnosisEvent("diagnosis_cta_click", { diagnosis: slug, version, result_id: levelId, cta: link.dataset.ctaKind });
    if (link.dataset.ctaKind === "cross_diagnosis") trackDiagnosisEvent("diagnosis_cross_start", { from_diagnosis: slug, to_diagnosis: otherSlug });
  });
}

trackDiagnosisEvent("diagnosis_result_view", { diagnosis: slug, version: isV2 ? version : 1, result_id: levelId, has_scores: Boolean(scores), weakest_axis: weakestAxis?.id ?? null });

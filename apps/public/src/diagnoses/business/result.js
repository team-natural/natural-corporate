import { computeResult, decodeAnswers, judgementReasons, maxPointsByType } from "./scoring";
import { buildContactMessage } from "./contact-message";
import { diagnosisResultPath, diagnosisContactHref, briefingBookingHref, withToken, PARAM_VERSION, PARAM_FROM, PARAM_ANSWERS, PARAM_SCORES, PARAM_TOKEN, PARAM_RESPONSE } from "../../lib/diagnosis/routes";
import { trackDiagnosisEvent } from "../../lib/diagnosis/analytics";
import { initLeadForm } from "../../lib/diagnosis/lead-form";

const dataEl = document.getElementById("diagnosis-result-data");
const data = JSON.parse(dataEl.textContent);
const { slug, version, title, otherSlug, currentTypeId, typeNames, scoreTypeIds, chartLabels, bridgeTextByConcern, questions, concernQuestionId, tieBreakOrder, zeroScoreTypeId, strengthById, complexThreshold } = data;

const params = new URLSearchParams(window.location.search);
const concern = params.get("concern");
const second = params.get("second");
const scoresParam = params.get(PARAM_SCORES);
const from = params.get(PARAM_FROM);
const token = params.get(PARAM_TOKEN);
// A URL without `v` was minted by v1: its `s` values are raw points on the old scale and it
// carries no answers, so only the v1 blocks (bridge, chart in points, secondary) are shown.
const isV2 = params.get(PARAM_VERSION) === String(version);

const bridgeEl = document.getElementById("diagnosis-bridge-text");
if (concern && bridgeTextByConcern[concern]) {
  bridgeEl.textContent = bridgeTextByConcern[concern];
  bridgeEl.classList.remove("hidden");
}

const secondaryEl = document.getElementById("diagnosis-secondary");
if (second && typeNames[second]) {
  document.getElementById("diagnosis-secondary-name").textContent = typeNames[second];
  // Carry every parameter across so the destination still shows the chart, bridge text and
  // reasons; `second` becomes a reciprocal link pointing back at this page's result type.
  const secondaryParams = new URLSearchParams(params);
  secondaryParams.set("second", currentTypeId);
  secondaryEl.href = `${diagnosisResultPath(slug, second)}?${secondaryParams}`;
  secondaryEl.classList.remove("hidden");
}

function parseScores(raw) {
  if (!raw) return null;
  const scores = raw.split(".").map((value) => Number(value));
  return scores.length === scoreTypeIds.length && scores.every((score) => Number.isInteger(score) && score >= 0) ? scores : null;
}

// Values are 0–1 per axis (v1: points ÷ highest score, v2: 課題度). null = not applicable.
function renderChart(values, formatValue) {
  const svg = document.getElementById("diagnosis-radar");
  const cx = Number(svg.dataset.cx);
  const cy = Number(svg.dataset.cy);
  const radius = Number(svg.dataset.r);
  const points = values
    .map((value, index) => {
      const angle = (Math.PI * 2 * index) / values.length;
      // Inverted axis: healthy types reach the outer edge and problem areas dent toward the
      // center. The 20% floor keeps a 100% axis from collapsing into the center point.
      const r = (0.2 + 0.8 * (1 - (value ?? 0))) * radius;
      const x = cx + r * Math.sin(angle);
      const y = cy - r * Math.cos(angle);
      const dot = document.getElementById(`diagnosis-radar-dot-${index}`);
      dot.setAttribute("cx", x.toFixed(1));
      dot.setAttribute("cy", y.toFixed(1));
      dot.classList.remove("hidden");
      if (value === null) {
        dot.setAttribute("fill", "var(--color-natural-muted)");
        document.getElementById(`diagnosis-radar-label-${index}`).setAttribute("fill", "var(--color-natural-muted)");
      }
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  document.getElementById("diagnosis-radar-shape").setAttribute("points", points);

  // Priority ranking (top 3): value descending. The diagnosed type wins ties so the #1 row
  // always matches the headline result (same as scoring's tie-break).
  const ranked = values
    .map((value, index) => ({ value: value ?? -1, index, isCurrent: scoreTypeIds[index] === currentTypeId }))
    .filter((entry) => entry.value >= 0)
    .sort((a, b) => b.value - a.value || Number(b.isCurrent) - Number(a.isCurrent) || a.index - b.index);
  ranked.slice(0, 3).forEach((entry, slot) => {
    document.getElementById(`diagnosis-rank-name-${slot}`).textContent = chartLabels[entry.index];
    document.getElementById(`diagnosis-rank-score-${slot}`).textContent = formatValue(entry.index, entry.value);
    document.getElementById(`diagnosis-rank-fill-${slot}`).style.width = `${entry.value * 100}%`;
  });

  document.getElementById("diagnosis-scores-section").classList.remove("hidden");
}

let hasScores = false;
let topIssues = [];

if (!isV2) {
  const scores = parseScores(scoresParam);
  const maxScore = scores ? Math.max(...scores) : 0;
  if (scores && maxScore > 0) {
    hasScores = true;
    renderChart(
      scores.map((score) => score / maxScore),
      (index) => `${scores[index]}点`,
    );
    document.getElementById("diagnosis-rank-note").textContent = "点数は課題の大きさを表し、高いほど優先度が高くなります。";
  }
} else {
  const answers = decodeAnswers(questions, params.get(PARAM_ANSWERS));
  const result = answers ? computeResult({ questions, concernQuestionId, tieBreakOrder, zeroScoreTypeId }, answers) : null;

  let ratios = null;
  let notApplicableIds = [];
  if (result) {
    ratios = result.ratios;
    notApplicableIds = result.notApplicableIds;
  } else {
    // Shared v2 URL that lost `a`: rebuild the ratios from `s` and `na` alone.
    const scores = parseScores(scoresParam);
    if (scores) {
      const max = maxPointsByType(questions);
      notApplicableIds = (params.get("na") ?? "")
        .split(".")
        .map((id) => id.toUpperCase())
        .filter((id) => scoreTypeIds.includes(id.toLowerCase()));
      ratios = {};
      scoreTypeIds.forEach((id, index) => {
        const typeId = id.toUpperCase();
        if (!notApplicableIds.includes(typeId)) ratios[typeId] = max[typeId] ? scores[index] / max[typeId] : 0;
      });
    }
  }

  if (ratios) {
    hasScores = true;
    const values = scoreTypeIds.map((id) => (notApplicableIds.includes(id.toUpperCase()) ? null : (ratios[id.toUpperCase()] ?? 0)));
    const percent = (value) => Math.round(value * 100);
    renderChart(values, (_, value) => `${percent(value)}%`);
    topIssues = values
      .map((value, index) => ({ label: chartLabels[index], percent: value === null ? -1 : percent(value) }))
      .filter((issue) => issue.percent > 0)
      .sort((a, b) => b.percent - a.percent)
      .slice(0, 3);

    if (notApplicableIds.length > 0) {
      const naNote = document.getElementById("diagnosis-na-note");
      naNote.textContent = `今回の診断では対象外: ${notApplicableIds.map((id) => chartLabels[scoreTypeIds.indexOf(id.toLowerCase())]).join("・")}（ご回答により判定から除いています）`;
      naNote.classList.remove("hidden");
    }

    // "複数課題" rule: primary and secondary both at or above the threshold (PRD-07 §1-7).
    const primaryRatio = ratios[currentTypeId.toUpperCase()] ?? 0;
    const secondaryRatio = second ? (ratios[second.toUpperCase()] ?? 0) : 0;
    if (primaryRatio >= complexThreshold && secondaryRatio >= complexThreshold) {
      document.getElementById("diagnosis-complex-cta")?.classList.remove("hidden");
    }
  }

  // Quote the answers behind this page's type, not the recomputed primary: the path is what
  // was shared, and a hand-edited `a` must not make the page explain a different type.
  const reasons = answers ? judgementReasons(questions, answers, currentTypeId.toUpperCase()) : [];
  if (reasons.length > 0) {
    const list = document.getElementById("diagnosis-reasons-list");
    for (const reason of reasons) {
      const question = questions.find((q) => q.id === reason.questionId);
      const item = document.createElement("li");
      item.className = "flex gap-2";
      const topic = document.createElement("span");
      topic.className = "flex-shrink-0 font-bold text-natural-teal-dark";
      topic.textContent = `${question.topic}:`;
      const label = document.createElement("span");
      label.textContent = question.options[reason.optionIndex].label;
      item.append(topic, label);
      list.appendChild(item);
    }
    document.getElementById("diagnosis-reasons").classList.remove("hidden");
  }

  if (result && result.strengthIds.length > 0) {
    const list = document.getElementById("diagnosis-strengths-list");
    for (const id of result.strengthIds) {
      const item = document.createElement("li");
      item.className = "flex gap-2";
      const name = document.createElement("span");
      name.className = "flex-shrink-0 font-bold text-emerald-700";
      name.textContent = chartLabels[scoreTypeIds.indexOf(id.toLowerCase())];
      const text = document.createElement("span");
      text.textContent = strengthById[id] ?? "";
      item.append(name, text);
      list.appendChild(item);
    }
    document.getElementById("diagnosis-strengths").classList.remove("hidden");
  }
}

// CTA hrefs were built without scores; rebuild the ones that carry the result over.
const resultUrl = window.location.href;
const contactMessage = buildContactMessage({ title, version, resultName: typeNames[currentTypeId], secondaryName: second ? typeNames[second] : null, topIssues, resultUrl: hasScores ? resultUrl : null });
for (const link of document.querySelectorAll("[data-cta-kind]")) {
  const kind = link.dataset.ctaKind;
  if (kind === "service_contact" || kind === "contact") link.href = diagnosisContactHref(contactMessage, link.dataset.inquiryType || undefined);
  if (kind === "briefing_15min") link.href = briefingBookingHref(hasScores ? resultUrl : null);
  // One round trip only: arriving from the other diagnosis, don't send the visitor back.
  if (kind === "cross_diagnosis" && from === otherSlug) (link.closest("li") ?? link.closest("section") ?? link).classList.add("hidden");
  if (kind === "cross_diagnosis") link.href = withToken(link.getAttribute("href"), token);

  link.addEventListener("click", () => {
    trackDiagnosisEvent("diagnosis_cta_click", { diagnosis: slug, version, result_id: currentTypeId, cta: kind });
    if (kind === "cross_diagnosis") trackDiagnosisEvent("diagnosis_cross_start", { from_diagnosis: slug, to_diagnosis: otherSlug });
  });
}

// Outbound run: contact details are collected here, against the saved response.
if (token) initLeadForm({ slug, version, resultId: currentTypeId, token, responseId: params.get(PARAM_RESPONSE) });

trackDiagnosisEvent("diagnosis_result_view", { diagnosis: slug, version: isV2 ? version : 1, result_id: currentTypeId, has_scores: hasScores });

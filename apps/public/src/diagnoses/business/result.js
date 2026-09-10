import { diagnosisResultPath } from "../../lib/diagnosis/routes";

const dataEl = document.getElementById("diagnosis-result-data");
const { slug, currentTypeId, bridgeTextByConcern, secondaryNames, scoreTypeCount, scoreTypeIds, chartLabels } = JSON.parse(dataEl.textContent);

const params = new URLSearchParams(window.location.search);
const concern = params.get("concern");
const second = params.get("second");
const scoresParam = params.get("s");

const bridgeEl = document.getElementById("diagnosis-bridge-text");
if (concern && bridgeTextByConcern[concern]) {
  bridgeEl.textContent = bridgeTextByConcern[concern];
  bridgeEl.classList.remove("hidden");
}

const secondaryEl = document.getElementById("diagnosis-secondary");
const secondaryNameEl = document.getElementById("diagnosis-secondary-name");
if (second && secondaryNames[second]) {
  secondaryNameEl.textContent = secondaryNames[second];

  // Carry forward the score and concern answers so the destination page still shows the
  // radar chart, bridge text, and "issues worth considering together"; `second` becomes a
  // reciprocal link pointing back at this page's result type.
  const secondaryParams = new URLSearchParams();
  secondaryParams.set("second", currentTypeId);
  if (concern) secondaryParams.set("concern", concern);
  if (scoresParam) secondaryParams.set("s", scoresParam);
  secondaryEl.href = `${diagnosisResultPath(slug, second)}?${secondaryParams.toString()}`;
  secondaryEl.classList.remove("hidden");
}

// Per-type tendency radar chart: only shown when the `s` param exists (scores in type
// order joined with "."). Keeps the section hidden for invalid values or when every type
// scored 0 (e.g. a Z-type direct match).
// Chart geometry (center/radius) is held by ResultPage.astro via the <svg>'s data attributes.
if (scoresParam) {
  const scores = scoresParam.split(".").map((value) => Number(value));
  const valid = scores.length === scoreTypeCount && scores.every((score) => Number.isInteger(score) && score >= 0);
  const maxScore = valid ? Math.max(...scores) : 0;
  if (valid && maxScore > 0) {
    const svg = document.getElementById("diagnosis-radar");
    const cx = Number(svg.dataset.cx);
    const cy = Number(svg.dataset.cy);
    const radius = Number(svg.dataset.r);
    const points = scores
      .map((score, index) => {
        const angle = (Math.PI * 2 * index) / scores.length;
        // Inverted axis: low-score (healthy) types reach the outer edge and problem
        // areas dent toward the center, matching how radar charts are intuitively
        // read (big area = good, dents = weaknesses). The 20% floor keeps max-score
        // axes from collapsing into a single point at the center when they tie.
        const r = (0.2 + 0.8 * ((maxScore - score) / maxScore)) * radius;
        const x = cx + r * Math.sin(angle);
        const y = cy - r * Math.cos(angle);
        const dot = document.getElementById(`diagnosis-radar-dot-${index}`);
        if (dot) {
          dot.setAttribute("cx", x.toFixed(1));
          dot.setAttribute("cy", y.toFixed(1));
          dot.classList.remove("hidden");
        }
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
    document.getElementById("diagnosis-radar-shape").setAttribute("points", points);

    // Priority ranking (top 3): score descending. The diagnosed type wins ties so
    // the #1 row always matches the headline result (same as scoring's tie-break).
    const ranked = scores.map((score, index) => ({ score, index, isCurrent: scoreTypeIds[index] === currentTypeId })).sort((a, b) => b.score - a.score || Number(b.isCurrent) - Number(a.isCurrent) || a.index - b.index);
    ranked.slice(0, 3).forEach((entry, slot) => {
      document.getElementById(`diagnosis-rank-name-${slot}`).textContent = chartLabels[entry.index];
      document.getElementById(`diagnosis-rank-score-${slot}`).textContent = `${entry.score}点`;
      document.getElementById(`diagnosis-rank-fill-${slot}`).style.width = `${(entry.score / maxScore) * 100}%`;
    });

    document.getElementById("diagnosis-scores-section").classList.remove("hidden");
  }
}

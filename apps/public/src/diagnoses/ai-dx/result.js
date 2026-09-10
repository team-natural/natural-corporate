import { findWeakestAxisIndex } from "./scoring";

const dataEl = document.getElementById("diagnosis-result-data");
const { axes, weakestAxisSteps } = JSON.parse(dataEl.textContent);

function parseScores(raw) {
  if (!raw) return null;
  const parts = raw.split(".");
  if (parts.length !== axes.length) return null;
  const scores = parts.map(Number);
  if (scores.some((n) => !Number.isInteger(n) || n < 0 || n > 6)) return null;
  return scores;
}

const params = new URLSearchParams(window.location.search);
const scores = parseScores(params.get("s"));

if (scores) {
  axes.forEach((axis, index) => {
    const fill = document.getElementById(`diagnosis-axis-fill-${index}`);
    const value = document.getElementById(`diagnosis-axis-value-${index}`);
    if (fill) fill.style.width = `${(scores[index] / 6) * 100}%`;
    if (value) value.textContent = `${scores[index]} / 6`;
  });

  const weakestIndex = findWeakestAxisIndex(scores);
  const weakestAxis = axes[weakestIndex];
  const step = weakestAxisSteps.find((s) => s.axisId === weakestAxis.id);

  if (step) {
    document.getElementById("diagnosis-weakest-heading").textContent = `まず着手すべきは【${weakestAxis.name}】です`;
    document.getElementById("diagnosis-weakest-body").textContent = step.body;
    document.getElementById("diagnosis-weakest-service").textContent = `関連サービス: ${step.relatedService}`;
  }

  document.getElementById("diagnosis-axis-section").classList.remove("hidden");
}

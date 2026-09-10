import { computeResult } from "./scoring";
import { diagnosisResultPath } from "../../lib/diagnosis/routes";

const dataEl = document.getElementById("diagnosis-questions-data");
const questionsData = JSON.parse(dataEl.textContent);
const { slug, concernQuestionId, tieBreakOrder, zeroScoreTypeId, scoreTypeOrder, questions } = questionsData;

const root = document.getElementById("diagnosis-question-root");
const progressFill = document.getElementById("diagnosis-progress-fill");
const stepLabel = document.getElementById("diagnosis-step-label");
const backButton = document.getElementById("diagnosis-back");

const answers = {};
let step = 0;

function render() {
  const question = questions[step];
  stepLabel.textContent = `${step + 1} / ${questions.length}`;
  progressFill.style.width = `${((step + 1) / questions.length) * 100}%`;
  backButton.classList.toggle("hidden", step === 0);

  root.classList.remove("diagnosis-question-step");
  root.innerHTML = "";
  // Restart the CSS animation on every question change.
  void root.offsetWidth;
  root.classList.add("diagnosis-question-step");

  const heading = document.createElement("h2");
  heading.className = "mb-6 text-lg leading-relaxed font-bold text-natural-text lg:text-xl";
  heading.textContent = question.prompt;
  root.appendChild(heading);

  const list = document.createElement("div");
  list.className = "space-y-3";
  question.options.forEach((option, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "diagnosis-option-card";
    if (answers[question.id] === index) button.classList.add("is-selected");
    button.textContent = option.label;
    button.addEventListener("click", () => selectOption(question.id, index));
    list.appendChild(button);
  });
  root.appendChild(list);
}

function selectOption(questionId, optionIndex) {
  answers[questionId] = optionIndex;

  if (step < questions.length - 1) {
    history.pushState({ step: step + 1 }, "", "");
    step += 1;
    render();
  } else {
    finish();
  }
}

function finish() {
  const result = computeResult({ questions, concernQuestionId, tieBreakOrder, zeroScoreTypeId }, answers);

  const params = new URLSearchParams();
  if (result.secondaryId) params.set("second", result.secondaryId.toLowerCase());
  if (result.concernOptionIndex !== null && result.concernOptionIndex !== undefined) {
    params.set("concern", String(result.concernOptionIndex + 1));
  }
  params.set("s", scoreTypeOrder.map((id) => result.totals[id] ?? 0).join("."));
  const query = params.toString();
  window.location.href = `${diagnosisResultPath(slug, result.primaryId)}${query ? `?${query}` : ""}`;
}

backButton.addEventListener("click", () => {
  if (step > 0) history.back();
});

window.addEventListener("popstate", () => {
  if (step > 0) {
    step -= 1;
    render();
  }
});

render();

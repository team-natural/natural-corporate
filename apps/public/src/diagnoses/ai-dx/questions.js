import { computeResult, encodeAnswers } from "./scoring";
import { diagnosisResultPath, PARAM_VERSION, PARAM_FROM, PARAM_ANSWERS, PARAM_SCORES } from "../../lib/diagnosis/routes";
import { trackDiagnosisEvent } from "../../lib/diagnosis/analytics";

const dataEl = document.getElementById("diagnosis-questions-data");
const questionsData = JSON.parse(dataEl.textContent);
const { slug, version, questions, axes, thresholds, strengthThreshold, maxStrengths, balanceNote } = questionsData;

const root = document.getElementById("diagnosis-question-root");
const progressFill = document.getElementById("diagnosis-progress-fill");
const stepLabel = document.getElementById("diagnosis-step-label");
const backButton = document.getElementById("diagnosis-back");

const from = new URLSearchParams(window.location.search).get(PARAM_FROM);
const answers = {};
let step = 0;

function render({ moveFocus }) {
  const question = questions[step];
  stepLabel.textContent = `${step + 1} / ${questions.length}`;
  progressFill.style.width = `${((step + 1) / questions.length) * 100}%`;
  progressFill.setAttribute("aria-valuenow", String(step + 1));
  backButton.classList.toggle("hidden", step === 0);

  root.classList.remove("diagnosis-question-step");
  root.innerHTML = "";
  // Restart the CSS animation on every question change.
  void root.offsetWidth;
  root.classList.add("diagnosis-question-step");

  const heading = document.createElement("h2");
  heading.id = "diagnosis-question-heading";
  heading.className = "mb-6 text-lg leading-relaxed font-bold text-natural-text lg:text-xl";
  heading.tabIndex = -1;
  heading.textContent = question.prompt;
  root.appendChild(heading);

  const list = document.createElement("div");
  list.className = "space-y-3";
  list.setAttribute("role", "radiogroup");
  list.setAttribute("aria-labelledby", heading.id);
  question.options.forEach((option, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "diagnosis-option-card";
    button.setAttribute("role", "radio");
    button.setAttribute("aria-checked", String(answers[question.id] === index));
    if (answers[question.id] === index) button.classList.add("is-selected");
    button.textContent = option.label;
    button.addEventListener("click", () => selectOption(question.id, index));
    button.addEventListener("keydown", (event) => moveRadioFocus(event, list));
    list.appendChild(button);
  });
  root.appendChild(list);

  // Screen readers stay on the old option otherwise; a fresh question must announce itself.
  if (moveFocus) heading.focus({ preventScroll: true });
}

function moveRadioFocus(event, list) {
  const keys = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 };
  const delta = keys[event.key];
  if (!delta) return;
  event.preventDefault();
  const radios = Array.from(list.querySelectorAll('[role="radio"]'));
  const next = (radios.indexOf(event.currentTarget) + delta + radios.length) % radios.length;
  radios[next].focus();
}

function selectOption(questionId, optionIndex) {
  answers[questionId] = optionIndex;
  trackDiagnosisEvent("diagnosis_answer", { diagnosis: slug, version, question_id: questionId, option_index: optionIndex + 1, step: step + 1 });

  if (step < questions.length - 1) {
    history.pushState({ step: step + 1 }, "", "");
    step += 1;
    render({ moveFocus: true });
  } else {
    finish();
  }
}

function finish() {
  const result = computeResult({ questions, axes, thresholds, strengthThreshold, maxStrengths, balanceNote }, answers);

  const params = new URLSearchParams();
  params.set(PARAM_VERSION, String(version));
  params.set(PARAM_SCORES, result.axisScores.join("."));
  params.set(PARAM_ANSWERS, encodeAnswers(questions, answers));
  if (result.flags.length > 0) params.set("f", result.flags.join("."));
  if (from) params.set(PARAM_FROM, from);

  trackDiagnosisEvent("diagnosis_complete", { diagnosis: slug, version, level: result.level, weakest_axis: axes[result.weakestAxisIndex].id });
  window.location.href = `${diagnosisResultPath(slug, `level-${result.level}`)}?${params}`;
}

backButton.addEventListener("click", () => {
  if (step > 0) history.back();
});

window.addEventListener("popstate", () => {
  if (step > 0) {
    step -= 1;
    trackDiagnosisEvent("diagnosis_back", { diagnosis: slug, step: step + 1 });
    render({ moveFocus: true });
  }
});

trackDiagnosisEvent("diagnosis_start", { diagnosis: slug, version, from_diagnosis: from ?? undefined });
render({ moveFocus: false });

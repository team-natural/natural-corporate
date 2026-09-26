// Client script shared by every intro page: fires `diagnosis_view` and carries the
// cross-guidance `from` parameter into the questions URL (PRD-08 §1-1). Intro pages are
// prerendered, so the query string is only visible here, not in frontmatter.

import { trackDiagnosisEvent } from "./analytics";
import { PARAM_FROM } from "./routes";

const startLink = document.querySelector<HTMLAnchorElement>("[data-diagnosis-start]");

if (startLink) {
  const slug = startLink.dataset.diagnosis ?? "";
  const version = Number(startLink.dataset.version ?? "1");
  const from = new URLSearchParams(window.location.search).get(PARAM_FROM);

  if (from) {
    const url = new URL(startLink.href, window.location.href);
    url.searchParams.set(PARAM_FROM, from);
    startLink.href = url.pathname + url.search;
  }

  trackDiagnosisEvent("diagnosis_view", { diagnosis: slug, version, from_diagnosis: from ?? undefined });
}

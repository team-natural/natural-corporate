// Client half of POST /api/v1/diagnosis-responses/ (DEV-11 §4-1 A). Only an outbound run
// (`?t=`) calls it; the public mode never sends answers anywhere.

export interface SaveResponseRequest {
  token: string;
  diagnosis: string;
  definitionVersion: number;
  answers: Record<string, number>;
  clientResult: { resultId: string; secondaryResultId: string | null };
}

// Returns the response's public id, or null on any failure — the visitor still gets their
// result; only the sales-side record is lost, and that is logged server-side.
export async function saveDiagnosisResponse(body: SaveResponseRequest): Promise<string | null> {
  try {
    const res = await fetch("/api/v1/diagnosis-responses/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { data?: { id?: string } };
    return json.data?.id ?? null;
  } catch {
    return null;
  }
}

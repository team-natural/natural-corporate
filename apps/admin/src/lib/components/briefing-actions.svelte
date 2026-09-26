<script lang="ts">
  import { Button } from "$lib/components/ui/button/index.js";
  import { FieldError } from "$lib/components/ui/field/index.js";
  import { Input } from "$lib/components/ui/input/index.js";
  import { callApi, reload } from "./api-client";

  // Compact row controls for the briefing list. `allowed` is the service's transition table.
  let { briefingId, allowed, outcomeLabels }: { briefingId: string; allowed: string[]; outcomeLabels: Record<string, string> } = $props();

  let scheduledAt = $state("");
  let externalRef = $state("");
  let outcome = $state("service");
  let submitting = $state(false);
  let error = $state("");

  // datetime-local has no zone; the operator types JST, so the ISO string gets +09:00.
  const toIso = (local: string) => (local ? `${local}:00+09:00` : "");

  async function post(action: string, body?: unknown, confirmText?: string) {
    if (submitting) return;
    if (confirmText && !window.confirm(confirmText)) return;
    submitting = true;
    error = "";
    const result = await callApi(`/api/v1/briefing-requests/${briefingId}/${action}`, { method: "POST", body });
    if (result.ok) {
      reload();
      return;
    }
    error = Object.values(result.error.errors).flat().filter(Boolean)[0] ?? result.error.message;
    submitting = false;
  }
</script>

<div class="flex flex-col gap-2">
  {#if error}
    <FieldError>{error}</FieldError>
  {/if}
  {#if allowed.includes("scheduled")}
    <form
      class="flex flex-wrap items-center gap-2"
      onsubmit={(event) => {
        event.preventDefault();
        post("schedule", { scheduledAt: toIso(scheduledAt), externalRef: externalRef || undefined });
      }}
    >
      <Input type="datetime-local" bind:value={scheduledAt} required class="w-52" aria-label="予約日時" />
      <Input bind:value={externalRef} placeholder="予約ツールの ID（任意）" class="w-44" aria-label="予約ツールの ID" />
      <Button type="submit" size="sm" disabled={submitting}>予約を登録</Button>
    </form>
  {/if}
  <div class="flex flex-wrap items-center gap-2">
    {#if allowed.includes("held")}
      <select bind:value={outcome} class="h-8 rounded-md border border-input bg-background px-2 text-sm" aria-label="実施後の分岐">
        {#each Object.entries(outcomeLabels) as [value, label] (value)}
          <option {value}>{label}</option>
        {/each}
      </select>
      <Button type="button" size="sm" disabled={submitting} onclick={() => post("hold", { outcome })}>実施済みにする</Button>
    {/if}
    {#if allowed.includes("requested")}
      <Button type="button" size="sm" variant="outline" disabled={submitting} onclick={() => post("unschedule")}>日程を取り消す</Button>
    {/if}
    {#if allowed.includes("no_show")}
      <Button type="button" size="sm" variant="outline" disabled={submitting} onclick={() => post("no-show")}>不参加</Button>
    {/if}
    {#if allowed.includes("cancelled")}
      <Button type="button" size="sm" variant="outline" class="text-destructive" disabled={submitting} onclick={() => post("cancel", undefined, "この申込を取り消します。よろしいですか？")}>取消</Button>
    {/if}
  </div>
</div>

<script lang="ts">
  import { Button } from "$lib/components/ui/button/index.js";
  import { FieldGroup, Field, FieldLabel, FieldError, FieldDescription } from "$lib/components/ui/field/index.js";
  import { Input } from "$lib/components/ui/input/index.js";
  import { Textarea } from "$lib/components/ui/textarea/index.js";
  import { callApi, reload } from "./api-client";

  interface IssuedToken {
    token: string;
    entryPath: string;
    recipientRef: string | null;
    expiresAt: string;
  }

  // `siteOrigin` is the public site, not this console: the URLs go into mails and forms.
  let { campaignId, siteOrigin, disabled = false }: { campaignId: string; siteOrigin: string; disabled?: boolean } = $props();

  const id = $props.id();
  const REFS_PLACEHOLDER = "list-2026-10-001\nlist-2026-10-002";
  let count = $state(10);
  let recipientRefs = $state("");
  let submitting = $state(false);
  let error = $state("");
  let issued = $state<IssuedToken[]>([]);

  const refs = () =>
    recipientRefs
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

  async function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    if (submitting) return;
    const lines = refs();
    const body = lines.length > 0 ? { count: lines.length, recipientRefs: lines } : { count };
    submitting = true;
    error = "";
    const result = await callApi<IssuedToken[]>(`/api/v1/campaigns/${campaignId}/tokens`, { method: "POST", body });
    submitting = false;
    if (!result.ok) {
      error = Object.values(result.error.errors).flat().filter(Boolean)[0] ?? result.error.message;
      return;
    }
    issued = result.data;
  }

  // CSV built here from the response (DEV-04 §5-9): one row per token, no personal data.
  function downloadCsv() {
    const escape = (value: string) => `"${value.replaceAll('"', '""')}"`;
    const rows = [["recipient_ref", "url", "expires_at"], ...issued.map((item) => [item.recipientRef ?? "", `${siteOrigin}${item.entryPath}`, item.expiresAt])];
    const blob = new Blob(["﻿" + rows.map((row) => row.map(escape).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `tokens-${campaignId}-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }
</script>

<div class="flex flex-col gap-4">
  <form onsubmit={handleSubmit} class="max-w-xl">
    <FieldGroup>
      {#if error}
        <FieldError>{error}</FieldError>
      {/if}
      <Field>
        <FieldLabel for="refs-{id}">宛先参照（1 行 1 件、任意）</FieldLabel>
        <Textarea id="refs-{id}" bind:value={recipientRefs} rows={4} placeholder={REFS_PLACEHOLDER} {disabled} />
        <FieldDescription>送付リスト上の行 ID など、社外に意味を持たない文字列だけを入れます。会社名・メールアドレスは書かないでください。入力した行数ぶん発行されます。</FieldDescription>
      </Field>
      <Field>
        <FieldLabel for="count-{id}">発行数（宛先参照が空のとき）</FieldLabel>
        <Input id="count-{id}" type="number" min="1" max="500" bind:value={count} {disabled} class="w-32" />
      </Field>
      <Field>
        <Button type="submit" disabled={disabled || submitting}>{submitting ? "発行中…" : "トークンを発行する"}</Button>
        {#if disabled}
          <FieldDescription>終了したキャンペーンでは発行できません。再開してから発行してください。</FieldDescription>
        {/if}
      </Field>
    </FieldGroup>
  </form>

  {#if issued.length > 0}
    <div class="rounded-md border bg-background p-4">
      <div class="mb-3 flex items-center justify-between gap-4">
        <p class="text-sm font-medium">{issued.length} 件を発行しました。下のトークン一覧は再読み込み後に反映されます。</p>
        <div class="flex gap-2">
          <Button type="button" variant="outline" size="sm" onclick={downloadCsv}>CSV をダウンロード</Button>
          <Button type="button" variant="outline" size="sm" onclick={reload}>一覧を更新</Button>
        </div>
      </div>
      <ul class="max-h-64 space-y-1 overflow-auto font-mono text-xs">
        {#each issued as item (item.token)}
          <li class="flex gap-3">
            <span class="w-40 shrink-0 truncate text-muted-foreground">{item.recipientRef ?? "—"}</span>
            <span class="select-all">{siteOrigin}{item.entryPath}</span>
          </li>
        {/each}
      </ul>
    </div>
  {/if}
</div>

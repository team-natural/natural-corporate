<script lang="ts">
  import { Button } from "$lib/components/ui/button/index.js";
  import { FieldGroup, Field, FieldLabel, FieldError, FieldDescription } from "$lib/components/ui/field/index.js";
  import { Input } from "$lib/components/ui/input/index.js";
  import { Textarea } from "$lib/components/ui/textarea/index.js";
  import { callApi } from "./api-client";

  interface Campaign {
    id: string;
    name: string;
    channel: string;
    diagnosisSlug: string;
    introCopy: string | null;
    sentAt: string | null;
    notes: string | null;
  }

  // Without `campaign` this creates; with it, it edits (drafts only — the API refuses otherwise).
  let { campaign = null }: { campaign?: Campaign | null } = $props();

  const id = $props.id();
  let name = $state(campaign?.name ?? "");
  let channel = $state(campaign?.channel ?? "form");
  let diagnosisSlug = $state(campaign?.diagnosisSlug ?? "business");
  let introCopy = $state(campaign?.introCopy ?? "");
  let sentAt = $state(campaign?.sentAt ?? "");
  let notes = $state(campaign?.notes ?? "");
  let submitting = $state(false);
  let fieldErrors = $state<Record<string, string[] | undefined>>({});
  let formError = $state("");

  const toFieldError = (messages: string[] | undefined) => messages?.map((message) => ({ message }));

  async function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    if (submitting) return;
    submitting = true;
    fieldErrors = {};
    formError = "";

    const body = { name, channel, diagnosisSlug, introCopy: introCopy || null, sentAt: sentAt || null, notes: notes || null };
    const result = campaign ? await callApi<Campaign>(`/api/v1/campaigns/${campaign.id}`, { method: "PATCH", body }) : await callApi<Campaign>("/api/v1/campaigns", { method: "POST", body });

    if (result.ok) {
      window.location.assign(`/campaigns/${result.data.id}/`);
      return;
    }
    fieldErrors = result.error.errors;
    formError = result.error.status === 422 ? "" : result.error.message;
    submitting = false;
  }
</script>

<form onsubmit={handleSubmit} class="max-w-xl">
  <FieldGroup>
    {#if formError}
      <FieldError>{formError}</FieldError>
    {/if}
    <Field>
      <FieldLabel for="name-{id}">キャンペーン名</FieldLabel>
      <Input id="name-{id}" bind:value={name} required placeholder="2026-10 製造業フォーム営業 A" aria-invalid={fieldErrors.name ? "true" : undefined} />
      <FieldError errors={toFieldError(fieldErrors.name)} />
    </Field>
    <div class="grid gap-4 sm:grid-cols-2">
      <Field>
        <FieldLabel for="channel-{id}">営業方法</FieldLabel>
        <select id="channel-{id}" bind:value={channel} class="h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs">
          <option value="form">フォーム営業</option>
          <option value="email">メール営業</option>
          <option value="other">その他</option>
        </select>
        <FieldError errors={toFieldError(fieldErrors.channel)} />
      </Field>
      <Field>
        <FieldLabel for="diagnosis-{id}">対象診断</FieldLabel>
        <select id="diagnosis-{id}" bind:value={diagnosisSlug} class="h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs">
          <option value="business">業務課題かんたん診断</option>
          <option value="ai-dx">AI・DX浸透診断</option>
        </select>
        <FieldError errors={toFieldError(fieldErrors.diagnosisSlug)} />
      </Field>
    </div>
    <Field>
      <FieldLabel for="intro-{id}">入口文言（任意）</FieldLabel>
      <Textarea id="intro-{id}" bind:value={introCopy} rows={3} placeholder="製造業の皆さまへ — 人手不足と手作業の課題を2分で整理" />
      <FieldDescription>空欄なら診断の既定文言を表示します。</FieldDescription>
      <FieldError errors={toFieldError(fieldErrors.introCopy)} />
    </Field>
    <Field>
      <FieldLabel for="sent-{id}">送付日（任意）</FieldLabel>
      <Input id="sent-{id}" type="date" bind:value={sentAt} />
      <FieldError errors={toFieldError(fieldErrors.sentAt)} />
    </Field>
    <Field>
      <FieldLabel for="notes-{id}">メモ（任意）</FieldLabel>
      <Textarea id="notes-{id}" bind:value={notes} rows={3} placeholder="送付方法・対象リストの所在など。送付先の個人情報は書かない" />
      <FieldError errors={toFieldError(fieldErrors.notes)} />
    </Field>
    <Field>
      <Button type="submit" disabled={submitting}>{submitting ? "保存中…" : campaign ? "保存する" : "作成する"}</Button>
    </Field>
  </FieldGroup>
</form>

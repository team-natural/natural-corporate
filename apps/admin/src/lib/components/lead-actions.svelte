<script lang="ts">
  import { Button } from "$lib/components/ui/button/index.js";
  import { FieldGroup, Field, FieldLabel, FieldError } from "$lib/components/ui/field/index.js";
  import { Input } from "$lib/components/ui/input/index.js";
  import { Textarea } from "$lib/components/ui/textarea/index.js";
  import { callApi, reload } from "./api-client";

  interface Owner {
    id: string;
    name: string;
  }

  // `allowed` comes from the page (the service's transition table); the island never guesses.
  let { leadId, ownerId, phone, notes, owners, allowed, labels }: { leadId: string; ownerId: string | null; phone: string | null; notes: string | null; owners: Owner[]; allowed: string[]; labels: Record<string, string> } = $props();

  const ACTIONS: Record<string, string> = { contacted: "contact", qualified: "qualify", nurturing: "nurture", converted: "convert", lost: "lose" };
  const id = $props.id();

  let selectedOwner = $state(ownerId ?? "");
  let phoneValue = $state(phone ?? "");
  let notesValue = $state(notes ?? "");
  let submitting = $state(false);
  let error = $state("");
  let fieldErrors = $state<Record<string, string[] | undefined>>({});
  const toFieldError = (messages: string[] | undefined) => messages?.map((message) => ({ message }));

  async function move(to: string) {
    if (submitting) return;
    if ((to === "converted" || to === "lost") && !window.confirm(`状態を「${labels[to]}」にします。よろしいですか？`)) return;
    submitting = true;
    error = "";
    const result = await callApi(`/api/v1/leads/${leadId}/${ACTIONS[to]}`, { method: "POST" });
    if (result.ok) {
      reload();
      return;
    }
    error = result.error.message;
    submitting = false;
  }

  async function save(event: SubmitEvent) {
    event.preventDefault();
    if (submitting) return;
    submitting = true;
    error = "";
    fieldErrors = {};
    const result = await callApi(`/api/v1/leads/${leadId}`, { method: "PATCH", body: { ownerId: selectedOwner || null, phone: phoneValue || null, notes: notesValue || null } });
    if (result.ok) {
      reload();
      return;
    }
    fieldErrors = result.error.errors;
    error = result.error.status === 422 ? "" : result.error.message;
    submitting = false;
  }
</script>

<div class="flex flex-col gap-6">
  <div class="flex flex-wrap items-center gap-2">
    {#if error}
      <FieldError>{error}</FieldError>
    {/if}
    {#each allowed as to (to)}
      <Button type="button" variant={to === "lost" ? "outline" : "default"} class={to === "lost" ? "text-destructive" : ""} disabled={submitting} onclick={() => move(to)}>{labels[to]}にする</Button>
    {/each}
    {#if allowed.length === 0}
      <p class="text-sm text-muted-foreground">この状態から先の遷移はありません。</p>
    {/if}
  </div>

  <form onsubmit={save} class="max-w-xl">
    <FieldGroup>
      <Field>
        <FieldLabel for="owner-{id}">担当者</FieldLabel>
        <select id="owner-{id}" bind:value={selectedOwner} class="h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs">
          <option value="">未割当</option>
          {#each owners as owner (owner.id)}
            <option value={owner.id}>{owner.name}</option>
          {/each}
        </select>
        <FieldError errors={toFieldError(fieldErrors.ownerId)} />
      </Field>
      <Field>
        <FieldLabel for="phone-{id}">電話番号</FieldLabel>
        <Input id="phone-{id}" bind:value={phoneValue} />
        <FieldError errors={toFieldError(fieldErrors.phone)} />
      </Field>
      <Field>
        <FieldLabel for="notes-{id}">営業メモ</FieldLabel>
        <Textarea id="notes-{id}" bind:value={notesValue} rows={4} />
        <FieldError errors={toFieldError(fieldErrors.notes)} />
      </Field>
      <Field>
        <Button type="submit" variant="outline" disabled={submitting}>{submitting ? "保存中…" : "担当・メモを保存"}</Button>
      </Field>
    </FieldGroup>
  </form>
</div>

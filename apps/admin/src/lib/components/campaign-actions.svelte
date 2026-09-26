<script lang="ts">
  import { Button } from "$lib/components/ui/button/index.js";
  import { FieldError } from "$lib/components/ui/field/index.js";
  import { callApi, reload } from "./api-client";

  let { campaignId, status }: { campaignId: string; status: string } = $props();

  let submitting = $state(false);
  let error = $state("");

  async function move(action: "activate" | "close") {
    if (submitting) return;
    if (action === "close" && !window.confirm("キャンペーンを終了します。以後このキャンペーンではトークンを発行できません。よろしいですか？")) return;
    submitting = true;
    error = "";
    const result = await callApi(`/api/v1/campaigns/${campaignId}/${action}`, { method: "POST" });
    if (result.ok) {
      reload();
      return;
    }
    error = result.error.message;
    submitting = false;
  }
</script>

<div class="flex items-center gap-2">
  {#if error}
    <FieldError>{error}</FieldError>
  {/if}
  {#if status === "draft" || status === "closed"}
    <Button type="button" disabled={submitting} onclick={() => move("activate")}>{status === "closed" ? "再開する" : "実施中にする"}</Button>
  {/if}
  {#if status === "active"}
    <Button type="button" variant="outline" disabled={submitting} onclick={() => move("close")}>終了する</Button>
  {/if}
</div>

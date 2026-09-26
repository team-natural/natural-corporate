<script lang="ts">
  import { Button } from "$lib/components/ui/button/index.js";
  import { callApi, reload } from "./api-client";

  let { campaignId, token }: { campaignId: string; token: string } = $props();
  let submitting = $state(false);
  let error = $state("");

  async function revoke() {
    if (submitting || !window.confirm("このトークンを失効させます。URL は以後 404 になります。よろしいですか？")) return;
    submitting = true;
    error = "";
    const result = await callApi(`/api/v1/campaigns/${campaignId}/tokens/${token}/revoke`, { method: "POST" });
    if (result.ok) {
      reload();
      return;
    }
    error = result.error.message;
    submitting = false;
  }
</script>

<span class="inline-flex items-center gap-2">
  {#if error}<span class="text-xs text-destructive">{error}</span>{/if}
  <Button type="button" variant="outline" size="sm" class="text-destructive" disabled={submitting} onclick={revoke}>失効</Button>
</span>

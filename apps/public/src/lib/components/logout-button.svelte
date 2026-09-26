<script lang="ts">
  import { onMount } from "svelte";

  // POST, not a link: logout deletes the member_sessions row, and a GET that mutates state
  // would be triggerable by any <img> pointed at it.
  let submitting = $state(false);
  let error = $state("");
  // The island renders before its JS runs; a click in that window does nothing at all, so the
  // button stays disabled until hydrated (same as login-form.svelte).
  let hydrated = $state(false);
  onMount(() => {
    hydrated = true;
  });

  async function handleLogout() {
    if (submitting) return;
    submitting = true;
    error = "";

    try {
      // Trailing slash required: trailingSlash "always" 404s "/api/v1/auth/logout".
      const response = await fetch("/api/v1/auth/logout/", { method: "POST" });

      // 401 means the session was already gone (expired, or revoked elsewhere) — the member is
      // logged out either way.
      if (response.ok || response.status === 401) {
        window.location.replace("/");
        return;
      }

      error = "ログアウトに失敗しました。再度お試しください。";
      submitting = false;
    } catch {
      error = "サーバーに接続できませんでした。通信環境をご確認ください。";
      submitting = false;
    }
  }
</script>

<div class="flex items-center gap-3">
  {#if error}
    <p role="alert" class="text-sm text-natural-peach-dark">{error}</p>
  {/if}
  <button type="button" class="rounded-full border border-natural-gray px-4 py-2 text-sm text-natural-text transition-colors hover:border-natural-teal hover:text-natural-teal-dark disabled:cursor-not-allowed disabled:opacity-60" disabled={!hydrated || submitting} onclick={handleLogout}>
    {submitting ? "ログアウト中…" : "ログアウト"}
  </button>
</div>

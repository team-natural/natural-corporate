<script lang="ts">
  // Plain markup, not shadcn: shadcn-svelte is admin-only, and a public site's design is
  // rebuilt per project anyway. This is the working skeleton to restyle.
  import { onMount } from "svelte";

  // Trailing slashes are required throughout: trailingSlash "always" 404s the slash-less form,
  // and that applies to API routes as well as pages.
  const LANDING_ROUTE = "/mypage/";

  const id = $props.id();

  let email = $state("");
  let password = $state("");
  let submitting = $state(false);
  // The island renders before its JS runs, and a submit in that window is a native POST that
  // silently loses the input.
  let hydrated = $state(false);
  onMount(() => {
    hydrated = true;
  });
  let fieldErrors = $state<Record<string, string[] | undefined>>({});
  let formError = $state("");

  // The API answers in Japanese; mapping by status keeps this screen in one language. None of
  // these distinguish "no such account" from "wrong password".
  function messageFor(status: number) {
    if (status === 401) return "メールアドレスまたはパスワードが正しくありません。";
    if (status === 429) return "試行回数が多すぎます。しばらくしてから再度お試しください。";
    return "ログインに失敗しました。しばらくしてから再度お試しください。";
  }

  async function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    if (submitting) return;

    submitting = true;
    fieldErrors = {};
    formError = "";

    try {
      const response = await fetch("/api/v1/auth/login/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (response.ok) {
        // replace() so Back doesn't return to an already-authenticated login form.
        window.location.replace(LANDING_ROUTE);
        return;
      }

      const body = (await response.json().catch(() => null)) as { errors?: Record<string, string[] | undefined> } | null;
      if (response.status === 422 && body?.errors) {
        fieldErrors = body.errors;
      } else {
        formError = messageFor(response.status);
      }
    } catch {
      formError = "サーバーに接続できませんでした。通信環境をご確認ください。";
    } finally {
      // Unreached on success (navigating away) — re-enabling first would allow a double submit.
      submitting = false;
    }
  }
</script>

<form class="flex w-full max-w-sm flex-col gap-4" onsubmit={handleSubmit}>
  {#if formError}
    <p role="alert" class="rounded-lg bg-natural-peach-mid/40 px-4 py-3 text-sm text-natural-text">{formError}</p>
  {/if}

  <div class="flex flex-col gap-1">
    <label for="email-{id}" class="text-sm font-medium text-natural-text">メールアドレス</label>
    <input id="email-{id}" class="rounded-lg border border-natural-gray bg-white px-4 py-3 text-sm text-natural-text focus:border-natural-teal focus:outline-none" type="email" autocomplete="username" bind:value={email} required aria-invalid={fieldErrors.email ? "true" : undefined} />
    {#if fieldErrors.email}
      <p role="alert" class="text-sm text-natural-peach-dark">{fieldErrors.email.join(" ")}</p>
    {/if}
  </div>

  <div class="flex flex-col gap-1">
    <label for="password-{id}" class="text-sm font-medium text-natural-text">パスワード</label>
    <input id="password-{id}" class="rounded-lg border border-natural-gray bg-white px-4 py-3 text-sm text-natural-text focus:border-natural-teal focus:outline-none" type="password" autocomplete="current-password" bind:value={password} required aria-invalid={fieldErrors.password ? "true" : undefined} />
    {#if fieldErrors.password}
      <p role="alert" class="text-sm text-natural-peach-dark">{fieldErrors.password.join(" ")}</p>
    {/if}
  </div>

  <button type="submit" class="cursor-pointer rounded-full bg-natural-teal px-8 py-3.5 text-sm font-medium text-white shadow-md transition-all duration-300 hover:bg-natural-teal-dark disabled:cursor-not-allowed disabled:opacity-60" disabled={!hydrated || submitting}>
    {submitting ? "ログイン中…" : "ログイン"}
  </button>
</form>

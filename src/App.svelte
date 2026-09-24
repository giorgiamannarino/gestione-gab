<script lang="ts">
  import { onMount } from 'svelte';
  import { app } from './lib/app/store.svelte';
  import { router } from './lib/app/router.svelte';
  import { openQuickAdd } from './lib/app/quickadd.svelte';
  import { lock } from './lib/security/lock.svelte';
  import { updater } from './lib/app/pwa.svelte';
  import Button from './ui/Button.svelte';
  import InlineMessage from './ui/InlineMessage.svelte';
  import TabBar, { type Tab } from './ui/TabBar.svelte';
  import Toaster from './ui/Toaster.svelte';
  import Home from './screens/Home.svelte';
  import Impostazioni from './screens/Impostazioni.svelte';
  import LockScreen from './screens/LockScreen.svelte';
  import Movimenti from './screens/Movimenti.svelte';
  import Onboarding from './screens/Onboarding.svelte';
  import Piano from './screens/Piano.svelte';
  import QuickAdd from './screens/QuickAdd.svelte';
  import Statistiche from './screens/Statistiche.svelte';

  onMount(async () => {
    await app.init();
    if (app.db) await lock.init();
  });

  const first = $derived(router.segments[0] ?? '');
  const tab = $derived<Tab>((['movimenti', 'piano', 'statistiche'].includes(first) ? first : 'home') as Tab);
  const showTabs = $derived(first !== 'impostazioni');
</script>

{#if !app.ready}
  <div class="splash" aria-busy="true"></div>
{:else if app.error}
  <div class="fatal"><InlineMessage tone="error" title="Qualcosa non va">{app.error}</InlineMessage></div>
{:else if lock.locked}
  <LockScreen />
{:else}
  <div class="shell" class:covered={lock.hidden} aria-hidden={lock.hidden}>
    {#if updater.needRefresh}
      <div class="update">
        <InlineMessage tone="info" title="Nuova versione disponibile">
          I tuoi dati restano dove sono.
          {#snippet action()}<Button variant="secondary" onclick={() => updater.update()}>Aggiorna ora</Button>{/snippet}
        </InlineMessage>
      </div>
    {/if}

    {#if !app.onboarded}
      <Onboarding />
    {:else}
      <main class:with-tabs={showTabs}>
        {#key first}
          {#if first === 'movimenti'}<Movimenti />
          {:else if first === 'piano'}<Piano />
          {:else if first === 'statistiche'}<Statistiche />
          {:else if first === 'impostazioni'}<Impostazioni />
          {:else}<Home />{/if}
        {/key}
      </main>
      {#if showTabs}
        <div class="tabs">
          <TabBar active={tab} onnavigate={(t) => router.go(t === 'home' ? '/' : `/${t}`)} onadd={() => openQuickAdd()} />
        </div>
      {/if}
      <QuickAdd />
    {/if}
  </div>
  {#if lock.hidden}<div class="privacy-cover" aria-hidden="true"></div>{/if}
  <Toaster offset={app.onboarded && showTabs ? '88px' : '24px'} />
{/if}

<style>
  .splash {
    min-height: 100dvh;
    background: var(--bg);
  }
  .fatal {
    padding: calc(var(--sp-8) + env(safe-area-inset-top)) var(--gutter);
  }
  main {
    max-width: 640px;
    margin: 0 auto;
  }
  main.with-tabs {
    padding-bottom: calc(88px + env(safe-area-inset-bottom));
  }
  .tabs {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 20;
  }
  .tabs :global(nav) {
    max-width: 640px;
    margin: 0 auto;
  }
  .update {
    position: sticky;
    top: 0;
    z-index: 30;
    padding: calc(var(--sp-2) + env(safe-area-inset-top)) var(--gutter) var(--sp-2);
    background: var(--bg);
  }
  /* In background o sul selettore delle app: contenuti sfocati. */
  .shell.covered {
    filter: blur(24px);
  }
  .privacy-cover {
    position: fixed;
    inset: 0;
    z-index: 90;
    background: color-mix(in srgb, var(--bg) 70%, transparent);
  }
</style>

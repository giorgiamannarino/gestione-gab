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
  import Riepilogo from './screens/Riepilogo.svelte';
  import Guida from './screens/Guida.svelte';
  import Pocket from './screens/Pocket.svelte';

  onMount(async () => {
    await app.init();
    if (app.db) await lock.init();
  });

  const first = $derived(router.segments[0] ?? '');
  const tab = $derived<Tab>((['movimenti', 'piano', 'statistiche'].includes(first) ? first : 'home') as Tab);
  const showTabs = $derived(!['impostazioni', 'riepilogo', 'guida'].includes(first));
</script>

{#if !app.ready}
  <div class="splash" aria-busy="true"></div>
{:else if app.error}
  <div class="fatal"><InlineMessage tone="error" title="Qualcosa non va">{app.error}</InlineMessage></div>
{:else if lock.locked}
  <LockScreen />
{:else}
  <div class="shell" class:layout={app.onboarded} class:covered={lock.hidden} aria-hidden={lock.hidden}>
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
      <main>
        <div class="content">
        {#key first}
          {#if first === 'movimenti'}<Movimenti />
          {:else if first === 'piano'}<Piano />
          {:else if first === 'statistiche'}<Statistiche />
          {:else if first === 'impostazioni'}<Impostazioni />
          {:else if first === 'riepilogo'}<Riepilogo />
          {:else if first === 'guida'}<Guida />
          {:else if first === 'pocket'}{#key router.segments[1]}<Pocket />{/key}
          {:else}<Home />{/if}
        {/key}
        </div>
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
  /*
   * Layout a schermo fisso: scorre solo <main>, la tab bar è l'ultimo elemento della colonna.
   * Niente position: fixed, che su iPhone si stacca dal fondo (rimbalzo, tastiera, barra di Safari).
   */
  .shell.layout {
    display: flex;
    flex-direction: column;
    height: 100vh;
    height: 100dvh;
    overflow: hidden;
  }
  .layout main {
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
    overscroll-behavior-y: contain;
    -webkit-overflow-scrolling: touch;
  }
  .content {
    max-width: 640px;
    margin: 0 auto;
  }
  .tabs {
    flex: none;
    position: relative;
    z-index: 20;
  }
  .tabs :global(nav) {
    max-width: 640px;
    margin: 0 auto;
  }
  .update {
    flex: none;
    position: relative;
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

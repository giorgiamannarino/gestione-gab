<script lang="ts">
  import { Fingerprint, Lock } from '@lucide/svelte';
  import { onMount } from 'svelte';
  import { app } from '../lib/app/store.svelte';
  import { lock } from '../lib/security/lock.svelte';
  import BottomSheet from '../ui/BottomSheet.svelte';
  import Button from '../ui/Button.svelte';
  import InlineMessage from '../ui/InlineMessage.svelte';
  import TextField from '../ui/TextField.svelte';
  import PinPad from './parts/PinPad.svelte';

  let message = $state('');
  let error = $state(false);
  let waitUntil = $state(0);
  let now = $state(Date.now());
  let forgot = $state(false);
  let wipeText = $state('');
  const waiting = $derived(waitUntil > now);
  const seconds = $derived(Math.ceil((waitUntil - now) / 1000));

  onMount(() => {
    const t = setInterval(() => (now = Date.now()), 500);
    const pending = lock.config?.pin.lockedUntil ?? 0;
    if (pending > Date.now()) waitUntil = pending;
    if (lock.config?.biometricId) lock.tryBiometric();
    return () => clearInterval(t);
  });

  async function onPin(pin: string) {
    const res = await lock.tryPin(pin);
    if (res.ok) return;
    error = true;
    setTimeout(() => (error = false), 450);
    if (res.waitMs > 0) {
      waitUntil = Date.now() + res.waitMs;
      message = '';
    } else message = 'PIN errato';
  }

  function fmtWait(s: number) {
    return s >= 60 ? `${Math.ceil(s / 60)} min` : `${s} s`;
  }
</script>

<div class="lock" role="dialog" aria-modal="true" aria-label="App bloccata">
  <div class="brand"><span class="icon"><Lock size={24} strokeWidth={2} /></span></div>
  <PinPad
    title="Inserisci il PIN"
    message={waiting ? `Troppi tentativi. Riprova tra ${fmtWait(seconds)}.` : message}
    {error}
    disabled={waiting}
    oncomplete={onPin}
  >
    {#snippet extra()}
      {#if lock.config?.biometricId}
        <button class="bio" aria-label="Sblocca con Face ID o impronta" onclick={() => lock.tryBiometric()}><Fingerprint size={28} strokeWidth={1.75} /></button>
      {/if}
    {/snippet}
  </PinPad>
  <Button variant="ghost" onclick={() => (forgot = true)}>Hai dimenticato il PIN?</Button>
</div>

<BottomSheet bind:open={forgot} title="PIN dimenticato">
  <div class="stack">
    <InlineMessage tone="warning" title="Il PIN non si può recuperare">
      L'unica strada è cancellare i dati da questo telefono e poi ripristinare il tuo ultimo backup.
    </InlineMessage>
    <TextField label='Per confermare scrivi "CANCELLA"' bind:value={wipeText} autocomplete="off" />
    <Button variant="danger" size="lg" block disabled={wipeText.trim().toUpperCase() !== 'CANCELLA'} onclick={() => app.wipe()}>Cancella i dati</Button>
  </div>
</BottomSheet>

<style>
  .lock {
    position: fixed;
    inset: 0;
    z-index: 100;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--sp-4);
    padding: env(safe-area-inset-top) var(--gutter) env(safe-area-inset-bottom);
    background: var(--bg);
  }
  .icon {
    width: 56px;
    height: 56px;
    display: grid;
    place-items: center;
    border-radius: 18px;
    background: var(--accent-soft);
    color: var(--accent-ink);
  }
  .bio {
    width: 72px;
    height: 72px;
    display: grid;
    place-items: center;
    border-radius: 50%;
    color: var(--accent-ink);
  }
  .stack {
    display: grid;
    gap: var(--sp-3);
  }
</style>

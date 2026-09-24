<!-- Ripristino da file: validazione, password se cifrato, anteprima, conferma. -->
<script lang="ts">
  import { FileUp } from '@lucide/svelte';
  import { app } from '../../lib/app/store.svelte';
  import { readBackup, restoreBackup } from '../../lib/backup/service';
  import type { BackupFile, BackupSummary } from '../../lib/backup/format';
  import { showToast } from '../../lib/ui/toast.svelte';
  import Button from '../../ui/Button.svelte';
  import InlineMessage from '../../ui/InlineMessage.svelte';
  import TextField from '../../ui/TextField.svelte';

  interface Props {
    ondone?: () => void;
  }
  let { ondone }: Props = $props();

  let text = $state('');
  let needsPassword = $state(false);
  let password = $state('');
  let error = $state('');
  let ready = $state<{ backup: BackupFile; summary: BackupSummary } | null>(null);
  let busy = $state(false);
  let input: HTMLInputElement | undefined = $state();

  async function onFile(e: Event) {
    const file = (e.currentTarget as HTMLInputElement).files?.[0];
    if (!file) return;
    reset();
    text = await file.text();
    await read();
  }

  function reset() {
    error = '';
    ready = null;
    needsPassword = false;
    password = '';
  }

  async function read() {
    try {
      const res = await readBackup(text, needsPassword ? password : undefined);
      if (res.status === 'needs-password') needsPassword = true;
      else ready = res;
      error = '';
    } catch (e) {
      error = (e as Error).message;
    }
  }

  async function restore() {
    if (!ready) return;
    busy = true;
    try {
      await restoreBackup(app.db!, $state.snapshot(ready.backup) as BackupFile);
      await app.reload();
      showToast('Backup ripristinato', { tone: 'success' });
      ready = null;
      text = '';
      ondone?.();
    } catch {
      error = 'Il ripristino non è riuscito: i dati precedenti sono rimasti come prima.';
    } finally {
      busy = false;
    }
  }
</script>

<div class="restore">
  <input bind:this={input} type="file" accept=".json,application/json" class="visually-hidden" onchange={onFile} aria-label="Scegli il file di backup" />
  <Button variant="secondary" block onclick={() => input?.click()}><FileUp size={18} /> Scegli il file di backup</Button>

  {#if needsPassword && !ready}
    <TextField label="Password del backup" type="password" bind:value={password} autocomplete="off" />
    <Button block disabled={!password} onclick={read}>Apri il backup</Button>
  {/if}

  {#if error}
    <InlineMessage tone="error" title="Non posso usare questo file">{error}</InlineMessage>
  {/if}

  {#if ready}
    <InlineMessage tone="warning" title={ready.summary.message}>
      Tutti i dati attuali dell'app verranno sostituiti da quelli del backup.
    </InlineMessage>
    <Button variant="danger" size="lg" block loading={busy} onclick={restore}>Ripristina</Button>
  {/if}
</div>

<style>
  .restore {
    display: grid;
    gap: var(--sp-3);
  }
</style>

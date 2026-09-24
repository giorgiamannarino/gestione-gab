<script lang="ts">
  import type { HTMLInputAttributes } from 'svelte/elements';

  interface Props extends Omit<HTMLInputAttributes, 'value'> {
    label: string;
    value?: string;
    hint?: string;
    error?: string;
  }

  let { label, value = $bindable(''), hint, error, id, ...rest }: Props = $props();
  const uid = $props.id();
  const inputId = $derived(id ?? `f-${uid}`);
</script>

<div class="field" class:has-error={!!error}>
  <label for={inputId}>{label}</label>
  <input
    id={inputId}
    bind:value
    aria-invalid={!!error}
    aria-describedby={error || hint ? `${inputId}-msg` : undefined}
    {...rest}
  />
  {#if error}
    <p id="{inputId}-msg" class="msg error">{error}</p>
  {:else if hint}
    <p id="{inputId}-msg" class="msg">{hint}</p>
  {/if}
</div>

<style>
  .field {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  label {
    font-size: var(--fs-callout);
    font-weight: var(--fw-medium);
    color: var(--text-2);
  }
  input {
    min-height: 48px;
    padding: 0 var(--sp-4);
    border: 0;
    border-radius: var(--r-md);
    background: var(--surface-2);
    box-shadow: inset 0 0 0 1px var(--hairline-strong);
    font-weight: var(--fw-regular);
    transition: box-shadow var(--dur-base);
  }
  input::placeholder {
    color: var(--text-3);
  }
  input:focus {
    outline: none;
    box-shadow: inset 0 0 0 2px var(--accent-ink);
  }
  .has-error input {
    box-shadow: inset 0 0 0 2px var(--negative);
  }
  .msg {
    font-size: var(--fs-caption);
    color: var(--text-3);
  }
  .msg.error {
    color: var(--negative);
    font-weight: var(--fw-medium);
  }
</style>

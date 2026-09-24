<!-- Allinea i saldi: inserisci il saldo reale, l'app crea le rettifiche per la differenza. -->
<script lang="ts">
  import { app } from '../../lib/app/store.svelte';
  import { formatCents, parseEuroInput } from '../../lib/domain/money';
  import type { Id } from '../../lib/domain/types';
  import { color, icon } from '../../lib/ui/icons';
  import Amount from '../../ui/Amount.svelte';
  import Button from '../../ui/Button.svelte';
  import IconTile from '../../ui/IconTile.svelte';

  interface Props {
    ondone?: (count: number) => void;
    cta?: string;
  }
  let { ondone, cta = 'Allinea i saldi' }: Props = $props();

  let values = $state<Record<Id, string>>({});
  let busy = $state(false);
  const pockets = $derived(app.activePockets.filter((p) => p.role !== 'investment'));
  const errors = $derived(Object.fromEntries(Object.entries(values).filter(([, v]) => v.trim() && parseEuroInput(v) === null).map(([k]) => [k, true])));
  const changes = $derived(
    pockets
      .map((p) => ({ p, real: parseEuroInput(values[p.id] ?? '') }))
      .filter((x): x is { p: (typeof pockets)[number]; real: number } => x.real !== null && x.real !== (app.balances.get(x.p.id) ?? 0)),
  );

  async function apply() {
    busy = true;
    const n = await app.adjust(new Map(changes.map((c) => [c.p.id, c.real])));
    values = {};
    busy = false;
    ondone?.(n);
  }
</script>

<div class="align">
  {#each pockets as p (p.id)}
    {@const cur = app.balances.get(p.id) ?? 0}
    {@const real = parseEuroInput(values[p.id] ?? '')}
    <div class="row">
      <IconTile icon={icon(p.icon)} color={color(p.color)} size="sm" />
      <div class="info">
        <p class="name">{p.name}</p>
        <p class="cur">nell'app <Amount cents={cur} size="sm" tone="muted" animate={false} />
          {#if real !== null && real !== cur}<span class="diff">· rettifica {formatCents(real - cur, { signed: true })}</span>{/if}
        </p>
      </div>
      <input
        class="input"
        class:err={errors[p.id]}
        inputmode="decimal"
        placeholder={formatCents(cur, { symbol: false })}
        aria-label="Saldo reale di {p.name}"
        bind:value={values[p.id]}
      />
    </div>
  {/each}
  <p class="hint">Lascia vuoto un pocket se il saldo è già giusto.</p>
  <Button size="lg" block disabled={busy || changes.length === 0} loading={busy} onclick={apply}>
    {changes.length ? `${cta} (${changes.length})` : cta}
  </Button>
</div>

<style>
  .align {
    display: grid;
    gap: var(--sp-1);
  }
  .row {
    display: flex;
    align-items: center;
    gap: var(--sp-3);
    min-height: 60px;
  }
  .row + .row {
    border-top: 1px solid var(--hairline);
  }
  .info {
    flex: 1;
    min-width: 0;
  }
  .name {
    font-weight: var(--fw-medium);
  }
  .cur {
    font-size: var(--fs-caption);
    color: var(--text-3);
  }
  .diff {
    color: var(--accent-ink);
    font-weight: var(--fw-medium);
  }
  .input {
    width: 112px;
    min-height: 44px;
    padding: 0 var(--sp-3);
    border: 0;
    border-radius: var(--r-sm);
    background: var(--surface-2);
    box-shadow: inset 0 0 0 1px var(--hairline-strong);
    text-align: right;
    font-variant-numeric: tabular-nums;
    color: var(--text);
  }
  .input:focus {
    outline: none;
    box-shadow: inset 0 0 0 2px var(--accent-ink);
  }
  .input.err {
    box-shadow: inset 0 0 0 2px var(--negative);
  }
  .hint {
    font-size: var(--fs-caption);
    color: var(--text-3);
    margin: var(--sp-2) 0 var(--sp-3);
  }
</style>

<script lang="ts">
  import { ChevronLeft, ChevronRight, Receipt, Search, SlidersHorizontal, X } from '@lucide/svelte';
  import { app } from '../lib/app/store.svelte';
  import { router } from '../lib/app/router.svelte';
  import { openQuickAdd } from '../lib/app/quickadd.svelte';
  import { addDays, formatLongDate, inPeriod, periodLabel, shiftPeriod } from '../lib/domain/dates';
  import { txAmount } from '../lib/domain/transactions';
  import type { Id, Transaction } from '../lib/domain/types';
  import { color, icon } from '../lib/ui/icons';
  import Amount from '../ui/Amount.svelte';
  import BottomSheet from '../ui/BottomSheet.svelte';
  import Button from '../ui/Button.svelte';
  import Chip from '../ui/Chip.svelte';
  import EmptyState from '../ui/EmptyState.svelte';
  import IconTile from '../ui/IconTile.svelte';
  import SwipeRow from '../ui/SwipeRow.svelte';

  interface Props {
    /** Pocket fisso: la lista mostra solo i suoi movimenti (pagina del pocket). */
    fixedPocket?: Id;
  }
  let { fixedPocket }: Props = $props();

  let offset = $state(0);
  let all = $state(false);
  let query = $state('');
  let pocketF = $state<Id | null>(null);
  let categoryF = $state<Id | null>(null);
  let filtersOpen = $state(false);

  // Filtri dall'indirizzo (es. /movimenti/pocket/ID) o pocket fisso.
  $effect(() => {
    if (fixedPocket) {
      pocketF = fixedPocket;
      return;
    }
    const [, type, id] = router.segments;
    if (type === 'pocket' && id) {
      pocketF = id;
      all = false;
    }
  });

  const period = $derived(shiftPeriod(app.period, offset, app.data.settings.salaryDay));
  const pocketName = (id: Id) => app.data.pockets.find((p) => p.id === id)?.name ?? '—';
  const category = (id?: Id) => app.data.categories.find((c) => c.id === id);
  const roundups = $derived(new Map(app.data.transactions.filter((t) => t.parentId).map((t) => [t.parentId!, t])));

  const list = $derived.by(() => {
    const q = query.trim().toLowerCase();
    return app.data.transactions
      .filter((t) => !(t.kind === 'roundup' && t.parentId))
      .filter((t) => all || inPeriod(t.date, period))
      .filter((t) => !pocketF || t.legs.some((l) => l.pocketId === pocketF))
      .filter((t) => !categoryF || t.categoryId === categoryF)
      .filter((t) => !q || t.description.toLowerCase().includes(q) || (t.note ?? '').toLowerCase().includes(q) || (category(t.categoryId)?.name ?? '').toLowerCase().includes(q))
      .sort((a, b) => (a.date === b.date ? b.createdAt - a.createdAt : a.date < b.date ? 1 : -1));
  });
  const days = $derived.by(() => {
    const m = new Map<string, Transaction[]>();
    for (const t of list) m.set(t.date, [...(m.get(t.date) ?? []), t]);
    return [...m];
  });

  function dayLabel(d: string) {
    if (d === app.today) return 'Oggi';
    if (d === addDays(app.today, -1)) return 'Ieri';
    return formatLongDate(d);
  }

  /** Importo con segno dal punto di vista del filtro (o del movimento). */
  function signed(t: Transaction): number {
    if (pocketF) return t.legs.filter((l) => l.pocketId === pocketF).reduce((a, l) => a + l.amount, 0);
    if (t.kind === 'transfer') return txAmount(t);
    return t.legs.reduce((a, l) => a + l.amount, 0);
  }
  function subtitle(t: Transaction): string {
    const neg = t.legs.filter((l) => l.amount < 0).map((l) => pocketName(l.pocketId));
    const pos = t.legs.filter((l) => l.amount > 0).map((l) => pocketName(l.pocketId));
    if (t.kind === 'transfer') return `${neg.join(', ') || '—'} → ${pos.length > 2 ? `${pos.length} pocket` : pos.join(', ') || '—'}`;
    const c = category(t.categoryId);
    return [...neg, ...pos].join(', ') + (c && !c.system ? ` · ${c.name}` : t.kind === 'adjustment' ? ' · Rettifica' : '');
  }
  function tileFor(t: Transaction) {
    if (t.kind === 'transfer') return { i: icon('arrow-right-left'), c: color('ardesia') };
    if (t.kind === 'adjustment') return { i: icon('scale'), c: color('ardesia') };
    const c = category(t.categoryId);
    return { i: icon(c?.icon), c: color(c?.color) };
  }
  const editable = (t: Transaction) => t.kind === 'expense' || t.kind === 'income' || t.kind === 'transfer';
  const activeFilters = $derived((pocketF && !fixedPocket ? 1 : 0) + (categoryF ? 1 : 0));
  function clearFilters() {
    pocketF = fixedPocket ?? null;
    categoryF = null;
    query = '';
    if (!fixedPocket && router.segments.length > 1) router.go('/movimenti');
  }
</script>

<div class="page" class:embedded={!!fixedPocket}>
  <header class="head">
    {#if fixedPocket}<h2 class="t-title-3">Movimenti e giroconti</h2>{:else}<h1 class="t-title-1">Movimenti</h1>{/if}
    <div class="period">
      {#if all}
        <button class="period-btn" onclick={() => (all = false)}>Tutto lo storico · mostra un periodo</button>
      {:else}
        <button class="nav" aria-label="Periodo precedente" onclick={() => offset--}><ChevronLeft size={20} /></button>
        <button class="period-btn" onclick={() => (all = true)} aria-label="Mostra tutto lo storico">{periodLabel(period)}</button>
        <button class="nav" aria-label="Periodo successivo" disabled={offset >= 0} onclick={() => offset++}><ChevronRight size={20} /></button>
      {/if}
    </div>
    <div class="searchbar">
      <label class="search">
        <Search size={18} strokeWidth={1.75} />
        <input type="search" placeholder="Cerca" bind:value={query} aria-label="Cerca nei movimenti" />
      </label>
      <button class="filter-btn" class:on={activeFilters > 0} onclick={() => (filtersOpen = true)} aria-label="Filtri">
        <SlidersHorizontal size={18} strokeWidth={1.75} />{#if activeFilters}<span class="badge">{activeFilters}</span>{/if}
      </button>
    </div>
    {#if activeFilters}
      <div class="active-filters">
        {#if pocketF && !fixedPocket}<button class="tag" onclick={() => { pocketF = null; router.go('/movimenti'); }}>{pocketName(pocketF)} <X size={14} /></button>{/if}
        {#if categoryF}<button class="tag" onclick={() => (categoryF = null)}>{category(categoryF)?.name} <X size={14} /></button>{/if}
      </div>
    {/if}
  </header>

  {#each days as [day, txs] (day)}
    <section class="day">
      <h2 class="day-head">
        <span class="t-overline c-3">{dayLabel(day)}</span>
      </h2>
      <div class="card">
        {#each txs as t (t.id)}
          {@const tile = tileFor(t)}
          {@const r = roundups.get(t.id)}
          {@const v = signed(t)}
          <SwipeRow onopen={editable(t) ? () => openQuickAdd({ editId: t.id }) : undefined} ondelete={() => app.deleteTx(t.id)}>
            <div class="row">
              <IconTile icon={tile.i} color={tile.c} />
              <div class="text">
                <p class="title">{t.description}</p>
                <p class="sub">{subtitle(t)}</p>
              </div>
              <div class="right">
                <Amount cents={v} signed={t.kind === 'income' || (t.kind === 'adjustment' && v > 0) || (!!pocketF && v > 0)} tone={t.kind === 'transfer' && !pocketF ? 'muted' : 'auto'} />
                {#if r}<p class="rsub"><Amount cents={r.legs.find((l) => l.amount > 0)?.amount ?? 0} signed size="sm" tone="muted" /> {pocketName(r.legs.find((l) => l.amount > 0)?.pocketId ?? '')}</p>{/if}
              </div>
            </div>
          </SwipeRow>
        {/each}
      </div>
    </section>
  {:else}
    <EmptyState
      icon={Receipt}
      title={query || activeFilters ? 'Nessun movimento trovato' : 'Nessun movimento in questo periodo'}
      text={query || activeFilters ? 'Prova a cambiare la ricerca o i filtri.' : 'Aggiungi una spesa con il pulsante +: bastano pochi secondi.'}
    >
      {#snippet action()}
        {#if query || activeFilters}<Button variant="secondary" onclick={clearFilters}>Rimuovi i filtri</Button>{/if}
      {/snippet}
    </EmptyState>
  {/each}
  {#if days.length}<p class="hint c-3">Scorri a sinistra per eliminare, tocca per modificare.</p>{/if}
</div>

<BottomSheet bind:open={filtersOpen} title="Filtri">
  {#if !fixedPocket}
    <p class="flabel">Pocket</p>
    <div class="chips">
      {#each app.data.pockets as p (p.id)}
        <Chip label={p.name} color={color(p.color)} selected={pocketF === p.id} onclick={() => (pocketF = pocketF === p.id ? null : p.id)} />
      {/each}
    </div>
  {/if}
  <p class="flabel">Categoria</p>
  <div class="chips">
    {#each app.data.categories.filter((c) => !c.archived) as c (c.id)}
      <Chip label={c.name} icon={icon(c.icon)} color={color(c.color)} selected={categoryF === c.id} onclick={() => (categoryF = categoryF === c.id ? null : c.id)} />
    {/each}
  </div>
  {#snippet footer()}
    <div class="fbtns">
      <Button variant="ghost" onclick={clearFilters}>Azzera</Button>
      <Button onclick={() => (filtersOpen = false)}>Mostra {list.length} movimenti</Button>
    </div>
  {/snippet}
</BottomSheet>

<style>
  .page {
    padding: calc(var(--sp-4) + env(safe-area-inset-top)) var(--gutter) var(--sp-5);
  }
  .page.embedded {
    padding: var(--sp-5) 0 0;
  }
  .head {
    display: grid;
    gap: var(--sp-3);
    margin-bottom: var(--sp-3);
  }
  .period {
    display: flex;
    align-items: center;
    gap: var(--sp-1);
  }
  .nav {
    width: var(--tap);
    height: var(--tap);
    display: grid;
    place-items: center;
    border-radius: 50%;
    color: var(--text-2);
  }
  .nav:disabled {
    opacity: 0.3;
  }
  .period-btn {
    flex: 1;
    min-height: var(--tap);
    font-weight: var(--fw-bold);
    border-radius: var(--r-sm);
  }
  .searchbar {
    display: flex;
    gap: var(--sp-2);
  }
  .search {
    flex: 1;
    display: flex;
    align-items: center;
    gap: var(--sp-2);
    padding: 0 var(--sp-3);
    min-height: var(--tap);
    border-radius: var(--r-md);
    background: var(--surface-3);
    color: var(--text-3);
  }
  .search input {
    flex: 1;
    min-width: 0;
    border: 0;
    background: none;
    color: var(--text);
    outline: none;
  }
  .filter-btn {
    position: relative;
    width: var(--tap);
    height: var(--tap);
    display: grid;
    place-items: center;
    border-radius: var(--r-md);
    background: var(--surface-3);
    color: var(--text-2);
  }
  .filter-btn.on {
    background: var(--accent-soft);
    color: var(--accent-ink);
  }
  .badge {
    position: absolute;
    top: 4px;
    right: 4px;
    min-width: 16px;
    height: 16px;
    border-radius: 8px;
    background: var(--accent);
    color: var(--on-accent);
    font-size: 10px;
    font-weight: var(--fw-heavy);
    display: grid;
    place-items: center;
  }
  .active-filters {
    display: flex;
    gap: var(--sp-2);
    flex-wrap: wrap;
  }
  .tag {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    min-height: 32px;
    padding: 0 var(--sp-3);
    border-radius: var(--r-full);
    background: var(--accent-soft);
    color: var(--accent-ink);
    font-size: var(--fs-callout);
    font-weight: var(--fw-medium);
  }
  .day {
    margin-top: var(--sp-4);
  }
  .day-head {
    padding: 0 var(--sp-1) var(--sp-2);
  }
  .card {
    border-radius: var(--r-lg);
    overflow: hidden;
    background: var(--surface);
    box-shadow: var(--shadow-1), var(--card-ring);
  }
  .card :global(.wrap + .wrap) {
    border-top: 1px solid var(--hairline);
  }
  .row {
    display: flex;
    align-items: center;
    gap: var(--sp-3);
    min-height: 64px;
    padding: var(--sp-2) var(--sp-4);
  }
  .text {
    flex: 1;
    min-width: 0;
  }
  .title {
    font-weight: var(--fw-medium);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .sub {
    font-size: var(--fs-callout);
    color: var(--text-3);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .right {
    text-align: right;
  }
  .rsub {
    font-size: var(--fs-caption);
    color: var(--text-3);
  }
  .hint {
    text-align: center;
    font-size: var(--fs-caption);
    margin-top: var(--sp-4);
  }
  .flabel {
    font-size: var(--fs-caption);
    font-weight: var(--fw-bold);
    color: var(--text-3);
    margin: var(--sp-3) 0 var(--sp-2);
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: var(--sp-2);
  }
  .fbtns {
    display: flex;
    justify-content: space-between;
  }
</style>

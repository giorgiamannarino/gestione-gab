<!-- Inserimento rapido: uscita, entrata, giroconto (anche uno-a-molti). -->
<script lang="ts">
  import { ChevronDown, Coins } from '@lucide/svelte';
  import { untrack } from 'svelte';
  import { app } from '../lib/app/store.svelte';
  import { quickAdd } from '../lib/app/quickadd.svelte';
  import { centsToKeypad, keypadToCents } from '../lib/domain/keypad';
  import { formatCents } from '../lib/domain/money';
  import { roundupPreview } from '../lib/domain/transactions';
  import type { Id, Transaction } from '../lib/domain/types';
  import { color, icon } from '../lib/ui/icons';
  import Amount from '../ui/Amount.svelte';
  import BottomSheet from '../ui/BottomSheet.svelte';
  import Button from '../ui/Button.svelte';
  import Chip from '../ui/Chip.svelte';
  import Keypad from '../ui/Keypad.svelte';
  import Segmented from '../ui/Segmented.svelte';
  import TextField from '../ui/TextField.svelte';

  type Kind = 'expense' | 'income' | 'transfer';

  let kind = $state<Kind>('expense');
  let keypad = $state('');
  let from = $state<Id>('');
  let to = $state<Id>('');
  let dests = $state<{ pocketId: Id; value: string }[]>([]);
  let activeDest = $state(0);
  let categoryId = $state<Id | undefined>();
  let description = $state('');
  let date = $state(app.today);
  let note = $state('');
  let tag = $state('');
  let roundup = $state(true);
  let details = $state(false);
  let saving = $state(false);
  let touchedPocket = false;
  let touchedCategory = false;

  const editing = $derived(quickAdd.editId ? app.data.transactions.find((t) => t.id === quickAdd.editId) : undefined);
  const pockets = $derived(app.activePockets);
  const categories = $derived(app.data.categories.filter((c) => !c.archived && !c.system).sort((a, b) => a.order - b.order));
  const amount = $derived(kind === 'transfer' ? dests.reduce((a, d) => a + keypadToCents(d.value), 0) : keypadToCents(keypad));
  const preview = $derived(kind === 'expense' ? roundupPreview({ kind, amount, fromPocketId: from, roundup }, app.data.pockets) : 0);
  const payerIsRevolut = $derived(app.data.pockets.find((p) => p.id === from)?.isRevolut ?? false);
  const savingsName = $derived(app.data.pockets.find((p) => p.role === 'savings')?.name ?? 'Savings');

  // Descrizioni già usate, dalla più recente, con pocket e categoria.
  const history = $derived.by(() => {
    const seen = new Map<string, Transaction>();
    const sorted = [...app.data.transactions].filter((t) => t.kind === 'expense' || t.kind === 'income').sort((a, b) => b.updatedAt - a.updatedAt);
    for (const t of sorted) if (t.description && !seen.has(t.description.toLowerCase())) seen.set(t.description.toLowerCase(), t);
    return [...seen.values()];
  });
  const suggestions = $derived.by(() => {
    const q = description.trim().toLowerCase();
    return history.filter((t) => t.kind === kind && (!q || (t.description.toLowerCase().startsWith(q) && t.description.toLowerCase() !== q))).slice(0, 4);
  });

  const title = $derived(editing ? 'Modifica movimento' : 'Nuovo movimento');

  // Etichette già usate, dalle più recenti, filtrate da quanto scritto.
  const tagSuggestions = $derived.by(() => {
    const q = tag.trim().toLowerCase();
    const seen = new Map<string, string>();
    for (const t of [...app.data.transactions].sort((a, b) => b.updatedAt - a.updatedAt)) {
      const v = t.tag?.trim();
      if (v && !seen.has(v.toLowerCase())) seen.set(v.toLowerCase(), v);
    }
    return [...seen.values()].filter((v) => v.toLowerCase() !== q && (!q || v.toLowerCase().includes(q))).slice(0, 5);
  });

  // Inizializza a ogni apertura.
  $effect(() => {
    void quickAdd.nonce;
    untrack(reset); // solo all'apertura, non a ogni aggiornamento dei dati
  });

  function reset() {
    const t = editing;
    touchedPocket = touchedCategory = false;
    details = false;
    saving = false;
    if (t && (t.kind === 'expense' || t.kind === 'income' || t.kind === 'transfer')) {
      kind = t.kind;
      const neg = t.legs.filter((l) => l.amount < 0);
      const pos = t.legs.filter((l) => l.amount > 0);
      from = neg[0]?.pocketId ?? '';
      to = pos[0]?.pocketId ?? '';
      keypad = centsToKeypad(Math.abs(t.legs[0]!.amount));
      dests = pos.map((l) => ({ pocketId: l.pocketId, value: centsToKeypad(l.amount) }));
      activeDest = 0;
      categoryId = t.categoryId;
      description = t.description;
      date = t.date;
      note = t.note ?? '';
      tag = t.tag ?? '';
      roundup = t.roundup !== false;
      details = !!t.note || !!t.tag || t.date !== app.today;
      return;
    }
    kind = (quickAdd.kind as Kind | null) ?? 'expense';
    keypad = '';
    const last = [...app.data.transactions].filter((x) => x.kind === 'expense' && x.source === 'manual').sort((a, b) => b.createdAt - a.createdAt)[0];
    from = last?.legs[0]?.pocketId && pockets.some((p) => p.id === last.legs[0]!.pocketId) ? last.legs[0]!.pocketId : (app.mainPocket?.id ?? pockets[0]?.id ?? '');
    to = app.mainPocket?.id ?? '';
    dests = [];
    activeDest = 0;
    categoryId = undefined;
    description = '';
    date = app.today;
    note = '';
    tag = '';
    roundup = true;
  }

  function applySuggestion(t: Transaction) {
    description = t.description;
    if (!touchedPocket) {
      if (t.kind === 'expense') from = t.legs[0]!.pocketId;
      else to = t.legs[0]!.pocketId;
    }
    if (!touchedCategory) categoryId = t.categoryId;
  }

  function onDescription() {
    const match = history.find((t) => t.kind === kind && t.description.toLowerCase() === description.trim().toLowerCase());
    if (match) applySuggestion(match);
  }

  function toggleDest(id: Id) {
    const i = dests.findIndex((d) => d.pocketId === id);
    if (i >= 0) {
      dests.splice(i, 1);
      activeDest = Math.max(0, Math.min(activeDest, dests.length - 1));
    } else {
      dests.push({ pocketId: id, value: dests.length === 0 ? keypad : '' });
      activeDest = dests.length - 1;
    }
  }

  function onKeypad(v: string) {
    if (kind === 'transfer' && dests[activeDest]) dests[activeDest]!.value = v;
  }

  const keypadValue = $derived(kind === 'transfer' ? (dests[activeDest]?.value ?? keypad) : keypad);
  const valid = $derived(
    amount > 0 &&
      (kind === 'expense' ? !!from : kind === 'income' ? !!to : !!from && dests.length > 0 && dests.every((d) => keypadToCents(d.value) > 0 && d.pocketId !== from)),
  );

  async function save() {
    if (!valid || saving) return;
    saving = true;
    try {
      await app.saveEntry(
        {
          kind,
          date,
          amount,
          fromPocketId: kind === 'income' ? undefined : from,
          toPocketId: kind === 'income' ? to : undefined,
          splits: kind === 'transfer' ? dests.map((d) => ({ pocketId: d.pocketId, amount: keypadToCents(d.value) })) : undefined,
          description: description.trim() || (kind === 'transfer' ? 'Giroconto' : (categories.find((c) => c.id === categoryId)?.name ?? (kind === 'income' ? 'Entrata' : 'Uscita'))),
          categoryId: kind === 'transfer' ? 'sys-transfer' : categoryId,
          note,
          tag,
          roundup,
          source: editing?.source,
        },
        editing?.id,
      );
      quickAdd.open = false;
    } finally {
      saving = false;
    }
  }

  const pocketName = (id: Id) => app.data.pockets.find((p) => p.id === id)?.name ?? '';
</script>

<BottomSheet bind:open={quickAdd.open} {title}>
  <div class="qa">
    {#if !editing}
      <Segmented
        label="Tipo di movimento"
        bind:value={kind}
        options={[
          { value: 'expense', label: 'Uscita' },
          { value: 'income', label: 'Entrata' },
          { value: 'transfer', label: 'Giroconto' },
        ]}
      />
    {/if}

    <div class="amount" aria-live="polite">
      <Amount cents={amount} size="display" animate={false} />
      {#if preview > 0}
        <button class="roundup" onclick={() => (roundup = false)} aria-label="Disattiva l'arrotondamento per questo movimento">
          <Coins size={14} strokeWidth={2} /> +{formatCents(preview)} ai {savingsName} <span aria-hidden="true">×</span>
        </button>
      {:else if kind === 'expense' && payerIsRevolut && !roundup}
        <button class="roundup off" onclick={() => (roundup = true)}>Arrotondamento disattivato · riattiva</button>
      {/if}
    </div>

    {#if kind !== 'transfer'}
      <div class="desc">
        <TextField label="Descrizione" placeholder={kind === 'income' ? 'Es. Stipendio' : 'Es. Supermercato'} bind:value={description} onchange={onDescription} onblur={onDescription} autocomplete="off" enterkeyhint="done" />
        {#if suggestions.length}
          <div class="chips scroll" aria-label="Suggerimenti">
            {#each suggestions as s (s.id)}
              <button class="suggestion" onclick={() => applySuggestion(s)}>{s.description}</button>
            {/each}
          </div>
        {/if}
      </div>
    {/if}

    <div class="group">
      <p class="label">{kind === 'income' ? 'Su' : 'Da'}</p>
      <div class="chips scroll">
        {#each pockets as p (p.id)}
          {@const sel = kind === 'income' ? to === p.id : from === p.id}
          <Chip label={p.name} color={color(p.color)} selected={sel} onclick={() => { touchedPocket = true; if (kind === 'income') to = p.id; else from = p.id; }} />
        {/each}
      </div>
    </div>

    {#if kind === 'transfer'}
      <div class="group">
        <p class="label">A <span class="hint">(anche più di uno)</span></p>
        <div class="chips scroll">
          {#each pockets.filter((p) => p.id !== from) as p (p.id)}
            <Chip label={p.name} color={color(p.color)} selected={dests.some((d) => d.pocketId === p.id)} onclick={() => toggleDest(p.id)} />
          {/each}
        </div>
        {#if dests.length > 1}
          <div class="splits">
            {#each dests as d, i (d.pocketId)}
              <button class="split" class:active={i === activeDest} onclick={() => (activeDest = i)}>
                <span>{pocketName(d.pocketId)}</span>
                <Amount cents={keypadToCents(d.value)} size="sm" animate={false} />
              </button>
            {/each}
          </div>
        {/if}
      </div>
    {:else}
      <div class="group">
        <p class="label">Categoria</p>
        <div class="chips scroll">
          {#each categories as c (c.id)}
            <Chip label={c.name} icon={icon(c.icon)} color={color(c.color)} selected={categoryId === c.id} onclick={() => { touchedCategory = true; categoryId = categoryId === c.id ? undefined : c.id; }} />
          {/each}
        </div>
      </div>
    {/if}

    {#if kind === 'transfer' && dests.length === 0}
      <p class="hint center">Scegli dove spostare i soldi, poi inserisci l'importo.</p>
    {:else if kind === 'transfer'}
      <Keypad value={keypadValue} onchange={onKeypad} />
    {:else}
      <Keypad bind:value={keypad} />
    {/if}

    <button class="details-toggle" aria-expanded={details} onclick={() => (details = !details)}>
      Data e nota <ChevronDown size={16} strokeWidth={2} />
    </button>
    {#if details}
      <div class="details">
        <label class="date">
          <span>Data</span>
          <input type="date" bind:value={date} max="2100-12-31" />
        </label>
        <TextField label="Nota (facoltativa)" bind:value={note} />
        <TextField label="Etichetta evento o viaggio (facoltativa)" placeholder="Es. Weekend Roma" bind:value={tag} autocomplete="off" />
        {#if tagSuggestions.length}
          <div class="chips scroll" aria-label="Etichette usate">
            {#each tagSuggestions as s (s)}<button class="suggestion" onclick={() => (tag = s)}>{s}</button>{/each}
          </div>
        {/if}
        {#if kind === 'expense' && payerIsRevolut}
          <label class="check"><input type="checkbox" bind:checked={roundup} /> Arrotondamento ai {savingsName}</label>
        {/if}
      </div>
    {/if}

    <Button size="lg" block disabled={!valid} loading={saving} onclick={save}>{editing ? 'Salva modifiche' : 'Salva'}</Button>
  </div>
</BottomSheet>

<style>
  .qa {
    display: flex;
    flex-direction: column;
    gap: var(--sp-3);
  }
  .amount {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--sp-2);
    min-height: 96px;
    padding-top: var(--sp-2);
  }
  .roundup {
    position: relative;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-height: 32px;
    padding: 0 var(--sp-3);
    border-radius: var(--r-full);
    font-size: var(--fs-callout);
    font-weight: var(--fw-bold);
    color: var(--pk-ocra);
    background: color-mix(in srgb, var(--pk-ocra) 12%, var(--surface));
  }
  .roundup::after {
    content: '';
    position: absolute;
    inset: -6px 0;
  }
  .roundup.off {
    color: var(--text-3);
    background: var(--surface-2);
    font-weight: var(--fw-medium);
  }
  .group .label {
    font-size: var(--fs-caption);
    font-weight: var(--fw-bold);
    color: var(--text-3);
    margin-bottom: 6px;
  }
  .hint {
    font-weight: var(--fw-regular);
    color: var(--text-3);
    font-size: var(--fs-callout);
  }
  .center {
    text-align: center;
    padding: var(--sp-5) 0;
  }
  .chips {
    display: flex;
    gap: var(--sp-2);
  }
  .chips.scroll {
    overflow-x: auto;
    margin: 0 calc(-1 * var(--sp-5));
    padding: 2px var(--sp-5);
    scrollbar-width: none;
  }
  .desc .chips {
    margin-top: var(--sp-2);
  }
  .suggestion {
    flex: none;
    min-height: 36px;
    padding: 0 var(--sp-3);
    border-radius: var(--r-full);
    background: var(--accent-soft);
    color: var(--accent-ink);
    font-size: var(--fs-callout);
    font-weight: var(--fw-medium);
  }
  .splits {
    display: grid;
    gap: var(--sp-1);
    margin-top: var(--sp-2);
  }
  .split {
    display: flex;
    justify-content: space-between;
    align-items: center;
    min-height: 44px;
    padding: 0 var(--sp-3);
    border-radius: var(--r-sm);
    background: var(--surface-2);
    font-size: var(--fs-callout);
  }
  .split.active {
    box-shadow: inset 0 0 0 2px var(--accent-ink);
  }
  .details-toggle {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    align-self: center;
    min-height: var(--tap);
    padding: 0 var(--sp-3);
    color: var(--text-2);
    font-size: var(--fs-callout);
    font-weight: var(--fw-medium);
  }
  .details {
    display: grid;
    gap: var(--sp-3);
  }
  .date {
    display: grid;
    gap: 6px;
    font-size: var(--fs-callout);
    font-weight: var(--fw-medium);
    color: var(--text-2);
  }
  .date input {
    min-height: 48px;
    padding: 0 var(--sp-4);
    border: 0;
    border-radius: var(--r-md);
    background: var(--surface-2);
    box-shadow: inset 0 0 0 1px var(--hairline-strong);
    color: var(--text);
  }
  .check {
    display: flex;
    align-items: center;
    gap: var(--sp-2);
    min-height: var(--tap);
    font-size: var(--fs-callout);
  }
  .check input {
    width: 20px;
    height: 20px;
    accent-color: var(--accent-ink);
  }
</style>

<script lang="ts">
  import { ChartPie, ChevronLeft, ChevronRight, Plus } from '@lucide/svelte';
  import { app } from '../lib/app/store.svelte';
  import { balanceSeries } from '../lib/domain/balances';
  import { monthName, periodLabel, periodShortName, shiftPeriod, inPeriod } from '../lib/domain/dates';
  import { parseEuroInput } from '../lib/domain/money';
  import { dailySpending, spendingByCategory, spendingByPocket, totalIncome, totalSpending } from '../lib/domain/stats';
  import { formatCents } from '../lib/domain/money';
  import { privacy } from '../lib/ui/privacy.svelte';
  import CalendarHeatmap from '../ui/charts/CalendarHeatmap.svelte';
  import { openQuickAdd } from '../lib/app/quickadd.svelte';
  import { router } from '../lib/app/router.svelte';
  import { tagSummary } from '../lib/domain/planning';
  import type { Id } from '../lib/domain/types';
  import { color, icon } from '../lib/ui/icons';
  import Amount from '../ui/Amount.svelte';
  import BottomSheet from '../ui/BottomSheet.svelte';
  import Button from '../ui/Button.svelte';
  import Card from '../ui/Card.svelte';
  import Chip from '../ui/Chip.svelte';
  import EmptyState from '../ui/EmptyState.svelte';
  import TextField from '../ui/TextField.svelte';
  import BarList from '../ui/charts/BarList.svelte';
  import ColumnChart from '../ui/charts/ColumnChart.svelte';
  import LineChart from '../ui/charts/LineChart.svelte';

  let offset = $state(0);
  const day = $derived(app.data.settings.salaryDay);
  const period = $derived(shiftPeriod(app.period, offset, day));
  const cats = $derived(app.data.categories);
  const txs = $derived(app.data.transactions);

  const spent = $derived(totalSpending(txs, period, cats));
  const income = $derived(totalIncome(txs, period));
  const prevSpent = $derived(totalSpending(txs, shiftPeriod(period, -1, day), cats));

  const byCategory = $derived(
    [...spendingByCategory(txs, period, cats)]
      .filter(([, v]) => v > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([id, value]) => {
        const c = cats.find((x) => x.id === id);
        return { id: id || 'none', label: c?.name ?? 'Senza categoria', value, color: color(c?.color), icon: icon(c?.icon) };
      }),
  );
  const byPocket = $derived(
    [...spendingByPocket(txs, period, cats)]
      .filter(([, v]) => v > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([id, value]) => {
        const p = app.data.pockets.find((x) => x.id === id);
        return { id, label: p?.name ?? '—', value, color: color(p?.color), icon: icon(p?.icon) };
      }),
  );
  const history = $derived(
    Array.from({ length: 6 }, (_, i) => shiftPeriod(period, i - 5, day)).map((p) => ({
      label: periodShortName(p),
      fullLabel: periodLabel(p),
      value: totalSpending(txs, p, cats),
    })),
  );

  // Etichette (tutto lo storico, dalla più recente)
  const tags = $derived(tagSummary(txs));
  const shortDay = (d: string) => `${Number(d.slice(8))} ${monthName(Number(d.slice(5, 7))).slice(0, 3)}`;

  // Calendario
  const daily = $derived(dailySpending(txs, period, cats));
  let selDay = $state<string | null>(null);
  $effect(() => {
    void period.key;
    selDay = null;
  });
  // Tutti i movimenti del giorno (gli arrotondamenti compaiono sotto la loro uscita).
  const dayTxs = $derived(selDay ? txs.filter((t) => t.date === selDay && !(t.kind === 'roundup' && t.parentId)).sort((a, b) => a.createdAt - b.createdAt) : []);
  const pocketOf = (id?: string) => app.data.pockets.find((p) => p.id === id)?.name ?? '';
  function dayRow(t: (typeof txs)[number]) {
    const neg = t.legs.filter((l) => l.amount < 0).map((l) => pocketOf(l.pocketId));
    const pos = t.legs.filter((l) => l.amount > 0).map((l) => pocketOf(l.pocketId));
    if (t.kind === 'transfer') return { sub: `${neg.join(', ')} → ${pos.join(', ')}`, amount: t.legs.filter((l) => l.amount > 0).reduce((a, l) => a + l.amount, 0), tone: 'muted' as const, signed: false };
    const amount = t.legs.reduce((a, l) => a + l.amount, 0);
    const cat = cats.find((c) => c.id === t.categoryId);
    return { sub: [...neg, ...pos].join(', ') + (cat && !cat.system ? ` · ${cat.name}` : ''), amount, tone: 'auto' as const, signed: amount > 0 };
  }

  // Investimenti: versato a fine periodo e valore reale inserito a mano.
  const investments = $derived(app.data.pockets.filter((p) => p.role === 'investment' && !p.archived));
  const invPeriods = $derived(Array.from({ length: 6 }, (_, i) => shiftPeriod(app.period, i - 5, day)));
  function valuationsFor(id: Id) {
    return invPeriods.map((p) => {
      const v = app.data.valuations.filter((x) => x.pocketId === id && inPeriod(x.date, p)).sort((a, b) => (a.date < b.date ? 1 : -1))[0];
      return v ? v.value : null;
    });
  }
  const invTotal = $derived(invPeriods.map((_, i) => investments.reduce((a, p) => a + balanceSeries(p, txs, invPeriods.map((x) => x.end))[i]!, 0)));

  let valOpen = $state(false);
  let valPocket = $state<Id>('');
  let valAmount = $state('');
  let valDate = $state(app.today);
  let valError = $state('');
  async function saveValuation() {
    const v = parseEuroInput(valAmount);
    if (!v || v <= 0 || !valPocket) {
      valError = 'Scrivi il valore, per esempio 3.250,00.';
      return;
    }
    await app.put('valuations', { id: crypto.randomUUID(), pocketId: valPocket, date: valDate, value: v });
    valOpen = false;
    valAmount = '';
    valError = '';
  }
</script>

<div class="page">
  <header class="head">
    <h1 class="t-title-1">Statistiche</h1>
    <div class="period">
      <button class="nav" aria-label="Periodo precedente" onclick={() => offset--}><ChevronLeft size={20} /></button>
      <p class="period-label">{periodLabel(period)}</p>
      <button class="nav" aria-label="Periodo successivo" disabled={offset >= 0} onclick={() => offset++}><ChevronRight size={20} /></button>
    </div>
  </header>

  <div class="kpis">
    <div class="kpi">
      <p class="c-3 small">Spese</p>
      <Amount cents={spent} size="lg" />
      {#if prevSpent > 0}
        {@const diff = spent - prevSpent}
        <p class="small" class:up={diff > 0} class:down={diff < 0}>
          {diff > 0 ? '+' : ''}{Math.round((diff / prevSpent) * 100)}% sul periodo prima
        </p>
      {/if}
    </div>
    <div class="kpi">
      <p class="c-3 small">Entrate</p>
      <Amount cents={income} size="lg" />
    </div>
  </div>

  {#if byCategory.length}
    <Card title="Spese per categoria"><BarList items={byCategory} /></Card>
    <Card title="Spese per pocket"><BarList items={byPocket} /></Card>
  {:else}
    <Card>
      <EmptyState icon={ChartPie} title="Nessuna spesa in questo periodo" text="Quando registri le uscite, qui vedi dove vanno i soldi." />
    </Card>
  {/if}

  <Card title="Calendario delle spese">
    <div class="cal-split">
      <CalendarHeatmap {period} days={daily} today={app.today} selected={selDay} onselect={(d) => (selDay = d)} />
      <div class="day-detail" aria-live="polite">
        {#if selDay}
          {@const v = daily.get(selDay)}
          <p class="strong">{Number(selDay.slice(8))} {monthName(Number(selDay.slice(5, 7)))}</p>
          <p class="c-3 tiny">Spese: {v ? (privacy.hidden ? '•••' : formatCents(v.amount)) : 'nessuna'}</p>
          <div class="day-list">
            {#each dayTxs as t (t.id)}
              {@const r = dayRow(t)}
              <button class="day-row" onclick={() => (t.kind === 'expense' || t.kind === 'income' || t.kind === 'transfer') && openQuickAdd({ editId: t.id })}>
                <span class="dr-text"><span class="dr-title">{t.description}</span><span class="c-3 tiny">{r.sub}</span></span>
                <Amount cents={r.amount} size="sm" tone={r.tone} signed={r.signed} />
              </button>
            {:else}
              <p class="c-3 tiny">Nessun movimento.</p>
            {/each}
          </div>
        {:else}
          <p class="c-3 tiny hint">Tocca un giorno per vedere i suoi movimenti.</p>
        {/if}
      </div>
    </div>
  </Card>

  {#if tags.length}
    <Card title="Etichette: eventi e viaggi">
      {#each tags as t (t.tag)}
        <button class="tag-row" onclick={() => router.go(`/movimenti/tag/${encodeURIComponent(t.tag)}`)}>
          <span class="dr-text">
            <span class="dr-title">{t.tag}</span>
            <span class="c-3 tiny">{t.count} {t.count === 1 ? 'movimento' : 'movimenti'} · {t.first === t.last ? shortDay(t.first) : `${shortDay(t.first)} – ${shortDay(t.last)}`}</span>
          </span>
          <Amount cents={t.spent} size="sm" />
        </button>
      {/each}
    </Card>
  {/if}

  <Card title="Spese negli ultimi sei periodi">
    <ColumnChart title="Spese totali negli ultimi sei periodi" data={history} />
  </Card>

  {#if investments.length}
    <Card title="Investimenti · totale versato">
      <ColumnChart title="Totale versato negli investimenti, periodo per periodo" data={invPeriods.map((p, i) => ({ label: periodShortName(p), fullLabel: periodLabel(p), value: invTotal[i]! }))} />
    </Card>
    {#each investments as inv (inv.id)}
      {@const series = balanceSeries(inv, txs, invPeriods.map((p) => p.end))}
      {@const vals = valuationsFor(inv.id)}
      <Card title={inv.name}>
        <LineChart
          title="{inv.name}: versato e valore reale"
          labels={invPeriods.map(periodShortName)}
          series={[
            { id: 'v', name: 'Versato', color: color(inv.color), values: series },
            ...(vals.some((v) => v !== null) ? [{ id: 'r', name: 'Valore reale', color: 'var(--pk-ocra)', values: vals }] : []),
          ]}
        />
        {#if !vals.some((v) => v !== null)}<p class="c-3 small hint">Aggiungi il valore dall'app di Generali per vederlo accanto al versato.</p>{/if}
      </Card>
    {/each}
    <Button variant="secondary" block onclick={() => { valPocket = investments[0]!.id; valDate = app.today; valOpen = true; }}>
      <Plus size={18} /> Aggiungi valore reale
    </Button>
  {/if}
</div>

<BottomSheet bind:open={valOpen} title="Valore reale">
  <div class="form">
    <div class="chips">
      {#each investments as inv (inv.id)}
        <Chip label={inv.name} color={color(inv.color)} selected={valPocket === inv.id} onclick={() => (valPocket = inv.id)} />
      {/each}
    </div>
    <TextField label="Valore dall'app di Generali" inputmode="decimal" placeholder="3.250,00" bind:value={valAmount} error={valError} />
    <TextField label="Data" type="date" bind:value={valDate} />
    <Button size="lg" block onclick={saveValuation}>Salva</Button>
  </div>
</BottomSheet>

<style>
  .page {
    display: flex;
    flex-direction: column;
    gap: var(--sp-3);
    padding: calc(var(--sp-4) + env(safe-area-inset-top)) var(--gutter) var(--sp-5);
  }
  .period {
    display: flex;
    align-items: center;
    margin-top: var(--sp-2);
  }
  .period-label {
    flex: 1;
    text-align: center;
    font-weight: var(--fw-bold);
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
  .kpis {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--sp-3);
  }
  .kpi {
    padding: var(--sp-4);
    border-radius: var(--r-lg);
    background: var(--surface);
    box-shadow: var(--shadow-1), var(--card-ring);
  }
  .small {
    font-size: var(--fs-callout);
  }
  .up {
    color: var(--negative);
  }
  .down {
    color: var(--positive);
  }
  .hint {
    margin-top: var(--sp-2);
  }
  .strong {
    font-weight: var(--fw-bold);
  }
  /* Calendario piccolo e centrato, movimenti del giorno sotto (con scorrimento se sono tanti). */
  .cal-split :global(.cal) {
    max-width: 280px;
    margin: 0 auto;
  }
  .day-detail {
    margin-top: var(--sp-3);
    padding-top: var(--sp-3);
    border-top: 1px solid var(--hairline);
  }
  .day-list {
    margin-top: var(--sp-2);
    max-height: 260px;
    overflow-y: auto;
    overscroll-behavior: contain;
  }
  .day-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--sp-2);
    width: 100%;
    min-height: 48px;
    padding: var(--sp-1) 0;
    text-align: left;
    border-top: 1px solid var(--hairline);
  }
  .dr-text {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  .dr-title {
    max-width: 100%;
    font-size: var(--fs-callout);
    font-weight: var(--fw-medium);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .tiny {
    font-size: var(--fs-caption);
  }
  .tag-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--sp-2);
    width: 100%;
    min-height: 52px;
    text-align: left;
  }
  .tag-row + .tag-row {
    border-top: 1px solid var(--hairline);
  }
  .form {
    display: grid;
    gap: var(--sp-4);
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: var(--sp-2);
  }
</style>

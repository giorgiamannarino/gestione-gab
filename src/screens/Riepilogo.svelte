<!-- Riepilogo del periodo, raccontato a parole. Tutto calcolato dai dati. -->
<script lang="ts">
  import { BookOpen, ChevronLeft, ChevronRight } from '@lucide/svelte';
  import { app } from '../lib/app/store.svelte';
  import { router } from '../lib/app/router.svelte';
  import { monthName, periodLabel, shiftPeriod, parseISODate } from '../lib/domain/dates';
  import { formatCents } from '../lib/domain/money';
  import { summarize } from '../lib/domain/summary';
  import { privacy } from '../lib/ui/privacy.svelte';
  import Button from '../ui/Button.svelte';
  import Card from '../ui/Card.svelte';

  let offset = $state(0);
  const period = $derived(shiftPeriod(app.period, offset, app.data.settings.salaryDay));
  const s = $derived(summarize(app.data, period, app.today));

  const eur = (c: number) => (privacy.hidden ? '•••' : formatCents(c));
  const signed = (c: number) => (privacy.hidden ? '•••' : formatCents(c, { signed: true }));
  const pct = (x: number) => `${Math.round(x * 100)}%`;
  const day = (d: string) => {
    const { d: dd, m } = parseISODate(d);
    return `${dd} ${monthName(m)}`;
  };
  function list(items: string[]): string {
    if (items.length <= 1) return items[0] ?? '';
    return `${items.slice(0, -1).join(', ')} e ${items.at(-1)}`;
  }

  const delta = $derived(s.wealthEnd - s.wealthStart);
  const prevDiff = $derived(s.spending.prevTotal > 0 ? (s.spending.total - s.spending.prevTotal) / s.spending.prevTotal : null);
  const projection = $derived(s.isCurrent && s.daysElapsed < s.daysTotal ? s.spending.dailyAvg * s.daysTotal : null);
  const groupedTransfers = $derived.by(() => {
    const m = new Map<string, { total: number; items: string[] }>();
    for (const t of s.transfersIn) {
      const g = m.get(t.group) ?? { total: 0, items: [] };
      g.total += t.amount;
      g.items.push(`${t.name} ${eur(t.amount)}`);
      m.set(t.group, g);
    }
    return [...m];
  });
</script>

<div class="page">
  <header class="head">
    <button class="back" onclick={() => router.go('/')} aria-label="Torna alla Home"><ChevronLeft size={22} /></button>
    <h1 class="t-title-1">Riepilogo</h1>
  </header>
  <div class="period">
    <button class="nav" aria-label="Periodo precedente" onclick={() => offset--}><ChevronLeft size={20} /></button>
    <p class="period-label">{periodLabel(period)}</p>
    <button class="nav" aria-label="Periodo successivo" disabled={offset >= 0} onclick={() => offset++}><ChevronRight size={20} /></button>
  </div>
  {#if s.isCurrent}<p class="c-3 small center">Siamo al giorno {s.daysElapsed} di {s.daysTotal} del periodo.</p>{/if}

  <Card title="Patrimonio">
    <p>
      Il patrimonio è passato da <strong>{eur(s.wealthStart)}</strong> a <strong>{eur(s.wealthEnd)}</strong>:
      <strong class:pos={delta > 0} class:neg={delta < 0}>{signed(delta)}</strong>{s.isCurrent ? ' finora' : ''}.
    </p>
    {#if s.groups.length}
      <ul class="rows">
        {#each s.groups as g (g.name)}
          <li><span>{g.name}</span><span class="num">{eur(g.start)} → <strong>{eur(g.end)}</strong></span></li>
        {/each}
      </ul>
    {/if}
  </Card>

  <Card title="Entrate">
    <p>
      {#if s.salary}Lo stipendio del {day(s.salary.date)} è stato di <strong>{eur(s.salary.amount)}</strong>.
      {:else if s.isCurrent}Lo stipendio di questo periodo non è ancora stato registrato: lo inserisci dal Piano.
      {:else}In questo periodo non risulta uno stipendio.{/if}
      {#if s.otherIncome.length}
        Altre entrate: {list(s.otherIncome.map((i) => `${i.name} ${eur(i.amount)}`))}.
      {/if}
    </p>
  </Card>

  <Card title="Messo da parte">
    <p>
      {#if s.savedTotal > 0}
        Hai messo da parte <strong class="pos">{eur(s.savedTotal)}</strong>: {list(s.saved.map((x) => `${x.name} ${signed(x.amount)}`))}.
      {:else if s.savedTotal < 0}
        Da risparmi e investimenti sono usciti <strong class="neg">{eur(-s.savedTotal)}</strong>: {list(s.saved.map((x) => `${x.name} ${signed(x.amount)}`))}.
      {:else}
        In questo periodo risparmi e investimenti non sono cambiati.
      {/if}
      {#if s.roundups.count}
        In più gli arrotondamenti hanno portato <strong>{eur(s.roundups.total)}</strong> nei {s.roundups.pocket} ({s.roundups.count} {s.roundups.count === 1 ? 'volta' : 'volte'}).
      {/if}
    </p>
  </Card>

  {#if groupedTransfers.length}
    <Card title="Soldi spostati">
      {#each groupedTransfers as [group, g] (group)}
        <p class="para">Verso <strong>{group}</strong>: {eur(g.total)} ({list(g.items)}).</p>
      {/each}
    </Card>
  {/if}

  <Card title="Spese">
    {#if s.spending.count === 0}
      <p>Nessuna spesa registrata in questo periodo.</p>
    {:else}
      <p class="para">
        Hai speso <strong>{eur(s.spending.total)}</strong> in {s.spending.count} movimenti, circa <strong>{eur(s.spending.dailyAvg)}</strong> al giorno.
        {#if prevDiff !== null}
          {s.isCurrent ? 'Finora è' : 'È'} il <strong class:neg={prevDiff > 0} class:pos={prevDiff < 0}>{pct(Math.abs(prevDiff))} {prevDiff > 0 ? 'in più' : 'in meno'}</strong> del periodo precedente ({eur(s.spending.prevTotal)}).
        {/if}
        {#if projection}Se continui così, a fine periodo arriverai a circa {eur(projection)}.{/if}
      </p>
      {#if s.spending.byCategory.length}
        {@const [first, ...rest] = s.spending.byCategory}
        <p class="para">
          La categoria più pesante è <strong>{first!.name}</strong> con {eur(first!.amount)} ({pct(first!.share)}){#if rest.length}, poi {list(rest.slice(0, 3).map((c) => `${c.name} ${eur(c.amount)} (${pct(c.share)})`))}{/if}.
        </p>
      {/if}
      {#if s.spending.byPocket.length}
        <p class="para">Per pocket: {list(s.spending.byPocket.map((p) => `${p.name} ${eur(p.amount)}`))}.</p>
      {/if}
      {#if s.spending.biggest}
        <p class="para">La spesa più alta è stata <strong>{s.spending.biggest.description}</strong> da {eur(s.spending.biggest.amount)} il {day(s.spending.biggest.date)} ({s.spending.biggest.pocket}).</p>
      {/if}
      {#if s.spending.busiestDay && s.spending.busiestDay.count > 1}
        <p class="para">Il giorno più caro è stato il {day(s.spending.busiestDay.date)}: {eur(s.spending.busiestDay.amount)} in {s.spending.busiestDay.count} spese.</p>
      {/if}
      {#if s.spending.topDescriptions.length}
        <p class="para">Le voci più frequenti: {list(s.spending.topDescriptions.map((d) => `${d.description} (${d.count} volte, ${eur(d.amount)})`))}.</p>
      {/if}
    {/if}
  </Card>

  {#if s.budgets.length}
    <Card title="Budget">
      {#each s.budgets as b (b.name)}
        <p class="para">
          {b.name}: spesi <strong>{eur(b.spent)}</strong> di {eur(b.budget)}.
          {#if b.spent <= b.budget}Restano {eur(b.budget - b.spent)}.{:else}<span class="neg">Superato di {eur(b.spent - b.budget)}.</span>{/if}
        </p>
      {/each}
    </Card>
  {/if}

  {#if s.debits.confirmed.length || s.debits.pending.length}
    <Card title="Addebiti fissi">
      {#if s.debits.confirmed.length}<p class="para">Confermati: {list(s.debits.confirmed.map((d) => `${d.name} ${eur(d.amount)}`))}.</p>{/if}
      {#if s.debits.pending.length}<p class="para">Ancora da confermare: {list(s.debits.pending.map((d) => `${d.name} ${eur(d.amount)} (dal ${day(d.date)})`))}.</p>{/if}
    </Card>
  {/if}

  {#if s.investments.length}
    <Card title="Investimenti">
      {#each s.investments as i (i.id)}
        <p class="para">
          <strong>{i.name}</strong>: versato {eur(i.end)}{#if i.end !== i.start} ({signed(i.end - i.start)} nel periodo){/if}.
          {#if i.value !== undefined}
            Valore reale {eur(i.value)}, <span class:pos={i.value >= i.end} class:neg={i.value < i.end}>{signed(i.value - i.end)}</span> rispetto al versato.
          {/if}
        </p>
      {/each}
    </Card>
  {/if}

  {#if s.adjustments.count}
    <Card title="Rettifiche">
      <p>{s.adjustments.count === 1 ? "C'è stata una rettifica" : `Ci sono state ${s.adjustments.count} rettifiche`} per {signed(s.adjustments.total)} in totale. Non contano nelle statistiche di spesa.</p>
    </Card>
  {/if}

  <Button variant="secondary" size="lg" block onclick={() => router.go('/guida')}><BookOpen size={18} /> Come funziona l'app</Button>
</div>

<style>
  .page {
    display: flex;
    flex-direction: column;
    gap: var(--sp-3);
    padding: calc(var(--sp-2) + env(safe-area-inset-top)) var(--gutter) var(--sp-7);
    line-height: 1.55;
  }
  .head {
    display: flex;
    align-items: center;
    gap: var(--sp-1);
    margin-top: var(--sp-2);
  }
  .back,
  .nav {
    width: var(--tap);
    height: var(--tap);
    display: grid;
    place-items: center;
    border-radius: 50%;
    color: var(--text-2);
  }
  .back {
    margin-left: calc(-1 * var(--sp-2));
  }
  .nav:disabled {
    opacity: 0.3;
  }
  .period {
    display: flex;
    align-items: center;
  }
  .period-label {
    flex: 1;
    text-align: center;
    font-weight: var(--fw-bold);
  }
  .small {
    font-size: var(--fs-callout);
  }
  .center {
    text-align: center;
  }
  .para + .para {
    margin-top: var(--sp-2);
  }
  strong {
    font-weight: var(--fw-bold);
    font-variant-numeric: tabular-nums;
  }
  .pos {
    color: var(--positive);
  }
  .neg {
    color: var(--negative);
  }
  .rows {
    list-style: none;
    margin: var(--sp-3) 0 0;
    padding: 0;
    display: grid;
    gap: var(--sp-1);
    font-size: var(--fs-callout);
  }
  .rows li {
    display: flex;
    justify-content: space-between;
    gap: var(--sp-2);
    color: var(--text-2);
  }
  .num {
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
</style>

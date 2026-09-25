<!-- Pagina di un pocket: saldo, movimento del periodo, previsione del prossimo mese, elenco movimenti. -->
<script lang="ts">
  import { ChevronLeft, Info, Settings2 } from '@lucide/svelte';
  import { app } from '../lib/app/store.svelte';
  import { router } from '../lib/app/router.svelte';
  import { balances } from '../lib/domain/balances';
  import { addDays, monthName, parseISODate, periodLabel } from '../lib/domain/dates';
  import { formatCents } from '../lib/domain/money';
  import { forecastAllocation } from '../lib/domain/plan';
  import { pocketPeriodStats } from '../lib/domain/stats';
  import { color, icon } from '../lib/ui/icons';
  import { privacy } from '../lib/ui/privacy.svelte';
  import Amount from '../ui/Amount.svelte';
  import Button from '../ui/Button.svelte';
  import Card from '../ui/Card.svelte';
  import IconTile from '../ui/IconTile.svelte';
  import Movimenti from './Movimenti.svelte';

  const id = $derived(router.segments[1] ?? '');
  const pocket = $derived(app.data.pockets.find((p) => p.id === id));
  const period = $derived(app.period);
  const balance = $derived(app.balances.get(id) ?? 0);
  const startBalance = $derived(pocket ? (balances([pocket], app.data.transactions, addDays(period.start, -1)).get(id) ?? 0) : 0);
  const st = $derived(pocketPeriodStats(id, app.data.transactions, period));
  const allocation = $derived(app.data.recurring.find((r) => r.active && r.kind === 'allocation' && r.toPocketId === id));
  const forecast = $derived(allocation ? forecastAllocation(allocation, app.data.recurring, app.data.pockets, balance, st.taken) : null);
  const nextStart = $derived(addDays(period.end, 1));
  const eur = (c: number) => (privacy.hidden ? '•••' : formatCents(c));
  const dayLabel = (d: string) => `${parseISODate(d).d} ${monthName(parseISODate(d).m)}`;
</script>

{#if !pocket}
  <div class="page">
    <p class="c-3">Pocket non trovato.</p>
    <Button variant="secondary" onclick={() => router.go('/')}>Torna alla Home</Button>
  </div>
{:else}
  <div class="page">
    <header class="head">
      <button class="back" onclick={() => router.back('/')} aria-label="Indietro"><ChevronLeft size={22} /></button>
      <IconTile icon={icon(pocket.icon)} color={color(pocket.color)} />
      <div class="title">
        <h1 class="t-title-2">{pocket.name}</h1>
        <p class="c-3 small">{app.data.groups.find((g) => g.id === pocket.groupId)?.name}{pocket.isRevolut ? ' · Revolut' : ''}</p>
      </div>
    </header>

    <section class="hero" aria-label="Saldo">
      <p class="label">Saldo attuale</p>
      <Amount cents={balance} size="display" splitDecimals />
      <p class="c-3 small">Periodo {periodLabel(period)}</p>
    </section>

    <div class="kpis">
      <div class="kpi"><span class="k">A inizio periodo</span><Amount cents={startBalance} /></div>
      <div class="kpi"><span class="k">Speso finora</span><Amount cents={st.spent} /></div>
      <div class="kpi"><span class="k">Entrato</span><Amount cents={st.received} /></div>
      <div class="kpi"><span class="k">Spostato altrove</span><Amount cents={st.movedOut} /></div>
    </div>
    {#if st.adjusted}<p class="c-3 small">Rettifiche nel periodo: {formatCents(st.adjusted, { signed: true })}.</p>{/if}

    {#if pocket.isRevolut && forecast && allocation}
      <Card title="Previsione per il {dayLabel(nextStart)}">
        <p class="forecast"><Amount cents={forecast.amount} size="lg" /> <span class="c-3 small">da spostare su {pocket.name}</span></p>
        <p class="why">
          {#if forecast.mode === 'topUp'}
            <strong>Ricarica fino a {eur(forecast.target)}.</strong> Oggi sul pocket ci sono {eur(balance)},
            {#if forecast.amount === 0}quindi è già a posto: non servirà spostare nulla.{:else}quindi mancano {eur(forecast.amount)}.{/if}
            Se spendi ancora prima del {dayLabel(nextStart)}, la cifra sale.
          {:else if forecast.mode === 'reserve'}
            <strong>Riserva da {eur(forecast.target)}.</strong>
            {#if forecast.taken === 0}
              Finora non è uscito nulla: se resta così, sposterai metà dell'importo ({eur(forecast.amount)}).
            {:else if forecast.taken < forecast.target}
              Finora sono usciti {eur(forecast.taken)}: sposterai quanto preso più {eur(forecast.extra)}, cioè {eur(forecast.amount)}.
            {:else}
              Finora sono usciti {eur(forecast.taken)}, almeno quanto l'importo: sposterai esattamente quanto preso.
            {/if}
          {:else}
            <strong>Importo pieno.</strong> Ogni mese si spostano {eur(forecast.target)}, qualunque cosa sia rimasta.
          {/if}
        </p>
        <p class="disclaimer">
          <Info size={14} strokeWidth={2} />
          <span>È una stima con i dati di oggi. La regola di "{allocation.name}" si cambia in Impostazioni → Spese fisse: pieno, ricarica (solo quanto manca) o riserva (metà se non hai preso nulla, altrimenti quanto preso più un extra).</span>
        </p>
        <Button variant="ghost" onclick={() => router.go('/impostazioni/fissi')}><Settings2 size={16} /> Modifica la regola</Button>
      </Card>
    {/if}

    <Movimenti fixedPocket={id} />
  </div>
{/if}

<style>
  .page {
    display: flex;
    flex-direction: column;
    gap: var(--sp-3);
    padding: calc(var(--sp-2) + env(safe-area-inset-top)) var(--gutter) var(--sp-5);
  }
  .head {
    display: flex;
    align-items: center;
    gap: var(--sp-3);
    margin-top: var(--sp-2);
  }
  .back {
    width: var(--tap);
    height: var(--tap);
    margin: 0 calc(-1 * var(--sp-2));
    display: grid;
    place-items: center;
    border-radius: 50%;
  }
  .title {
    min-width: 0;
  }
  .small {
    font-size: var(--fs-callout);
  }
  .hero {
    padding: var(--sp-5);
    border-radius: var(--r-lg);
    background: var(--hero-bg);
    box-shadow: var(--shadow-1), var(--card-ring);
  }
  .label {
    font-size: var(--fs-callout);
    color: var(--text-3);
    font-weight: var(--fw-medium);
    margin-bottom: var(--sp-1);
  }
  .kpis {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--sp-2);
  }
  .kpi {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: var(--sp-3) var(--sp-4);
    border-radius: var(--r-md);
    background: var(--surface);
    box-shadow: var(--shadow-1), var(--card-ring);
  }
  .k {
    font-size: var(--fs-caption);
    color: var(--text-3);
    font-weight: var(--fw-medium);
  }
  .forecast {
    display: flex;
    align-items: baseline;
    gap: var(--sp-2);
    flex-wrap: wrap;
  }
  .why {
    margin-top: var(--sp-2);
    color: var(--text-2);
    line-height: 1.55;
  }
  .why strong {
    color: var(--text);
  }
  .disclaimer {
    display: flex;
    gap: var(--sp-2);
    margin-top: var(--sp-3);
    padding: var(--sp-3);
    border-radius: var(--r-sm);
    background: var(--surface-2);
    font-size: var(--fs-caption);
    color: var(--text-3);
    line-height: 1.45;
  }
  .disclaimer :global(svg) {
    flex: none;
    margin-top: 2px;
  }
</style>

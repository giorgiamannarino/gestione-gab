<!--
  Calendario del periodo con heatmap delle spese: più scuro = più speso.
  Una sola tonalità (scala sequenziale), con legenda; tocca un giorno per i dettagli.
-->
<script lang="ts">
  import { addDays, formatLongDate, parseISODate } from '../../lib/domain/dates';
  import type { Period } from '../../lib/domain/dates';
  import { formatCents } from '../../lib/domain/money';
  import type { ISODate } from '../../lib/domain/types';
  import { privacy } from '../../lib/ui/privacy.svelte';

  interface Props {
    period: Period;
    days: Map<ISODate, { amount: number; count: number }>;
    today: ISODate;
    selected?: ISODate | null;
    onselect?: (date: ISODate | null) => void;
  }

  let { period, days, today, selected = null, onselect }: Props = $props();

  const WEEKDAYS = ['L', 'M', 'M', 'G', 'V', 'S', 'D'];
  const LEVELS = [0, 14, 32, 55, 85]; // % di colore per livello

  const cells = $derived.by(() => {
    const list: ISODate[] = [];
    for (let d = period.start; d <= period.end; d = addDays(d, 1)) list.push(d);
    const { y, m, d } = parseISODate(period.start);
    const lead = (new Date(y, m - 1, d).getDay() + 6) % 7; // lunedì = 0
    return { lead, list };
  });
  const max = $derived(Math.max(1, ...[...days.values()].map((v) => v.amount)));

  function level(amount: number): number {
    if (amount <= 0) return 0;
    return Math.min(4, Math.max(1, Math.ceil((amount / max) * 4)));
  }
  const label = (d: ISODate) => {
    const v = days.get(d);
    const money = privacy.hidden ? 'importo nascosto' : v ? formatCents(v.amount) : 'nessuna spesa';
    return `${formatLongDate(d)}: ${money}${v ? `, ${v.count} ${v.count === 1 ? 'spesa' : 'spese'}` : ''}`;
  };
</script>

<div class="cal">
  <div class="grid" role="grid" aria-label="Spese giorno per giorno">
    {#each WEEKDAYS as w, i (i)}<span class="wd" aria-hidden="true">{w}</span>{/each}
    {#each Array(cells.lead) as _, i (`b${i}`)}<span></span>{/each}
    {#each cells.list as d (d)}
      {@const v = days.get(d)}
      {@const lv = level(v?.amount ?? 0)}
      <button
        class="day lv{lv}"
        class:future={d > today}
        class:today={d === today}
        class:sel={selected === d}
        style:--p="{LEVELS[lv]}%"
        aria-label={label(d)}
        aria-pressed={selected === d}
        disabled={d > today}
        onclick={() => onselect?.(selected === d ? null : d)}
      >
        {parseISODate(d).d}
      </button>
    {/each}
  </div>
  <div class="legend" aria-hidden="true">
    <span>meno</span>
    {#each LEVELS.slice(1) as p, i (i)}<span class="sw" style:--p="{p}%"></span>{/each}
    <span>più</span>
  </div>
</div>

<style>
  .cal {
    width: 100%;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 3px;
  }
  .wd {
    text-align: center;
    font-size: var(--fs-caption);
    font-weight: var(--fw-bold);
    color: var(--text-3);
    padding-bottom: 2px;
  }
  .day {
    aspect-ratio: 1;
    border-radius: var(--r-xs);
    font-size: var(--fs-caption);
    font-weight: var(--fw-medium);
    font-variant-numeric: tabular-nums;
    color: var(--text);
    background: color-mix(in srgb, var(--accent-ink) var(--p), var(--surface-2));
    transition: transform var(--dur-fast) var(--ease-out);
  }
  .day:active {
    transform: scale(0.94);
  }
  /* Testo leggibile sulla cella più intensa (contrasto AA verificato in chiaro e scuro). */
  .lv4 {
    color: var(--heat-strong-text);
    font-weight: var(--fw-bold);
  }
  .today {
    box-shadow: inset 0 0 0 2px var(--text-3);
  }
  .sel {
    box-shadow: inset 0 0 0 2.5px var(--text);
  }
  .future {
    background: transparent;
    box-shadow: inset 0 0 0 1px var(--hairline);
    color: var(--text-3);
  }
  .legend {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 4px;
    margin-top: var(--sp-2);
    font-size: var(--fs-caption);
    color: var(--text-3);
  }
  .sw {
    width: 12px;
    height: 12px;
    border-radius: 4px;
    background: color-mix(in srgb, var(--accent-ink) var(--p), var(--surface-2));
  }
</style>

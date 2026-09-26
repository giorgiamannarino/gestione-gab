<!-- Dettaglio di una voce della checklist del Piano: cosa si sposta, perché quell'importo, cosa c'era già, cosa è stato fatto. -->
<script lang="ts">
  import { ArrowRight } from '@lucide/svelte';
  import { app } from '../../lib/app/store.svelte';
  import { router } from '../../lib/app/router.svelte';
  import { monthName } from '../../lib/domain/dates';
  import { formatCents } from '../../lib/domain/money';
  import type { PlanLine } from '../../lib/domain/plan';
  import type { ISODate, Transaction } from '../../lib/domain/types';
  import { color, icon } from '../../lib/ui/icons';
  import { privacy } from '../../lib/ui/privacy.svelte';
  import Amount from '../../ui/Amount.svelte';
  import BottomSheet from '../../ui/BottomSheet.svelte';
  import Button from '../../ui/Button.svelte';
  import IconTile from '../../ui/IconTile.svelte';

  interface Props {
    line: PlanLine | null;
    onclose: () => void;
  }
  let { line, onclose }: Props = $props();

  const eur = (c: number) => (privacy.hidden ? '•••' : formatCents(c));
  const day = (d: ISODate) => `${Number(d.slice(8))} ${monthName(Number(d.slice(5, 7)))}`;
  const dayYear = (d: ISODate) => `${day(d)} ${d.slice(0, 4)}`;
  const pocket = (id?: string) => app.data.pockets.find((p) => p.id === id);
  const into = (t: Transaction, pocketId?: string) => t.legs.find((l) => l.pocketId === pocketId && l.amount > 0)?.amount ?? 0;

  const d = $derived.by(() => {
    if (!line) return null;
    const l = line;
    const st = app.planStatus(l);
    const moved = app.planMoved(l);
    const rec = app.data.recurring.find((r) => r.id === l.recurringId);
    const own = l.dueDate ? app.deadlineOfLine(l.recurringId) : undefined;
    const deadlines = [...(l.covers ?? []), ...(own ? [l] : [])].map((c) => {
      const dl = app.deadlineOfLine(c.recurringId);
      const saved = dl ? app.deadlineSaved(dl).before : 0;
      return { line: c, total: dl?.amount ?? 0, saved };
    });
    const manualAmount = moved.found.reduce((a, t) => a + into(t, l.toPocketId), 0);
    const planAmount = moved.planTx ? into(moved.planTx, l.toPocketId) : 0;
    return {
      l, st, moved, rec, deadlines, manualAmount, planAmount,
      from: pocket(l.fromPocketId), to: pocket(l.toPocketId),
      before: app.balancesBeforeSalary.get(l.toPocketId ?? '') ?? 0,
      now: app.balances.get(l.toPocketId ?? '') ?? 0,
      base: l.base ?? l.amount,
      coversSum: (l.covers ?? []).reduce((a, c) => a + c.amount, 0),
    };
  });

  const action = $derived.by(() => {
    if (!d) return null;
    const rest = d.l.amount - (d.st === 'partial' ? d.moved.manualAmount : 0);
    switch (d.st) {
      case 'auto': return { label: 'Togli la spunta', hint: 'Cancella il giroconto creato dalla spunta.', variant: 'secondary' as const };
      case 'manual': return { label: 'Togli la spunta', hint: 'Il giroconto dai Movimenti resta, ma non conta più per questa voce.', variant: 'secondary' as const };
      case 'ignored': return { label: 'Conta di nuovo il giroconto', hint: 'Non crea un nuovo giroconto.', variant: 'primary' as const };
      case 'partial': return { label: `Spunta: sposta i ${eur(rest)} che mancano`, hint: 'Registra un giroconto per la differenza.', variant: 'primary' as const };
      default:
        return d.l.amount > 0
          ? { label: `Spunta: segna ${eur(d.l.amount)} come spostati`, hint: "Registra il giroconto nell'app: in banca lo fai tu.", variant: 'primary' as const }
          : null;
    }
  });

  async function act() {
    if (!line) return;
    await app.togglePlanTransfer(line, app.today);
  }
</script>

<BottomSheet open={!!line} title={line?.name ?? ''} {onclose}>
  {#if d}
    <div class="sheet">
      <!-- Cosa si sposta -->
      <div class="move">
        {#if d.from}<IconTile icon={icon(d.from.icon)} color={color(d.from.color)} size="sm" />{/if}
        <span class="c-2">{d.from?.name}</span>
        <ArrowRight size={16} class="arrow" />
        {#if d.to}<IconTile icon={icon(d.to.icon)} color={color(d.to.color)} size="sm" />{/if}
        <span class="c-2">{d.to?.name}</span>
        <span class="grow"></span>
        <Amount cents={d.l.amount} size="lg" />
      </div>

      <p class="state" class:done={d.st === 'auto' || d.st === 'manual'} class:warn={d.st === 'partial'}>
        {#if d.st === 'auto'}
          Spuntata: {eur(d.l.amount)} risultano spostati{#if d.manualAmount}{' '}({eur(d.manualAmount)} con un giroconto dai Movimenti e {eur(d.planAmount)} con la spunta){/if}.
        {:else if d.st === 'manual'}
          Fatta con un giroconto dai Movimenti: spostati {eur(d.manualAmount)}.
        {:else if d.st === 'partial'}
          Spostati finora {eur(d.manualAmount)} con un giroconto dai Movimenti: ne mancano {eur(d.l.amount - d.manualAmount)}.
        {:else if d.st === 'ignored'}
          C'è un giroconto dai Movimenti di {eur(d.manualAmount)}, ma hai tolto la spunta: per questa voce non conta.
        {:else if d.l.amount === 0}
          Non serve spostare nulla in questo periodo.
        {:else}
          Non ancora spostato.
        {/if}
      </p>

      <!-- Perché questo importo -->
      <section>
        <h3 class="flabel">Come è calcolato</h3>
        <p class="c-2 small">
          {#if d.l.dueDate && !d.l.covers}
            È l'accantonamento per una scadenza: quello che manca, diviso gli stipendi che restano prima della data.
          {:else if d.rec?.amountFromDebits}
            È la somma degli abbonamenti addebitati su {d.to?.name}, più i loro arrotondamenti: {eur(d.l.target)}.
          {:else if d.l.mode === 'topUp'}
            <strong>Ricarica.</strong> {d.to?.name} deve avere {eur(d.l.target)} a inizio periodo. Prima dello stipendio c'erano {eur(d.l.remaining ?? 0)},
            {#if (d.l.remaining ?? 0) >= d.l.target}quindi non serve aggiungere nulla.{:else}quindi si sposta solo quello che manca: {eur(d.l.target)} − {eur(d.l.remaining ?? 0)} = {eur(d.base)}.{/if}
          {:else if d.l.mode === 'reserve'}
            <strong>Riserva.</strong> Budget {eur(d.l.target)}. Nel periodo prima da {d.to?.name} sono usciti {eur(d.l.taken ?? 0)}:
            {#if (d.l.taken ?? 0) === 0}non hai preso nulla, quindi si sposta metà del budget ({eur(d.base)}).
            {:else if (d.l.taken ?? 0) < d.l.target}hai preso meno del budget, quindi si rimette quanto preso più un extra: {eur(d.l.taken ?? 0)} + {eur(d.base - (d.l.taken ?? 0))} = {eur(d.base)}.
            {:else}hai preso almeno il budget, quindi si rimette quanto preso: {eur(d.base)}.{/if}
          {:else}
            <strong>Importo pieno.</strong> A ogni stipendio si spostano {eur(d.l.target)}, qualunque cosa sia rimasta sul pocket.
          {/if}
        </p>
        {#if d.l.covers}
          <p class="c-2 small top">
            Su {d.to?.name} accantoni anche delle scadenze, che in questo periodo chiedono {eur(d.coversSum)}.
            Si sposta il più alto tra la regola del pocket ({eur(d.base)}) e le scadenze ({eur(d.coversSum)}), senza sommarli:
            <strong>{eur(d.l.amount)}</strong>{d.coversSum > d.base ? ', per le scadenze.' : ': le scadenze stanno dentro il budget.'}
          </p>
        {/if}
      </section>

      {#if d.deadlines.length}
        <section>
          <h3 class="flabel">{d.deadlines.length === 1 ? 'Scadenza' : 'Scadenze'}</h3>
          {#each d.deadlines as x (x.line.recurringId)}
            <div class="row">
              <span class="grow">
                <span class="strong">{x.line.name}</span>
                <span class="c-3 small block">
                  scade il {dayYear(x.line.dueDate ?? '')} · totale {eur(x.total)} · messi da parte prima di questo stipendio {eur(x.saved)} ·
                  {x.line.paydays === 1 ? 'ultimo stipendio per accantonare' : `${x.line.paydays} stipendi per accantonare, questo compreso`}
                </span>
              </span>
              <span class="right"><span class="c-3 small block">quota</span><Amount cents={x.line.amount} size="sm" /></span>
            </div>
          {/each}
        </section>
      {/if}

      <!-- Cosa c'era già -->
      {#if d.to}
        <section>
          <h3 class="flabel">Saldo di {d.to.name}</h3>
          <div class="row"><span class="grow c-2">Prima dello stipendio (rimasti dal periodo prima)</span><Amount cents={d.before} size="sm" /></div>
          <div class="row"><span class="grow c-2">Adesso</span><Amount cents={d.now} size="sm" /></div>
        </section>
      {/if}

      <!-- Giroconti del periodo -->
      {#if d.moved.planTx || d.moved.found.length}
        <section>
          <h3 class="flabel">Giroconti di questo periodo verso {d.to?.name}</h3>
          {#each d.moved.found as t (t.id)}
            <div class="row">
              <span class="grow">
                <span>{t.description}</span>
                <span class="c-3 small block">{day(t.date)} · dai Movimenti{d.st === 'ignored' ? ' · non contato' : ''}</span>
              </span>
              <Amount cents={into(t, d.l.toPocketId)} size="sm" tone={d.st === 'ignored' ? 'muted' : 'default'} />
            </div>
          {/each}
          {#if d.moved.planTx}
            <div class="row">
              <span class="grow">
                <span>{d.moved.planTx.description}</span>
                <span class="c-3 small block">{day(d.moved.planTx.date)} · con la spunta</span>
              </span>
              <Amount cents={d.planAmount} size="sm" />
            </div>
          {/if}
        </section>
      {/if}

      <div class="actions">
        {#if action}
          <Button variant={action.variant} size="lg" block onclick={act}>{action.label}</Button>
          <p class="c-3 small center">{action.hint}</p>
        {/if}
        <div class="links">
          {#if d.to}<Button variant="ghost" onclick={() => { onclose(); router.go(`/pocket/${d.to!.id}`); }}>Apri {d.to.name}</Button>{/if}
          {#if d.rec}
            <Button variant="ghost" onclick={() => { onclose(); router.go('/impostazioni/fissi'); }}>Modifica la regola</Button>
          {:else if d.deadlines.length}
            <Button variant="ghost" onclick={() => { onclose(); router.go('/impostazioni/fissi'); }}>Modifica le scadenze</Button>
          {/if}
        </div>
      </div>
    </div>
  {/if}
</BottomSheet>

<style>
  .sheet {
    display: grid;
    gap: var(--sp-4);
  }
  .move {
    display: flex;
    align-items: center;
    gap: var(--sp-2);
    flex-wrap: wrap;
  }
  .move :global(.arrow) {
    color: var(--text-3);
  }
  .grow {
    flex: 1;
    min-width: 0;
  }
  .state {
    padding: var(--sp-3);
    border-radius: var(--r-md);
    background: var(--surface-2);
    font-size: var(--fs-callout);
    color: var(--text-2);
  }
  .state.done {
    color: var(--positive);
  }
  .state.warn {
    color: var(--warning);
    background: var(--warning-fill);
  }
  section {
    display: grid;
    gap: var(--sp-2);
  }
  .flabel {
    font-size: var(--fs-caption);
    font-weight: var(--fw-bold);
    color: var(--text-3);
  }
  .small {
    font-size: var(--fs-callout);
  }
  .top {
    margin-top: var(--sp-1);
  }
  .strong {
    font-weight: var(--fw-bold);
  }
  .block {
    display: block;
  }
  .row {
    display: flex;
    align-items: center;
    gap: var(--sp-3);
    font-variant-numeric: tabular-nums;
  }
  .right {
    text-align: right;
  }
  .actions {
    display: grid;
    gap: var(--sp-2);
  }
  .center {
    text-align: center;
  }
  .links {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: var(--sp-2);
  }
</style>

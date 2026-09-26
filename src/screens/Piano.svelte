<script lang="ts">
  import { Check, CircleCheck, CloudUpload, Lock, PiggyBank } from '@lucide/svelte';
  import { app } from '../lib/app/store.svelte';
  import { router } from '../lib/app/router.svelte';
  import { euroInputError, formatCents, parseEuroInput } from '../lib/domain/money';
  import { monthName, periodLabel } from '../lib/domain/dates';
  import type { Id } from '../lib/domain/types';
  import type { PlanLine } from '../lib/domain/plan';
  import { billShortfall } from '../lib/domain/stats';
  import { color, icon } from '../lib/ui/icons';
  import { privacy } from '../lib/ui/privacy.svelte';
  import Amount from '../ui/Amount.svelte';
  import Button from '../ui/Button.svelte';
  import Card from '../ui/Card.svelte';
  import IconTile from '../ui/IconTile.svelte';
  import InlineMessage from '../ui/InlineMessage.svelte';
  import TextField from '../ui/TextField.svelte';

  const key = $derived(app.period.key);
  const salaryTx = $derived(app.salaryTx);
  // Stipendio inserito fuori dal Piano (importato o a mano): gli spostamenti del mese sono già fatti,
  // quindi "Metti da parte" e "Avanzo del periodo precedente" non servono.
  const salaryFromPlan = $derived(!!salaryTx?.autoKey?.startsWith('salary:'));
  const salary = $derived(salaryTx ? salaryTx.legs.reduce((a, l) => a + l.amount, 0) : 0);
  const plan = $derived(app.planFor(salary));
  const pocket = (id?: Id) => app.data.pockets.find((p) => p.id === id);
  const status = (l: PlanLine) => app.planStatus(l);
  // Fatta: spuntata o fatta per intero con un giroconto. "partial" resta da completare.
  const isDone = (l: PlanLine) => {
    const st = status(l);
    return st === 'auto' || st === 'manual';
  };
  const done = (recurringId: Id) => {
    const l = [...plan.revolut, ...plan.others, ...plan.deadlines].find((x) => x.recurringId === recurringId);
    return l ? isDone(l) : !!app.txByKey(`plan:${recurringId}:${key}`);
  };

  let salaryInput = $state('');
  let salaryError = $state('');
  let savingInput = $state('');
  // Bollette attese in questo periodo: solo informazione. L'accantonamento è già nei fissi e
  // l'eventuale differenza, al pagamento, arriva dai Risparmi: non va tolta anche dalla proposta.
  const billsPocket = $derived(app.data.pockets.find((p) => p.role === 'bills' && !p.archived));
  const billInfo = $derived.by(() => {
    const bill = app.billThisPeriod;
    if (!bill || !billsPocket) return null;
    // Solo i soldi messi da parte per queste bollette. Se sono in ritardo (periodo successivo),
    // l'accantonamento di questo mese è per le bollette seguenti e non si conta.
    const fund = bill.available;
    const line = plan.others.find((l) => l.toPocketId === billsPocket.id);
    const allocation = !bill.late && line && !isDone(line) ? line.amount : 0; // se già spostato è già nel fondo
    return { estimate: bill.estimate, fund, allocation, late: bill.late, shortfall: billShortfall(fund, allocation, bill.estimate) };
  });
  const proposal = $derived(plan.saveable);
  // Vuoto = la proposta.
  const savingError = $derived(euroInputError(savingInput, { optional: true }));
  const saveAmount = $derived(savingError ? 0 : (parseEuroInput(savingInput) ?? proposal));
  const savedTx = $derived(app.txByKey(`plan:save:${key}`));
  const leftoverTx = $derived(app.txByKey(`plan:leftover:${key}`));
  const checklistDone = $derived([...plan.revolut, ...plan.others, ...plan.deadlines].every((l) => done(l.recurringId)));
  const eur = (c: number) => (privacy.hidden ? '•••' : formatCents(c));

  async function registerSalary() {
    const cents = parseEuroInput(salaryInput);
    salaryError = euroInputError(salaryInput);
    if (salaryError || !cents) return;
    salaryError = '';
    await app.registerSalary(cents, app.today);
    salaryInput = '';
  }

  async function moveToSavings(amount: number, id: 'save' | 'leftover', label: string) {
    const main = app.mainPocket;
    const target = app.savingsTarget;
    if (!main || !target || amount <= 0) return;
    const existing = app.txByKey(`plan:${id}:${key}`);
    if (existing) return app.deleteTx(existing.id, 'Spostamento annullato');
    await app.saveEntry({ kind: 'transfer', date: app.today, amount, fromPocketId: main.id, splits: [{ pocketId: target.id, amount }], description: label, categoryId: 'sys-transfer', source: 'plan', autoKey: `plan:${id}:${key}` });
  }
</script>

<div class="page">
  <header class="head">
    <h1 class="t-title-1">Piano</h1>
    <p class="c-3">{periodLabel(app.period)}</p>
  </header>

  {#if !app.mainPocket}
    <InlineMessage tone="warning">Manca il conto principale: impostalo nei pocket.</InlineMessage>
  {:else if !salaryTx}
    <Card>
      <h2 class="t-title-3">È arrivato lo stipendio?</h2>
      <p class="c-2 small">Inserisci l'importo di questo mese. Registro l'entrata su {app.mainPocket.name} e, da soli, gli spostamenti automatici.</p>
      <div class="salary-form">
        <TextField label="Stipendio" inputmode="decimal" placeholder="2.345,00" bind:value={salaryInput} error={salaryError} enterkeyhint="done" onkeydown={(e) => e.key === 'Enter' && registerSalary()} />
        <Button size="lg" block onclick={registerSalary}>Registra stipendio</Button>
      </div>
    </Card>
    <p class="c-3 small center">Dopo lo stipendio qui trovi la checklist di cosa spostare dove.</p>
  {:else}
    <section class="summary" aria-label="Riepilogo">
      <!-- Come uno scontrino: stipendio, meno fissi e margine, uguale risparmio. -->
      <div class="sum-row"><span class="c-2">Stipendio</span><Amount cents={salary} /></div>
      <div class="sum-row"><span class="c-2"><span class="op">−</span>Fissi e pocket</span><Amount cents={plan.fixedTotal} /></div>
      {#if plan.marginFromSalary}
        <div class="sum-row"><span class="c-2"><span class="op">−</span>Margine di sicurezza</span><Amount cents={plan.marginFromSalary} /></div>
      {/if}
      <div class="sum-row total"><span><span class="op">=</span>Puoi mettere da parte</span><Amount cents={proposal} size="lg" /></div>
      <p class="sr-only-sentence c-3 small">
        Stipendio {eur(salary)} → fissi e pocket {eur(plan.fixedTotal)}{plan.marginFromSalary ? ` → margine ${eur(plan.marginFromSalary)}` : ''} → puoi mettere da parte {eur(proposal)}
      </p>
    </section>
    <p class="c-3 small note">
      {#if app.savingsTarget && salaryFromPlan}
        La stima di risparmio è un consiglio: puoi accettarla in fondo alla pagina oppure scegliere tu quando mettere da parte, facendo a mano un giroconto dai Movimenti.
      {:else}
        La stima di risparmio è un consiglio: scegli tu quando mettere da parte, facendo a mano un giroconto dai Movimenti.
      {/if}
    </p>

    {#if plan.auto.length}
      <Card title="Già fatto in automatico">
        {#each plan.auto as l (l.recurringId)}
          {@const to = pocket(l.toPocketId)}
          <div class="line">
            <span class="tick on" aria-hidden="true"><Check size={14} strokeWidth={3} /></span>
            <span class="lname">{l.name}<span class="c-3 small"> · {pocket(l.fromPocketId)?.name} → {to?.name}</span></span>
            <Amount cents={l.amount} />
          </div>
        {/each}
      </Card>
    {/if}

    {#if plan.revolut.length || plan.others.length || plan.deadlines.length}
      <p class="c-2 small note">
        Indipendentemente da quanto decidi di mettere da parte, segna qui sotto tutti gli spostamenti verso i tuoi pocket.
        Spuntando una voce non paghi nulla: registri solo la ripartizione.
      </p>
    {/if}

    {#if plan.revolut.length}
      <Card title="Da spostare su Revolut">
        {#snippet aside()}<Amount cents={plan.revolutTotal} />{/snippet}
        {#each plan.revolut as l (l.recurringId)}
          {@render check(l)}
        {/each}
      </Card>
    {/if}

    {#if plan.others.length}
      <Card title="Da spostare su Risparmi">
        {#each plan.others as l (l.recurringId)}
          {@render check(l)}
        {/each}
      </Card>
    {/if}

    {#if plan.deadlines.length}
      <Card title="Scadenze">
        {#each plan.deadlines as l (l.recurringId)}
          {@render check(l)}
        {/each}
      </Card>
    {/if}

    {#if plan.keep.length}
      <Card title="Resta su {app.mainPocket.name}">
        {#each plan.keep as l (l.recurringId)}
          <div class="line">
            <Lock size={16} strokeWidth={1.75} class="lock" />
            <span class="lname">{l.name}</span>
            <Amount cents={l.amount} tone="muted" />
          </div>
        {/each}
        {#if plan.safetyMargin}
          <div class="line">
            <Lock size={16} strokeWidth={1.75} class="lock" />
            <span class="lname">
              Margine di sicurezza
              {#if plan.marginFromLeftover}
                <span class="topup">{eur(plan.marginFromLeftover)} già rimasti dal periodo prima{plan.marginFromSalary ? `, ${eur(plan.marginFromSalary)} dallo stipendio` : ': nulla dallo stipendio'}</span>
              {/if}
            </span>
            <Amount cents={plan.safetyMargin} tone="muted" />
          </div>
        {/if}
      </Card>
    {/if}

    {#if billInfo}
      <Card title="Bollette attese in questo periodo">
        <p class="c-2 small">
          {#if billInfo.late}Le bollette del periodo scorso non sono ancora uscite.{/if}
          Stima {eur(billInfo.estimate)}. Messi da parte per queste bollette: {eur(billInfo.fund)}{billInfo.allocation ? `, e con l'accantonamento del mese si arriva a ${eur(billInfo.fund + billInfo.allocation)}` : ''}.
          {#if billInfo.late}L'accantonamento di questo mese resta per le bollette successive.{/if}
          {#if billInfo.shortfall > 0}
            Mancheranno circa <strong>{eur(billInfo.shortfall)}</strong>, che al pagamento verranno presi da {app.savingsTarget?.name ?? 'Risparmi'}.
          {:else}
            Il fondo basta.
          {/if}
        </p>
      </Card>
    {/if}

    {#if app.savingsTarget && salaryFromPlan}
      <Card title="Metti da parte">
        <p class="c-2 small">
          Proposta: sposta su {app.savingsTarget.name} quello che avanza dopo fissi e pocket.
        </p>
        {#if savedTx}
          <div class="done-box"><CircleCheck size={18} /> Spostati <Amount cents={savedTx.legs[1]?.amount ?? 0} /> su {app.savingsTarget.name}</div>
          <Button variant="ghost" onclick={() => moveToSavings(0, 'save', '')}>Annulla lo spostamento</Button>
        {:else}
          <div class="salary-form">
            <TextField label="Importo" inputmode="decimal" placeholder={formatCents(proposal, { symbol: false })} bind:value={savingInput} error={savingError} hint="Lascia vuoto per usare la proposta." />
            <Button size="lg" block disabled={saveAmount <= 0} onclick={() => moveToSavings(saveAmount, 'save', 'Risparmio del mese')}>
              <PiggyBank size={18} /> Sposta {eur(saveAmount)}
            </Button>
          </div>
        {/if}
      </Card>

      {#if plan.leftoverExcess > 0 || leftoverTx}
        <Card title="Avanzo del periodo precedente">
          <p class="c-2 small">
            Prima dello stipendio su {app.mainPocket.name} erano rimasti {eur(plan.leftover)}.
            {#if plan.marginFromLeftover}{eur(plan.marginFromLeftover)} restano come margine di sicurezza; gli altri {eur(plan.leftoverExcess)} puoi aggiungerli al risparmio.{:else}Vuoi aggiungerli al risparmio?{/if}
          </p>
          <div class="btn-row">
            <Button variant={leftoverTx ? 'ghost' : 'secondary'} onclick={() => moveToSavings(plan.leftoverExcess, 'leftover', 'Avanzo del periodo')}>
              {leftoverTx ? 'Annulla' : `Aggiungi ${eur(plan.leftoverExcess)}`}
            </Button>
          </div>
        </Card>
      {/if}
    {/if}

    {#if app.deadlineRecap.length}
      <Card title="Riepilogo scadenze">
        {#each app.deadlineRecap as r (r.deadline.id)}
          {@const d = r.deadline}
          <div class="dl">
            <div class="dl-row">
              <span class="lname">{d.name}</span>
              <Amount cents={d.amount} />
            </div>
            <p class="c-3 small">
              {Number(d.dueDate.slice(8))} {monthName(Number(d.dueDate.slice(5, 7)))} {d.dueDate.slice(0, 4)} · {r.daysLeft > 1 ? `tra ${r.daysLeft} giorni` : r.daysLeft === 1 ? 'domani' : r.daysLeft === 0 ? 'oggi' : `scaduta da ${-r.daysLeft} giorni`}{r.paydays > 0 && r.missing > 0 ? ` · ${r.paydays} ${r.paydays === 1 ? 'stipendio' : 'stipendi'} per accantonare, questo compreso` : ''}
            </p>
            <div class="bar" role="progressbar" aria-label="Accantonato per {d.name}" aria-valuemin={0} aria-valuemax={d.amount} aria-valuenow={r.saved}>
              <span style:width="{Math.round((r.saved / d.amount) * 100)}%"></span>
            </div>
            <p class="small dl-nums">
              <span>Messi da parte <strong>{eur(r.saved)}</strong></span>
              <span>{r.missing > 0 ? 'Mancano' : 'Completa'} {#if r.missing > 0}<strong>{eur(r.missing)}</strong>{/if}</span>
            </p>
          </div>
        {/each}
      </Card>
    {/if}

    <Card>
      <div class="backup">
        <IconTile icon={CloudUpload} color="var(--accent-ink)" />
        <div class="grow">
          <p class="lname">{checklistDone ? 'Tutto fatto. Salva il backup' : 'A fine piano, salva il backup'}</p>
          <p class="c-3 small">Un tocco, su iCloud Drive o dove preferisci.</p>
        </div>
        <Button variant="secondary" onclick={() => router.go('/impostazioni/backup')}>Backup</Button>
      </div>
    </Card>
  {/if}
</div>

{#snippet check(l: PlanLine)}
  {@const st = status(l)}
  {@const full = l.mode === 'topUp' && l.amount === 0}
  {@const ok = st === 'auto' || st === 'manual' || full}
  {@const moved = st === 'partial' || (st === 'auto' && l.covers) ? app.planMoved(l).manualAmount : 0}
  {@const to = pocket(l.toPocketId)}
  <button class="line check" class:ok disabled={full} onclick={() => app.togglePlanTransfer(l, app.today)} role="checkbox" aria-checked={ok}>
    <span class="tick" class:on={ok} aria-hidden="true">{#if ok}<Check size={14} strokeWidth={3} />{/if}</span>
    {#if to}<IconTile icon={icon(to.icon)} color={color(to.color)} size="sm" />{/if}
    <span class="lname">
      {l.name}
      {#if l.mode === 'topUp' && l.remaining !== undefined}
        <span class="topup">
          {#if full}già a posto: rimasti {eur(l.remaining)}{:else if l.remaining !== 0}{eur(l.target)} − {eur(l.remaining)} rimasti{/if}
        </span>
      {:else if l.mode === 'reserve' && l.taken !== undefined}
        <span class="topup">
          {#if l.taken === 0}nessun prelievo: metà del budget di {eur(l.target)}{:else if l.taken < l.target}presi {eur(l.taken)} + {eur((l.base ?? l.amount) - l.taken)}{:else}reintegra i {eur(l.taken)} presi{/if}
        </span>
      {:else if l.dueDate}
        <span class="topup">
          {l.fromPocketId !== app.mainPocket?.id ? `da ${pocket(l.fromPocketId)?.name} ` : ''}su {to?.name} · scade il {Number(l.dueDate.slice(8))} {monthName(Number(l.dueDate.slice(5, 7)))} · {l.paydays === 1 ? 'ultimo stipendio prima della scadenza' : `ancora ${l.paydays} stipendi, questo compreso`}
        </span>
      {/if}
      {#if l.covers && l.base !== undefined}
        {@const covered = l.covers.reduce((a, c) => a + c.amount, 0)}
        <span class="topup">
          {#if covered > l.base}scadenze {eur(covered)} al posto del budget di {eur(l.base)}{:else}budget {eur(l.base)}, comprese le scadenze{/if}:
          {l.covers.map((c) => `${c.name} ${eur(c.amount)}`).join(', ')}
        </span>
      {/if}
      {#if st === 'manual'}
        <span class="topup">fatto con un giroconto dai Movimenti</span>
      {:else if st === 'ignored'}
        <span class="topup">il giroconto dai Movimenti non conta per questa voce: spunta per contarlo di nuovo</span>
      {:else if st === 'partial'}
        <span class="topup warn">già spostati {eur(moved)} con un giroconto: spunta per spostare i {eur(l.amount - moved)} che mancano</span>
      {:else if moved > 0}
        <span class="topup">{eur(moved)} con un giroconto + {eur(l.amount - moved)} con la spunta</span>
      {/if}
    </span>
    <Amount cents={l.amount} tone={ok ? 'muted' : 'default'} />
  </button>
{/snippet}

<style>
  .page {
    display: flex;
    flex-direction: column;
    gap: var(--sp-3);
    padding: calc(var(--sp-4) + env(safe-area-inset-top)) var(--gutter) var(--sp-5);
  }
  .head {
    margin-bottom: var(--sp-2);
  }
  .small {
    font-size: var(--fs-callout);
  }
  .center {
    text-align: center;
  }
  .salary-form {
    display: grid;
    gap: var(--sp-3);
    margin-top: var(--sp-4);
  }
  .summary {
    display: grid;
    gap: var(--sp-1);
    padding: var(--sp-5);
    border-radius: var(--r-lg);
    background: var(--hero-bg);
    box-shadow: var(--shadow-1), var(--card-ring);
  }
  .op {
    display: inline-block;
    width: 1.1em;
    color: var(--text-3);
  }
  .sum-row {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
  }
  .sum-row.total {
    margin-top: var(--sp-2);
    padding-top: var(--sp-2);
    border-top: 1px solid var(--hairline-strong);
    color: var(--positive);
    font-weight: var(--fw-bold);
    align-items: center;
  }
  .note {
    padding: 0 var(--sp-1);
  }
  .sr-only-sentence {
    margin-top: var(--sp-2);
  }
  .line {
    display: flex;
    align-items: center;
    gap: var(--sp-3);
    width: 100%;
    min-height: 52px;
    text-align: left;
  }
  .line + .line {
    border-top: 1px solid var(--hairline);
  }
  .lname {
    flex: 1;
    font-weight: var(--fw-medium);
  }
  .check.ok .lname {
    color: var(--text-3);
    text-decoration: line-through;
  }
  .topup.warn {
    color: var(--warning, var(--text-2));
    font-weight: var(--fw-medium);
  }
  .topup {
    display: block;
    font-size: var(--fs-caption);
    font-weight: var(--fw-regular);
    color: var(--text-3);
    text-decoration: none;
    font-variant-numeric: tabular-nums;
  }
  .check:disabled {
    cursor: default;
  }
  .tick {
    flex: none;
    width: 24px;
    height: 24px;
    border-radius: 8px;
    display: grid;
    place-items: center;
    box-shadow: inset 0 0 0 2px var(--hairline-strong);
    transition: background-color var(--dur-base);
  }
  .tick.on {
    background: var(--accent);
    color: var(--on-accent);
    box-shadow: none;
  }
  .line :global(.lock) {
    color: var(--text-3);
    flex: none;
  }
  .done-box {
    display: flex;
    align-items: center;
    gap: var(--sp-2);
    margin: var(--sp-3) 0 var(--sp-1);
    color: var(--positive);
    font-weight: var(--fw-medium);
  }
  .btn-row {
    margin-top: var(--sp-3);
  }
  .dl + .dl {
    margin-top: var(--sp-3);
    padding-top: var(--sp-3);
    border-top: 1px solid var(--hairline);
  }
  .dl-row {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: var(--sp-3);
  }
  .bar {
    height: 6px;
    margin: var(--sp-2) 0 var(--sp-1);
    border-radius: 3px;
    background: var(--surface-2);
    box-shadow: inset 0 0 0 1px var(--hairline);
    overflow: hidden;
  }
  .bar span {
    display: block;
    height: 100%;
    background: var(--positive);
  }
  .dl-nums {
    display: flex;
    justify-content: space-between;
    gap: var(--sp-3);
    color: var(--text-2);
    font-variant-numeric: tabular-nums;
  }
  .backup {
    display: flex;
    align-items: center;
    gap: var(--sp-3);
  }
  .grow {
    flex: 1;
  }
</style>

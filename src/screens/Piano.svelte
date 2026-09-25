<script lang="ts">
  import { Check, CircleCheck, CloudUpload, Lock, PiggyBank } from '@lucide/svelte';
  import { app } from '../lib/app/store.svelte';
  import { router } from '../lib/app/router.svelte';
  import { formatCents, parseEuroInput } from '../lib/domain/money';
  import { periodLabel } from '../lib/domain/dates';
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
  const status = (l: { recurringId: Id; fromPocketId: Id; toPocketId?: Id }) => app.planStatus(l);
  const done = (recurringId: Id) => {
    const l = [...plan.revolut, ...plan.others].find((x) => x.recurringId === recurringId);
    return l ? !!status(l) : !!app.txByKey(`plan:${recurringId}:${key}`);
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
    const allocation = !bill.late && line && !app.planStatus(line) ? line.amount : 0; // se già spostato è già nel fondo
    return { estimate: bill.estimate, fund, allocation, late: bill.late, shortfall: billShortfall(fund, allocation, bill.estimate) };
  });
  const proposal = $derived(plan.saveable);
  const saveAmount = $derived(parseEuroInput(savingInput) ?? proposal);
  const savedTx = $derived(app.txByKey(`plan:save:${key}`));
  const leftoverTx = $derived(app.txByKey(`plan:leftover:${key}`));
  const checklistDone = $derived([...plan.revolut, ...plan.others].every((l) => done(l.recurringId)));
  const eur = (c: number) => (privacy.hidden ? '•••' : formatCents(c));

  async function registerSalary() {
    const cents = parseEuroInput(salaryInput);
    if (!cents || cents <= 0) {
      salaryError = 'Scrivi un importo valido, per esempio 2.345,00.';
      return;
    }
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
            <TextField label="Importo" inputmode="decimal" placeholder={formatCents(proposal, { symbol: false })} bind:value={savingInput} hint="Lascia vuoto per usare la proposta." />
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
  {@const ok = !!st || full}
  {@const to = pocket(l.toPocketId)}
  <button class="line check" class:ok disabled={st === 'manual' || full} title={st === 'manual' ? 'Già registrato con un giroconto' : undefined} onclick={() => app.togglePlanTransfer(l, app.today)} role="checkbox" aria-checked={ok}>
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
          {#if l.taken === 0}nessun prelievo: metà del budget di {eur(l.target)}{:else if l.taken < l.target}presi {eur(l.taken)} + {eur(l.amount - l.taken)}{:else}reintegra i {eur(l.taken)} presi{/if}
        </span>
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
  .backup {
    display: flex;
    align-items: center;
    gap: var(--sp-3);
  }
  .grow {
    flex: 1;
  }
</style>

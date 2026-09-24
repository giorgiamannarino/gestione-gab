<script lang="ts">
  import { ArrowRight, Check, CircleCheck, CloudUpload, Lock, PiggyBank } from '@lucide/svelte';
  import { app } from '../lib/app/store.svelte';
  import { router } from '../lib/app/router.svelte';
  import { formatCents, parseEuroInput } from '../lib/domain/money';
  import { periodLabel } from '../lib/domain/dates';
  import type { Id } from '../lib/domain/types';
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
  const saveAmount = $derived(parseEuroInput(savingInput) ?? plan.saveable);
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
      <div class="sum-row"><span class="c-3">Stipendio</span><Amount cents={salary} size="lg" /></div>
      <ArrowRight size={16} class="arrow" />
      <div class="sum-row"><span class="c-3">Fissi e pocket</span><Amount cents={plan.fixedTotal} size="lg" /></div>
      <ArrowRight size={16} class="arrow" />
      <div class="sum-row strong"><span>Puoi mettere da parte</span><Amount cents={plan.saveable} size="lg" /></div>
      <p class="sr-only-sentence c-3 small">
        Stipendio {eur(salary)} → fissi e pocket {eur(plan.fixedTotal)}{plan.safetyMargin ? ` → margine ${eur(plan.safetyMargin)}` : ''} → puoi mettere da parte {eur(plan.saveable)}
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
      <Card title="Altri spostamenti">
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
          <div class="line"><Lock size={16} strokeWidth={1.75} class="lock" /><span class="lname">Margine di sicurezza</span><Amount cents={plan.safetyMargin} tone="muted" /></div>
        {/if}
      </Card>
    {/if}

    {#if app.savingsTarget}
      <Card title="Metti da parte">
        <p class="c-2 small">Proposta: sposta su {app.savingsTarget.name} quello che avanza dopo fissi e pocket.</p>
        {#if savedTx}
          <div class="done-box"><CircleCheck size={18} /> Spostati <Amount cents={savedTx.legs[1]?.amount ?? 0} /> su {app.savingsTarget.name}</div>
          <Button variant="ghost" onclick={() => moveToSavings(0, 'save', '')}>Annulla lo spostamento</Button>
        {:else}
          <div class="salary-form">
            <TextField label="Importo" inputmode="decimal" placeholder={formatCents(plan.saveable, { symbol: false })} bind:value={savingInput} hint="Lascia vuoto per usare la proposta." />
            <Button size="lg" block disabled={saveAmount <= 0} onclick={() => moveToSavings(saveAmount, 'save', 'Risparmio del mese')}>
              <PiggyBank size={18} /> Sposta {eur(saveAmount)}
            </Button>
          </div>
        {/if}
      </Card>

      {#if plan.leftover > 0}
        <Card title="Avanzo del periodo precedente">
          <p class="c-2 small">Prima dello stipendio su {app.mainPocket.name} erano rimasti {eur(plan.leftover)}. Vuoi aggiungerli al risparmio?</p>
          <div class="btn-row">
            <Button variant={leftoverTx ? 'ghost' : 'secondary'} onclick={() => moveToSavings(plan.leftover, 'leftover', 'Avanzo del periodo')}>
              {leftoverTx ? 'Annulla' : `Aggiungi ${eur(plan.leftover)}`}
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

{#snippet check(l: { recurringId: Id; name: string; fromPocketId: Id; toPocketId?: Id; amount: number })}
  {@const st = status(l)}
  {@const ok = !!st}
  {@const to = pocket(l.toPocketId)}
  <button class="line check" class:ok disabled={st === 'manual'} title={st === 'manual' ? 'Già registrato con un giroconto' : undefined} onclick={() => app.togglePlanTransfer(l, app.today)} role="checkbox" aria-checked={ok}>
    <span class="tick" class:on={ok} aria-hidden="true">{#if ok}<Check size={14} strokeWidth={3} />{/if}</span>
    {#if to}<IconTile icon={icon(to.icon)} color={color(to.color)} size="sm" />{/if}
    <span class="lname">{l.name}</span>
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
  .summary :global(.arrow) {
    color: var(--text-3);
    transform: rotate(90deg);
    margin-left: 2px;
  }
  .sum-row {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
  }
  .sum-row.strong {
    color: var(--positive);
    font-weight: var(--fw-bold);
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

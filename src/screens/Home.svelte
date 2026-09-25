<script lang="ts">
  import { TriangleAlert, Check, ChevronRight, CloudUpload, Eye, EyeOff, Fuel, Settings, TrendingDown, TrendingUp, Wallet } from '@lucide/svelte';
  import { app } from '../lib/app/store.svelte';
  import { router } from '../lib/app/router.svelte';
  import { openQuickAdd } from '../lib/app/quickadd.svelte';
  import { balances, sumBalances } from '../lib/domain/balances';
  import { addDays, formatLongDate, monthName } from '../lib/domain/dates';
  import { formatCents } from '../lib/domain/money';
  import { budgetSpent, debitKey, dueDebits, pocketPeriodStats, splitBill } from '../lib/domain/stats';
  import { dailyAllowance } from '../lib/domain/planning';
  import { parseEuroInput } from '../lib/domain/money';
  import BottomSheet from '../ui/BottomSheet.svelte';
  import TextField from '../ui/TextField.svelte';
  import type { Pocket } from '../lib/domain/types';
  import { color, icon } from '../lib/ui/icons';
  import { privacy, togglePrivacy } from '../lib/ui/privacy.svelte';
  import Amount from '../ui/Amount.svelte';
  import Button from '../ui/Button.svelte';
  import Card from '../ui/Card.svelte';
  import IconButton from '../ui/IconButton.svelte';
  import IconTile from '../ui/IconTile.svelte';
  import InlineMessage from '../ui/InlineMessage.svelte';
  import ListRow from '../ui/ListRow.svelte';
  import ProgressBar from '../ui/ProgressBar.svelte';

  const p = $derived(app.period);
  const bal = $derived(app.balances);
  const startTotal = $derived.by(() => {
    const active = app.data.pockets.filter((x) => !x.archived);
    return sumBalances(balances(active, app.data.transactions, addDays(p.start, -1)));
  });
  const delta = $derived(app.total - startTotal);

  const groups = $derived(
    [...app.data.groups]
      .sort((a, b) => a.order - b.order)
      .map((g) => ({ ...g, pockets: app.activePockets.filter((x) => x.groupId === g.id) }))
      .filter((g) => g.pockets.length),
  );
  const groupTotal = (ps: Pocket[]) => ps.reduce((a, x) => a + (bal.get(x.id) ?? 0), 0);

  const budgets = $derived(app.data.recurring.filter((r) => r.active && r.kind === 'budget'));
  const due = $derived(dueDebits(app.data.recurring, app.data.transactions, p, app.today));
  const salaryDone = $derived(!!app.salaryTx);
  const nextBill = $derived(app.data.settings.nextBill);

  // Oggi puoi spendere: saldo del pocket diviso i giorni che mancano a fine periodo.
  const daily = $derived.by(() => {
    const pocket = app.dailyPocket;
    if (!pocket) return null;
    const st = pocketPeriodStats(pocket.id, app.data.transactions, p);
    return { pocket, ...dailyAllowance(bal.get(pocket.id) ?? 0, st.taken, app.today, p) };
  });

  const daysSinceBackup = $derived(app.backupInfo.lastAt ? Math.floor((Date.now() - app.backupInfo.lastAt) / 86_400_000) : null);
  const backupText = $derived(
    daysSinceBackup === null
      ? 'Nessun backup ancora'
      : `Backup ${daysSinceBackup === 0 ? 'di oggi' : daysSinceBackup === 1 ? 'di ieri' : `di ${daysSinceBackup} giorni fa`}`,
  );
  const backupOld = $derived(
    app.data.transactions.length > 0 &&
      (daysSinceBackup === null || daysSinceBackup > 30 || (app.data.settings.weeklyBackupReminder && daysSinceBackup >= 7 && app.pending > 0)),
  );

  function billMonth(m: string) {
    return monthName(Number(m.slice(5, 7)));
  }
  const open = (pocket: Pocket) => router.go(`/pocket/${pocket.id}`);

  // ── Bollette ──
  const billsPocket = $derived(app.data.pockets.find((x) => x.role === 'bills' && !x.archived));
  // Solo i soldi messi da parte per queste bollette (non gli accantonamenti dei mesi dopo).
  const billFund = $derived(app.billFund?.available ?? 0);
  const billFundNow = $derived(app.billFund?.now ?? 0);
  let billOpen = $state(false);
  let billAmount = $state('');
  let billDate = $state(app.today);
  const billCents = $derived(parseEuroInput(billAmount));
  const billSplit = $derived(billCents && billCents > 0 ? splitBill(billFund, billCents) : null);
  function openBill() {
    billAmount = app.billDue ? formatCents(app.billDue.estimate, { symbol: false }) : '';
    billDate = app.today;
    billOpen = true;
  }
  async function saveBill() {
    if (!billCents || billCents <= 0) return;
    await app.registerBill(billCents, billDate);
    billOpen = false;
  }

  // Saluto in base all'ora, aggiornato ogni minuto.
  let hour = $state(new Date().getHours());
  $effect(() => {
    const t = setInterval(() => (hour = new Date().getHours()), 60_000);
    return () => clearInterval(t);
  });
  const greeting = $derived(hour >= 5 && hour < 13 ? 'Buongiorno,' : hour >= 13 && hour < 18 ? 'Buon pomeriggio,' : 'Buonasera,');
</script>

<div class="page">
  <header class="top">
    <div>
      <p class="eyebrow">{formatLongDate(app.today)}</p>
      <h1 class="t-title-2">{greeting}</h1>
    </div>
    <div class="actions">
      <IconButton icon={privacy.hidden ? EyeOff : Eye} label={privacy.hidden ? 'Mostra importi' : 'Nascondi importi'} onclick={togglePrivacy} />
      <IconButton icon={Settings} label="Impostazioni" onclick={() => router.go('/impostazioni')} />
    </div>
  </header>

  <button class="hero" onclick={() => router.go('/riepilogo')}>
    <span class="label">Patrimonio totale <span class="more">Riepilogo <ChevronRight size={14} strokeWidth={2} /></span></span>
    <Amount cents={app.total} size="display" splitDecimals />
    <span class="meta">
      <span class="delta" class:neg={delta < 0}>
        {#if delta < 0}<TrendingDown size={14} strokeWidth={2} />{:else}<TrendingUp size={14} strokeWidth={2} />{/if}
        <Amount cents={delta} signed size="sm" />
      </span>
      <span class="c-3">dal {Number(p.start.slice(8))} {monthName(Number(p.start.slice(5, 7)))}</span>
    </span>
  </button>

  <button class="backup-hint" onclick={() => router.go('/impostazioni/backup')}>
    <CloudUpload size={16} strokeWidth={1.75} />
    <span>{backupText}{app.pending > 0 ? ` · ${app.pending} ${app.pending === 1 ? 'movimento' : 'movimenti'} da salvare` : ''}</span>
    <ChevronRight size={16} strokeWidth={1.75} />
  </button>

  <div class="stack">
    <!-- Due quadrati affiancati; se ne resta uno solo occupa tutta la riga. -->
    {#if daily || backupOld}
      <div class="tiles-row">
        {#if daily}
          <button class="daily pace-{daily.pace}" onclick={() => open(daily.pocket)}>
            <span class="daily-label">Oggi puoi spendere</span>
            {#if daily.pace === 'over'}
              <span class="over-text">Attenzione, stai spendendo più di quanto programmato in questi giorni</span>
            {:else}
              <Amount cents={daily.today} size="lg" />
            {/if}
            <span class="c-3 small">su {daily.pocket.name} · quota {privacy.hidden ? '•••' : formatCents(daily.daily)} al giorno<br />{daily.daysLeft === 1 ? 'ultimo giorno' : `${daily.daysLeft} giorni al ${app.data.settings.salaryDay}`}</span>
            <span class="pace">{daily.pace === 'ok' ? 'In linea' : daily.pace === 'tight' ? 'Un po’ oltre' : 'Oltre il programma'}</span>
          </button>
        {/if}
        {#if backupOld}
          <div class="backup-tile">
            <span class="bt-icon" aria-hidden="true"><TriangleAlert size={18} strokeWidth={2} /></span>
            <span class="bt-title">{daysSinceBackup === null ? 'Nessun backup ancora' : `Backup di ${daysSinceBackup} giorni fa`}</span>
            <span class="c-3 small">Salvalo con un tocco.</span>
            <Button variant="secondary" block onclick={() => router.go('/impostazioni/backup')}>Fai il backup</Button>
          </div>
        {/if}
      </div>
    {/if}

    {#if app.billDue}
      {@const due = app.billDue}
      {#if due.lastDay}
        <InlineMessage tone="warning" title="Ultimo giorno del periodo: le bollette non sono ancora uscite dal conto?">
          Stima {privacy.hidden ? '•••' : formatCents(due.estimate)}. Se confermi, le considero nel prossimo periodo di stipendio.
          {#snippet action()}
            <div class="msg-actions">
              <Button variant="secondary" onclick={openBill}>Sono uscite, inserisci</Button>
              <Button variant="ghost" onclick={() => app.deferBill()}>Confermo, non ancora</Button>
            </div>
          {/snippet}
        </InlineMessage>
      {:else}
        <InlineMessage tone="info" title="Sono arrivate le bollette di {monthName(Number(due.month.slice(5, 7)))}?">
          Stima: {privacy.hidden ? '•••' : formatCents(due.estimate)}. Messi da parte per queste bollette: {privacy.hidden ? '•••' : formatCents(billFund)}.
          {#snippet action()}
            <div class="msg-actions">
              <Button variant="secondary" onclick={openBill}>Sì, inserisci</Button>
              <Button variant="ghost" onclick={() => app.snoozeBill()}>Non ancora</Button>
            </div>
          {/snippet}
        </InlineMessage>
      {/if}
    {/if}

    {#if app.eveningReminderDue}
      <InlineMessage tone="info" title="Hai inserito le spese di oggi?">
        Non ti scordare!
        {#snippet action()}<Button variant="secondary" onclick={() => openQuickAdd()}>Aggiungi una spesa</Button>{/snippet}
      </InlineMessage>
    {/if}

    {#if !salaryDone && app.mainPocket}
      <InlineMessage tone="info" title="È arrivato lo stipendio?">
        Inseriscilo nel piano: gli spostamenti fissi si preparano da soli.
        {#snippet action()}<Button variant="secondary" onclick={() => router.go('/piano')}>Apri il piano</Button>{/snippet}
      </InlineMessage>
    {/if}

    {#if due.length || app.dueDeadlines.length}
      <Card title="Da confermare">
        {#each app.dueDeadlines as dl (dl.id)}
          <ListRow title={dl.name} subtitle="Scadenza · da {app.data.pockets.find((x) => x.id === dl.pocketId)?.name ?? ''} · {dl.dueDate > app.today ? 'scade' : 'scaduta'} il {Number(dl.dueDate.slice(8))} {monthName(Number(dl.dueDate.slice(5, 7)))}">
            {#snippet trailing()}
              <button class="confirm" onclick={() => app.confirmDeadline(dl)}>
                <Check size={16} strokeWidth={2.25} /> {privacy.hidden ? 'Conferma' : formatCents(dl.amount)}
              </button>
            {/snippet}
          </ListRow>
        {/each}
        {#each due as d (d.recurring.id)}
          {@const pk = app.data.pockets.find((x) => x.id === d.recurring.fromPocketId)}
          {@const to = d.recurring.toPocketId ? app.data.pockets.find((x) => x.id === d.recurring.toPocketId) : undefined}
          <ListRow title={d.recurring.name} subtitle="{pk?.name ?? ''}{to ? ` → ${to.name}` : ''} · dal {Number(d.date.slice(8))} {monthName(Number(d.date.slice(5, 7)))}">
            {#snippet trailing()}
              <button class="confirm" onclick={() => app.confirmDebit(d.recurring, d.date, debitKey(d.recurring, p))}>
                <Check size={16} strokeWidth={2.25} /> {privacy.hidden ? 'Conferma' : formatCents(d.recurring.amount)}
              </button>
            {/snippet}
          </ListRow>
        {/each}
      </Card>
    {/if}

    {#each groups as g (g.id)}
      {@const invest = g.pockets.every((x) => x.role === 'investment')}
      <Card title={g.name}>
        {#snippet aside()}<Amount cents={groupTotal(g.pockets)} />{/snippet}
        {#if invest}
          <div class="tiles">
            {#each g.pockets as pk (pk.id)}
              <button class="tile" style:--c={color(pk.color)} onclick={() => open(pk)}>
                <IconTile icon={icon(pk.icon)} color={color(pk.color)} size="sm" />
                <span class="tile-name">{pk.name}</span>
                <Amount cents={bal.get(pk.id) ?? 0} />
                <span class="tile-sub">versato</span>
              </button>
            {/each}
          </div>
        {:else}
          {@const saving = g.pockets.find((x) => x.role === 'savings')}
          {@const rows = g.pockets.filter((x) => x.role !== 'savings')}
          {#if saving}
            <button class="savings" style:--c={color(saving.color)} onclick={() => open(saving)}>
              <IconTile icon={icon(saving.icon)} color={color(saving.color)} />
              <span class="savings-text">
                <span class="savings-name">{saving.name}</span>
                <span class="c-3 small">i tuoi arrotondamenti</span>
              </span>
              <Amount cents={bal.get(saving.id) ?? 0} />
            </button>
          {/if}
          {#if saving && rows.length > 1}
            <div class="grid">
              {#each rows as pk (pk.id)}
                <button class="pocket" onclick={() => open(pk)}>
                  <IconTile icon={icon(pk.icon)} color={color(pk.color)} size="sm" />
                  <span class="pocket-name">{pk.name}</span>
                  <Amount cents={bal.get(pk.id) ?? 0} tone={(bal.get(pk.id) ?? 0) < 0 ? 'auto' : 'default'} />
                </button>
              {/each}
            </div>
          {:else}
            {#each rows as pk (pk.id)}
              <ListRow title={pk.name} onclick={() => open(pk)}>
                {#snippet leading()}<IconTile icon={icon(pk.icon)} color={color(pk.color)} />{/snippet}
                {#snippet sub()}
                  {#if pk.role === 'bills' && nextBill}
                    {@const covered = (bal.get(pk.id) ?? 0) >= nextBill.amount}
                    <span class:ok={covered} class:warn={!covered}>
                      {#if covered}<Check size={13} strokeWidth={2.25} /> Copre la bolletta di {billMonth(nextBill.month)}{:else}Mancano {privacy.hidden ? '•••' : formatCents(nextBill.amount - (bal.get(pk.id) ?? 0))} per {billMonth(nextBill.month)}{/if}
                    </span>
                  {:else if pk.role === 'main'}
                    Conto principale
                  {/if}
                {/snippet}
                {#snippet trailing()}<Amount cents={bal.get(pk.id) ?? 0} tone={(bal.get(pk.id) ?? 0) < 0 ? 'auto' : 'default'} />{/snippet}
              </ListRow>
              {#each budgets.filter((b) => b.fromPocketId === pk.id) as b (b.id)}
                {@const spent = budgetSpent(b, app.data.transactions, p)}
                <div class="budget">
                  <div class="budget-head">
                    <span class="budget-label"><Fuel size={14} strokeWidth={1.75} /> {b.name}</span>
                    {#if spent <= b.amount}
                      <span class="c-3"><strong class="strong"><Amount cents={b.amount - spent} size="sm" /></strong> rimasti di <Amount cents={b.amount} size="sm" tone="muted" /></span>
                    {:else}
                      <span class="warn">Superato di <Amount cents={spent - b.amount} size="sm" /></span>
                    {/if}
                  </div>
                  <ProgressBar value={spent} max={b.amount} color={color(pk.color)} label="Budget {b.name}" />
                </div>
              {/each}
            {/each}
          {/if}
        {/if}
      </Card>
    {:else}
      <Card>
        <div class="empty">
          <Wallet size={28} strokeWidth={1.5} />
          <p>Nessun pocket ancora. Aggiungine uno dalle Impostazioni.</p>
          <Button variant="secondary" onclick={() => router.go('/impostazioni/pocket')}>Aggiungi un pocket</Button>
        </div>
      </Card>
    {/each}
  </div>
</div>

<BottomSheet bind:open={billOpen} title="Bollette">
  <div class="bill">
    <TextField label="Quanto è uscito?" inputmode="decimal" bind:value={billAmount} error={billAmount.trim() && billCents === null ? 'Scrivi un importo valido, es. 187,40.' : ''} />
    <TextField label="Data" type="date" bind:value={billDate} />
    <p class="c-3 small">
      Esce da {billsPocket?.name ?? 'Fondo bollette'}. Per queste bollette erano stati messi da parte {privacy.hidden ? '•••' : formatCents(billFund)}{billFundNow > billFund ? `; gli altri ${privacy.hidden ? '•••' : formatCents(billFundNow - billFund)} nel fondo sono per le bollette successive e restano lì` : ''}.
    </p>
    {#if billSplit && billSplit.shortfall > 0}
      <InlineMessage tone="warning" title="Il fondo non basta">
        {#if app.savingsTarget}
          Tolgo {privacy.hidden ? '•••' : formatCents(billSplit.shortfall)} da {app.savingsTarget.name}. Se capita spesso, conviene aumentare l'accantonamento mensile.
        {:else}
          Mancano {privacy.hidden ? '•••' : formatCents(billSplit.shortfall)}: il fondo bollette andrà in negativo.
        {/if}
      </InlineMessage>
    {:else if billSplit && billSplit.rest > 0}
      <InlineMessage tone="success">
        Avanzano {privacy.hidden ? '•••' : formatCents(billSplit.rest)}: li sposto su {app.savingsTarget?.name ?? 'Risparmi'}.
      </InlineMessage>
    {/if}
    <p class="c-3 small">La prossima bolletta stimata passerà a due mesi dopo, con questo importo come stima.</p>
    <Button size="lg" block disabled={!billCents || billCents <= 0} onclick={saveBill}>Registra le bollette</Button>
  </div>
</BottomSheet>

<style>
  .page {
    padding: calc(var(--sp-2) + env(safe-area-inset-top)) var(--gutter) var(--sp-5);
  }
  .top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--sp-2) var(--sp-1) var(--sp-4);
  }
  .eyebrow {
    font-size: var(--fs-callout);
    color: var(--text-3);
    text-transform: capitalize;
  }
  .actions {
    display: flex;
    gap: var(--sp-2);
  }
  .hero {
    display: block;
    width: 100%;
    text-align: left;
    transition: transform var(--dur-fast) var(--ease-out);
    padding: var(--sp-5);
    border-radius: var(--r-lg);
    background: var(--hero-bg);
    box-shadow: var(--shadow-1), var(--card-ring);
  }
  .hero:active {
    transform: scale(0.99);
  }
  .more {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    float: right;
    color: var(--accent-ink);
    font-weight: var(--fw-bold);
  }
  .label {
    display: block;
    font-size: var(--fs-callout);
    color: var(--text-3);
    font-weight: var(--fw-medium);
    margin-bottom: var(--sp-1);
  }
  .meta {
    display: flex;
    align-items: center;
    gap: var(--sp-2);
    margin-top: var(--sp-3);
    font-size: var(--fs-callout);
  }
  .delta {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 10px;
    border-radius: var(--r-full);
    color: var(--positive);
    background: color-mix(in srgb, var(--positive-fill) var(--tint), var(--surface));
  }
  .delta.neg {
    color: var(--negative);
    background: color-mix(in srgb, var(--negative-fill) var(--tint), var(--surface));
  }
  .backup-hint {
    display: flex;
    align-items: center;
    gap: var(--sp-2);
    width: 100%;
    min-height: var(--tap);
    margin: var(--sp-2) 0;
    padding: 0 var(--sp-3);
    color: var(--text-3);
    font-size: var(--fs-callout);
    text-align: left;
  }
  .backup-hint span {
    flex: 1;
  }
  .tiles-row {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(0, 1fr));
    gap: var(--sp-3);
  }
  /* Oggi puoi spendere: il colore segue il ritmo di spesa. */
  .daily {
    --c: var(--positive);
    --f: var(--positive-fill);
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 2px;
    min-width: 0;
    padding: var(--sp-4);
    border-radius: var(--r-lg);
    text-align: left;
    background: color-mix(in srgb, var(--f) var(--tint), var(--surface));
    box-shadow: var(--shadow-1), var(--card-ring);
  }
  .daily .pace {
    margin-top: auto;
  }
  .daily .small {
    margin-bottom: var(--sp-2);
  }
  .backup-tile {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 2px;
    min-width: 0;
    padding: var(--sp-4);
    border-radius: var(--r-lg);
    background: color-mix(in srgb, var(--warning-fill) var(--tint), var(--surface));
    box-shadow: var(--shadow-1), var(--card-ring);
  }
  .backup-tile :global(.btn) {
    margin-top: auto;
    padding: 0 var(--sp-3);
  }
  .bt-icon {
    color: var(--warning);
    margin-bottom: var(--sp-1);
  }
  .bt-title {
    font-weight: var(--fw-bold);
    line-height: 1.3;
  }
  .backup-tile .small {
    margin-bottom: var(--sp-3);
  }
  .daily.pace-tight {
    --c: var(--warning);
    --f: var(--warning-fill);
  }
  .daily.pace-over {
    --c: var(--negative);
    --f: var(--negative-fill);
  }
  .over-text {
    color: var(--negative);
    font-weight: var(--fw-bold);
    font-size: var(--fs-callout);
    line-height: 1.35;
    margin: 2px 0;
  }
  .daily-text {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .daily-label {
    font-size: var(--fs-callout);
    font-weight: var(--fw-bold);
    color: var(--text-2);
  }
  .pace {
    flex: none;
    padding: 4px 10px;
    border-radius: var(--r-full);
    font-size: var(--fs-caption);
    font-weight: var(--fw-bold);
    color: var(--c);
    background: var(--surface);
  }
  .bill {
    display: grid;
    gap: var(--sp-3);
  }
  .msg-actions {
    display: flex;
    gap: var(--sp-2);
    flex-wrap: wrap;
  }
  .stack {
    display: flex;
    flex-direction: column;
    gap: var(--sp-3);
  }
  .small {
    font-size: var(--fs-callout);
  }
  .strong {
    color: var(--text);
  }
  .ok {
    color: var(--positive);
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }
  .warn {
    color: var(--warning);
    font-weight: var(--fw-medium);
  }
  .confirm {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-height: 40px;
    padding: 0 var(--sp-3);
    border-radius: var(--r-full);
    background: var(--accent);
    color: var(--on-accent);
    font-weight: var(--fw-bold);
    font-size: var(--fs-callout);
    font-variant-numeric: tabular-nums;
  }
  .tiles,
  .grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--sp-2);
  }
  .tile,
  .pocket {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 2px;
    padding: var(--sp-3);
    border-radius: var(--r-md);
    background: var(--surface-2);
    text-align: left;
    min-width: 0;
  }
  .tile-name,
  .pocket-name {
    margin-top: var(--sp-2);
    font-size: var(--fs-callout);
    color: var(--text-2);
    font-weight: var(--fw-medium);
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .tile-sub {
    font-size: var(--fs-caption);
    color: var(--text-3);
  }
  /* Numero dispari: l'ultimo pocket occupa la riga intera. */
  .pocket:last-child:nth-child(odd) {
    grid-column: 1 / -1;
    flex-direction: row;
    align-items: center;
    gap: var(--sp-3);
  }
  .pocket:last-child:nth-child(odd) .pocket-name {
    margin: 0;
    flex: 1;
  }
  .savings {
    display: flex;
    align-items: center;
    gap: var(--sp-3);
    width: 100%;
    min-height: 64px;
    padding: var(--sp-2) var(--sp-3);
    margin-bottom: var(--sp-2);
    border-radius: var(--r-md);
    background: color-mix(in srgb, var(--c) 10%, var(--surface));
    text-align: left;
  }
  .savings-text {
    flex: 1;
    display: flex;
    flex-direction: column;
  }
  .savings-name {
    font-weight: var(--fw-medium);
  }
  .budget {
    margin-top: var(--sp-1);
    padding: var(--sp-3);
    border-radius: var(--r-md);
    background: var(--surface-2);
  }
  .budget-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--sp-2);
    margin-bottom: var(--sp-2);
    font-size: var(--fs-callout);
  }
  .budget-label {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    color: var(--text-2);
    font-weight: var(--fw-medium);
  }
  .empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--sp-3);
    padding: var(--sp-5);
    text-align: center;
    color: var(--text-3);
  }
</style>

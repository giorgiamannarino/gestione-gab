<script lang="ts">
  import {
    Bell, BookOpen, ChevronLeft, ChevronRight, CloudUpload, Download, Fingerprint, HardDrive, Layers, ListChecks, Lock, Scale,
    SlidersHorizontal, Tags, Trash2, Wallet,
  } from '@lucide/svelte';
  import { app } from '../lib/app/store.svelte';
  import { router } from '../lib/app/router.svelte';
  import { APP_VERSION, exportCsv, saveBackup } from '../lib/app/backup-actions';
  import { getTheme, setTheme, type ThemeChoice } from '../lib/ui/theme';
  import { notify, notifyState, requestNotify, REMINDER_TEXT, type NotifyState } from '../lib/app/notify';
  import { formatDate, toISODate } from '../lib/domain/dates';
  import { formatCents, parseEuroInput } from '../lib/domain/money';
  import type { Category, Id, PaletteColor, Pocket, Recurring } from '../lib/domain/types';
  import { biometricAvailable } from '../lib/security/biometric';
  import { lock } from '../lib/security/lock.svelte';
  import { ICON_NAMES, PALETTE, color, icon } from '../lib/ui/icons';
  import { showToast } from '../lib/ui/toast.svelte';
  import Amount from '../ui/Amount.svelte';
  import BottomSheet from '../ui/BottomSheet.svelte';
  import Button from '../ui/Button.svelte';
  import Card from '../ui/Card.svelte';
  import Chip from '../ui/Chip.svelte';
  import IconTile from '../ui/IconTile.svelte';
  import InlineMessage from '../ui/InlineMessage.svelte';
  import ListRow from '../ui/ListRow.svelte';
  import Segmented from '../ui/Segmented.svelte';
  import TextField from '../ui/TextField.svelte';
  import Toggle from '../ui/Toggle.svelte';
  import AlignBalances from './parts/AlignBalances.svelte';
  import PinPad from './parts/PinPad.svelte';
  import RestorePanel from './parts/RestorePanel.svelte';

  const section = $derived(router.segments[1] ?? '');
  const titles: Record<string, string> = {
    backup: 'Backup e dati', blocco: 'Blocco', pocket: 'Pocket', categorie: 'Categorie', fissi: 'Spese fisse',
    generali: 'Stipendio e piano', saldi: 'Allinea i saldi', cancella: 'Cancella i dati', promemoria: 'Promemoria',
  };

  // ── Backup ──
  let encrypt = $state(false);
  let pw = $state('');
  let pw2 = $state('');
  let backupBusy = $state(false);
  const pwError = $derived(encrypt && pw2 && pw !== pw2 ? 'Le password non coincidono.' : '');
  async function doBackup() {
    backupBusy = true;
    try {
      await saveBackup(encrypt ? pw : undefined);
    } finally {
      backupBusy = false;
    }
  }
  const lastBackup = $derived(app.backupInfo.lastAt ? formatDate(toISODate(new Date(app.backupInfo.lastAt))) : null);

  // ── Blocco ──
  let pinStep = $state<'idle' | 'first' | 'confirm'>('idle');
  let firstPin = '';
  let pinMsg = $state('');
  let pinErr = $state(false);
  let bioOk = $state(false);
  $effect(() => {
    biometricAvailable().then((v) => (bioOk = v));
  });
  async function onPin(p: string) {
    if (pinStep === 'first') {
      firstPin = p;
      pinStep = 'confirm';
      pinMsg = '';
      pinErr = false;
    } else if (p === firstPin) {
      await lock.enable(p);
      pinStep = 'idle';
      showToast('Blocco attivato', { tone: 'success' });
    } else {
      pinStep = 'first';
      pinMsg = 'I due PIN non coincidono. Riprova.';
      pinErr = true;
    }
  }
  const timeouts = [
    { value: '0', label: 'Subito' },
    { value: '60000', label: '1 min' },
    { value: '300000', label: '5 min' },
    { value: '900000', label: '15 min' },
  ];
  async function toggleBio(on: boolean) {
    try {
      if (on) await lock.enableBiometric();
      else await lock.disableBiometric();
    } catch {
      showToast('Face ID / impronta non attivato', { tone: 'error' });
    }
  }

  // ── Pocket ──
  let pocketEdit = $state<Pocket | null>(null);
  function newPocket(): Pocket {
    return {
      id: crypto.randomUUID(), name: '', groupId: app.data.groups[0]?.id ?? '', color: 'indaco', icon: 'wallet',
      isRevolut: false, openingBalance: 0, openingDate: app.today, archived: false, order: app.data.pockets.length,
    };
  }
  async function savePocket() {
    if (!pocketEdit || !pocketEdit.name.trim()) return;
    await app.put('pockets', { ...pocketEdit, name: pocketEdit.name.trim() });
    pocketEdit = null;
    showToast('Pocket salvato', { tone: 'success' });
  }
  let newGroup = $state('');
  async function addGroup() {
    if (!newGroup.trim() || !pocketEdit) return;
    const g = { id: crypto.randomUUID(), name: newGroup.trim(), order: app.data.groups.length };
    await app.put('groups', g);
    pocketEdit.groupId = g.id;
    newGroup = '';
  }

  // ── Categorie ──
  let catEdit = $state<Category | null>(null);
  async function saveCategory() {
    if (!catEdit || !catEdit.name.trim()) return;
    await app.put('categories', { ...catEdit, name: catEdit.name.trim() });
    catEdit = null;
    showToast('Categoria salvata', { tone: 'success' });
  }

  // ── Spese fisse ──
  let recEdit = $state<(Recurring & { amountText: string }) | null>(null);
  const recKinds = { debit: 'Addebito', allocation: 'Spostamento', budget: 'Budget' } as const;
  function editRecurring(r?: Recurring) {
    const base: Recurring = r ?? { id: crypto.randomUUID(), name: '', kind: 'debit', amount: 0, fromPocketId: app.mainPocket?.id ?? '', active: true, order: app.data.recurring.length };
    recEdit = { ...$state.snapshot(base), amountText: base.amount ? formatCents(base.amount, { symbol: false }) : '' };
  }
  const recAmountError = $derived(recEdit && !recEdit.amountFromDebits && recEdit.amountText && parseEuroInput(recEdit.amountText) === null ? 'Importo non valido.' : '');
  async function saveRecurring() {
    if (!recEdit || !recEdit.name.trim()) return;
    const { amountText, ...r } = recEdit;
    const amount = r.amountFromDebits ? 0 : (parseEuroInput(amountText) ?? 0);
    await app.put('recurring', { ...r, name: r.name.trim(), amount, day: r.kind === 'debit' ? r.day : undefined, toPocketId: r.kind === 'budget' ? undefined : r.toPocketId, categoryId: r.kind === 'debit' && r.toPocketId ? undefined : r.categoryId });
    recEdit = null;
    showToast('Voce salvata', { tone: 'success' });
  }

  // ── Generali ──
  let salaryDay = $state(String(app.data.settings.salaryDay));
  let margin = $state(formatCents(app.data.settings.safetyMargin, { symbol: false }));
  let billMonth = $state(app.data.settings.nextBill?.month ?? '');
  let billAmount = $state(app.data.settings.nextBill ? formatCents(app.data.settings.nextBill.amount, { symbol: false }) : '');
  async function saveGeneral() {
    const day = Number(salaryDay);
    const m = parseEuroInput(margin);
    const b = parseEuroInput(billAmount);
    if (!(day >= 1 && day <= 31) || m === null) {
      showToast('Controlla i valori inseriti', { tone: 'error' });
      return;
    }
    await app.updateSettings({ salaryDay: day, safetyMargin: m, nextBill: billMonth && b ? { month: billMonth, amount: b } : undefined });
    showToast('Impostazioni salvate', { tone: 'success' });
  }

  // ── Aspetto ──
  let themeChoice = $state<ThemeChoice>(getTheme());

  // ── Promemoria ──
  let notifyStatus = $state<NotifyState>(notifyState());
  async function testNotify() {
    if (notifyStatus !== 'granted') notifyStatus = await requestNotify();
    if (notifyStatus !== 'granted') return showToast('Notifiche non autorizzate', { tone: 'error' });
    const ok = await notify('Conti', REMINDER_TEXT);
    showToast(ok ? 'Notifica inviata' : 'Non riesco a mostrare la notifica', { tone: ok ? 'success' : 'error' });
  }

  // ── Cancella ──
  let wipeText = $state('');

  const pocketName = (id?: Id) => app.data.pockets.find((p) => p.id === id)?.name ?? '—';
  const groupName = (id: Id) => app.data.groups.find((g) => g.id === id)?.name ?? '—';
</script>

<div class="page">
  {#if section}
    <header class="sub-head">
      <button class="back" onclick={() => router.go('/impostazioni')} aria-label="Indietro"><ChevronLeft size={22} /></button>
      <h1 class="t-title-2">{titles[section] ?? 'Impostazioni'}</h1>
    </header>
  {:else}
    <header class="sub-head">
      <button class="back" onclick={() => router.go('/')} aria-label="Torna alla Home"><ChevronLeft size={22} /></button>
      <h1 class="t-title-1">Impostazioni</h1>
    </header>
  {/if}

  {#if section === ''}
    <Card title="Aspetto">
      <Segmented
        label="Aspetto"
        bind:value={themeChoice}
        onchange={(v) => setTheme(v)}
        options={[
          { value: 'auto', label: 'Automatico' },
          { value: 'light', label: 'Chiaro' },
          { value: 'dark', label: 'Scuro' },
        ]}
      />
      <p class="c-3 small top">{themeChoice === 'auto' ? "Segue l'impostazione dell'iPhone (Impostazioni → Schermo e luminosità)." : 'Resta così a prescindere dal telefono.'}</p>
    </Card>
    <Card padded={false}>
      <div class="list">
        {@render nav('backup', CloudUpload, 'Backup e dati', lastBackup ? `Ultimo backup ${lastBackup}${app.pending ? ` · ${app.pending} da salvare` : ''}` : 'Nessun backup ancora')}
        {@render nav('blocco', Lock, 'Blocco', lock.enabled ? 'Attivo' : 'Non attivo')}
        {@render nav('promemoria', Bell, 'Promemoria', app.data.settings.eveningReminder ? 'Ogni sera alle 20' : 'Non attivo')}
        {@render nav('saldi', Scale, 'Allinea i saldi', 'Rettifica con i saldi reali')}
      </div>
    </Card>
    <Card padded={false}>
      <div class="list">
        {@render nav('pocket', Wallet, 'Pocket', `${app.activePockets.length} attivi`)}
        {@render nav('categorie', Tags, 'Categorie', `${app.data.categories.filter((c) => !c.system && !c.archived).length} categorie`)}
        {@render nav('fissi', ListChecks, 'Spese fisse', 'Voci, importi, giorni di addebito')}
        {@render nav('generali', SlidersHorizontal, 'Stipendio e piano', `Periodo dal giorno ${app.data.settings.salaryDay}`)}
        <button class="nav-row" onclick={() => router.go('/guida')}>
          <IconTile icon={BookOpen} color="var(--accent-ink)" size="sm" />
          <span class="nav-text"><span class="strong">Come funziona l'app</span><span class="c-3 small">Logiche, regole, cosa si può modificare</span></span>
          <ChevronRight size={18} class="chev" />
        </button>
      </div>
    </Card>
    <Card>
      <div class="storage">
        <HardDrive size={18} strokeWidth={1.75} />
        <div class="grow">
          <p class="strong">Memoria persistente</p>
          <p class="c-3 small">{app.persisted ? 'Attiva: il telefono non cancellerà i dati da solo.' : "Non attiva: installa l'app sulla schermata Home e attivala."}</p>
        </div>
        {#if !app.persisted}<Button variant="secondary" onclick={() => app.requestPersistence()}>Attiva</Button>{/if}
      </div>
    </Card>
    <Card padded={false}>
      <div class="list">{@render nav('cancella', Trash2, 'Cancella i dati', 'Per ripartire da zero')}</div>
    </Card>
    {#if import.meta.env.DEV}
      <Card>
        <p class="strong">Anteprima di sviluppo</p>
        <p class="c-3 small bottom">Sostituisce tutti i dati di questa anteprima con dati inventati.</p>
        <Button variant="secondary" block onclick={async () => { await app.loadDemo(); router.go('/'); showToast('Dati di esempio caricati', { tone: 'success' }); }}>Ricarica i dati di esempio</Button>
      </Card>
    {/if}
    <p class="version">Conti {APP_VERSION} · i dati restano solo su questo telefono</p>

  {:else if section === 'backup'}
    <Card>
      <p class="strong">{lastBackup ? `Ultimo backup: ${lastBackup}` : 'Nessun backup ancora'}</p>
      <p class="c-3 small">{app.pending ? `${app.pending} ${app.pending === 1 ? 'movimento non ancora incluso' : 'movimenti non ancora inclusi'}.` : 'Tutto incluso nell\'ultimo backup.'}</p>
      <p class="c-2 small top">Il backup è una copia completa di tutto: basta sempre l'ultimo. Salvalo su iCloud Drive dal menu di condivisione.</p>
      <div class="stack top">
        <Toggle label="Proteggi con password" description="Separata dal PIN. Senza password il backup non si apre." bind:checked={encrypt} />
        {#if encrypt}
          <TextField label="Password" type="password" bind:value={pw} autocomplete="new-password" />
          <TextField label="Ripeti la password" type="password" bind:value={pw2} error={pwError} autocomplete="new-password" />
        {/if}
        <Button size="lg" block loading={backupBusy} disabled={encrypt && (!pw || pw !== pw2)} onclick={doBackup}><CloudUpload size={18} /> Salva il backup</Button>
      </div>
    </Card>
    <Card>
      <Toggle label="Promemoria settimanale" description="In Home ti ricordo il backup se è passata una settimana." checked={app.data.settings.weeklyBackupReminder} onchange={(v) => app.updateSettings({ weeklyBackupReminder: v })} />
    </Card>
    <Card title="Ripristina">
      <p class="c-2 small bottom">Riporta l'app esattamente allo stato di un backup.</p>
      <RestorePanel />
    </Card>
    <Card title="Esporta">
      <Button variant="secondary" block onclick={exportCsv}><Download size={18} /> Esporta i movimenti in CSV</Button>
    </Card>

  {:else if section === 'blocco'}
    {#if pinStep !== 'idle'}
      <Card>
        <PinPad title={pinStep === 'first' ? 'Scegli un PIN di 6 cifre' : 'Ripeti il PIN'} message={pinMsg} error={pinErr} oncomplete={onPin} />
        <div class="center top"><Button variant="ghost" onclick={() => (pinStep = 'idle')}>Annulla</Button></div>
      </Card>
    {:else if !lock.enabled}
      <InlineMessage tone="warning" title="Prima di attivarlo">
        Se dimentichi il PIN non c'è modo di recuperarlo: l'unica strada è cancellare i dati e ripristinare un backup.
        Tieni sempre un backup recente.
      </InlineMessage>
      <Button size="lg" block onclick={() => { pinStep = 'first'; pinMsg = ''; pinErr = false; }}><Lock size={18} /> Attiva il blocco con PIN</Button>
    {:else}
      <Card>
        <p class="strong">Blocco attivo</p>
        <p class="c-3 small bottom">Chiedo il PIN all'apertura e dopo un periodo in background.</p>
        <Segmented label="Blocca dopo" options={timeouts} value={String(lock.config?.timeoutMs ?? 60000)} onchange={(v) => lock.setTimeout(Number(v))} />
      </Card>
      {#if bioOk}
        <Card>
          <Toggle label="Face ID o impronta" description="Il PIN resta sempre disponibile." checked={!!lock.config?.biometricId} onchange={toggleBio} />
        </Card>
      {:else}
        <p class="c-3 small center"><Fingerprint size={14} /> Face ID o impronta non disponibili su questo browser.</p>
      {/if}
      <Button variant="danger" block onclick={async () => { await lock.disable(); showToast('Blocco disattivato'); }}>Disattiva il blocco</Button>
    {/if}

  {:else if section === 'promemoria'}
    <Card>
      <Toggle
        label="Promemoria delle 20"
        description="Dopo le 20, se oggi non hai inserito movimenti, ti ricordo di farlo."
        checked={!!app.data.settings.eveningReminder}
        onchange={async (v) => {
          await app.updateSettings({ eveningReminder: v });
          if (v && notifyState() === 'default') notifyStatus = await requestNotify();
        }}
      />
    </Card>
    <Card>
      <p class="strong">Notifiche</p>
      <p class="c-3 small bottom">
        {notifyStatus === 'granted' ? 'Attive su questo telefono.'
          : notifyStatus === 'denied' ? 'Bloccate: riattivale in Impostazioni iPhone → Notifiche → Conti.'
          : notifyStatus === 'unsupported' ? "Non disponibili qui. Su iPhone funzionano solo con l'app aggiunta alla schermata Home (iOS 16.4 o successivo)."
          : 'Non ancora autorizzate.'}
      </p>
      <Button variant="secondary" block disabled={notifyStatus === 'unsupported' || notifyStatus === 'denied'} onclick={testNotify}>
        <Bell size={18} /> Prova le notifiche
      </Button>
    </Card>
    <InlineMessage tone="info" title="Notifica alle 20 anche con l'app chiusa">
      Senza server l'app non può mandarti notifiche programmate quando è chiusa. Si fa in un minuto con Comandi Rapidi:
      <ol class="steps">
        <li>Apri <strong>Comandi Rapidi</strong> → <strong>Automazione</strong> → <strong>+</strong></li>
        <li>Scegli <strong>Ora del giorno</strong>: 20:00, ogni giorno, <strong>Esegui immediatamente</strong></li>
        <li>Aggiungi l'azione <strong>Mostra notifica</strong> con il testo: <em>{REMINDER_TEXT}</em></li>
        <li>Salva: da stasera la notifica arriva ogni giorno alle 20</li>
      </ol>
    </InlineMessage>

  {:else if section === 'saldi'}
    <Card>
      <p class="c-2 small bottom">Scrivi il saldo reale che vedi nelle app di Intesa, Generali e Revolut. Per ogni differenza creo un movimento di rettifica, escluso dalle statistiche.</p>
      <AlignBalances />
    </Card>

  {:else if section === 'pocket'}
    {#each [...app.data.groups].sort((a, b) => a.order - b.order) as g (g.id)}
      {@const ps = app.data.pockets.filter((p) => p.groupId === g.id).sort((a, b) => a.order - b.order)}
      {#if ps.length}
        <Card title={g.name}>
          {#each ps as p (p.id)}
            <ListRow title={p.name} subtitle={[p.isRevolut ? 'Revolut' : '', p.role === 'savings' ? 'riceve gli arrotondamenti' : '', p.archived ? 'archiviato' : ''].filter(Boolean).join(' · ')} onclick={() => (pocketEdit = $state.snapshot(p) as Pocket)}>
              {#snippet leading()}<IconTile icon={icon(p.icon)} color={color(p.color)} />{/snippet}
              {#snippet trailing()}<Amount cents={app.balances.get(p.id) ?? 0} tone={p.archived ? 'muted' : 'default'} />{/snippet}
            </ListRow>
          {/each}
        </Card>
      {/if}
    {/each}
    <Button variant="secondary" block onclick={() => (pocketEdit = newPocket())}>Aggiungi un pocket</Button>

  {:else if section === 'categorie'}
    <Card>
      {#each app.data.categories.filter((c) => !c.system).sort((a, b) => a.order - b.order) as c (c.id)}
        <ListRow title={c.name} subtitle={c.archived ? 'archiviata' : undefined} onclick={() => (catEdit = $state.snapshot(c) as Category)}>
          {#snippet leading()}<IconTile icon={icon(c.icon)} color={color(c.color)} />{/snippet}
        </ListRow>
      {/each}
    </Card>
    <Button variant="secondary" block onclick={() => (catEdit = { id: crypto.randomUUID(), name: '', icon: 'circle-dashed', color: 'indaco', archived: false, order: app.data.categories.length })}>Aggiungi una categoria</Button>

  {:else if section === 'fissi'}
    {#each ['allocation', 'debit', 'budget'] as const as k (k)}
      {@const rs = app.data.recurring.filter((r) => r.kind === k).sort((a, b) => a.order - b.order)}
      {#if rs.length}
        <Card title={k === 'allocation' ? 'Spostamenti a inizio mese' : k === 'debit' ? 'Addebiti' : 'Budget'}>
          {#each rs as r (r.id)}
            <ListRow
              title={r.name}
              subtitle={[k === 'allocation' ? `${pocketName(r.fromPocketId)} → ${pocketName(r.toPocketId)}` : pocketName(r.fromPocketId), r.day ? `giorno ${r.day}` : '', r.auto ? 'automatico' : '', r.active ? '' : 'disattivato'].filter(Boolean).join(' · ')}
              onclick={() => editRecurring(r)}
            >
              {#snippet trailing()}
                {#if r.amountFromDebits}<span class="c-3 small">da addebiti</span>{:else}<Amount cents={r.amount} tone={r.active ? 'default' : 'muted'} />{/if}
              {/snippet}
            </ListRow>
          {/each}
        </Card>
      {/if}
    {/each}
    <Button variant="secondary" block onclick={() => editRecurring()}>Aggiungi una voce</Button>

  {:else if section === 'generali'}
    <Card>
      <div class="stack">
        <TextField label="Giorno dello stipendio" inputmode="numeric" bind:value={salaryDay} hint="Il periodo va da questo giorno al giorno prima del mese dopo." />
        <TextField label="Margine di sicurezza su {app.mainPocket?.name ?? 'conto principale'}" inputmode="decimal" bind:value={margin} hint="Resta sempre sul conto: non viene proposto come risparmio." />
        <TextField label="Mese della prossima bolletta" type="month" bind:value={billMonth} />
        <TextField label="Importo stimato della bolletta" inputmode="decimal" bind:value={billAmount} />
        <Button size="lg" block onclick={saveGeneral}>Salva</Button>
      </div>
    </Card>

  {:else if section === 'cancella'}
    <InlineMessage tone="error" title="Attenzione: non si può annullare">
      Cancello tutti i dati da questo telefono. Potrai ripartire da zero o ripristinare un backup.
    </InlineMessage>
    <Card>
      <div class="stack">
        <TextField label='Per confermare scrivi "CANCELLA"' bind:value={wipeText} autocomplete="off" />
        <Button variant="danger" size="lg" block disabled={wipeText.trim().toUpperCase() !== 'CANCELLA'} onclick={() => app.wipe()}>Cancella tutti i dati</Button>
      </div>
    </Card>
  {/if}
</div>

{#snippet nav(id: string, Icon: typeof Lock, title: string, sub: string)}
  <button class="nav-row" onclick={() => router.go(`/impostazioni/${id}`)}>
    <IconTile icon={Icon} color="var(--accent-ink)" size="sm" />
    <span class="nav-text"><span class="strong">{title}</span><span class="c-3 small">{sub}</span></span>
    <ChevronRight size={18} class="chev" />
  </button>
{/snippet}

<BottomSheet open={!!pocketEdit} title={pocketEdit && app.data.pockets.some((p) => p.id === pocketEdit!.id) ? 'Modifica pocket' : 'Nuovo pocket'} onclose={() => (pocketEdit = null)}>
  {#if pocketEdit}
    <div class="stack">
      <TextField label="Nome" bind:value={pocketEdit.name} />
      <p class="flabel">Gruppo</p>
      <div class="chips">
        {#each app.data.groups as g (g.id)}<Chip label={g.name} selected={pocketEdit.groupId === g.id} onclick={() => (pocketEdit!.groupId = g.id)} />{/each}
      </div>
      <div class="row-input"><TextField label="Nuovo gruppo" bind:value={newGroup} /><Button variant="secondary" disabled={!newGroup.trim()} onclick={addGroup}>Aggiungi</Button></div>
      {@render colorPicker(pocketEdit.color, (c) => (pocketEdit!.color = c))}
      {@render iconPicker(pocketEdit.icon, pocketEdit.color, (i) => (pocketEdit!.icon = i))}
      <Toggle label="È un pocket Revolut" description="Le uscite generano l'arrotondamento nei Savings." bind:checked={pocketEdit.isRevolut} />
      <Toggle label="Riceve gli arrotondamenti (Savings)" checked={pocketEdit.role === 'savings'} onchange={(v) => (pocketEdit!.role = v ? 'savings' : undefined)} />
      <Toggle label="Archiviato" description="Nascosto da Home e inserimento; lo storico resta." bind:checked={pocketEdit.archived} />
      <Button size="lg" block disabled={!pocketEdit.name.trim() || !pocketEdit.groupId} onclick={savePocket}>Salva</Button>
    </div>
  {/if}
</BottomSheet>

<BottomSheet open={!!catEdit} title="Categoria" onclose={() => (catEdit = null)}>
  {#if catEdit}
    <div class="stack">
      <TextField label="Nome" bind:value={catEdit.name} />
      {@render colorPicker(catEdit.color, (c) => (catEdit!.color = c))}
      {@render iconPicker(catEdit.icon, catEdit.color, (i) => (catEdit!.icon = i))}
      <Toggle label="Archiviata" bind:checked={catEdit.archived} />
      <Button size="lg" block disabled={!catEdit.name.trim()} onclick={saveCategory}>Salva</Button>
    </div>
  {/if}
</BottomSheet>

<BottomSheet open={!!recEdit} title="Spesa fissa" onclose={() => (recEdit = null)}>
  {#if recEdit}
    <div class="stack">
      <TextField label="Nome" bind:value={recEdit.name} />
      <Segmented label="Tipo" bind:value={recEdit.kind} options={Object.entries(recKinds).map(([value, label]) => ({ value: value as Recurring['kind'], label }))} />
      {#if !recEdit.amountFromDebits}
        <TextField label="Importo" inputmode="decimal" bind:value={recEdit.amountText} error={recAmountError} />
      {:else}
        <p class="c-3 small">Importo calcolato dagli addebiti del pocket più i loro arrotondamenti.</p>
      {/if}
      <p class="flabel">{recEdit.kind === 'allocation' ? 'Da' : 'Pocket'}</p>
      <div class="chips">
        {#each app.activePockets as p (p.id)}<Chip label={p.name} color={color(p.color)} selected={recEdit.fromPocketId === p.id} onclick={() => (recEdit!.fromPocketId = p.id)} />{/each}
      </div>
      {#if recEdit.kind === 'allocation'}
        <p class="flabel">A</p>
        <div class="chips">
          {#each app.activePockets.filter((p) => p.id !== recEdit!.fromPocketId) as p (p.id)}<Chip label={p.name} color={color(p.color)} selected={recEdit.toPocketId === p.id} onclick={() => (recEdit!.toPocketId = p.id)} />{/each}
        </div>
        <Toggle label="Automatico con lo stipendio" description="Registrato da solo quando inserisci lo stipendio." checked={!!recEdit.auto} onchange={(v) => (recEdit!.auto = v || undefined)} />
        {#if app.data.pockets.find((p) => p.id === recEdit!.toPocketId)?.isRevolut}
          <p class="flabel">Quanto spostare a inizio mese</p>
          <Segmented
            label="Quanto spostare a inizio mese"
            value={recEdit.mode ?? 'full'}
            options={[
              { value: 'full', label: 'Pieno' },
              { value: 'topUp', label: 'Ricarica' },
              { value: 'reserve', label: 'Riserva' },
            ]}
            onchange={(v) => (recEdit!.mode = v === 'full' ? undefined : (v as 'topUp' | 'reserve'))}
          />
          <p class="c-3 small">
            {#if recEdit.mode === 'topUp'}Sposta solo quanto manca rispetto a quello che è rimasto sul pocket.
            {:else if recEdit.mode === 'reserve'}Se nel mese prima non è stato preso nulla sposta metà; se è stato preso meno dell'importo reintegra quanto preso più l'extra; altrimenti reintegra quanto preso.
            {:else}Sposta sempre l'importo pieno, anche se sul pocket è rimasto qualcosa.{/if}
          </p>
          {#if recEdit.mode === 'reserve'}
            <TextField label="Extra quando è stato preso meno dell'importo" inputmode="decimal" value={formatCents(recEdit.reserveExtra ?? 10000, { symbol: false })} onchange={(e) => (recEdit!.reserveExtra = parseEuroInput((e.currentTarget as HTMLInputElement).value) ?? undefined)} />
          {/if}
        {/if}
      {/if}
      {#if recEdit.kind === 'debit'}
        <TextField label="Giorno di addebito" inputmode="numeric" value={recEdit.day ? String(recEdit.day) : ''} oninput={(e) => (recEdit!.day = Number((e.currentTarget as HTMLInputElement).value) || undefined)} hint="Il giorno in cui te lo propongo da confermare." />
        <p class="flabel">Verso un altro pocket (facoltativo)</p>
        <p class="c-3 small">Se lo scegli, alla conferma registro un giroconto invece di una spesa (es. Generali → Fondo Pensione).</p>
        <div class="chips">
          {#each app.activePockets.filter((p) => p.id !== recEdit!.fromPocketId) as p (p.id)}<Chip label={p.name} color={color(p.color)} selected={recEdit.toPocketId === p.id} onclick={() => (recEdit!.toPocketId = recEdit!.toPocketId === p.id ? undefined : p.id)} />{/each}
        </div>
      {/if}
      {#if recEdit.kind === 'budget' || (recEdit.kind === 'debit' && !recEdit.toPocketId)}
        <p class="flabel">Categoria</p>
        <div class="chips">
          {#each app.data.categories.filter((c) => !c.system && !c.archived) as c (c.id)}<Chip label={c.name} icon={icon(c.icon)} color={color(c.color)} selected={recEdit.categoryId === c.id} onclick={() => (recEdit!.categoryId = c.id)} />{/each}
        </div>
      {/if}
      <Toggle label="Attiva" bind:checked={recEdit.active} />
      <Button size="lg" block disabled={!recEdit.name.trim() || !!recAmountError} onclick={saveRecurring}>Salva</Button>
      {#if app.data.recurring.some((r) => r.id === recEdit!.id)}
        <Button variant="ghost" onclick={async () => { await app.remove('recurring', recEdit!.id); recEdit = null; showToast('Voce eliminata'); }}>Elimina la voce</Button>
      {/if}
    </div>
  {/if}
</BottomSheet>

{#snippet colorPicker(current: PaletteColor, set: (c: PaletteColor) => void)}
  <p class="flabel">Colore</p>
  <div class="swatches" role="radiogroup" aria-label="Colore">
    {#each PALETTE as c (c)}
      <button class="swatch" role="radio" aria-checked={current === c} aria-label={c} style:--c={color(c)} class:on={current === c} onclick={() => set(c)}></button>
    {/each}
  </div>
{/snippet}

{#snippet iconPicker(current: string, c: PaletteColor, set: (i: string) => void)}
  <p class="flabel">Icona</p>
  <div class="icons" role="radiogroup" aria-label="Icona">
    {#each ICON_NAMES as name (name)}
      {@const I = icon(name)}
      <button class="icon-opt" role="radio" aria-checked={current === name} aria-label={name} class:on={current === name} style:--c={color(c)} onclick={() => set(name)}><I size={20} strokeWidth={1.75} /></button>
    {/each}
  </div>
{/snippet}

<style>
  .page {
    display: flex;
    flex-direction: column;
    gap: var(--sp-3);
    padding: calc(var(--sp-2) + env(safe-area-inset-top)) var(--gutter) var(--sp-7);
  }
  .sub-head {
    display: flex;
    align-items: center;
    gap: var(--sp-1);
    margin: var(--sp-2) 0;
  }
  .back {
    width: var(--tap);
    height: var(--tap);
    margin-left: calc(-1 * var(--sp-2));
    display: grid;
    place-items: center;
    border-radius: 50%;
  }
  .list {
    padding: var(--sp-1) var(--sp-4);
  }
  .nav-row {
    display: flex;
    align-items: center;
    gap: var(--sp-3);
    width: 100%;
    min-height: 60px;
    text-align: left;
  }
  .nav-row + .nav-row {
    border-top: 1px solid var(--hairline);
  }
  .nav-text {
    flex: 1;
    display: flex;
    flex-direction: column;
  }
  .nav-row :global(.chev) {
    color: var(--text-3);
  }
  .strong {
    font-weight: var(--fw-bold);
  }
  .small {
    font-size: var(--fs-callout);
  }
  .top {
    margin-top: var(--sp-3);
  }
  .bottom {
    margin-bottom: var(--sp-3);
  }
  .center {
    text-align: center;
  }
  .grow {
    flex: 1;
  }
  .storage {
    display: flex;
    align-items: center;
    gap: var(--sp-3);
  }
  .stack {
    display: grid;
    gap: var(--sp-3);
  }
  .version {
    text-align: center;
    font-size: var(--fs-caption);
    color: var(--text-3);
    margin-top: var(--sp-3);
  }
  .flabel {
    font-size: var(--fs-caption);
    font-weight: var(--fw-bold);
    color: var(--text-3);
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: var(--sp-2);
  }
  .row-input {
    display: flex;
    align-items: flex-end;
    gap: var(--sp-2);
  }
  .row-input :global(.field) {
    flex: 1;
  }
  .swatches {
    display: flex;
    flex-wrap: wrap;
    gap: var(--sp-2);
  }
  .swatch {
    width: 44px;
    height: 44px;
    border-radius: 50%;
    background: var(--c);
    box-shadow: inset 0 0 0 3px var(--surface);
    outline: 2px solid transparent;
  }
  .swatch.on {
    outline-color: var(--c);
  }
  .steps {
    margin: var(--sp-2) 0 0;
    padding-left: var(--sp-5);
    display: grid;
    gap: var(--sp-1);
  }
  .icons {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(44px, 1fr));
    gap: var(--sp-2);
  }
  .icon-opt {
    height: 44px;
    display: grid;
    place-items: center;
    border-radius: var(--r-sm);
    color: var(--text-2);
    background: var(--surface-2);
  }
  .icon-opt.on {
    color: var(--c);
    background: color-mix(in srgb, var(--c) 14%, var(--surface));
    box-shadow: inset 0 0 0 2px var(--c);
  }
</style>

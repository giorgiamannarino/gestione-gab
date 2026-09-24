<script lang="ts" module>
  export type Tab = 'home' | 'movimenti' | 'piano' | 'statistiche';
</script>

<script lang="ts">
  import { ArrowRightLeft, CalendarCheck, ChartPie, House, Plus } from '@lucide/svelte';

  interface Props {
    active: Tab;
    onnavigate: (tab: Tab) => void;
    onadd: () => void;
  }

  let { active, onnavigate, onadd }: Props = $props();

  const left = [
    { id: 'home', label: 'Home', icon: House },
    { id: 'movimenti', label: 'Movimenti', icon: ArrowRightLeft },
  ] as const;
  const right = [
    { id: 'piano', label: 'Piano', icon: CalendarCheck },
    { id: 'statistiche', label: 'Statistiche', icon: ChartPie },
  ] as const;
</script>

{#snippet tab(t: { id: Tab; label: string; icon: typeof House })}
  <button class="tab" class:active={active === t.id} aria-current={active === t.id ? 'page' : undefined} onclick={() => onnavigate(t.id)}>
    <t.icon size={22} strokeWidth={active === t.id ? 2 : 1.75} />
    <span>{t.label}</span>
  </button>
{/snippet}

<nav class="tabbar" aria-label="Navigazione principale">
  {#each left as t (t.id)}{@render tab(t)}{/each}
  <button class="fab" aria-label="Nuovo movimento" onclick={onadd}><Plus size={26} strokeWidth={2.25} /></button>
  {#each right as t (t.id)}{@render tab(t)}{/each}
</nav>

<style>
  .tabbar {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    align-items: center;
    padding: var(--sp-2) var(--sp-2) calc(var(--sp-2) + env(safe-area-inset-bottom));
    background: var(--tabbar-bg);
    backdrop-filter: blur(20px) saturate(1.4);
    -webkit-backdrop-filter: blur(20px) saturate(1.4);
    border-top: 1px solid var(--hairline);
  }
  .tab {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    min-height: 48px;
    font-size: var(--fs-micro);
    font-weight: var(--fw-medium);
    color: var(--text-3);
    transition: color var(--dur-base);
  }
  .tab.active {
    color: var(--accent-ink);
    font-weight: var(--fw-bold);
  }
  .fab {
    justify-self: center;
    width: 52px;
    height: 52px;
    display: grid;
    place-items: center;
    border-radius: 18px;
    background: var(--accent);
    color: var(--on-accent);
    box-shadow: 0 6px 16px color-mix(in srgb, var(--accent) 35%, transparent);
    transition: transform var(--dur-fast) var(--ease-out);
  }
  .fab:active {
    transform: scale(0.92);
  }
</style>

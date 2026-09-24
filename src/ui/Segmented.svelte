<script lang="ts" generics="T extends string">
  interface Props {
    options: { value: T; label: string }[];
    value: T;
    label: string;
    onchange?: (value: T) => void;
  }

  let { options, value = $bindable(), label, onchange }: Props = $props();

  function select(v: T) {
    value = v;
    onchange?.(v);
  }
</script>

<div class="seg" role="radiogroup" aria-label={label} style:--n={options.length}>
  <span
    class="thumb"
    aria-hidden="true"
    style:transform="translateX({options.findIndex((o) => o.value === value) * 100}%)"
  ></span>
  {#each options as o (o.value)}
    <button role="radio" aria-checked={value === o.value} class:on={value === o.value} onclick={() => select(o.value)}>
      {o.label}
    </button>
  {/each}
</div>

<style>
  .seg {
    position: relative;
    display: grid;
    grid-template-columns: repeat(var(--n), 1fr);
    padding: 3px;
    border-radius: 12px;
    background: var(--surface-3);
  }
  .thumb {
    position: absolute;
    top: 3px;
    bottom: 3px;
    left: 3px;
    width: calc((100% - 6px) / var(--n));
    border-radius: 9px;
    background: var(--surface);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
    transition: transform var(--dur-slow) var(--ease-out);
  }
  button {
    position: relative;
    min-height: 38px;
    font-size: var(--fs-callout);
    font-weight: var(--fw-medium);
    color: var(--text-2);
    transition: color var(--dur-base);
  }
  button.on {
    color: var(--text);
    font-weight: var(--fw-bold);
  }
</style>

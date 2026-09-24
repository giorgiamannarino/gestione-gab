<script lang="ts">
  interface Props {
    checked?: boolean;
    label: string;
    description?: string;
    onchange?: (checked: boolean) => void;
  }

  let { checked = $bindable(false), label, description, onchange }: Props = $props();
  const uid = $props.id();

  function toggle() {
    checked = !checked;
    onchange?.(checked);
  }
</script>

<button class="toggle-row" role="switch" aria-checked={checked} aria-describedby={description ? `d-${uid}` : undefined} onclick={toggle}>
  <span class="text">
    <span class="label">{label}</span>
    {#if description}<span class="desc" id="d-{uid}">{description}</span>{/if}
  </span>
  <span class="track" class:on={checked} aria-hidden="true"><span class="knob"></span></span>
</button>

<style>
  .toggle-row {
    display: flex;
    align-items: center;
    gap: var(--sp-3);
    width: 100%;
    min-height: 56px;
    text-align: left;
  }
  .text {
    flex: 1;
    display: flex;
    flex-direction: column;
  }
  .label {
    font-weight: var(--fw-medium);
  }
  .desc {
    font-size: var(--fs-callout);
    color: var(--text-3);
  }
  .track {
    flex: none;
    width: 51px;
    height: 31px;
    padding: 2px;
    border-radius: var(--r-full);
    background: var(--surface-3);
    box-shadow: inset 0 0 0 1px var(--hairline);
    transition: background-color var(--dur-base) var(--ease-out);
  }
  .track.on {
    background: var(--accent);
  }
  .knob {
    display: block;
    width: 27px;
    height: 27px;
    border-radius: 50%;
    background: #fff;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.18);
    transition: transform var(--dur-base) var(--ease-spring);
  }
  .on .knob {
    transform: translateX(20px);
  }
</style>

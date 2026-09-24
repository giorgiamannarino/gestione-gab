// Pagina di sviluppo: design system. Non fa parte della build.
import '@fontsource-variable/manrope';
import '../styles/tokens.css';
import '../styles/base.css';
import { mount } from 'svelte';
import DesignSystem from './DesignSystem.svelte';

mount(DesignSystem, { target: document.getElementById('app')! });

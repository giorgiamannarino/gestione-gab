import '@fontsource-variable/manrope';
import './styles/tokens.css';
import './styles/base.css';
import { mount } from 'svelte';
import App from './App.svelte';
import { updater } from './lib/app/pwa.svelte';
import { applyTheme } from './lib/ui/theme';

applyTheme();
updater.start();

const app = mount(App, { target: document.getElementById('app')! });

export default app;

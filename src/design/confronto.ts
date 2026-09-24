// Pagina di sviluppo: confronto tra le tre direzioni visive. Non fa parte della build.
import '@fontsource-variable/inter';
import '@fontsource-variable/geist';
import '@fontsource-variable/manrope';
import './directions.css';
import { mount } from 'svelte';
import Confronto from './Confronto.svelte';

mount(Confronto, { target: document.getElementById('app')! });

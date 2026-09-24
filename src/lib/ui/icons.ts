/** Icone di pocket e categorie: nome (salvato nei dati) → componente Lucide. */
import type { Component } from 'svelte';
import {
  ArrowRightLeft, Baby, Book, Briefcase, Car, CircleDashed, Coins, Dog, Film, Fuel, Gamepad2, Gift,
  GraduationCap, HeartPulse, Heart, House, Landmark, Music, Phone, PiggyBank, Plane, ReceiptEuro, Repeat,
  Scale, Shirt, ShieldCheck, ShoppingCart, Sofa, Sparkles, TrendingUp, Utensils, Wallet, Wifi, Zap,
} from '@lucide/svelte';
import type { PaletteColor } from '../domain/types';

type Icon = Component<{ size?: number; strokeWidth?: number }>;

export const ICONS: Record<string, Icon> = {
  'landmark': Landmark, 'piggy-bank': PiggyBank, 'wallet': Wallet, 'coins': Coins, 'zap': Zap,
  'shield-check': ShieldCheck, 'trending-up': TrendingUp, 'repeat': Repeat, 'heart': Heart, 'sofa': Sofa,
  'sparkles': Sparkles, 'car': Car, 'shopping-cart': ShoppingCart, 'utensils': Utensils, 'fuel': Fuel,
  'gift': Gift, 'heart-pulse': HeartPulse, 'circle-dashed': CircleDashed, 'arrow-right-left': ArrowRightLeft,
  'scale': Scale, 'plane': Plane, 'gamepad-2': Gamepad2, 'shirt': Shirt, 'book': Book, 'dog': Dog,
  'baby': Baby, 'graduation-cap': GraduationCap, 'phone': Phone, 'wifi': Wifi, 'music': Music, 'film': Film,
  'house': House, 'briefcase': Briefcase, 'receipt-euro': ReceiptEuro,
};

export const ICON_NAMES = Object.keys(ICONS).filter((n) => !['arrow-right-left', 'scale'].includes(n));

export function icon(name: string | undefined): Icon {
  return (name && ICONS[name]) || CircleDashed;
}

export const PALETTE: PaletteColor[] = ['indaco', 'arancio', 'acqua', 'ocra', 'cielo', 'verde', 'viola', 'magenta', 'ardesia'];

export function color(c: PaletteColor | undefined): string {
  return `var(--pk-${c ?? 'ardesia'})`;
}

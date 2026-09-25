/**
 * Notifiche locali. Senza server una web app può mostrare notifiche solo quando è in esecuzione:
 * per la notifica puntuale delle 20 con l'app chiusa si usa un'automazione di Comandi Rapidi (vedi Impostazioni).
 * Su iPhone le notifiche funzionano solo con l'app installata sulla schermata Home (iOS 16.4+).
 */
export const REMINDER_HOUR = 20;
export const REMINDER_TEXT = 'Hai inserito le spese di oggi? Non ti scordare!';

export type NotifyState = 'unsupported' | 'default' | 'granted' | 'denied';

export function notifyState(): NotifyState {
  if (typeof Notification === 'undefined') return 'unsupported';
  return Notification.permission;
}

export async function requestNotify(): Promise<NotifyState> {
  if (typeof Notification === 'undefined') return 'unsupported';
  try {
    return await Notification.requestPermission();
  } catch {
    return notifyState();
  }
}

export async function notify(title: string, body: string): Promise<boolean> {
  if (notifyState() !== 'granted') return false;
  const icon = `${import.meta.env.BASE_URL}icons/icon-192.png`;
  try {
    const reg = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : undefined;
    if (reg) await reg.showNotification(title, { body, icon, badge: icon, tag: 'conti-promemoria' });
    else new Notification(title, { body, icon });
    return true;
  } catch {
    return false;
  }
}

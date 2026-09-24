/** Modalità privacy: quando attiva, tutti gli importi sono nascosti. */
export const privacy = $state({ hidden: false });

export function togglePrivacy(): void {
  privacy.hidden = !privacy.hidden;
}

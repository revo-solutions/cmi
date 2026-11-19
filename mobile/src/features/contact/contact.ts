import type { Relationship, Sex } from '../../api/generated/client';
import type { Position } from '../../lib/location';

// What the person is to the contact, as the notices read it: "sua mãe, Maria" (docs/escopo.md, parentesco).
const relationshipLabels: Record<Relationship, string> = {
  Mother: 'Mãe',
  Father: 'Pai',
  Wife: 'Esposa',
  Husband: 'Marido',
  Grandmother: 'Avó',
  Grandfather: 'Avô',
  Aunt: 'Tia',
  Uncle: 'Tio',
  Friend: 'Amigo ou amiga',
  Other: 'Outro',
};

export function relationshipLabel(relationship: Relationship, sex: Sex) {
  if (relationship === 'Friend' && sex) {
    return sex === 'Female' ? 'Amiga' : 'Amigo';
  }
  return relationshipLabels[relationship];
}

// ContactModelValidator rejects longer names in the sync batch.
export const maxNameLength = 200;
export const maxPhoneDigits = 11;

export function phoneDigits(phone: string) {
  const digits = phone.replace(/\D/g, '');
  if (/^\s*\+55/.test(phone) || (/^\s*55/.test(phone) && /^55\d{10,11}$/.test(digits))) {
    return digits.slice(2);
  }
  return digits;
}

export function formatPhone(digits: string) {
  if (digits.length <= 2) {
    return digits;
  }
  const split = digits.length === maxPhoneDigits ? 7 : 6;
  const ending = digits.slice(split);
  return `(${digits.slice(0, 2)}) ${digits.slice(2, split)}${ending && `-${ending}`}`;
}

export function phoneProblem(digits: string) {
  if (!digits) {
    return 'Escreva o telefone.';
  }
  if (digits.length < 10 || digits.length > maxPhoneDigits) {
    return 'Escreva o telefone com o DDD, por exemplo (11) 98765-4321.';
  }
  return '';
}

function dialable(phone: string) {
  return phone.replace(/[^\d+]/g, '');
}

export function callUrl(phone: string) {
  return `tel:${dialable(phone)}`;
}

// iOS reads the body after "&", Android after "?".
export function smsUrl(phone: string, body: string, platform: 'ios' | 'android') {
  return `sms:${dialable(phone)}${platform === 'ios' ? '&' : '?'}body=${encodeURIComponent(body)}`;
}

// The code goes as a word of its own: the server's webhook looks for it in the contact's message.
export function linkMessage(personName: string | null, code: string) {
  return `Quero receber os avisos ${personName ? `de ${personName}` : 'do Central Melhor Idade'}. Código ${code}`;
}

// Opens a chat with the app's number on the phone that taps it, so it must be the contact's phone, never this one.
export function whatsAppLinkUrl(appNumber: string, message: string) {
  return `https://wa.me/${appNumber.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`;
}

// The same link the server puts in the WhatsApp message: Google's, because the contact's phone is unknown. It opens
// Google Maps on Android, and Google Maps or the browser on an iPhone.
export function mapsUrl({ latitude, longitude }: Position) {
  return `https://www.google.com/maps/search/?api=1&query=${latitude.toFixed(6)},${longitude.toFixed(6)}`;
}

export function helpMessage(personName: string | null, position: Position | null = null) {
  return `${personName ? `Aqui é ${personName}. ` : ''}Preciso de ajuda. Por favor, me ligue.` +
    (position ? ` Estou aqui: ${mapsUrl(position)}` : '');
}

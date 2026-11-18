import { describe, expect, it } from '@jest/globals';

import {
  callUrl, formatPhone, helpMessage, linkMessage, phoneDigits, phoneProblem, smsUrl, whatsAppLinkUrl,
} from './contact';

describe('phone formatting', () => {
  it('keeps the digits and removes the country code from pasted Brazilian numbers', () => {
    expect(phoneDigits('a(11) 98765-4321')).toBe('11987654321');
    expect(phoneDigits('+55 (11) 98765-4321')).toBe('11987654321');
    expect(phoneDigits('5511987654321')).toBe('11987654321');
    expect(phoneDigits('(55) 98765-4321')).toBe('55987654321');
  });

  it('formats partial numbers, landlines and mobile numbers as they are typed', () => {
    expect(formatPhone('11')).toBe('11');
    expect(formatPhone('119')).toBe('(11) 9');
    expect(formatPhone('1133334444')).toBe('(11) 3333-4444');
    expect(formatPhone('11987654321')).toBe('(11) 98765-4321');
  });

  it('reformats the digits left after backspacing', () => {
    expect(formatPhone(phoneDigits('(11) 98765-432'))).toBe('(11) 9876-5432');
    expect(formatPhone(phoneDigits('(11) '))).toBe('11');
  });
});

describe('phoneProblem', () => {
  it('accepts ten or eleven digits', () => {
    expect(phoneProblem('11987654321')).toBe('');
    expect(phoneProblem('1133334444')).toBe('');
  });

  it('asks for the full number when the digit count is wrong', () => {
    expect(phoneProblem('987654321')).not.toBe('');
    expect(phoneProblem('119876543219')).not.toBe('');
    expect(phoneProblem('')).toBe('Escreva o telefone.');
  });
});

describe('links', () => {
  it('dials only the digits and the plus sign', () => {
    expect(callUrl('+55 (11) 98765-4321')).toBe('tel:+5511987654321');
  });

  it('puts the body where each platform reads it', () => {
    expect(smsUrl('(11) 98765-4321', 'Oi, tudo bem?', 'android')).toBe('sms:11987654321?body=Oi%2C%20tudo%20bem%3F');
    expect(smsUrl('(11) 98765-4321', 'Oi', 'ios')).toBe('sms:11987654321&body=Oi');
  });

  it('opens a chat with the app number and the code as a word of its own', () => {
    const message = linkMessage('Maria', 'K7P2QX9M');
    expect(message).toBe('Quero receber os avisos de Maria. Código K7P2QX9M');
    expect(whatsAppLinkUrl('+55 (11) 4000-1234', message))
      .toBe('https://wa.me/551140001234?text=Quero%20receber%20os%20avisos%20de%20Maria.%20C%C3%B3digo%20K7P2QX9M');
  });

  it('signs the help message when the name is known', () => {
    expect(helpMessage('Maria')).toBe('Aqui é Maria. Preciso de ajuda. Por favor, me ligue.');
    expect(helpMessage(null)).toBe('Preciso de ajuda. Por favor, me ligue.');
  });
});

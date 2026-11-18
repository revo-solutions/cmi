import { randomUUID } from 'expo-crypto';
import type { SQLiteDatabase } from 'expo-sqlite';

import type { Relationship } from '../../api/generated/client';
import { useRows } from '../../lib/db';
import { enqueue, updatedAfter } from '../../lib/outbox';
import { changeAccount } from '../../lib/sync';
import { queueMedication, type MedicationRow } from '../medications/store';

type ContactRow = { id: string; name: string; phone: string; relationship: Relationship; updated_at: string };

export type Contact = { id: string; name: string; phone: string; relationship: Relationship };

export type ContactInput = Omit<Contact, 'id'>;

export function useContact() {
  const rows = useRows<ContactRow>('SELECT * FROM contact LIMIT 1');
  const row = rows?.[0];
  return rows && (row ? { id: row.id, name: row.name, phone: row.phone, relationship: row.relationship } : null);
}

// A removal or an unshared medication still waiting for the server: until it is sent, the server keeps sharing.
export function usePendingRevocation() {
  const rows = useRows<{ type: string; id: string }>(`
    SELECT type, json_extract(payload, '$.id') AS id FROM outbox
    WHERE (type = 'contacts' AND json_extract(payload, '$.deleted') = 1)
       OR (type = 'medications' AND json_extract(payload, '$.sharedWithContact') = 0)
  `);
  return rows && {
    contact: rows.some((row) => row.type === 'contacts'),
    medications: new Set(rows.filter((row) => row.type === 'medications').map((row) => row.id)),
  };
}

// Every medication, or only medicationId.
async function setSharing(transaction: SQLiteDatabase, shared: boolean, medicationId: string | null = null) {
  const rows = await transaction.getAllAsync<MedicationRow>(
    'SELECT * FROM medications WHERE deleted = 0 AND shared_with_contact = ? AND (? IS NULL OR id = ?)',
    shared ? 0 : 1, medicationId, medicationId,
  );
  for (const existing of rows) {
    await queueMedication(transaction, await transaction.getFirstAsync<MedicationRow>(
      'UPDATE medications SET shared_with_contact = ?, updated_at = ? WHERE id = ? RETURNING *',
      shared ? 1 : 0, updatedAfter(existing.updated_at), existing.id,
    ));
  }
}

// A new contact starts with every medication shared; the person then sees the list to uncheck any (docs/escopo.md).
export async function saveContact(input: ContactInput) {
  await changeAccount(async (transaction) => {
    const existing = await transaction.getFirstAsync<ContactRow>('SELECT * FROM contact LIMIT 1');
    const id = existing?.id ?? randomUUID();
    const updatedAt = updatedAfter(existing?.updated_at);
    await transaction.runAsync(`
      INSERT INTO contact (id, name, phone, relationship, updated_at) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT (id) DO UPDATE SET name = excluded.name, phone = excluded.phone,
        relationship = excluded.relationship, updated_at = excluded.updated_at
    `, id, input.name, input.phone, input.relationship, updatedAt);
    await enqueue(transaction, 'contacts', { id, ...input, deleted: false, updatedAt });
    if (!existing) {
      await setSharing(transaction, true);
    }
  });
}

export async function shareMedication(medicationId: string, shared: boolean) {
  await changeAccount(async (transaction) => {
    if (await transaction.getFirstAsync('SELECT id FROM contact LIMIT 1')) {
      await setSharing(transaction, shared, medicationId);
    }
  });
}

// The server removes the contact and stops sharing; the device does the same, so it shows what the server will have.
export async function removeContact() {
  await changeAccount(async (transaction) => {
    const existing = await transaction.getFirstAsync<ContactRow>('SELECT * FROM contact LIMIT 1');
    if (!existing) {
      return;
    }
    await transaction.runAsync('DELETE FROM contact WHERE id = ?', existing.id);
    await setSharing(transaction, false);
    await enqueue(transaction, 'contacts', {
      id: existing.id,
      name: existing.name,
      phone: existing.phone,
      relationship: existing.relationship,
      deleted: true,
      updatedAt: updatedAfter(existing.updated_at),
    });
  });
}

/** Explicit adapters for the two deployed contact shapes; unknown rows stay quarantined. */
import type { D1Database } from '@cloudflare/workers-types';

type Column = { name: string; type: string; pk: number };
export class ContactSchemaUnavailable extends Error {}
export interface ContactMessageInput {
  tenantId: string; classification: 'contact' | 'chat'; name: string; phone: string;
  email?: string | null; category: string; content: string; direction: 'customer' | 'admin';
}
export async function contactMessageRepository(db: D1Database) {
  const metadata = await db.prepare('PRAGMA table_info(contact_messages)').all<Column>();
  const columns = new Set(metadata.results.map((column) => column.name));
  const canonical = ['content', 'category', 'status'].every((column) => columns.has(column));
  const legacy = ['message', 'direction', 'read_at'].every((column) => columns.has(column));
  if (!['id', 'name', 'phone', 'created_at', 'tenant_id', 'classification'].every((column) => columns.has(column))
    || (!canonical && !legacy)) throw new ContactSchemaUnavailable('Contact schema requires privacy upgrade');
  const idColumn = metadata.results.find((column) => column.name === 'id');
  if (!idColumn || idColumn.pk !== 1 || !['TEXT', 'INTEGER'].includes(idColumn.type.toUpperCase()))
    throw new ContactSchemaUnavailable('Unsupported contact identity');
  const integerId = idColumn.type.toUpperCase() === 'INTEGER';
  const text = canonical && legacy ? 'COALESCE(cm.content, cm.message)' : canonical ? 'cm.content' : 'cm.message';
  const direction = (alias: string) => {
    const categoryDirection = `CASE WHEN ${alias}.category = 'chat_admin' THEN 'admin' ELSE 'customer' END`;
    return canonical && legacy ? `COALESCE(${alias}.direction, ${categoryDirection})`
      : canonical ? categoryDirection : `${alias}.direction`;
  };
  const readAt = (alias: string) => {
    const statusReadAt = `CASE WHEN ${alias}.status = 'read' THEN ${alias}.created_at ELSE NULL END`;
    return canonical && legacy ? `COALESCE(${alias}.read_at, ${statusReadAt})`
      : canonical ? statusReadAt : `${alias}.read_at`;
  };
  const unread = (alias: string) => `${direction(alias)} = 'customer' AND ${readAt(alias)} IS NULL`;
  const allowed = (alias: string) => `${alias}.tenant_id = ? AND ${alias}.classification IN ('contact', 'chat')`
    + (columns.has('category') ? ` AND COALESCE(${alias}.category, '') <> 'recruitment'` : '');
  return {
    async insert(input: ContactMessageInput): Promise<string | number> {
      const id = `MSG_${crypto.randomUUID()}`;
      const values: Record<string, string | null> = {
        ...(!integerId ? { id } : {}), name: input.name, phone: input.phone,
        tenant_id: input.tenantId, classification: input.classification, created_at: new Date().toISOString(),
      };
      if (columns.has('email')) values.email = input.email || null;
      if (columns.has('content')) values.content = input.content;
      if (columns.has('category')) values.category = input.category;
      if (columns.has('status')) values.status = input.direction === 'admin' ? 'read' : 'unread';
      if (columns.has('message')) values.message = input.content;
      if (columns.has('direction')) values.direction = input.direction;
      if (columns.has('read_at')) values.read_at = input.direction === 'admin' ? values.created_at : null;
      const names = Object.keys(values);
      const result = await db.prepare(`INSERT INTO contact_messages (${names.join(', ')}) VALUES (${names.map(() => '?').join(', ')})`)
        .bind(...Object.values(values)).run();
      return integerId ? Number(result.meta.last_row_id) : id;
    },
    async conversations(tenantId: string) {
      return (await db.prepare(`SELECT cm.phone, cm.name, ${text} AS last_message,
        ${direction('cm')} AS last_direction, cm.created_at AS last_message_at,
        (SELECT COUNT(*) FROM contact_messages counted WHERE counted.phone = cm.phone AND ${allowed('counted')}) AS message_count,
        (SELECT COUNT(*) FROM contact_messages unread WHERE unread.phone = cm.phone AND ${allowed('unread')}
          AND ${unread('unread')}) AS unread_count
        FROM contact_messages cm WHERE ${allowed('cm')} AND NOT EXISTS (
          SELECT 1 FROM contact_messages newer WHERE newer.phone = cm.phone AND ${allowed('newer')}
          AND (COALESCE(newer.created_at, '') > COALESCE(cm.created_at, '')
          OR (COALESCE(newer.created_at, '') = COALESCE(cm.created_at, '') AND newer.rowid > cm.rowid)))
        ORDER BY cm.created_at DESC, cm.rowid DESC`)
        .bind(tenantId, tenantId, tenantId, tenantId).all()).results;
    },
    async history(tenantId: string, phone: string) {
      // No mutation of the unrelated chat_messages table: ownership there is not established.
      const updates = [];
      if (columns.has('read_at')) updates.push('read_at = ?');
      if (columns.has('status')) updates.push("status = 'read'");
      const params = columns.has('read_at') ? [new Date().toISOString(), phone, tenantId] : [phone, tenantId];
      await db.prepare(`UPDATE contact_messages AS cm SET ${updates.join(', ')} WHERE cm.phone = ? AND ${allowed('cm')}
        AND ${unread('cm')}`)
        .bind(...params).run();
      return (await db.prepare(`SELECT cm.id, cm.name, cm.phone, ${text} AS message,
        ${direction('cm')} AS direction, cm.created_at, ${readAt('cm')} AS read_at
        FROM contact_messages cm WHERE cm.phone = ? AND ${allowed('cm')} ORDER BY cm.created_at ASC, cm.rowid ASC`)
        .bind(phone, tenantId).all()).results;
    },
  };
}

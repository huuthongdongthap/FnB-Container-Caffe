import type { MixpostEnv } from './types';

export async function resolveTemplate(template: string, env: MixpostEnv): Promise<string> {
  let content = template;

  if (content.includes('{{total_customers}}') && env.AURA_DB) {
    const { count } = await env.AURA_DB.prepare('SELECT COUNT(*) as count FROM customers').first<{ count: number }>() || { count: 0 };
    content = content.replace('{{total_customers}}', String(count));
  }

  if (content.includes('{{today_orders}}') && env.AURA_DB) {
    const today = new Date().toISOString().slice(0, 10);
    const { count } = await env.AURA_DB.prepare(
      "SELECT COUNT(*) as count FROM orders WHERE DATE(created_at) = ? AND status != 'cancelled'"
    ).bind(today).first<{ count: number }>() || { count: 0 };
    content = content.replace('{{today_orders}}', String(count));
  }

  return content;
}

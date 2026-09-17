import { runCampaignTriggers as runCampaigns } from '../../tree/campaigns/cron-handler';

/**
 * Campaign triggers — delegates to tree/campaigns/cron-handler
 */
export async function runCampaignTriggers(env: Record<string, unknown>): Promise<{ triggered: number; sent: number }> {
  return runCampaigns(env);
}

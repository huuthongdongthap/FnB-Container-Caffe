export async function isAllowedCronLocationForTenant(
  db: any,
  locationId: unknown,
  tenantId: string
): Promise<boolean> {
  if (locationId === undefined || locationId === null || String(locationId).trim() === '') {
    return true;
  }
  if (!tenantId || tenantId === '*') return true;
  const locId = String(locationId).trim();
  if (locId === tenantId) return true;
  try {
    const locRow = await db
      .prepare('SELECT tenant_id FROM locations WHERE id = ? LIMIT 1')
      .bind(locId)
      .first();
    if (locRow && locRow.tenant_id !== undefined && locRow.tenant_id !== null && String(locRow.tenant_id).trim() !== '') {
      return String(locRow.tenant_id).trim() === tenantId;
    }
  } catch {
    // Optional locations table
  }
  if (tenantId !== 'default') {
    return false;
  }
  if (/^tenant[-_]/i.test(locId) && locId !== 'default') {
    return false;
  }
  return true;
}

export async function checkCronJobTenant(
  db: any,
  job: Record<string, any> | null | undefined,
  tenantId: string
): Promise<boolean> {
  if (!job) return false;
  if (!tenantId || tenantId === '*') return true;

  if (job.tenant_id !== undefined && job.tenant_id !== null && String(job.tenant_id).trim() !== '') {
    return String(job.tenant_id).trim() === tenantId;
  }

  if (job.payload) {
    try {
      const parsed = typeof job.payload === 'string' ? JSON.parse(job.payload) : job.payload;
      const payloadTenant = parsed?.tenant_id ?? parsed?.tenantId;
      if (payloadTenant && String(payloadTenant).trim() !== '') {
        return String(payloadTenant).trim() === tenantId;
      }
    } catch {
      // Ignore non-JSON payload
    }
  }

  if (job.created_by) {
    try {
      const creator = await db
        .prepare('SELECT tenant_id FROM users WHERE id = ? LIMIT 1')
        .bind(job.created_by)
        .first();
      if (creator && creator.tenant_id !== undefined && creator.tenant_id !== null && String(creator.tenant_id).trim() !== '') {
        return String(creator.tenant_id).trim() === tenantId;
      }
    } catch {
      // Optional users table
    }
  }

  if (job.id) {
    try {
      const auditRow = await db
        .prepare(
          `SELECT metadata, details FROM audit_logs
           WHERE (entity_id = ? OR resource_id = ?) AND action = 'cron_job_create'
           ORDER BY created_at DESC LIMIT 1`
        )
        .bind(job.id, job.id)
        .first();
      const rawMeta = auditRow?.metadata ?? auditRow?.details;
      if (rawMeta) {
        const parsed = typeof rawMeta === 'string' ? JSON.parse(rawMeta) : rawMeta;
        const metaTenant = parsed?.tenant_id ?? parsed?.tenantId;
        if (metaTenant && String(metaTenant).trim() !== '') {
          return String(metaTenant).trim() === tenantId;
        }
      }
    } catch {
      // Optional audit_logs table
    }
  }

  if (job.location_id !== undefined && job.location_id !== null && String(job.location_id).trim() !== '') {
    return isAllowedCronLocationForTenant(db, job.location_id, tenantId);
  }

  return tenantId === 'default';
}

export function formatJob(j: Record<string, any>) {
  return {
    ...j,
    cronExpression: j.cron_expression,
    timeoutSeconds: j.timeout_seconds,
    maxRetries: j.max_retries,
    retryDelaySeconds: j.retry_delay_seconds,
    isActive: j.is_active,
    lastRunAt: j.last_run_at,
    nextRunAt: j.next_run_at,
    successCount: j.success_count,
    failureCount: j.failure_count,
    lastStatus: j.last_status,
    lastError: j.last_error,
    createdAt: j.created_at,
    updatedAt: j.updated_at,
  };
}

export function formatRun(r: Record<string, any>) {
  return {
    ...r,
    jobId: r.job_id,
    startedAt: r.started_at,
    completedAt: r.completed_at,
    durationMs: r.duration_ms,
    createdAt: r.created_at,
  };
}

export async function isAllowedCronLocationForTenant(
  db: any,
  locationId: unknown,
  tenantId: string
): Promise<boolean> {
  if (locationId === undefined || locationId === null || String(locationId).trim() === '') {
    return true;
  }
  const normTenant = (tenantId || '').trim() || 'default';
  if (normTenant === '*') return true;
  const locId = String(locationId).trim();
  if (locId === normTenant) return true;
  try {
    const locRow = await db
      .prepare('SELECT tenant_id FROM locations WHERE id = ? LIMIT 1')
      .bind(locId)
      .first();
    if (locRow && locRow.tenant_id !== undefined && locRow.tenant_id !== null && String(locRow.tenant_id).trim() !== '') {
      return String(locRow.tenant_id).trim() === normTenant;
    }
  } catch {
    // Optional locations table
  }
  if (normTenant !== 'default') {
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
  const normTenant = (tenantId || '').trim() || 'default';
  if (normTenant === '*') return true;

  if (job.tenant_id !== undefined && job.tenant_id !== null && String(job.tenant_id).trim() !== '') {
    return String(job.tenant_id).trim() === normTenant;
  }

  if (job.created_by) {
    try {
      const creator = await db
        .prepare('SELECT tenant_id FROM users WHERE id = ? LIMIT 1')
        .bind(job.created_by)
        .first();
      if (creator && creator.tenant_id !== undefined && creator.tenant_id !== null && String(creator.tenant_id).trim() !== '') {
        return String(creator.tenant_id).trim() === normTenant;
      }
    } catch {
      // Optional users table
    }
  }

  if (job.payload) {
    try {
      const parsed = typeof job.payload === 'string' ? JSON.parse(job.payload) : job.payload;
      const payloadTenant = parsed?.tenant_id ?? parsed?.tenantId;
      if (payloadTenant && String(payloadTenant).trim() !== '') {
        return String(payloadTenant).trim() === normTenant;
      }
    } catch {
      // Ignore non-JSON payload
    }
  }

  const auditCandidateIds = [job.id, job.job_id].filter((v): v is string => typeof v === 'string' && v.trim() !== '');
  for (const candidateId of auditCandidateIds) {
    try {
      let auditRow: any = null;
      try {
        auditRow = await db
          .prepare(
            `SELECT metadata, details, tenant_id FROM audit_logs
             WHERE (entity_id = ? OR resource_id = ?) AND action IN ('cron_job_create', 'cron_job_trigger', 'cron_run_retry')
             ORDER BY created_at DESC LIMIT 1`
          )
          .bind(candidateId, candidateId)
          .first();
      } catch {
        auditRow = await db
          .prepare(
            `SELECT metadata, details FROM audit_logs
             WHERE (entity_id = ? OR resource_id = ?) AND action IN ('cron_job_create', 'cron_job_trigger', 'cron_run_retry')
             ORDER BY created_at DESC LIMIT 1`
          )
          .bind(candidateId, candidateId)
          .first();
      }
      if (auditRow?.tenant_id && String(auditRow.tenant_id).trim() !== '') {
        return String(auditRow.tenant_id).trim() === normTenant;
      }
      const rawMeta = auditRow?.metadata ?? auditRow?.details;
      if (rawMeta) {
        const parsed = typeof rawMeta === 'string' ? JSON.parse(rawMeta) : rawMeta;
        const metaTenant = parsed?.tenant_id ?? parsed?.tenantId;
        if (metaTenant && String(metaTenant).trim() !== '') {
          return String(metaTenant).trim() === normTenant;
        }
      }
    } catch {
      // Optional audit_logs table
    }
  }

  if (job.location_id !== undefined && job.location_id !== null && String(job.location_id).trim() !== '') {
    return isAllowedCronLocationForTenant(db, job.location_id, normTenant);
  }

  return normTenant === 'default';
}

export function hasExplicitCronTenantId(row: Record<string, any> | null | undefined): boolean {
  return Boolean(row && row.tenant_id !== undefined && row.tenant_id !== null && String(row.tenant_id).trim() !== '');
}

export function resolveCronEntityTenant(
  row: Record<string, any> | null | undefined,
  fallbackJob?: Record<string, any> | null | undefined
): string | null {
  for (const candidate of [row, fallbackJob]) {
    if (!candidate) continue;
    if (hasExplicitCronTenantId(candidate)) {
      const t = String(candidate.tenant_id).trim();
      if (t && t !== '*') return t;
    }
    if (candidate.payload) {
      try {
        const parsed = typeof candidate.payload === 'string' ? JSON.parse(candidate.payload) : candidate.payload;
        const payloadTenant = parsed?.tenant_id ?? parsed?.tenantId;
        if (payloadTenant !== undefined && payloadTenant !== null) {
          const t = String(payloadTenant).trim();
          if (t && t !== '*') return t;
        }
      } catch {
        // Ignore non-JSON payload
      }
    }
    if (candidate.location_id !== undefined && candidate.location_id !== null) {
      const loc = String(candidate.location_id).trim();
      if (loc && loc !== '*') return loc;
    }
  }
  return null;
}

export function matchesCronRunTenant(
  run: Record<string, any> | null | undefined,
  tenantId: string,
  expectedJobId?: string
): boolean {
  if (!run) return false;
  if (expectedJobId !== undefined && run.job_id !== undefined && run.job_id !== null && String(run.job_id) !== String(expectedJobId)) {
    return false;
  }
  const normTenant = (tenantId || '').trim() || 'default';
  if (normTenant === '*') return true;
  if (hasExplicitCronTenantId(run)) {
    return String(run.tenant_id).trim() === normTenant;
  }
  if (run.payload) {
    try {
      const parsed = typeof run.payload === 'string' ? JSON.parse(run.payload) : run.payload;
      const payloadTenant = parsed?.tenant_id ?? parsed?.tenantId;
      if (payloadTenant !== undefined && payloadTenant !== null && String(payloadTenant).trim() !== '') {
        return String(payloadTenant).trim() === normTenant;
      }
    } catch {
      // Ignore non-JSON payload
    }
  }
  return true;
}

export function ensureCronPayloadTenant(rawPayload: unknown, tenantId: string): string | null {
  const normTenant = (tenantId || '').trim() || 'default';
  if (normTenant === '*') {
    if (rawPayload === undefined || rawPayload === null) return null;
    return typeof rawPayload === 'string' ? rawPayload : JSON.stringify(rawPayload);
  }
  if (rawPayload === undefined || rawPayload === null || rawPayload === '') {
    return JSON.stringify({ tenant_id: normTenant });
  }
  if (typeof rawPayload === 'object' && !Array.isArray(rawPayload)) {
    const copy: Record<string, unknown> = { ...(rawPayload as Record<string, unknown>) };
    delete copy.tenantId;
    copy.tenant_id = normTenant;
    return JSON.stringify(copy);
  }
  if (typeof rawPayload === 'string') {
    try {
      const parsed = JSON.parse(rawPayload);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        const copy: Record<string, unknown> = { ...(parsed as Record<string, unknown>) };
        delete copy.tenantId;
        copy.tenant_id = normTenant;
        return JSON.stringify(copy);
      }
      return rawPayload;
    } catch {
      return rawPayload;
    }
  }
  return JSON.stringify(rawPayload);
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

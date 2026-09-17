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

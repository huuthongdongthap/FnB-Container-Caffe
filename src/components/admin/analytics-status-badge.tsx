interface StatusBadgeProps {
  active: boolean;
  hasId: boolean;
  activeLabel?: string;
  loadingLabel?: string;
  inactiveLabel?: string;
}

export function StatusBadge({
  active,
  hasId,
  activeLabel = 'Active',
  loadingLabel = 'Script Loading',
  inactiveLabel = 'Not Configured',
}: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
        active
          ? 'bg-green-900/50 text-green-400'
          : hasId
            ? 'bg-yellow-900/50 text-yellow-400'
            : 'bg-red-900/50 text-red-400'
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          active
            ? 'bg-green-400'
            : hasId
              ? 'bg-yellow-400'
              : 'bg-red-400'
        }`}
      />
      {active ? activeLabel : hasId ? loadingLabel : inactiveLabel}
    </span>
  );
}

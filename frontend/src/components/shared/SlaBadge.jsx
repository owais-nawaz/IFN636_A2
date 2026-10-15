// Shown when the SLA escalation has flagged the bug (BTS2-13).
export default function SlaBadge({ bug }) {
  if (!bug.slaBreached) return null;
  const when = bug.escalatedAt ? new Date(bug.escalatedAt).toLocaleString() : null;
  return (
    <span className="badge badge-sla" title={when ? `SLA breached, escalated ${when}` : 'SLA breached'}>
      SLA breached
    </span>
  );
}

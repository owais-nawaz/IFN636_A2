import StatusBadge from '../shared/StatusBadge';

export default function BugCard({ bug, currentUser, onClaim, onResolve }) {
  const id = bug.ticketId || bug.id;
  const isClaimableStatus = (bug.status === 'Open' && (bug.assignee === 'Unassigned' || !bug.assignee))
    || bug.status === 'Re-opened';
  const canClaim = isClaimableStatus && currentUser?.role === 'Developer';
  const canResolve = bug.status === 'In Progress' && currentUser?.role === 'Developer' && bug.assignee === currentUser?.username;

  return (
    <div className="bug-card">
      <div className="bug-card__header">
        <span className="bug-card__id">BUG-{id}</span>
        <StatusBadge text={bug.status} type="status" />
      </div>

      <div className="bug-card__title">{bug.title}</div>

      <div className="bug-card__tags">
        <span>Module: <strong>{bug.module}</strong></span>
        <span>·</span>
        <span>Severity: <strong>{bug.severity}</strong></span>
      </div>

      <p className="bug-card__desc">{bug.description}</p>

      {bug.resolutionNotes && (
        <div className="bug-card__resolution-notes">
          <strong>Resolution:</strong> {bug.resolutionNotes}
        </div>
      )}
      {bug.qaNotes && (
        <div className="bug-card__qa-notes">
          <strong>QA Notes:</strong> {bug.qaNotes}
        </div>
      )}

      <hr className="bug-card__divider" />

      <div className="bug-card__meta">
        <span>Rep: <strong>{bug.reporter}</strong></span>
        <span>Dev: <strong>{bug.assignee || 'Unassigned'}</strong></span>
      </div>

      {(canClaim || canResolve) && (
        <div className="bug-card__actions">
          {canClaim && <button className="btn btn-primary btn-full" onClick={() => onClaim(bug)}>Claim and Start Work</button>}
          {canResolve && <button className="btn btn-resolve btn-full" onClick={() => onResolve(bug)}>Submit Resolution</button>}
        </div>
      )}
    </div>
  );
}

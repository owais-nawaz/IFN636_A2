import StatusBadge from '../shared/StatusBadge';
import SlaBadge from '../shared/SlaBadge';
import { canDo } from '../shared/bugActions';

export default function BugCard({ bug, currentUser, onClaim, onResolve }) {
  const id = bug.ticketId || bug.id;
  const isDeveloper = currentUser?.role === 'Developer';
  // Buttons are enabled only for the moves the bug's current status allows.
  const canClaim = canDo(bug.status, 'claim');
  const canResolve = canDo(bug.status, 'resolve') && bug.assignee === currentUser?.username;

  return (
    <div className="bug-card">
      <div className="bug-card__header">
        <span className="bug-card__id">BUG-{id}</span>
        <div className="bug-card__badges">
          <SlaBadge bug={bug} />
          <StatusBadge text={bug.status} type="status" />
        </div>
      </div>

      <div className="bug-card__title">{bug.title}</div>

      <div className="bug-card__tags">
        <span>Module: <strong>{bug.module}</strong></span>
        <span>·</span>
        <span>Severity: <strong>{bug.severity}</strong></span>
        <span>·</span>
        <span>Priority: <StatusBadge text={bug.priority} type="level" /></span>
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

      {isDeveloper && bug.status !== 'Closed' && (
        <div className="bug-card__actions bug-card__actions--split">
          <button className="btn btn-primary" disabled={!canClaim}
            title={canClaim ? '' : `Cannot claim a bug that is ${bug.status}`}
            onClick={() => onClaim(bug)}>Claim and Start Work</button>
          <button className="btn btn-resolve" disabled={!canResolve}
            title={canResolve ? '' : 'Only the assigned developer can resolve an In Progress bug'}
            onClick={() => onResolve(bug)}>Submit Resolution</button>
        </div>
      )}
    </div>
  );
}

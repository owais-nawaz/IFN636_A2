import { useState, useEffect, useCallback } from 'react';
import { bugsApi } from '../../api/client';
import BugFilters from '../bugs/BugFilters';
import StatusBadge from '../shared/StatusBadge';
import SlaBadge from '../shared/SlaBadge';
import { canDo } from '../shared/bugActions';
import ReopenModal from './ReopenModal';

const DEFAULT = { status: 'All', priority: 'All', search: '' };

function QACard({ bug, onVerifyClose, onReopenRequest }) {
  const id = bug.ticketId || bug.id;
  // Buttons are enabled only for the moves the bug's current status allows.
  const canClose = canDo(bug.status, 'close');
  const canReopen = canDo(bug.status, 'reopen');
  const blocked = `Only Resolved bugs can be verified (this one is ${bug.status})`;

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

      {bug.status !== 'Closed' && (
        <div className="bug-card__actions bug-card__actions--split">
          <button className="btn btn-verify" disabled={!canClose} title={canClose ? '' : blocked}
            onClick={() => onVerifyClose(bug)}>
            <span className="material-icons btn-icon">fact_check</span> Verify fix and Audit
          </button>
          <button className="btn btn-reopen" disabled={!canReopen} title={canReopen ? '' : blocked}
            onClick={() => onReopenRequest(bug)}>
            <span className="material-icons btn-icon">replay</span> Re-open
          </button>
        </div>
      )}
    </div>
  );
}

export default function QAVerificationPanel({ currentUser, onNotify }) {
  const [bugs, setBugs]           = useState([]);
  const [loading, setLoading]     = useState(true);
  const [filters, setFilters]     = useState(DEFAULT);
  const [refresh, setRefresh]     = useState(0);
  const [reopenBug, setReopenBug] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { setBugs((await bugsApi.getAll(filters)).bugs || []); }
    catch (err) { onNotify(err.message, 'error'); }
    finally { setLoading(false); }
  }, [filters, onNotify]);

  useEffect(() => { load(); }, [load, refresh]);

  async function handleClose(bug) {
    const id = bug.ticketId || bug.id;
    try {
      await bugsApi.verify(id, { action: 'close', qaNotes: null }, currentUser);
      onNotify(`BUG-${id} verified and Closed`, 'success');
      setRefresh(r => r + 1);
    } catch (err) { onNotify(err.message, 'error'); }
  }

  if (loading) return <div className="bts-loading">Loading tickets…</div>;

  return (
    <div>
      {/* <div className="bts-workspace-heading">
        <span className="material-icons">fact_check</span>
        QA Verification Queue
      </div>*/}

      <BugFilters filters={filters} onChange={setFilters} />

      {bugs.length === 0 ? (
        <div className="bts-empty">
          <span className="material-icons bts-empty__icon">fact_check</span>
          <div className="bts-empty__title">No tickets found</div>
          <p>Resolved tickets appear here for review.</p>
        </div>
      ) : (
        <div className="bug-grid">
          {bugs.map(b => (
            <QACard key={b._id || b.ticketId} bug={b} onVerifyClose={handleClose} onReopenRequest={setReopenBug} />
          ))}
        </div>
      )}

      {reopenBug && (
        <ReopenModal
          bug={reopenBug}
          currentUser={currentUser}
          onSuccess={() => { setReopenBug(null); setRefresh(r => r + 1); }}
          onClose={() => setReopenBug(null)}
          onNotify={onNotify}
        />
      )}
    </div>
  );
}

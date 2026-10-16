import { useState, useCallback } from 'react';
import { bugsApi } from '../../api/client';

function getActionMeta(action) {
  switch (action) {
    case 'bug.created':
    case 'CREATE':
      return { label: 'Created', icon: 'add_circle_outline', className: 'badge-history-create' };
    case 'bug.claimed':
    case 'CLAIM':
      return { label: 'Claimed', icon: 'play_circle_outline', className: 'badge-history-claim' };
    case 'bug.resolved':
    case 'RESOLVE':
      return { label: 'Resolved', icon: 'check_circle_outline', className: 'badge-history-resolve' };
    case 'bug.closed':
    case 'CLOSE':
      return { label: 'Closed', icon: 'task_alt', className: 'badge-history-close' };
    case 'bug.reopened':
    case 'REOPEN':
      return { label: 'Re-opened', icon: 'replay', className: 'badge-history-reopen' };
    case 'STATUS_CHANGE':
    case 'UPDATE':
    default:
      return { label: 'Updated', icon: 'edit_note', className: 'badge-history-update' };
  }
}

function formatDate(timestamp) {
  if (!timestamp) return '';
  const d = new Date(timestamp);
  if (isNaN(d.getTime())) return String(timestamp);
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function BugHistory({ bugId, currentUser }) {
  const [isOpen, setIsOpen]   = useState(false);
  const [history, setHistory] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);

  const fetchHistory = useCallback(async () => {
    if (!bugId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await bugsApi.getHistory(bugId, currentUser);
      setHistory(res.history || []);
    } catch (err) {
      setError(err.message || 'Failed to load ticket history.');
    } finally {
      setLoading(false);
    }
  }, [bugId, currentUser]);

  const handleToggle = () => {
    const nextState = !isOpen;
    setIsOpen(nextState);
    if (nextState && history === null && !loading) {
      fetchHistory();
    }
  };

  return (
    <div className="bug-card__history">
      <div className="bug-card__history-header">
        <button
          type="button"
          className="bug-card__history-toggle"
          onClick={handleToggle}
          aria-expanded={isOpen}
          title={isOpen ? 'Hide ticket history' : 'Show ticket history'}
        >
          <span className="material-icons bug-card__history-toggle-icon">history</span>
          <span>History</span>
          {history !== null && (
            <span className="bug-card__history-count">({history.length})</span>
          )}
          <span className="material-icons bug-card__history-arrow">
            {isOpen ? 'expand_less' : 'expand_more'}
          </span>
        </button>

        {isOpen && (
          <button
            type="button"
            className="bug-card__history-refresh"
            onClick={fetchHistory}
            disabled={loading}
            title="Refresh history"
          >
            <span className={`material-icons ${loading ? 'spin' : ''}`}>refresh</span>
          </button>
        )}
      </div>

      {isOpen && (
        <div className="bug-card__history-panel">
          {loading && (
            <div className="bug-card__history-status">
              <span className="material-icons spin">sync</span> Loading history…
            </div>
          )}

          {error && !loading && (
            <div className="bug-card__history-error">
              <span>{error}</span>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={fetchHistory}
              >
                Retry
              </button>
            </div>
          )}

          {!loading && !error && history && history.length === 0 && (
            <div className="bug-card__history-empty">
              No audit history recorded yet for BUG-{bugId}.
            </div>
          )}

          {!loading && !error && history && history.length > 0 && (
            <ol className="bug-card__history-list">
              {history.map((entry, index) => {
                const meta = getActionMeta(entry.action);
                const who = entry.actingUser || entry.changedBy || 'System';
                const hasTransition = entry.oldValue !== undefined || entry.prevValue !== undefined;
                const oldVal = entry.oldValue ?? entry.prevValue;
                const newVal = entry.newValue;
                const notes = entry.details?.notes || entry.details?.resolutionNotes || entry.details?.qaNotes;

                return (
                  <li key={entry.id || entry._id || index} className="bug-card__history-item">
                    <div className="bug-card__history-marker">
                      <span className="material-icons">{meta.icon}</span>
                    </div>

                    <div className="bug-card__history-content">
                      <div className="bug-card__history-top">
                        <span className={`badge ${meta.className}`}>
                          {meta.label}
                        </span>
                        <span className="bug-card__history-time">
                          {formatDate(entry.timestamp)}
                        </span>
                      </div>

                      <div className="bug-card__history-actor">
                        By <strong>{who}</strong>
                      </div>

                      {hasTransition && oldVal !== null && oldVal !== undefined && (
                        <div className="bug-card__history-diff">
                          <span className="bug-card__history-from">{String(oldVal)}</span>
                          <span className="material-icons bug-card__history-diff-icon">arrow_forward</span>
                          <span className="bug-card__history-to">{String(newVal)}</span>
                        </div>
                      )}

                      {(!hasTransition || oldVal === null || oldVal === undefined) && newVal && entry.fieldChanged !== 'bug' && (
                        <div className="bug-card__history-diff">
                          <span>Set to: </span>
                          <span className="bug-card__history-to">{String(newVal)}</span>
                        </div>
                      )}

                      {notes && (
                        <div className="bug-card__history-notes">
                          <em>"{notes}"</em>
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      )}
    </div>
  );
}

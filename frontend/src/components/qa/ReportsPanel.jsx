import { useState, useEffect } from 'react';
import { reportsApi } from '../../api/client';

const STATUS_KEYS   = ['Open', 'In Progress', 'Resolved', 'Closed', 'Re-opened'];
const SEVERITY_KEYS = ['Low', 'Medium', 'High', 'Critical'];

function todayStamp() {
  const d = new Date();
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function downloadBlob(blob, filename) {
  const url  = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

// 12 -> "12.00 hours"; under an hour adds a friendly size: "0.02 hours, about 1 minute"
function formatMttr(hours) {
  const text = `${hours.toFixed(2)} hours`;
  if (hours >= 1) return text;
  const minutes = Math.round(hours * 60);
  if (minutes < 1) return `${text}, less than a minute`;
  return `${text}, about ${minutes} minute${minutes === 1 ? '' : 's'}`;
}

function StatCard({ icon, label, value, note, small }) {
  return (
    <div className="bug-card">
      <div className="bug-card__tags">
        <span className="material-icons btn-icon">{icon}</span> {label}
      </div>
      <div style={{ fontSize: small ? 16 : 26, fontWeight: 700 }}>{value}</div>
      {note && <div className="bug-card__meta">{note}</div>}
    </div>
  );
}

// One row per key (zeros included). Bar width is the share of the total; the number is
// printed beside every bar so the meaning never depends on colour or length alone.
function BarCard({ icon, title, keys, counts, total }) {
  return (
    <div className="bug-card">
      <div className="bug-card__title">
        <span className="material-icons btn-icon">{icon}</span> {title}
      </div>
      {keys.map(key => {
        const count = counts?.[key] ?? 0;
        const share = total > 0 ? (count / total) * 100 : 0; // total 0 -> no division
        return (
          <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12 }}>
            <span style={{ width: 80, flexShrink: 0 }}>{key}</span>
            <div role="img" aria-label={`${key}: ${count} of ${total} (${Math.round(share)}%)`}
              style={{ flex: 1, height: 10, background: 'var(--bts-surface-2)', borderRadius: 'var(--bts-radius-sm)', overflow: 'hidden' }}>
              <div style={{ width: `${share}%`, minWidth: count > 0 ? 2 : 0, height: '100%', background: 'var(--bts-primary)' }} />
            </div>
            <span style={{ width: 70, textAlign: 'right', flexShrink: 0 }}>
              <strong>{count}</strong> ({Math.round(share)}%)
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default function ReportsPanel({ currentUser, onNotify }) {
  const [exporting, setExporting]             = useState(null); // null | 'csv' | 'json'
  const [summary, setSummary]                 = useState(null);
  const [loadingSummary, setLoadingSummary]   = useState(true);
  const [refreshKey, setRefreshKey]           = useState(0);

  // Loads on mount and again whenever Refresh bumps refreshKey. State is only set in the
  // promise callbacks, and `cancelled` stops a late response from updating an unmounted panel.
  useEffect(() => {
    let cancelled = false;
    reportsApi.getSummary(currentUser)
      .then(res => { if (!cancelled) setSummary(res.summary); })
      .catch(err => { if (!cancelled) onNotify(err.message, 'error'); })
      .finally(() => { if (!cancelled) setLoadingSummary(false); });
    return () => { cancelled = true; };
  }, [currentUser, onNotify, refreshKey]);

  function handleRefresh() {
    setLoadingSummary(true);
    setRefreshKey(k => k + 1);
  }

  async function handleExport(format) {
    setExporting(format);
    try {
      const blob     = await reportsApi.exportBugs(format, currentUser);
      const filename = `bugs-report-${todayStamp()}.${format}`;
      downloadBlob(blob, filename);
      onNotify(`${filename} downloaded`, 'success');
    } catch (err) { onNotify(err.message, 'error'); }
    finally { setExporting(null); }
  }

  const refreshLabel = !loadingSummary ? 'Refresh' : (summary ? 'Refreshing…' : 'Loading…');
  const grid = min => ({ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(${min}px, 1fr))`, gap: 16 });

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="bts-section-header" style={{ marginBottom: 0 }}>
        <div className="bug-card__title">
          <span className="material-icons btn-icon">analytics</span> Bug summary
        </div>
        <button className="btn btn-ghost btn-sm" disabled={loadingSummary} onClick={handleRefresh}>
          <span className="material-icons btn-icon">refresh</span> {refreshLabel}
        </button>
      </div>

      {!summary && loadingSummary && <div className="bts-loading">Loading summary…</div>}
      {!summary && !loadingSummary && (
        <div className="bts-loading">Summary unavailable. Use Refresh to try again.</div>
      )}

      {summary && (
        <>
          <div style={grid(220)}>
            <StatCard icon="bug_report" label="Total bugs" value={summary.total} note="All tickets in the system" />
            <StatCard icon="timer" label="Mean time to resolve (MTTR)"
              small={summary.mttrHours === null}
              value={summary.mttrHours === null ? 'No resolved bugs yet' : formatMttr(summary.mttrHours)}
              note={summary.mttrHours === null
                ? 'MTTR appears once a bug has been resolved.'
                : `Based on ${summary.mttrSampleSize} resolved bug${summary.mttrSampleSize === 1 ? '' : 's'}`} />
          </div>

          <div style={grid(300)}>
            <BarCard icon="flag" title="By status" keys={STATUS_KEYS}
              counts={summary.countsByStatus} total={summary.total} />
            <BarCard icon="priority_high" title="By severity" keys={SEVERITY_KEYS}
              counts={summary.countsBySeverity} total={summary.total} />
          </div>
        </>
      )}

      <div className="bug-card">
        <div className="bug-card__title">
          <span className="material-icons btn-icon">download</span> Export bug report
        </div>
        <p className="bug-card__desc">Download every ticket in the system as a CSV spreadsheet or a JSON file.</p>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button className="btn btn-primary" disabled={exporting !== null} onClick={() => handleExport('csv')}>
            {exporting === 'csv'
              ? <><span className="material-icons btn-icon">hourglass_top</span> Exporting…</>
              : <><span className="material-icons btn-icon">table_chart</span> Export CSV</>}
          </button>
          <button className="btn btn-primary" disabled={exporting !== null} onClick={() => handleExport('json')}>
            {exporting === 'json'
              ? <><span className="material-icons btn-icon">hourglass_top</span> Exporting…</>
              : <><span className="material-icons btn-icon">code</span> Export JSON</>}
          </button>
        </div>
      </div>
    </div>
  );
}

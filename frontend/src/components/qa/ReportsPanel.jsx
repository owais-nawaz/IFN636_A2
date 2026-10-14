import { useState } from 'react';
import { reportsApi } from '../../api/client';

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

export default function ReportsPanel({ currentUser, onNotify }) {
  const [exporting, setExporting] = useState(null); // null | 'csv' | 'json'

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

  return (
    <div className="bug-card" style={{ maxWidth: 600, margin: '0 auto' }}>
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
  );
}

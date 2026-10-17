import { useCallback, useEffect, useRef, useState } from 'react';
import { notificationsApi } from '../../api/client';

const POLL_MS = 30000;

function timeAgo(date) {
  const mins = Math.floor((Date.now() - new Date(date).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  return hours < 24 ? `${hours} h ago` : new Date(date).toLocaleDateString();
}

// Bell with unread count; polls the API and refreshes after the user's own
// actions (refreshTrigger), since those can notify them too.
export default function NotificationBell({ user, refreshTrigger }) {
  const [notifications, setNotifications] = useState([]);
  const [unread, setUnread]               = useState(0);
  const [open, setOpen]                   = useState(false);

  const load = useCallback(() => notificationsApi.getAll(user)
    .then(data => {
      setNotifications(data.notifications);
      setUnread(data.unread);
    })
    .catch(() => { /* keep the last list; the bell is not worth an error toast */ }), [user]);

  useEffect(() => {
    load();
    const t = setInterval(load, POLL_MS);
    return () => clearInterval(t);
  }, [load, refreshTrigger]);

  // Close the panel on a click outside the bell or on Esc.
  const rootRef = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const onClick = e => { if (!rootRef.current?.contains(e.target)) setOpen(false); };
    const onKey = e => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  async function handleMarkRead(n) {
    if (n.read) return;
    try {
      await notificationsApi.markRead(n._id, user);
      setNotifications(list => list.map(x => (x._id === n._id ? { ...x, read: true } : x)));
      setUnread(u => Math.max(0, u - 1));
    } catch { load(); }
  }

  return (
    <div className="bts-bell" ref={rootRef}>
      <button className="bts-bell__button" onClick={() => setOpen(o => !o)}
        aria-label={`Notifications, ${unread} unread`} aria-expanded={open}>
        <span className="material-icons">notifications</span>
        {unread > 0 && <span className="bts-bell__badge">{unread > 99 ? '99+' : unread}</span>}
      </button>

      {open && (
        <div className="bts-bell__panel" role="dialog" aria-label="Notifications">
          <div className="bts-bell__header">Notifications</div>
          {notifications.length === 0 ? (
            <div className="bts-bell__empty">No notifications yet.</div>
          ) : (
            <ul className="bts-bell__list">
              {notifications.map(n => (
                <li key={n._id}>
                  <button className={`bts-bell__item${n.read ? '' : ' bts-bell__item--unread'}`}
                    onClick={() => handleMarkRead(n)} title={n.read ? '' : 'Mark as read'}>
                    <span className="bts-bell__message">{n.message}</span>
                    <span className="bts-bell__time">{timeAgo(n.timestamp)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

// Mirrors the backend state machine (backend/src/services/bugStates.js):
// which actions each status allows. The server still enforces this (409);
// the UI only uses it to enable or disable buttons.
export const ALLOWED_ACTIONS = {
  'Open':        ['claim'],
  'In Progress': ['resolve'],
  'Resolved':    ['close', 'reopen'],
  'Closed':      [],
  'Re-opened':   ['claim'],
};

export function canDo(status, action) {
  return (ALLOWED_ACTIONS[status] || []).includes(action);
}

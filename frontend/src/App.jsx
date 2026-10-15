import { useCallback, useState } from 'react';
import './App.css';
import { AuthProvider, useAuth } from './context/AuthContext';
import AuthPage from './components/auth/AuthPage';
import Navbar from './components/shared/Navbar';
import SubNav from './components/shared/SubNav';
import Notification from './components/shared/Notification';
import BugDashboard from './components/bugs/BugDashboard';
import BugSubmissionForm from './components/bugs/BugSubmissionForm';
import DeveloperWorkspace from './components/developer/DeveloperWorkspace';
import QAVerificationPanel from './components/qa/QAVerificationPanel';
import { bugsApi } from './api/client';

function AppContent() {
  const { user, login, logout } = useAuth();
  const [activeTab, setActiveTab]           = useState('dashboard');
  const [notification, setNotification]     = useState(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const notify = useCallback((message, type = 'info') => setNotification({ message, type }), []);

  if (!user) return <AuthPage onLogin={login} />;

  async function handleClaim(bug) {
    const id = bug.ticketId || bug.id;
    try {
      await bugsApi.claim(id, user);
      notify('BUG-${id} claimed! Status changed to In Progress', 'success');
      setRefreshTrigger(r => r + 1);
    } catch (err) { notify(err.message, 'error'); }
  }

  async function handleVerify(bug, action, qaNotes) {
    const id = bug.ticketId || bug.id;
    try {
      await bugsApi.verify(id, { action, qaNotes }, user);
      notify(action === 'close' ? 'BUG-${id} verified and Closed' : `BUG-${id} re-opened 🔄`,
        action === 'close' ? 'success' : 'info');
      setRefreshTrigger(r => r + 1);
    } catch (err) { notify(err.message, 'error'); }
  }

  return (
    <div className="bts-layout">
      <Navbar user={user} onLogout={logout} refreshTrigger={refreshTrigger} />
      <SubNav user={user} activeTab={activeTab} onTabChange={setActiveTab} />

      {notification && (
        <Notification message={notification.message} type={notification.type} onClose={() => setNotification(null)} />
      )}

      <main className="bts-main">
        {activeTab === 'dashboard' && (
          <BugDashboard
            currentUser={user} onNotify={notify} refreshTrigger={refreshTrigger}
            onClaim={handleClaim}
            onResolve={() => notify('Use the Developer Workspace to resolve tickets.', 'info')}
          />
        )}
        {activeTab === 'submit' && (user.role === 'Tester' || user.role === 'QALead') && (
          <BugSubmissionForm currentUser={user} onNotify={notify} onSuccess={() => setRefreshTrigger(r => r + 1)} />
        )}
        {activeTab === 'mywork' && user.role === 'Developer' && (
          <DeveloperWorkspace currentUser={user} onNotify={notify} />
        )}
        {activeTab === 'qa' && user.role === 'QALead' && (
          <QAVerificationPanel currentUser={user} onNotify={notify} />
        )}
      </main>
    </div>
  );
}

export default function App() {
  return <AuthProvider><AppContent /></AuthProvider>;
}

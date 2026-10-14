const TABS = { dashboard: 'Bug Repository', submit: '+ Report Bug', mywork: 'Developer Workspace', qa: 'QA Verification', reports: 'Reports' };
const ROLE_TABS = {
  Tester:    ['dashboard', 'submit'],
  Developer: ['dashboard', 'mywork'],
  QALead:    ['dashboard', 'submit', 'qa', 'reports'],
};

export default function SubNav({ user, activeTab, onTabChange }) {
  const tabs = ROLE_TABS[user?.role] || ['dashboard'];
  return (
    <div className="bts-subnav">
      {tabs.map(t => (
        <button key={t}
          className={`bts-subnav__tab${activeTab === t ? ' bts-subnav__tab--active' : ''}`}
          onClick={() => onTabChange(t)}>
          {TABS[t]}
        </button>
      ))}
    </div>
  );
}

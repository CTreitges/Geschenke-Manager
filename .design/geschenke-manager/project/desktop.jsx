// desktop.jsx — Desktop layout for the Geschenke-Manager

const { useState: useStateDk } = React;

function DesktopApp({ ctx, route, navigate, dark, authed, onLogin }) {
  if (!authed) {
    return (
      <div style={{
        height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: dark
          ? 'radial-gradient(60% 60% at 50% 30%, #451A03 0%, #1C1917 70%)'
          : 'radial-gradient(60% 60% at 50% 30%, #FEF3C7 0%, #FAFAF9 70%)',
      }}>
        <div style={{ width: 360 }}>
          <LoginPage onLogin={onLogin} dark={dark}/>
        </div>
      </div>
    );
  }

  const me = ctx.people.find(p => p.id === ctx.identity);
  const navItems = [
    { k: 'home', l: 'Stack', icon: <Icon.home/> },
    { k: 'people', l: 'Personen', icon: <Icon.users/> },
    { k: 'settings', l: 'Einstellungen', icon: <Icon.settings/> },
  ];

  return (
    <div style={{
      height: '100%', display: 'flex',
      background: dark ? '#1C1917' : '#FAFAF9',
      color: dark ? '#FAFAF9' : '#1C1917',
    }}>
      {/* Sidebar */}
      <div style={{
        width: 240, flexShrink: 0,
        borderRight: dark ? '1px solid #292524' : '1px solid #F0EBE6',
        padding: '20px 14px',
        display: 'flex', flexDirection: 'column', gap: 4,
        background: dark ? '#1C1917' : '#FAFAF9',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 8px 18px' }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'linear-gradient(135deg, #F59E0B 0%, #F97316 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 20, boxShadow: '0 4px 10px -3px rgba(249,115,22,0.45)',
          }}>🎁</div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, letterSpacing: -0.2 }}>Geschenke</div>
            <div style={{ fontSize: 11, color: dark ? '#A8A29E' : '#A8A29E', fontWeight: 500 }}>Manager</div>
          </div>
        </div>

        {navItems.map(n => {
          const active = route.name === n.k || (n.k === 'home' && (route.name === 'gift' || route.name === 'person'));
          return (
            <button key={n.k} onClick={() => navigate(n.k)} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '9px 10px', borderRadius: 10, cursor: 'pointer',
              background: active ? (dark ? '#292524' : '#fff') : 'transparent',
              border: active ? (dark ? '1px solid #3A3633' : '1px solid #F0EBE6') : '1px solid transparent',
              color: active ? (dark ? '#FCD34D' : '#B45309') : (dark ? '#E7E5E4' : '#44403C'),
              fontSize: 13.5, fontWeight: 600, textAlign: 'left',
              boxShadow: active ? '0 1px 2px rgba(28,25,23,0.04)' : 'none',
            }}>
              {n.icon}
              <span>{n.l}</span>
            </button>
          );
        })}

        <div style={{ flex: 1 }}/>

        <button onClick={() => ctx.openIdentityPicker()} style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '8px 8px', borderRadius: 12, cursor: 'pointer',
          background: dark ? '#292524' : '#fff',
          border: dark ? '1px solid #3A3633' : '1px solid #F0EBE6',
          textAlign: 'left',
        }}>
          {me ? <Avatar person={me} size={32}/> : <div style={{ width: 32, height: 32, borderRadius: '50%', background: dark ? '#3A3633' : '#F5F1ED' }}/>}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, color: dark ? '#A8A29E' : '#A8A29E', fontWeight: 600, letterSpacing: 0.3, textTransform: 'uppercase' }}>Ich bin</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: dark ? '#FAFAF9' : '#1C1917' }}>{me ? me.name : 'wähle …'}</div>
          </div>
        </button>
      </div>

      {/* Main panel */}
      <div style={{
        flex: 1, minWidth: 0, position: 'relative',
        display: 'flex', flexDirection: 'column',
        background: dark ? '#0c0a09' : '#FFFFFF',
      }}>
        <div style={{ flex: 1, overflowY: 'auto', position: 'relative' }}>
          <div style={{ maxWidth: 720, margin: '0 auto', padding: '8px 0 60px' }}>
            {route.name === 'home' && <HomePage ctx={ctx}/>}
            {route.name === 'person' && <PersonPage ctx={ctx} personId={route.param}/>}
            {route.name === 'gift' && <GiftPage ctx={ctx} giftId={route.param}/>}
            {route.name === 'people' && <PeoplePage ctx={ctx}/>}
            {route.name === 'settings' && <SettingsPage ctx={ctx}/>}
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { DesktopApp });

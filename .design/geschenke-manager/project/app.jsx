// app.jsx — Main App + router + state + tab bar + device frames

const { useState: useStateA, useEffect: useEffectA, useRef: useRefA } = React;

function App({ initialRoute, externalSetRoute, hideAuthGate, platform = 'ios' }) {
  const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
    "darkMode": false,
    "device": "all",
    "scenario": "kevin-stack",
    "screen": "home"
  }/*EDITMODE-END*/;
  const [tweaks, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const dark = tweaks.darkMode;

  const [authed, setAuthed] = useStateA(hideAuthGate ? true : false);
  const [route, setRoute] = useStateA(initialRoute || { name: 'home', param: null });
  const [people, setPeople] = useStateA(PEOPLE_INIT);
  const [wishlists, setWishlists] = useStateA(WISHLISTS_INIT);
  const [stack, setStack] = useStateA(STACK_INIT);
  const [pastGifts, setPastGifts] = useStateA(PAST_GIFTS_INIT);
  const [identity, setIdentity] = useStateA('p_kevin');
  const [defaultBudget, setDefaultBudget] = useStateA(15);

  const [showIdentity, setShowIdentity] = useStateA(false);
  const [showAddPerson, setShowAddPerson] = useStateA(false);
  const [showAddToStack, setShowAddToStack] = useStateA(false);
  const [confirmReceivedId, setConfirmReceivedId] = useStateA(null);

  // Sync screen tweak → route (for jumping to any screen via Tweaks)
  useEffectA(() => {
    if (!tweaks.screen) return;
    if (tweaks.screen === 'login') { setAuthed(false); return; }
    if (tweaks.screen === 'gift-vote') {
      setAuthed(true);
      setStack(STACK_INIT.map(s => s.id === 'g_kevin_2026' ? { ...s, pollStatus: 'active' } : s));
      setRoute({ name: 'gift', param: 'g_kevin_2026' });
      return;
    }
    setAuthed(true);
    if (tweaks.screen === 'person') setRoute({ name: 'person', param: 'p_kevin' });
    else if (tweaks.screen === 'gift') setRoute({ name: 'gift', param: 'g_kevin_2026' });
    else setRoute({ name: tweaks.screen, param: null });
  }, [tweaks.screen]);

  useEffectA(() => {
    if (tweaks.scenario === 'fresh') {
      setStack(STACK_INIT.slice(0, 1).map(s => ({ ...s, suggestions: [], votes: {}, pollStatus: 'none', participants: ['p_tim'] })));
    } else if (tweaks.scenario === 'voting-done') {
      setStack(STACK_INIT.map(s => s.id === 'g_kevin_2026' ? { ...s, pollStatus: 'ended', votes: { p_tim: 's2', p_sara: 's2', p_lena: 's2' } } : s));
    } else {
      setStack(STACK_INIT);
    }
  }, [tweaks.scenario]);

  const navigate = (name, param = null) => setRoute({ name, param });

  const addPerson = ({ name, birthday, email }) => {
    const colors = ['#06B6D4', '#8B5CF6', '#10B981', '#EC4899', '#F97316', '#F59E0B'];
    const np = { id: uid('p'), name, birthday, email, color: colors[people.length % colors.length] };
    setPeople([...people, np]);
    setWishlists({ ...wishlists, [np.id]: [] });
  };
  const addToStack = (personId, year) => {
    const newGift = {
      id: uid('g'), personId, year,
      addedToStack: TODAY.toISOString().slice(0, 10),
      budgetPerPerson: defaultBudget,
      participants: identity ? [identity] : [],
      suggestions: [], pollStatus: 'none', votes: {}, status: 'open',
    };
    setStack([...stack, newGift]);
  };
  const confirmReceived = () => {
    const g = stack.find(s => s.id === confirmReceivedId);
    if (!g) return;
    const winner = g.suggestions.find(s => g.votes[Object.keys(g.votes)[0]] === s.id) || g.suggestions[0];
    setPastGifts([...pastGifts, {
      id: uid('pg'), personId: g.personId, year: g.year,
      title: winner?.title || 'Geschenk',
      price: winner?.price || g.budgetPerPerson * g.participants.length,
      status: 'received',
    }]);
    setStack(stack.filter(s => s.id !== g.id));
    setConfirmReceivedId(null);
    navigate('home');
  };

  const ctx = {
    people, setPeople, wishlists, setWishlists, stack, setStack, pastGifts, setPastGifts,
    identity, setIdentity, defaultBudget, setDefaultBudget,
    dark, setDark: (v) => setTweak('darkMode', v),
    navigate,
    openIdentityPicker: () => setShowIdentity(true),
    openAddPerson: () => setShowAddPerson(true),
    openAddToStack: () => setShowAddToStack(true),
    openConfirmReceived: (id) => setConfirmReceivedId(id),
    onLogout: () => { setAuthed(false); navigate('home'); },
  };

  const showTabBar = authed && ['home', 'people', 'settings'].includes(route.name);

  // Desktop layout path
  if (platform === 'desktop') {
    return (
      <ToastProvider dark={dark}>
        <DesktopApp ctx={ctx} route={route} navigate={navigate} dark={dark} authed={authed} onLogin={() => setAuthed(true)}/>
        <IdentityPickerDialog open={showIdentity} onClose={() => setShowIdentity(false)} people={people} identity={identity} setIdentity={setIdentity} dark={dark}/>
        <AddPersonDialog open={showAddPerson} onClose={() => setShowAddPerson(false)} onAdd={addPerson} dark={dark}/>
        <AddToStackDialog open={showAddToStack} onClose={() => setShowAddToStack(false)} people={people} stack={stack} onAdd={addToStack} dark={dark} defaultBudget={defaultBudget}/>
        <ConfirmReceivedDialog open={!!confirmReceivedId} onClose={() => setConfirmReceivedId(null)}
          gift={stack.find(s => s.id === confirmReceivedId)}
          person={(() => { const g = stack.find(s => s.id === confirmReceivedId); return g ? people.find(p => p.id === g.personId) : null; })()}
          onConfirm={confirmReceived} dark={dark}/>
      </ToastProvider>
    );
  }

  // Mobile layout (iOS / Android)
  return (
    <ToastProvider dark={dark}>
      <div style={{
        height: '100%', position: 'relative',
        background: dark ? '#1C1917' : '#FAFAF9',
        color: dark ? '#FAFAF9' : '#1C1917', overflow: 'hidden',
      }}>
        <div style={{
          height: '100%', overflowY: 'auto', overflowX: 'hidden',
          paddingTop: 50, paddingBottom: showTabBar ? 80 : 30,
        }}>
          {!authed && <LoginPage onLogin={() => setAuthed(true)} dark={dark}/>}
          {authed && route.name === 'home' && <HomePage ctx={ctx}/>}
          {authed && route.name === 'person' && <PersonPage ctx={ctx} personId={route.param}/>}
          {authed && route.name === 'gift' && <GiftPage ctx={ctx} giftId={route.param}/>}
          {authed && route.name === 'people' && <PeoplePage ctx={ctx}/>}
          {authed && route.name === 'settings' && <SettingsPage ctx={ctx}/>}
        </div>

        {showTabBar && (
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 40, paddingBottom: 28,
            background: dark ? 'linear-gradient(to top, #1C1917 60%, rgba(28,25,23,0))' : 'linear-gradient(to top, #FAFAF9 60%, rgba(250,250,249,0))',
          }}>
            <div style={{
              margin: '0 18px', padding: '8px 6px', borderRadius: 22,
              background: dark ? 'rgba(41,37,36,0.92)' : 'rgba(255,255,255,0.92)',
              backdropFilter: 'blur(12px)',
              border: dark ? '1px solid #3A3633' : '1px solid #F0EBE6',
              boxShadow: '0 14px 28px -10px rgba(28,25,23,0.18)',
              display: 'flex',
            }}>
              <TabBtn active={route.name === 'home'} onClick={() => navigate('home')} icon={<Icon.home/>} label="Stack" dark={dark}/>
              <TabBtn active={route.name === 'people'} onClick={() => navigate('people')} icon={<Icon.users/>} label="Personen" dark={dark}/>
              <TabBtn active={route.name === 'settings'} onClick={() => navigate('settings')} icon={<Icon.settings/>} label="Einstell." dark={dark}/>
            </div>
          </div>
        )}

        <IdentityPickerDialog open={showIdentity} onClose={() => setShowIdentity(false)} people={people} identity={identity} setIdentity={setIdentity} dark={dark}/>
        <AddPersonDialog open={showAddPerson} onClose={() => setShowAddPerson(false)} onAdd={addPerson} dark={dark}/>
        <AddToStackDialog open={showAddToStack} onClose={() => setShowAddToStack(false)} people={people} stack={stack} onAdd={addToStack} dark={dark} defaultBudget={defaultBudget}/>
        <ConfirmReceivedDialog open={!!confirmReceivedId} onClose={() => setConfirmReceivedId(null)}
          gift={stack.find(s => s.id === confirmReceivedId)}
          person={(() => { const g = stack.find(s => s.id === confirmReceivedId); return g ? people.find(p => p.id === g.personId) : null; })()}
          onConfirm={confirmReceived} dark={dark}/>
      </div>
    </ToastProvider>
  );
}

function TabBtn({ active, onClick, icon, label, dark }) {
  return (
    <button onClick={onClick} style={{
      flex: 1, padding: '8px 6px', borderRadius: 16, border: 'none', cursor: 'pointer',
      background: 'transparent', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
      color: active ? (dark ? '#FCD34D' : '#B45309') : (dark ? '#78716C' : '#A8A29E'),
    }}>
      <div style={{ position: 'relative' }}>{icon}
        {active && <div style={{ position: 'absolute', top: -2, left: '50%', transform: 'translateX(-50%)', width: 22, height: 22, background: 'radial-gradient(circle, rgba(249,115,22,0.18) 0%, transparent 70%)', zIndex: -1 }}/>}
      </div>
      <span style={{ fontSize: 10.5, fontWeight: 700 }}>{label}</span>
    </button>
  );
}

// ── Frames ─────────────────────────────────────────────────────
function PhonePanel({ kind, label }) {
  const Frame = kind === 'android' ? AndroidDevice : IOSDevice;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase', color: '#A8A29E', display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 13 }}>{kind === 'android' ? '🤖' : '🍎'}</span>{label}
      </div>
      <Frame width={kind === 'android' ? 400 : 390} height={kind === 'android' ? 840 : 820}>
        <App platform={kind}/>
      </Frame>
    </div>
  );
}

function DesktopPanel() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase', color: '#A8A29E', display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 13 }}>🖥️</span>Desktop · Web
      </div>
      <ChromeWindow width={1140} height={760} url="geschenke-manager.app">
        <App platform="desktop"/>
      </ChromeWindow>
    </div>
  );
}

function Root() {
  const [device, setDevice] = useStateA(() => {
    try {
      const m = document.documentElement.innerHTML.match(/EDITMODE-BEGIN\*\/([\s\S]*?)\/\*EDITMODE-END/);
      if (m) return JSON.parse(m[1]).device || 'all';
    } catch {}
    return 'all';
  });
  useEffectA(() => {
    const onMsg = (e) => {
      if (e.data?.type === '__edit_mode_set_keys' && e.data.edits && 'device' in e.data.edits) {
        setDevice(e.data.edits.device);
      }
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, []);

  const all = device === 'all';
  const showIos = all || device === 'ios';
  const showAndroid = all || device === 'android';
  const showDesktop = all || device === 'desktop';

  return (
    <div style={{
      width: '100vw', minHeight: '100vh',
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      padding: '40px 30px',
      background: 'radial-gradient(120% 80% at 50% 0%, #FFF7ED 0%, #FAFAF9 60%, #F5F1ED 100%)',
      fontFamily: '"Inter", -apple-system, system-ui, sans-serif',
    }}>
      <div style={{
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        gap: 40, flexWrap: 'wrap', maxWidth: 1900,
      }}>
        {showDesktop && <DesktopPanel/>}
        {showIos && <PhonePanel kind="ios" label="iPhone · iOS"/>}
        {showAndroid && <PhonePanel kind="android" label="Pixel · Android"/>}
      </div>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<Root/>);

// pages.jsx — All page components

const { useState: useStateP, useEffect: useEffectP, useMemo: useMemoP, useRef: useRefP } = React;

// ── LOGIN PAGE ─────────────────────────────────────────────────
function LoginPage({ onLogin, dark }) {
  const [pw, setPw] = useStateP('');
  const [shake, setShake] = useStateP(false);
  const [show, setShow] = useStateP(false);
  const submit = (e) => {
    e?.preventDefault?.();
    if (pw === 'geschenke' || pw === 'wichteln' || pw.length >= 4) {
      onLogin();
    } else {
      setShake(true);
      setTimeout(() => setShake(false), 400);
    }
  };
  return (
    <div style={{
      height: '100%', display: 'flex', flexDirection: 'column',
      justifyContent: 'center', padding: '0 26px',
      background: dark
        ? 'radial-gradient(120% 60% at 50% 0%, #451A03 0%, #1C1917 60%)'
        : 'radial-gradient(120% 60% at 50% 0%, #FEF3C7 0%, #FAFAF9 55%)',
    }}>
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <div style={{
          width: 78, height: 78, margin: '0 auto 18px',
          borderRadius: 24,
          background: 'linear-gradient(135deg, #F59E0B 0%, #F97316 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 12px 28px -8px rgba(249,115,22,0.5), 0 0 0 1px rgba(255,255,255,0.2) inset',
          fontSize: 38,
        }}>🎁</div>
        <h1 style={{
          margin: 0, fontSize: 26, fontWeight: 800, letterSpacing: -0.6,
          color: dark ? '#FAFAF9' : '#1C1917',
        }}>Geschenke-Manager</h1>
        <p style={{
          margin: '6px 0 0', fontSize: 14, lineHeight: 1.5,
          color: dark ? '#A8A29E' : '#78716C',
        }}>
          Wer bekommt als Nächstes was?<br/>Gemeinsam, ohne Chaos.
        </p>
      </div>
      <form onSubmit={submit} style={{
        animation: shake ? 'shake 0.4s' : 'none',
        display: 'flex', flexDirection: 'column', gap: 12,
      }}>
        <div style={{ position: 'relative' }}>
          <Input
            type={show ? 'text' : 'password'}
            placeholder="Gruppen-Passwort"
            value={pw}
            onChange={e => setPw(e.target.value)}
            dark={dark}
            style={{ paddingLeft: 42, paddingRight: 56 }}
          />
          <div style={{ position: 'absolute', left: 13, top: 13, color: dark ? '#A8A29E' : '#A8A29E' }}>
            <Icon.lock/>
          </div>
          <button type="button" onClick={() => setShow(s => !s)} style={{
            position: 'absolute', right: 8, top: 8,
            background: 'transparent', border: 'none', cursor: 'pointer',
            padding: '6px 10px', fontSize: 12, fontWeight: 600,
            color: dark ? '#A8A29E' : '#78716C',
          }}>{show ? 'Verbergen' : 'Zeigen'}</button>
        </div>
        <Button type="submit" size="lg">
          Reinkommen <Icon.chev/>
        </Button>
      </form>
      <p style={{
        textAlign: 'center', fontSize: 12, marginTop: 22, lineHeight: 1.5,
        color: dark ? '#78716C' : '#A8A29E',
      }}>
        Vertrauensbasis, kein Account.<br/>
        Das Passwort liegt im Familien-Chat 💛
      </p>
    </div>
  );
}

// ── HOME PAGE ──────────────────────────────────────────────────
function HomePage({ ctx }) {
  const { people, stack, setStack, identity, setIdentity, dark, navigate, openIdentityPicker, openAddToStack } = ctx;
  const peopleById = Object.fromEntries(people.map(p => [p.id, p]));

  // hero: nearest upcoming birthday
  const hero = useMemoP(() => {
    return [...people]
      .map(p => ({ p, days: daysUntilBirthday(p.birthday) }))
      .sort((a, b) => a.days - b.days)[0];
  }, [people]);

  const me = identity ? peopleById[identity] : null;
  const sortedStack = useMemoP(() =>
    [...stack].sort((a, b) => new Date(a.addedToStack) - new Date(b.addedToStack))
  , [stack]);

  // drag-reorder
  const [dragId, setDragId] = useStateP(null);
  const [dragOver, setDragOver] = useStateP(null);
  const onDragStart = (id) => () => setDragId(id);
  const onDragOver = (id) => (e) => { e.preventDefault(); setDragOver(id); };
  const onDrop = () => {
    if (!dragId || !dragOver || dragId === dragOver) { setDragId(null); setDragOver(null); return; }
    const order = sortedStack.map(s => s.id);
    const from = order.indexOf(dragId);
    const to = order.indexOf(dragOver);
    order.splice(to, 0, order.splice(from, 1)[0]);
    // reassign addedToStack timestamps to keep this order
    const baseDate = new Date('2026-04-01');
    const newStack = stack.map(s => {
      const idx = order.indexOf(s.id);
      const d = new Date(baseDate); d.setDate(d.getDate() + idx);
      return { ...s, addedToStack: d.toISOString().slice(0, 10) };
    });
    setStack(newStack);
    setDragId(null); setDragOver(null);
  };

  return (
    <div>
      {/* Top bar */}
      <div style={{
        padding: '14px 18px 8px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: dark ? '#A8A29E' : '#A8A29E', letterSpacing: 0.3, textTransform: 'uppercase' }}>
            Donnerstag · 8. Mai
          </div>
          <h1 style={{
            margin: '2px 0 0', fontSize: 26, fontWeight: 800, letterSpacing: -0.5,
            color: dark ? '#FAFAF9' : '#1C1917',
          }}>Hallo{me ? `, ${me.name}` : ''} 👋</h1>
        </div>
        <IdentityChip person={me} dark={dark} onClick={openIdentityPicker}/>
      </div>

      {/* Hero card */}
      <div style={{ padding: '4px 18px 18px' }}>
        <div onClick={() => {
          const sg = stack.find(s => s.personId === hero.p.id);
          if (sg) navigate('gift', sg.id);
          else navigate('person', hero.p.id);
        }} style={{
          position: 'relative', overflow: 'hidden',
          borderRadius: 24, padding: '20px 20px 22px',
          background: 'linear-gradient(135deg, #FBBF24 0%, #F97316 100%)',
          color: '#fff',
          boxShadow: '0 18px 36px -12px rgba(249,115,22,0.45), 0 0 0 1px rgba(255,255,255,0.2) inset',
          cursor: 'pointer',
        }}>
          <Confetti active={hero.days <= 3}/>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, opacity: 0.95 }}>
            <span>🎂</span> Als Nächstes hat Geburtstag …
          </div>
          <div style={{
            display: 'flex', alignItems: 'flex-end', gap: 14, marginTop: 12,
          }}>
            <Avatar person={hero.p} size={56}/>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 32, fontWeight: 800, lineHeight: 1,
                letterSpacing: -0.8, marginBottom: 4,
              }}>{hero.p.name}</div>
              <div style={{ fontSize: 13, opacity: 0.95, fontWeight: 500 }}>
                {fmtDate(hero.p.birthday)} · wird {ageOnNextBirthday(hero.p.birthday)}
              </div>
            </div>
          </div>
          <div style={{
            marginTop: 14, padding: '10px 14px',
            background: 'rgba(255,255,255,0.18)',
            borderRadius: 14, backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: -0.3 }}>
              {hero.days === 0 ? 'Heute! 🎉' : hero.days === 1 ? 'Morgen' : `in ${hero.days} Tagen`}
            </div>
            <Icon.chev style={{ opacity: 0.9 }}/>
          </div>
        </div>
      </div>

      {/* Section header */}
      <div style={{
        padding: '6px 22px 10px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <h2 style={{
            margin: 0, fontSize: 17, fontWeight: 700,
            color: dark ? '#FAFAF9' : '#1C1917', letterSpacing: -0.2,
          }}>Aktueller Stack</h2>
          <Chip variant="accent" dark={dark}>{sortedStack.length}</Chip>
        </div>
        <span style={{ fontSize: 12, color: dark ? '#A8A29E' : '#A8A29E', fontWeight: 500 }}>
          ältest. oben
        </span>
      </div>

      {/* Stack list */}
      <div style={{ padding: '0 18px 100px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {sortedStack.length === 0 && (
          <Card dark={dark} style={{ padding: 0 }}>
            <EmptyState
              emoji="🎉"
              title="Stack ist leer"
              subtitle="Alle Geschenke sind organisiert. Genieße die Pause!"
              dark={dark}
            />
          </Card>
        )}
        {sortedStack.map(g => {
          const p = peopleById[g.personId];
          const days = daysUntilBirthday(p.birthday);
          const inStackDays = daysAgo(g.addedToStack);
          const totalBudget = g.budgetPerPerson * g.participants.length;
          const isUrgent = days <= 7;
          return (
            <div key={g.id}
              draggable
              onDragStart={onDragStart(g.id)}
              onDragOver={onDragOver(g.id)}
              onDrop={onDrop}
              onDragEnd={() => { setDragId(null); setDragOver(null); }}
              onClick={() => navigate('gift', g.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '14px 14px 14px 8px',
                background: dark ? '#292524' : '#FFFFFF',
                borderRadius: 18,
                border: dark ? '1px solid #3A3633' : '1px solid #F0EBE6',
                boxShadow: dragOver === g.id ? '0 0 0 2px #F97316' : '0 1px 2px rgba(28,25,23,0.04)',
                cursor: 'pointer',
                opacity: dragId === g.id ? 0.4 : 1,
                transition: 'box-shadow 0.15s, opacity 0.15s',
              }}>
              <div style={{
                color: dark ? '#57534E' : '#A8A29E', cursor: 'grab', padding: '4px 2px',
              }}><Icon.drag/></div>
              <Avatar person={p} size={42}/>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 16, fontWeight: 700, color: dark ? '#FAFAF9' : '#1C1917',
                  letterSpacing: -0.2,
                }}>{p.name} <span style={{ color: dark ? '#A8A29E' : '#A8A29E', fontWeight: 500 }}>· {fmtDateShort(p.birthday)}</span></div>
                <div style={{
                  fontSize: 12, color: dark ? '#A8A29E' : '#78716C', marginTop: 2,
                  display: 'flex', gap: 8, alignItems: 'center',
                }}>
                  <span style={{ color: isUrgent ? (dark ? '#FCD34D' : '#B45309') : 'inherit', fontWeight: isUrgent ? 600 : 500 }}>
                    {days === 0 ? '🎂 heute!' : `in ${days} T.`}
                  </span>
                  <span style={{ opacity: 0.5 }}>·</span>
                  <span>seit {inStackDays} T. im Stack</span>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
                <Chip variant="neutral" dark={dark}>
                  <Icon.users style={{ width: 12, height: 12, marginRight: -1 }}/>
                  {g.participants.length}
                </Chip>
                <Chip variant="accent" dark={dark}>
                  {totalBudget} €
                </Chip>
              </div>
            </div>
          );
        })}
      </div>

      {/* FAB */}
      <button onClick={openAddToStack} style={{
        position: 'absolute', right: 22, bottom: 92, zIndex: 50,
        width: 56, height: 56, borderRadius: 28,
        background: 'linear-gradient(135deg, #F59E0B 0%, #F97316 100%)',
        color: '#fff', border: 'none', cursor: 'pointer',
        boxShadow: '0 14px 28px -8px rgba(249,115,22,0.55), 0 0 0 1px rgba(255,255,255,0.2) inset',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon.plus style={{ width: 26, height: 26 }}/>
      </button>
    </div>
  );
}

// ── PERSON PAGE ────────────────────────────────────────────────
function PersonPage({ ctx, personId }) {
  const { people, wishlists, setWishlists, stack, pastGifts, identity, dark, navigate } = ctx;
  const person = people.find(p => p.id === personId);
  const [tab, setTab] = useStateP('wishlist');
  const [editingItem, setEditingItem] = useStateP(null);
  const toast = useToast();

  if (!person) return null;
  const items = wishlists[personId] || [];
  const isMe = identity === personId;

  const addItem = (text, url, price) => {
    if (!text.trim()) return;
    setWishlists({
      ...wishlists,
      [personId]: [...items, {
        id: uid('w'), text, url, price: price ? parseFloat(price) : undefined,
        by: identity, addedAt: TODAY.toISOString().slice(0, 10),
      }],
    });
    toast('Wunsch hinzugefügt');
  };
  const deleteItem = (id) => {
    setWishlists({ ...wishlists, [personId]: items.filter(i => i.id !== id) });
    toast('Wunsch gelöscht');
  };

  const myStack = stack.filter(g => g.personId === personId);
  const past = pastGifts.filter(g => g.personId === personId);

  return (
    <div>
      <PageHeader
        onBack={() => navigate('home')}
        title={person.name}
        subtitle={`${fmtDate(person.birthday)} · in ${daysUntilBirthday(person.birthday)} Tagen`}
        right={<button style={{
          background: 'transparent', border: 'none', cursor: 'pointer', padding: 8,
          color: dark ? '#A8A29E' : '#78716C',
        }}><Icon.pencil/></button>}
        dark={dark}
      />

      {/* Hero strip */}
      <div style={{ padding: '0 18px 14px', display: 'flex', alignItems: 'center', gap: 14 }}>
        <Avatar person={person} size={64}/>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, color: dark ? '#A8A29E' : '#78716C', fontWeight: 500 }}>
            wird {ageOnNextBirthday(person.birthday)} · {person.email || 'keine Mail'}
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
            {myStack.length > 0 && <Chip variant="accent" dark={dark}>{myStack.length} im Stack</Chip>}
            <Chip variant="neutral" dark={dark}>{items.length} Wünsche</Chip>
            <Chip variant="neutral" dark={dark}>{past.length} erhalten</Chip>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{
        margin: '0 18px', padding: 4, borderRadius: 12,
        background: dark ? '#292524' : '#F5F1ED',
        display: 'flex', gap: 2,
      }}>
        {[
          { k: 'wishlist', l: 'Wunschliste' },
          { k: 'gifts', l: 'Geschenke' },
          { k: 'profile', l: 'Profil' },
        ].map(t => (
          <button key={t.k} onClick={() => setTab(t.k)} style={{
            flex: 1, padding: '8px 10px', borderRadius: 9,
            border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
            background: tab === t.k ? (dark ? '#1C1917' : '#fff') : 'transparent',
            color: tab === t.k ? (dark ? '#FAFAF9' : '#1C1917') : (dark ? '#A8A29E' : '#78716C'),
            boxShadow: tab === t.k ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
            transition: 'all 0.15s',
          }}>{t.l}</button>
        ))}
      </div>

      <div style={{ padding: '14px 18px 100px' }}>
        {tab === 'wishlist' && (
          <WishlistTab items={items} addItem={addItem} deleteItem={deleteItem} editingItem={editingItem} setEditingItem={setEditingItem} isMe={isMe} dark={dark} person={person}/>
        )}
        {tab === 'gifts' && (
          <GiftsTab person={person} stack={myStack} past={past} dark={dark} navigate={navigate}/>
        )}
        {tab === 'profile' && (
          <ProfileTab person={person} dark={dark}/>
        )}
      </div>
    </div>
  );
}

function WishlistTab({ items, addItem, deleteItem, editingItem, setEditingItem, isMe, dark, person }) {
  const [text, setText] = useStateP('');
  const [url, setUrl] = useStateP('');
  const [price, setPrice] = useStateP('');
  const [showExtra, setShowExtra] = useStateP(false);

  const submit = () => {
    if (!text.trim()) return;
    addItem(text, url, price);
    setText(''); setUrl(''); setPrice(''); setShowExtra(false);
  };

  return (
    <div>
      <Card dark={dark} style={{ padding: 12, marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 18, paddingLeft: 4 }}>✨</span>
          <input
            placeholder={isMe ? 'Was wünschst du dir?' : `Was wünscht sich ${person.name}?`}
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && submit()}
            style={{
              flex: 1, padding: '10px 4px', fontSize: 15, border: 'none', outline: 'none',
              background: 'transparent', color: dark ? '#FAFAF9' : '#1C1917', fontFamily: 'inherit',
            }}
          />
          {!showExtra && text && (
            <button onClick={() => setShowExtra(true)} style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              fontSize: 12, fontWeight: 600, color: dark ? '#FCD34D' : '#B45309', padding: 4,
            }}>+ Details</button>
          )}
          <button onClick={submit} disabled={!text.trim()} style={{
            background: text.trim() ? 'linear-gradient(135deg, #F59E0B 0%, #F97316 100%)' : (dark ? '#3A3633' : '#E7E5E4'),
            color: '#fff', border: 'none', cursor: text.trim() ? 'pointer' : 'default',
            borderRadius: 10, width: 36, height: 36,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}><Icon.plus style={{ width: 18, height: 18 }}/></button>
        </div>
        {showExtra && (
          <div style={{ display: 'flex', gap: 8, marginTop: 10, paddingLeft: 30 }}>
            <Input dark={dark} placeholder="Link (optional)" value={url} onChange={e => setUrl(e.target.value)} style={{ flex: 2, padding: '8px 12px', fontSize: 13 }}/>
            <Input dark={dark} placeholder="€" value={price} onChange={e => setPrice(e.target.value)} type="number" style={{ flex: 1, padding: '8px 12px', fontSize: 13 }}/>
          </div>
        )}
      </Card>

      {items.length === 0 ? (
        <EmptyState emoji="📝" title="Noch keine Wünsche — leg los!" subtitle="Schreib einfach rein, was dir vorschwebt. Auch lose Ideen helfen." dark={dark}/>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {items.map(it => (
            <div key={it.id} style={{
              padding: '14px 14px',
              background: dark ? '#292524' : '#FFFFFF',
              borderRadius: 14,
              border: dark ? '1px solid #3A3633' : '1px solid #F0EBE6',
              display: 'flex', alignItems: 'flex-start', gap: 10,
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14.5, fontWeight: 600, color: dark ? '#FAFAF9' : '#1C1917', lineHeight: 1.35 }}>
                  {it.text}
                </div>
                <div style={{ display: 'flex', gap: 10, marginTop: 6, alignItems: 'center', fontSize: 12 }}>
                  {it.price && <span style={{
                    color: dark ? '#FCD34D' : '#B45309', fontWeight: 600,
                  }}>{it.price} €</span>}
                  {it.url && (
                    <a href={it.url} onClick={e => e.preventDefault()} style={{
                      color: dark ? '#A8A29E' : '#78716C', textDecoration: 'none',
                      display: 'flex', alignItems: 'center', gap: 3,
                    }}><Icon.link/> Link</a>
                  )}
                  <span style={{ color: dark ? '#78716C' : '#A8A29E' }}>{fmtDateShort(it.addedAt)}</span>
                </div>
              </div>
              <button onClick={() => deleteItem(it.id)} style={{
                background: 'transparent', border: 'none', cursor: 'pointer',
                color: dark ? '#78716C' : '#A8A29E', padding: 4,
              }}><Icon.trash/></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function GiftsTab({ person, stack, past, dark, navigate }) {
  const all = [
    ...stack.map(g => ({ ...g, status: 'open' })),
    ...past,
  ];
  if (all.length === 0) {
    return <EmptyState emoji="🎁" title="Noch kein Geschenk hier" subtitle={`Lege ein neues Geschenk für ${person.name} an.`} dark={dark} action={<Button>+ Neues Geschenk anlegen</Button>}/>;
  }
  const byYear = {};
  all.forEach(g => { (byYear[g.year] ||= []).push(g); });
  const years = Object.keys(byYear).sort((a, b) => b - a);

  return (
    <div>
      {years.map(y => (
        <div key={y} style={{ marginBottom: 18 }}>
          <div style={{
            fontSize: 12, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase',
            color: dark ? '#A8A29E' : '#A8A29E', marginBottom: 8, paddingLeft: 4,
          }}>{y}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {byYear[y].map(g => (
              <div key={g.id} onClick={() => g.status === 'open' && navigate('gift', g.id)} style={{
                padding: '12px 14px',
                background: dark ? '#292524' : '#FFFFFF',
                borderRadius: 14,
                border: dark ? '1px solid #3A3633' : '1px solid #F0EBE6',
                display: 'flex', alignItems: 'center', gap: 10,
                cursor: g.status === 'open' ? 'pointer' : 'default',
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: g.status === 'open' ? 'linear-gradient(135deg, #FBBF24 0%, #F97316 100%)' : (dark ? '#3A3633' : '#E7E5E4'),
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: g.status === 'open' ? '#fff' : (dark ? '#A8A29E' : '#78716C'),
                }}><Icon.gift/></div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: dark ? '#FAFAF9' : '#1C1917' }}>
                    {g.title || `Geschenk ${y}`}
                  </div>
                  <div style={{ fontSize: 12, color: dark ? '#A8A29E' : '#78716C', marginTop: 2 }}>
                    {g.status === 'open' ? `${g.participants?.length || 0} Personen · ${(g.budgetPerPerson || 0) * (g.participants?.length || 0)} €` : `erhalten · ${g.price} €`}
                  </div>
                </div>
                {g.status === 'open' ? (
                  <Chip variant="info" dark={dark}>offen</Chip>
                ) : (
                  <Chip variant="success" dark={dark}>erhalten</Chip>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
      <Button variant="secondary" dark={dark} style={{ width: '100%', marginTop: 4 }}>
        <Icon.plus/> Neues Geschenk anlegen
      </Button>
    </div>
  );
}

function ProfileTab({ person, dark }) {
  const fields = [
    { k: 'Name', v: person.name },
    { k: 'Geburtstag', v: fmtDate(person.birthday) },
    { k: 'E-Mail', v: person.email || '—' },
  ];
  return (
    <div>
      <Card dark={dark} style={{ padding: 0, overflow: 'hidden' }}>
        {fields.map((f, i) => (
          <div key={f.k} style={{
            padding: '14px 16px', display: 'flex', justifyContent: 'space-between',
            borderTop: i > 0 ? (dark ? '1px solid #3A3633' : '1px solid #F0EBE6') : 'none',
          }}>
            <span style={{ fontSize: 13, color: dark ? '#A8A29E' : '#78716C', fontWeight: 500 }}>{f.k}</span>
            <span style={{ fontSize: 14, color: dark ? '#FAFAF9' : '#1C1917', fontWeight: 600 }}>{f.v}</span>
          </div>
        ))}
      </Card>
      <Button variant="danger" dark={dark} style={{ width: '100%', marginTop: 14 }}>
        <Icon.trash/> Person löschen
      </Button>
    </div>
  );
}

// ── GIFT PAGE ──────────────────────────────────────────────────
function GiftPage({ ctx, giftId }) {
  const { people, stack, setStack, identity, dark, navigate, openIdentityPicker, openConfirmReceived } = ctx;
  const peopleById = Object.fromEntries(people.map(p => [p.id, p]));
  const gift = stack.find(g => g.id === giftId);
  const toast = useToast();
  const [newSugg, setNewSugg] = useStateP('');
  const [editBudget, setEditBudget] = useStateP(false);
  const [budgetDraft, setBudgetDraft] = useStateP('');

  if (!gift) return null;
  const person = peopleById[gift.personId];
  const totalBudget = gift.budgetPerPerson * gift.participants.length;

  const updateGift = (patch) => setStack(stack.map(g => g.id === gift.id ? { ...g, ...patch } : g));

  const toggleParticipant = (pid) => {
    if (!identity) { openIdentityPicker(); return; }
    if (gift.participants.includes(pid)) {
      updateGift({ participants: gift.participants.filter(p => p !== pid) });
    } else {
      updateGift({ participants: [...gift.participants, pid] });
    }
  };

  const addSuggestion = () => {
    if (!newSugg.trim()) return;
    if (!identity) { openIdentityPicker(); return; }
    updateGift({
      suggestions: [...gift.suggestions, {
        id: uid('s'), title: newSugg.trim(), by: identity,
      }],
    });
    setNewSugg('');
    toast('Vorschlag hinzugefügt');
  };

  const startPoll = () => updateGift({ pollStatus: 'active', votes: {} });
  const endPoll = () => updateGift({ pollStatus: 'ended' });
  const vote = (sid) => {
    if (!identity) { openIdentityPicker(); return; }
    updateGift({ votes: { ...gift.votes, [identity]: sid } });
    toast('Stimme gespeichert');
  };

  // tally votes
  const voteTally = {};
  gift.suggestions.forEach(s => voteTally[s.id] = []);
  Object.entries(gift.votes).forEach(([pid, sid]) => {
    if (voteTally[sid]) voteTally[sid].push(pid);
  });
  const winnerId = gift.pollStatus === 'ended'
    ? Object.entries(voteTally).sort((a, b) => b[1].length - a[1].length)[0]?.[0]
    : null;

  return (
    <div>
      <PageHeader
        onBack={() => navigate('home')}
        title={`Geschenk für ${person.name}`}
        subtitle={`🎁 Jahr ${gift.year} · in ${daysUntilBirthday(person.birthday)} Tagen`}
        dark={dark}
        right={<Chip variant="info" dark={dark}>offen</Chip>}
      />

      {/* Person banner */}
      <div style={{ padding: '0 18px 16px' }}>
        <div style={{
          padding: '14px 16px', borderRadius: 16,
          background: `linear-gradient(135deg, ${person.color}22, ${person.color}08)`,
          border: dark ? '1px solid #3A3633' : `1px solid ${person.color}33`,
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <Avatar person={person} size={44}/>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: dark ? '#FAFAF9' : '#1C1917' }}>{person.name}</div>
            <div style={{ fontSize: 12, color: dark ? '#A8A29E' : '#78716C', marginTop: 1 }}>
              {fmtDate(person.birthday)} · wird {ageOnNextBirthday(person.birthday)}
            </div>
          </div>
          <button onClick={() => navigate('person', person.id)} style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: dark ? '#A8A29E' : '#78716C', padding: 6,
          }}><Icon.chev/></button>
        </div>
      </div>

      {/* Teilnehmer */}
      <Section title="Teilnehmer" dark={dark} hint={`${gift.participants.length} dabei`}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
          {people.filter(p => p.id !== gift.personId).map(p => {
            const joined = gift.participants.includes(p.id);
            return (
              <button key={p.id} onClick={() => toggleParticipant(p.id)} style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '5px 10px 5px 5px', borderRadius: 999,
                background: joined
                  ? `linear-gradient(135deg, ${p.color}, ${p.color}dd)`
                  : (dark ? '#292524' : '#fff'),
                border: joined ? 'none' : (dark ? '1px solid #3A3633' : '1px solid #E7E5E4'),
                color: joined ? '#fff' : (dark ? '#E7E5E4' : '#44403C'),
                fontSize: 13, fontWeight: 600, cursor: 'pointer',
                transition: 'all 0.15s',
              }}>
                <Avatar person={p} size={22}/>
                {p.name}
                {joined && <Icon.check style={{ width: 14, height: 14, marginLeft: 1 }}/>}
              </button>
            );
          })}
        </div>
        <div style={{
          padding: '12px 14px', borderRadius: 12,
          background: dark ? '#292524' : '#FAFAF9',
          border: dark ? '1px solid #3A3633' : '1px solid #F0EBE6',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ fontSize: 13, color: dark ? '#A8A29E' : '#78716C' }}>
            <strong style={{ color: dark ? '#FAFAF9' : '#1C1917', fontSize: 15 }}>
              {gift.participants.length} × {editBudget ? (
                <input type="number" autoFocus value={budgetDraft}
                  onChange={e => setBudgetDraft(e.target.value)}
                  onBlur={() => { if (budgetDraft) updateGift({ budgetPerPerson: parseFloat(budgetDraft) }); setEditBudget(false); }}
                  onKeyDown={e => e.key === 'Enter' && e.target.blur()}
                  style={{ width: 50, padding: '2px 4px', borderRadius: 6, border: '1px solid #F97316', fontSize: 15, fontWeight: 700, fontFamily: 'inherit', background: 'transparent', color: 'inherit' }}/>
              ) : (
                <span onClick={() => { setEditBudget(true); setBudgetDraft(String(gift.budgetPerPerson)); }} style={{ cursor: 'pointer', borderBottom: '1px dashed #F97316' }}>
                  {gift.budgetPerPerson} €
                </span>
              )}
            </strong>
            <span style={{ margin: '0 6px' }}>=</span>
          </div>
          <div style={{
            fontSize: 22, fontWeight: 800, letterSpacing: -0.4,
            color: dark ? '#FCD34D' : '#B45309',
          }}>{totalBudget} €</div>
        </div>
      </Section>

      {/* Vorschläge */}
      <Section title="Vorschläge" dark={dark} hint={`${gift.suggestions.length}`}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {gift.suggestions.map(s => {
            const author = peopleById[s.by];
            const isWinner = s.id === winnerId;
            const voters = voteTally[s.id] || [];
            const myVote = identity && gift.votes[identity] === s.id;
            return (
              <div key={s.id} style={{
                padding: '14px 14px', borderRadius: 14,
                background: isWinner ? (dark ? '#451A03' : '#FFFBEB') : (dark ? '#292524' : '#fff'),
                border: isWinner ? '2px solid #F97316' : (dark ? '1px solid #3A3633' : '1px solid #F0EBE6'),
                position: 'relative',
              }}>
                {isWinner && (
                  <div style={{
                    position: 'absolute', top: -10, right: 12,
                    background: 'linear-gradient(135deg, #F59E0B, #F97316)',
                    color: '#fff', padding: '3px 10px', borderRadius: 999,
                    fontSize: 11, fontWeight: 700, letterSpacing: 0.4,
                    boxShadow: '0 4px 10px -2px rgba(249,115,22,0.5)',
                  }}>🏆 Gewonnen</div>
                )}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: dark ? '#FAFAF9' : '#1C1917', lineHeight: 1.3 }}>
                      {s.title}
                    </div>
                    <div style={{ display: 'flex', gap: 10, marginTop: 5, alignItems: 'center', fontSize: 12 }}>
                      {s.price && <span style={{ color: dark ? '#FCD34D' : '#B45309', fontWeight: 600 }}>{s.price} €</span>}
                      {s.url && <span style={{ color: dark ? '#A8A29E' : '#78716C', display: 'flex', alignItems: 'center', gap: 3 }}><Icon.link/> Link</span>}
                      <span style={{ color: dark ? '#78716C' : '#A8A29E' }}>von {author?.name || '—'}</span>
                    </div>
                    {s.note && <div style={{ fontSize: 12, color: dark ? '#A8A29E' : '#78716C', marginTop: 6, lineHeight: 1.4, fontStyle: 'italic' }}>„{s.note}"</div>}
                  </div>
                  {gift.pollStatus !== 'none' && (
                    <button onClick={() => gift.pollStatus === 'active' && vote(s.id)}
                      disabled={gift.pollStatus === 'ended'}
                      style={{
                        width: 28, height: 28, borderRadius: '50%',
                        border: myVote ? 'none' : '2px solid ' + (dark ? '#44403C' : '#D6D3D1'),
                        background: myVote ? 'linear-gradient(135deg, #F59E0B, #F97316)' : 'transparent',
                        cursor: gift.pollStatus === 'active' ? 'pointer' : 'default',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: '#fff', flexShrink: 0,
                      }}>
                      {myVote && <Icon.check style={{ width: 14, height: 14 }}/>}
                    </button>
                  )}
                </div>
                {gift.pollStatus !== 'none' && voters.length > 0 && (
                  <div style={{
                    marginTop: 10, paddingTop: 10,
                    borderTop: dark ? '1px solid #3A3633' : '1px solid #F0EBE6',
                    display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap',
                  }}>
                    <div style={{ display: 'flex' }}>
                      {voters.map((vid, i) => (
                        <div key={vid} style={{ marginLeft: i > 0 ? -6 : 0 }}>
                          <Avatar person={peopleById[vid]} size={20} ring dark={dark}/>
                        </div>
                      ))}
                    </div>
                    <div style={{ fontSize: 12, color: dark ? '#A8A29E' : '#78716C', fontWeight: 500 }}>
                      {voters.map(v => peopleById[v]?.name).join(', ')} {voters.length === 1 ? 'hat' : 'haben'} gewählt
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div style={{
          marginTop: 10, padding: 10,
          background: dark ? '#292524' : '#FAFAF9',
          borderRadius: 12, border: dark ? '1px solid #3A3633' : '1px solid #F0EBE6',
          display: 'flex', gap: 8, alignItems: 'center',
        }}>
          <input
            value={newSugg}
            onChange={e => setNewSugg(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addSuggestion()}
            placeholder="Idee teilen…"
            style={{
              flex: 1, border: 'none', outline: 'none', background: 'transparent',
              padding: '6px 4px', fontSize: 14,
              color: dark ? '#FAFAF9' : '#1C1917', fontFamily: 'inherit',
            }}
          />
          <Button size="sm" onClick={addSuggestion} disabled={!newSugg.trim()} style={{ minHeight: 32, padding: '6px 12px' }}>
            Teilen
          </Button>
        </div>
      </Section>

      {/* Abstimmung */}
      <Section title="Abstimmung" dark={dark}>
        {gift.pollStatus === 'none' && (
          <div style={{ textAlign: 'center', padding: '8px 0' }}>
            <Button onClick={startPoll} style={{ width: '100%' }}>
              <Icon.vote/> Abstimmung starten
            </Button>
            <p style={{ fontSize: 12, color: dark ? '#A8A29E' : '#78716C', marginTop: 8, lineHeight: 1.4 }}>
              Jede Person hat eine Stimme. Stimmen sind sichtbar.
            </p>
          </div>
        )}
        {gift.pollStatus === 'active' && (
          <div>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 12px', borderRadius: 12,
              background: dark ? '#451A03' : '#FEF3C7',
              marginBottom: 10,
            }}>
              <span style={{ fontSize: 18 }}>🗳️</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: dark ? '#FCD34D' : '#92400E' }}>
                  Abstimmung läuft
                </div>
                <div style={{ fontSize: 12, color: dark ? '#FCD34D' : '#92400E', opacity: 0.8 }}>
                  {Object.keys(gift.votes).length} von {gift.participants.length} Stimmen
                </div>
              </div>
            </div>
            <Button variant="secondary" dark={dark} onClick={endPoll} style={{ width: '100%' }}>
              Abstimmung beenden
            </Button>
          </div>
        )}
        {gift.pollStatus === 'ended' && (
          <div style={{
            padding: '14px 14px', borderRadius: 12,
            background: dark ? '#451A03' : '#FEF3C7',
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <span style={{ fontSize: 22 }}>🏆</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: dark ? '#FCD34D' : '#92400E' }}>
                Gewinner steht fest
              </div>
              <div style={{ fontSize: 12, color: dark ? '#FCD34D' : '#92400E', opacity: 0.85, marginTop: 1 }}>
                {gift.suggestions.find(s => s.id === winnerId)?.title}
              </div>
            </div>
          </div>
        )}
      </Section>

      <div style={{ padding: '6px 18px 100px' }}>
        <Button size="lg" onClick={() => openConfirmReceived(gift.id)} style={{ width: '100%' }}>
          <Icon.check/> Geschenk erhalten
        </Button>
      </div>
    </div>
  );
}

function Section({ title, hint, dark, children }) {
  return (
    <div style={{ padding: '0 18px 18px' }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 10, paddingLeft: 2,
      }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: dark ? '#FAFAF9' : '#1C1917', letterSpacing: -0.1 }}>{title}</h3>
        {hint && <span style={{ fontSize: 12, color: dark ? '#A8A29E' : '#A8A29E', fontWeight: 500 }}>{hint}</span>}
      </div>
      {children}
    </div>
  );
}

// ── PEOPLE PAGE ────────────────────────────────────────────────
function PeoplePage({ ctx }) {
  const { people, dark, navigate, openIdentityPicker, identity, openAddPerson } = ctx;
  const [sort, setSort] = useStateP('birthday');
  const me = people.find(p => p.id === identity);

  const sorted = useMemoP(() => {
    const xs = [...people];
    if (sort === 'birthday') xs.sort((a, b) => daysUntilBirthday(a.birthday) - daysUntilBirthday(b.birthday));
    else xs.sort((a, b) => a.name.localeCompare(b.name, 'de'));
    return xs;
  }, [people, sort]);

  return (
    <div>
      <PageHeader
        title="Personen"
        subtitle={`${people.length} im Freundeskreis`}
        dark={dark}
        right={<IdentityChip person={me} dark={dark} onClick={openIdentityPicker}/>}
      />
      <div style={{
        padding: '0 18px 12px', display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <div style={{
          flex: 1, padding: 4, borderRadius: 10,
          background: dark ? '#292524' : '#F5F1ED', display: 'flex', gap: 2,
        }}>
          {[
            { k: 'birthday', l: 'Nächster Geburtstag' },
            { k: 'alpha', l: 'A–Z' },
          ].map(t => (
            <button key={t.k} onClick={() => setSort(t.k)} style={{
              flex: 1, padding: '7px 8px', borderRadius: 8,
              border: 'none', cursor: 'pointer', fontSize: 12.5, fontWeight: 600,
              background: sort === t.k ? (dark ? '#1C1917' : '#fff') : 'transparent',
              color: sort === t.k ? (dark ? '#FAFAF9' : '#1C1917') : (dark ? '#A8A29E' : '#78716C'),
            }}>{t.l}</button>
          ))}
        </div>
      </div>
      <div style={{ padding: '0 18px 100px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {sorted.map(p => {
          const days = daysUntilBirthday(p.birthday);
          const isUrgent = days <= 14;
          return (
            <div key={p.id} onClick={() => navigate('person', p.id)} style={{
              padding: '16px 14px',
              background: dark ? '#292524' : '#fff',
              borderRadius: 18,
              border: dark ? '1px solid #3A3633' : '1px solid #F0EBE6',
              cursor: 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 8,
              minHeight: 130,
            }}>
              <Avatar person={p} size={40}/>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: dark ? '#FAFAF9' : '#1C1917', letterSpacing: -0.2 }}>
                  {p.name}{p.id === identity && <span style={{ fontSize: 11, color: dark ? '#FCD34D' : '#B45309', fontWeight: 600, marginLeft: 5 }}>· du</span>}
                </div>
                <div style={{ fontSize: 12, color: dark ? '#A8A29E' : '#78716C', marginTop: 1, fontWeight: 500 }}>
                  {fmtDate(p.birthday)}
                </div>
              </div>
              <Chip variant={isUrgent ? 'accent' : 'neutral'} dark={dark} style={{ marginTop: 'auto' }}>
                {days === 0 ? 'heute 🎂' : `in ${days} T.`}
              </Chip>
            </div>
          );
        })}
      </div>

      <button onClick={openAddPerson} style={{
        position: 'absolute', right: 22, bottom: 92, zIndex: 50,
        width: 56, height: 56, borderRadius: 28,
        background: 'linear-gradient(135deg, #F59E0B 0%, #F97316 100%)',
        color: '#fff', border: 'none', cursor: 'pointer',
        boxShadow: '0 14px 28px -8px rgba(249,115,22,0.55), 0 0 0 1px rgba(255,255,255,0.2) inset',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon.plus style={{ width: 26, height: 26 }}/>
      </button>
    </div>
  );
}

// ── SETTINGS PAGE ──────────────────────────────────────────────
function SettingsPage({ ctx }) {
  const { people, identity, setIdentity, dark, setDark, navigate, defaultBudget, setDefaultBudget, onLogout } = ctx;
  const me = people.find(p => p.id === identity);
  const toast = useToast();

  return (
    <div>
      <PageHeader title="Einstellungen" dark={dark}/>
      <div style={{ padding: '0 18px 100px' }}>
        <SettingsGroup title="Wer bin ich?" dark={dark}>
          <div style={{ padding: 12 }}>
            <div style={{ fontSize: 12, color: dark ? '#A8A29E' : '#78716C', marginBottom: 8, lineHeight: 1.4 }}>
              Beeinflusst, wem deine Stimmen, Vorschläge und Wünsche zugeordnet werden.
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {people.map(p => (
                <button key={p.id} onClick={() => { setIdentity(p.id); toast(`Du bist jetzt ${p.name}`); }} style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '5px 11px 5px 5px', borderRadius: 999,
                  background: identity === p.id ? `linear-gradient(135deg, ${p.color}, ${p.color}dd)` : (dark ? '#1C1917' : '#FAFAF9'),
                  border: identity === p.id ? 'none' : (dark ? '1px solid #3A3633' : '1px solid #E7E5E4'),
                  color: identity === p.id ? '#fff' : (dark ? '#E7E5E4' : '#44403C'),
                  fontSize: 13, fontWeight: 600, cursor: 'pointer',
                }}>
                  <Avatar person={p} size={22}/>{p.name}
                </button>
              ))}
            </div>
          </div>
        </SettingsGroup>

        <SettingsGroup title="Geschenke" dark={dark}>
          <SettingsRow dark={dark} label="Default-Budget pro Person" hint="Für neue Geschenke" right={
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <input type="number" value={defaultBudget} onChange={e => setDefaultBudget(parseFloat(e.target.value) || 0)}
                style={{ width: 60, padding: '6px 8px', textAlign: 'right', borderRadius: 8, border: dark ? '1px solid #3A3633' : '1px solid #E7E5E4', background: dark ? '#1C1917' : '#fff', color: dark ? '#FAFAF9' : '#1C1917', fontSize: 14, fontWeight: 600, fontFamily: 'inherit', outline: 'none' }}/>
              <span style={{ color: dark ? '#A8A29E' : '#78716C' }}>€</span>
            </div>
          }/>
        </SettingsGroup>

        <SettingsGroup title="Aussehen" dark={dark}>
          <SettingsRow dark={dark} label="Dark Mode" icon={<Icon.moon/>}
            right={<Toggle on={dark} onChange={() => setDark(!dark)} dark={dark}/>}/>
        </SettingsGroup>

        <SettingsGroup title="Mitteilungen" dark={dark}>
          <SettingsRow dark={dark} label="Mail-Benachrichtigungen" icon={<Icon.mail/>}
            hint="Erinnerungen vor Geburtstagen"
            right={<Chip variant="neutral" dark={dark}>bald verfügbar</Chip>}/>
        </SettingsGroup>

        <SettingsGroup title="Sicherheit" dark={dark}>
          <SettingsRow dark={dark} label="Passwort ändern" icon={<Icon.lock/>}
            right={<Icon.chev style={{ color: dark ? '#A8A29E' : '#A8A29E' }}/>} onClick={() => toast('Demo: nicht implementiert')}/>
          <SettingsRow dark={dark} label="Abmelden" icon={<Icon.x/>}
            right={null} onClick={onLogout} danger/>
        </SettingsGroup>

        <div style={{ textAlign: 'center', padding: '20px 0 6px', fontSize: 11, color: dark ? '#57534E' : '#A8A29E' }}>
          Geschenke-Manager · v0.4 · trust-based
        </div>
      </div>
    </div>
  );
}

function SettingsGroup({ title, dark, children }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{
        fontSize: 11, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase',
        color: dark ? '#A8A29E' : '#A8A29E', padding: '6px 14px 6px',
      }}>{title}</div>
      <Card dark={dark} style={{ padding: 0, overflow: 'hidden' }}>{children}</Card>
    </div>
  );
}

function SettingsRow({ label, hint, right, icon, dark, onClick, danger }) {
  return (
    <div onClick={onClick} style={{
      padding: '13px 14px', display: 'flex', alignItems: 'center', gap: 12,
      cursor: onClick ? 'pointer' : 'default',
      borderTop: dark ? '1px solid #3A3633' : '1px solid #F5F1ED',
    }}>
      {icon && <div style={{
        width: 32, height: 32, borderRadius: 9,
        background: danger ? (dark ? '#7F1D1D' : '#FEE2E2') : (dark ? '#3A3633' : '#F5F1ED'),
        color: danger ? (dark ? '#FCA5A5' : '#B91C1C') : (dark ? '#E7E5E4' : '#57534E'),
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>{icon}</div>}
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: danger ? (dark ? '#FCA5A5' : '#B91C1C') : (dark ? '#FAFAF9' : '#1C1917') }}>{label}</div>
        {hint && <div style={{ fontSize: 12, color: dark ? '#A8A29E' : '#78716C', marginTop: 1 }}>{hint}</div>}
      </div>
      {right}
    </div>
  );
}

function Toggle({ on, onChange, dark }) {
  return (
    <button onClick={onChange} style={{
      width: 46, height: 28, borderRadius: 14, padding: 2,
      background: on ? 'linear-gradient(135deg, #F59E0B, #F97316)' : (dark ? '#3A3633' : '#D6D3D1'),
      border: 'none', cursor: 'pointer', display: 'flex',
      transition: 'background 0.2s',
    }}>
      <div style={{
        width: 24, height: 24, borderRadius: '50%', background: '#fff',
        transform: on ? 'translateX(18px)' : 'translateX(0)',
        transition: 'transform 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
      }}/>
    </button>
  );
}

Object.assign(window, { LoginPage, HomePage, PersonPage, GiftPage, PeoplePage, SettingsPage });

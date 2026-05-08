// dialogs.jsx — All modal dialogs (identity, add person, add to stack, confirm received)

const { useState: useStateD } = React;

function IdentityPickerDialog({ open, onClose, people, identity, setIdentity, dark }) {
  const toast = useToast();
  return (
    <Dialog open={open} onClose={onClose} title="Wer bist du?" dark={dark}>
      <p style={{ fontSize: 13, color: dark ? '#A8A29E' : '#78716C', margin: '0 0 14px', lineHeight: 1.5 }}>
        Beeinflusst, wem deine Stimmen, Vorschläge und Wünsche zugeordnet werden. Kannst du jederzeit ändern.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {people.map(p => {
          const sel = identity === p.id;
          return (
            <button key={p.id} onClick={() => { setIdentity(p.id); toast(`Du bist jetzt ${p.name}`); onClose(); }} style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px',
              borderRadius: 14,
              background: sel ? (dark ? '#451A03' : '#FEF3C7') : (dark ? '#1C1917' : '#fff'),
              border: sel ? '2px solid #F97316' : (dark ? '1px solid #3A3633' : '1px solid #E7E5E4'),
              cursor: 'pointer', textAlign: 'left',
            }}>
              <Avatar person={p} size={36}/>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: dark ? '#FAFAF9' : '#1C1917' }}>{p.name}</div>
                <div style={{ fontSize: 12, color: dark ? '#A8A29E' : '#78716C', marginTop: 1 }}>{fmtDate(p.birthday)}</div>
              </div>
              {sel && (
                <div style={{
                  width: 24, height: 24, borderRadius: '50%',
                  background: 'linear-gradient(135deg, #F59E0B, #F97316)', color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}><Icon.check style={{ width: 14, height: 14 }}/></div>
              )}
            </button>
          );
        })}
      </div>
    </Dialog>
  );
}

function AddPersonDialog({ open, onClose, onAdd, dark }) {
  const [name, setName] = useStateD('');
  const [bd, setBd] = useStateD('');
  const [email, setEmail] = useStateD('');
  const submit = () => {
    if (!name.trim() || !bd) return;
    onAdd({ name: name.trim(), birthday: bd, email: email.trim() || undefined });
    setName(''); setBd(''); setEmail('');
    onClose();
  };
  return (
    <Dialog open={open} onClose={onClose} title="Person hinzufügen" dark={dark}
      footer={
        <Button size="lg" onClick={submit} disabled={!name.trim() || !bd} style={{ width: '100%', opacity: (!name.trim() || !bd) ? 0.5 : 1 }}>
          Hinzufügen
        </Button>
      }>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingBottom: 8 }}>
        <Input dark={dark} label="Name" placeholder="z.B. Lisa" value={name} onChange={e => setName(e.target.value)}/>
        <Input dark={dark} label="Geburtstag" type="date" value={bd} onChange={e => setBd(e.target.value)}/>
        <Input dark={dark} label="E-Mail (optional)" type="email" placeholder="lisa@example.com" value={email} onChange={e => setEmail(e.target.value)}/>
      </div>
    </Dialog>
  );
}

function AddToStackDialog({ open, onClose, people, stack, onAdd, dark, defaultBudget }) {
  const [pid, setPid] = useStateD('');
  const [year, setYear] = useStateD(2026);
  const inStack = new Set(stack.map(s => s.personId));
  const eligible = people.filter(p => !inStack.has(p.id));

  const submit = () => {
    if (!pid) return;
    onAdd(pid, year);
    setPid('');
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} title="Geschenk zum Stack hinzufügen" dark={dark}
      footer={
        <Button size="lg" onClick={submit} disabled={!pid} style={{ width: '100%', opacity: !pid ? 0.5 : 1 }}>
          Zum Stack hinzufügen
        </Button>
      }>
      <p style={{ fontSize: 13, color: dark ? '#A8A29E' : '#78716C', margin: '0 0 14px', lineHeight: 1.5 }}>
        Manuell, falls jemand nicht automatisch im Stack auftaucht.
      </p>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: dark ? '#A8A29E' : '#78716C', marginBottom: 8, paddingLeft: 2 }}>
          Für wen?
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {eligible.length === 0 && <p style={{ fontSize: 13, color: dark ? '#A8A29E' : '#78716C' }}>Alle Personen sind schon im Stack.</p>}
          {eligible.map(p => (
            <button key={p.id} onClick={() => setPid(p.id)} style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '5px 11px 5px 5px', borderRadius: 999,
              background: pid === p.id ? `linear-gradient(135deg, ${p.color}, ${p.color}dd)` : (dark ? '#1C1917' : '#fff'),
              border: pid === p.id ? 'none' : (dark ? '1px solid #3A3633' : '1px solid #E7E5E4'),
              color: pid === p.id ? '#fff' : (dark ? '#E7E5E4' : '#44403C'),
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}>
              <Avatar person={p} size={22}/>{p.name}
            </button>
          ))}
        </div>
      </div>
      <Input dark={dark} label="Jahr (Override)" type="number" value={year} onChange={e => setYear(parseInt(e.target.value, 10))}/>
    </Dialog>
  );
}

function ConfirmReceivedDialog({ open, onClose, gift, person, onConfirm, dark }) {
  if (!gift || !person) return null;
  return (
    <Dialog open={open} onClose={onClose} title="Geschenk erhalten?" dark={dark}
      footer={
        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="secondary" dark={dark} onClick={onClose} style={{ flex: 1 }}>Abbrechen</Button>
          <Button onClick={onConfirm} style={{ flex: 1 }}><Icon.check/> Bestätigen</Button>
        </div>
      }>
      <div style={{
        padding: 16, textAlign: 'center',
        background: 'linear-gradient(135deg, #FBBF2422, #F9731622)',
        borderRadius: 16, marginBottom: 14,
      }}>
        <div style={{ fontSize: 38 }}>🎉</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: dark ? '#FAFAF9' : '#1C1917', marginTop: 4 }}>
          {person.name} hat das Geschenk erhalten?
        </div>
        <div style={{ fontSize: 13, color: dark ? '#A8A29E' : '#78716C', marginTop: 4, lineHeight: 1.4 }}>
          Das Geschenk wandert ins Archiv und wird aus dem Stack entfernt.
        </div>
      </div>
    </Dialog>
  );
}

Object.assign(window, {
  IdentityPickerDialog, AddPersonDialog, AddToStackDialog, ConfirmReceivedDialog,
});

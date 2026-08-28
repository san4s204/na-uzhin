'use client';

import { useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent } from 'react';
import { seedDishes, type DishRecord } from '@/lib/dishes';
import type { RoomSession } from '@/lib/session';

const fallbackDishes: DishRecord[] = seedDishes.map((dish) => ({
  ...dish, votes: 0, voters: [], voterIds: [],
}));
const filters = ['Всё', 'Быстро', 'Уютно', 'Полегче', 'Оба за'];
type DishForm = { id?: string; name: string; minutes: string; category: string; note: string; image: string; priceBand: string };
const emptyForm: DishForm = { name: '', minutes: '30', category: 'Уютно', note: '', image: '', priceBand: '₽₽' };

export default function RoomApp() {
  const [status, setStatus] = useState<'checking' | 'welcome' | 'joining' | 'ready'>('checking');
  const [session, setSession] = useState<RoomSession | null>(null);
  const [inviteToken, setInviteToken] = useState('');
  const [inviteUrl, setInviteUrl] = useState('');
  const [onboarding, setOnboarding] = useState({ ownerName: '', partnerName: '', roomName: '' });
  const [joinName, setJoinName] = useState('');
  const [onboardingError, setOnboardingError] = useState('');
  const [dishes, setDishes] = useState<DishRecord[]>(fallbackDishes);
  const [filter, setFilter] = useState('Всё');
  const [pickerDish, setPickerDish] = useState<DishRecord | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [isChoosing, setIsChoosing] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [roomOpen, setRoomOpen] = useState(false);
  const [form, setForm] = useState<DishForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');
  const cycleRef = useRef<number | null>(null);
  const stopRef = useRef<number | null>(null);

  useEffect(() => {
    const invite = new URLSearchParams(window.location.search).get('invite') || '';
    setInviteToken(invite);
    void boot(invite);
    return () => {
      if (cycleRef.current) window.clearInterval(cycleRef.current);
      if (stopRef.current) window.clearTimeout(stopRef.current);
    };
  }, []);

  useEffect(() => {
    if (status !== 'ready') return;
    const timer = window.setInterval(() => { void refreshRoom(true); }, 7000);
    return () => window.clearInterval(timer);
  }, [status]);

  async function boot(invite: string) {
    try {
      const response = await fetch('/api/session', { cache: 'no-store' });
      const data = await response.json() as { authenticated: boolean; session?: RoomSession };
      if (data.authenticated && data.session) {
        setSession(data.session);
        setStatus('ready');
        if (invite) window.history.replaceState({}, '', window.location.pathname);
        await loadDishes(true);
      } else {
        setStatus(invite ? 'joining' : 'welcome');
        setLoading(false);
      }
    } catch {
      setStatus(invite ? 'joining' : 'welcome');
      setLoading(false);
    }
  }

  async function loadDishes(silent = false) {
    try {
      const response = await fetch('/api/dishes', { cache: 'no-store' });
      if (!response.ok) throw new Error('load failed');
      const data = await response.json() as { dishes: DishRecord[] };
      setDishes(data.dishes);
    } catch {
      if (!silent) showNotice('Не удалось обновить коллекцию. Попробуйте ещё раз.');
    } finally {
      setLoading(false);
    }
  }

  async function refreshRoom(silent = false) {
    try {
      const [sessionResponse, dishesResponse] = await Promise.all([
        fetch('/api/session', { cache: 'no-store' }),
        fetch('/api/dishes', { cache: 'no-store' }),
      ]);
      if (sessionResponse.status === 401 || dishesResponse.status === 401) {
        setSession(null);
        setStatus('welcome');
        return;
      }
      const sessionData = await sessionResponse.json() as { authenticated: boolean; session?: RoomSession };
      const dishesData = await dishesResponse.json() as { dishes?: DishRecord[] };
      if (sessionData.session) setSession(sessionData.session);
      if (dishesData.dishes) setDishes(dishesData.dishes);
    } catch {
      if (!silent) showNotice('Связь прервалась, но ваши данные в безопасности.');
    }
  }

  function showNotice(message: string) {
    setNotice(message);
    window.setTimeout(() => setNotice(''), 3200);
  }

  async function createRoom(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setOnboardingError('');
    try {
      const response = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(onboarding),
      });
      const data = await response.json() as { session?: RoomSession; inviteUrl?: string; imported?: boolean; error?: string };
      if (!response.ok || !data.session) throw new Error(data.error || 'Не удалось создать столик');
      setSession(data.session);
      setInviteUrl(data.inviteUrl || '');
      setRoomOpen(true);
      setStatus('ready');
      setLoading(true);
      await loadDishes();
      if (data.imported) showNotice('Ваши прежние блюда и голоса перенесены');
    } catch (error) {
      setOnboardingError(error instanceof Error ? error.message : 'Не удалось создать столик');
    } finally {
      setSaving(false);
    }
  }

  async function joinRoom(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setOnboardingError('');
    try {
      const response = await fetch('/api/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invite: inviteToken, displayName: joinName }),
      });
      const data = await response.json() as { session?: RoomSession; error?: string };
      if (!response.ok || !data.session) throw new Error(data.error || 'Не удалось присоединиться');
      setSession(data.session);
      setStatus('ready');
      window.history.replaceState({}, '', window.location.pathname);
      setLoading(true);
      await loadDishes();
      showNotice('Готово — теперь это ваш общий столик');
    } catch (error) {
      setOnboardingError(error instanceof Error ? error.message : 'Не удалось присоединиться');
    } finally {
      setSaving(false);
    }
  }

  async function prepareInvite() {
    setSaving(true);
    try {
      let url = inviteUrl;
      if (!url) {
        const response = await fetch('/api/invitations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'rotate' }),
        });
        const data = await response.json() as { inviteUrl?: string; error?: string };
        if (!response.ok || !data.inviteUrl) throw new Error(data.error || 'Не удалось создать приглашение');
        url = data.inviteUrl;
        setInviteUrl(url);
      }
      setRoomOpen(true);
    } catch (error) {
      showNotice(error instanceof Error ? error.message : 'Не удалось создать приглашение');
    } finally {
      setSaving(false);
    }
  }

  async function copyInvite() {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      showNotice('Ссылка скопирована — отправьте её партнёру');
    } catch {
      showNotice('Выделите ссылку и скопируйте вручную');
    }
  }

  async function leaveRoom() {
    setSaving(true);
    try {
      await fetch('/api/session', { method: 'DELETE' });
      setSession(null);
      setDishes(fallbackDishes);
      setInviteUrl('');
      setRoomOpen(false);
      setStatus('welcome');
      window.history.replaceState({}, '', window.location.pathname);
    } finally {
      setSaving(false);
    }
  }

  const partnerJoined = Boolean(session?.members.find((member) => member.slot === 2)?.joined);
  const myId = session?.member.id || '';
  const filteredDishes = useMemo(() => {
    if (filter === 'Всё') return dishes;
    if (filter === 'Оба за') return dishes.filter((dish) => partnerJoined && dish.votes === 2);
    return dishes.filter((dish) => dish.category === filter);
  }, [dishes, filter, partnerJoined]);
  const myDishes = dishes.filter((dish) => dish.voterIds.includes(myId));
  const sharedFinalists = dishes.filter((dish) => dish.votes > 0).sort((a, b) => b.votes - a.votes);
  const agreedDishes = dishes.filter((dish) => partnerJoined && dish.votes === 2);
  const decisionPool = agreedDishes.length ? agreedDishes : sharedFinalists;

  async function toggleVote(dishId: string) {
    if (!session) return;
    const snapshot = dishes;
    setDishes((current) => current.map((dish) => {
      if (dish.id !== dishId) return dish;
      const active = dish.voterIds.includes(myId);
      const voterIds = active ? dish.voterIds.filter((id) => id !== myId) : [...dish.voterIds, myId];
      const voters = active ? dish.voters.filter((name) => name !== session.member.displayName) : [...dish.voters, session.member.displayName];
      return { ...dish, voterIds, voters, votes: voterIds.length };
    }));
    try {
      const response = await fetch('/api/votes', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dishId }),
      });
      if (!response.ok) throw new Error('vote failed');
    } catch {
      setDishes(snapshot);
      showNotice('Голос не сохранился. Попробуйте ещё раз.');
    }
  }

  function chooseRandom(pool: DishRecord[] = filteredDishes) {
    if (!pool.length) return;
    if (cycleRef.current) window.clearInterval(cycleRef.current);
    if (stopRef.current) window.clearTimeout(stopRef.current);
    setPickerOpen(true);
    setIsChoosing(true);
    setPickerDish(pool[Math.floor(Math.random() * pool.length)]);
    cycleRef.current = window.setInterval(() => setPickerDish(pool[Math.floor(Math.random() * pool.length)]), 95);
    stopRef.current = window.setTimeout(() => {
      if (cycleRef.current) window.clearInterval(cycleRef.current);
      setPickerDish(pool[Math.floor(Math.random() * pool.length)]);
      setIsChoosing(false);
    }, 950);
  }

  function openEditDish(dish?: DishRecord) {
    setForm(dish ? { id: dish.id, name: dish.name, minutes: String(dish.minutes), category: dish.category, note: dish.note, image: dish.image, priceBand: dish.priceBand } : emptyForm);
    setEditorOpen(true);
  }

  async function saveDish(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      const response = await fetch('/api/dishes', {
        method: form.id ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || 'Не удалось сохранить блюдо');
      await loadDishes();
      setEditorOpen(false);
      showNotice(form.id ? 'Блюдо обновлено' : 'Блюдо появилось у вас обоих');
    } catch (error) {
      showNotice(error instanceof Error ? error.message : 'Не удалось сохранить блюдо');
    } finally {
      setSaving(false);
    }
  }

  async function deleteDish() {
    if (!form.id) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/dishes?id=${encodeURIComponent(form.id)}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Не удалось удалить блюдо');
      await loadDishes();
      setEditorOpen(false);
      showNotice('Блюдо удалено');
    } catch (error) {
      showNotice(error instanceof Error ? error.message : 'Не удалось удалить блюдо');
    } finally {
      setSaving(false);
    }
  }

  if (status !== 'ready' || !session) {
    return <main><section className="access-gate onboarding-gate" aria-labelledby="access-title"><div className="access-card onboarding-card">
      <span className="access-mark" aria-hidden="true">ну</span>
      <p className="eyebrow"><span /> Личное пространство для двоих</p>
      <h1 id="access-title">{status === 'joining' ? <>Вас ждут<br /><em>за столом</em></> : <>Ваш общий<br /><em>столик</em></>}</h1>
      {status === 'checking' ? <p className="access-checking">Проверяю это устройство…</p> : status === 'joining' ?
        <form className="onboarding-form" onSubmit={joinRoom}>
          <p className="access-intro">Партнёр уже создал пространство. Представьтесь — и ваши голоса будут храниться отдельно.</p>
          <label htmlFor="join-name">Ваше имя<input id="join-name" required minLength={2} maxLength={32} autoFocus value={joinName} onChange={(event) => setJoinName(event.target.value)} placeholder="Как к вам обращаться" /></label>
          <button className="onboarding-submit" type="submit" disabled={saving}>{saving ? 'Присоединяю…' : 'Присоединиться'} <span>→</span></button>
          <button className="onboarding-back" type="button" onClick={() => { setInviteToken(''); setStatus('welcome'); window.history.replaceState({}, '', window.location.pathname); }}>Создать другой столик</button>
          {onboardingError && <p className="access-error" role="alert">{onboardingError}</p>}
        </form> :
        <form className="onboarding-form" onSubmit={createRoom}>
          <p className="access-intro">Создайте приватное пространство для вашей пары. Следующим шагом отправите партнёру одноразовую ссылку.</p>
          <div className="onboarding-names"><label>Ваше имя<input required minLength={2} maxLength={32} autoFocus value={onboarding.ownerName} onChange={(event) => setOnboarding({ ...onboarding, ownerName: event.target.value })} placeholder="Например, Саша" /></label><label>Имя партнёра<input required minLength={2} maxLength={32} value={onboarding.partnerName} onChange={(event) => setOnboarding({ ...onboarding, partnerName: event.target.value })} placeholder="Например, Лера" /></label></div>
          <label>Название столика <small>необязательно</small><input maxLength={32} value={onboarding.roomName} onChange={(event) => setOnboarding({ ...onboarding, roomName: event.target.value })} placeholder="Наши ужины" /></label>
          <button className="onboarding-submit" type="submit" disabled={saving}>{saving ? 'Накрываю стол…' : 'Создать столик'} <span>→</span></button>
          {onboardingError && <p className="access-error" role="alert">{onboardingError}</p>}
          <small className="privacy-note">Без регистрации. У каждого участника будет своя защищённая сессия.</small>
        </form>}
    </div></section></main>;
  }

  const heroDish = dishes.find((dish) => dish.id === 'shakshuka') || dishes[0];
  const heroSelected = Boolean(heroDish?.voterIds.includes(myId));
  return <main>
    <header className="site-header"><a className="brand" href="#top"><span className="brand-mark">ну</span><span>на ужин</span></a><nav><a href="#ideas">Идеи</a><a href="#favorites">Наш выбор</a></nav><div className="header-tools"><button className="room-chip" type="button" onClick={() => setRoomOpen(true)}><span>{session.member.displayName.slice(0, 1).toUpperCase()}</span><small>{session.room.name}</small></button><button className="mini-button" type="button" onClick={() => document.getElementById('favorites')?.scrollIntoView({ behavior: 'smooth' })}><span>♡</span>{myDishes.length ? `${myDishes.length} моих` : 'ещё не выбрано'}</button></div></header>

    <section className="hero" id="top"><div className="hero-copy"><p className="eyebrow"><span /> {partnerJoined ? 'Вы снова выбираете вместе' : `Ждём: ${session.members[1]?.displayName}`}</p><h1>Ну что<br /><em>на ужин?</em></h1><p className="hero-intro">{partnerJoined ? 'Каждый голосует со своего телефона. Совпадения появляются сами — без переключения ролей и подсматривания в чужой экран.' : 'Ваш столик уже готов. Отправьте партнёру приглашение — ссылка сработает один раз и закрепит второй голос за его устройством.'}</p><div className="hero-actions">{partnerJoined ? <button className="primary-button" type="button" onClick={() => chooseRandom()}><span className="dice">✦</span>Удиви нас</button> : <button className="primary-button" type="button" onClick={prepareInvite} disabled={saving}><span className="dice">↗</span>Пригласить</button>}<a className="text-link" href="#ideas">Смотреть все блюда <span>↘</span></a></div><div className="live-note"><span className={loading ? 'loading-dot' : ''} />{loading ? 'Обновляю ваш столик…' : `Выбирает: ${session.member.displayName}`}</div></div>
      {heroDish && <div className="hero-feature"><div className="feature-photo"><img src={heroDish.image} alt={heroDish.name} /><span className="scribble">блюдо дня</span><span className="time-badge">{heroDish.minutes}<br /><small>мин</small></span></div><div className="feature-caption"><div><p>{heroDish.note} · {heroDish.priceBand}</p><h2>{heroDish.name}</h2></div><button className={heroSelected ? 'selected' : ''} type="button" aria-pressed={heroSelected} onClick={() => toggleVote(heroDish.id)}>{heroSelected ? '♥' : '♡'}</button></div><VotePair members={session.members} voterIds={heroDish.voterIds} /></div>}
    </section>

    <section className="ideas" id="ideas"><div className="section-heading"><div><p className="eyebrow"><span /> {session.room.name}</p><h2>Сегодня хочется…</h2></div><div className="section-controls"><div className="filters">{filters.map((item) => <button className={filter === item ? 'active' : ''} key={item} type="button" aria-pressed={filter === item} onClick={() => setFilter(item)}>{item}</button>)}</div><button className="add-dish-button" type="button" onClick={() => openEditDish()}><span>+</span> Добавить своё</button></div></div>
      {filteredDishes.length ? <div className="dish-grid">{filteredDishes.map((dish, index) => { const voted = dish.voterIds.includes(myId); const match = partnerJoined && dish.votes === 2; return <article className={`dish-card ${match ? 'is-match' : ''}`} key={dish.id} style={{ '--accent': dish.color } as CSSProperties}><div className="dish-image"><img src={dish.image} alt={dish.name} loading="lazy" /><span className="dish-number">{String(index + 1).padStart(2, '0')}</span>{match && <span className="match-badge">совпадение</span>}{dish.isCustom && <button className="edit-dish" type="button" onClick={() => openEditDish(dish)}>✎</button>}<button className={`vote-button ${voted ? 'selected' : ''}`} type="button" aria-pressed={voted} onClick={() => toggleVote(dish.id)}>{voted ? '✓' : '+'}</button></div><div className="dish-kicker"><p>{dish.note}</p><span>{dish.priceBand}</span></div><h3>{dish.name}</h3><div className="dish-meta-row"><span>{dish.meta}</span><VotePair members={session.members} voterIds={dish.voterIds} compact /></div>{dish.isCustom && <small>Добавил(а): {dish.createdBy}</small>}</article>; })}</div> : <div className="no-results"><span>♡</span><h3>Совпадений пока нет</h3><p>Продолжайте голосовать — общий фаворит появится здесь.</p></div>}
    </section>

    <section className="finalists" id="favorites"><div className="finalists-copy"><p className="eyebrow light"><span /> {agreedDishes.length ? 'Есть совпадение' : 'Ваши голоса'}</p><h2>{agreedDishes.length ? <>Вы оба<br /><em>за это</em></> : <>Общий<br /><em>шорт-лист</em></>}</h2><p>{agreedDishes.length ? 'Когда два голоса встретились на одной карточке, переговоры окончены.' : partnerJoined ? 'Здесь собираются голоса с обоих устройств.' : 'Ваши варианты уже сохраняются. Голос партнёра появится после входа по приглашению.'}</p><button className="final-button" type="button" disabled={!decisionPool.length} onClick={() => chooseRandom(decisionPool)}>{!decisionPool.length ? 'Сначала проголосуйте' : decisionPool.length === 1 ? 'Показать победителя' : `Выбрать из ${decisionPool.length}`}<span>✦</span></button></div><div className={`shortlist ${sharedFinalists.length ? '' : 'is-empty'}`}>{sharedFinalists.length ? sharedFinalists.map((dish, index) => <article className={`shortlist-item ${partnerJoined && dish.votes === 2 ? 'agreed' : ''}`} key={dish.id}><img src={dish.image} alt="" /><span className="shortlist-index">0{index + 1}</span><div><p>{partnerJoined && dish.votes === 2 ? 'Вы оба за · ' : ''}{dish.category} · {dish.priceBand}</p><h3>{dish.name}</h3><VotePair members={session.members} voterIds={dish.voterIds} compact /></div><button type="button" onClick={() => toggleVote(dish.id)}>{dish.voterIds.includes(myId) ? '♥' : '+'}</button></article>) : <div className="empty-state"><span>♡</span><h3>Пока тихо</h3><p>Поставьте первый голос — он останется только в вашем столике.</p><a href="#ideas">Вернуться к идеям</a></div>}</div></section>

    <footer><a className="brand" href="#top"><span className="brand-mark">ну</span><span>на ужин</span></a><p>{session.members.map((member) => member.displayName).join(' + ')}. Два голоса. Один ужин.</p><a href="#top">Наверх ↑</a></footer>

    {roomOpen && <div className="picker-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setRoomOpen(false); }}><section className="room-panel" role="dialog" aria-modal="true"><button className="picker-close" type="button" onClick={() => setRoomOpen(false)}>×</button><p className="eyebrow"><span /> Ваш приватный столик</p><h2>{session.room.name}</h2><div className="member-list">{session.members.map((member) => <div key={member.id}><span>{member.displayName.slice(0, 1).toUpperCase()}</span><p><strong>{member.displayName}{member.id === myId ? ' · это вы' : ''}</strong><small>{member.joined ? 'уже за столом' : 'ждёт приглашения'}</small></p><i className={member.joined ? 'online' : ''} /></div>)}</div>{!partnerJoined && session.member.slot === 1 && <div className="invite-box"><p>Одноразовая ссылка для {session.members[1]?.displayName}</p>{inviteUrl && <input readOnly value={inviteUrl} onFocus={(event) => event.currentTarget.select()} />}<button className="primary-button compact" type="button" onClick={inviteUrl ? copyInvite : prepareInvite} disabled={saving}>{inviteUrl ? 'Скопировать ссылку' : 'Создать приглашение'}</button><small>После первого входа ссылка перестанет работать.</small></div>}<button className="leave-button" type="button" onClick={leaveRoom} disabled={saving}>Выйти на этом устройстве</button></section></div>}
    {pickerOpen && pickerDish && <div className="picker-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !isChoosing) setPickerOpen(false); }}><section className="picker" role="dialog" aria-modal="true"><button className="picker-close" type="button" onClick={() => setPickerOpen(false)} disabled={isChoosing}>×</button><p className="eyebrow"><span /> {isChoosing ? 'Крутим тарелку' : 'Сегодня вы готовите'}</p><div className={`picker-image ${isChoosing ? 'is-choosing' : ''}`}><img src={pickerDish.image} alt="" /></div><p className="picker-label">{isChoosing ? 'А может быть…' : 'Спор окончен'}</p><h2>{pickerDish.name}</h2><p className="picker-meta">{pickerDish.meta} · примерно {pickerDish.priceBand}</p><div className="picker-actions"><button className="primary-button compact" type="button" onClick={() => setPickerOpen(false)} disabled={isChoosing}>По рукам</button><button className="retry-button" type="button" onClick={() => chooseRandom(decisionPool.length ? decisionPool : filteredDishes)} disabled={isChoosing}>Ещё раз</button></div></section></div>}
    {editorOpen && <div className="picker-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setEditorOpen(false); }}><section className="dish-editor" role="dialog" aria-modal="true"><button className="picker-close" type="button" onClick={() => setEditorOpen(false)}>×</button><p className="eyebrow"><span /> {session.room.name}</p><h2>{form.id ? 'Изменить блюдо' : 'Добавить своё'}</h2><p className="editor-intro">Блюдо увидят только участники этого столика.</p><form onSubmit={saveDish}><label>Название<input required minLength={2} maxLength={80} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Например, сырники" /></label><div className="form-row"><label>Время<input required type="number" min="5" max="240" value={form.minutes} onChange={(event) => setForm({ ...form, minutes: event.target.value })} /></label><label>Настроение<select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}><option>Быстро</option><option>Уютно</option><option>Полегче</option></select></label><label>Цена<select value={form.priceBand} onChange={(event) => setForm({ ...form, priceBand: event.target.value })}><option>₽</option><option>₽₽</option><option>₽₽₽</option></select></label></div><label>Описание<input maxLength={100} value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} placeholder="Почему вы его любите" /></label><label>Ссылка на фото<input type="url" value={form.image} onChange={(event) => setForm({ ...form, image: event.target.value })} placeholder="https://…" /></label><div className="editor-actions"><button className="primary-button compact" type="submit" disabled={saving}>{saving ? 'Сохраняю…' : 'Сохранить'}</button>{form.id && <button className="delete-button" type="button" onClick={deleteDish} disabled={saving}>Удалить</button>}</div></form></section></div>}
    {notice && <div className="toast" role="status">{notice}</div>}
  </main>;
}

function VotePair({ members, voterIds, compact = false }: { members: RoomSession['members']; voterIds: string[]; compact?: boolean }) {
  const count = voterIds.length;
  return <div className={`vote-pair ${compact ? 'compact' : ''}`} aria-label={`Голосов: ${count}`}>{members.map((member) => <span title={member.displayName} key={member.id} className={voterIds.includes(member.id) ? 'active' : ''}>{member.displayName.slice(0, 1).toUpperCase()}</span>)}{!compact && <small>{count === 2 ? 'вы оба за' : count === 1 ? 'один голос' : 'ждёт голосов'}</small>}</div>;
}

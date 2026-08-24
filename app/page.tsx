'use client';

import { useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent } from 'react';
import { seedDishes, type DishRecord } from '@/lib/dishes';

const fallbackDishes: DishRecord[] = seedDishes.map((dish) => ({ ...dish, votes: 0, voters: [] }));
const filters = ['Всё', 'Быстро', 'Уютно', 'Полегче', 'Оба за'];
type Identity = 'Я' | 'Она';
type DishForm = { id?: string; name: string; minutes: string; category: string; note: string; image: string; priceBand: string };
const emptyForm: DishForm = { name: '', minutes: '30', category: 'Уютно', note: '', image: '', priceBand: '₽₽' };

export default function Home() {
  const [dishes, setDishes] = useState<DishRecord[]>(fallbackDishes);
  const [filter, setFilter] = useState('Всё');
  const [identity, setIdentity] = useState<Identity>('Я');
  const [pickerDish, setPickerDish] = useState<DishRecord | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [isChoosing, setIsChoosing] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [form, setForm] = useState<DishForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');
  const cycleRef = useRef<number | null>(null);
  const stopRef = useRef<number | null>(null);

  useEffect(() => {
    const savedIdentity = localStorage.getItem('dinner-identity');
    if (savedIdentity === 'Я' || savedIdentity === 'Она') setIdentity(savedIdentity);
    void loadDishes();
  }, []);

  useEffect(() => () => {
    if (cycleRef.current) window.clearInterval(cycleRef.current);
    if (stopRef.current) window.clearTimeout(stopRef.current);
  }, []);

  async function loadDishes() {
    try {
      const response = await fetch('/api/dishes', { cache: 'no-store' });
      if (!response.ok) throw new Error('load failed');
      const data = await response.json() as { dishes: DishRecord[] };
      setDishes(data.dishes);
    } catch {
      showNotice('Не удалось обновить общую коллекцию. Показываю сохранённую подборку.');
    } finally {
      setLoading(false);
    }
  }

  function showNotice(message: string) {
    setNotice(message);
    window.setTimeout(() => setNotice(''), 3200);
  }

  function changeIdentity(value: Identity) {
    setIdentity(value);
    localStorage.setItem('dinner-identity', value);
  }

  const filteredDishes = useMemo(() => {
    if (filter === 'Всё') return dishes;
    if (filter === 'Оба за') return dishes.filter((dish) => dish.voters.includes('Я') && dish.voters.includes('Она'));
    return dishes.filter((dish) => dish.category === filter);
  }, [dishes, filter]);

  const myDishes = dishes.filter((dish) => dish.voters.includes(identity));
  const sharedFinalists = dishes.filter((dish) => dish.votes > 0).sort((a, b) => b.votes - a.votes);
  const agreedDishes = dishes.filter((dish) => dish.voters.includes('Я') && dish.voters.includes('Она'));
  const decisionPool = agreedDishes.length ? agreedDishes : sharedFinalists;

  async function toggleVote(dishId: string) {
    const snapshot = dishes;
    setDishes((current) => current.map((dish) => {
      if (dish.id !== dishId) return dish;
      const active = dish.voters.includes(identity);
      const voters = active ? dish.voters.filter((voter) => voter !== identity) : [...dish.voters, identity];
      return { ...dish, voters, votes: voters.length };
    }));

    try {
      const response = await fetch('/api/votes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dishId, voter: identity }),
      });
      if (!response.ok) throw new Error('vote failed');
    } catch {
      setDishes(snapshot);
      showNotice('Голос не сохранился. Попробуйте ещё раз.');
    }
  }

  function jumpToFinalists() {
    document.getElementById('favorites')?.scrollIntoView({ behavior: 'smooth' });
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

  function openAddDish() {
    setForm(emptyForm);
    setEditorOpen(true);
  }

  function openEditDish(dish: DishRecord) {
    setForm({ id: dish.id, name: dish.name, minutes: String(dish.minutes), category: dish.category, note: dish.note, image: dish.image, priceBand: dish.priceBand });
    setEditorOpen(true);
  }

  async function saveDish(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      const response = await fetch('/api/dishes', {
        method: form.id ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, createdBy: identity }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || 'Не удалось сохранить блюдо');
      await loadDishes();
      setEditorOpen(false);
      showNotice(form.id ? 'Блюдо обновлено' : 'Новое блюдо уже в общей коллекции');
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
      showNotice('Блюдо удалено из общей коллекции');
    } catch (error) {
      showNotice(error instanceof Error ? error.message : 'Не удалось удалить блюдо');
    } finally {
      setSaving(false);
    }
  }

  const heroDish = dishes.find((dish) => dish.id === 'shakshuka') || dishes[0];
  const heroSelected = heroDish?.voters.includes(identity);

  return (
    <main>
      <header className="site-header">
        <a className="brand" href="#top" aria-label="На ужин — на главную">
          <span className="brand-mark">ну</span><span>на ужин</span>
        </a>
        <nav aria-label="Основная навигация"><a href="#ideas">Идеи</a><a href="#favorites">Наш выбор</a></nav>
        <div className="header-tools">
          <div className="identity-switch" aria-label="Кто сейчас выбирает">
            {(['Я', 'Она'] as Identity[]).map((value) => (
              <button type="button" key={value} className={identity === value ? 'active' : ''} onClick={() => changeIdentity(value)} aria-pressed={identity === value}>{value}</button>
            ))}
          </div>
          <button className="mini-button" type="button" onClick={jumpToFinalists}><span aria-hidden="true">♡</span>{myDishes.length ? `${myDishes.length} моих` : 'ещё не выбрано'}</button>
        </div>
      </header>

      <section className="hero" id="top">
        <div className="hero-copy">
          <p className="eyebrow"><span /> Теперь выбираете вместе</p>
          <h1>Ну что<br /><em>на ужин?</em></h1>
          <p className="hero-intro">Откройте сайт каждый на своём телефоне, выберите свою роль и голосуйте. Совпадения поднимутся наверх сами.</p>
          <div className="hero-actions">
            <button className="primary-button" type="button" onClick={() => chooseRandom()}><span className="dice" aria-hidden="true">✦</span>Удиви нас</button>
            <a className="text-link" href="#ideas">Смотреть все блюда <span>↘</span></a>
          </div>
          <div className="live-note"><span className={loading ? 'loading-dot' : ''} />{loading ? 'Обновляю общую коллекцию…' : `Сейчас выбирает: ${identity}`}</div>
        </div>

        {heroDish && <div className="hero-feature" aria-label={`Блюдо дня: ${heroDish.name}`}>
          <div className="feature-photo"><img src={heroDish.image} alt={heroDish.name} /><span className="scribble">блюдо дня</span><span className="time-badge">{heroDish.minutes}<br /><small>мин</small></span></div>
          <div className="feature-caption">
            <div><p>{heroDish.note} · {heroDish.priceBand}</p><h2>{heroDish.name}</h2></div>
            <button className={heroSelected ? 'selected' : ''} type="button" aria-label={heroSelected ? 'Убрать свой голос' : 'Проголосовать'} aria-pressed={heroSelected} onClick={() => toggleVote(heroDish.id)}>{heroSelected ? '♥' : '♡'}</button>
          </div>
          <VotePair voters={heroDish.voters} />
        </div>}
      </section>

      <section className="ideas" id="ideas">
        <div className="section-heading">
          <div><p className="eyebrow"><span /> Общая коллекция</p><h2>Сегодня хочется…</h2></div>
          <div className="section-controls">
            <div className="filters" aria-label="Фильтры блюд">
              {filters.map((item) => <button className={filter === item ? 'active' : ''} key={item} type="button" aria-pressed={filter === item} onClick={() => setFilter(item)}>{item}</button>)}
            </div>
            <button className="add-dish-button" type="button" onClick={openAddDish}><span>+</span> Добавить своё</button>
          </div>
        </div>

        {filteredDishes.length ? <div className="dish-grid">
          {filteredDishes.map((dish, index) => {
            const voted = dish.voters.includes(identity);
            return <article className={`dish-card ${dish.votes === 2 ? 'is-match' : ''}`} key={dish.id} style={{ '--accent': dish.color } as CSSProperties}>
              <div className="dish-image">
                <img src={dish.image} alt={dish.name} loading="lazy" />
                <span className="dish-number">{String(index + 1).padStart(2, '0')}</span>
                {dish.votes === 2 && <span className="match-badge">совпадение</span>}
                {dish.isCustom && <button className="edit-dish" type="button" aria-label={`Редактировать «${dish.name}»`} onClick={() => openEditDish(dish)}>✎</button>}
                <button className={`vote-button ${voted ? 'selected' : ''}`} type="button" aria-label={voted ? `Убрать свой голос за «${dish.name}»` : `Проголосовать за «${dish.name}»`} aria-pressed={voted} onClick={() => toggleVote(dish.id)}>{voted ? '✓' : '+'}</button>
              </div>
              <div className="dish-kicker"><p>{dish.note}</p><span>{dish.priceBand}</span></div>
              <h3>{dish.name}</h3>
              <div className="dish-meta-row"><span>{dish.meta}</span><VotePair voters={dish.voters} compact /></div>
              {dish.isCustom && <small>Добавил{dish.createdBy === 'Она' ? 'а' : ''}: {dish.createdBy}</small>}
            </article>;
          })}
        </div> : <div className="no-results"><span>♡</span><h3>Совпадений пока нет</h3><p>Продолжайте голосовать — общий фаворит обязательно появится.</p></div>}
      </section>

      <section className="finalists" id="favorites">
        <div className="finalists-copy">
          <p className="eyebrow light"><span /> {agreedDishes.length ? 'Есть совпадение' : 'Ваши голоса'}</p>
          <h2>{agreedDishes.length ? <>Вы оба<br /><em>за это</em></> : <>Общий<br /><em>шорт-лист</em></>}</h2>
          <p>{agreedDishes.length ? 'Когда оба сердца на одной карточке, переговоры окончены. Если совпадений несколько — выбор можно доверить случаю.' : 'Здесь собираются голоса с обоих устройств. Совпавшие варианты автоматически получают приоритет.'}</p>
          <button className="final-button" type="button" disabled={!decisionPool.length} onClick={() => chooseRandom(decisionPool)}>{!decisionPool.length ? 'Сначала проголосуйте' : decisionPool.length === 1 ? 'Показать победителя' : `Выбрать из ${decisionPool.length}`}<span aria-hidden="true">✦</span></button>
        </div>

        <div className={`shortlist ${sharedFinalists.length ? '' : 'is-empty'}`}>
          {sharedFinalists.length ? sharedFinalists.map((dish, index) => (
            <article className={`shortlist-item ${dish.votes === 2 ? 'agreed' : ''}`} key={dish.id}>
              <img src={dish.image} alt="" /><span className="shortlist-index">0{index + 1}</span>
              <div><p>{dish.votes === 2 ? 'Вы оба за · ' : ''}{dish.category} · {dish.priceBand}</p><h3>{dish.name}</h3><VotePair voters={dish.voters} compact /></div>
              <button type="button" onClick={() => toggleVote(dish.id)} aria-label={`Изменить свой голос за «${dish.name}»`}>{dish.voters.includes(identity) ? '♥' : '+'}</button>
            </article>
          )) : <div className="empty-state"><span aria-hidden="true">♡</span><h3>Пока тихо</h3><p>Выберите свою роль и поставьте первый голос.</p><a href="#ideas">Вернуться к идеям</a></div>}
        </div>
      </section>

      <footer><a className="brand" href="#top"><span className="brand-mark">ну</span><span>на ужин</span></a><p>Два телефона. Два голоса. Один ужин.</p><a href="#top">Наверх ↑</a></footer>

      {pickerOpen && pickerDish && <div className="picker-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !isChoosing) setPickerOpen(false); }}>
        <section className="picker" role="dialog" aria-modal="true" aria-labelledby="picker-title"><button className="picker-close" type="button" onClick={() => setPickerOpen(false)} aria-label="Закрыть" disabled={isChoosing}>×</button><p className="eyebrow"><span /> {isChoosing ? 'Крутим тарелку' : pickerDish.votes === 2 ? 'Ваше совпадение' : 'Спор окончен'}</p><div className={`picker-image ${isChoosing ? 'is-choosing' : ''}`}><img src={pickerDish.image} alt="" /></div><p className="picker-label">{isChoosing ? 'А может быть…' : 'Сегодня вы готовите'}</p><h2 id="picker-title">{pickerDish.name}</h2><p className="picker-meta">{pickerDish.meta} · примерно {pickerDish.priceBand}</p><div className="picker-actions"><button type="button" className="primary-button compact" onClick={() => { setPickerOpen(false); showNotice('Решено. Сегодня без переговоров ✦'); }} disabled={isChoosing}>По рукам</button><button type="button" className="retry-button" onClick={() => chooseRandom(decisionPool.length ? decisionPool : filteredDishes)} disabled={isChoosing}>Ещё раз</button></div></section>
      </div>}

      {editorOpen && <div className="picker-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setEditorOpen(false); }}>
        <section className="dish-editor" role="dialog" aria-modal="true" aria-labelledby="editor-title"><button className="picker-close" type="button" onClick={() => setEditorOpen(false)} aria-label="Закрыть" disabled={saving}>×</button><p className="eyebrow"><span /> Общая коллекция</p><h2 id="editor-title">{form.id ? 'Изменить блюдо' : 'Добавить своё'}</h2><p className="editor-intro">Блюдо сразу появится у вас обоих.</p><form onSubmit={saveDish}><label>Название<input required minLength={2} maxLength={80} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Например, сырники" /></label><div className="form-row"><label>Время, минут<input required type="number" min="5" max="240" value={form.minutes} onChange={(e) => setForm({ ...form, minutes: e.target.value })} /></label><label>Настроение<select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}><option>Быстро</option><option>Уютно</option><option>Полегче</option></select></label><label>Цена<select value={form.priceBand} onChange={(e) => setForm({ ...form, priceBand: e.target.value })}><option>₽</option><option>₽₽</option><option>₽₽₽</option></select></label></div><label>Короткое описание<input maxLength={100} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Почему вы его любите" /></label><label>Ссылка на фото <small>необязательно</small><input type="url" value={form.image} onChange={(e) => setForm({ ...form, image: e.target.value })} placeholder="https://…" /></label><div className="editor-actions"><button className="primary-button compact" type="submit" disabled={saving}>{saving ? 'Сохраняю…' : form.id ? 'Сохранить' : 'Добавить блюдо'}</button>{form.id && <button className="delete-button" type="button" onClick={deleteDish} disabled={saving}>Удалить</button>}</div></form></section>
      </div>}

      {notice && <div className="toast" role="status">{notice}</div>}
    </main>
  );
}

function VotePair({ voters, compact = false }: { voters: string[]; compact?: boolean }) {
  return <div className={`vote-pair ${compact ? 'compact' : ''}`} aria-label={`Голоса: ${voters.length ? voters.join(' и ') : 'пока нет'}`}><span className={voters.includes('Я') ? 'active' : ''}>Я</span><span className={voters.includes('Она') ? 'active' : ''}>О</span>{!compact && <small>{voters.length === 2 ? 'вы оба за' : voters.length === 1 ? 'один голос' : 'ждёт голосов'}</small>}</div>;
}

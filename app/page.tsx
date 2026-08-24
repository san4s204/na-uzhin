'use client';

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';

const dishes = [
  {
    id: 'shakshuka',
    name: 'Шакшука с фетой',
    meta: '30 минут · одна сковорода',
    minutes: 30,
    category: 'Уютно',
    note: 'Ярко и согревающе',
    image: 'https://images.unsplash.com/photo-1590412200988-a436970781fa?auto=format&fit=crop&w=1200&q=88',
    color: '#ee5837',
  },
  {
    id: 'pasta',
    name: 'Паста с томатами',
    meta: '25 минут · итальянское',
    minutes: 25,
    category: 'Уютно',
    note: 'Когда хочется уютно',
    image: 'https://images.unsplash.com/photo-1551183053-bf91a1d81141?auto=format&fit=crop&w=1000&q=86',
    color: '#e94d32',
  },
  {
    id: 'bowl',
    name: 'Тёплый боул',
    meta: '35 минут · сбалансированное',
    minutes: 35,
    category: 'Полегче',
    note: 'Легко, но не грустно',
    image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=1000&q=86',
    color: '#79935a',
  },
  {
    id: 'pizza',
    name: 'Домашняя пицца',
    meta: '50 минут · на двоих',
    minutes: 50,
    category: 'Уютно',
    note: 'Пятничное настроение',
    image: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=1000&q=86',
    color: '#c88a27',
  },
  {
    id: 'tacos',
    name: 'Тако с курицей',
    meta: '25 минут · можно руками',
    minutes: 25,
    category: 'Быстро',
    note: 'Сочно и без церемоний',
    image: 'https://images.unsplash.com/photo-1551504734-5ee1c4a1479b?auto=format&fit=crop&w=1000&q=86',
    color: '#d96c31',
  },
  {
    id: 'salmon',
    name: 'Лосось и овощи',
    meta: '35 минут · всё в духовке',
    minutes: 35,
    category: 'Полегче',
    note: 'Когда хочется свежести',
    image: 'https://images.unsplash.com/photo-1467003909585-2f8a72700288?auto=format&fit=crop&w=1000&q=86',
    color: '#ca6b63',
  },
  {
    id: 'curry',
    name: 'Кокосовый карри',
    meta: '35 минут · пряное',
    minutes: 35,
    category: 'Уютно',
    note: 'Тёплое объятие в миске',
    image: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=1000&q=86',
    color: '#c78625',
  },
  {
    id: 'sandwich',
    name: 'Горячий сэндвич',
    meta: '15 минут · минимум посуды',
    minutes: 15,
    category: 'Быстро',
    note: 'Просто, хрустко, идеально',
    image: 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?auto=format&fit=crop&w=1000&q=86',
    color: '#b47732',
  },
];

const filters = ['Всё', 'Быстро', 'Уютно', 'Полегче'];
type Dish = (typeof dishes)[number];

export default function Home() {
  const [filter, setFilter] = useState('Всё');
  const [selected, setSelected] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [pickerDish, setPickerDish] = useState<Dish | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [isChoosing, setIsChoosing] = useState(false);
  const [toast, setToast] = useState('');
  const cycleRef = useRef<number | null>(null);
  const stopRef = useRef<number | null>(null);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('dinner-finalists') || '[]');
      if (Array.isArray(saved)) setSelected(saved.filter((id) => dishes.some((dish) => dish.id === id)));
    } catch {
      // An empty shortlist is a safe fallback if local storage is unavailable.
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem('dinner-finalists', JSON.stringify(selected));
  }, [hydrated, selected]);

  useEffect(() => () => {
    if (cycleRef.current) window.clearInterval(cycleRef.current);
    if (stopRef.current) window.clearTimeout(stopRef.current);
  }, []);

  const filteredDishes = useMemo(
    () => filter === 'Всё' ? dishes : dishes.filter((dish) => dish.category === filter),
    [filter],
  );

  const selectedDishes = dishes.filter((dish) => selected.includes(dish.id));

  function toggleDish(id: string) {
    setSelected((current) => current.includes(id)
      ? current.filter((dishId) => dishId !== id)
      : [...current, id]);
  }

  function jumpToFinalists() {
    document.getElementById('favorites')?.scrollIntoView({ behavior: 'smooth' });
  }

  function chooseRandom(onlySelected = false) {
    const shortlist = dishes.filter((dish) => selected.includes(dish.id));
    const pool = onlySelected && shortlist.length ? shortlist : filteredDishes;
    if (!pool.length) return;

    if (cycleRef.current) window.clearInterval(cycleRef.current);
    if (stopRef.current) window.clearTimeout(stopRef.current);

    setPickerOpen(true);
    setIsChoosing(true);
    setPickerDish(pool[Math.floor(Math.random() * pool.length)]);

    cycleRef.current = window.setInterval(() => {
      setPickerDish(pool[Math.floor(Math.random() * pool.length)]);
    }, 95);

    stopRef.current = window.setTimeout(() => {
      if (cycleRef.current) window.clearInterval(cycleRef.current);
      setPickerDish(pool[Math.floor(Math.random() * pool.length)]);
      setIsChoosing(false);
    }, 950);
  }

  function confirmDinner() {
    setPickerOpen(false);
    setToast('Решено. Сегодня без переговоров ✦');
    window.setTimeout(() => setToast(''), 3000);
  }

  const heroDish = dishes[0];
  const heroSelected = selected.includes(heroDish.id);

  return (
    <main>
      <header className="site-header">
        <a className="brand" href="#top" aria-label="На ужин — на главную">
          <span className="brand-mark">ну</span>
          <span>на ужин</span>
        </a>
        <nav aria-label="Основная навигация">
          <a href="#ideas">Идеи</a>
          <a href="#favorites">Финалисты</a>
        </nav>
        <button className="mini-button" type="button" onClick={jumpToFinalists}>
          <span aria-hidden="true">♡</span>
          {selected.length ? `${selected.length} в списке` : 'список пуст'}
        </button>
      </header>

      <section className="hero" id="top">
        <div className="hero-copy">
          <p className="eyebrow"><span /> Вечер начинается здесь</p>
          <h1>Ну что<br /><em>на ужин?</em></h1>
          <p className="hero-intro">
            Больше никаких «я не знаю, а ты?». Выбирайте по настроению,
            собирайте финалистов — или доверьтесь случаю.
          </p>
          <div className="hero-actions">
            <button className="primary-button" type="button" onClick={() => chooseRandom(false)}>
              <span className="dice" aria-hidden="true">✦</span>
              Удиви нас
            </button>
            <a className="text-link" href="#ideas">Смотреть все блюда <span>↘</span></a>
          </div>
          <p className="tiny-note">Выбор сохранится на этом устройстве</p>
        </div>

        <div className="hero-feature" aria-label={`Блюдо дня: ${heroDish.name}`}>
          <div className="feature-photo">
            <img src={heroDish.image} alt="Шакшука в сковороде" />
            <span className="scribble">блюдо дня</span>
            <span className="time-badge">{heroDish.minutes}<br /><small>мин</small></span>
          </div>
          <div className="feature-caption">
            <div>
              <p>{heroDish.note}</p>
              <h2>{heroDish.name}</h2>
            </div>
            <button
              className={heroSelected ? 'selected' : ''}
              type="button"
              aria-label={heroSelected ? 'Убрать шакшуку из списка' : 'Добавить шакшуку в список'}
              aria-pressed={heroSelected}
              onClick={() => toggleDish(heroDish.id)}
            >{heroSelected ? '♥' : '♡'}</button>
          </div>
        </div>
      </section>

      <section className="ideas" id="ideas">
        <div className="section-heading">
          <div>
            <p className="eyebrow"><span /> Под ваше настроение</p>
            <h2>Сегодня хочется…</h2>
          </div>
          <div className="filters" aria-label="Фильтры блюд">
            {filters.map((item) => (
              <button
                className={filter === item ? 'active' : ''}
                key={item}
                type="button"
                aria-pressed={filter === item}
                onClick={() => setFilter(item)}
              >{item}</button>
            ))}
          </div>
        </div>

        <div className="dish-grid">
          {filteredDishes.map((dish, index) => {
            const isSelected = selected.includes(dish.id);
            return (
              <article className="dish-card" key={dish.id} style={{ '--accent': dish.color } as CSSProperties}>
                <div className="dish-image">
                  <img src={dish.image} alt={dish.name} loading="lazy" />
                  <span className="dish-number">{String(index + 1).padStart(2, '0')}</span>
                  <button
                    className={isSelected ? 'selected' : ''}
                    type="button"
                    aria-label={isSelected ? `Убрать «${dish.name}» из списка` : `Добавить «${dish.name}» в список`}
                    aria-pressed={isSelected}
                    onClick={() => toggleDish(dish.id)}
                  >{isSelected ? '✓' : '+'}</button>
                </div>
                <p>{dish.note}</p>
                <h3>{dish.name}</h3>
                <span>{dish.meta}</span>
              </article>
            );
          })}
        </div>
      </section>

      <section className="finalists" id="favorites">
        <div className="finalists-copy">
          <p className="eyebrow light"><span /> Почти договорились</p>
          <h2>Ваши<br /><em>финалисты</em></h2>
          <p>
            Добавьте хотя бы два блюда — и пусть случай решит последний спор.
            Или выберите победителя сами, мы никому не скажем.
          </p>
          <button
            className="final-button"
            type="button"
            disabled={selectedDishes.length < 2}
            onClick={() => chooseRandom(true)}
          >
            {selectedDishes.length < 2 ? 'Нужно два блюда' : `Выбрать из ${selectedDishes.length}`}
            <span aria-hidden="true">✦</span>
          </button>
        </div>

        <div className={`shortlist ${selectedDishes.length ? '' : 'is-empty'}`}>
          {selectedDishes.length ? selectedDishes.map((dish, index) => (
            <article className="shortlist-item" key={dish.id}>
              <img src={dish.image} alt="" />
              <span className="shortlist-index">0{index + 1}</span>
              <div>
                <p>{dish.category} · {dish.minutes} мин</p>
                <h3>{dish.name}</h3>
              </div>
              <button type="button" onClick={() => toggleDish(dish.id)} aria-label={`Убрать «${dish.name}»`}>
                ×
              </button>
            </article>
          )) : (
            <div className="empty-state">
              <span aria-hidden="true">♡</span>
              <h3>Пока никого</h3>
              <p>Нажимайте на плюс у блюд, которые понравились вам обоим.</p>
              <a href="#ideas">Вернуться к идеям</a>
            </div>
          )}
        </div>
      </section>

      <footer>
        <a className="brand" href="#top"><span className="brand-mark">ну</span><span>на ужин</span></a>
        <p>Сделано для вечеров вдвоём и быстрых решений.</p>
        <a href="#top">Наверх ↑</a>
      </footer>

      {pickerOpen && pickerDish && (
        <div className="picker-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget && !isChoosing) setPickerOpen(false);
        }}>
          <section className="picker" role="dialog" aria-modal="true" aria-labelledby="picker-title">
            <button className="picker-close" type="button" onClick={() => setPickerOpen(false)} aria-label="Закрыть" disabled={isChoosing}>×</button>
            <p className="eyebrow"><span /> {isChoosing ? 'Крутим тарелку' : 'Спор окончен'}</p>
            <div className={`picker-image ${isChoosing ? 'is-choosing' : ''}`}>
              <img src={pickerDish.image} alt="" />
            </div>
            <p className="picker-label">{isChoosing ? 'А может быть…' : 'Сегодня вы готовите'}</p>
            <h2 id="picker-title">{pickerDish.name}</h2>
            <p className="picker-meta">{pickerDish.meta}</p>
            <div className="picker-actions">
              <button type="button" className="primary-button compact" onClick={confirmDinner} disabled={isChoosing}>
                По рукам
              </button>
              <button type="button" className="retry-button" onClick={() => chooseRandom(selectedDishes.length > 1)} disabled={isChoosing}>
                Ещё раз
              </button>
            </div>
          </section>
        </div>
      )}

      {toast && <div className="toast" role="status">{toast}</div>}
    </main>
  );
}

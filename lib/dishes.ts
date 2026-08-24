export type DishRecord = {
  id: string;
  name: string;
  meta: string;
  minutes: number;
  category: string;
  note: string;
  image: string;
  color: string;
  priceBand: string;
  createdBy: string;
  isCustom: boolean;
  createdAt: string;
  votes: number;
  voters: string[];
};

export const seedDishes: Omit<DishRecord, 'votes' | 'voters'>[] = [
  { id: 'shakshuka', name: 'Шакшука с фетой', meta: '30 минут · одна сковорода', minutes: 30, category: 'Уютно', note: 'Ярко и согревающе', image: 'https://images.unsplash.com/photo-1590412200988-a436970781fa?auto=format&fit=crop&w=1200&q=88', color: '#ee5837', priceBand: '₽₽', createdBy: 'На ужин', isCustom: false, createdAt: '2026-01-01T00:00:00.000Z' },
  { id: 'pasta', name: 'Паста с томатами', meta: '25 минут · итальянское', minutes: 25, category: 'Уютно', note: 'Когда хочется уютно', image: 'https://images.unsplash.com/photo-1551183053-bf91a1d81141?auto=format&fit=crop&w=1000&q=86', color: '#e94d32', priceBand: '₽', createdBy: 'На ужин', isCustom: false, createdAt: '2026-01-02T00:00:00.000Z' },
  { id: 'bowl', name: 'Тёплый боул', meta: '35 минут · сбалансированное', minutes: 35, category: 'Полегче', note: 'Легко, но не грустно', image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=1000&q=86', color: '#79935a', priceBand: '₽₽', createdBy: 'На ужин', isCustom: false, createdAt: '2026-01-03T00:00:00.000Z' },
  { id: 'pizza', name: 'Домашняя пицца', meta: '50 минут · на двоих', minutes: 50, category: 'Уютно', note: 'Пятничное настроение', image: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=1000&q=86', color: '#c88a27', priceBand: '₽₽', createdBy: 'На ужин', isCustom: false, createdAt: '2026-01-04T00:00:00.000Z' },
  { id: 'tacos', name: 'Тако с курицей', meta: '25 минут · можно руками', minutes: 25, category: 'Быстро', note: 'Сочно и без церемоний', image: 'https://images.unsplash.com/photo-1551504734-5ee1c4a1479b?auto=format&fit=crop&w=1000&q=86', color: '#d96c31', priceBand: '₽₽', createdBy: 'На ужин', isCustom: false, createdAt: '2026-01-05T00:00:00.000Z' },
  { id: 'salmon', name: 'Лосось и овощи', meta: '35 минут · всё в духовке', minutes: 35, category: 'Полегче', note: 'Когда хочется свежести', image: 'https://images.unsplash.com/photo-1467003909585-2f8a72700288?auto=format&fit=crop&w=1000&q=86', color: '#ca6b63', priceBand: '₽₽₽', createdBy: 'На ужин', isCustom: false, createdAt: '2026-01-06T00:00:00.000Z' },
  { id: 'curry', name: 'Кокосовый карри', meta: '35 минут · пряное', minutes: 35, category: 'Уютно', note: 'Тёплое объятие в миске', image: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=1000&q=86', color: '#c78625', priceBand: '₽₽', createdBy: 'На ужин', isCustom: false, createdAt: '2026-01-07T00:00:00.000Z' },
  { id: 'sandwich', name: 'Горячий сэндвич', meta: '15 минут · минимум посуды', minutes: 15, category: 'Быстро', note: 'Просто, хрустко, идеально', image: 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?auto=format&fit=crop&w=1000&q=86', color: '#b47732', priceBand: '₽', createdBy: 'На ужин', isCustom: false, createdAt: '2026-01-08T00:00:00.000Z' },
];

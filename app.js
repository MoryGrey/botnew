// Состояние
const state = {
  tariffs: {
    econom: { name: 'ЭКОНОМ', base: 150 },
    student: { name: 'СТУДЕНТ', base: 100 },
    kids: { name: 'С ДЕТЬМИ', base: 200 },
    business: { name: 'БИЗНЕС', base: 150, multiplier: 1.5 }, // +50%
  },
  selectedTariff: 'econom',
  payment: 'cash', // cash | card | free
  promo: null,
  extraStops: [],
  profile: { name: '', phone: '', username: '' },
  tgInit: null,
};

const tg = window.Telegram?.WebApp;

// Утилиты
const qs = (s, r = document) => r.querySelector(s);
const qsa = (s, r = document) => Array.from(r.querySelectorAll(s));

function getTariffPrice(code) {
  const t = state.tariffs[code];
  if (!t) return 0;
  const base = t.base;
  const m = t.multiplier || 1;
  return Math.round(base * m);
}

function calcTotal() {
  const stopsPrice = state.extraStops.length * 100;
  let total = getTariffPrice(state.selectedTariff) + stopsPrice;
  // Промокод FREE100 — бесплатная поездка
  if (state.promo === 'FREE100') total = 0;
  // Каждая 10-я поездка бесплатно
  const rides = Number(localStorage.getItem('prestige_rides') || '0');
  const isFreeRide = (rides + 1) % 10 === 0;
  if (isFreeRide) total = 0;
  return total;
}

function updateOrderButton() {
  const t = state.tariffs[state.selectedTariff];
  const btn = qs('#order-btn');
  if (btn && t) btn.textContent = `ПОДТВЕРДИТЬ ${t.name}`;
}

function renderPaymentMethod() {
  const el = qs('#payment-method');
  if (!el) return;
  el.textContent = state.payment === 'cash' ? 'Наличными' : state.payment === 'card' ? 'Перевод' : 'Бесплатно';
}

function ensureStopsContainer() {
  let cont = qs('#extra-stops');
  if (!cont) {
    cont = document.createElement('div');
    cont.id = 'extra-stops';
    cont.style.marginTop = '8px';
    const routeSection = qs('.route-section');
    routeSection && routeSection.appendChild(cont);
  }
  return cont;
}

function addStop(value = '') {
  const id = `${Date.now()}_${Math.random()}`;
  state.extraStops.push({ id, value });
  const cont = ensureStopsContainer();
  const row = document.createElement('div');
  row.className = 'route-point stop';
  row.dataset.id = id;
  row.innerHTML = `
    <div class="point-dot"></div>
    <div class="point-content">
      <input type="text" placeholder="Доп. точка" value="${value.replace(/"/g, '&quot;')}">
      <button class="remove-stop-btn">−100₽</button>
    </div>
  `;
  cont.appendChild(row);
  const input = qs('input', row);
  input.addEventListener('input', (e) => {
    const s = state.extraStops.find((x) => x.id === id);
    if (s) s.value = e.target.value;
  });
  qs('.remove-stop-btn', row).addEventListener('click', () => removeStop(id));
}

function removeStop(id) {
  state.extraStops = state.extraStops.filter((x) => x.id !== id);
  const el = qs(`.route-point.stop[data-id="${id}"]`);
  el && el.remove();
}

function applyPromo() {
  const input = qs('#promo-input');
  const code = (input?.value || '').trim().toUpperCase();
  state.promo = code || null;
  const freeOpt = qs('#free-option');
  if (freeOpt) freeOpt.style.display = (code === 'FREE100') ? 'flex' : 'none';
  renderPaymentMethod();
  toast(code === 'FREE100' ? 'Промокод применён: бесплатная поездка' : 'Промокод обновлён');
}

function toast(text) {
  if (tg?.HapticFeedback) tg.HapticFeedback.notificationOccurred('success');
  // Небольшой нативный тост через alert для простоты
  // Можно заменить на кастомный тост, если потребуется
  console.log('[INFO]', text);
}

function showPaymentModal(show) {
  const modal = qs('#payment-modal');
  if (!modal) return;
  modal.style.display = show ? 'flex' : 'none';
}

function updateProfileUI() {
  qs('#profile-name').textContent = state.profile.name || 'Без имени';
  qs('#profile-phone').textContent = state.profile.phone || 'Номер не указан';
  updateLoyalty();
}

function saveProfile() {
  localStorage.setItem('prestige_profile', JSON.stringify(state.profile));
  toast('Профиль сохранён');
}

function loadProfile() {
  try {
    const raw = localStorage.getItem('prestige_profile');
    if (raw) {
      const p = JSON.parse(raw);
      state.profile = { ...state.profile, ...p };
    }
  } catch {}
}

function updateLoyalty() {
  const rides = Number(localStorage.getItem('prestige_rides') || '0');
  const freeRides = Math.floor(rides / 10);
  const toFree = 10 - (rides % 10 || 0);
  const progress = ((rides % 10) / 10) * 100;
  const freeEl = qs('#free-rides');
  const toEl = qs('#rides-to-free');
  const fill = qs('#progress-fill');
  if (freeEl) freeEl.textContent = String(freeRides);
  if (toEl) toEl.textContent = String(toFree === 10 ? 10 : toFree);
  if (fill) fill.style.width = `${progress}%`;
  // показать опцию Бесплатно на 10‑ю поездку
  const freeOpt = qs('#free-option');
  if (freeOpt) freeOpt.style.display = ((rides + 1) % 10 === 0) ? 'flex' : (state.promo === 'FREE100' ? 'flex' : 'none');
}

function openProfilePage(open) {
  const page = qs('#profile-page');
  const app = qs('#app > :not(.profile-page)');
  if (page) page.style.display = open ? 'block' : 'none';
}

function buildOrderPayload() {
  const from = qs('#from-input')?.value?.trim();
  const to = qs('#to-input')?.value?.trim();
  const points = state.extraStops.map((s) => s.value).filter(Boolean);
  const t = state.tariffs[state.selectedTariff];
  const total = calcTotal();
  return {
    type: 'create_order',
    from,
    to,
    points,
    tariff: { code: state.selectedTariff, name: t?.name, base: t?.base, multiplier: t?.multiplier || 1 },
    payment: state.payment,
    promo: state.promo,
    total,
    user: state.profile,
    tg: state.tgInit ? { user: state.tgInit.user } : null,
  };
}

function validateBeforeOrder() {
  const from = qs('#from-input')?.value?.trim();
  const to = qs('#to-input')?.value?.trim();
  if (!from || !to) {
    alert('Укажите адреса Откуда и Куда');
    return false;
    }
  if (!state.profile.phone) {
    alert('Вы не зарегистрированы! Отправьте команду /start в боте для регистрации.');
    return false;
  }
  return true;
}

function completeOrderUI() {
  const overlay = qs('#success-overlay');
  if (overlay) overlay.style.display = 'flex';
  setTimeout(() => { if (overlay) overlay.style.display = 'none'; }, 2200);
}

function incRidesCounters() {
  const rides = Number(localStorage.getItem('prestige_rides') || '0');
  localStorage.setItem('prestige_rides', String(rides + 1));
  updateLoyalty();
}

function sendToBot(payload) {
  try {
    if (tg) {
      tg.sendData(JSON.stringify(payload));
      if (tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('success');
    }
  } catch (e) { console.warn('sendData error', e); }
}

// Telegram WebApp init
function initTelegram() {
  if (!tg) return;
  try {
    tg.ready();
    tg.expand();
    state.tgInit = tg.initDataUnsafe || null;
    const u = state.tgInit?.user || {};
    const name = [u.first_name, u.last_name].filter(Boolean).join(' ').trim();
    
    // Устанавливаем данные из Telegram
    state.profile.name = name || 'Пользователь';
    state.profile.username = u.username ? `@${u.username}` : '';
    
    // Загружаем сохранённый профиль (номер телефона)
    loadProfile();
    
    // Обновляем UI
    updateProfileUI();
    
    // Если номер телефона не указан, показываем предупреждение
    if (!state.profile.phone) {
      console.warn('Номер телефона не указан. Пользователь должен зарегистрироваться через /start');
    }
  } catch (e) { console.warn('TG init error', e); }
}

// PWA install banner
function initPWA() {
  let deferredPrompt = null;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    const banner = qs('#install-banner');
    if (banner) banner.style.display = 'block';
  });
  qs('#install-app-btn')?.addEventListener('click', async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    const banner = qs('#install-banner');
    if (banner) banner.style.display = 'none';
  });
  qs('#close-install-btn')?.addEventListener('click', () => {
    const banner = qs('#install-banner');
    if (banner) banner.style.display = 'none';
  });
}

// Привязка событий UI
function bindUI() {
  // Тарифы
  qsa('.tariff-option').forEach((el) => {
    el.addEventListener('click', () => {
      qsa('.tariff-option').forEach((x) => x.classList.remove('active'));
      el.classList.add('active');
      state.selectedTariff = el.dataset.tariff;
      updateOrderButton();
    });
  });

  // Оплата
  qs('#payment-btn')?.addEventListener('click', () => showPaymentModal(true));
  qs('#payment-modal .close-btn')?.addEventListener('click', () => showPaymentModal(false));
  qsa('#payment-modal .payment-option').forEach((opt) => {
    opt.addEventListener('click', () => {
      state.payment = opt.dataset.payment;
      renderPaymentMethod();
      showPaymentModal(false);
    });
  });

  // Промокод
  qs('#promo-btn')?.addEventListener('click', applyPromo);

  // Кнопка добавления точки
  qs('.add-stop-btn')?.addEventListener('click', () => addStop());

  // Кнопка заказа
  qs('#order-btn')?.addEventListener('click', () => {
    if (!validateBeforeOrder()) return;
    const payload = buildOrderPayload();
    sendToBot(payload);
    completeOrderUI();
    incRidesCounters();
  });

  // Профиль: открыть/закрыть
  qs('.profile-btn')?.addEventListener('click', () => openProfilePage(true));
  qs('.back-to-main-btn')?.addEventListener('click', () => openProfilePage(false));

  // Редактирование и сохранение профиля
  qs('#edit-profile')?.addEventListener('click', () => {
    alert('Для изменения данных обратитесь к боту. Отправьте команду /start для повторной регистрации.');
  });
  qs('#save-profile')?.addEventListener('click', saveProfile);

  // Поддержка
  qs('#support-btn')?.addEventListener('click', () => {
    const link = state.profile.username ? `https://t.me/${state.profile.username.replace('@','')}` : 'https://t.me';
    window.open(link, '_blank');
  });
}

// Получение данных пользователя от бота
function requestUserData() {
  if (!tg) return;
  try {
    // Отправляем запрос на получение данных пользователя
    tg.sendData(JSON.stringify({ type: 'get_user_data' }));
  } catch (e) { console.warn('requestUserData error', e); }
}

// Обработка сообщений от бота
function handleBotMessage(data) {
  if (data.type === 'user_data') {
    state.profile.phone = data.phone || '';
    state.profile.name = data.name || state.profile.name;
    state.profile.username = data.username || state.profile.username;
    saveProfile();
    updateProfileUI();
  }
}

// Инициализация
document.addEventListener('DOMContentLoaded', () => {
  loadProfile();
  updateProfileUI();
  updateOrderButton();
  renderPaymentMethod();
  initPWA();
  bindUI();
  
  // Инициализация Telegram после загрузки API
  if (window.Telegram?.WebApp) {
    initTelegram();
    // Запрашиваем данные пользователя у бота
    setTimeout(requestUserData, 1000);
  } else {
    // Если скрипт подгрузится динамически — пробуем позже
    const iv = setInterval(() => {
      if (window.Telegram?.WebApp) { 
        clearInterval(iv); 
        initTelegram();
        setTimeout(requestUserData, 1000);
      }
    }, 300);
    setTimeout(() => clearInterval(iv), 8000);
  }
  
  // Слушаем сообщения от бота
  window.addEventListener('message', (e) => {
    try {
      const data = JSON.parse(e.data);
      handleBotMessage(data);
    } catch (err) {
      // Игнорируем не JSON сообщения
    }
  });
});



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

let tg = window.Telegram?.WebApp;

// Проверяем доступность Telegram WebApp
if (typeof window !== 'undefined') {
  console.log('window.Telegram:', window.Telegram);
  console.log('window.Telegram?.WebApp:', window.Telegram?.WebApp);
}

// Функция для обновления tg после загрузки скрипта
function updateTg() {
  tg = window.Telegram?.WebApp;
  console.log('tg обновлен:', tg);
  if (tg) {
    console.log('tg.sendData доступен:', typeof tg.sendData === 'function');
    console.log('tg.ready доступен:', typeof tg.ready === 'function');
    console.log('tg.expand доступен:', typeof tg.expand === 'function');
  }
}

// Делаем функцию доступной глобально
window.updateTg = updateTg;

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
  const nameEl = qs('#profile-name');
  const phoneEl = qs('#profile-phone');
  
  if (nameEl) {
    nameEl.textContent = state.profile.name || 'Загрузка...';
  }
  if (phoneEl) {
    phoneEl.textContent = state.profile.phone || 'Номер не указан';
  }
  
  updateLoyalty();
  
  // Показываем статус загрузки
  if (!state.profile.phone && state.profile.name === 'Загрузка...') {
    console.log('Ожидание данных пользователя...');
  } else {
    console.log('Профиль обновлён:', state.profile);
  }
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
    // Обновляем tg перед отправкой
    updateTg();
    
    if (tg && typeof tg.sendData === 'function') {
      console.log('Отправка данных в бота:', payload);
      tg.sendData(JSON.stringify(payload));
      if (tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('success');
      console.log('Данные успешно отправлены в бота');
    } else {
      console.warn('Telegram WebApp не доступен или sendData недоступен');
      console.log('tg:', tg);
      console.log('tg.sendData:', tg?.sendData);
      console.log('typeof tg.sendData:', typeof tg?.sendData);
      console.log('window.Telegram:', window.Telegram);
      console.log('window.Telegram?.WebApp:', window.Telegram?.WebApp);
      alert('Ошибка: Telegram WebApp не доступен. Убедитесь, что вы открыли приложение через бота.');
    }
  } catch (e) { 
    console.error('sendData error', e);
    // Показываем уведомление пользователю
    alert('Ошибка отправки заказа. Попробуйте еще раз.');
  }
}

// Telegram WebApp init
function initTelegram() {
  // Обновляем tg перед инициализацией
  updateTg();
  
  if (!tg) {
    console.warn('Telegram WebApp не доступен');
    return;
  }
  try {
    tg.ready();
    tg.expand();
    state.tgInit = tg.initDataUnsafe || null;
    const u = state.tgInit?.user || {};
    const name = [u.first_name, u.last_name].filter(Boolean).join(' ').trim();
    
    console.log('Telegram WebApp инициализирован:', { name, username: u.username });
    console.log('tg.sendData доступен:', typeof tg.sendData === 'function');
    
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
    console.log('Кнопка заказа нажата');
    if (!validateBeforeOrder()) return;
    const payload = buildOrderPayload();
    console.log('Payload создан:', payload);
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
  qs('#save-profile')?.addEventListener('click', () => {
    refreshUserData();
    alert('Данные обновлены!');
  });
  

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
    
    // Альтернативный способ - проверяем localStorage на наличие данных
    setTimeout(() => {
      const savedProfile = localStorage.getItem('prestige_profile');
      if (savedProfile) {
        try {
          const profile = JSON.parse(savedProfile);
          if (profile.phone) {
            state.profile = { ...state.profile, ...profile };
            updateProfileUI();
            console.log('Данные загружены из localStorage:', state.profile);
          }
        } catch (e) {
          console.warn('Ошибка загрузки профиля из localStorage:', e);
        }
      }
    }, 2000);
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
    console.log('Данные пользователя загружены:', state.profile);
  }
}

// Обработка специальных сообщений от бота
function handleSpecialMessage(text) {
  if (text && text.includes('WEBAPP_DATA:')) {
    try {
      const jsonStr = text.replace('WEBAPP_DATA:', '');
      const data = JSON.parse(jsonStr);
      handleBotMessage(data);
    } catch (e) {
      console.warn('Ошибка парсинга данных от бота:', e);
    }
  }
}

// Альтернативный способ получения данных через Telegram WebApp API
function getTelegramUserData() {
  if (!tg || !tg.initDataUnsafe) return;
  
  const user = tg.initDataUnsafe.user;
  if (!user) return;
  
  // Получаем данные из Telegram
  const name = [user.first_name, user.last_name].filter(Boolean).join(' ').trim();
  const username = user.username ? `@${user.username}` : '';
  
  // Обновляем профиль
  state.profile.name = name || 'Пользователь';
  state.profile.username = username;
  
  // Сохраняем данные
  saveProfile();
  updateProfileUI();
  
  // Запрашиваем телефон у бота
  requestUserData();
}

// Получение данных пользователя из URL параметров
function getUserDataFromURL() {
  const urlParams = new URLSearchParams(window.location.search);
  const name = urlParams.get('name');
  const phone = urlParams.get('phone');
  const username = urlParams.get('username');
  const user_id = urlParams.get('user_id');
  
  if (name || phone || username) {
    state.profile.name = name || state.profile.name;
    state.profile.phone = phone || state.profile.phone;
    state.profile.username = username || state.profile.username;
    state.profile.user_id = user_id || state.profile.user_id;
    
    saveProfile();
    updateProfileUI();
    console.log('Данные пользователя загружены из URL:', state.profile);
    return true;
  }
  return false;
}

// Функция для принудительного обновления данных
function refreshUserData() {
  console.log('Обновление данных пользователя...');
  getTelegramUserData();
  requestUserData();
}

// Инициализация
document.addEventListener('DOMContentLoaded', () => {
  loadProfile();
  updateProfileUI();
  updateOrderButton();
  renderPaymentMethod();
  initPWA();
  bindUI();
  
  // Сначала проверяем URL параметры
  const hasUrlData = getUserDataFromURL();
  
  // Инициализация Telegram после загрузки API
  if (window.Telegram?.WebApp) {
    console.log('Telegram WebApp доступен');
    initTelegram();
    if (!hasUrlData) {
      getTelegramUserData();
      // Запрашиваем данные пользователя у бота
      setTimeout(requestUserData, 1000);
    }
  } else {
    console.log('Telegram WebApp не доступен, ожидание загрузки...');
    console.log('Проверяем доступность window.Telegram каждые 300мс');
    
    // Пытаемся загрузить Telegram WebApp API вручную
    if (!window.Telegram) {
      console.log('Пытаемся загрузить Telegram WebApp API вручную');
      const script = document.createElement('script');
      script.src = 'https://telegram.org/js/telegram-web-app.js';
      script.onload = function() {
        console.log('Telegram WebApp API загружен вручную');
        updateTg();
        if (window.Telegram?.WebApp) {
          console.log('Telegram WebApp доступен после загрузки');
          initTelegram();
          if (!hasUrlData) {
            getTelegramUserData();
            setTimeout(requestUserData, 1000);
          }
        } else {
          console.warn('Telegram WebApp все еще недоступен после загрузки скрипта');
        }
      };
      script.onerror = function() {
        console.error('Ошибка загрузки Telegram WebApp API');
      };
      document.head.appendChild(script);
    } else {
      console.log('window.Telegram уже доступен, но WebApp нет');
      console.log('window.Telegram:', window.Telegram);
      console.log('window.Telegram.WebApp:', window.Telegram.WebApp);
    }
    
    // Если скрипт подгрузится динамически — пробуем позже
    const iv = setInterval(() => {
      if (window.Telegram?.WebApp) { 
        console.log('Telegram WebApp загружен динамически');
        clearInterval(iv); 
        updateTg();
        initTelegram();
        if (!hasUrlData) {
          getTelegramUserData();
          setTimeout(requestUserData, 1000);
        }
      } else {
        console.log('Ожидание Telegram WebApp...', window.Telegram);
        if (window.Telegram) {
          console.log('window.Telegram доступен, но WebApp нет');
          console.log('window.Telegram.WebApp:', window.Telegram.WebApp);
        }
      }
    }, 300);
    setTimeout(() => {
      clearInterval(iv);
      console.log('Таймаут ожидания Telegram WebApp');
      if (!window.Telegram?.WebApp) {
        console.warn('Telegram WebApp так и не загрузился. Возможно, приложение открыто не через бота.');
        console.log('Финальная проверка:');
        console.log('window.Telegram:', window.Telegram);
        console.log('window.Telegram?.WebApp:', window.Telegram?.WebApp);
        if (window.Telegram) {
          console.log('Доступные методы window.Telegram:', Object.keys(window.Telegram));
        }
      }
    }, 8000);
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
  
  // Слушаем сообщения от Telegram WebApp
  if (tg) {
    tg.onEvent('viewportChanged', () => {
      console.log('Viewport changed');
    });
    
    // Периодически проверяем наличие новых сообщений
    setInterval(() => {
      if (tg && tg.initDataUnsafe) {
        const user = tg.initDataUnsafe.user;
        if (user && !state.profile.phone) {
          getTelegramUserData();
        }
      }
    }, 3000);
  } else {
    console.log('tg недоступен для настройки событий');
  }
  
  // Обработка специальных сообщений от бота (через консоль)
  const originalLog = console.log;
  console.log = function(...args) {
    originalLog.apply(console, args);
    args.forEach(arg => {
      if (typeof arg === 'string' && arg.includes('WEBAPP_DATA:')) {
        handleSpecialMessage(arg);
      }
    });
  };
});



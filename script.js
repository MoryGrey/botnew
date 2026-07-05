// State Management
let bookingFlow = {
    service: '',
    price: 0,
    master: '',
    masterPhoto: '',
    date: '12 июля',
    time: '',
    status: 'Ожидается'
};

// Глобальная навигация
window.navigateTo = function(screenId) {
    console.log('Navigating to:', screenId);
    document.querySelectorAll('.screen').forEach(s => {
        s.classList.remove('active');
        s.style.display = 'none';
    });
    
    const target = document.getElementById(screenId);
    if (target) {
        target.classList.add('active');
        target.style.display = 'block';
    }
    
    const navBtns = document.querySelectorAll('.nav-btn');
    navBtns.forEach(btn => btn.classList.remove('active'));
    
    if (screenId === 'screen-home' && navBtns[0]) navBtns[0].classList.add('active');
    if (['screen-services', 'screen-masters', 'screen-datetime'].includes(screenId) && navBtns[1]) navBtns[1].classList.add('active');
    if (screenId === 'screen-my-bookings' && navBtns[2]) {
        navBtns[2].classList.add('active');
        renderBookings();
    }
    if (screenId === 'screen-profile' && navBtns[3]) navBtns[3].classList.add('active');

    window.scrollTo(0, 0);
};

window.selectService = function(name, price) {
    bookingFlow.service = name;
    bookingFlow.price = price;
    navigateTo('screen-masters');
};

window.selectMaster = function(name, photoUrl) {
    bookingFlow.master = name;
    bookingFlow.masterPhoto = photoUrl || 'https://via.placeholder.com/100';
    navigateTo('screen-datetime');
    const summaryEl = document.getElementById('mini-summary');
    if (summaryEl) {
        summaryEl.innerHTML = '<div style="background: #f5f3ff; padding: 15px; border-radius: 15px; margin-bottom: 20px; display: flex; align-items: center; gap: 12px;"><img src="' + bookingFlow.masterPhoto + '" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover;"><div><p style="font-size: 0.7rem; color: var(--primary); font-weight: 700; margin:0;">ВЫБРАНО:</p><p style="margin:0; font-size: 0.9rem;"><b>' + bookingFlow.service + '</b> • ' + bookingFlow.master + '</p></div></div>';
    }
};

window.selectDate = function(date) {
    bookingFlow.date = date;
    document.querySelectorAll('.date-chip').forEach(chip => {
        chip.classList.remove('active');
        if (chip.innerText.includes(date)) chip.classList.add('active');
    });
};

window.selectTimeSlot = function(el, time) {
    bookingFlow.time = time;
    document.querySelectorAll('.time-chip').forEach(chip => chip.classList.remove('selected'));
    el.classList.add('selected');
    const actionDiv = document.getElementById('datetime-action');
    if (actionDiv) actionDiv.style.display = 'block';
};

window.showConfirmScreen = function() {
    const fields = {
        'conf-service': bookingFlow.service,
        'conf-master-name': bookingFlow.master,
        'conf-date': bookingFlow.date,
        'conf-time': bookingFlow.time,
        'conf-price': bookingFlow.price + ' ₽'
    };
    for (let id in fields) {
        const el = document.getElementById(id);
        if (el) el.innerText = fields[id];
    }
    const img = document.getElementById('conf-master-img');
    if (img) img.src = bookingFlow.masterPhoto;
    navigateTo('screen-final-confirm');
};

window.processBooking = function() {
    const newBooking = { ...bookingFlow, id: Date.now() };
    let bookings = JSON.parse(localStorage.getItem('bookings') || '[]');
    bookings.push(newBooking);
    localStorage.setItem('bookings', JSON.stringify(bookings));
    const succFields = {
        'succ-master-info': 'Мастер: ' + bookingFlow.master,
        'succ-service-info': 'Услуга: ' + bookingFlow.service,
        'succ-date-info': 'Дата: ' + bookingFlow.date + ' в ' + bookingFlow.time
    };
    for (let id in succFields) {
        const el = document.getElementById(id);
        if (el) el.innerText = succFields[id];
    }
    navigateTo('screen-success-check');
};

window.setReminders = function() {
    alert('Уведомления установлены!');
    navigateTo('screen-my-bookings');
};

function renderBookings() {
    const container = document.getElementById('bookings-list-container');
    if (!container) return;
    const bookings = JSON.parse(localStorage.getItem('bookings') || '[]');
    if (bookings.length === 0) {
        container.innerHTML = '<div class="empty-state"><i class="fas fa-calendar-day"></i><p>У вас пока нет активных записей</p><button class="btn-main" onclick="navigateTo(\'screen-services\')">Записаться</button></div>';
        return;
    }
    container.innerHTML = bookings.map(b => '<div class="list-item-card"><div class="item-details"><div style="display:flex; align-items:center; gap:10px; margin-bottom:5px;"><h4 style="margin:0">' + b.service + '</h4><span class="status-badge status-waiting">' + b.status + '</span></div><p>' + b.date + ' в ' + b.time + '</p><p style="font-size: 0.8rem">Мастер: ' + b.master + '</p></div><div style="font-weight: 800; color: var(--primary)">' + b.price + ' ₽</div></div>').join('');
}

document.addEventListener('DOMContentLoaded', () => {
    console.log('App initialized');
    if (window.Telegram && window.Telegram.WebApp) {
        const tg = window.Telegram.WebApp;
        tg.expand();
        if (tg.initDataUnsafe && tg.initDataUnsafe.user) {
            const user = tg.initDataUnsafe.user;
            const nameEl = document.getElementById('user-name-display');
            const photoEl = document.getElementById('user-photo-img');
            if (nameEl) nameEl.innerText = user.first_name + ' ' + (user.last_name || '');
            if (photoEl && user.photo_url) photoEl.src = user.photo_url;
        }
    }
});

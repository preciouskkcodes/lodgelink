// ─── SUPABASE CONFIG ─────────────────────────────────────────────────────────
// Replace these two values with your actual Supabase project URL and publishable key
const SUPABASE_URL = 'https://zomcrvfekwihqrrqvifi.supabase.co';
const SUPABASE_KEY = 'sb_publishable_lC9xUJnLXMF5saz5Y6JYag_JGzmP6fD';
 
// Lightweight Supabase REST helper — no SDK needed for MVP
// All requests go through the auto-generated REST API Supabase provides
const db = {
  async get(table, filters = {}) {
    let url = `${SUPABASE_URL}/rest/v1/${table}?select=*`;
    Object.entries(filters).forEach(([k, v]) => {
      url += `&${k}=eq.${encodeURIComponent(v)}`;
    });
    const res = await fetch(url, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'x-client-info': 'supabase-js/2.0.0',
      }
    });
    if (!res.ok) throw new Error(`Supabase GET failed: ${res.status}`);
    return res.json();
  },
 
  async insert(table, data) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
      },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`Supabase INSERT failed: ${res.status}`);
    return res.json();
  }
};
 
// ─── ONBOARDING — Option C ────────────────────────────────────────────────────
const ONBOARDING_KEY = 'lodgelink_onboarded_v1';
const STORAGE_KEY    = 'lodgelink_reservations_v1';
 
function hasSeenOnboarding() {
  try { return !!localStorage.getItem(ONBOARDING_KEY); }
  catch (e) { return false; }
}
 
function markOnboardingDone() {
  try { localStorage.setItem(ONBOARDING_KEY, '1'); }
  catch (e) {}
}
 
function dismissOnboarding() {
  markOnboardingDone();
  const overlay = document.getElementById('onboarding-overlay');
  if (!overlay) return;
  overlay.classList.remove('open');
  overlay.setAttribute('aria-hidden', 'true');
  const sel = document.getElementById('program-select');
  if (sel) sel.focus();
}
 
function initOnboarding() {
  if (hasSeenOnboarding()) return;
  const overlay = document.getElementById('onboarding-overlay');
  if (!overlay) return;
  setTimeout(() => {
    overlay.classList.add('open');
    overlay.setAttribute('aria-hidden', 'false');
  }, 400);
  const btnStart = document.getElementById('btn-onboarding-start');
  const btnSkip  = document.getElementById('btn-onboarding-skip');
  if (btnStart) btnStart.addEventListener('click', dismissOnboarding);
  if (btnSkip)  btnSkip.addEventListener('click',  dismissOnboarding);
  overlay.addEventListener('click', function(e) {
    if (e.target === overlay) dismissOnboarding();
  });
}
 
// ─── DATA LAYER ───────────────────────────────────────────────────────────────
// allListings holds the listings fetched from Supabase
// Used by search and filter functions throughout
let allListings = [];
 
async function fetchListings() {
  try {
    showLoadingState();
    // Fetch only approved and available listings from Supabase
    const url = `${SUPABASE_URL}/rest/v1/listings?select=*&available=eq.true&approved=eq.true`;
    const res = await fetch(url, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
      }
    });
    if (!res.ok) throw new Error(`Failed to fetch listings: ${res.status}`);
    const data = await res.json();
 
    // Map Supabase snake_case columns to camelCase for the rest of the app
    allListings = data.map(l => ({
      id:              l.id,
      name:            l.name,
      type:            l.type,
      roomType:        l.room_type,
      pricePerNight:   l.price_per_night,
      distanceM:       l.distance_m,
      distanceLabel:   l.distance_label,
      capacity:        l.capacity,
      amenities:       l.amenities || [],
      host:            l.host_name,
      hostPhone:       l.host_phone,
      hostBankName:    l.host_bank_name,
      hostBankAccount: l.host_bank_account,
      hostBankBank:    l.host_bank_bank,
      available:       l.available,
      location:        l.location || '',
      imageUrl:        l.image_url || '',
      images:          Array.isArray(l.images) ? l.images : (l.image_url ? [l.image_url] : []),
      roomsAvailable:  l.rooms_available ?? l.total_rooms ?? 1,
    }));
 
    renderList(allListings);
    renderInsights(allListings);
  } catch (err) {
    console.error('LodgeLink: fetchListings failed', err);
    showErrorState();
  }
}
 
function showLoadingState() {
  const root = document.getElementById('list-root');
  if (!root) return;
  root.innerHTML = `
    <div style="text-align:center; padding:40px 20px; color:#7A95B0;">
      <div style="font-size:32px; margin-bottom:12px;">⏳</div>
      <p style="font-weight:600; color:#0B1F3A; margin-bottom:6px;">Loading rooms...</p>
      <p style="font-size:13px;">Fetching available listings for you</p>
    </div>`;
}
 
function showErrorState() {
  const root = document.getElementById('list-root');
  if (!root) return;
  root.innerHTML = `
    <div style="text-align:center; padding:40px 20px; color:#7A95B0;">
      <div style="font-size:32px; margin-bottom:12px;">⚠️</div>
      <p style="font-weight:600; color:#0B1F3A; margin-bottom:6px;">Could not load listings</p>
      <p style="font-size:13px;">Check your connection and refresh the page.</p>
    </div>`;
}
 
function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) { return []; }
}
 
function saveData(records) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(records)); }
  catch (e) {}
}
 
// ─── RENDER HELPERS ───────────────────────────────────────────────────────────
 
function getPriceLabel(price, allPrices) {
  const sorted = [...allPrices].sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const fairCeiling = min + (max - min) * 0.55;
  if (price === min)        return { label: '★ Best Value', cls: 'best' };
  if (price <= fairCeiling) return { label: '✓ Fair Price', cls: 'fair' };
  return                           { label: '↑ Above Avg',  cls: 'above' };
}
 
function formatPrice(n) {
  return '₦' + n.toLocaleString('en-NG');
}
 
function buildCard(listing, allPrices) {
  const { label, cls } = getPriceLabel(listing.pricePerNight, allPrices);
  const isFullyBooked = listing.roomsAvailable === 0;

  // Build image gallery — use images array, fallback to imageUrl, fallback to placeholder
  const imgs = listing.images.length > 0 ? listing.images
             : listing.imageUrl ? [listing.imageUrl]
             : [];
  const cardId = 'card-' + listing.id.substring(0, 8);

  let galleryHtml;
  if (imgs.length === 0) {
    galleryHtml = `<div class="card-image-placeholder" aria-hidden="true">🏨</div>`;
  } else if (imgs.length === 1) {
    galleryHtml = `<img src="${imgs[0]}" alt="${listing.name}" style="width:100%;height:100%;object-fit:cover;position:absolute;inset:0;" />`;
  } else {
    // Multi-image slider
    galleryHtml = `
      <div class="img-slider" id="${cardId}-slider" data-index="0">
        ${imgs.map((src, i) => `
          <img src="${src}" alt="${listing.name} photo ${i+1}"
               class="slider-img ${i === 0 ? 'active' : ''}"
               style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;
                      opacity:${i === 0 ? 1 : 0};transition:opacity 0.35s ease;" />
        `).join('')}
        <button class="slider-btn slider-prev" onclick="slideImg(event,'${cardId}-slider',-1)" aria-label="Previous photo">‹</button>
        <button class="slider-btn slider-next" onclick="slideImg(event,'${cardId}-slider', 1)" aria-label="Next photo">›</button>
        <div class="slider-dots">
          ${imgs.map((_, i) => `<span class="slider-dot ${i === 0 ? 'active' : ''}" data-i="${i}"></span>`).join('')}
        </div>
      </div>`;
  }

  const card = document.createElement('article');
  card.className = 'listing-card';
  card.setAttribute('role', 'listitem');
  card.setAttribute('aria-label', `${listing.name} listing`);

  card.innerHTML = `
    <div class="card-image">
      ${galleryHtml}
      <div class="price-badge">${formatPrice(listing.pricePerNight)} <span>/night</span></div>
      <div class="fair-label ${cls}">${label}</div>
      ${isFullyBooked ? `<div class="fully-booked-overlay">🚫 Fully Booked</div>` : ''}
    </div>
    <div class="card-body">
      <h2 class="card-title">${listing.name}</h2>
      <p class="card-type">${listing.type} · ${listing.roomType}</p>
      <div class="card-meta">
        <div class="meta-item">
          <span class="meta-icon" aria-hidden="true">📍</span>
          <span><strong>${listing.distanceLabel}</strong> from venue</span>
        </div>
        <div class="meta-item">
          <span class="meta-icon" aria-hidden="true">👥</span>
          <span>Up to <strong>${listing.capacity} guest${listing.capacity > 1 ? 's' : ''}</strong></span>
        </div>
        ${!isFullyBooked ? `
        <div class="meta-item">
          <span class="meta-icon" aria-hidden="true">🛏️</span>
          <span><strong>${listing.roomsAvailable}</strong> room${listing.roomsAvailable !== 1 ? 's' : ''} left</span>
        </div>` : ''}
      </div>
      <div class="amenities">
        ${listing.amenities.map(a => `<span class="amenity-pill">${a}</span>`).join('')}
      </div>
      <div class="card-footer">
        <div class="host-info">
          <div class="host-avatar">${listing.host.substring(0,2).toUpperCase()}</div>
          <div class="host-name">Host: <strong>${listing.host}</strong></div>
        </div>
        ${isFullyBooked
          ? `<button class="reserve-btn" disabled style="opacity:0.45;cursor:not-allowed;background:#ccc;color:#666;box-shadow:none;">Fully Booked</button>`
          : `<button class="reserve-btn" type="button"
               onclick="handleReservation('${listing.name}', ${listing.pricePerNight}, '${listing.id}')">
               Reserve Room
             </button>`
        }
      </div>
    </div>`;
  return card;
}
 
window.slideImg = function(e, sliderId, direction) {
  e.stopPropagation();
  const slider = document.getElementById(sliderId);
  if (!slider) return;
  const imgs = slider.querySelectorAll('.slider-img');
  const dots = slider.querySelectorAll('.slider-dot');
  let idx = parseInt(slider.dataset.index || 0);
  imgs[idx].style.opacity = 0;
  if (dots[idx]) dots[idx].classList.remove('active');
  idx = (idx + direction + imgs.length) % imgs.length;
  imgs[idx].style.opacity = 1;
  if (dots[idx]) dots[idx].classList.add('active');
  slider.dataset.index = idx;
};


// ─── RENDER LIST ──────────────────────────────────────────────────────────────
 
function renderList(listings) {
  const root = document.getElementById('list-root');
  if (!root) return;
  root.innerHTML = '';
 
  const countEl = document.getElementById('results-count-num');
  if (countEl) countEl.textContent = listings.length
    ? `${listings.length} room${listings.length !== 1 ? 's' : ''}`
    : '0 rooms';
 
  if (!listings || listings.length === 0) {
    root.innerHTML = `
      <div style="text-align:center; padding:40px 20px; color:#7A95B0;">
        <div style="font-size:40px; margin-bottom:12px;">🔍</div>
        <p style="font-weight:600; color:#0B1F3A; margin-bottom:6px;">No rooms found</p>
        <p style="font-size:13px;">Try adjusting your search or removing a filter.</p>
      </div>`;
    return;
  }
 
  const allPrices = listings.map(l => l.pricePerNight);
  listings.forEach(l => root.appendChild(buildCard(l, allPrices)));
}
 
// ─── RENDER INSIGHTS ─────────────────────────────────────────────────────────
 
function renderInsights(listings) {
  const panel = document.getElementById('insights-panel');
  if (!panel || !listings || listings.length === 0) return;
 
  const prices = listings.map(l => l.pricePerNight);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const sorted = [...prices].sort((a, b) => a - b);
  const fairCeiling = sorted[0] + (sorted[sorted.length - 1] - sorted[0]) * 0.55;
 
  const subtitle = panel.querySelector('.insights-subtitle');
  if (subtitle) subtitle.textContent = `Based on ${listings.length} listing${listings.length !== 1 ? 's' : ''}`;
 
  const priceLabels = panel.querySelectorAll('.price-label');
  if (priceLabels.length >= 2) {
    priceLabels[0].textContent = formatPrice(min);
    priceLabels[1].textContent = formatPrice(max);
  }
 
  const tagsContainer = panel.querySelector('.insight-tags');
  if (tagsContainer) {
    tagsContainer.innerHTML = `
      <span class="insight-tag tag-fair"  role="listitem">✓ Fair: ${formatPrice(min)}–${formatPrice(Math.round(fairCeiling))}</span>
      <span class="insight-tag tag-best"  role="listitem">★ Best: ${formatPrice(min)}</span>
      <span class="insight-tag tag-above" role="listitem">↑ Above avg: ${formatPrice(Math.round(fairCeiling))}+</span>`;
  }
}
 
// ─── PROGRAM SELECTOR VISUAL CUE ─────────────────────────────────────────────
 
function initProgramSelectorCue() {
  const sel     = document.getElementById('program-select');
  const wrap    = document.getElementById('program-selector-wrap');
  const nudge   = document.getElementById('program-nudge');
  const filterH = document.getElementById('filter-hint');
  let filterHintDismissed = false;
 
  if (!sel) return;
 
  sel.addEventListener('change', () => {
    if (sel.value) {
      if (wrap)  wrap.classList.remove('needs-attention');
      if (nudge) nudge.classList.add('hidden');
      if (!filterHintDismissed) {
        setTimeout(() => {
          if (filterH) filterH.classList.add('hidden');
          filterHintDismissed = true;
        }, 8000);
      }
    } else {
      if (wrap)  wrap.classList.add('needs-attention');
      if (nudge) nudge.classList.remove('hidden');
    }
  });
 
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (filterH) filterH.classList.add('hidden');
      filterHintDismissed = true;
    }, { once: true });
  });
}
 
// ─── SEARCH ───────────────────────────────────────────────────────────────────
 
function parseBudget(query) {
  // Strip currency symbols, commas and spaces first
  const q = query.toLowerCase()
    .replace(/₦/g, '')
    .replace(/,/g, '')
    .replace(/naira/g, '')
    .trim();

  // Match patterns like: under 20k, under 20000, below 20k, 20k budget
  const match = q.match(/(?:under|below|max|within)\s*(\d+)(k?)/);
  if (!match) return null;

  const num = parseInt(match[1]);
  const isK = match[2] === 'k';
  return isK ? num * 1000 : num;
}
 
function parseGuests(query) {
  const match = query.match(/for\s*(\d+)\s*(person|people|guest|guests)?/i);
  return match ? parseInt(match[1]) : null;
}
 
function parseDistance(query) {
  const q = query.toLowerCase();
  if (q.includes('close') || q.includes('near') || q.includes('walking')) return 'close';
  return null;
}
 
window.handleSearch = function(query) {
  const budget       = parseBudget(query);
  const guests       = parseGuests(query);
  const distancePref = parseDistance(query);
 
  let pool = [...allListings];
 
  // Exact matches
  let matched = [...pool];
  if (budget)                   matched = matched.filter(l => l.pricePerNight <= budget);
  if (guests)                   matched = matched.filter(l => l.capacity >= guests);
  if (distancePref === 'close') matched = matched.filter(l => l.distanceM <= 1000);
 
  // Other options
  const matchedIds = new Set(matched.map(l => l.id));
  const others = pool.filter(l => !matchedIds.has(l.id));
 
  const noMatchPanel = document.getElementById('no-match-panel');
  const listRoot     = document.getElementById('list-root');
 
  if (matched.length === 0 && others.length === 0) {
    if (noMatchPanel) noMatchPanel.classList.add('visible');
    if (listRoot)     listRoot.style.display = 'none';
  } else {
    if (noMatchPanel) noMatchPanel.classList.remove('visible');
    if (listRoot)     listRoot.style.display = '';
    renderSearchResults(matched, others);
    renderInsights(pool);
  }
};
 
function renderSearchResults(matched, others) {
  const root = document.getElementById('list-root');
  if (!root) return;
  root.innerHTML = '';
 
  const allPrices = [...matched, ...others].map(l => l.pricePerNight);
 
  const countEl = document.getElementById('results-count-num');
  if (countEl) countEl.textContent = `${matched.length} match${matched.length !== 1 ? 'es' : ''}${others.length ? `, ${others.length} other` : ''}`;
 
  function sectionHeader(text, sub) {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'padding:6px 2px 10px; display:flex; align-items:baseline; gap:8px;';
    wrap.innerHTML = `
      <span style="font-family:var(--font-head);font-size:13px;font-weight:700;color:var(--text-dark);">${text}</span>
      <span style="font-size:11px;color:var(--text-light);">${sub}</span>`;
    return wrap;
  }
 
  if (matched.length > 0) {
    root.appendChild(sectionHeader('Best matches', 'exactly what you described'));
    matched.forEach(l => root.appendChild(buildCard(l, allPrices)));
  }
 
  if (others.length > 0) {
    const divider = document.createElement('div');
    divider.style.cssText = 'height:1px;background:var(--border);margin:8px 0 16px;';
    root.appendChild(divider);
    root.appendChild(sectionHeader('Other options', 'may not match all your criteria'));
    others.forEach(l => root.appendChild(buildCard(l, allPrices)));
  }
}
 
// ─── RESERVATION ─────────────────────────────────────────────────────────────
 
let activeReservation = { propertyName: '', pricePerNight: 0, listingId: '' };
 
function setModalStep(step) {
  for (let i = 1; i <= 3; i++) {
    const el = document.getElementById(`modal-step-${i}`);
    if (!el) continue;
    el.classList.remove('active', 'done');
    if (i < step)       el.classList.add('done');
    else if (i === step) el.classList.add('active');
  }
}
 
window.handleReservation = function(propertyName, pricePerNight, listingId) {
  activeReservation = { propertyName, pricePerNight, listingId };
 
  const nameEl = document.getElementById('modal-property-name');
  if (nameEl) nameEl.textContent = propertyName;
 
  const overlay = document.getElementById('modal-overlay');
  if (overlay) {
    overlay.classList.add('open');
    overlay.setAttribute('aria-hidden', 'false');
  }
 
  const nightsEl = document.getElementById('input-nights');
  if (nightsEl) { nightsEl.value = '2'; updateTotal(); }
 
  setModalStep(1);
 
  const nameInput  = document.getElementById('input-name');
  const phoneInput = document.getElementById('input-phone');
 
  if (nameInput) {
    nameInput.focus();
    nameInput.addEventListener('blur', () => {
      if (nameInput.value.trim()) setModalStep(2);
    });
  }
  if (phoneInput) {
    phoneInput.addEventListener('blur', () => {
      const v = phoneInput.value.trim();
      const validNg = /^0\d{10}$/.test(v) || /^\+234\d{10}$/.test(v);
      const validIntl = /^\+(?!234)\d{6,13}$/.test(v);
      if (validNg || validIntl) setModalStep(3);
    });
  }
};
 
window.updateTotal = function() {
  const nights  = parseInt(document.getElementById('input-nights').value, 10) || 1;
  const total   = nights * activeReservation.pricePerNight;
  const totalEl = document.getElementById('modal-total');
  const brkEl   = document.getElementById('nights-breakdown');
  if (totalEl) totalEl.textContent = formatPrice(total);
  if (brkEl)   brkEl.textContent   = `${nights} night${nights > 1 ? 's' : ''} × ${formatPrice(activeReservation.pricePerNight)} per night`;
};
 
window.confirmReservation = async function() {
  const name   = document.getElementById('input-name').value.trim();
  const phone  = document.getElementById('input-phone').value.trim();
  const guests = document.getElementById('input-guests').value;
  const nights = parseInt(document.getElementById('input-nights').value, 10);
  const program = document.getElementById('program-select').value;

  if (!name) {
    alert('Please enter your full name.');
    document.getElementById('input-name').focus();
    return;
  }
  const isNigerian = /^0\d{10}$/.test(phone) || /^\+234\d{10}$/.test(phone);
  const isInternational = /^\+(?!234)\d{6,13}$/.test(phone);
if (!phone || (!isNigerian && !isInternational)) {
    alert('Please enter a valid phone number.\n\nNigerian: 08012345678 or +2348012345678\nInternational: +447911123456');
    document.getElementById('input-phone').focus();
    return;
  }

  const record = {
    listing_id:      activeReservation.listingId,
    guest_name:      name,
    guest_phone:     phone,
    guests:          parseInt(guests),
    nights:          nights,
    price_per_night: activeReservation.pricePerNight,
    total_cost:      nights * activeReservation.pricePerNight,
    reservation_fee: 2000,
    program:         program || 'unspecified',
    status:          'pending',
  };

  try {
    await db.insert('reservations', record);

    const localRecord = {
      ...record,
      id:            'res-' + Date.now(),
      propertyName:  activeReservation.propertyName,
      pricePerNight: activeReservation.pricePerNight,
      totalCost:     record.total_cost,
      timestamp:     new Date().toISOString(),
    };

    const records = loadData();
    records.push(localRecord);
    saveData(records);

    closeModal();
    setTimeout(() => {
      window.open('https://paystack.shop/pay/4c9yb89ptb', '_blank');
      setTimeout(() => openPrePay(localRecord), 2000);
    }, 300);

  } catch (err) {
    console.error('LodgeLink: reservation save failed', err);
    alert('Could not save your reservation. Please check your connection and try again.');
  }
};

    
// ─── PRE-PAY FLOW ─────────────────────────────────────────────────────────────
 
function openPrePay(record) {
  const overlay = document.getElementById('prepay-overlay');
  if (!overlay) return;
 
  const confirmEl = document.getElementById('prepay-property-confirm');
  if (confirmEl) confirmEl.textContent = `${record.propertyName} · SMS coming to ${record.guest_phone}`;
 
  const breakdownEl = document.getElementById('prepay-breakdown');
  const totalEl     = document.getElementById('prepay-total');
  if (breakdownEl) breakdownEl.textContent = `${record.nights} night${record.nights !== 1 ? 's' : ''} × ${formatPrice(record.pricePerNight)}`;
  if (totalEl)     totalEl.textContent     = formatPrice(record.totalCost);
 
  const bankPanel = document.getElementById('bank-details-panel');
  const btnPay    = document.getElementById('btn-prepay-now');
  if (bankPanel) bankPanel.style.display = 'none';
  if (btnPay)    btnPay.style.display    = '';
 
  // Find host bank details from allListings
  const listing = allListings.find(l => l.name === record.propertyName);
  const detailsContent = document.getElementById('bank-details-content');
  if (detailsContent) {
    if (listing && listing.hostBankAccount) {
      detailsContent.innerHTML = `
        <div><strong>Account name:</strong> ${listing.hostBankName}</div>
        <div><strong>Bank:</strong> ${listing.hostBankBank}</div>
        <div><strong>Account number:</strong> <strong style="font-size:16px;color:var(--navy);letter-spacing:1px;">${listing.hostBankAccount}</strong></div>
        <div><strong>Amount to send:</strong> <strong style="color:var(--navy);">${formatPrice(record.totalCost)}</strong></div>
        <div style="margin-top:4px;"><strong>Host WhatsApp/SMS:</strong> ${listing.hostPhone}</div>`;
    } else {
      detailsContent.innerHTML = `<div style="color:var(--text-light);">Contact your host directly. Their number will be in your SMS confirmation.</div>`;
    }
  }
 
  overlay.classList.add('open');
  overlay.setAttribute('aria-hidden', 'false');
}
 
window.showBankDetails = function() {
  const bankPanel = document.getElementById('bank-details-panel');
  const btnPay    = document.getElementById('btn-prepay-now');
  if (bankPanel) bankPanel.style.display = 'block';
  if (btnPay)    btnPay.style.display    = 'none';
};
 
window.closePrePay = function() {
  const overlay = document.getElementById('prepay-overlay');
  if (overlay) {
    overlay.classList.remove('open');
    overlay.setAttribute('aria-hidden', 'true');
  }
};
 
window.closeModal = function() {
  const overlay = document.getElementById('modal-overlay');
  if (overlay) {
    overlay.classList.remove('open');
    overlay.setAttribute('aria-hidden', 'true');
  }
};
 
//  — called by feature icon buttons
// Shows listings for the selected location first, others below
window.filterByLocation = function(location) {
  // Scroll down to listings
  const main = document.getElementById('main');
  if (main) main.scrollIntoView({ behavior: 'smooth' });

  const matched = allListings.filter(l => l.location === location);
  const others  = allListings.filter(l => l.location !== location);

  const noMatch  = document.getElementById('no-match-panel');
  const listRoot = document.getElementById('list-root');
  if (noMatch)  noMatch.classList.remove('visible');
  if (listRoot) listRoot.style.display = '';

  renderSearchResults(matched, others);
  renderInsights(allListings);

  // Update results count label
  const countEl = document.getElementById('results-count-num');
  if (countEl) countEl.textContent =
    `${matched.length} in ${location}${others.length ? `, ${others.length} other` : ''}`;
};


// ─── INIT ─────────────────────────────────────────────────────────────────────
 
function init() {
  // Fetch listings from Supabase on load
  fetchListings();
 
  const footerYear = document.getElementById('footer-year');
  if (footerYear) footerYear.textContent = new Date().getFullYear();
 
  initOnboarding();
  initProgramSelectorCue();
 
  document.querySelectorAll('.hint-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.getElementById('search-input').value = chip.textContent.trim();
      document.getElementById('search-input').focus();
    });
  });
 
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const filterType = btn.textContent.trim();
      let filtered = [...allListings];
      if (filterType !== 'All') filtered = filtered.filter(l => l.type === filterType);
      const noMatch  = document.getElementById('no-match-panel');
      const listRoot = document.getElementById('list-root');
      if (noMatch)  noMatch.classList.remove('visible');
      if (listRoot) listRoot.style.display = '';
      renderList(filtered);
      renderInsights(filtered);
    });
  });
 
  document.getElementById('btn-primary').addEventListener('click', () => {
    const query = document.getElementById('search-input').value.trim();
    if (query) window.handleSearch(query);
  });
 
  document.getElementById('search-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      const query = document.getElementById('search-input').value.trim();
      if (query) window.handleSearch(query);
    }
  });
 
  document.getElementById('modal-overlay').addEventListener('click', function(e) {
    if (e.target === this) window.closeModal();
  });
 
  const prepayOverlay = document.getElementById('prepay-overlay');
  if (prepayOverlay) {
    prepayOverlay.addEventListener('click', function(e) {
      if (e.target === this) window.closePrePay();
    });
  }
 
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { window.closeModal(); window.closePrePay(); }
  });
 
  document.getElementById('program-select').addEventListener('change', () => {
    const activeFilter = document.querySelector('.filter-btn.active');
    const filterType   = activeFilter ? activeFilter.textContent.trim() : 'All';
    let filtered = [...allListings];
    if (filterType !== 'All') filtered = filtered.filter(l => l.type === filterType);
    const noMatch  = document.getElementById('no-match-panel');
    const listRoot = document.getElementById('list-root');
    if (noMatch)  noMatch.classList.remove('visible');
    if (listRoot) listRoot.style.display = '';
    renderList(filtered);
    renderInsights(filtered);
  });
}
 
document.addEventListener('DOMContentLoaded', init);
 
// ─── SUPABASE CONFIG ─────────────────────────────────────────────────────────
const SUPABASE_URL = 'https://zomcrvfekwihqrrqvifi.supabase.co';
const SUPABASE_KEY = 'sb_publishable_lC9xUJnLXMF5saz5Y6JYag_JGzmP6fD';
 
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
 
// ─── ONBOARDING ───────────────────────────────────────────────────────────────
const ONBOARDING_KEY = 'lodgelink_onboarded_v2';
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
  
  const carousel = document.getElementById('onboarding-carousel');
  const dots = document.querySelectorAll('.onboarding-dot');
  if (carousel && dots.length) {
    carousel.addEventListener('scroll', () => {
      const scrollPos = carousel.scrollLeft;
      const slideWidth = carousel.clientWidth;
      const activeIndex = Math.round(scrollPos / slideWidth);
      dots.forEach((dot, index) => {
        dot.classList.toggle('active', index === activeIndex);
      });
    });
  }

  const btnStart = document.getElementById('btn-onboarding-start');
  if (btnStart) btnStart.addEventListener('click', dismissOnboarding);
  overlay.addEventListener('click', function(e) {
    if (e.target === overlay) dismissOnboarding();
  });
}
 
// ─── DATA LAYER ───────────────────────────────────────────────────────────────
let allListings = [];
 
async function fetchListings() {
  try {
    showLoadingState();
    const url = `${SUPABASE_URL}/rest/v1/listings?select=*&available=eq.true&approved=eq.true`;
    const res = await fetch(url, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
      }
    });
    if (!res.ok) throw new Error(`Failed to fetch listings: ${res.status}`);
    const data = await res.json();
 
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
      ratingAvg:       l.rating_avg || 0,
      reviewCount:     l.review_count || 0,
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
 
function formatPrice(n, listingName = '') {
  const naira = '₦' + Number(n).toLocaleString('en-NG');
  if (listingName) {
    const nameUpper = String(listingName).toUpperCase();
    if (nameUpper.includes('OMNIA') || nameUpper.includes('SAPPHIRE')) {
      const espees = (Number(n) / 2050).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
      return `${naira} (${espees} Espees)`;
    }
  }
  return naira;
}
 
// ─── IMAGE SLIDER ─────────────────────────────────────────────────────────────
window.slideImg = function(e, sliderId, direction) {
  e.stopPropagation();
  const slider = document.getElementById(sliderId);
  if (!slider) return;
  const imgs = slider.querySelectorAll('.slider-img');
  const dots = slider.querySelectorAll('.slider-dot');
  let idx = parseInt(slider.dataset.index || 0);
  imgs[idx].style.opacity = '0';
  if (dots[idx]) dots[idx].classList.remove('active');
  idx = (idx + direction + imgs.length) % imgs.length;
  imgs[idx].style.opacity = '1';
  if (dots[idx]) dots[idx].classList.add('active');
  slider.dataset.index = idx;
};
 
// ─── BUILD CARD ───────────────────────────────────────────────────────────────
function buildCard(listing, allPrices) {
  const { label, cls } = getPriceLabel(listing.pricePerNight, allPrices);
  const isFullyBooked = listing.roomsAvailable === 0;
  const cardId = 'card-' + listing.id.substring(0, 8);
 
  const imgs = listing.images.length > 0 ? listing.images
             : listing.imageUrl ? [listing.imageUrl]
             : [];
 
  let galleryHtml;
  if (imgs.length === 0) {
    galleryHtml = `<div class="card-image-placeholder" aria-hidden="true">🏨</div>`;
  } else if (imgs.length === 1) {
    galleryHtml = `<img src="${imgs[0]}" alt="${listing.name}"
      style="width:100%;height:100%;object-fit:cover;position:absolute;inset:0;" />`;
  } else {
    galleryHtml = `
      <div class="img-slider" id="${cardId}-slider" data-index="0">
        ${imgs.map((src, i) => `
          <img src="${src}" alt="${listing.name} photo ${i + 1}"
               class="slider-img"
               style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;
                      opacity:${i === 0 ? 1 : 0};transition:opacity 0.35s ease;" />
        `).join('')}
        <button class="slider-btn slider-prev"
                onclick="slideImg(event,'${cardId}-slider',-1)"
                aria-label="Previous photo">&#8249;</button>
        <button class="slider-btn slider-next"
                onclick="slideImg(event,'${cardId}-slider', 1)"
                aria-label="Next photo">&#8250;</button>
        <div class="slider-dots">
          ${imgs.map((_, i) => `
            <span class="slider-dot ${i === 0 ? 'active' : ''}" data-i="${i}"></span>
          `).join('')}
        </div>
      </div>`;
  }
 
  const card = document.createElement('article');
  card.className = 'listing-card';
  card.setAttribute('role', 'listitem');
  card.setAttribute('aria-label', `${listing.name} listing`);

  const locClass = listing.location.toLowerCase().includes('asese') ? 'loc-asese' : 'loc-camp';
  const locText = listing.location ? listing.location : 'Lodge Venue';

  card.innerHTML = `
    <div class="card-image" onclick="showListingDetails('${listing.id}')">
      ${galleryHtml}
      <div class="fair-label ${cls}">${label}</div>
      <!-- Heart Icon overlay -->
      <div style="position: absolute; top: 16px; right: 16px; z-index: 2; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; color: white; opacity: 0.8; transition: opacity 0.2s;">
        <svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" style="display: block; fill: rgba(0, 0, 0, 0.5); height: 24px; width: 24px; stroke: white; stroke-width: 2px; overflow: visible;"><path d="M16 28c7-4.73 14-10 14-17a6.98 6.98 0 0 0-7-6.91c-2.5 0-4.73 1.18-6 3.09-1.27-1.91-3.5-3.09-6-3.09a6.98 6.98 0 0 0-7 6.91c0 7 7 12.27 14 17z"></path></svg>
      </div>
      ${isFullyBooked ? `<div class="fully-booked-overlay">🚫 Fully Booked</div>` : ''}
    </div>
    <div class="card-body" onclick="showListingDetails('${listing.id}')">
      <h2 class="card-title" style="display:flex; justify-content:space-between; align-items:flex-start;">
        <span>${listing.name}</span>
        ${listing.ratingAvg > 0 ? `<span style="font-size:13px; font-weight:700; color:var(--text-dark); display:flex; align-items:center; gap:3px;"><span style="color:#E8A020;">★</span> ${Number(listing.ratingAvg).toFixed(1)} <span style="font-weight:400; color:var(--text-light); font-size:11px;">(${listing.reviewCount})</span></span>` : ''}
      </h2>
      <div class="card-type">${locText} • ${listing.roomType}</div>
      <div class="card-meta">
        ${listing.distanceLabel} away • Up to ${listing.capacity} guests
      </div>
      ${!isFullyBooked ? `<div style="font-size:11px; color:#92600A; font-weight:600; margin-top:4px; padding:2px 6px; background:rgba(232,160,32,0.1); border-radius:4px; display:inline-block;">🔥 Only ${listing.roomsAvailable} room${listing.roomsAvailable !== 1 ? 's' : ''} left!</div>` : ''}
      <div class="card-price-row" style="display:flex; justify-content:space-between; align-items:center;">
        <div>${formatPrice(listing.pricePerNight, listing.name)} <span>/night</span></div>
        <div style="font-size:13px; font-weight:700; color:var(--navy); text-decoration:underline;">View details</div>
      </div>
    </div>`;
  return card;
}
 
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
 
// ─── SEARCH PARSERS ───────────────────────────────────────────────────────────
function parseBudget(query) {
  const q = query.toLowerCase()
    .replace(/₦/g, '').replace(/,/g, '').replace(/naira/g, '').trim();
  const match = q.match(/(?:under|below|max|within)\s*(\d+)(k?)/);
  if (!match) return null;
  const num = parseInt(match[1]);
  return match[2] === 'k' ? num * 1000 : num;
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
 
// ─── ROOM TYPE PARSER — checks both roomType and type fields ──────────────────
function parseRoomType(query) {
  const q = query.toLowerCase().trim();
 
  // Property type keywords
  if (q.includes('hotel'))                                  return { field: 'type', value: 'hotel' };
  if (q.includes('guesthouse') || q.includes('guest house')) return { field: 'type', value: 'guesthouse' };
  if (q.includes('hostel'))                                 return { field: 'type', value: 'hostel' };
  if (q.includes('self-contain') || q.includes('self contain') || q.includes('studio')) return { field: 'type', value: 'self-contain' };
 
  // Room type keywords
if (q.includes('family suite') || (q.includes('family') && q.includes('suite'))) return { field: 'roomType', value: 'family suite' };
if (q.includes('single'))                                 return { field: 'roomType', value: 'single' };
if (q.includes('double'))                                 return { field: 'roomType', value: 'double' };
if (q.includes('shared'))                                 return { field: 'roomType', value: 'shared' };
if (q.includes('executive'))                              return { field: 'roomType', value: 'double' };

return null;
}
 
// ─── LISTING MATCHER ─────────────────────────────────────────────────────────
function listingMatchesRoomType(listing, roomTypeFilter) {
  if (!roomTypeFilter) return true;
  const { field, value } = roomTypeFilter;
 
  if (field === 'type') {
    return listing.type.toLowerCase().includes(value);
  }
  if (field === 'roomType') {
    return listing.roomType.toLowerCase().includes(value);
  }
  return true;
}
 
// ─── AUTO-SCROLL ─────────────────────────────────────────────────────────────
function scrollToListings() {
  const main = document.getElementById('main');
  if (main) setTimeout(() => main.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
}
 
// ─── HANDLE SEARCH ───────────────────────────────────────────────────────────
window.handleSearch = function(query) {
  const budget       = parseBudget(query);
  const guests       = parseGuests(query);
  const distancePref = parseDistance(query);
  const roomType     = parseRoomType(query);
 
  // Debug — remove after testing
  console.log('Search:', query);
  console.log('Parsed roomType:', roomType);
  console.log('All listings roomTypes:', allListings.map(l => ({ name: l.name, type: l.type, roomType: l.roomType })));
 
  let pool = [...allListings];
  let matched = [...pool];
 
  if (budget)                   matched = matched.filter(l => l.pricePerNight <= budget);
  if (guests)                   matched = matched.filter(l => l.capacity >= guests);
  if (distancePref === 'close') matched = matched.filter(l => l.distanceM <= 1000);
  if (roomType)                 matched = matched.filter(l => listingMatchesRoomType(l, roomType));
 
  const matchedIds = new Set(matched.map(l => l.id));
  const others = pool.filter(l => !matchedIds.has(l.id));
 
  const noMatchPanel = document.getElementById('no-match-panel');
  const listRoot     = document.getElementById('list-root');
 
  // If roomType search returns 0 matches — show "no match" not all listings
  if (matched.length === 0 && roomType) {
    if (noMatchPanel) noMatchPanel.classList.add('visible');
    if (listRoot)     listRoot.style.display = 'none';
    const countEl = document.getElementById('results-count-num');
    if (countEl) countEl.textContent = `0 matches for "${query}"`;
  } else if (matched.length === 0 && others.length === 0) {
    if (noMatchPanel) noMatchPanel.classList.add('visible');
    if (listRoot)     listRoot.style.display = 'none';
  } else {
    if (noMatchPanel) noMatchPanel.classList.remove('visible');
    if (listRoot)     listRoot.style.display = '';
    renderSearchResults(matched, others);
    renderInsights(pool);
  }
 
  scrollToListings();
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
    if (i < step)        el.classList.add('done');
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
      const validNg   = /^0\d{10}$/.test(v) || /^\+234\d{10}$/.test(v);
      const validIntl = /^\+(?!234)\d{6,13}$/.test(v);
      if (validNg || validIntl) setModalStep(3);
    });
  }
};
 
window.updateTotal = function() {
  const checkinVal = document.getElementById('input-checkin').value;
  const checkoutVal = document.getElementById('input-checkout').value;
  let nights = 1;
  
  const displayBox = document.getElementById('calculated-nights-display');
  const displayText = document.getElementById('calculated-nights-text');

  if (checkinVal && checkoutVal) {
    const d1 = new Date(checkinVal);
    const d2 = new Date(checkoutVal);
    const diffTime = d2 - d1;
    if (diffTime > 0) {
      nights = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (displayBox && displayText) {
        displayBox.style.display = 'flex';
        displayText.textContent = `Staying for ${nights} night${nights !== 1 ? 's' : ''}`;
      }
    } else {
      if (displayBox) displayBox.style.display = 'none';
    }
  } else {
    if (displayBox) displayBox.style.display = 'none';
  }

  const total   = nights * activeReservation.pricePerNight;
  const totalEl = document.getElementById('modal-total');
  const brkEl   = document.getElementById('nights-breakdown');
  if (totalEl) totalEl.textContent = formatPrice(total, activeReservation.propertyName);
  if (brkEl)   brkEl.textContent   = `${nights} night${nights > 1 ? 's' : ''} × ${formatPrice(activeReservation.pricePerNight, activeReservation.propertyName)} per night`;
};
 
window.confirmReservation = async function() {
  const name    = document.getElementById('input-name').value.trim();
  const email   = document.getElementById('input-email').value.trim();
  const phone   = document.getElementById('input-phone').value.trim();
  const guests  = document.getElementById('input-guests').value;
  const checkin = document.getElementById('input-checkin').value;
  const checkout = document.getElementById('input-checkout').value;
  const program = document.getElementById('program-select') ? document.getElementById('program-select').value : 'unspecified';

  if (!name || !email || !phone || !checkin || !checkout) {
    alert('Please fill in all required fields.');
    return;
  }
  
  const cleanPhone = phone.trim().replace(/\s+/g, '');
  const isNigerian = /^0\d{10}$/.test(cleanPhone);
  const isIntl = /^\+\d{10,15}$/.test(cleanPhone);
  
  if (!isNigerian && !isIntl) {
    alert('Please enter a valid 11-digit Nigerian number (e.g. 08012345678) or an international number starting with + (e.g. +234...).');
    return;
  }
  
  const d1 = new Date(checkin);
  const d2 = new Date(checkout);
  const diffTime = d2 - d1;
  const nights = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (nights <= 0) {
    alert('Check-out date must be after check-in date.');
    return;
  }

  const record = {
    listing_id:      activeReservation.listingId,
    guest_name:      name,
    guest_email:     email,
    guest_phone:     phone,
    guests:          parseInt(guests),
    checkin:         checkin,
    checkout:        checkout,
    nights:          nights,
    price_per_night: activeReservation.pricePerNight,
    total_cost:      nights * activeReservation.pricePerNight,
    reservation_fee: 2000,
    program:         program || 'unspecified',
    status:          'pending',
  };

  const btn = document.getElementById('btn-reserve-confirm');
  const originalText = btn.textContent;
  btn.textContent = 'Processing...';
  btn.disabled = true;

  try {
    // Save to Supabase FIRST to get a real ID for Paystack metadata
    const saved = await db.insert('reservations', record);
    if (!saved || !saved[0] || !saved[0].id) {
      throw new Error("Could not connect to server. Check your internet.");
    }
    const realId = saved[0].id;

    // Launch Paystack Inline
    let handler = PaystackPop.setup({
      key: 'pk_live_3d75970ca819e2febf78281901410d755d38b5bc',
      email: email,
      amount: 200000, // ₦2,000 in kobo
      currency: 'NGN',
      ref: 'LL_' + Math.floor((Math.random() * 1000000000) + 1),
      metadata: {
        custom_fields: [
          {
            display_name: "Reservation ID",
            variable_name: "reservation_id",
            value: realId
          }
        ]
      },
      callback: function(response) {
        // Payment successful! Create local record
        const localRecord = {
          ...record,
          id:              realId,
          propertyName:    activeReservation.propertyName,
          pricePerNight:   activeReservation.pricePerNight,
          totalCost:       record.total_cost,
          total:           record.total_cost,
          guestName:       name,
          paymentMethod:   'arrival',
          image:           activeReservation.imageUrl || activeReservation.image || '',
          hostPhone:       activeReservation.hostPhone || '',
          hostBankName:    activeReservation.hostBankName || '',
          hostBankAccount: activeReservation.hostBankAccount || '',
          hostBankBank:    activeReservation.hostBankBank || '',
          timestamp:       new Date().toISOString(),
          status:          'paid' // Optimistic update, webhook will also do this
        };
        const records = loadData();
        records.push(localRecord);
        saveData(records);

        closeModal();
        alert('Payment complete! Reference: ' + response.reference);
        showScreen('bookings');
        renderGuestBookings();
      },
      onClose: function() {
        alert('Payment cancelled. Your reservation is still pending.');
        btn.textContent = originalText;
        btn.disabled = false;
      }
    });

    handler.openIframe();
  } catch (err) {
    alert(err.message);
    btn.textContent = originalText;
    btn.disabled = false;
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
 
window.filterByLocation = function(location) {
  const main = document.getElementById('main');
  if (main) main.scrollIntoView({ behavior: 'auto' });
 
  const matched = allListings.filter(l => l.location === location);
  const others  = allListings.filter(l => l.location !== location);
 
  const noMatch  = document.getElementById('no-match-panel');
  const listRoot = document.getElementById('list-root');
  if (noMatch)  noMatch.classList.remove('visible');
  if (listRoot) listRoot.style.display = '';
 
  renderSearchResults(matched, others);
  renderInsights(allListings);
 
  const countEl = document.getElementById('results-count-num');
  if (countEl) countEl.textContent =
    `${matched.length} in ${location}${others.length ? `, ${others.length} other` : ''}`;
};
 
// ─── SCREEN NAVIGATION ────────────────────────────────────────────────────────
window.showScreen = function(screenName) {
  // Toggle screens
  const exploreScreen  = document.getElementById('screen-explore');
  const bookingsScreen = document.getElementById('screen-bookings');
  const detailsScreen  = document.getElementById('screen-listing-details');
  const bottomNav      = document.querySelector('.bottom-nav');
  if (!exploreScreen || !bookingsScreen) return;

  exploreScreen.classList.remove('active');
  bookingsScreen.classList.remove('active');
  if (detailsScreen) detailsScreen.classList.remove('active');

  // Show/Hide bottom nav
  if (bottomNav) {
    bottomNav.style.display = screenName === 'listing-details' ? 'none' : 'flex';
  }

  // Update screens
  if (screenName === 'bookings') {
    bookingsScreen.classList.add('active');
    renderGuestBookings();
    syncLocalBookingsWithBackend();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } else if (screenName === 'listing-details') {
    if (detailsScreen) detailsScreen.classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } else {
    exploreScreen.classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // Update nav active states
  document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
  const activeNavId = screenName === 'bookings' ? 'nav-bookings' : 'nav-explore';
  const activeNav = document.getElementById(activeNavId);
  if (activeNav) activeNav.classList.add('active');
};

// ─── BACKGROUND SYNC ───────────────────────────────────────────────────────────
window.syncLocalBookingsWithBackend = async function() {
  const records = loadData();
  const pendingIds = records.filter(r => r.status === 'pending').map(r => r.id);
  if (pendingIds.length === 0) return;

  try {
    const list = pendingIds.map(id => `"${id}"`).join(',');
    const url = `${SUPABASE_URL}/rest/v1/reservations?id=in.(${list})&select=id,status`;
    const res = await fetch(url, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    if (!res.ok) return;
    const updates = await res.json();
    
    let changed = false;
    updates.forEach(u => {
      const idx = records.findIndex(r => r.id === u.id);
      if (idx !== -1 && records[idx].status !== u.status) {
        records[idx].status = u.status;
        changed = true;
        
        // Trigger notification
        if (typeof addNotification === 'function') {
          if (u.status === 'confirmed') {
            addNotification('guest', 'Reservation Confirmed! 🎉', `Your reservation for ${records[idx].propertyName} was confirmed by the host.`);
          } else if (u.status === 'declined') {
            addNotification('guest', 'Reservation Declined', `Unfortunately, your reservation for ${records[idx].propertyName} was declined.`);
          }
        }
      }
    });

    if (changed) {
      saveData(records);
      // Re-render if we are on the bookings screen
      if (document.getElementById('screen-bookings').classList.contains('active')) {
        renderGuestBookings();
      }
    }
  } catch (err) {
    console.warn('LodgeLink: Silent sync failed', err);
  }
};

// ─── LISTING DETAILS ───────────────────────────────────────────────────────────
window.showListingDetails = function(listingId) {
  const listing = allListings.find(l => l.id === listingId);
  if (!listing) return;
  
  const content = document.getElementById('listing-details-content');
  if (!content) return;

  const isFullyBooked = listing.roomsAvailable === 0;
  const imgs = listing.images.length > 0 ? listing.images : listing.imageUrl ? [listing.imageUrl] : [];
  
  let coverHtml;
  const detailsId = 'details-' + listing.id.substring(0, 8);
  if (imgs.length === 0) {
    coverHtml = `<div style="width:100%;height:100%;background:#e2e8f0;display:flex;align-items:center;justify-content:center;font-size:40px;">🏨</div>`;
  } else if (imgs.length === 1) {
    coverHtml = `<img src="${imgs[0]}" alt="${listing.name}" style="width:100%;height:100%;object-fit:cover;position:absolute;inset:0;" />`;
  } else {
    coverHtml = `
      <div class="img-slider" id="${detailsId}-slider" data-index="0" style="width:100%;height:100%;position:absolute;inset:0;">
        ${imgs.map((src, i) => `
          <img src="${src}" alt="${listing.name} photo ${i + 1}"
               class="slider-img"
               style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;
                      opacity:${i === 0 ? 1 : 0};transition:opacity 0.35s ease;" />
        `).join('')}
        <button class="slider-btn slider-prev" onclick="slideImg(event,'${detailsId}-slider',-1)" style="left:10px;top:50%;transform:translateY(-50%);">&#8249;</button>
        <button class="slider-btn slider-next" onclick="slideImg(event,'${detailsId}-slider', 1)" style="right:10px;top:50%;transform:translateY(-50%);">&#8250;</button>
        <div class="slider-dots">
          ${imgs.map((_, i) => `<span class="slider-dot ${i === 0 ? 'active' : ''}" data-i="${i}"></span>`).join('')}
        </div>
      </div>`;
  }

  const locText = listing.location ? listing.location : 'Lodge Venue';

  content.innerHTML = `
    <div class="details-cover">
      <button class="details-back-btn" onclick="showScreen('explore')">←</button>
      ${coverHtml}
    </div>
    <div class="details-body">
      <div class="details-type-loc">
        <span style="text-transform:uppercase;font-weight:700;color:var(--navy);">${listing.type}</span>
        <span>·</span>
        <span>📍 ${locText}</span>
      </div>
      <h1 class="details-title">${listing.name}</h1>
      <div style="font-size:14px;color:var(--text-mid);margin-bottom:16px;">${listing.roomType}</div>
      
      <div class="details-price">
        ${formatPrice(listing.pricePerNight, listing.name)} <span>/ night</span>
      </div>

      <div class="details-host-card">
        <div class="details-host-avatar">${listing.host.substring(0, 2).toUpperCase()}</div>
        <div>
          <div style="font-size:14px;color:var(--text-dark);">Hosted by <strong>${listing.host}</strong></div>
          <div style="font-size:11px;color:#1A7A4A;font-weight:600;margin-top:2px;">🛡️ Identity Verified</div>
        </div>
      </div>

      <div class="details-section-title">About this room</div>
      <div style="display:flex;gap:12px;margin-bottom:24px;">
        <div style="flex:1;padding:12px;background:#FAFCFF;border:1px solid var(--border);border-radius:var(--radius-sm);text-align:center;">
          <div style="font-size:20px;margin-bottom:4px;">👥</div>
          <div style="font-size:11px;color:var(--text-light);font-weight:600;text-transform:uppercase;">Capacity</div>
          <div style="font-size:13px;color:var(--text-dark);font-weight:600;margin-top:2px;">Up to ${listing.capacity}</div>
        </div>
        <div style="flex:1;padding:12px;background:#FAFCFF;border:1px solid var(--border);border-radius:var(--radius-sm);text-align:center;">
          <div style="font-size:20px;margin-bottom:4px;">🚗</div>
          <div style="font-size:11px;color:var(--text-light);font-weight:600;text-transform:uppercase;">Distance</div>
          <div style="font-size:13px;color:var(--text-dark);font-weight:600;margin-top:2px;">${listing.distanceLabel}</div>
        </div>
      </div>

      <div class="details-section-title">Amenities</div>
      <div class="details-amenities-grid">
        ${listing.amenities.map(a => `
          <div class="details-amenity-item">
            <div class="details-amenity-icon">✓</div>
            ${a}
          </div>
        `).join('')}
      </div>
      
      ${!isFullyBooked ? `
      <div style="margin-top:32px;padding:12px;background:rgba(232,160,32,0.1);border-radius:var(--radius-sm);text-align:center;font-size:12px;color:#92600A;font-weight:600;">
        Only ${listing.roomsAvailable} room${listing.roomsAvailable !== 1 ? 's' : ''} left!
      </div>` : ''}

      <div class="details-section-title" style="margin-top:40px; display:flex; justify-content:space-between; align-items:center;">
        <div>Guest Reviews <span style="font-size:12px; color:var(--text-light); font-weight:400;">(${listing.reviewCount})</span></div>
        <button onclick="showReviewModal('${listing.id}')" style="background:var(--navy); color:var(--white); border:none; padding:6px 12px; border-radius:12px; font-size:11px; font-weight:600; cursor:pointer;">Write Review</button>
      </div>
      <div id="reviews-container" style="margin-bottom:32px;">
        <div style="font-size:13px; color:var(--text-light); padding:20px; text-align:center; background:#FAFCFF; border-radius:var(--radius-sm); border:1px dashed var(--border);">Loading reviews...</div>
      </div>

    </div>
    
    <div class="details-sticky-footer" style="z-index:50;">
      <div>
        <div style="font-size:12px;color:var(--text-light);font-weight:600;text-transform:uppercase;margin-bottom:2px;">Total</div>
        <div style="font-family:var(--font-head);font-size:18px;font-weight:800;color:var(--text-dark);">${formatPrice(listing.pricePerNight, listing.name)} <span style="font-family:var(--font-body);font-size:12px;font-weight:400;">/night</span></div>
      </div>
      ${isFullyBooked 
        ? `<button disabled style="background:#ccc;color:#666;border:none;padding:14px 24px;border-radius:var(--radius-md);font-family:var(--font-head);font-size:15px;font-weight:700;">Fully Booked</button>`
        : `<button onclick="handleReservation('${listing.name.replace(/'/g, "\\'")}', ${listing.pricePerNight}, '${listing.id}')" style="background:var(--navy);color:var(--white);border:none;padding:14px 28px;border-radius:var(--radius-md);font-family:var(--font-head);font-size:15px;font-weight:700;cursor:pointer;box-shadow:0 4px 14px rgba(11,31,58,0.2);">Reserve Room</button>`
      }
    </div>
  `;
  showScreen('listing-details');
  loadReviews(listing.id);
};

async function loadReviews(listingId) {
  const container = document.getElementById('reviews-container');
  if (!container) return;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/reviews?listing_id=eq.${listingId}&order=created_at.desc&limit=5`, {
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
    });
    if (!res.ok) throw new Error('Failed to load reviews');
    const reviews = await res.json();
    
    if (reviews.length === 0) {
      container.innerHTML = '<div style="font-size:13px; color:var(--text-light); padding:20px; text-align:center; background:#FAFCFF; border-radius:var(--radius-sm); border:1px dashed var(--border);">No reviews yet. Be the first!</div>';
      return;
    }
    
    container.innerHTML = reviews.map(r => `
      <div style="padding:16px; border:1px solid var(--border); border-radius:var(--radius-md); margin-bottom:12px; background:var(--white);">
        <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
          <div style="font-weight:700; font-size:14px; color:var(--text-dark);">${r.guest_name || 'Guest'}</div>
          <div style="color:#E8A020; font-size:12px;">${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}</div>
        </div>
        <div style="font-size:13px; color:var(--text-mid); line-height:1.5;">"${r.comment}"</div>
      </div>
    `).join('');
  } catch (err) {
    container.innerHTML = '<div style="font-size:13px; color:var(--text-light); padding:10px; text-align:center;">Could not load reviews.</div>';
  }
}

// ─── BOOKINGS SCREEN RENDERER ──────────────────────────────────────────────────
function renderGuestBookings() {
  const root = document.getElementById('bookings-list-root');
  if (!root) return;

  let reservations = [];
  try {
    reservations = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch(e) { reservations = []; }

  if (reservations.length === 0) {
    root.innerHTML = `
      <div class="bookings-empty">
        <div class="bookings-empty-icon">🛏️</div>
        <h2>No bookings yet</h2>
        <p>Find and reserve accommodation for your upcoming event — rooms fill fast!</p>
        <button class="bookings-empty-btn" onclick="showScreen('explore')">
          🔍 Explore Rooms
        </button>
      </div>`;
    return;
  }

  // Sort: most recent first
  const sorted = [...reservations].reverse();

  root.innerHTML = `<div class="booking-list">${sorted.map((r, i) => {
    // Determine status
    let statusLabel, statusClass;
    const payMethod = (r.paymentMethod || '').toLowerCase();
    if (payMethod === 'paystack' || payMethod === 'online') {
      statusLabel = '✅ Confirmed';
      statusClass = 'status-confirmed';
    } else {
      // Pay on arrival — pending host confirmation
      statusLabel = '⏳ Pending Host';
      statusClass = 'status-pending-host';
    }

    // Format dates
    const checkinDisplay  = r.checkin  ? formatBookingDate(r.checkin)  : 'Not set';
    const checkoutDisplay = r.checkout ? formatBookingDate(r.checkout) : 'Not set';

    // Nights
    let nightsText = '';
    if (r.checkin && r.checkout) {
      const d1 = new Date(r.checkin);
      const d2 = new Date(r.checkout);
      const nights = Math.max(1, Math.round((d2 - d1) / (1000 * 60 * 60 * 24)));
      nightsText = `${nights} night${nights !== 1 ? 's' : ''}`;
    }

    // Image
    const imageHtml = r.image
      ? `<img class="booking-card-image" src="${r.image}" alt="${r.propertyName || 'Room photo'}" onerror="this.parentNode.innerHTML='<div class=booking-card-image-placeholder>🏠</div>'">`
      : `<div class="booking-card-image-placeholder">🏠</div>`;

    // Bank details panel (only show for pay-on-arrival bookings)
    const showBank = r.hostBankAccount || r.hostBankName;
    const bankPanel = showBank ? `
      <div class="booking-bank-panel" id="bank-panel-${i}">
        <div class="booking-bank-title">Host Bank Details</div>
        <div class="booking-bank-row">
          ${r.hostBankName ? `<strong>Account Name:</strong> ${r.hostBankName}<br>` : ''}
          ${r.hostBankAccount ? `<strong>Account No:</strong> ${r.hostBankAccount}<br>` : ''}
          ${r.hostBankBank ? `<strong>Bank:</strong> ${r.hostBankBank}` : ''}
        </div>
      </div>` : '';

    // WhatsApp link
    const phone = (r.hostPhone || '').replace(/[^0-9]/g, '');
    const waMsg = encodeURIComponent(`Hi, I reserved *${r.propertyName || 'a room'}* on LodgeLink. My check-in is ${checkinDisplay}. Please confirm my booking.`);
    const waUrl = phone ? `https://wa.me/${phone.startsWith('0') ? '234' + phone.slice(1) : phone}?text=${waMsg}` : '#';

    // Actions
    const bankBtnHtml = showBank && payMethod !== 'paystack' ? `
      <button class="booking-action-btn primary" onclick="toggleBankPanel(${i})">
        🏦 Bank Details
      </button>` : '';
    const waBtnHtml = phone ? `
      <a href="${waUrl}" target="_blank" rel="noopener noreferrer" class="booking-action-btn whatsapp">
        💬 WhatsApp Host
      </a>` : '';

    return `
      <div class="booking-card">
        ${imageHtml}
        <div class="booking-card-body">
          <div class="booking-card-top">
            <div class="booking-card-name">${r.propertyName || 'Room Reservation'}</div>
            <span class="booking-status-badge ${statusClass}">${statusLabel}</span>
          </div>
          <div class="booking-dates">
            <span>📅 ${checkinDisplay}</span>
            <span class="booking-dates-divider">→</span>
            <span>${checkoutDisplay}</span>
          </div>
          <div class="booking-meta">
            ${nightsText ? `<span class="booking-meta-item">🌙 ${nightsText}</span>` : ''}
            ${r.guests ? `<span class="booking-meta-item">👤 ${r.guests} guest${r.guests > 1 ? 's' : ''}</span>` : ''}
            ${r.total ? `<span class="booking-meta-item">💰 ₦${Number(r.total).toLocaleString('en-NG')}</span>` : ''}
            ${r.guestName ? `<span class="booking-meta-item">🙋 ${r.guestName}</span>` : ''}
          </div>
          ${bankPanel}
          <div class="booking-actions">
            ${bankBtnHtml}
            ${waBtnHtml}
          </div>
        </div>
      </div>`;
  }).join('')}</div>`;
}
// ─── REVIEWS LOGIC ─────────────────────────────────────────────────────────────
let activeReviewListingId = null;
let selectedRating = 5;

window.showReviewModal = function(listingId) {
  activeReviewListingId = listingId;
  selectedRating = 5;
  document.getElementById('review-name').value = localStorage.getItem('ll_guest_name') || '';
  document.getElementById('review-comment').value = '';
  updateStarUI(5);
  const overlay = document.getElementById('review-overlay');
  if (overlay) overlay.classList.add('open');
};

window.closeReviewModal = function() {
  const overlay = document.getElementById('review-overlay');
  if (overlay) overlay.classList.remove('open');
};

function updateStarUI(val) {
  document.querySelectorAll('.star-input').forEach(s => {
    if (parseInt(s.getAttribute('data-val')) <= val) {
      s.style.color = '#E8A020';
    } else {
      s.style.color = '#ccc';
    }
  });
}

document.querySelectorAll('.star-input').forEach(star => {
  star.addEventListener('click', function() {
    selectedRating = parseInt(this.getAttribute('data-val'));
    updateStarUI(selectedRating);
  });
});

window.submitReview = async function() {
  const name = document.getElementById('review-name').value.trim();
  const comment = document.getElementById('review-comment').value.trim();

  if (!name || !comment) {
    alert('Please enter your name and a comment.');
    return;
  }

  const btn = document.getElementById('btn-submit-review');
  const origText = btn.textContent;
  btn.textContent = 'Submitting...';
  btn.disabled = true;

  try {
    // 1. Insert review into Supabase
    const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/reviews`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({
        listing_id: activeReviewListingId,
        guest_name: name,
        rating: selectedRating,
        comment: comment
      })
    });

    if (!insertRes.ok) throw new Error('Failed to submit review');

    // 2. We skip updating the listing rating_avg manually here to keep it simple, 
    // it's best done via Supabase Trigger or just read dynamically.
    
    alert('Review submitted successfully! Thank you.');
    closeReviewModal();
  } catch (err) {
    console.error('Error submitting review:', err);
    alert('Could not submit review at this time.');
  } finally {
    btn.textContent = origText;
    btn.disabled = false;
  }
};

function formatBookingDate(dateStr) {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch(e) { return dateStr; }
}

window.toggleBankPanel = function(index) {
  const panel = document.getElementById(`bank-panel-${index}`);
  if (panel) panel.classList.toggle('visible');
};

// ─── INIT ─────────────────────────────────────────────────────────────────────
function init() {
  fetchListings();
 
  const footerYear = document.getElementById('footer-year');
  if (footerYear) footerYear.textContent = new Date().getFullYear();
 
  initOnboarding();
  initProgramSelectorCue();
  
  if (typeof setupNotificationsUI === 'function') {
    setupNotificationsUI('guest');
  }
 
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
      scrollToListings();
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

// ─── IN-APP NOTIFICATIONS ENGINE ───────────────────────────────────────────────
const NOTIF_STORAGE_KEY = 'lodgelink_notifications_v1';

window.addNotification = function(recipient, title, message) {
  let list = [];
  try {
    list = JSON.parse(localStorage.getItem(NOTIF_STORAGE_KEY) || '[]');
  } catch(e) {}
  
  list.unshift({
    id: 'notif-' + Math.random().toString(36).substr(2, 9),
    recipient: recipient, // 'guest' or 'host'
    title: title,
    message: message,
    timestamp: Date.now(),
    read: false
  });
  
  localStorage.setItem(NOTIF_STORAGE_KEY, JSON.stringify(list));
  window.dispatchEvent(new Event('storage'));
};

window.clearNotifications = function(recipient) {
  let list = [];
  try {
    list = JSON.parse(localStorage.getItem(NOTIF_STORAGE_KEY) || '[]');
  } catch(e) {}
  
  list = list.filter(n => n.recipient !== recipient);
  localStorage.setItem(NOTIF_STORAGE_KEY, JSON.stringify(list));
  window.dispatchEvent(new Event('storage'));
};

window.renderNotifications = function(recipient) {
  const badge = document.getElementById('notif-badge');
  const listEl = document.getElementById('notifications-list');
  if (!listEl) return;

  let list = [];
  try {
    list = JSON.parse(localStorage.getItem(NOTIF_STORAGE_KEY) || '[]');
  } catch(e) {}

  const filtered = list.filter(n => n.recipient === recipient);
  const unreadCount = filtered.filter(n => !n.read).length;

  if (badge) {
    badge.style.display = unreadCount > 0 ? 'block' : 'none';
  }

  if (filtered.length === 0) {
    listEl.innerHTML = `<div style="text-align:center; padding:24px; color:var(--text-light); font-size:13px;">No notifications yet</div>`;
    return;
  }

  listEl.innerHTML = filtered.map(n => `
    <div style="padding: 12px 16px; border-bottom: 1px solid var(--border); background: ${n.read ? 'white' : '#EEF4FB'}; transition: background 0.2s; position: relative;" onclick="window.markNotifAsRead('${n.id}', '${recipient}')">
      <div style="font-family: var(--font-head); font-weight: 700; font-size: 13px; color: var(--navy); margin-bottom: 4px; display: flex; align-items: center; gap: 6px;">
        ${!n.read ? `<span style="width:6px; height:6px; background:#FF4D4D; border-radius:50%;"></span>` : ''}
        ${n.title}
      </div>
      <div style="font-size: 12px; color: var(--text-mid); line-height: 1.4;">${n.message}</div>
      <div style="font-size: 10px; color: var(--text-light); margin-top: 6px;">
        ${new Date(n.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
      </div>
    </div>
  `).join('');
};

window.markNotifAsRead = function(id, recipient) {
  let list = [];
  try {
    list = JSON.parse(localStorage.getItem(NOTIF_STORAGE_KEY) || '[]');
  } catch(e) {}
  
  const idx = list.findIndex(n => n.id === id);
  if (idx !== -1) {
    list[idx].read = true;
    localStorage.setItem(NOTIF_STORAGE_KEY, JSON.stringify(list));
    window.renderNotifications(recipient);
  }
};

function setupNotificationsUI(recipient) {
  const btn = document.getElementById('btn-notifications');
  const drawer = document.getElementById('notifications-drawer');
  if (!btn || !drawer) return;

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const isVisible = drawer.style.display === 'block';
    drawer.style.display = isVisible ? 'none' : 'block';
    
    if (!isVisible) {
      // Mark all currently listed notifications as read when opening drawer
      let list = [];
      try {
        list = JSON.parse(localStorage.getItem(NOTIF_STORAGE_KEY) || '[]');
      } catch(e) {}
      list.forEach(n => {
        if (n.recipient === recipient) n.read = true;
      });
      localStorage.setItem(NOTIF_STORAGE_KEY, JSON.stringify(list));
      window.renderNotifications(recipient);
    }
  });

  document.addEventListener('click', (e) => {
    if (!drawer.contains(e.target) && !btn.contains(e.target)) {
      drawer.style.display = 'none';
    }
  });
  
  window.addEventListener('storage', () => {
    window.renderNotifications(recipient);
  });
  
  window.renderNotifications(recipient);
}

document.addEventListener('DOMContentLoaded', init);
 
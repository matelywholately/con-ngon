import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { vi } from '../../src/i18n/vi';
import { en } from '../../src/i18n/en';
import { canReserve, displayedOrderStatus, pickupDeadline, reserveFailure } from '../../src/lib/reservations';
import { encodePickupQr } from '../../src/lib/pickupQr';
import type { NearbyListing, OrderWithListing } from '../../src/lib/types';
import * as api from './client';
import { clearPending, readPending, requestId, savePending, type Pending } from './pending';
import { pendingStorage } from './platform';
import { Icon } from './Icon';
import { mealCatalog, type MealFilter, type MealSort } from './catalog';

const areas = [
  { name: 'Cầu Giấy', lat: 21.0313, lng: 105.7902 },
  { name: 'Ba Đình', lat: 21.035, lng: 105.814 },
  { name: 'Đống Đa', lat: 21.012, lng: 105.825 },
];
const interpolate = (text: string, values: Record<string, string | number>) =>
  text.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ''));
type Page = 'meals' | 'orders' | 'account' | 'detail' | 'pass' | 'privacy' | 'safety';

export function App() {
  const [locale, setLocale] = useState<'vi' | 'en'>('vi');
  const t = locale === 'vi' ? vi : en;
  const [page, setPage] = useState<Page>('meals');
  const [area, setArea] = useState(0);
  const [listings, setListings] = useState<NearbyListing[]>([]);
  const [myOrders, setOrders] = useState<OrderWithListing[]>([]);
  const [user, setUser] = useState<api.Account | null>(null);
  const [listing, setListing] = useState<NearbyListing | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [portions, setPortions] = useState(1);
  const [payment, setPayment] = useState<'cash' | 'credit'>('cash');
  const [pending, setPending] = useState<Pending | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [now, setNow] = useState(new Date());
  const [qr, setQr] = useState('');
  const [cancelConfirm, setCancelConfirm] = useState(false);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<MealFilter>('all');
  const [sort, setSort] = useState<MealSort>('nearby');
  const [history, setHistory] = useState(false);
  const [helpBack, setHelpBack] = useState<Page>('account');
  const [art, setArt] = useState('');
  const mealRequest = useRef(0);
  const money = (value: number) => new Intl.NumberFormat(locale === 'vi' ? 'vi-VN' : 'en-US',
    { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(value);
  const time = (value: string | Date) => new Intl.DateTimeFormat(locale === 'vi' ? 'vi-VN' : 'en-GB',
    { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
  const active = myOrders.filter(order => displayedOrderStatus(order, now) === 'reserved');
  const pass = myOrders.find(order => order.id === orderId);
  const passActive = !!pass && displayedOrderStatus(pass, now) === 'reserved';
  const total = (listing?.price_vnd ?? 0) * portions;
  const available = mealCatalog(listings, now);
  const visibleMeals = mealCatalog(listings, now, query, filter, sort);
  const shownOrders = history ? myOrders.filter(order => displayedOrderStatus(order, now) !== 'reserved') : active;
  const minutesLeft = (value: NearbyListing | OrderWithListing['listing']) => Math.max(0, Math.ceil((pickupDeadline(value).getTime() - now.getTime()) / 60000));
  const sample = (id: string) => api.demoMode && art ? { url: art, index: Math.max(0, Math.min(4, Number(id.slice(-1)) - 1)) } : undefined;

  async function loadMeals() {
    const request = ++mealRequest.current;
    setLoading(true);
    try {
      const current = areas[area]!;
      const meals = await api.meals(current.lat, current.lng);
      if (request === mealRequest.current) setListings(meals);
    } catch { if (request === mealRequest.current) { setListings([]); setError(t.common.errorBody); } }
    finally { if (request === mealRequest.current) setLoading(false); }
  }
  async function refreshAccount() {
    const [account, orders] = await Promise.all([api.account(), api.orders()]);
    setUser(account); setOrders(orders);
    setPending(readPending(pendingStorage, account.id));
    return account;
  }
  async function login() {
    setBusy(true); setError('');
    try { await refreshAccount(); }
    catch { setError(t.zalo.loginFailed); }
    finally { setBusy(false); }
  }
  useEffect(() => { void loadMeals(); }, [area]);
  useEffect(() => {
    if (api.demoMode) void login();
    if (import.meta.env.VITE_DEMO_MODE === 'true') void import('./demoArt').then(value => setArt(value.default));
    const timer = setInterval(() => setNow(new Date()), 15000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => { document.documentElement.lang = locale; }, [locale]);
  useEffect(() => {
    const refresh = () => {
      setNow(new Date());
      if (document.visibilityState === 'visible' && user) void refreshAccount().catch(() => setError(t.common.errorBody));
    };
    document.addEventListener('visibilitychange', refresh);
    return () => document.removeEventListener('visibilitychange', refresh);
  }, [user?.id, locale]);
  useEffect(() => {
    let cancelled = false; setQr('');
    if (pass && passActive) {
      const payload = encodePickupQr({ orderId: pass.id, restaurantId: pass.listing.restaurant.id, code: pass.pickup_code });
      void QRCode.toDataURL(payload, { errorCorrectionLevel: 'M', margin: 4, width: 320 })
        .then(value => { if (!cancelled) setQr(value); }).catch(() => { if (!cancelled) setError(t.pass.qrFailed); });
    }
    return () => { cancelled = true; };
  }, [pass?.id, passActive, pass?.pickup_code]);

  function go(next: Page) {
    if (next === 'safety' || next === 'privacy') setHelpBack(page);
    setPage(next); setError(''); setCancelConfirm(false); window.scrollTo(0, 0);
  }
  function openMeal(value: NearbyListing) {
    setListing(value); setPortions(1); setPayment('cash'); go('detail');
    if (pending?.listingId === value.id) { setPortions(pending.portions); setPayment(pending.paymentMethod); }
  }
  function openPass(value: OrderWithListing) { setOrderId(value.id); go('pass'); }
  function status(order: OrderWithListing) {
    const value = displayedOrderStatus(order, now);
    return { reserved: t.orders.statusReserved, collected: t.orders.statusCollected,
      cancelled: t.orders.statusCancelled, no_show: t.orders.statusNoShow, incident: t.orders.statusIncident }[value];
  }
  async function book() {
    if (busy || !user || (!pending && !listing)) return;
    setBusy(true); setError('');
    let value = pending;
    let confirmed = false;
    try {
      if (!value) {
        value = { ownerId: user.id, listingId: listing!.id, portions, paymentMethod: payment, requestId: requestId() };
        // Persist before dispatch. If storage fails, do not send a chargeable request.
        savePending(pendingStorage, value); setPending(value);
      }
      if (value.ownerId !== (await api.signIn()).id) throw new Error('identity_changed');
      const id = await api.reserve(value);
      confirmed = true;
      clearPending(pendingStorage, user.id); setPending(null);
      setOrderId(id); go('pass');
      await refreshAccount(); await loadMeals();
    } catch (failure) {
      const reason = reserveFailure(failure instanceof Error ? failure.message : '');
      if (failure instanceof api.ApiError && failure.definite) {
        clearPending(pendingStorage, user.id); setPending(null);
        const messages = { insufficient_credit: t.reserve.insufficientCredit, sold_out: t.reserve.soldOut,
          past_pickup_window: t.reserve.tooLate, restaurant_unavailable: t.reserve.unavailable,
          not_authenticated: t.reserve.signInRequired, priority_window: t.reserve.priorityWindow };
        setError(messages[reason as keyof typeof messages] ?? t.reserve.failedTitle);
      } else setError(confirmed ? t.common.errorBody : value ? t.reserve.retryPending : t.common.errorBody);
    } finally { setBusy(false); }
  }
  async function cancelPass() {
    if (!pass || busy) return;
    setBusy(true); setError('');
    try { await api.cancel(pass.id); setCancelConfirm(false); await refreshAccount(); await loadMeals(); }
    catch { setError(t.pass.cancelFailed); }
    finally { setBusy(false); }
  }
  const loginPanel = <section className="card login">
    <Icon name="person" /><h2>{t.zalo.welcome}</h2><p>{t.zalo.welcomeBody}</p>
    <button className="primary" disabled={busy} onClick={() => void login()}>{busy ? t.common.loading : t.zalo.signIn}<Icon name="arrow" /></button>
  </section>;
  const orderCard = (order: OrderWithListing) => <button key={order.id} className="order-card" onClick={() => openPass(order)}>
    <span className="order-icon"><Icon name={displayedOrderStatus(order, now) === 'reserved' ? 'qr' : 'receipt'} /></span>
    <span className="order-copy"><span className="badge">{status(order)}</span><strong>{order.listing.title}</strong>
      <span>{order.listing.restaurant.name}</span><span>{time(order.listing.pickup_from)}–{time(pickupDeadline(order.listing))} · {interpolate(t.offer.portions, { n: order.portions })}</span>
      <span className="link">{displayedOrderStatus(order, now) === 'reserved' ? t.orders.showQr : t.pass.summary}</span></span><Icon name="arrow" />
  </button>;
  const clearFilters = () => { setQuery(''); setFilter('all'); };

  return <div className={`shell page-${page}`}>
    <header className="app-header">
      <button className="brand" onClick={() => go('meals')}><span className="brand-mark"><Icon name="bowl" /></span><span>{t.zalo.name}</span></button>
      <button className="pickup-shortcut" onClick={() => { const first = active[0]; first ? openPass(first) : go('orders'); }}>
        <Icon name="qr" />{t.pass.headerShortcut}{active.length > 0 && <span className="count">{active.length}</span>}
      </button>
    </header>
    {api.demoMode && <p className="preview-note">{t.zalo.demo}</p>}
    <main>
      {!api.configured ? <section className="card"><p>{t.zalo.unavailable}</p></section> : <>
        {error && <div role="alert" className="error">{error}<button onClick={() => setError('')} aria-label={t.common.done}>×</button></div>}
        {pending && <section className="pending card"><strong>{t.zalo.pending}</strong><p>{t.zalo.pendingBody}</p><button className="primary" disabled={busy} onClick={() => void book()}>{busy ? t.common.loading : t.zalo.checkPending}</button></section>}
        {['detail', 'pass', 'privacy', 'safety'].includes(page) && <button className="back" onClick={() => go(page === 'pass' ? 'orders' : page === 'privacy' || page === 'safety' ? helpBack : 'meals')}><Icon name="back" />{t.common.back}</button>}
        {page === 'meals' && <>
          <div className="area-row"><Icon name="pin" /><label><span>{t.zalo.area}</span><select value={area} onChange={e => setArea(Number(e.target.value))}>{areas.map((value, index) => <option key={value.name} value={index}>{value.name}</option>)}</select></label><button className="icon-button" onClick={() => void loadMeals()} disabled={loading} aria-label={t.zalo.refresh}><Icon name="refresh" /></button></div>
          <section className="intro"><p className="eyebrow">{t.zalo.nearbyToday}</p><h1>{t.zalo.tagline}</h1></section>
          {active[0] ? <button className="pickup-banner" onClick={() => openPass(active[0]!)}>
            <span><span className="pickup-caption">{t.zalo.pickupReady}</span><strong>{active[0].listing.title}</strong><span>{interpolate(t.zalo.pickupAt, { time: time(pickupDeadline(active[0].listing)) })} · {interpolate(t.zalo.pickupCount, { n: active.length })}</span></span>
            <span className="pickup-tile"><Icon name="qr" /><span>{t.pass.headerShortcut}</span></span>
          </button> : <ol className="journey" aria-label={t.zalo.pickupSteps}>{[t.journey.meal, t.journey.reserve, t.journey.pickup].map((label, i) => <li key={label}><span>{i + 1}</span>{label}</li>)}</ol>}
          <label className="search-field"><Icon name="search" /><span className="sr-only">{t.zalo.search}</span><input type="search" aria-label={t.zalo.search} value={query} onChange={e => setQuery(e.target.value)} placeholder={t.zalo.search} />{query && <button type="button" onClick={() => setQuery('')} aria-label={t.zalo.clearFilters}>×</button>}</label>
          <div className="filters" role="group" aria-label={t.zalo.mealChoices}>{(['all', 'vegetarian', 'budget', 'soon'] as const).map(value => <button key={value} aria-pressed={filter === value} onClick={() => setFilter(value)}>{value === 'vegetarian' && <Icon name="leaf" />}{value === 'soon' && <Icon name="clock" />}{t.zalo.filters[value]}</button>)}</div>
          <div className="section-title"><div><h2>{t.zalo.meals}</h2><span aria-live="polite">{loading ? t.common.loading : interpolate(t.zalo.results, { n: visibleMeals.length })}</span></div><label className="sort"><span className="sr-only">{t.zalo.sort}</span><select value={sort} onChange={e => setSort(e.target.value as MealSort)}>{(['nearby', 'deadline', 'price'] as const).map(value => <option key={value} value={value}>{t.zalo.sorts[value]}</option>)}</select></label></div>
          {loading ? <div className="meal-grid skeleton-grid" role="status" aria-label={t.common.loading}>{[1, 2, 3, 4].map(value => <div className="skeleton" key={value}><div /><span /><span /></div>)}</div>
            : !visibleMeals.length ? <section className="empty-state"><Icon name="bowl" /><h2>{available.length ? t.zalo.noResults : t.discover.emptyTitle}</h2><p>{available.length ? t.zalo.noResultsBody : t.discover.emptyBody}</p>{available.length > 0 && <button className="primary" onClick={clearFilters}>{t.zalo.clearFilters}</button>}</section>
            : <div className="meal-grid">{visibleMeals.map(value => <button className="meal-card" key={value.id} onClick={() => openMeal(value)}>
              <div className="meal-image"><MealPhoto src={value.photo_url} label={value.title} fallback={t.zalo.noPhoto} sample={sample(value.id)} illustration={t.zalo.illustration} />{value.is_vegetarian && <span className="diet-badge" title={t.offer.vegetarian}><Icon name="leaf" /><span className="sr-only">{t.offer.vegetarian}</span></span>}</div>
              <div className="meal-copy"><span className="restaurant">{value.restaurant_name}</span><h3>{value.title}</h3>
                <span className="pickup-time"><Icon name="clock" />{time(value.pickup_from)}–{time(pickupDeadline(value))}</span>
                <div className="meal-price"><strong>{money(value.price_vnd)}</strong>{value.original_price_vnd && value.original_price_vnd > value.price_vnd && <del>{money(value.original_price_vnd)}</del>}</div>
                <div className="meal-bottom"><span>{interpolate(t.discover.portionsLeft, { n: value.portions_left })}</span><span>{interpolate(t.zalo.distance, { n: (value.distance_m / 1000).toLocaleString(locale, { maximumFractionDigits: 1 }) })}</span></div>
                {minutesLeft(value) <= 30 && <span className="deadline"><Icon name="clock" />{interpolate(t.zalo.endsIn, { n: minutesLeft(value) })}</span>}
              </div>
            </button>)}</div>}
        </>}
        {page === 'detail' && listing && <div className="detail-layout"><div>
          <div className="detail-photo"><MealPhoto src={listing.photo_url} label={listing.title} fallback={t.zalo.noPhoto} sample={sample(listing.id)} illustration={t.zalo.illustration} /></div>
          <section className="detail-heading"><p className="eyebrow">{listing.restaurant_name}</p><h1>{listing.title}</h1><div className="detail-price"><strong className="price">{money(listing.price_vnd)}</strong><span>{t.zalo.perPortion}</span>{listing.original_price_vnd && listing.original_price_vnd > listing.price_vnd && <del>{money(listing.original_price_vnd)}</del>}</div>{listing.is_vegetarian && <span className="badge"><Icon name="leaf" />{t.offer.vegetarian}</span>}</section>
          <section className="detail-section"><h2>{t.offer.contents}</h2><p>{listing.description}</p><p className="allergens"><strong>{t.offer.allergens}: </strong>{listing.allergens.join(', ') || t.offer.noAllergens}</p></section>
          <section className="pickup-info"><span className="info-icon"><Icon name="pin" /></span><div><h2>{t.zalo.pickup}</h2><p className="time-large">{time(listing.pickup_from)}–{time(pickupDeadline(listing))}</p><p>{listing.restaurant_address}</p><p className="muted">{interpolate(t.offer.cookedAt, { time: time(listing.prepared_at) })}</p><button className="text-button" onClick={() => go('safety')}><Icon name="shield" />{t.offer.safetyLink}<Icon name="arrow" /></button></div></section>
        </div><div className="checkout-column">{!user ? loginPanel : <section className="card checkout"><h2>{t.journey.checkoutTitle}</h2>
          <div className="quantity"><label htmlFor="portions">{t.reserve.howMany}</label><div className="stepper"><button aria-label={t.zalo.decrease} disabled={!!pending || busy || portions <= 1} onClick={() => setPortions(value => value - 1)}>−</button><input id="portions" type="number" min="1" max={listing.portions_left} value={portions} disabled={!!pending || busy} onChange={e => setPortions(Math.max(1, Math.min(listing.portions_left, Math.floor(Number(e.target.value)) || 1)))} /><button aria-label={t.zalo.increase} disabled={!!pending || busy || portions >= listing.portions_left} onClick={() => setPortions(value => value + 1)}>+</button></div></div>
          <fieldset disabled={!!pending || busy}><legend>{t.reserve.payWith}</legend><label className={`payment-option ${payment === 'cash' ? 'selected' : ''}`}><input type="radio" name="payment" checked={payment === 'cash'} onChange={() => setPayment('cash')} /><span><strong>{t.reserve.cash}</strong><small>{t.reserve.payAtPickup}</small></span></label>
            <label className={`payment-option ${payment === 'credit' ? 'selected' : ''}`}><input type="radio" name="payment" checked={payment === 'credit'} disabled={total <= 0 || user.credit < total} onChange={() => setPayment('credit')} /><span><strong>{t.reserve.credit}</strong><small>{interpolate(t.reserve.creditBalance, { amount: money(user.credit) })}</small></span></label></fieldset>
          {payment === 'credit' && <p className="muted">{t.reserve.creditTerms}</p>}
          <div className="checkout-note"><Icon name="qr" /><p>{t.zalo.checkoutHint}</p></div>
          <div className="checkout-action"><div><span>{t.reserve.total}</span><strong>{money(total)}</strong></div><button className="primary" disabled={busy || !!pending || !canReserve(listing, now) || (payment === 'credit' && user.credit < total)} onClick={() => void book()}>{busy ? t.common.loading : canReserve(listing, now) ? t.reserve.confirm : t.offer.expiredCta}<Icon name="arrow" /></button></div>
        </section>}</div></div>}
        {page === 'orders' && <><div className="page-heading"><p className="eyebrow">{t.zalo.name}</p><h1>{t.orders.title}</h1><p>{t.orders.subtitle}</p></div>{!user ? loginPanel : <>
          <div className="order-toolbar"><div className="segments"><button aria-pressed={!history} onClick={() => setHistory(false)}>{t.orders.active}<span>{active.length}</span></button><button aria-pressed={history} onClick={() => setHistory(true)}>{t.orders.past}</button></div><button className="icon-button" onClick={() => void login()} disabled={busy} aria-label={t.pass.refresh}><Icon name="refresh" /></button></div>
          <div className="order-grid">{shownOrders.length ? shownOrders.map(orderCard) : <section className="empty-state"><Icon name="receipt" /><h2>{history ? t.orders.past : t.orders.emptyActive}</h2><p>{history ? t.zalo.historyEmpty : t.journey.qrAfterBooking}</p><button className="primary" onClick={() => go('meals')}>{t.zalo.browseMeals}<Icon name="arrow" /></button></section>}</div>
        </>}</>}
        {page === 'pass' && <><div className="page-heading"><p className="eyebrow">{t.zalo.name}</p><h1>{t.pass.title}</h1></div>{!pass ? <section className="card"><p>{t.common.loading}</p><button onClick={() => void login()} disabled={busy}>{t.pass.refresh}</button></section> : <div className="pass-layout">
          <section className="card qr-card"><span className="badge"><Icon name={passActive ? 'clock' : 'receipt'} />{status(pass)}</span><h2>{pass.listing.title}</h2>{passActive && <>{qr ? <img className="qr" src={qr} width="320" height="320" alt={t.pass.qrLabel} /> : <p role="status">{t.common.loading}</p>}<p className="qr-hint">{t.pass.qrHint}</p><div className="ticket-divider" /><p className="muted">{t.pass.manualCode}</p><strong className="manual-code">{pass.pickup_code}</strong></>}
            <p className="time-large">{time(pass.listing.pickup_from)}–{time(pickupDeadline(pass.listing))}</p>{passActive && <p className="deadline"><Icon name="clock" />{interpolate(t.pass.expiresIn, { n: minutesLeft(pass.listing) })}</p>}
          </section><div><section className="card pass-details"><span className="info-icon"><Icon name="pin" /></span><h2>{pass.listing.restaurant.name}</h2><p>{pass.listing.restaurant.address}</p>{pass.listing.restaurant.pickup_instructions && <p>{pass.listing.restaurant.pickup_instructions}</p>}<div className="total"><span>{interpolate(t.offer.portions, { n: pass.portions })}</span><strong>{money(pass.price_paid_vnd)}</strong></div><p>{pass.payment_method === 'credit' ? t.reserve.credit : t.reserve.cash}</p><details><summary>{t.zalo.reference}</summary><code className="order-ref">{pass.id}</code></details></section>
          <button className="full" disabled={busy} onClick={() => void login()}><Icon name="refresh" />{t.pass.refresh}</button>{passActive && <><p className="muted">{t.pass.cancelCreditHint}</p>{cancelConfirm ? <section className="card cancel-confirm" aria-live="polite"><p>{t.zalo.cancelledConfirm}</p><button className="danger full" disabled={busy} onClick={() => void cancelPass()}>{t.zalo.confirmCancel}</button><button className="full" disabled={busy} onClick={() => setCancelConfirm(false)}>{t.zalo.keepOrder}</button></section> : <button className="danger full" disabled={busy} onClick={() => setCancelConfirm(true)}>{t.pass.cancelOrder}</button>}</>}</div>
        </div>}</>}
        {page === 'account' && <><div className="page-heading"><p className="eyebrow">{t.zalo.name}</p><h1>{t.profile.title}</h1></div>{!user ? loginPanel : <section className="credit-card"><div><p>{t.zalo.freeCredit}</p><strong className="balance">{money(user.credit)}</strong></div><Icon name="bowl" /><p className="credit-description">{t.zalo.creditsBody}</p><button disabled={busy} onClick={() => void login()}><Icon name="refresh" />{t.zalo.refresh}</button></section>}
          <section className="card settings"><label>{t.profile.language}<select value={locale} onChange={e => setLocale(e.target.value as 'vi' | 'en')}><option value="vi">{t.common.vietnamese}</option><option value="en">{t.common.english}</option></select></label><button className="settings-row" onClick={() => go('privacy')}><Icon name="shield" />{t.zalo.privacy}<Icon name="arrow" /></button><button className="settings-row" onClick={() => go('safety')}><Icon name="leaf" />{t.safety.title}<Icon name="arrow" /></button></section>
          <section className="help-section"><h2>{t.zalo.help}</h2><p>{t.zalo.helpBody}</p></section>
        </>}
        {page === 'privacy' && <section className="card prose"><Icon name="shield" /><h1>{t.zalo.privacy}</h1><p>{t.zalo.privacyBody}</p></section>}
        {page === 'safety' && <section className="card prose"><Icon name="leaf" /><h1>{t.safety.title}</h1><p>{t.zalo.safetyBody}</p><h2>{t.safety.ruleTitle}</h2><p>{t.safety.ruleBody}</p></section>}
      </>}
    </main>
    <nav className="tabs" aria-label={t.zalo.name}>{(['meals', 'orders', 'account'] as const).map((value, index) => <button key={value} aria-current={(page === value || value === 'meals' && page === 'detail' || value === 'orders' && page === 'pass' || value === 'account' && (page === 'privacy' || page === 'safety')) ? 'page' : undefined} onClick={() => go(value)}><span className="tab-icon"><Icon name={(['bowl', 'receipt', 'person'] as const)[index]!} />{value === 'orders' && active.length > 0 && <span className="tab-dot" />}</span>{[t.zalo.meals, t.orders.title, t.zalo.account][index]}</button>)}</nav>
  </div>;
}

function MealPhoto({ src, label, fallback, sample, illustration }: { src: string | null; label: string; fallback: string; sample?: { url: string; index: number }; illustration: string }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  if (src?.startsWith('https://') && !failed) return <img className="meal-photo" src={src} alt={label} loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} />;
  if (sample) return <div className="meal-art" role="img" aria-label={`${label} · ${illustration}`} style={{ backgroundImage: `url(${sample.url})`, backgroundPosition: `${sample.index * 25}% center` }}><small>{illustration}</small></div>;
  return <div className="meal-placeholder" role="img" aria-label={fallback}><Icon name="bowl" /><small>{fallback}</small></div>;
}

import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { vi } from '../../src/i18n/vi';
import { en } from '../../src/i18n/en';
import { canReserve, displayedOrderStatus, pickupDeadline, reserveFailure } from '../../src/lib/reservations';
import { encodePickupQr } from '../../src/lib/pickupQr';
import type { NearbyListing, OrderWithListing } from '../../src/lib/types';
import * as api from './client';
import { clearPending, readPending, requestId, savePending, type Pending } from './pending';
import { pendingStorage } from './platform';

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
  const money = (value: number) => new Intl.NumberFormat(locale === 'vi' ? 'vi-VN' : 'en-US',
    { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(value);
  const time = (value: string | Date) => new Intl.DateTimeFormat(locale === 'vi' ? 'vi-VN' : 'en-GB',
    { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
  const active = myOrders.filter(order => displayedOrderStatus(order, now) === 'reserved');
  const pass = myOrders.find(order => order.id === orderId);
  const passActive = !!pass && displayedOrderStatus(pass, now) === 'reserved';
  const total = (listing?.price_vnd ?? 0) * portions;

  async function loadMeals() {
    setLoading(true);
    try {
      const current = areas[area]!;
      setListings(await api.meals(current.lat, current.lng));
    } catch { setError(t.common.errorBody); }
    finally { setLoading(false); }
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

  function go(next: Page) { setPage(next); setError(''); setCancelConfirm(false); window.scrollTo(0, 0); }
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
    <h2>{t.zalo.welcome}</h2><p>{t.zalo.welcomeBody}</p>
    <button className="primary" disabled={busy} onClick={() => void login()}>{busy ? t.common.loading : t.zalo.signIn}</button>
  </section>;
  const orderCard = (order: OrderWithListing) => <button key={order.id} className="order-card" onClick={() => openPass(order)}>
    <span className="badge">{status(order)}</span><strong>{order.listing.title}</strong>
    <span>{order.listing.restaurant.name}</span>
    <span>{time(order.listing.pickup_from)}–{time(pickupDeadline(order.listing))} · {interpolate(t.offer.portions, { n: order.portions })}</span>
    <span className="link">{displayedOrderStatus(order, now) === 'reserved' ? t.orders.showQr : t.pass.summary} →</span>
  </button>;

  return <div className="shell">
    <header className="app-header"><button className="brand" onClick={() => go('meals')}><span className="brand-mark" aria-hidden="true">BK</span>{t.zalo.name}</button>
      <button className="pickup-shortcut" onClick={() => { const first = active[0]; first ? openPass(first) : go('orders'); }}>
        <span aria-hidden="true">▦</span> {t.pass.headerShortcut}{active.length > 0 && <span className="count">{active.length}</span>}
      </button></header>
    {api.demoMode && <p className="preview-note">{t.zalo.demo}</p>}
    <main>
      {!api.configured ? <section className="card"><p>{t.zalo.unavailable}</p></section> : <>
        {error && <div role="alert" className="error">{error}<button onClick={() => setError('')} aria-label={t.common.done}>×</button></div>}
        {pending && <section className="pending card"><strong>{t.zalo.pending}</strong><p>{t.zalo.pendingBody}</p><button className="primary" disabled={busy} onClick={() => void book()}>{busy ? t.common.loading : t.zalo.checkPending}</button></section>}
        {['detail', 'pass', 'privacy', 'safety'].includes(page) && <button className="back" onClick={() => go(page === 'pass' ? 'orders' : page === 'privacy' ? 'account' : 'meals')}>← {t.common.back}</button>}
        {page === 'meals' && <>
          <section className="intro"><p className="eyebrow">{t.zalo.name}</p><h1>{t.zalo.tagline}</h1><p>{t.zalo.pilot}</p></section>
          <div className="list-tools"><label>{t.zalo.area}<select value={area} onChange={e => setArea(Number(e.target.value))}>{areas.map((value, index) => <option key={value.name} value={index}>{value.name}</option>)}</select></label><button onClick={() => void loadMeals()} disabled={loading}>{t.zalo.refresh}</button></div>
          <div className="section-title"><h2>{t.zalo.meals}</h2><span>{interpolate(t.discover.subtitle, { count: listings.filter(value => canReserve(value, now)).reduce((sum, value) => sum + value.portions_left, 0) })}</span></div>
          {loading ? <p role="status">{t.common.loading}</p> : listings.filter(value => canReserve(value, now)).length === 0 ? <section className="card"><h2>{t.discover.emptyTitle}</h2><p>{t.discover.emptyBody}</p></section> : <div className="meal-grid">{listings.filter(value => canReserve(value, now)).map(value => <button className="meal-card" key={value.id} onClick={() => openMeal(value)}>
            <MealPhoto src={value.photo_url} label={value.title} fallback={t.zalo.noPhoto} />
            <div className="meal-copy"><span className="restaurant">{value.restaurant_name}</span><h3>{value.title}</h3><span>{time(value.pickup_from)}–{time(pickupDeadline(value))}</span>
              <div className="meal-bottom"><strong>{money(value.price_vnd)}</strong><span className="badge">{interpolate(t.discover.portionsLeft, { n: value.portions_left })}</span></div></div>
          </button>)}</div>}
        </>}
        {page === 'detail' && listing && <>
          <MealPhoto src={listing.photo_url} label={listing.title} fallback={t.zalo.noPhoto} />
          <section className="detail-heading"><p className="eyebrow">{listing.restaurant_name}</p><h1>{listing.title}</h1><strong className="price">{money(listing.price_vnd)}</strong>{listing.original_price_vnd && <p>{interpolate(t.offer.originalPrice, { price: money(listing.original_price_vnd) })}</p>}</section>
          <section className="card"><h2>{t.offer.contents}</h2><p>{listing.description}</p><p><strong>{t.offer.allergens}: </strong>{listing.allergens.join(', ') || t.offer.noAllergens}</p>{listing.is_vegetarian && <span className="badge">{t.offer.vegetarian}</span>}</section>
          <section className="card"><h2>{t.zalo.pickup}</h2><p className="time-large">{time(listing.pickup_from)}–{time(pickupDeadline(listing))}</p><p>{listing.restaurant_address}</p><p>{interpolate(t.offer.cookedAt, { time: time(listing.prepared_at) })}</p><button className="text-button" onClick={() => go('safety')}>{t.offer.safetyLink} →</button></section>
          {!user ? loginPanel : <section className="card checkout"><h2>{t.journey.checkoutTitle}</h2><label>{t.reserve.howMany}<input type="number" min="1" max={listing.portions_left} value={portions} disabled={!!pending || busy} onChange={e => setPortions(Math.max(1, Math.min(listing.portions_left, Math.floor(Number(e.target.value)) || 1)))} /></label>
            <fieldset disabled={!!pending || busy}><legend>{t.reserve.payWith}</legend><label className="radio"><input type="radio" checked={payment === 'cash'} onChange={() => setPayment('cash')} />{t.reserve.cash}</label>
              <label className="radio"><input type="radio" checked={payment === 'credit'} disabled={total <= 0 || user.credit < total} onChange={() => setPayment('credit')} />{t.reserve.credit}</label></fieldset>
            <p>{interpolate(t.reserve.creditBalance, { amount: money(user.credit) })}</p><p className="muted">{payment === 'cash' ? t.reserve.payAtPickup : t.reserve.creditTerms}</p>
            <div className="total"><span>{t.reserve.total}</span><strong>{money(total)}</strong></div>
            <button className="primary" disabled={busy || !!pending || !canReserve(listing, now) || (payment === 'credit' && user.credit < total)} onClick={() => void book()}>{busy ? t.common.loading : canReserve(listing, now) ? t.reserve.confirm : t.offer.expiredCta}</button><p className="muted">{t.journey.qrAfterBooking}</p>
          </section>}
        </>}
        {page === 'orders' && <><h1>{t.orders.title}</h1><p>{t.orders.subtitle}</p>{!user ? loginPanel : <>
          <button onClick={() => void login()} disabled={busy}>{t.pass.refresh}</button><h2>{t.orders.active}</h2><div className="order-grid">{active.length ? active.map(orderCard) : <p>{t.orders.emptyActive}</p>}</div><h2>{t.orders.past}</h2><div className="order-grid">{myOrders.filter(order => displayedOrderStatus(order, now) !== 'reserved').map(orderCard)}</div>
        </>}</>}
        {page === 'pass' && <><h1>{t.pass.title}</h1>{!pass ? <section className="card"><p>{t.common.loading}</p><button onClick={() => void login()} disabled={busy}>{t.pass.refresh}</button></section> : <>
          <section className="card qr-card"><span className="badge">{status(pass)}</span><h2>{pass.listing.title}</h2>{passActive && <>{qr ? <img className="qr" src={qr} width="320" height="320" alt={t.pass.qrLabel} /> : <p>{t.pass.qrFailed}</p>}<p>{t.pass.qrHint}</p><p className="muted">{t.pass.manualCode}</p><strong className="manual-code">{pass.pickup_code}</strong></>}
            <p className="time-large">{time(pass.listing.pickup_from)}–{time(pickupDeadline(pass.listing))}</p>{passActive && <p>{interpolate(t.pass.expiresIn, { n: Math.max(0, Math.ceil((pickupDeadline(pass.listing).getTime() - now.getTime()) / 60000)) })}</p>}
          </section><section className="card"><h2>{pass.listing.restaurant.name}</h2><p>{pass.listing.restaurant.address}</p>{pass.listing.restaurant.pickup_instructions && <p>{pass.listing.restaurant.pickup_instructions}</p>}<div className="total"><span>{interpolate(t.offer.portions, { n: pass.portions })}</span><strong>{money(pass.price_paid_vnd)}</strong></div><p>{pass.payment_method === 'credit' ? t.reserve.credit : t.reserve.cash}</p><code className="order-ref">{pass.id}</code></section>
          <button className="full" disabled={busy} onClick={() => void login()}>{t.pass.refresh}</button>{passActive && <><p className="muted">{t.pass.cancelCreditHint}</p>{cancelConfirm ? <section className="card" aria-live="polite"><p>{t.zalo.cancelledConfirm}</p><button className="danger full" disabled={busy} onClick={() => void cancelPass()}>{t.zalo.confirmCancel}</button><button className="full" disabled={busy} onClick={() => setCancelConfirm(false)}>{t.zalo.keepOrder}</button></section> : <button className="danger full" disabled={busy} onClick={() => setCancelConfirm(true)}>{t.pass.cancelOrder}</button>}</>}
        </>}</>}
        {page === 'account' && <><h1>{t.profile.title}</h1>{!user ? loginPanel : <section className="card"><p className="eyebrow">{t.zalo.freeCredit}</p><strong className="balance">{money(user.credit)}</strong><p>{t.zalo.creditsBody}</p><button disabled={busy} onClick={() => void login()}>{t.zalo.refresh}</button></section>}
          <section className="card"><label>{t.profile.language}<select value={locale} onChange={e => setLocale(e.target.value as 'vi' | 'en')}><option value="vi">{t.common.vietnamese}</option><option value="en">{t.common.english}</option></select></label></section>
          <section className="card"><h2>{t.zalo.help}</h2><p>{t.zalo.helpBody}</p><button className="text-button" onClick={() => go('privacy')}>{t.zalo.privacy} →</button></section>
        </>}
        {page === 'privacy' && <section className="card"><h1>{t.zalo.privacy}</h1><p>{t.zalo.privacyBody}</p></section>}
        {page === 'safety' && <section className="card"><h1>{t.safety.title}</h1><p>{t.zalo.safetyBody}</p><h2>{t.safety.ruleTitle}</h2><p>{t.safety.ruleBody}</p></section>}
      </>}
    </main>
    <nav className="tabs" aria-label={t.zalo.name}>{(['meals', 'orders', 'account'] as const).map((value, index) => <button key={value} aria-current={(page === value || value === 'meals' && page === 'detail' || value === 'orders' && page === 'pass') ? 'page' : undefined} onClick={() => go(value)}><span aria-hidden="true">{['◉', '▦', '○'][index]}</span>{[t.zalo.meals, t.orders.title, t.zalo.account][index]}</button>)}</nav>
  </div>;
}

function MealPhoto({ src, label, fallback }: { src: string | null; label: string; fallback: string }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  return src?.startsWith('https://') && !failed ? <img className="meal-photo" src={src} alt={label} loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} />
    : <div className="meal-placeholder" role="img" aria-label={fallback}><span aria-hidden="true">◡</span><small>{fallback}</small></div>;
}

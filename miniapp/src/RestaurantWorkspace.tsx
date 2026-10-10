import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { Dictionary } from '../../src/i18n/vi';
import { decodePickupQr } from '../../src/lib/pickupQr';
import { pickupDeadline } from '../../src/lib/reservations';
import { safetyDeadline, type HandlingClass } from '../../src/lib/safety';
import type { Listing, PartnerOrder } from '../../src/lib/types';
import * as api from './client';
import { Icon } from './Icon';
import { requestId } from './pending';
import { pendingStorage, scanPickup } from './platform';
import { clearPendingListing, listingInput, readPendingListing, savePendingListing, vietnamTimeInput,
  type ListingDraft, type PendingListing } from './restaurant';

const freshDraft = (): ListingDraft => ({ title: '', description: '', portions: '1', price: '', originalPrice: '',
  handling: 'hot', preparedAt: vietnamTimeInput(new Date()),
  pickupUntil: vietnamTimeInput(safetyDeadline(new Date(), 'hot')), vegetarian: false, allergens: '', photoUrl: '' });

export function RestaurantWorkspace({ account, t, locale, onMarketplace, onRefresh }: {
  account: api.Account; t: Dictionary; locale: 'vi' | 'en'; onMarketplace: () => void; onRefresh: () => Promise<void>;
}) {
  const [restaurantId, setRestaurantId] = useState(account.restaurants[0]?.id ?? '');
  const restaurant = account.restaurants.find(value => value.id === restaurantId);
  const [tab, setTab] = useState<keyof Dictionary['partner']['tabs']>('today');
  const [listings, setListings] = useState<Listing[]>([]);
  const [orders, setOrders] = useState<PartnerOrder[]>([]);
  const [draft, setDraft] = useState(freshDraft);
  const [pending, setPending] = useState<PendingListing | null>(null);
  const [code, setCode] = useState('');
  const [orderId, setOrderId] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [now, setNow] = useState(new Date());
  const version = useRef(0);
  const time = (value: Date | string) => new Intl.DateTimeFormat(locale === 'vi' ? 'vi-VN' : 'en-GB',
    { timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
  const money = (value: number) => new Intl.NumberFormat(locale === 'vi' ? 'vi-VN' : 'en-US',
    { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(value);
  const failure = (cause: unknown) => {
    const message = cause instanceof Error ? cause.message : '';
    return message.includes('prepared_in_future') ? t.partner.rejectedFuture
      : message.includes('past_safety_deadline') || message.includes('window_entirely_in_the_past') ? t.partner.rejectedTooOld
      : message.includes('window_ends_before_it_starts') ? t.partner.rejectedWindow
      : message === 'invalid_photo' ? t.partner.invalidPhoto : message === 'invalid_listing' ? t.partner.invalidListing
      : message.includes('pickup_expired') || message.includes('past_pickup_window') ? t.partner.pickupExpired
      : message.includes('pickup_not_started') ? t.partner.pickupNotStarted
      : message.includes('restaurant_unavailable') || message.includes('not_staff') ? t.partner.pickupUnavailable
      : message.includes('ambiguous_code') ? t.partner.ambiguousCode
      : message.includes('code_not_found') ? t.partner.wrongCode : t.common.errorBody;
  };
  async function load() {
    if (!restaurant) return;
    const current = ++version.current;
    setLoading(true);
    try {
      const [meals, waiting] = await Promise.all([api.partnerListings(restaurant.id), api.partnerOrders(restaurant.id)]);
      if (current === version.current) { setListings(meals); setOrders(waiting); }
    } catch (cause) { if (current === version.current) setError(failure(cause)); }
    finally { if (current === version.current) setLoading(false); }
  }
  useEffect(() => {
    setListings([]); setOrders([]); setCode(''); setOrderId(undefined); setError(''); setSuccess('');
    setDraft(freshDraft()); setPending(null);
    try {
      const saved = readPendingListing(pendingStorage, account.id, restaurantId);
      setPending(saved); if (saved) { setDraft(saved.draft); setTab('new'); }
    } catch { setError(t.common.errorBody); }
    void load();
    return () => { version.current++; };
  }, [restaurantId]);
  useEffect(() => { if (!restaurant && account.restaurants[0]) setRestaurantId(account.restaurants[0].id); }, [account.restaurants]);
  useEffect(() => { const timer = setInterval(() => setNow(new Date()), 15000); return () => clearInterval(timer); }, []);
  async function publish(event: FormEvent) {
    event.preventDefault();
    if (!restaurant || busy) return;
    setBusy(true); setError(''); setSuccess('');
    try {
      let value = pending;
      if (!value) {
        const id = requestId();
        listingInput(draft, restaurant.id, id);
        value = { id, ownerId: account.id, restaurantId: restaurant.id, draft };
        savePendingListing(pendingStorage, value);
        setPending(value);
      }
      await api.publish(value.draft, restaurant, value.id);
      clearPendingListing(pendingStorage, account.id, restaurant.id);
      setPending(null); setDraft(freshDraft()); setSuccess(t.partner.published); setTab('today'); await load();
    } catch (cause) {
      if (cause instanceof api.ApiError && cause.definite) {
        try { clearPendingListing(pendingStorage, account.id, restaurant.id); setPending(null); }
        catch { /* Keep the same request if device storage is unavailable. */ }
      }
      setError(failure(cause));
    }
    finally { setBusy(false); }
  }
  async function scan() {
    if (!restaurant || busy) return;
    setBusy(true); setError(''); setSuccess(''); setCode(''); setOrderId(undefined);
    try {
      const pass = decodePickupQr(await scanPickup());
      if (!pass) setError(t.partner.invalidQr);
      else if (pass.restaurantId !== restaurant.id) setError(t.partner.wrongRestaurantQr);
      else { setCode(pass.code); setOrderId(pass.orderId); }
    } catch { setError(t.partner.invalidQr); }
    finally { setBusy(false); }
  }
  async function collect(event: FormEvent) {
    event.preventDefault();
    if (!restaurant || busy) return;
    setBusy(true); setError(''); setSuccess('');
    try {
      await api.collect(restaurant.id, code, orderId);
      setCode(''); setOrderId(undefined); setSuccess(t.partner.verifiedGeneric);
    } catch (cause) { setError(failure(cause)); }
    finally { await load(); setBusy(false); }
  }
  const prepared = new Date(`${draft.preparedAt}:00+07:00`);
  const deadline = Number.isFinite(+prepared) ? safetyDeadline(prepared, draft.handling) : null;
  const live = listings.filter(value => +pickupDeadline(value) > +now);
  const handlingLabels: Record<HandlingClass, string> = { hot: t.partner.handlingHot, chilled: t.partner.handlingChilled,
    ambient: t.partner.handlingAmbient, shelf_stable: t.partner.handlingShelfStable };
  const field = (key: keyof ListingDraft, value: string | boolean) => setDraft(current => ({ ...current, [key]: value }));

  return <>
    <button className="back" onClick={onMarketplace}><Icon name="back" />{t.restaurantPortal.marketplace}</button>
    <div className="page-heading"><p className="eyebrow">{t.restaurantPortal.title}</p><h1>{t.restaurantPortal.workspace}</h1></div>
    {error && <p className="error" role="alert">{error}</p>}
    {success && <p className="success" role="status">{success}</p>}
    {!restaurant ? <section className="card"><h2>{t.restaurantPortal.restrictedTitle}</h2><p>{t.restaurantPortal.restrictedBody}</p>
      <p>{t.partner.accountReference}</p><code className="order-ref">{account.id}</code>
      <button className="full" disabled={busy} onClick={async () => { setBusy(true); try { await onRefresh(); } catch { setError(t.common.errorBody); } finally { setBusy(false); } }}>{t.partner.accessRefresh}</button>
    </section> : <>
      <section className="card venue-card"><label>{t.partner.restaurant}<select value={restaurantId} disabled={busy}
        onChange={event => setRestaurantId(event.target.value)}>{account.restaurants.map(value => <option key={value.id} value={value.id}>{value.name}</option>)}</select></label>
        <p>{restaurant.address}</p></section>
      {restaurant.status !== 'approved' ? <p className="error">{t.partner.approvalRequired}</p> : <>
        <div className="segments partner-tabs" aria-label={t.restaurantPortal.workspace}>{(Object.keys(t.partner.tabs) as (keyof typeof t.partner.tabs)[]).map(value =>
          <button key={value} aria-pressed={tab === value} disabled={busy} onClick={() => { setTab(value); setError(''); setSuccess(''); }}>{t.partner.tabs[value]}</button>)}</div>
        {(tab === 'today' || tab === 'orders') && <button className="full" disabled={loading || busy} onClick={() => { setError(''); void load(); }}>{loading ? t.common.loading : t.zalo.refresh}</button>}
        {tab === 'today' && <section><h2>{t.partner.liveListings}</h2>{!loading && !live.length && <p className="muted">{t.partner.noListings}</p>}
          {live.map(value => <article className="card partner-item" key={value.id}><h3>{value.title}</h3>
            <p>{t.discover.portionsLeft.replace('{n}', String(value.portions_left))} · {money(value.price_vnd)}</p>
            <p>{t.zalo.pickupAt.replace('{time}', time(pickupDeadline(value)))}</p></article>)}</section>}
        {tab === 'new' && <form className="card listing-form" onSubmit={event => void publish(event)}>
          <h2>{t.partner.newListing}</h2>{pending && <p className="muted" role="status">{t.partner.publishPending}</p>}
          <fieldset disabled={busy || !!pending}>
            <label>{t.partner.dish}<input required maxLength={160} value={draft.title} onChange={event => field('title', event.target.value)} placeholder={t.partner.dishPlaceholder} /></label>
            <label>{t.offer.contents}<textarea value={draft.description} onChange={event => field('description', event.target.value)} /></label>
            <div className="form-row"><label>{t.partner.portions}<input required inputMode="numeric" type="number" min="1" step="1" value={draft.portions} onChange={event => field('portions', event.target.value)} /></label>
              <label>{t.partner.price}<input required inputMode="numeric" type="number" min="0" step="1" value={draft.price} onChange={event => field('price', event.target.value)} /></label></div>
            <label>{t.partner.originalPrice} · {t.partner.optional}<input inputMode="numeric" type="number" min={draft.price || '0'} step="1" value={draft.originalPrice} onChange={event => field('originalPrice', event.target.value)} /></label>
            <label>{t.partner.handling}<select value={draft.handling} onChange={event => field('handling', event.target.value)}>{(Object.keys(handlingLabels) as HandlingClass[]).map(value => <option key={value} value={value}>{handlingLabels[value]}</option>)}</select></label>
            <p className="muted">{t.partner.vietnamTime}</p>
            <label>{t.partner.preparedAt}<input required type="datetime-local" value={draft.preparedAt} onChange={event => field('preparedAt', event.target.value)} /></label>
            <label>{t.partner.pickupUntil}<input required type="datetime-local" value={draft.pickupUntil} onChange={event => field('pickupUntil', event.target.value)} /></label>
            {deadline && <p className="muted">{t.partner.computedDeadline.replace('{time}', time(deadline))}<br />{t.partner.computedDeadlineHint}</p>}
            <label className="checkbox-label"><input type="checkbox" checked={draft.vegetarian} onChange={event => field('vegetarian', event.target.checked)} />{t.offer.vegetarian}</label>
            <label>{t.offer.allergens}<input value={draft.allergens} onChange={event => field('allergens', event.target.value)} /><small>{t.partner.allergenHint}</small></label>
            <label>{t.partner.photoUrl} · {t.partner.optional}<input type="url" value={draft.photoUrl} onChange={event => field('photoUrl', event.target.value)} /></label>
          </fieldset><button className="primary" disabled={busy}>{busy ? t.partner.publishing : pending ? t.partner.publishRetry : t.partner.publish}</button>
        </form>}
        {tab === 'orders' && <section><h2>{t.partner.ordersTitle}</h2>{!loading && !orders.length && <p className="muted">{t.partner.noOrders}</p>}
          {orders.map(value => <article className="card partner-item" key={value.id}><h3>{value.listing_title}</h3>
            <p>{t.offer.portions.replace('{n}', String(value.portions))} · {money(value.price_paid_vnd)}</p>
            <p>{value.payment_method === 'credit' ? t.reserve.credit : t.reserve.cash}</p><code className="order-ref">{value.id}</code>
            <button disabled={busy} onClick={() => { setTab('verify'); setCode(value.pickup_code); setOrderId(value.id); setError(''); setSuccess(''); }}>{t.partner.verifyTitle}</button></article>)}</section>}
        {tab === 'verify' && <form className="card listing-form" onSubmit={event => void collect(event)}><h2>{t.partner.verifyTitle}</h2>
          <p>{t.partner.scanHint}</p><button type="button" onClick={() => void scan()} disabled={busy}><Icon name="qr" />{t.partner.scanInstead}</button>
          <label>{t.partner.enterCode}<input required inputMode="numeric" autoComplete="off" pattern="[0-9]{4}" maxLength={4} value={code} disabled={busy}
            onChange={event => { setCode(event.target.value.replace(/\D/g, '')); setOrderId(undefined); }} /></label>
          {orderId && <code className="order-ref">{orderId}</code>}
          <button className="primary" disabled={busy || !/^\d{4}$/.test(code)}>{busy ? t.common.loading : t.partner.confirmPickup}</button>
        </form>}
      </>}
    </>}
  </>;
}

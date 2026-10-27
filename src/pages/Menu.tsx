import { ProductImage } from '../components/ProductImage';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowUpRight, Check, Clock, Plus, Search, ShoppingBag, Trash2 } from 'lucide-react';
import { useClock, useMenu } from '../hooks';
import { api, errorMessage } from '../lib';
import {
  isOpen,
  sydneyParts,
  money,
  priceLine,
  isProductInWindow,
  matchesMenuFilter,
} from '../../shared/domain';
import {
  orderInputSchema,
  lineSchema,
  type CartLine,
  type OrderInput,
  type Product,
} from '../../shared/model';
import ProductEditor from '../components/ProductEditor';
import { ErrorNotice, Modal } from '../components/Modal';
const CART = 'bc-cart-v1',
  PENDING = 'bc-pending-v1';
function readCart(): CartLine[] {
  try {
    return lineSchema.array().parse(JSON.parse(localStorage.getItem(CART) ?? '[]'));
  } catch {
    return [];
  }
}
function sessionStart() {
  const old = Number(sessionStorage.getItem('bc-session'));
  const now = Date.now();
  if (old && now - old < 23 * 3600000) return old;
  sessionStorage.setItem('bc-session', String(now));
  return now;
}
export default function Menu() {
  const { products, categories, settings, error, loading } = useMenu();
  const now = useClock(),
    navigate = useNavigate();
  const [search, setSearch] = useState(''),
    [category, setCategory] = useState('all'),
    [cart, setCartState] = useState<CartLine[]>(readCart),
    [editing, setEditing] = useState<{ product: Product; index?: number } | null>(null),
    [cartOpen, setCartOpen] = useState(false),
    [review, setReview] = useState(false),
    [busy, setBusy] = useState(false),
    [submitError, setSubmitError] = useState('');
  const [pending, setPending] = useState<OrderInput | null>(() => {
    try {
      const raw = JSON.parse(localStorage.getItem(PENDING) ?? 'null');
      return raw ? orderInputSchema.parse(raw) : null;
    } catch {
      return null;
    }
  });
  const params = new URLSearchParams(location.search);
  const [draft] = useState<Partial<OrderInput>>(() => {
    try {
      return JSON.parse(sessionStorage.getItem('bc-checkout') ?? '{}');
    } catch {
      return {};
    }
  });
  const restored = pending ?? draft;
  const [orderType, setOrderType] = useState<'Dine-in' | 'Takeaway'>(
      restored.orderType ?? 'Dine-in',
    ),
    [table, setTable] = useState(
      pending?.tableNumber ??
        params.get('table')?.match(/^\d{1,3}$/)?.[0] ??
        draft.tableNumber ??
        '',
    ),
    [name, setName] = useState(restored.customerName ?? ''),
    [instructions, setInstructions] = useState(restored.specialInstructions ?? ''),
    [first, setFirst] = useState(
      restored.isFirstVisit == null ? '' : restored.isFirstVisit ? 'yes' : 'no',
    ),
    [student, setStudent] = useState(
      restored.isUsydStudent == null ? '' : restored.isUsydStudent ? 'yes' : 'no',
    );
  useEffect(() => {
    sessionStorage.setItem(
      'bc-checkout',
      JSON.stringify({
        orderType,
        tableNumber: table,
        customerName: name,
        specialInstructions: instructions,
        isFirstVisit: first === '' ? null : first === 'yes',
        isUsydStudent: student === '' ? null : student === 'yes',
      }),
    );
  }, [orderType, table, name, instructions, first, student]);
  const [started] = useState(sessionStart);
  const open = !!settings && isOpen(settings, now);
  const todayHours = settings?.hours.find((h) => h.day === sydneyParts(now).day);
  const visibleCategories = categories.filter(
    (c) =>
      !c.seasonal ||
      products.some(
        (p) => p.categoryId === c.id && p.status !== 'Hidden' && isProductInWindow(p, now),
      ),
  );
  const filters = [
    { id: 'all', name: 'All' },
    ...visibleCategories,
    { id: 'vegetarian', name: 'Vegetarian' },
    { id: 'under-ten', name: 'Under $10' },
    { id: 'popular', name: 'Popular' },
  ];
  const filteredProducts = products.filter(
    (p) =>
      visibleCategories.some((c) => c.id === p.categoryId) &&
      matchesMenuFilter(p, category, search, now),
  );
  function setCart(next: CartLine[]) {
    setCartState(next);
    localStorage.setItem(CART, JSON.stringify(next));
    setReview(false);
  }
  const priced = cart.map((line) => {
    try {
      const p = products.find((p) => p.id === line.productId);
      return p ? priceLine(line, p) : null;
    } catch {
      return null;
    }
  });
  const valid = priced.every(Boolean);
  const total = priced.reduce((n, l) => n + (l?.lineTotal ?? 0), 0);
  const count = cart.reduce((n, l) => n + l.quantity, 0);
  async function submit() {
    setBusy(true);
    setSubmitError('');
    const payload = pending ?? {
      items: cart,
      orderType,
      ...(orderType === 'Dine-in' ? { tableNumber: table } : { customerName: name }),
      source: params.get('source') === 'qr' ? ('qr' as const) : ('direct' as const),
      isFirstVisit: first === '' ? null : first === 'yes',
      isUsydStudent: student === '' ? null : student === 'yes',
      specialInstructions: instructions,
      sessionStartedAt: started,
      idempotencyKey: crypto.randomUUID(),
    };
    localStorage.setItem(PENDING, JSON.stringify(payload));
    setPending(payload);
    try {
      const result = await api<{ publicToken: string; orderNumber: string }>('order', payload);
      localStorage.removeItem(PENDING);
      sessionStorage.removeItem('bc-checkout');
      setPending(null);
      setCart([]);
      localStorage.setItem('bc-last-order', result.publicToken);
      navigate(`/track/${result.publicToken}`);
    } catch (e) {
      setSubmitError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <header className="site-header">
        <Link to="/order" className="wordmark">
          <span className="cherry-mark">
            ●<span>●</span>
          </span>
          <span>
            black cherry<small>CAFÉ · SYDNEY</small>
          </span>
        </Link>
        <nav>
          <span className="header-note">Good coffee. Your way.</span>
          <Link className="subtle-link" to="/staff">
            Our team <ArrowUpRight size={14} />
          </Link>
          <button
            className="bag-button"
            onClick={() => setCartOpen(true)}
            aria-label={`Open cart, ${count} items`}
          >
            <ShoppingBag size={19} />
            <b>{count}</b>
          </button>
        </nav>
      </header>
      <main className="menu-layout">
        <aside className="menu-sidebar">
          <p className="eyebrow">YOUR DAILY PAUSE</p>
          <h2>
            A seat.
            <br />A sip.
            <br />
            Something good.
          </h2>
          <div className={`open-state ${open ? '' : 'closed'}`}>
            <i />
            {open ? 'Open for orders' : 'Orders paused'}
          </div>
          {todayHours && (
            <p className="business-hours">
              Today · {todayHours.closed ? 'Closed' : `${todayHours.open}–${todayHours.close}`}
              <br />
              <small>Sydney time</small>
            </p>
          )}
          <p className="muted small">
            Made with care,
            <br />
            right here in Sydney.
          </p>
          <div className="side-line" />
          <p className="eyebrow">EXPLORE THE MENU</p>
          <div className="categories">
            {filters.map((c) => (
              <button
                key={c.id}
                onClick={() => setCategory(c.id)}
                className={category === c.id ? 'active' : ''}
              >
                {c.name}
                <span>↗</span>
              </button>
            ))}
          </div>
          <div className="sidebar-bottom">
            <span>01 / ORDER</span>
            <p>Scan. Sip. Stay a while.</p>
            <small>Pay at the counter. No account needed.</small>
          </div>
        </aside>
        <div className="menu-main">
          <section className="hero">
            <div className="hero-copy">
              <p className="eyebrow">THE NEIGHBOURHOOD COFFEE RITUAL</p>
              <h1>
                Your usual.
                <br />
                Or a <em>new favourite.</em>
              </h1>
              <p>
                Small moments, made better.
                <br />
                Find your cup of happy.
              </p>
              <span className="hero-pill">
                <Clock size={15} />
                {settings?.waitMinutes ?? '—'} min estimated wait
              </span>
            </div>
            <img
              src="/menu-items/latte-960.webp"
              alt="Original hand-drawn latte sticker"
              width="960"
              height="720"
            />
            <span className="hero-stamp">
              BREWED
              <br />
              WITH LOVE
              <br />
              <span>✳</span>
            </span>
          </section>
          {settings?.announcement && (
            <div className="announcement">
              <span>✦</span>
              {settings.announcement}
            </div>
          )}
          <ErrorNotice message={error} />
          {pending && (
            <div className="notice">
              We’re checking your order. Continue to see whether it was received.
              <button
                onClick={() => {
                  setCartOpen(true);
                  setReview(true);
                }}
              >
                Continue your order
              </button>
            </div>
          )}
          <section className="menu-section">
            <div className="section-head">
              <div>
                <p className="eyebrow">FRESHLY MADE, JUST FOR YOU</p>
                <h2>
                  {category === 'all'
                    ? 'On the menu'
                    : filters.find((c) => c.id === category)?.name}
                </h2>
              </div>
              <label className="search">
                <Search size={18} />
                <input
                  aria-label="Search menu"
                  placeholder="Find your favourite…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </label>
            </div>
            {loading ? (
              <p role="status">Getting the good stuff ready…</p>
            ) : (
              <div className="product-grid">
                {filteredProducts.map((p) => (
                  <article className="product-card" key={p.id}>
                    <button
                      className="product-image-button"
                      aria-label={`Customize ${p.name}`}
                      disabled={p.status !== 'Available' || !!pending}
                      onClick={() => setEditing({ product: p })}
                    >
                      <ProductImage product={p} />
                      <div className="card-tags">
                        {p.tags
                          .filter((t) =>
                            ['New', 'Limited', 'Seasonal', 'Popular', 'Recommended'].includes(t),
                          )
                          .map((t) => (
                            <span
                              key={t}
                              className={`tag ${t === 'New' || t === 'Limited' ? 'new' : ''}`}
                            >
                              {t === 'Recommended' ? 'POPULAR' : t.toUpperCase()}
                            </span>
                          ))}
                      </div>
                      {p.status === 'Sold Out' && <span className="sold-out">SOLD OUT</span>}
                    </button>
                    <div className="product-info">
                      <h3>{p.name}</h3>
                      <p>{p.description}</p>
                      <div className="dietary-tags">
                        {p.dietaryTags?.map((t) => (
                          <span key={t}>{t === 'Vegetarian' ? 'VEGETARIAN' : t}</span>
                        ))}
                      </div>
                      <div>
                        <span className="price">
                          {money(p.basePrice)}
                          <small> / from</small>
                        </span>
                        <button
                          className="add-button"
                          aria-label={`Add ${p.name}`}
                          disabled={p.status !== 'Available' || !!pending}
                          onClick={() => setEditing({ product: p })}
                        >
                          <Plus size={16} />
                          <span>Add to Order</span>
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
            {!loading && filteredProducts.length === 0 && (
              <p className="muted">No matching items. Try a different search.</p>
            )}
          </section>
          <footer className="menu-footer">
            <span>BLACK CHERRY CAFÉ</span>
            <span>A little local love in every cup.</span>
            <small>Prices in AUD</small>
          </footer>
        </div>
      </main>
      {count > 0 && (
        <button className="floating-cart" onClick={() => setCartOpen(true)}>
          <ShoppingBag size={19} />
          <span>
            View your order <b>{count}</b>
          </span>
          <strong>{money(total)}</strong>
        </button>
      )}
      {localStorage.getItem('bc-last-order') && (
        <Link className="last-order" to={`/track/${localStorage.getItem('bc-last-order')}`}>
          Track latest order ↗
        </Link>
      )}
      {editing && (
        <ProductEditor
          product={editing.product}
          initial={editing.index !== undefined ? cart[editing.index] : undefined}
          onClose={() => setEditing(null)}
          onSave={(line) => {
            const updated = [...cart];
            if (editing.index !== undefined) updated[editing.index] = line;
            else updated.push(line);
            setCart(updated);
            setEditing(null);
          }}
        />
      )}
      {cartOpen && !editing && (
        <Modal
          title={review ? 'Check your order' : 'Your order'}
          onClose={() => setCartOpen(false)}
        >
          {cart.length === 0 && !pending ? (
            <p>Your next favourite is waiting on the menu.</p>
          ) : (
            <>
              <div className="cart-lines">
                {cart.map((l, i) => {
                  const p = products.find((x) => x.id === l.productId);
                  return (
                    <div key={i} className="cart-line">
                      <div>
                        <h3>{p?.name ?? 'Unavailable item'}</h3>
                        <p>
                          {priced[i]?.options
                            .map((o) => `${o.name}${o.price ? ' +' + money(o.price) : ''}`)
                            .join(' · ')}
                        </p>
                        <small>
                          Base {money(p?.basePrice ?? 0)}
                          {l.instructions && ` · ${l.instructions}`}
                        </small>
                        {!review && !pending && (
                          <div className="cart-actions">
                            <label>
                              Qty
                              <input
                                aria-label={`Quantity ${p?.name}`}
                                type="number"
                                min="1"
                                max="20"
                                value={l.quantity}
                                onChange={(e) =>
                                  setCart(
                                    cart.map((v, j) =>
                                      j === i
                                        ? {
                                            ...v,
                                            quantity: Math.max(
                                              1,
                                              Math.min(20, Number(e.target.value)),
                                            ),
                                          }
                                        : v,
                                    ),
                                  )
                                }
                              />
                            </label>
                            <button
                              disabled={!p}
                              onClick={() => p && setEditing({ product: p, index: i })}
                            >
                              Edit
                            </button>
                            <button
                              aria-label={`Remove ${p?.name}`}
                              onClick={() => setCart(cart.filter((_, j) => j !== i))}
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        )}
                      </div>
                      <strong>{priced[i] ? money(priced[i]!.lineTotal) : 'Unavailable'}</strong>
                    </div>
                  );
                })}
              </div>
              <div className="total-row">
                <span>Total estimate</span>
                <strong>{money(total)}</strong>
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (review || pending) void submit();
                  else setReview(true);
                }}
              >
                <fieldset disabled={review || !!pending}>
                  <legend>Make yourself comfortable</legend>
                  <div className="choices">
                    {(['Dine-in', 'Takeaway'] as const).map((type) => (
                      <label
                        key={type}
                        className={`choice ${orderType === type ? 'selected' : ''}`}
                      >
                        <input
                          type="radio"
                          name="orderType"
                          value={type}
                          checked={orderType === type}
                          onChange={() => setOrderType(type)}
                        />
                        {type}
                      </label>
                    ))}
                  </div>
                  {orderType === 'Dine-in' ? (
                    <label>
                      Table number
                      <input
                        value={table}
                        required
                        pattern="[0-9]{1,3}"
                        onChange={(e) => setTable(e.target.value)}
                        placeholder="e.g. 3"
                      />
                    </label>
                  ) : (
                    <label>
                      Pickup name
                      <input
                        value={name}
                        maxLength={40}
                        required
                        onChange={(e) => setName(e.target.value)}
                        placeholder="First name or nickname"
                        autoComplete="given-name"
                      />
                    </label>
                  )}
                  <label>
                    Order notes
                    <textarea
                      value={instructions}
                      maxLength={500}
                      onChange={(e) => setInstructions(e.target.value)}
                    />
                  </label>
                  <div className="form-grid">
                    <label>
                      First visit? (optional)
                      <select value={first} onChange={(e) => setFirst(e.target.value)}>
                        <option value="">Prefer not to say</option>
                        <option value="yes">Yes</option>
                        <option value="no">No</option>
                      </select>
                    </label>
                    <label>
                      USYD student? (optional)
                      <select value={student} onChange={(e) => setStudent(e.target.value)}>
                        <option value="">Prefer not to say</option>
                        <option value="yes">Yes</option>
                        <option value="no">No</option>
                      </select>
                    </label>
                  </div>
                </fieldset>
                <div className="payment-note">
                  <Check size={18} />
                  <div>
                    <strong>Pay at Counter</strong>
                    <p>Please pay our team at the counter after placing your order.</p>
                  </div>
                </div>
                {review && (
                  <p>
                    Confirm your items and collection details. We’ll check availability when you
                    place your order.
                  </p>
                )}
                <ErrorNotice message={submitError} />
                {!valid && !pending && (
                  <ErrorNotice message="An item or option is no longer available. Edit or remove it before submitting." />
                )}
                {!open && <p className="notice">Online orders are currently paused.</p>}
                <button className="primary full" disabled={busy || (!pending && (!open || !valid))}>
                  {busy
                    ? 'Submitting…'
                    : pending
                      ? 'Try again'
                      : review
                        ? 'Confirm & place order'
                        : 'Review order'}
                </button>
                {review && !pending && (
                  <button type="button" className="text-button" onClick={() => setReview(false)}>
                    Back to edit
                  </button>
                )}
                {pending && (
                  <p className="small muted">
                    Your order is saved. You can safely try again. If an item is unavailable,{' '}
                    <button
                      type="button"
                      className="text-button"
                      onClick={() => {
                        if (
                          confirm(
                            'Only start over if the error clearly rejected your order. For a connection error, retry first to avoid a duplicate.',
                          )
                        ) {
                          localStorage.removeItem(PENDING);
                          setPending(null);
                          setReview(false);
                        }
                      }}
                    >
                      unlock the cart
                    </button>
                    .
                  </p>
                )}
              </form>
            </>
          )}
        </Modal>
      )}
    </>
  );
}

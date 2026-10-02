import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ChangeEvent, type FormEvent, type MouseEvent, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { supabase, type Product, type CartItem, type Order } from '@/lib/supabase';
import NotFound from '@/pages/not-found';
import { Link, Route, Switch, useLocation, useParams, Router as WouterRouter } from 'wouter';
import { ArrowLeft, ArrowRight, Check, CircleAlert, Instagram, Leaf, LoaderCircle, LockKeyhole, Menu, Minus, Plus, ShoppingBag, Sparkles, X } from 'lucide-react';
import type { Session } from '@supabase/supabase-js';

const queryClient = new QueryClient();
const guestCartKey = 'pariallon-guest-cart';
const heroFallback = `${import.meta.env.BASE_URL}pariallon-hero.jpg`;
const money = (amount: number) => `₦${Number(amount || 0).toLocaleString('en-NG')}`;
const freeDeliveryThreshold = 75000;
const standardDelivery = 3500;
const deliveryFee = (subtotal: number) => subtotal > freeDeliveryThreshold ? 0 : standardDelivery;
const readGuestCart = (): CartItem[] => {
  try { return JSON.parse(localStorage.getItem(guestCartKey) || '[]') as CartItem[]; } catch { return []; }
};

type StoreContextValue = {
  products: Product[]; productsLoading: boolean; productError: string;
  cart: CartItem[]; session: Session | null; cartLoading: boolean;
  authReady: boolean;
  addToCart: (productId: string, quantity?: number) => void;
  setQuantity: (productId: string, quantity: number) => void;
  removeFromCart: (productId: string) => void;
  cartProducts: { product: Product; quantity: number }[];
  retryProducts: () => void;
};
const StoreContext = createContext<StoreContextValue | null>(null);
const useStore = () => {
  const value = useContext(StoreContext);
  if (!value) throw new Error('Store context is missing');
  return value;
};

function App() {
  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [productError, setProductError] = useState('');
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [cart, setCart] = useState<CartItem[]>(readGuestCart);
  const [cartLoading, setCartLoading] = useState(true);
  const [cartReadyUserId, setCartReadyUserId] = useState<string | null>(null);
  const [location] = useLocation();

  const loadProducts = useCallback(async () => {
    setProductsLoading(true); setProductError('');
    const { data, error } = await supabase.from('products').select('*').order('created_at', { ascending: false });
    if (error) setProductError('We couldn’t load the collection just now.');
    else setProducts((data || []) as Product[]);
    setProductsLoading(false);
  }, []);

  useEffect(() => { void loadProducts(); }, [loadProducts]);

  useEffect(() => {
    let alive = true;
    supabase.auth.getSession().then(({ data }) => { if (alive) { setSession(data.session); setAuthReady(true); } });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setAuthReady(true);
    });
    return () => { alive = false; listener.subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!session?.user) {
      setCart(readGuestCart());
      setCartLoading(false);
      setCartReadyUserId(null);
      return;
    }
    let alive = true;
    setCartLoading(true);
    void (async () => {
      const guestItems = readGuestCart();
      const { data, error } = await supabase.from('carts').select('items').eq('user_id', session.user.id).maybeSingle();
      if (!alive) return;
      if (error) {
        console.error('Could not load the saved cart.');
        setCart(guestItems);
        setCartLoading(false);
        return;
      }
      const signedItems = (data?.items || []) as CartItem[];
      const merged = new Map<string, number>();
      signedItems.forEach((item) => merged.set(item.product_id, (merged.get(item.product_id) || 0) + item.quantity));
      guestItems.forEach((item) => merged.set(item.product_id, (merged.get(item.product_id) || 0) + item.quantity));
      const nextCart = Array.from(merged, ([product_id, quantity]) => ({ product_id, quantity }));
      setCart(nextCart);
      localStorage.removeItem(guestCartKey);
      if (guestItems.length) {
        const { error: saveError } = await supabase.from('carts').upsert({ user_id: session.user.id, items: nextCart }, { onConflict: 'user_id' });
        if (saveError) console.error('Could not merge saved cart.');
      }
      setCartReadyUserId(session.user.id);
      setCartLoading(false);
    })();
    return () => { alive = false; };
  }, [session?.user?.id]);

  useEffect(() => {
    if (!session?.user) localStorage.setItem(guestCartKey, JSON.stringify(cart));
    else if (!cartLoading && cartReadyUserId === session.user.id) {
      void supabase.from('carts').upsert({ user_id: session.user.id, items: cart }, { onConflict: 'user_id' });
    }
  }, [cart, session?.user?.id, cartLoading, cartReadyUserId]);

  const addToCart = useCallback((productId: string, quantity = 1) => setCart((current) => {
    const existing = current.find((item) => item.product_id === productId);
    return existing
      ? current.map((item) => item.product_id === productId ? { ...item, quantity: item.quantity + quantity } : item)
      : [...current, { product_id: productId, quantity }];
  }), []);
  const setQuantity = useCallback((productId: string, quantity: number) => setCart((current) =>
    productId === '__clear_all__' ? [] : quantity <= 0 ? current.filter((item) => item.product_id !== productId) : current.map((item) => item.product_id === productId ? { ...item, quantity } : item)
  ), []);
  const removeFromCart = useCallback((productId: string) => setCart((current) => current.filter((item) => item.product_id !== productId)), []);
  const cartProducts = useMemo(() => cart.flatMap((item) => {
    const product = products.find((candidate) => candidate.id === item.product_id);
    return product ? [{ product, quantity: item.quantity }] : [];
  }), [cart, products]);
  const value = { products, productsLoading, productError, cart, session, cartLoading, authReady, addToCart, setQuantity, removeFromCart, cartProducts, retryProducts: loadProducts };

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <StoreContext.Provider value={value}>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
            <div className="app-shell">
              <Header />
              <main className="main-shell">
                <RoutedErrorBoundary resetKey={location}>
                  <Switch>
                    <Route path="/" component={Home} />
                    <Route path="/product/:slug" component={ProductPage} />
                    <Route path="/cart" component={CartPage} />
                    <Route path="/checkout" component={CheckoutPage} />
                    <Route path="/sign-in" component={SignInPage} />
                    <Route path="/orders/:id" component={OrderPage} />
                    <Route component={NotFound} />
                  </Switch>
                </RoutedErrorBoundary>
              </main>
              <Footer />
              <Toaster />
            </div>
          </WouterRouter>
        </StoreContext.Provider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

function RoutedErrorBoundary({ children, resetKey }: { children: ReactNode; resetKey: string }) {
  return <ErrorBoundary resetKey={resetKey}>{children}</ErrorBoundary>;
}

function Header() {
  const { session, cart } = useStore();
  const [menuOpen, setMenuOpen] = useState(false);
  const count = cart.reduce((total, item) => total + item.quantity, 0);
  return <>
    <div className="announcement">Made for the way we live here <span>—</span> free delivery on orders over ₦75,000</div>
    <header className="site-header">
      <button className="menu-toggle icon-button" aria-label="Open menu" data-testid="button-open-menu" onClick={() => setMenuOpen((open) => !open)}>{menuOpen ? <X /> : <Menu />}</button>
      <nav className={`nav-links ${menuOpen ? 'nav-open' : ''}`}>
        <Link href="/" onClick={() => setMenuOpen(false)}>Shop all</Link>
        <a href="/#story" onClick={() => setMenuOpen(false)}>Our point of view</a>
        <a href="/#journal" onClick={() => setMenuOpen(false)}>Notes from home</a>
      </nav>
      <Link href="/" className="wordmark" aria-label="Pariallon home"><span>pariallon</span><small>PA · LAGOS</small></Link>
      <div className="header-actions">
        <Link href={session ? '/' : '/sign-in'} className="account-link" data-testid="link-account">{session ? 'Account' : 'Sign in'}</Link>
        <Link href="/cart" className="bag-link" data-testid="link-cart"><ShoppingBag size={19} strokeWidth={1.5} /><span>Bag</span><sup>{count}</sup></Link>
      </div>
    </header>
  </>;
}

function Footer() {
  return <footer className="site-footer">
    <div className="footer-top">
      <div><Link href="/" className="footer-mark serif">A home, more you.</Link><p>Useful things, chosen slowly.<br />Made to live with, wherever home is.</p></div>
      <div className="footer-col"><span className="eyebrow">Find your way</span><Link href="/">Shop the collection</Link><Link href="/cart">Your bag</Link><Link href="/sign-in">Your account</Link></div>
      <div className="footer-col"><span className="eyebrow">A little note</span><span>Questions, thoughts, or just hello?</span><a href="mailto:hello@pariallon.com">hello@pariallon.com</a><span className="social"><Instagram size={16} /> @pariallon.home</span></div>
    </div>
      <div className="footer-bottom"><span>© {new Date().getFullYear()} Pariallon PA</span><span>Considered goods for everyday living</span><span>Lagos, Nigeria</span></div>
  </footer>;
}

function Home() {
  const { products, productsLoading, productError, retryProducts } = useStore();
  const [category, setCategory] = useState('Everything');
  const categories = useMemo(() => ['Everything', ...Array.from(new Set(products.map((product) => product.category).filter(Boolean)))], [products]);
  const filtered = category === 'Everything' ? products : products.filter((product) => product.category === category);
  const featured = products.filter((product) => product.is_featured);
  const displayProducts = category === 'Everything' && featured.length ? [...featured, ...products.filter((product) => !product.is_featured)] : filtered;
  return <div className="page-in">
    <section className="hero">
      <div className="hero-photo" style={{ backgroundImage: `url("${heroFallback}")` }} />
      <div className="hero-copy">
        <span className="eyebrow light">THE PARIALLON EDIT · NO. 01</span>
        <h1 className="serif">A softer kind<br />of <em>everyday.</em></h1>
        <p>Well-made things for all the little rituals that make a place feel like yours.</p>
        <a className="button button-light" href="#collection">Find your something <ArrowRight size={16} /></a>
        <div className="hero-caption"><span>01 / A slower way to live</span><span>Objects for a life well lived</span></div>
      </div>
      <div className="hero-side-note">PARIALLON · LAGOS · EST. 2024</div>
    </section>
    <section className="intro-band" id="story">
      <span className="intro-mark">PA</span>
      <div><span className="eyebrow">THE THINGS WE KEEP</span><p>Home isn’t a look. It’s the cup you reach for, the light at the end of the day, the things that quietly become <em>yours.</em></p></div>
      <span className="intro-aside">A considered collection<br />for everyday life.</span>
    </section>
    <section className="collection section-wrap" id="collection">
      <div className="section-heading">
        <div><span className="eyebrow">A SMALL, GOOD PLACE TO START</span><h2 className="serif">Objects for <em>everyday.</em></h2></div>
        <span className="collection-count">{products.length.toString().padStart(2, '0')} things, picked with care</span>
      </div>
      <div className="filter-row" aria-label="Product categories">
        <div className="category-list">{categories.map((item) => <button key={item} className={`filter-button ${category === item ? 'filter-active' : ''}`} onClick={() => setCategory(item)} data-testid={`filter-category-${item.toLowerCase().replace(/\s+/g, '-')}`}>{item}</button>)}</div>
        <span className="filter-note"><span className="green-dot" /> Ships from Lagos</span>
      </div>
      {productsLoading ? <ProductSkeleton /> : productError ? <div className="state-panel"><CircleAlert /><h3>Our shelves are taking a moment.</h3><p>{productError}</p><button className="text-action" onClick={retryProducts}>Try again <ArrowRight size={15} /></button></div> :
        displayProducts.length ? <div className="product-grid">{displayProducts.map((product, index) => <ProductCard key={product.id} product={product} index={index} />)}</div> :
          <div className="state-panel"><ShoppingBag /><h3>A little room for what’s next.</h3><p>There’s nothing on this shelf yet. Check back soon.</p></div>}
    </section>
    <section className="manifesto">
      <div className="manifesto-image"><img src={heroFallback} alt="Sunlight across a thoughtful home interior" /></div>
      <div className="manifesto-copy"><span className="eyebrow">OUR POINT OF VIEW</span><h2 className="serif">Less, but with<br /><em>more meaning.</em></h2><p>We believe the best things don’t ask for attention. They earn a place in your home through use, through time, through the small joy of reaching for them again.</p><a className="text-action" href="#journal">A note on how we choose <ArrowRight size={15} /></a></div>
      <div className="manifesto-stamp">PA<br /><span>GOOD THINGS<br />TO LIVE WITH</span></div>
    </section>
    <section className="promise-row">
      <div><span className="promise-icon"><Leaf size={19} /></span><span className="eyebrow">MADE TO LAST</span><p>Materials with a little more life in them.</p></div>
      <div><span className="promise-icon"><Sparkles size={19} /></span><span className="eyebrow">CHOSEN SLOWLY</span><p>Every piece has a reason to be here.</p></div>
      <div><span className="promise-icon"><ArrowRight size={19} /></span><span className="eyebrow">FROM LAGOS, WITH CARE</span><p>Thoughtful delivery, close to home.</p></div>
    </section>
    <section className="journal-strip" id="journal"><div><span className="eyebrow">NOTES FROM HOME · VOL. 01</span><h2 className="serif">A home takes its time.</h2><p>We’re gathering thoughts on the rituals, places, and objects that make a home feel lived in.</p></div><span className="journal-label">COMING INTO FOCUS <span>—</span> SOON</span></section>
  </div>;
}

function ProductCard({ product, index }: { product: Product; index: number }) {
  const { addToCart } = useStore();
  const [added, setAdded] = useState(false);
  const add = (event: MouseEvent) => {
    event.preventDefault(); event.stopPropagation();
    addToCart(product.id); setAdded(true); window.setTimeout(() => setAdded(false), 1600);
  };
  return <article className={`product-card product-card-${index % 4}`} data-testid={`card-product-${product.id}`}>
    <Link href={`/product/${product.slug}`} className="product-link">
      <div className="product-image image-zoom"><img src={product.image_url || heroFallback} alt={product.name} loading={index > 3 ? 'lazy' : 'eager'} /><span className="product-tag">{product.is_featured ? 'A Pariallon favourite' : product.category}</span><span className="quick-add" aria-hidden="true"><ArrowRight size={17} /></span></div>
      <div className="product-info"><div><span className="product-category">{product.category}</span><h3>{product.name}</h3></div><span className="product-price">{money(product.price_naira)}</span></div>
    </Link>
    <button className={`add-inline ${added ? 'added' : ''}`} onClick={add} disabled={product.stock_quantity <= 0} data-testid={`button-add-${product.id}`}>{product.stock_quantity <= 0 ? 'Currently unavailable' : added ? <><Check size={14} /> Added to your bag</> : <><Plus size={14} /> Add to bag</>}</button>
  </article>;
}

function ProductSkeleton() {
  return <div className="product-grid" aria-label="Loading collection">{[0, 1, 2, 3].map((item) => <div className="skeleton-card" key={item}><div className="skeleton-image" /><div className="skeleton-line" /><div className="skeleton-line short" /></div>)}</div>;
}

function ProductPage() {
  const { slug } = useParams<{ slug: string }>();
  const { products, productsLoading, addToCart } = useStore();
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const product = products.find((item) => item.slug === slug);
  if (productsLoading) return <div className="detail-loading page-in"><div className="skeleton-image" /><div><div className="skeleton-line" /><div className="skeleton-line short" /></div></div>;
  if (!product) return <div className="state-panel page-in"><CircleAlert /><h3>We couldn’t find that one.</h3><p>This piece may have found its home.</p><Link className="text-action" href="/">Back to the collection <ArrowRight size={15} /></Link></div>;
  const add = () => { addToCart(product.id, quantity); setAdded(true); window.setTimeout(() => setAdded(false), 1700); };
  return <div className="product-detail page-in">
    <Link href="/" className="back-link"><ArrowLeft size={15} /> Back to the collection</Link>
    <div className="detail-grid">
      <div className="detail-image image-zoom"><img src={product.image_url || heroFallback} alt={product.name} /><span className="detail-image-label">PARIALLON · OBJECT STUDY</span></div>
      <div className="detail-copy"><span className="eyebrow">{product.category}</span><h1 className="serif">{product.name}</h1><div className="detail-price">{money(product.price_naira)}</div><div className="detail-rule" /><p className="detail-description">{product.description}</p>
        <div className="stock-note"><span className={product.stock_quantity > 0 ? 'green-dot' : 'red-dot'} />{product.stock_quantity > 0 ? `${product.stock_quantity} available` : 'Currently out of stock'}</div>
        <div className="buy-row"><div className="quantity-control"><button aria-label="Decrease quantity" onClick={() => setQuantity((n) => Math.max(1, n - 1))}><Minus size={14} /></button><span>{quantity}</span><button aria-label="Increase quantity" onClick={() => setQuantity((n) => Math.min(product.stock_quantity || 1, n + 1))}><Plus size={14} /></button></div><button className="button button-dark add-detail" disabled={!product.stock_quantity} onClick={add} data-testid="button-add-to-bag">{added ? <><Check size={16} /> In your bag</> : <>Add to bag <ArrowRight size={16} /></>}</button></div>
        <div className="detail-assurance"><span><Check size={14} /> Made for everyday use</span><span><Check size={14} /> Delivery from Lagos</span></div>
        <div className="detail-note"><span className="eyebrow">A THOUGHTFUL THING</span><p>Chosen for how it feels to live with, not just how it looks on a shelf.</p></div>
      </div>
    </div>
  </div>;
}

function CartPage() {
  const { cartProducts, setQuantity, removeFromCart, cartLoading } = useStore();
  const [, setLocation] = useLocation();
  const subtotal = cartProducts.reduce((sum, item) => sum + item.product.price_naira * item.quantity, 0);
  const shipping = deliveryFee(subtotal);
  if (cartLoading) return <section className="cart-page page-in"><h1 className="serif">Your bag</h1><div className="skeleton-image cart-skeleton" /></section>;
  if (!cartProducts.length) return <section className="empty-cart page-in"><div className="empty-mark"><ShoppingBag size={26} /></div><span className="eyebrow">NOTHING JUST YET</span><h1 className="serif">Room for something good.</h1><p>Your bag is waiting for the things you’ll reach for every day.</p><Link className="button button-dark" href="/">Explore the collection <ArrowRight size={16} /></Link></section>;
  return <section className="cart-page page-in">
    <div className="page-heading"><span className="eyebrow">A GOOD PLACE TO BEGIN</span><h1 className="serif">Your bag <span>({cartProducts.reduce((sum, item) => sum + item.quantity, 0)})</span></h1></div>
    <div className="cart-layout"><div className="cart-items">
      {cartProducts.map(({ product, quantity }) => <div className="cart-item" key={product.id} data-testid={`cart-item-${product.id}`}>
        <Link className="cart-thumb image-zoom" href={`/product/${product.slug}`}><img src={product.image_url || heroFallback} alt={product.name} /></Link>
        <div className="cart-item-copy"><span className="product-category">{product.category}</span><Link href={`/product/${product.slug}`} className="cart-item-name">{product.name}</Link><span className="cart-item-price">{money(product.price_naira)}</span><button className="remove-link" onClick={() => removeFromCart(product.id)} data-testid={`button-remove-${product.id}`}>Remove</button></div>
        <div className="quantity-control cart-quantity"><button aria-label={`Decrease ${product.name} quantity`} onClick={() => setQuantity(product.id, quantity - 1)}><Minus size={14} /></button><span>{quantity}</span><button aria-label={`Increase ${product.name} quantity`} onClick={() => setQuantity(product.id, Math.min(product.stock_quantity || quantity + 1, quantity + 1))}><Plus size={14} /></button></div>
        <span className="cart-line-total">{money(product.price_naira * quantity)}</span>
      </div>)}
      <Link href="/" className="continue-link"><ArrowLeft size={15} /> Keep looking</Link>
    </div>
     <aside className="order-summary"><span className="eyebrow">THE SHORT VERSION</span><h2 className="serif">A few good things.</h2><div className="summary-row"><span>Subtotal</span><span>{money(subtotal)}</span></div><div className="summary-row"><span>Delivery</span><span className="delivery-detail">{shipping === 0 ? 'Complimentary' : money(shipping)}</span></div><div className="summary-total"><span>Total</span><span>{money(subtotal + shipping)}</span></div><button className="button button-dark summary-button" onClick={() => setLocation('/checkout')} data-testid="button-checkout">Continue to delivery <ArrowRight size={16} /></button><p className="payment-note"><LockKeyhole size={14} /> No payment is taken here. We’ll confirm your order first.</p></aside></div>
  </section>;
}

function CheckoutPage() {
  const { session, cart, cartProducts, cartLoading, authReady } = useStore();
  const [, setLocation] = useLocation();
  const [form, setForm] = useState({ customerName: '', email: '', phone: '', address: '', city: '', state: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!session?.user) return;
    const metadata = session.user.user_metadata as { full_name?: string; name?: string } | undefined;
    setForm((current) => ({
      ...current,
      customerName: current.customerName || metadata?.full_name || metadata?.name || '',
      email: session.user.email || current.email,
    }));
  }, [session?.user?.id, session?.user?.email]);
  if (!session && authReady && !cartLoading) return <section className="checkout-auth page-in"><div className="empty-mark"><LockKeyhole size={25} /></div><span className="eyebrow">ONE QUICK STEP</span><h1 className="serif">Sign in to place<br />your order.</h1><p>Your bag will be waiting here when you come back.</p><Link href="/sign-in" className="button button-dark">Continue with Google <ArrowRight size={16} /></Link><Link href="/cart" className="text-action">Back to your bag</Link></section>;
  const subtotal = cartProducts.reduce((sum, item) => sum + item.product.price_naira * item.quantity, 0);
  const shipping = deliveryFee(subtotal);
  const update = (key: keyof typeof form) => (event: ChangeEvent<HTMLInputElement>) => setForm((current) => ({ ...current, [key]: event.target.value }));
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!session) return;
    setError('');
    if (!cart.length) { setError('Your bag is empty. Add something before placing an order.'); return; }
    setSubmitting(true);
    const { data, error: orderError } = await supabase.rpc('place_order', {
      p_customer_name: form.customerName.trim(), p_email: form.email.trim(), p_phone: form.phone.trim(),
      p_address_line1: form.address.trim(), p_city: form.city.trim(), p_state: form.state.trim(), p_items: cart,
    });
    if (orderError || !data) { setError(orderError?.message || 'We couldn’t place your order. Please try again.'); setSubmitting(false); return; }
    try {
      const { error: mailError } = await supabase.functions.invoke('order-confirmation', { body: { orderId: data } });
      if (mailError) sessionStorage.setItem(`pariallon-mail-${data}`, 'delivery-trouble');
    } catch {
      sessionStorage.setItem(`pariallon-mail-${data}`, 'delivery-trouble');
    }
    setLocation(`/orders/${data}`);
    setSubmitting(false);
  };
  const field = (label: string, key: keyof typeof form, placeholder: string, type = 'text') => <label className="form-field" key={key}><span>{label}</span><input required type={type} value={form[key]} onChange={update(key)} placeholder={placeholder} readOnly={key === 'email'} data-testid={`input-${key}`} /></label>;
  return <section className="checkout-page page-in">
    <Link href="/cart" className="back-link"><ArrowLeft size={15} /> Back to your bag</Link>
    <div className="page-heading"><span className="eyebrow">THE LAST LITTLE DETAILS</span><h1 className="serif">Delivery, then <em>home.</em></h1></div>
    <div className="checkout-layout"><form className="delivery-form" onSubmit={submit}>
      <div className="form-section-title"><span className="step-number">01</span><div><h2>Where should we bring it?</h2><p>We’ll use these details to get your things to you.</p></div></div>
      <div className="form-grid">{field('Full name', 'customerName', 'Your name')}{field('Email address', 'email', 'you@example.com', 'email')}{field('Phone number', 'phone', '+234 800 000 0000', 'tel')}{field('Street address', 'address', 'House number and street')}<div className="form-grid nested">{field('City', 'city', 'Lagos')}{field('State', 'state', 'Lagos State')}</div></div>
      {error && <div className="form-error"><CircleAlert size={16} />{error}</div>}
      <button className="button button-dark place-order" type="submit" disabled={submitting || cartLoading} data-testid="button-place-order">{submitting ? <><LoaderCircle className="spin" size={16} /> Placing your order…</> : <>Place order <ArrowRight size={16} /></>}</button>
      <p className="no-payment"><LockKeyhole size={14} /> This places an order only. No online payment is taken.</p>
    </form>
      <aside className="checkout-summary"><span className="eyebrow">YOUR THINGS</span><h2 className="serif">A small collection.</h2>{cartProducts.map(({ product, quantity }) => <div className="checkout-line" key={product.id}><div className="checkout-thumb"><img src={product.image_url || heroFallback} alt={product.name} /><span>{quantity}</span></div><span>{product.name}</span><strong>{money(product.price_naira * quantity)}</strong></div>)}<div className="summary-row"><span>Subtotal</span><span>{money(subtotal)}</span></div><div className="summary-row"><span>Delivery</span><span>{shipping === 0 ? 'Complimentary' : money(shipping)}</span></div><div className="summary-total"><span>Order total</span><span>{money(subtotal + shipping)}</span></div><p className="payment-note">{shipping === 0 ? 'Complimentary delivery on orders over ₦75,000.' : `Add ${money(freeDeliveryThreshold + 1 - subtotal)} more for free delivery.`}</p></aside></div>
  </section>;
}

function SignInPage() {
  const { session } = useStore();
  const [, setLocation] = useLocation();
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { if (session) setLocation('/'); }, [session, setLocation]);
  const signIn = async () => {
    setWorking(true); setError('');
    const { error: authError } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin + import.meta.env.BASE_URL } });
    if (authError) { setError('We couldn’t open Google sign-in. Please try again.'); setWorking(false); }
  };
  return <section className="signin-page page-in">
    <div className="signin-art"><img src={heroFallback} alt="Sunlit home, a quieter moment" /><div className="signin-art-caption"><span className="eyebrow light">PARIALLON · PA</span><p className="serif">Come back to<br /><em>your kind of home.</em></p></div></div>
    <div className="signin-content"><span className="eyebrow">A PLACE FOR YOUR THINGS</span><h1 className="serif">Welcome<br />back <em>home.</em></h1><p>Sign in to keep your bag close, and make the things you love yours.</p>
      <button className="google-button" onClick={signIn} disabled={working} data-testid="button-google-sign-in">{working ? <LoaderCircle className="spin" size={18} /> : <GoogleMark />}<span>{working ? 'Opening Google…' : 'Continue with Google'}</span><ArrowRight size={16} /></button>
      {error && <div className="form-error"><CircleAlert size={16} />{error}</div>}
      <span className="signin-footnote"><LockKeyhole size={13} /> Your account details stay yours. Always.</span>
      <Link href="/" className="text-action sign-back"><ArrowLeft size={15} /> Back to the collection</Link>
    </div>
  </section>;
}

function GoogleMark() {
  return <span className="google-mark" aria-hidden="true">G</span>;
}

function OrderPage() {
  const { id } = useParams<{ id: string }>();
  const { setQuantity } = useStore();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [emailTrouble, setEmailTrouble] = useState(false);
  useEffect(() => {
    let alive = true;
    void (async () => {
      const { data, error: fetchError } = await supabase.from('orders').select('*').eq('id', id).maybeSingle();
      if (!alive) return;
      if (fetchError || !data) setError(true);
      else {
        setOrder(data as Order);
        setQuantity('__clear_all__', 0);
      }
      setEmailTrouble(sessionStorage.getItem(`pariallon-mail-${id}`) === 'delivery-trouble');
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [id, setQuantity]);
  if (loading) return <div className="order-loading page-in"><div className="skeleton-image" /><div className="skeleton-line" /></div>;
  if (error || !order) return <div className="state-panel page-in"><CircleAlert /><h3>We couldn’t find that order.</h3><p>Try returning to your bag or get in touch if you need a hand.</p><Link href="/" className="text-action">Back to Pariallon <ArrowRight size={15} /></Link></div>;
  const parts = (order.items || []) as Order['items'];
  return <section className="order-page page-in">
    <div className="confirmation-top"><span className="confirmation-check"><Check size={25} /></span><span className="eyebrow">ORDER RECEIVED · {order.id.slice(0, 8).toUpperCase()}</span><h1 className="serif">A good thing<br /><em>is on its way.</em></h1><p>Thank you, {order.customer_name.split(' ')[0]}. Your order is in our hands now.</p></div>
    {emailTrouble && <div className="email-note"><CircleAlert size={16} /><span>Your order is still placed. We couldn’t send the confirmation email just now, but you can find all the details below.</span></div>}
    <div className="order-details-grid"><div className="ordered-things"><span className="eyebrow">WHAT YOU CHOSE</span>{parts.map((item) => <div className="ordered-item" key={item.product_id}><div className="checkout-thumb"><img src={item.image_url || heroFallback} alt={item.name} /><span>{item.quantity}</span></div><span>{item.name}</span><strong>{money(item.subtotal_naira)}</strong></div>)}<div className="summary-row"><span>Subtotal</span><span>{money(order.subtotal_naira)}</span></div><div className="summary-row"><span>Delivery</span><span>{order.shipping_naira === 0 ? 'Complimentary' : money(order.shipping_naira)}</span></div><div className="summary-total"><span>Order total</span><span>{money(order.total_naira)}</span></div></div>
      <div className="delivery-card"><span className="eyebrow">COMING HOME TO</span><strong>{order.customer_name}</strong><p>{order.address_line1}<br />{order.city}, {order.state}<br />{order.phone}</p><div className="detail-rule" /><span className="eyebrow">ORDER STATUS</span><span className="status-pill">{order.status}</span><p className="status-note">We’ll be in touch at <strong>{order.email}</strong> with any updates.</p><p className="payment-note"><LockKeyhole size={14} /> No payment has been taken online.</p></div>
    </div>
    <Link className="button button-dark order-back" href="/">Back to the collection <ArrowRight size={16} /></Link>
  </section>;
}

export default App;
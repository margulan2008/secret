// auth.js — client-side authorization, cart and last-viewed persistence
// Uses Web Crypto (SHA-256) for password hashing (not a substitute for a server-side auth)

const Auth = (() => {
  const USERS_KEY = 'app_users_v1';
  const CURRENT_KEY = 'auth_current_v1';

  function _loadUsers(){
    try{ return JSON.parse(localStorage.getItem(USERS_KEY) || '{}'); }
    catch(e){ return {}; }
  }
  function _saveUsers(obj){ localStorage.setItem(USERS_KEY, JSON.stringify(obj)); }

  function _userCartKey(email){ return `cart:${email}`; }
  function _userViewedKey(email){ return `viewed:${email}`; }

  function _randomSalt(){
    const a = new Uint8Array(16);
    crypto.getRandomValues(a);
    return Array.from(a).map(b => b.toString(16).padStart(2,'0')).join('');
  }

  async function _hash(password, salt){
    const enc = new TextEncoder();
    const data = enc.encode(salt + password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2,'0')).join('');
  }

  function _getCurrentEmail(){
    return localStorage.getItem(CURRENT_KEY);
  }

  function onAuthChange(cb){
    window.addEventListener('authchange', e => cb(e.detail && e.detail.user));
  }

  function _emitAuth(user){
    const ev = new CustomEvent('authchange', { detail: { user } });
    window.dispatchEvent(ev);
  }

  async function createUser(email, password){
    if(!email || !password) throw new Error('Email және пароль қажет');
    email = String(email).trim().toLowerCase();
    const users = _loadUsers();
    if(users[email]) throw new Error('Пайдаланушы бар');
    const salt = _randomSalt();
    const hash = await _hash(password, salt);
    users[email] = { salt, hash, createdAt: Date.now() };
    _saveUsers(users);
    return true;
  }

  async function signIn(email, password){
    email = String(email || '').trim().toLowerCase();
    const users = _loadUsers();
    const entry = users[email];
    if(!entry) throw new Error('Пайдаланушы табылмады');
    const candidate = await _hash(password, entry.salt);
    if(candidate !== entry.hash) throw new Error('Қате пароль');
    // success
    localStorage.setItem(CURRENT_KEY, email);
    _emitAuth(email);
    return email;
  }

  function signOut(){
    localStorage.removeItem(CURRENT_KEY);
    _emitAuth(null);
  }

  function getCurrentUser(){
    return _getCurrentEmail();
  }

  // Cart APIs
  function _loadCart(email){
    try{ return JSON.parse(localStorage.getItem(_userCartKey(email)) || '[]'); } catch(e){ return []; }
  }
  function _saveCart(email, arr){ localStorage.setItem(_userCartKey(email), JSON.stringify(arr)); }

  function addToCart(product){
    const email = _getCurrentEmail();
    if(!email) throw new Error('User not signed in');
    if(!product || !product.id) throw new Error('Product must have id');
    const cart = _loadCart(email);
    const idx = cart.findIndex(it => it.id === product.id);
    if(idx >= 0){ cart[idx].qty = (cart[idx].qty || 1) + (product.qty || 1); }
    else { cart.push(Object.assign({ qty: product.qty || 1 }, product)); }
    _saveCart(email, cart);
    // emit event
    window.dispatchEvent(new CustomEvent('cartchange', { detail: { user: email, cart } }));
    return cart;
  }

  function getCart(){
    const email = _getCurrentEmail();
    if(!email) return [];
    return _loadCart(email);
  }

  function setCart(items){
    const email = _getCurrentEmail();
    if(!email) throw new Error('User not signed in');
    _saveCart(email, items || []);
    window.dispatchEvent(new CustomEvent('cartchange', { detail: { user: email, cart: items } }));
  }

  // Viewed APIs (keep last N)
  function _loadViewed(email){
    try{ return JSON.parse(localStorage.getItem(_userViewedKey(email)) || '[]'); } catch(e){ return []; }
  }
  function _saveViewed(email, arr){ localStorage.setItem(_userViewedKey(email), JSON.stringify(arr)); }

  function markViewed(product){
    const email = _getCurrentEmail();
    if(!email) throw new Error('User not signed in');
    if(!product || !product.id) throw new Error('Product must have id');
    const max = 20;
    let arr = _loadViewed(email);
    // remove existing
    arr = arr.filter(it => it.id !== product.id);
    // add to front
    arr.unshift(Object.assign({ viewedAt: Date.now() }, product));
    if(arr.length > max) arr = arr.slice(0, max);
    _saveViewed(email, arr);
    window.dispatchEvent(new CustomEvent('viewedchange', { detail: { user: email, viewed: arr } }));
    return arr;
  }

  function getViewed(){
    const email = _getCurrentEmail();
    if(!email) return [];
    return _loadViewed(email);
  }

  // utility: migrate cart from guest session to user after sign-up/sign-in
  function migrateGuestCartToUser(email){
    try{
      const guest = JSON.parse(localStorage.getItem('cart:guest') || '[]');
      if(!guest || !guest.length) return;
      const existing = _loadCart(email);
      // merge by id
      guest.forEach(g => {
        const idx = existing.findIndex(it => it.id === g.id);
        if(idx >= 0) existing[idx].qty = (existing[idx].qty || 1) + (g.qty || 1);
        else existing.push(g);
      });
      _saveCart(email, existing);
      localStorage.removeItem('cart:guest');
    } catch(e){ /* ignore */ }
  }

  // Public API
  return {
    createUser,
    signIn,
    signOut,
    getCurrentUser,
    onAuthChange,
    addToCart,
    getCart,
    setCart,
    markViewed,
    getViewed,
    migrateGuestCartToUser
  };
})();

// expose to window
window.Auth = Auth;

// small helper: if user signs in elsewhere, reflect in UI by emitting authchange
window.addEventListener('storage', e => {
  if(e.key && e.key.startsWith('auth_current')){
    const user = localStorage.getItem('auth_current_v1');
    window.dispatchEvent(new CustomEvent('authchange', { detail: { user } }));
  }
});

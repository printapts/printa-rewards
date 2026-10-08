/* One selected customer for the website and its same-origin game. */
window.PrintaCustomer = (() => {
  const key = 'printa_customer_phone';
  const valid = phone => /^01\d{9}$/.test(phone || '');
  function get() {
    try {
      const phone = sessionStorage.getItem(key);
      if (valid(phone)) return phone;
      const round = JSON.parse(sessionStorage.getItem('printa_server_round') || 'null');
      return valid(round?.phone) ? round.phone : '';
    } catch { return ''; }
  }
  function select(phone) {
    if (!valid(phone)) return;
    try {
      const round = JSON.parse(sessionStorage.getItem('printa_server_round') || 'null');
      if (round && round.phone !== phone) {
        sessionStorage.removeItem('printa_server_round');
        sessionStorage.removeItem('printa_pending_spin');
      }
      sessionStorage.setItem(key, phone);
    } catch { /* The current page remains usable without storage. */ }
    if (window.parent !== window) window.parent.postMessage({type:'printa-customer-selected',phone},location.origin);
  }
  return {get, select};
})();

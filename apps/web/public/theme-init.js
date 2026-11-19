// Apply the saved theme before first paint (kept as a file so the CSP needs no 'unsafe-inline').
try {
  var p = localStorage.getItem('classquest.theme');
  var dark = p === 'dark' || (p !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
} catch (e) {
  /* storage unavailable */
}

// Live search filter
const searchBox  = document.getElementById('searchBox');
const grid       = document.getElementById('cardsGrid');
const noResults  = document.getElementById('noResults');
const noTerm     = document.getElementById('noResultsTerm');

if (searchBox && grid) {
  searchBox.addEventListener('input', () => {
    const q     = searchBox.value.trim().toLowerCase();
    const cards = grid.querySelectorAll('.card');
    let   vis   = 0;

    cards.forEach(card => {
      const match = !q
        || card.dataset.name.includes(q)
        || (card.dataset.desc || '').includes(q);
      card.hidden = !match;
      if (match) vis++;
    });

    if (noResults) {
      noResults.hidden = vis > 0 || !q;
      if (noTerm) noTerm.textContent = searchBox.value.trim();
    }
  });
}

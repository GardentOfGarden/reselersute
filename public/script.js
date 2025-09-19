const menuItems = document.querySelectorAll('.sidebar .menu li');
const sections = document.querySelectorAll('.section');

menuItems.forEach(item => {
  item.addEventListener('click', () => {
    menuItems.forEach(i => i.classList.remove('active'));
    sections.forEach(s => s.classList.remove('active'));
    item.classList.add('active');
    document.getElementById(item.dataset.section).classList.add('active');
  });
});

// Generate key
document.getElementById('keyForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const duration = document.getElementById('duration').value;
  const unit = document.getElementById('unit').value;

  try {
    const res = await fetch('/api/keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ days: convertToDays(duration, unit) })
    });
    const data = await res.json();
    document.getElementById('generatedKey').textContent = `Key: ${data.value}`;
    loadHistory();
  } catch (err) {
    console.error(err);
    alert('Error generating key!');
  }
});

// Convert input to days
function convertToDays(value, unit) {
  value = Number(value);
  switch(unit) {
    case 'seconds': return value / 86400;
    case 'minutes': return value / 1440;
    case 'hours': return value / 24;
    case 'days': return value;
    case 'weeks': return value * 7;
    case 'months': return value * 30;
    case 'years': return value * 365;
  }
}

// Load history
async function loadHistory() {
  try {
    const res = await fetch('/api/keys');
    const keys = await res.json();
    const tbody = document.querySelector('#keyHistory tbody');
    tbody.innerHTML = '';
    keys.forEach(k => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${k.value}</td>
        <td>${k.expiresAt ? k.expiresAt : 'Permanent'}</td>
        <td>${k.banned ? 'Banned' : 'Active'}</td>
        <td>${new Date(k.createdAt || Date.now()).toLocaleString()}</td>
      `;
      tbody.appendChild(tr);
    });
  } catch(err) {
    console.error(err);
  }
}

// Initial load
loadHistory();

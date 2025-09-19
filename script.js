let token = null;

async function login() {
  const password = document.getElementById("password").value;

  const res = await fetch("/api/admin/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password })
  });

  const data = await res.json();
  if (data.success) {
    token = data.token;
    document.getElementById("loginBox").style.display = "none";
    document.getElementById("adminPanel").style.display = "block";
    loadKeys();
  } else {
    document.getElementById("loginStatus").innerText = "Неверный пароль!";
  }
}

async function generateKey() {
  const res = await fetch("/api/keys", {
    method: "POST",
    headers: { 
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}` 
    },
    body: JSON.stringify({ days: 7 })
  });
  const key = await res.json();
  alert("Создан ключ: " + key.value);
  loadKeys();
}

async function loadKeys() {
  const res = await fetch("/api/keys");
  const keys = await res.json();
  const list = document.getElementById("keysList");
  list.innerHTML = keys.map(k => `<p>${k.value} (бан: ${k.banned})</p>`).join("");
}

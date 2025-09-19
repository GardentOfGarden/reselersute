const loginDiv = document.getElementById("login");
const panelDiv = document.getElementById("panel");
const loginBtn = document.getElementById("loginBtn");
const passwordInput = document.getElementById("password");
const loginMsg = document.getElementById("loginMsg");

loginBtn.onclick = async () => {
  const password = passwordInput.value;
  const res = await fetch("/api/admin-login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password })
  });
  const data = await res.json();
  if (data.success) {
    loginDiv.style.display = "none";
    panelDiv.style.display = "block";
    loadKeys();
  } else {
    loginMsg.textContent = "Wrong password!";
  }
};

// Создание нового ключа
document.getElementById("createKeyBtn").onclick = async () => {
  const days = document.getElementById("days").value;
  const res = await fetch("/api/keys", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ days: days ? Number(days) : null })
  });
  const data = await res.json();
  document.getElementById("newKey").textContent = `Key: ${data.value}`;
  loadKeys();
};

// Загрузка всех ключей
async function loadKeys() {
  const res = await fetch("/api/keys");
  const keys = await res.json();
  const ul = document.getElementById("keys");
  ul.innerHTML = "";
  keys.forEach(k => {
    const li = document.createElement("li");
    li.textContent = `${k.value} ${k.banned ? "(Banned)" : ""} ${k.expiresAt ? "- Expires: " + new Date(k.expiresAt).toLocaleDateString() : ""}`;
    ul.appendChild(li);
  });
}

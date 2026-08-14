async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    credentials: "same-origin"
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || "Ошибка запроса.");
  }

  return data;
}

function showAuthMessage(text, type = "error") {
  const el = document.getElementById("message");
  if (!el) return;
  el.textContent = text;
  el.className = "message " + type;
}

async function registerUser() {
  const username = document.getElementById("username")?.value.trim();
  const email = document.getElementById("email")?.value.trim();
  const password = document.getElementById("password")?.value;
  const passwordConfirm = document.getElementById("passwordConfirm")?.value;
  const terms = document.getElementById("terms")?.checked;

  if (!username || !email || !password || !passwordConfirm) {
    showAuthMessage("Заполните все поля.");
    return;
  }

  if (password !== passwordConfirm) {
    showAuthMessage("Пароли не совпадают.");
    return;
  }

  if (!terms) {
    showAuthMessage("Примите условия использования.");
    return;
  }

  const button = document.getElementById("registerButton");
  if (button) {
    button.disabled = true;
    button.textContent = "Создание аккаунта...";
  }

  try {
    await api("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ username, email, password })
    });

    showAuthMessage("Аккаунт создан. Перенаправляем на вход...", "success");

    setTimeout(() => {
      window.location.href = "login.html?registered=1";
    }, 700);
  } catch (error) {
    showAuthMessage(error.message);
    if (button) {
      button.disabled = false;
      button.textContent = "Создать аккаунт";
    }
  }
}

async function loginUser() {
  const login = document.getElementById("login")?.value.trim();
  const password = document.getElementById("password")?.value;

  if (!login || !password) {
    showAuthMessage("Введите логин и пароль.");
    return;
  }

  const button = document.getElementById("loginButton");
  if (button) {
    button.disabled = true;
    button.textContent = "Выполняется вход...";
  }

  try {
    await api("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ login, password })
    });

    window.location.href = "cabinet.html";
  } catch (error) {
    showAuthMessage(error.message);
    if (button) {
      button.disabled = false;
      button.textContent = "Войти";
    }
  }
}

async function loadCabinet() {
  try {
    const data = await api("/api/auth/me");

    const name = document.getElementById("profileName");
    const email = document.getElementById("profileEmail");
    const avatar = document.getElementById("avatar");

    if (name) name.textContent = data.user.username;
    if (email) email.textContent = data.user.email;
    if (avatar) avatar.textContent = data.user.username.charAt(0).toUpperCase();
  } catch {
    window.location.href = "login.html";
  }
}

async function logout() {
  try {
    await api("/api/auth/logout", { method: "POST" });
  } finally {
    window.location.href = "index.html";
  }
}

document.addEventListener("DOMContentLoaded", () => {
  if (document.body.dataset.page === "cabinet") {
    loadCabinet();
  }

  const params = new URLSearchParams(location.search);
  if (params.get("registered") === "1") {
    showAuthMessage("Аккаунт создан. Теперь войдите.", "success");
  }
});

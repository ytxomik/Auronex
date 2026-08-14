async function api(path, options = {}) {
  const response = await fetch(path, {
    method: options.method || "GET",
    body: options.body,
    credentials: "include",
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {})
    }
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || `Ошибка запроса (${response.status})`);
  }

  return data;
}


function showAuthMessage(text, type = "error") {
  const el = document.getElementById("message");

  if (!el) return;

  el.textContent = text;
  el.className = "message " + type;
}


/* =========================
   РЕГИСТРАЦИЯ
========================= */

async function registerUser() {
  const username =
    document.getElementById("username")?.value.trim();

  const email =
    document.getElementById("email")?.value.trim();

  const password =
    document.getElementById("password")?.value;

  const passwordConfirm =
    document.getElementById("passwordConfirm")?.value;

  const terms =
    document.getElementById("terms")?.checked;


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


  const button =
    document.getElementById("registerButton");


  if (button) {
    button.disabled = true;
    button.textContent = "Создание аккаунта...";
  }


  try {
    await api("/api/auth/register", {
      method: "POST",

      body: JSON.stringify({
        username,
        email,
        password
      })
    });


    showAuthMessage(
      "Аккаунт создан. Перенаправляем на вход...",
      "success"
    );


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


/* =========================
   ВХОД
========================= */

async function loginUser() {
  const login =
    document.getElementById("login")?.value.trim();

  const password =
    document.getElementById("password")?.value;


  if (!login || !password) {
    showAuthMessage("Введите логин и пароль.");
    return;
  }


  const button =
    document.getElementById("loginButton");


  if (button) {
    button.disabled = true;
    button.textContent = "Выполняется вход...";
  }


  try {

    const data = await api("/api/auth/login", {
      method: "POST",

      body: JSON.stringify({
        login,
        password
      })
    });


    console.log("LOGIN:", data);


    if (!data.ok) {
      throw new Error(
        data.error || "Не удалось войти."
      );
    }


    /*
      Небольшая задержка позволяет браузеру
      сохранить Set-Cookie перед переходом.
    */

    setTimeout(() => {
      window.location.href = "/cabinet.html";
    }, 200);


  } catch (error) {

    console.error("LOGIN ERROR:", error);

    showAuthMessage(error.message);

    if (button) {
      button.disabled = false;
      button.textContent = "Войти";
    }
  }
}


/* =========================
   ПРОВЕРКА АВТОРИЗАЦИИ
========================= */

async function getCurrentUser() {
  return await api("/api/auth/me", {
    method: "GET"
  });
}


/* =========================
   ЛИЧНЫЙ КАБИНЕТ
========================= */

async function loadCabinet() {

  const name =
    document.getElementById("profileName");

  const email =
    document.getElementById("profileEmail");

  const avatar =
    document.getElementById("avatar");


  if (name) {
    name.textContent = "Загрузка...";
  }

  if (email) {
    email.textContent = "Загрузка...";
  }

  if (avatar) {
    avatar.textContent = "A";
  }


  try {

    const data = await getCurrentUser();


    console.log("CURRENT USER:", data);


    if (!data.ok || !data.user) {
      throw new Error(
        data.error || "Пользователь не найден."
      );
    }


    const user = data.user;


    if (name) {
      name.textContent =
        user.username || "Пользователь";
    }


    if (email) {
      email.textContent =
        user.email || "";
    }


    if (avatar) {
      avatar.textContent =
        (user.username || "A")
          .charAt(0)
          .toUpperCase();
    }


    /*
      Если на странице есть блок ошибки,
      скрываем его после успешной загрузки.
    */

    const errorElement =
      document.getElementById("cabinetError");

    if (errorElement) {
      errorElement.style.display = "none";
    }


    const loadingElement =
      document.getElementById("cabinetLoading");

    if (loadingElement) {
      loadingElement.style.display = "none";
    }


  } catch (error) {

    console.error(
      "CABINET ERROR:",
      error
    );


    if (name) {
      name.textContent = "Не авторизован";
    }

    if (email) {
      email.textContent = "";
    }

    if (avatar) {
      avatar.textContent = "?";
    }


    const errorElement =
      document.getElementById("cabinetError");

    if (errorElement) {

      errorElement.textContent =
        error.message || "Ошибка запроса.";

      errorElement.style.display = "block";

    } else {

      /*
        Не отправляем пользователя сразу на login.html.
        Так мы увидим настоящую ошибку.
      */

      showAuthMessage(
        error.message || "Ошибка запроса."
      );
    }
  }
}


/* =========================
   ВЫХОД
========================= */

async function logout() {

  try {

    await api("/api/auth/logout", {
      method: "POST"
    });

  } catch (error) {

    console.error(
      "LOGOUT ERROR:",
      error
    );

  } finally {

    window.location.href =
      "/login.html";
  }
}


/* =========================
   ЗАПУСК
========================= */

document.addEventListener(
  "DOMContentLoaded",
  () => {

    const page =
      document.body?.dataset?.page;


    /*
      Кабинет
    */

    if (page === "cabinet") {
      loadCabinet();
    }


    /*
      Сообщение после регистрации
    */

    const params =
      new URLSearchParams(
        window.location.search
      );


    if (
      params.get("registered") === "1"
    ) {

      showAuthMessage(
        "Аккаунт создан. Теперь войдите.",
        "success"
      );
    }
  }
);


(function () {
    "use strict";

    async function checkAuth() {
        try {
            const response = await fetch("/api/auth/me", {
                method: "GET",
                credentials: "same-origin",
                cache: "no-store"
            });

            if (!response.ok) {
                return null;
            }

            const data = await response.json();

            if (!data.ok || !data.user) {
                return null;
            }

            return data.user;

        } catch (error) {
            console.error("Auth check error:", error);
            return null;
        }
    }


    function updateNavigation(user) {

        /*
         * Ищем стандартные элементы авторизации.
         * Если их нет — ничего не ломаем.
         */

        const loginLinks = document.querySelectorAll(
            'a[href="login.html"]'
        );

        const registerLinks = document.querySelectorAll(
            'a[href="register.html"]'
        );


        if (user) {

            /*
             * Пользователь авторизован.
             *
             * Вход → Кабинет
             * Регистрация → Выйти
             */

            loginLinks.forEach(link => {
                link.href = "cabinet.html";
                link.textContent = "Профиль";
                link.classList.add("auth-profile-link");
            });


            registerLinks.forEach(link => {

                link.href = "#";
                link.textContent = "Выйти";
                link.classList.add("auth-logout-link");

                /*
                 * Не добавляем обработчик повторно.
                 */

                if (link.dataset.authReady === "1") {
                    return;
                }

                link.dataset.authReady = "1";

                link.addEventListener("click", async function (event) {

                    event.preventDefault();

                    link.textContent = "Выход...";

                    try {

                        await fetch("/api/auth/logout", {
                            method: "POST",
                            headers: {
                                "Content-Type": "application/json"
                            },
                            credentials: "same-origin"
                        });

                    } catch (error) {

                        console.error(
                            "Logout error:",
                            error
                        );

                    } finally {

                        window.location.href = "index.html";

                    }

                });

            });

        } else {

            /*
             * Пользователь не авторизован.
             *
             * Возвращаем обычные ссылки.
             */

            loginLinks.forEach(link => {

                link.href = "login.html";
                link.textContent = "Войти";

                link.classList.remove(
                    "auth-profile-link"
                );

            });


            registerLinks.forEach(link => {

                link.href = "register.html";
                link.textContent = "Регистрация";

                link.classList.remove(
                    "auth-logout-link"
                );

            });

        }
    }


    async function initAuthNavigation() {

        const user = await checkAuth();

        updateNavigation(user);

        /*
         * Делаем пользователя доступным
         * для других скриптов сайта.
         */

        window.AuronexAuth = {
            user: user,
            loggedIn: Boolean(user)
        };
    }


    if (document.readyState === "loading") {

        document.addEventListener(
            "DOMContentLoaded",
            initAuthNavigation
        );

    } else {

        initAuthNavigation();

    }

})();


console.log("Auronex v2 loaded");


const registerForm = document.getElementById("registerForm");

if (registerForm) {

    registerForm.addEventListener("submit", function(event) {

        event.preventDefault();

        const username =
            document.getElementById("username").value.trim();

        const email =
            document.getElementById("email").value.trim();

        const password =
            document.getElementById("password").value;

        const passwordConfirm =
            document.getElementById("passwordConfirm").value;

        const message =
            document.getElementById("registerMessage");


        if (password !== passwordConfirm) {

            message.textContent =
                "Пароли не совпадают.";

            return;
        }


        if (password.length < 8) {

            message.textContent =
                "Пароль должен содержать минимум 8 символов.";

            return;
        }


        message.textContent =
            `Форма заполнена. Добро пожаловать, ${username}!`;

        console.log({
            username,
            email
        });

    });

}

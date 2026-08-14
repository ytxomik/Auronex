
import { jwtVerify } from "jose";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);

function getCookie(req, name) {
  const raw = req.headers.cookie || "";

  const part = raw
    .split(";")
    .map(v => v.trim())
    .find(v => v.startsWith(name + "="));

  if (!part) {
    return null;
  }

  return decodeURIComponent(
    part.slice(name.length + 1)
  );
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({
      ok: false,
      error: "Метод не поддерживается."
    });
  }

  try {
    // ==============================
    // 1. Получаем JWT из cookie
    // ==============================

    const token = getCookie(
      req,
      "auronex_session"
    );

    if (!token) {
      return res.status(401).json({
        ok: false,
        error: "Не авторизован."
      });
    }

    // ==============================
    // 2. Проверяем JWT_SECRET
    // ==============================

    if (!process.env.JWT_SECRET) {
      console.error(
        "JWT_SECRET не задан в Environment Variables."
      );

      return res.status(500).json({
        ok: false,
        error: "Ошибка конфигурации сервера."
      });
    }

    const secret = new TextEncoder().encode(
      process.env.JWT_SECRET
    );

    const { payload } = await jwtVerify(
      token,
      secret
    );

    // ==============================
    // 3. Получаем ID пользователя
    // ==============================

    const userId = payload.sub;

    if (!userId) {
      return res.status(401).json({
        ok: false,
        error: "Сессия недействительна."
      });
    }

    // ==============================
    // 4. Получаем пользователя из Neon
    // ==============================

    const users = await sql`
      SELECT
        id,
        username,
        email
      FROM users
      WHERE id = ${userId}
      LIMIT 1
    `;

    if (!users.length) {
      return res.status(404).json({
        ok: false,
        error: "Пользователь не найден."
      });
    }

    const dbUser = users[0];

    // ==============================
    // 5. Пока покупки и ключи пустые
    //
    // Эти поля уже поддерживает
    // cabinet.html.
    //
    // Когда создадим таблицы заказов
    // и ключей — подключим их сюда.
    // ==============================

    const purchases = [];
    const keys = [];

    const spent = 0;

    // ==============================
    // 6. Ответ
    // ==============================

    return res.status(200).json({
      ok: true,

      user: {
        id: String(dbUser.id),
        username: dbUser.username,
        email: dbUser.email,

        purchases,
        keys,
        spent
      }
    });

  } catch (error) {

    console.error(
      "GET /api/auth/me error:",
      error
    );

    // JWT недействителен / просрочен
    if (
      error?.code === "ERR_JWT_EXPIRED" ||
      error?.code === "ERR_JWS_SIGNATURE_VERIFICATION_FAILED" ||
      error?.code === "ERR_JWT_INVALID"
    ) {
      return res.status(401).json({
        ok: false,
        error: "Сессия недействительна."
      });
    }

    return res.status(500).json({
      ok: false,
      error: "Ошибка сервера."
    });
  }
}
```

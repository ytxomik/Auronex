
import { jwtVerify } from "jose";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);

function getCookie(req, name) {
  const raw = req.headers.cookie || "";

  const parts = raw.split(";");

  for (const part of parts) {
    const item = part.trim();

    if (item.startsWith(name + "=")) {
      return decodeURIComponent(
        item.substring(name.length + 1)
      );
    }
  }

  return null;
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({
      ok: false,
      error: "Метод не поддерживается."
    });
  }

  try {
    const token = getCookie(req, "auronex_session");

    if (!token) {
      return res.status(401).json({
        ok: false,
        error: "Не авторизован."
      });
    }

    if (!process.env.JWT_SECRET) {
      console.error("JWT_SECRET is missing");

      return res.status(500).json({
        ok: false,
        error: "JWT_SECRET не настроен."
      });
    }

    if (!process.env.DATABASE_URL) {
      console.error("DATABASE_URL is missing");

      return res.status(500).json({
        ok: false,
        error: "DATABASE_URL не настроен."
      });
    }

    const secret = new TextEncoder().encode(
      process.env.JWT_SECRET
    );

    const result = await jwtVerify(
      token,
      secret
    );

    const payload = result.payload;

    const userId = payload.sub;

    if (!userId) {
      return res.status(401).json({
        ok: false,
        error: "Сессия недействительна."
      });
    }

    const users = await sql`
      SELECT id, username, email
      FROM users
      WHERE id = ${userId}
      LIMIT 1
    `;

    if (!users || users.length === 0) {
      return res.status(404).json({
        ok: false,
        error: "Пользователь не найден."
      });
    }

    const user = users[0];

    return res.status(200).json({
      ok: true,
      user: {
        id: String(user.id),
        username: user.username,
        email: user.email,
        purchases: [],
        keys: [],
        spent: 0
      }
    });

  } catch (error) {
    console.error("ME API ERROR:", error);

    if (
      error &&
      (
        error.code === "ERR_JWT_EXPIRED" ||
        error.code === "ERR_JWS_SIGNATURE_VERIFICATION_FAILED" ||
        error.code === "ERR_JWT_INVALID"
      )
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

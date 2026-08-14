```js
const { neon } = require("@neondatabase/serverless");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const sql = neon(process.env.DATABASE_URL);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      ok: false,
      error: "Метод не поддерживается."
    });
  }

  try {
    const { login, password } = req.body || {};

    const value = String(login || "").trim();
    const pass = String(password || "");

    if (!value || !pass) {
      return res.status(400).json({
        ok: false,
        error: "Введите логин и пароль."
      });
    }

    if (!process.env.JWT_SECRET) {
      console.error("JWT_SECRET не установлен");
      return res.status(500).json({
        ok: false,
        error: "JWT_SECRET не настроен на сервере."
      });
    }

    const rows = await sql`
      SELECT id, username, email, password_hash
      FROM users
      WHERE LOWER(email) = LOWER(${value})
         OR LOWER(username) = LOWER(${value})
      LIMIT 1
    `;

    if (!rows.length) {
      return res.status(401).json({
        ok: false,
        error: "Неверный логин или пароль."
      });
    }

    const user = rows[0];

    const valid = await bcrypt.compare(
      pass,
      user.password_hash
    );

    if (!valid) {
      return res.status(401).json({
        ok: false,
        error: "Неверный логин или пароль."
      });
    }

    const token = jwt.sign(
      {
        sub: String(user.id),
        username: user.username,
        email: user.email
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "7d"
      }
    );

    res.setHeader(
      "Set-Cookie",
      `auronex_session=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=604800`
    );

    return res.status(200).json({
      ok: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email
      }
    });

  } catch (error) {
    console.error("LOGIN ERROR:", error);

    return res.status(500).json({
      ok: false,
      error: "Ошибка сервера."
    });
  }
}
```

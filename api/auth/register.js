import { neon } from "@neondatabase/serverless";
import bcrypt from "bcryptjs";

const sql = neon(process.env.DATABASE_URL);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Метод не поддерживается." });
  }

  try {
    const { username, email, password } = req.body || {};

    const cleanUsername = String(username || "").trim();
    const cleanEmail = String(email || "").trim().toLowerCase();
    const cleanPassword = String(password || "");

    if (!/^[a-zA-Z0-9_-]{3,32}$/.test(cleanUsername)) {
      return res.status(400).json({
        ok: false,
        error: "Логин: 3–32 символа, только латинские буквы, цифры, _ и -."
      });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return res.status(400).json({ ok: false, error: "Введите корректный Email." });
    }

    if (cleanPassword.length < 8) {
      return res.status(400).json({ ok: false, error: "Пароль должен содержать минимум 8 символов." });
    }

    const existing = await sql`
      SELECT id FROM users
      WHERE username = ${cleanUsername} OR email = ${cleanEmail}
      LIMIT 1
    `;

    if (existing.length) {
      return res.status(409).json({
        ok: false,
        error: "Пользователь с таким логином или Email уже существует."
      });
    }

    const passwordHash = await bcrypt.hash(cleanPassword, 12);

    const rows = await sql`
      INSERT INTO users (username, email, password_hash)
      VALUES (${cleanUsername}, ${cleanEmail}, ${passwordHash})
      RETURNING id, username, email, created_at
    `;

    return res.status(201).json({
      ok: true,
      user: rows[0]
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ ok: false, error: "Ошибка сервера." });
  }
}

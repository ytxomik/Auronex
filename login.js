import { neon } from "@neondatabase/serverless";
import bcrypt from "bcryptjs";
import { SignJWT } from "jose";

const sql = neon(process.env.DATABASE_URL);

function getSecret() {
  return new TextEncoder().encode(process.env.JWT_SECRET);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Метод не поддерживается." });
  }

  try {
    const { login, password } = req.body || {};
    const value = String(login || "").trim();
    const pass = String(password || "");

    if (!value || !pass) {
      return res.status(400).json({ ok: false, error: "Введите логин и пароль." });
    }

    const rows = await sql`
      SELECT id, username, email, password_hash
      FROM users
      WHERE LOWER(email) = LOWER(${value}) OR LOWER(username) = LOWER(${value})
      LIMIT 1
    `;

    if (!rows.length) {
      return res.status(401).json({ ok: false, error: "Неверный логин или пароль." });
    }

    const user = rows[0];
    const valid = await bcrypt.compare(pass, user.password_hash);

    if (!valid) {
      return res.status(401).json({ ok: false, error: "Неверный логин или пароль." });
    }

    const token = await new SignJWT({
      sub: String(user.id),
      username: user.username,
      email: user.email
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("7d")
      .sign(getSecret());

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
    console.error(error);
    return res.status(500).json({ ok: false, error: "Ошибка сервера." });
  }
}
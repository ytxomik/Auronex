
import { jwtVerify } from "jose";

function getCookie(req, name) {
  const raw = req.headers.cookie || "";

  for (const part of raw.split(";")) {
    const item = part.trim();

    if (item.startsWith(name + "=")) {
      return decodeURIComponent(
        item.slice(name.length + 1)
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

    if (!process.env.JWT_SECRET) {
      return res.status(500).json({
        ok: false,
        error: "JWT_SECRET не настроен."
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

    return res.status(200).json({
      ok: true,
      user: {
        id: payload.sub || null,
        username: payload.username || null,
        email: payload.email || null
      }
    });

  } catch (error) {
    console.error("ME JWT ERROR:", error);

    return res.status(401).json({
      ok: false,
      error: "Сессия недействительна."
    });
  }
}


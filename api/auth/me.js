import { jwtVerify } from "jose";

function getCookie(req, name) {
  const cookieHeader = req.headers.cookie || "";

  const cookies = cookieHeader.split(";");

  for (const cookie of cookies) {
    const [key, ...valueParts] = cookie.trim().split("=");

    if (key === name) {
      return decodeURIComponent(valueParts.join("="));
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
        error: "Вы не авторизованы."
      });
    }

    const jwtSecret = process.env.JWT_SECRET;

    if (!jwtSecret) {
      console.error("JWT_SECRET отсутствует в Environment Variables");

      return res.status(500).json({
        ok: false,
        error: "JWT_SECRET не настроен."
      });
    }

    const secret = new TextEncoder().encode(jwtSecret);

    const { payload } = await jwtVerify(token, secret);

    return res.status(200).json({
      ok: true,
      user: {
        id: payload.sub,
        username: payload.username,
        email: payload.email
      }
    });

  } catch (error) {
    console.error("ME ERROR:", error);

    return res.status(401).json({
      ok: false,
      error: "Сессия недействительна или истекла."
    });
  }
}

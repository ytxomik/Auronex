import { jwtVerify } from "jose";

function getCookie(req, name) {
  const raw = req.headers.cookie || "";
  const part = raw.split(";").map(v => v.trim()).find(v => v.startsWith(name + "="));
  return part ? decodeURIComponent(part.slice(name.length + 1)) : null;
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "Метод не поддерживается." });
  }

  try {
    const token = getCookie(req, "auronex_session");

    if (!token || !process.env.JWT_SECRET) {
      return res.status(401).json({ ok: false, error: "Не авторизован." });
    }

    const secret = new TextEncoder().encode(process.env.JWT_SECRET);
    const { payload } = await jwtVerify(token, secret);

    return res.status(200).json({
      ok: true,
      user: {
        id: payload.sub,
        username: payload.username,
        email: payload.email
      }
    });
  } catch {
    return res.status(401).json({ ok: false, error: "Сессия недействительна." });
  }
}
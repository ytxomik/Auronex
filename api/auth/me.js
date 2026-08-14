```js
import { jwtVerify } from "jose";

function getCookie(req, name) {
  const raw = req.headers.cookie || "";

  const cookies = raw.split(";").map((item) => item.trim());

  const cookie = cookies.find((item) =>
    item.startsWith(name + "=")
  );

  if (!cookie) {
    return null;
  }

  return decodeURIComponent(
    cookie.substring(name.length + 1)
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
    const token = getCookie(req, "auronex_session");

    if (!token) {
      return res.status(401).json({
        ok: false,
        error: "Сессия не найдена."
      });
    }

    if (!process.env.JWT_SECRET) {
      console.error("JWT_SECRET не установлен");

      return res.status(500).json({
        ok: false,
        error: "JWT_SECRET не настроен."
      });
    }

    const secret = new TextEncoder().encode(
      process.env.JWT_SECRET
    );

    const { payload } = await jwtVerify(
      token,
      secret
    );

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
      error: "Сессия недействительна."
    });
  }
}
```

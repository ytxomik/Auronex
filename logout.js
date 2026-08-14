export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Метод не поддерживается." });
  }

  res.setHeader(
    "Set-Cookie",
    "auronex_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0"
  );

  return res.status(200).json({ ok: true });
}
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({
      ok: false,
      error: "Метод не поддерживается."
    });
  }

  try {
    const products = await sql`
      SELECT
        p.id,
        p.name,
        p.slug,
        p.description,
        p.price,
        p.version,
        p.image_url,
        p.active,
        c.id AS category_id,
        c.name AS category_name,
        c.slug AS category_slug
      FROM products p
      LEFT JOIN categories c
        ON c.id = p.category_id
      WHERE p.active = TRUE
      ORDER BY p.id DESC
    `;

    return res.status(200).json({
      ok: true,
      products
    });
  } catch (error) {
    console.error("GET /api/products error:", error);

    return res.status(500).json({
      ok: false,
      error: "Ошибка сервера."
    });
  }
}


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
        p.download_url,
        p.active,
        p.category_id,
        c.name AS category_name,
        c.slug AS category_slug
      FROM products p
      LEFT JOIN categories c
        ON c.id = p.category_id
      WHERE p.active = true
      ORDER BY p.id ASC
    `;

    return res.status(200).json({
      ok: true,
      products
    });

  } catch (error) {
    console.error("PRODUCTS API ERROR:", error);

    return res.status(500).json({
      ok: false,
      error: "Не удалось загрузить товары."
    });
  }
}


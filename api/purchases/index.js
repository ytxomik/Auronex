
import { jwtVerify } from "jose";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);

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

async function getUserId(req) {
  const token = getCookie(req, "auronex_session");

  if (!token) {
    throw new Error("UNAUTHORIZED");
  }

  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET_MISSING");
  }

  const secret = new TextEncoder().encode(
    process.env.JWT_SECRET
  );

  const { payload } = await jwtVerify(
    token,
    secret
  );

  if (!payload.sub) {
    throw new Error("UNAUTHORIZED");
  }

  return Number(payload.sub);
}

export default async function handler(req, res) {
  try {
    const userId = await getUserId(req);

    if (req.method === "GET") {
      const purchases = await sql`
        SELECT
          p.id,
          p.product_id,
          p.subscription_id,
          p.price,
          p.status,
          p.created_at,
          pr.name AS product_name,
          pr.slug AS product_slug
        FROM purchases p
        LEFT JOIN products pr
          ON pr.id = p.product_id
        WHERE p.user_id = ${userId}
        ORDER BY p.created_at DESC
      `;

      const totalResult = await sql`
        SELECT
          COALESCE(SUM(price), 0) AS total_spent,
          COUNT(*) AS purchase_count
        FROM purchases
        WHERE user_id = ${userId}
          AND status = 'completed'
      `;

      return res.status(200).json({
        ok: true,
        purchases,
        stats: {
          count: Number(
            totalResult[0]?.purchase_count || 0
          ),
          spent: Number(
            totalResult[0]?.total_spent || 0
          )
        }
      });
    }

    if (req.method === "POST") {
      const productId = Number(req.body?.product_id);

      if (!productId || !Number.isInteger(productId)) {
        return res.status(400).json({
          ok: false,
          error: "Некорректный product_id."
        });
      }

      const products = await sql`
        SELECT
          id,
          name,
          price,
          active
        FROM products
        WHERE id = ${productId}
        LIMIT 1
      `;

      if (!products.length) {
        return res.status(404).json({
          ok: false,
          error: "Товар не найден."
        });
      }

      const product = products[0];

      if (!product.active) {
        return res.status(400).json({
          ok: false,
          error: "Товар недоступен."
        });
      }

      const purchase = await sql`
        INSERT INTO purchases (
          user_id,
          product_id,
          price,
          status
        )
        VALUES (
          ${userId},
          ${product.id},
          ${product.price},
          'completed'
        )
        RETURNING
          id,
          user_id,
          product_id,
          price,
          status,
          created_at
      `;

      return res.status(201).json({
        ok: true,
        message: "Покупка создана.",
        purchase: purchase[0],
        product: {
          id: product.id,
          name: product.name,
          price: product.price
        }
      });
    }

    return res.status(405).json({
      ok: false,
      error: "Метод не поддерживается."
    });

  } catch (error) {
    console.error("PURCHASES API ERROR:", error);

    if (error.message === "UNAUTHORIZED") {
      return res.status(401).json({
        ok: false,
        error: "Не авторизован."
      });
    }

    if (error.message === "JWT_SECRET_MISSING") {
      return res.status(500).json({
        ok: false,
        error: "JWT_SECRET не настроен."
      });
    }

    return res.status(500).json({
      ok: false,
      error: "Ошибка сервера."
    });
  }
}


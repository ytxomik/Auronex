
import jwt from "jsonwebtoken";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);

function getToken(req) {
    const cookies = req.headers.cookie || "";

    const match = cookies.match(
        /(?:^|;\s*)token=([^;]+)/
    );

    if (!match) {
        return null;
    }

    return decodeURIComponent(match[1]);
}

export default async function handler(req, res) {

    if (req.method !== "GET") {
        return res.status(405).json({
            ok: false,
            error: "Метод не поддерживается."
        });
    }

    try {

        const token = getToken(req);

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

        let payload;

        try {
            payload = jwt.verify(
                token,
                process.env.JWT_SECRET
            );
        } catch {
            return res.status(401).json({
                ok: false,
                error: "Сессия недействительна."
            });
        }

        const userId = Number(payload.sub);

        if (!Number.isInteger(userId)) {
            return res.status(401).json({
                ok: false,
                error: "Некорректный пользователь."
            });
        }

        const keys = await sql`
            SELECT
                lk.id,
                lk.key_code,
                lk.product_id,
                lk.activated,
                lk.activated_by,
                lk.activated_at,
                lk.created_at,
                p.name AS product_name,
                p.slug AS product_slug,
                p.version AS product_version

            FROM license_keys lk

            LEFT JOIN products p
                ON p.id = lk.product_id

            WHERE
                lk.activated = true
                AND lk.activated_by = ${userId}

            ORDER BY
                lk.activated_at DESC NULLS LAST,
                lk.created_at DESC
        `;

        return res.status(200).json({
            ok: true,

            keys: keys,

            count: keys.length
        });

    } catch (error) {

        console.error(
            "GET /api/keys error:",
            error
        );

        return res.status(500).json({
            ok: false,
            error: "Ошибка сервера."
        });
    }
}


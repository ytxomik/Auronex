
import { jwtVerify } from "jose";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);

function getCookie(req, name) {
    const raw = req.headers.cookie || "";

    const part = raw
        .split(";")
        .map(v => v.trim())
        .find(v => v.startsWith(name + "="));

    return part
        ? decodeURIComponent(part.slice(name.length + 1))
        : null;
}

async function getUserFromSession(req) {
    const token = getCookie(req, "auronex_session");

    if (!token) {
        throw new Error("Не авторизован.");
    }

    if (!process.env.JWT_SECRET) {
        throw new Error("JWT_SECRET не настроен.");
    }

    const secret = new TextEncoder().encode(
        process.env.JWT_SECRET
    );

    const { payload } = await jwtVerify(
        token,
        secret
    );

    if (!payload.sub) {
        throw new Error("Недействительная сессия.");
    }

    return {
        id: Number(payload.sub),
        username: payload.username,
        email: payload.email
    };
}

export default async function handler(req, res) {

    if (req.method !== "POST") {
        return res.status(405).json({
            ok: false,
            error: "Метод не поддерживается."
        });
    }

    try {

        /*
         * ==========================================
         * 1. ПОЛУЧАЕМ ПОЛЬЗОВАТЕЛЯ
         * ==========================================
         */

        const user = await getUserFromSession(req);

        if (!Number.isInteger(user.id)) {
            return res.status(401).json({
                ok: false,
                error: "Недействительный пользователь."
            });
        }


        /*
         * ==========================================
         * 2. ПОЛУЧАЕМ КЛЮЧ
         * ==========================================
         */

        const body =
            typeof req.body === "string"
                ? JSON.parse(req.body)
                : req.body || {};

        const keyCode =
            String(body.key || body.key_code || "")
                .trim()
                .toUpperCase();

        if (!keyCode) {
            return res.status(400).json({
                ok: false,
                error: "Введите ключ."
            });
        }


        /*
         * ==========================================
         * 3. НАХОДИМ КЛЮЧ
         * ==========================================
         */

        const keys = await sql`
            SELECT
                lk.id,
                lk.key_code,
                lk.product_id,
                lk.activated,
                lk.activated_by,
                lk.activated_at,

                p.name AS product_name,
                p.price AS product_price,
                p.active AS product_active,
                p.activation_limit

            FROM license_keys lk

            INNER JOIN products p
                ON p.id = lk.product_id

            WHERE UPPER(lk.key_code) = ${keyCode}

            LIMIT 1
        `;

        if (!keys.length) {
            return res.status(404).json({
                ok: false,
                error: "Ключ не найден."
            });
        }

        const licenseKey = keys[0];


        /*
         * ==========================================
         * 4. ПРОВЕРЯЕМ КЛЮЧ
         * ==========================================
         */

        if (licenseKey.activated) {
            return res.status(409).json({
                ok: false,
                error: "Этот ключ уже активирован."
            });
        }


        /*
         * ==========================================
         * 5. ПРОВЕРЯЕМ ТОВАР
         * ==========================================
         */

        if (!licenseKey.product_active) {
            return res.status(400).json({
                ok: false,
                error: "Этот товар больше недоступен."
            });
        }


        /*
         * ==========================================
         * 6. ПОЛУЧАЕМ ЛИМИТ
         * ==========================================
         */

        const activationLimit =
            Number(licenseKey.activation_limit);


        /*
         * ==========================================
         * 7. ПОЛУЧАЕМ СЧЁТЧИК
         * ==========================================
         */

        const counters = await sql`
            SELECT
                id,
                activation_count
            FROM product_activation_counters
            WHERE user_id = ${user.id}
              AND product_id = ${licenseKey.product_id}
            LIMIT 1
        `;

        const currentCount =
            counters.length
                ? Number(counters[0].activation_count)
                : 0;


        /*
         * ==========================================
         * 8. ПРОВЕРЯЕМ ЛИМИТ
         *
         * activation_limit = 0
         * означает отсутствие ограничения.
         * ==========================================
         */

        if (
            activationLimit > 0 &&
            currentCount >= activationLimit
        ) {
            return res.status(429).json({
                ok: false,
                error:
                    `Лимит активаций этого товара достигнут (${activationLimit}).`
            });
        }


        /*
         * ==========================================
         * 9. АКТИВИРУЕМ КЛЮЧ
         * ==========================================
         */

        const activatedKeys = await sql`
            UPDATE license_keys
            SET
                activated = TRUE,
                activated_by = ${user.id},
                activated_at = NOW()

            WHERE id = ${licenseKey.id}
              AND activated = FALSE

            RETURNING
                id,
                key_code,
                product_id,
                activated,
                activated_by,
                activated_at
        `;

        /*
         * Если другой запрос успел активировать
         * этот же ключ раньше — не продолжаем.
         */

        if (!activatedKeys.length) {
            return res.status(409).json({
                ok: false,
                error: "Этот ключ уже был активирован."
            });
        }


        /*
         * ==========================================
         * 10. ОБНОВЛЯЕМ СЧЁТЧИК
         * ==========================================
         */

        await sql`
            INSERT INTO product_activation_counters (
                user_id,
                product_id,
                activation_count,
                updated_at
            )

            VALUES (
                ${user.id},
                ${licenseKey.product_id},
                1,
                NOW()
            )

            ON CONFLICT (user_id, product_id)

            DO UPDATE SET
                activation_count =
                    product_activation_counters.activation_count + 1,

                updated_at = NOW()
        `;


        /*
         * ==========================================
         * 11. СОЗДАЁМ ПОКУПКУ
         * ==========================================
         */

        const purchases = await sql`
            INSERT INTO purchases (
                user_id,
                product_id,
                price,
                status
            )

            VALUES (
                ${user.id},
                ${licenseKey.product_id},
                ${licenseKey.product_price},
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


        /*
         * ==========================================
         * 12. ОТВЕТ
         * ==========================================
         */

        return res.status(200).json({
            ok: true,

            message: "Ключ успешно активирован.",

            product: {
                id: licenseKey.product_id,
                name: licenseKey.product_name,
                price: licenseKey.product_price
            },

            key: {
                id: activatedKeys[0].id,
                code: activatedKeys[0].key_code,
                activated_at:
                    activatedKeys[0].activated_at
            },

            purchase: purchases[0],

            activation: {
                count: currentCount + 1,
                limit: activationLimit
            }
        });

    } catch (error) {

        console.error(
            "Activate key error:",
            error
        );

        return res.status(500).json({
            ok: false,
            error:
                error.message ||
                "Внутренняя ошибка сервера."
        });
    }
}


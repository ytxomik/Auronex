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

function normalizeKey(value) {
    return String(value || "")
        .trim()
        .toUpperCase();
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
        throw new Error("INVALID_SESSION");
    }

    return String(payload.sub);
}

export default async function handler(req, res) {

    if (req.method !== "POST") {
        return res.status(405).json({
            ok: false,
            error: "Метод не поддерживается."
        });
    }

    try {

        if (!process.env.DATABASE_URL) {
            return res.status(500).json({
                ok: false,
                error: "DATABASE_URL не настроен."
            });
        }

        const userId = await getUserId(req);

        const body =
            typeof req.body === "object" && req.body
                ? req.body
                : {};

        const keyCode =
            normalizeKey(
                body.key ||
                body.key_code ||
                body.code
            );

        if (!keyCode) {
            return res.status(400).json({
                ok: false,
                error: "Введите ключ."
            });
        }

        /*
         * Ищем ключ.
         */
        const keyRows = await sql`
            SELECT
                lk.id,
                lk.key_code,
                lk.product_id,
                lk.activated,
                lk.activated_by,
                lk.activated_at,

                p.name AS product_name,
                p.slug AS product_slug,
                p.description AS product_description,
                p.price AS product_price,
                p.version AS product_version,
                p.image_url AS product_image_url,
                p.active AS product_active,
                p.activation_limit

            FROM license_keys lk

            INNER JOIN products p
                ON p.id = lk.product_id

            WHERE UPPER(lk.key_code) = ${keyCode}

            LIMIT 1
        `;

        if (!keyRows.length) {
            return res.status(404).json({
                ok: false,
                error: "Такой ключ не найден."
            });
        }

        const key = keyRows[0];

        /*
         * Уже активирован.
         */
        if (key.activated) {
            return res.status(409).json({
                ok: false,
                error: "Этот ключ уже активирован."
            });
        }

        /*
         * Проверяем товар.
         */
        if (!key.product_active) {
            return res.status(400).json({
                ok: false,
                error: "Этот товар сейчас недоступен."
            });
        }

        /*
         * Лимит активаций.
         *
         * Например:
         * activation_limit = 1
         *
         * Пользователь может активировать
         * один ключ этого товара.
         */
        const limit =
            Number(key.activation_limit || 1);

        const counterRows = await sql`
            SELECT
                id,
                user_id,
                product_id,
                activation_count,
                updated_at

            FROM product_activation_counters

            WHERE user_id = ${userId}
              AND product_id = ${key.product_id}

            LIMIT 1
        `;

        const currentCount =
            counterRows.length
                ? Number(
                    counterRows[0].activation_count || 0
                )
                : 0;

        if (currentCount >= limit) {
            return res.status(409).json({
                ok: false,
                error:
                    `Лимит активаций для товара исчерпан. ` +
                    `Разрешено: ${limit}.`
            });
        }

        /*
         * -----------------------------------------
         * АКТИВАЦИЯ
         * -----------------------------------------
         *
         * Сначала помечаем ключ активированным.
         */

        const activatedRows = await sql`
            UPDATE license_keys

            SET
                activated = TRUE,
                activated_by = ${userId},
                activated_at = NOW()

            WHERE id = ${key.id}
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
         * Защита от двойной активации,
         * если два запроса пришли одновременно.
         */
        if (!activatedRows.length) {
            return res.status(409).json({
                ok: false,
                error: "Этот ключ уже активируется или был активирован."
            });
        }

        /*
         * Обновляем счётчик.
         */
        if (counterRows.length) {

            await sql`
                UPDATE product_activation_counters

                SET
                    activation_count =
                        activation_count + 1,
                    updated_at = NOW()

                WHERE id = ${counterRows[0].id}
            `;

        } else {

            await sql`
                INSERT INTO product_activation_counters (
                    user_id,
                    product_id,
                    activation_count,
                    updated_at
                )

                VALUES (
                    ${userId},
                    ${key.product_id},
                    1,
                    NOW()
                )
            `;
        }

        /*
         * Создаём покупку.
         *
         * Для ключевой активации subscription_id = NULL.
         */
        const purchaseRows = await sql`
            INSERT INTO purchases (
                user_id,
                product_id,
                subscription_id,
                price,
                status,
                created_at
            )

            VALUES (
                ${userId},
                ${key.product_id},
                NULL,
                ${key.product_price || 0},
                'completed',
                NOW()
            )

            RETURNING
                id,
                user_id,
                product_id,
                price,
                status,
                created_at
        `;

        const activatedKey =
            activatedRows[0];

        return res.status(200).json({

            ok: true,

            message:
                "Ключ успешно активирован.",

            key: {
                id: String(activatedKey.id),

                key_code:
                    activatedKey.key_code,

                activated_at:
                    activatedKey.activated_at
            },

            product: {
                id: String(key.product_id),

                name:
                    key.product_name,

                slug:
                    key.product_slug,

                description:
                    key.product_description,

                price:
                    key.product_price,

                version:
                    key.product_version,

                image_url:
                    key.product_image_url
            },

            activation: {
                count:
                    currentCount + 1,

                limit:
                    limit
            },

            purchase: purchaseRows.length
                ? {
                    id:
                        String(
                            purchaseRows[0].id
                        ),

                    status:
                        purchaseRows[0].status
                }
                : null
        });

    } catch (error) {

        console.error(
            "ACTIVATE KEY ERROR:",
            error
        );

        if (
            error &&
            (
                error.code === "ERR_JWT_EXPIRED" ||
                error.code === "ERR_JWS_SIGNATURE_VERIFICATION_FAILED" ||
                error.code === "ERR_JWT_INVALID"
            )
        ) {
            return res.status(401).json({
                ok: false,
                error: "Сессия недействительна."
            });
        }

        if (
            error &&
            error.message === "UNAUTHORIZED"
        ) {
            return res.status(401).json({
                ok: false,
                error: "Не авторизован."
            });
        }

        if (
            error &&
            error.message === "JWT_SECRET_MISSING"
        ) {
            return res.status(500).json({
                ok: false,
                error: "JWT_SECRET не настроен."
            });
        }

        if (
            error &&
            error.message === "INVALID_SESSION"
        ) {
            return res.status(401).json({
                ok: false,
                error: "Сессия недействительна."
            });
        }

        return res.status(500).json({
            ok: false,
            error: "Ошибка сервера при активации ключа."
        });
    }
}

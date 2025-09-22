import json
import logging
import os
from typing import Dict, Any

from aiogram import Bot, Dispatcher, F
from aiogram.enums import ParseMode
from aiogram.filters import Command
from aiogram.types import Message, WebAppInfo, ReplyKeyboardMarkup, KeyboardButton, ReplyKeyboardRemove
from aiogram.utils.keyboard import ReplyKeyboardBuilder
from aiogram import Router

TOKEN = os.getenv("BOT_TOKEN", "PASTE_YOUR_BOT_TOKEN_HERE")

logging.basicConfig(level=logging.INFO)

router = Router()


def main_menu_kb() -> ReplyKeyboardMarkup:
    builder = ReplyKeyboardBuilder()
    builder.button(text="Открыть мини-приложение", web_app=WebAppInfo(url="https://your-domain-or-filehost.example/index.html"))
    builder.button(text="Профиль")
    builder.button(text="История")
    builder.adjust(1, 2)
    return builder.as_markup(resize_keyboard=True)


@router.message(Command("start"))
async def cmd_start(message: Message):
    await message.answer(
        "Добро пожаловать в Такси Престиж!\nОткройте мини‑приложение, чтобы оформить заказ.",
        reply_markup=main_menu_kb(),
    )


@router.message(F.web_app_data)
async def on_web_app_data(message: Message):
    try:
        data = json.loads(message.web_app_data.data)
    except Exception:
        await message.answer("Не удалось разобрать данные заказа")
        return

    if data.get("type") == "create_order":
        total = data.get("total")
        tariff = data.get("tariff", {}).get("name", "Тариф")
        from_addr = data.get("from")
        to_addr = data.get("to")
        extras = data.get("points", [])
        pay = data.get("payment")
        user = data.get("user", {})

        extras_text = (" +" + str(len(extras))) if extras else ""
        await message.answer(
            (
                f"Заказ принят: {from_addr} → {to_addr}{extras_text}\n"
                f"Тариф: {tariff}\nОплата: {'Наличными' if pay=='cash' else 'Перевод'}\n"
                f"Итого: <b>{total}₽</b>\n\n"
                "Ваш заказ создан и передан водителям.\n"
                "Сообщим марку авто и гос номер отдельным сообщением."
            ),
            parse_mode=ParseMode.HTML,
            reply_markup=main_menu_kb(),
        )

        # Имитация назначения авто и завершения поездки (в проде заменить на реальную логику)
        car = "Hyundai Solaris"
        plate = "А123ВС77"
        await message.answer(f"Назначено авто: {car}, гос. номер {plate}")

        # Сохранение истории на стороне бота опционально — здесь просто отправим JSON, чтобы фронт мог сохранить локально при желании
        history_item = {
            "from": from_addr,
            "to": to_addr,
            "points": extras,
            "tariff": tariff,
            "price": total,
            "car": car,
            "plate": plate,
        }
        await message.answer(
            "Для истории (локально):\n<code>" + json.dumps(history_item, ensure_ascii=False) + "</code>",
            parse_mode=ParseMode.HTML,
        )
    else:
        await message.answer("Получены данные мини‑приложения")


async def main() -> None:
    bot = Bot(TOKEN, parse_mode=ParseMode.HTML)
    dp = Dispatcher()
    dp.include_router(router)
    await dp.start_polling(bot)


if __name__ == "__main__":
    import asyncio
    asyncio.run(main())



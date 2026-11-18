import { z } from "zod";

// Сообщения zod по умолчанию — на русском (для полей без своего текста ошибки).
z.config(z.locales.ru());

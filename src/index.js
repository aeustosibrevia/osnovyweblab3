require("dotenv").config();

const { Telegraf, Markup } = require("telegraf");

const requiredEnv = ["BOT_TOKEN", "GROQ_API_KEY"];
const missingEnv = requiredEnv.filter((key) => !process.env[key]);

if (missingEnv.length) {
  console.error(`Missing environment variables: ${missingEnv.join(", ")}`);
  process.exit(1);
}

const bot = new Telegraf(process.env.BOT_TOKEN);
const awaitingPrompt = new Set();

const mainMenu = Markup.keyboard([
  ["Студент", "IT-технології"],
  ["Контакти", "Prompt AI"]
]).resize();

const menuText = "Оберіть потрібний розділ меню:";

bot.start(async (ctx) => {
  awaitingPrompt.delete(ctx.from.id);
  await ctx.reply(
    `Вітаю, ${ctx.from.first_name || "користувачу"}! Я навчальний Telegram-бот з меню та AI.`,
    mainMenu
  );
  await ctx.reply(menuText);
});

bot.hears("Студент", async (ctx) => {
  const surname = process.env.STUDENT_SURNAME || "Не вказано";
  const group = process.env.STUDENT_GROUP || "Не вказано";
  await ctx.reply(`Студент: ${surname}\nГрупа: ${group}`, mainMenu);
});

bot.hears("IT-технології", async (ctx) => {
  await ctx.reply(
    "IT-технології\n\n• JavaScript — мова програмування для вебзастосунків.",
    mainMenu
  );
});

bot.hears("Контакти", async (ctx) => {
  const phone = process.env.CONTACT_PHONE || "Не вказано";
  const email = process.env.CONTACT_EMAIL || "Не вказано";
  await ctx.reply(`Контакти\nТелефон: ${phone}\nE-mail: ${email}`, mainMenu);
});

bot.hears("Prompt AI", async (ctx) => {
  awaitingPrompt.add(ctx.from.id);
  await ctx.reply(
    "Напишіть свій запит до AI одним повідомленням. Щоб повернутися до меню, натисніть /menu.",
    Markup.removeKeyboard()
  );
});

bot.command("menu", async (ctx) => {
  awaitingPrompt.delete(ctx.from.id);
  await ctx.reply(menuText, mainMenu);
});

bot.on("text", async (ctx) => {
  const userId = ctx.from.id;
  const prompt = ctx.message.text.trim();

  if (prompt.startsWith("/") || !awaitingPrompt.has(userId)) {
    return;
  }

  if (!prompt) {
    await ctx.reply("Будь ласка, введіть текст запиту.");
    return;
  }

  awaitingPrompt.delete(userId);
  await ctx.reply("Обробляю запит, зачекайте...");

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "openai/gpt-oss-120b",
        messages: [
          {
            role: "system",
            content: "Ти корисний AI-асистент. Відповідай українською мовою, якщо користувач не попросив іншу мову. Відповідай зрозуміло та по суті."
          },
          { role: "user", content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 1024
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error?.message || `Groq API error: ${response.status}`);
    }

    const answer = data.choices?.[0]?.message?.content?.trim();

    if (!answer) {
      throw new Error("AI не повернув текстову відповідь.");
    }

    for (let i = 0; i < answer.length; i += 4000) {
      await ctx.reply(answer.slice(i, i + 4000), mainMenu);
    }
  } catch (error) {
    console.error(error.message);
    await ctx.reply(
      "Не вдалося отримати відповідь від AI. Перевірте ключ Groq API та спробуйте ще раз.",
      mainMenu
    );
  }
});

bot.catch((error, ctx) => {
  console.error(`Bot error for update ${ctx.update.update_id}:`, error.message);
});

bot.launch().then(() => {
  console.log("Telegram bot is running.");
});

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));

const validateUrl = (data) => {
  // 1. Проверка на пустоту
  if (!data || typeof data !== "string" || data.trim() === "") {
    return "Данные не введены!";
  }

  let url;
  try {
    // 2. Попытка распарсить URL. Если ссылка битая, new URL выбросит ошибку
    url = new URL(data);
  } catch (e) {
    return "Некорректный URL!";
  }

  // 3. Проверка протокола (должен быть http или https)
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return "Поддерживаются только http и https ссылки!";
  }

  // 4. Проверка домена YouTube
  // hostname вернет, например, "www.youtube.com", "youtube.com", "m.youtube.com", "youtu.be"
  const hostname = url.hostname.toLowerCase();

  const isYouTube = hostname.endsWith("youtube.com") || hostname === "youtu.be";

  if (!isYouTube) {
    return "Это не ссылка YouTube!";
  }

  // 5. Если всё хорошо, возвращаем 1 (или true)
  return 1;
};

module.exports = validateUrl;

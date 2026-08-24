const { spawn } = require("child_process");
const { log } = require("console");
const path = require("path");

// Путь к exe файлу. Убедитесь, что yt-dlp.exe лежит в корне проекта
const ytdlpPath = path.join(__dirname, "..", "yt-dlp.exe");

const getTitle = (link) => {
  return new Promise((resolve, reject) => {
    // Аргументы командной строки
    const args = [
      link,
      "--dump-json", // Вывод информации в JSON
      "--no-playlist", // Игнорировать плейлисты, брать только видео
    ];

    // Запускаем процесс
    const ytdlpProcess = spawn(ytdlpPath, args);

    let stdoutData = "";
    let stderrData = "";

    // Сбор данных из стандартного вывода (stdout)
    ytdlpProcess.stdout.on("data", (data) => {
      stdoutData += data.toString();
    });

    // Сбор данных из потока ошибок (stderr)
    ytdlpProcess.stderr.on("data", (data) => {
      stderrData += data.toString();
    });

    // Обработка завершения процесса
    ytdlpProcess.on("close", (code) => {
      if (code === 0) {
        try {
          // Парсим JSON из stdout
          const data = JSON.parse(stdoutData);
          resolve(data.title); // Возвращаем название
        } catch (e) {
          console.error("Ошибка парсинга JSON в getTitle:", e);
          resolve(null);
        }
      } else {
        console.error(`yt-dlp завершился с кодом ${code}`);
        if (stderrData) console.error(stderrData);
        resolve(null);
      }
    });

    // Обработка ошибок запуска (например, файл не найден)
    ytdlpProcess.on("error", (err) => {
      console.error("Не удалось запустить yt-dlp в getTitle:", err);
      resolve(null);
    });
  });
};

module.exports = getTitle;

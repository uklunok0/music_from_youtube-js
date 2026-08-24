const express = require("express");
const bodyParser = require("body-parser");
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

const validateUrl = require("./public/validateURL");
const getTitle = require("./public/getTitleVideo"); // Используем эту функцию для имени
const getVideoInfo = require("./public/getVideoInfo");

const app = express();
const port = 3000;

// Пути к исполняемым файлам
const ytdlpPath = path.join(__dirname, "./yt-dlp.exe");
const ffmpegPath = path.join(__dirname, "ffmpeg", "bin", "ffmpeg.exe");

const downloadTasks = {};

app.set("view engine", "ejs");
app.get("/", (req, res) => res.render("index.ejs"));
app.use(express.static("public"));
app.use(bodyParser.json());

function generateRandomName() {
  const alphabet = "abcdefghijklmnopqrstuvwxyz";
  let name = "";
  for (let i = 0; i < 8; i++)
    name += alphabet[Math.floor(Math.random() * alphabet.length)];
  return name;
}

// 1. Получение информации о видео (для превью на странице)
app.post("/", async (req, res) => {
  let link = req.body.name;
  if (link.startsWith("www.youtube.")) link = "https://" + link;

  const validate = validateUrl(link);
  if (validate !== 1) return res.send(validate);

  try {
    const videoTitle = await getTitle(link);
    const info = await getVideoInfo(link); // Возвращает [size, thumb, min, sec]

    if (!info) return res.send("Не удалось получить информацию о видео.");

    // Для отображения на странице название можно получить отдельно или добавить в getVideoInfo
    // Но чтобы не ломать ваш текущий getVideoInfo, оставим как есть.
    // Если нужно название в превью, можно раскомментировать строку ниже:
    // const title = await getTitle(link);

    const responseHTML = `Название видео:<br>${videoTitle}<br>Размер файла:<br>~ ${info[0]} кбайт<br>Длительность:<br>${info[2]}min ${info[3]}s<br><img src ="${info[1]}" style="width: 225px; height: 125px;"/>`;

    res.send(responseHTML);
  } catch (error) {
    console.error(error);
    res.send("Ошибка сервера");
  }
});

// 2. Запуск скачивания и конвертации
app.post("/data", async (req, res) => {
  let link = req.body.name;
  if (link.startsWith("www.youtube.")) link = "https://" + link;

  const taskId = generateRandomName();
  const outputPath = path.join(
    __dirname,
    "./public/Downloads",
    `${taskId}.%(ext)s`,
  );

  try {
    const videoTitle = await getTitle(link);

    downloadTasks[taskId] = {
      progress: 0,
      status: "processing",
      stage: "init", // init, downloading, converting, finished
      message: "Инициализация...",
      filename: `${taskId}.mp3`,
      originalTitle: videoTitle || "youtube_audio", // Сохраняем имя
    };

    console.log(`Запуск обработки: ${taskId}`);

    // Параметры для ffmpeg: 256kbps битрейт, 44100Hz частота
    const ffmpegArgs = "-codec:a libmp3lame -b:a 256k -ar 44100";

    const args = [
      link,
      "-x", // Извлечь аудио
      "--audio-format",
      "mp3",
      "--postprocessor-args",
      `ffmpeg:${ffmpegArgs}`, // Применение настроек ffmpeg
      "-o",
      outputPath,
      "--no-playlist",
      "--newline",
    ];

    // Если ffmpeg лежит в нестандартном месте, указываем путь явно
    if (fs.existsSync(ffmpegPath)) {
      args.push("--ffmpeg-location", ffmpegPath);
    }

    const process = spawn(ytdlpPath, args);

    process.stdout.on("data", (data) => {
      const output = data.toString();

      // 1. Этап скачивания
      if (output.includes("[download]")) {
        if (downloadTasks[taskId].stage !== "downloading") {
          downloadTasks[taskId].stage = "downloading";
          downloadTasks[taskId].message = "Скачивание аудиодорожки...";
        }

        const match = output.match(/(\d+\.?\d*)%/);
        if (match && downloadTasks[taskId]) {
          downloadTasks[taskId].progress = parseFloat(match[1]);
        }
      }

      // 2. Этап конвертации
      // yt-dlp пишет "[ExtractAudio] Destination" или "[ffmpeg] Destination" когда начинает конвертацию
      if (output.includes("Destination") || output.includes("[ffmpeg]")) {
        if (downloadTasks[taskId].stage !== "converting") {
          downloadTasks[taskId].stage = "converting";
          downloadTasks[taskId].message = "Конвертация в MP3...";
          downloadTasks[taskId].progress = 90; // Визуально переходим на 90%
        } else {
          // Эмуляция прогресса во время конвертации (от 90 до 99%)
          if (downloadTasks[taskId].progress < 99) {
            downloadTasks[taskId].progress += 2;
          }
        }
      }
    });

    process.stderr.on("data", (data) => {
      console.error(`yt-dlp stderr: ${data}`);
    });

    process.on("close", (code) => {
      if (code === 0) {
        downloadTasks[taskId].status = "finished";
        downloadTasks[taskId].stage = "finished";
        downloadTasks[taskId].message = "Готово!";
        downloadTasks[taskId].progress = 100;
        console.log(`Успех: ${taskId}`);
      } else {
        downloadTasks[taskId].status = "error";
        downloadTasks[taskId].message = "Ошибка обработки.";
        console.error(`Ошибка yt-dlp код: ${code}`);
      }
    });

    res.json({ taskId: taskId, status: "started" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Ошибка" });
  }
});

// 3. SSE Прогресс
app.get("/progress/:taskId", (req, res) => {
  const taskId = req.params.taskId;
  res.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  const interval = setInterval(() => {
    const task = downloadTasks[taskId];
    if (task) {
      res.write(`data: ${JSON.stringify(task)}\n\n`);
      if (task.status === "finished" || task.status === "error") {
        clearInterval(interval);
        res.end();
      }
    } else {
      clearInterval(interval);
      res.end();
    }
  }, 1000);

  req.on("close", () => clearInterval(interval));
});

// 4. Скачивание готового файла с правильным именем
app.get("/download/:taskId", (req, res) => {
  const taskId = req.params.taskId;
  const task = downloadTasks[taskId];

  if (!task || task.status !== "finished") {
    return res.status(404).send("Файл не готов или не найден");
  }

  const filePath = path.join(__dirname, "./public/Downloads", task.filename);

  // Очищаем имя файла от запрещенных символов для Windows/Linux
  let safeName = task.originalTitle.replace(/[^a-z0-9а-яё\s\-_]/gi, "_").trim();
  // Ограничиваем длину имени
  if (safeName.length > 100) safeName = safeName.substring(0, 100);

  const downloadName = `${safeName}.mp3`;

  res.download(filePath, downloadName, (err) => {
    if (!err) {
      // Удаляем файл после успешной передачи
      fs.unlink(filePath, (unlinkErr) => {
        if (unlinkErr) console.error("Ошибка удаления файла:", unlinkErr);
      });
      delete downloadTasks[taskId];
    } else {
      console.error("Ошибка отправки файла:", err);
    }
  });
});

app.listen(port, () =>
  console.log(`Server running on http://localhost:${port}`),
);

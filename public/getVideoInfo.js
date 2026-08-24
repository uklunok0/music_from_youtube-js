const { spawn } = require("child_process");
const path = require("path");

const ytdlpPath = path.join(__dirname, "..", "yt-dlp.exe");
const getVideoInfo = (link) => {
  return new Promise((resolve, reject) => {
    const args = [link, "--dump-json", "--no-playlist"];

    const ytdlpProcess = spawn(ytdlpPath, args);

    let stdoutData = "";
    let stderrData = "";

    ytdlpProcess.stdout.on("data", (data) => {
      stdoutData += data.toString();
    });

    ytdlpProcess.stderr.on("data", (data) => {
      stderrData += data.toString();
    });

    ytdlpProcess.on("close", (code) => {
      if (code === 0) {
        try {
          const data = JSON.parse(stdoutData);

          const duration = data.duration; // в секундах
          if (!duration) {
            resolve(null);
            return;
          }

          const minutes = Math.floor(duration / 60);
          const seconds = duration % 60;

          // Примерный размер в КБ (128kbps ~ 16KB/s)
          const estimatedSizeKB = Math.floor(32 * duration);

          const thumbnail = data.thumbnail;

          // Возвращаем массив: [размер, картинка, минуты, секунды]
          resolve([estimatedSizeKB, thumbnail, minutes, seconds]);
        } catch (e) {
          console.error("Ошибка парсинга JSON в getVideoInfo:", e);
          resolve(null);
        }
      } else {
        console.error(`yt-dlp error in getVideoInfo: ${stderrData}`);
        resolve(null);
      }
    });

    ytdlpProcess.on("error", (err) => {
      console.error("Не удалось запустить yt-dlp в getVideoInfo:", err);
      resolve(null);
    });
  });
};

module.exports = getVideoInfo;

const ffmpeg = require("fluent-ffmpeg");
const ytdl = require("@distube/ytdl-core");
const readline = require("readline");
const { response } = require("express");

const getStream = async (link, linkYoutube) => {
  // ф-ция получения и обработки видеопотока

  try {
    let stream = await ytdl(link, { quality: "highestaudio" }); // получить видеопоток по ссылке
    ffmpeg.setFfmpegPath(
      "C:/JS-PROGECTS/mp3_from_youtube/ffmpeg/bin/ffmpeg.exe",
    );

    function saveStream() {
      let start = Date.now();
      ffmpeg(stream) // преобразование видеопотока в *mp3
        .audioBitrate(320)
        .save(
          "C:/JS-PROGECTS/mp3_from_youtube/tmp_from_youtube/" +
            `${linkYoutube}.mp3`,
        )
        .on("progress", (p) => {
          readline.cursorTo(process.stdout, 0); // перемещает курсор в начало строки
          process.stdout.write(`${p.targetSize}kb downloaded`);
        })
        .on("end", () => {
          console.log(`\ndone, thanks - ${(Date.now() - start) / 1000}s`);
          responseHTML = `\ndone, thanks - ${(Date.now() - start) / 1000}s`;
          return responseHTML;
        });
    }
    saveStream();
  } catch (error) {
    console.log(error);
  }
};

module.exports = getStream;

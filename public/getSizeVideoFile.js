const ytdl = require("ytdl-core");

const getFileSize = async (link) => {
  try {
    const info = await ytdl.getInfo(link);
    console.log(info.player_response.videoDetails.title);
    const audioFormat = info.formats.find((format) => format.mimeType.startsWith("audio/"));
    // получить объём аудио
    const fileSize = Math.floor((parseInt(audioFormat.contentLength) / 1024) * 2.5);
    // получить превью
    const thumbnailUrl = info.player_response.videoDetails.thumbnail.thumbnails[0].url;
    console.log(thumbnailUrl);
    // const thumbnailFileName = "thumbnail";
    // file = fs.createWriteStream(thumbnailFileName);

    // https.get(thumbnailUrl, (response) => {
    //   response.pipe(file);
    // });

    // file.on("finish", () => {
    //   file.close(() => {
    //     sharp(thumbnailFileName).toFile(
    //       "./public/converted-image.jpg",
    //       (err, info) => {
    //         if (err) {
    //           console.error("Ошибка при конвертировании изображения:", err);
    //         } else {
    //           console.log("Изображение успешно конвертировано");
    //         }
    //       }
    //     );
    //   });
    // });

    // file.on("error", (err) => {
    //   fs.unlink(thumbnailFileName, () => {
    //     console.error("Произошла ошибка при сохранении изображения:", err);
    //   });
    // });

    return [fileSize, thumbnailUrl];
  } catch (error) {
    console.error(error);
    return 0;
  }
};

module.exports = getFileSize;

// получить элементы формы
const form = document.querySelector("#getLink");
const nameInput = document.querySelector("#nameInput");
const resultDiv = document.getElementById("result");
const resultDivWrap = document.createElement("div");
const divBtn = form.getElementsByClassName("btn")[0];

// Элемент для отображения статуса/прогресса
const statusElement = document.getElementById("status");

async function sendRequestAndUpdateResult(url, data) {
  try {
    showAnimation();

    // Отправка запроса к серверу
    const response = await axios.post(url, data);
    let resultData = response.data;

    // проверяем тип данных. Сервер может вернуть строку (ошибку/HTML) или JSON (при скачивании)
    if (typeof resultData === "object" && resultData !== null) {
      // Если пришел JSON (например, { taskId: "..." }), обрабатываем отдельно или возвращаем
      return resultData;
    }

    // Логика для строковых ответов (валидация, инфо о видео)
    const resultDataCut = resultData.substring(0, 8);

    if (resultDataCut == "Название") {
      // Создаем элемент плашки
      resultDivWrap.className = "messageWrap";
      const container = document.getElementById("result");
      // Очищаем контейнер перед добавлением нового, если нужно, или добавляем внутрь
      container.innerHTML = "";
      container.appendChild(resultDivWrap);
      resultDivWrap.innerHTML = resultData;

      nameInput.setAttribute("readonly", true);
    } else {
      // Обновление содержимого div с результатом (ошибки валидации и т.д.)
      resultDiv.innerHTML = resultData;
      // Очищаем обертку, если она была
      if (resultDivWrap.parentNode) {
        resultDivWrap.remove();
      }
    }

    closeAnimation();
    return null; // Возвращаем null для строковых ответов
  } catch (error) {
    console.error(error);
    closeAnimation();
    resultDiv.innerHTML = "Ошибка соединения с сервером";
    return null;
  }
}

function checkDivIsNotEmpty() {
  // Проверка, что в resultDiv нет сообщений об ошибках
  const inner = resultDiv.innerHTML;
  const isError =
    inner.includes("Некорректный URL") ||
    inner.includes("Данные не введены") ||
    inner.includes("Это не ссылка YouTube") ||
    inner.includes("Попробуйте что-нибудь другое") ||
    inner.includes("Файл много весит");

  if (!isError && inner.includes("Название")) {
    console.log("win!");

    // Удаляем старую кнопку, если есть
    const oldBtn = document.getElementById("confirmButton");
    if (oldBtn) oldBtn.remove();

    const btn = document.createElement("button");
    btn.innerHTML = "Скачать";
    btn.id = "confirmButton";
    divBtn.appendChild(btn);

    btn.addEventListener("click", btnSubmit);
  }
}

// Обработчик события клика по кнопке формы
const handleSubmit = async function (e) {
  e.preventDefault();
  resultDiv.innerHTML = "";

  // Сброс состояния
  nameInput.removeAttribute("readonly");
  document.getElementById("submitButton").remove(); // удалить кнопку если запрос отправлен на youtube
  const oldBtn = document.getElementById("confirmButton");
  if (oldBtn) oldBtn.remove();

  const data = {
    name: nameInput.value,
  };

  // Простая проверка перед отправкой (дублирует серверную, но для UX полезно)
  if (!data.name) {
    resultDiv.innerHTML = "Введите ссылку!";
    return;
  }

  // Отправляем запрос на получение информации
  await sendRequestAndUpdateResult("/", data);

  // Проверяем ответ и создаем кнопку скачивания
  checkDivIsNotEmpty();
};

form.addEventListener("submit", handleSubmit);

// Обработчик события клика по созданной кнопке для отправки запроса на скачивание
const btnSubmit = async function () {
  console.log("Начало скачивания...");

  const confirmBtn = document.getElementById("confirmButton");
  if (confirmBtn) confirmBtn.remove();

  // Показываем статус
  resultDiv.innerHTML = "Подготовка файла... Пожалуйста, подождите.";
  showAnimation();

  const data = {
    name: nameInput.value,
  };

  try {
    // 1. Отправляем запрос на скачивание. Сервер вернет JSON { taskId: "..." }
    const responseData = await axios.post("/data", data);
    const taskId = responseData.data.taskId;

    if (!taskId) {
      throw new Error("Не получен ID задачи");
    }

    // 2. Подключаемся к SSE с конкретным ID задачи
    const eventSource = new EventSource(`/progress/${taskId}`);

    eventSource.onmessage = function (event) {
      try {
        const taskData = JSON.parse(event.data);

        // Обновляем сообщение и прогресс в реальном времени
        let progressText = "";
        if (taskData.stage === "downloading") {
          progressText = `📥 ${taskData.message} ${Math.round(taskData.progress)}%`;
        } else if (taskData.stage === "converting") {
          progressText = `⚙️ ${taskData.message} ${Math.round(taskData.progress)}%`;
        } else if (taskData.stage === "init") {
          progressText = `🕒 ${taskData.message}`;
        }

        resultDiv.innerHTML = progressText;

        if (taskData.status === "finished") {
          eventSource.close();
          closeAnimation();
          resultDiv.innerHTML = "<strong>✅ Готово! Загрузка файла...</strong>";

          // Автоматическое скачивание
          const link = document.createElement("a");
          link.href = `/download/${taskId}`;
          link.style.display = "none";
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);

          setTimeout(() => {
            nameInput.removeAttribute("readonly");
            resultDiv.innerHTML = "";
          }, 5000);
        } else if (taskData.status === "error") {
          eventSource.close();
          closeAnimation();
          resultDiv.innerHTML = "Ошибка при обработке видео.";
        }
      } catch (e) {
        console.error("Ошибка парсинга SSE:", e);
      }
    };

    eventSource.onerror = function () {};
  } catch (error) {
    console.error(error);
    closeAnimation();
    resultDiv.innerHTML = "Ошибка при запуске скачивания.";
  }
};

// анимация в момент запроса данных
function showAnimation() {
  if (statusElement) {
    statusElement.className = "loadingio-spinner-ellipsis-29linrtctor";
  }
}
function closeAnimation() {
  if (statusElement) {
    statusElement.classList.remove("loadingio-spinner-ellipsis-29linrtctor");
  }
}

// автовызываемая функция затемнения навигационного бара по скроллингу
(function () {
  const header = document.getElementsByClassName("header")[0];
  if (header) {
    window.onscroll = function () {
      if (window.pageYOffset > 50) {
        header.classList.add("header__active");
      } else {
        header.classList.remove("header__active");
      }
    };
  }
})();

// burger handler
(function () {
  const burgerItem = document.querySelector(".header__burger");
  const menu = document.querySelector(".header__nav");
  const menuClose = document.querySelector(".header__nav_close");

  if (burgerItem && menu) {
    burgerItem.addEventListener("click", () => {
      menu.classList.add("header__nav_active");
    });
  }
  if (menuClose && menu) {
    menuClose.addEventListener("click", () => {
      menu.classList.remove("header__nav_active");
    });
  }
})();

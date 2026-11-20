"use strict";

(() => {
  const root = document.querySelector("#subscriptions");
  const tabs = root?.querySelector("#subscription-switch");
  const panel = root?.querySelector("#subscription-cards");
  if (!tabs || !panel) return;

  const singlePrices = {
    "Начинающий": { pdf: 49, video: 149 },
    "Продвинутый": { pdf: 99, video: 249 },
  };
  const subscriptionPrices = {
    4: { "Начинающий": { pdf: 149, video: 399 }, "Продвинутый": { pdf: 299, video: 699 } },
    8: { "Начинающий": { pdf: 269, video: 699 }, "Продвинутый": { pdf: 539, video: 1190 } },
  };
  const levels = ["Начинающий", "Продвинутый"];
  const formats = ["pdf", "video"];
  let count = 4;
  const rub = (value) => new Intl.NumberFormat("ru-RU").format(value) + " ₽";

  function requestLink(level, format, price) {
    const message = [
      "Здравствуйте! Хочу оформить подписку на разборы песен «Струны будущего».",
      "Количество: " + count + " песен в месяц",
      "Уровень: " + level,
      "Формат: " + (format === "video" ? "PDF + видеоразборы" : "Только PDF"),
      "Стоимость: " + rub(price) + " в месяц",
      "Подскажите, пожалуйста, как оплатить и получить доступ.",
    ].join("\n");
    return "https://t.me/nikguitar?text=" + encodeURIComponent(message);
  }

  function render() {
    tabs.querySelectorAll("[data-count]").forEach((tab) => {
      const selected = Number(tab.dataset.count) === count;
      tab.setAttribute("aria-selected", String(selected));
      tab.tabIndex = selected ? 0 : -1;
    });
    panel.setAttribute("aria-labelledby", "subscription-count-" + count);
    panel.innerHTML = levels.flatMap((level) => formats.map((format) => {
      const video = format === "video";
      const price = subscriptionPrices[count][level][format];
      const retail = singlePrices[level][format] * count;
      const discount = Math.round((retail - price) * 100 / retail);
      const title = video ? "С видеоразборами" : "Самостоятельная игра";
      const description = video ? "Полный формат обучения: видеообъяснение и PDF к каждой песне." : "Аккорды, схемы, табулатуры и подсказки в удобном PDF.";
      return `<article class="subscription-card${video ? " sub-video" : ""}">
        <div class="sub-card-top"><span class="sub-level">${level}</span><span class="sub-type">${video ? "PDF + ВИДЕО" : "ТОЛЬКО PDF"}</span></div>
        <h3 class="sub-card-title">${title}</h3>
        <p class="sub-card-description">${description}</p>
        <div class="sub-price"><strong>${rub(price)}</strong><small>/ месяц</small></div>
        <div class="sub-discount"><span>Отдельно <s>${rub(retail)}</s></span><b>Выгода ${discount}%</b></div>
        <ul class="sub-features">
          <li>${count} ${count === 4 ? "песни" : "песен"} из раздела «${level}»</li>
          <li>PDF можно скачать и сохранить</li>
          <li>${video ? "Видео доступны онлайн при активной подписке" : "PDF без видеоразборов"}</li>
          <li>Новый выбор песен каждый оплаченный месяц</li>
        </ul>
        <a class="sub-cta" target="_blank" rel="noopener noreferrer" href="${requestLink(level, format, price)}">Выбрать тариф <span aria-hidden="true">↗</span></a>
      </article>`;
    })).join("");
  }

  tabs.querySelectorAll("[data-count]").forEach((tab, index, allTabs) => {
    tab.addEventListener("click", () => {
      count = Number(tab.dataset.count);
      render();
    });
    tab.addEventListener("keydown", (event) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      event.preventDefault();
      const nextIndex = (index + (event.key === "ArrowRight" ? 1 : -1) + allTabs.length) % allTabs.length;
      allTabs[nextIndex].focus();
      allTabs[nextIndex].click();
    });
  });
  render();
})();

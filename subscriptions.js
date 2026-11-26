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
    panel.innerHTML = levels.map((level, index) => {
      const plans = formats.map((format) => {
        const video = format === "video";
        const price = subscriptionPrices[count][level][format];
        const retail = singlePrices[level][format] * count;
        const discount = Math.round((retail - price) * 100 / retail);
        const title = video ? "PDF + видео" : "Только PDF";
        const description = video ? "Видеоразборы онлайн без скачивания, пока подписка действует." : "Для самостоятельной игры.";
        return `<div class="sub-plan${video ? " sub-video" : ""}">
          <h4 class="sub-card-title">${title}</h4>
          <p class="sub-card-description">${description}</p>
          <div class="sub-price"><strong>${rub(price)}</strong><small>/ месяц</small></div>
          <div class="sub-discount"><span>Отдельно <s>${rub(retail)}</s></span><b>Выгода ${discount}%</b></div>
          <a class="sub-cta" target="_blank" rel="noopener noreferrer" href="${requestLink(level, format, price)}" aria-label="Выбрать тариф: ${level}, ${title}, ${count} песен в месяц">Выбрать <span aria-hidden="true">↗</span></a>
        </div>`;
      }).join("");
      return `<article class="subscription-group" aria-labelledby="sub-level-${index}">
        <header class="sub-group-heading">
          <h3 id="sub-level-${index}">${level}</h3>
          <span>${count} ${count === 4 ? "песни" : "песен"} в месяц из своего раздела</span>
        </header>
        <div class="sub-plans">${plans}</div>
      </article>`;
    }).join("");
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

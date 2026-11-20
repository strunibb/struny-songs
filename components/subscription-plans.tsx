"use client";

import { useState } from "react";
import styles from "./subscription-plans.module.css";

type SongCount = 4 | 8;
type SongLevel = "Начинающий" | "Продвинутый";
type PlanFormat = "pdf" | "video";

type SubscriptionPlan = {
  level: SongLevel;
  format: PlanFormat;
  price: number;
  singlePrice: number;
};

const plans: Record<SongCount, SubscriptionPlan[]> = {
  4: [
    { level: "Начинающий", format: "pdf", price: 149, singlePrice: 49 },
    { level: "Начинающий", format: "video", price: 399, singlePrice: 149 },
    { level: "Продвинутый", format: "pdf", price: 299, singlePrice: 99 },
    { level: "Продвинутый", format: "video", price: 699, singlePrice: 249 },
  ],
  8: [
    { level: "Начинающий", format: "pdf", price: 269, singlePrice: 49 },
    { level: "Начинающий", format: "video", price: 699, singlePrice: 149 },
    { level: "Продвинутый", format: "pdf", price: 539, singlePrice: 99 },
    { level: "Продвинутый", format: "video", price: 1190, singlePrice: 249 },
  ],
};

const formatPrice = (price: number) => price.toLocaleString("ru-RU");

function telegramLink(plan: SubscriptionPlan, count: SongCount): string {
  const message = [
    "Здравствуйте! Хочу оформить подписку «Струны будущего».",
    `Количество: ${count} песен в месяц`,
    `Раздел: ${plan.level}`,
    `Формат: ${plan.format === "pdf" ? "Только PDF" : "PDF + видеоразборы"}`,
    `Стоимость: ${formatPrice(plan.price)} ₽/мес`,
    "Подскажите, пожалуйста, как оформить доступ.",
  ].join("\n");

  return `https://t.me/nikguitar?text=${encodeURIComponent(message)}`;
}

export function SubscriptionPlans() {
  const [songCount, setSongCount] = useState<SongCount>(4);

  return (
    <section className={styles.section} id="subscriptions" aria-labelledby="subscriptions-title">
      <div className="shell">
        <div className={styles.heading}>
          <p className="eyebrow"><i /> Ваша музыка каждый месяц</p>
          <h2 id="subscriptions-title">
            Разбирайте любимые песни.
            <span> Платите меньше.</span>
          </h2>
          <p className={styles.intro}>
            Выберите свой уровень и изучайте 4 или 8 песен в месяц.
            Скачивайте PDF или занимайтесь по подробным видеоразборам.
          </p>
        </div>

        <div className={styles.switcher} role="tablist" aria-label="Количество песен в месяц">
          {([4, 8] as const).map((count) => (
            <button
              key={count}
              type="button"
              id={`subscription-tab-${count}`}
              role="tab"
              aria-selected={songCount === count}
              aria-controls="subscription-options"
              className={songCount === count ? styles.activeTab : ""}
              onClick={() => setSongCount(count)}
            >
              <span className={styles.tabNumber}>{count}</span>
              <span className={styles.tabDetails}>
                <strong>{count} песни в месяц</strong>
                <small>{count === 4 ? "1 песня в неделю" : "2 песни в неделю"}</small>
              </span>
              {count === 8 && <span className={styles.tabBonus}>Выгоднее</span>}
            </button>
          ))}
        </div>

        <div
          className={styles.grid}
          role="tabpanel"
          id="subscription-options"
          aria-labelledby={`subscription-tab-${songCount}`}
          key={songCount}
        >
          {plans[songCount].map((plan) => {
            const isVideo = plan.format === "video";
            const retail = plan.singlePrice * songCount;
            const saving = Math.round((1 - plan.price / retail) * 100);

            return (
              <article
                key={`${plan.level}-${plan.format}`}
                className={`${styles.card} ${isVideo ? styles.videoCard : ""}`}
              >
                <div className={styles.cardTop}>
                  <span className={styles.level}>{plan.level}</span>
                  <span className={styles.format}>{isVideo ? "PDF + ВИДЕО" : "ТОЛЬКО PDF"}</span>
                </div>
                <h3>{isVideo ? "С видеоразборами" : "Для самостоятельной игры"}</h3>
                <p className={styles.cardDescription}>
                  {isVideo
                    ? "Разбирайте песни по видео и закрепляйте материал с PDF."
                    : "Изучайте песни по удобным PDF-разборам."}
                </p>

                <div className={styles.priceRow}>
                  <strong>{formatPrice(plan.price)} ₽</strong>
                  <span>/ месяц</span>
                </div>
                <div className={styles.saving}>
                  <span>Вместо <s>{formatPrice(retail)} ₽</s> по отдельности</span>
                  <strong>−{saving}%</strong>
                </div>

                <ul className={styles.features}>
                  <li>{songCount} песни из раздела «{plan.level}»</li>
                  <li>PDF можно скачать и сохранить</li>
                  <li>{isVideo ? "Видео доступны для просмотра на сайте" : "Без видеоразборов"}</li>
                  <li>Новый выбор песен каждый оплаченный месяц</li>
                </ul>

                <a
                  className={`${styles.cta} ${isVideo ? styles.videoCta : ""}`}
                  href={telegramLink(plan, songCount)}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Оформить подписку: ${songCount} песни, ${plan.level}, ${isVideo ? "PDF и видео" : "PDF"}, ${formatPrice(plan.price)} рублей в месяц`}
                >
                  Выбрать тариф <span aria-hidden="true">↗</span>
                </a>
              </article>
            );
          })}
        </div>

        <div className={styles.bottom}>
          <p>PDF остаются у вас после скачивания. Видео по подписке доступны онлайн, пока подписка активна. Выбор видеоразборов зависит от готовых материалов в каталоге.</p>
          <a href="#catalog">Или выберите песню отдельно <span aria-hidden="true">↓</span></a>
        </div>
      </div>
    </section>
  );
}

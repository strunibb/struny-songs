import { readFile, writeFile } from "node:fs/promises";

const [, , inputPath, outputPath = "lib/song-library.ts"] = process.argv;

if (!inputPath) {
  throw new Error("Укажите путь к Markdown-файлу со списком песен.");
}

const source = await readFile(inputPath, "utf8");
const transliteration = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i", й: "y",
  к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f",
  х: "h", ц: "ts", ч: "ch", ш: "sh", щ: "sch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
};

function slugify(value) {
  return value.toLowerCase().split("").map((char) => transliteration[char] ?? char).join("")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "song";
}
const entries = source
  .split(/\r?\n/)
  .filter((line) => line.startsWith("·"))
  .map((line) => line.replace(/^·[\s\u00a0]*/, "").trim())
  .filter(Boolean)
  .map((line) => {
    const separator = line.includes(" — ") ? " — " : line.includes(" - ") ? " - " : null;
    if (!separator) return { artist: "Исполнитель не указан", title: line };
    const [artist, ...titleParts] = line.split(separator);
    return { artist: artist.trim(), title: titleParts.join(separator).trim() };
  });

const seen = new Set();
const usedSlugs = new Set();
const songs = entries.filter(({ artist, title }) => {
  const key = `${artist}\u0000${title}`.normalize("NFKC").toLocaleLowerCase("ru");
  if (seen.has(key)) return false;
  seen.add(key);
  return true;
}).map(({ artist, title }) => {
  const base = `library-${slugify(`${artist}-${title}`)}`;
  let slug = base;
  let suffix = 2;
  while (usedSlugs.has(slug)) slug = `${base}-${suffix++}`;
  usedSlugs.add(slug);
  return { slug, artist, title };
});

const output = `// Сгенерировано из пользовательского списка. Не редактировать вручную.\nexport const pendingSongLibrary = ${JSON.stringify(songs, null, 2)} as const;\n`;
await writeFile(outputPath, output, "utf8");
console.log(`Сохранено песен: ${songs.length}`);

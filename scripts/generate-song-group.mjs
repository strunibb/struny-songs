import { readFile, writeFile } from "node:fs/promises";

const [, , inputPath, exportName, outputPath, slugPrefix = "beginner"] = process.argv;

if (!inputPath || !exportName || !outputPath) {
  throw new Error("Использование: node generate-song-group.mjs <список.md> <exportName> <output.ts>");
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
  .filter((line) => /^-\s+/.test(line))
  .map((line) => line.replace(/^-\s+/, "").trim())
  .filter(Boolean)
  .map((line) => {
    const separator = line.includes(" — ") ? " — " : line.includes(" - ") ? " - " : null;
    if (!separator) return { artist: "Исполнитель не указан", title: line };
    const [artist, ...titleParts] = line.split(separator);
    return { artist: artist.trim(), title: titleParts.join(separator).trim() };
  });

const seen = new Set();
const usedSlugs = new Set();
const unique = entries.filter(({ artist, title }) => {
  const key = `${artist}\u0000${title}`.normalize("NFKC").toLocaleLowerCase("ru");
  if (seen.has(key)) return false;
  seen.add(key);
  return true;
}).map(({ artist, title }) => {
  const base = `${slugPrefix}-${slugify(`${artist}-${title}`)}`;
  let slug = base;
  let suffix = 2;
  while (usedSlugs.has(slug)) slug = `${base}-${suffix++}`;
  usedSlugs.add(slug);
  return { slug, artist, title };
});

const output = `// Сгенерировано из пользовательского распределения. Не редактировать вручную.\nexport const ${exportName} = ${JSON.stringify(unique, null, 2)} as const;\n`;
await writeFile(outputPath, output, "utf8");
console.log(`Сохранено песен: ${unique.length}`);

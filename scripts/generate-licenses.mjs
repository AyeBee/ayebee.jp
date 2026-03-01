// scripts/generate-licenses.mjs
import { writeFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { Interface } from "node:readline";
const require = createRequire(import.meta.url);
const checker = require("license-checker-rseidelsohn");

const ROOT = process.cwd();
const OUTPUT = path.resolve(ROOT, "public/third-party-licenses.json");

// ルート package.json から自分のパッケージ名を取得（なければ空）
let SELF_NAME = "";
try {
  const pkgJson = JSON.parse(
    await readFile(path.resolve(ROOT, "package.json"), "utf8")
  );
  SELF_NAME = pkgJson?.name ?? "";
} catch {}

// 除外対象のパッケージ名にマッチする正規表現を列挙
let EXCLUDE_NAME_REGEXES = [
  // ここに除外したいパッケージ名パターンを追加
  // /^@types\//, /^eslint/, /^prettier/,
];
// 自分自身を除外対象に追加
SELF_NAME && EXCLUDE_NAME_REGEXES.push(new RegExp(SELF_NAME));

// Windows/Unix 両対応のため、パスをスラッシュで正規化して判定
const inNodeModules = (p) => {
  if (!p || typeof p !== "string") return false;
  const norm = p.replace(/\\/g, "/");
  return norm.includes("/node_modules/");
};

function normalize(data) {
  const items = Object.entries(data)
    .map(([key, v]) => {
      // key 例: "react@18.3.1" <- 最後に登場する '@' を基準に 名前 と バージョン に分割
      const at = key.lastIndexOf("@");
      const name = key.slice(0, at);
      const version = key.slice(at + 1);
      return {
        name,
        version,
        licenses: Array.isArray(v.licenses)
          ? v.licenses.join(", ")
          : v.licenses || "UNKNOWN",
        repository: v.repository || v.homepage || "",
        publisher: v.publisher || v.author || "",
        licenseFile: v.licenseFile || "",
        path: v.path || "",
      };
    })
    // 除外対象を除外
    .filter((x) => !EXCLUDE_NAME_REGEXES.some((re) => re.test(x.name)))
    // node_modules 配下にない（= ローカル/ワークスペース直参照）ものを除外
    .filter((x) => inNodeModules(x.path))
    // 出力する項目名の選択
    .map(
      ({
        name,
        version,
        licenses,
        repository,
        publisher,
        licenseFile,
        path,
      }) => {
        return {
          name,
          version,
          licenses,
          repository,
          publisher,
        };
      }
    )
    .sort((a, b) => a.name.localeCompare(b.name));
  return items;
}

async function main() {
  const data = await new Promise((resolve, reject) => {
    checker.init(
      {
        start: ROOT,
        production: true, // 開発依存も入れたいなら false
        direct: false, // 直接依存のみなら true
      },
      (err, json) => (err ? reject(err) : resolve(json))
    );
  });

  const normalized = normalize(data);

  await mkdir(path.dirname(OUTPUT), { recursive: true });
  await writeFile(
    OUTPUT,
    JSON.stringify(
      { generatedAt: new Date().toISOString(), items: normalized },
      null,
      2
    ),
    "utf8"
  );

  console.log(`Wrote ${OUTPUT} (${normalized.length} packages)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

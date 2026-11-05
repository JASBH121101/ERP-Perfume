import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { build } from "esbuild";

const root = process.cwd();
const output = new URL("../dist/", import.meta.url);
const outDir = new URL("../dist/", import.meta.url);

await rm(outDir, { recursive: true, force: true });
await mkdir(new URL("../dist/assets/js/", import.meta.url), { recursive: true });
await cp(new URL("../index.html", import.meta.url), new URL("../dist/index.html", import.meta.url));
await cp(new URL("../assets/css/", import.meta.url), new URL("../dist/assets/css/", import.meta.url), { recursive: true });
await cp(new URL("../assets/images/", import.meta.url), new URL("../dist/assets/images/", import.meta.url), { recursive: true });

await build({
  entryPoints: ["assets/js/bootstrap.mjs"],
  bundle: true,
  format: "esm",
  platform: "browser",
  target: ["es2022"],
  outfile: "dist/assets/js/app.js",
  minify: true,
  legalComments: "none"
});

const htmlPath = new URL("../dist/index.html", import.meta.url);
const html = await readFile(htmlPath, "utf8");
await writeFile(htmlPath, html.replace('src="assets/js/bootstrap.mjs"', 'src="assets/js/app.js"'), "utf8");
console.log("Built static ERP assets and bundled browser authentication client.");

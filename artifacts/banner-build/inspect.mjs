import fs from "node:fs/promises";
import { FileBlob, PresentationFile } from "@oai/artifact-tool";

const sourcePath = "/home/rafael/Downloads/AnaliseBanner (2).pptx";
const outputDir = "/home/rafael/Documentos/TCC-Teste2/Front-end para academia/artifacts/banner-build";

const presentation = await PresentationFile.importPptx(await FileBlob.load(sourcePath));
const snapshot = await presentation.inspect({
  kind: "deck,slide,textbox,shape,image,table,chart,notes,layout",
  include: "id,slide,name,title,bbox,text,textPreview,textChars,textLines,alt,isPlaceholder,placeholders",
  maxChars: 30000,
});
await fs.writeFile(`${outputDir}/source-inspect.ndjson`, snapshot.ndjson);

const slide = presentation.slides.getItem(0);
const preview = await slide.export({ format: "png", scale: 1 });
await fs.writeFile(`${outputDir}/source-slide.png`, new Uint8Array(await preview.arrayBuffer()));
const layout = await slide.export({ format: "layout" });
await fs.writeFile(`${outputDir}/source-layout.json`, await layout.text());

console.log(snapshot.ndjson);

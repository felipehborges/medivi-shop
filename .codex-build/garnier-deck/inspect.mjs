import { FileBlob, PresentationFile } from "@oai/artifact-tool";
const source = "C:/Users/felipe.borges/Downloads/Desafio_Reimagine_um_Produto_Garnier_Derma_EDITAVEL.pptx";
const p = await PresentationFile.importPptx(await FileBlob.load(source));
const out = await p.inspect({kind:"slide,textbox,shape,image,table,chart,notes,layout", maxChars:40000});
console.log(out.ndjson);
console.log(JSON.stringify({slides:p.slides.items.length, masters:p.masters.items.length}, null, 2));

// Carrega o pdfjs sob demanda (só quando alguém abre "Importar orçamento"). O código vem de vendor/pdfjs, sem CDN.
let promessa;
export function carregarPdfjs() {
  promessa ??= import("../../vendor/pdfjs/pdf.min.mjs").then((pdfjs) => {
    pdfjs.GlobalWorkerOptions.workerSrc = new URL("../../vendor/pdfjs/pdf.worker.min.mjs", import.meta.url).href;
    return pdfjs;
  });
  return promessa;
}

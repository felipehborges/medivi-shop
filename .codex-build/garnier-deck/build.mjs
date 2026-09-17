import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { FileBlob, PresentationFile } from "@oai/artifact-tool";

const workspaceDir = "C:/Users/felipe.borges/code/hamasaki/medivi-shop";
const sourcePath = "C:/Users/felipe.borges/Downloads/Desafio_Reimagine_um_Produto_Garnier_Derma_EDITAVEL.pptx";
const buildDir = path.join(workspaceDir, ".codex-build/garnier-deck");
const outputDir = path.join(workspaceDir, "output");
const finalPath = path.join(outputDir, "Desafio_Garnier_Derma_C_Final_v2.pptx");
const skillDir = "C:/Users/felipe.borges/.codex/plugins/cache/openai-primary-runtime/presentations/26.909.61513/skills/presentations";
const pythonExecutable = "C:/Users/felipe.borges/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe";

const presentation = await PresentationFile.importPptx(await FileBlob.load(sourcePath));
const replacements = new Map([
  ["DERMA C+", "DERMA C+"],
  ["Um sérum de alta performance que leva a força da rotina Garnier para um território mais próximo da ciência dermatológica.", "O Sérum Booster Anti-Marcas reimaginado como tratamento diário para marcas pós-acne e tom irregular, com protocolo claro e prova de eficácia."],
  ["HIDRATA", "RENOVA"],
  ["Ácido hialurônico", "Ácido salicílico"],
  ["O consumidor começa acessível, aprende sobre skincare e passa a buscar mais eficácia.", "Quem começou no skincare acessível passa a exigir resultados comprovados, sem aceitar uma rotina mais complexa."],
  ["“O consumidor em evolução”: já conhece ativos, pesquisa antes de comprar e quer resultados sem complicar a rotina.", "Já conhece ativos e compara fórmulas, mas ainda quer orientação simples, preço alcançável e uso diário."],
  ["Ciência dermatológica + praticidade + acessibilidade em um único tratamento diário.", "Correção de marcas com tolerância comprovada, orientação de uso e preço de entrada na categoria."],
  ["Uma ponte entre skincare de massa e dermocosméticos: mais ciência sem perder o DNA democrático da Garnier.", "A porta de entrada da Beleza Dermatológica: rigor de prova e linguagem simples, sem competir com tratamentos especializados."],
  ["Acessibilidade, praticidade, linguagem próxima e o DNA de cuidado diário da Garnier.", "Preço alcançável, textura leve, uso diário e linguagem direta. Vitamina C e niacinamida continuam no centro da fórmula."],
  ["Mais ciência, percepção de eficácia, embalagem premium, ativos em destaque e presença em canais de saúde e skincare.", "Validação clínica, avaliação de tolerância e embalagem airless. A venda migra para farmácias e e-commerce com orientação especializada."],
  ["GARNIER DERMA", "DERMA C+"],
  ["MAIOR VALOR PERCEBIDO", "ENTRADA EM DERMOCOSMÉTICOS"],
  ["Evoluir sem romper: a marca acompanha o consumidor conforme sua necessidade de cuidado aumenta.", "A nova proposta acompanha o consumidor que busca mais eficácia, sem abandonar a simplicidade que o trouxe à Garnier."],
  ["SUA PELE EVOLUIU.", "MARCAS VISÍVEIS."],
  ["SEU SKINCARE TAMBÉM.", "ROTINA SIMPLES."],
  ["CIÊNCIA PARA A\nROTINA REAL.", "EFICÁCIA CLÍNICA.\nROTINA SIMPLES."],
  ["Mais confiança, eficácia percebida e rotina simplificada.", "Mais segurança na escolha, instruções claras e uma rotina simples para tratar marcas."],
  ["Maior ticket médio e entrada em um território de maior valor.", "Maior ticket médio e credibilidade no canal farma, com uma porta de entrada para a categoria."],
  ["Cria uma jornada de evolução dentro do ecossistema da companhia.", "Retém o consumidor antes que ele migre para marcas dermatológicas fora do grupo."],
  ["Não afastar o consumidor atual com excesso de linguagem clínica.", "A linguagem clínica pode enfraquecer o vínculo acessível e próximo da Garnier."],
  ["Diferenciar claramente a proposta frente aos dermocosméticos do grupo.", "A nova linha pode sobrepor ofertas de CeraVe, Vichy e La Roche-Posay."],
  ["Sustentar comunicação com testes e evidências de eficácia.", "Claims exigem estudos robustos, avaliação de tolerância e comunicação regulatória precisa."],
  ["Aumento de valor percebido e ticket médio.", "Trade-up dentro da marca, com margem e ticket maiores sem abandonar o preço de entrada."],
  ["Garnier mais associada a ciência e inovação.", "Maior associação da Garnier com eficácia comprovada e cuidado dermatológico acessível."],
  ["Maior retenção ao longo da evolução de sua rotina.", "Mais retenção e uma progressão clara para soluções especializadas do portfólio L’Oréal."],
  ["DA BELEZA ACESSÍVEL PARA O CUIDADO COM PRECISÃO.", "DERMOCOSMÉTICO DE ENTRADA, COM A SIMPLICIDADE DA GARNIER."],
]);

for (const slide of presentation.slides.items) {
  for (const [from, to] of replacements) {
    for (const item of slide.shapes.items) {
      if (item.text?.replace && item.text.toString().includes(from)) {
        item.text.replace(from, to);
      }
    }
  }
}
const campaignLine2 = presentation.resolve("sh/hcvy14ne");
campaignLine2.position.top = 558.72;

presentation.slides.items[0].speakerNotes.textFrame.setText(
  "Produto de origem: Garnier SkinActive Sérum Booster Anti-Marcas com Vitamina C. A página oficial informa Vitamina C, niacinamida, extrato de limão e ácido salicílico na fórmula. Fonte: https://www.garnier.com.br/loja/pele/necessidade/hidratacao/serum-garnier-antimarcas-com-vitamina-c (acesso em 15 set. 2026). A versão Derma C+ Corretor é uma proposta conceitual."
);
presentation.slides.items[1].speakerNotes.textFrame.setText(
  "A L’Oréal Brasil posiciona Garnier em Produtos de Grande Público e descreve Beleza Dermatológica como uma divisão de soluções de alta eficácia, com presença em farmácias, drogarias e canais exclusivos. Fonte: https://www.loreal.com/pt-br/brazil/news/grupo/conheca-as-24-marcas-que-fazem-parte-do-grupo-loreal/ (acesso em 15 set. 2026). Embalagem, validação, canais e resultados apresentados são decisões e hipóteses da proposta."
);

await fs.mkdir(outputDir, { recursive: true });
const { finalizePresentation } = await import(pathToFileURL(path.join(skillDir, "container_tools/artifact_tool_utils.mjs")).href);
const candidatePath = path.join(buildDir, "candidate.pptx");
await (await PresentationFile.exportPptx(presentation)).save(candidatePath);
const requirements = {
  explicitTotalSlideCount: 2,
  requiredNativeTableOwnerSlides: [],
  requiredNativeChartOwnerSlides: [],
};
await finalizePresentation({
  ...requirements,
  workspaceDir,
  candidatePath,
  finalPath,
  pythonExecutable,
  integrityValidatorPath: path.join(skillDir, "container_tools/inspect_presentation_package_integrity.py"),
  layoutValidatorPath: path.join(skillDir, "container_tools/inspect_presentation_layout_geometry.py"),
  layoutArgs: ["--expected-slide-size-emu", "7562088,10689336", "--validate-bullet-geometry", "--validate-heading-fit"],
  verifyArtifactToolImport: true,
  receiptPath: path.join(buildDir, "validation-final-v2.json"),
});
console.log(finalPath);

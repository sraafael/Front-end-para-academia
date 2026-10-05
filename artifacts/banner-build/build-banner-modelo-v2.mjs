import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { FileBlob, PresentationFile } from "@oai/artifact-tool";

const workspaceDir = "/home/rafael/Documentos/TCC-Teste2/Front-end para academia";
const sourcePath = "/home/rafael/Downloads/AnaliseBanner (2).pptx";
const profileImagePath = path.join(workspaceDir, "artifacts/assets/screens/fitpro-perfis.png");
const studentImagePath = path.join(workspaceDir, "artifacts/assets/doc-media/image18.png");
const outputDir = path.join(workspaceDir, "artifacts/entregaveis/banner");
const TMP_DIR = path.join(workspaceDir, "artifacts/banner-build/private-modelo-v3");
const FINAL_PPTX = path.join(outputDir, "Banner_TCC_FitPro_Rafael_Bavaresco_modelo_v3.pptx");
const SKILL_DIR = "/home/rafael/.codex/plugins/cache/openai-primary-runtime/presentations/26.921.10847/skills/presentations";
const RUNTIME_PYTHON = "/home/rafael/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3";

const { finalizePresentation } = await import(
  pathToFileURL(path.join(SKILL_DIR, "container_tools/artifact_tool_utils.mjs")).href
);

await fs.mkdir(TMP_DIR, { recursive: true });
await fs.mkdir(outputDir, { recursive: true });

const presentation = await PresentationFile.importPptx(await FileBlob.load(sourcePath));
const slide = presentation.slides.getItem(0);

const BLACK = "#000000";

function paragraph(text, spaceAfterPoints = 8) {
  return {
    runs: [text],
    spaceAfter: Math.round(spaceAfterPoints * 100),
  };
}

function heading(text) {
  return {
    runs: [{
      run: text,
      textStyle: {
        bold: true,
        fontSize: "30pt",
        typeface: "Arial",
        color: BLACK,
      },
    }],
    spaceAfter: 900,
  };
}

function setSection(shapeId, paragraphs, fontSize = 40, alignment = "justify") {
  const shape = presentation.resolve(shapeId);
  shape.text = paragraphs;
  shape.text.style = {
    typeface: "Arial",
    fontSize,
    color: BLACK,
    alignment,
    verticalAlignment: "top",
    autoFit: "none",
    wrap: "square",
  };
  return shape;
}

const header = presentation.resolve("sh/sryl4zqx");
header.text = "APRESENTAÇÃO DE TRABALHOS DE CONCLUSÃO DE CURSO\n2026";
header.text.style = {
  typeface: "Arial Black",
  fontSize: 66.67,
  bold: true,
  color: BLACK,
  alignment: "center",
  verticalAlignment: "middle",
  autoFit: "none",
  wrap: "square",
};

const workTitle = presentation.resolve("sh/65g3298r");
workTitle.text = "FITPRO: SISTEMA WEB PARA GESTÃO DE PEQUENAS ACADEMIAS";
workTitle.text.style = {
  typeface: "Arial Black",
  fontSize: 88,
  bold: true,
  color: BLACK,
  alignment: "center",
  verticalAlignment: "middle",
  autoFit: "none",
  wrap: "square",
};

const authors = presentation.resolve("sh/547294r6");
authors.text = "Aluno: Rafael Bavaresco Messias Moura¹,\nOrientador: Prof. Esp. Célio Desiró²";
authors.text.style = {
  typeface: "Arial",
  fontSize: 80,
  color: BLACK,
  alignment: "center",
  verticalAlignment: "middle",
  autoFit: "none",
  wrap: "square",
};

const affiliation = presentation.resolve("sh/fu94fe98");
affiliation.text = [
  [{ run: "¹ Graduando em Análise e Desenvolvimento de Sistemas pela Fundação Educacional do Município de Assis (FEMA).", textStyle: { fontSize: "28pt", typeface: "Arial" } }],
  [{ run: "² Especialista. Docente e orientador do curso de Análise e Desenvolvimento de Sistemas da Fundação Educacional do Município de Assis (FEMA).", textStyle: { fontSize: "28pt", typeface: "Arial" } }],
];
affiliation.text.style = {
  typeface: "Arial",
  fontSize: 37.33,
  color: BLACK,
  alignment: "center",
  verticalAlignment: "middle",
  autoFit: "none",
  wrap: "square",
};

setSection("sh/wn6dc7eh", [
  heading("INTRODUÇÃO"),
  paragraph("Pequenas academias podem enfrentar dificuldades quando cadastros, frequência, treinos e controles financeiros permanecem distribuídos entre papéis, planilhas e aplicativos de mensagens. Essa fragmentação reduz a padronização, dificulta a consulta ao histórico e aumenta o retrabalho. Sistemas de informação podem organizar esses fluxos quando são projetados a partir das necessidades reais dos usuários [1]."),
  paragraph("Neste contexto, este trabalho apresenta o FitPro, sistema web desenvolvido para apoiar a gestão do Studio Bio Fitness. A aplicação reúne rotinas administrativas e de acompanhamento em áreas específicas para proprietário, administração, professor e aluno. A versão atual utiliza React e TypeScript no front-end, Supabase como Backend-as-a-Service e PostgreSQL para persistência dos dados."),
  paragraph("A digitalização também exige cuidados com dados pessoais. Nome, CPF, telefone, e-mail e registros ligados à saúde requerem controles de acesso e medidas técnicas adequadas à Lei Geral de Proteção de Dados Pessoais [2]. O trabalho investiga como um sistema integrado pode reduzir a fragmentação operacional e evoluir com segurança para um ambiente de produção.", 0),
]);

setSection("sh/1cvuxc7e", [
  heading("OBJETIVOS"),
  paragraph("O objetivo geral é desenvolver e avaliar o FitPro como aplicação web de apoio à gestão do Studio Bio Fitness. O projeto busca centralizar cadastros, turmas, planos, finanças, frequência, treinos e evolução de peso. Também organiza o acesso por perfil, valida a persistência dos dados e identifica medidas necessárias para a evolução segura do sistema.", 0),
], 40, "justify");

setSection("sh/sfqdkrep", [
  heading("DESCRIÇÃO METODOLÓGICA"),
  paragraph("O trabalho caracteriza-se como desenvolvimento tecnológico aplicado, de natureza exploratória e abordagem qualitativa. O levantamento de necessidades ocorreu de forma imersiva no Studio Bio Fitness, por meio da observação da rotina, de conversas com pessoas envolvidas na operação e de revisões sucessivas das telas e fluxos."),
  paragraph("O desenvolvimento seguiu ciclos incrementais de compreensão do problema, implementação e revisão, em alinhamento com princípios ágeis [3]. Os requisitos foram confrontados com o código e com a execução dos fluxos disponíveis. A validação considerou o comportamento dos perfis, a persistência no Supabase, o isolamento entre academias e as limitações ainda presentes. Os resultados descrevem o contexto estudado e não representam inferência estatística sobre o setor.", 0),
]);

setSection("sh/0bmd476t", [
  heading("RESULTADOS E DISCUSSÃO"),
  paragraph("O levantamento realizado no Studio Bio Fitness mostrou a necessidade de centralizar informações antes consultadas em registros separados. O FitPro passou a reunir, em uma única aplicação, o cadastro de academias, administradores, alunos, professores, planos e turmas. O sistema também contempla agenda, frequência, informações financeiras, relatórios, treinos e evolução de peso."),
  paragraph("O proprietário cadastra academias e define seus administradores. A administração gerencia a rotina operacional da unidade. O professor consulta os alunos vinculados, organiza treinos e registra presença. O aluno acompanha exercícios, séries realizadas, peso, frequência e situação da mensalidade. A separação dos perfis reduz a exposição de funções que não pertencem ao usuário autenticado."),
  paragraph("A versão atual utiliza políticas de Row Level Security para restringir o acesso conforme o perfil e a academia [4]. Operações sensíveis, como criação de contas e redefinição de acesso, são executadas em funções de servidor. Alterações administrativas ficam registradas em auditoria. Em um ensaio com duas academias fictícias, usuários de uma unidade não conseguiram ler ou alterar registros da outra."),
  paragraph("A integração Pix é opcional por academia. Pagamentos reais controlados confirmaram a geração da cobrança, a validação no servidor e o registro financeiro. A rotina de conciliação consulta cobranças pendentes, enquanto o histórico permite acompanhar o estado das transações. Estornos, disputas e falhas externas ainda exigem conferência operacional."),
  paragraph("Os resultados indicam que a aplicação centraliza os principais fluxos previstos e oferece uma base funcional para evolução. Entretanto, a adoção em produção depende de testes contínuos das políticas de acesso, monitoramento das integrações e revisão periódica dos controles de segurança.", 0),
]);

setSection("sh/zadcv2p8", [
  heading("CONSIDERAÇÕES FINAIS"),
  paragraph("O FitPro demonstrou a viabilidade de centralizar processos relevantes do Studio Bio Fitness em uma aplicação web integrada. A evolução do projeto acrescentou isolamento entre academias, operações administrativas no servidor, auditoria, criação de treinos, persistência de frequência e pagamentos Pix opcionais. Antes de uma adoção comercial ampla, o sistema ainda requer testes contínuos de segurança, acompanhamento das integrações financeiras e validação operacional em diferentes academias.", 0),
]);

const references = presentation.resolve("sh/utg3698n");
references.position = { left: 1754.9, top: 4135, width: 1472.05, height: 339.28 };
references.text = [
  heading("REFERÊNCIAS"),
  { runs: ["1. LAUDON, K. C.; LAUDON, J. P. Sistemas de informação gerenciais. 11. ed. São Paulo: Pearson, 2016."], spaceAfter: 350 },
  { runs: ["2. BRASIL. Lei nº 13.709, de 14 de agosto de 2018. Lei Geral de Proteção de Dados Pessoais."], spaceAfter: 350 },
  { runs: ["3. BECK, K. et al. Manifesto for Agile Software Development. 2001."], spaceAfter: 350 },
  { runs: ["4. SUPABASE. Row Level Security. 2026."], spaceAfter: 0 },
];
references.text.style = {
  typeface: "Arial",
  fontSize: 32,
  color: BLACK,
  alignment: "left",
  verticalAlignment: "top",
  autoFit: "none",
  wrap: "square",
};
references.position = { left: 1754.9, top: 4135, width: 1472.05, height: 339.28 };

const profileImage = slide.images.add({
  blob: await fs.readFile(profileImagePath),
  contentType: "image/png",
  alt: "Tela do FitPro com os perfis Proprietário, Administração, Professor e Aluno",
  fit: "contain",
  position: { left: 230, top: 3690, width: 1290, height: 680 },
});
profileImage.lockAspectRatio = true;

const studentImage = slide.images.add({
  blob: await fs.readFile(studentImagePath),
  contentType: "image/png",
  alt: "Painel do aluno com treino, progresso e evolução corporal",
  fit: "contain",
  position: { left: 1755, top: 2730, width: 1472, height: 620 },
});
studentImage.lockAspectRatio = true;

function addCaption(text, position) {
  const caption = slide.shapes.add({
    geometry: "textbox",
    position,
    fill: "none",
    line: { fill: "none", width: 0 },
  });
  caption.text = text;
  caption.text.style = {
    typeface: "Arial",
    fontSize: 32,
    italic: true,
    color: BLACK,
    alignment: "center",
    verticalAlignment: "middle",
    autoFit: "none",
    wrap: "square",
  };
}

addCaption("Figura 1. Perfis de acesso do FitPro. Fonte: elaborado pelo autor (2026).", {
  left: 120,
  top: 4380,
  width: 1511,
  height: 75,
});
addCaption("Figura 2. Painel do aluno e acompanhamento do treino. Fonte: elaborado pelo autor (2026).", {
  left: 1755,
  top: 3370,
  width: 1472,
  height: 75,
});

slide.speakerNotes.textFrame.setText([
  "Fontes de conteúdo:",
  "/home/rafael/Downloads/B2411550048.docx",
  path.join(workspaceDir, "README.md"),
  path.join(workspaceDir, "docs/roteiro-validacao.md"),
  path.join(workspaceDir, "docs/pix-mercado-pago.md"),
  "A geometria, as cores e os tamanhos de fonte seguem o modelo original do banner.",
].join("\n"));

const draftPath = path.join(TMP_DIR, "Banner_TCC_FitPro_modelo_v3_draft.pptx");
await (await PresentationFile.exportPptx(presentation)).save(draftPath);
const preview = await slide.export({ format: "png", scale: 0.75 });
await fs.writeFile(path.join(TMP_DIR, "banner-preview.png"), new Uint8Array(await preview.arrayBuffer()));
const layout = await slide.export({ format: "layout" });
await fs.writeFile(path.join(TMP_DIR, "banner-layout.json"), await layout.text());

const sourceSha256 = crypto.createHash("sha256").update(await fs.readFile(sourcePath)).digest("hex");
const fontPolicy = {
  basis: "reference",
  families: ["Arial", "Arial Black"],
  referencePath: sourcePath,
  referenceSha256: sourceSha256,
};
const stagingDir = path.join(workspaceDir, ".codex-finalizer-banner-modelo-v3");
await fs.mkdir(stagingDir, { recursive: true });
const candidatePath = path.join(stagingDir, "candidate.pptx");
await (await PresentationFile.exportPptx(presentation)).save(candidatePath);

const result = await finalizePresentation({
  explicitTotalSlideCount: 1,
  requiredNativeTableOwnerSlides: [],
  requiredNativeChartOwnerSlides: [],
  workspaceDir,
  candidatePath,
  finalPath: FINAL_PPTX,
  pythonExecutable: RUNTIME_PYTHON,
  integrityValidatorPath: path.join(SKILL_DIR, "container_tools/inspect_presentation_package_integrity.py"),
  layoutValidatorPath: path.join(SKILL_DIR, "container_tools/inspect_presentation_layout_geometry.py"),
  layoutArgs: [
    "--expected-slide-size-emu", "32399288,43200638",
    "--validate-heading-fit",
  ],
  fontPolicy,
  verifyArtifactToolImport: true,
  receiptPath: path.join(stagingDir, `${path.basename(FINAL_PPTX)}.validation.json`),
});

console.log(JSON.stringify({ finalPath: FINAL_PPTX, draftPath, validation: result }, null, 2));

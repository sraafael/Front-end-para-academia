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
const TMP_DIR = path.join(workspaceDir, "artifacts/banner-build/private");
const FINAL_PPTX = path.join(outputDir, "Banner_TCC_FitPro_Rafael_Bavaresco_v1.pptx");
const SKILL_DIR = "/home/rafael/.codex/plugins/cache/openai-primary-runtime/presentations/26.921.10847/skills/presentations";
const RUNTIME_PYTHON = "/home/rafael/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3";

const {
  finalizePresentation,
  makeNativeBulletParagraphs,
} = await import(pathToFileURL(path.join(SKILL_DIR, "container_tools/artifact_tool_utils.mjs")).href);

await fs.mkdir(TMP_DIR, { recursive: true });
await fs.mkdir(outputDir, { recursive: true });

const presentation = await PresentationFile.importPptx(await FileBlob.load(sourcePath));
const slide = presentation.slides.getItem(0);

const BLUE = "#005A93";
const ORANGE = "#F28C00";
const TEXT = "#202124";
const MUTED = "#5F6368";

const header = presentation.resolve("sh/sryl4zqx");
header.position = { left: 770, top: 115, width: 1510, height: 400 };
header.text = "APRESENTAÇÃO DE TRABALHOS DE CONCLUSÃO DE CURSO\n2026";
header.text.style = {
  typeface: "Arial Black",
  fontSize: 54,
  bold: true,
  color: "#000000",
  alignment: "center",
  verticalAlignment: "middle",
  autoFit: "none",
  wrap: "square",
  insets: { top: 4, right: 4, bottom: 4, left: 4 },
};
header.fill = "none";
header.line = { fill: "none", width: 0 };
header.bringToFront();

const workTitle = presentation.resolve("sh/65g3298r");
workTitle.position = { left: 210, top: 665, width: 2980, height: 235 };
workTitle.text = "FITPRO: SISTEMA WEB PARA GESTÃO DE PEQUENAS ACADEMIAS";
workTitle.text.style = {
  typeface: "Arial Black",
  fontSize: 64,
  bold: true,
  color: BLUE,
  alignment: "center",
  verticalAlignment: "middle",
  autoFit: "shrinkText",
  wrap: "square",
  insets: { top: 0, right: 4, bottom: 0, left: 4 },
};
workTitle.fill = "none";
workTitle.line = { fill: "none", width: 0 };

const authors = presentation.resolve("sh/547294r6");
authors.position = { left: 280, top: 920, width: 2840, height: 175 };
authors.text = [
  [{ run: "Aluno: Rafael Bavaresco Messias Moura", textStyle: { bold: true, fontSize: "31pt", typeface: "Arial" } }],
  [{ run: "Orientador: Prof. Esp. Célio Desiró", textStyle: { fontSize: "28pt", typeface: "Arial" } }],
];
authors.text.style = {
  typeface: "Arial",
  fontSize: 38,
  color: TEXT,
  alignment: "center",
  verticalAlignment: "middle",
  autoFit: "none",
  wrap: "square",
  lineSpacing: 1.05,
  insets: { top: 2, right: 4, bottom: 2, left: 4 },
};
authors.fill = "none";
authors.line = { fill: "none", width: 0 };

const affiliation = presentation.resolve("sh/fu94fe98");
affiliation.position = { left: 250, top: 1110, width: 2900, height: 150 };
affiliation.text = "Curso de Análise e Desenvolvimento de Sistemas, IMESA/FEMA, Assis/SP";
affiliation.text.style = {
  typeface: "Arial",
  fontSize: 28,
  color: MUTED,
  alignment: "center",
  verticalAlignment: "middle",
  autoFit: "none",
  wrap: "square",
  insets: { top: 2, right: 4, bottom: 2, left: 4 },
};
affiliation.fill = "none";
affiliation.line = { fill: "none", width: 0 };

function headingParagraph(text) {
  return {
    runs: [{ run: text, textStyle: { bold: true, fontSize: "30pt", typeface: "Arial", color: BLUE } }],
    spaceAfter: 900,
  };
}

function bodyParagraph(text, spaceAfterPoints = 9) {
  return { runs: [text], spaceAfter: Math.round(spaceAfterPoints * 100) };
}

function styleSection(shape, position, paragraphs, fontSize = 31) {
  shape.position = position;
  shape.text = paragraphs;
  shape.text.style = {
    typeface: "Arial",
    fontSize,
    color: TEXT,
    alignment: "left",
    verticalAlignment: "top",
    autoFit: "none",
    wrap: "square",
    lineSpacing: 1.05,
    insets: { top: 6, right: 8, bottom: 6, left: 8 },
  };
  shape.fill = "none";
  shape.line = { fill: "none", width: 0 };
}

const introduction = presentation.resolve("sh/wn6dc7eh");
styleSection(
  introduction,
  { left: 120, top: 1360, width: 1511, height: 650 },
  [
    headingParagraph("INTRODUÇÃO"),
    bodyParagraph("Pequenas academias ainda podem manter cadastros, frequência, treinos e controles financeiros distribuídos entre papéis, planilhas e aplicativos de mensagens. Essa fragmentação dificulta o histórico das operações e aumenta o retrabalho (LAUDON; LAUDON, 2016)."),
    bodyParagraph("O FitPro foi desenvolvido no contexto do Studio Bio Fitness para centralizar essas rotinas em uma aplicação web com áreas próprias para proprietário, administração, professor e aluno. O tratamento de dados pessoais também exige controles compatíveis com a LGPD (BRASIL, 2018).", 0),
  ],
  31,
);

const objectives = presentation.resolve("sh/1cvuxc7e");
styleSection(
  objectives,
  { left: 120, top: 2020, width: 1511, height: 610 },
  [
    headingParagraph("OBJETIVOS"),
    ...makeNativeBulletParagraphs([
      "Desenvolver e avaliar uma aplicação web para apoiar a gestão do Studio Bio Fitness.",
      "Centralizar cadastros, turmas, treinos, frequência, mensalidades e indicadores gerenciais.",
      "Oferecer fluxos específicos e protegidos para os quatro perfis de acesso.",
      "Identificar limites técnicos e medidas necessárias para evolução segura do sistema.",
    ], { marginLeftPoints: 22, hangingPoints: 11, spaceAfterPoints: 6 }),
  ],
  30,
);

const methodology = presentation.resolve("sh/sfqdkrep");
styleSection(
  methodology,
  { left: 120, top: 2640, width: 1511, height: 720 },
  [
    headingParagraph("METODOLOGIA"),
    bodyParagraph("Pesquisa aplicada, exploratória e qualitativa. As necessidades foram levantadas por observação da rotina, conversas com pessoas envolvidas e revisão sucessiva das telas e fluxos."),
    bodyParagraph("O desenvolvimento seguiu ciclos incrementais de entendimento, implementação e validação funcional, em alinhamento com princípios ágeis (BECK et al., 2001)."),
    bodyParagraph("A versão atual utiliza React 19 e TypeScript no front-end, Supabase Auth e Data API, PostgreSQL, Edge Functions, políticas RLS e Zustand para estado da aplicação. Os resultados são específicos ao contexto estudado e não representam inferência estatística sobre o setor.", 0),
  ],
  30,
);

const results = presentation.resolve("sh/0bmd476t");
styleSection(
  results,
  { left: 1755, top: 1360, width: 1472, height: 1130 },
  [
    headingParagraph("RESULTADOS E DISCUSSÃO"),
    ...makeNativeBulletParagraphs([
      "O FitPro reúne gestão de academias, administradores, alunos, professores, planos, turmas, frequência, finanças, treinos e evolução de peso em uma única aplicação.",
      "Políticas RLS restringem os dados por academia e perfil. Operações sensíveis utilizam Edge Functions, e alterações administrativas são registradas em auditoria (SUPABASE, 2026).",
      "Um ensaio com duas academias fictícias bloqueou a leitura cruzada de registros e impediu a alteração de um plano pertencente a outra unidade.",
      "A integração Pix opcional por academia processou pagamentos reais controlados, confirmou cobranças no servidor e registrou o histórico. A conciliação, estornos e disputas ainda exigem monitoramento operacional.",
    ], { marginLeftPoints: 22, hangingPoints: 11, spaceAfterPoints: 8 }),
  ],
  29,
);

const conclusions = presentation.resolve("sh/zadcv2p8");
styleSection(
  conclusions,
  { left: 1755, top: 3260, width: 1472, height: 610 },
  [
    headingParagraph("CONSIDERAÇÕES FINAIS"),
    bodyParagraph("O projeto demonstrou a viabilidade de centralizar processos relevantes do Studio Bio Fitness em uma aplicação web integrada. A evolução do código acrescentou isolamento entre academias, operações administrativas no servidor, auditoria, criação de treinos, persistência de frequência e pagamentos Pix opcionais."),
    bodyParagraph("Antes de uso comercial amplo, o sistema ainda requer testes contínuos das políticas de acesso, acompanhamento de falhas financeiras, tratamento de incidentes e validação operacional com diferentes academias. O FitPro constitui uma base funcional para essa evolução.", 0),
  ],
  29,
);

const references = presentation.resolve("sh/utg3698n");
styleSection(
  references,
  { left: 1755, top: 3890, width: 1472, height: 585 },
  [
    headingParagraph("REFERÊNCIAS"),
    bodyParagraph("BECK, K. et al. Manifesto for Agile Software Development. 2001.", 4),
    bodyParagraph("BRASIL. Lei nº 13.709, de 14 de agosto de 2018. Lei Geral de Proteção de Dados Pessoais.", 4),
    bodyParagraph("LAUDON, K. C.; LAUDON, J. P. Sistemas de informação gerenciais. 11. ed. 2016.", 4),
    bodyParagraph("SUPABASE. Row Level Security. 2026.", 0),
  ],
  24,
);

const profileImage = slide.images.add({
  blob: await fs.readFile(profileImagePath),
  contentType: "image/png",
  alt: "Tela atual do FitPro com os perfis Proprietário, Administração, Professor e Aluno",
  fit: "contain",
  position: { left: 120, top: 3385, width: 1511, height: 850 },
  geometry: "roundRect",
  borderRadius: 12,
});
profileImage.lockAspectRatio = true;

const studentImage = slide.images.add({
  blob: await fs.readFile(studentImagePath),
  contentType: "image/png",
  alt: "Painel do aluno com treino, progresso e evolução corporal",
  fit: "contain",
  position: { left: 1755, top: 2495, width: 1472, height: 650 },
  geometry: "roundRect",
  borderRadius: 12,
});
studentImage.lockAspectRatio = true;

function addCaption(text, position) {
  const caption = slide.shapes.add({
    geometry: "textbox",
    name: `caption-${text.slice(0, 20)}`,
    position,
    fill: "none",
    line: { fill: "none", width: 0 },
  });
  caption.text = text;
  caption.text.style = {
    typeface: "Arial",
    fontSize: 22,
    italic: true,
    color: MUTED,
    alignment: "center",
    verticalAlignment: "middle",
    autoFit: "none",
    wrap: "square",
    insets: { top: 0, right: 2, bottom: 0, left: 2 },
  };
  return caption;
}

addCaption("Figura 1. Perfis de acesso do FitPro. Fonte: elaborado pelo autor (2026).", { left: 120, top: 4240, width: 1511, height: 65 });
addCaption("Figura 2. Painel do aluno e acompanhamento do treino. Fonte: elaborado pelo autor (2026).", { left: 1755, top: 3150, width: 1472, height: 70 });

const accent = slide.shapes.add({
  geometry: "rect",
  name: "title-accent",
  position: { left: 1515, top: 892, width: 370, height: 8 },
  fill: ORANGE,
  line: { fill: "none", width: 0 },
});
accent.sendToBack();

slide.speakerNotes.textFrame.setText([
  "Fontes de conteúdo:",
  "/home/rafael/Downloads/B2411550048.docx",
  path.join(workspaceDir, "README.md"),
  path.join(workspaceDir, "docs/roteiro-validacao.md"),
  path.join(workspaceDir, "docs/pix-mercado-pago.md"),
  "O texto concilia a monografia enviada com a versão atual do código e da documentação do projeto.",
].join("\n"));

const draftPath = path.join(TMP_DIR, "Banner_TCC_FitPro_Rafael_Bavaresco_draft.pptx");
await (await PresentationFile.exportPptx(presentation)).save(draftPath);
const preview = await slide.export({ format: "png", scale: 0.75 });
await fs.writeFile(path.join(TMP_DIR, "banner-preview.png"), new Uint8Array(await preview.arrayBuffer()));
const layout = await slide.export({ format: "layout" });
await fs.writeFile(path.join(TMP_DIR, "banner-layout.json"), await layout.text());

const sourceSha256 = crypto.createHash("sha256").update(await fs.readFile(sourcePath)).digest("hex");
const requirements = {
  explicitTotalSlideCount: 1,
  requiredNativeTableOwnerSlides: [],
  requiredNativeChartOwnerSlides: [],
};
const fontPolicy = {
  basis: "reference",
  families: ["Arial", "Arial Black"],
  referencePath: sourcePath,
  referenceSha256: sourceSha256,
};
const stagingDir = path.join(workspaceDir, ".codex-finalizer-banner-v1");
await fs.mkdir(stagingDir, { recursive: true });
const candidatePath = path.join(stagingDir, "candidate.pptx");
await (await PresentationFile.exportPptx(presentation)).save(candidatePath);

const result = await finalizePresentation({
  ...requirements,
  workspaceDir,
  candidatePath,
  finalPath: FINAL_PPTX,
  pythonExecutable: RUNTIME_PYTHON,
  integrityValidatorPath: path.join(SKILL_DIR, "container_tools/inspect_presentation_package_integrity.py"),
  layoutValidatorPath: path.join(SKILL_DIR, "container_tools/inspect_presentation_layout_geometry.py"),
  layoutArgs: [
    "--expected-slide-size-emu", "32399288,43200638",
    "--validate-bullet-geometry",
    "--validate-heading-fit",
  ],
  requiredNativeTableOwnerSlides: [],
  fontPolicy,
  verifyArtifactToolImport: true,
  receiptPath: path.join(stagingDir, `${path.basename(FINAL_PPTX)}.validation.json`),
});

console.log(JSON.stringify({ finalPath: FINAL_PPTX, draftPath, validation: result }, null, 2));

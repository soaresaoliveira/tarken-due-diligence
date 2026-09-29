import type { CnpjEntry } from './cnpj.ts'
import type { Evidence, SupplierRow } from '../types/analysis.ts'

export type PdfNode = { [key: string]: unknown }

export type PdfDocumentDefinition = {
  pageSize: 'A4'
  pageOrientation: 'landscape'
  pageMargins: [number, number, number, number]
  info: { title: string; author: string; subject: string }
  defaultStyle: PdfNode
  styles: Record<string, PdfNode>
  content: PdfNode[]
  header: () => PdfNode
  footer: (pageNumber: number, pageCount: number) => PdfNode
}

const TITLE = 'Due diligence de fornecedores - consolidado'

const COLORS = {
  ink: '#172821',
  muted: '#617068',
  line: '#dfe7e1',
  forest: '#18382b',
  green: '#39745a',
  gold: '#a76d19',
  red: '#a54540',
} as const

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date)
}

function formatEmbargo(value: Evidence): string {
  if (value === 'SIM') return 'Sim'
  if (value === 'NÃO') return 'Não'
  return 'NA'
}

function colorForRisk(risk: SupplierRow['classificacao_risco']) {
  if (risk === 'APROVAR') return COLORS.green
  if (risk === 'REVISAR') return COLORS.gold
  return COLORS.red
}

function makeSupplierTable(rows: SupplierRow[]): PdfNode {
  const header = [
    'CNPJ',
    'Razão Social',
    'Situação Cadastral',
    'Telefone',
    'Embargo',
    'Classificação de Risco',
  ].map((text) => ({ text, style: 'tableHeader' }))

  const body = rows.map((row) => {
    const result = row.result
    return [
      { text: row.input.original || row.input.cnpj || 'NA', style: 'cnpjCell' },
      { text: result?.razao_social?.trim() || 'NA', style: 'nameCell' },
      { text: result?.situacao_cadastral?.trim() || 'NA', style: 'cell' },
      { text: result?.telefone?.trim() || 'NA', style: 'cell' },
      { text: result ? formatEmbargo(result.tem_embargo_ibama) : 'NA', style: 'centerCell' },
      {
        text: row.classificacao_risco,
        style: 'riskCell',
        color: colorForRisk(row.classificacao_risco),
      },
    ]
  })

  return {
    table: {
      headerRows: 1,
      keepWithHeaderRows: 1,
      dontBreakRows: true,
      widths: [104, '*', 105, 92, 64, 120],
      body: [header, ...body],
    },
    layout: {
      hLineWidth: (index: number) => index === 0 ? 0 : 0.5,
      hLineColor: () => COLORS.line,
      vLineWidth: () => 0,
      paddingLeft: () => 5,
      paddingRight: () => 5,
      paddingTop: () => 4,
      paddingBottom: () => 4,
    },
  }
}

export function buildSupplierPdfDocument(
  rows: SupplierRow[],
  duplicates: CnpjEntry[],
  generatedAt = new Date(),
): PdfDocumentDefinition {
  const generatedLabel = formatDateTime(generatedAt)
  const duplicateLabel = duplicates.length === 1
    ? '1 duplicidade descartada'
    : `${duplicates.length} duplicidades descartadas`
  const content: PdfNode[] = [
    { text: TITLE, style: 'title' },
    {
      text: `Receita Federal / BrasilAPI · IBAMA · ${rows.length} fornecedores · ${duplicateLabel} · Gerado em ${generatedLabel}`,
      style: 'metadata',
    },
    makeSupplierTable(rows),
  ]

  return {
    pageSize: 'A4',
    pageOrientation: 'landscape',
    pageMargins: [24, 48, 24, 38],
    info: {
      title: TITLE,
      author: 'Tarken',
      subject: 'Relatório consolidado de due diligence',
    },
    defaultStyle: { font: 'Roboto', fontSize: 7.5, color: COLORS.ink },
    styles: {
      title: { fontSize: 15, bold: true, color: COLORS.ink, margin: [0, 0, 0, 4] },
      metadata: { fontSize: 7, color: COLORS.muted, margin: [0, 0, 0, 10] },
      tableHeader: { fontSize: 7, bold: true, color: '#ffffff', fillColor: COLORS.forest },
      cnpjCell: { fontSize: 7, color: COLORS.ink },
      nameCell: { fontSize: 7.5, color: COLORS.ink },
      cell: { fontSize: 7, color: COLORS.ink },
      centerCell: { fontSize: 7, alignment: 'center', color: COLORS.ink },
      riskCell: { fontSize: 7, bold: true, alignment: 'center' },
    },
    header: () => ({
      columns: [
        { text: 'TARKEN', bold: true, color: COLORS.forest, fontSize: 8 },
        { text: 'RECEITA FEDERAL / BRASILAPI · IBAMA', alignment: 'right', color: COLORS.muted, fontSize: 7 },
      ],
      margin: [24, 16, 24, 0],
    }),
    footer: (pageNumber, pageCount) => ({
      columns: [
        { text: `Gerado em ${generatedLabel}`, color: COLORS.muted, fontSize: 7 },
        { text: `Página ${pageNumber} de ${pageCount}`, alignment: 'right', color: COLORS.muted, fontSize: 7 },
      ],
      margin: [24, 0, 24, 14],
    }),
    content,
  }
}

export function supplierPdfFilename(date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `due-diligence-fornecedores-${year}-${month}-${day}.pdf`
}

export async function createSupplierPdfBlob(
  rows: SupplierRow[],
  duplicates: CnpjEntry[],
  generatedAt = new Date(),
): Promise<{ blob: Blob; filename: string }> {
  if (rows.length === 0) throw new Error('Não há fornecedores para exportar.')

  const [{ default: pdfMake }, { default: virtualFonts }] = await Promise.all([
    import('pdfmake/build/pdfmake.js'),
    import('pdfmake/build/vfs_fonts.js'),
  ])
  pdfMake.addVirtualFileSystem(virtualFonts)
  const definition = buildSupplierPdfDocument(rows, duplicates, generatedAt)
  const blob = await pdfMake.createPdf(definition).getBlob()
  if (blob.type !== 'application/pdf') throw new Error('A biblioteca não gerou um arquivo PDF válido.')

  return { blob, filename: supplierPdfFilename(generatedAt) }
}
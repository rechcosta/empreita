'use client'

import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { Orcamento, CompanyInfo, LaborItem } from '@/types'
import { formatCurrency, formatCurrencyOrDash } from './utils'
import { sumUnitItems, sumSqmItems } from './labor'

export function generateOrcamentoPDF(
  orcamento: Orcamento,
  company: CompanyInfo
): void {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const pageWidth  = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const ML = 16
  const MR = 16
  const innerWidth = pageWidth - ML - MR

  // Layout constants used for bottom-up reservations
  const FOOTER_HEIGHT       = 12   // from bottom: 12mm reserved for footer + rule
  const SIGNATURE_HEIGHT    = 20   // from signature top: line @+10, labels @+14, +2mm breathing = 16, plus a 4mm top margin
  const SIGNATURE_TO_FOOTER = 4    // space between signature labels and footer rule
  const MIN_BOTTOM_SPACE    = FOOTER_HEIGHT + SIGNATURE_HEIGHT + SIGNATURE_TO_FOOTER // = 36mm total reserved at bottom

  // ── Palette ──────────────────────────────────────────────────
  const inkDark:   [number, number, number] = [17,  24,  39]
  const inkMid:    [number, number, number] = [55,  65,  81]
  const inkLight:  [number, number, number] = [107, 114, 128]
  const inkMuted:  [number, number, number] = [156, 163, 175]
  const stripe1:   [number, number, number] = [250, 250, 250]
  const border:    [number, number, number] = [229, 231, 235]
  const accent:    [number, number, number] = [255, 122,   0]
  const accentSoft:[number, number, number] = [255, 244, 230]
  const accentText:[number, number, number] = [138,  62,   0]
  const white:     [number, number, number] = [255, 255, 255]

  function setInk(rgb: [number, number, number]) {
    doc.setTextColor(rgb[0], rgb[1], rgb[2])
  }
  function setFill(rgb: [number, number, number]) {
    doc.setFillColor(rgb[0], rgb[1], rgb[2])
  }
  function setStroke(rgb: [number, number, number]) {
    doc.setDrawColor(rgb[0], rgb[1], rgb[2])
  }

  function sectionLabel(text: string, x: number, y: number) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.5)
    setInk(inkLight)
    doc.setCharSpace(0.8)
    doc.text(text.toUpperCase(), x, y)
    doc.setCharSpace(0)
  }

  // ═══════════ HEADER ══════════════════════════════════════════

  const headerTop = 14
  let logoEndX = ML

  if (company.logoBase64) {
    try {
      const imgFormat = company.logoBase64.includes('data:image/png') ? 'PNG' : 'JPEG'
      const imgData = company.logoBase64.includes('base64,')
        ? company.logoBase64.split('base64,')[1]
        : company.logoBase64
      doc.addImage(imgData, imgFormat, ML, headerTop, 12, 12)
      logoEndX = ML + 12 + 4
    } catch { /* skip */ }
  } else {
    setFill(accent)
    doc.roundedRect(ML, headerTop, 12, 12, 2, 2, 'F')
    logoEndX = ML + 12 + 4
  }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  setInk(inkDark)
  doc.text(company.companyName, logoEndX, headerTop + 5.5)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  setInk(inkLight)
  doc.text(`CNPJ: ${company.cnpj}`, logoEndX, headerTop + 10.5)

  const budgetNumber = (orcamento._id ?? '').toUpperCase().slice(-7).replace(/(.{4})(.+)/, '$1-$2') || 'NOVO'
  const dateStr = orcamento.createdAt
    ? new Intl.DateTimeFormat('pt-BR').format(new Date(orcamento.createdAt))
    : new Intl.DateTimeFormat('pt-BR').format(new Date())

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7)
  setInk(inkLight)
  doc.setCharSpace(0.8)
  doc.text('ORÇAMENTO', pageWidth - MR, headerTop + 3, { align: 'right' })
  doc.setCharSpace(0)

  doc.setFont('courier', 'normal')
  doc.setFontSize(10)
  setInk(inkDark)
  doc.text(`Nº ${budgetNumber}`, pageWidth - MR, headerTop + 8, { align: 'right' })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  setInk(inkLight)
  doc.text(dateStr, pageWidth - MR, headerTop + 12.5, { align: 'right' })

  setFill(accent)
  doc.rect(ML, headerTop + 16, innerWidth, 0.8, 'F')

  // ═══════════ DOCUMENT TITLE ══════════════════════════════════

  let y = headerTop + 16 + 10
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(15)
  setInk(inkDark)
  doc.text('Orçamento de serviço', ML, y)
  y += 10

  // ═══════════ CLIENT BLOCK ════════════════════════════════════

  const labelCol = 22
  const rowGap = 5

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  setInk(inkLight)
  doc.text('Cliente', ML, y)
  setInk(inkDark)
  doc.setFont('helvetica', 'bold')
  doc.text(orcamento.clientName, ML + labelCol, y)
  y += rowGap

  doc.setFont('helvetica', 'normal')
  setInk(inkLight)
  doc.text('Endereço', ML, y)
  setInk(inkDark)
  const addressLines = doc.splitTextToSize(
    orcamento.clientAddress,
    innerWidth - labelCol
  ) as string[]
  doc.text(addressLines, ML + labelCol, y)
  y += addressLines.length * 4.5 + 0.5

  setInk(inkLight)
  doc.text('Serviço', ML, y)
  setInk(inkDark)
  doc.setFont('helvetica', 'bold')
  doc.text(orcamento.serviceName, ML + labelCol, y)
  y += 12

  let cursorY = y

  // ═══════════ MATERIAIS ════════════════════════════════════════

  if (orcamento.materials.length > 0) {
    sectionLabel('Materiais', ML, cursorY)
    cursorY += 3

    const unitLabels: Record<string, string> = {
      unidade: 'un',
      m3: 'm³',
      kg: 'kg',
    }

    autoTable(doc, {
      startY: cursorY,
      head: [['Material', 'Qtd', 'Valor un.', 'Total']],
      body: orcamento.materials.map((m) => [
        m.name,
        `${m.quantity} ${unitLabels[m.unit] ?? m.unit}`,
        formatCurrencyOrDash(m.unitPrice),
        formatCurrencyOrDash(m.total),
      ]),
      foot: [['', '', 'Subtotal materiais', formatCurrency(orcamento.materialsTotal)]],
      theme: 'plain',
      headStyles: {
        fillColor: stripe1, textColor: inkMid, fontStyle: 'normal', fontSize: 8,
        lineColor: border, lineWidth: 0.3,
        cellPadding: { top: 2.5, right: 3, bottom: 2.5, left: 3 },
      },
      footStyles: {
        fillColor: white, textColor: inkDark, fontStyle: 'bold', fontSize: 8.5,
        lineColor: border, lineWidth: 0.3,
        cellPadding: { top: 3, right: 3, bottom: 3, left: 3 },
      },
      bodyStyles: {
        fontSize: 8.5, textColor: inkMid,
        cellPadding: { top: 2.5, right: 3, bottom: 2.5, left: 3 },
        lineColor: [243, 244, 246], lineWidth: 0.2,
      },
      styles: { lineColor: border },
      columnStyles: {
        0: { cellWidth: innerWidth - 32 - 28 - 28 },
        1: { cellWidth: 32, halign: 'center' },
        2: { cellWidth: 28, halign: 'right' },
        3: { cellWidth: 28, halign: 'right' },
      },
      margin: { left: ML, right: MR, bottom: MIN_BOTTOM_SPACE },
      didParseCell: (data) => {
        if (
          data.section === 'body' &&
          (data.column.index === 2 || data.column.index === 3) &&
          data.cell.text[0] === '—'
        ) {
          data.cell.styles.textColor = inkMuted
        }
      },
    })
    cursorY = (doc as any).lastAutoTable.finalY + 10
  }

  // ═══════════ MÃO DE OBRA ═════════════════════════════════════

  sectionLabel('Mão de obra', ML, cursorY)
  cursorY += 3

  const fixedItems = orcamento.labor.items.filter((i) => i.type === 'fixo')
  const unitItems  = orcamento.labor.items.filter(
    (i): i is Extract<LaborItem, { type: 'por_unidade' }> => i.type === 'por_unidade'
  )
  const sqmItems   = orcamento.labor.items.filter(
    (i): i is Extract<LaborItem, { type: 'por_m2' }> => i.type === 'por_m2'
  )

  if (orcamento.labor.items.length === 0) {
    autoTable(doc, {
      startY: cursorY,
      body: [['Nenhum serviço de mão de obra.']],
      theme: 'plain',
      bodyStyles: {
        fontSize: 8.5, textColor: inkLight, fontStyle: 'italic',
        cellPadding: { top: 3, right: 3, bottom: 3, left: 3 },
      },
      columnStyles: { 0: { cellWidth: innerWidth } },
      margin: { left: ML, right: MR, bottom: MIN_BOTTOM_SPACE },
    })
    cursorY = (doc as any).lastAutoTable.finalY + 4
  }

  function laborGroupHeader(title: string, startY: number, subtitle?: string): number {
    autoTable(doc, {
      startY,
      body: [[
        { content: title, styles: { fontStyle: 'bold', textColor: inkDark as any } },
        { content: subtitle ?? '', styles: { halign: 'right', fontSize: 7.5, textColor: inkLight as any } },
      ]],
      theme: 'plain',
      bodyStyles: {
        fillColor: stripe1, fontSize: 9,
        cellPadding: { top: 2.5, right: 3, bottom: 2.5, left: 3 },
        lineColor: border, lineWidth: 0.2,
      },
      columnStyles: {
        0: { cellWidth: innerWidth - 55 },
        1: { cellWidth: 55, halign: 'right' },
      },
      margin: { left: ML, right: MR, bottom: MIN_BOTTOM_SPACE },
    })
    return (doc as any).lastAutoTable.finalY
  }

  // ─ Group 1: Preço fixo ─
  if (fixedItems.length > 0) {
    cursorY = laborGroupHeader('Preço fixo', cursorY)

    const fixedValue = orcamento.labor.fixedGroupValue ?? 0
    const body: any[] = fixedItems.map((it) => [
      { content: `  ${it.description}`, styles: { textColor: inkMid as any } },
      '',
    ])
    body.push([
      { content: '  Valor total do grupo', styles: { fontStyle: 'bold', textColor: inkDark as any } },
      { content: formatCurrency(fixedValue), styles: { fontStyle: 'bold', halign: 'right', textColor: inkDark as any } },
    ])

    autoTable(doc, {
      startY: cursorY,
      body,
      theme: 'plain',
      bodyStyles: {
        fontSize: 8.5, textColor: inkMid,
        cellPadding: { top: 2.5, right: 3, bottom: 2.5, left: 3 },
        lineColor: [243, 244, 246], lineWidth: 0.2,
      },
      columnStyles: {
        0: { cellWidth: innerWidth - 55 },
        1: { cellWidth: 55, halign: 'right' },
      },
      margin: { left: ML, right: MR, bottom: MIN_BOTTOM_SPACE },
    })
    cursorY = (doc as any).lastAutoTable.finalY + 3
  }

  // ─ Group 2: Por unidade ─
  if (unitItems.length > 0) {
    cursorY = laborGroupHeader('Por unidade', cursorY, 'Quantidade × valor unitário')

    const body: any[] = unitItems.map((it) => [
      { content: `  ${it.description}`, styles: { textColor: inkMid as any } },
      `${it.quantity} × ${formatCurrency(it.unitPrice)}`,
      formatCurrency(it.subtotal),
    ])
    body.push([
      { content: '  Subtotal por unidade', styles: { fontStyle: 'bold', textColor: inkDark as any } },
      '',
      { content: formatCurrency(sumUnitItems(orcamento.labor.items)), styles: { fontStyle: 'bold', halign: 'right', textColor: inkDark as any } },
    ])

    autoTable(doc, {
      startY: cursorY,
      body,
      theme: 'plain',
      bodyStyles: {
        fontSize: 8.5, textColor: inkMid,
        cellPadding: { top: 2.5, right: 3, bottom: 2.5, left: 3 },
        lineColor: [243, 244, 246], lineWidth: 0.2,
      },
      columnStyles: {
        0: { cellWidth: innerWidth - 45 - 35 },
        1: { cellWidth: 45, halign: 'right' },
        2: { cellWidth: 35, halign: 'right' },
      },
      margin: { left: ML, right: MR, bottom: MIN_BOTTOM_SPACE },
    })
    cursorY = (doc as any).lastAutoTable.finalY + 3
  }

  // ─ Group 3: Por m² ─
  if (sqmItems.length > 0) {
    cursorY = laborGroupHeader('Por m²', cursorY, 'Área × valor por m²')

    const body: any[] = sqmItems.map((it) => [
      { content: `  ${it.description}`, styles: { textColor: inkMid as any } },
      `${it.area} m² × ${formatCurrency(it.pricePerMeter)}`,
      formatCurrency(it.subtotal),
    ])
    body.push([
      { content: '  Subtotal por m²', styles: { fontStyle: 'bold', textColor: inkDark as any } },
      '',
      { content: formatCurrency(sumSqmItems(orcamento.labor.items)), styles: { fontStyle: 'bold', halign: 'right', textColor: inkDark as any } },
    ])

    autoTable(doc, {
      startY: cursorY,
      body,
      theme: 'plain',
      bodyStyles: {
        fontSize: 8.5, textColor: inkMid,
        cellPadding: { top: 2.5, right: 3, bottom: 2.5, left: 3 },
        lineColor: [243, 244, 246], lineWidth: 0.2,
      },
      columnStyles: {
        0: { cellWidth: innerWidth - 50 - 35 },
        1: { cellWidth: 50, halign: 'right' },
        2: { cellWidth: 35, halign: 'right' },
      },
      margin: { left: ML, right: MR, bottom: MIN_BOTTOM_SPACE },
    })
    cursorY = (doc as any).lastAutoTable.finalY + 3
  }

  // ─ Total da mão de obra ─
  autoTable(doc, {
    startY: cursorY,
    body: [[
      { content: 'Subtotal mão de obra', styles: { fontStyle: 'bold', textColor: inkDark as any } },
      { content: formatCurrency(orcamento.labor.total), styles: { fontStyle: 'bold', halign: 'right', textColor: inkDark as any } },
    ]],
    theme: 'plain',
    bodyStyles: {
      fontSize: 9,
      cellPadding: { top: 3, right: 3, bottom: 3, left: 3 },
      lineColor: border, lineWidth: 0.3,
    },
    columnStyles: {
      0: { cellWidth: innerWidth - 55 },
      1: { cellWidth: 55, halign: 'right' },
    },
    margin: { left: ML, right: MR, bottom: MIN_BOTTOM_SPACE },
  })
  cursorY = (doc as any).lastAutoTable.finalY + 10

  // ═══════════ GRAND TOTAL ═════════════════════════════════════

  const totalBoxH = 16
  // If grand total wouldn't fit above the reserved bottom area, move to next page
  if (cursorY + totalBoxH > pageHeight - MIN_BOTTOM_SPACE) {
    doc.addPage()
    cursorY = 20
  }

  setFill(accentSoft)
  doc.rect(ML, cursorY, innerWidth, totalBoxH, 'F')

  setFill(accent)
  doc.rect(ML, cursorY, 2, totalBoxH, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  setInk(accentText)
  doc.setCharSpace(0.8)
  doc.text('VALOR TOTAL', ML + 7, cursorY + 6.5)
  doc.setCharSpace(0)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  setInk(inkDark)
  doc.text(formatCurrency(orcamento.grandTotal), pageWidth - MR - 4, cursorY + 11, { align: 'right' })

  cursorY += totalBoxH + 8

  // ═══════════ SIGNATURE AREA — anchored to bottom ═════════════
  //
  // The signature is ALWAYS placed above the footer with guaranteed clearance,
  // regardless of content length. If content pushed us past the reserved area,
  // we add a new page first.

  // Space required: signature (20mm) + gap (4mm) + footer (12mm) = 36mm from bottom
  // Signature top anchor: pageHeight - FOOTER_HEIGHT - SIGNATURE_TO_FOOTER - SIGNATURE_HEIGHT
  // = pageHeight - 12 - 4 - 20 = pageHeight - 36

  // If content went further than that, start a new page for signature + footer
  if (cursorY > pageHeight - MIN_BOTTOM_SPACE) {
    doc.addPage()
    cursorY = 20
  }

  const signatureTop = pageHeight - FOOTER_HEIGHT - SIGNATURE_TO_FOOTER - SIGNATURE_HEIGHT
  // Line sits visually in the middle of the reserved signature band
  const sigLineY = signatureTop + 10
  const colGap = 18
  const sigColW = (innerWidth - colGap) / 2

  setStroke(inkMid)
  doc.setLineWidth(0.3)
  doc.line(ML, sigLineY, ML + sigColW, sigLineY)
  doc.line(ML + sigColW + colGap, sigLineY, pageWidth - MR, sigLineY)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  setInk(inkLight)
  doc.text('Cliente', ML + sigColW / 2, sigLineY + 4, { align: 'center' })
  doc.text('Empresa', ML + sigColW + colGap + sigColW / 2, sigLineY + 4, { align: 'center' })

  // ═══════════ FOOTER on EVERY page ════════════════════════════
  //
  // Important: apply the footer to all pages (including any new ones created
  // above). We draw footer once per page at the very end, so if a page break
  // happened mid-content, the footer is still present there.

  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)

    setStroke(border)
    doc.setLineWidth(0.3)
    doc.line(ML, pageHeight - 12, pageWidth - MR, pageHeight - 12)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    setInk(inkMuted)
    doc.text(
      `orçamento gerado por empreita, gestão de orçamentos - ${company.companyName}`,
      pageWidth / 2,
      pageHeight - 7,
      { align: 'center' }
    )

    // Page number only shown when there is more than one page
    if (pageCount > 1) {
      doc.text(
        `${i} / ${pageCount}`,
        pageWidth - MR,
        pageHeight - 7,
        { align: 'right' }
      )
    }
  }

  const safeName = orcamento.serviceName.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()
  doc.save(`orcamento_${safeName}.pdf`)
}
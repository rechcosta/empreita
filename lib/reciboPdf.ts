'use client'

import jsPDF from 'jspdf'
import { Recibo, CompanyInfo } from '@/types'
import { formatCurrency } from './utils'

const MONTHS = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
]

/**
 * Gera o "Recibo de Prestação de Serviços" em PDF (client-side), reproduzindo
 * o layout do bloco em papel: cabeçalho com logo/dados da empresa, título com
 * número, dados do tomador, tabela Quant./Descrição/Valores e o bloco de
 * totais (Mão de Obra, Material Empregado, TOTAL).
 */
export function generateReciboPDF(recibo: Recibo, company: CompanyInfo): void {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const ML = 14
  const MR = 14
  const innerWidth = pageWidth - ML - MR
  const right = pageWidth - MR

  // ── Paleta (alinhada ao orçamento/comprovante) ──────────────
  const inkDark: [number, number, number] = [17, 24, 39]
  const inkMid: [number, number, number] = [55, 65, 81]
  const inkLight: [number, number, number] = [107, 114, 128]
  const inkMuted: [number, number, number] = [156, 163, 175]
  const border: [number, number, number] = [120, 130, 140]
  const borderSoft: [number, number, number] = [205, 210, 217]
  const accent: [number, number, number] = [255, 122, 0]
  const accentSoft: [number, number, number] = [255, 244, 230]
  const accentText: [number, number, number] = [138, 62, 0]
  const stripe: [number, number, number] = [245, 246, 248]

  const setInk = (c: [number, number, number]) => doc.setTextColor(c[0], c[1], c[2])
  const setFill = (c: [number, number, number]) => doc.setFillColor(c[0], c[1], c[2])
  const setStroke = (c: [number, number, number]) => doc.setDrawColor(c[0], c[1], c[2])

  /** Trunca um texto para caber em maxW (mm). */
  function fit(text: string, maxW: number): string {
    let t = text ?? ''
    if (doc.getTextWidth(t) <= maxW) return t
    while (t.length > 1 && doc.getTextWidth(t + '…') > maxW) t = t.slice(0, -1)
    return t + '…'
  }

  /** Campo "label: valor" com sublinhado, dentro de uma largura fixa. */
  function field(label: string, value: string, x: number, y: number, width: number) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    setInk(inkLight)
    doc.text(label, x, y)
    const valX = x + doc.getTextWidth(label) + 1.5
    setStroke(borderSoft)
    doc.setLineWidth(0.2)
    doc.line(valX, y + 1, x + width, y + 1)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    setInk(inkDark)
    doc.text(fit(value, x + width - valX - 1), valX, y)
  }

  // ═══════════ CABEÇALHO (empresa) ═════════════════════════════
  const headerTop = 12
  const headerH = 23
  setStroke(border)
  doc.setLineWidth(0.4)
  doc.rect(ML, headerTop, innerWidth, headerH)

  let logoEndX = ML + 4
  const logoSize = 16
  if (company.logoBase64) {
    try {
      const fmt = company.logoBase64.includes('data:image/png') ? 'PNG' : 'JPEG'
      const data = company.logoBase64.includes('base64,')
        ? company.logoBase64.split('base64,')[1]
        : company.logoBase64
      doc.addImage(data, fmt, ML + 4, headerTop + 3.5, logoSize, logoSize)
      logoEndX = ML + 4 + logoSize + 5
    } catch {
      /* ignora logo inválida */
    }
  } else {
    setFill(accent)
    doc.roundedRect(ML + 4, headerTop + 3.5, logoSize, logoSize, 2, 2, 'F')
    logoEndX = ML + 4 + logoSize + 5
  }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  setInk(inkDark)
  doc.text(fit(company.companyName, right - logoEndX - 3), logoEndX, headerTop + 7)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  setInk(inkLight)
  let cy = headerTop + 11.5
  const contactMaxW = right - logoEndX - 3
  doc.text(fit(`CNPJ: ${company.cnpj}`, contactMaxW), logoEndX, cy)
  if (company.address) {
    cy += 3.8
    doc.text(fit(company.address, contactMaxW), logoEndX, cy)
  }
  if (company.phone) {
    cy += 3.8
    doc.text(fit(`Tel: ${company.phone}`, contactMaxW), logoEndX, cy)
  }
  if (company.email) {
    cy += 3.8
    doc.text(fit(`E-mail: ${company.email}`, contactMaxW), logoEndX, cy)
  }

  // ═══════════ TÍTULO + Nº ═════════════════════════════════════
  const titleTop = headerTop + headerH
  const titleH = 12
  setStroke(border)
  doc.rect(ML, titleTop, innerWidth, titleH)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13.5)
  setInk(inkDark)
  doc.text('Recibo de Prestação de Serviços', ML + 4, titleTop + 8)

  const numberLabel =
    recibo.number !== undefined && recibo.number !== null
      ? `REC-${recibo.number.toString().padStart(4, '0')}`
      : ((recibo._id ?? '').toUpperCase().slice(-7).replace(/(.{3})(.+)/, '$1-$2') || 'NOVO')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  setInk(inkLight)
  doc.text('Nº', right - 4 - doc.getTextWidth('REC-0000') - 6, titleTop + 8)
  doc.setFont('courier', 'bold')
  doc.setFontSize(12)
  setInk(accentText)
  doc.text(numberLabel, right - 4, titleTop + 8, { align: 'right' })

  // ═══════════ DADOS DO TOMADOR ════════════════════════════════
  const infoTop = titleTop + titleH
  const infoH = 41
  setStroke(border)
  doc.rect(ML, infoTop, innerWidth, infoH)

  // Linha de local/data
  const d = recibo.date ? new Date(recibo.date) : new Date()
  const dateLine =
    `${recibo.city ? recibo.city + ', ' : ''}` +
    `${d.getDate().toString().padStart(2, '0')} de ${MONTHS[d.getMonth()]} de ${d.getFullYear()}`
  doc.setFont('helvetica', 'italic')
  doc.setFontSize(9)
  setInk(inkMid)
  doc.text(dateLine, right - 4, infoTop + 7, { align: 'right' })

  let fy = infoTop + 7
  field('Firma ou Sr.:', recibo.clientName, ML + 4, fy, innerWidth - 8 - 55)
  fy += 8
  field('Endereço:', recibo.clientAddress, ML + 4, fy, innerWidth - 8 - 40)
  field('Nº', recibo.clientAddressNumber, right - 38, fy, 34)
  fy += 8
  const col3 = (innerWidth - 8) / 3
  field('Bairro:', recibo.clientNeighborhood, ML + 4, fy, col3 - 2)
  field('Município:', recibo.clientCity, ML + 4 + col3, fy, col3 - 2)
  field('Estado:', recibo.clientState, ML + 4 + col3 * 2, fy, col3 - 2)
  fy += 8
  field('CNPJ:', recibo.clientCnpj, ML + 4, fy, (innerWidth - 8) / 2 - 2)
  field('Inscr. Est.:', recibo.clientInscricaoEstadual, ML + 4 + (innerWidth - 8) / 2, fy, (innerWidth - 8) / 2 - 2)

  // ═══════════ TABELA DE SERVIÇOS ══════════════════════════════
  const tableTop = infoTop + infoH
  const colQuant = 22
  const colValor = 34
  const colDesc = innerWidth - colQuant - colValor
  const headH = 8
  const rowH = 7.5

  // Quantas linhas cabem acima do bloco de totais + rodapé.
  const totalsH = 30
  const footerReserve = 14
  const maxTableBottom = pageHeight - footerReserve - totalsH - 6
  const availableRows = Math.max(8, Math.floor((maxTableBottom - (tableTop + headH)) / rowH))
  const rows = Math.min(Math.max(recibo.items.length, 12), availableRows)
  const tableH = headH + rows * rowH

  // Cabeçalho da tabela
  setFill(stripe)
  setStroke(border)
  doc.setLineWidth(0.4)
  doc.rect(ML, tableTop, innerWidth, headH, 'FD')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8.5)
  setInk(inkMid)
  doc.text('Quant.', ML + colQuant / 2, tableTop + 5.3, { align: 'center' })
  doc.text('Descrição dos Serviços', ML + colQuant + 3, tableTop + 5.3)
  doc.text('Valores', ML + colQuant + colDesc + colValor / 2, tableTop + 5.3, { align: 'center' })

  // Corpo: linhas (preenchidas + vazias para imitar o formulário)
  const xDesc = ML + colQuant
  const xValor = ML + colQuant + colDesc
  for (let i = 0; i < rows; i++) {
    const ry = tableTop + headH + i * rowH
    const baseline = ry + rowH - 2.6
    const item = recibo.items[i]
    if (item) {
      setInk(inkDark)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      if (item.quantity !== null && item.quantity !== undefined) {
        doc.text(String(item.quantity), ML + colQuant / 2, baseline, { align: 'center' })
      }
      doc.text(fit(item.description, colDesc - 6), xDesc + 3, baseline)
      if (item.value !== null && item.value !== undefined) {
        doc.text(formatCurrency(item.value), xValor + colValor - 3, baseline, { align: 'right' })
      }
    }
    // Linha divisória inferior da célula
    setStroke(borderSoft)
    doc.setLineWidth(0.2)
    doc.line(ML, ry + rowH, right, ry + rowH)
  }

  // Bordas externas + colunas verticais
  setStroke(border)
  doc.setLineWidth(0.4)
  doc.rect(ML, tableTop, innerWidth, tableH)
  doc.line(xDesc, tableTop, xDesc, tableTop + tableH)
  doc.line(xValor, tableTop, xValor, tableTop + tableH)

  // ═══════════ TOTAIS ══════════════════════════════════════════
  const totalsTop = tableTop + tableH + 6
  const totalsW = 92
  const tx = right - totalsW
  const trH = 7

  // Cabeçalho "TOTAL"
  setFill(accentSoft)
  setStroke(border)
  doc.setLineWidth(0.4)
  doc.rect(tx, totalsTop, totalsW, trH, 'FD')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  setInk(accentText)
  doc.setCharSpace(0.6)
  doc.text('TOTAL', tx + totalsW / 2, totalsTop + 4.8, { align: 'center' })
  doc.setCharSpace(0)

  const totalRow = (label: string, value: number, y: number, highlight = false) => {
    if (highlight) {
      setFill(accentSoft)
      doc.rect(tx, y, totalsW, trH, 'F')
    }
    setStroke(border)
    doc.setLineWidth(0.4)
    doc.rect(tx, y, totalsW, trH)
    doc.setFont('helvetica', highlight ? 'bold' : 'normal')
    doc.setFontSize(9)
    setInk(highlight ? inkDark : inkMid)
    doc.text(label, tx + 3, y + 4.8)
    doc.setFont('helvetica', 'bold')
    setInk(highlight ? accentText : inkDark)
    doc.text(`R$ ${formatCurrency(value).replace('R$', '').trim()}`, tx + totalsW - 3, y + 4.8, { align: 'right' })
  }
  totalRow('Mão de Obra', recibo.laborTotal, totalsTop + trH)
  totalRow('Material Empregado', recibo.materialsTotal, totalsTop + trH * 2)
  totalRow('TOTAL', recibo.total, totalsTop + trH * 3, true)

  // ── Assinatura (lado esquerdo, alinhada à base dos totais) ──
  const sigY = totalsTop + trH * 4 - 2
  const sigW = 70
  setStroke(inkMid)
  doc.setLineWidth(0.3)
  doc.line(ML + 4, sigY, ML + 4 + sigW, sigY)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  setInk(inkLight)
  doc.text('Assinatura', ML + 4 + sigW / 2, sigY + 4, { align: 'center' })

  // ═══════════ RODAPÉ ══════════════════════════════════════════
  const footerY = pageHeight - 10
  setStroke(borderSoft)
  doc.setLineWidth(0.3)
  doc.line(ML, footerY, right, footerY)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  setInk(inkMuted)
  doc.text(
    `recibo gerado por empreita - ${company.companyName}`,
    pageWidth / 2,
    footerY + 5,
    { align: 'center' }
  )

  const safeName = numberLabel.replace(/[^a-zA-Z0-9-]/g, '_').toLowerCase()
  doc.save(`recibo_${safeName}.pdf`)
}

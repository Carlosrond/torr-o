// Gera os ícones do PWA (PNG) sem dependência nenhuma: "T" branco sobre âmbar,
// desenhado por matemática e codificado à mão (zlib é do Node). Rodar uma vez e
// commitar os PNGs: `node scripts/gerar-icones.mjs`.
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'

const AMBAR = [146, 64, 14] // amber-800, a cor de ação do app
const BRANCO = [255, 255, 255]

function crc32(buf) {
  let c
  const table = []
  for (let n = 0; n < 256; n++) {
    c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c
  }
  let crc = 0xffffffff
  for (const b of buf) crc = table[(crc ^ b) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(tipo, dados) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(dados.length)
  const corpo = Buffer.concat([Buffer.from(tipo), dados])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(corpo))
  return Buffer.concat([len, corpo, crc])
}

function png(tamanho) {
  // o "T": barra e haste em proporção fixa, dentro da zona segura de ícone maskable (80% central)
  const dentroDoT = (x, y) => {
    const px = x / tamanho
    const py = y / tamanho
    const barra = px >= 0.27 && px <= 0.73 && py >= 0.3 && py <= 0.42
    const haste = px >= 0.44 && px <= 0.56 && py >= 0.3 && py <= 0.74
    return barra || haste
  }

  const linhas = []
  for (let y = 0; y < tamanho; y++) {
    const linha = Buffer.alloc(1 + tamanho * 3) // byte de filtro 0 + RGB
    for (let x = 0; x < tamanho; x++) {
      const [r, g, b] = dentroDoT(x, y) ? BRANCO : AMBAR
      linha[1 + x * 3] = r
      linha[1 + x * 3 + 1] = g
      linha[1 + x * 3 + 2] = b
    }
    linhas.push(linha)
  }

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(tamanho, 0)
  ihdr.writeUInt32BE(tamanho, 4)
  ihdr[8] = 8 // 8 bits por canal
  ihdr[9] = 2 // RGB

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(Buffer.concat(linhas))),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

mkdirSync('public/icones', { recursive: true })
writeFileSync('public/icones/icone-192.png', png(192))
writeFileSync('public/icones/icone-512.png', png(512))
writeFileSync('public/icones/apple-touch-icon.png', png(180))
console.log('ícones gerados em public/icones/')

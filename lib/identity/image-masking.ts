import sharp from 'sharp'

export async function maskIdentityImage(inputBuffer: Buffer): Promise<Buffer> {
  const image = sharp(inputBuffer)
  const metadata = await image.metadata()
  const width = metadata.width ?? 800
  const height = metadata.height ?? 500

  const maskHeight = Math.floor(height * 0.40)
  const maskTop = height - maskHeight

  const overlay = Buffer.from(
    `<svg width="${width}" height="${height}">
      <rect x="0" y="${maskTop}" width="${width}" height="${maskHeight}" fill="rgba(0,0,0,0.85)" rx="4"/>
      <text x="${width / 2}" y="${maskTop + maskHeight / 2 + 6}"
            font-family="sans-serif" font-size="14" fill="white"
            text-anchor="middle" dominant-baseline="middle">민감정보 마스킹됨</text>
    </svg>`
  )

  return image
    .composite([{ input: overlay, top: 0, left: 0 }])
    .jpeg({ quality: 85 })
    .toBuffer()
}

export async function createThumbnail(inputBuffer: Buffer): Promise<Buffer> {
  return sharp(inputBuffer).resize(200, undefined, { fit: 'inside' }).jpeg({ quality: 70 }).toBuffer()
}

import QRCode from 'qrcode'

/**
 * QR 코드 → Data URL (PNG, base64)
 * 클라이언트 <img src=...> 또는 서버 응답에 사용
 */
export async function generateQrDataUrl(text: string): Promise<string> {
  return QRCode.toDataURL(text, {
    errorCorrectionLevel: 'M',
    margin: 2,
    width: 400,
    color: {
      dark: '#1a1a2e',
      light: '#ffffff',
    },
  })
}

/**
 * QR 코드 → PNG Buffer (서버에서 파일 저장 또는 HTTP 응답 시 사용)
 */
export async function generateQrBuffer(text: string): Promise<Buffer> {
  return QRCode.toBuffer(text, {
    errorCorrectionLevel: 'M',
    margin: 2,
    width: 400,
  })
}

/**
 * 현장 QR URL → QR Data URL
 */
export async function generateSiteQrDataUrl(
  baseUrl: string,
  qrToken: string
): Promise<string> {
  const url = `${baseUrl}/qr/${qrToken}`
  return generateQrDataUrl(url)
}

export interface SiteInfo {
  id: string
  name: string
  address: string
  latitude: number
  longitude: number
  allowedRadius: number
  qrToken: string
  isActive: boolean
}

export interface SiteWithDistance extends SiteInfo {
  distance?: number
}

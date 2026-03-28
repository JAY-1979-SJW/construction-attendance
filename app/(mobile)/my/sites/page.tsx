'use client'

import { useState, useEffect } from 'react'
import WorkerBottomNav from '@/components/worker/WorkerBottomNav'
import WorkerTopBar from '@/components/worker/WorkerTopBar'

interface SiteItem {
  siteId: string
  siteName: string
  companyName: string
  tradeType: string | null
  isPrimary: boolean
  allowedRadiusMeters: number
  distanceMeters: number | null
  withinRadius: boolean | null
}

export default function MySitesPage() {
  const [sites, setSites] = useState<SiteItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/attendance/available-sites')
      .then(r => r.json())
      .then(d => { if (d.success) setSites(d.sites ?? []) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <WorkerTopBar />
      <div className="px-4 pt-4">
        <h2 className="text-[16px] font-bold text-gray-800 mb-4">배정 현장</h2>

        {loading ? (
          <div className="text-center py-16 text-sm text-gray-400">불러오는 중...</div>
        ) : sites.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-[14px] text-gray-500 mb-1">배정된 현장이 없습니다</p>
            <p className="text-[12px] text-gray-400">관리자에게 현장 참여를 요청하세요.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {sites.map(site => (
              <div key={site.siteId} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="font-bold text-[15px] text-gray-800">
                      {site.siteName}
                      {site.isPrimary && (
                        <span className="ml-2 px-2 py-0.5 bg-orange-50 text-orange-600 text-[10px] rounded-full font-bold">주현장</span>
                      )}
                    </div>
                    <div className="text-[12px] text-gray-500 mt-0.5">{site.companyName}</div>
                  </div>
                  {site.distanceMeters !== null && (
                    <div className="text-right">
                      <div className={`text-[13px] font-bold ${site.withinRadius ? 'text-green-600' : 'text-gray-400'}`}>
                        {site.distanceMeters}m
                      </div>
                      <div className="text-[10px] text-gray-400">
                        {site.withinRadius ? '반경 내' : `허용 ${site.allowedRadiusMeters}m`}
                      </div>
                    </div>
                  )}
                </div>
                {site.tradeType && (
                  <span className="inline-block px-2 py-0.5 bg-gray-100 text-gray-600 text-[11px] rounded-full">
                    {site.tradeType}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      <WorkerBottomNav />
    </div>
  )
}

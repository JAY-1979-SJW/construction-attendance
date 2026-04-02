// AdminTable — 표준 테이블 컨테이너
export function AdminTable({
  headers,
  children,
  className,
}: {
  headers: (string | React.ReactNode)[]
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={`bg-card rounded-[12px] border border-brand overflow-hidden ${className ?? ''}`}>
      <div className="overflow-x-auto max-h-[calc(100vh-220px)] overflow-y-auto">
        <table className="w-full border-collapse">
          <thead className="sticky top-0 z-10">
            <tr className="bg-footer">
              {headers.map((h, i) => (
                <th
                  key={i}
                  className="text-left px-3 py-[10px] text-[11px] font-bold text-body-brand border-b border-brand whitespace-nowrap bg-footer"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>{children}</tbody>
        </table>
      </div>
    </div>
  )
}

// AdminTr — 테이블 행
export function AdminTr({
  children,
  onClick,
  highlighted,
  className,
}: {
  children: React.ReactNode
  onClick?: () => void
  highlighted?: boolean
  className?: string
}) {
  return (
    <tr
      onClick={onClick}
      className={`border-b border-[#F9FAFB] last:border-b-0 transition-colors ${
        onClick ? 'cursor-pointer' : ''
      } ${
        highlighted ? 'bg-[#FFF1F2] hover:bg-[#FFE4E6]' : 'hover:bg-surface'
      } ${className ?? ''}`}
    >
      {children}
    </tr>
  )
}

// AdminTd — 테이블 셀
export function AdminTd({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <td className={`px-3 py-[10px] text-[13px] text-body-brand whitespace-nowrap ${className ?? ''}`}>
      {children}
    </td>
  )
}

// EmptyRow — 데이터 없을 때
export function EmptyRow({ colSpan = 99, message = '데이터가 없습니다.' }: { colSpan?: number; message?: string }) {
  return (
    <tr>
      <td colSpan={colSpan} className="text-center py-12 text-muted2-brand text-[13px]">
        {message}
      </td>
    </tr>
  )
}

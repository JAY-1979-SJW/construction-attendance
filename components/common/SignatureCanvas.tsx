'use client'

import { useRef, useEffect, useState, useCallback } from 'react'

interface SignatureCanvasProps {
  onSave: (dataUri: string) => void
  width?: number
  height?: number
  accentColor?: string
  disabled?: boolean
}

export default function SignatureCanvas({
  onSave,
  width = 340,
  height = 160,
  accentColor = '#1976d2',
  disabled = false,
}: SignatureCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [hasStrokes, setHasStrokes] = useState(false)
  const lastPoint = useRef<{ x: number; y: number } | null>(null)

  // Canvas 초기화
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, width, height)
    ctx.strokeStyle = '#222222'
    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
  }, [width, height])

  const getPoint = useCallback(
    (e: React.TouchEvent | React.MouseEvent) => {
      const canvas = canvasRef.current
      if (!canvas) return null
      const rect = canvas.getBoundingClientRect()
      const scaleX = width / rect.width
      const scaleY = height / rect.height
      if ('touches' in e) {
        const touch = e.touches[0]
        return {
          x: (touch.clientX - rect.left) * scaleX,
          y: (touch.clientY - rect.top) * scaleY,
        }
      }
      return {
        x: ((e as React.MouseEvent).clientX - rect.left) * scaleX,
        y: ((e as React.MouseEvent).clientY - rect.top) * scaleY,
      }
    },
    [width, height]
  )

  const startDraw = useCallback(
    (e: React.TouchEvent | React.MouseEvent) => {
      if (disabled) return
      e.preventDefault()
      const pt = getPoint(e)
      if (!pt) return
      setIsDrawing(true)
      lastPoint.current = pt
    },
    [disabled, getPoint]
  )

  const draw = useCallback(
    (e: React.TouchEvent | React.MouseEvent) => {
      if (!isDrawing || disabled) return
      e.preventDefault()
      const pt = getPoint(e)
      if (!pt || !lastPoint.current) return
      const ctx = canvasRef.current?.getContext('2d')
      if (!ctx) return
      ctx.beginPath()
      ctx.moveTo(lastPoint.current.x, lastPoint.current.y)
      ctx.lineTo(pt.x, pt.y)
      ctx.stroke()
      lastPoint.current = pt
      if (!hasStrokes) setHasStrokes(true)
    },
    [isDrawing, disabled, getPoint, hasStrokes]
  )

  const endDraw = useCallback(() => {
    setIsDrawing(false)
    lastPoint.current = null
  }, [])

  const handleClear = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, width, height)
    setHasStrokes(false)
  }

  const handleSave = () => {
    const canvas = canvasRef.current
    if (!canvas || !hasStrokes) return
    const dataUri = canvas.toDataURL('image/png')
    onSave(dataUri)
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="text-[13px] font-semibold text-[#222] mb-1">전자서명</div>
      <div
        className="border-2 border-dashed rounded-lg overflow-hidden bg-white"
        style={{ borderColor: hasStrokes ? accentColor : '#ccc' }}
      >
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          className="w-full touch-none"
          style={{ display: 'block', cursor: disabled ? 'not-allowed' : 'crosshair' }}
          onMouseDown={startDraw}
          onMouseMove={draw}
          onMouseUp={endDraw}
          onMouseLeave={endDraw}
          onTouchStart={startDraw}
          onTouchMove={draw}
          onTouchEnd={endDraw}
        />
      </div>
      <div className="text-[11px] text-[#999] text-center">
        위 영역에 손가락 또는 마우스로 서명해 주세요
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleClear}
          disabled={disabled || !hasStrokes}
          className="flex-1 py-[10px] rounded-lg border text-[13px] font-semibold transition-colors"
          style={{
            borderColor: '#ddd',
            color: hasStrokes ? '#666' : '#ccc',
            cursor: hasStrokes && !disabled ? 'pointer' : 'not-allowed',
          }}
        >
          지우기
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={disabled || !hasStrokes}
          className="flex-1 py-[10px] rounded-lg border-none text-[13px] font-bold text-white transition-colors"
          style={{
            background: hasStrokes && !disabled ? accentColor : '#ccc',
            cursor: hasStrokes && !disabled ? 'pointer' : 'not-allowed',
          }}
        >
          서명 제출
        </button>
      </div>
    </div>
  )
}

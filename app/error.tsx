'use client';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen flex flex-col bg-[#F5F7FA]">
      <div className="h-1 w-full bg-[#F97316]" />
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center px-4">
          <h1 className="text-xl font-semibold text-[#0F172A] mb-2">
            오류가 발생했습니다
          </h1>
          <p className="text-sm text-[#6B7280] mb-8">
            페이지를 불러오는 중 문제가 발생했습니다.
          </p>
          <div className="flex flex-col items-center gap-3">
            <button
              onClick={reset}
              className="px-5 py-2.5 bg-[#F97316] text-white text-sm font-medium rounded-lg hover:bg-[#EA580C] transition-colors"
            >
              다시 시도
            </button>
            <a
              href="/"
              className="text-sm text-[#6B7280] hover:text-[#374151] transition-colors"
            >
              홈으로 돌아가기
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

'use client';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen flex flex-col bg-brand">
      <div className="h-1 w-full bg-brand-accent" />
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center px-4">
          <h1 className="text-xl font-semibold text-title-brand mb-2">
            오류가 발생했습니다
          </h1>
          <p className="text-sm text-muted-brand mb-8">
            페이지를 불러오는 중 문제가 발생했습니다.
          </p>
          <div className="flex flex-col items-center gap-3">
            <button
              onClick={reset}
              className="px-5 py-2.5 bg-brand-accent text-white text-sm font-medium rounded-lg hover:bg-brand-accent-hover transition-colors"
            >
              다시 시도
            </button>
            <a
              href="/"
              className="text-sm text-muted-brand hover:text-body-brand transition-colors"
            >
              홈으로 돌아가기
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

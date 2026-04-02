export default function Loading() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-brand">
      <div className="h-8 w-8 rounded-full border-2 border-brand border-t-accent animate-spin mb-4" />
      <p className="text-sm text-muted-brand">불러오는 중...</p>
    </div>
  );
}

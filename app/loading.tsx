export default function Loading() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#F5F7FA]">
      <div className="h-8 w-8 rounded-full border-2 border-[#E5E7EB] border-t-[#F97316] animate-spin mb-4" />
      <p className="text-sm text-[#6B7280]">불러오는 중...</p>
    </div>
  );
}

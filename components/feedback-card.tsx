type FeedbackCardProps = {
  title?: string;
  text?: string;
  loading?: boolean;
  emptyMessage?: string;
};

export default function FeedbackCard({
  title = "Feedback",
  text = "",
  loading = false,
  emptyMessage = "Submit to receive AI feedback.",
}: FeedbackCardProps) {
  const showEmpty = !loading && !text.trim();

  return (
    <div className="flex h-full flex-col rounded-2xl border border-red-200 bg-white shadow-sm">
      <div className="rounded-t-2xl bg-red-100 px-6 py-4">
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      </div>

      <div className="flex-1 p-6">
        {loading ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3 text-sm text-slate-600">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-red-300 border-t-red-700" />
              <span>Generating feedback...</span>
            </div>

            <div className="space-y-3">
              <div className="h-4 w-5/6 animate-pulse rounded bg-slate-200" />
              <div className="h-4 w-full animate-pulse rounded bg-slate-200" />
              <div className="h-4 w-4/5 animate-pulse rounded bg-slate-200" />
              <div className="h-4 w-3/4 animate-pulse rounded bg-slate-200" />
            </div>
          </div>
        ) : showEmpty ? (
          <div className="rounded-2xl bg-slate-50 p-5 text-slate-500">
            <p className="leading-7">{emptyMessage}</p>
          </div>
        ) : (
          <div className="rounded-2xl bg-slate-50 p-5">
            <p className="whitespace-pre-wrap leading-7 text-slate-900">{text}</p>
          </div>
        )}
      </div>
    </div>
  );
}
interface AISuggestionInlineCardProps {
    title: string
    value?: string
    onAccept: () => void
}

export const AISuggestionInlineCard = ({
    title,
    value,
    onAccept,
}: AISuggestionInlineCardProps) => {
    if (!value?.trim()) return null

    return (
        <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50/80 p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-amber-800">{title}</p>
                    <p className="mt-2 whitespace-pre-wrap text-sm text-stone-700">{value}</p>
                </div>
                <button
                    type="button"
                    onClick={onAccept}
                    className="shrink-0 rounded-xl border border-orange-200 bg-orange-50 px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-orange-700 transition-all hover:bg-orange-100 active:scale-95"
                >
                    Dùng gợi ý
                </button>
            </div>
        </div>
    )
}

export default AISuggestionInlineCard

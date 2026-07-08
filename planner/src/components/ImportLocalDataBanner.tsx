import { usePlannerData } from '../context/PlannerDataContext'

export function ImportLocalDataBanner() {
  const { showImportBanner, importing, importLocalData } = usePlannerData()

  if (!showImportBanner) return null

  return (
    <div className="border-b border-[#007AFF]/20 bg-[#007AFF]/5 px-4 py-3">
      <div className="mx-auto flex max-w-3xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[13px] text-[#1C1C1E]">
          Local data found on this device. Import it to your cloud account?
        </p>
        <button
          type="button"
          onClick={() => void importLocalData()}
          disabled={importing}
          className="shrink-0 rounded-lg bg-[#007AFF] px-4 py-1.5 text-[12px] font-medium text-white disabled:opacity-50"
        >
          {importing ? 'Importing…' : 'Import my existing data'}
        </button>
      </div>
    </div>
  )
}

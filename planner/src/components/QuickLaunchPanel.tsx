import { useState } from 'react'
import { Plus, Settings2, Trash2, X } from 'lucide-react'
import type { LinkedAppsActions } from '../hooks/useLinkedApps'
import type { LinkedApp, LinkedAppOpenMode } from '../types/linkedApp'
import { LinkedAppIframeModal } from './LinkedAppIframeModal'

interface LinkedAppFormProps {
  draft: Omit<LinkedApp, 'id'> & { id?: string }
  onChange: (draft: Omit<LinkedApp, 'id'> & { id?: string }) => void
  onSave: () => void
  onDelete?: () => void
  onCancel: () => void
}

function LinkedAppForm({ draft, onChange, onSave, onDelete, onCancel }: LinkedAppFormProps) {
  return (
    <div className="space-y-3 rounded-xl border border-hairline bg-white p-3 shadow-sm">
      <div className="flex gap-2">
        <input
          type="text"
          value={draft.icon ?? ''}
          onChange={(e) => onChange({ ...draft, icon: e.target.value || undefined })}
          placeholder="📋"
          maxLength={4}
          className="w-12 rounded-lg border border-hairline px-2 py-1.5 text-center text-[13px] focus:outline-none"
        />
        <input
          type="text"
          value={draft.name}
          onChange={(e) => onChange({ ...draft, name: e.target.value })}
          placeholder="App name"
          className="min-w-0 flex-1 rounded-lg border border-hairline px-3 py-1.5 text-[13px] focus:outline-none"
        />
      </div>
      <input
        type="url"
        value={draft.url}
        onChange={(e) => onChange({ ...draft, url: e.target.value })}
        placeholder="https://…"
        className="w-full rounded-lg border border-hairline px-3 py-1.5 text-[13px] focus:outline-none"
      />
      <div>
        <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-muted">
          Open mode
        </label>
        <select
          value={draft.openMode}
          onChange={(e) => onChange({ ...draft, openMode: e.target.value as LinkedAppOpenMode })}
          className="w-full rounded-lg border border-hairline px-3 py-1.5 text-[12px] focus:outline-none"
        >
          <option value="newTab">New tab (recommended)</option>
          <option value="iframe">Embedded panel</option>
        </select>
      </div>
      <div className="flex gap-1">
        <button
          type="button"
          onClick={onSave}
          disabled={!draft.name.trim() || !draft.url.trim()}
          className="rounded-lg bg-[#007AFF] px-3 py-1.5 text-[11px] font-medium text-white disabled:opacity-40"
        >
          Save
        </button>
        <button type="button" onClick={onCancel} className="rounded-lg px-3 py-1.5 text-[11px] text-muted">
          Cancel
        </button>
        {onDelete && (
          <button
            type="button"
            onClick={onDelete}
            className="ml-auto flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] text-red-500 hover:bg-red-50"
          >
            <Trash2 size={12} />
            Delete
          </button>
        )}
      </div>
    </div>
  )
}

const emptyDraft = (): Omit<LinkedApp, 'id'> => ({
  name: '',
  url: '',
  icon: '🔗',
  openMode: 'newTab',
})

interface QuickLaunchPanelProps {
  linkedApps: LinkedAppsActions
  layout?: 'vertical' | 'horizontal'
  collapsed?: boolean
}

export function QuickLaunchPanel({
  linkedApps,
  layout = 'vertical',
  collapsed = false,
}: QuickLaunchPanelProps) {
  const { linkedApps: apps, addLinkedApp, updateLinkedApp, deleteLinkedApp, openLinkedApp } =
    linkedApps
  const [iframeApp, setIframeApp] = useState<LinkedApp | null>(null)
  const [managing, setManaging] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState(emptyDraft())

  const handleLaunch = (app: LinkedApp) => {
    if (app.openMode === 'newTab') {
      openLinkedApp(app)
      return
    }
    setIframeApp(app)
  }

  const startEdit = (app: LinkedApp) => {
    setEditingId(app.id)
    setDraft({ name: app.name, url: app.url, icon: app.icon, openMode: app.openMode })
    setManaging(true)
    setAdding(false)
  }

  const startAdd = () => {
    setAdding(true)
    setEditingId(null)
    setDraft(emptyDraft())
    setManaging(true)
  }

  const saveDraft = () => {
    if (!draft.name.trim() || !draft.url.trim()) return
    if (editingId) {
      updateLinkedApp(editingId, draft)
    } else {
      addLinkedApp(draft)
    }
    setAdding(false)
    setEditingId(null)
    setManaging(false)
    setDraft(emptyDraft())
  }

  if (collapsed) {
    return (
      <>
        <div className="mt-4 flex flex-col items-center gap-2 border-t border-hairline pt-3">
          {apps.map((app) => (
            <button
              key={app.id}
              type="button"
              onClick={() => handleLaunch(app)}
              title={app.name}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-[14px] transition-colors hover:bg-white hover:shadow-sm"
            >
              {app.icon ?? '🔗'}
            </button>
          ))}
        </div>
        {iframeApp && (
          <LinkedAppIframeModal app={iframeApp} onClose={() => setIframeApp(null)} />
        )}
      </>
    )
  }

  if (layout === 'horizontal') {
    return (
      <>
        <div className="border-b border-hairline bg-white px-6 py-3">
          <div className="flex items-center gap-2 overflow-x-auto">
            <span className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-muted">
              Quick Launch
            </span>
            {apps.map((app) => (
              <button
                key={app.id}
                type="button"
                onClick={() => handleLaunch(app)}
                className="flex shrink-0 items-center gap-1.5 rounded-full bg-[#F2F2F7] px-3 py-1.5 text-[12px] font-medium text-[#48484A] ring-1 ring-[#E5E5EA]/80 transition-colors hover:bg-[#EBEBEF]"
              >
                {app.icon && <span>{app.icon}</span>}
                {app.name}
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                setManaging(true)
                startAdd()
              }}
              className="flex shrink-0 items-center rounded-full border border-dashed border-hairline p-1.5 text-muted hover:text-[#007AFF]"
              aria-label="Manage linked apps"
            >
              <Settings2 size={14} />
            </button>
          </div>
        </div>

        {managing && (
          <ManageOverlay
            apps={apps}
            adding={adding}
            editingId={editingId}
            draft={draft}
            onDraftChange={setDraft}
            onSave={saveDraft}
            onCancel={() => {
              setManaging(false)
              setAdding(false)
              setEditingId(null)
            }}
            onAdd={startAdd}
            onEdit={startEdit}
            onDelete={(id) => {
              deleteLinkedApp(id)
              setEditingId(null)
              setAdding(false)
            }}
          />
        )}

        {iframeApp && (
          <LinkedAppIframeModal app={iframeApp} onClose={() => setIframeApp(null)} />
        )}
      </>
    )
  }

  return (
    <>
      <div className="mt-6 border-t border-hairline pt-4">
        <div className="mb-2 flex items-center justify-between px-1">
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted">
            Quick Launch
          </h2>
          <button
            type="button"
            onClick={() => {
              if (managing) {
                setManaging(false)
                setAdding(false)
                setEditingId(null)
              } else {
                setManaging(true)
              }
            }}
            className="rounded-md p-1 text-muted hover:bg-white hover:shadow-sm"
            aria-label="Manage linked apps"
          >
            {managing ? <X size={14} /> : <Settings2 size={14} />}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          {apps.map((app) => (
            <button
              key={app.id}
              type="button"
              onClick={() => !managing && handleLaunch(app)}
              onContextMenu={(e) => {
                e.preventDefault()
                setManaging(true)
                startEdit(app)
              }}
              className="flex flex-col items-center gap-1 rounded-xl bg-[#F2F2F7] px-2 py-2.5 text-center transition-colors hover:bg-[#EBEBEF] ring-1 ring-[#E5E5EA]/60"
            >
              <span className="text-[18px] leading-none">{app.icon ?? '🔗'}</span>
              <span className="line-clamp-2 text-[10px] font-medium leading-tight text-[#48484A]">
                {app.name}
              </span>
            </button>
          ))}
          {managing && (
            <button
              type="button"
              onClick={startAdd}
              className="flex flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-hairline py-2.5 text-muted hover:border-[#007AFF]/40 hover:text-[#007AFF]"
            >
              <Plus size={18} />
              <span className="text-[10px] font-medium">Add</span>
            </button>
          )}
        </div>

        {managing && (adding || editingId) && (
          <div className="mt-2">
            <LinkedAppForm
              draft={draft}
              onChange={setDraft}
              onSave={saveDraft}
              onDelete={
                editingId
                  ? () => {
                      deleteLinkedApp(editingId)
                      setEditingId(null)
                      setManaging(false)
                    }
                  : undefined
              }
              onCancel={() => {
                setAdding(false)
                setEditingId(null)
              }}
            />
          </div>
        )}
      </div>

      {iframeApp && (
        <LinkedAppIframeModal app={iframeApp} onClose={() => setIframeApp(null)} />
      )}
    </>
  )
}

function ManageOverlay({
  apps,
  adding,
  editingId,
  draft,
  onDraftChange,
  onSave,
  onCancel,
  onAdd,
  onEdit,
  onDelete,
}: {
  apps: LinkedApp[]
  adding: boolean
  editingId: string | null
  draft: Omit<LinkedApp, 'id'> & { id?: string }
  onDraftChange: (d: Omit<LinkedApp, 'id'> & { id?: string }) => void
  onSave: () => void
  onCancel: () => void
  onAdd: () => void
  onEdit: (app: LinkedApp) => void
  onDelete: (id: string) => void
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 p-4 backdrop-blur-[2px]"
      onClick={onCancel}
    >
      <div
        className="max-h-[90vh] w-full max-w-sm overflow-y-auto rounded-2xl border border-hairline bg-[#FDFCF9] p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-3 text-[15px] font-semibold">Linked Apps</h2>
        <ul className="mb-3 space-y-1">
          {apps.map((app) => (
            <li key={app.id}>
              <button
                type="button"
                onClick={() => onEdit(app)}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-[13px] hover:bg-white"
              >
                <span>{app.icon ?? '🔗'}</span>
                <span className="flex-1 truncate">{app.name}</span>
                <span className="text-[10px] text-muted">{app.openMode}</span>
              </button>
            </li>
          ))}
        </ul>
        {!adding && !editingId && (
          <button
            type="button"
            onClick={onAdd}
            className="mb-3 flex w-full items-center justify-center gap-1 rounded-lg border border-dashed border-hairline py-2 text-[12px] text-muted hover:text-[#007AFF]"
          >
            <Plus size={14} />
            Add app
          </button>
        )}
        {(adding || editingId) && (
          <LinkedAppForm
            draft={draft}
            onChange={onDraftChange}
            onSave={onSave}
            onDelete={editingId ? () => onDelete(editingId) : undefined}
            onCancel={onCancel}
          />
        )}
        {!adding && !editingId && (
          <button
            type="button"
            onClick={onCancel}
            className="w-full rounded-lg py-2 text-[12px] text-muted"
          >
            Done
          </button>
        )}
      </div>
    </div>
  )
}

import type { MyRoomPerson, PersonMemory } from '../../types/myRoom'

const PROMPTS = [
  'Has anyone recently become more important to you?',
  'Who would you like to make more room for?',
  'Who have you been thinking about lately?',
  'Has anyone naturally become more distant?',
  'Who made you feel most like yourself recently?',
  'Is there someone you would like to reconnect with?',
  'Does your current room reflect what matters to you?',
]

interface ReflectionsViewProps {
  memories: PersonMemory[]
  people: MyRoomPerson[]
}

export function ReflectionsView({ memories, people }: ReflectionsViewProps) {
  const nameById = new Map(people.map((p) => [p.id, p.name]))

  return (
    <div className="flex-1 overflow-y-auto bg-[#FAF7F2] px-4 pb-24 pt-20">
      <section className="mb-8">
        <h2 className="my-room-serif mb-3 text-lg text-[#3D3229]">Optional prompts</h2>
        <ul className="space-y-3">
          {PROMPTS.map((q) => (
            <li
              key={q}
              className="rounded-xl border border-[#E8DFD4] bg-[#F7F2EB] px-4 py-3 text-sm italic text-[#5C4A3A]"
            >
              {q}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="my-room-serif mb-3 text-lg text-[#3D3229]">Memories</h2>
        {memories.length === 0 ? (
          <p className="text-sm text-[#8B7355]">Memories you add on a person&apos;s profile appear here.</p>
        ) : (
          <ul className="space-y-3">
            {[...memories].reverse().map((m) => (
              <li key={m.id} className="rounded-xl bg-white p-4 shadow-sm">
                <p className="text-xs font-medium text-[#8B7355]">
                  {nameById.get(m.personId) ?? 'Someone'} ·{' '}
                  {new Date(m.date).toLocaleDateString()}
                </p>
                <p className="mt-2 text-sm text-[#3D3229]">{m.text}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

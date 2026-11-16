export type CoachChatMessage = {
  role: 'user' | 'assistant'
  content: string
}

export type CoachChatResponse = {
  reply: string
  model?: string
  entryCount?: number
}

export async function sendCloudDiaryCoachChat(
  accessToken: string,
  messages: CoachChatMessage[],
): Promise<CoachChatResponse> {
  const res = await fetch('/api/cloud-diary-coach', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ messages }),
  })

  const payload = (await res.json()) as CoachChatResponse & { error?: string }

  if (!res.ok) {
    throw new Error(payload.error ?? `Coach request failed (${res.status})`)
  }

  if (!payload.reply?.trim()) {
    throw new Error('Empty coach response')
  }

  return payload
}

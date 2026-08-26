import type {
  CoherenceStep,
  DashboardStep,
  ExerciseKey,
  GoodtimeState,
  LongformStep,
  MindmapStep,
  OdysseyStep,
} from '../types/compass'

export type Guide = {
  key: string
  title: string
  duration: string
  cadence: string
  what: string
  why: string
  how: { step: string; body: string }[]
  tips: string[]
  traps: string[]
}

export const GUIDES: Record<string, Guide> = {
  dashboard: {
    key: 'dashboard',
    title: '라이프 대시보드',
    duration: '20~30분',
    cadence: '1~2개월마다',
    what: '건강·일·놀이·사랑 네 칸이 지금 얼마나 차 있는지 보는 거야. 칸마다 지금 실제로 하고 있는 걸 먼저 적고, 그 목록을 보면서 만족도를 정해.',
    why: '어디로 갈지는 지금 어디 있는지를 알아야 정할 수 있어. 이건 잘하고 못하고를 매기는 게 아니라 상태를 읽는 거야.',
    how: [
      {
        step: 'health',
        body: '건강부터 — 나머지의 토대라서 먼저 봐. 몸만이 아니라 마음과 정신까지.',
      },
      {
        step: 'work',
        body: '일 — 돈 받는 일만이 아니야. 부업, 집안일, 돌봄, 공부 전부.',
      },
      {
        step: 'play',
        body: '놀이 — 결과 없이 그냥 즐거워서 하는 것. 대부분 여기가 제일 비어 있어.',
      },
      {
        step: 'love',
        body: '사랑 — 연애만이 아니라 사랑이 오가는 모든 곳.',
      },
      {
        step: 'summary',
        body: '정리 — 다 채우고 나서 "여기서 뭘 바꾸고 싶은지" 하나만 적어.',
      },
    ],
    tips: [
      '목록을 먼저 채워. 게이지부터 만지면 그냥 기분으로 찍게 돼.',
      '나쁜 것도 적어. "밤에 늦게 잠"도 건강 칸 항목이야.',
      '가득 넘게 차 있는 칸이 있으면 넘겨. 넘치는 것도 상태야.',
    ],
    traps: [
      '네 칸을 골고루 맞추려고 할 때. 균형이 정답이 아니야.',
      '남이 볼 점수처럼 매길 때.',
      '놀이 칸이 비었다고 자책할 때. 비어 있는 것도 결과야.',
    ],
  },

  workview: {
    key: 'workview',
    title: '일 관점',
    duration: '30~40분',
    cadence: '6개월마다',
    what: '일에 대한 네 생각을 한 편의 글로 쓰는 거야. 500자쯤. 답변 폼이 아니라 선언문에 가까워.',
    why: '뭘 고를 때마다 매번 처음부터 고민하지 않으려면 기준이 있어야 해. 이게 그 기준의 절반이야.',
    how: [
      {
        step: 'dump',
        body: '왜 일하는지 10개 쏟아내기 — 유치해도 되고 서로 모순돼도 돼. 잘 쓰려고 하지 마.',
      },
      {
        step: 'write',
        body: '글로 잇기 — 왼쪽 목록을 다시 읽고, 거기서 반복되는 걸 한 편으로 이어.',
      },
      {
        step: 'values',
        body: '가치 3개 뽑기 — 방금 쓴 글에서 제일 크게 나온 것.',
      },
    ],
    tips: [
      '여기서 "일"은 돈 받는 일만이 아니야. 세상이랑 능동적으로 관계 맺는 것 전부.',
      '모순이 있으면 그대로 둬. 정리된 글보다 정직한 글이 나중에 쓸모 있어.',
      '500자 안 넘어도 돼. 짧고 진짜인 게 낫지.',
    ],
    traps: [
      '"어떤 일을 하고 싶은가"를 쓸 때. 그건 일 관점이 아니야.',
      '원하는 근무 조건, 회사 조건을 나열할 때.',
      '빈 화면에서 바로 쓰려고 할 때. 목록 단계를 건너뛰면 거의 못 써.',
    ],
  },

  lifeview: {
    key: 'lifeview',
    title: '삶 관점',
    duration: '30~40분',
    cadence: '6개월마다',
    what: '세상이 어떻게 돌아간다고 보는지, 뭐가 중요한지를 한 편의 글로 쓰는 거야. 500자쯤.',
    why: '일 관점이랑 합쳐지면 네 나침반이 돼. 큰 결정 앞에서 꺼내 보는 것.',
    how: [
      {
        step: 'dump',
        body: '떠오르는 대로 10개 — "왜 우리는 여기 있을까?"에서 시작해서 아무거나.',
      },
      { step: 'write', body: '글로 잇기' },
      { step: 'values', body: '가치 3개 뽑기' },
    ],
    tips: [
      '답 없는 질문들이야. 지금 생각하는 대로만 쓰면 돼.',
      '반년 뒤에 달라져 있어도 그게 정상이야. 그거 보려고 하는 거고.',
      '종교나 철학 용어 안 써도 돼. 네 말로.',
    ],
    traps: [
      '목표나 버킷리스트를 쓸 때. 그건 계획이지 관점이 아니야.',
      '멋있게 쓰려고 할 때.',
      '정답을 찾으려고 할 때.',
    ],
  },

  coherence: {
    key: 'coherence',
    title: '두 관점 맞춰보기',
    duration: '30분',
    cadence: '1년마다',
    what: '일 관점과 삶 관점을 나란히 놓고 세 가지만 물어봐. 어디서 보완하나, 어디서 부딪히나, 하나가 다른 하나를 이끌고 있나.',
    why: '둘이 대충이라도 맞물리면 내가 누구인지·뭘 믿는지·뭘 하는지가 한 줄로 서기 시작해. 이걸 마치면 네 나침반이 생겨.',
    how: [
      {
        step: 'mark',
        body: '다시 읽으면서 표시하기 — 두 글에서 문장끼리 이어봐. 보완 / 부딪힘 / 이끎.',
      },
      {
        step: 'answer',
        body: '세 질문에 쓰기 — 표시한 걸 옆에 놓고 풀어써.',
      },
      {
        step: 'compass',
        body: '나침반 확인 — 결과물을 한 장으로 보고 마무리.',
      },
    ],
    tips: [
      '부딪히는 걸 찾는 게 목적이야. 없다고 쓰지 말고 더 들여다봐.',
      '표시를 두세 개만 해도 세 질문 쓰기가 훨씬 쉬워져.',
      '세 번째 질문(뭐가 뭘 이끄나)이 제일 어려운데 제일 값져.',
    ],
    traps: [
      '부딪힘을 해결하려고 할 때. 아는 게 목적이지 없애는 게 아니야.',
      '두 글을 대충 훑고 바로 쓸 때.',
      '일관성을 점수로 매기려고 할 때.',
    ],
  },

  goodtime: {
    key: 'goodtime',
    title: '굿타임 저널',
    duration: '하루 2~3분 × 3주',
    cadence: '6개월~1년마다',
    what: '3주 동안 매일 뭘 했는지랑, 그때 얼마나 빠져들었고(몰입) 기운이 어땠는지(에너지)를 적어. 매주 끝에 돌아보고, 3주 뒤에 제일 걸리는 걸 확대해서 뜯어봐.',
    why: '"나 이런 거 좋아하는 것 같아"는 기억이 지어낸 거고, 이건 데이터야. 3주치가 쌓이면 네가 몰랐던 패턴이 나와.',
    how: [
      {
        step: 'record',
        body: '매일 3~5개 — 활동, 걸린 시간, 몰입, 에너지. 시간 가는 줄 몰랐으면 ⚡.',
      },
      {
        step: 'weekly',
        body: '주말마다 회고 — 뭐가 몰입됐고, 뭐가 기운을 뺐고, 놀라운 게 있었나.',
      },
      {
        step: 'zoom',
        body: '줌인 — 3주 끝나면 제일 걸리는 3~5개 골라서 "정확히 뭐가 좋았나" 한 줄씩.',
      },
      {
        step: 'aeiou',
        body: 'AEIOU — 고른 것만 다섯 각도로 분해.',
      },
      {
        step: 'closing',
        body: '정리 — 뭘 더 하고 뭘 줄일지.',
      },
    ],
    tips: [
      '몰입이랑 에너지는 다른 거야. 빠져드는데 진 빠지는 일이 있어. 그런 게 제일 중요한 단서야.',
      '2주차부터는 좁혀서 써. "회의" 말고 "회의에서 내 아이디어를 다들 받아줬을 때".',
      '안 좋았던 것도 적어. 마이너스 데이터가 절반이야.',
      '완벽하게 다 적으려고 하면 3일 만에 그만두게 돼.',
    ],
    traps: [
      '하루에 10개씩 다 적으려고 할 때.',
      '주간 회고를 건너뛸 때. 기록만 쌓는 건 절반이야.',
      '좋았던 것만 적을 때.',
      '하루 밀렸다고 그만둘 때. 그냥 오늘부터 이어서 해.',
    ],
  },

  mindmap: {
    key: 'mindmap',
    title: '마인드맵',
    duration: '맵당 4분 + 역할 만들기 10분',
    cadence: '3~6개월마다',
    what: '굿타임 저널에서 몰입됐던 것, 기운을 줬던 것, 시간 가는 줄 몰랐던 것을 하나씩 골라 마인드맵 세 개를 만들어. 각 맵의 바깥 링에서 세 개를 뽑아 "이런 일을 하는 사람"을 하나 만들어.',
    why: '아는 선택지 안에서만 고르면 계속 같은 데서 맴돌아. 억지로 바깥으로 나가는 장치야.',
    how: [
      {
        step: 'source',
        body: '출발점 3개 고르기 — 몰입 / 에너지 / flow 각각 하나씩.',
      },
      {
        step: 'map',
        body: '맵당 4분 — 말 되는지 따지지 말고 가지 뻗기. 5~6개씩, 세 겹까지.',
      },
      {
        step: 'pick',
        body: '바깥 링에서 3개 — 눈에 확 들어오는 거. 고민하지 말고.',
      },
      {
        step: 'role',
        body: '역할 만들기 — 그 셋을 합쳐서 하는 일 하나. 이름 붙이고 그림 그리기.',
      },
    ],
    tips: [
      '4분이 짧은 건 일부러야. 따질 시간을 안 주려고.',
      '바깥 링까지 나가야 재밌는 게 나와. 안쪽은 늘 하던 생각이야.',
      '조건은 둘뿐이야 — 나한테 재밌을 것, 남한테 도움이 될 것.',
      '졸라맨으로 그려도 돼.',
    ],
    traps: [
      '"이게 직업이 되나" 생각할 때. 될 필요 없어.',
      '안쪽 링에서 고를 때.',
      '노드 위치를 예쁘게 정리할 때. 4분 안에 그럴 시간 없어.',
      '세 역할이 다 비슷할 때 — 그럼 아직 바깥으로 안 나간 거야.',
    ],
  },

  odyssey: {
    key: 'odyssey',
    title: '오디세이 플랜',
    duration: '플랜당 30분',
    cadence: '6개월~1년마다',
    what: '앞으로 5년을 세 가지 버전으로 그려. ① 지금 가는 길 ② 그게 사라지면 ③ 돈도 남 눈도 상관없다면.',
    why: '길이 하나뿐이라고 느낄 때 실제로는 여러 개야. 셋 다 그려봐야 지금 안 보이던 게 보여.',
    how: [
      {
        step: 'plan1',
        body: '지금 가는 길 — 지금 삶이 이어지거나, 오래 품고만 있던 그 아이디어.',
      },
      {
        step: 'plan2',
        body: '그게 사라지면 — ①이 갑자기 불가능해지면 뭘 할래?',
      },
      {
        step: 'plan3',
        body: '돈도 남 눈도 상관없다면',
      },
      { step: 'compare', body: '나란히 보기' },
      {
        step: 'present',
        body: '누군가한테 말해보기 — 말하면서 어느 게 제일 신나는지 봐.',
      },
    ],
    tips: [
      '셋 다 진짜 괜찮은 삶이어야 해. 하나는 들러리로 만들지 마.',
      '타임라인에 일만 넣지 마. 결혼, 이사, 여행, 배우고 싶은 것도.',
      '제목은 타임라인 다 채우고 나서 붙여. 먼저 정하면 거기 맞추게 돼.',
      '자원이 없어도 자신 있을 수 있어. 두 게이지는 다른 거야.',
    ],
    traps: [
      '질문 칸에 걱정이나 리스크를 쓸 때. "이렇게 살면 뭘 알게 될까"를 쓰는 거야.',
      '②나 ③이 사실 ①의 변형일 때.',
      '지금 하나를 고르려고 할 때. 고르는 연습이 아니야.',
      '현실성을 따질 때. 특히 ③에서.',
    ],
  },

  prototype: {
    key: 'prototype',
    title: '프로토타입',
    duration: '계속 돌아감',
    cadence: '분기에 2~3건',
    what: '오디세이에서 쓴 질문들을 실제로 확인해보는 거야. 두 가지 방법 — 그거 하고 있는 사람 만나서 이야기 듣기(대화), 짧게 직접 해보기(경험).',
    why: '머릿속으로 아무리 굴려도 안 나오는 게 한 번 해보면 30분 만에 나와.',
    how: [
      {
        step: 'questions',
        body: '질문 모으기 — 오디세이 질문이 자동으로 들어와. 직접 추가도 하고.',
      },
      {
        step: 'ideas',
        body: '아이디어 쏟아내기 — 질문마다 만날 사람이랑 해볼 것을 여러 개.',
      },
      { step: 'pick', body: '1~3개 고르기' },
      {
        step: 'prep',
        body: '준비 — 대화면 물어볼 질문 3개 이상. 경험이면 가장 작은 버전.',
      },
      {
        step: 'log',
        body: '끝나고 기록 — 뭘 알게 됐는지, 새로 생긴 질문은 뭔지.',
      },
    ],
    tips: [
      '대화는 취업 면접이 아니야. 그 사람 이야기를 들으러 가는 거야.',
      '내가 상대보다 말을 더 많이 하고 있으면 그건 인터뷰가 아니야.',
      '구직이 아니라는 걸 미리 말해. 안 하면 상대가 부담스러워해.',
      '"또 누구랑 얘기하면 좋을까요?"는 매번 물어봐. 다음 대화가 거기서 나와.',
      '커리어만이 아니야. 관계, 건강, 사는 방식 뭐든.',
    ],
    traps: [
      '질문 없이 그냥 만날 때. 그건 커피 약속이지 프로토타입이 아니야.',
      '경험을 너무 크게 잡을 때. 크면 안 하게 돼.',
      '끝나고 기록 안 할 때. 일주일이면 다 날아가.',
      '"새로 생긴 질문"을 안 적을 때. 거기서 다음이 나오는데.',
    ],
  },

  choosing: {
    key: 'choosing',
    title: '고르기',
    duration: '모으기·좁히기 40분 + 며칠 입어보기 + 고르기 20분',
    cadence: '필요할 때',
    what: '지금까지 나온 것들을 다 모아서 3~5개로 줄이고, 며칠 입어보고, 하나 고르고, 나머지를 놓아주는 거야.',
    why: '옵션이 많으면 못 고르고, 고르고 나서도 계속 흔들려. 고르는 것보다 놓아주는 게 어렵고, 그걸 못 하면 고른 게 소용없어져.',
    how: [
      {
        step: 'gather',
        body: '다 모으기 — 오디세이, 마인드맵 역할, 프로토타입에서 나온 것 전부.',
      },
      {
        step: 'narrow',
        body: '3~5개로 줄이기 — 줄일 땐 잃을 게 없어. 잘못 지웠으면 나중에 알게 돼.',
      },
      {
        step: 'wear',
        body: '며칠씩 입어보기 — 이미 정한 것처럼 하루씩 지내보고 어땠는지 적어.',
      },
      {
        step: 'choose',
        body: '고르기 — 머리로만 고르지 마. 직감, 몸의 반응, 관계까지 같이 봐.',
      },
      {
        step: 'release',
        body: '놓아주기 — 안 고른 것들을 닫고 나아가.',
      },
    ],
    tips: [
      '3~5개까지 줄였으면 이미 못 져. 거기서 뭘 골라도 좋은 선택이야.',
      '다 좋아 보이면 직감을 들어. 직감은 네 경험의 총합이야.',
      '"충분히 좋은 것"을 고르는 게 맞아. 최고를 찾으려 하면 영영 못 골라.',
      '고르고 나서 다시 안 여는 게 이 연습의 절반이야.',
    ],
    traps: [
      '옵션을 6개 이상 남길 때. 머리가 얼어붙어.',
      '옳은 선택이 하나 있다고 믿을 때. 그런 건 없어.',
      '다 분석해서 최적을 찾으려 할 때.',
      '고른 뒤에도 계속 다른 걸 들춰볼 때.',
    ],
  },
}

export function getGuide(key: string | ExerciseKey): Guide | null {
  return GUIDES[key] ?? null
}

/** First sentence (or full short body) for the always-visible inline hint. */
export function getGuideInlineHint(
  key: string | ExerciseKey,
  step?: string | null,
): string | null {
  const guide = getGuide(key)
  if (!guide) return null
  if (step) {
    const how = guide.how.find((h) => h.step === step)
    if (how) {
      const first = how.body.split(/[—\-–]/)[0]?.trim()
      return first || how.body
    }
  }
  return guide.how[0]?.body.split(/[—\-–]/)[0]?.trim() ?? guide.what
}

export function guideFoldSummary(guide: Guide): string {
  return `${guide.what}\n\n${guide.why}`
}

const DASHBOARD_STEPS = ['health', 'work', 'play', 'love', 'summary'] as const

export function dashboardGuideStep(step: DashboardStep): string {
  return DASHBOARD_STEPS[step] ?? 'health'
}

export function longformGuideStep(step: LongformStep): string {
  return (['dump', 'write', 'values'] as const)[step] ?? 'dump'
}

export function coherenceGuideStep(step: CoherenceStep): string {
  return (['mark', 'answer', 'compass'] as const)[step] ?? 'mark'
}

export function goodtimeGuideStep(
  state: GoodtimeState,
  weeklyOpen = false,
): string {
  if (weeklyOpen) return 'weekly'
  if (state === 'zoom') return 'zoom'
  if (state === 'aeiou') return 'aeiou'
  if (state === 'closing' || state === 'done') return 'closing'
  return 'record'
}

export function mindmapGuideStep(step: MindmapStep): string {
  if (step === 'gate' || step === 'sources') return 'source'
  if (step === 'draw') return 'map'
  if (step === 'pick') return 'pick'
  if (step === 'role' || step === 'summary') return 'role'
  return 'source'
}

export function odysseyGuideStep(step: OdysseyStep): string {
  if (step === 'prep' || step === 'plan0') return 'plan1'
  if (step === 'plan1') return 'plan2'
  if (step === 'plan2') return 'plan3'
  if (step === 'side') return 'compare'
  if (step === 'present') return 'present'
  return 'plan1'
}

export function prototypeGuideStep(input: {
  tab: 'questions' | 'todo' | 'learned'
  screen:
    | 'main'
    | 'brainstorm'
    | 'pick'
    | 'prep'
    | 'reflect'
}): string {
  if (input.screen === 'brainstorm') return 'ideas'
  if (input.screen === 'pick') return 'pick'
  if (input.screen === 'prep') return 'prep'
  if (input.screen === 'reflect') return 'log'
  if (input.tab === 'learned') return 'log'
  if (input.tab === 'todo') return 'pick'
  return 'questions'
}

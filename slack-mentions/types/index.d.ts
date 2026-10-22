// `new`: no draft yet and none started, which is how a channel-wide message arrives.
export type MentionStatus = 'new' | 'drafting' | 'ready' | 'sending' | 'sent' | 'error'

export type Person = { id: string; name: string }

export type Mention = {
  id: string
  fromId?: string
  // Who took part in the conversation, for turning `@name` in a reply into a real mention.
  people?: Person[]
  // Reached you through @here / @channel / @everyone rather than by name.
  isBroadcast?: boolean
  // Sent by a bot or app: shown only when it names me, and drafted only on request.
  isBot?: boolean
  channelId: string
  channelName: string
  from: string
  time: string
  text: string
  permalink: string
  ts: string
  threadTs?: string
  draft: string
  status: MentionStatus
  error?: string
  draftingSince?: number
}

export type PollInfo = { lastCheck?: string; error?: string; isPaused: boolean; isLeader: boolean }

export type Target = { kind: 'user' | 'channel'; id: string; name: string }

export type Compose = {
  isOpen: boolean
  query: string
  results: Target[]
  target?: Target
  text: string
  status: 'idle' | 'searching' | 'sending'
  error?: string
}

declare module 'claude-code' {
  interface PluginState {
    'slack-mentions': { items: Mention[]; poll: PollInfo; isOpen: boolean; compose: Compose }
  }
}

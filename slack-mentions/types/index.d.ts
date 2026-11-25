// `new`: no draft yet and none started, which is how a channel-wide message arrives.
// `waiting`: handed to a session that works on the same task; its answer comes back as the draft.
export type MentionStatus = 'new' | 'drafting' | 'waiting' | 'ready' | 'sending' | 'sent' | 'error'

export type Person = { id: string; name: string }

export type Mention = {
  id: string
  fromId?: string
  // Who took part in the conversation, for turning `@name` in a reply into a real mention.
  people?: Person[]
  // Reached you through @here / @channel / @everyone rather than by name.
  isBroadcast?: boolean
  // Written by me and naming me: a task of mine to run, not a message to answer.
  isMine?: boolean
  // Sent by a bot or app: shown only when it names me, and drafted only on request.
  isBot?: boolean
  // Its search listing held a planted result block: the sender and channel are not certain.
  isSuspect?: boolean
  // Pressed 发送 in a session auto mode blocks: waiting for another session to send it.
  relaying?: boolean
  // The session the message was handed to (no id: one the person was asked to start), and since when.
  route?: { sessionId: string; title: string }
  waitingSince?: number
  // What that session answered: the facts the draft is written from.
  facts?: string
  // Where the draft came from, or what the card suggests, in a line.
  note?: string
  // Wants looking into and no session has it: the card offers to start one.
  wantsSession?: boolean
  // The knowledge base files the draft was written from.
  sources?: string[]
  // The pull request the message asks a review of, checked and read: sending the reply approves it first,
  // as long as its head is still this commit.
  approve?: { url: string; sha: string }
  // Written from the knowledge base alone and past every check: sent at this time unless stopped.
  autoSendAt?: number
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

export type PollInfo = { lastCheck?: string; error?: string; notice?: string; isPaused: boolean; isLeader: boolean; isByNotice?: boolean }

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
    'slack-mentions': {
      items: Mention[]
      poll: PollInfo
      isOpen: boolean
      compose: Compose
      // Cards whose long message this session shows whole.
      expanded: string[]
    }
  }
}

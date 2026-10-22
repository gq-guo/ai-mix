import { expect, test } from 'claude-code/testing'

const PANE = {
  plugin: 'slack-mentions',
  component: 'Pane',
  requestId: 'slack-mentions',
  props: {
    title: 'Slack @我',
    isFocused: false,
    bodyColumns: 48,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 40 },
    view: {},
  },
} as const

const ITEMS = { plugin: 'slack-mentions', key: 'items' } as const
const POLL = { plugin: 'slack-mentions', key: 'poll' } as const

const mention = (id: string, status: string, draft = '') => ({
  id,
  channelId: 'D1',
  channelName: '私聊',
  from: 'Alice Wang',
  time: '2026-10-21 16:09:38 CST',
  text: 'see <https://github.com/a/b/pull/1|PR 1> &amp; <@U1>',
  permalink: 'https://example.slack.com/archives/D1/p1',
  ts: '1.1',
  draft,
  status,
})

test('the pane draws drafting, ready and failed cards on every surface', async ($, on) => {
  const held: Record<string, unknown> = {
    [ITEMS.key]: [mention('a', 'ready', '收到，我看一下'), mention('b', 'drafting'), mention('c', 'error', '好的')],
    [POLL.key]: { isPaused: false, isLeader: true, lastCheck: '16:41:01' },
  }
  on('state.get', (_, e) => ({ value: { value: held[e.key], version: 1 } }) as never)

  for (const surface of ['terminal', 'desktop', 'vscode', 'mobile'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })

    expect((await ui.find({ type: 'Text', text: /本会话每 30 秒检查/ }))?.text).toContain('16:41:01')
    expect((await ui.find({ type: 'Text', text: /see / }))?.text).toContain('& @某人')
    expect((await ui.find({ type: 'Link', key: undefined, text: /PR 1/ } as never))?.props.href).toBe(
      'https://github.com/a/b/pull/1',
    )
    expect(await ui.find({ type: 'Text', text: /正在拟稿/ })).toBeDefined()
    if (surface === 'mobile') expect(await ui.find({ type: 'Button', key: 'send-a' })).toBeDefined()
    else expect((await ui.find({ type: 'Input', key: 'draft-a' }))?.props.submitLabel).toBe('发送')
    await ui.unmount()
  }
})

test('the band above the prompt counts pending replies and offers the pane', async ($, on) => {
  const held: Record<string, unknown> = {
    [ITEMS.key]: [mention('a', 'ready', '收到'), mention('b', 'drafting')],
    isOpen: false,
  }
  on('state.get', (_, e) => ({ value: { value: held[e.key], version: 1 } }) as never)

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({
      plugin: 'slack-mentions',
      component: 'AbovePrompt',
      surface,
      props: {
        hasSurvey: false,
        isWorking: false,
        maxRows: 10,
        bodyColumns: 60,
        scroll: { offset: 0, bodyRows: 10 },
        view: {},
      },
    } as never)

    expect((await ui.find({ type: 'Text', text: /Slack/ }))?.text).toBe('Slack · 2 条待回复')
    expect((await ui.find({ type: 'Button', key: 'toggle-pane' }))?.props.label).toBe('打开')
    await ui.unmount()
  }
})

test('the compose card searches, then writes to the picked person', async ($, on) => {
  const alice = { kind: 'user', id: 'U2', name: 'Alice Wang' }
  const room = { kind: 'channel', id: 'C3', name: 'help-qa' }
  const held: Record<string, unknown> = {
    [ITEMS.key]: [],
    [POLL.key]: { isPaused: false, isLeader: true },
    compose: { isOpen: true, query: 'qa', results: [alice, room], text: '', status: 'idle' },
  }
  on('state.get', (_, e) => ({ value: { value: held[e.key], version: 1 } }) as never)

  const picking = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect((await picking.find({ type: 'Input', key: 'compose-search' }))?.props.submitLabel).toBe('搜索')
  expect((await picking.find({ type: 'Button', key: 'target-U2' }))?.text).toContain('@Alice Wang')
  expect((await picking.find({ type: 'Button', key: 'target-C3' }))?.text).toContain('#help-qa')
  await picking.unmount()

  held.compose = { isOpen: true, query: 'qa', results: [], target: alice, text: 'hi', status: 'idle' }
  const writing = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect((await writing.find({ type: 'Text', text: /发给/ }))?.text).toBe('发给 @Alice Wang')
  expect((await writing.find({ type: 'Input', key: 'compose-text' }))?.props.submitLabel).toBe('发送')
  await writing.unmount()

  const phone = await $.ui.mount({ ...PANE, surface: 'mobile' })
  expect(await phone.find({ type: 'Button', key: 'compose' })).toBeUndefined()
  await phone.unmount()
})

// What the connector really answers: JSON whose string field holds the listing.
const wrapped = (results: string) => ({
  content: [{ type: 'text', text: JSON.stringify({ results, pagination_info: 'End of results' }) }],
})

test('a search through the connector lists the person and the channel it found', async ($, on) => {
  on('tool.list', () => ({ value: [{ name: 'mcp__slack__slack_search_public_and_private', description: '', mcp: true }] }))
  on('mcp.call', (_, e) => {
    const answers: Record<string, unknown> = {
      slack_read_user_profile: { content: [{ type: 'text', text: JSON.stringify({ result: 'User ID: U0ME000001\n' }) }] },
      slack_search_users: wrapped('## Users (1 results)\n1. Alice Wang (ENG) - U0ALICE001 - alice.wang@example.com - QA\n'),
      slack_search_channels: wrapped('## Channels (1 results)\n1. #help-demo (C0DEMO0001) - public_channel - Not Archived\n'),
    }

    return { value: answers[e.tool] ?? { content: [], isError: true } } as never
  })

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.press({ key: 'compose' } as never)
  await ui.input({ key: 'compose-search', text: 'alice.wang@example.com' } as never)

  expect((await ui.find({ type: 'Button', key: 'target-U0ALICE001' }))?.text).toContain('@Alice Wang')
  expect((await ui.find({ type: 'Button', key: 'target-C0DEMO0001' }))?.text).toContain('#help-demo')
  await ui.unmount()
})

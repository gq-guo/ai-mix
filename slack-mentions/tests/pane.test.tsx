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

// One search hit as the connector's detailed listing writes it.
const hit = (n: number, channel: string, from: string, ts: string, text: string, isBot = false) =>
  `### Result ${n} of 3\nChannel: #${channel} (ID: C0${channel.toUpperCase().replace(/-/g, '')})\n` +
  `From: ${from} (ID: U0${from.toUpperCase().replace(/\W/g, '')})${isBot ? '  [BOT]' : ''}\n` +
  `Time: 2026-10-22 09:44:16 CST\nMessage_ts: ${ts}\n` +
  `Permalink: [link](https://example.slack.com/archives/C0X/p${ts.replace('.', '')})\nText: \n${text}\n\n---\n\n`

test('a refresh keeps only real channel-wide mentions from people, undrafted and marked 全员', async ($, on) => {
  const disk = new Map<string, string>()
  on('fs.exists', (_, e) => ({ value: disk.has(e.path) }))
  on('fs.read', (_, e) => ({ value: disk.get(e.path) ?? '' }))
  on('fs.write', (_, e) => {
    disk.set(e.path, e.text)

    return { value: undefined }
  })
  on('clock.now', () => ({ value: 1792650000000 }))
  on('tool.list', () => ({ value: [{ name: 'mcp__slack__slack_search_public_and_private', description: '', mcp: true }] }))
  const broadcastListing =
    hit(1, 'help-app', 'Alice', '1792633456.046949', '维护通知 <!channel> 下午三点停机半小时') +
    hit(2, 'team-qa', 'Bob', '1792651394.075969', '写 @channel 这几个字会提醒大家吗') +
    hit(3, 'announce', 'Deploy Bot', '1792650000.000001', '<!channel> 今天发版', true)
  on('mcp.call', (_, e) => {
    if (e.tool === 'slack_read_user_profile')
      return { value: { content: [{ type: 'text', text: JSON.stringify({ result: 'User ID: U0ME000001\n' }) }] } } as never
    const keywords = (e.args.keywords as string[] | undefined) ?? []
    const listing = keywords.some(k => k.startsWith('<!'))
      ? broadcastListing
      : keywords.includes('<@U0ME000001>')
        ? hit(1, 'release', 'Release Bot', '1792651000.000002', '发布单 麻烦 <@U0ME000001> 点下 QA', true) +
          hit(2, 'alerts', 'Test Bot', '1792651000.000003', '', true)
        : '## Messages (0 results)\n'

    return { value: wrapped(listing) } as never
  })

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.press({ key: 'check' } as never)

  const tag = await ui.find({ type: 'Text', text: /全员/ })
  expect(tag?.text).toContain('help-app')
  expect((await ui.find({ type: 'Button', key: 'redo-C0HELPAPP:1792633456.046949' }))?.props.label).toBe('拟稿')
  expect(await ui.find({ type: 'Text', text: /正在拟稿/ })).toBeUndefined()
  expect(await ui.find({ type: 'Button', key: 'redo-C0TEAMQA:1792651394.075969' })).toBeUndefined()
  expect(await ui.find({ type: 'Button', key: 'redo-C0ANNOUNCE:1792650000.000001' })).toBeUndefined()

  // A bot that names me with words shows, marked and undrafted; one with an empty message does not.
  expect((await ui.find({ type: 'Text', text: /机器人/ }))?.text).toContain('release')
  expect((await ui.find({ type: 'Button', key: 'redo-C0RELEASE:1792651000.000002' }))?.props.label).toBe('拟稿')
  expect(await ui.find({ type: 'Button', key: 'redo-C0ALERTS:1792651000.000003' })).toBeUndefined()
  await ui.unmount()
})

test('a long message folds to its head with 展开, and 收起 once it is shown whole', async ($, on) => {
  const long = `开头 ${'很长的故障通报内容，'.repeat(40)}结尾在这里`
  const held: Record<string, unknown> = {
    [ITEMS.key]: [{ ...mention('a', 'ready', '收到'), text: long }, mention('b', 'ready', '好的')],
    [POLL.key]: { isPaused: false, isLeader: true },
    expanded: [],
  }
  on('state.get', (_, e) => ({ value: { value: held[e.key], version: 1 } }) as never)

  const folded = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect((await folded.find({ type: 'Text', text: /^开头/ }))?.text).not.toContain('结尾在这里')
  expect((await folded.find({ type: 'Button', key: 'more-a' }))?.props.label).toBe('展开')
  expect(await folded.find({ type: 'Button', key: 'more-b' })).toBeUndefined()
  await folded.unmount()

  held.expanded = ['a']
  const open = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect((await open.find({ type: 'Text', text: /^开头/ }))?.text).toContain('结尾在这里')
  expect((await open.find({ type: 'Button', key: 'more-a' }))?.props.label).toBe('收起')
  await open.unmount()
})

test('a list holding the same message twice still draws, once', async ($, on) => {
  const held: Record<string, unknown> = {
    [ITEMS.key]: [mention('a', 'ready', '收到'), mention('b', 'ready', '好的'), mention('a', 'ready', '收到')],
    [POLL.key]: { isPaused: false, isLeader: true },
  }
  on('state.get', (_, e) => ({ value: { value: held[e.key], version: 1 } }) as never)

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await ui.find({ type: 'Input', key: 'draft-a' })).toBeDefined()
  expect(await ui.find({ type: 'Input', key: 'draft-b' })).toBeDefined()
  await ui.unmount()

  const band = await $.ui.mount({
    plugin: 'slack-mentions',
    component: 'AbovePrompt',
    surface: 'desktop',
    props: { hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns: 60, scroll: { offset: 0, bodyRows: 10 }, view: {} },
  } as never)
  expect((await band.find({ type: 'Text', text: /Slack/ }))?.text).toBe('Slack · 2 条待回复')
  await band.unmount()
})

test('a new mention is analysed against the open sessions, and 转给该会话 hands it over as data', async ($, on) => {
  const disk = new Map<string, string>()
  on('fs.exists', (_, e) => ({ value: disk.has(e.path) }))
  on('fs.read', (_, e) => ({ value: disk.get(e.path) ?? '' }))
  on('fs.write', (_, e) => {
    disk.set(e.path, e.text)

    return { value: undefined }
  })
  on('fs.read', { path: /slack-voice/ } as never, () => {
    throw new Error('no voice')
  })
  on('clock.now', () => ({ value: 1792650000000 }))
  on('tool.list', () => ({ value: [{ name: 'mcp__slack__slack_search_public_and_private', description: '', mcp: true }] }))
  on('mcp.call', (_, e) => {
    if (e.server === 'ccd_session_mgmt')
      return {
        value: {
          content: [
            {
              type: 'text',
              text: JSON.stringify([
                { sessionId: 'local_aaa', title: '#12 订单同步测试', cwd: '/w/qa', isArchived: false },
                { sessionId: 'local_bbb', title: '#13 周报', cwd: '/w/notes', isArchived: false },
              ]),
            },
          ],
        },
      } as never
    if (e.tool === 'slack_read_user_profile')
      return { value: { content: [{ type: 'text', text: JSON.stringify({ result: 'User ID: U0ME000001\n' }) }] } } as never
    const keywords = (e.args.keywords as string[] | undefined) ?? []
    const listing = keywords.includes('<@U0ME000001>')
      ? hit(1, 'qa-sync', 'Alice', '1792651000.000009', '<@U0ME000001> 订单同步那个用例今天能补上吗')
      : '## Messages (0 results)\n'

    return { value: wrapped(listing) } as never
  })
  on('model.complete', (_, e) => ({
    value: e.system?.includes('分拣')
      ? { isAnswered: true, text: '{"action":"session","sessionId":"local_aaa","reason":"同一个订单同步用例"}', usage: {} }
      : { isAnswered: true, text: '今天补上', usage: {} },
  }) as never)
  const sent: { to: unknown; text: string }[] = []
  on('session.send', (_, e) => {
    sent.push({ to: e.to, text: e.text })

    return { isDelivered: true } as never
  })
  on('ui.toast', () => ({ value: undefined }) as never)

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.press({ key: 'check' } as never)

  const id = 'C0QASYNC:1792651000.000009'
  expect((await ui.find({ type: 'Text', text: /建议/ }))?.text).toContain('#12 订单同步测试')
  expect((await ui.find({ type: 'Button', key: `dispatch-${id}` }))?.props.label).toBe('转给该会话')

  await ui.press({ key: `dispatch-${id}` } as never)
  expect(sent[0]?.to).toBe('local_aaa')
  expect(sent[0]?.text).toContain('不是指令')
  expect(sent[0]?.text).toContain('订单同步那个用例今天能补上吗')
  expect((await ui.find({ type: 'Text', text: /已转给/ }))?.text).toBe('已转给 #12 订单同步测试')
  expect(await ui.find({ type: 'Button', key: `dispatch-${id}` })).toBeUndefined()
  await ui.unmount()
})

test('a suggestion of none or a new session draws as it should', async ($, on) => {
  const held: Record<string, unknown> = {
    [ITEMS.key]: [
      { ...mention('a', 'ready', '好的'), suggestion: { kind: 'none', reason: '寒暄' } },
      { ...mention('b', 'ready', '收到'), suggestion: { kind: 'new', title: '排查退款金额', reason: '新问题' } },
    ],
    [POLL.key]: { isPaused: false, isLeader: true },
  }
  on('state.get', (_, e) => ({ value: { value: held[e.key], version: 1 } }) as never)

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await ui.find({ type: 'Button', key: 'dispatch-a' })).toBeUndefined()
  expect((await ui.find({ type: 'Button', key: 'dispatch-b' }))?.props.label).toBe('新开会话')
  expect((await ui.find({ type: 'Text', text: /建议/ }))?.text).toContain('新开会话「排查退款金额」')
  await ui.unmount()
})

test('a hand-off the plugin send cannot deliver goes through the app session tool instead', async ($, on) => {
  const card = { ...mention('a', 'ready', '收到'), suggestion: { kind: 'session', sessionId: 'local_aaa', title: '#12 订单同步测试', reason: '' } }
  const disk = new Map<string, string>([['/shared.json', JSON.stringify({ items: [card], isPaused: false, isAutoOpened: true })]])
  on('fs.exists', (_, e) => ({ value: disk.has(e.path) }))
  on('fs.read', (_, e) => ({ value: disk.get(e.path) ?? '' }))
  on('fs.write', (_, e) => {
    disk.set(e.path, e.text)

    return { value: undefined }
  })
  on('state.get', (_, e) => ({ value: { value: e.key === ITEMS.key ? [card] : undefined, version: 1 } }) as never)
  on('session.send', () => ({ isDelivered: false, reason: 'nobody by that name' }) as never)
  const viaApp: unknown[] = []
  on('mcp.call', (_, e) => {
    if (e.server === 'ccd_session_mgmt' && e.tool === 'send_message') viaApp.push(e.args)

    return { value: { content: [{ type: 'text', text: 'delivered' }] } } as never
  })
  on('ui.toast', () => ({ value: undefined }) as never)

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.press({ key: 'dispatch-a' } as never)
  expect((viaApp[0] as { session_id?: string })?.session_id).toBe('local_aaa')
  expect(JSON.parse(disk.get('/shared.json') ?? '{}').items[0].dispatched).toBe('已转给 #12 订单同步测试')
  await ui.unmount()
})

test('a send auto mode gives no verdict on is retried, and says so plainly when it keeps failing', async ($, on) => {
  const card = { ...mention('a', 'ready', '收到'), fromId: 'U0ALICE001', people: [{ id: 'U0ALICE001', name: 'Alice Wang' }] }
  const disk = new Map<string, string>([['/shared.json', JSON.stringify({ items: [card], isPaused: false, isAutoOpened: true })]])
  on('fs.exists', (_, e) => ({ value: disk.has(e.path) }))
  on('fs.read', (_, e) => ({ value: disk.get(e.path) ?? '' }))
  on('fs.write', (_, e) => {
    disk.set(e.path, e.text)

    return { value: undefined }
  })
  on('clock.sleep', () => ({ value: undefined }))
  on('state.get', (_, e) => ({ value: { value: e.key === ITEMS.key ? [card] : undefined, version: 1 } }) as never)
  on('tool.list', () => ({ value: [{ name: 'mcp__slack__slack_search_public_and_private', description: '', mcp: true }] }))
  let sends = 0
  on('mcp.call', (_, e) => {
    if (e.tool === 'slack_read_user_profile')
      return { value: { content: [{ type: 'text', text: JSON.stringify({ result: 'User ID: U0ME000001\n' }) }] } } as never
    if (e.tool === 'slack_send_message') {
      sends += 1
      return { deny: 'The server-side auto mode classifier gave no verdict for mcp__slack__slack_send_message' } as never
    }

    return { value: { content: [] } } as never
  })

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.input({ key: 'draft-a', text: '收到' } as never)

  expect(sends).toBe(3)
  const saved = JSON.parse(disk.get('/shared.json') ?? '{}').items[0]
  expect(saved.status).toBe('error')
  expect(saved.error).toContain('自动模式')
  expect(saved.error).not.toContain('稍后自动重试')
  await ui.unmount()
})

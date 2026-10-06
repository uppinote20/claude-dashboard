/**
 * surface-probe: answers "can this client draw the dashboard's pane/band?".
 * A client draws a mod only after it attaches (session.attach) and sends ui.render asks,
 * so /surface-probe reports the roster, the attach/detach timeline and the asks per surface.
 */
import type { Register } from 'claude-code'

const MAX_EVENTS = 50

export const register: Register = on => {
  const renders = new Map<string, number>()
  const events: string[] = []
  let surfacesAtStart = '?'

  function note(now: number, line: string) {
    events.push(`${new Date(now).toISOString().slice(11, 19)} ${line}`)
    if (events.length > MAX_EVENTS) events.shift()
  }

  on('session.start', async ($, e, next) => {
    surfacesAtStart = JSON.stringify(await $.session.surfaces())
    await $.command.register({
      name: 'surface-probe',
      description: 'Report surfaces, attach/detach events and ui.render asks seen since load',
    })
    return next(e)
  })

  on('session.attach', async ($, e, next) => {
    note(await $.clock.now(), `attach ${JSON.stringify(e)}`)
    return next(e)
  })

  on('session.detach', async ($, e, next) => {
    note(await $.clock.now(), `detach ${JSON.stringify(e)}`)
    return next(e)
  })

  on('ui.render', async ($, e, next) => {
    const key = `${e.component}@${e.surface}`
    renders.set(key, (renders.get(key) ?? 0) + 1)
    return next(e)
  })

  on('command.run', { command: 'surface-probe' }, async $ => {
    const surfaces = await $.session.surfaces()
    // Each channel below shows on a surface only if that surface carries it.
    $.ui.toast('surface-probe: TOAST test')
    $.ui.status('surface-probe: STATUS test')
    $.ui.log('surface-probe: LOG test')
    const asks = [...renders].map(([k, n]) => `${k}×${n}`)
    return {
      text: [
        `surfaces(now)=${JSON.stringify(surfaces)}`,
        `surfaces(at load)=${surfacesAtStart}`,
        `renders=${JSON.stringify(asks)}`,
        `events=${JSON.stringify(events)}`,
      ].join('\n'),
    }
  })
}

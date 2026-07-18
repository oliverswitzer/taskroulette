const { chromium } = require('@playwright/test')
const path = require('path')
const fs = require('fs')

const BASE_URL = 'http://localhost:5173'
const OUT_DIR = path.join(process.cwd(), 'tests/e2e/screenshots')

fs.mkdirSync(OUT_DIR, { recursive: true })

const FIFTEEN_TASKS = Array.from({ length: 15 }, (_, i) => ({
  id: String(i + 1),
  text: `Task ${i + 1}: ${['call dentist', 'finish report', 'email Sarah', 'pay bills', 'do groceries', 'clean kitchen', 'schedule meeting', 'review PR', 'update docs', 'fix bug', 'write tests', 'deploy staging', 'respond to Slack', 'water plants', 'book haircut'][i]}`,
  position: i,
  completed: false,
}))

async function screenshot(browser, name, width, fn) {
  const ctx = await browser.newContext({ viewport: { width, height: 812 } })
  const page = await ctx.newPage()
  try {
    await page.goto(BASE_URL, { waitUntil: 'networkidle' })
    await fn(page)
    await page.waitForTimeout(350) // let animations settle
    await page.screenshot({ path: path.join(OUT_DIR, `${name}.png`), fullPage: false })
    console.log(`✓ ${name}.png`)
  } catch (e) {
    console.error(`✗ ${name}.png — ${e.message}`)
  }
  await ctx.close()
}

async function main() {
  const browser = await chromium.launch()

  for (const [width, suffix] of [[375, 'mobile'], [1280, 'desktop']]) {
    // 1. Dump empty
    await screenshot(browser, `dump-empty-${suffix}`, width, async (page) => {
      await page.waitForSelector('textarea')
    })

    // 2. Dump filled
    await screenshot(browser, `dump-filled-${suffix}`, width, async (page) => {
      await page.waitForSelector('textarea')
      await page.fill('textarea', 'Call dentist, finish the quarterly report, email Sarah about project handoff, pay bills before end of month')
    })

    // 3. Parsing
    await screenshot(browser, `parsing-${suffix}`, width, async (page) => {
      await page.evaluate(() => window.__setAppState('PARSING'))
      await page.waitForTimeout(500)
    })

    // 4. ListEdit — 3 tasks
    await screenshot(browser, `list-3tasks-${suffix}`, width, async (page) => {
      await page.evaluate(() => window.__setAppState('LIST_EDIT'))
      await page.waitForTimeout(400)
    })

    // 5. ListEdit — 15 tasks (warning state)
    await screenshot(browser, `list-15tasks-${suffix}`, width, async (page) => {
      await page.evaluate((tasks) => {
        window.__setTasks(tasks)
        window.__setAppState('LIST_EDIT')
      }, FIFTEEN_TASKS)
      await page.waitForTimeout(500)
    })
  }

  await browser.close()
  console.log('\nAll screenshots saved to', OUT_DIR)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})

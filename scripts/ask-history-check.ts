// Ask recall check — run with `npm run check:ask-history`.
//
// Recall suggests a tenant's own past questions when the engine cannot match a
// new one. Two ways that goes wrong, both worse than showing nothing:
//
//   • suggesting an unrelated question, which puts words in the user's mouth
//   • suggesting the opposite question — "who owes me money" and "who do I owe"
//     differ almost entirely in stopwords and mean opposite things
//
// So the thresholds are pinned here, along with the normalisation the stored
// form depends on. No database: the matching rules are pure.

import {
  normalizeQuestion, contentTokens, overlapScore, confidence,
  rankRecalls, isConfidentMatch, RECALL_THRESHOLD, type PastQuestion,
} from '@/lib/ask/history'

let failures = 0
function check(name: string, ok: boolean, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  ${detail}` : ''}`)
  if (!ok) failures++
}

const past = (question: string, over: Partial<PastQuestion> = {}): PastQuestion => ({
  question, answerKind: 'table', answerTitle: question, hits: 1, score: 0.5, ...over,
})

console.log('\n— Normalisation —')
{
  check('lowercases and strips punctuation',
    normalizeQuestion('Who owes me money?') === 'who owes me money',
    normalizeQuestion('Who owes me money?'))
  check('collapses whitespace',
    normalizeQuestion('  ledger   of   Babar  ') === 'ledger of babar')
  check('keeps contractions in one piece',
    normalizeQuestion("what's overdue") === 'whats overdue',
    normalizeQuestion("what's overdue"))
  check('empty input is safe', normalizeQuestion('') === '' && normalizeQuestion(null as unknown as string) === '')
  check('digits survive', normalizeQuestion('cheque 0045123') === 'cheque 0045123')
}

console.log('\n— Content tokens —')
{
  check('drops noise words',
    !contentTokens('show me the ledger of babar').includes('show'),
    contentTokens('show me the ledger of babar').join(','))
  check('keeps the meaningful ones',
    contentTokens('show me the ledger of babar').includes('ledger'))
  check('keeps "owes" and "owe" — they carry the direction',
    contentTokens('who owes me money').includes('owes') && contentTokens('who do i owe').includes('owe'))
}

console.log('\n— Overlap —')
{
  check('identical questions score 1', overlapScore('stock summary', 'stock summary') === 1)
  check('a longer question containing a shorter one scores high',
    overlapScore('ledger of ali traders', 'ledger of ali traders for last month') === 1,
    String(overlapScore('ledger of ali traders', 'ledger of ali traders for last month')))
  check('unrelated questions score 0',
    overlapScore('stock summary', 'who owes me money') === 0)
  check('empty is 0, not NaN', overlapScore('', 'stock summary') === 0)
}

console.log('\n— Opposite questions must not be recalled for each other —')
{
  // The dangerous case: near-identical spelling, opposite meaning. A trigram
  // score alone rates these highly, which is exactly why overlap dominates.
  const owed = past('who owes me money', { score: 0.75 })
  const owe  = 'who do i owe'
  check('trigram alone would have matched them', owed.score > 0.6)
  check('combined confidence does not', confidence(owed, owe) < RECALL_THRESHOLD,
    confidence(owed, owe).toFixed(2))
  check('and it is not offered', rankRecalls([owed], owe).length === 0)
}

console.log('\n— Genuine near-misses ARE recalled —')
{
  const candidates = [
    past('ledger of Babar Textiles', { score: 0.8, hits: 4 }),
    past('stock summary', { score: 0.1 }),
  ]
  const ranked = rankRecalls(candidates, 'ledger of Babar')
  check('the related question is offered', ranked.length === 1, `${ranked.length} offered`)
  check('and it is the right one', ranked[0]?.question === 'ledger of Babar Textiles')

  check('a typo still finds it',
    rankRecalls([past('stock summary', { score: 0.85 })], 'stock summry').length === 1)
}

console.log('\n— Ranking —')
{
  const a = past('ledger of Babar Textiles', { score: 0.8, hits: 1 })
  const b = past('ledger of Babar Traders', { score: 0.8, hits: 9 })
  const ranked = rankRecalls([a, b], 'ledger of Babar')
  check('both are offered', ranked.length === 2)
  check('the more-asked one comes first at equal confidence',
    ranked[0]?.hits === 9, `hits=${ranked[0]?.hits}`)
}

console.log('\n— The question just asked is never suggested back —')
{
  const same = past('stock summary', { score: 1 })
  check('exact repeat is excluded', rankRecalls([same], 'stock summary').length === 0)
  check('and so is a differently-cased repeat', rankRecalls([same], 'Stock Summary?').length === 0)
}

console.log('\n— Answering outright needs near-certainty —')
{
  check('near-identical wording qualifies',
    isConfidentMatch(past('stock summary', { score: 1 }), 'stock summary!'))
  check('a merely good match does not',
    !isConfidentMatch(past('ledger of Babar Textiles', { score: 0.6 }), 'ledger of Babar'))
}

console.log('\n— Nothing to recall —')
{
  check('an empty history offers nothing', rankRecalls([], 'anything').length === 0)
  check('an empty question offers nothing', rankRecalls([past('stock summary')], '').length === 0)
}

console.log(failures === 0 ? '\nAll checks passed.\n' : `\n${failures} check(s) FAILED.\n`)
process.exit(failures === 0 ? 0 : 1)

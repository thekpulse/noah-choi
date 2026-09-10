import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(root, 'index.html'), 'utf8');
const baseline = readFileSync(join(root, 'source', 'baseline.html'), 'utf8');
let passed = 0;

function test(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`✓ ${name}`);
  } catch (error) {
    console.error(`✗ ${name}`);
    throw error;
  }
}

function engine(source) {
  const end = source.indexOf('/* ══════════ ENGINE END ══════════');
  assert.ok(end > 0, '계산 엔진 종료 표식을 찾을 수 없습니다.');
  const start = source.lastIndexOf('<script>', end) + '<script>'.length;
  assert.ok(start >= '<script>'.length, '계산 엔진 시작 태그를 찾을 수 없습니다.');
  return source.slice(start, end);
}

test('v44 계산 엔진을 변경하지 않았다', () => {
  assert.equal(engine(html), engine(baseline));
});

test('모든 인라인 JavaScript의 문법이 유효하다', () => {
  const temp = mkdtempSync(join(tmpdir(), 'yeongkkeul-v47-'));
  try {
    const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)]
      .map((match) => match[1])
      .filter((script) => script.trim());
    assert.ok(scripts.length > 0);
    scripts.forEach((script, index) => {
      const path = join(temp, `inline-${index}.js`);
      writeFileSync(path, script);
      execFileSync(process.execPath, ['--check', path], { stdio: 'pipe' });
    });
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
});

test('정적 화면 마크업의 id가 중복되지 않는다', () => {
  const markup = html
    .replace(/<script(?:\s[^>]*)?>[\s\S]*?<\/script>/g, '')
    .replace(/<style(?:\s[^>]*)?>[\s\S]*?<\/style>/g, '');
  const ids = [...markup.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
  const duplicates = [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];
  assert.deepEqual(duplicates, []);
});

test('결과의 핵심 금액과 비용 수정 진입점이 존재한다', () => {
  for (const id of ['easyPrice', 'easyCost', 'heroAmount', 'tileMonthly', 'easyCash', 'easyLoan']) {
    assert.match(html, new RegExp(`id="${id}"`), `${id}가 없습니다.`);
  }
  assert.match(html, /id="easyCostOpen"[^>]+aria-label="부대비용 항목과 금액 조정"/);
  assert.match(html, /<i class="math-sign"[^>]*>\+<\/i>부대비용/);
});

test('주택담보대출 월 상환액과 세전 소득 비율을 구분한다', () => {
  assert.match(html, /주택담보대출 월 상환액/);
  assert.match(html, /'세전 소득의'/);
  assert.match(html, /기존 대출 월 .*포함한 비율입니다/);
});

test('대출별 입력 토글과 합산 로직이 연결되어 있다', () => {
  assert.match(html, /if\(dl \|\| dbt\)/);
  assert.match(html, /S\.debtPartsOpen = !S\.debtPartsOpen/);
  assert.match(html, /const t=\(S\.debtParts\.credit\|\|0\)\+\(S\.debtParts\.etc\|\|0\)/);
  assert.match(html, /id="inDebtCredit"[^>]+aria-label="신용대출 매달 갚을 돈\(만원\)"/);
  assert.match(html, /id="inDebtEtc"[^>]+aria-label="기타 대출 매달 갚을 돈\(만원\)"/);
});

test('대출 없이 계산하는 경로가 소득과 금리 입력을 건너뛴다', () => {
  assert.match(html, /id="mainNoLoan"/);
  assert.match(html, /if\(S\.noLoan\) S\.income=null/);
  assert.match(html, /if\(!\(loan > 0\)\)\{ box\.setAttribute\('hidden',''\)/);
});

test('첫 화면의 대출 없음 선택 상태가 행 전체에 표시된다', () => {
  assert.match(html, /\.crows \.main-no-loan:has\(input:checked\)\{/);
  assert.match(html, /\.crows \.main-no-loan:has\(input:checked\)::after\{content:'선택됨'/);
  assert.match(html, /border-color:#9aade4/);
});

test('부대비용 및 대출 상한 입력이 결과를 다시 계산한다', () => {
  assert.match(html, /S\.broker\.v = d \? \+d : 0/);
  assert.match(html, /lastCommitted = i\.value/);
  assert.match(html, /S\.loanCap = d \? \+d : 0/);
  assert.match(html, /capCommitted = i\.value/);
});

test('상세 창의 접근성 이름과 상태 속성이 있다', () => {
  assert.match(html, /id="qSheet"[^>]+role="dialog"[^>]+aria-modal="true"/);
  assert.match(html, /id="whySheet"[^>]+role="dialog"[^>]+aria-modal="true"/);
  assert.match(html, /id="swMci" aria-label="MCI·MCG 가입 조건 적용"/);
  assert.match(html, /id="swCap" aria-label="대출 한도 직접 입력"/);
  assert.match(html, /role="switch"/);
});

test('지원 모바일 폭에서 가로 넘침 방지 규칙이 있다', () => {
  assert.match(html, /@media\(max-width:370px\)/);
  assert.match(html, /grid-template-columns:minmax\(0,1fr\) 44px 86px/);
  assert.match(html, /min-width:0/);
});

console.log(`\n${passed}개 테스트 통과`);

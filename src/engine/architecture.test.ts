import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Architecture invariants, enforced against the source rather than asserted in
 * a README.
 *
 * The safety story of this system rests on one structural claim: the
 * personalised model decides how much, the deterministic stage machine decides
 * what is permitted, and the model can never move a patient between stages.
 * That claim is only as good as the import graph, so the import graph is
 * checked.
 */

const ENGINE = join(process.cwd(), 'src/engine');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    if (!path.endsWith('.ts') || path.includes('.test.')) return [];
    return [path];
  });
}

const files = sourceFiles(ENGINE).map((path) => ({
  path: path.replace(`${process.cwd()}/`, ''),
  source: readFileSync(path, 'utf8'),
}));

describe('the tolerance model cannot move a patient between stages', () => {
  const toleranceFiles = files.filter((file) => file.path.includes('engine/tolerance/'));

  it('finds the tolerance modules', () => {
    expect(toleranceFiles.length).toBeGreaterThanOrEqual(5);
  });

  it.each(toleranceFiles)('$path does not import the stage machine', (file) => {
    // stage-caps.ts reads the protocol *tables*, which are data. Importing the
    // machine that advances between steps would be a different thing entirely.
    expect(file.source).not.toMatch(/from '@\/engine\/stage\/machine'/);
    expect(file.source).not.toMatch(/\bapplyDecision\b/);
    expect(file.source).not.toMatch(/\bevaluate\s*\(/);
  });

  it.each(toleranceFiles)('$path never constructs a stage transition', (file) => {
    expect(file.source).not.toMatch(/StageDecision|StageState/);
  });
});

describe('the guideline layer stays independent', () => {
  it('never imports from the engine', () => {
    // Guidelines are transcription. If they depended on the engine, a change to
    // the model could quietly change what the guideline says.
    const guidelineDir = join(process.cwd(), 'src/data/guidelines');
    for (const path of sourceFiles(guidelineDir)) {
      const source = readFileSync(path, 'utf8');
      expect(source, path).not.toMatch(/from '@\/engine/);
    }
  });
});

describe('only the stage machine issues stage decisions', () => {
  it('is applied in exactly three places, all of them replays', () => {
    const everything = sourceFiles(join(process.cwd(), 'src')).map((path) => ({
      path: path.replace(`${process.cwd()}/`, ''),
      source: readFileSync(path, 'utf8'),
    }));

    const callers = everything
      .filter((file) => /\bapplyDecision\(/.test(file.source))
      .map((file) => file.path)
      .sort();

    // machine.ts declares it; session.ts replays the real check-in log; and
    // simulate.ts replays a synthetic one for the evaluation harness. A fourth
    // name appearing here means something other than a replay is moving a
    // patient between stages, which is the thing this whole split exists to
    // prevent.
    expect(callers).toEqual([
      'src/data/synthetic/simulate.ts',
      'src/engine/session.ts',
      'src/engine/stage/machine.ts',
    ]);
  });
});

describe('every dose-bounding constant carries provenance', () => {
  const threshold = files.find((file) => file.path.endsWith('tolerance/threshold.ts'))!;

  it('reads its ceiling and ramp floor from the provenance system', () => {
    // Both directly bound a recommended dose. Left as bare literals they would
    // be invisible to the clinician-facing provenance the README promises.
    expect(threshold.source).toMatch(/SEARCH_CEILING = MAX_RECOMMENDED_LOAD\.value/);
    expect(threshold.source).toMatch(/floorIncrement = RAMP_FLOOR_INCREMENT\.value/);
  });

  it('leaves no bare decimal literal in the clamp itself', () => {
    const clamp = threshold.source.slice(
      threshold.source.indexOf('export function recommendDomain'),
      threshold.source.indexOf('export interface DayPlan'),
    );
    expect(clamp.length).toBeGreaterThan(200);
    expect(clamp).not.toMatch(/[^.\w]0\.\d+/);
  });
});

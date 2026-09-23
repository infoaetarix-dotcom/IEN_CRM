import { describe, it, expect } from 'vitest';
import {
  APPLICATION_STAGES,
  APPLICATION_STATUSES,
  APPLICATION_STATUS_STAGE,
  APPLICATION_STATUSES_BY_STAGE,
  APPLICATION_STATUS_LABELS,
  APPLICATION_STATUS_BADGE,
} from '@/lib/leads/display';

describe('application status/stage mapping', () => {
  it('has a stage, label, and badge for every status', () => {
    for (const s of APPLICATION_STATUSES) {
      expect(APPLICATION_STATUS_STAGE[s]).toBeDefined();
      expect(APPLICATION_STAGES).toContain(APPLICATION_STATUS_STAGE[s]);
      expect(APPLICATION_STATUS_LABELS[s]).toBeTruthy();
      expect(APPLICATION_STATUS_BADGE[s]).toBeTruthy();
    }
  });

  it('groups every status into exactly one stage, with none missing or duplicated', () => {
    const grouped = APPLICATION_STAGES.flatMap((stage) => APPLICATION_STATUSES_BY_STAGE[stage]);
    expect(grouped.length).toBe(APPLICATION_STATUSES.length);
    expect(new Set(grouped).size).toBe(APPLICATION_STATUSES.length);
    for (const s of APPLICATION_STATUSES) expect(grouped).toContain(s);
  });

  it('places each grouped status under the stage its own mapping says it belongs to', () => {
    for (const stage of APPLICATION_STAGES) {
      for (const s of APPLICATION_STATUSES_BY_STAGE[stage]) {
        expect(APPLICATION_STATUS_STAGE[s]).toBe(stage);
      }
    }
  });

  it('gives the enrollment stage exactly one status (Student Enrolled)', () => {
    expect(APPLICATION_STATUSES_BY_STAGE.enrollment).toEqual(['enrolled']);
  });
});

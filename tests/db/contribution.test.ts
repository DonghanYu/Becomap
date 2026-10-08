// Phase 3 완료 기준: 등록 → 집계 반영(표본 기준 충족 시) → 철회 → 집계에서 사라짐
import postgres from "postgres";
import { afterAll, describe, expect, it } from "vitest";
import { DATABASE_URL, as, createUser, flowCount, hasDb, inRollback, nodeId, occupationId, registerWithPath } from "./helpers";

describe.skipIf(!hasDb)("종사자 등록과 철회 (로컬 Postgres)", () => {
  const sql = postgres(DATABASE_URL ?? "", { max: 1, onnotice: () => {} });
  afterAll(() => sql.end());

  it("등록 5명 → 집계 반영, 1명 철회 → 집계에서 사라지고 원본도 즉시 삭제됩니다", async () => {
    await inRollback(sql, async (tx) => {
      const occ = await occupationId(tx, "data-analyst");
      const a = await nodeId(tx, "학부-수학·통계");
      const b = await nodeId(tx, "관문-정보보안기사");
      const users: string[] = [];
      for (let i = 0; i < 5; i++) {
        const u = await createUser(tx, `contrib${i}@example.test`);
        users.push(u);
        await registerWithPath(tx, u, occ, [a, b]);
      }
      expect(await flowCount(tx, occ, a, b)).toBe(5);

      const leaver = users[0]!;
      await as(tx, { role: "authenticated", sub: leaver }, async () => {
        await tx`select public.withdraw_me()`;
      });
      expect(await flowCount(tx, occ, a, b)).toBeNull();

      // soft delete가 아니라 원본 행 자체가 없어야 함
      const [c] = await tx`select count(*)::int as c from contributors where user_id = ${leaver}`;
      expect(c!.c).toBe(0);
      const [s] = await tx`select count(*)::int as c from path_steps s
        where not exists (select 1 from contributors c where c.id = s.contributor_id)`;
      expect(s!.c).toBe(0);
    });
  });

  it("경로 저장은 기존 단계를 대체하고, 공개 범위 기본값은 aggregate_only입니다", async () => {
    await inRollback(sql, async (tx) => {
      const occ = await occupationId(tx, "lawyer");
      const u = await createUser(tx, "replace@example.test");
      const a = await nodeId(tx, "고교-일반고");
      const b = await nodeId(tx, "학부-법학");
      await registerWithPath(tx, u, occ, [a, b]);
      await registerWithPath(tx, u, occ, [b]);
      await as(tx, { role: "authenticated", sub: u }, async () => {
        const rows = await tx<{ seq: number; visibility: string }[]>`select seq, visibility from path_steps`;
        expect(rows).toEqual([{ seq: 1, visibility: "aggregate_only" }]);
      });
    });
  });

  it("제안한 마디는 승인 전까지 집계에 쓰이지 않습니다", async () => {
    await inRollback(sql, async (tx) => {
      const occ = await occupationId(tx, "lawyer");
      const a = await nodeId(tx, "고교-일반고");
      const users: string[] = [];
      let proposed = 0;
      for (let i = 0; i < 5; i++) {
        const u = await createUser(tx, `prop${i}@example.test`);
        users.push(u);
        proposed = await as(tx, { role: "authenticated", sub: u }, async () => {
          const [r] = await tx<{ id: number }[]>`select public.propose_node('prep', '학원-테스트 준비') as id`;
          return r!.id;
        });
        await registerWithPath(tx, u, occ, [a, proposed]);
      }
      expect(await flowCount(tx, occ, a, proposed)).toBeNull();
      await tx`update nodes set approved = true where id = ${proposed}`;
      expect(await flowCount(tx, occ, a, proposed)).toBe(5);
    });
  });

  it("관리자가 아니면 관리자 함수를 실행할 수 없고, 관리자 작업은 감사 로그에 남습니다", async () => {
    await inRollback(sql, async (tx) => {
      const u = await createUser(tx, "notadmin@example.test");
      await tx`savepoint s1`;
      await expect(
        as(tx, { role: "authenticated", sub: u }, () => tx`select * from public.admin_review_queue(10)`),
      ).rejects.toThrow(/관리자 권한/);
      await tx`rollback to savepoint s1`;

      const admin = await createUser(tx, "admin@example.test");
      await tx`insert into admins (user_id) values (${admin})`;
      const from = await tx<{ id: number }[]>`
        insert into nodes (stage, label_type, approved) values ('prep', '학원-병합 대상', false) returning id`;
      const to = await nodeId(tx, "학원-LEET 준비");
      await as(tx, { role: "authenticated", sub: admin }, async () => {
        await tx`select public.admin_merge_nodes(${from[0]!.id}, ${to})`;
        const log = await tx<{ action: string }[]>`select action from admin_audit_log`;
        expect(log.map((l) => l.action)).toContain("merge_nodes");
      });
    });
  });
});

// Phase 1 완료 기준: 표본 5명 미만 마디·간선이 집계 뷰에서 빠지는지, 타인의 path_steps가 RLS로 막히는지 확인
import postgres from "postgres";
import { afterAll, describe, expect, it } from "vitest";
import { DATABASE_URL, as, createUser, flowCount, hasDb, inRollback, nodeId, occupationId, registerWithPath } from "./helpers";

describe.skipIf(!hasDb)("집계 뷰와 RLS (로컬 Postgres)", () => {
  const sql = postgres(DATABASE_URL ?? "", { max: 1, onnotice: () => {} });
  afterAll(() => sql.end());

  it("min_sample()은 5입니다", async () => {
    const [row] = await sql<{ m: number }[]>`select public.min_sample() as m`;
    expect(row!.m).toBe(5);
  });

  it("시드의 3명짜리 갈래(판사 ← 첫 소속-검사)는 node_agg·flow_agg에 나타나지 않습니다", async () => {
    await inRollback(sql, async (tx) => {
      const judge = await occupationId(tx, "judge");
      const n = await nodeId(tx, "첫 소속-검사");
      const raw = await tx`select count(distinct s.contributor_id)::int as c from path_steps s
        join contributors c on c.id = s.contributor_id where s.node_id = ${n} and c.occupation_id = ${judge}`;
      expect(raw[0]!.c).toBe(3); // 원본에는 존재
      await as(tx, { role: "anon" }, async () => {
        expect(await tx`select 1 from node_agg where occupation_id = ${judge} and node_id = ${n}`).toHaveLength(0);
        expect(
          await tx`select 1 from flow_agg where occupation_id = ${judge} and (from_node = ${n} or to_node = ${n})`,
        ).toHaveLength(0);
      });
    });
  });

  it("공개 집계 뷰의 모든 행은 기여자 5명 이상입니다", async () => {
    await inRollback(sql, async (tx) => {
      await as(tx, { role: "anon" }, async () => {
        const [f] = await tx`select coalesce(min(contributors), 99) as m from flow_agg`;
        const [n] = await tx`select coalesce(min(contributors), 99) as m from node_agg`;
        const [t] = await tx`select coalesce(min(contributors), 99) as m from occupation_totals`;
        expect(f!.m).toBeGreaterThanOrEqual(5);
        expect(n!.m).toBeGreaterThanOrEqual(5);
        expect(t!.m).toBeGreaterThanOrEqual(5);
      });
    });
  });

  it("새 간선은 4명일 때 숨겨지고 5명이 되면 나타납니다", async () => {
    await inRollback(sql, async (tx) => {
      const occ = await occupationId(tx, "lawyer");
      const a = await nodeId(tx, "고교-일반고");
      const b = await nodeId(tx, "학부-전문대 전기과");
      for (let i = 0; i < 4; i++) {
        const u = await createUser(tx, `edge${i}@example.test`);
        await registerWithPath(tx, u, occ, [a, b]);
      }
      expect(await flowCount(tx, occ, a, b)).toBeNull();
      const u5 = await createUser(tx, "edge5@example.test");
      await registerWithPath(tx, u5, occ, [a, b]);
      expect(await flowCount(tx, occ, a, b)).toBe(5);
    });
  });

  it("익명 사용자는 path_steps·contributors 원본을 읽을 수 없습니다", async () => {
    await inRollback(sql, async (tx) => {
      await tx`savepoint s1`;
      await expect(as(tx, { role: "anon" }, () => tx`select * from path_steps limit 1`)).rejects.toThrow(
        /permission denied/,
      );
      await tx`rollback to savepoint s1`;
      await expect(as(tx, { role: "anon" }, () => tx`select * from contributors limit 1`)).rejects.toThrow(
        /permission denied/,
      );
      await tx`rollback to savepoint s1`;
      await expect(as(tx, { role: "anon" }, () => tx`select * from keyword_volume limit 1`)).rejects.toThrow(
        /permission denied/,
      );
    });
  });

  it("로그인 사용자는 타인의 path_steps를 조회·수정·삭제할 수 없습니다", async () => {
    await inRollback(sql, async (tx) => {
      const occ = await occupationId(tx, "doctor");
      const n1 = await nodeId(tx, "고교-일반고");
      const n2 = await nodeId(tx, "관문-의과대학 입학");
      const alice = await createUser(tx, "alice@example.test");
      const bob = await createUser(tx, "bob@example.test");
      await registerWithPath(tx, alice, occ, [n1, n2]);
      await registerWithPath(tx, bob, occ, [n1]);

      await as(tx, { role: "authenticated", sub: alice }, async () => {
        expect(await tx`select * from path_steps`).toHaveLength(2); // 본인 행만
      });
      await as(tx, { role: "authenticated", sub: bob }, async () => {
        const rows = await tx`select * from path_steps`;
        expect(rows).toHaveLength(1); // 합성 기여자·alice 행은 보이지 않음
        const upd = await tx`update path_steps set node_id = ${n1} where seq = 2`;
        expect(upd.count).toBe(0);
        const del = await tx`delete from path_steps where seq = 2`;
        expect(del.count).toBe(0);
        expect(await tx`select * from contributors`).toHaveLength(1);
      });
      const [left] = await tx`select count(*)::int as c from path_steps s join contributors c on c.id = s.contributor_id
        where c.user_id = ${alice}`;
      expect(left!.c).toBe(2);
    });
  });

  it("다른 사람 명의로 기여자를 등록하거나 합성 표시를 할 수 없습니다", async () => {
    await inRollback(sql, async (tx) => {
      const occ = await occupationId(tx, "doctor");
      const alice = await createUser(tx, "alice2@example.test");
      const bob = await createUser(tx, "bob2@example.test");
      await tx`savepoint s1`;
      await expect(
        as(tx, { role: "authenticated", sub: alice }, () =>
          tx`insert into contributors (user_id, occupation_id, consent_version) values (${bob}, ${occ}, 'v1')`,
        ),
      ).rejects.toThrow(/row-level security/);
      await tx`rollback to savepoint s1`;
      await expect(
        as(tx, { role: "authenticated", sub: alice }, () =>
          tx`insert into contributors (user_id, is_synthetic, occupation_id, consent_version)
             values (${alice}, true, ${occ}, 'v1')`,
        ),
      ).rejects.toThrow(/row-level security/);
    });
  });

  it("값이 있는 gate_stats에는 모두 출처가 있습니다", async () => {
    const rows = await sql`select count(*)::int as c from gate_stats where value is not null and source_url is null`;
    expect(rows[0]!.c).toBe(0);
  });

  it("공개 뷰에는 기관명·연도·공개 범위 같은 개별 속성 컬럼이 없습니다", async () => {
    const cols = await sql<{ column_name: string }[]>`
      select column_name from information_schema.columns
      where table_schema = 'public' and table_name in ('flow_agg', 'node_agg', 'occupation_totals')`;
    const names = cols.map((c) => c.column_name);
    for (const banned of ["institution_name", "start_year_bucket", "visibility", "contributor_id", "user_id"]) {
      expect(names).not.toContain(banned);
    }
  });
});

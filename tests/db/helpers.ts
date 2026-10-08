import postgres from "postgres";

export const DATABASE_URL = process.env.DATABASE_URL;
export const hasDb = Boolean(DATABASE_URL);

export type Tx = postgres.TransactionSql;

class Rollback extends Error {}

/** 테스트를 하나의 트랜잭션에서 실행하고 항상 롤백합니다(DB 상태를 남기지 않음). */
export async function inRollback(sql: postgres.Sql, fn: (tx: Tx) => Promise<void>) {
  try {
    await sql.begin(async (tx) => {
      await fn(tx);
      throw new Rollback();
    });
  } catch (e) {
    if (!(e instanceof Rollback)) throw e;
  }
}

/** Supabase API와 같은 조건(역할 + JWT sub)으로 쿼리를 실행합니다. */
export async function as<T>(
  tx: Tx,
  who: { role: "anon" } | { role: "authenticated"; sub: string },
  fn: () => Promise<T>,
): Promise<T> {
  const claims = who.role === "authenticated" ? { sub: who.sub, role: who.role } : { role: "anon" };
  await tx`select set_config('request.jwt.claims', ${JSON.stringify(claims)}, true)`;
  await tx.unsafe(`set local role ${who.role}`);
  let result: T;
  try {
    result = await fn();
  } catch (e) {
    // 트랜잭션이 중단된 상태이므로 역할 복원은 호출 측의 savepoint 롤백에 맡기고 원래 오류를 전달합니다.
    throw e;
  }
  await tx.unsafe("reset role");
  await tx`select set_config('request.jwt.claims', '', true)`;
  return result;
}

/** auth.users에 테스트 사용자를 만듭니다(슈퍼유저 권한). */
export async function createUser(tx: Tx, email: string): Promise<string> {
  const [row] = await tx<{ id: string }[]>`insert into auth.users (email) values (${email}) returning id`;
  return row!.id;
}

export async function nodeId(tx: Tx, label: string): Promise<number> {
  const [row] = await tx<{ id: number }[]>`select id from public.nodes where label_type = ${label}`;
  if (!row) throw new Error(`마디 없음: ${label}`);
  return row.id;
}

export async function occupationId(tx: Tx, slug: string): Promise<number> {
  const [row] = await tx<{ id: number }[]>`select id from public.occupations where slug = ${slug}`;
  if (!row) throw new Error(`직업 없음: ${slug}`);
  return row.id;
}

/** 사용자 권한으로 동의 → 경로 저장까지 수행합니다. */
export async function registerWithPath(tx: Tx, sub: string, occupation: number, nodeIds: number[]) {
  await as(tx, { role: "authenticated", sub }, async () => {
    await tx`select public.register_contributor(${occupation}, 'v1-draft')`;
    const steps = nodeIds.map((id) => ({ node_id: id, start_year_bucket: "2015-2019" }));
    await tx`select public.save_my_path(${tx.json(steps)})`;
  });
}

export async function flowCount(tx: Tx, occupation: number, from: number, to: number) {
  return as(tx, { role: "anon" }, async () => {
    const rows = await tx<{ contributors: number }[]>`
      select contributors from public.flow_agg
      where occupation_id = ${occupation} and from_node = ${from} and to_node = ${to}`;
    return rows[0]?.contributors ?? null;
  });
}

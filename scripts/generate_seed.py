#!/usr/bin/env python3
"""합성(가상) 시드 데이터 생성기 → supabase/seed.sql

원칙(CLAUDE.md)
- 실존 인물·실제 기관 재직자 정보 없음: 모든 기여자는 가상이며 is_synthetic = true로 표시합니다.
- 마디는 기관명 없이 유형 라벨만 사용합니다(institution_name = NULL).
- gate_stats에는 docs/PLAN.md 부록 A에 출처와 함께 적힌 값만 넣고, 그 밖의 관문은 value = NULL로 둡니다.
- 직업당 합성 기여자 30명, 2~4개 갈래. 일부 직업에는 MIN_SAMPLE(5) 미만 갈래를 일부러 두어
  DB 뷰의 표본 필터가 동작하는지 화면에서도 확인할 수 있게 합니다.

사용: python3 scripts/generate_seed.py  (고정 난수 시드로 항상 같은 결과)
"""
from __future__ import annotations

import random
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "supabase" / "seed.sql"
SEED_NS = uuid.UUID("6f1d5d55-0000-4000-8000-00000000be00")

STAGE_BY_PREFIX = {
    "고교": "high_school",
    "학부": "undergrad",
    "대학원": "grad",
    "학원": "prep",
    "교육": "prep",
    "관문": "gate",
    "첫 소속": "first_job",
    "경력": "career",
}

# (slug, 이름, 그룹, 별칭)
OCCUPATIONS = [
    ("lawyer", "변호사", "A_전문직", ["변호사", "로이어"]),
    ("judge", "판사", "A_전문직", ["판사", "법관"]),
    ("prosecutor", "검사", "A_전문직", ["검사", "검찰"]),
    ("doctor", "의사", "A_전문직", ["의사", "의사선생님", "닥터", "의대"]),
    ("accountant", "회계사", "A_전문직", ["회계사", "공인회계사", "CPA"]),
    ("patent-attorney", "변리사", "A_전문직", ["변리사"]),
    ("tax-accountant", "세무사", "A_전문직", ["세무사"]),
    ("samsung-electronics", "삼성전자 공채 입사", "A_전문직",
     ["삼성전자", "삼성", "삼성 공채", "삼성전자 입사", "삼성전자 공채"]),
    ("software-developer", "소프트웨어 개발자", "B_기술직",
     ["소프트웨어 개발자", "개발자", "프로그래머", "SW 개발자", "백엔드 개발자", "프론트엔드 개발자"]),
    ("ai-engineer", "AI 엔지니어", "B_기술직",
     ["AI 엔지니어", "인공지능 개발자", "인공지능 엔지니어", "머신러닝 엔지니어", "AI 개발자"]),
    ("data-analyst", "데이터 분석가", "B_기술직", ["데이터 분석가", "데이터 애널리스트"]),
    ("semiconductor-engineer", "반도체 엔지니어", "B_기술직",
     ["반도체 엔지니어", "반도체 공정 엔지니어", "반도체"]),
    ("security-specialist", "정보보안 전문가", "B_기술직",
     ["정보보안 전문가", "화이트해커", "보안 전문가", "해커", "보안 엔지니어"]),
    ("electrician", "전기 기술자", "B_기술직", ["전기 기술자", "전기기사", "전기기능사", "전기공"]),
    ("auto-mechanic", "자동차 정비사", "B_기술직", ["자동차 정비사", "자동차정비사", "카센터 정비사"]),
    ("aircraft-mechanic", "항공정비사", "B_기술직", ["항공정비사", "항공 정비사", "비행기 정비사"]),
]

LAW_BASE = ["학원-LEET 준비", "관문-법학전문대학원 입학", "대학원-법학전문대학원", "관문-변호사시험"]

# 직업별 갈래: (인원, [마디 라벨...]) — 인원 합계 30
PATHS: dict[str, list[tuple[int, list[str]]]] = {
    "lawyer": [
        (14, ["고교-일반고", "학부-법학"] + LAW_BASE + ["첫 소속-로펌"]),
        (10, ["고교-일반고", "학부-비법학(인문·사회)"] + LAW_BASE + ["첫 소속-기업·공공기관 법무"]),
        (6, ["고교-자사고·특목고", "학부-법학", "관문-법학전문대학원 입학", "대학원-법학전문대학원",
             "관문-변호사시험", "첫 소속-로펌"]),
    ],
    "judge": [
        (13, ["고교-일반고", "학부-법학"] + LAW_BASE
         + ["첫 소속-로펌", "경력-법조경력 5년 이상", "관문-법관 임용", "경력-판사"]),
        (9, ["고교-일반고", "학부-비법학(인문·사회)"] + LAW_BASE
         + ["첫 소속-재판연구원", "경력-법조경력 5년 이상", "관문-법관 임용", "경력-판사"]),
        (5, ["고교-자사고·특목고", "학부-법학"] + LAW_BASE
         + ["첫 소속-기업·공공기관 법무", "경력-법조경력 5년 이상", "관문-법관 임용", "경력-판사"]),
        # 표본 기준 미만(3명) 갈래: 집계 뷰에서 빠져야 함
        (3, ["고교-일반고", "학부-법학"] + LAW_BASE
         + ["첫 소속-검사", "경력-법조경력 5년 이상", "관문-법관 임용", "경력-판사"]),
    ],
    "prosecutor": [
        (14, ["고교-일반고", "학부-법학"] + LAW_BASE + ["관문-검사 임용", "경력-검사"]),
        (11, ["고교-일반고", "학부-비법학(인문·사회)"] + LAW_BASE + ["관문-검사 임용", "경력-검사"]),
        (5, ["고교-자사고·특목고", "학부-법학"] + LAW_BASE
         + ["첫 소속-로펌", "관문-검사 임용", "경력-검사"]),
    ],
    "doctor": [
        (12, ["고교-일반고", "관문-의과대학 입학", "학부-의예과·의학과", "관문-의사 국가시험",
              "첫 소속-인턴·전공의"]),
        (9, ["고교-일반고", "학원-재수 종합반", "관문-의과대학 입학", "학부-의예과·의학과",
             "관문-의사 국가시험", "첫 소속-인턴·전공의"]),
        (6, ["고교-자사고·특목고", "관문-의과대학 입학", "학부-의예과·의학과", "관문-의사 국가시험",
             "첫 소속-공중보건의"]),
        (3, ["고교-일반고", "학부-타 전공", "학원-재수 종합반", "관문-의과대학 입학",
             "학부-의예과·의학과", "관문-의사 국가시험", "첫 소속-인턴·전공의"]),
    ],
    "accountant": [
        (14, ["고교-일반고", "학부-경영·경제", "학원-CPA 준비", "관문-공인회계사 시험", "첫 소속-회계법인"]),
        (10, ["고교-일반고", "학부-비상경 전공", "학원-CPA 준비", "관문-공인회계사 시험", "첫 소속-회계법인"]),
        (6, ["고교-일반고", "학부-경영·경제", "관문-공인회계사 시험", "첫 소속-일반 기업 재무"]),
    ],
    "patent-attorney": [
        (13, ["고교-일반고", "학부-이공계", "학원-변리사 시험 준비", "관문-변리사 시험", "첫 소속-특허법인"]),
        (10, ["고교-일반고", "학부-이공계", "대학원-이공계 석사", "학원-변리사 시험 준비", "관문-변리사 시험",
              "첫 소속-특허법인"]),
        (7, ["고교-과학고·영재고", "학부-이공계", "학원-변리사 시험 준비", "관문-변리사 시험",
             "첫 소속-기업 특허팀"]),
    ],
    "tax-accountant": [
        (14, ["고교-일반고", "학부-경영·세무", "학원-세무사 시험 준비", "관문-세무사 시험",
              "첫 소속-세무법인·세무사 사무소"]),
        (10, ["고교-일반고", "학부-기타 전공", "학원-세무사 시험 준비", "관문-세무사 시험",
              "첫 소속-세무법인·세무사 사무소"]),
        (6, ["고교-특성화고", "학부-경영·세무", "학원-세무사 시험 준비", "관문-세무사 시험",
             "첫 소속-일반 기업 재무"]),
    ],
    "samsung-electronics": [
        (12, ["고교-일반고", "학부-공학", "관문-직무적합성평가", "관문-GSAT", "관문-면접", "관문-건강검진",
              "첫 소속-삼성전자"]),
        (10, ["고교-일반고", "학부-컴퓨터공학", "관문-직무적합성평가", "관문-SW 역량테스트", "관문-면접",
              "관문-건강검진", "첫 소속-삼성전자"]),
        (8, ["고교-일반고", "학부-공학", "대학원-공학 석사", "관문-직무적합성평가", "관문-GSAT", "관문-면접",
             "관문-건강검진", "첫 소속-삼성전자"]),
    ],
    "software-developer": [
        (13, ["고교-일반고", "학부-컴퓨터공학", "첫 소속-IT 기업"]),
        (10, ["고교-일반고", "학부-비전공", "학원-부트캠프", "첫 소속-스타트업"]),
        (7, ["고교-특성화고", "학부-컴퓨터공학", "관문-정보처리기사", "첫 소속-IT 기업"]),
    ],
    "ai-engineer": [
        (13, ["고교-일반고", "학부-컴퓨터공학", "관문-대학원 진학", "대학원-AI·컴퓨터 석사",
              "첫 소속-IT 기업 AI 조직"]),
        (9, ["고교-일반고", "학부-수학·통계", "관문-대학원 진학", "대학원-AI·컴퓨터 석사",
             "첫 소속-IT 기업 AI 조직"]),
        (5, ["고교-과학고·영재고", "학부-컴퓨터공학", "첫 소속-IT 기업", "경력-AI 직무 전환"]),
        (3, ["고교-일반고", "학부-비전공", "학원-부트캠프", "첫 소속-스타트업", "경력-AI 직무 전환"]),
    ],
    "data-analyst": [
        (12, ["고교-일반고", "학부-수학·통계", "관문-ADsP", "첫 소속-기업 데이터팀"]),
        (11, ["고교-일반고", "학부-경영·경제", "학원-데이터 분석 교육과정", "관문-빅데이터분석기사",
              "첫 소속-기업 데이터팀"]),
        (7, ["고교-일반고", "학부-컴퓨터공학", "첫 소속-IT 기업", "경력-데이터 분석 직무 전환"]),
    ],
    "semiconductor-engineer": [
        (9, ["고교-일반고", "관문-계약학과 입학", "학부-반도체 계약학과", "첫 소속-반도체 제조사"]),
        (12, ["고교-일반고", "학부-전자·재료공학", "학원-반도체 교육과정", "첫 소속-반도체 제조사"]),
        (9, ["고교-과학고·영재고", "학부-전자·재료공학", "대학원-공학 석사", "첫 소속-반도체 제조사"]),
    ],
    "security-specialist": [
        (12, ["고교-일반고", "학부-정보보안", "관문-정보보안기사", "첫 소속-보안 기업"]),
        (11, ["고교-일반고", "학부-컴퓨터공학", "교육-정보보안 교육과정", "첫 소속-보안관제 기업"]),
        (7, ["고교-특성화고", "학부-정보보안", "관문-정보보안기사", "첫 소속-공공기관 보안팀"]),
    ],
    "electrician": [
        (12, ["고교-특성화고", "관문-전기기능사", "첫 소속-전기공사 업체"]),
        (11, ["고교-일반고", "학부-전기공학", "관문-전기기사", "첫 소속-전력·설비 기업"]),
        (7, ["고교-일반고", "학부-전문대 전기과", "학원-전기기사 준비", "관문-전기기사", "첫 소속-전력·설비 기업"]),
    ],
    "auto-mechanic": [
        (13, ["고교-특성화고", "관문-자동차정비기능사", "첫 소속-정비업체"]),
        (10, ["고교-일반고", "학부-전문대 자동차과", "관문-자동차정비기능사", "첫 소속-완성차 서비스센터"]),
        (7, ["고교-일반고", "교육-직업훈련(자동차정비)", "관문-자동차정비기능사", "첫 소속-정비업체"]),
    ],
    "aircraft-mechanic": [
        (13, ["고교-일반고", "관문-항공정비 학과 입학", "학부-항공정비학과", "관문-항공정비사 면허",
              "첫 소속-항공사 정비"]),
        (10, ["고교-특성화고", "교육-항공정비 전문교육기관", "관문-항공정비사 면허", "첫 소속-항공기 정비(MRO) 기업"]),
        (7, ["고교-일반고", "경력-군 항공정비", "관문-항공정비사 면허", "첫 소속-항공사 정비"]),
    ],
}

# 관문 마디 설명(사실 주장은 최소화, 수치는 gate_stats로만)
DESCRIPTIONS = {
    "관문-법학전문대학원 입학": "법학전문대학원 입학 전형입니다. 법학적성시험(LEET) 성적 등을 반영합니다.",
    "관문-변호사시험": "법학전문대학원 졸업(예정)자가 응시하는 변호사 자격시험입니다.",
    "관문-법관 임용": "법조경력 요건을 갖춘 사람 가운데 법관을 임용합니다.",
    "관문-검사 임용": "변호사 자격을 갖춘 사람 가운데 검사를 임용합니다.",
    "관문-의과대학 입학": "의과대학(의예과) 입학 전형입니다.",
    "관문-의사 국가시험": "의사 면허를 받기 위한 국가시험입니다.",
    "관문-공인회계사 시험": "공인회계사 자격시험입니다.",
    "관문-변리사 시험": "변리사 자격시험입니다.",
    "관문-세무사 시험": "세무사 자격시험입니다.",
    "관문-직무적합성평가": "삼성 신입 공채의 서류 단계 평가입니다.",
    "관문-GSAT": "삼성 직무적성검사입니다. SW 직군은 GSAT 대신 SW 역량테스트를 봅니다.",
    "관문-SW 역량테스트": "삼성 신입 공채 SW 직군의 실기형 평가입니다.",
    "관문-면접": "삼성 신입 공채의 면접 단계입니다.",
    "관문-건강검진": "삼성 신입 공채의 마지막 단계입니다.",
    "관문-정보처리기사": "정보처리 분야 국가기술자격입니다.",
    "관문-대학원 진학": "석사 과정 입학 전형입니다.",
    "관문-ADsP": "데이터 분석 분야 민간 자격입니다.",
    "관문-빅데이터분석기사": "빅데이터 분석 분야 국가기술자격입니다.",
    "관문-계약학과 입학": "기업과 대학이 협약해 운영하는 계약학과의 입학 전형입니다.",
    "관문-정보보안기사": "정보보안 분야 국가기술자격입니다.",
    "관문-전기기사": "전기 분야 국가기술자격(기사 등급)입니다.",
    "관문-전기기능사": "전기 분야 국가기술자격(기능사 등급)입니다.",
    "관문-자동차정비기능사": "자동차 정비 분야 국가기술자격입니다.",
    "관문-항공정비사 면허": "항공기 정비 업무를 위한 자격증명입니다.",
    "관문-항공정비 학과 입학": "항공정비 관련 학과의 입학 전형입니다.",
}

MOJ = "https://www.moj.go.kr/bbs/moj/182/493830/download.do"
LAWTIMES = "https://www.lawtimes.co.kr/news/203750"
SAMSUNG = ("https://news.samsung.com/kr/%EC%82%BC%EC%84%B1-2026%EB%85%84-%EC%83%81%EB%B0%98%EA%B8%B0-"
           "%EC%82%BC%EC%84%B1%EC%A7%81%EB%AC%B4%EC%A0%81%EC%84%B1%EA%B2%80%EC%82%ACgsat%EC%8B%A4%EC%8B%9C")
SAMSUNG_PROCESS = "직무적합성평가 → GSAT → 면접 → 건강검진 (SW 직군은 GSAT 대신 SW 역량테스트)"

# PLAN.md 부록 A의 값만: (마디, 연도, 지표, 값, 출처, 비고)
GATE_STATS = [
    ("관문-변호사시험", 2026, "examinees", 3364, MOJ, "제15회 변호사시험 응시자 수"),
    ("관문-변호사시험", 2026, "passers", 1714, MOJ, "제15회 변호사시험 합격자 수"),
    ("관문-변호사시험", 2026, "pass_rate_examinees", 50.95, MOJ, "제15회 변호사시험 응시자 대비 합격률(%)"),
    ("관문-변호사시험", 2026, "first_attempt_pass_rate", 70.04, MOJ, "제15회 변호사시험 초시 합격률(%)"),
    ("관문-법학전문대학원 입학", 2026, "admission_quota", 2000, MOJ, "법학전문대학원 입학정원(명)"),
    ("관문-법관 임용", None, "min_legal_career_years", 5, LAWTIMES,
     "법관 임용 최소 법조경력 5년 이상 유지(법원조직법 개정, 법률신문 보도)"),
] + [
    (gate, 2026, "procedure", None, SAMSUNG, SAMSUNG_PROCESS)
    for gate in ["관문-직무적합성평가", "관문-GSAT", "관문-SW 역량테스트", "관문-면접", "관문-건강검진"]
]


def stage_of(label: str) -> str:
    prefix = label.split("-", 1)[0]
    if prefix not in STAGE_BY_PREFIX:
        raise ValueError(f"알 수 없는 마디 접두어: {label}")
    return STAGE_BY_PREFIX[prefix]


def q(v: object) -> str:
    if v is None:
        return "null"
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, (int, float)):
        return str(v)
    return "'" + str(v).replace("'", "''") + "'"


def bucket(year: int) -> str:
    start = year - year % 5
    return f"{start}-{start + 4}"


def main() -> None:
    rng = random.Random(20261008)
    for slug, branches in PATHS.items():
        total = sum(n for n, _ in branches)
        assert total == 30, f"{slug}: 합성 기여자 수가 30이 아님({total})"

    labels: list[str] = []
    for branches in PATHS.values():
        for _, steps in branches:
            for label in steps:
                if label not in labels:
                    labels.append(label)

    lines = [
        "-- 자동 생성 파일: python3 scripts/generate_seed.py 로 다시 만드세요. 직접 수정하지 않습니다.",
        "-- 모든 기여자는 합성(가상) 데이터입니다(is_synthetic = true). 실존 인물 정보 없음.",
        "begin;",
        "",
        "insert into public.occupations (slug, name_ko, grp, aliases, sort_order) values",
    ]
    occ_rows = []
    for i, (slug, name, grp, aliases) in enumerate(OCCUPATIONS, start=1):
        arr = "array[" + ", ".join(q(a) for a in aliases) + "]::text[]"
        occ_rows.append(f"  ({q(slug)}, {q(name)}, {q(grp)}, {arr}, {i})")
    lines.append(",\n".join(occ_rows) + ";")
    lines.append("")

    lines.append("insert into public.nodes (stage, label_type, is_gate, description) values")
    node_rows = []
    for label in labels:
        st = stage_of(label)
        node_rows.append(f"  ({q(st)}, {q(label)}, {q(st == 'gate')}, {q(DESCRIPTIONS.get(label))})")
    lines.append(",\n".join(node_rows) + ";")
    lines.append("")

    # 관문 통계: 부록 A 값 + 그 밖의 관문은 NULL/TODO
    stat_rows = []
    with_stats = {g for g, *_ in GATE_STATS}
    for gate, year, metric, value, src, note in GATE_STATS:
        assert value is None or src, "값이 있는 통계는 출처가 필수입니다."
        stat_rows.append(
            f"  ((select id from public.nodes where label_type = {q(gate)}), {q(year)}, {q(metric)}, "
            f"{q(value)}, {q(src)}, {q(note)})"
        )
    for label in labels:
        if stage_of(label) == "gate" and label not in with_stats:
            stat_rows.append(
                f"  ((select id from public.nodes where label_type = {q(label)}), null, 'pass_rate_examinees', "
                f"null, null, 'TODO: 출처 확인 필요')"
            )
    lines.append("insert into public.gate_stats (node_id, year, metric, value, source_url, note) values")
    lines.append(",\n".join(stat_rows) + ";")
    lines.append("")

    contrib_rows = []
    step_rows = []
    for slug, branches in PATHS.items():
        k = 0
        for n, steps in branches:
            for _ in range(n):
                k += 1
                cid = uuid.uuid5(SEED_NS, f"{slug}-{k}")
                contrib_rows.append(
                    f"  ({q(str(cid))}, true, (select id from public.occupations where slug = {q(slug)}), "
                    f"'synthetic-v1', '2026-10-08T00:00:00Z')"
                )
                year = rng.randint(1998, 2014)  # 고교 입학 연도(가상)
                for seq, label in enumerate(steps, start=1):
                    if seq > 1:
                        year += rng.choice([1, 2, 2, 3])
                    vis = "public" if rng.random() < 0.2 else "aggregate_only"
                    step_rows.append(
                        f"  ({q(str(cid))}, {seq}, (select id from public.nodes where label_type = {q(label)}), "
                        f"{q(bucket(year))}, {q(vis)})"
                    )

    lines.append(
        "insert into public.contributors (id, is_synthetic, occupation_id, consent_version, consented_at) values"
    )
    lines.append(",\n".join(contrib_rows) + ";")
    lines.append("")
    lines.append(
        "insert into public.path_steps (contributor_id, seq, node_id, start_year_bucket, visibility) values"
    )
    lines.append(",\n".join(step_rows) + ";")
    lines.append("")
    lines.append("commit;")
    OUT.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"작성 완료: {OUT.relative_to(ROOT)} (직업 {len(OCCUPATIONS)}, 마디 {len(labels)}, "
          f"기여자 {len(contrib_rows)}, 단계 {len(step_rows)})")


if __name__ == "__main__":
    main()

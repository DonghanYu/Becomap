#!/usr/bin/env python3
"""Phase 0 — 진로 검색량 분석

입력
- keywords/*.csv : 직업·의도 매핑 (group, occupation, keyword, intent, gate_node)
- data/raw/naver_keyword_tool/* : 네이버 검색광고 키워드도구 결과(CSV 또는 XLSX)
- (선택) data/raw/career_survey_2025.csv : 직업별 희망 비율(직접 입력, 형식은 data/templates 참고)

출력 (--out, 기본 reports/)
- keyword_volume.md : 직업별 합계, 모바일 비중, 그룹 A·B 비교, 의도별 구성, (선택) 희망 비율 대비 표
- keyword_volume_by_occupation.png : 직업별 검색량 막대그래프
- keyword_volume_load.csv : keyword_volume 테이블 적재용

원칙
- 원자료의 컬럼명은 RAW_COLUMN_CANDIDATES 중 하나와 정확히 일치해야 합니다.
  일치하는 컬럼이 없으면 추측하지 않고 실제 컬럼 목록을 출력한 뒤 종료합니다(사람이 확인 후 매핑 추가).
- 키워드는 공백을 모두 제거하고 대소문자를 무시해 비교합니다.
- "<10" 같은 임계값 미만 표기는 수치로 바꾸지 않고 below_threshold = True로 표시하며,
  합계에는 포함하지 않고 별도 개수로 표기합니다.

사용 예
  python3 scripts/analyze_keywords.py                                  # 실제 원자료
  python3 scripts/analyze_keywords.py --raw-dir data/raw/samples/naver_keyword_tool --as-of 2026-10-08
"""
from __future__ import annotations

import argparse
import re
import sys
from dataclasses import dataclass
from datetime import date
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parent.parent

# 원자료 컬럼 후보. 실제 내려받은 파일을 열어 확인한 이름만 추가합니다.
# 주의: 아래 이름은 키워드도구 화면 표기를 기준으로 한 초기값이며, 실제 파일로 아직 검증되지 않았습니다.
RAW_COLUMN_CANDIDATES = {
    "keyword": ["연관키워드", "키워드"],
    "pc": ["월간검색수(PC)", "월간검색수 PC", "PC 월간검색수"],
    "mobile": ["월간검색수(모바일)", "월간검색수 모바일", "모바일 월간검색수"],
}

THRESHOLD_PATTERN = re.compile(r"^\s*<\s*\d+\s*$")
GROUP_LABEL = {"A_전문직": "A. 전문직·고위직", "B_기술직": "B. 기술직"}
INTENT_LABEL = {"how_to": "방법(되는 법)", "gate": "관문", "prep": "준비"}


class ColumnMappingError(Exception):
    pass


def normalize_keyword(s: object) -> str:
    """공백을 모두 제거하고 소문자로 바꿉니다."""
    return re.sub(r"\s+", "", str(s)).lower()


@dataclass
class Volume:
    value: int | None
    below_threshold: bool


def parse_volume(raw: object) -> Volume:
    """검색수 셀을 해석합니다. '<10'은 수치로 바꾸지 않습니다."""
    if raw is None or (isinstance(raw, float) and pd.isna(raw)):
        return Volume(None, False)
    if isinstance(raw, (int, float)):
        return Volume(int(raw), False)
    text = str(raw).strip()
    if THRESHOLD_PATTERN.match(text):
        return Volume(None, True)
    cleaned = text.replace(",", "")
    if re.fullmatch(r"\d+(\.0+)?", cleaned):
        return Volume(int(float(cleaned)), False)
    raise ValueError(f"검색수 값을 해석할 수 없습니다: {raw!r}")


def load_mapping(keywords_dir: Path) -> pd.DataFrame:
    files = sorted(keywords_dir.glob("*.csv"))
    if not files:
        raise FileNotFoundError(f"키워드 매핑 파일이 없습니다: {keywords_dir}")
    df = pd.concat([pd.read_csv(f, dtype=str, keep_default_na=False) for f in files], ignore_index=True)
    required = {"group", "occupation", "keyword", "intent"}
    missing = required - set(df.columns)
    if missing:
        raise ColumnMappingError(f"키워드 매핑 파일에 컬럼이 없습니다: {sorted(missing)}")
    df["norm"] = df["keyword"].map(normalize_keyword)
    dup = df[df.duplicated("norm", keep=False)]
    if not dup.empty:
        raise ValueError(f"공백 제거 후 중복되는 매핑 키워드가 있습니다: {sorted(dup['keyword'])}")
    return df


def _find_header(frame: pd.DataFrame) -> pd.DataFrame:
    """머리글이 첫 줄이 아닐 수 있어, 키워드 컬럼 후보가 있는 행을 머리글로 삼습니다."""
    if any(c in frame.columns for c in RAW_COLUMN_CANDIDATES["keyword"]):
        return frame
    for i in range(min(len(frame), 10)):
        row = [str(v).strip() for v in frame.iloc[i].tolist()]
        if any(c in row for c in RAW_COLUMN_CANDIDATES["keyword"]):
            out = frame.iloc[i + 1 :].copy()
            out.columns = row
            return out
    return frame


def read_raw_file(path: Path) -> pd.DataFrame:
    if path.suffix.lower() in {".xlsx", ".xls"}:
        frame = pd.read_excel(path, dtype=object)
    elif path.suffix.lower() == ".csv":
        frame = None
        for enc in ("utf-8-sig", "cp949"):
            try:
                frame = pd.read_csv(path, dtype=object, encoding=enc)
                break
            except UnicodeDecodeError:
                continue
        if frame is None:
            raise ValueError(f"인코딩을 알 수 없습니다: {path}")
    else:
        raise ValueError(f"지원하지 않는 파일 형식: {path}")
    frame.columns = [str(c).strip() for c in frame.columns]
    frame = _find_header(frame)

    mapping: dict[str, str] = {}
    for target, candidates in RAW_COLUMN_CANDIDATES.items():
        found = [c for c in candidates if c in frame.columns]
        if not found:
            raise ColumnMappingError(
                f"{path.name}: '{target}' 컬럼을 찾지 못했습니다.\n"
                f"  실제 컬럼: {list(frame.columns)}\n"
                f"  후보: {candidates}\n"
                "  → 실제 컬럼명을 확인한 뒤 RAW_COLUMN_CANDIDATES에 추가하세요(추측 매핑 금지)."
            )
        mapping[found[0]] = target
    out = frame[list(mapping)].rename(columns=mapping)
    out = out[out["keyword"].notna() & (out["keyword"].astype(str).str.strip() != "")]
    out["source_file"] = path.name
    return out


def load_raw(raw_dir: Path) -> pd.DataFrame:
    files = sorted(p for p in raw_dir.glob("*") if p.suffix.lower() in {".csv", ".xlsx", ".xls"})
    if not files:
        raise FileNotFoundError(f"원자료 파일이 없습니다: {raw_dir}")
    raw = pd.concat([read_raw_file(f) for f in files], ignore_index=True)
    raw["norm"] = raw["keyword"].map(normalize_keyword)
    raw = raw.drop_duplicates("norm", keep="first")
    return raw


def build_table(mapping: pd.DataFrame, raw: pd.DataFrame) -> pd.DataFrame:
    merged = mapping.merge(raw[["norm", "pc", "mobile", "source_file"]], on="norm", how="left")
    merged["found"] = merged["source_file"].notna()
    pc = merged["pc"].map(parse_volume)
    mo = merged["mobile"].map(parse_volume)
    merged["pc_value"] = [v.value for v in pc]
    merged["mobile_value"] = [v.value for v in mo]
    merged["pc_below"] = [v.below_threshold for v in pc]
    merged["mobile_below"] = [v.below_threshold for v in mo]
    merged["below_threshold"] = merged["pc_below"] | merged["mobile_below"]
    merged["total_value"] = merged["pc_value"].fillna(0) + merged["mobile_value"].fillna(0)
    return merged


def _fmt_int(v: float | int) -> str:
    return f"{int(v):,}"


def _pct(n: float, d: float) -> str:
    return "—" if d == 0 else f"{n / d * 100:.1f}%"


def summarize(table: pd.DataFrame) -> pd.DataFrame:
    found = table[table["found"]]
    g = found.groupby(["group", "occupation"], sort=False).agg(
        pc=("pc_value", "sum"),
        mobile=("mobile_value", "sum"),
        keywords=("keyword", "count"),
        below=("below_threshold", "sum"),
    )
    g["total"] = g["pc"] + g["mobile"]
    order = table[["group", "occupation"]].drop_duplicates()
    g = order.merge(g.reset_index(), on=["group", "occupation"], how="left").fillna(
        {"pc": 0, "mobile": 0, "keywords": 0, "below": 0, "total": 0}
    )
    return g


def render_chart(summary: pd.DataFrame, path: Path) -> None:
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    from matplotlib import font_manager

    for name in ("NanumGothic", "Noto Sans CJK KR", "Noto Sans KR", "Malgun Gothic", "AppleGothic",
                 "WenQuanYi Zen Hei"):
        if any(f.name == name for f in font_manager.fontManager.ttflist):
            plt.rcParams["font.family"] = name
            break
    else:
        print("경고: 한글 글꼴을 찾지 못해 그래프의 한글이 깨질 수 있습니다.", file=sys.stderr)
    plt.rcParams["axes.unicode_minus"] = False

    s = summary.sort_values("total")
    colors = ["#3b6ea5" if g == "A_전문직" else "#d07a2d" for g in s["group"]]
    fig, ax = plt.subplots(figsize=(8, max(4, len(s) * 0.38)))
    ax.barh(s["occupation"], s["total"], color=colors)
    ax.set_xlabel("월간 검색수 합계(PC+모바일, 임계값 미만 제외)")
    ax.set_title("직업별 진로 검색량")
    ax.spines[["top", "right"]].set_visible(False)
    from matplotlib.patches import Patch

    ax.legend(handles=[Patch(color="#3b6ea5", label=GROUP_LABEL["A_전문직"]),
                       Patch(color="#d07a2d", label=GROUP_LABEL["B_기술직"])],
              loc="lower right", frameon=False)
    fig.tight_layout()
    fig.savefig(path, dpi=150)
    plt.close(fig)


def load_survey(path: Path) -> pd.DataFrame | None:
    if not path.exists():
        return None
    df = pd.read_csv(path, dtype=str, keep_default_na=False)
    if "occupation" not in df.columns:
        raise ColumnMappingError(f"{path}: 'occupation' 컬럼이 필요합니다. 실제 컬럼: {list(df.columns)}")
    return df


def render_report(table: pd.DataFrame, summary: pd.DataFrame, survey: pd.DataFrame | None,
                  as_of: str, raw_dir: Path, chart_name: str) -> str:
    lines: list[str] = []
    found = table[table["found"]]
    lines += [
        "# 진로 검색량 분석",
        "",
        f"- 기준일: {as_of}",
        f"- 원자료: `{raw_dir.relative_to(ROOT) if raw_dir.is_relative_to(ROOT) else raw_dir}`"
        f" ({', '.join(sorted(found['source_file'].dropna().unique())) or '없음'})",
        f"- 매핑 키워드 {len(table)}개 중 원자료에서 찾은 키워드 {int(table['found'].sum())}개",
    ]
    if "samples" in raw_dir.parts:
        lines += ["", "> ⚠️ 합성 샘플 원자료로 만든 보고서입니다. 실제 검색량이 아닙니다.", ""]
    lines += [
        "- 합계는 PC+모바일 월간 검색수이며, `<10` 등 임계값 미만 값은 합계에 넣지 않고 별도로 표기합니다.",
        "",
        "## 직업별 진로 검색량",
        "",
        "| 그룹 | 직업 | 합계 | PC | 모바일 | 모바일 비중 | 키워드 수 | 임계값 미만 |",
        "| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |",
    ]
    for _, r in summary.sort_values("total", ascending=False).iterrows():
        lines.append(
            f"| {GROUP_LABEL.get(r['group'], r['group'])} | {r['occupation']} | {_fmt_int(r['total'])} | "
            f"{_fmt_int(r['pc'])} | {_fmt_int(r['mobile'])} | {_pct(r['mobile'], r['total'])} | "
            f"{int(r['keywords'])} | {int(r['below'])} |"
        )
    lines += ["", f"![직업별 진로 검색량]({chart_name})", "", "## 그룹 A·B 비교", "",
              "| 그룹 | 합계 | 모바일 비중 | 직업당 평균 | 임계값 미만 키워드 |",
              "| --- | ---: | ---: | ---: | ---: |"]
    for grp, s in summary.groupby("group", sort=False):
        lines.append(
            f"| {GROUP_LABEL.get(grp, grp)} | {_fmt_int(s['total'].sum())} | "
            f"{_pct(s['mobile'].sum(), s['total'].sum())} | {_fmt_int(s['total'].mean())} | {int(s['below'].sum())} |"
        )
    lines += ["", "## 의도별 구성", "", "| 그룹 | 의도 | 합계 | 그룹 내 비중 |", "| --- | --- | ---: | ---: |"]
    for grp, s in found.groupby("group", sort=False):
        total = s["total_value"].sum()
        for intent, t in s.groupby("intent", sort=False):
            v = t["total_value"].sum()
            lines.append(f"| {GROUP_LABEL.get(grp, grp)} | {INTENT_LABEL.get(intent, intent)} | "
                         f"{_fmt_int(v)} | {_pct(v, total)} |")

    below = table[table["below_threshold"]]
    if not below.empty:
        lines += ["", "## 임계값 미만 키워드(합계 미포함)", ""]
        lines += [f"- {r['occupation']}: {r['keyword']}" for _, r in below.iterrows()]
    missing = table[~table["found"]]
    if not missing.empty:
        lines += ["", "## 원자료에서 찾지 못한 키워드", ""]
        lines += [f"- {r['occupation']}: {r['keyword']}" for _, r in missing.iterrows()]

    if survey is not None:
        cols = [c for c in survey.columns if c != "occupation"]
        lines += ["", "## 희망 비율 대비 검색량", "",
                  "출처: 교육부·한국직업능력연구원 「2025년 초·중등 진로교육 현황조사」(직접 입력, 빈칸은 보고서에 없음)", "",
                  "| 직업 | 검색량 합계 | " + " | ".join(f"희망 비율 {c}" for c in cols) + " |",
                  "| --- | ---: | " + " | ".join("---:" for _ in cols) + " |"]
        merged = summary.merge(survey, on="occupation", how="left")
        for _, r in merged.iterrows():
            vals = [str(r[c]) if isinstance(r[c], str) and r[c] != "" else "—" for c in cols]
            lines.append(f"| {r['occupation']} | {_fmt_int(r['total'])} | " + " | ".join(vals) + " |")
    lines.append("")
    return "\n".join(lines)


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="진로 검색량 분석")
    ap.add_argument("--keywords-dir", type=Path, default=ROOT / "keywords")
    ap.add_argument("--raw-dir", type=Path, default=ROOT / "data" / "raw" / "naver_keyword_tool")
    ap.add_argument("--survey", type=Path, default=ROOT / "data" / "raw" / "career_survey_2025.csv")
    ap.add_argument("--out", type=Path, default=ROOT / "reports")
    ap.add_argument("--as-of", default=date.today().isoformat(), help="원자료 기준일(YYYY-MM-DD)")
    args = ap.parse_args(argv)

    try:
        mapping = load_mapping(args.keywords_dir)
        raw = load_raw(args.raw_dir)
        table = build_table(mapping, raw)
        survey = load_survey(args.survey)
    except (ColumnMappingError, FileNotFoundError, ValueError) as e:
        print(f"중단: {e}", file=sys.stderr)
        return 2

    summary = summarize(table)
    args.out.mkdir(parents=True, exist_ok=True)
    chart = "keyword_volume_by_occupation.png"
    render_chart(summary, args.out / chart)
    (args.out / "keyword_volume.md").write_text(
        render_report(table, summary, survey, args.as_of, args.raw_dir.resolve(), chart), encoding="utf-8"
    )

    load = table[table["found"]].copy()
    load_df = pd.DataFrame({
        "keyword": load["keyword"],
        "occupation": load["occupation"],
        "intent": load["intent"],
        "pc": load["pc_value"].astype("Int64"),
        "mobile": load["mobile_value"].astype("Int64"),
        "below_threshold": load["below_threshold"],
        "as_of": args.as_of,
    })
    load_df.to_csv(args.out / "keyword_volume_load.csv", index=False, encoding="utf-8")
    print(f"완료: {args.out}/keyword_volume.md, {chart}, keyword_volume_load.csv")
    return 0


if __name__ == "__main__":
    sys.exit(main())

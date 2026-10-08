"""analyze_keywords.py 단위 테스트 (python3 -m unittest discover -s scripts/tests)"""
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import analyze_keywords as ak  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]


class ParseTest(unittest.TestCase):
    def test_threshold_is_not_converted(self):
        v = ak.parse_volume("< 10")
        self.assertIsNone(v.value)
        self.assertTrue(v.below_threshold)
        self.assertTrue(ak.parse_volume("<10").below_threshold)

    def test_numbers(self):
        self.assertEqual(ak.parse_volume("1,234").value, 1234)
        self.assertEqual(ak.parse_volume(56).value, 56)
        self.assertIsNone(ak.parse_volume(float("nan")).value)

    def test_unknown_value_raises(self):
        with self.assertRaises(ValueError):
            ak.parse_volume("많음")

    def test_normalize_removes_spaces(self):
        self.assertEqual(ak.normalize_keyword("변호사 되는 법"), ak.normalize_keyword("변호사되는법"))
        self.assertEqual(ak.normalize_keyword("CPA 시험"), "cpa시험")


class EndToEndTest(unittest.TestCase):
    def test_sample_runs_to_completion(self):
        with tempfile.TemporaryDirectory() as out:
            code = ak.main(["--raw-dir", str(ROOT / "data/raw/samples/naver_keyword_tool"),
                            "--survey", str(ROOT / "data/templates/career_survey_2025.csv"),
                            "--out", out, "--as-of", "2026-10-08"])
            self.assertEqual(code, 0)
            report = (Path(out) / "keyword_volume.md").read_text(encoding="utf-8")
            self.assertIn("## 그룹 A·B 비교", report)
            self.assertIn("## 임계값 미만 키워드(합계 미포함)", report)
            self.assertIn("## 희망 비율 대비 검색량", report)
            self.assertTrue((Path(out) / "keyword_volume_by_occupation.png").exists())
            load = (Path(out) / "keyword_volume_load.csv").read_text(encoding="utf-8")
            self.assertIn("below_threshold", load.splitlines()[0])

    def test_unknown_columns_stop_instead_of_guessing(self):
        with tempfile.TemporaryDirectory() as d:
            (Path(d) / "x.csv").write_text("키워드명,PC,모바일\n변호사 되는 법,1,2\n", encoding="utf-8")
            with self.assertRaises(ak.ColumnMappingError):
                ak.load_raw(Path(d))


if __name__ == "__main__":
    unittest.main()

"""Test basic workspace imports and modules."""

def test_sailing_records_import():
    import sailing_records
    assert sailing_records.__version__ == "1.0.0"


def test_layline_scoring_import():
    import layline_scoring
    assert layline_scoring.__version__ == "1.0.0"


def test_ingestion_modules_import():
    from sailing_records.ingestion import sailing_urls
    assert hasattr(sailing_urls, "setup_db")
    assert hasattr(sailing_urls, "get_last_id")


def test_analysis_modules_import():
    from sailing_records.analysis import export_almanac, detect_families
    assert hasattr(export_almanac, "export_all") or hasattr(export_almanac, "main")
    assert hasattr(detect_families, "main") or callable(getattr(detect_families, "detect_families", None))

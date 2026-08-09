import importlib.util
import pathlib


def test_backend_main_importable():
    path = pathlib.Path(__file__).resolve().parents[1] / 'backend' / 'app' / 'main.py'
    spec = importlib.util.spec_from_file_location('app.main', str(path))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    assert hasattr(mod, 'app')

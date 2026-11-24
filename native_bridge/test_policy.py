"""No actual backend startup or filesystem access."""
import ast
import pathlib
import unittest

source = ast.parse(pathlib.Path(__file__).with_name("host.py").read_text(encoding="utf-8"))
function = next(n for n in source.body if isinstance(n, ast.FunctionDef) and n.name == "allowed")
namespace = {}
exec(compile(ast.Module(body=[function], type_ignores=[]), "host-policy", "exec"), namespace)
allowed = namespace["allowed"]


class PolicyTests(unittest.TestCase):
    def test_read_and_workflow(self):
        for method, path in [
            ("GET", "/api/bootstrap"), ("GET", "/api/assets"),
            ("GET", "/api/assets/output_123/chain"),
            ("GET", "/library/generated/output_123.png"),
            ("GET", "/library-thumbnails/example.jpg"),
            ("POST", "/api/generate"), ("PATCH", "/api/assets/output_123"),
            ("POST", "/api/jobs/123/cancel"),
        ]:
            self.assertTrue(allowed(method, path), (method, path))

    def test_restricted(self):
        for method, path in [
            ("POST", "/api/config"), ("DELETE", "/api/assets/output_123"),
            ("POST", "/api/assets/empty-trash"), ("GET", "/"),
            ("GET", "/library/generated/settings.json"), ("GET", "/docs"),
            ("POST", "/api/vault-categories"),
        ]:
            self.assertFalse(allowed(method, path), (method, path))


if __name__ == "__main__":
    unittest.main()

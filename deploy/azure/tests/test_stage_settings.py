import base64
import importlib.util
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location("stage_settings", Path(__file__).resolve().parents[1] / "make_stage_settings.py")
stage = importlib.util.module_from_spec(spec)
spec.loader.exec_module(stage)


class StageSettingsTests(unittest.TestCase):
    def values(self):
        return {
            "EDUNEXA_MSSQL_HOST": "pragathiedu.database.windows.net",
            "EDUNEXA_MSSQL_NAME": "edu_stage", "EDUNEXA_MSSQL_USER": "edunexa_stage",
            "EDUNEXA_MSSQL_PASSWORD": "test-only-sql-password",
            "EDUNEXA_JWT_SECRET": "x" * 64,
            "EDUNEXA_CERTIFICATE_SIGNING_KEY": base64.b64encode(bytes(32)).decode(),
            "EDUNEXA_AZURE_STORAGE_ACCOUNT": "stagetestaccount",
            "EDUNEXA_AZURE_STORAGE_CONTAINER": "edu-stage",
            "EDUNEXA_AZURE_STORAGE_KEY": "test-only-storage-key",
        }

    def test_isolated_settings_and_side_effects_disabled(self):
        result = stage.build(self.values(), "https://edunexa-stage-api.azurewebsites.net")
        self.assertEqual(result["EDUNEXA_MSSQL_NAME"], "edu_stage")
        self.assertEqual(result["EDUNEXA_SEMESTER_REMINDERS_ENABLED"], "false")
        self.assertEqual(result["EDUNEXA_STAFF_PASSWORD_LOGIN"], "false")
        self.assertEqual(result["EDUNEXA_PAYMENT_ADAPTER_URL"], "")
        self.assertEqual(result["EDUNEXA_FCM_SERVICE_ACCOUNT_JSON"], "")

    def test_configured_email_is_restricted_to_designated_tester(self):
        values = self.values()
        values.update(EDUNEXA_EMAIL_CONNECTION_STRING="test-email-service", EDUNEXA_EMAIL_SENDER="test@example.org")
        result = stage.build(values, "https://edunexa-stage-api.azurewebsites.net")
        self.assertEqual(result["EDUNEXA_EMAIL_ALLOWED_RECIPIENTS"], '["kattachaitanya507@gmail.com"]')
        self.assertEqual(result["EDUNEXA_EMAIL_CONNECTION_STRING"], "test-email-service")

    def test_copied_login_email_allowlist_is_explicit(self):
        values = self.values()
        values["EDUNEXA_EMAIL_ALLOWED_RECIPIENTS"] = '["first@example.org", "second@example.org"]'
        result = stage.build(values, "https://edunexa-stage-api.azurewebsites.net")
        self.assertEqual(result["EDUNEXA_EMAIL_ALLOWED_RECIPIENTS"], values["EDUNEXA_EMAIL_ALLOWED_RECIPIENTS"])
        values["EDUNEXA_EMAIL_ALLOWED_RECIPIENTS"] = '[]'
        with self.assertRaises(ValueError):
            stage.build(values, "https://edunexa-stage-api.azurewebsites.net")

    def test_rejects_production_or_wrong_database(self):
        for database in ("eduadmin", "stagedb", "master"):
            values = self.values(); values["EDUNEXA_MSSQL_NAME"] = database
            with self.assertRaises(ValueError):
                stage.build(values, "https://edunexa-stage-api.azurewebsites.net")

    def test_rejects_incomplete_email_credentials_in_input(self):
        values = self.values(); values["EDUNEXA_EMAIL_CONNECTION_STRING"] = "live-provider"
        with self.assertRaises(ValueError):
            stage.build(values, "https://edunexa-stage-api.azurewebsites.net")

    def test_rejects_wrong_origins_and_production_api(self):
        for api, admin in (("http://stage.example.org", stage.DOMAIN),
                           ("https://edunexa-api-pragathi.azurewebsites.net", stage.DOMAIN),
                           ("https://stage-api.example.org", "https://edu.pragathiews.org")):
            with self.assertRaises(ValueError):
                stage.build(self.values(), api, admin)

    def test_rejects_placeholder_and_bad_keys(self):
        for key, value in (("EDUNEXA_JWT_SECRET", "short"),
                           ("EDUNEXA_MSSQL_PASSWORD", "REPLACE_PASSWORD"),
                           ("EDUNEXA_CERTIFICATE_SIGNING_KEY", "invalid")):
            values = self.values(); values[key] = value
            with self.assertRaises(ValueError):
                stage.build(values, "https://stage-api.example.org")


if __name__ == "__main__":
    unittest.main()

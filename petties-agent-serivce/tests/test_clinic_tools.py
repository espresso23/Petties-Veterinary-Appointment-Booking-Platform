from pathlib import Path
import sys
import types
import unittest
from unittest.mock import AsyncMock, patch


ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

motor_module = types.ModuleType("motor")
motor_asyncio_module = types.ModuleType("motor.motor_asyncio")
motor_asyncio_module.AsyncIOMotorClient = object
motor_asyncio_module.AsyncIOMotorDatabase = object
sys.modules.setdefault("motor", motor_module)
sys.modules.setdefault("motor.motor_asyncio", motor_asyncio_module)

from app.core.tool_runtime_context import (  # noqa: E402
    ToolRuntimeContext,
    reset_tool_runtime_context,
    set_tool_runtime_context,
)
from app.core.tools.mcp_tools.clinic_tools import (  # noqa: E402
    create_clinic_service,
    execute_update_service_confirmed,
    generate_clinic_services,
    get_my_clinics,
    list_clinic_services,
    update_service_info,
)


class ClinicToolsTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.runtime_token = set_tool_runtime_context(
            ToolRuntimeContext(
                user_id="owner-1",
                role="CLINIC_OWNER",
                auth_token="jwt-token",
                clinic_id="clinic-1",
            )
        )

    def tearDown(self):
        reset_tool_runtime_context(self.runtime_token)

    async def test_tc_unit_005_001_generate_clinic_services_ai_generated_only(self):
        client = AsyncMock()
        client.get_my_clinic_services.return_value = []

        llm_response = type(
            "Resp",
            (),
            {
                "content": '{"suggestions":[{"name":"Khám tim mạch chuyên sâu","display_name":"Khám tim mạch chuyên sâu","description":"Sàng lọc bệnh tim cho thú cưng lớn tuổi","basePrice":350000,"durationTime":50,"slotsRequired":2,"isActive":true,"isHomeVisit":false,"serviceCategory":"CHECK_UP","petType":"DOG","recommended_action":"create"}]}'
            },
        )()
        llm_client = AsyncMock()
        llm_client.generate.return_value = llm_response

        with (
            patch(
                "app.core.tools.mcp_tools.clinic_tools.get_backend_client",
                return_value=client,
            ),
            patch(
                "app.core.tools.mcp_tools.clinic_tools.get_llm_client",
                return_value=llm_client,
            ),
        ):
            result = await generate_clinic_services(
                pet_types=["DOG"], service_scope=["CHECK_UP"]
            )

        self.assertTrue(result["success"])
        self.assertEqual(result["data"]["total_suggestions"], 1)
        self.assertEqual(result["data"]["recommendation_mode"], "ai_generated")
        suggestion = result["data"]["suggestions"][0]
        self.assertEqual(suggestion["name"], "Khám tim mạch chuyên sâu")
        self.assertEqual(suggestion["basePrice"], 350000)
        self.assertEqual(suggestion["slotsRequired"], 2)
        self.assertEqual(suggestion["serviceCategory"], "CHECK_UP")
        self.assertIsNone(suggestion.get("master_service_id"))

    async def test_tc_unit_005_001b_generate_clinic_services_deduplicates_existing_names(
        self,
    ):
        client = AsyncMock()
        client.get_my_clinic_services.return_value = [
            {
                "serviceId": "svc-1",
                "name": "Khám tổng quát",
                "description": "Khám định kỳ",
                "basePrice": 150000,
                "durationTime": 30,
                "slotsRequired": 1,
                "serviceCategory": "HEALTHCARE",
                "petType": "DOG",
                "isHomeVisit": False,
            }
        ]

        llm_response = type(
            "Resp",
            (),
            {
                "content": '{"suggestions":[{"name":"Khám tổng quát","display_name":"Khám tổng quát","description":"Bản trùng","basePrice":180000,"durationTime":35,"slotsRequired":2,"isActive":true,"isHomeVisit":false,"serviceCategory":"KHAM","petType":"DOG","recommended_action":"create"},{"name":"Khám tiêu hóa chuyên sâu","display_name":"Khám tiêu hóa chuyên sâu","description":"Đánh giá rối loạn tiêu hóa","basePrice":310000,"durationTime":45,"slotsRequired":2,"isActive":true,"isHomeVisit":false,"serviceCategory":"CHECK_UP","petType":"DOG","recommended_action":"create"}]}'
            },
        )()
        llm_client = AsyncMock()
        llm_client.generate.return_value = llm_response

        with (
            patch(
                "app.core.tools.mcp_tools.clinic_tools.get_backend_client",
                return_value=client,
            ),
            patch(
                "app.core.tools.mcp_tools.clinic_tools.get_llm_client",
                return_value=llm_client,
            ),
        ):
            result = await generate_clinic_services(
                pet_types=["DOG"]
            )

        self.assertTrue(result["success"])
        self.assertEqual(result["data"]["recommendation_mode"], "ai_generated")
        self.assertEqual(result["data"]["update_suggestions"], 0)
        self.assertEqual(result["data"]["create_suggestions"], 1)
        suggestion = result["data"]["suggestions"][0]
        self.assertEqual(suggestion["recommended_action"], "create")
        self.assertEqual(suggestion["name"], "Khám tiêu hóa chuyên sâu")

    async def test_tc_unit_005_001c_generate_clinic_services_prefers_missing_categories(
        self,
    ):
        client = AsyncMock()
        client.get_my_clinic_services.return_value = [
            {
                "serviceId": "svc-1",
                "name": "Khám tổng quát cơ bản",
                "basePrice": 120000,
                "durationTime": 20,
                "slotsRequired": 1,
                "serviceCategory": "HEALTHCARE",
                "petType": "DOG",
                "isHomeVisit": False,
            }
        ]

        llm_client = AsyncMock()
        llm_client.generate.side_effect = RuntimeError("LLM timeout")

        with (
            patch(
                "app.core.tools.mcp_tools.clinic_tools.get_backend_client",
                return_value=client,
            ),
            patch(
                "app.core.tools.mcp_tools.clinic_tools.get_llm_client",
                return_value=llm_client,
            ),
        ):
            result = await generate_clinic_services(pet_types=["DOG"])

        self.assertTrue(result["success"])
        self.assertGreaterEqual(result["data"]["total_suggestions"], 1)
        top_suggestion = result["data"]["suggestions"][0]
        self.assertEqual(top_suggestion["name"], "Khám da liễu chuyên sâu")
        self.assertEqual(result["data"]["recommendation_mode"], "ai_generated")
        self.assertEqual(result["data"].get("llm_generated", 0), 0)

    async def test_tc_unit_005_001d_generate_clinic_services_uses_llm_when_catalog_sparse(
        self,
    ):
        client = AsyncMock()
        client.get_my_clinic_services.return_value = []

        llm_response = type(
            "Resp",
            (),
            {
                "content": '{"suggestions":[{"name":"Khám da liễu","display_name":"Khám da liễu","description":"Kiểm tra bệnh da","basePrice":260000,"durationTime":45,"slotsRequired":2,"isActive":true,"isHomeVisit":false,"serviceCategory":"DERMATOLOGY","petType":"DOG","recommended_action":"create"}]}'
            },
        )()
        llm_client = AsyncMock()
        llm_client.generate.return_value = llm_response

        with (
            patch(
                "app.core.tools.mcp_tools.clinic_tools.get_backend_client",
                return_value=client,
            ),
            patch(
                "app.core.tools.mcp_tools.clinic_tools.get_llm_client",
                return_value=llm_client,
            ),
        ):
            result = await generate_clinic_services(pet_types=["DOG"])

        self.assertTrue(result["success"])
        self.assertGreaterEqual(result["data"]["total_suggestions"], 1)
        self.assertTrue(
            any(s.get("name") == "Khám da liễu" for s in result["data"]["suggestions"])
        )
        self.assertGreaterEqual(result["data"].get("llm_generated", 0), 1)

    async def test_tc_unit_005_001e_generate_clinic_services_requests_clinic_selection_when_missing_context(
        self,
    ):
        with (
            patch(
                "app.core.tools.mcp_tools.clinic_tools._resolve_runtime_clinic_id",
                return_value=None,
            ),
            patch(
                "app.core.tools.mcp_tools.clinic_tools.get_my_clinics",
                new=AsyncMock(
                    return_value={
                        "success": True,
                        "clinics": [
                            {"clinicId": "clinic-1", "name": "Petties Hà Nội"},
                            {"clinicId": "clinic-2", "name": "Petties Đà Nẵng"},
                        ],
                    }
                ),
            ),
        ):
            result = await generate_clinic_services(
                pet_types=["DOG"],
                service_scope=["CHECK_UP"],
            )

        self.assertTrue(result["success"])
        self.assertEqual(result["ui_card"], "clinic_list_card")
        self.assertEqual(result["data"]["recommendation_mode"], "awaiting_clinic_selection")
        self.assertTrue(result["data"]["needs_clarification"])
        self.assertEqual(len(result["data"]["clinics"]), 2)
        self.assertIn("phòng khám nào", result["message"])

    async def test_tc_unit_005_002_list_clinic_services_formats_summary(self):
        client = AsyncMock()
        client.get_my_clinic_services.return_value = [
            {
                "serviceId": "svc-1",
                "name": "Khám tổng quát",
                "basePrice": 150000,
                "durationTime": 30,
                "slotsRequired": 1,
                "isActive": True,
                "serviceCategory": "HEALTHCARE",
                "petType": "DOG",
            },
            {
                "serviceId": "svc-2",
                "name": "Spa",
                "basePrice": 250000,
                "isActive": False,
                "serviceCategory": "BEAUTY",
                "petType": "CAT",
            },
        ]

        with patch(
            "app.core.tools.mcp_tools.clinic_tools.get_backend_client",
            return_value=client,
        ):
            result = await list_clinic_services(sort_by="price", order="asc")

        self.assertTrue(result["success"])
        self.assertEqual(result["data"]["total"], 2)
        self.assertEqual(result["data"]["summary"]["active_services"], 1)
        self.assertEqual(result["data"]["services"][0]["service_id"], "svc-1")
        self.assertEqual(
            result["data"]["services"][1]["display_status"], "Không hoạt động"
        )

    async def test_tc_unit_005_003_update_service_info_returns_write_preview(self):
        result = await update_service_info(
            service_id="svc-1",
            service_name="Tiêm phòng",
            base_price=220000,
            is_active=True,
        )

        self.assertTrue(result["success"])
        self.assertTrue(result["data"]["requires_confirmation"])
        self.assertEqual(result["data"]["action_type"], "preview")
        self.assertTrue(result["metadata"]["is_write_preview"])
        self.assertEqual(result["data"]["changes"]["basePrice"]["new"], 220000)

    async def test_tc_unit_005_004_create_clinic_service_maps_payload_to_backend(self):
        client = AsyncMock()
        client.create_clinic_service.return_value = {"serviceId": "svc-10"}

        service_data = {
            "name": "Tiêm phòng dại",
            "description": "Tiêm phòng định kỳ",
            "basePrice": 180000,
            "slotsRequired": 1,
            "durationTime": 20,
            "isActive": True,
            "isHomeVisit": False,
            "serviceCategory": "VACCINATION",
            "petType": "DOG",
        }

        with patch(
            "app.core.tools.mcp_tools.clinic_tools.get_backend_client",
            return_value=client,
        ):
            result = await create_clinic_service(service_data, return_created=False)

        self.assertTrue(result["success"])
        self.assertTrue(result["data"]["created"])
        client.create_clinic_service.assert_awaited_once_with(
            "jwt-token",
            {
                "name": "Tiêm phòng dại",
                "description": "Tiêm phòng định kỳ",
                "basePrice": 180000,
                "slotsRequired": 1,
                "durationTime": 20,
                "isActive": True,
                "isHomeVisit": False,
                "serviceCategory": "VACCINATION",
                "petType": "DOG",
                "reminderInterval": None,
                "reminderUnit": None,
            },
        )

    async def test_tc_unit_005_006_update_service_info_rejects_empty_changes(self):
        result = await update_service_info(service_id="svc-1")

        self.assertFalse(result["success"])
        self.assertEqual(result["error_code"], "INVALID_INPUT")

    async def test_tc_unit_005_007_get_my_clinics_handles_page_response(self):
        client = AsyncMock()
        client.get_my_clinics.return_value = {
            "content": [
                {
                    "clinicId": "clinic-1",
                    "name": "Petties Clinic",
                    "address": "123 Nguyen Hue",
                    "phoneNumber": "0909123456",
                    "status": "ACTIVE",
                }
            ]
        }

        with patch(
            "app.core.tools.mcp_tools.clinic_tools.BackendClient",
            return_value=client,
        ):
            result = await get_my_clinics()

        self.assertTrue(result["success"])
        self.assertEqual(len(result["clinics"]), 1)
        self.assertEqual(result["clinics"][0]["clinicId"], "clinic-1")

    async def test_tc_unit_005_007b_get_my_clinics_resolves_active_runtime_clinic(self):
        client = AsyncMock()
        client.get_my_clinics.return_value = {
            "content": [
                {
                    "clinicId": "clinic-1",
                    "name": "Petties Clinic HN",
                    "status": "ACTIVE",
                },
                {
                    "clinicId": "clinic-2",
                    "name": "Petties Clinic DN",
                    "status": "ACTIVE",
                },
            ]
        }

        with patch(
            "app.core.tools.mcp_tools.clinic_tools.BackendClient",
            return_value=client,
        ):
            result = await get_my_clinics()

        self.assertTrue(result["success"])
        self.assertEqual(result.get("target_clinic_id"), "clinic-1")
        self.assertFalse(result.get("needs_clarification"))
        self.assertIsInstance(result.get("matched_clinic"), dict)
        self.assertEqual(result["matched_clinic"].get("clinicId"), "clinic-1")
        self.assertEqual(result.get("resolved_clinic", {}).get("clinicId"), "clinic-1")

    async def test_tc_unit_005_005_execute_update_service_confirmed_maps_backend_fields(
        self,
    ):
        client = AsyncMock()
        client.update_clinic_service.return_value = {"serviceId": "svc-1"}

        with patch(
            "app.core.tools.mcp_tools.clinic_tools.get_backend_client",
            return_value=client,
        ):
            result = await execute_update_service_confirmed(
                service_id="svc-1",
                base_price=230000,
                duration_minutes=45,
                slots_required=2,
                is_home_visit=True,
                service_category="HEALTHCARE",
                pet_type="CAT",
            )

        self.assertTrue(result["success"])
        client.update_clinic_service.assert_awaited_once_with(
            "jwt-token",
            "svc-1",
            {
                "basePrice": 230000,
                "durationTime": 45,
                "slotsRequired": 2,
                "isHomeVisit": True,
                "serviceCategory": "HEALTHCARE",
                "petType": "CAT",
            },
        )


if __name__ == "__main__":
    unittest.main()

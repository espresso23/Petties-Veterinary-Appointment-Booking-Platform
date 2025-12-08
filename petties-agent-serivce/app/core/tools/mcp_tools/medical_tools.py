"""
PETTIES AGENT SERVICE - Medical Tools (FastMCP)
Code-based tools cho Medical/Triage Agent - Viết bằng FastMCP

Package: app.core.tools.mcp_tools
Purpose:
    - Chẩn đoán sơ bộ dựa trên triệu chứng
    - Tra cứu lịch sử bệnh từ EMR (Electronic Medical Records)
    - RAG search từ knowledge base (Qdrant)

Tools:
    - search_symptoms: Tìm bệnh dựa trên triệu chứng
    - RAG_search: Tìm kiếm kiến thức y tế từ vector store
    - get_medical_history: Lấy lịch sử khám bệnh

Reference: Section 6 - Medical Agent features
Version: v0.0.1
"""

from app.core.tools.mcp_server import mcp_server
from typing import Dict, Any, List
import httpx
import logging

from app.config.settings import settings

logger = logging.getLogger(__name__)


# ===== MEDICAL TOOLS =====

@mcp_server.tool()
async def search_symptoms(symptoms: List[str], pet_type: str = "dog") -> Dict[str, Any]:
    """
    Tìm bệnh dựa trên triệu chứng (Symptom Checker)

    Args:
        symptoms: Danh sách triệu chứng (ví dụ: ["sốt", "nôn mửa", "mệt mỏi"])
        pet_type: Loại thú cưng (dog, cat, bird, rabbit)

    Returns:
        Dict chứa:
            - diseases: List[Dict] - Danh sách bệnh có thể
                - name: str - Tên bệnh
                - probability: float - Xác suất (0.0-1.0)
                - severity: str - Mức độ nghiêm trọng (mild, moderate, severe, critical)
                - recommendations: str - Khuyến nghị
            - urgent: bool - Cần khám gấp không

    Example:
        >>> await search_symptoms(["sốt cao", "nôn mửa", "tiêu chảy"], "dog")
        {
            "diseases": [
                {
                    "name": "Parvovirus",
                    "probability": 0.85,
                    "severity": "critical",
                    "recommendations": "Cần đến phòng khám NGAY LẬP TỨC"
                },
                {
                    "name": "Viêm dạ dày ruột",
                    "probability": 0.65,
                    "severity": "moderate",
                    "recommendations": "Nên đặt lịch khám trong 24h"
                }
            ],
            "urgent": True
        }

    Purpose:
        - Medical Agent dùng để chẩn đoán sơ bộ
        - Call AI model hoặc knowledge graph để match symptoms
    """
    try:
        # Call Spring Boot backend API (có thể có ML model)
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{settings.SPRING_BACKEND_URL}/medical/symptom-checker",
                json={
                    "symptoms": symptoms,
                    "petType": pet_type
                },
                timeout=settings.MCP_TIMEOUT
            )
            response.raise_for_status()
            data = response.json()

        logger.info(f"✅ Searched symptoms: {symptoms}")
        return data

    except httpx.HTTPError as e:
        logger.error(f"❌ Error searching symptoms: {e}")
        return {
            "diseases": [],
            "urgent": False,
            "error": str(e)
        }


@mcp_server.tool()
async def RAG_search(query: str, top_k: int = 5) -> Dict[str, Any]:
    """
    Tìm kiếm kiến thức y tế từ RAG (Retrieval-Augmented Generation)

    Args:
        query: Câu hỏi hoặc từ khóa tìm kiếm
        top_k: Số lượng documents trả về (default: 5)

    Returns:
        Dict chứa:
            - query: str - Query gốc
            - results: List[Dict] - Danh sách documents
                - content: str - Nội dung document
                - score: float - Similarity score
                - source: str - Nguồn (tên file PDF/Docx)
                - page: int - Số trang (nếu có)
            - answer: str - Câu trả lời được synthesize từ RAG

    Example:
        >>> await RAG_search("Cách điều trị Parvo ở chó con")
        {
            "query": "Cách điều trị Parvo ở chó con",
            "results": [
                {
                    "content": "Parvovirus được điều trị bằng...",
                    "score": 0.92,
                    "source": "vet_handbook_2024.pdf",
                    "page": 145
                }
            ],
            "answer": "Điều trị Parvo cần: 1) Nhập viện, 2) Truyền dịch..."
        }

    Purpose:
        - Medical Agent dùng để tra cứu kiến thức chuyên môn
        - Query Qdrant vector store → LLM synthesis
    """
    try:
        from qdrant_client import QdrantClient

        # Connect to Qdrant Cloud
        client = QdrantClient(
            url=settings.QDRANT_URL,
            api_key=settings.QDRANT_API_KEY
        )

        # TODO: Implement actual RAG search
        # 1. Generate query embedding (OpenAI or SentenceTransformer)
        # 2. Search Qdrant collection
        # 3. Retrieve top_k documents
        # 4. Synthesize answer using LLM

        logger.info(f"✅ RAG search: {query}")

        # Placeholder response
        return {
            "query": query,
            "results": [],
            "answer": "RAG search chưa được implement. Coming soon!"
        }

    except Exception as e:
        logger.error(f"❌ Error in RAG search: {e}")
        return {
            "query": query,
            "results": [],
            "error": str(e)
        }


@mcp_server.tool()
async def get_medical_history(pet_id: str, limit: int = 10) -> Dict[str, Any]:
    """
    Lấy lịch sử khám bệnh từ EMR (Electronic Medical Records)

    Args:
        pet_id: ID của thú cưng (format: PET_xxxxx)
        limit: Số lượng records tối đa (default: 10)

    Returns:
        Dict chứa:
            - pet_id: str
            - pet_name: str
            - records: List[Dict] - Lịch sử khám bệnh
                - date: str - Ngày khám
                - doctor_name: str - Bác sĩ
                - diagnosis: str - Chẩn đoán
                - treatment: str - Phương pháp điều trị
                - prescriptions: List[str] - Đơn thuốc

    Purpose:
        - Medical Agent tra cứu lịch sử để context cho chẩn đoán
    """
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{settings.SPRING_BACKEND_URL}/medical/history/{pet_id}",
                params={"limit": limit},
                timeout=settings.MCP_TIMEOUT
            )
            response.raise_for_status()
            data = response.json()

        logger.info(f"✅ Retrieved medical history for pet {pet_id}")
        return data

    except httpx.HTTPError as e:
        logger.error(f"❌ Error getting medical history: {e}")
        return {
            "pet_id": pet_id,
            "records": [],
            "error": str(e)
        }


@mcp_server.tool()
async def get_vaccine_schedule(pet_id: str) -> Dict[str, Any]:
    """
    Lấy lịch tiêm chủng (Vaccination Schedule)

    Args:
        pet_id: ID của thú cưng (format: PET_xxxxx)

    Returns:
        Dict chứa:
            - pet_id: str
            - pet_name: str
            - pet_age_months: int
            - completed_vaccines: List[Dict] - Vaccine đã tiêm
            - upcoming_vaccines: List[Dict] - Vaccine sắp tới
                - vaccine_name: str
                - due_date: str
                - status: str (overdue, upcoming, completed)

    Purpose:
        - Medical Agent check lịch tiêm chủng
        - Nhắc nhở user về vaccine sắp tới hoặc quá hạn

    Reference: UC-02 Example - get_vaccine_schedule tool
    """
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{settings.SPRING_BACKEND_URL}/medical/vaccine-schedule/{pet_id}",
                timeout=settings.MCP_TIMEOUT
            )
            response.raise_for_status()
            data = response.json()

        logger.info(f"✅ Retrieved vaccine schedule for pet {pet_id}")
        return data

    except httpx.HTTPError as e:
        logger.error(f"❌ Error getting vaccine schedule: {e}")
        return {
            "pet_id": pet_id,
            "completed_vaccines": [],
            "upcoming_vaccines": [],
            "error": str(e)
        }


# ===== TOOL METADATA =====
if __name__ == "__main__":
    print("🔧 Medical Tools registered in FastMCP:")
    print("  - search_symptoms")
    print("  - RAG_search")
    print("  - get_medical_history")
    print("  - get_vaccine_schedule")

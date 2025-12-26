"""
PETTIES AGENT SERVICE - Pet Care RAG Tools (FastMCP)

Code-based tools for Single Agent - RAG-based Q&A and symptom checking.
Uses Cohere embeddings + Qdrant vector search.

Package: app.core.tools.mcp_tools
Purpose:
    - RAG-based Q&A for pet care knowledge
    - Symptom search using knowledge base
    - Vietnamese language support via Cohere multilingual

Tools:
    - pet_care_qa: RAG-based Q&A for pet care questions
    - symptom_search: Search diseases based on symptoms using RAG

Reference: Technical Scope - Single Agent with ReAct pattern
Version: v1.0.0 (Migrated from Multi-Agent medical_tools)

Changes:
- Removed API-based tools (booking, history, vaccine) - not for RAG
- Implemented real RAG search using Qdrant + Cohere
- Added pet_care_qa tool
- Renamed to focus on RAG functionality
"""

from app.core.tools.mcp_server import mcp_server
from typing import Dict, Any, List, Optional
from loguru import logger


# ===== RAG TOOLS =====

@mcp_server.tool
async def pet_care_qa(
    query: str,
    top_k: int = 5,
    min_score: float = 0.5
) -> Dict[str, Any]:
    """
    Tìm kiếm kiến thức chăm sóc thú cưng từ Knowledge Base (RAG Q&A)

    Sử dụng tool này khi người dùng hỏi các câu hỏi về:
    - Cách chăm sóc thú cưng (cho ăn, tắm rửa, tập luyện)
    - Thông tin về giống loài
    - Điều trị bệnh thường gặp
    - Dinh dưỡng và thực phẩm

    Args:
        query: Câu hỏi hoặc từ khóa tìm kiếm (tiếng Việt hoặc English)
        top_k: Số lượng kết quả trả về (mặc định: 5)
        min_score: Điểm tương đồng tối thiểu (mặc định: 0.5)

    Returns:
        Dict chứa:
            - query: str - Câu hỏi gốc
            - results: List[Dict] - Danh sách tài liệu tìm được
            - answer: str - Câu trả lời tổng hợp
            - sources_used: int - Số tài liệu được sử dụng
    """
    try:
        from app.core.rag.rag_engine import get_rag_engine

        # Get RAG engine
        rag = get_rag_engine()

        # Query knowledge base
        results = await rag.query(
            query=query,
            top_k=top_k,
            min_score=min_score
        )

        # Format results
        formatted_results = [
            {
                "content": r.content,
                "score": r.score,
                "source": r.document_name,
                "chunk_index": r.chunk_index
            }
            for r in results
        ]

        # Tạo câu trả lời tổng hợp từ kết quả tìm được
        if formatted_results:
            # Kết hợp 3 đoạn văn bản đầu tiên
            context = "\n\n".join([r["content"] for r in formatted_results[:3]])
            answer = f"Dựa trên kiến thức trong knowledge base:\n\n{context[:1000]}..."
        else:
            answer = "Không tìm thấy thông tin phù hợp trong knowledge base. Vui lòng hỏi câu hỏi khác hoặc liên hệ bác sĩ thú y."

        logger.info(f"pet_care_qa: Found {len(results)} results for query: {query[:50]}...")

        return {
            "query": query,
            "results": formatted_results,
            "answer": answer,
            "sources_used": len(formatted_results)
        }

    except Exception as e:
        logger.error(f"Lỗi trong pet_care_qa: {e}")
        return {
            "query": query,
            "results": [],
            "answer": f"Lỗi khi tìm kiếm: {str(e)}. Vui lòng thử lại sau.",
            "sources_used": 0,
            "error": str(e)
        }


@mcp_server.tool
async def symptom_search(
    symptoms: List[str],
    pet_type: str = "dog",
    top_k: int = 5
) -> Dict[str, Any]:
    """
    Tìm bệnh dựa trên triệu chứng sử dụng RAG (Kiểm tra triệu chứng)

    Sử dụng tool này khi người dùng mô tả triệu chứng của thú cưng:
    - Thú cưng bị sốt, nôn, tiêu chảy
    - Thú cưng bỏ ăn, mệt mỏi
    - Các vấn đề về da, lông
    - Vấn đề hô hấp, mắt

    Args:
        symptoms: Danh sách triệu chứng (ví dụ: ["sốt", "nôn mửa", "mệt mỏi"])
        pet_type: Loại thú cưng (dog, cat, bird, rabbit, hamster)
        top_k: Số lượng kết quả (mặc định: 5)

    Returns:
        Dict chứa:
            - symptoms: List[str] - Triệu chứng đã nhập
            - pet_type: str - Loại thú cưng
            - possible_conditions: List[Dict] - Các bệnh có thể
            - urgent: bool - Cần khám gấp không
            - recommendations: str - Khuyến nghị

    LƯU Ý: Tool này chỉ cung cấp thông tin tham khảo.
    Luôn khuyên người dùng đến phòng khám thú y để được chẩn đoán chính xác.
    """
    try:
        from app.core.rag.rag_engine import get_rag_engine

        # Lấy RAG engine
        rag = get_rag_engine()

        # Xây dựng câu truy vấn từ triệu chứng
        symptoms_text = ", ".join(symptoms)
        query = f"{pet_type} triệu chứng {symptoms_text} bệnh chẩn đoán"

        # Truy vấn knowledge base
        results = await rag.query(
            query=query,
            top_k=top_k,
            min_score=0.4  # Ngưỡng thấp hơn cho tìm kiếm triệu chứng
        )

        # Phân tích kết quả tìm các bệnh có thể
        possible_conditions = []
        urgent = False

        # Từ khóa chỉ tình trạng khẩn cấp
        urgent_keywords = ["nguy hiểm", "cấp cứu", "ngay lập tức", "parvo", "distemper",
                          "ngộ độc", "xuất huyết", "suy hô hấp", "co giật", "bất tỉnh"]

        for r in results:
            content_lower = r.content.lower()

            # Kiểm tra mức độ nghiêm trọng dựa trên nội dung
            severity = "nhẹ"
            if any(kw in content_lower for kw in ["nặng", "nguy hiểm", "cấp cứu"]):
                severity = "nặng"
                urgent = True
            elif any(kw in content_lower for kw in ["vừa", "cần theo dõi"]):
                severity = "vừa"

            # Kiểm tra từ khóa khẩn cấp
            if any(kw in content_lower for kw in urgent_keywords):
                urgent = True
                severity = "nghiêm trọng"

            possible_conditions.append({
                "name": f"Phát hiện từ {r.document_name}",
                "description": r.content[:300] + "..." if len(r.content) > 300 else r.content,
                "severity": severity,
                "source": r.document_name,
                "score": r.score
            })

        # Tạo khuyến nghị
        if urgent:
            recommendations = "CẢNH BÁO: Các triệu chứng này có thể nghiêm trọng. Cần đến phòng khám thú y NGAY LẬP TỨC để được khám và điều trị kịp thời."
        elif possible_conditions:
            recommendations = "Nên đặt lịch khám trong 24-48 giờ để bác sĩ thú y chẩn đoán chính xác. Theo dõi thêm các triệu chứng khác."
        else:
            recommendations = "Không tìm thấy thông tin phù hợp. Nếu triệu chứng nghiêm trọng, nên đến phòng khám thú y để được tư vấn."

        logger.info(f"symptom_search: Tìm thấy {len(possible_conditions)} bệnh có thể cho triệu chứng: {symptoms}")

        return {
            "symptoms": symptoms,
            "pet_type": pet_type,
            "possible_conditions": possible_conditions,
            "urgent": urgent,
            "recommendations": recommendations,
            "disclaimer": "Thông tin này chỉ mang tính chất tham khảo. Vui lòng đến phòng khám thú y để được chẩn đoán và điều trị chính xác."
        }

    except Exception as e:
        logger.error(f"Lỗi trong symptom_search: {e}")
        return {
            "symptoms": symptoms,
            "pet_type": pet_type,
            "possible_conditions": [],
            "urgent": False,
            "recommendations": f"Lỗi khi tìm kiếm: {str(e)}. Nên đến phòng khám thú y để được tư vấn.",
            "error": str(e)
        }


# ===== TOOL METADATA =====
if __name__ == "__main__":
    print("Pet Care RAG Tools registered in FastMCP:")
    print("  - pet_care_qa: RAG-based Q&A for pet care knowledge")
    print("  - symptom_search: Search diseases based on symptoms")
    print("\nThese tools use:")
    print("  - Cohere embed-multilingual-v3.0 for Vietnamese support")
    print("  - Qdrant vector database for similarity search")
    print("  - LlamaIndex for document processing")

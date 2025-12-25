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

@mcp_server.tool()
async def pet_care_qa(
    query: str,
    top_k: int = 5,
    min_score: float = 0.5
) -> Dict[str, Any]:
    """
    Tim kiem kien thuc cham soc thu cung tu knowledge base (RAG Q&A)

    Su dung tool nay khi user hoi cac cau hoi ve:
    - Cach cham soc thu cung (cho an, tam rua, tap luyen)
    - Thong tin ve giong loai
    - Dieu tri benh thuong gap
    - Dinh duong va thuc pham

    Args:
        query: Cau hoi hoac tu khoa tim kiem (tieng Viet hoac English)
        top_k: So luong ket qua tra ve (default: 5)
        min_score: Diem tuong dong toi thieu (default: 0.5)

    Returns:
        Dict chua:
            - query: str - Query goc
            - results: List[Dict] - Danh sach documents
                - content: str - Noi dung document
                - score: float - Similarity score
                - source: str - Nguon (ten file)
                - chunk_index: int - So thu tu chunk
            - answer: str - Tong hop tu cac documents tim duoc
            - sources_used: int - So documents duoc su dung

    Example:
        >>> await pet_care_qa("Cach tam cho cho con 2 thang tuoi")
        {
            "query": "Cach tam cho cho con 2 thang tuoi",
            "results": [
                {
                    "content": "Cho con 2 thang tuoi chua nen tam nuoc...",
                    "score": 0.89,
                    "source": "huong_dan_cham_soc_cho.pdf",
                    "chunk_index": 12
                }
            ],
            "answer": "Cho con 2 thang tuoi chua nen tam nuoc vi...",
            "sources_used": 3
        }

    Purpose:
        - Single Agent dung de tra loi cau hoi ve cham soc thu cung
        - Tim kiem trong knowledge base da duoc upload
        - Su dung Cohere multilingual embeddings cho tieng Viet
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

        # Generate synthesized answer from top results
        if formatted_results:
            # Combine top 3 chunks for answer
            context = "\n\n".join([r["content"] for r in formatted_results[:3]])
            answer = f"Dua tren kien thuc trong knowledge base:\n\n{context[:1000]}..."
        else:
            answer = "Khong tim thay thong tin phu hop trong knowledge base. Vui long hoi cau hoi khac hoac lien he bac si thu y."

        logger.info(f"pet_care_qa: Found {len(results)} results for query: {query[:50]}...")

        return {
            "query": query,
            "results": formatted_results,
            "answer": answer,
            "sources_used": len(formatted_results)
        }

    except Exception as e:
        logger.error(f"Error in pet_care_qa: {e}")
        return {
            "query": query,
            "results": [],
            "answer": f"Loi khi tim kiem: {str(e)}. Vui long thu lai sau.",
            "sources_used": 0,
            "error": str(e)
        }


@mcp_server.tool()
async def symptom_search(
    symptoms: List[str],
    pet_type: str = "dog",
    top_k: int = 5
) -> Dict[str, Any]:
    """
    Tim benh dua tren trieu chung su dung RAG (Symptom Checker)

    Su dung tool nay khi user mo ta trieu chung cua thu cung:
    - Thu cung bi sot, non, tieu chay
    - Thu cung bo an, met moi
    - Cac van de ve da, long
    - Van de ho hap, mat

    Args:
        symptoms: Danh sach trieu chung (vi du: ["sot", "non mua", "met moi"])
        pet_type: Loai thu cung (dog, cat, bird, rabbit, hamster)
        top_k: So luong ket qua (default: 5)

    Returns:
        Dict chua:
            - symptoms: List[str] - Trieu chung da nhap
            - pet_type: str - Loai thu cung
            - possible_conditions: List[Dict] - Cac benh co the
                - name: str - Ten benh
                - description: str - Mo ta
                - severity: str - Muc do (mild, moderate, severe, critical)
                - source: str - Nguon thong tin
                - score: float - Do phu hop
            - urgent: bool - Can kham gap khong
            - recommendations: str - Khuyen nghi

    Example:
        >>> await symptom_search(["sot cao", "non mua", "tieu chay"], "dog")
        {
            "symptoms": ["sot cao", "non mua", "tieu chay"],
            "pet_type": "dog",
            "possible_conditions": [
                {
                    "name": "Parvo virus",
                    "description": "Benh truyen nhiem nguy hiem...",
                    "severity": "critical",
                    "source": "vet_handbook.pdf",
                    "score": 0.92
                }
            ],
            "urgent": True,
            "recommendations": "Can den phong kham NGAY LAP TUC"
        }

    Purpose:
        - Single Agent dung de chan doan so bo
        - Tim kiem benh trong knowledge base dua tren trieu chung
        - KHONG thay the chan doan cua bac si thu y

    WARNING:
        Tool nay chi cung cap thong tin tham khao.
        Luon khuyen nguoi dung den phong kham thu y de duoc chan doan chinh xac.
    """
    try:
        from app.core.rag.rag_engine import get_rag_engine

        # Get RAG engine
        rag = get_rag_engine()

        # Build search query from symptoms
        symptoms_text = ", ".join(symptoms)
        query = f"{pet_type} trieu chung {symptoms_text} benh chan doan"

        # Query knowledge base
        results = await rag.query(
            query=query,
            top_k=top_k,
            min_score=0.4  # Lower threshold for symptom search
        )

        # Analyze results for possible conditions
        possible_conditions = []
        urgent = False

        # Keywords indicating urgency
        urgent_keywords = ["nguy hiem", "cap cuu", "ngay lap tuc", "parvo", "distemper",
                          "ngo doc", "xuat huyet", "suy ho hap", "co giat", "bat tinh"]

        for r in results:
            content_lower = r.content.lower()

            # Check severity based on content
            severity = "mild"
            if any(kw in content_lower for kw in ["nang", "nguy hiem", "cap cuu"]):
                severity = "severe"
                urgent = True
            elif any(kw in content_lower for kw in ["vua", "can theo doi"]):
                severity = "moderate"

            # Check for urgent keywords
            if any(kw in content_lower for kw in urgent_keywords):
                urgent = True
                severity = "critical"

            possible_conditions.append({
                "name": f"Phat hien tu {r.document_name}",
                "description": r.content[:300] + "..." if len(r.content) > 300 else r.content,
                "severity": severity,
                "source": r.document_name,
                "score": r.score
            })

        # Generate recommendations
        if urgent:
            recommendations = "CANH BAO: Cac trieu chung nay co the nghiem trong. Can den phong kham thu y NGAY LAP TUC de duoc kham va dieu tri kip thoi."
        elif possible_conditions:
            recommendations = "Nen dat lich kham trong 24-48 gio de bac si thu y chan doan chinh xac. Theo doi them cac trieu chung khac."
        else:
            recommendations = "Khong tim thay thong tin phu hop. Neu trieu chung nghiem trong, nen den phong kham thu y de duoc tu van."

        logger.info(f"symptom_search: Found {len(possible_conditions)} conditions for symptoms: {symptoms}")

        return {
            "symptoms": symptoms,
            "pet_type": pet_type,
            "possible_conditions": possible_conditions,
            "urgent": urgent,
            "recommendations": recommendations,
            "disclaimer": "Thong tin nay chi mang tinh chat tham khao. Vui long den phong kham thu y de duoc chan doan va dieu tri chinh xac."
        }

    except Exception as e:
        logger.error(f"Error in symptom_search: {e}")
        return {
            "symptoms": symptoms,
            "pet_type": pet_type,
            "possible_conditions": [],
            "urgent": False,
            "recommendations": f"Loi khi tim kiem: {str(e)}. Nen den phong kham thu y de duoc tu van.",
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

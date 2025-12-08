"""
PETTIES AGENT SERVICE - Research Tools (FastMCP)
Code-based tools cho Research Agent - Viết bằng FastMCP

Package: app.core.tools.mcp_tools
Purpose:
    - Tìm kiếm thông tin trên web (general-purpose)
    - Web Search (DuckDuckGo/Tavily) - bao gồm sản phẩm, bài viết, thông tin chung
    - Extract content từ web pages
    - Video search trên YouTube

Tools:
    - web_search: Tìm kiếm web (DuckDuckGo/Tavily)
    - extract_web_content: Extract thông tin từ URL (không chỉ product)
    - search_youtube_videos: Tìm video hướng dẫn

Reference: Technical Scope - Research Agent (Web & Content)
Version: v0.1.0
"""

from app.core.tools.mcp_server import mcp_server
from typing import Dict, Any, List
import httpx
import logging
from duckduckgo_search import DDGS

from app.config.settings import settings

logger = logging.getLogger(__name__)


# ===== RESEARCH TOOLS =====

@mcp_server.tool()
async def web_search(query: str, max_results: int = 5) -> Dict[str, Any]:
    """
    Tìm kiếm thông tin trên web (DuckDuckGo/Tavily) - general-purpose

    Args:
        query: Từ khóa tìm kiếm (có thể là sản phẩm, bài viết, thông tin chung)
        max_results: Số lượng kết quả (default: 5)

    Returns:
        Dict chứa:
            - query: str
            - results: List[Dict] - Kết quả tìm kiếm
                - title: str - Tiêu đề
                - url: str - Link
                - snippet: str - Đoạn trích
                - source: str - Nguồn (tên website)

    Example:
        >>> await web_search("cách chăm sóc chó con")
        {
            "query": "cách chăm sóc chó con",
            "results": [
                {
                    "title": "Hướng dẫn chăm sóc chó con - PetMart",
                    "url": "https://petmart.vn/...",
                    "snippet": "Chăm sóc chó con cần chú ý...",
                    "source": "petmart.vn"
                }
            ]
        }

    Purpose:
        - Research Agent tìm bất cứ thứ gì trên web được Main Agent giao phó
        - Bao gồm: sản phẩm, bài viết y khoa, mẹo vặt, thông tin chung
        - Ưu tiên nguồn uy tín
    """
    try:
        # Use DuckDuckGo Search API
        with DDGS() as ddgs:
            search_results = list(ddgs.text(
                query,
                max_results=max_results
            ))

        results = [
            {
                "title": result.get("title", ""),
                "url": result.get("href", ""),
                "snippet": result.get("body", ""),
                "source": result.get("href", "").split("/")[2] if result.get("href") else ""
            }
            for result in search_results
        ]

        logger.info(f"✅ Web search: {query} - Found {len(results)} results")
        return {
            "query": query,
            "results": results
        }

    except Exception as e:
        logger.error(f"❌ Error in web search: {e}")
        return {
            "query": query,
            "results": [],
            "error": str(e)
        }


@mcp_server.tool()
async def extract_web_content(url: str) -> Dict[str, Any]:
    """
    Trích xuất thông tin từ URL (Web Scraping) - general-purpose

    Args:
        url: Link web cần extract (có thể là sản phẩm, bài viết, trang thông tin)

    Returns:
        Dict chứa:
            - url: str
            - title: str - Tiêu đề trang
            - content: str - Nội dung chính
            - description: str - Mô tả
            - images: List[str] - Danh sách link ảnh (nếu có)
            - metadata: Dict - Thông tin bổ sung

    Purpose:
        - Extract nội dung từ bất kỳ trang web nào
        - Dùng BeautifulSoup hoặc LlamaIndex web scraper
        - Hỗ trợ cả sản phẩm và bài viết/content

    Reference: Section 6 - Data Extraction feature
    """
    try:
        # TODO: Implement web scraping
        # Use BeautifulSoup or LlamaIndex SimpleWebPageReader

        logger.info(f"✅ Extracting web content from: {url}")

        # Placeholder
        return {
            "url": url,
            "title": "",
            "content": "",
            "description": "",
            "images": [],
            "metadata": {},
            "error": "Web content extraction chưa được implement"
        }

    except Exception as e:
        logger.error(f"❌ Error extracting web content: {e}")
        return {
            "url": url,
            "error": str(e)
        }


@mcp_server.tool()
async def search_youtube_videos(query: str, max_results: int = 5) -> Dict[str, Any]:
    """
    Tìm video hướng dẫn trên YouTube

    Args:
        query: Từ khóa tìm kiếm (ví dụ: "cách cho chó uống thuốc", "mẹo chăm sóc mèo")
        max_results: Số video tối đa (default: 5)

    Returns:
        Dict chứa:
            - query: str
            - videos: List[Dict] - Danh sách video
                - title: str
                - url: str - Link YouTube
                - thumbnail: str - Link thumbnail
                - channel: str - Tên kênh
                - views: int - Lượt xem

    Purpose:
        - Research Agent tìm video hướng dẫn, review, tutorials
        - Hỗ trợ Medical Agent tìm video y tế
        - Tự động nhúng link video vào câu trả lời

    Reference: Section 6 - Video Integration feature
    """
    try:
        # Use YouTube Data API (nếu có API key)
        # Hoặc dùng DuckDuckGo search với site:youtube.com

        if settings.YOUTUBE_API_KEY:
            # TODO: Implement YouTube Data API v3
            pass
        else:
            # Fallback: DuckDuckGo search
            search_query = f"{query} site:youtube.com"
            web_result = await web_search(search_query, max_results)

            videos = [
                {
                    "title": result["title"],
                    "url": result["url"],
                    "thumbnail": "",
                    "channel": "",
                    "views": 0
                }
                for result in web_result["results"]
                if "youtube.com" in result["url"]
            ]

            logger.info(f"✅ Found {len(videos)} YouTube videos")
            return {
                "query": query,
                "videos": videos
            }

    except Exception as e:
        logger.error(f"❌ Error searching YouTube: {e}")
        return {
            "query": query,
            "videos": [],
            "error": str(e)
        }


# ===== TOOL METADATA =====
if __name__ == "__main__":
    print("🔧 Research Tools registered in FastMCP:")
    print("  - web_search")
    print("  - extract_web_content")
    print("  - search_youtube_videos")
    print("\n📌 NOTE: Research Agent tìm bất cứ thứ gì trên web được Main Agent giao phó")


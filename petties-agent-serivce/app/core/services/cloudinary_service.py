"""
PETTIES AGENT SERVICE - Cloudinary Service
Service hÃ´Ìƒ trÆ¡Ì£ upload vÃ  quaÌ‰n lyÌ phiÌ le trÃªn Cloudinary.

Package: app.core.services
Version: v1.0.0
"""

import cloudinary
import cloudinary.uploader
from loguru import logger
from typing import Optional, Dict, Any
from app.config.settings import settings

class CloudinaryService:
    """
    Service upload và quản lý file trên Cloudinary cho AI Knowledge Base và các tính năng liên quan.
    Cung cấp phương thức upload file và xóa file, với cấu hình linh hoạt qua
    """

    def __init__(self):
        # Cấu hình Cloudinary từ settings
        if settings.CLOUDINARY_CLOUD_NAME and settings.CLOUDINARY_API_KEY:
            cloudinary.config(
                cloud_name=settings.CLOUDINARY_CLOUD_NAME,
                api_key=settings.CLOUDINARY_API_KEY,
                api_secret=settings.CLOUDINARY_API_SECRET,
                secure=True
            )
            logger.info("Cloudinary configured successfully for AI Service")
        else:
            logger.warning("Cloudinary configuration missing in AI Service")

    async def upload_file(
        self, 
        file_content: bytes, 
        filename: str, 
        folder: str = "ai_knowledge",
        resource_type: str = "auto"
    ) -> Optional[Dict[str, Any]]:
        """Upload file lên Cloudinary với cấu hình thư mục và loại tài nguyên linh hoạt.
        Sử dụng folder prefix "petties/" để tổ chức file theo backend.
        """
        try:
            # SÆ°Ì‰ duÌ£ng folder prefix "petties/" Ä‘ÃªÌ‰ thÃ´Ì ng nhÃ¢Ì t vÆ¡Ì i Backend
            cloudinary_folder = f"petties/{folder}"
            
            # Upload lÃªn Cloudinary
            upload_result = cloudinary.uploader.upload(
                file_content,
                folder=cloudinary_folder,
                public_id=filename.rsplit(".", 1)[0],
                resource_type=resource_type,
                overwrite=True
            )
            
            logger.info(f"Successfully uploaded file to Cloudinary: {filename}")
            return upload_result
            
        except Exception as e:
            logger.error(f"Failed to upload file to Cloudinary: {str(e)}")
            return None

    async def delete_file(self, public_id: str, resource_type: str = "raw") -> bool:
        """
        Xóa a file trên Cloudinary.
        """
        try:
            result = cloudinary.uploader.destroy(public_id, resource_type=resource_type)
            return result.get("result") == "ok"
        except Exception as e:
            logger.error(f"Failed to delete file from Cloudinary: {str(e)}")
            return False

# Global instance
cloudinary_service = CloudinaryService()

def get_cloudinary_service() -> CloudinaryService:
    return cloudinary_service

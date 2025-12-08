"""
PETTIES AGENT SERVICE - Logging Configuration
Setup logging cho toàn bộ application

Package: app.config
Purpose: Centralized logging configuration với file và console handlers
Version: v0.0.1
"""

import logging
import sys
from pathlib import Path
from logging.handlers import RotatingFileHandler


def setup_logging(log_level: str = "INFO", log_file: str = "./logs/agent_service.log"):
    """
    Setup logging configuration cho application

    Args:
        log_level: Logging level (DEBUG, INFO, WARNING, ERROR, CRITICAL)
        log_file: Path đến log file

    Purpose:
        - Console handler: Log ra terminal với colors (nếu có)
        - File handler: Log vào file với rotation (10MB, 5 backups)
        - Format: timestamp - logger name - level - message
    """

    # ===== CREATE LOG DIRECTORY =====
    log_path = Path(log_file)
    log_path.parent.mkdir(parents=True, exist_ok=True)

    # ===== LOGGING FORMAT =====
    log_format = "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    date_format = "%Y-%m-%d %H:%M:%S"

    # ===== ROOT LOGGER =====
    root_logger = logging.getLogger()
    root_logger.setLevel(log_level.upper())

    # Clear existing handlers
    root_logger.handlers.clear()

    # ===== CONSOLE HANDLER =====
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(log_level.upper())
    console_formatter = logging.Formatter(log_format, datefmt=date_format)
    console_handler.setFormatter(console_formatter)
    root_logger.addHandler(console_handler)

    # ===== FILE HANDLER (với rotation) =====
    # RotatingFileHandler: Tự động rotate khi file đạt maxBytes
    # maxBytes=10MB, backupCount=5 (giữ tối đa 5 backup files)
    file_handler = RotatingFileHandler(
        filename=log_file,
        maxBytes=10 * 1024 * 1024,  # 10 MB
        backupCount=5,
        encoding="utf-8",
    )
    file_handler.setLevel(log_level.upper())
    file_formatter = logging.Formatter(log_format, datefmt=date_format)
    file_handler.setFormatter(file_formatter)
    root_logger.addHandler(file_handler)

    # ===== SILENCE NOISY LOGGERS =====
    # Giảm noise từ các thư viện bên thứ ba
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)

    logging.info(f"✅ Logging configured: level={log_level}, file={log_file}")


if __name__ == "__main__":
    # Test logging configuration
    setup_logging(log_level="DEBUG")

    logger = logging.getLogger(__name__)
    logger.debug("This is a DEBUG message")
    logger.info("This is an INFO message")
    logger.warning("This is a WARNING message")
    logger.error("This is an ERROR message")
    logger.critical("This is a CRITICAL message")

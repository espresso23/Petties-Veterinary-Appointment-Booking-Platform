"""
PETTIES AGENT SERVICE - Logging Configuration
Setup logging cho toàn bộ application với Sentry integration

Package: app.config
Purpose: Centralized logging configuration với file, console, JSON handlers + Sentry
Version: v0.0.2
"""

import logging
import sys
import json
from pathlib import Path
from logging.handlers import RotatingFileHandler
from datetime import datetime
from typing import Optional


class JSONFormatter(logging.Formatter):
    """Custom JSON formatter cho structured logging"""
    
    def format(self, record: logging.LogRecord) -> str:
        log_obj = {
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "module": record.module,
            "function": record.funcName,
            "line": record.lineno,
        }
        
        # Add exception info if present
        if record.exc_info:
            log_obj["exception"] = self.formatException(record.exc_info)
        
        # Add extra fields
        if hasattr(record, "extra"):
            log_obj["extra"] = record.extra
            
        return json.dumps(log_obj, ensure_ascii=False)


def setup_sentry(sentry_dsn: str, environment: str = "development"):
    """
    Initialize Sentry for error tracking
    
    Args:
        sentry_dsn: Sentry DSN URL
        environment: Environment name (development, staging, production)
    """
    if not sentry_dsn:
        logging.warning("Sentry DSN not configured. Error tracking disabled.")
        return
    
    try:
        import sentry_sdk
        from sentry_sdk.integrations.fastapi import FastApiIntegration
        from sentry_sdk.integrations.logging import LoggingIntegration
        
        # Configure Sentry logging integration
        sentry_logging = LoggingIntegration(
            level=logging.INFO,        # Capture INFO and above
            event_level=logging.ERROR  # Send ERROR and above as events
        )
        
        sentry_sdk.init(
            dsn=sentry_dsn,
            environment=environment,
            integrations=[
                FastApiIntegration(),
                sentry_logging,
            ],
            traces_sample_rate=1.0,
            profiles_sample_rate=0.5,
            send_default_pii=False,  # GDPR compliance
        )
        
        logging.info(f"✅ Sentry initialized: environment={environment}")
        
    except ImportError:
        logging.warning("sentry-sdk not installed. Error tracking disabled.")
    except Exception as e:
        logging.error(f"Failed to initialize Sentry: {e}")


def setup_logging(
    log_level: str = "INFO",
    log_file: str = "./logs/agent_service.log",
    sentry_dsn: Optional[str] = None,
    environment: str = "development",
    enable_json_logging: bool = False,
):
    """
    Setup logging configuration cho application
    
    Args:
        log_level: Logging level (DEBUG, INFO, WARNING, ERROR, CRITICAL)
        log_file: Path đến log file
        sentry_dsn: Sentry DSN for error tracking (optional)
        environment: Environment name for Sentry
        enable_json_logging: Enable JSON format logging for file
    
    Features:
        - Console handler: Log ra terminal với colors
        - File handler: Log vào file với rotation (10MB, 5 backups)
        - JSON handler: Structured logging cho production (optional)
        - Sentry integration: Error tracking + Discord alerts
    """
    
    # ===== CREATE LOG DIRECTORY =====
    log_path = Path(log_file)
    log_path.parent.mkdir(parents=True, exist_ok=True)
    
    # ===== LOGGING FORMAT =====
    console_format = "%(asctime)s | %(levelname)-8s | %(name)s:%(lineno)d | %(message)s"
    file_format = "%(asctime)s | %(levelname)-8s | %(name)s:%(funcName)s:%(lineno)d | %(message)s"
    date_format = "%Y-%m-%d %H:%M:%S"
    
    # ===== ROOT LOGGER =====
    root_logger = logging.getLogger()
    root_logger.setLevel(log_level.upper())
    
    # Clear existing handlers
    root_logger.handlers.clear()
    
    # ===== CONSOLE HANDLER (with colors) =====
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(log_level.upper())
    console_formatter = logging.Formatter(console_format, datefmt=date_format)
    console_handler.setFormatter(console_formatter)
    root_logger.addHandler(console_handler)
    
    # ===== FILE HANDLER (với rotation) =====
    file_handler = RotatingFileHandler(
        filename=log_file,
        maxBytes=10 * 1024 * 1024,  # 10 MB
        backupCount=5,
        encoding="utf-8",
    )
    file_handler.setLevel(log_level.upper())
    
    if enable_json_logging:
        file_handler.setFormatter(JSONFormatter())
    else:
        file_handler.setFormatter(logging.Formatter(file_format, datefmt=date_format))
    
    root_logger.addHandler(file_handler)
    
    # ===== ERROR-ONLY FILE HANDLER =====
    error_log_file = log_file.replace(".log", "_errors.log")
    error_handler = RotatingFileHandler(
        filename=error_log_file,
        maxBytes=10 * 1024 * 1024,  # 10 MB
        backupCount=10,  # Keep more error logs
        encoding="utf-8",
    )
    error_handler.setLevel(logging.WARNING)
    error_handler.setFormatter(logging.Formatter(file_format, datefmt=date_format))
    root_logger.addHandler(error_handler)
    
    # ===== SILENCE NOISY LOGGERS =====
    noisy_loggers = [
        "uvicorn.access",
        "httpx",
        "httpcore",
        "asyncio",
        "watchfiles",
        "qdrant_client",
        "cohere",
        "openai",
        "urllib3",
        "charset_normalizer",
    ]
    for logger_name in noisy_loggers:
        logging.getLogger(logger_name).setLevel(logging.WARNING)
    
    # ===== SETUP SENTRY =====
    if sentry_dsn:
        setup_sentry(sentry_dsn, environment)
    
    logging.info(f"✅ Logging configured: level={log_level}, file={log_file}")
    if sentry_dsn:
        logging.info(f"✅ Error tracking: Sentry → Discord #monitoring")


def get_logger(name: str) -> logging.Logger:
    """
    Get a logger instance for a specific module
    
    Usage:
        from app.config.logging_config import get_logger
        log = get_logger(__name__)
        log.info("Hello world")
    """
    return logging.getLogger(name)


if __name__ == "__main__":
    # Test logging configuration
    setup_logging(
        log_level="DEBUG",
        enable_json_logging=False,
    )
    
    log = get_logger(__name__)
    log.debug("This is a DEBUG message")
    log.info("This is an INFO message")
    log.warning("This is a WARNING message")
    log.error("This is an ERROR message")
    log.critical("This is a CRITICAL message")
    
    # Test exception logging
    try:
        raise ValueError("Test exception for logging")
    except Exception as e:
        log.exception(f"Caught exception: {e}")

"""
PETTIES AGENT SERVICE - Base Tool Class
MCP-compatible tool base class for LangChain integration

Package: app.core.tools
Purpose: Base class for all agent tools
"""

from typing import Any, Dict, Optional
from pydantic import BaseModel, Field


class BaseTool(BaseModel):
    """
    Base class for all agent tools in Petties
    Compatible with FastMCP protocol and LangChain
    """
    
    name: str = Field(..., description="Tool name (unique identifier)")
    description: str = Field(..., description="Tool description for LLM")
    enabled: bool = Field(default=True, description="Whether tool is enabled")
    category: str = Field(default="general", description="Tool category")
    
    class Config:
        arbitrary_types_allowed = True
    
    def execute(self, **kwargs: Any) -> Dict[str, Any]:
        """
        Execute the tool with given parameters
        Override this method in subclasses
        """
        raise NotImplementedError("Subclasses must implement execute() method")
    
    def validate_params(self, params: Dict[str, Any]) -> bool:
        """
        Validate tool parameters before execution
        Override for custom validation logic
        """
        return True

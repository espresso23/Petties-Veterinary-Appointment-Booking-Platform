"""
PETTIES AGENT SERVICE - Token Budget Manager

Estimates and manages token usage to prevent context overflow.
Calculates available budget before sending to LLM.

Package: app.core.agents
Version: v1.0.0

Usage:
    budget = TokenBudgetManager(
        max_tokens=2000,
        reserved_tokens=500,  # For response
        model_context_window=128000,  # gemini context
    )

    estimated = budget.estimate_tokens("some text")
    if not budget.has_budget(prompt_tokens=estimated):
        # Summarize or truncate
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import List, Optional, Tuple



# Approximate tokens per character (Vietnamese text is ~2-3 chars per token)
# Using conservative estimate
DEFAULT_CHARS_PER_TOKEN = 3.5

# Model context windows
MODEL_CONTEXT_WINDOWS = {
    "gemini-2.0-flash-lite": 128000,
    "gemini-2.5-flash-lite": 128000,
    "gemini-2.5-pro": 128000,
    "gemini-pro": 128000,
    "llama-3.3-70b": 128000,
    "claude-3.5-sonnet": 200000,
    "default": 128000,
}


@dataclass
class BudgetCheckResult:
    """Result of budget check."""

    can_proceed: bool
    estimated_tokens: int
    available_tokens: int
    recommended_action: str  # "proceed", "summarize", "truncate"
    shortfall: Optional[int] = None


@dataclass
class TokenEstimate:
    """Token estimation result."""

    tokens: int
    chars: int
    method: str  # "exact", "approximate", "estimated"


class TokenBudgetManager:
    """
    Manages token budget for LLM prompts.

    Features:
    - Estimate tokens using multiple methods
    - Check budget before LLM call
    - Suggest actions when budget exceeded
    - Support for different model context windows
    """

    def __init__(
        self,
        max_response_tokens: int = 2000,
        reserved_tokens: int = 500,
        model_context_window: int = 128000,
        chars_per_token: float = DEFAULT_CHARS_PER_TOKEN,
        safety_margin: float = 0.9,  # Use 90% of available budget
    ):
        """
        Initialize budget manager.

        Args:
            max_response_tokens: Max tokens expected for response
            reserved_tokens: Buffer reserved for system overhead
            model_context_window: Model's max context window
            chars_per_token: Chars to token ratio for estimation
            safety_margin: Use only this fraction of available budget
        """
        self.max_response_tokens = max_response_tokens
        self.reserved_tokens = reserved_tokens
        self.model_context_window = model_context_window
        self.chars_per_token = chars_per_token
        self.safety_margin = safety_margin

    @property
    def available_budget(self) -> int:
        """Calculate available budget for input (total - response - reserved)."""
        return int(
            (
                self.model_context_window
                - self.max_response_tokens
                - self.reserved_tokens
            )
            * self.safety_margin
        )

    def estimate_tokens(self, text: str) -> int:
        """
        Estimate token count for text.

        Args:
            text: Input text

        Returns:
            Estimated token count
        """
        if not text:
            return 0

        return self._estimate_vietnamese(text)

    def _estimate_vietnamese(self, text: str) -> int:
        """
        Estimate tokens for Vietnamese text.

        Vietnamese text tends to have more tokens per character
        due to diacritics and compound words.
        """
        if not text:
            return 0

        # Remove excessive whitespace
        text = re.sub(r"\s+", " ", text).strip()

        # Vietnamese-specific adjustments:
        # - Count words (space-separated)
        # - Vietnamese words average ~2-3 chars
        words = text.split()
        word_count = len(words)

        # Estimate: words * 1.3 + special chars handling
        # Plus rough char count / chars_per_token

        # Method 1: Word-based estimate
        word_estimate = int(word_count * 1.3)

        # Method 2: Character-based estimate
        char_count = len(text)
        char_estimate = int(char_count / self.chars_per_token)

        # Use average of both (more accurate for mixed content)
        estimated = int((word_estimate + char_estimate) / 2)

        # Cap at reasonable minimum
        return max(1, estimated)

    def estimate_messages(self, messages: List[dict]) -> int:
        """
        Estimate total tokens for a list of messages.

        Args:
            messages: List of message dicts with 'role' and 'content'

        Returns:
            Total estimated tokens
        """
        total = 0

        # Each message has ~4 token overhead for role formatting
        MESSAGE_OVERHEAD = 4

        for msg in messages:
            if not isinstance(msg, dict):
                continue

            content = msg.get("content", "")
            if content:
                total += self.estimate_tokens(content) + MESSAGE_OVERHEAD

        return total

    def check_budget(
        self,
        estimated_tokens: int,
        additional_context: int = 0,
    ) -> BudgetCheckResult:
        """
        Check if estimated tokens fit within budget.

        Args:
            estimated_tokens: Estimated tokens for main content
            additional_context: Additional context tokens (system prompt, etc.)

        Returns:
            BudgetCheckResult with recommendation
        """
        total_needed = estimated_tokens + additional_context
        available = self.available_budget

        if total_needed <= available:
            return BudgetCheckResult(
                can_proceed=True,
                estimated_tokens=total_needed,
                available_tokens=available,
                recommended_action="proceed",
            )

        shortfall = total_needed - available
        return BudgetCheckResult(
            can_proceed=False,
            estimated_tokens=total_needed,
            available_tokens=available,
            recommended_action="summarize" if shortfall > 100 else "truncate",
            shortfall=shortfall,
        )

    def calculate_safe_truncation(
        self,
        text: str,
        max_tokens: Optional[int] = None,
    ) -> Tuple[str, int]:
        """
        Truncate text to fit within token budget.

        Args:
            text: Text to truncate
            max_tokens: Override max tokens (defaults to available_budget)

        Returns:
            Tuple of (truncated_text, tokens_saved)
        """
        if max_tokens is None:
            max_tokens = self.available_budget

        current_tokens = self.estimate_tokens(text)

        if current_tokens <= max_tokens:
            return text, 0

        # Binary search for correct truncation
        low, high = 0, len(text)

        while low < high:
            mid = (low + high + 1) // 2
            test_text = text[:mid]
            test_tokens = self.estimate_tokens(test_text)

            if test_tokens <= max_tokens:
                low = mid
            else:
                high = mid - 1

        truncated = text[:low]
        saved = current_tokens - self.estimate_tokens(truncated)

        return truncated, saved

    def suggest_compression_ratio(self, total_tokens: int) -> float:
        """
        Suggest compression ratio needed to fit budget.

        Args:
            total_tokens: Current token count

        Returns:
            Compression ratio (0.0 to 1.0)
        """
        available = self.available_budget
        if total_tokens <= available:
            return 1.0

        return available / total_tokens

    def format_budget_warning(
        self,
        result: BudgetCheckResult,
        text_sample: str = "",
    ) -> str:
        """
        Format budget warning message.

        Args:
            result: BudgetCheckResult
            text_sample: Optional text sample for debugging

        Returns:
            Formatted warning message
        """
        msg = (
            f"⚠️ Token budget exceeded: "
            f"estimated={result.estimated_tokens}, "
            f"available={result.available_tokens}, "
            f"shortfall={result.shortfall or 0}"
        )

        if text_sample:
            msg += f"\nSample: {text_sample[:100]}..."

        msg += f"\nRecommended action: {result.recommended_action}"

        return msg


def get_model_context_window(model_name: str) -> int:
    """
    Get context window for a model.

    Args:
        model_name: Model name (e.g., 'gemini-2.0-flash-lite')

    Returns:
        Context window in tokens
    """
    model_lower = model_name.lower()

    for key, window in MODEL_CONTEXT_WINDOWS.items():
        if key in model_lower:
            return window

    return MODEL_CONTEXT_WINDOWS["default"]


def estimate_tokens_simple(text: str) -> int:
    """
    Quick token estimate without creating manager instance.

    Uses simple character-based estimation.
    """
    if not text:
        return 0

    text = re.sub(r"\s+", " ", text).strip()
    return max(1, int(len(text) / DEFAULT_CHARS_PER_TOKEN))


# ============================================================================
# PROMPT BUILDER INTEGRATION
# ============================================================================


class PromptBudgetCalculator:
    """
    Calculates budget for prompt assembly.

    Integrates with prompt_builder to:
    - Track token usage during prompt assembly
    - Trigger summarization when needed
    - Format warnings
    """

    def __init__(
        self,
        max_tokens: int = 2000,
        model_context_window: int = 128000,
        system_prompt_tokens: int = 500,
        tools_tokens: int = 800,
    ):
        """
        Initialize calculator.

        Args:
            max_tokens: Max response tokens
            model_context_window: Model context window
            system_prompt_tokens: Estimated system prompt tokens
            tools_tokens: Estimated tools description tokens
        """
        self.budget = TokenBudgetManager(
            max_response_tokens=max_tokens,
            reserved_tokens=system_prompt_tokens + tools_tokens,
            model_context_window=model_context_window,
        )

    def calculate_available_for_context(
        self,
        context_parts: List[str],
    ) -> int:
        """
        Calculate available tokens for context given other prompt parts.

        Args:
            context_parts: List of context strings

        Returns:
            Available tokens for context
        """
        used = sum(self.budget.estimate_tokens(p) for p in context_parts)
        return max(0, self.budget.available_budget - used)

    def truncate_context_if_needed(
        self,
        context: str,
        available_tokens: Optional[int] = None,
    ) -> Tuple[str, bool, int]:
        """
        Truncate context to fit budget.

        Args:
            context: Context string
            available_tokens: Override available tokens

        Returns:
            Tuple of (truncated_context, was_truncated, tokens_saved)
        """
        if available_tokens is None:
            available_tokens = self.budget.available_budget

        current = self.budget.estimate_tokens(context)

        if current <= available_tokens:
            return context, False, 0

        truncated, saved = self.budget.calculate_safe_truncation(
            context, available_tokens
        )

        return truncated, True, saved


# ============================================================================
# SINGLETON INSTANCE
# ============================================================================

_default_calculator: Optional[PromptBudgetCalculator] = None


def get_budget_calculator(
    max_tokens: int = 2000,
    model_name: str = "gemini-2.0-flash-lite",
) -> PromptBudgetCalculator:
    """Get singleton budget calculator."""
    global _default_calculator

    if _default_calculator is None:
        context_window = get_model_context_window(model_name)
        _default_calculator = PromptBudgetCalculator(
            max_tokens=max_tokens,
            model_context_window=context_window,
        )

    return _default_calculator


def reset_budget_calculator() -> None:
    """Reset singleton (for testing)."""
    global _default_calculator
    _default_calculator = None

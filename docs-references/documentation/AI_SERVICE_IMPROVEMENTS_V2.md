# AI Service Improvements - Migration Guide

**Version:** v2.1.0
**Date:** 2026-03-24
**Components:** petties-agent-serivce

---

## Overview

This document describes the improvements made to the Petties AI Agent Service in version 2.1.0 and provides migration instructions.

## Changes Summary

### P1 - Critical Improvements

#### 1.1 Tool Parameter Handling (executor.py)
**Before:** Parameters not in schema were silently dropped
**After:** Dropped parameters are tracked and included in response with warning

**Migration:** No code changes required. Response now includes `_warning` and `_dropped_params` fields.

#### 1.2 Conversation Summarization (conversation_summarizer.py)
**New:** `ConversationSummarizer` service for compressing long chat histories

**Migration:** Optional - summarization is triggered automatically when conversation exceeds threshold.

#### 1.3 Token Budget Management (token_budget.py)
**New:** `TokenBudgetManager` and `PromptBudgetCalculator` for estimating and managing token usage

**Migration:** No code changes required. Budget checks are integrated into prompt building.

---

### P2 - Medium Improvements

#### 2.1 Async Context Manager (tool_runtime_context.py)
**Before:** Manual token management with ContextVar
**After:** AsyncContextManager pattern for safer async usage

**New API:**
```python
# Old way (still works for backward compatibility)
token = set_tool_runtime_context(context)
# ... use context
reset_tool_runtime_context(token)

# New way (recommended)
async with tool_runtime_context(context) as ctx:
    # use ctx
# context auto-cleared

# Or using class directly
async with ToolRuntimeContextManager(context) as ctx:
    # use ctx
```

**Migration:** Legacy functions still work. Consider migrating to new pattern.

#### 2.2 Persistent Checkpointer (postgres_checkpointer.py)
**New:** `PostgresCheckpointer` for persisting LangGraph state across restarts

**Migration:** Optional - add to your graph compilation:
```python
from app.core.agents.postgres_checkpointer import PostgresCheckpointer

checkpointer = PostgresCheckpointer(session_factory=async_session_maker)
graph = workflow.compile(checkpointer=checkpointer)
```

#### 2.3 Rate Limiting (rate_limiter.py)
**New:** `RateLimiter` with token bucket and sliding window algorithms

**Default Limits:**
- 30 requests per minute per user
- 10,000 tokens per minute (LLM budget)
- 200 requests per hour per session

**Migration:** Rate limiting is enabled by default. To customize:
```python
from app.core.middleware.rate_limiter import RateLimiter

limiter = RateLimiter(
    requests_per_minute=60,  # Increase limit
    tokens_per_minute=20000,
)
```

---

### P3 - Minor Improvements

#### 3.1 Tool Policy Registry (tool_policy.py)
**Before:** Hardcoded `allow_empty_params_tools` set in single_agent.py
**After:** Decorator-based policy system

**New API:**
```python
from app.core.tools.tool_policy import tool_policy, allow_empty_params

# Register policy with decorator
@tool_policy(allow_empty_params=True, requires_context=True)
@mcp_server.tool
async def my_tool(...):
    ...

# Check policy
if allow_empty_params("my_tool"):
    # handle empty params
```

**Migration:** Legacy hardcoded list still works. New tools should use decorator.

#### 3.2 Configurable Context Steps (prompt_builder.py)
**Status:** Retained as hardcoded constants - no settings needed

```python
MAX_CONTEXT_STEPS = 5
OBSERVATION_MAX_LENGTH = 1500
OBSERVATION_HEAD_LENGTH = 1000
OBSERVATION_TAIL_LENGTH = 200
```

**Migration:** No changes needed. Values are hardcoded in `prompt_builder.py`.

---

## New Files Added

```
petties-agent-serivce/app/
├── core/
│   ├── agents/
│   │   ├── conversation_summarizer.py   # P1-2
│   │   ├── token_budget.py                # P1-3
│   │   └── postgres_checkpointer.py      # P2-2
│   ├── tools/
│   │   ├── executor_state.py             # P1-1
│   │   └── tool_policy.py                # P3-1
│   └── middleware/
│       └── rate_limiter.py                # P2-3
```

## Updated Files

```
petties-agent-serivce/app/
├── core/
│   ├── tools/
│   │   ├── __init__.py                   # P1-1
│   │   └── executor.py                   # P1-1, P3-1
│   ├── agents/
│   │   ├── single_agent.py                # P3-1
│   │   └── prompt_builder.py             # P3-2
│   └── tool_runtime_context.py           # P2-1
├── config/
│   └── settings.py                       # P3-2
```

---

## Testing Recommendations

1. **Tool Execution:** Test tools with various parameter combinations
2. **Rate Limiting:** Verify 429 responses when limits exceeded
3. **Context Management:** Test async context manager with concurrent requests
4. **Token Budget:** Monitor token usage with long conversations

---

## Rollback Plan

If issues arise, these changes can be disabled:

1. **Rate Limiting:** Set `limiter.disable()` in development
2. **Summarization:** Override `should_summarize()` to return False
3. **Token Budget:** Use simpler estimation without budget checks

---

## Performance Considerations

- Token budget calculations add ~1-2ms per prompt
- Rate limiter uses in-memory storage (suitable for single instance)
- PostgreSQL checkpointer adds DB overhead (~5-10ms per checkpoint)
- Consider Redis for rate limiting in multi-instance deployments

---

## Future Considerations

1. **Redis-based Rate Limiter:** For multi-instance deployments
2. **Adaptive Summarization:** Trigger based on token budget
3. **Prompt Caching:** Cache frequently used prompts
4. **Tool Call Analytics:** Track tool usage patterns

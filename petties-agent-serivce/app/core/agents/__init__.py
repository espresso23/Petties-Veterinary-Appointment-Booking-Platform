"""Agent package exports with lazy heavy imports.

Keep lightweight modules importable in test and tooling environments where optional
runtime dependencies for the full agent stack may be missing.
"""

from app.core.agents.state import ReActState, ReActStep, create_initial_react_state

__all__ = [
    "SingleAgent",
    "ReActState",
    "ReActStep",
    "create_initial_react_state",
    "AgentFactory",
]


def __getattr__(name):
    if name == "SingleAgent":
        from app.core.agents.single_agent import SingleAgent

        return SingleAgent
    if name == "AgentFactory":
        from app.core.agents.factory import AgentFactory

        return AgentFactory
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")

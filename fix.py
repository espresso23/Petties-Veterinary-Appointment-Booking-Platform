import os


def fix_file(path):
    with open(path, "r", encoding="utf-8") as f:
        c = f.read()
    c = c.replace("\\n", "\n")
    with open(path, "w", encoding="utf-8") as f:
        f.write(c)


fix_file("petties-agent-serivce/app/core/tools/mcp_tools/__init__.py")
fix_file("petties-agent-serivce/app/core/tools/tool_policy.py")
fix_file("petties-agent-serivce/app/core/context_policy.py")

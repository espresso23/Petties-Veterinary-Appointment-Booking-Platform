import os

FILE_PATH = "d:/SEP490/petties/petties-agent-serivce/app/core/tools/mcp_tools/booking_tools.py"

with open(FILE_PATH, "r", encoding="utf-8") as f:
    lines = f.readlines()

out_lines = []
in_ui_card = False
brace_count = 0

for line in lines:
    if not in_ui_card and '"ui_card": {' in line:
        in_ui_card = True
        brace_count = line.count('{') - line.count('}')
        continue
        
    if in_ui_card:
        brace_count += line.count('{') - line.count('}')
        if brace_count <= 0:
            in_ui_card = False
            # Check if there's trailing comma or whatever on this line? usually '    },\n'
            # Just ignore it
        continue
        
    out_lines.append(line)

with open(FILE_PATH, "w", encoding="utf-8") as f:
    f.writelines(out_lines)

print("Removed all ui_card blocks")

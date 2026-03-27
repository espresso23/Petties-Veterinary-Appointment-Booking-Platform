import sys
import os

file_path = r'd:\SEP490\petties\petties-agent-serivce\app\core\agents\single_agent.py'

with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

output = []
i = 0
while i < len(lines):
    line = lines[i]
    
    # Patch _think_node return
    if 'return {' in line and i > 570 and i < 590:
        output.append(line) # return {
        output.append('                "react_steps": [step],\n')
        output.append('                "current_thought": parsed.get("thought", thought_content),\n')
        output.append('                "pending_tool_call": pending_tool_call,\n')
        output.append('                "should_end": should_end,\n')
        output.append('                "final_answer": final_answer,\n')
        output.append('                "iteration": iteration + 1,\n')
        output.append('                "stage": "COLLECTING" if pending_tool_call else ("IDLE" if should_end and state.get("stage") == "PRESENTING" else state.get("stage", "IDLE")),\n')
        output.append('            }\n')
        # Skip until closing brace
        while i < len(lines) and '}' not in lines[i]:
            i += 1
    
    # Patch _observe_node return
    elif 'return {' in line and i > 730 and i < 740:
        output.append(line)
        output.append('            "react_steps": [step],\n')
        output.append('            "current_observation": observation,\n')
        output.append('            "stage": "BOOKED" if observed_tool_name == "create_booking_for_user" and tool_result.get("success") else ("CONFIRMING" if observed_tool_name == "check_available_slots" and tool_result.get("success") else "PRESENTING"),\n')
        output.append('        }\n')
        while i < len(lines) and '}' not in lines[i]:
            i += 1
            
    else:
        output.append(line)
    
    i += 1

with open(file_path, 'w', encoding='utf-8') as f:
    f.writelines(output)

print("Succesfully patched single_agent.py")

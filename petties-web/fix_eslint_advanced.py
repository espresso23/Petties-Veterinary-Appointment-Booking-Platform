#!/usr/bin/env python3
"""
Advanced ESLint fixer for petties-web
Handles complex patterns like unused error variables, any types, etc.
"""

import re
from pathlib import Path

def fix_unused_error_in_catch(content):
    """
    Fix unused 'error' or 'err' variables in catch blocks
    catch (error) { ... } where error is never used -> catch { ... }
    """
    lines = content.split('\n')
    result = []
    i = 0

    while i < len(lines):
        line = lines[i]

        # Check for catch (error) or catch (err)
        catch_match = re.search(r'catch\s*\((\w+)\)', line)
        if catch_match:
            var_name = catch_match.group(1)

            # Look ahead in the catch block to see if variable is used
            block_content = []
            j = i + 1
            brace_count = 0
            found_opening = False

            # Find the opening brace
            temp_line = line
            while '{' not in temp_line and j < len(lines):
                temp_line += ' ' + lines[j]
                j += 1

            if '{' in temp_line:
                found_opening = True
                brace_count = temp_line.count('{') - temp_line.count('}')
                block_start = j

                # Collect lines until closing brace
                while brace_count > 0 and j < len(lines):
                    block_line = lines[j]
                    block_content.append(block_line)
                    brace_count += block_line.count('{') - block_line.count('}')
                    j += 1

                # Check if variable is used in the block
                block_text = '\n'.join(block_content)

                # Check if variable is actually referenced (not just in comments)
                # Remove comments first
                block_no_comments = re.sub(r'//.*$', '', block_text, flags=re.MULTILINE)
                block_no_comments = re.sub(r'/\*.*?\*/', '', block_no_comments, flags=re.DOTALL)

                # Check for variable usage (word boundary to avoid false positives)
                var_pattern = r'\b' + re.escape(var_name) + r'\b'
                if not re.search(var_pattern, block_no_comments):
                    # Variable is not used, remove it from catch
                    line = re.sub(r'catch\s*\(\w+\)', 'catch', line)

        result.append(line)
        i += 1

    return '\n'.join(result)

def fix_explicit_any_in_functions(content):
    """
    Fix explicit any in function parameters and variables
    Look for patterns like: (param: any) and replace with proper type or unknown
    """
    # Fix function parameters with any
    # For now, replace with unknown for safety
    content = re.sub(r'(\w+):\s*any\s*\)', r'\1: unknown)', content)
    content = re.sub(r'(\w+):\s*any\s*,', r'\1: unknown,', content)
    content = re.sub(r'(\w+):\s*any\s*=', r'\1: unknown =', content)

    return content

def add_eslint_disable_for_set_state_in_effect(content):
    """
    Add eslint-disable-next-line comment for setState in useEffect
    """
    lines = content.split('\n')
    result = []
    i = 0

    while i < len(lines):
        line = lines[i]

        # Check if next lines have useEffect
        if i + 1 < len(lines) and 'useEffect' in lines[i + 1]:
            # Look ahead to see if there's setState call in the effect
            j = i + 1
            effect_lines = []
            brace_count = 0

            while j < len(lines) and (brace_count > 0 or 'useEffect' in lines[j]):
                effect_lines.append(lines[j])
                brace_count += lines[j].count('{') - lines[j].count('}')
                j += 1
                if brace_count == 0 and len(effect_lines) > 1:
                    break

            effect_text = '\n'.join(effect_lines)

            # Check if setState is called directly in effect
            if re.search(r'set\w+\(', effect_text) and '{' in effect_text:
                # Check if already has eslint-disable
                if i > 0 and 'eslint-disable' not in lines[i] and 'eslint-disable' not in lines[i-1]:
                    # Add the disable comment
                    indent = re.match(r'^(\s*)', lines[i+1]).group(1)
                    result.append(line)
                    result.append(f'{indent}// eslint-disable-next-line react-hooks/set-state-in-effect')
                    i += 1
                    continue

        result.append(line)
        i += 1

    return '\n'.join(result)

def fix_file(file_path):
    """Fix a single file"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()

        original = content

        # Apply fixes
        content = fix_unused_error_in_catch(content)

        # Only write if changed
        if content != original:
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(content)
            return True
    except Exception as e:
        print(f"Error processing {file_path}: {e}")
    return False

def main():
    """Main function"""
    src_path = Path('src')
    fixed_count = 0

    for file_path in src_path.rglob('*.ts*'):
        if file_path.suffix in ['.ts', '.tsx']:
            if fix_file(file_path):
                print(f"Fixed: {file_path}")
                fixed_count += 1

    print(f"\nTotal files fixed: {fixed_count}")

if __name__ == '__main__':
    main()

#!/usr/bin/env python3
"""
Script để tự động fix các lỗi ESLint phổ biến trong petties-web
"""

import re
import os
from pathlib import Path

def fix_catch_any(content):
    """Fix catch (error: any) -> catch (error)"""
    content = re.sub(r'catch\s*\(\s*error\s*:\s*any\s*\)', 'catch (error)', content)
    content = re.sub(r'catch\s*\(\s*err\s*:\s*any\s*\)', 'catch (err)', content)
    content = re.sub(r'catch\s*\(\s*e\s*:\s*any\s*\)', 'catch (e)', content)
    return content

def fix_unused_error(content):
    """Fix unused error variables in catch blocks"""
    # Replace 'error' with '_error' if it's defined but never used
    # This is a simple heuristic - we look for catch (error) followed by no error usage
    lines = content.split('\n')
    result = []
    i = 0
    while i < len(lines):
        line = lines[i]
        # Check for catch (error) or catch (err) that's never used
        if re.search(r'catch\s*\(\s*error\s*\)', line):
            # Look ahead to see if 'error' is used in the next few lines
            block_end = min(i + 10, len(lines))
            block = '\n'.join(lines[i+1:block_end])
            if 'error' not in block or block.strip().startswith('//'):
                line = re.sub(r'catch\s*\(\s*error\s*\)', 'catch {', line)
        elif re.search(r'catch\s*\(\s*err\s*\)', line):
            block_end = min(i + 10, len(lines))
            block = '\n'.join(lines[i+1:block_end])
            if 'err' not in block or block.strip().startswith('//'):
                line = re.sub(r'catch\s*\(\s*err\s*\)', 'catch {', line)
        result.append(line)
        i += 1
    return '\n'.join(result)

def fix_file(file_path):
    """Fix a single TypeScript/TSX file"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()

        original = content

        # Apply fixes
        content = fix_catch_any(content)
        content = fix_unused_error(content)

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

    # Find all .ts and .tsx files
    for file_path in src_path.rglob('*.ts*'):
        if file_path.suffix in ['.ts', '.tsx']:
            if fix_file(file_path):
                print(f"Fixed: {file_path}")
                fixed_count += 1

    print(f"\nTotal files fixed: {fixed_count}")

if __name__ == '__main__':
    main()

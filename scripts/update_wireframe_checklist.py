#!/usr/bin/env python3
"""
Update WIREFRAME_CHECKLIST.md with new Stitch IDs.

Usage:
    python scripts/update_wireframe_checklist.py --screen "Pet Detail Screen" --stitch-id "abc123..."
    python scripts/update_wireframe_checklist.py --screen "Pet Detail Screen" --stitch-id "abc123..." --type design
"""

import argparse
import re
import sys
from pathlib import Path


def update_checklist(
    screen_name: str,
    stitch_id: str,
    checklist_path: str,
    update_type: str = "wireframe",
):
    """Update the wireframe checklist with new Stitch ID."""

    checklist_file = Path(checklist_path)

    if not checklist_file.exists():
        print(f"❌ Error: Checklist file not found at {checklist_path}")
        sys.exit(1)

    print(f"📄 Loading checklist: {checklist_path}")

    content = checklist_file.read_text(encoding="utf-8")

    # Pattern to find the screen
    pattern = rf"(?m)^(- \[[ -]\]) \*\*{re.escape(screen_name)}\*\*"

    match = re.search(pattern, content)

    if not match:
        print(f"❌ Screen not found: {screen_name}")
        print("   Available screens:")

        # List all screens
        screens = re.findall(r"^- \[.\] \*\*(.+?)\*\*", content, re.MULTILINE)
        for screen in screens[:10]:  # Show first 10
            print(f"   - {screen}")

        sys.exit(1)

    print(f"✅ Found screen: {screen_name}")

    # Check if already completed
    completed_pattern = rf"(?m)^(- \[x\]) \*\*{re.escape(screen_name)}\*\*"
    is_completed = re.search(completed_pattern, content)

    if is_completed and update_type == "wireframe":
        print("ℹ️  Screen already marked as completed")

        # Check if we need to add Design ID
        if (
            "Design Stitch ID:"
            in content[is_completed.start() : is_completed.start() + 500]
        ):
            print(f"   Wireframe ID already recorded")
        else:
            print(f"   Add Design ID with --type design")

    elif update_type == "design" and is_completed:
        # Add Design ID to existing entry
        # First, rename existing Stitch ID to Wireframe Stitch ID if needed
        content = re.sub(
            rf"(?m)(- \[x\] \*\*{re.escape(screen_name)}\*\*.*?)\n  - Stitch ID:",
            r"\1\n  - Wireframe Stitch ID:",
            content,
        )

        # Add Design Stitch ID
        content = re.sub(
            rf"(?m)(- \[x\] \*\*{re.escape(screen_name)}\*\*.*?)\n  - Code:",
            rf"\1\n  - Design Stitch ID: `{stitch_id}`\n  - Code:",
            content,
        )

        checklist_file.write_text(content, encoding="utf-8")
        print(f"✅ Added Design Stitch ID: {stitch_id}")

    else:
        # Mark as completed and add Stitch ID
        content = re.sub(
            rf"(?m)^(- \[ \]) \*\*{re.escape(screen_name)}\*\*",
            f"- [x] **{screen_name}**",
            content,
        )

        # Add Stitch ID after screen name
        content = re.sub(
            rf"(?m)(- \[x\] \*\*{re.escape(screen_name)}\*\*.*?)(\n  - Code:)",
            rf"\1\n  - Stitch ID: `{stitch_id}`\2",
            content,
        )

        checklist_file.write_text(content, encoding="utf-8")
        print(f"✅ Updated checklist:")
        print(f"   Screen: {screen_name}")
        print(f"   Status: Completed")
        print(f"   Stitch ID: {stitch_id}")

    print("\n" + "=" * 50)
    print("✅ Checklist updated successfully!")
    print("=" * 50)

    if update_type == "wireframe":
        print("\nNext steps:")
        print("  1. Review wireframe in Stitch")
        print("  2. Generate full-color design: @petties-stitch-design")
        print("  3. Update with Design ID: --type design")
    else:
        print("\nNext steps:")
        print("  1. Review full-color design")
        print("  2. Implement code with: @petties-flutter or @petties-web-frontend")


def main():
    parser = argparse.ArgumentParser(
        description="Update wireframe checklist with Stitch IDs"
    )
    parser.add_argument(
        "--screen",
        required=True,
        help="Screen name to update (e.g., 'Pet Detail Screen')",
    )
    parser.add_argument(
        "--stitch-id", required=True, help="Stitch ID from generated wireframe/design"
    )
    parser.add_argument(
        "--type",
        choices=["wireframe", "design"],
        default="wireframe",
        help="Type of update (wireframe or design)",
    )
    parser.add_argument(
        "--checklist",
        default="docs-references/documentation/SRS/WIREFRAME_CHECKLIST.md",
        help="Path to checklist file",
    )

    args = parser.parse_args()

    update_checklist(
        screen_name=args.screen,
        stitch_id=args.stitch_id,
        checklist_path=args.checklist,
        update_type=args.type,
    )


if __name__ == "__main__":
    main()

from app.core.tools.fastmcp_app import mcp_server


def main() -> None:
    mcp_server.run(transport="stdio", show_banner=False)


if __name__ == "__main__":
    main()
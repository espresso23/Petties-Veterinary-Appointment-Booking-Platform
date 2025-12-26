"""
Quick script to debug Qdrant collection
Run this to check what's in Qdrant
"""
import requests
import json

# API endpoint
url = "http://localhost:8000/api/v1/knowledge/debug/qdrant"

try:
    response = requests.get(url)
    response.raise_for_status()

    data = response.json()

    print("=" * 80)
    print("QDRANT DEBUG INFO")
    print("=" * 80)

    print(f"\nCollection exists: {data.get('exists', False)}")
    print(f"Collection name: {data.get('collection_name', 'N/A')}")
    print(f"Expected dimension: {data.get('expected_dimension', 'N/A')}")

    if data.get('collection_info'):
        info = data['collection_info']
        print(f"\nCollection info:")
        print(f"  - Points count: {info.get('points_count', 0)}")
        print(f"  - Vectors config: {info.get('vectors_config', 'N/A')}")
        print(f"  - Status: {info.get('status', 'unknown')}")

    if data.get('sample_points'):
        print(f"\nSample points ({len(data['sample_points'])} total):")
        for i, point in enumerate(data['sample_points'], 1):
            print(f"\n  Point {i}:")
            print(f"    ID: {point.get('id', 'N/A')}")
            print(f"    Vector length: {point.get('vector_length', 0)}")
            if point.get('payload'):
                payload = point['payload']
                print(f"    Document ID: {payload.get('document_id', 'N/A')}")
                print(f"    Document name: {payload.get('document_name', 'N/A')}")
                print(f"    Chunk index: {payload.get('chunk_index', 'N/A')}")
                content = payload.get('content', '')
                print(f"    Content preview: {content[:100]}...")
    else:
        print("\nNo sample points found!")

    print("\n" + "=" * 80)

except requests.exceptions.RequestException as e:
    print(f"Error calling API: {e}")
except Exception as e:
    print(f"Error: {e}")

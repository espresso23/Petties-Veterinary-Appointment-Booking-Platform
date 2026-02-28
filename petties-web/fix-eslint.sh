#!/bin/bash

# Tệp script để fix các lỗi ESLint phổ biến

# Fix các file có catch (error: any) - thay bằng catch (error)
find src -name "*.tsx" -o -name "*.ts" | while read file; do
    if grep -q "catch (error: any)" "$file"; then
        sed -i 's/catch (error: any)/catch (error)/g' "$file"
        echo "Fixed catch any in: $file"
    fi
    if grep -q "catch (err: any)" "$file"; then
        sed -i 's/catch (err: any)/catch (err)/g' "$file"
        echo "Fixed catch any (err) in: $file"
    fi
done

echo "Done fixing catch blocks"
